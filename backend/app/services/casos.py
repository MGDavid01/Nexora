"""Fábrica de casos para seed y tests. No es un endpoint público."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import (
    Calificacion,
    CategoriaServicio,
    Cotizacion,
    HistorialServicio,
    Participacion,
    Reclamacion,
    Sancion,
    Servicio,
    Solicitud,
    Ubicacion,
    Usuario,
)
from app.models.enums import (
    CategoriaReclamacion,
    CodigoMarca,
    EstadoCotizacion,
    EstadoParticipacion,
    EstadoReclamacion,
    EstadoServicio,
    EstadoSolicitud,
    LadoCalificacion,
    TipoHistorial,
    TipoMarca,
)


@dataclass
class CasoArmado:
    solicitud: Solicitud
    ubicacion: Ubicacion
    participaciones: list[Participacion] = field(default_factory=list)
    cotizaciones: list[Cotizacion] = field(default_factory=list)
    servicio: Servicio | None = None
    informe: HistorialServicio | None = None
    calificaciones: list[Calificacion] = field(default_factory=list)
    reclamacion: Reclamacion | None = None
    marca: Sancion | None = None


async def armar_caso(
    session: AsyncSession,
    *,
    clave: str,
    cliente: Usuario,
    proveedor: Usuario,
    categoria: CategoriaServicio,
    proveedor_b: Usuario | None = None,
    tecnico: Usuario | None = None,
    descripcion: str = "Equipo sin red",
    estado_solicitud: EstadoSolicitud = EstadoSolicitud.abierta,
    con_cotizacion: bool = False,
    segunda_cotizacion: bool = False,
    estado_servicio: EstadoServicio | None = None,
    con_informe: bool = False,
    calificacion: str | None = None,
    reclamacion: str | None = None,
    categoria_reclamacion: CategoriaReclamacion = CategoriaReclamacion.sin_iniciar,
    marca_codigo: CodigoMarca | None = None,
    marca_via_reclamacion: bool = False,
    marca_lado: str = "proveedor",
    dirigida: bool = False,
    ubicacion: dict[str, str] | None = None,
    coords: tuple[float, float] | None = None,
    texto_cotizacion: str = "Diagnóstico y reparación",
    costo: str = "1500.00",
    condiciones: str = "24 horas en sitio",
    texto_cotizacion_b: str = "Segunda oferta",
    costo_b: str = "1800.00",
    condiciones_b: str | None = None,
    texto_informe: str = "Se restableció la red local",
    tipo_informe: TipoHistorial = TipoHistorial.mantenimiento,
    detalle_pieza: str | None = None,
    motivo_reclamacion: str = "El trabajo no arrancó en el plazo acordado",
    comentario_calificacion: str | None = "Quedó bien",
) -> CasoArmado:
    existente = (await session.exec(select(Solicitud).where(Solicitud.titulo == clave))).first()
    if existente is not None:
        return await _cargar(session, existente)

    if cliente.perfil_cliente_id is None or proveedor.perfil_proveedor_id is None:
        raise ValueError("El caso requiere un cliente y un proveedor con perfil")

    solicitud = Solicitud(
        perfil_cliente_id=cliente.perfil_cliente_id,
        categoria_id=categoria.id,
        dirigida_a_perfil_proveedor_id=proveedor.perfil_proveedor_id if dirigida else None,
        titulo=clave,
        descripcion=descripcion,
        estado=estado_solicitud,
        datos_cerrados=estado_solicitud != EstadoSolicitud.abierta or con_cotizacion,
    )
    session.add(solicitud)
    await session.flush()
    datos_ubi = ubicacion or {
        "calle_numero": "Av. Revolución 1000",
        "colonia": "Zona Centro",
        "ciudad": "Tijuana",
        "estado": "Baja California",
        "codigo_postal": "22000",
    }
    ubicacion_fila = Ubicacion(
        calle_numero=datos_ubi["calle_numero"],
        colonia=datos_ubi["colonia"],
        ciudad=datos_ubi["ciudad"],
        estado=datos_ubi["estado"],
        codigo_postal=datos_ubi["codigo_postal"],
        solicitud_id=solicitud.id,
        latitud=coords[0] if coords else None,
        longitud=coords[1] if coords else None,
    )
    session.add(ubicacion_fila)

    participaciones: list[Participacion] = []
    cotizaciones: list[Cotizacion] = []
    if con_cotizacion or estado_servicio is not None:
        part, cot = _cotizacion_de(
            solicitud.id,
            proveedor.perfil_proveedor_id,
            aceptada=estado_servicio is not None,
            texto=texto_cotizacion,
            costo=costo,
            condiciones=condiciones,
        )
        session.add(part)
        await session.flush()
        cot.participacion_id = part.id
        session.add(cot)
        participaciones.append(part)
        cotizaciones.append(cot)

    if segunda_cotizacion:
        if proveedor_b is None or proveedor_b.perfil_proveedor_id is None:
            raise ValueError("La segunda cotización requiere otro proveedor")
        part_b, cot_b = _cotizacion_de(
            solicitud.id,
            proveedor_b.perfil_proveedor_id,
            aceptada=False,
            texto=texto_cotizacion_b,
            costo=costo_b,
            condiciones=condiciones_b or condiciones,
        )
        session.add(part_b)
        await session.flush()
        cot_b.participacion_id = part_b.id
        session.add(cot_b)
        participaciones.append(part_b)
        cotizaciones.append(cot_b)

    servicio: Servicio | None = None
    informe: HistorialServicio | None = None
    calificaciones: list[Calificacion] = []
    if estado_servicio is not None:
        if not cotizaciones:
            raise ValueError("Un servicio requiere cotización")
        servicio = Servicio(
            solicitud_id=solicitud.id,
            cotizacion_id=cotizaciones[0].id,
            perfil_proveedor_id=proveedor.perfil_proveedor_id,
            tecnico_usuario_id=tecnico.id if tecnico is not None else None,
            estado=estado_servicio,
        )
        session.add(servicio)
        await session.flush()
        if con_informe:
            if tecnico is None:
                raise ValueError("El informe requiere un técnico")
            informe = HistorialServicio(
                servicio_id=servicio.id,
                tecnico_usuario_id=tecnico.id,
                descripcion=texto_informe,
                tipo=tipo_informe,
                detalle_pieza=detalle_pieza,
                fecha=datetime.now(UTC),
            )
            session.add(informe)
        if calificacion == "auto":
            calificaciones = _calificaciones(servicio.id, manual=False)
        elif calificacion == "manual":
            calificaciones = _calificaciones(
                servicio.id, manual=True, comentario=comentario_calificacion
            )
        for item in calificaciones:
            session.add(item)

    reclamacion_obj: Reclamacion | None = None
    if reclamacion is not None:
        if servicio is None:
            raise ValueError("La reclamación requiere un servicio")
        estado_rec = EstadoReclamacion.abierta if reclamacion == "abierta" else EstadoReclamacion.cerrada
        reclamacion_obj = Reclamacion(
            servicio_id=servicio.id,
            reclamante_usuario_id=cliente.id,
            categoria=categoria_reclamacion,
            motivo=motivo_reclamacion,
            estado=estado_rec,
            cerrada_en=datetime.now(UTC) if estado_rec == EstadoReclamacion.cerrada else None,
        )
        session.add(reclamacion_obj)
        await session.flush()

    marca: Sancion | None = None
    if marca_codigo is not None:
        if servicio is None:
            raise ValueError("La marca del caso requiere un servicio")
        marca = Sancion(
            tipo=TipoMarca.advertencia,
            codigo=marca_codigo,
            descripcion="Marca originada en el expediente de Trabajos",
            perfil_cliente_id=cliente.perfil_cliente_id if marca_lado == "cliente" else None,
            perfil_proveedor_id=proveedor.perfil_proveedor_id if marca_lado == "proveedor" else None,
            servicio_id=servicio.id,
            reclamacion_id=reclamacion_obj.id if marca_via_reclamacion and reclamacion_obj else None,
        )
        session.add(marca)
        if marca_lado == "proveedor":
            from app.models.entities import PerfilProveedor

            perfil = await session.get(PerfilProveedor, proveedor.perfil_proveedor_id)
        else:
            from app.models.entities import PerfilCliente

            perfil = await session.get(PerfilCliente, cliente.perfil_cliente_id)
        if perfil is not None:
            perfil.conteo_marcas += 1
            if perfil.conteo_marcas >= 3:
                perfil.bloqueado = True

    await session.flush()
    return CasoArmado(
        solicitud=solicitud,
        ubicacion=ubicacion_fila,
        participaciones=participaciones,
        cotizaciones=cotizaciones,
        servicio=servicio,
        informe=informe,
        calificaciones=calificaciones,
        reclamacion=reclamacion_obj,
        marca=marca,
    )


async def asegurar_casos_demo(
    session: AsyncSession,
    *,
    cliente: Usuario,
    proveedor: Usuario,
    proveedor_b: Usuario,
    tecnico: Usuario,
    categoria: CategoriaServicio,
    categorias: dict[str, CategoriaServicio] | None = None,
) -> list[CasoArmado]:
    por_nombre = categorias or {}

    def _cat(nombre: str) -> CategoriaServicio:
        return por_nombre.get(nombre, categoria)

    playas = {
        "calle_numero": "Paseo Pedregal 220-B",
        "colonia": "Playas de Tijuana",
        "ciudad": "Tijuana",
        "estado": "Baja California",
        "codigo_postal": "22504",
    }
    centro = {
        "calle_numero": "Av. Revolución 1480",
        "colonia": "Zona Centro",
        "ciudad": "Tijuana",
        "estado": "Baja California",
        "codigo_postal": "22000",
    }
    rio = {
        "calle_numero": "Paseo de los Héroes 9350 int. 4",
        "colonia": "Zona Río",
        "ciudad": "Tijuana",
        "estado": "Baja California",
        "codigo_postal": "22010",
    }
    specs = [
        dict(
            clave="La red de recepción se cae cada tarde",
            descripcion=(
                "Desde el lunes la red de la recepción pierde conexión entre las 16:00 y las 18:00. "
                "Las tres cajas se quedan sin sistema y hay que cobrar a mano. Ya se reinició el módem "
                "Telmex tres veces y el problema vuelve."
            ),
            estado_solicitud=EstadoSolicitud.abierta,
            categoria=_cat("Redes"),
            ubicacion=playas,
            coords=(32.53050, -117.11730),
        ),
        dict(
            clave="Laptop del almacén no enciende",
            descripcion=(
                "Es una Dell Latitude 5540. El viernes hubo un corte de luz y desde entonces no da "
                "señal, ni siquiera el LED de carga. La necesitamos para el inventario del lunes."
            ),
            estado_solicitud=EstadoSolicitud.abierta,
            con_cotizacion=True,
            segunda_cotizacion=True,
            categoria=_cat("Hardware"),
            ubicacion=playas,
            coords=(32.53050, -117.11730),
            texto_cotizacion=(
                "Diagnóstico en sitio y, si aplica, cambio de fuente 65 W. Incluye respaldo de disco "
                "si el equipo responde."
            ),
            costo="1850.00",
            condiciones="Visita el mismo día hábil. Refacción de fuente por separado si hace falta.",
            texto_cotizacion_b=(
                "Recojo en Playas, diagnóstico en taller y entrega en 24 h. No incluye pieza."
            ),
            costo_b="1200.00",
            condiciones_b="Recolección entre 9:00 y 13:00. Entrega al día siguiente hábil.",
        ),
        dict(
            clave="Formatear e instalar Windows 11 en caja 2",
            descripcion=(
                "La PC de caja 2 (HP ProDesk) está lentísima y el Punto de Venta se cierra solo. "
                "Queremos formateo, Windows 11 Pro y dejar instalado el soft de SoftRestaurant."
            ),
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.en_curso,
            categoria=_cat("Software"),
            ubicacion=centro,
            coords=(32.51490, -117.03820),
            texto_cotizacion=(
                "Formateo, instalación de Windows 11 Pro, drivers, SoftRestaurant y prueba de "
                "impresión con la térmica del mostrador."
            ),
            costo="2200.00",
            condiciones="Un día en sitio. La licencia de Windows la pone el cliente.",
        ),
        dict(
            clave="Limpieza y respaldo del NAS de la oficina",
            descripcion=(
                "El Synology DS223 ya no deja entrar desde la red. Pedimos limpieza, revisión de "
                "discos y un respaldo en un disco externo que nosotros ponemos."
            ),
            estado_solicitud=EstadoSolicitud.cerrada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.cerrado,
            con_informe=True,
            calificacion="auto",
            categoria=_cat("Soporte técnico"),
            ubicacion=rio,
            coords=(32.53010, -117.01980),
            texto_cotizacion="Revisión de volúmenes, SMART de ambos discos y respaldo completo a USB.",
            costo="1600.00",
            condiciones="Media jornada en sitio. Disco externo lo aporta el cliente.",
            texto_informe=(
                "Se reparó el volumen 1 (se había desmontado tras un apagón). SMART de ambos "
                "Seagate IronWolf: saludable. Respaldo de 412 GB a disco WD 2 TB. Se dejó el NAS "
                "accesible por SMB y se explicó el apagado correcto."
            ),
        ),
        dict(
            clave="Cambio de fuente en la PC de diseño",
            descripcion=(
                "La workstation de diseño (Dell OptiPlex) se apaga sola a los diez minutos. Huele "
                "a quemado por la parte de atrás. Pedimos cambio de fuente y prueba con Photoshop."
            ),
            estado_solicitud=EstadoSolicitud.cerrada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.cerrado,
            con_informe=True,
            calificacion="manual",
            categoria=_cat("Hardware"),
            ubicacion=rio,
            coords=(32.53010, -117.01980),
            texto_cotizacion="Cambio de fuente 500 W 80 Plus y prueba de carga 40 minutos.",
            costo="2450.00",
            condiciones="Incluye pieza. Garantía de 90 días sobre la fuente.",
            tipo_informe=TipoHistorial.cambio_de_pieza,
            detalle_pieza="Fuente EVGA 500 W 80 Plus White, P/N 100-W1-0500-KR",
            texto_informe=(
                "Se sustituyó la fuente original (capacitores hinchados). El equipo encendió a la "
                "primera. Prueba de 40 minutos con Photoshop y Chrome: temperaturas normales, no "
                "se apagó. Se dejó el empaque de la pieza por si hay garantía."
            ),
            comentario_calificacion=(
                "Llegó a las 9:15 como quedó. Explicó el cambio y no se volvió a apagar en toda la tarde."
            ),
        ),
        dict(
            clave="Instalar repetidor Wi-Fi en la bodega de Otay",
            descripcion=(
                "En la bodega de Otay no pega la red de la oficina. Queríamos un repetidor o un "
                "punto de acceso. Al final ya no se pudo ese día: había inventario y no dejaban pasar."
            ),
            estado_solicitud=EstadoSolicitud.cancelada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.cancelado,
            categoria=_cat("Redes"),
            ubicacion={
                "calle_numero": "Blvd. Lázaro Cárdenas 1850",
                "colonia": "Otay Constituyentes",
                "ciudad": "Tijuana",
                "estado": "Baja California",
                "codigo_postal": "22457",
            },
            coords=(32.54760, -116.93800),
            texto_cotizacion="Suministro e instalación de Ubiquiti U6-Lite con backhaul al switch de oficina.",
            costo="3100.00",
            condiciones="Incluye aparato. Cableado hasta 40 m. Cita de 3 horas.",
        ),
        dict(
            clave="La impresora del mostrador sigue sacando hojas en blanco",
            descripcion=(
                "Es una Brother HL-L2460DW. Cambiamos tóner y no cambió nada. El técnico confirmó "
                "visita a las 10:00 del jueves y a las 13:00 nadie había llegado. El mostrador cobra "
                "sin ticket."
            ),
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente,
            reclamacion="abierta",
            categoria_reclamacion=CategoriaReclamacion.sin_iniciar,
            motivo_reclamacion=(
                "Confirmaron visita a las 10:00 del jueves 13 de noviembre y no se presentaron. "
                "Nadie avisó. La impresora del mostrador sigue sin imprimir y estamos cobrando a mano."
            ),
            categoria=_cat("Soporte técnico"),
            ubicacion=playas,
            coords=(32.53050, -117.11730),
            texto_cotizacion="Diagnóstico de fusor y, si aplica, cambio. Prueba de 20 páginas.",
            costo="950.00",
            condiciones="Visita en la mañana. Pieza por separado si el fusor está dañado.",
        ),
        dict(
            clave="No se presentó el técnico el martes en Playas",
            descripcion=(
                "Habíamos quedado a las 11:00 para revisar el switch de recepción. Nadie llegó. "
                "Ese día se cayó la red otra vez a las 16:30."
            ),
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente,
            reclamacion="cerrada",
            marca_codigo=CodigoMarca.servicio_sin_iniciar,
            marca_via_reclamacion=True,
            categoria_reclamacion=CategoriaReclamacion.sin_iniciar,
            motivo_reclamacion=(
                "El servicio lleva cuatro días en pendiente. El técnico no se presentó el martes "
                "ni reprogramó. Pedimos que Nexora lo marque; no es la primera vez con este proveedor."
            ),
            categoria=_cat("Redes"),
            ubicacion=playas,
            coords=(32.53050, -117.11730),
            texto_cotizacion="Revisión del switch TP-Link de 8 puertos y recableado del patch de recepción.",
            costo="1400.00",
            condiciones="Cita de 2 horas. Si hay que cambiar el switch, se cotiza aparte.",
        ),
        dict(
            clave="Revisión de cámaras en el estacionamiento",
            descripcion=(
                "Dos cámaras del estacionamiento (Hikvision) dejaron de grabar el viernes. El técnico "
                "ya vino, las dejó funcionando, pero no ha subido el informe y no podemos cerrar."
            ),
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente_historial,
            marca_codigo=CodigoMarca.informe_no_completado,
            categoria=_cat("Ciberseguridad"),
            ubicacion=centro,
            coords=(32.51490, -117.03820),
            texto_cotizacion="Revisión de NVR, regrabación de dos canales y prueba de 24 h.",
            costo="1800.00",
            condiciones="Incluye realineación de las dos cámaras. No incluye cambio de DVR.",
        ),
    ]
    casos: list[CasoArmado] = []
    for spec in specs:
        datos = dict(spec)
        cat = datos.pop("categoria", categoria)
        casos.append(
            await armar_caso(
                session,
                cliente=cliente,
                proveedor=proveedor,
                categoria=cat,
                proveedor_b=proveedor_b,
                tecnico=tecnico,
                **datos,
            )
        )
    return casos


def _cotizacion_de(
    solicitud_id: UUID,
    perfil_proveedor_id: UUID,
    *,
    aceptada: bool,
    texto: str,
    costo: str,
    condiciones: str = "24 horas en sitio",
) -> tuple[Participacion, Cotizacion]:
    participacion = Participacion(
        solicitud_id=solicitud_id,
        perfil_proveedor_id=perfil_proveedor_id,
        estado=EstadoParticipacion.cotizada,
        aceptada_en=datetime.now(UTC),
    )
    cotizacion = Cotizacion(
        solicitud_id=solicitud_id,
        perfil_proveedor_id=perfil_proveedor_id,
        participacion_id=participacion.id,
        descripcion=texto,
        costo_mxn=Decimal(costo),
        condiciones=condiciones,
        estado=EstadoCotizacion.aceptada if aceptada else EstadoCotizacion.enviada,
    )
    return participacion, cotizacion


def _calificaciones(
    servicio_id: UUID, *, manual: bool, comentario: str | None = "Quedó bien"
) -> list[Calificacion]:
    if manual:
        return [
            Calificacion(
                servicio_id=servicio_id,
                lado=LadoCalificacion.cliente,
                valor=Decimal("5.0"),
                comentario=comentario,
                es_automatica=False,
            ),
            Calificacion(
                servicio_id=servicio_id,
                lado=LadoCalificacion.proveedor,
                valor=Decimal("4.5"),
                comentario=None,
                es_automatica=True,
            ),
        ]
    return [
        Calificacion(
            servicio_id=servicio_id,
            lado=lado,
            valor=Decimal("4.5"),
            comentario=None,
            es_automatica=True,
        )
        for lado in (LadoCalificacion.cliente, LadoCalificacion.proveedor)
    ]


async def _cargar(session: AsyncSession, solicitud: Solicitud) -> CasoArmado:
    ubicacion = (await session.exec(select(Ubicacion).where(Ubicacion.solicitud_id == solicitud.id))).first()
    participaciones = list(
        (await session.exec(select(Participacion).where(Participacion.solicitud_id == solicitud.id))).all()
    )
    cotizaciones = list(
        (await session.exec(select(Cotizacion).where(Cotizacion.solicitud_id == solicitud.id))).all()
    )
    servicio = (await session.exec(select(Servicio).where(Servicio.solicitud_id == solicitud.id))).first()
    informe = None
    calificaciones: list[Calificacion] = []
    reclamacion = None
    marca = None
    if servicio is not None:
        informe = (
            await session.exec(select(HistorialServicio).where(HistorialServicio.servicio_id == servicio.id))
        ).first()
        calificaciones = list(
            (await session.exec(select(Calificacion).where(Calificacion.servicio_id == servicio.id))).all()
        )
        reclamaciones = list(
            (await session.exec(select(Reclamacion).where(Reclamacion.servicio_id == servicio.id))).all()
        )
        reclamacion = reclamaciones[0] if reclamaciones else None
        marcas = list((await session.exec(select(Sancion).where(Sancion.servicio_id == servicio.id))).all())
        marca = marcas[0] if marcas else None
    if ubicacion is None:
        raise ValueError("El caso existente no tiene ubicación de solicitud")
    return CasoArmado(
        solicitud=solicitud,
        ubicacion=ubicacion,
        participaciones=participaciones,
        cotizaciones=cotizaciones,
        servicio=servicio,
        informe=informe,
        calificaciones=calificaciones,
        reclamacion=reclamacion,
        marca=marca,
    )
