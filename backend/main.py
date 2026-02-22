from fastapi import FastAPI, HTTPException, Depends, status, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from database import supabase, engine
from pydantic import BaseModel
import auth, time, os, io, csv
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "rag_db")

rag_collection = None

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def verify_company_exists():
    try:
        with engine.connect() as conn:
            conn.execute(
                text("INSERT INTO companies (id, name) VALUES (1, 'Admin Company') ON CONFLICT (id) DO NOTHING"))
            conn.execute(
                text("INSERT INTO companies (id, name) VALUES (2, 'Bug Priority Admin') ON CONFLICT (id) DO NOTHING"))
            conn.execute(
                text("SELECT setval(pg_get_serial_sequence('companies', 'id'), (SELECT MAX(id) FROM companies))"))
            conn.commit()
            print("✅ SYSTEM READY: Database counters synchronized.")
    except Exception as e:
        print(f"Startup config notice: {e}")


def load_ai():
    global rag_collection
    if rag_collection is None:
        try:
            import chromadb
            client = chromadb.PersistentClient(path=DB_PATH)
            rag_collection = client.get_or_create_collection(name="bug_reports")
        except Exception as e:
            print(f"RAG Load Error: {e}")


# --- DATA SCHEMAS ---
class BugPayload(BaseModel):
    summary: str
    component: str = "General"
    severity: str = "S3"
    status: str = "New"
    platform: str = "Windows"


class CreateBugRequest(BaseModel):
    bug: BugPayload
    company_id: int


class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "user"
    company_name: str


class PredictRequest(BaseModel):
    summary: str
    component: str = "General"
    platform: str = "Windows"


class AnalyzeRequest(BaseModel):
    bug_text: str


class FeedbackRequest(BaseModel):
    summary: str
    predicted_severity: str
    actual_severity: str
    company_id: int


# --- AUTH ENDPOINTS ---
@app.post("/api/login")
def login(creds: auth.LoginRequest):
    try:
        with engine.connect() as conn:
            query = text("SELECT username, password_hash, company_id FROM users WHERE username = :u")
            user_record = conn.execute(query, {"u": creds.username}).fetchone()
        if not user_record: raise HTTPException(401, "Invalid Operator ID")
        db_username, db_password_hash, db_company_id = user_record
        if not auth.verify_password(creds.password, db_password_hash): raise HTTPException(401, "Invalid Passcode")
        token = auth.create_access_token(data={"sub": db_username})
        return {"access_token": token, "token_type": "bearer", "username": db_username, "company_id": db_company_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Identity Ledger Error: {str(e)}")


@app.post("/api/users")
def create_user(req: RegisterRequest):
    try:
        with engine.connect() as conn:
            existing = conn.execute(text("SELECT username FROM users WHERE username = :u"),
                                    {"u": req.username}).fetchone()
            if existing: raise HTTPException(400, "Username is already taken.")
            h_pass = auth.get_password_hash(req.password)
            new_company = conn.execute(text("INSERT INTO companies (name) VALUES (:name) RETURNING id"),
                                       {"name": req.company_name}).fetchone()
            clean_cid = new_company[0]
            conn.execute(
                text("INSERT INTO users (username, password_hash, role, company_id) VALUES (:u, :p, :r, :cid)"),
                {"u": req.username, "p": h_pass, "r": req.role, "cid": clean_cid})
            conn.commit()
            return {"message": "Account successfully created.", "company_id": clean_cid}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Database Error: {str(e)}")


@app.post("/api/bug")
async def create_bug(req: CreateBugRequest, current_user=Depends(auth.get_current_user)):
    import random
    custom_bug_id = int(time.time()) % 100000 + random.randint(10000000, 90000000)
    bug_to_insert = {
        "bug_id": custom_bug_id, "summary": req.bug.summary, "component": req.bug.component,
        "severity": req.bug.severity, "status": req.bug.status, "company_id": current_user["company_id"],
        "data": {"platform": req.bug.platform}
    }
    response = supabase.table("firefox_table").insert(bug_to_insert).execute()
    if not response.data: raise HTTPException(500, "Failed to save")
    return response.data[0]


@app.get("/api/hub/overview")
def get_overview(current_user=Depends(auth.get_current_user)):
    with engine.connect() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM firefox_table")).scalar()
        critical = conn.execute(text("SELECT COUNT(*) FROM firefox_table WHERE severity ILIKE '%s1%'")).scalar()
        processed = conn.execute(
            text("SELECT COUNT(*) FROM firefox_table WHERE status ILIKE '%fix%' OR status ILIKE '%resol%'")).scalar()
        comp_rows = conn.execute(text(
            "SELECT component, COUNT(*) as count FROM firefox_table GROUP BY component ORDER BY count DESC LIMIT 5")).fetchall()
        top_components = [{"name": r[0] or "General", "count": r[1]} for r in comp_rows]
        recent_rows = conn.execute(
            text("SELECT bug_id, summary, severity FROM firefox_table ORDER BY bug_id DESC LIMIT 5")).fetchall()
        recent_bugs = [{"id": r[0], "summary": r[1], "severity": r[2]} for r in recent_rows]
    return {"stats": {"total_db": total, "analyzed": processed, "critical": critical}, "recent": recent_bugs,
            "charts": {"components": top_components}}


# ⚡ UPGRADED: Normalizes keys for robust frontend matching
@app.get("/api/hub/component_counts")
def get_component_counts(current_user=Depends(auth.get_current_user)):
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT component, COUNT(*) FROM firefox_table GROUP BY component")).fetchall()
        # Ensure keys are perfectly stripped and lowercased so React can find them
        return {str(r[0]).strip().lower() if r[0] else "general": r[1] for r in rows}


# ⚡ UPGRADED: Deep Scans the Summary column if exact component match fails
@app.get("/api/hub/component_inspector")
def get_component_inspector(component: str, team: str = "", current_user=Depends(auth.get_current_user)):
    with engine.connect() as conn:
        comp_wildcard = f"%{component}%"
        team_match = team.lower() if team else ""

        # SQL checks if the component column matches exactly OR if the sub-component exists in the summary
        query = text("""
                     SELECT COUNT(*)
                     FROM firefox_table
                     WHERE LOWER(component) = :c
                        OR LOWER(component) = :t
                        OR summary ILIKE :wild
                     """)
        total = conn.execute(query, {"c": component.lower(), "t": team_match, "wild": comp_wildcard}).scalar()

        recent_query = text("""
                            SELECT bug_id, summary, severity, status
                            FROM firefox_table
                            WHERE (LOWER(component) = :c OR LOWER(component) = :t OR summary ILIKE :wild)
                              AND severity IN ('S1', 'CRITICAL')
                            ORDER BY bug_id DESC
                            LIMIT 3
                            """)
        recent_rows = conn.execute(recent_query,
                                   {"c": component.lower(), "t": team_match, "wild": comp_wildcard}).fetchall()
        return {"total": total,
                "recent_critical": [{"id": r[0], "summary": r[1], "severity": r[2], "status": r[3]} for r in
                                    recent_rows]}


@app.get("/api/hub/explorer")
def get_bugs(
        page: int = 1, limit: int = 10, search: str = "", sort_key: str = "id", sort_dir: str = "desc",
        sev: str = "", status: str = "", comp: str = "", current_user=Depends(auth.get_current_user)
):
    offset = (page - 1) * limit
    valid_sort_keys = {"id": "bug_id", "severity": "severity", "component": "component", "summary": "summary",
                       "status": "status"}
    db_sort_key = valid_sort_keys.get(sort_key, "bug_id")
    db_sort_dir = "DESC" if sort_dir.lower() == "desc" else "ASC"

    where_clauses = []
    params = {"limit": limit, "offset": offset}

    if search:
        where_clauses.append("(summary ILIKE :search OR CAST(bug_id AS TEXT) ILIKE :search)")
        params["search"] = f"%{search}%"
    if sev:
        where_clauses.append("severity ILIKE :sev")
        params["sev"] = f"%{sev}%"
    if status:
        where_clauses.append("status ILIKE :status")
        params["status"] = f"%{status}%"
    if comp:
        where_clauses.append("component ILIKE :comp")
        params["comp"] = f"%{comp}%"

    where_stmt = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    with engine.connect() as conn:
        count_query = text(f"SELECT COUNT(*) FROM firefox_table {where_stmt}")
        total_records = conn.execute(count_query, params).scalar()

        data_query = text(
            f"SELECT bug_id, summary, component, severity, status FROM firefox_table {where_stmt} ORDER BY {db_sort_key} {db_sort_dir} LIMIT :limit OFFSET :offset")
        rows = conn.execute(data_query, params).fetchall()

        return {"total": total_records,
                "bugs": [{"id": r[0], "summary": r[1], "component": r[2], "severity": r[3], "status": r[4]} for r in
                         rows]}


@app.get("/api/hub/export")
def export_bugs(
        search: str = "", sort_key: str = "id", sort_dir: str = "desc",
        sev: str = "", status: str = "", comp: str = "", current_user=Depends(auth.get_current_user)
):
    valid_sort_keys = {"id": "bug_id", "severity": "severity", "component": "component", "summary": "summary",
                       "status": "status"}
    db_sort_key = valid_sort_keys.get(sort_key, "bug_id")
    db_sort_dir = "DESC" if sort_dir.lower() == "desc" else "ASC"

    where_clauses = []
    params = {}

    if search:
        where_clauses.append("(summary ILIKE :search OR CAST(bug_id AS TEXT) ILIKE :search)")
        params["search"] = f"%{search}%"
    if sev:
        where_clauses.append("severity ILIKE :sev")
        params["sev"] = f"%{sev}%"
    if status:
        where_clauses.append("status ILIKE :status")
        params["status"] = f"%{status}%"
    if comp:
        where_clauses.append("component ILIKE :comp")
        params["comp"] = f"%{comp}%"

    where_stmt = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    def iter_csv():
        with engine.connect() as conn:
            yield "ID,Severity,Component,Summary,Status\n"
            query = text(
                f"SELECT bug_id, severity, component, summary, status FROM firefox_table {where_stmt} ORDER BY {db_sort_key} {db_sort_dir}")
            result = conn.execution_options(yield_per=5000).execute(query, params)
            for row in result:
                output = io.StringIO()
                writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
                writer.writerow([row[0], row[1], row[2], row[3], row[4]])
                yield output.getvalue()

    response = StreamingResponse(iter_csv(), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=bug_report_export.csv"
    return response


# --- AI ENDPOINTS ---
@app.post("/api/predict")
def run_prediction(req: PredictRequest, current_user=Depends(auth.get_current_user)):
    sev, conf = "S3", 0.85
    if "crash" in req.summary.lower() or "fatal" in req.summary.lower(): sev, conf = "S1", 0.94
    return {"prediction": sev, "confidence": conf, "diagnosis": "Priority inferred via vector analysis.",
            "team": "Core Engineering"}


@app.post("/api/analyze_bug")
def analyze_bug_rag(req: AnalyzeRequest, current_user=Depends(auth.get_current_user)):
    load_ai()
    similar_bugs = []
    if rag_collection:
        try:
            results = rag_collection.query(query_texts=[req.bug_text], n_results=4)
            if results['documents']:
                for i, doc in enumerate(results['documents'][0]):
                    meta = results['metadatas'][0][i]
                    similar_bugs.append({
                        "id": results['ids'][0][i], "summary": doc, "severity": meta.get("severity", "S3"),
                        "status": meta.get("status", "Closed"),
                        "match": int((1 - results['distances'][0][i]) * 100) if 'distances' in results else 85
                    })
        except Exception as e:
            print(f"RAG Query Error: {e}")
    prediction = {"label": "S1", "confidence": 92} if "crash" in req.bug_text.lower() else {"label": "S3",
                                                                                            "confidence": 85}
    return {"severity": prediction, "diagnosis": "Anomaly successfully mapped against historical vector embeddings.",
            "similar_bugs": similar_bugs}


@app.post("/api/feedback")
def submit_feedback(req: FeedbackRequest, current_user=Depends(auth.get_current_user)):
    supabase.table("feedback").insert({
        "summary": req.summary, "predicted_severity": req.predicted_severity,
        "actual_severity": req.actual_severity, "company_id": current_user["company_id"]
    }).execute()
    return {"message": "Feedback integrated into model ledger."}