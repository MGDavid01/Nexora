from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import TarifaAlquiler, TarifaTramo
from app.schemas.tarifas import (
    TarifaAlquilerEditarIn,
    TarifaAlquilerOut,
    TarifasOut,
    TarifaTramoEditarIn,
    TarifaTramoOut,
)
from app.services.auditoria import registrar_evento

TRAMOS_DEFECTO: tuple[tuple[Decimal, Decimal | None, Decimal], ...] = (
    (Decimal("0.00"), Decimal("1999.00"), Decimal("5.00")),
    (Decimal("2000.00"), Decimal("7999.00"), Decimal("7.00")),
    (Decimal("8000.00"), Decimal("24999.00"), Decimal("8.00")),
    (Decimal("25000.00"), None, Decimal("9.00")),
)
N_ALQUILER_DEFECTO = Decimal("10.00")


async def listar_tramos(session: AsyncSession) -> list[TarifaTramo]:
    filas = list((await session.exec(select(TarifaTramo))).all())
    if not filas:
        return [
            TarifaTramo(costo_desde_mxn=desde, costo_hasta_mxn=hasta, porcentaje=pct)
            for desde, hasta, pct in TRAMOS_DEFECTO
        ]
    filas.sort(key=lambda fila: fila.costo_desde_mxn)
    return filas


async def porcentaje_comision(session: AsyncSession, costo_mxn: Decimal) -> Decimal:
    for tramo in await listar_tramos(session):
        hasta = tramo.costo_hasta_mxn
        if costo_mxn < tramo.costo_desde_mxn:
            continue
        if hasta is None or costo_mxn <= hasta:
            return tramo.porcentaje
    return TRAMOS_DEFECTO[-1][2]


async def tarifa_alquiler(session: AsyncSession) -> TarifaAlquiler:
    fila = next(
        (
            item
            for item in (await session.exec(select(TarifaAlquiler))).all()
            if item.clave == "esp32_n"
        ),
        None,
    )
    if fila is None:
        return TarifaAlquiler(clave="esp32_n", porcentaje_n=N_ALQUILER_DEFECTO)
    return fila


async def consultar_tarifas(session: AsyncSession) -> TarifasOut:
    tramos = [
        TarifaTramoOut(
            id=fila.id,
            costo_desde_mxn=fila.costo_desde_mxn,
            costo_hasta_mxn=fila.costo_hasta_mxn,
            porcentaje=fila.porcentaje,
            actualizado_en=fila.actualizado_en,
        )
        for fila in await listar_tramos(session)
    ]
    alquiler = await tarifa_alquiler(session)
    return TarifasOut(
        tramos=tramos,
        alquiler=TarifaAlquilerOut(
            id=alquiler.id,
            clave=alquiler.clave,
            porcentaje_n=alquiler.porcentaje_n,
            actualizado_en=alquiler.actualizado_en,
        ),
    )


async def editar_tramo(
    session: AsyncSession,
    datos: TarifaTramoEditarIn,
    actor_id: UUID,
) -> TarifasOut:
    fila = await session.get(TarifaTramo, datos.id)
    if fila is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ese tramo")
    fila.porcentaje = datos.porcentaje
    fila.actualizado_en = datetime.now(UTC)
    await session.flush()
    await registrar_evento(
        session,
        actor_usuario_id=actor_id,
        accion="edicion_tarifas",
        entidad="tarifa_tramo",
        entidad_id=fila.id,
        detalle=f"porcentaje={datos.porcentaje}",
    )
    return await consultar_tarifas(session)


async def editar_alquiler(
    session: AsyncSession,
    datos: TarifaAlquilerEditarIn,
    actor_id: UUID,
) -> TarifasOut:
    fila = next(
        (item for item in (await session.exec(select(TarifaAlquiler))).all() if item.clave == "esp32_n"),
        None,
    )
    if fila is None:
        fila = TarifaAlquiler(clave="esp32_n", porcentaje_n=datos.porcentaje_n)
        session.add(fila)
    else:
        fila.porcentaje_n = datos.porcentaje_n
        fila.actualizado_en = datetime.now(UTC)
    await session.flush()
    await registrar_evento(
        session,
        actor_usuario_id=actor_id,
        accion="edicion_tarifas",
        entidad="tarifa_alquiler",
        entidad_id=fila.id,
        detalle=f"porcentaje_n={datos.porcentaje_n}",
    )
    return await consultar_tarifas(session)
