from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import qa_router, summarize_router, auth_router, history_router
from backend.db import models, database

# Create DB tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Smart Document Assistant")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router.router)
app.include_router(qa_router.router)
app.include_router(summarize_router.router)
app.include_router(history_router.router)  # ✅ NEW

@app.get("/")
async def root():
    return {"message": "🚀 Smart Document Assistant is running"}
