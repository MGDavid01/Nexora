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

_SOLO_ADMIN = "Solo el administrador de plataforma puede registrar clientes y proveedores"


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
    session.add(_ubicacion(datos.ubicacion, perfil_cliente_id=perfil.id))
    usuario = Usuario(
        nombre=datos.nombre,
        correo=datos.correo,
        contrasena_hash=hash_password(datos.contrasena),
        telefono=datos.telefono,
        tipo_cuenta=TipoCuenta.cliente,
        perfil_cliente_id=perfil.id,
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
    session.add(_ubicacion(datos.ubicacion, perfil_proveedor_id=perfil.id))
    for nombre in datos.categorias:
        categoria = await _categoria(session, nombre)
        session.add(
            PerfilProveedorCategoria(perfil_proveedor_id=perfil.id, categoria_id=categoria.id)
        )
    usuario = Usuario(
        nombre=datos.nombre,
        correo=datos.correo,
        contrasena_hash=hash_password(datos.contrasena),
        telefono=datos.telefono,
        tipo_cuenta=TipoCuenta.proveedor,
        funcion=FuncionProveedor.administrativo,
        perfil_proveedor_id=perfil.id,
    )
    session.add(usuario)
    await _flush_unico(session)
    return usuario


def _exigir_administrador(usuario: Usuario) -> None:
    if usuario.tipo_cuenta != TipoCuenta.administrador:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_SOLO_ADMIN)


def marcar_baja(usuario: Usuario) -> None:
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
