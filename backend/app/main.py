from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.ml.artifacts import get_artifacts
from app.routers import auth, customers, dashboard, gemini_settings, public, retention, sms_gateway


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    artifacts = get_artifacts()
    print(
        f"[startup] Loaded {len(artifacts.feature_columns)} features, "
        f"XGBoost + Random Forest + SHAP explainer OK"
    )
    yield


app = FastAPI(title="Churn Prediction Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(customers.router)
app.include_router(retention.router)
app.include_router(sms_gateway.router)
app.include_router(gemini_settings.router)
app.include_router(public.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
