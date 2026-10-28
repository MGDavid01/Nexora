from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_v1
from app.core.config import settings

app = FastAPI(title="Nexora", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_v1, prefix="/api/v1")


@app.get("/salud", tags=["salud"])
async def salud() -> dict[str, str]:
    return {"estado": "ok"}
