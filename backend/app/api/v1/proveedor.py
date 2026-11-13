from uuid import UUID

from fastapi import APIRouter

from app.api.deps import SessionDep, UsuarioActual
from app.schemas.solicitudes import MercadoSolicitudOut, ParticipacionOut
from app.services.solicitudes import mercado, retirar

router = APIRouter(tags=["proveedor"])


@router.get("/proveedor/solicitudes", response_model=list[MercadoSolicitudOut])
async def listar_mercado(session: SessionDep, usuario: UsuarioActual) -> list[MercadoSolicitudOut]:
    return await mercado(session, usuario)


@router.post("/participaciones/{participacion_id}/retirar", response_model=ParticipacionOut)
async def retirar_participacion(participacion_id: UUID, session: SessionDep, usuario: UsuarioActual) -> ParticipacionOut:
    # La ruta histórica está documentada bajo participaciones; se mantiene aquí
    # para no mezclarla con el mercado del proveedor.
    return await retirar(session, usuario, participacion_id)
