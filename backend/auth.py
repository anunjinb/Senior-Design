import os
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text
from pydantic import BaseModel
from database import engine


class LoginRequest(BaseModel):
    username: str
    password: str


SECRET_KEY = "YOUR_SURE_SECRET_KEY_FOR_DEMO"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 600

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")


def verify_password(plain_password, hashed_password):
    if isinstance(plain_password, bytes):
        plain_password = plain_password.decode('utf-8')
    if isinstance(hashed_password, bytes):
        hashed_password = hashed_password.decode('utf-8')
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # ⚡ DIRECT SQL: Bypasses RLS blocks to validate the user
    with engine.connect() as conn:
        query = text("SELECT username, company_id FROM users WHERE username = :u")
        result = conn.execute(query, {"u": username}).fetchone()

    if not result:
        raise credentials_exception

    return {"username": result[0], "company_id": result[1]}