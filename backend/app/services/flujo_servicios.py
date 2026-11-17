from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import (
    Calificacion,
    CategoriaServicio,
    Cotizacion,
    HistorialServicio,
    Participacion,
    PerfilCliente,
    PerfilProveedor,
    Reclamacion,
    Servicio,
    Solicitud,
    Usuario,
)
from app.models.enums import (
    EstadoCotizacion,
    EstadoParticipacion,
    EstadoReclamacion,
    EstadoServicio,
    EstadoSolicitud,
    FuncionProveedor,
    LadoCalificacion,
    TipoCuenta,
    estado_servicio_publico,
    etiqueta_categoria_reclamacion,
)
from app.schemas.flujo import (
    CalificacionIn,
    CalificacionOut,
    InformeIn,
    InformeOut,
    ReclamacionResumenOut,
    ServicioDetalleOut,
    ServicioOut,
    TecnicoIn,
)
from app.services.avisos_negocio import avisar_cancelar
from app.services.ingresos import aplicar_cierre
from app.services.perfiles import es_lado_administrativo, es_proveedor, exigir_cliente, puede_mover_servicio

ACTIVOS = frozenset(
    {EstadoServicio.pendiente, EstadoServicio.en_curso, EstadoServicio.pendiente_historial}
)
CALIFICACION_OMITIDA = Decimal("4.5")


def _servicio_out(servicio: Servicio) -> ServicioOut:
    return ServicioOut(
        id=servicio.id,
        solicitud_id=servicio.solicitud_id,
        cotizacion_id=servicio.cotizacion_id,
        perfil_proveedor_id=servicio.perfil_proveedor_id,
        tecnico_usuario_id=servicio.tecnico_usuario_id,
        estado=estado_servicio_publico(servicio.estado),
        creado_en=servicio.creado_en,
    )


def nombre_cliente(perfil: PerfilCliente | None, usuario: Usuario | None) -> str:
    if perfil and perfil.nombre_comercial:
        return perfil.nombre_comercial
    if usuario:
        return usuario.nombre
    return "Cliente"


def nombre_proveedor(perfil: PerfilProveedor | None) -> str:
    return perfil.nombre_comercial if perfil else "Proveedor"


async def _detalle_out(session: AsyncSession, servicio: Servicio, solicitud: Solicitud) -> ServicioDetalleOut:
    cotizacion = await session.get(Cotizacion, servicio.cotizacion_id)
    proveedor = await session.get(PerfilProveedor, servicio.perfil_proveedor_id)
    cliente_perfil = await session.get(PerfilCliente, solicitud.perfil_cliente_id)
    categoria = await session.get(CategoriaServicio, solicitud.categoria_id)
    tecnico = await session.get(Usuario, servicio.tecnico_usuario_id) if servicio.tecnico_usuario_id else None
    usuario_cli = next(
        (
            item
            for item in (await session.exec(select(Usuario))).all()
            if item.perfil_cliente_id == solicitud.perfil_cliente_id
        ),
        None,
    )
    informe = next(
        (item for item in (await session.exec(select(HistorialServicio))).all() if item.servicio_id == servicio.id),
        None,
    )
    calificaciones = [
        CalificacionOut.model_validate(item, from_attributes=True)
        for item in (await session.exec(select(Calificacion))).all()
        if item.servicio_id == servicio.id
    ]
    abierta = next(
        (
            item
            for item in (await session.exec(select(Reclamacion))).all()
            if item.servicio_id == servicio.id and item.estado == EstadoReclamacion.abierta
        ),
        None,
    )
    base = _servicio_out(servicio)
    return ServicioDetalleOut(
        **base.model_dump(),
        titulo=solicitud.titulo,
        categoria=categoria.nombre if categoria else "",
        descripcion=solicitud.descripcion,
        costo_mxn=cotizacion.costo_mxn if cotizacion else None,
        cliente=nombre_cliente(cliente_perfil, usuario_cli),
        proveedor=nombre_proveedor(proveedor),
        tecnico=tecnico.nombre if tecnico else None,
        informe=InformeOut.model_validate(informe, from_attributes=True) if informe else None,
        calificaciones=calificaciones,
        reclamacion_abierta=(
            ReclamacionResumenOut(
                id=abierta.id,
                categoria=abierta.categoria,
                categoria_etiqueta=etiqueta_categoria_reclamacion(abierta.categoria),
                motivo=abierta.motivo,
                estado=abierta.estado,
            )
            if abierta
            else None
        ),
    )


async def _cargar(session: AsyncSession, servicio_id: UUID) -> tuple[Servicio, Solicitud]:
    servicio = await session.get(Servicio, servicio_id)
    solicitud = await session.get(Solicitud, servicio.solicitud_id) if servicio else None
    if servicio is None or solicitud is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ese servicio")
    return servicio, solicitud


def _lado_cliente(usuario: Usuario, solicitud: Solicitud) -> bool:
    return usuario.tipo_cuenta == TipoCuenta.cliente and usuario.perfil_cliente_id == solicitud.perfil_cliente_id


def _lado_proveedor(usuario: Usuario, servicio: Servicio) -> bool:
    return es_proveedor(usuario) and usuario.perfil_proveedor_id == servicio.perfil_proveedor_id


async def obtener_servicio(session: AsyncSession, usuario: Usuario, servicio_id: UUID) -> ServicioDetalleOut:
    servicio, solicitud = await _cargar(session, servicio_id)
    if not _lado_cliente(usuario, solicitud) and not _lado_proveedor(usuario, servicio):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ese servicio")
    return await _detalle_out(session, servicio, solicitud)


async def asignar_tecnico(
    session: AsyncSession, usuario: Usuario, servicio_id: UUID, datos: TecnicoIn
) -> ServicioOut:
    servicio, _solicitud = await _cargar(session, servicio_id)
    if not _lado_proveedor(usuario, servicio) or not es_lado_administrativo(usuario):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el lado administrativo asigna técnico")
    if servicio.estado not in {EstadoServicio.pendiente, EstadoServicio.en_curso, EstadoServicio.pendiente_historial}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El servicio ya no admite técnico")
    if usuario.tipo_cuenta == TipoCuenta.negocio:
        if datos.tecnico_usuario_id != usuario.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="En un negocio el técnico es el administrativo de campo",
            )
        servicio.tecnico_usuario_id = usuario.id
        await session.flush()
        return _servicio_out(servicio)
    tecnico = await session.get(Usuario, datos.tecnico_usuario_id)
    if (
        tecnico is None
        or tecnico.perfil_proveedor_id != servicio.perfil_proveedor_id
        or tecnico.funcion != FuncionProveedor.tecnico
        or tecnico.baja_procesada_en is not None
    ):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="El técnico no pertenece a este perfil")
    servicio.tecnico_usuario_id = tecnico.id
    await session.flush()
    return _servicio_out(servicio)


async def iniciar_servicio(session: AsyncSession, usuario: Usuario, servicio_id: UUID) -> ServicioOut:
    servicio, _solicitud = await _cargar(session, servicio_id)
    _exigir_movimiento(usuario, servicio)
    if servicio.estado != EstadoServicio.pendiente:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo un servicio pendiente pasa a en curso")
    if servicio.tecnico_usuario_id is None:
        if usuario.tipo_cuenta == TipoCuenta.negocio:
            servicio.tecnico_usuario_id = usuario.id
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Hay que asignar un técnico antes de pasar a en curso",
            )
    servicio.estado = EstadoServicio.en_curso
    await session.flush()
    return _servicio_out(servicio)


async def terminar_trabajo(session: AsyncSession, usuario: Usuario, servicio_id: UUID) -> ServicioOut:
    servicio, _solicitud = await _cargar(session, servicio_id)
    _exigir_movimiento(usuario, servicio)
    if servicio.estado != EstadoServicio.en_curso:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo un servicio en curso pasa a pendiente de informe")
    servicio.estado = EstadoServicio.pendiente_historial
    await session.flush()
    return _servicio_out(servicio)


async def registrar_informe(
    session: AsyncSession, usuario: Usuario, servicio_id: UUID, datos: InformeIn
) -> InformeOut:
    servicio, solicitud = await _cargar(session, servicio_id)
    _exigir_movimiento(usuario, servicio)
    if servicio.estado != EstadoServicio.pendiente_historial:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El informe se registra en pendiente de informe")
    if servicio.tecnico_usuario_id is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El servicio no tiene técnico")
    existente = next(
        (item for item in (await session.exec(select(HistorialServicio))).all() if item.servicio_id == servicio.id),
        None,
    )
    if existente is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El informe ya está registrado")
    informe = HistorialServicio(
        servicio_id=servicio.id,
        tecnico_usuario_id=servicio.tecnico_usuario_id,
        descripcion=datos.descripcion,
        tipo=datos.tipo,
        detalle_pieza=datos.detalle_pieza,
        fecha=datos.fecha or datetime.now(UTC),
    )
    session.add(informe)
    servicio.estado = EstadoServicio.cerrado
    solicitud.estado = EstadoSolicitud.cerrada
    await _cerrar_calificaciones(session, servicio)
    cotizacion = await session.get(Cotizacion, servicio.cotizacion_id)
    if cotizacion is not None:
        await aplicar_cierre(session, servicio, cotizacion)
    await session.flush()
    return InformeOut.model_validate(informe, from_attributes=True)


async def calificar(
    session: AsyncSession, usuario: Usuario, servicio_id: UUID, datos: CalificacionIn
) -> CalificacionOut:
    servicio, solicitud = await _cargar(session, servicio_id)
    if servicio.estado in {EstadoServicio.cerrado, EstadoServicio.cancelado}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La calificación ya no se puede cambiar")
    if _lado_cliente(usuario, solicitud):
        lado = LadoCalificacion.cliente
    elif _lado_proveedor(usuario, servicio) and (es_lado_administrativo(usuario) or usuario.id == servicio.tecnico_usuario_id):
        lado = LadoCalificacion.proveedor
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes calificar este servicio")
    previa = next(
        (
            item
            for item in (await session.exec(select(Calificacion))).all()
            if item.servicio_id == servicio.id and item.lado == lado
        ),
        None,
    )
    if previa is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este lado ya calificó")
    fila = Calificacion(
        servicio_id=servicio.id,
        lado=lado,
        valor=datos.valor,
        comentario=datos.comentario,
        es_automatica=False,
    )
    session.add(fila)
    await session.flush()
    return CalificacionOut.model_validate(fila, from_attributes=True)


async def cancelar_servicio(session: AsyncSession, usuario: Usuario, servicio_id: UUID) -> ServicioOut:
    servicio, solicitud = await _cargar(session, servicio_id)
    if not _lado_cliente(usuario, solicitud) and not _lado_proveedor(usuario, servicio):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ese servicio")
    if servicio.estado not in {EstadoServicio.pendiente, EstadoServicio.en_curso}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se cancela desde pendiente o en curso",
        )
    servicio.estado = EstadoServicio.cancelado
    if solicitud.estado == EstadoSolicitud.asignada:
        solicitud.estado = EstadoSolicitud.cancelada
    for participacion in (await session.exec(select(Participacion))).all():
        if participacion.solicitud_id != solicitud.id:
            continue
        if participacion.estado in {EstadoParticipacion.pendiente, EstadoParticipacion.aceptada}:
            participacion.estado = EstadoParticipacion.retirada
    for cotizacion in (await session.exec(select(Cotizacion))).all():
        if cotizacion.solicitud_id == solicitud.id and cotizacion.estado == EstadoCotizacion.enviada:
            cotizacion.estado = EstadoCotizacion.descartada
    await avisar_cancelar(session, solicitud, actor=usuario, perfil_proveedor_id=servicio.perfil_proveedor_id)
    await session.flush()
    return _servicio_out(servicio)


def _exigir_movimiento(usuario: Usuario, servicio: Servicio) -> None:
    if not _lado_proveedor(usuario, servicio) or not puede_mover_servicio(usuario):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes mover este servicio")
    if usuario.funcion == FuncionProveedor.tecnico and servicio.tecnico_usuario_id not in {None, usuario.id}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Este técnico no está asignado al servicio")


async def _cerrar_calificaciones(session: AsyncSession, servicio: Servicio) -> None:
    existentes = {
        item.lado
        for item in (await session.exec(select(Calificacion))).all()
        if item.servicio_id == servicio.id
    }
    for lado in (LadoCalificacion.cliente, LadoCalificacion.proveedor):
        if lado in existentes:
            continue
        session.add(
            Calificacion(
                servicio_id=servicio.id,
                lado=lado,
                valor=CALIFICACION_OMITIDA,
                comentario=None,
                es_automatica=True,
            )
        )


async def reasignar_tecnico_servicios(
    session: AsyncSession,
    *,
    perfil_proveedor_id: UUID,
    de_usuario_id: UUID,
    a_usuario_id: UUID,
) -> int:
    n = 0
    for servicio in (await session.exec(select(Servicio))).all():
        if servicio.perfil_proveedor_id != perfil_proveedor_id:
            continue
        if servicio.tecnico_usuario_id != de_usuario_id:
            continue
        if servicio.estado not in ACTIVOS:
            continue
        servicio.tecnico_usuario_id = a_usuario_id
        n += 1
    return n


async def servicios_activos_del_tecnico(
    session: AsyncSession, perfil_proveedor_id: UUID, tecnico_id: UUID
) -> list[Servicio]:
    return [
        item
        for item in (await session.exec(select(Servicio))).all()
        if item.perfil_proveedor_id == perfil_proveedor_id
        and item.tecnico_usuario_id == tecnico_id
        and item.estado in ACTIVOS
    ]
