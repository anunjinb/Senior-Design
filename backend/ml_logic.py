import os, json, joblib, re
from config import ART_RF

_loaded_pack = None

# ⚡ NEW: Allows main.py to force ml_logic to drop its cached model after retraining
def force_reload_models():
    global _loaded_pack
    _loaded_pack = load_pack()
    print("🔄 ml_logic intelligence models hot-reloaded!")

# --- 1. CORE LOGIC ---
def load_pack(s=ART_RF):
    try:
        if not os.path.exists(s['model']) or not os.path.exists(s['vec']):
            print(f"⚠️ Models not found at {s['model']} or {s['vec']}. Using fallback mode.")
            return None, None, {}

        m = joblib.load(s["model"])
        v = joblib.load(s["vec"])
        met = json.load(open(s["met"])) if os.path.exists(s["met"]) else {}

        return m, v, met
    except Exception as e:
        print(f"Error loading model: {e}")
        return None, None, {}


def predict_internal(sum_text, m, v):
    if not m or not v: return None, 0.0

    # 1. Vectorize the raw text exactly how it was trained
    xt = v.transform([sum_text])

    # 2. Predict probabilities
    pro = m.predict_proba(xt)[0]

    # 3. Get the class labels from the model itself
    classes = m.classes_

    # Return the highest probability label and its score
    best_idx = pro.argmax()
    return classes[best_idx], float(pro[best_idx])


# --- 2. INTELLIGENCE MODULES ---
def heuristic_predict(text):
    """Fallback if ML model fails or is missing"""
    text = text.lower()
    if "crash" in text or "security" in text or "data loss" in text:
        return "S1", 0.95
    if "slow" in text or "performance" in text or "broken" in text:
        return "S2", 0.85
    if "typo" in text or "color" in text or "align" in text:
        return "S4", 0.70
    return "S3", 0.60


def predict_team(text, diagnosis):
    """Smart Team Routing"""
    t = text.lower()
    d = diagnosis.lower()
    if "security" in t or "auth" in t or "login" in t: return "🛡️ Security Ops"
    if "database" in d or "sql" in t or "query" in t: return "💾 Data Infrastructure"
    if "ui" in t or "css" in t or "align" in t or "color" in t: return "🎨 Frontend/UX"
    if "crash" in t or "memory" in t or "leak" in t: return "⚡ Core Performance"
    return "🔧 General Maintenance"


def extract_keywords(text):
    """Explainable AI - Return specific trigger words"""
    triggers = ["crash", "leak", "security", "fail", "slow", "broken", "error", "exception", "timeout", "freeze",
                "database", "login", "api"]
    found = []
    for word in text.split():
        clean_word = re.sub(r'\W+', '', word).lower()
        if clean_word in triggers:
            found.append(word)
    return list(set(found))


# --- 3. API WRAPPER ---
def predict_severity(summary: str, component: str = "General", platform: str = "All"):
    """Called by the Website API."""
    global _loaded_pack
    if _loaded_pack is None: _loaded_pack = load_pack()

    m, v, _ = _loaded_pack
    label, conf = None, 0.0

    # 1. Run ML Prediction
    if m and v:
        try:
            label, conf = predict_internal(summary, m, v)
        except Exception as err:
            print(f"Prediction Error: {err}. Falling back.")

    # 2. Fallback
    if not label:
        label, conf = heuristic_predict(summary)

    # 3. Generate Analysis
    s = summary.lower()
    diagnosis = "Standard Logic Defect"
    if "database" in s or "sql" in s:
        diagnosis = "Database Contention"
    elif "ui" in s or "css" in s:
        diagnosis = "Frontend Rendering"
    elif "auth" in s:
        diagnosis = "Access Control Failure"
    elif "crash" in s:
        diagnosis = "Critical Memory Corruption"

    # 4. Smart Features
    team = predict_team(summary, diagnosis)
    keywords = extract_keywords(summary)

    return {
        "prediction": label,
        "confidence": conf,
        "diagnosis": diagnosis,
        "team": team,
        "keywords": keywords
    }