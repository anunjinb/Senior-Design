from fastapi import FastAPI, Depends, HTTPException, Body, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, engine
from pydantic import BaseModel
import models, auth, bcrypt, ml_logic, json, time, random

# --- ✅ AI IMPORTS ---
import chromadb
from sentence_transformers import SentenceTransformer
import joblib
import numpy as np
import os

# --- DATABASE SETUP ---
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

ANALYTICS_SLICE_LIMIT = 5000
DEFAULT_SOURCE_COMPANY_ID = 1

# --- ✅ LOAD ALL AI BRAINS ---
print("⏳ Loading AI Models (Vector DB + Random Forest)...")
AI_READY = False
try:
    # 1. Vector DB (For finding similar bugs)
    rag_client = chromadb.PersistentClient(path="./rag_db")
    rag_collection = rag_client.get_collection(name="bug_reports")
    rag_model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # 2. Random Forest (For predicting severity)
    # We check if files exist to prevent crashing if you deleted them
    if os.path.exists("rf_model.pkl") and os.path.exists("tfidf_vectorizer.pkl"):
        rf_model = joblib.load("rf_model.pkl")
        vectorizer = joblib.load("tfidf_vectorizer.pkl")
        print("✅ Random Forest & Vectorizer Loaded!")
        AI_READY = True
    else:
        print("⚠️ Warning: .pkl files not found. Prediction will use fallback logic.")

except Exception as e:
    print(f"⚠️ AI LOAD WARNING: {e}")

# --- HELPER FUNCTIONS ---
def map_sev(s):
    s = str(s).lower().strip()
    if s in ['blocker', 'critical', 's1']: return 'S1'
    if s in ['major', 's2']: return 'S2'
    if s in ['normal', 's3']: return 'S3'
    return 'S4'

class PredictionRequest(BaseModel):
    summary: str
    component: str = "General"
    platform: str = "All"

# ==========================================
# 👇 THE REAL AI ENDPOINT
# ==========================================
@app.post("/analyze_bug")
def analyze_bug(bug_text: str, db: Session = Depends(get_db)):
    print(f"Analyzing: {bug_text}")
    
    # 1. SEARCH FOR SIMILAR BUGS (Vector DB)
    similar_bugs = []
    try:
        query_vec = rag_model.encode([bug_text]).tolist()
        results = rag_collection.query(query_embeddings=query_vec, n_results=3)
        if results['documents']:
            for i in range(len(results['documents'][0])):
                similar_bugs.append({
                    "id": results['ids'][0][i],
                    "summary": results['documents'][0][i],
                    "status": results['metadatas'][0][i].get('status', 'Unknown'),
                    "match": round((1 - results['distances'][0][i]) * 100)
                })
    except Exception as e:
        print(f"Vector Search Error: {e}")

    # 2. PREDICT SEVERITY (Random Forest)
    severity_label = "S3"
    confidence = 0
    action = "Investigate"

    if AI_READY:
        try:
            # Transform text into numbers
            X_input = vectorizer.transform([bug_text])
            
            # Predict
            pred_label = rf_model.predict(X_input)[0]
            probs = rf_model.predict_proba(X_input)[0]
            max_prob = np.max(probs) # Get the highest confidence score

            # Map the result to our UI labels
            severity_label = pred_label.upper()
            confidence = int(max_prob * 100)
            
            # Smart Actions based on result
            if severity_label in ['S1', 'CRITICAL', 'BLOCKER']:
                action = "Escalate to Senior Dev immediately"
            elif severity_label in ['S2', 'MAJOR']:
                action = "Schedule for upcoming sprint"
            else:
                action = "Add to backlog for future review"
                
        except Exception as e:
            print(f"Prediction Error: {e}")
            severity_label = "ERROR"

    return {
        "severity": {
            "label": severity_label,
            "confidence": confidence,
            "action": action
        },
        "similar_bugs": similar_bugs
    }

# --- REST OF THE API (Dashboard, Login, etc.) ---
# (Keeping the rest of your endpoints exactly the same)

@app.get("/api/hub/overview")
def get_overview(company_id: int, db: Session = Depends(get_db)):
    total_db = db.execute(text("SELECT COUNT(*) FROM bugs WHERE company_id = :cid"), {"cid": company_id}).scalar() or 0
    return {"stats": {"total_db": total_db, "analyzed": 500, "critical": 12, "components": 5}, "charts": {"severity": [], "components": []}, "recent": []}

@app.get("/api/hub/explorer")
def get_explorer(company_id: int, limit: int = 5000, db: Session = Depends(get_db)):
    res = db.execute(text("SELECT bug_id, data->>'summary', data->>'severity', data->>'component', data->>'status' FROM bugs WHERE company_id=:cid LIMIT :lim"), {"cid": company_id, "lim": limit}).fetchall()
    return [{"id": r[0], "summary": r[1], "severity": map_sev(r[2]), "component": r[3], "status": r[4]} for r in res]

@app.post("/api/predict")
def predict(req: PredictionRequest):
    return ml_logic.predict_severity(req.summary, req.component, req.platform)

@app.post("/api/login")
def login(creds: auth.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == creds.username).first()
    if not user or not bcrypt.checkpw(creds.password.encode(), user.password_hash.encode()):
        raise HTTPException(401, "Invalid credentials")
    return {"username": user.username, "role": user.role, "company_id": user.company_id}

@app.post("/api/users")
def create_user(req: auth.CreateUserRequest, company_name: str = Body(..., embed=True), db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == req.username).first(): raise HTTPException(400, "Username taken")
    new_cid = int(time.time())
    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    db.execute(text("INSERT INTO users (username, password_hash, role, company_id) VALUES (:u, :p, :r, :cid)"), {"u": req.username, "p": hashed, "r": req.role, "cid": new_cid})
    db.commit()
    return {"message": "Created"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)