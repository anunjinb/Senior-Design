import os, sys, json, joblib, argparse, time, shutil
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS = {
    "model": os.path.join(BASE_DIR, "../backend/rf_model.pkl"),
    "vectorizer": os.path.join(BASE_DIR, "../backend/tfidf_vectorizer.pkl"),
    "metrics": os.path.join(BASE_DIR, "rf_metrics.json"),
    "baseline_metrics": os.path.join(BASE_DIR, "baseline_metrics.json"),
}

sys.path.append(os.path.abspath(os.path.join(BASE_DIR, '../backend')))
from database import supabase

def backup_for_revert():
    print("🛡️ Creating Revert Point (saving .old files)...")
    for name, path in ARTIFACTS.items():
        if name != "baseline_metrics" and os.path.exists(path):
            shutil.copy(path, path + ".old")

def fetch_data_from_supabase(fast_mode=False):
    print("☁️ Connecting to Supabase database...")
    all_data = []
    limit = 1000
    offset = 0

    while True:
        res = supabase.table("firefox_table").select("summary, severity").order("bug_id").range(offset, offset + limit - 1).execute()
        if not res.data: break
        all_data.extend(res.data)

        if fast_mode: break
        if len(res.data) < limit: break
        offset += limit

    return pd.DataFrame(all_data)

def run_training_pipeline(fast_mode=False, append_csv_path=None):
    backup_for_revert()
    try:
        df = fetch_data_from_supabase(fast_mode)

        if append_csv_path and os.path.exists(append_csv_path):
            new_df = pd.read_csv(append_csv_path)
            if "description" in new_df.columns: new_df.rename(columns={"description": "summary"}, inplace=True)
            df = pd.concat([df, new_df], ignore_index=True)

        df['summary'] = df['summary'].fillna("").astype(str).str.lower()
        severity_map = {"blocker": "S1", "critical": "S1", "s1": "S1", "major": "S2", "s2": "S2", "normal": "S3", "minor": "S3", "trivial": "S3", "s3": "S3", "enhancement": "S4", "s4": "S4"}
        df["severity"] = df["severity"].str.lower().map(severity_map).fillna("S3")

        X_train_raw, X_test_raw, y_train, y_test = train_test_split(df["summary"], df["severity"], test_size=0.2, random_state=42, stratify=df["severity"])

        print("⚙️ Recompiling TF-IDF Vocabulary...")
        vectorizer = TfidfVectorizer(max_features=1000 if fast_mode else 5000, stop_words="english", ngram_range=(1, 2), min_df=3, max_df=0.85)
        X_train = vectorizer.fit_transform(X_train_raw)
        X_test = vectorizer.transform(X_test_raw)

        print("🌲 Training Random Forest Classifier...")
        rf = RandomForestClassifier(n_estimators=50 if fast_mode else 100, class_weight="balanced", n_jobs=-1, random_state=42)
        rf.fit(X_train, y_train)

        y_pred = rf.predict(X_test)
        acc = accuracy_score(y_test, y_pred)

        joblib.dump(rf, ARTIFACTS["model"])
        joblib.dump(vectorizer, ARTIFACTS["vectorizer"])

        status_text = "Active Model (Demo Batch)" if fast_mode else "Active Build (Retrained)"

        metrics = {
            "accuracy": round(acc, 3), "f1_score": round(f1_score(y_test, y_pred, average='weighted'), 3),
            "precision": round(precision_score(y_test, y_pred, average='weighted', zero_division=0), 3),
            "recall": round(recall_score(y_test, y_pred, average='weighted', zero_division=0), 3),
            "dataset_size": len(df), "last_trained": time.ctime(), "status": status_text
        }

        with open(ARTIFACTS["metrics"], "w") as f:
            json.dump(metrics, f, indent=4)

        if not os.path.exists(ARTIFACTS["baseline_metrics"]):
            metrics["status"] = "Main Brain (Firefox Dataset)"
            with open(ARTIFACTS["baseline_metrics"], "w") as f:
                json.dump(metrics, f, indent=4)
            print("🌐 Main Brain Baseline locked in permanently!")

        print(f"✅ Training Complete! Dataset Size: {len(df)}. Accuracy: {acc:.2%}")
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