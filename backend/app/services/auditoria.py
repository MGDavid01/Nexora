"""Log de auditoría persistido en `auditoria` (D4 / RN-014)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import Auditoria, Sancion, Usuario
from app.schemas.auditoria import AuditoriaEventoOut, AuditoriaListaOut


async def registrar_evento(
    session: AsyncSession,
    *,
    actor_usuario_id: UUID | None,
    accion: str,
    entidad: str,
    entidad_id: UUID | None = None,
    detalle: str | None = None,
) -> Auditoria:
    fila = Auditoria(
        actor_usuario_id=actor_usuario_id,
        accion=accion,
        entidad=entidad,
        entidad_id=entidad_id,
        detalle=detalle,
        creado_en=datetime.now(UTC),
    )
    session.add(fila)
    await session.flush()
    return fila


async def listar_auditoria(
    session: AsyncSession,
    *,
    accion: str | None = None,
    limite: int = 200,
) -> AuditoriaListaOut:
    filas = list((await session.exec(select(Auditoria))).all())
    if not filas:
        filas_virtuales = await _reconstruir(session)
        eventos = filas_virtuales
    else:
        eventos = [_out(fila) for fila in filas]
    if accion is not None:
        eventos = [evento for evento in eventos if evento.accion == accion]
    eventos.sort(key=lambda evento: (evento.creado_en is not None, str(evento.creado_en or "")), reverse=True)
    recorte = eventos[: max(1, min(limite, 500))]
    return AuditoriaListaOut(total=len(eventos), eventos=recorte)


def _out(fila: Auditoria) -> AuditoriaEventoOut:
    return AuditoriaEventoOut(
        id=fila.id,
        actor_usuario_id=fila.actor_usuario_id,
        accion=fila.accion,
        entidad=fila.entidad,
        entidad_id=fila.entidad_id,
        detalle=fila.detalle,
        creado_en=fila.creado_en,
    )


async def _reconstruir(session: AsyncSession) -> list[AuditoriaEventoOut]:
    eventos: list[AuditoriaEventoOut] = []
    for usuario in (await session.exec(select(Usuario))).all():
        if usuario.creado_en is not None:
            eventos.append(
                AuditoriaEventoOut(
                    id=usuario.id,
                    actor_usuario_id=None,
                    accion="alta_cuenta",
                    entidad="usuario",
                    entidad_id=usuario.id,
                    detalle=f"alta {usuario.tipo_cuenta.value} {usuario.correo}",
                    creado_en=_utc(usuario.creado_en),
                )
            )
        if usuario.baja_procesada_en is not None:
            eventos.append(
                AuditoriaEventoOut(
                    id=usuario.id,
                    actor_usuario_id=None,
                    accion="baja_procesada",
                    entidad="usuario",
                    entidad_id=usuario.id,
                    detalle="baja procesada",
                    creado_en=_utc(usuario.baja_procesada_en),
                )
            )
    for marca in (await session.exec(select(Sancion))).all():
        eventos.append(
            AuditoriaEventoOut(
                id=marca.id,
                actor_usuario_id=None,
                accion="marca",
                entidad="sancion",
                entidad_id=marca.id,
                detalle=f"{marca.tipo.value}:{marca.codigo.value}",
                creado_en=_utc(marca.creada_en or datetime.now(UTC)),
            )
        )
    return eventos


def _utc(valor: datetime) -> datetime:
    if valor.tzinfo is None:
        return valor.replace(tzinfo=UTC)
    return valor.astimezone(UTC)
