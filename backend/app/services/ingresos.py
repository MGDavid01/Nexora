from decimal import Decimal
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import AlquilerEsp32, Cotizacion, DispositivoEsp32, Reporte, Servicio
from app.schemas.ingresos import IngresoComisionItemOut, IngresosAlquilerOut, IngresosOut
from app.services.reportes import registrar_reporte
from app.services.tarifas import porcentaje_comision


def _accion_cierre(servicio_id: UUID) -> str:
    return f"cierre_servicio:{servicio_id}"


async def aplicar_cierre(
    session: AsyncSession,
    servicio: Servicio,
    cotizacion: Cotizacion,
) -> None:
    """H14: comisión RN-016 y N % de alquiler RN-018 al cerrar. No recalcula el pasado."""
    accion = _accion_cierre(servicio.id)
    ya = any(fila.accion == accion and fila.metrica == "comision_mxn" for fila in (await session.exec(select(Reporte))).all())
    if ya:
        return

    costo = Decimal(str(cotizacion.costo_mxn))
    pct = await porcentaje_comision(session, costo)
    comision = (costo * pct / Decimal("100")).quantize(Decimal("0.01"))
    alquiler_mxn = Decimal("0.00")
    for alquiler in (await session.exec(select(AlquilerEsp32))).all():
        if alquiler.desasignado_en is not None:
            continue
        if alquiler.perfil_proveedor_id != servicio.perfil_proveedor_id:
            continue
        tokens = Decimal(alquiler.tokens_consumidos)
        n_pct = Decimal(str(alquiler.porcentaje_n))
        alquiler_mxn += (tokens + (tokens * n_pct / Decimal("100"))).quantize(Decimal("0.01"))

    for metrica, valor in (
        ("comision_mxn", str(comision)),
        ("comision_pct", str(pct)),
        ("costo_mxn", str(costo)),
        ("alquiler_n_mxn", str(alquiler_mxn)),
        ("cotizacion_id", str(cotizacion.id)),
    ):
        await registrar_reporte(
            session,
            accion=accion,
            metrica=metrica,
            valor=valor,
            perfil_proveedor_id=servicio.perfil_proveedor_id,
        )


async def consultar_ingresos(session: AsyncSession) -> IngresosOut:
    reportes = list((await session.exec(select(Reporte))).all())
    servicios = {item.id: item for item in (await session.exec(select(Servicio))).all()}

    por_servicio: dict[str, dict[str, str]] = {}
    for fila in reportes:
        if not fila.accion.startswith("cierre_servicio:"):
            continue
        sid = fila.accion.split(":", 1)[1]
        por_servicio.setdefault(sid, {})[fila.metrica] = fila.valor

    items: list[IngresoComisionItemOut] = []
    total = Decimal("0.00")
    base = Decimal("0.00")
    alquiler_total = Decimal("0.00")
    for sid, metricas in por_servicio.items():
        try:
            servicio_id = UUID(sid)
        except ValueError:
            continue
        servicio = servicios.get(servicio_id)
        comision = Decimal(metricas.get("comision_mxn", "0"))
        costo = Decimal(metricas.get("costo_mxn", "0"))
        pct = Decimal(metricas.get("comision_pct", "0"))
        cotizacion_id = None
        if "cotizacion_id" in metricas:
            try:
                cotizacion_id = UUID(metricas["cotizacion_id"])
            except ValueError:
                cotizacion_id = servicio.cotizacion_id if servicio else None
        alquiler_total += Decimal(metricas.get("alquiler_n_mxn", "0"))
        total += comision
        base += costo
        items.append(
            IngresoComisionItemOut(
                servicio_id=servicio_id,
                cotizacion_id=cotizacion_id,
                perfil_proveedor_id=servicio.perfil_proveedor_id if servicio else None,
                costo_mxn=float(costo),
                porcentaje=float(pct),
                comision_mxn=float(comision),
                cerrado_en=None,
            )
        )

    asignados = sum(
        1
        for item in (await session.exec(select(DispositivoEsp32))).all()
        if item.perfil_cliente_id is not None or item.perfil_proveedor_id is not None
    )
    items.sort(key=lambda item: str(item.servicio_id))
    return IngresosOut(
        comision_total_mxn=float(total),
        comision_base_mxn=float(base),
        cierres=len(items),
        comisiones=items,
        alquiler=IngresosAlquilerOut(
            total_mxn=float(alquiler_total),
            dispositivos_asignados=asignados,
            detalle="Tokens de IA + N % registrados al cerrar. Sin tokens el monto de alquiler es 0.",
        ),
    )
