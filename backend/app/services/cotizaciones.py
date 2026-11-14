from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import Cotizacion, Participacion, Servicio, Solicitud, Usuario
from app.models.enums import EstadoCotizacion, EstadoParticipacion, EstadoServicio, EstadoSolicitud, TipoCuenta
from app.schemas.flujo import CotizacionCrearIn, CotizacionOut, ServicioOut
from app.services.perfiles import exigir_cliente, exigir_proveedor
from app.services.vencimientos import PLAZO_COTIZAR, vencer_aceptadas
from app.models.enums import estado_servicio_publico


def _utc(valor: datetime) -> datetime:
    if valor.tzinfo is None:
        return valor.replace(tzinfo=UTC)
    return valor.astimezone(UTC)


def _out(cotizacion: Cotizacion) -> CotizacionOut:
    return CotizacionOut.model_validate(cotizacion, from_attributes=True)


def _servicio_out(servicio: Servicio) -> ServicioOut:
    return ServicioOut(
        id=servicio.id,
        solicitud_id=servicio.solicitud_id,
        cotizacion_id=servicio.cotizacion_id,
        perfil_proveedor_id=servicio.perfil_proveedor_id,
        tecnico_usuario_id=servicio.tecnico_usuario_id,
        estado=estado_servicio_publico(servicio.estado),
        creado_en=servicio.creado_en,
    )


async def cotizar(
    session: AsyncSession,
    usuario: Usuario,
    solicitud_id: UUID,
    datos: CotizacionCrearIn,
) -> CotizacionOut:
    await vencer_aceptadas(session)
    perfil_id = exigir_proveedor(usuario)
    solicitud = await session.get(Solicitud, solicitud_id)
    if solicitud is None or solicitud.estado != EstadoSolicitud.abierta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe una solicitud abierta")
    participacion = next(
        (
            item
            for item in (await session.exec(select(Participacion))).all()
            if item.solicitud_id == solicitud.id and item.perfil_proveedor_id == perfil_id
        ),
        None,
    )
    if participacion is None or participacion.estado != EstadoParticipacion.aceptada:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se cotiza una participación aceptada y vigente",
        )
    if participacion.aceptada_en is not None and datetime.now(UTC) - _utc(participacion.aceptada_en) >= PLAZO_COTIZAR:
        participacion.estado = EstadoParticipacion.vencida
        await session.flush()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El plazo de 24 horas ya venció")
    existente = next(
        (
            item
            for item in (await session.exec(select(Cotizacion))).all()
            if item.solicitud_id == solicitud.id and item.perfil_proveedor_id == perfil_id
        ),
        None,
    )
    if existente is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya hay una cotización de este perfil")
    cotizacion = Cotizacion(
        solicitud_id=solicitud.id,
        perfil_proveedor_id=perfil_id,
        participacion_id=participacion.id,
        descripcion=datos.descripcion,
        costo_mxn=datos.costo_mxn,
        condiciones=datos.condiciones,
        estado=EstadoCotizacion.enviada,
    )
    session.add(cotizacion)
    participacion.estado = EstadoParticipacion.cotizada
    await session.flush()
    return _out(cotizacion)


async def listar_cotizaciones(session: AsyncSession, usuario: Usuario, solicitud_id: UUID) -> list[CotizacionOut]:
    await vencer_aceptadas(session)
    solicitud = await session.get(Solicitud, solicitud_id)
    if solicitud is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe esa solicitud")
    if usuario.tipo_cuenta == TipoCuenta.cliente:
        if solicitud.perfil_cliente_id != usuario.perfil_cliente_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe esa solicitud")
        filas = [
            item
            for item in (await session.exec(select(Cotizacion))).all()
            if item.solicitud_id == solicitud.id
        ]
    else:
        perfil_id = exigir_proveedor(usuario)
        filas = [
            item
            for item in (await session.exec(select(Cotizacion))).all()
            if item.solicitud_id == solicitud.id and item.perfil_proveedor_id == perfil_id
        ]
    filas.sort(key=lambda item: (item.creado_en is not None, str(item.creado_en or "")), reverse=True)
    return [_out(item) for item in filas]


async def rechazar_cotizacion(session: AsyncSession, usuario: Usuario, cotizacion_id: UUID) -> CotizacionOut:
    exigir_cliente(usuario)
    cotizacion = await session.get(Cotizacion, cotizacion_id)
    solicitud = await session.get(Solicitud, cotizacion.solicitud_id) if cotizacion else None
    if cotizacion is None or solicitud is None or solicitud.perfil_cliente_id != usuario.perfil_cliente_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe esa cotización")
    if solicitud.estado != EstadoSolicitud.abierta or cotizacion.estado != EstadoCotizacion.enviada:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Esa cotización ya no se puede rechazar")
    cotizacion.estado = EstadoCotizacion.rechazada
    await session.flush()
    return _out(cotizacion)


async def elegir_cotizacion(session: AsyncSession, usuario: Usuario, cotizacion_id: UUID) -> ServicioOut:
    await vencer_aceptadas(session)
    exigir_cliente(usuario)
    cotizacion = await session.get(Cotizacion, cotizacion_id)
    solicitud = await session.get(Solicitud, cotizacion.solicitud_id) if cotizacion else None
    if cotizacion is None or solicitud is None or solicitud.perfil_cliente_id != usuario.perfil_cliente_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe esa cotización")
    if solicitud.estado != EstadoSolicitud.abierta:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La solicitud ya no está abierta")
    if cotizacion.estado != EstadoCotizacion.enviada:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se elige una cotización enviada")
    existente = next(
        (item for item in (await session.exec(select(Servicio))).all() if item.solicitud_id == solicitud.id),
        None,
    )
    if existente is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya hay un servicio para esta solicitud")

    cotizacion.estado = EstadoCotizacion.aceptada
    solicitud.estado = EstadoSolicitud.asignada
    for otra in (await session.exec(select(Cotizacion))).all():
        if otra.solicitud_id == solicitud.id and otra.id != cotizacion.id and otra.estado == EstadoCotizacion.enviada:
            otra.estado = EstadoCotizacion.descartada
    for participacion in (await session.exec(select(Participacion))).all():
        if participacion.solicitud_id != solicitud.id:
            continue
        if participacion.estado in {EstadoParticipacion.pendiente, EstadoParticipacion.aceptada}:
            participacion.estado = EstadoParticipacion.retirada

    tecnico_id = None
    if True:
        campo = next(
            (
                item
                for item in (await session.exec(select(Usuario))).all()
                if item.perfil_proveedor_id == cotizacion.perfil_proveedor_id
                and item.tipo_cuenta == TipoCuenta.negocio
                and item.baja_procesada_en is None
            ),
            None,
        )
        if campo is not None:
            tecnico_id = campo.id

    servicio = Servicio(
        solicitud_id=solicitud.id,
        cotizacion_id=cotizacion.id,
        perfil_proveedor_id=cotizacion.perfil_proveedor_id,
        tecnico_usuario_id=tecnico_id,
        estado=EstadoServicio.pendiente,
    )
    session.add(servicio)
    await session.flush()
    return _servicio_out(servicio)
