from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.adaptadores.avisos import aviso_marca
from app.models.entities import PerfilCliente, PerfilProveedor, Sancion, Usuario
from app.models.enums import TipoCuenta, codigo_marca_aplica, etiqueta_codigo_marca
from app.schemas.usuarios import MarcaIn


async def aplicar_marca(
    session: AsyncSession,
    usuario: Usuario,
    datos: MarcaIn,
    *,
    servicio_id: UUID | None = None,
    reclamacion_id: UUID | None = None,
) -> Sancion:
    if usuario.tipo_cuenta == TipoCuenta.administrador:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Las marcas aplican a un perfil cliente o proveedor",
        )
    if not codigo_marca_aplica(datos.codigo, usuario.tipo_cuenta):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Ese código no aplica a un perfil {usuario.tipo_cuenta.value}",
        )
    existentes = await marcas_del_usuario(session, usuario)
    if any(marca.codigo == datos.codigo for marca in existentes):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ese código ya tiene una marca en este perfil",
        )
    marca = Sancion(
        tipo=datos.tipo,
        codigo=datos.codigo,
        descripcion=datos.descripcion,
        perfil_cliente_id=usuario.perfil_cliente_id,
        perfil_proveedor_id=usuario.perfil_proveedor_id,
        servicio_id=servicio_id,
        reclamacion_id=reclamacion_id,
    )
    session.add(marca)
    perfil = await perfil_ligado(session, usuario)
    perfil.conteo_marcas += 1
    if perfil.conteo_marcas >= 3:
        perfil.bloqueado = True
    try:
        await session.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ese código ya tiene una marca en este perfil",
        ) from exc
    await _avisar_marca(session, usuario, datos, perfil)
    return marca


async def _avisar_marca(
    session: AsyncSession,
    usuario: Usuario,
    datos: MarcaIn,
    perfil: PerfilCliente | PerfilProveedor,
) -> None:
    """El acto de marca ya valió; un fallo de correo no lo revierte."""
    cuentas = list((await session.exec(select(Usuario))).all())
    if usuario.perfil_cliente_id is not None:
        destinos = [
            cuenta.correo
            for cuenta in cuentas
            if cuenta.perfil_cliente_id == usuario.perfil_cliente_id and cuenta.baja_procesada_en is None
        ]
        nombre = usuario.nombre
    else:
        destinos = [
            cuenta.correo
            for cuenta in cuentas
            if cuenta.perfil_proveedor_id == usuario.perfil_proveedor_id and cuenta.baja_procesada_en is None
        ]
        nombre = getattr(perfil, "nombre_comercial", None) or usuario.nombre
    try:
        await aviso_marca(
            correos=destinos,
            nombre_perfil=nombre,
            codigo=etiqueta_codigo_marca(datos.codigo),
            descripcion=datos.descripcion,
            bloqueado=perfil.bloqueado,
        )
    except Exception:  # noqa: BLE001
        return


async def marcas_del_usuario(session: AsyncSession, usuario: Usuario) -> list[Sancion]:
    if usuario.perfil_cliente_id is not None:
        consulta = select(Sancion).where(Sancion.perfil_cliente_id == usuario.perfil_cliente_id)
    elif usuario.perfil_proveedor_id is not None:
        consulta = select(Sancion).where(Sancion.perfil_proveedor_id == usuario.perfil_proveedor_id)
    else:
        return []
    marcas = list((await session.exec(consulta)).all())
    marcas.sort(key=lambda marca: marca.creada_en or marca.id, reverse=True)
    return marcas


async def perfil_ligado(session: AsyncSession, usuario: Usuario) -> PerfilCliente | PerfilProveedor:
    if usuario.perfil_cliente_id is not None:
        perfil = await session.get(PerfilCliente, usuario.perfil_cliente_id)
    else:
        perfil = await session.get(PerfilProveedor, usuario.perfil_proveedor_id)
    if perfil is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe el perfil de esa cuenta")
    return perfil
