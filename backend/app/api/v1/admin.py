import logging
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, File, Form, UploadFile, status
from pydantic import BaseModel

from app.adaptadores.archivos import subir_archivo
from app.adaptadores._resultado import EstadoEnvio
from app.api.deps import AdministradorActual, SessionDep
from app.schemas.auth import RegistroCliente, RegistroProveedor, UsuarioOut
from app.schemas.tablero import TableroAdminOut
from app.schemas.trabajos import (
    CerrarReclamacionIn,
    ExpedienteTrabajoOut,
    MarcaCasoIn,
    TrabajoListaOut,
)
from app.schemas.usuarios import EditarCuenta, MarcaIn, RegistroAdministrador, UsuarioDetalleOut, UsuarioListaOut
from app.services.registro import registrar_administrador, registrar_cliente, registrar_proveedor
from app.services.tablero import obtener_tablero_admin
from app.services.trabajos import (
    cerrar_reclamacion_del_caso,
    listar_trabajos,
    obtener_expediente,
    registrar_marca_del_caso,
)
from app.services.usuarios import (
    desbloquear_perfil,
    detalle_usuario,
    editar_cuenta,
    listar_usuarios,
    procesar_baja_perfil,
    registrar_marca,
)

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/admin", tags=["admin"])


class ArchivoSubidoOut(BaseModel):
    estado: EstadoEnvio
    detalle: str
    referencia: str | None = None


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


@router.post("/usuarios/{usuario_id}/desbloqueo", response_model=UsuarioDetalleOut)
async def desbloquear_cuenta(
    usuario_id: UUID,
    session: SessionDep,
    administrador: AdministradorActual,
) -> UsuarioDetalleOut:
    detalle = await desbloquear_perfil(session, usuario_id)
    logger.info("administrador %s desbloqueó el perfil de la cuenta %s", administrador.id, usuario_id)
    return detalle


@router.post("/usuarios/{usuario_id}/baja", response_model=UsuarioDetalleOut)
async def procesar_baja_de_perfil(
    usuario_id: UUID,
    session: SessionDep,
    administrador: AdministradorActual,
) -> UsuarioDetalleOut:
    detalle = await procesar_baja_perfil(session, usuario_id)
    logger.info("administrador %s procesó la baja de perfil de la cuenta %s", administrador.id, usuario_id)
    return detalle


@router.get("/trabajos", response_model=list[TrabajoListaOut])
async def consultar_trabajos(
    session: SessionDep,
    administrador: AdministradorActual,
    etapa: Literal["solicitud", "cotizacion", "servicio"] | None = None,
    reclamacion: Literal["abierta", "cerrada"] | None = None,
    cierre: Literal["abierto", "cerrado"] | None = None,
    marca: Literal["con", "sin"] | None = None,
    q: str | None = None,
) -> list[TrabajoListaOut]:
    filas = await listar_trabajos(
        session, etapa=etapa, reclamacion=reclamacion, cierre=cierre, marca=marca, q=q
    )
    logger.info("administrador %s consultó trabajos (%s casos)", administrador.id, len(filas))
    return filas


@router.get("/trabajos/{solicitud_id}", response_model=ExpedienteTrabajoOut)
async def consultar_expediente(
    solicitud_id: UUID,
    session: SessionDep,
    administrador: AdministradorActual,
) -> ExpedienteTrabajoOut:
    expediente = await obtener_expediente(session, solicitud_id)
    logger.info("administrador %s consultó el expediente del caso %s", administrador.id, solicitud_id)
    if expediente.historial_perfiles is not None:
        logger.info(
            "administrador %s consultó el historial acotado de ambos perfiles del caso %s",
            administrador.id,
            solicitud_id,
        )
    return expediente


@router.post(
    "/trabajos/{solicitud_id}/reclamaciones/{reclamacion_id}/cerrar",
    response_model=ExpedienteTrabajoOut,
)
async def cerrar_reclamacion_admin(
    solicitud_id: UUID,
    reclamacion_id: UUID,
    datos: CerrarReclamacionIn,
    session: SessionDep,
    administrador: AdministradorActual,
) -> ExpedienteTrabajoOut:
    expediente = await cerrar_reclamacion_del_caso(session, solicitud_id, reclamacion_id, datos)
    logger.info(
        "administrador %s cerró la reclamación %s del caso %s",
        administrador.id,
        reclamacion_id,
        solicitud_id,
    )
    return expediente


@router.post("/trabajos/{solicitud_id}/marcas", response_model=ExpedienteTrabajoOut, status_code=status.HTTP_201_CREATED)
async def alta_marca_del_caso(
    solicitud_id: UUID,
    datos: MarcaCasoIn,
    session: SessionDep,
    administrador: AdministradorActual,
) -> ExpedienteTrabajoOut:
    expediente = await registrar_marca_del_caso(session, solicitud_id, datos)
    logger.info("administrador %s registró una marca del caso %s", administrador.id, solicitud_id)
    return expediente


@router.post("/archivos", response_model=ArchivoSubidoOut)
async def subir_archivo_admin(
    administrador: AdministradorActual,
    archivo: UploadFile = File(...),
    carpeta: str = Form(default="nexora"),
) -> ArchivoSubidoOut:
    """D7 — POST a Cloudinary. Sin credencial responde estado=omitido (el acto no falla)."""
    contenido = await archivo.read()
    nombre = archivo.filename or "archivo.bin"
    resultado = await subir_archivo(contenido=contenido, nombre_archivo=nombre, carpeta=carpeta.strip() or "nexora")
    logger.info(
        "administrador %s subió archivo %s → %s",
        administrador.id,
        nombre,
        resultado.estado.value,
    )
    return ArchivoSubidoOut(
        estado=resultado.estado,
        detalle=resultado.detalle,
        referencia=resultado.referencia,
    )
