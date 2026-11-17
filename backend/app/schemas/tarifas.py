from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class TarifaTramoOut(BaseModel):
    id: UUID
    costo_desde_mxn: Decimal
    costo_hasta_mxn: Decimal | None
    porcentaje: Decimal
    actualizado_en: datetime | None


class TarifaAlquilerOut(BaseModel):
    id: UUID
    clave: str
    porcentaje_n: Decimal
    actualizado_en: datetime | None


class TarifasOut(BaseModel):
    tramos: list[TarifaTramoOut]
    alquiler: TarifaAlquilerOut | None


class TarifaTramoEditarIn(BaseModel):
    id: UUID
    porcentaje: Decimal = Field(ge=0, le=100)


class TarifaAlquilerEditarIn(BaseModel):
    porcentaje_n: Decimal = Field(ge=0, le=100)
