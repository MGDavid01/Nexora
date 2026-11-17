from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuditoriaEventoOut(BaseModel):
    id: UUID
    actor_usuario_id: UUID | None
    accion: str
    entidad: str
    entidad_id: UUID | None
    detalle: str | None
    creado_en: datetime | None


class AuditoriaListaOut(BaseModel):
    total: int
    eventos: list[AuditoriaEventoOut]
