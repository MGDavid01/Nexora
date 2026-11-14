from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import (
    CategoriaServicio,
    Cotizacion,
    Participacion,
    Servicio,
    Solicitud,
    Ubicacion,
    Usuario,
)
from app.models.enums import EstadoCotizacion, EstadoParticipacion, EstadoServicio, EstadoSolicitud, TipoCuenta
from app.schemas.auth import UbicacionIn
from app.schemas.solicitudes import (
    MercadoSolicitudOut,
    ParticipacionOut,
    SolicitudCrearIn,
    SolicitudOut,
    UbicacionSolicitudOut,
)
from app.services.avisos_negocio import avisar_denegar
from app.services.osm_ubicacion import intentar_geocodificar
from app.services.perfiles import exigir_cliente as _exigir_cliente
from app.services.perfiles import exigir_proveedor as _exigir_proveedor
from app.services.vencimientos import vencer_aceptadas


async def _categoria(
    session: AsyncSession, datos: SolicitudCrearIn
) -> CategoriaServicio:
    categoria = await session.get(CategoriaServicio, datos.categoria_id) if datos.categoria_id else None
    if categoria is None and datos.categoria:
        categoria = (
            await session.exec(
                select(CategoriaServicio).where(CategoriaServicio.nombre.ilike(datos.categoria))
            )
        ).first()
    if categoria is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="La categoría no existe")
    return categoria


def _ubicacion(datos: UbicacionIn, solicitud_id: UUID) -> Ubicacion:
    return Ubicacion(
        calle_numero=datos.calle_numero,
        colonia=datos.colonia,
        ciudad=datos.ciudad,
        estado=datos.estado,
        codigo_postal=datos.codigo_postal,
        solicitud_id=solicitud_id,
    )


async def publicar(session: AsyncSession, usuario: Usuario, datos: SolicitudCrearIn) -> SolicitudOut:
    perfil_cliente_id = _exigir_cliente(usuario)
    categoria = await _categoria(session, datos)
    dirigida = datos.dirigida_a_perfil_proveedor_id
    if dirigida is not None:
        cerrado = next(
            (
                servicio
                for servicio in (await session.exec(select(Servicio))).all()
                if servicio.perfil_proveedor_id == dirigida
                and servicio.estado == EstadoServicio.cerrado
            ),
            None,
        )
        if cerrado is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Solo se dirige a un proveedor con un servicio cerrado previo",
            )
        solicitud_cerrada = await session.get(Solicitud, cerrado.solicitud_id)
        if solicitud_cerrada is None or solicitud_cerrada.perfil_cliente_id != perfil_cliente_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Ese proveedor no está en el historial de este cliente",
            )
    solicitud = Solicitud(
        perfil_cliente_id=perfil_cliente_id,
        categoria_id=categoria.id,
        dirigida_a_perfil_proveedor_id=dirigida,
        titulo=datos.titulo,
        descripcion=datos.descripcion,
        estado=EstadoSolicitud.abierta,
        datos_cerrados=False,
    )
    session.add(solicitud)
    await session.flush()
    ubicacion = _ubicacion(datos.ubicacion, solicitud.id)
    session.add(ubicacion)
    await intentar_geocodificar(ubicacion)
    await session.flush()
    return _salida(solicitud, categoria, ubicacion)


async def listar_propias(session: AsyncSession, usuario: Usuario) -> list[SolicitudOut]:
    perfil_cliente_id = _exigir_cliente(usuario)
    solicitudes = list((await session.exec(select(Solicitud))).all())
    categorias = {item.id: item for item in (await session.exec(select(CategoriaServicio))).all()}
    ubicaciones = {
        item.solicitud_id: item
        for item in (await session.exec(select(Ubicacion))).all()
        if item.solicitud_id is not None
    }
    resultado = [
        _salida(item, categorias[item.categoria_id], ubicaciones[item.id])
        for item in solicitudes
        if item.perfil_cliente_id == perfil_cliente_id and item.id in ubicaciones and item.categoria_id in categorias
    ]
    resultado.sort(key=lambda item: (item.creado_en is not None, str(item.creado_en or ""), str(item.id)), reverse=True)
    return resultado


async def cancelar(session: AsyncSession, usuario: Usuario, solicitud_id: UUID) -> SolicitudOut:
    perfil_cliente_id = _exigir_cliente(usuario)
    solicitud = await session.get(Solicitud, solicitud_id)
    if solicitud is None or solicitud.perfil_cliente_id != perfil_cliente_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe esa solicitud")
    if solicitud.estado != EstadoSolicitud.abierta:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se puede cancelar una solicitud abierta")

    solicitud.estado = EstadoSolicitud.cancelada
    participaciones = list((await session.exec(select(Participacion))).all())
    for participacion in participaciones:
        if participacion.solicitud_id == solicitud.id and participacion.estado in {
            EstadoParticipacion.pendiente,
            EstadoParticipacion.aceptada,
        }:
            participacion.estado = EstadoParticipacion.retirada
    cotizaciones = list((await session.exec(select(Cotizacion))).all())
    for cotizacion in cotizaciones:
        if cotizacion.solicitud_id == solicitud.id and cotizacion.estado == EstadoCotizacion.enviada:
            cotizacion.estado = EstadoCotizacion.descartada
    await session.flush()
    categoria = await session.get(CategoriaServicio, solicitud.categoria_id)
    ubicacion = (
        await session.exec(select(Ubicacion).where(Ubicacion.solicitud_id == solicitud.id))
    ).first()
    if categoria is None or ubicacion is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Solicitud incompleta")
    return _salida(solicitud, categoria, ubicacion)


async def mercado(session: AsyncSession, usuario: Usuario) -> list[MercadoSolicitudOut]:
    await vencer_aceptadas(session)
    perfil_proveedor_id = _exigir_proveedor(usuario)
    solicitudes = list((await session.exec(select(Solicitud))).all())
    categorias = {item.id: item for item in (await session.exec(select(CategoriaServicio))).all()}
    ubicaciones = {
        item.solicitud_id: item
        for item in (await session.exec(select(Ubicacion))).all()
        if item.solicitud_id is not None
    }
    participaciones = list((await session.exec(select(Participacion))).all())
    propias = {
        item.solicitud_id
        for item in participaciones
        if item.perfil_proveedor_id == perfil_proveedor_id
        and item.estado != EstadoParticipacion.pendiente
    }
    resultado = []
    for solicitud in solicitudes:
        if solicitud.estado != EstadoSolicitud.abierta or solicitud.id in propias:
            continue
        if solicitud.dirigida_a_perfil_proveedor_id is not None:
            if solicitud.dirigida_a_perfil_proveedor_id == perfil_proveedor_id:
                # La comprobación de `propias` arriba evita volver a decidir.
                pass
            else:
                # Una solicitud dirigida solo se abre al mercado después de que
                # el destinatario la rechace, venza o se retire.
                participacion_destino = next(
                    (
                        item
                        for item in participaciones
                        if item.solicitud_id == solicitud.id
                        and item.perfil_proveedor_id == solicitud.dirigida_a_perfil_proveedor_id
                    ),
                    None,
                )
                if participacion_destino is None or participacion_destino.estado in {
                    EstadoParticipacion.pendiente,
                    EstadoParticipacion.aceptada,
                    EstadoParticipacion.cotizada,
                }:
                    continue
        categoria = categorias.get(solicitud.categoria_id)
        ubicacion = ubicaciones.get(solicitud.id)
        if categoria is not None and ubicacion is not None:
            resultado.append(MercadoSolicitudOut(**_salida(solicitud, categoria, ubicacion).model_dump()))
    resultado.sort(key=lambda item: (item.creado_en is not None, str(item.creado_en or ""), str(item.id)), reverse=True)
    return resultado


async def decidir(
    session: AsyncSession, usuario: Usuario, solicitud_id: UUID, *, aceptar: bool
) -> ParticipacionOut:
    perfil_proveedor_id = _exigir_proveedor(usuario)
    solicitud = await session.get(Solicitud, solicitud_id)
    if solicitud is None or solicitud.estado != EstadoSolicitud.abierta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe una solicitud abierta")
    if solicitud.dirigida_a_perfil_proveedor_id not in (None, perfil_proveedor_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe esa solicitud")
    existente = next(
        (
            item
            for item in (await session.exec(select(Participacion))).all()
            if item.solicitud_id == solicitud.id and item.perfil_proveedor_id == perfil_proveedor_id
        ),
        None,
    )
    if existente is not None and existente.estado != EstadoParticipacion.pendiente:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El proveedor ya decidió sobre esta solicitud")
    if existente is None:
        participacion = Participacion(
            solicitud_id=solicitud.id,
            perfil_proveedor_id=perfil_proveedor_id,
            estado=EstadoParticipacion.aceptada if aceptar else EstadoParticipacion.rechazada,
            aceptada_en=datetime.now(UTC) if aceptar else None,
        )
        session.add(participacion)
    else:
        participacion = existente
        participacion.estado = EstadoParticipacion.aceptada if aceptar else EstadoParticipacion.rechazada
        participacion.aceptada_en = datetime.now(UTC) if aceptar else None
    if aceptar:
        solicitud.datos_cerrados = True
    else:
        await avisar_denegar(session, solicitud, perfil_proveedor_id)
    await session.flush()
    return ParticipacionOut.model_validate(participacion, from_attributes=True)


async def retirar(session: AsyncSession, usuario: Usuario, participacion_id: UUID) -> ParticipacionOut:
    _exigir_cliente(usuario)
    participacion = await session.get(Participacion, participacion_id)
    solicitud = await session.get(Solicitud, participacion.solicitud_id) if participacion else None
    if participacion is None or solicitud is None or solicitud.perfil_cliente_id != usuario.perfil_cliente_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe esa participación")
    if participacion.estado != EstadoParticipacion.aceptada:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se puede retirar una aceptación sin cotización")
    participacion.estado = EstadoParticipacion.retirada
    await session.flush()
    return ParticipacionOut.model_validate(participacion, from_attributes=True)


def _salida(solicitud: Solicitud, categoria: CategoriaServicio, ubicacion: Ubicacion) -> SolicitudOut:
    return SolicitudOut(
        id=solicitud.id,
        titulo=solicitud.titulo,
        descripcion=solicitud.descripcion,
        categoria_id=categoria.id,
        categoria=categoria.nombre,
        estado=solicitud.estado,
        datos_cerrados=solicitud.datos_cerrados,
        creado_en=solicitud.creado_en,
        ubicacion=UbicacionSolicitudOut.model_validate(ubicacion, from_attributes=True),
    )
