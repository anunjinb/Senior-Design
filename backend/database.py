import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from supabase import create_client, Client

# Load environment variables from the .env file (for local development)
load_dotenv()

# Fetch credentials securely from the environment
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")  # The anon or service_role key
DATABASE_URL = os.getenv("DATABASE_URL")  # The postgresql:// connection string

# Ensure all required variables are present before starting
if not all([SUPABASE_URL, SUPABASE_KEY, DATABASE_URL]):
    raise ValueError("Missing essential environment variables (SUPABASE_URL, SUPABASE_KEY, or DATABASE_URL). Check your .env file.")

# ==========================================
# 1. Supabase Client Setup (Used in main.py)
# ==========================================
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==========================================
# 2. SQLAlchemy Setup (Used in models.py)
# ==========================================
# pool_pre_ping=True tests connections before using them, preventing drops from the Supabase pooler
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get DB session (if needed in FastAPI routes)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()