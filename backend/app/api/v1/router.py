from fastapi import APIRouter

from app.api.v1 import admin, auth, empresa, proveedor, servicios, solicitudes

router = APIRouter()
router.include_router(auth.router)
router.include_router(admin.router)
router.include_router(servicios.router)
router.include_router(solicitudes.router)
router.include_router(proveedor.router)
router.include_router(empresa.router)
