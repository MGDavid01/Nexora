import pytest
from pydantic import ValidationError

from app.models.enums import TipoPerfilCliente, TipoPerfilProveedor
from app.schemas.auth import RegistroCliente, RegistroProveedor

UBICACION = {
    "calle_numero": "Calle 1",
    "colonia": "Centro",
    "ciudad": "Tijuana",
    "estado": "Baja California",
    "codigo_postal": "22000",
}


def test_cliente_persona_no_exige_nombre_comercial() -> None:
    datos = RegistroCliente(
        nombre="Ana",
        correo="Ana@Example.com",
        contrasena="secreta123",
        telefono="6641234567",
        tipo=TipoPerfilCliente.persona,
        ubicacion=UBICACION,
    )
    assert datos.correo == "ana@example.com"
    assert datos.telefono == "6641234567"


def test_cliente_empresa_exige_nombre_comercial() -> None:
    with pytest.raises(ValidationError):
        RegistroCliente(
            nombre="Ana",
            correo="ana@example.com",
            contrasena="secreta123",
            telefono="6641234567",
            tipo=TipoPerfilCliente.empresa,
            ubicacion=UBICACION,
        )


def test_proveedor_exige_categoria() -> None:
    with pytest.raises(ValidationError):
        RegistroProveedor(
            nombre="Luis",
            correo="luis@example.com",
            contrasena="secreta123",
            telefono="6641234567",
            tipo=TipoPerfilProveedor.empresa,
            nombre_comercial="Soporte Norte",
            descripcion="Redes",
            categorias=["  "],
            ubicacion=UBICACION,
        )


def test_codigo_postal_de_cinco_digitos() -> None:
    with pytest.raises(ValidationError):
        RegistroCliente(
            nombre="Ana",
            correo="ana@example.com",
            contrasena="secreta123",
            telefono="6641234567",
            tipo=TipoPerfilCliente.persona,
            ubicacion={**UBICACION, "codigo_postal": "220"},
        )
