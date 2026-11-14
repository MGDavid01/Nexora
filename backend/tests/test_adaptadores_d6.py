import asyncio
import hashlib
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.adaptadores.correo import enviar_correo
from app.adaptadores.recuperacion import confirmar_recuperacion, solicitar_recuperacion
from app.adaptadores._resultado import EstadoEnvio
from app.api.deps import get_session
from app.core import config as config_mod
from app.core.security import hash_password, verify_password
from app.db.session import get_session as sesion_real
from app.main import app
from app.models.entities import PerfilCliente, TokenRecuperacion, Usuario
from app.models.enums import TipoCuenta, TipoPerfilCliente


class _Resultado:
    def __init__(self, filas: list) -> None:
        self._filas = filas

    def all(self) -> list:
        return self._filas

    def first(self):
        return self._filas[0] if self._filas else None


class SesionMemoria:
    def __init__(self) -> None:
        self.objetos: dict[tuple[type, object], object] = {}
        self.listas: dict[type, list] = {
            Usuario: [],
            TokenRecuperacion: [],
            PerfilCliente: [],
        }

    def add(self, obj: object) -> None:
        tipo = type(obj)
        clave = (tipo, getattr(obj, "id", id(obj)))
        if clave not in self.objetos and tipo in self.listas:
            self.listas[tipo].append(obj)
        self.objetos[clave] = obj

    async def get(self, modelo: type, pk: object):
        return self.objetos.get((modelo, pk))

    async def flush(self) -> None:
        return None

    async def exec(self, consulta):
        entidad = consulta.column_descriptions[0]["type"]
        filas = list(self.listas.get(entidad, []))
        for crit in getattr(consulta, "_where_criteria", ()):
            filas = [fila for fila in filas if _cumple(fila, crit)]
        return _Resultado(filas)


def _cumple(fila: object, crit) -> bool:
    clave = crit.left.key
    derecho = crit.right
    valor = derecho.value if hasattr(derecho, "value") else derecho
    return getattr(fila, clave) == valor


def _usuario(sesion: SesionMemoria) -> Usuario:
    perfil = PerfilCliente(tipo=TipoPerfilCliente.persona)
    sesion.add(perfil)
    usuario = Usuario(
        nombre="Ana",
        correo="ana@example.com",
        contrasena_hash=hash_password("secreto12"),
        telefono="5512345678",
        tipo_cuenta=TipoCuenta.cliente,
        perfil_cliente_id=perfil.id,
    )
    sesion.add(usuario)
    return usuario


def test_correo_omitido_sin_credencial(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config_mod.settings, "google_smtp_user", "")
    monkeypatch.setattr(config_mod.settings, "google_smtp_password", "")
    r = enviar_correo(para="a@b.com", asunto="t", cuerpo_texto="hola")
    assert r.estado == EstadoEnvio.omitido


def test_correo_enviado_con_smtp_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config_mod.settings, "google_smtp_user", "nexora@gmail.com")
    monkeypatch.setattr(config_mod.settings, "google_smtp_password", "app-pass")
    monkeypatch.setattr(config_mod.settings, "google_smtp_from", "nexora@gmail.com")

    class _SMTP:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def ehlo(self):
            return None

        def starttls(self, context=None):
            return None

        def login(self, user, password):
            assert user == "nexora@gmail.com"

        def send_message(self, msg):
            assert msg["To"] == "a@b.com"

    monkeypatch.setattr("app.adaptadores.correo.smtplib.SMTP", _SMTP)
    r = enviar_correo(para="a@b.com", asunto="Hola", cuerpo_texto="cuerpo")
    assert r.estado == EstadoEnvio.enviado


def test_correo_fallido_con_error_smtp(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config_mod.settings, "google_smtp_user", "nexora@gmail.com")
    monkeypatch.setattr(config_mod.settings, "google_smtp_password", "app-pass")

    class _SMTP:
        def __init__(self, *a, **k):
            raise OSError("smtp caído")

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr("app.adaptadores.correo.smtplib.SMTP", _SMTP)
    r = enviar_correo(para="a@b.com", asunto="Hola", cuerpo_texto="cuerpo")
    assert r.estado == EstadoEnvio.fallido


def test_solicitar_recuperacion_crea_token_y_omite_correo(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config_mod.settings, "google_smtp_user", "")
    monkeypatch.setattr(config_mod.settings, "google_smtp_password", "")
    sesion = SesionMemoria()
    usuario = _usuario(sesion)
    r = asyncio.run(solicitar_recuperacion(sesion, usuario.correo))
    assert r.estado == EstadoEnvio.omitido
    assert len(sesion.listas[TokenRecuperacion]) == 1
    assert sesion.listas[TokenRecuperacion][0].usuario_id == usuario.id


def test_solicitar_recuperacion_correo_desconocido() -> None:
    sesion = SesionMemoria()
    r = asyncio.run(solicitar_recuperacion(sesion, "nadie@example.com"))
    assert r.estado == EstadoEnvio.omitido
    assert sesion.listas[TokenRecuperacion] == []


def test_solicitar_invalida_tokens_previos(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config_mod.settings, "google_smtp_user", "")
    monkeypatch.setattr(config_mod.settings, "google_smtp_password", "")
    sesion = SesionMemoria()
    usuario = _usuario(sesion)
    asyncio.run(solicitar_recuperacion(sesion, usuario.correo))
    asyncio.run(solicitar_recuperacion(sesion, usuario.correo))
    tokens = sesion.listas[TokenRecuperacion]
    assert len(tokens) == 2
    assert tokens[0].usado is True
    assert tokens[1].usado is False


def test_confirmar_recuperacion_cambia_password() -> None:
    sesion = SesionMemoria()
    usuario = _usuario(sesion)
    token_plano = "token-de-prueba-muy-largo-1234"
    sesion.add(
        TokenRecuperacion(
            usuario_id=usuario.id,
            token_hash=hashlib.sha256(token_plano.encode()).hexdigest(),
            expira_en=datetime.now(UTC) + timedelta(hours=1),
            usado=False,
        )
    )
    asyncio.run(confirmar_recuperacion(sesion, token=token_plano, contrasena_nueva="nuevaClave9"))
    assert verify_password("nuevaClave9", usuario.contrasena_hash)
    assert sesion.listas[TokenRecuperacion][0].usado is True


def test_confirmar_recuperacion_token_vencido() -> None:
    sesion = SesionMemoria()
    usuario = _usuario(sesion)
    token_plano = "token-vencido-abcdefghijkl"
    sesion.add(
        TokenRecuperacion(
            usuario_id=usuario.id,
            token_hash=hashlib.sha256(token_plano.encode()).hexdigest(),
            expira_en=datetime.now(UTC) - timedelta(minutes=1),
            usado=False,
        )
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(confirmar_recuperacion(sesion, token=token_plano, contrasena_nueva="nuevaClave9"))
    assert exc.value.status_code == 400


def test_auth_recuperar_siempre_204() -> None:
    sesion = SesionMemoria()

    async def _override() -> AsyncIterator:
        yield sesion

    app.dependency_overrides[sesion_real] = _override
    app.dependency_overrides[get_session] = _override
    try:
        with TestClient(app) as client:
            r = client.post("/api/v1/auth/recuperar", json={"correo": "nadie@example.com"})
            assert r.status_code == 204
    finally:
        app.dependency_overrides.clear()


def test_auth_confirmar_token_invalido_400() -> None:
    sesion = SesionMemoria()

    async def _override() -> AsyncIterator:
        yield sesion

    app.dependency_overrides[sesion_real] = _override
    app.dependency_overrides[get_session] = _override
    try:
        with TestClient(app) as client:
            r = client.post(
                "/api/v1/auth/recuperar/confirmar",
                json={"token": "no-existe", "contrasena": "nuevaClave9"},
            )
            assert r.status_code == 400
    finally:
        app.dependency_overrides.clear()
