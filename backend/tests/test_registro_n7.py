import asyncio

from app.core.config import settings
from app.models.entities import PerfilProveedor, Usuario
from app.models.enums import FuncionProveedor, TipoCuenta, TipoPerfilProveedor
from app.schemas.auth import RegistroProveedor
from app.services.registro import registrar_proveedor
from tests.sesion_memoria import SesionMemoria

settings.osm_geocoding_enabled = False

_UBICACION = {
    "calle_numero": "Calle 1",
    "colonia": "Centro",
    "ciudad": "Tijuana",
    "estado": "Baja California",
    "codigo_postal": "22000",
}


def _admin(sesion: SesionMemoria) -> Usuario:
    usuario = Usuario(
        nombre="Admin",
        correo="admin@example.com",
        contrasena_hash="hash",
        telefono="6640000001",
        tipo_cuenta=TipoCuenta.administrador,
    )
    sesion.add(usuario)
    return usuario


def test_alta_escribe_empresa_no_proveedor() -> None:
    sesion = SesionMemoria()
    admin = _admin(sesion)
    usuario = asyncio.run(
        registrar_proveedor(
            sesion,
            RegistroProveedor(
                nombre="Luis",
                correo="luis@example.com",
                contrasena="secreta123",
                telefono="6642222222",
                tipo=TipoPerfilProveedor.empresa,
                nombre_comercial="Norte",
                descripcion="Redes",
                categorias=["Redes"],
                ubicacion=_UBICACION,
            ),
            admin,
        )
    )
    assert usuario.tipo_cuenta == TipoCuenta.empresa
    assert usuario.funcion == FuncionProveedor.administrativo
    assert usuario.tipo_cuenta != TipoCuenta.proveedor


def test_alta_negocio_administrativo_campo() -> None:
    sesion = SesionMemoria()
    admin = _admin(sesion)
    usuario = asyncio.run(
        registrar_proveedor(
            sesion,
            RegistroProveedor(
                nombre="Nora",
                correo="nora@example.com",
                contrasena="secreta123",
                telefono="6644444444",
                tipo=TipoPerfilProveedor.persona,
                nombre_comercial="Taller Uno",
                descripcion="Campo",
                categorias=["Soporte"],
                tipo_cuenta="negocio",
                ubicacion=_UBICACION,
            ),
            admin,
        )
    )
    assert usuario.tipo_cuenta == TipoCuenta.negocio
    assert usuario.funcion == FuncionProveedor.administrativo_campo
