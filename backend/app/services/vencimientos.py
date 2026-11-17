from datetime import UTC, datetime, timedelta

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import Cotizacion, Participacion, Solicitud
from app.models.enums import EstadoCotizacion, EstadoParticipacion, EstadoSolicitud
from app.services.avisos_negocio import avisar_vencimiento

PLAZO_COTIZAR = timedelta(hours=24)


def _utc(valor: datetime) -> datetime:
    if valor.tzinfo is None:
        return valor.replace(tzinfo=UTC)
    return valor.astimezone(UTC)


async def vencer_aceptadas(session: AsyncSession, *, ahora: datetime | None = None) -> int:
    """H6: participaciones aceptadas sin cotizar a las 24 h (RN-006)."""
    instante = ahora or datetime.now(UTC)
    vencidas = 0
    solicitudes = {item.id: item for item in (await session.exec(select(Solicitud))).all()}
    for participacion in (await session.exec(select(Participacion))).all():
        if participacion.estado != EstadoParticipacion.aceptada or participacion.aceptada_en is None:
            continue
        solicitud = solicitudes.get(participacion.solicitud_id)
        if solicitud is None:
            continue
        if solicitud.estado != EstadoSolicitud.abierta:
            continue
        if instante - _utc(participacion.aceptada_en) < PLAZO_COTIZAR:
            continue
        participacion.estado = EstadoParticipacion.vencida
        vencidas += 1
        await avisar_vencimiento(session, solicitud, participacion.perfil_proveedor_id)
    if vencidas:
        await session.flush()
    return vencidas


async def descartar_cotizaciones_huerfanas(session: AsyncSession) -> int:
    """Cotizaciones enviadas cuya solicitud ya no está abierta (RN-006)."""
    solicitudes = {item.id: item for item in (await session.exec(select(Solicitud))).all()}
    n = 0
    for cotizacion in (await session.exec(select(Cotizacion))).all():
        if cotizacion.estado != EstadoCotizacion.enviada:
            continue
        solicitud = solicitudes.get(cotizacion.solicitud_id)
        if solicitud is None or solicitud.estado == EstadoSolicitud.abierta:
            continue
        cotizacion.estado = EstadoCotizacion.descartada
        n += 1
    if n:
        await session.flush()
    return n


async def ejecutar_ciclo_24h(session: AsyncSession, *, ahora: datetime | None = None) -> dict[str, int]:
    """Job programable: vence participaciones a las 24 h y limpia cotizaciones. Sin despliegue."""
    vencidas = await vencer_aceptadas(session, ahora=ahora)
    descartadas = await descartar_cotizaciones_huerfanas(session)
    return {
        "vencidas": vencidas,
        "cotizaciones_descartadas": descartadas,
    }
