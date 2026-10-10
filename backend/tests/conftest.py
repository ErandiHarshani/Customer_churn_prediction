import os
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
PROJECT = BACKEND.parent / "mlpart" / "churn_prediction_project"

# Must be set before anything imports app.config. Real env vars take priority over
# backend/.env, so the tests never touch the real database or call real APIs.
os.environ["ML_ARTIFACT_DIR"] = str(PROJECT / "artifacts")
os.environ["RAW_CSV_PATH"] = str(PROJECT / "churn_with_sentiment.csv")
os.environ["JWT_SECRET"] = "test-secret"
os.environ["GEMINI_API_KEY"] = ""
os.environ["DRY_RUN"] = "true"
os.environ["DATABASE_URL"] = f"sqlite:///{Path(tempfile.mkdtemp()) / 'test.db'}"
sys.path.insert(0, str(BACKEND))


@pytest.fixture(scope="session")
def seeded_db():
    from app.database import SessionLocal
    from app.seed import seed_database
    from app.seed_admin import seed_admin

    db = SessionLocal()
    try:
        seed_database(db)
        seed_admin(db, "tester", "tester-pass")
    finally:
        db.close()


@pytest.fixture(scope="session")
def client(seeded_db):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        token = c.post("/api/auth/login", json={"username": "tester", "password": "tester-pass"}).json()[
            "access_token"
        ]
        c.headers["Authorization"] = f"Bearer {token}"
        yield c
