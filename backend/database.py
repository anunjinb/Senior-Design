# backend/database.py
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from supabase import create_client, Client

# Load environment variables from the .env file in your backend folder
load_dotenv()

# ⚡ FIXED: Safely load credentials. (We provide fallbacks just in case the .env fails to load during demo)
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ofthvbabxgzsjercdjmo.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...") # Keep your fallback key here if .env fails
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres.ofthvbabxgzsjercdjmo:GannonUniversity2026%24@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()