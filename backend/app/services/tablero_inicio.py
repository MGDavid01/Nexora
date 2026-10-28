"""Agregados del inicio del administrador.

La comisión usa la escala por defecto (ADR-027). El porcentaje vigente al cerrar
todavía no se guarda en el servicio; hasta esa herramienta, el inicio recalcula
con la escala actual y solo incluye servicios cerrados de los últimos 30 días.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from app.models.entities import (
    Calificacion,
    CategoriaServicio,
    Cotizacion,
    HistorialServicio,
    Participacion,
    PerfilCliente,
    PerfilProveedor,
    Sancion,
    Servicio,
    Solicitud,
)
from app.models.enums import EstadoCotizacion, EstadoParticipacion, EstadoServicio, EstadoSolicitud
from app.schemas.tablero import (
    CategoriaInicioOut,
    InicioAdminOut,
    MixAltasOut,
    SerieAltasOut,
    SerieComisionOut,
)

VENTANA_DIAS = 30
ETIQUETAS_30 = ["1", "5", "10", "15", "20", "25", "30"]


def asegurar_utc(fecha: datetime | None, respaldo: datetime) -> datetime:
    if fecha is None:
        return respaldo
    if fecha.tzinfo is None:
        return fecha.replace(tzinfo=UTC)
    return fecha.astimezone(UTC)


def comision_simulada(costo: Decimal) -> Decimal:
    if costo <= Decimal("1999"):
        tasa = Decimal("0.05")
    elif costo <= Decimal("7999"):
        tasa = Decimal("0.07")
    elif costo <= Decimal("24999"):
        tasa = Decimal("0.08")
    else:
        tasa = Decimal("0.09")
    return (costo * tasa).quantize(Decimal("0.01"))


def indice_en_ventana(momento: datetime, ahora: datetime) -> int | None:
    dia_fin = ahora.astimezone(UTC).date()
    dia = momento.astimezone(UTC).date()
    delta = (dia_fin - dia).days
    if delta < 0 or delta >= VENTANA_DIAS:
        return None
    return VENTANA_DIAS - 1 - delta


def _dinero(valor: Decimal) -> float:
    return float(valor.quantize(Decimal("0.01")))


def _serie_comision(total: Decimal, base: Decimal, cierres: int, serie: list[Decimal]) -> SerieComisionOut:
    return SerieComisionOut(
        total=_dinero(total),
        base=_dinero(base),
        cierres=cierres,
        serie=[_dinero(punto) for punto in serie],
        etiquetas=list(ETIQUETAS_30),
    )


def _serie_altas(serie: list[int], meta: str) -> SerieAltasOut:
    return SerieAltasOut(
        total=sum(serie),
        meta=meta,
        serie=list(serie),
        etiquetas=list(ETIQUETAS_30),
    )


def construir_inicio_admin(
    *,
    ahora: datetime,
    clientes: list[PerfilCliente],
    proveedores: list[PerfilProveedor],
    solicitudes: list[Solicitud],
    participaciones: list[Participacion],
    cotizaciones: list[Cotizacion],
    servicios: list[Servicio],
    historiales: list[HistorialServicio],
    calificaciones: list[Calificacion],
    sanciones: list[Sancion],
    categorias: list[CategoriaServicio],
    cuentas_en_baja: int,
) -> InicioAdminOut:
    limite_24h = ahora - timedelta(hours=24)
    limite_7d = ahora - timedelta(days=7)
    limite_30d = ahora - timedelta(days=30)

    solicitud_por_id = {sol.id: sol for sol in solicitudes}
    cotizacion_por_id = {cot.id: cot for cot in cotizaciones}
    historial_por_servicio = {hist.servicio_id: hist for hist in historiales}

    nuevas_24h = sum(1 for sol in solicitudes if asegurar_utc(sol.creado_en, ahora) >= limite_24h)
    abiertas = [sol for sol in solicitudes if sol.estado == EstadoSolicitud.abierta]

    cotizaciones_por_solicitud: dict[UUID, int] = {}
    aceptadas = 0
    rechazadas_cot = 0
    for cot in cotizaciones:
        cotizaciones_por_solicitud[cot.solicitud_id] = cotizaciones_por_solicitud.get(cot.solicitud_id, 0) + 1
        if cot.estado == EstadoCotizacion.aceptada:
            aceptadas += 1
        elif cot.estado == EstadoCotizacion.rechazada:
            rechazadas_cot += 1

    con_alguna = len(cotizaciones_por_solicitud)
    promedio = (len(cotizaciones) / con_alguna) if con_alguna else 0.0
    umbral = round(promedio)
    sobre_promedio = sum(1 for cantidad in cotizaciones_por_solicitud.values() if cantidad > umbral)

    if abiertas:
        con_cotizacion = sum(1 for sol in abiertas if cotizaciones_por_solicitud.get(sol.id, 0) > 0)
        porcentaje = round(100 * con_cotizacion / len(abiertas))
    else:
        porcentaje = None

    rechazadas_7d = 0
    for part in participaciones:
        if part.estado != EstadoParticipacion.rechazada:
            continue
        sol = solicitud_por_id.get(part.solicitud_id)
        if sol is None:
            continue
        if asegurar_utc(sol.creado_en, ahora) >= limite_7d:
            rechazadas_7d += 1

    hasta_6 = entre_6_12 = entre_12_24 = vencidas = 0
    for part in participaciones:
        if part.estado == EstadoParticipacion.vencida:
            vencidas += 1
            continue
        if part.estado != EstadoParticipacion.aceptada:
            continue
        aceptada_en = asegurar_utc(part.aceptada_en, ahora)
        restantes = ((aceptada_en + timedelta(hours=24)) - ahora).total_seconds() / 3600
        if restantes <= 6:
            hasta_6 += 1
        elif restantes <= 12:
            entre_6_12 += 1
        else:
            entre_12_24 += 1

    abiertas_por_categoria: dict[UUID, int] = {}
    for sol in abiertas:
        abiertas_por_categoria[sol.categoria_id] = abiertas_por_categoria.get(sol.categoria_id, 0) + 1

    serie_global = [Decimal("0")] * VENTANA_DIAS
    base_global = Decimal("0")
    total_global = Decimal("0")
    cierres_global = 0
    series_cat = {cat.id: [Decimal("0")] * VENTANA_DIAS for cat in categorias}
    base_cat = {cat.id: Decimal("0") for cat in categorias}
    total_cat = {cat.id: Decimal("0") for cat in categorias}
    cierres_cat = {cat.id: 0 for cat in categorias}

    for srv in servicios:
        if srv.estado != EstadoServicio.cerrado:
            continue
        cot = cotizacion_por_id.get(srv.cotizacion_id)
        if cot is None:
            continue
        hist = historial_por_servicio.get(srv.id)
        momento = asegurar_utc(hist.fecha if hist is not None else srv.creado_en, ahora)
        idx = indice_en_ventana(momento, ahora)
        if idx is None:
            continue
        monto = comision_simulada(cot.costo_mxn)
        serie_global[idx] += monto
        total_global += monto
        base_global += cot.costo_mxn
        cierres_global += 1
        sol = solicitud_por_id.get(srv.solicitud_id)
        if sol is None or sol.categoria_id not in series_cat:
            continue
        series_cat[sol.categoria_id][idx] += monto
        total_cat[sol.categoria_id] += monto
        base_cat[sol.categoria_id] += cot.costo_mxn
        cierres_cat[sol.categoria_id] += 1

    categorias_out = [
        CategoriaInicioOut(
            nombre=cat.nombre,
            solicitudes_abiertas=abiertas_por_categoria.get(cat.id, 0),
            comision=_serie_comision(
                total_cat[cat.id],
                base_cat[cat.id],
                cierres_cat[cat.id],
                series_cat[cat.id],
            ),
        )
        for cat in categorias
    ]
    categorias_out.sort(key=lambda item: (-item.solicitudes_abiertas, item.nombre.casefold()))

    serie_clientes = [0] * VENTANA_DIAS
    serie_proveedores = [0] * VENTANA_DIAS
    for perfil in clientes:
        idx = indice_en_ventana(asegurar_utc(perfil.creado_en, ahora), ahora)
        if idx is not None:
            serie_clientes[idx] += 1
    for perfil in proveedores:
        idx = indice_en_ventana(asegurar_utc(perfil.creado_en, ahora), ahora)
        if idx is not None:
            serie_proveedores[idx] += 1

    altas_clientes = sum(serie_clientes)
    altas_proveedores = sum(serie_proveedores)
    serie_perfiles = [a + b for a, b in zip(serie_clientes, serie_proveedores, strict=True)]

    clientes_activos = sum(1 for perfil in clientes if not perfil.bloqueado)
    proveedores_activos = sum(1 for perfil in proveedores if not perfil.bloqueado)
    bloqueados = sum(1 for perfil in clientes if perfil.bloqueado) + sum(
        1 for perfil in proveedores if perfil.bloqueado
    )
    en_riesgo = sum(1 for perfil in clientes if not perfil.bloqueado and perfil.conteo_marcas == 2) + sum(
        1 for perfil in proveedores if not perfil.bloqueado and perfil.conteo_marcas == 2
    )

    vencimientos: dict[UUID, int] = {}
    for part in participaciones:
        if part.estado == EstadoParticipacion.vencida:
            vencimientos[part.perfil_proveedor_id] = vencimientos.get(part.perfil_proveedor_id, 0) + 1
    reincidentes = sum(1 for conteo in vencimientos.values() if conteo >= 2)
    marcas_30d = sum(1 for san in sanciones if asegurar_utc(san.creada_en, ahora) >= limite_30d)

    promedio_calificacion: float | None = None
    if calificaciones:
        suma = sum((cal.valor for cal in calificaciones), Decimal("0"))
        promedio_calificacion = round(float(suma / Decimal(len(calificaciones))), 2)
    sin_calificar = sum(1 for cal in calificaciones if cal.es_automatica)
    menores_2 = sum(1 for cal in calificaciones if cal.valor < Decimal("2"))
    mayores_45 = sum(1 for cal in calificaciones if cal.valor > Decimal("4.5"))

    return InicioAdminOut(
        nuevas_24h=nuevas_24h,
        en_proceso=len(abiertas),
        rechazadas_7d=rechazadas_7d,
        porcentaje_con_cotizacion=porcentaje,
        categorias=categorias_out,
        comision=_serie_comision(total_global, base_global, cierres_global, serie_global),
        cotizaciones_total=len(cotizaciones),
        cotizaciones_aceptadas=aceptadas,
        cotizaciones_rechazadas=rechazadas_cot,
        promedio_cotizaciones=round(promedio, 2),
        solicitudes_sobre_promedio=sobre_promedio,
        plazos_hasta_6h=hasta_6,
        plazos_6_a_12h=entre_6_12,
        plazos_12_a_24h=entre_12_24,
        plazos_vencidas=vencidas,
        clientes=clientes_activos,
        proveedores=proveedores_activos,
        altas_30d=altas_clientes + altas_proveedores,
        en_baja=cuentas_en_baja,
        crecimiento=_serie_altas(
            serie_perfiles,
            f"{altas_clientes} clientes · {altas_proveedores} proveedores",
        ),
        mix=[
            MixAltasOut(
                nombre="Clientes",
                altas=altas_clientes,
                crecimiento=_serie_altas(serie_clientes, "Altas de clientes"),
            ),
            MixAltasOut(
                nombre="Proveedores",
                altas=altas_proveedores,
                crecimiento=_serie_altas(serie_proveedores, "Altas de proveedores"),
            ),
        ],
        bloqueados=bloqueados,
        en_riesgo=en_riesgo,
        marcas_30d=marcas_30d,
        reincidentes_24h=reincidentes,
        promedio_calificacion=promedio_calificacion,
        sin_calificar=sin_calificar,
        calificaciones_menores_2=menores_2,
        calificaciones_mayores_45=mayores_45,
    )
