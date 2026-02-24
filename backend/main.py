from fastapi import FastAPI, HTTPException, Depends, Form, File, UploadFile, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import os, joblib, pandas as pd, io, csv, subprocess, sys, json
import auth
from database import supabase, SUPABASE_URL, SUPABASE_KEY
from supabase import create_client
from ml_logic import predict_severity, force_reload_models

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "rf_model.pkl")
VECTOR_PATH = os.path.join(BASE_DIR, "tfidf_vectorizer.pkl")
rf_model = None
vectorizer = None


def load_models():
    global rf_model, vectorizer
    try:
        if os.path.exists(MODEL_PATH) and os.path.exists(VECTOR_PATH):
            rf_model = joblib.load(MODEL_PATH)
            vectorizer = joblib.load(VECTOR_PATH)
            print("AI Models loaded successfully.")
    except Exception as e:
        print(f"AI Load Error: {e}")


app = FastAPI()
load_models()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"],
                   allow_headers=["*"])


class BugPayload(BaseModel):
    summary: str
    component: str = "General"
    severity: str = "S3"
    status: str = "NEW"
    platform: str = "Windows"


class CreateBugRequest(BaseModel):
    bug: BugPayload
    company_id: int


class PredictPayload(BaseModel):
    summary: str
    component: str = "Frontend"
    platform: str = "Windows"


class FeedbackPayload(BaseModel):
    summary: str
    predicted_severity: str
    actual_severity: str
    company_id: int


class UserRegister(BaseModel):
    username: str
    password: str
    role: str = "user"
    company_name: str = "Unknown"


@app.post("/api/login")
def login(creds: auth.LoginRequest):
    response = supabase.table("users").select("*").eq("username", creds.username).execute()
    user = response.data[0] if response.data else None
    if not user or not auth.verify_password(creds.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = auth.create_access_token(
        data={"sub": user["username"], "company_id": user["company_id"], "role": user.get("role", "user")})
    return {"access_token": token, "token_type": "bearer", "username": user["username"],
            "company_id": user["company_id"]}


@app.post("/api/users")
def create_user(req: UserRegister):
    hashed_pwd = auth.get_password_hash(req.password)

    # 1. Fetch the highest company_id currently in the database
    res = supabase.table("users").select("company_id").order("company_id", desc=True).limit(1).execute()

    # 2. Sequentially add 1 to the highest ID. If no users exist, default to 3.
    if res.data and res.data[0].get("company_id") is not None:
        new_company_id = res.data[0]["company_id"] + 1
    else:
        new_company_id = 3

    # 3. Create the Company FIRST to satisfy the Supabase Foreign Key constraint
    try:
        supabase.table("companies").insert({
            "id": new_company_id,
            "name": req.company_name
        }).execute()
    except Exception as e:
        # Fallback just in case your column is named 'company_name' instead of 'name'
        try:
            supabase.table("companies").insert({
                "id": new_company_id,
                "company_name": req.company_name
            }).execute()
        except Exception as inner_e:
            print(f"Company Creation Error: {inner_e}")
            raise HTTPException(status_code=500, detail=f"Failed to create company record: {str(inner_e)}")

    # 4. Now it is completely safe to insert the user
    supabase.table("users").insert(
        {"username": req.username, "password_hash": hashed_pwd, "role": req.role, "company_id": new_company_id}
    ).execute()

    return {"message": f"User created successfully with isolated workspace (Company ID: {new_company_id})."}


@app.get("/api/hub/overview")
def get_overview(current_user=Depends(auth.get_current_user)):
    user_company = current_user.get("company_id")

    count_res = supabase.table("firefox_table").select("*", count="exact").eq("company_id", user_company).limit(
        1).execute()
    res = supabase.table("firefox_table").select("*").eq("company_id", user_company).order("bug_id", desc=True).limit(
        500).execute()

    bugs = res.data or []
    critical_count = len([b for b in bugs if b.get("severity") in ["S1", "CRITICAL"]])
    components = {}
    for b in bugs:
        comp = b.get("component", "General")
        components[comp] = components.get(comp, 0) + 1
    top_5 = sorted([{"name": k, "value": v} for k, v in components.items()], key=lambda x: x["value"], reverse=True)[:5]

    return {
        "stats": {"total_db": count_res.count or 0, "analyzed": count_res.count or 0, "critical": critical_count},
        "recent": [{"id": b.get("bug_id"), "summary": b.get("summary"), "severity": b.get("severity"),
                    "status": b.get("status")} for b in bugs[:5]],
        "charts": {"components": top_5}
    }


@app.get("/api/hub/component_counts")
def get_component_counts(current_user=Depends(auth.get_current_user)):
    return {}


@app.get("/api/hub/component_inspector")
def get_component_inspector(component: str, team: str, current_user=Depends(auth.get_current_user)):
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    user_company = current_user.get("company_id")

    count_res = sb.table("firefox_table").select("*", count="exact").eq("company_id", user_company).ilike("component",
                                                                                                          f"%{component}%").limit(
        1).execute()
    total = count_res.count or 0
    crit_res = sb.table("firefox_table").select("bug_id, summary, severity, status, component").eq("company_id",
                                                                                                   user_company).ilike(
        "component", f"%{component}%").ilike("severity", "%S1%").order("bug_id", desc=True).limit(5).execute()
    recent = crit_res.data or []

    if total == 0:
        count_res = sb.table("firefox_table").select("*", count="exact").eq("company_id", user_company).ilike(
            "component", f"%{team}%").limit(1).execute()
        total = count_res.count or 0
        crit_res = sb.table("firefox_table").select("bug_id, summary, severity, status, component").eq("company_id",
                                                                                                       user_company).ilike(
            "component", f"%{team}%").ilike("severity", "%S1%").order("bug_id", desc=True).limit(5).execute()
        recent = crit_res.data or []

    normalized = [{"bug_id": b.get("bug_id") or b.get("id"), "summary": b.get("summary", "No summary"),
                   "severity": b.get("severity", "S1"), "status": b.get("status", "NEW"),
                   "component": b.get("component", component)} for b in recent]
    return {"total": total, "recent_critical": normalized}


@app.get("/api/hub/explorer")
def get_bugs(page: int = 1, limit: int = 10, search: str = "", sort_key: str = "id", sort_dir: str = "desc",
             sev: str = "", status: str = "", comp: str = "", current_user=Depends(auth.get_current_user)):
    offset = (page - 1) * limit
    db_sort = "bug_id" if sort_key == "id" else sort_key

    query = supabase.table("firefox_table").select("*", count="exact").eq("company_id", current_user.get("company_id"))

    if search: query = query.ilike("summary", f"%{search}%")
    if sev:    query = query.ilike("severity", f"%{sev}%")
    if status: query = query.ilike("status", f"%{status}%")
    if comp:   query = query.ilike("component", f"%{comp}%")

    res = query.order(db_sort, desc=(sort_dir.lower() == "desc")).range(offset, offset + limit - 1).execute()
    return {"total": res.count or 0, "bugs": [
        {"id": r.get("bug_id"), "summary": r.get("summary"), "component": r.get("component"),
         "severity": r.get("severity"), "status": r.get("status")} for r in (res.data or [])]}


@app.get("/api/hub/export")
def export_bugs(search: str = "", sort_key: str = "id", sort_dir: str = "desc", sev: str = "", status: str = "",
                comp: str = "", current_user=Depends(auth.get_current_user)):
    db_sort = "bug_id" if sort_key == "id" else sort_key

    query = supabase.table("firefox_table").select("*").eq("company_id", current_user.get("company_id"))

    if search: query = query.ilike("summary", f"%{search}%")
    res = query.order(db_sort, desc=(sort_dir.lower() == "desc")).limit(1000).execute()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Summary", "Component", "Severity", "Status"])
    for b in (res.data or []):
        writer.writerow([b.get("bug_id"), b.get("summary"), b.get("component"), b.get("severity"), b.get("status")])
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=bug_export.csv"})


@app.post("/api/analyze_bug")
async def analyze_bug(bug_text: str = Query(...), current_user=Depends(auth.get_current_user)):
    try:
        sev_label, confidence = "S3", 0.85
        if rf_model is not None and vectorizer is not None:
            prediction = rf_model.predict(vectorizer.transform([bug_text]))[0]
            sev_label = str(prediction)
        similar_bugs = []
        if len(bug_text.strip()) > 2:
            similar_bugs = supabase.table("firefox_table").select("*").eq("company_id",
                                                                          current_user.get("company_id")).ilike(
                "summary", f"%{bug_text.strip()[:20]}%").limit(5).execute().data

        return {"severity": {"label": sev_label, "confidence": confidence, "action": "Investigate"},
                "similar_bugs": similar_bugs, "analysis_context": {"method": "Random Forest + RAG"}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/predict")
def predict_endpoint(payload: PredictPayload, current_user=Depends(auth.get_current_user)):
    return predict_severity(payload.summary, payload.component, payload.platform)


@app.post("/api/bug")
async def create_bug(req: CreateBugRequest, current_user=Depends(auth.get_current_user)):
    bug_to_insert = {"summary": req.bug.summary, "component": req.bug.component, "severity": req.bug.severity,
                     "status": "NEW", "company_id": current_user.get("company_id")}
    response = supabase.table("firefox_table").insert(bug_to_insert).execute()
    return response.data[0] if response.data else {}


@app.delete("/api/bug/{bug_id}")
async def delete_bug(bug_id: int, current_user=Depends(auth.get_current_user)):
    supabase.table("firefox_table").delete().eq("bug_id", bug_id).eq("company_id",
                                                                     current_user.get("company_id")).execute()
    return {"status": "deleted"}


@app.post("/api/feedback")
def submit_feedback(payload: FeedbackPayload, current_user=Depends(auth.get_current_user)):
    supabase.table("feedback").insert({"summary": payload.summary, "predicted_severity": payload.predicted_severity,
                                       "actual_severity": payload.actual_severity,
                                       "company_id": current_user.get("company_id")}).execute()
    return {"status": "success"}


@app.get("/api/batches")
def get_batches(current_user=Depends(auth.get_current_user)):
    res = supabase.table("training_batches").select("*").eq("company_id", current_user.get("company_id")).order(
        "upload_time", desc=True).execute()
    return [{"id": b.get("id"), "batch_name": b.get("batch_name", "Unknown"), "bug_count": b.get("bug_count", 0),
             "status": b.get("status", "completed"), "upload_time": b.get("upload_time")} for b in (res.data or [])]


@app.delete("/api/batches/{batch_id}")
def delete_batch(batch_id: int, current_user=Depends(auth.get_current_user)):
    supabase.table("training_batches").delete().eq("id", batch_id).eq("company_id",
                                                                      current_user.get("company_id")).execute()
    return {"status": "deleted"}


@app.post("/api/retrain")
async def bulk_retrain(background_tasks: BackgroundTasks, company_id: int = Form(...), file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents)) if file.filename.endswith(".csv") else pd.read_json(io.BytesIO(contents))

        bug_count = len(df)
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)

        sb.table("training_batches").insert({
            "batch_name": file.filename,
            "company_id": company_id,
            "bug_count": bug_count,
            "status": "completed"
        }).execute()

        temp_csv_path = os.path.join(os.path.dirname(__file__), "temp_upload.csv")
        df.to_csv(temp_csv_path, index=False)

        def run_ml_pipeline():
            try:
                subprocess.run(
                    [sys.executable, os.path.join(os.path.dirname(__file__), "../Random Forest ML/Train_Universal.py"),
                     "--append_csv", temp_csv_path], check=True)
                load_models()
                force_reload_models()
            finally:
                if os.path.exists(temp_csv_path): os.remove(temp_csv_path)

        background_tasks.add_task(run_ml_pipeline)
        return {"status": "success", "message": f"{bug_count} bugs processed for ML training."}

    except Exception as e:
        error_msg = str(e)
        print(f"❌ Bulk Upload Database Crash: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Database Rejected File: {error_msg}")


@app.post("/api/hub/trigger_retrain")
async def trigger_ml_retrain(current_user=Depends(auth.get_current_user)):
    try:
        ml_dir = os.path.join(BASE_DIR, "../Random Forest ML") if os.path.exists(
            os.path.join(BASE_DIR, "../Random Forest ML")) else os.path.join(BASE_DIR, "../random_forest_ml")
        script_path = os.path.join(ml_dir, "Train_Universal.py")
        if not os.path.exists(script_path): raise HTTPException(status_code=404,
                                                                detail="Training script not found on server.")

        custom_env = dict(os.environ)
        custom_env["PYTHONIOENCODING"] = "utf-8"
        result = subprocess.run([sys.executable, script_path], capture_output=True, text=True, check=True,
                                encoding="utf-8", env=custom_env)

        load_models()
        force_reload_models()
        return {"status": "success", "message": "Model retrained successfully", "logs": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/hub/ml_metrics")
def get_ml_metrics():
    try:
        ml_dir = os.path.join(BASE_DIR, "../Random Forest ML") if os.path.exists(
            os.path.join(BASE_DIR, "../Random Forest ML")) else os.path.join(BASE_DIR, "../random_forest_ml")
        m_path = os.path.join(ml_dir, "rf_metrics.json")
        b_path = os.path.join(ml_dir, "baseline_metrics.json")

        current_data = json.load(open(m_path)) if os.path.exists(m_path) else None
        baseline_data = json.load(open(b_path)) if os.path.exists(b_path) else current_data
        previous_data = json.load(open(m_path + ".old")) if os.path.exists(m_path + ".old") else None

        return {
            "baseline": baseline_data,
            "current": current_data,
            "previous": previous_data
        }
    except Exception as e:
        print(f"Error fetching metrics: {e}")
        return {"baseline": None, "current": None, "previous": None}