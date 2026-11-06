from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import SessionDep, UsuarioActual
from app.schemas.trabajos import AbrirReclamacionIn, ReclamacionTrabajoOut
from app.models.enums import etiqueta_categoria_reclamacion
from app.services.reclamaciones import abrir_reclamacion

router = APIRouter(prefix="/servicios", tags=["servicios"])


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
