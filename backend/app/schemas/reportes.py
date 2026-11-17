from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ReporteOut(BaseModel):
    id: UUID
    perfil_cliente_id: UUID | None
    perfil_proveedor_id: UUID | None
    accion: str
    metrica: str
    valor: str
    fecha: datetime
