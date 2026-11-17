from datetime import UTC, datetime
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from fastapi import HTTPException, status

from app.models.entities import Reporte, Usuario
from app.schemas.reportes import ReporteOut


async def registrar_reporte(
    session: AsyncSession,
    *,
    accion: str,
    metrica: str,
    valor: str,
    perfil_cliente_id: UUID | None = None,
    perfil_proveedor_id: UUID | None = None,
    fecha: datetime | None = None,
) -> Reporte:
    fila = Reporte(
        perfil_cliente_id=perfil_cliente_id,
        perfil_proveedor_id=perfil_proveedor_id,
        accion=accion,
        metrica=metrica,
        valor=valor,
        fecha=fecha or datetime.now(UTC),
    )
    session.add(fila)
    await session.flush()
    return fila


async def listar_reportes(
    session: AsyncSession,
    *,
    perfil_cliente_id: UUID | None = None,
    perfil_proveedor_id: UUID | None = None,
    limite: int = 200,
) -> list[ReporteOut]:
    filas = list((await session.exec(select(Reporte))).all())
    if perfil_cliente_id is not None:
        filas = [fila for fila in filas if fila.perfil_cliente_id == perfil_cliente_id]
    if perfil_proveedor_id is not None:
        filas = [fila for fila in filas if fila.perfil_proveedor_id == perfil_proveedor_id]
    filas.sort(key=lambda fila: (fila.fecha is not None, str(fila.fecha)), reverse=True)
    recorte = filas[: max(1, min(limite, 500))]
    return [
        ReporteOut(
            id=fila.id,
            perfil_cliente_id=fila.perfil_cliente_id,
            perfil_proveedor_id=fila.perfil_proveedor_id,
            accion=fila.accion,
            metrica=fila.metrica,
            valor=fila.valor,
            fecha=fila.fecha,
        )
        for fila in recorte
    ]


async def listar_reportes_perfil(session: AsyncSession, usuario: Usuario) -> list[ReporteOut]:
    if usuario.perfil_cliente_id is not None:
        return await listar_reportes(session, perfil_cliente_id=usuario.perfil_cliente_id)
    if usuario.perfil_proveedor_id is not None:
        return await listar_reportes(session, perfil_proveedor_id=usuario.perfil_proveedor_id)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Solo un perfil cliente o proveedor consulta sus reportes",
    )
