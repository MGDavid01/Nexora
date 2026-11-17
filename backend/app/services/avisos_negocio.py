import logging
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.adaptadores.avisos import aviso_cancelar_servicio, aviso_denegar_solicitud, aviso_vencimiento_cotizacion
from app.models.entities import PerfilProveedor, Solicitud, Usuario

logger = logging.getLogger(__name__)


async def _correo_cliente(session: AsyncSession, solicitud: Solicitud) -> str | None:
    for usuario in (await session.exec(select(Usuario))).all():
        if usuario.perfil_cliente_id == solicitud.perfil_cliente_id and usuario.baja_procesada_en is None:
            return usuario.correo
    return None


async def _nombre_proveedor(session: AsyncSession, perfil_proveedor_id: UUID) -> str:
    perfil = await session.get(PerfilProveedor, perfil_proveedor_id)
    return perfil.nombre_comercial if perfil else "proveedor"


async def avisar_denegar(session: AsyncSession, solicitud: Solicitud, perfil_proveedor_id: UUID) -> None:
    correo = await _correo_cliente(session, solicitud)
    if not correo:
        return
    try:
        await aviso_denegar_solicitud(
            correo_cliente=correo,
            titulo_solicitud=solicitud.titulo,
            nombre_proveedor=await _nombre_proveedor(session, perfil_proveedor_id),
        )
    except Exception as exc:  # noqa: BLE001
        logger.info("aviso denegar omitido: %s", exc)


async def avisar_vencimiento(session: AsyncSession, solicitud: Solicitud, perfil_proveedor_id: UUID) -> None:
    correo = await _correo_cliente(session, solicitud)
    if not correo:
        return
    try:
        await aviso_vencimiento_cotizacion(
            correo_cliente=correo,
            titulo_solicitud=solicitud.titulo,
            nombre_proveedor=await _nombre_proveedor(session, perfil_proveedor_id),
        )
    except Exception as exc:  # noqa: BLE001
        logger.info("aviso vencimiento omitido: %s", exc)


async def avisar_cancelar(
    session: AsyncSession,
    solicitud: Solicitud,
    *,
    actor: Usuario,
    perfil_proveedor_id: UUID,
) -> None:
    destinos: list[str] = []
    for usuario in (await session.exec(select(Usuario))).all():
        if usuario.id == actor.id or usuario.baja_procesada_en is not None:
            continue
        if actor.tipo_cuenta.value == "cliente":
            if usuario.perfil_proveedor_id == perfil_proveedor_id:
                destinos.append(usuario.correo)
        elif usuario.perfil_cliente_id == solicitud.perfil_cliente_id:
            destinos.append(usuario.correo)
    for correo in destinos:
        try:
            await aviso_cancelar_servicio(
                correo_contraparte=correo,
                titulo_solicitud=solicitud.titulo,
                quien_cancela=actor.nombre,
            )
        except Exception as exc:  # noqa: BLE001
            logger.info("aviso cancelar omitido: %s", exc)
