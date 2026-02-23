import os
import json
import joblib
import argparse
import time
import shutil
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, classification_report

# --- CONFIG ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS = {
    "model": os.path.join(BASE_DIR, "../backend/rf_model.pkl"),
    "vectorizer": os.path.join(BASE_DIR, "../backend/tfidf_vectorizer.pkl"),
    "metrics": os.path.join(BASE_DIR, "rf_metrics.json"),
}

load_dotenv(os.path.join(BASE_DIR, "../backend/.env"))
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")


def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Missing Supabase credentials in .env file")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def backup_for_revert():
    print("🛡️ Creating Revert Point (saving .old files)...")
    for name, path in ARTIFACTS.items():
        if os.path.exists(path):
            shutil.copy(path, path + ".old")


def fetch_data_from_supabase():
    print("☁️ Connecting to Supabase database...")
    supabase = get_supabase_client()
    all_data = []
    limit = 1000
    offset = 0

    while True:
        res = supabase.table("firefox_table").select("summary, severity").range(offset, offset + limit - 1).execute()
        data = res.data
        if not data:
            break
        all_data.extend(data)
        if len(data) < limit:
            break
        offset += limit

    print(f"   -> Successfully extracted {len(all_data)} records from cloud.")
    return pd.DataFrame(all_data)


def run_training_pipeline(fast_mode=False, append_csv_path=None):
    backup_for_revert()

    try:
        # 1. FETCH DATA
        try:
            df = fetch_data_from_supabase()
        except Exception as e:
            print(f"⚠️ Supabase fetch failed: {e}. Falling back to local data.csv if it exists.")
            df = pd.read_csv(os.path.join(BASE_DIR, "data.csv"))
            if "description" in df.columns: df.rename(columns={"description": "summary"}, inplace=True)

        if append_csv_path and os.path.exists(append_csv_path):
            print(f"🔄 Merging Temp Data from {append_csv_path}...")
            new_df = pd.read_csv(append_csv_path)
            if "description" in new_df.columns: new_df.rename(columns={"description": "summary"}, inplace=True)
            df = pd.concat([df, new_df], ignore_index=True)

        # 2. PREPROCESS
        print("⚙️ Processing Text & Normalizing Labels...")
        df['summary'] = df['summary'].fillna("").astype(str).str.lower()

        severity_map = {
            "blocker": "S1", "critical": "S1", "s1": "S1",
            "major": "S2", "s2": "S2",
            "normal": "S3", "minor": "S3", "trivial": "S3", "enhancement": "S4", "s3": "S3", "s4": "S4"
        }
        df["severity"] = df["severity"].str.lower().map(severity_map).fillna("S3")

        # 3. VECTORIZE
        print("🧮 Converting text to TF-IDF vectors...")
        vectorizer = TfidfVectorizer(max_features=1000 if fast_mode else 5000, stop_words="english", ngram_range=(1, 2),
                                     min_df=3, max_df=0.85)
        X = vectorizer.fit_transform(df["summary"])
        y = df["severity"]

        # 4. SPLIT
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        # 5. TRAIN
        print(f"🚀 Training Random Forest (Trees={50 if fast_mode else 100})...")
        rf = RandomForestClassifier(n_estimators=50 if fast_mode else 100, class_weight="balanced", n_jobs=-1,
                                    random_state=42)
        rf.fit(X_train, y_train)

        # 6. METRICS
        y_pred = rf.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred, average='weighted')
        prec = precision_score(y_test, y_pred, average='weighted', zero_division=0)
        rec = recall_score(y_test, y_pred, average='weighted', zero_division=0)

        print(f"✅ Training Complete. Acc: {round(acc * 100, 2)}%")

        # 7. SAVE
        joblib.dump(rf, ARTIFACTS["model"])
        joblib.dump(vectorizer, ARTIFACTS["vectorizer"])

        metrics = {
            "accuracy": round(acc, 3), "f1_score": round(f1, 3), "precision": round(prec, 3), "recall": round(rec, 3),
            "dataset_size": len(df), "last_trained": time.ctime(), "status": "Enterprise Model Deployed"
        }
        with open(ARTIFACTS["metrics"], "w") as f:
            json.dump(metrics, f, indent=4)

        return True

    except Exception as e:
        print(f"❌ Critical Pipeline Failure: {e}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", action="store_true")
    parser.add_argument("--append_csv", type=str, default=None)
    args = parser.parse_args()
    run_training_pipeline(fast_mode=args.limit, append_csv_path=args.append_csv)