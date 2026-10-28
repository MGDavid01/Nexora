from fastapi import APIRouter

from app.api.v1 import admin, auth

router = APIRouter()
router.include_router(auth.router)
router.include_router(admin.router)
