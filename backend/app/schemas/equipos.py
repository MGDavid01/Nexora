from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class EquipoIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, valor: str) -> str:
        limpio = valor.strip()
        if not limpio:
            raise ValueError("El nombre del equipo es obligatorio")
        return limpio


class EquipoOut(BaseModel):
    id: UUID
    perfil_cliente_id: UUID
    nombre: str
