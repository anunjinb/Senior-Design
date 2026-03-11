# Stage 1: Build dependencies
FROM python:3.11-slim as builder
WORKDIR /app
RUN apt-get update && apt-get install -y build-essential libpq-dev
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Stage 2: Final Runtime
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libpq-dev && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

COPY . .

EXPOSE 8000

# Command to run the FastAPI application pointing to backend/main.py
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-w", "4", "-b", "0.0.0.0:8000", "backend.main:app"]