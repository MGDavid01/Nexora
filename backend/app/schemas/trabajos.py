from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.enums import (
    CategoriaReclamacion,
    CodigoMarca,
    EstadoCotizacion,
    EstadoParticipacion,
    EstadoReclamacion,
    EstadoSolicitud,
    LadoCalificacion,
    TipoHistorial,
    TipoMarca,
)

EtapaTrabajo = Literal["solicitud", "cotizacion", "servicio"]
CierreTrabajo = Literal["abierto", "cerrado"]
EstadoReclamacionFiltro = Literal["abierta", "cerrada"]
MarcaFiltro = Literal["con", "sin"]
PerfilAfectado = Literal["cliente", "proveedor"]
DesenlaceReclamacion = Literal["sin_marca", "con_marca"]


class AbrirReclamacionIn(BaseModel):
    categoria: CategoriaReclamacion
    motivo: str = Field(min_length=1)

    @field_validator("motivo")
    @classmethod
    def _motivo(cls, value: str) -> str:
        limpio = value.strip()
        if not limpio:
            raise ValueError("El motivo es obligatorio")
        return limpio


class CerrarReclamacionIn(BaseModel):
    desenlace: DesenlaceReclamacion
    tipo: TipoMarca | None = None
    codigo: CodigoMarca | None = None
    descripcion: str | None = None
    perfil_afectado: PerfilAfectado | None = None

    @field_validator("descripcion")
    @classmethod
    def _descripcion(cls, value: str | None) -> str | None:
        if value is None:
            return None
        limpio = value.strip()
        return limpio or None


class MarcaCasoIn(BaseModel):
    tipo: TipoMarca
    codigo: CodigoMarca
    descripcion: str = Field(min_length=1)
    perfil_afectado: PerfilAfectado

    @field_validator("descripcion")
    @classmethod
    def _descripcion(cls, value: str) -> str:
        limpio = value.strip()
        if not limpio:
            raise ValueError("La descripción es obligatoria")
        return limpio


class UbicacionTrabajoOut(BaseModel):
    id: UUID
    calle_numero: str
    colonia: str
    ciudad: str
    estado: str
    codigo_postal: str


class SolicitudTrabajoOut(BaseModel):
    id: UUID
    titulo: str
    descripcion: str
    estado: EstadoSolicitud
    categoria: str
    categoria_id: UUID
    cliente: str
    perfil_cliente_id: UUID
    dirigida_a_perfil_proveedor_id: UUID | None
    datos_cerrados: bool
    creado_en: datetime | None
    ubicacion: UbicacionTrabajoOut | None


class ParticipacionTrabajoOut(BaseModel):
    id: UUID
    perfil_proveedor_id: UUID
    proveedor: str
    estado: EstadoParticipacion
    aceptada_en: datetime | None


class CotizacionTrabajoOut(BaseModel):
    id: UUID
    perfil_proveedor_id: UUID
    proveedor: str
    descripcion: str
    costo_mxn: Decimal
    condiciones: str
    estado: EstadoCotizacion
    creado_en: datetime | None


class InformeTrabajoOut(BaseModel):
    id: UUID
    tecnico_usuario_id: UUID
    tecnico: str | None
    descripcion: str
    tipo: TipoHistorial
    detalle_pieza: str | None
    fecha: datetime


class CalificacionTrabajoOut(BaseModel):
    id: UUID
    lado: LadoCalificacion
    valor: Decimal
    comentario: str | None
    es_automatica: bool


class ServicioTrabajoOut(BaseModel):
    id: UUID
    perfil_proveedor_id: UUID
    proveedor: str
    tecnico_usuario_id: UUID | None
    tecnico: str | None
    estado: str
    cotizacion_id: UUID
    creado_en: datetime | None
    informe: InformeTrabajoOut | None
    calificaciones: list[CalificacionTrabajoOut]


class ReclamacionTrabajoOut(BaseModel):
    id: UUID
    servicio_id: UUID
    reclamante_usuario_id: UUID
    reclamante: str | None
    categoria: CategoriaReclamacion
    categoria_etiqueta: str
    motivo: str
    estado: EstadoReclamacion
    creada_en: datetime | None
    cerrada_en: datetime | None


class MarcaCasoOut(BaseModel):
    id: UUID
    tipo: TipoMarca
    codigo: CodigoMarca
    etiqueta: str
    descripcion: str
    perfil_afectado: PerfilAfectado
    servicio_id: UUID | None
    reclamacion_id: UUID | None
    creada_en: datetime | None


class HistorialServicioResumenOut(BaseModel):
    servicio_id: UUID
    solicitud_id: UUID
    titulo: str
    estado: str
    creado_en: datetime | None


class HistorialAcotadoOut(BaseModel):
    cliente: list[HistorialServicioResumenOut]
    proveedor: list[HistorialServicioResumenOut]


class TrabajoListaOut(BaseModel):
    solicitud_id: UUID
    titulo: str
    cliente: str
    categoria: str
    etapa: EtapaTrabajo
    estado_solicitud: EstadoSolicitud
    cierre: CierreTrabajo
    estado_servicio: str | None
    proveedor: str | None
    reclamacion: EstadoReclamacionFiltro | None
    hay_marca: bool
    creado_en: datetime | None


class ExpedienteTrabajoOut(BaseModel):
    solicitud: SolicitudTrabajoOut
    participaciones: list[ParticipacionTrabajoOut]
    cotizaciones: list[CotizacionTrabajoOut]
    servicio: ServicioTrabajoOut | None
    reclamaciones: list[ReclamacionTrabajoOut]
    marcas: list[MarcaCasoOut]
    historial_perfiles: HistorialAcotadoOut | None
