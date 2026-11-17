from uuid import UUID

from fastapi import APIRouter, Response, status

from app.api.deps import SessionDep, UsuarioActual
from app.schemas.equipos import EquipoIn, EquipoOut
from app.services.equipos import borrar_equipo, crear_equipo, listar_equipos

router = APIRouter(prefix="/equipos", tags=["equipos"])


@router.get("", response_model=list[EquipoOut])
async def consultar_equipos(session: SessionDep, usuario: UsuarioActual) -> list[EquipoOut]:
    return await listar_equipos(session, usuario)


@router.post("", response_model=EquipoOut, status_code=status.HTTP_201_CREATED)
async def alta_equipo(datos: EquipoIn, session: SessionDep, usuario: UsuarioActual) -> EquipoOut:
    return await crear_equipo(session, usuario, datos)


@router.delete("/{equipo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def baja_equipo(equipo_id: UUID, session: SessionDep, usuario: UsuarioActual) -> Response:
    await borrar_equipo(session, usuario, equipo_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
