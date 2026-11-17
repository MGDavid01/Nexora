from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class DispositivoAltaIn(BaseModel):
    identificador: str = Field(min_length=1, max_length=120)
    nombre: str = Field(min_length=1, max_length=120)
    perfil_cliente_id: UUID | None = None
    perfil_proveedor_id: UUID | None = None

    @model_validator(mode="after")
    def _un_perfil(self) -> "DispositivoAltaIn":
        self.identificador = self.identificador.strip()
        self.nombre = self.nombre.strip()
        if self.perfil_cliente_id is not None and self.perfil_proveedor_id is not None:
            raise ValueError("El ESP32 se asigna a un solo perfil")
        return self


class DispositivoAsignarIn(BaseModel):
    perfil_cliente_id: UUID | None = None
    perfil_proveedor_id: UUID | None = None

    @model_validator(mode="after")
    def _un_perfil(self) -> "DispositivoAsignarIn":
        if (self.perfil_cliente_id is None) == (self.perfil_proveedor_id is None):
            raise ValueError("Indica perfil_cliente_id o perfil_proveedor_id")
        return self


class DispositivoOut(BaseModel):
    id: UUID
    identificador: str
    nombre: str
    perfil_cliente_id: UUID | None
    perfil_proveedor_id: UUID | None
    perfil_nombre: str | None = None
    estatus: Literal["pool", "asignado_cliente", "asignado_proveedor"]
    alquiler_id: UUID | None = None
    porcentaje_n: float | None = None
    tokens_consumidos: int = 0
    online: bool = False
    visto_en: datetime | None = None
    clave_api: str | None = None


class DispositivoEstatusOut(DispositivoOut):
    asignado: bool
    consultado_en: datetime
    ultimo_dato: str | None = None
