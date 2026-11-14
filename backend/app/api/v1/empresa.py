from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import SessionDep, UsuarioActual
from app.schemas.flujo import (
    BajaUsuarioIn,
    ConversionOut,
    ConversionPedirIn,
    EmpresaUsuarioOut,
    ExtraUsuarioIn,
)
from app.services.conversion import pedir_conversion
from app.services.empresa_usuarios import alta_extra, baja_usuario_extra, listar_usuarios_empresa

router = APIRouter(prefix="/empresa", tags=["empresa"])


@router.get("/usuarios", response_model=list[EmpresaUsuarioOut])
async def listar_extras(session: SessionDep, usuario: UsuarioActual) -> list[EmpresaUsuarioOut]:
    return await listar_usuarios_empresa(session, usuario)


@router.post("/usuarios", response_model=EmpresaUsuarioOut, status_code=status.HTTP_201_CREATED)
async def crear_extra(
    datos: ExtraUsuarioIn, session: SessionDep, usuario: UsuarioActual
) -> EmpresaUsuarioOut:
    return await alta_extra(session, usuario, datos)


@router.post("/usuarios/{usuario_id}/baja", response_model=EmpresaUsuarioOut)
async def baja_extra(
    usuario_id: UUID, datos: BajaUsuarioIn, session: SessionDep, usuario: UsuarioActual
) -> EmpresaUsuarioOut:
    return await baja_usuario_extra(session, usuario, usuario_id, datos)


@router.post("/conversion", response_model=ConversionOut, status_code=status.HTTP_201_CREATED)
async def pedir_cambio_tipo(
    datos: ConversionPedirIn, session: SessionDep, usuario: UsuarioActual
) -> ConversionOut:
    return await pedir_conversion(session, usuario, datos)
