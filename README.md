# BugPriority AI: Enterprise Bug Intelligence OS

### Overview
BugPriority AI is a full-stack, AI-driven platform designed to automate software defect triage. By leveraging a **Random Forest (RF)** classifier and a **Retrieval-Augmented Generation (RAG)** pipeline, the system predicts bug severity with **95% accuracy** against a dataset of **221,000+ real-world records**.

---

## 🚀 Key Features

* **Predictive Severity Analysis:** Supervised learning via Random Forest to categorize bugs (S1-S4) instantly.
* **RAG-Powered Explainability:** Semantic search using **ChromaDB** to find and display similar historical defects for every submission.
* **Enterprise Security:** **JWT-based authentication** with a secure handshake protocol and multi-tenant data isolation.
* **Bulk Data Ingestion:** Dynamic CSV/JSON upload logic for training models on new company-specific data.
* **Interactive Dashboard:** Real-time analytics and bug exploration powered by a high-performance PostgreSQL backend.



---

## 🛠️ Tech Stack

* **Frontend:** React.js, Tailwind CSS, Axios
* **Backend:** FastAPI (Python 3.11+), SQLAlchemy
* **Machine Learning:** Scikit-learn (Random Forest), Sentence-Transformers
* **Databases:** * **PostgreSQL:** Relational storage for bug metadata.
    * **ChromaDB:** Vector/Semantic Search for RAG.
    * **Supabase:** Cloud-hosted production database (Deployment Phase).
* **Data Source:** Official [Mozilla Bugbug Dataset](https://github.com/mozilla/bugbug/blob/master/docs/data.md)

---

## 📦 Installation & Setup

### 1. Prerequisites
* **Python 3.11+** (Optimized for FastAPI & ML performance)
* **PostgreSQL 14+** (Local Dev) or **Supabase Account** (Production)
* **Node.js & npm** (Frontend)

### 2. Data Acquisition
Download the universal training dataset (~221k records):
```bash
pip install bugbug
python3 -c "from bugbug import bugzilla, db; db.download(bugzilla.BUGS_DB)"
