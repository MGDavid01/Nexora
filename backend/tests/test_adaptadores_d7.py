import asyncio
from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.adaptadores.archivos import cloudinary_configurado, credenciales_cloudinary, subir_archivo
from app.adaptadores._resultado import EstadoEnvio
from app.api.deps import get_session, usuario_actual
from app.core import config as config_mod
from app.core.security import hash_password
from app.db.session import get_session as sesion_real
from app.main import app
from app.models.entities import Usuario
from app.models.enums import TipoCuenta


def _limpiar_cloudinary(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config_mod.settings, "cloudinary_url", "")
    monkeypatch.setattr(config_mod.settings, "cloudinary_cloud_name", "")
    monkeypatch.setattr(config_mod.settings, "cloudinary_api_key", "")
    monkeypatch.setattr(config_mod.settings, "cloudinary_api_secret", "")


def test_cloudinary_omitido_sin_credencial(monkeypatch: pytest.MonkeyPatch) -> None:
    _limpiar_cloudinary(monkeypatch)
    assert cloudinary_configurado() is False
    r = asyncio.run(subir_archivo(contenido=b"abc", nombre_archivo="a.png"))
    assert r.estado == EstadoEnvio.omitido


def test_cloudinary_url_parseada(monkeypatch: pytest.MonkeyPatch) -> None:
    _limpiar_cloudinary(monkeypatch)
    monkeypatch.setattr(
        config_mod.settings,
        "cloudinary_url",
        "cloudinary://key123:secret456@mi-nube",
    )
    creds = credenciales_cloudinary()
    assert creds is not None
    assert creds.cloud_name == "mi-nube"
    assert creds.api_key == "key123"
    assert creds.api_secret == "secret456"


def test_cloudinary_url_gana_al_trio(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config_mod.settings, "cloudinary_url", "cloudinary://urlkey:urlsecret@desde-url")
    monkeypatch.setattr(config_mod.settings, "cloudinary_cloud_name", "otro")
    monkeypatch.setattr(config_mod.settings, "cloudinary_api_key", "otro")
    monkeypatch.setattr(config_mod.settings, "cloudinary_api_secret", "otro")
    creds = credenciales_cloudinary()
    assert creds is not None
    assert creds.cloud_name == "desde-url"


def test_cloudinary_subida_mock_con_trio(monkeypatch: pytest.MonkeyPatch) -> None:
    _limpiar_cloudinary(monkeypatch)
    monkeypatch.setattr(config_mod.settings, "cloudinary_cloud_name", "demo")
    monkeypatch.setattr(config_mod.settings, "cloudinary_api_key", "key")
    monkeypatch.setattr(config_mod.settings, "cloudinary_api_secret", "secret")

    class _Resp:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "public_id": "nexora/foto",
                "secure_url": "https://res.cloudinary.com/demo/image/upload/nexora/foto",
                "format": "png",
                "bytes": 3,
            }

    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, data=None, files=None):
            assert "demo" in url
            assert data["api_key"] == "key"
            assert "signature" in data
            return _Resp()

    monkeypatch.setattr("app.adaptadores.archivos.httpx.AsyncClient", _Client)
    r = asyncio.run(subir_archivo(contenido=b"abc", nombre_archivo="a.png"))
    assert r.estado == EstadoEnvio.enviado
    assert r.referencia and "cloudinary" in r.referencia


def test_cloudinary_subida_mock_con_url(monkeypatch: pytest.MonkeyPatch) -> None:
    _limpiar_cloudinary(monkeypatch)
    monkeypatch.setattr(config_mod.settings, "cloudinary_url", "cloudinary://ukey:usecret@nube-url")

    class _Resp:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "public_id": "nexora/doc",
                "secure_url": "https://res.cloudinary.com/nube-url/image/upload/nexora/doc",
            }

    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, data=None, files=None):
            assert "nube-url" in url
            assert data["api_key"] == "ukey"
            return _Resp()

    monkeypatch.setattr("app.adaptadores.archivos.httpx.AsyncClient", _Client)
    r = asyncio.run(subir_archivo(contenido=b"pdf", nombre_archivo="a.pdf"))
    assert r.estado == EstadoEnvio.enviado


def test_admin_archivos_omitido(monkeypatch: pytest.MonkeyPatch) -> None:
    _limpiar_cloudinary(monkeypatch)
    admin = Usuario(
        id=uuid4(),
        nombre="Admin",
        correo="admin@example.com",
        contrasena_hash=hash_password("secreto12"),
        telefono="5511111111",
        tipo_cuenta=TipoCuenta.administrador,
    )

    async def _sesion() -> AsyncIterator[None]:
        yield None

    async def _admin() -> Usuario:
        return admin

    app.dependency_overrides[sesion_real] = _sesion
    app.dependency_overrides[get_session] = _sesion
    app.dependency_overrides[usuario_actual] = _admin
    try:
        with TestClient(app) as client:
            r = client.post(
                "/api/v1/admin/archivos",
                files={"archivo": ("foto.png", b"abc", "image/png")},
                headers={"authorization": "Bearer prueba"},
            )
        assert r.status_code == 200
        cuerpo = r.json()
        assert cuerpo["estado"] == "omitido"
        assert cuerpo["referencia"] is None
    finally:
        app.dependency_overrides.clear()
