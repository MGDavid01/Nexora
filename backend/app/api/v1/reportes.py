from fastapi import APIRouter

from app.api.deps import SessionDep, UsuarioActual
from app.schemas.reportes import ReporteOut
from app.services.reportes import listar_reportes_perfil

router = APIRouter(prefix="/reportes", tags=["reportes"])


@router.get("", response_model=list[ReporteOut])
async def consultar_reportes_propios(session: SessionDep, usuario: UsuarioActual) -> list[ReporteOut]:
    return await listar_reportes_perfil(session, usuario)
