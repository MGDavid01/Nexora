from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import SessionDep, UsuarioActual
from app.schemas.flujo import CalificacionIn, CalificacionOut, InformeIn, InformeOut, ServicioOut, TecnicoIn
from app.schemas.trabajos import AbrirReclamacionIn, ReclamacionTrabajoOut
from app.models.enums import etiqueta_categoria_reclamacion
from app.services.flujo_servicios import (
    asignar_tecnico,
    calificar,
    cancelar_servicio,
    iniciar_servicio,
    obtener_servicio,
    registrar_informe,
    terminar_trabajo,
)
from app.services.reclamaciones import abrir_reclamacion

router = APIRouter(prefix="/servicios", tags=["servicios"])


@router.get("/{servicio_id}", response_model=ServicioOut)
async def consultar_servicio(servicio_id: UUID, session: SessionDep, actor: UsuarioActual) -> ServicioOut:
    return await obtener_servicio(session, actor, servicio_id)


@router.post("/{servicio_id}/tecnico", response_model=ServicioOut)
async def tecnico_del_servicio(
    servicio_id: UUID, datos: TecnicoIn, session: SessionDep, actor: UsuarioActual
) -> ServicioOut:
    return await asignar_tecnico(session, actor, servicio_id, datos)


@router.post("/{servicio_id}/iniciar", response_model=ServicioOut)
async def iniciar(servicio_id: UUID, session: SessionDep, actor: UsuarioActual) -> ServicioOut:
    return await iniciar_servicio(session, actor, servicio_id)


@router.post("/{servicio_id}/terminar", response_model=ServicioOut)
async def terminar(servicio_id: UUID, session: SessionDep, actor: UsuarioActual) -> ServicioOut:
    return await terminar_trabajo(session, actor, servicio_id)


@router.post("/{servicio_id}/informe", response_model=InformeOut)
async def informe(
    servicio_id: UUID, datos: InformeIn, session: SessionDep, actor: UsuarioActual
) -> InformeOut:
    return await registrar_informe(session, actor, servicio_id, datos)


@router.post("/{servicio_id}/calificar", response_model=CalificacionOut)
async def calificacion(
    servicio_id: UUID, datos: CalificacionIn, session: SessionDep, actor: UsuarioActual
) -> CalificacionOut:
    return await calificar(session, actor, servicio_id, datos)


@router.post("/{servicio_id}/cancelar", response_model=ServicioOut)
async def cancelar(servicio_id: UUID, session: SessionDep, actor: UsuarioActual) -> ServicioOut:
    return await cancelar_servicio(session, actor, servicio_id)


@router.post(
    "/{servicio_id}/reclamaciones",
    response_model=ReclamacionTrabajoOut,
    status_code=status.HTTP_201_CREATED,
)
async def abrir_reclamacion_servicio(
    servicio_id: UUID,
    datos: AbrirReclamacionIn,
    session: SessionDep,
    actor: UsuarioActual,
) -> ReclamacionTrabajoOut:
    reclamacion = await abrir_reclamacion(
        session, actor, servicio_id, datos.categoria, datos.motivo
    )
    return ReclamacionTrabajoOut(
        id=reclamacion.id,
        servicio_id=reclamacion.servicio_id,
        reclamante_usuario_id=reclamacion.reclamante_usuario_id,
        reclamante=actor.nombre,
        categoria=reclamacion.categoria,
        categoria_etiqueta=etiqueta_categoria_reclamacion(reclamacion.categoria),
        motivo=reclamacion.motivo,
        estado=reclamacion.estado,
        creada_en=reclamacion.creada_en,
        cerrada_en=reclamacion.cerrada_en,
    )
