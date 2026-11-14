from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import hash_password
from app.models.entities import (
    CategoriaServicio,
    PerfilCliente,
    PerfilProveedor,
    PerfilProveedorCategoria,
    Ubicacion,
    Usuario,
)
from app.models.enums import FuncionProveedor, TipoCuenta
from app.schemas.auth import RegistroCliente, RegistroProveedor, UbicacionIn
from app.schemas.usuarios import RegistroAdministrador
from app.services.osm_ubicacion import intentar_geocodificar

_SOLO_ADMIN = "Solo el administrador de plataforma puede registrar clientes y proveedores"
_NO_PIDE_BAJA = (
    "Solo el usuario del perfil cliente, un administrativo de una empresa "
    "o el administrativo de campo de un negocio pueden pedir la baja de perfil"
)
_TIPOS_EMPRESA = frozenset({TipoCuenta.proveedor.value, TipoCuenta.empresa.value})


async def registrar_cliente(
    session: AsyncSession,
    datos: RegistroCliente,
    administrador: Usuario,
) -> Usuario:
    _exigir_administrador(administrador)
    await _correo_libre(session, datos.correo)
    perfil = PerfilCliente(tipo=datos.tipo, nombre_comercial=datos.nombre_comercial)
    session.add(perfil)
    await session.flush()
    ubicacion = _ubicacion(datos.ubicacion, perfil_cliente_id=perfil.id)
    session.add(ubicacion)
    await intentar_geocodificar(ubicacion)
    usuario = Usuario(
        nombre=datos.nombre,
        correo=datos.correo,
        contrasena_hash=hash_password(datos.contrasena),
        telefono=datos.telefono,
        tipo_cuenta=TipoCuenta.cliente,
        perfil_cliente_id=perfil.id,
        creado_en=datetime.now(UTC),
    )
    session.add(usuario)
    await _flush_unico(session)
    return usuario


async def registrar_proveedor(
    session: AsyncSession,
    datos: RegistroProveedor,
    administrador: Usuario,
) -> Usuario:
    _exigir_administrador(administrador)
    await _correo_libre(session, datos.correo)
    perfil = PerfilProveedor(
        tipo=datos.tipo,
        nombre_comercial=datos.nombre_comercial,
        descripcion=datos.descripcion,
    )
    session.add(perfil)
    await session.flush()
    ubicacion = _ubicacion(datos.ubicacion, perfil_proveedor_id=perfil.id)
    session.add(ubicacion)
    await intentar_geocodificar(ubicacion)
    for nombre in datos.categorias:
        categoria = await _categoria(session, nombre)
        session.add(
            PerfilProveedorCategoria(perfil_proveedor_id=perfil.id, categoria_id=categoria.id)
        )
    if datos.tipo_cuenta == "negocio":
        tipo = TipoCuenta.negocio
        funcion = FuncionProveedor.administrativo_campo
    else:
        tipo = TipoCuenta.empresa
        funcion = FuncionProveedor.administrativo
    usuario = Usuario(
        nombre=datos.nombre,
        correo=datos.correo,
        contrasena_hash=hash_password(datos.contrasena),
        telefono=datos.telefono,
        tipo_cuenta=tipo,
        funcion=funcion,
        perfil_proveedor_id=perfil.id,
        creado_en=datetime.now(UTC),
    )
    session.add(usuario)
    await _flush_unico(session)
    return usuario


async def registrar_administrador(
    session: AsyncSession,
    datos: RegistroAdministrador,
    administrador: Usuario,
) -> Usuario:
    _exigir_administrador(administrador)
    await _correo_libre(session, datos.correo)
    usuario = Usuario(
        nombre=datos.nombre,
        correo=datos.correo,
        contrasena_hash=hash_password(datos.contrasena),
        telefono=datos.telefono,
        tipo_cuenta=TipoCuenta.administrador,
    )
    session.add(usuario)
    await _flush_unico(session)
    return usuario


def _exigir_administrador(usuario: Usuario) -> None:
    if usuario.tipo_cuenta != TipoCuenta.administrador:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_SOLO_ADMIN)


def puede_pedir_baja_perfil(usuario: Usuario) -> bool:
    tipo = usuario.tipo_cuenta.value
    if tipo == TipoCuenta.cliente.value:
        return True
    if tipo in _TIPOS_EMPRESA and usuario.funcion == FuncionProveedor.administrativo:
        return True
    if tipo == TipoCuenta.negocio.value and usuario.funcion == FuncionProveedor.administrativo_campo:
        return True
    return False


def marcar_baja(usuario: Usuario) -> None:
    if not puede_pedir_baja_perfil(usuario):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_NO_PIDE_BAJA)
    if usuario.baja_solicitada_en is None:
        usuario.baja_solicitada_en = datetime.now(UTC)


def _ubicacion(
    datos: UbicacionIn,
    *,
    perfil_cliente_id=None,
    perfil_proveedor_id=None,
) -> Ubicacion:
    return Ubicacion(
        calle_numero=datos.calle_numero,
        colonia=datos.colonia,
        ciudad=datos.ciudad,
        estado=datos.estado,
        codigo_postal=datos.codigo_postal,
        perfil_cliente_id=perfil_cliente_id,
        perfil_proveedor_id=perfil_proveedor_id,
    )


async def _categoria(session: AsyncSession, nombre: str) -> CategoriaServicio:
    existente = (
        await session.exec(select(CategoriaServicio).where(CategoriaServicio.nombre.ilike(nombre)))
    ).first()
    if existente is not None:
        return existente
    categoria = CategoriaServicio(nombre=nombre)
    session.add(categoria)
    await session.flush()
    return categoria


async def _correo_libre(session: AsyncSession, correo: str) -> None:
    ya = (await session.exec(select(Usuario).where(Usuario.correo == correo))).first()
    if ya is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El correo ya está registrado")


async def _flush_unico(session: AsyncSession) -> None:
    try:
        await session.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo ya está registrado",
        ) from exc
