import asyncio
from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.deps import get_session, usuario_actual
from app.db.session import get_session as sesion_real
from app.main import app
from app.models.entities import Usuario
from app.models.enums import FuncionProveedor, TipoCuenta, TipoPerfilCliente, TipoPerfilProveedor
from app.schemas.auth import RegistroCliente, RegistroProveedor
from app.services.registro import registrar_cliente, registrar_proveedor

UBICACION = {
    "calle_numero": "Calle 1",
    "colonia": "Centro",
    "ciudad": "Tijuana",
    "estado": "Baja California",
    "codigo_postal": "22000",
}


def _cliente_datos() -> RegistroCliente:
    return RegistroCliente(
        nombre="Ana",
        correo="ana@example.com",
        contrasena="secreta123",
        telefono="6641234567",
        tipo=TipoPerfilCliente.persona,
        ubicacion=UBICACION,
    )


def _proveedor_datos() -> RegistroProveedor:
    return RegistroProveedor(
        nombre="Luis",
        correo="luis@example.com",
        contrasena="secreta123",
        telefono="6641234567",
        tipo=TipoPerfilProveedor.empresa,
        nombre_comercial="Soporte Norte",
        descripcion="Redes",
        categorias=["Redes"],
        ubicacion=UBICACION,
    )


def _usuario(tipo: TipoCuenta) -> Usuario:
    return Usuario(
        nombre="Quien intenta",
        correo=f"{tipo.value}@example.com",
        contrasena_hash="hash",
        telefono="6640000000",
        tipo_cuenta=tipo,
        funcion=FuncionProveedor.administrativo if tipo == TipoCuenta.proveedor else None,
        perfil_cliente_id=uuid4() if tipo == TipoCuenta.cliente else None,
        perfil_proveedor_id=uuid4() if tipo == TipoCuenta.proveedor else None,
    )


async def _sesion_vacia() -> AsyncIterator[None]:
    yield None


def test_servicio_rechaza_cliente_y_proveedor() -> None:
    with pytest.raises(HTTPException) as cliente:
        asyncio.run(registrar_cliente(None, _cliente_datos(), _usuario(TipoCuenta.cliente)))  # type: ignore[arg-type]
    with pytest.raises(HTTPException) as proveedor:
        asyncio.run(registrar_proveedor(None, _proveedor_datos(), _usuario(TipoCuenta.proveedor)))  # type: ignore[arg-type]
    assert cliente.value.status_code == 403
    assert proveedor.value.status_code == 403


def test_alta_publica_ya_no_existe() -> None:
    with TestClient(app) as cliente:
        respuesta = cliente.post("/api/v1/auth/registro/cliente", json={})
    assert respuesta.status_code == 404


def test_alta_sin_token_responde_401() -> None:
    app.dependency_overrides[get_session] = _sesion_vacia
    app.dependency_overrides[sesion_real] = _sesion_vacia
    try:
        with TestClient(app) as cliente:
            respuesta = cliente.post("/api/v1/admin/clientes", json=_cliente_datos().model_dump(mode="json"))
        assert respuesta.status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_alta_de_otro_rol_responde_403() -> None:
    async def como_cliente() -> Usuario:
        return _usuario(TipoCuenta.cliente)

    app.dependency_overrides[get_session] = _sesion_vacia
    app.dependency_overrides[sesion_real] = _sesion_vacia
    app.dependency_overrides[usuario_actual] = como_cliente
    try:
        with TestClient(app) as cliente:
            respuesta = cliente.post(
                "/api/v1/admin/proveedores",
                json=_proveedor_datos().model_dump(mode="json"),
                headers={"authorization": "Bearer prueba"},
            )
        assert respuesta.status_code == 403
        assert respuesta.json()["detail"] == "Solo el administrador de plataforma puede registrar clientes y proveedores"
    finally:
        app.dependency_overrides.clear()


def test_tablero_admin_rechaza_otro_rol() -> None:
    async def como_proveedor() -> Usuario:
        return _usuario(TipoCuenta.proveedor)

    app.dependency_overrides[get_session] = _sesion_vacia
    app.dependency_overrides[sesion_real] = _sesion_vacia
    app.dependency_overrides[usuario_actual] = como_proveedor
    try:
        with TestClient(app) as cliente:
            respuesta = cliente.get(
                "/api/v1/admin/tablero",
                headers={"authorization": "Bearer prueba"},
            )
        assert respuesta.status_code == 403
    finally:
        app.dependency_overrides.clear()

