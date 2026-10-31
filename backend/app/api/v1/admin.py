import logging
from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import AdministradorActual, SessionDep
from app.schemas.auth import RegistroCliente, RegistroProveedor, UsuarioOut
from app.schemas.tablero import TableroAdminOut
from app.schemas.usuarios import EditarCuenta, MarcaIn, RegistroAdministrador, UsuarioDetalleOut, UsuarioListaOut
from app.services.registro import registrar_administrador, registrar_cliente, registrar_proveedor
from app.services.tablero import obtener_tablero_admin
from app.services.usuarios import detalle_usuario, editar_cuenta, listar_usuarios, registrar_marca

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


@router.post("/administradores", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def alta_administrador(
    datos: RegistroAdministrador,
    session: SessionDep,
    administrador: AdministradorActual,
) -> UsuarioOut:
    usuario = await registrar_administrador(session, datos, administrador)
    logger.info("administrador %s registró administrador %s", administrador.id, usuario.id)
    return UsuarioOut.model_validate(usuario, from_attributes=True)


@router.get("/usuarios", response_model=list[UsuarioListaOut])
async def consultar_usuarios(
    session: SessionDep,
    administrador: AdministradorActual,
) -> list[UsuarioListaOut]:
    cuentas = await listar_usuarios(session)
    logger.info("administrador %s consultó %s cuentas", administrador.id, len(cuentas))
    return cuentas


@router.get("/usuarios/{usuario_id}", response_model=UsuarioDetalleOut)
async def consultar_usuario(
    usuario_id: UUID,
    session: SessionDep,
    administrador: AdministradorActual,
) -> UsuarioDetalleOut:
    detalle = await detalle_usuario(session, usuario_id)
    logger.info("administrador %s consultó la cuenta %s", administrador.id, usuario_id)
    return detalle


@router.patch("/usuarios/{usuario_id}", response_model=UsuarioDetalleOut)
async def actualizar_cuenta(
    usuario_id: UUID,
    datos: EditarCuenta,
    session: SessionDep,
    administrador: AdministradorActual,
) -> UsuarioDetalleOut:
    detalle = await editar_cuenta(session, usuario_id, datos)
    logger.info("administrador %s editó la cuenta %s", administrador.id, usuario_id)
    return detalle


@router.post("/usuarios/{usuario_id}/marcas", response_model=UsuarioDetalleOut, status_code=status.HTTP_201_CREATED)
async def alta_marca(
    usuario_id: UUID,
    datos: MarcaIn,
    session: SessionDep,
    administrador: AdministradorActual,
) -> UsuarioDetalleOut:
    detalle = await registrar_marca(session, usuario_id, datos)
    logger.info("administrador %s registró una marca sobre la cuenta %s", administrador.id, usuario_id)
    return detalle
