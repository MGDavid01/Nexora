from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import (
    Calificacion,
    CategoriaServicio,
    Cotizacion,
    DispositivoEsp32,
    HistorialServicio,
    Participacion,
    PerfilCliente,
    PerfilProveedor,
    PerfilProveedorCategoria,
    Sancion,
    Servicio,
    Solicitud,
    Ubicacion,
    Usuario,
)
from app.models.enums import (
    EstadoCotizacion,
    EstadoParticipacion,
    EstadoServicio,
    EstadoSolicitud,
    FuncionProveedor,
    TipoCuenta,
)
from app.schemas.tablero import (
    CoberturaCategoriaItem,
    KpisTableroAdmin,
    PadronRecienteItem,
    ServicioActivoItem,
    SolicitudAbiertaItem,
    TableroAdminOut,
    VigilanciaPerfilItem,
)
from app.services.tablero_inicio import asegurar_utc as _asegurar_utc
from app.services.tablero_inicio import construir_inicio_admin


async def obtener_tablero_admin(session: AsyncSession) -> TableroAdminOut:
    ahora = datetime.now(UTC)

    clientes = list((await session.exec(select(PerfilCliente))).all())
    proveedores = list((await session.exec(select(PerfilProveedor))).all())
    usuarios = list((await session.exec(select(Usuario))).all())
    ubicaciones = list((await session.exec(select(Ubicacion))).all())
    categorias = list((await session.exec(select(CategoriaServicio))).all())
    rel_cat = list((await session.exec(select(PerfilProveedorCategoria))).all())
    solicitudes = list((await session.exec(select(Solicitud))).all())
    participaciones = list((await session.exec(select(Participacion))).all())
    cotizaciones = list((await session.exec(select(Cotizacion))).all())
    servicios = list((await session.exec(select(Servicio))).all())
    calificaciones = list((await session.exec(select(Calificacion))).all())
    sanciones = list((await session.exec(select(Sancion))).all())
    dispositivos = list((await session.exec(select(DispositivoEsp32))).all())
    historiales = list((await session.exec(select(HistorialServicio))).all())

    usuario_por_cliente: dict[UUID, Usuario] = {}
    usuarios_por_proveedor: dict[UUID, list[Usuario]] = {}
    usuario_por_id: dict[UUID, Usuario] = {}
    for u in usuarios:
        usuario_por_id[u.id] = u
        if u.perfil_cliente_id is not None:
            usuario_por_cliente[u.perfil_cliente_id] = u
        if u.perfil_proveedor_id is not None:
            usuarios_por_proveedor.setdefault(u.perfil_proveedor_id, []).append(u)

    ubicacion_cliente: dict[UUID, Ubicacion] = {}
    ubicacion_proveedor: dict[UUID, Ubicacion] = {}
    for ub in ubicaciones:
        if ub.perfil_cliente_id is not None:
            ubicacion_cliente[ub.perfil_cliente_id] = ub
        elif ub.perfil_proveedor_id is not None:
            ubicacion_proveedor[ub.perfil_proveedor_id] = ub

    cliente_por_id = {c.id: c for c in clientes}
    proveedor_por_id = {p.id: p for p in proveedores}
    categoria_por_id = {cat.id: cat for cat in categorias}
    solicitud_por_id = {s.id: s for s in solicitudes}

    def nombre_cliente(c: PerfilCliente) -> str:
        if c.nombre_comercial:
            return c.nombre_comercial
        usu = usuario_por_cliente.get(c.id)
        return usu.nombre if usu else "Cliente"

    # Participaciones e incumplimientos de 24 h
    part_por_solicitud: dict[UUID, list[Participacion]] = {}
    vencimientos_por_proveedor: dict[UUID, int] = {}
    participaciones_en_plazo = 0
    participaciones_por_vencer_6h = 0
    participaciones_vencidas_total = 0

    for part in participaciones:
        part_por_solicitud.setdefault(part.solicitud_id, []).append(part)
        if part.estado == EstadoParticipacion.vencida:
            participaciones_vencidas_total += 1
            vencimientos_por_proveedor[part.perfil_proveedor_id] = (
                vencimientos_por_proveedor.get(part.perfil_proveedor_id, 0) + 1
            )
        elif part.estado == EstadoParticipacion.aceptada:
            participaciones_en_plazo += 1
            aceptada_en = _asegurar_utc(part.aceptada_en, ahora)
            vence_en = aceptada_en + timedelta(hours=24)
            restantes_h = (vence_en - ahora).total_seconds() / 3600
            if restantes_h <= 6:
                participaciones_por_vencer_6h += 1

    # Cotizaciones por solicitud
    cot_enviadas_por_solicitud: dict[UUID, int] = {}
    for cot in cotizaciones:
        if cot.estado == EstadoCotizacion.enviada:
            cot_enviadas_por_solicitud[cot.solicitud_id] = (
                cot_enviadas_por_solicitud.get(cot.solicitud_id, 0) + 1
            )

    # Solicitudes abiertas
    solicitudes_abiertas = [s for s in solicitudes if s.estado == EstadoSolicitud.abierta]
    solicitudes_sin_cotizacion = 0
    solicitudes_rezagadas_24h = 0
    solicitudes_dirigidas_abiertas = 0
    solicitudes_con_cotizacion_por_elegir = 0
    cotizaciones_enviadas_activas = 0

    solicitudes_items: list[SolicitudAbiertaItem] = []
    solicitudes_abiertas_por_categoria: dict[UUID, int] = {}

    for sol in solicitudes_abiertas:
        solicitudes_abiertas_por_categoria[sol.categoria_id] = (
            solicitudes_abiertas_por_categoria.get(sol.categoria_id, 0) + 1
        )
        enviadas = cot_enviadas_por_solicitud.get(sol.id, 0)
        cotizaciones_enviadas_activas += enviadas
        creado = _asegurar_utc(sol.creado_en, ahora)
        horas_abierta = max(0, int((ahora - creado).total_seconds() // 3600))
        rezagada = enviadas == 0 and (ahora - creado) >= timedelta(hours=24)

        if enviadas == 0:
            solicitudes_sin_cotizacion += 1
        else:
            solicitudes_con_cotizacion_por_elegir += 1
        if rezagada:
            solicitudes_rezagadas_24h += 1
        if sol.dirigida_a_perfil_proveedor_id is not None:
            solicitudes_dirigidas_abiertas += 1

        parts = part_por_solicitud.get(sol.id, [])
        aceptadas_sol = [p for p in parts if p.estado == EstadoParticipacion.aceptada]
        vencidas_sol = sum(1 for p in parts if p.estado == EstadoParticipacion.vencida)

        min_restante: float | None = None
        for p in aceptadas_sol:
            aceptada_en = _asegurar_utc(p.aceptada_en, ahora)
            restante = ((aceptada_en + timedelta(hours=24)) - ahora).total_seconds() / 3600
            restante_red = round(restante, 1)
            if min_restante is None or restante_red < min_restante:
                min_restante = restante_red

        cli = cliente_por_id.get(sol.perfil_cliente_id)
        cat = categoria_por_id.get(sol.categoria_id)
        solicitudes_items.append(
            SolicitudAbiertaItem(
                id=sol.id,
                titulo=sol.titulo,
                cliente=nombre_cliente(cli) if cli else "Cliente",
                categoria=cat.nombre if cat else "General",
                es_dirigida=sol.dirigida_a_perfil_proveedor_id is not None,
                aceptadas_en_plazo=len(aceptadas_sol),
                vencidas=vencidas_sol,
                cotizaciones_enviadas=enviadas,
                horas_abierta=horas_abierta,
                rezagada_24h=rezagada,
                horas_restantes_plazo_min=min_restante,
            )
        )

    solicitudes_items.sort(
        key=lambda item: (
            not item.rezagada_24h,
            item.cotizaciones_enviadas > 0,
            -item.horas_abierta,
        )
    )

    # Servicios
    servicios_sin_tecnico = 0
    servicios_en_curso = 0
    servicios_pendiente_historial = 0
    servicios_cerrados = 0
    servicios_cancelados = 0
    servicios_items: list[ServicioActivoItem] = []

    for srv in servicios:
        if srv.estado == EstadoServicio.cerrado:
            servicios_cerrados += 1
            continue
        if srv.estado == EstadoServicio.cancelado:
            servicios_cancelados += 1
            continue

        if srv.estado == EstadoServicio.pendiente and srv.tecnico_usuario_id is None:
            servicios_sin_tecnico += 1
        elif srv.estado == EstadoServicio.en_curso:
            servicios_en_curso += 1
        elif srv.estado == EstadoServicio.pendiente_historial:
            servicios_pendiente_historial += 1

        sol = solicitud_por_id.get(srv.solicitud_id)
        prov = proveedor_por_id.get(srv.perfil_proveedor_id)
        tec = usuario_por_id.get(srv.tecnico_usuario_id) if srv.tecnico_usuario_id else None

        if srv.estado == EstadoServicio.pendiente:
            requisito = (
                "Asignar técnico del perfil antes de iniciar (RN-007)"
                if tec is None
                else "Listo para pasar a en curso"
            )
        elif srv.estado == EstadoServicio.en_curso:
            requisito = "En atención; historial del cliente accesible y auditado (RN-010)"
        else:
            requisito = "No cancelable; falta registrar historial para cerrar (RN-007/008)"

        servicios_items.append(
            ServicioActivoItem(
                id=srv.id,
                solicitud_titulo=sol.titulo if sol else "Servicio",
                proveedor=prov.nombre_comercial if prov else "Proveedor",
                tecnico=tec.nombre if tec else None,
                estado=srv.estado,
                requisito_avance=requisito,
                creado_en=srv.creado_en,
            )
        )

    prioridad_estado = {
        EstadoServicio.pendiente_historial: 0,
        EstadoServicio.pendiente: 1,
        EstadoServicio.en_curso: 2,
    }
    servicios_items.sort(
        key=lambda item: (
            prioridad_estado.get(item.estado, 9),
            item.tecnico is not None,
        )
    )

    servicios_activos = sum(
        1
        for srv in servicios
        if srv.estado
        in (
            EstadoServicio.pendiente,
            EstadoServicio.en_curso,
            EstadoServicio.pendiente_historial,
        )
    )

    # Sanciones, bloqueos y vigilancia
    ultima_causa_cliente: dict[UUID, str] = {}
    ultima_causa_proveedor: dict[UUID, str] = {}
    sanciones_ordenadas = sorted(
        sanciones,
        key=lambda s: _asegurar_utc(s.creada_en, ahora),
    )
    for san in sanciones_ordenadas:
        if san.perfil_cliente_id is not None:
            ultima_causa_cliente[san.perfil_cliente_id] = san.causa
        if san.perfil_proveedor_id is not None:
            ultima_causa_proveedor[san.perfil_proveedor_id] = san.causa

    perfiles_bloqueados = sum(1 for c in clientes if c.bloqueado) + sum(
        1 for p in proveedores if p.bloqueado
    )
    perfiles_en_riesgo = sum(
        1 for c in clientes if not c.bloqueado and c.conteo_marcas == 2
    ) + sum(1 for p in proveedores if not p.bloqueado and p.conteo_marcas == 2)
    proveedores_reincidentes_vencimiento = sum(
        1 for conteo in vencimientos_por_proveedor.values() if conteo >= 2
    )

    vigilancia: list[VigilanciaPerfilItem] = []
    for c in clientes:
        if c.bloqueado or c.conteo_marcas > 0:
            if c.bloqueado:
                motivo = "Bloqueado (3 marcas): requiere revisión de Nexora para desbloquear"
            elif c.conteo_marcas == 2:
                motivo = "En riesgo (2/3 marcas): la siguiente marca bloquea la cuenta"
            else:
                motivo = "Con antecedente (1/3 marcas)"
            vigilancia.append(
                VigilanciaPerfilItem(
                    perfil_id=c.id,
                    nombre=nombre_cliente(c),
                    tipo_perfil=f"Cliente ({c.tipo.value})",
                    conteo_marcas=c.conteo_marcas,
                    bloqueado=c.bloqueado,
                    vencimientos_24h=0,
                    ultima_causa=ultima_causa_cliente.get(c.id),
                    motivo_atencion=motivo,
                )
            )

    for p in proveedores:
        venc_p = vencimientos_por_proveedor.get(p.id, 0)
        if p.bloqueado or p.conteo_marcas > 0 or venc_p > 0:
            if p.bloqueado:
                motivo = "Bloqueado (3 marcas): cotizaciones descartadas; espera revisión"
            elif p.conteo_marcas == 2:
                motivo = "En riesgo (2/3 marcas): la siguiente marca bloquea a sus usuarios"
            elif venc_p >= 2:
                motivo = f"Reiteración de vencimientos 24 h ({venc_p}): candidato a sanción (RN-006)"
            elif p.conteo_marcas == 1:
                motivo = "Con antecedente (1/3 marcas)"
            else:
                motivo = "Primer vencimiento de 24 h sin cotizar (no bloquea)"
            vigilancia.append(
                VigilanciaPerfilItem(
                    perfil_id=p.id,
                    nombre=p.nombre_comercial,
                    tipo_perfil=f"Proveedor ({p.tipo.value})",
                    conteo_marcas=p.conteo_marcas,
                    bloqueado=p.bloqueado,
                    vencimientos_24h=venc_p,
                    ultima_causa=ultima_causa_proveedor.get(p.id),
                    motivo_atencion=motivo,
                )
            )

    vigilancia.sort(
        key=lambda item: (
            not item.bloqueado,
            -item.conteo_marcas,
            -item.vencimientos_24h,
        )
    )

    # Calificaciones
    calificaciones_totales = len(calificaciones)
    calificaciones_automaticas_45 = sum(1 for cal in calificaciones if cal.es_automatica)
    calificaciones_manuales = calificaciones_totales - calificaciones_automaticas_45
    calificaciones_bajas = sum(1 for cal in calificaciones if cal.valor <= Decimal("3.0"))
    promedio_calificacion: float | None = None
    if calificaciones_totales > 0:
        suma = sum((cal.valor for cal in calificaciones), Decimal("0"))
        promedio_calificacion = round(float(suma / Decimal(calificaciones_totales)), 2)

    # Padrón y usuarios
    clientes_activos = sum(1 for c in clientes if not c.bloqueado)
    proveedores_activos = sum(1 for p in proveedores if not p.bloqueado)
    usuarios_administrativos = sum(
        1
        for u in usuarios
        if u.tipo_cuenta == TipoCuenta.proveedor
        and u.funcion == FuncionProveedor.administrativo
        and u.baja_solicitada_en is None
    )
    usuarios_tecnicos = sum(
        1
        for u in usuarios
        if u.tipo_cuenta == TipoCuenta.proveedor
        and u.funcion == FuncionProveedor.tecnico
        and u.baja_solicitada_en is None
    )
    cuentas_en_baja = sum(1 for u in usuarios if u.baja_solicitada_en is not None)

    # Cobertura de categorías
    proveedores_activos_por_cat: dict[UUID, int] = {}
    categorias_por_proveedor: dict[UUID, list[str]] = {}
    for rel in rel_cat:
        prov = proveedor_por_id.get(rel.perfil_proveedor_id)
        cat = categoria_por_id.get(rel.categoria_id)
        if cat is not None:
            categorias_por_proveedor.setdefault(rel.perfil_proveedor_id, []).append(cat.nombre)
        if prov is not None and not prov.bloqueado:
            proveedores_activos_por_cat[rel.categoria_id] = (
                proveedores_activos_por_cat.get(rel.categoria_id, 0) + 1
            )

    cobertura_categorias: list[CoberturaCategoriaItem] = []
    for cat in categorias:
        prov_act = proveedores_activos_por_cat.get(cat.id, 0)
        sol_ab = solicitudes_abiertas_por_categoria.get(cat.id, 0)
        cobertura_categorias.append(
            CoberturaCategoriaItem(
                id=cat.id,
                nombre=cat.nombre,
                proveedores_activos=prov_act,
                solicitudes_abiertas=sol_ab,
                sin_cobertura=prov_act == 0,
            )
        )
    cobertura_categorias.sort(
        key=lambda c: (not c.sin_cobertura, -c.solicitudes_abiertas, c.nombre.casefold())
    )

    # Padrón reciente (últimos perfiles registrados)
    padron: list[PadronRecienteItem] = []
    for c in clientes:
        ub = ubicacion_cliente.get(c.id)
        usu = usuario_por_cliente.get(c.id)
        ciudad_estado = f"{ub.ciudad}, {ub.estado}" if ub else "Sin ubicación"
        detalle = usu.correo if usu else "1 cuenta solicitante"
        padron.append(
            PadronRecienteItem(
                perfil_id=c.id,
                nombre=nombre_cliente(c),
                rol="Cliente",
                subtipo=c.tipo,
                ubicacion=ciudad_estado,
                detalle=detalle,
                bloqueado=c.bloqueado,
                creado_en=c.creado_en,
            )
        )

    for p in proveedores:
        ub = ubicacion_proveedor.get(p.id)
        usus = usuarios_por_proveedor.get(p.id, [])
        n_admin = sum(1 for u in usus if u.funcion == FuncionProveedor.administrativo)
        n_tec = sum(1 for u in usus if u.funcion == FuncionProveedor.tecnico)
        cats = categorias_por_proveedor.get(p.id, [])
        ciudad_estado = f"{ub.ciudad}, {ub.estado}" if ub else "Sin ubicación"
        resumen_cats = ", ".join(cats[:2]) + (f" (+{len(cats) - 2})" if len(cats) > 2 else "")
        detalle = f"{n_admin} admin · {n_tec} téc" + (f" · {resumen_cats}" if resumen_cats else "")
        padron.append(
            PadronRecienteItem(
                perfil_id=p.id,
                nombre=p.nombre_comercial,
                rol="Proveedor",
                subtipo=p.tipo,
                ubicacion=ciudad_estado,
                detalle=detalle,
                bloqueado=p.bloqueado,
                creado_en=p.creado_en,
            )
        )

    padron.sort(key=lambda item: _asegurar_utc(item.creado_en, ahora), reverse=True)

    return TableroAdminOut(
        kpis=KpisTableroAdmin(
            solicitudes_abiertas=len(solicitudes_abiertas),
            solicitudes_sin_cotizacion=solicitudes_sin_cotizacion,
            solicitudes_rezagadas_24h=solicitudes_rezagadas_24h,
            solicitudes_dirigidas_abiertas=solicitudes_dirigidas_abiertas,
            solicitudes_con_cotizacion_por_elegir=solicitudes_con_cotizacion_por_elegir,
            participaciones_en_plazo=participaciones_en_plazo,
            participaciones_por_vencer_6h=participaciones_por_vencer_6h,
            participaciones_vencidas_total=participaciones_vencidas_total,
            cotizaciones_enviadas_activas=cotizaciones_enviadas_activas,
            servicios_activos=servicios_activos,
            servicios_sin_tecnico=servicios_sin_tecnico,
            servicios_en_curso=servicios_en_curso,
            servicios_pendiente_historial=servicios_pendiente_historial,
            servicios_cerrados=servicios_cerrados,
            servicios_cancelados=servicios_cancelados,
            perfiles_bloqueados=perfiles_bloqueados,
            perfiles_en_riesgo=perfiles_en_riesgo,
            proveedores_reincidentes_vencimiento=proveedores_reincidentes_vencimiento,
            marcas_totales=len(sanciones),
            promedio_calificacion=promedio_calificacion,
            calificaciones_totales=calificaciones_totales,
            calificaciones_manuales=calificaciones_manuales,
            calificaciones_automaticas_45=calificaciones_automaticas_45,
            calificaciones_bajas=calificaciones_bajas,
            clientes_activos=clientes_activos,
            proveedores_activos=proveedores_activos,
            usuarios_administrativos=usuarios_administrativos,
            usuarios_tecnicos=usuarios_tecnicos,
            dispositivos_esp32=len(dispositivos),
            cuentas_en_baja=cuentas_en_baja,
        ),
        vigilancia=vigilancia[:8],
        solicitudes_atencion=solicitudes_items[:8],
        servicios_activos=servicios_items[:8],
        cobertura_categorias=cobertura_categorias,
        padron_reciente=padron[:8],
        inicio=construir_inicio_admin(
            ahora=ahora,
            clientes=clientes,
            proveedores=proveedores,
            solicitudes=solicitudes,
            participaciones=participaciones,
            cotizaciones=cotizaciones,
            servicios=servicios,
            historiales=historiales,
            calificaciones=calificaciones,
            sanciones=sanciones,
            categorias=categorias,
            cuentas_en_baja=cuentas_en_baja,
        ),
    )
