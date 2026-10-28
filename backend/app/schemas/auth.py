import re
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models.enums import FuncionProveedor, TipoCuenta, TipoPerfilCliente, TipoPerfilProveedor

_DIGITOS = re.compile(r"\D+")


class UbicacionIn(BaseModel):
    calle_numero: str = Field(min_length=1)
    colonia: str = Field(min_length=1)
    ciudad: str = Field(min_length=1)
    estado: str = Field(min_length=1)
    codigo_postal: str

    @field_validator("calle_numero", "colonia", "ciudad", "estado")
    @classmethod
    def _texto(cls, value: str) -> str:
        limpio = value.strip()
        if not limpio:
            raise ValueError("Este dato es obligatorio")
        return limpio

    @field_validator("codigo_postal")
    @classmethod
    def _cp(cls, value: str) -> str:
        limpio = value.strip()
        if not re.fullmatch(r"\d{5}", limpio):
            raise ValueError("El código postal debe tener 5 dígitos")
        return limpio


class RegistroCliente(BaseModel):
    nombre: str = Field(min_length=1)
    correo: EmailStr
    contrasena: str = Field(min_length=8)
    telefono: str
    tipo: TipoPerfilCliente
    nombre_comercial: str | None = None
    ubicacion: UbicacionIn

    @field_validator("nombre", "nombre_comercial")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        if value is None:
            return None
        limpio = value.strip()
        return limpio or None

    @field_validator("telefono")
    @classmethod
    def _telefono(cls, value: str) -> str:
        digitos = _DIGITOS.sub("", value)
        if len(digitos) != 10:
            raise ValueError("El teléfono debe tener 10 dígitos")
        return digitos

    @field_validator("correo")
    @classmethod
    def _correo(cls, value: EmailStr) -> str:
        return value.lower()

    @model_validator(mode="after")
    def _nombre_comercial_si_no_es_persona(self) -> "RegistroCliente":
        if self.tipo != TipoPerfilCliente.persona and not self.nombre_comercial:
            raise ValueError("El establecimiento o la empresa necesitan nombre comercial")
        return self


class RegistroProveedor(BaseModel):
    nombre: str = Field(min_length=1)
    correo: EmailStr
    contrasena: str = Field(min_length=8)
    telefono: str
    tipo: TipoPerfilProveedor
    nombre_comercial: str = Field(min_length=1)
    descripcion: str = Field(min_length=1)
    categorias: list[str] = Field(min_length=1)
    ubicacion: UbicacionIn

    @field_validator("nombre", "nombre_comercial", "descripcion")
    @classmethod
    def _strip(cls, value: str) -> str:
        limpio = value.strip()
        if not limpio:
            raise ValueError("Este dato es obligatorio")
        return limpio

    @field_validator("telefono")
    @classmethod
    def _telefono(cls, value: str) -> str:
        digitos = _DIGITOS.sub("", value)
        if len(digitos) != 10:
            raise ValueError("El teléfono debe tener 10 dígitos")
        return digitos

    @field_validator("correo")
    @classmethod
    def _correo(cls, value: EmailStr) -> str:
        return value.lower()

    @field_validator("categorias")
    @classmethod
    def _categorias(cls, value: list[str]) -> list[str]:
        limpias: list[str] = []
        vistas: set[str] = set()
        for categoria in value:
            nombre = categoria.strip()
            clave = nombre.casefold()
            if not nombre or clave in vistas:
                continue
            vistas.add(clave)
            limpias.append(nombre)
        if not limpias:
            raise ValueError("Indica al menos una categoría")
        return limpias


class Login(BaseModel):
    correo: EmailStr
    contrasena: str

    @field_validator("correo")
    @classmethod
    def _correo(cls, value: EmailStr) -> str:
        return value.lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UsuarioOut(BaseModel):
    id: UUID
    nombre: str
    correo: str
    telefono: str
    tipo_cuenta: TipoCuenta
    funcion: FuncionProveedor | None
    perfil_cliente_id: UUID | None
    perfil_proveedor_id: UUID | None
