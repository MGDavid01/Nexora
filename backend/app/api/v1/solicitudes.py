from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import SessionDep, UsuarioActual
from app.schemas.solicitudes import ParticipacionOut, SolicitudCrearIn, SolicitudOut
from app.services.solicitudes import cancelar, decidir, listar_propias, publicar

router = APIRouter(prefix="/solicitudes", tags=["solicitudes"])


@router.post("", response_model=SolicitudOut, status_code=status.HTTP_201_CREATED)
async def publicar_solicitud(datos: SolicitudCrearIn, session: SessionDep, usuario: UsuarioActual) -> SolicitudOut:
    return await publicar(session, usuario, datos)


@router.get("", response_model=list[SolicitudOut])
async def listar_solicitudes(session: SessionDep, usuario: UsuarioActual) -> list[SolicitudOut]:
    return await listar_propias(session, usuario)


@router.post("/{solicitud_id}/cancelar", response_model=SolicitudOut)
async def cancelar_solicitud(solicitud_id: UUID, session: SessionDep, usuario: UsuarioActual) -> SolicitudOut:
    return await cancelar(session, usuario, solicitud_id)


@router.post("/{solicitud_id}/aceptar", response_model=ParticipacionOut)
async def aceptar_solicitud(solicitud_id: UUID, session: SessionDep, usuario: UsuarioActual) -> ParticipacionOut:
    return await decidir(session, usuario, solicitud_id, aceptar=True)


@router.post("/{solicitud_id}/denegar", response_model=ParticipacionOut)
async def denegar_solicitud(solicitud_id: UUID, session: SessionDep, usuario: UsuarioActual) -> ParticipacionOut:
    return await decidir(session, usuario, solicitud_id, aceptar=False)
