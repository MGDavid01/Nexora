from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.models.enums import (
    EstadoCotizacion,
    EstadoParticipacion,
    EstadoServicio,
    FuncionProveedor,
    LadoCalificacion,
    TipoCuenta,
    TipoHistorial,
)


class CotizacionCrearIn(BaseModel):
    descripcion: str = Field(min_length=1)
    costo_mxn: Decimal = Field(gt=0)
    condiciones: str = Field(min_length=1)

    @model_validator(mode="after")
    def _texto(self) -> "CotizacionCrearIn":
        self.descripcion = self.descripcion.strip()
        self.condiciones = self.condiciones.strip()
        if not self.descripcion or not self.condiciones:
            raise ValueError("La descripción y las condiciones son obligatorias")
        return self


class CotizacionOut(BaseModel):
    id: UUID
    solicitud_id: UUID
    perfil_proveedor_id: UUID
    participacion_id: UUID
    descripcion: str
    costo_mxn: Decimal
    condiciones: str
    estado: EstadoCotizacion
    creado_en: datetime | None


class InformeIn(BaseModel):
    descripcion: str = Field(min_length=1)
    tipo: TipoHistorial
    detalle_pieza: str | None = None
    fecha: datetime | None = None

    @model_validator(mode="after")
    def _pieza(self) -> "InformeIn":
        self.descripcion = self.descripcion.strip()
        if self.detalle_pieza:
            self.detalle_pieza = self.detalle_pieza.strip() or None
        if self.tipo == TipoHistorial.cambio_de_pieza and not self.detalle_pieza:
            raise ValueError("El cambio de pieza requiere el detalle de la pieza")
        if self.tipo != TipoHistorial.cambio_de_pieza:
            self.detalle_pieza = None
        return self


class CalificacionIn(BaseModel):
    valor: Decimal = Field(ge=Decimal("1"), le=Decimal("5"))
    comentario: str | None = None

    @model_validator(mode="after")
    def _comentario(self) -> "CalificacionIn":
        if self.comentario:
            self.comentario = self.comentario.strip() or None
        return self


class TecnicoIn(BaseModel):
    tecnico_usuario_id: UUID


class ServicioOut(BaseModel):
    id: UUID
    solicitud_id: UUID
    cotizacion_id: UUID
    perfil_proveedor_id: UUID
    tecnico_usuario_id: UUID | None
    estado: str
    creado_en: datetime | None


class InformeOut(BaseModel):
    id: UUID
    servicio_id: UUID
    tecnico_usuario_id: UUID
    descripcion: str
    tipo: TipoHistorial
    detalle_pieza: str | None
    fecha: datetime


class CalificacionOut(BaseModel):
    id: UUID
    servicio_id: UUID
    lado: LadoCalificacion
    valor: Decimal
    comentario: str | None
    es_automatica: bool


class HistorialItemOut(BaseModel):
    servicio_id: UUID
    solicitud_id: UUID
    titulo: str
    estado: str
    perfil_proveedor_id: UUID
    costo_mxn: Decimal | None
    creado_en: datetime | None
    informe: InformeOut | None = None


class ExtraUsuarioIn(BaseModel):
    nombre: str = Field(min_length=1)
    correo: str
    contrasena: str = Field(min_length=8)
    telefono: str
    funcion: Literal["administrativo", "tecnico"]


class BajaUsuarioIn(BaseModel):
    tecnico_reemplazo_id: UUID | None = None


class ConversionPedirIn(BaseModel):
    hacia: Literal["empresa", "negocio"]


class ConversionAutorizarIn(BaseModel):
    extras_a_eliminar: list[UUID] = Field(default_factory=list)


class ConversionOut(BaseModel):
    perfil_proveedor_id: UUID
    desde: TipoCuenta
    hacia: TipoCuenta
    estado: Literal["solicitada", "autorizada", "rechazada"]
    extras: list[UUID]
    detalle: str | None
    pedido_en: datetime | None
    actor_usuario_id: UUID | None


class EmpresaUsuarioOut(BaseModel):
    id: UUID
    nombre: str
    correo: str
    telefono: str
    tipo_cuenta: TipoCuenta
    funcion: FuncionProveedor | None
    primera: bool
    baja_procesada: bool


class ParticipacionDetalleOut(BaseModel):
    id: UUID
    solicitud_id: UUID
    perfil_proveedor_id: UUID
    estado: EstadoParticipacion
    aceptada_en: datetime | None
