import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import CodigoMarca, FuncionProveedor, TipoCuenta, TipoMarca

_DIGITOS = re.compile(r"\D+")


class UsuarioListaOut(BaseModel):
    id: UUID
    nombre: str
    correo: str
    telefono: str
    tipo_cuenta: TipoCuenta
    funcion: FuncionProveedor | None
    perfil_cliente_id: UUID | None
    perfil_proveedor_id: UUID | None
    perfil_nombre: str
    bloqueado: bool
    conteo_marcas: int
    baja_solicitada: bool
    baja_procesada: bool


class MarcaOut(BaseModel):
    id: UUID
    tipo: TipoMarca
    codigo: CodigoMarca
    etiqueta: str
    descripcion: str
    creada_en: datetime | None


class UsuarioDetalleOut(UsuarioListaOut):
    marcas: list[MarcaOut]


class EditarCuenta(BaseModel):
    nombre: str = Field(min_length=1)
    correo: EmailStr
    telefono: str
    funcion: FuncionProveedor | None = None
    contrasena: str | None = Field(default=None, min_length=8)

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, value: str) -> str:
        limpio = value.strip()
        if not limpio:
            raise ValueError("El nombre es obligatorio")
        return limpio

    @field_validator("correo")
    @classmethod
    def _correo(cls, value: EmailStr) -> str:
        return value.lower()

    @field_validator("telefono")
    @classmethod
    def _telefono(cls, value: str) -> str:
        digitos = _DIGITOS.sub("", value)
        if len(digitos) != 10:
            raise ValueError("El teléfono debe tener 10 dígitos")
        return digitos


class RegistroAdministrador(BaseModel):
    nombre: str = Field(min_length=1)
    correo: EmailStr
    contrasena: str = Field(min_length=8)
    telefono: str

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, value: str) -> str:
        limpio = value.strip()
        if not limpio:
            raise ValueError("El nombre es obligatorio")
        return limpio

    @field_validator("correo")
    @classmethod
    def _correo(cls, value: EmailStr) -> str:
        return value.lower()

    @field_validator("telefono")
    @classmethod
    def _telefono(cls, value: str) -> str:
        digitos = _DIGITOS.sub("", value)
        if len(digitos) != 10:
            raise ValueError("El teléfono debe tener 10 dígitos")
        return digitos


class MarcaIn(BaseModel):
    tipo: TipoMarca
    codigo: CodigoMarca
    descripcion: str = Field(min_length=1)

    @field_validator("descripcion")
    @classmethod
    def _descripcion(cls, value: str) -> str:
        limpio = value.strip()
        if not limpio:
            raise ValueError("La descripción es obligatoria")
        return limpio
