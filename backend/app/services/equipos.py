from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import EquipoComputo, Usuario
from app.schemas.equipos import EquipoIn, EquipoOut
from app.services.perfiles import exigir_cliente


def _out(equipo: EquipoComputo) -> EquipoOut:
    return EquipoOut(id=equipo.id, perfil_cliente_id=equipo.perfil_cliente_id, nombre=equipo.nombre)


async def listar_equipos(session: AsyncSession, usuario: Usuario) -> list[EquipoOut]:
    perfil_id = exigir_cliente(usuario)
    filas = [
        item
        for item in (await session.exec(select(EquipoComputo))).all()
        if item.perfil_cliente_id == perfil_id
    ]
    filas.sort(key=lambda item: item.nombre.casefold())
    return [_out(item) for item in filas]


async def crear_equipo(session: AsyncSession, usuario: Usuario, datos: EquipoIn) -> EquipoOut:
    perfil_id = exigir_cliente(usuario)
    duplicado = next(
        (
            item
            for item in (await session.exec(select(EquipoComputo))).all()
            if item.perfil_cliente_id == perfil_id and item.nombre.casefold() == datos.nombre.casefold()
        ),
        None,
    )
    if duplicado is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese equipo ya está registrado")
    equipo = EquipoComputo(perfil_cliente_id=perfil_id, nombre=datos.nombre)
    session.add(equipo)
    await session.flush()
    return _out(equipo)


async def borrar_equipo(session: AsyncSession, usuario: Usuario, equipo_id: UUID) -> None:
    perfil_id = exigir_cliente(usuario)
    equipo = await session.get(EquipoComputo, equipo_id)
    if equipo is None or equipo.perfil_cliente_id != perfil_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ese equipo")
    await session.delete(equipo)
    await session.flush()
