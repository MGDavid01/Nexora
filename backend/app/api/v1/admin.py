import logging
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, File, Form, UploadFile, status
from pydantic import BaseModel

from app.adaptadores.archivos import subir_archivo
from app.adaptadores.osm import vista_mapa
from app.adaptadores._resultado import EstadoEnvio
from app.api.deps import AdministradorActual, SessionDep
from app.schemas.auditoria import AuditoriaListaOut
from app.schemas.auth import RegistroCliente, RegistroProveedor, UsuarioOut
from app.schemas.dispositivos import (
    DispositivoAltaIn,
    DispositivoAsignarIn,
    DispositivoEstatusOut,
    DispositivoOut,
)
from app.schemas.flujo import ConversionAutorizarIn, ConversionOut
from app.schemas.ingresos import IngresosOut
from app.schemas.reportes import ReporteOut
from app.schemas.tablero import TableroAdminOut
from app.schemas.tarifas import TarifaAlquilerEditarIn, TarifasOut, TarifaTramoEditarIn
from app.schemas.trabajos import (
    CerrarReclamacionIn,
    ExpedienteTrabajoOut,
    MarcaCasoIn,
    TrabajoListaOut,
)
from app.schemas.usuarios import EditarCuenta, MarcaIn, RegistroAdministrador, UsuarioDetalleOut, UsuarioListaOut
from app.services.auditoria import listar_auditoria, registrar_evento
from app.services.conversion import autorizar_conversion, listar_conversiones, rechazar_conversion
from app.services.dispositivos import (
    alta_dispositivo,
    asignar_dispositivo,
    desasignar_dispositivo,
    estatus_dispositivo,
    listar_dispositivos,
)
from app.services.ingresos import consultar_ingresos
from app.services.registro import registrar_administrador, registrar_cliente, registrar_proveedor
from app.services.reportes import listar_reportes
from app.services.tablero import obtener_tablero_admin
from app.services.tarifas import consultar_tarifas, editar_alquiler, editar_tramo
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


class MapaOut(BaseModel):
    latitud: float | None
    longitud: float | None
    etiqueta: str
    mapa_url: str
    tesela_url: str
    atribucion: str
    estado: EstadoEnvio
    detalle: str


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
    await registrar_evento(
        session,
        actor_usuario_id=administrador.id,
        accion="alta_cuenta",
        entidad="usuario",
        entidad_id=usuario.id,
        detalle=f"alta cliente {usuario.correo}",
    )
    logger.info("administrador %s registró cliente %s", administrador.id, usuario.id)
    return UsuarioOut.model_validate(usuario, from_attributes=True)


@router.post("/proveedores", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def alta_proveedor(
    datos: RegistroProveedor,
    session: SessionDep,
    administrador: AdministradorActual,
) -> UsuarioOut:
    """Alta `empresa` o `negocio` (N7). La ruta histórica `/proveedores` se conserva."""
    usuario = await registrar_proveedor(session, datos, administrador)
    await registrar_evento(
        session,
        actor_usuario_id=administrador.id,
        accion="alta_cuenta",
        entidad="usuario",
        entidad_id=usuario.id,
        detalle=f"alta {usuario.tipo_cuenta.value} {usuario.correo}",
    )
    logger.info("administrador %s registró %s %s", administrador.id, usuario.tipo_cuenta.value, usuario.id)
    return UsuarioOut.model_validate(usuario, from_attributes=True)


@router.post("/administradores", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def alta_administrador(
    datos: RegistroAdministrador,
    session: SessionDep,
    administrador: AdministradorActual,
) -> UsuarioOut:
    usuario = await registrar_administrador(session, datos, administrador)
    await registrar_evento(
        session,
        actor_usuario_id=administrador.id,
        accion="alta_cuenta",
        entidad="usuario",
        entidad_id=usuario.id,
        detalle=f"alta administrador {usuario.correo}",
    )
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
    await registrar_evento(
        session,
        actor_usuario_id=administrador.id,
        accion="edicion_cuenta",
        entidad="usuario",
        entidad_id=usuario_id,
        detalle=f"edición {datos.correo}",
    )
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
    await registrar_evento(
        session,
        actor_usuario_id=administrador.id,
        accion="marca",
        entidad="usuario",
        entidad_id=usuario_id,
        detalle=f"{datos.tipo.value}:{datos.codigo.value}",
    )
    logger.info("administrador %s registró una marca sobre la cuenta %s", administrador.id, usuario_id)
    return detalle


@router.post("/usuarios/{usuario_id}/desbloqueo", response_model=UsuarioDetalleOut)
async def desbloquear_cuenta(
    usuario_id: UUID,
    session: SessionDep,
    administrador: AdministradorActual,
) -> UsuarioDetalleOut:
    detalle = await desbloquear_perfil(session, usuario_id)
    await registrar_evento(
        session,
        actor_usuario_id=administrador.id,
        accion="desbloqueo",
        entidad="usuario",
        entidad_id=usuario_id,
        detalle="desbloqueo de perfil",
    )
    logger.info("administrador %s desbloqueó el perfil de la cuenta %s", administrador.id, usuario_id)
    return detalle


@router.post("/usuarios/{usuario_id}/baja", response_model=UsuarioDetalleOut)
async def procesar_baja_de_perfil(
    usuario_id: UUID,
    session: SessionDep,
    administrador: AdministradorActual,
) -> UsuarioDetalleOut:
    detalle = await procesar_baja_perfil(session, usuario_id)
    await registrar_evento(
        session,
        actor_usuario_id=administrador.id,
        accion="baja_procesada",
        entidad="usuario",
        entidad_id=usuario_id,
        detalle="baja de perfil procesada",
    )
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
        await registrar_evento(
            session,
            actor_usuario_id=administrador.id,
            accion="consulta_historial",
            entidad="solicitud",
            entidad_id=solicitud_id,
            detalle="historial acotado de ambos perfiles del caso",
        )
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


@router.get("/mapa", response_model=MapaOut)
async def consultar_mapa(
    administrador: AdministradorActual,
    calle_numero: str,
    colonia: str,
    ciudad: str,
    estado: str,
    codigo_postal: str,
) -> MapaOut:
    """D8 — geocodifica y devuelve URL OSM + plantilla de teselas con atribución."""
    vista = await vista_mapa(
        calle_numero=calle_numero,
        colonia=colonia,
        ciudad=ciudad,
        estado=estado,
        codigo_postal=codigo_postal,
    )
    logger.info("administrador %s consultó mapa OSM (%s)", administrador.id, vista.punto.geocodificacion.estado.value)
    return MapaOut(
        latitud=vista.punto.latitud,
        longitud=vista.punto.longitud,
        etiqueta=vista.punto.etiqueta,
        mapa_url=vista.punto.mapa_url,
        tesela_url=vista.tesela_url,
        atribucion=vista.atribucion,
        estado=vista.punto.geocodificacion.estado,
        detalle=vista.punto.geocodificacion.detalle,
    )


@router.post("/empresas", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def alta_empresa(
    datos: RegistroProveedor,
    session: SessionDep,
    administrador: AdministradorActual,
) -> UsuarioOut:
    datos.tipo_cuenta = "empresa"
    return await alta_proveedor(datos, session, administrador)


@router.post("/negocios", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def alta_negocio(
    datos: RegistroProveedor,
    session: SessionDep,
    administrador: AdministradorActual,
) -> UsuarioOut:
    datos.tipo_cuenta = "negocio"
    return await alta_proveedor(datos, session, administrador)


@router.get("/dispositivos", response_model=list[DispositivoOut])
async def consultar_dispositivos(
    session: SessionDep,
    administrador: AdministradorActual,
) -> list[DispositivoOut]:
    return await listar_dispositivos(session)


@router.post("/dispositivos", response_model=DispositivoOut, status_code=status.HTTP_201_CREATED)
async def registrar_dispositivo(
    datos: DispositivoAltaIn,
    session: SessionDep,
    administrador: AdministradorActual,
) -> DispositivoOut:
    return await alta_dispositivo(session, datos, administrador.id)


@router.post("/dispositivos/{dispositivo_id}/asignar", response_model=DispositivoOut)
async def asignar_dispositivo_a_perfil(
    dispositivo_id: UUID,
    datos: DispositivoAsignarIn,
    session: SessionDep,
    administrador: AdministradorActual,
) -> DispositivoOut:
    return await asignar_dispositivo(session, dispositivo_id, datos, administrador.id)


@router.post("/dispositivos/{dispositivo_id}/desasignar", response_model=DispositivoOut)
async def desasignar_dispositivo_al_pool(
    dispositivo_id: UUID,
    session: SessionDep,
    administrador: AdministradorActual,
) -> DispositivoOut:
    return await desasignar_dispositivo(session, dispositivo_id, administrador.id)


@router.get("/dispositivos/{dispositivo_id}/estatus", response_model=DispositivoEstatusOut)
async def consultar_estatus_dispositivo(
    dispositivo_id: UUID,
    session: SessionDep,
    administrador: AdministradorActual,
) -> DispositivoEstatusOut:
    return await estatus_dispositivo(session, dispositivo_id)


@router.get("/ingresos", response_model=IngresosOut)
async def consultar_ingresos_admin(
    session: SessionDep,
    administrador: AdministradorActual,
) -> IngresosOut:
    return await consultar_ingresos(session)


@router.get("/auditoria", response_model=AuditoriaListaOut)
async def consultar_auditoria(
    session: SessionDep,
    administrador: AdministradorActual,
    accion: str | None = None,
    limite: int = 200,
) -> AuditoriaListaOut:
    return await listar_auditoria(session, accion=accion, limite=limite)


@router.get("/reportes", response_model=list[ReporteOut])
async def consultar_reportes(
    session: SessionDep,
    administrador: AdministradorActual,
    perfil_cliente_id: UUID | None = None,
    perfil_proveedor_id: UUID | None = None,
    limite: int = 200,
) -> list[ReporteOut]:
    return await listar_reportes(
        session,
        perfil_cliente_id=perfil_cliente_id,
        perfil_proveedor_id=perfil_proveedor_id,
        limite=limite,
    )


@router.get("/tarifas", response_model=TarifasOut)
async def consultar_tarifas_admin(
    session: SessionDep,
    administrador: AdministradorActual,
) -> TarifasOut:
    return await consultar_tarifas(session)


@router.patch("/tarifas/tramos", response_model=TarifasOut)
async def editar_tramo_admin(
    datos: TarifaTramoEditarIn,
    session: SessionDep,
    administrador: AdministradorActual,
) -> TarifasOut:
    return await editar_tramo(session, datos, administrador.id)


@router.patch("/tarifas/alquiler", response_model=TarifasOut)
async def editar_alquiler_admin(
    datos: TarifaAlquilerEditarIn,
    session: SessionDep,
    administrador: AdministradorActual,
) -> TarifasOut:
    return await editar_alquiler(session, datos, administrador.id)


@router.get("/conversiones", response_model=list[ConversionOut])
async def consultar_conversiones(
    session: SessionDep,
    administrador: AdministradorActual,
    pendientes: bool = True,
) -> list[ConversionOut]:
    return await listar_conversiones(session, solo_pendientes=pendientes)


@router.post("/conversiones/{perfil_id}/autorizar", response_model=ConversionOut)
async def autorizar_conversion_admin(
    perfil_id: UUID,
    datos: ConversionAutorizarIn,
    session: SessionDep,
    administrador: AdministradorActual,
) -> ConversionOut:
    return await autorizar_conversion(session, administrador, perfil_id, datos)


@router.post("/conversiones/{perfil_id}/rechazar", response_model=ConversionOut)
async def rechazar_conversion_admin(
    perfil_id: UUID,
    session: SessionDep,
    administrador: AdministradorActual,
) -> ConversionOut:
    return await rechazar_conversion(session, administrador, perfil_id)
