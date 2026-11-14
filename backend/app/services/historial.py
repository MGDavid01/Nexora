from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import Cotizacion, HistorialServicio, Servicio, Solicitud, Usuario
from app.models.enums import EstadoServicio, TipoCuenta, estado_servicio_publico
from app.schemas.flujo import HistorialItemOut, InformeOut
from app.services.auditoria import registrar_evento
from app.services.flujo_servicios import ACTIVOS
from app.services.perfiles import es_lado_administrativo, es_proveedor


def _item(
    servicio: Servicio,
    solicitud: Solicitud,
    cotizacion: Cotizacion | None,
    informe: HistorialServicio | None,
) -> HistorialItemOut:
    return HistorialItemOut(
        servicio_id=servicio.id,
        solicitud_id=solicitud.id,
        titulo=solicitud.titulo,
        estado=estado_servicio_publico(servicio.estado),
        perfil_proveedor_id=servicio.perfil_proveedor_id,
        costo_mxn=cotizacion.costo_mxn if cotizacion else None,
        creado_en=servicio.creado_en,
        informe=InformeOut.model_validate(informe, from_attributes=True) if informe else None,
    )


async def historial_propio(session: AsyncSession, usuario: Usuario) -> list[HistorialItemOut]:
    solicitudes = {item.id: item for item in (await session.exec(select(Solicitud))).all()}
    cotizaciones = {item.id: item for item in (await session.exec(select(Cotizacion))).all()}
    informes = {item.servicio_id: item for item in (await session.exec(select(HistorialServicio))).all()}
    salida: list[HistorialItemOut] = []
    for servicio in (await session.exec(select(Servicio))).all():
        solicitud = solicitudes.get(servicio.solicitud_id)
        if solicitud is None:
            continue
        if usuario.tipo_cuenta == TipoCuenta.cliente:
            if solicitud.perfil_cliente_id != usuario.perfil_cliente_id:
                continue
        elif es_proveedor(usuario):
            if servicio.perfil_proveedor_id != usuario.perfil_proveedor_id:
                continue
            if usuario.funcion and usuario.funcion.value == "tecnico" and servicio.tecnico_usuario_id != usuario.id:
                continue
        else:
            continue
        salida.append(_item(servicio, solicitud, cotizaciones.get(servicio.cotizacion_id), informes.get(servicio.id)))
    salida.sort(key=lambda item: (item.creado_en is not None, str(item.creado_en or "")), reverse=True)
    return salida


async def historial_cliente_acotado(
    session: AsyncSession, usuario: Usuario, perfil_cliente_id: UUID
) -> list[HistorialItemOut]:
    if not es_proveedor(usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el proveedor con servicio activo consulta este historial",
        )
    solicitudes = {item.id: item for item in (await session.exec(select(Solicitud))).all()}
    hay_activo = False
    for servicio in (await session.exec(select(Servicio))).all():
        solicitud = solicitudes.get(servicio.solicitud_id)
        if solicitud is None or solicitud.perfil_cliente_id != perfil_cliente_id:
            continue
        if servicio.perfil_proveedor_id != usuario.perfil_proveedor_id or servicio.estado not in ACTIVOS:
            continue
        if es_lado_administrativo(usuario) or servicio.tecnico_usuario_id == usuario.id:
            hay_activo = True
            break
    if not hay_activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sin servicio activo no hay acceso al historial de ese cliente",
        )
    cotizaciones = {item.id: item for item in (await session.exec(select(Cotizacion))).all()}
    informes = {item.servicio_id: item for item in (await session.exec(select(HistorialServicio))).all()}
    salida: list[HistorialItemOut] = []
    for servicio in (await session.exec(select(Servicio))).all():
        solicitud = solicitudes.get(servicio.solicitud_id)
        if solicitud is None or solicitud.perfil_cliente_id != perfil_cliente_id:
            continue
        if servicio.estado != EstadoServicio.cerrado:
            continue
        salida.append(_item(servicio, solicitud, cotizaciones.get(servicio.cotizacion_id), informes.get(servicio.id)))
    await registrar_evento(
        session,
        actor_usuario_id=usuario.id,
        accion="consulta_historial",
        entidad="perfil_cliente",
        entidad_id=perfil_cliente_id,
        detalle=f"proveedor {usuario.perfil_proveedor_id}",
    )
    salida.sort(key=lambda item: (item.creado_en is not None, str(item.creado_en or "")), reverse=True)
    return salida
