# Bug priority os & analysis system  
Senior design project – ai-powered enterprise bug tracking  

This system combines a random forest classifier for real-time severity prediction, a chromadb-powered rag (retrieval-augmented generation) engine for duplicate detection, and a live etl (extract, transform, load) pipeline that syncs directly with the Mozilla Bugzilla REST API.

---

## Critical version requirements

- **Python 3.11 only**  
  Do not use python 3.12 or newer. Core AI libraries (including `bugbug` and some tensorflow dependencies) require python 3.11.

- **Node.js**  
  Required to build and run the React frontend.

- **Database**  
  The system connects to a cloud-hosted Supabase PostgreSQL instance. No local database setup is required.

---

## 1. System setup and installation

### Backend setup (api and ml engine)

1. Navigate to the backend folder:

```bash
cd backend
```

2. Create and activate a virtual environment:

**Windows**

```bash
python -m venv .venv
.venv\Scripts\activate
```

**Mac/Linux**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

---

### Frontend setup (react ui)

1. Open a new terminal and navigate to the frontend folder:

```bash
cd frontend
```

2. Install node packages:

```bash
npm install
```

---

## 2. Machine learning pipeline (the brain)

Before starting the server for the first time, you must generate the model artifacts.

### 1. Generate the dataset

- Navigate to the `Random Forest ML/` folder.
- Run:

```bash
python make_data.py
```

This downloads and prepares the hugging face dataset.

---

### 2. Train the model

Run:

```bash
python Train_Universal.py
```

This generates:

- `rf_model.pkl`
- `tfidf_vectorizer.pkl`

---

### 3. Automatic deployment

The training scripts automatically save the generated artifacts into the `backend/` directory, where the api expects them.

---

## 3. Search memory initialization

To enable duplicate detection, you must initialize the local vector database.

Inside the `backend/` folder, run:

```bash
python build_rag_db.py
```

This initializes the local chromadb instance and creates the `rag_db` folder, which stores embeddings for semantic similarity search.

---

## 4. Running the application (automated orchestrator)

The project includes a bootstrap orchestrator (`run_app.py`) that manages the entire stack.

When executed, it will:

1. Clear any lingering background ports.
2. Run the etl pipeline (`sync_taxonomy.py`) to fetch the latest organizational taxonomy from the mozilla bugzilla api and inject it into the frontend.
3. Start the fastapi backend.
4. Start the react frontend.

---

## To start the system

Make sure:

- Your python virtual environment is activated.
- You are in the root directory of the project.

Then run:

```bash
python run_app.py
```