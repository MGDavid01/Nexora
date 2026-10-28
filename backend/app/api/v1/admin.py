import logging

from fastapi import APIRouter, status

from app.api.deps import AdministradorActual, SessionDep
from app.schemas.auth import RegistroCliente, RegistroProveedor, UsuarioOut
from app.schemas.tablero import TableroAdminOut
from app.services.registro import registrar_cliente, registrar_proveedor
from app.services.tablero import obtener_tablero_admin

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/tablero", response_model=TableroAdminOut)
async def consultar_tablero(
    session: SessionDep,
    administrador: AdministradorActual,
) -> TableroAdminOut:
    tablero = await obtener_tablero_admin(session)
    logger.info("administrador %s consultó el tablero operativo", administrador.id)
    return tablero


@router.post("/clientes", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def alta_cliente(
    datos: RegistroCliente,
    session: SessionDep,
    administrador: AdministradorActual,
) -> UsuarioOut:
    usuario = await registrar_cliente(session, datos, administrador)
    logger.info("administrador %s registró cliente %s", administrador.id, usuario.id)
    return UsuarioOut.model_validate(usuario, from_attributes=True)


@router.post("/proveedores", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def alta_proveedor(
    datos: RegistroProveedor,
    session: SessionDep,
    administrador: AdministradorActual,
) -> UsuarioOut:
    """La primera cuenta del perfil queda como administrativa."""
    usuario = await registrar_proveedor(session, datos, administrador)
    logger.info("administrador %s registró proveedor %s", administrador.id, usuario.id)
    return UsuarioOut.model_validate(usuario, from_attributes=True)
