from uuid import UUID

from fastapi import APIRouter

from app.api.deps import SessionDep, UsuarioActual
from app.schemas.flujo import CotizacionOut, HistorialItemOut, ServicioOut
from app.schemas.solicitudes import MercadoSolicitudOut, ParticipacionOut
from app.services.cotizaciones import elegir_cotizacion, rechazar_cotizacion
from app.services.historial import historial_cliente_acotado, historial_propio
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


@router.post("/cotizaciones/{cotizacion_id}/elegir", response_model=ServicioOut)
async def elegir(cotizacion_id: UUID, session: SessionDep, usuario: UsuarioActual) -> ServicioOut:
    return await elegir_cotizacion(session, usuario, cotizacion_id)


@router.post("/cotizaciones/{cotizacion_id}/rechazar", response_model=CotizacionOut)
async def rechazar(cotizacion_id: UUID, session: SessionDep, usuario: UsuarioActual) -> CotizacionOut:
    return await rechazar_cotizacion(session, usuario, cotizacion_id)


@router.get("/historial", response_model=list[HistorialItemOut])
async def historial(session: SessionDep, usuario: UsuarioActual) -> list[HistorialItemOut]:
    return await historial_propio(session, usuario)


@router.get("/clientes/{perfil_cliente_id}/historial", response_model=list[HistorialItemOut])
async def historial_de_cliente(
    perfil_cliente_id: UUID, session: SessionDep, usuario: UsuarioActual
) -> list[HistorialItemOut]:
    return await historial_cliente_acotado(session, usuario, perfil_cliente_id)
