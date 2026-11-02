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
    Sancion,
    Servicio,
    Solicitud,
    Ubicacion,
    Usuario,
)
from app.models.enums import (
    CODIGOS_MARCA_DEL_CASO,
    CodigoMarca,
    EstadoReclamacion,
    EstadoSolicitud,
    FuncionProveedor,
    estado_servicio_publico,
    etiqueta_categoria_reclamacion,
    etiqueta_codigo_marca,
)
from app.schemas.trabajos import (
    CalificacionTrabajoOut,
    CerrarReclamacionIn,
    CotizacionTrabajoOut,
    ExpedienteTrabajoOut,
    HistorialAcotadoOut,
    HistorialServicioResumenOut,
    InformeTrabajoOut,
    MarcaCasoIn,
    MarcaCasoOut,
    ParticipacionTrabajoOut,
    ReclamacionTrabajoOut,
    ServicioTrabajoOut,
    SolicitudTrabajoOut,
    TrabajoListaOut,
    UbicacionTrabajoOut,
)
from app.schemas.usuarios import MarcaIn
from app.services.marcas import aplicar_marca
from app.services.reclamaciones import cerrar_reclamacion


async def listar_trabajos(
    session: AsyncSession,
    *,
    etapa: str | None = None,
    reclamacion: str | None = None,
    cierre: str | None = None,
    marca: str | None = None,
    q: str | None = None,
) -> list[TrabajoListaOut]:
    grafo = await _grafo(session)
    filas: list[TrabajoListaOut] = []
    busqueda = (q or "").strip().casefold()
    for solicitud in grafo.solicitudes:
        fila = _fila_lista(solicitud, grafo)
        if etapa and fila.etapa != etapa:
            continue
        if cierre and fila.cierre != cierre:
            continue
        if marca == "con" and not fila.hay_marca:
            continue
        if marca == "sin" and fila.hay_marca:
            continue
        if reclamacion:
            estados = grafo.reclamaciones_por_servicio.get(
                grafo.servicio_por_solicitud[solicitud.id].id
                if solicitud.id in grafo.servicio_por_solicitud
                else None,
                [],
            )
            if not any(item.estado.value == reclamacion for item in estados):
                continue
        if busqueda:
            hay = busqueda in fila.titulo.casefold() or busqueda in fila.cliente.casefold() or busqueda in fila.categoria.casefold()
            if not hay:
                continue
        filas.append(fila)
    filas.sort(key=lambda item: item.creado_en or item.solicitud_id, reverse=True)
    return filas


async def obtener_expediente(session: AsyncSession, solicitud_id: UUID) -> ExpedienteTrabajoOut:
    grafo = await _grafo(session)
    solicitud = next((item for item in grafo.solicitudes if item.id == solicitud_id), None)
    if solicitud is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe esa solicitud")
    servicio = grafo.servicio_por_solicitud.get(solicitud.id)
    reclamaciones = grafo.reclamaciones_por_servicio.get(servicio.id, []) if servicio else []
    marcas = grafo.marcas_por_servicio.get(servicio.id, []) if servicio else []
    ver_historial = bool(reclamaciones or marcas)
    historial = _historial_acotado(solicitud, servicio, grafo) if ver_historial else None
    return ExpedienteTrabajoOut(
        solicitud=_solicitud_out(solicitud, grafo),
        participaciones=[
            _participacion_out(item, grafo) for item in grafo.participaciones_por_solicitud.get(solicitud.id, [])
        ],
        cotizaciones=[
            _cotizacion_out(item, grafo) for item in grafo.cotizaciones_por_solicitud.get(solicitud.id, [])
        ],
        servicio=_servicio_out(servicio, grafo) if servicio else None,
        reclamaciones=[_reclamacion_out(item, grafo) for item in reclamaciones],
        marcas=[_marca_out(item) for item in marcas],
        historial_perfiles=historial,
    )


async def cerrar_reclamacion_del_caso(
    session: AsyncSession,
    solicitud_id: UUID,
    reclamacion_id: UUID,
    datos: CerrarReclamacionIn,
) -> ExpedienteTrabajoOut:
    reclamacion = await session.get(Reclamacion, reclamacion_id)
    if reclamacion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe esa reclamación")
    servicio = await session.get(Servicio, reclamacion.servicio_id)
    if servicio is None or servicio.solicitud_id != solicitud_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La reclamación no pertenece a ese caso")
    await cerrar_reclamacion(
        session,
        reclamacion,
        desenlace=datos.desenlace,
        tipo=datos.tipo,
        codigo=datos.codigo,
        descripcion=datos.descripcion,
        perfil_afectado=datos.perfil_afectado,
    )
    return await obtener_expediente(session, solicitud_id)


async def registrar_marca_del_caso(
    session: AsyncSession,
    solicitud_id: UUID,
    datos: MarcaCasoIn,
) -> ExpedienteTrabajoOut:
    servicio = (
        await session.exec(select(Servicio).where(Servicio.solicitud_id == solicitud_id))
    ).first()
    if servicio is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La marca del caso requiere un servicio",
        )
    if datos.codigo not in CODIGOS_MARCA_DEL_CASO:
        detalle = (
            "reiteracion_vencimiento_24h no se registra desde Trabajos"
            if datos.codigo == CodigoMarca.reiteracion_vencimiento_24h
            else "Ese código no es una marca del caso"
        )
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detalle)
    afectado = await _usuario_lado(session, servicio, datos.perfil_afectado)
    await aplicar_marca(
        session,
        afectado,
        MarcaIn(tipo=datos.tipo, codigo=datos.codigo, descripcion=datos.descripcion),
        servicio_id=servicio.id,
    )
    return await obtener_expediente(session, solicitud_id)


class _Grafo:
    def __init__(self) -> None:
        self.solicitudes: list[Solicitud] = []
        self.clientes: dict[UUID, PerfilCliente] = {}
        self.proveedores: dict[UUID, PerfilProveedor] = {}
        self.usuarios: dict[UUID, Usuario] = {}
        self.usuario_cliente: dict[UUID, Usuario] = {}
        self.usuarios_proveedor: dict[UUID, list[Usuario]] = {}
        self.categorias: dict[UUID, CategoriaServicio] = {}
        self.ubicacion_solicitud: dict[UUID, Ubicacion] = {}
        self.participaciones_por_solicitud: dict[UUID, list[Participacion]] = {}
        self.cotizaciones_por_solicitud: dict[UUID, list[Cotizacion]] = {}
        self.servicio_por_solicitud: dict[UUID, Servicio] = {}
        self.informe_por_servicio: dict[UUID, HistorialServicio] = {}
        self.calificaciones_por_servicio: dict[UUID, list[Calificacion]] = {}
        self.reclamaciones_por_servicio: dict[UUID, list[Reclamacion]] = {}
        self.marcas_por_servicio: dict[UUID, list[Sancion]] = {}
        self.servicios_por_cliente: dict[UUID, list[Servicio]] = {}
        self.servicios_por_proveedor: dict[UUID, list[Servicio]] = {}
        self.solicitud_por_id: dict[UUID, Solicitud] = {}


async def _grafo(session: AsyncSession) -> _Grafo:
    grafo = _Grafo()
    grafo.solicitudes = list((await session.exec(select(Solicitud))).all())
    grafo.solicitud_por_id = {item.id: item for item in grafo.solicitudes}
    grafo.clientes = {item.id: item for item in (await session.exec(select(PerfilCliente))).all()}
    grafo.proveedores = {item.id: item for item in (await session.exec(select(PerfilProveedor))).all()}
    grafo.categorias = {item.id: item for item in (await session.exec(select(CategoriaServicio))).all()}
    for usuario in (await session.exec(select(Usuario))).all():
        grafo.usuarios[usuario.id] = usuario
        if usuario.perfil_cliente_id is not None:
            grafo.usuario_cliente[usuario.perfil_cliente_id] = usuario
        if usuario.perfil_proveedor_id is not None:
            grafo.usuarios_proveedor.setdefault(usuario.perfil_proveedor_id, []).append(usuario)
    for ubicacion in (await session.exec(select(Ubicacion))).all():
        if ubicacion.solicitud_id is not None:
            grafo.ubicacion_solicitud[ubicacion.solicitud_id] = ubicacion
    for part in (await session.exec(select(Participacion))).all():
        grafo.participaciones_por_solicitud.setdefault(part.solicitud_id, []).append(part)
    for cot in (await session.exec(select(Cotizacion))).all():
        grafo.cotizaciones_por_solicitud.setdefault(cot.solicitud_id, []).append(cot)
    for servicio in (await session.exec(select(Servicio))).all():
        grafo.servicio_por_solicitud[servicio.solicitud_id] = servicio
        grafo.servicios_por_proveedor.setdefault(servicio.perfil_proveedor_id, []).append(servicio)
        solicitud = grafo.solicitud_por_id.get(servicio.solicitud_id)
        if solicitud is not None:
            grafo.servicios_por_cliente.setdefault(solicitud.perfil_cliente_id, []).append(servicio)
    for informe in (await session.exec(select(HistorialServicio))).all():
        grafo.informe_por_servicio[informe.servicio_id] = informe
    for cal in (await session.exec(select(Calificacion))).all():
        grafo.calificaciones_por_servicio.setdefault(cal.servicio_id, []).append(cal)
    for rec in (await session.exec(select(Reclamacion))).all():
        grafo.reclamaciones_por_servicio.setdefault(rec.servicio_id, []).append(rec)
    for marca in (await session.exec(select(Sancion))).all():
        if marca.servicio_id is not None:
            grafo.marcas_por_servicio.setdefault(marca.servicio_id, []).append(marca)
    return grafo


def _fila_lista(solicitud: Solicitud, grafo: _Grafo) -> TrabajoListaOut:
    cotizaciones = grafo.cotizaciones_por_solicitud.get(solicitud.id, [])
    servicio = grafo.servicio_por_solicitud.get(solicitud.id)
    if servicio is not None:
        etapa = "servicio"
    elif cotizaciones:
        etapa = "cotizacion"
    else:
        etapa = "solicitud"
    reclamaciones = grafo.reclamaciones_por_servicio.get(servicio.id, []) if servicio else []
    estado_rec = None
    if any(item.estado == EstadoReclamacion.abierta for item in reclamaciones):
        estado_rec = "abierta"
    elif reclamaciones:
        estado_rec = "cerrada"
    cliente = grafo.clientes.get(solicitud.perfil_cliente_id)
    usuario_cli = grafo.usuario_cliente.get(solicitud.perfil_cliente_id)
    nombre_cliente = (
        cliente.nombre_comercial if cliente and cliente.nombre_comercial else (usuario_cli.nombre if usuario_cli else "Cliente")
    )
    categoria = grafo.categorias.get(solicitud.categoria_id)
    proveedor_nombre = None
    if servicio is not None:
        proveedor = grafo.proveedores.get(servicio.perfil_proveedor_id)
        proveedor_nombre = proveedor.nombre_comercial if proveedor else None
    elif cotizaciones:
        proveedor = grafo.proveedores.get(cotizaciones[0].perfil_proveedor_id)
        proveedor_nombre = proveedor.nombre_comercial if proveedor else None
    return TrabajoListaOut(
        solicitud_id=solicitud.id,
        titulo=solicitud.titulo,
        cliente=nombre_cliente,
        categoria=categoria.nombre if categoria else "",
        etapa=etapa,
        estado_solicitud=solicitud.estado,
        cierre="cerrado" if solicitud.estado == EstadoSolicitud.cerrada else "abierto",
        estado_servicio=estado_servicio_publico(servicio.estado) if servicio else None,
        proveedor=proveedor_nombre,
        reclamacion=estado_rec,
        hay_marca=bool(servicio and grafo.marcas_por_servicio.get(servicio.id)),
        creado_en=solicitud.creado_en,
    )


def _solicitud_out(solicitud: Solicitud, grafo: _Grafo) -> SolicitudTrabajoOut:
    cliente = grafo.clientes.get(solicitud.perfil_cliente_id)
    usuario_cli = grafo.usuario_cliente.get(solicitud.perfil_cliente_id)
    nombre_cliente = (
        cliente.nombre_comercial if cliente and cliente.nombre_comercial else (usuario_cli.nombre if usuario_cli else "Cliente")
    )
    categoria = grafo.categorias.get(solicitud.categoria_id)
    ubicacion = grafo.ubicacion_solicitud.get(solicitud.id)
    return SolicitudTrabajoOut(
        id=solicitud.id,
        titulo=solicitud.titulo,
        descripcion=solicitud.descripcion,
        estado=solicitud.estado,
        categoria=categoria.nombre if categoria else "",
        categoria_id=solicitud.categoria_id,
        cliente=nombre_cliente,
        perfil_cliente_id=solicitud.perfil_cliente_id,
        dirigida_a_perfil_proveedor_id=solicitud.dirigida_a_perfil_proveedor_id,
        datos_cerrados=solicitud.datos_cerrados,
        creado_en=solicitud.creado_en,
        ubicacion=UbicacionTrabajoOut.model_validate(ubicacion, from_attributes=True) if ubicacion else None,
    )


def _participacion_out(item: Participacion, grafo: _Grafo) -> ParticipacionTrabajoOut:
    proveedor = grafo.proveedores.get(item.perfil_proveedor_id)
    return ParticipacionTrabajoOut(
        id=item.id,
        perfil_proveedor_id=item.perfil_proveedor_id,
        proveedor=proveedor.nombre_comercial if proveedor else "",
        estado=item.estado,
        aceptada_en=item.aceptada_en,
    )


def _cotizacion_out(item: Cotizacion, grafo: _Grafo) -> CotizacionTrabajoOut:
    proveedor = grafo.proveedores.get(item.perfil_proveedor_id)
    return CotizacionTrabajoOut(
        id=item.id,
        perfil_proveedor_id=item.perfil_proveedor_id,
        proveedor=proveedor.nombre_comercial if proveedor else "",
        descripcion=item.descripcion,
        costo_mxn=item.costo_mxn,
        condiciones=item.condiciones,
        estado=item.estado,
        creado_en=item.creado_en,
    )


def _servicio_out(servicio: Servicio, grafo: _Grafo) -> ServicioTrabajoOut:
    proveedor = grafo.proveedores.get(servicio.perfil_proveedor_id)
    tecnico = grafo.usuarios.get(servicio.tecnico_usuario_id) if servicio.tecnico_usuario_id else None
    informe = grafo.informe_por_servicio.get(servicio.id)
    return ServicioTrabajoOut(
        id=servicio.id,
        perfil_proveedor_id=servicio.perfil_proveedor_id,
        proveedor=proveedor.nombre_comercial if proveedor else "",
        tecnico_usuario_id=servicio.tecnico_usuario_id,
        tecnico=tecnico.nombre if tecnico else None,
        estado=estado_servicio_publico(servicio.estado),
        cotizacion_id=servicio.cotizacion_id,
        creado_en=servicio.creado_en,
        informe=_informe_out(informe, grafo) if informe else None,
        calificaciones=[
            CalificacionTrabajoOut.model_validate(item, from_attributes=True)
            for item in grafo.calificaciones_por_servicio.get(servicio.id, [])
        ],
    )


def _informe_out(informe: HistorialServicio, grafo: _Grafo) -> InformeTrabajoOut:
    tecnico = grafo.usuarios.get(informe.tecnico_usuario_id)
    return InformeTrabajoOut(
        id=informe.id,
        tecnico_usuario_id=informe.tecnico_usuario_id,
        tecnico=tecnico.nombre if tecnico else None,
        descripcion=informe.descripcion,
        tipo=informe.tipo,
        detalle_pieza=informe.detalle_pieza,
        fecha=informe.fecha,
    )


def _reclamacion_out(item: Reclamacion, grafo: _Grafo) -> ReclamacionTrabajoOut:
    reclamante = grafo.usuarios.get(item.reclamante_usuario_id)
    return ReclamacionTrabajoOut(
        id=item.id,
        servicio_id=item.servicio_id,
        reclamante_usuario_id=item.reclamante_usuario_id,
        reclamante=reclamante.nombre if reclamante else None,
        categoria=item.categoria,
        categoria_etiqueta=etiqueta_categoria_reclamacion(item.categoria),
        motivo=item.motivo,
        estado=item.estado,
        creada_en=item.creada_en,
        cerrada_en=item.cerrada_en,
    )


def _marca_out(item: Sancion) -> MarcaCasoOut:
    lado = "cliente" if item.perfil_cliente_id is not None else "proveedor"
    return MarcaCasoOut(
        id=item.id,
        tipo=item.tipo,
        codigo=item.codigo,
        etiqueta=etiqueta_codigo_marca(item.codigo),
        descripcion=item.descripcion,
        perfil_afectado=lado,
        servicio_id=item.servicio_id,
        reclamacion_id=item.reclamacion_id,
        creada_en=item.creada_en,
    )


def _historial_acotado(
    solicitud: Solicitud, servicio: Servicio | None, grafo: _Grafo
) -> HistorialAcotadoOut:
    actual = servicio.id if servicio else None

    def resumenes(servicios: list[Servicio]) -> list[HistorialServicioResumenOut]:
        filas = []
        for item in servicios:
            if item.id == actual:
                continue
            sol = grafo.solicitud_por_id.get(item.solicitud_id)
            filas.append(
                HistorialServicioResumenOut(
                    servicio_id=item.id,
                    solicitud_id=item.solicitud_id,
                    titulo=sol.titulo if sol else "",
                    estado=estado_servicio_publico(item.estado),
                    creado_en=item.creado_en,
                )
            )
        filas.sort(key=lambda fila: fila.creado_en or fila.servicio_id, reverse=True)
        return filas

    cliente = resumenes(grafo.servicios_por_cliente.get(solicitud.perfil_cliente_id, []))
    proveedor_id = servicio.perfil_proveedor_id if servicio else None
    proveedor = resumenes(grafo.servicios_por_proveedor.get(proveedor_id, [])) if proveedor_id else []
    return HistorialAcotadoOut(cliente=cliente, proveedor=proveedor)


async def _usuario_lado(session: AsyncSession, servicio: Servicio, lado: str) -> Usuario:
    if lado == "cliente":
        solicitud = await session.get(Solicitud, servicio.solicitud_id)
        if solicitud is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe la solicitud del servicio")
        usuario = (
            await session.exec(select(Usuario).where(Usuario.perfil_cliente_id == solicitud.perfil_cliente_id))
        ).first()
    else:
        usuarios = list(
            (await session.exec(select(Usuario).where(Usuario.perfil_proveedor_id == servicio.perfil_proveedor_id))).all()
        )
        usuario = next(
            (item for item in usuarios if item.funcion == FuncionProveedor.administrativo),
            usuarios[0] if usuarios else None,
        )
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hay usuario en el perfil afectado")
    return usuario
