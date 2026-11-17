import secrets
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import hash_password
from app.models.entities import (
    Cotizacion,
    HistorialServicio,
    Participacion,
    PerfilCliente,
    PerfilProveedor,
    Reclamacion,
    Sancion,
    Servicio,
    Solicitud,
    TokenRecuperacion,
    Usuario,
)
from app.models.enums import (
    EstadoCotizacion,
    EstadoParticipacion,
    EstadoReclamacion,
    EstadoServicio,
    EstadoSolicitud,
    FuncionProveedor,
    TipoCuenta,
    TipoHistorial,
    etiqueta_codigo_marca,
)
from app.services.dispositivos import desasignar_perfil
from app.services.empresa_usuarios import primera_cuenta
from app.services.reclamaciones import cerrar_reclamacion
from app.schemas.usuarios import (
    EditarCuenta,
    MarcaIn,
    MarcaOut,
    UsuarioDetalleOut,
    UsuarioListaOut,
)
from app.services.marcas import aplicar_marca, marcas_del_usuario, perfil_ligado

INFORME_BAJA_PERFIL = (
    "Este servicio fue cancelado y no se tiene datos precisos. Los cambios son desconocidos."
)
INFORME_BAJA_NEGOCIO = INFORME_BAJA_PERFIL
_TIPOS_EMPRESA = frozenset({TipoCuenta.proveedor.value, TipoCuenta.empresa.value})


async def listar_usuarios(session: AsyncSession) -> list[UsuarioListaOut]:
    usuarios = list((await session.exec(select(Usuario))).all())
    clientes, proveedores = await _perfiles(session)
    filas = [_fila(usuario, clientes, proveedores) for usuario in usuarios]
    filas.sort(key=lambda fila: (fila.tipo_cuenta.value, fila.nombre.casefold()))
    return filas


async def detalle_usuario(session: AsyncSession, usuario_id: UUID) -> UsuarioDetalleOut:
    usuario = await _usuario(session, usuario_id)
    clientes, proveedores = await _perfiles(session)
    base = _fila(usuario, clientes, proveedores)
    marcas = [_marca_out(marca) for marca in await marcas_del_usuario(session, usuario)]
    return UsuarioDetalleOut(**base.model_dump(), marcas=marcas)


async def editar_cuenta(session: AsyncSession, usuario_id: UUID, datos: EditarCuenta) -> UsuarioDetalleOut:
    usuario = await _usuario(session, usuario_id)
    if datos.correo != usuario.correo:
        ya = (await session.exec(select(Usuario).where(Usuario.correo == datos.correo))).first()
        if ya is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El correo ya está registrado")
    if datos.funcion is not None:
        if usuario.tipo_cuenta == TipoCuenta.negocio:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La función de un negocio es administrativo de campo",
            )
        if usuario.tipo_cuenta not in {TipoCuenta.proveedor, TipoCuenta.empresa}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Solo un usuario de empresa tiene función",
            )
        if datos.funcion == FuncionProveedor.administrativo_campo:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="administrativo_campo solo aplica a negocio",
            )
        usuario.funcion = datos.funcion
    usuario.nombre = datos.nombre
    usuario.correo = datos.correo
    usuario.telefono = datos.telefono
    if datos.contrasena is not None:
        usuario.contrasena_hash = hash_password(datos.contrasena)
    await session.flush()
    return await detalle_usuario(session, usuario.id)


async def registrar_marca(session: AsyncSession, usuario_id: UUID, datos: MarcaIn) -> UsuarioDetalleOut:
    usuario = await _usuario(session, usuario_id)
    await aplicar_marca(session, usuario, datos)
    return await detalle_usuario(session, usuario.id)


async def desbloquear_perfil(session: AsyncSession, usuario_id: UUID) -> UsuarioDetalleOut:
    usuario = await _usuario(session, usuario_id)
    if usuario.tipo_cuenta == TipoCuenta.administrador:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El desbloqueo aplica a un perfil cliente o proveedor",
        )
    perfil = await perfil_ligado(session, usuario)
    if not perfil.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El perfil no está bloqueado",
        )
    perfil.bloqueado = False
    await session.flush()
    return await detalle_usuario(session, usuario.id)


async def procesar_baja_perfil(session: AsyncSession, usuario_id: UUID) -> UsuarioDetalleOut:
    usuario = await _usuario(session, usuario_id)
    if usuario.tipo_cuenta == TipoCuenta.administrador or not _tiene_perfil(usuario):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La baja de perfil aplica a un perfil cliente o proveedor",
        )
    cuentas = await _cuentas_del_perfil(session, usuario)
    ancla = primera_cuenta(cuentas)
    if ancla.baja_procesada_en is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La baja de perfil ya fue procesada",
        )
    if all(cuenta.baja_solicitada_en is None for cuenta in cuentas):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No hay un pedido de baja de perfil",
        )
    await _aplicar_efectos_al_procesar_baja(session, usuario)
    if usuario.perfil_cliente_id is not None:
        await desasignar_perfil(session, perfil_cliente_id=usuario.perfil_cliente_id)
    if usuario.perfil_proveedor_id is not None:
        await desasignar_perfil(session, perfil_proveedor_id=usuario.perfil_proveedor_id)
    ahora = datetime.now(UTC)
    ids = {cuenta.id for cuenta in cuentas}
    for cuenta in cuentas:
        cuenta.baja_procesada_en = ahora
        cuenta.contrasena_hash = hash_password(secrets.token_urlsafe(32))
    for token in (await session.exec(select(TokenRecuperacion))).all():
        if token.usuario_id in ids:
            token.usado = True
    await session.flush()
    return await detalle_usuario(session, usuario.id)


def _tiene_perfil(usuario: Usuario) -> bool:
    return usuario.perfil_cliente_id is not None or usuario.perfil_proveedor_id is not None


async def _cuentas_del_perfil(session: AsyncSession, usuario: Usuario) -> list[Usuario]:
    cuentas = list((await session.exec(select(Usuario))).all())
    if usuario.perfil_cliente_id is not None:
        return [cuenta for cuenta in cuentas if cuenta.perfil_cliente_id == usuario.perfil_cliente_id]
    if usuario.perfil_proveedor_id is not None:
        return [cuenta for cuenta in cuentas if cuenta.perfil_proveedor_id == usuario.perfil_proveedor_id]
    return [usuario]


def _es_empresa(usuario: Usuario) -> bool:
    return usuario.tipo_cuenta.value in _TIPOS_EMPRESA


async def _aplicar_efectos_al_procesar_baja(session: AsyncSession, usuario: Usuario) -> None:
    solicitudes = list((await session.exec(select(Solicitud))).all())
    servicios = list((await session.exec(select(Servicio))).all())
    participaciones = list((await session.exec(select(Participacion))).all())
    cotizaciones = list((await session.exec(select(Cotizacion))).all())
    informes = {fila.servicio_id: fila for fila in (await session.exec(select(HistorialServicio))).all()}
    reclamaciones = list((await session.exec(select(Reclamacion))).all())
    del_perfil = _servicios_del_perfil(usuario, solicitudes, servicios)
    ids_servicios = {servicio.id for servicio in del_perfil}

    for servicio in del_perfil:
        await _cancelar_servicio_activo(session, servicio, usuario, informes, solicitudes, participaciones, cotizaciones)

    if usuario.tipo_cuenta == TipoCuenta.cliente and usuario.perfil_cliente_id is not None:
        for solicitud in solicitudes:
            if solicitud.perfil_cliente_id != usuario.perfil_cliente_id:
                continue
            if solicitud.estado == EstadoSolicitud.abierta:
                _marcar_solicitud_cancelada(solicitud, participaciones, cotizaciones)

    if _es_empresa(usuario) and usuario.perfil_proveedor_id is not None:
        for cotizacion in cotizaciones:
            if cotizacion.perfil_proveedor_id != usuario.perfil_proveedor_id:
                continue
            if cotizacion.estado == EstadoCotizacion.enviada:
                cotizacion.estado = EstadoCotizacion.descartada

    for reclamacion in reclamaciones:
        if reclamacion.servicio_id not in ids_servicios:
            continue
        if reclamacion.estado != EstadoReclamacion.abierta:
            continue
        await cerrar_reclamacion(session, reclamacion, desenlace="sin_marca")


def _servicios_del_perfil(
    usuario: Usuario,
    solicitudes: list[Solicitud],
    servicios: list[Servicio],
) -> list[Servicio]:
    if usuario.perfil_cliente_id is not None:
        ids = {item.id for item in solicitudes if item.perfil_cliente_id == usuario.perfil_cliente_id}
        return [servicio for servicio in servicios if servicio.solicitud_id in ids]
    if usuario.perfil_proveedor_id is not None:
        return [servicio for servicio in servicios if servicio.perfil_proveedor_id == usuario.perfil_proveedor_id]
    return []


async def _cancelar_servicio_activo(
    session: AsyncSession,
    servicio: Servicio,
    usuario: Usuario,
    informes: dict[UUID, HistorialServicio],
    solicitudes: list[Solicitud],
    participaciones: list[Participacion],
    cotizaciones: list[Cotizacion],
) -> None:
    if servicio.estado in (EstadoServicio.pendiente, EstadoServicio.en_curso):
        servicio.estado = EstadoServicio.cancelado
        _cancelar_solicitud_del_servicio(servicio.solicitud_id, solicitudes, participaciones, cotizaciones)
        return
    if servicio.estado != EstadoServicio.pendiente_historial:
        return
    if servicio.id not in informes:
        tecnico_id = usuario.id if usuario.tipo_cuenta == TipoCuenta.negocio else servicio.tecnico_usuario_id
        if tecnico_id is None:
            tecnico_id = usuario.id
        session.add(
            HistorialServicio(
                servicio_id=servicio.id,
                tecnico_usuario_id=tecnico_id,
                descripcion=INFORME_BAJA_PERFIL,
                tipo=TipoHistorial.otro_servicio,
                fecha=datetime.now(UTC),
            )
        )
    servicio.estado = EstadoServicio.cancelado
    _cancelar_solicitud_del_servicio(servicio.solicitud_id, solicitudes, participaciones, cotizaciones)


def _cancelar_solicitud_del_servicio(
    solicitud_id: UUID,
    solicitudes: list[Solicitud],
    participaciones: list[Participacion],
    cotizaciones: list[Cotizacion],
) -> None:
    solicitud = next((item for item in solicitudes if item.id == solicitud_id), None)
    if solicitud is None or solicitud.estado != EstadoSolicitud.asignada:
        return
    _marcar_solicitud_cancelada(solicitud, participaciones, cotizaciones)


def _marcar_solicitud_cancelada(
    solicitud: Solicitud,
    participaciones: list[Participacion],
    cotizaciones: list[Cotizacion],
) -> None:
    solicitud.estado = EstadoSolicitud.cancelada
    for participacion in participaciones:
        if participacion.solicitud_id != solicitud.id:
            continue
        if participacion.estado in (EstadoParticipacion.pendiente, EstadoParticipacion.aceptada):
            participacion.estado = EstadoParticipacion.retirada
    for cotizacion in cotizaciones:
        if cotizacion.solicitud_id != solicitud.id:
            continue
        if cotizacion.estado == EstadoCotizacion.enviada:
            cotizacion.estado = EstadoCotizacion.descartada


def _marca_out(marca: Sancion) -> MarcaOut:
    return MarcaOut(
        id=marca.id,
        tipo=marca.tipo,
        codigo=marca.codigo,
        etiqueta=etiqueta_codigo_marca(marca.codigo),
        descripcion=marca.descripcion,
        creada_en=marca.creada_en,
    )


async def _usuario(session: AsyncSession, usuario_id: UUID) -> Usuario:
    usuario = await session.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe esa cuenta")
    return usuario


async def _perfiles(
    session: AsyncSession,
) -> tuple[dict[UUID, PerfilCliente], dict[UUID, PerfilProveedor]]:
    clientes = {perfil.id: perfil for perfil in (await session.exec(select(PerfilCliente))).all()}
    proveedores = {perfil.id: perfil for perfil in (await session.exec(select(PerfilProveedor))).all()}
    return clientes, proveedores


def _fila(
    usuario: Usuario,
    clientes: dict[UUID, PerfilCliente],
    proveedores: dict[UUID, PerfilProveedor],
) -> UsuarioListaOut:
    bloqueado = False
    conteo = 0
    perfil_nombre = "Plataforma"
    if usuario.perfil_cliente_id is not None:
        perfil = clientes.get(usuario.perfil_cliente_id)
        if perfil is not None:
            bloqueado = perfil.bloqueado
            conteo = perfil.conteo_marcas
            perfil_nombre = perfil.nombre_comercial or "Persona"
    elif usuario.perfil_proveedor_id is not None:
        perfil = proveedores.get(usuario.perfil_proveedor_id)
        if perfil is not None:
            bloqueado = perfil.bloqueado
            conteo = perfil.conteo_marcas
            perfil_nombre = perfil.nombre_comercial
    return UsuarioListaOut(
        id=usuario.id,
        nombre=usuario.nombre,
        correo=usuario.correo,
        telefono=usuario.telefono,
        tipo_cuenta=usuario.tipo_cuenta,
        funcion=usuario.funcion,
        perfil_cliente_id=usuario.perfil_cliente_id,
        perfil_proveedor_id=usuario.perfil_proveedor_id,
        perfil_nombre=perfil_nombre,
        bloqueado=bloqueado,
        conteo_marcas=conteo,
        baja_solicitada=usuario.baja_solicitada_en is not None,
        baja_procesada=usuario.baja_procesada_en is not None,
    )


