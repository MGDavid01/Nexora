from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import SessionDep, UsuarioActual
from app.schemas.flujo import CotizacionCrearIn, CotizacionOut
from app.schemas.solicitudes import ParticipacionOut, SolicitudCrearIn, SolicitudOut
from app.services.cotizaciones import cotizar, listar_cotizaciones
from app.services.solicitudes import cancelar, decidir, listar_propias, publicar
from app.services.vencimientos import vencer_aceptadas

router = APIRouter(prefix="/solicitudes", tags=["solicitudes"])


@router.post("", response_model=SolicitudOut, status_code=status.HTTP_201_CREATED)
async def publicar_solicitud(datos: SolicitudCrearIn, session: SessionDep, usuario: UsuarioActual) -> SolicitudOut:
    return await publicar(session, usuario, datos)


@router.get("", response_model=list[SolicitudOut])
async def listar_solicitudes(session: SessionDep, usuario: UsuarioActual) -> list[SolicitudOut]:
    return await listar_propias(session, usuario)


@router.post("/vencer")
async def vencer_plazos(session: SessionDep, usuario: UsuarioActual) -> dict[str, int]:
    _ = usuario
    return {"vencidas": await vencer_aceptadas(session)}


@router.post("/{solicitud_id}/cancelar", response_model=SolicitudOut)
async def cancelar_solicitud(solicitud_id: UUID, session: SessionDep, usuario: UsuarioActual) -> SolicitudOut:
    return await cancelar(session, usuario, solicitud_id)


@router.post("/{solicitud_id}/aceptar", response_model=ParticipacionOut)
async def aceptar_solicitud(solicitud_id: UUID, session: SessionDep, usuario: UsuarioActual) -> ParticipacionOut:
    return await decidir(session, usuario, solicitud_id, aceptar=True)


@router.post("/{solicitud_id}/denegar", response_model=ParticipacionOut)
async def denegar_solicitud(solicitud_id: UUID, session: SessionDep, usuario: UsuarioActual) -> ParticipacionOut:
    return await decidir(session, usuario, solicitud_id, aceptar=False)


@router.post("/{solicitud_id}/cotizar", response_model=CotizacionOut, status_code=status.HTTP_201_CREATED)
async def cotizar_solicitud(
    solicitud_id: UUID, datos: CotizacionCrearIn, session: SessionDep, usuario: UsuarioActual
) -> CotizacionOut:
    return await cotizar(session, usuario, solicitud_id, datos)


@router.get("/{solicitud_id}/cotizaciones", response_model=list[CotizacionOut])
async def cotizaciones_de_solicitud(
    solicitud_id: UUID, session: SessionDep, usuario: UsuarioActual
) -> list[CotizacionOut]:
    return await listar_cotizaciones(session, usuario, solicitud_id)
