import asyncio
from collections.abc import AsyncIterator
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.adaptadores import osm as osm_mod
from app.adaptadores.osm import (
    PuntoMapa,
    atribucion_osm,
    geocodificar_ubicacion,
    persistir_coordenadas,
    tesela_url,
    user_agent_nominatim,
    url_mapa,
)
from app.adaptadores._resultado import EstadoEnvio, ResultadoExterno
from app.api.deps import get_session, usuario_actual
from app.core import config as config_mod
from app.core.security import hash_password
from app.db.session import get_session as sesion_real
from app.main import app
from app.models.entities import Ubicacion, Usuario
from app.models.enums import TipoCuenta

_DIR = dict(
    calle_numero="Calle 1",
    colonia="Centro",
    ciudad="Tijuana",
    estado="Baja California",
    codigo_postal="22000",
)


@pytest.fixture(autouse=True)
def _limpiar_osm() -> None:
    osm_mod._cache.clear()
    osm_mod._ultimo_nominatim = 0.0


def test_url_mapa_con_coords() -> None:
    url = url_mapa(latitud=32.5, longitud=-117.0)
    assert "mlat=32.5" in url
    assert "mlon=-117.0" in url


def test_tesela_y_atribucion(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config_mod.settings, "osm_tile_url", "https://tile.openstreetmap.org/{z}/{x}/{y}.png")
    monkeypatch.setattr(config_mod.settings, "osm_attribution", "© OpenStreetMap contributors")
    assert "{z}" in tesela_url()
    assert "OpenStreetMap" in atribucion_osm()


def test_user_agent_incluye_email(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config_mod.settings, "osm_user_agent", "Nexora/0.1")
    monkeypatch.setattr(config_mod.settings, "osm_contact_email", "nexora@example.com")
    ua = user_agent_nominatim()
    assert "Nexora/0.1" in ua
    assert "nexora@example.com" in ua


def test_geocodificar_desactivado(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config_mod.settings, "osm_geocoding_enabled", False)
    punto = asyncio.run(geocodificar_ubicacion(**_DIR))
    assert punto.latitud is None
    assert punto.geocodificacion.estado == EstadoEnvio.omitido
    assert "openstreetmap.org" in punto.mapa_url


def test_geocodificar_mock_y_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config_mod.settings, "osm_geocoding_enabled", True)
    monkeypatch.setattr(config_mod.settings, "osm_contact_email", "nexora@example.com")
    llamadas = {"n": 0}

    class _Resp:
        def raise_for_status(self):
            return None

        def json(self):
            return [{"lat": "32.5149", "lon": "-117.0382", "display_name": "Tijuana"}]

    class _Client:
        def __init__(self, *a, **k):
            assert "Nexora" in k.get("headers", {}).get("User-Agent", "")

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url, params=None):
            llamadas["n"] += 1
            assert params["email"] == "nexora@example.com"
            return _Resp()

    monkeypatch.setattr("app.adaptadores.osm.httpx.AsyncClient", _Client)
    monkeypatch.setattr("app.adaptadores.osm.asyncio.sleep", lambda *_a, **_k: asyncio.sleep(0))
    p1 = asyncio.run(geocodificar_ubicacion(**_DIR))
    p2 = asyncio.run(geocodificar_ubicacion(**_DIR))
    assert p1.latitud == pytest.approx(32.5149)
    assert p1.geocodificacion.estado == EstadoEnvio.enviado
    assert llamadas["n"] == 1
    assert p2.etiqueta == "Tijuana"


def test_persistir_en_ubicacion_con_lat_lon() -> None:
    ubicacion = Ubicacion(
        calle_numero="Calle 1",
        colonia="Centro",
        ciudad="Tijuana",
        estado="Baja California",
        codigo_postal="22000",
    )
    punto = PuntoMapa(
        latitud=32.5,
        longitud=-117.0,
        etiqueta="x",
        mapa_url="https://www.openstreetmap.org/",
        geocodificacion=ResultadoExterno(EstadoEnvio.enviado, "ok"),
    )
    r = persistir_coordenadas(ubicacion, punto)
    assert r.estado == EstadoEnvio.enviado
    assert ubicacion.latitud == 32.5
    assert ubicacion.longitud == -117.0


def test_persistir_sin_atributos_omite() -> None:
    destino = SimpleNamespace(calle="x")
    punto = PuntoMapa(
        latitud=32.5,
        longitud=-117.0,
        etiqueta="x",
        mapa_url="https://www.openstreetmap.org/",
        geocodificacion=ResultadoExterno(EstadoEnvio.enviado, "ok"),
    )
    r = persistir_coordenadas(destino, punto)
    assert r.estado == EstadoEnvio.omitido
    assert "columnas" in r.detalle


def test_persistir_con_columnas_hook() -> None:
    destino = SimpleNamespace(latitud=None, longitud=None)
    punto = PuntoMapa(
        latitud=32.5,
        longitud=-117.0,
        etiqueta="x",
        mapa_url="https://www.openstreetmap.org/",
        geocodificacion=ResultadoExterno(EstadoEnvio.enviado, "ok"),
    )
    r = persistir_coordenadas(destino, punto)
    assert r.estado == EstadoEnvio.enviado
    assert destino.latitud == 32.5
    assert destino.longitud == -117.0


def test_admin_mapa_omitido(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config_mod.settings, "osm_geocoding_enabled", False)
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
            r = client.get("/api/v1/admin/mapa", params=_DIR, headers={"authorization": "Bearer prueba"})
        assert r.status_code == 200
        cuerpo = r.json()
        assert cuerpo["estado"] == "omitido"
        assert "OpenStreetMap" in cuerpo["atribucion"]
        assert "{z}" in cuerpo["tesela_url"]
    finally:
        app.dependency_overrides.clear()
