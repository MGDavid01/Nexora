from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.models.enums import EstadoParticipacion, EstadoSolicitud
from app.schemas.auth import UbicacionIn


class SolicitudCrearIn(BaseModel):
    titulo: str = Field(min_length=1)
    descripcion: str = Field(min_length=1)
    # `categoria_id` es la forma estable para la API; `categoria` permite
    # publicar usando el nombre que ya utiliza el alta de proveedores.
    categoria_id: UUID | None = None
    categoria: str | None = None
    dirigida_a_perfil_proveedor_id: UUID | None = None
    ubicacion: UbicacionIn

    @model_validator(mode="after")
    def _categoria_requerida(self) -> "SolicitudCrearIn":
        if self.categoria_id is None and not (self.categoria and self.categoria.strip()):
            raise ValueError("La categoría es obligatoria")
        self.titulo = self.titulo.strip()
        self.descripcion = self.descripcion.strip()
        if not self.titulo or not self.descripcion:
            raise ValueError("El título y la descripción son obligatorios")
        if self.categoria:
            self.categoria = self.categoria.strip()
        return self


class UbicacionSolicitudOut(BaseModel):
    id: UUID
    calle_numero: str
    colonia: str
    ciudad: str
    estado: str
    codigo_postal: str


class SolicitudOut(BaseModel):
    id: UUID
    titulo: str
    descripcion: str
    categoria_id: UUID
    categoria: str
    estado: EstadoSolicitud
    datos_cerrados: bool
    creado_en: datetime | None
    ubicacion: UbicacionSolicitudOut


class ParticipacionOut(BaseModel):
    id: UUID
    solicitud_id: UUID
    perfil_proveedor_id: UUID
    estado: EstadoParticipacion
    aceptada_en: datetime | None


class MercadoSolicitudOut(SolicitudOut):
    pass
