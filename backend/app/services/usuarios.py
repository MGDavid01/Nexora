from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import hash_password
from app.models.entities import PerfilCliente, PerfilProveedor, Sancion, Usuario
from app.models.enums import TipoCuenta, etiqueta_codigo_marca
from app.schemas.usuarios import (
    EditarCuenta,
    MarcaIn,
    MarcaOut,
    UsuarioDetalleOut,
    UsuarioListaOut,
)
from app.services.marcas import aplicar_marca, marcas_del_usuario


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
        if usuario.tipo_cuenta != TipoCuenta.proveedor:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Solo un usuario de proveedor tiene función",
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
    )


