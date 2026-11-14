from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class IngresoComisionItemOut(BaseModel):
    servicio_id: UUID
    cotizacion_id: UUID | None = None
    perfil_proveedor_id: UUID | None
    costo_mxn: float
    porcentaje: float
    comision_mxn: float
    cerrado_en: datetime | None


class IngresosAlquilerOut(BaseModel):
    total_mxn: float
    dispositivos_asignados: int
    detalle: str


class IngresosOut(BaseModel):
    comision_total_mxn: float
    comision_base_mxn: float
    cierres: int
    comisiones: list[IngresoComisionItemOut]
    alquiler: IngresosAlquilerOut
