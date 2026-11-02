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
) -> CasoArmado:
    existente = (await session.exec(select(Solicitud).where(Solicitud.titulo == clave))).first()
    if existente is not None:
        return await _cargar(session, existente)

    if cliente.perfil_cliente_id is None or proveedor.perfil_proveedor_id is None:
        raise ValueError("El caso requiere un cliente y un proveedor con perfil")

    solicitud = Solicitud(
        perfil_cliente_id=cliente.perfil_cliente_id,
        categoria_id=categoria.id,
        titulo=clave,
        descripcion=descripcion,
        estado=estado_solicitud,
        datos_cerrados=estado_solicitud == EstadoSolicitud.cerrada,
    )
    session.add(solicitud)
    await session.flush()
    ubicacion = Ubicacion(
        calle_numero="Av. Revolución 1000",
        colonia="Zona Centro",
        ciudad="Tijuana",
        estado="Baja California",
        codigo_postal="22000",
        solicitud_id=solicitud.id,
    )
    session.add(ubicacion)

    participaciones: list[Participacion] = []
    cotizaciones: list[Cotizacion] = []
    if con_cotizacion or estado_servicio is not None:
        part, cot = _cotizacion_de(
            solicitud.id,
            proveedor.perfil_proveedor_id,
            aceptada=estado_servicio is not None,
            texto="Diagnóstico y reparación",
            costo="1500.00",
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
            texto="Segunda oferta",
            costo="1800.00",
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
                descripcion="Se restableció la red local",
                tipo=TipoHistorial.mantenimiento,
                fecha=datetime.now(UTC),
            )
            session.add(informe)
        if calificacion == "auto":
            calificaciones = _calificaciones(servicio.id, manual=False)
        elif calificacion == "manual":
            calificaciones = _calificaciones(servicio.id, manual=True)
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
            motivo="El trabajo no arrancó en el plazo acordado",
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
        ubicacion=ubicacion,
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
) -> list[CasoArmado]:
    specs = [
        dict(clave="[demo] Solicitud sin cotizar", estado_solicitud=EstadoSolicitud.abierta),
        dict(
            clave="[demo] Cotizaciones sin aceptar",
            estado_solicitud=EstadoSolicitud.abierta,
            con_cotizacion=True,
            segunda_cotizacion=True,
        ),
        dict(
            clave="[demo] Servicio en curso",
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.en_curso,
        ),
        dict(
            clave="[demo] Cerrado con 4.5 automático",
            estado_solicitud=EstadoSolicitud.cerrada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.cerrado,
            con_informe=True,
            calificacion="auto",
        ),
        dict(
            clave="[demo] Cerrado con nota manual",
            estado_solicitud=EstadoSolicitud.cerrada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.cerrado,
            con_informe=True,
            calificacion="manual",
        ),
        dict(
            clave="[demo] Servicio cancelado",
            estado_solicitud=EstadoSolicitud.cancelada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.cancelado,
        ),
        dict(
            clave="[demo] Reclamación abierta",
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente,
            reclamacion="abierta",
        ),
        dict(
            clave="[demo] Reclamación cerrada con marca",
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente,
            reclamacion="cerrada",
            marca_codigo=CodigoMarca.servicio_sin_iniciar,
            marca_via_reclamacion=True,
        ),
        dict(
            clave="[demo] Marca de caso sin reclamación",
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente_historial,
            marca_codigo=CodigoMarca.informe_no_completado,
        ),
    ]
    casos: list[CasoArmado] = []
    for spec in specs:
        casos.append(
            await armar_caso(
                session,
                cliente=cliente,
                proveedor=proveedor,
                categoria=categoria,
                proveedor_b=proveedor_b,
                tecnico=tecnico,
                **spec,
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
        condiciones="24 horas en sitio",
        estado=EstadoCotizacion.aceptada if aceptada else EstadoCotizacion.enviada,
    )
    return participacion, cotizacion


def _calificaciones(servicio_id: UUID, *, manual: bool) -> list[Calificacion]:
    if manual:
        return [
            Calificacion(
                servicio_id=servicio_id,
                lado=LadoCalificacion.cliente,
                valor=Decimal("5.0"),
                comentario="Quedó bien",
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
