import asyncio
from uuid import uuid4

import pytest

from app.adaptadores.avisos import (
    aviso_cancelar_servicio,
    aviso_denegar_solicitud,
    aviso_marca,
    aviso_vencimiento_cotizacion,
)
from app.adaptadores._resultado import EstadoEnvio
from app.core import config as config_mod
from app.core.security import hash_password
from app.models.entities import PerfilCliente, PerfilProveedor, Sancion, Usuario
from app.models.enums import CodigoMarca, TipoCuenta, TipoMarca, TipoPerfilCliente, TipoPerfilProveedor
from app.schemas.usuarios import MarcaIn
from app.services.marcas import aplicar_marca


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
            Sancion: [],
            PerfilCliente: [],
            PerfilProveedor: [],
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


def test_hooks_omitidos_sin_smtp(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config_mod.settings, "google_smtp_user", "")
    monkeypatch.setattr(config_mod.settings, "google_smtp_password", "")
    r1 = asyncio.run(
        aviso_marca(
            correos=["ana@example.com"],
            nombre_perfil="Ana",
            codigo="uso_indebido_reclamacion",
            descripcion="detalle",
            bloqueado=False,
        )
    )
    r2 = asyncio.run(
        aviso_denegar_solicitud(
            correo_cliente="ana@example.com",
            titulo_solicitud="PC lenta",
            nombre_proveedor="Soporte Norte",
        )
    )
    r3 = asyncio.run(
        aviso_vencimiento_cotizacion(
            correo_cliente="ana@example.com",
            titulo_solicitud="PC lenta",
            nombre_proveedor="Soporte Norte",
        )
    )
    r4 = asyncio.run(
        aviso_cancelar_servicio(
            correo_contraparte="ana@example.com",
            titulo_solicitud="PC lenta",
            quien_cancela="el cliente",
        )
    )
    assert r1.estado == EstadoEnvio.omitido
    assert r2.estado == EstadoEnvio.omitido
    assert r3.estado == EstadoEnvio.omitido
    assert r4.estado == EstadoEnvio.omitido


def test_aviso_marca_enviado_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    enviados: list[str] = []

    def _fake(*, para: str, asunto: str, cuerpo_texto: str, cuerpo_html: str | None = None):
        enviados.append(para)
        assert "equipo Nexora" in cuerpo_texto
        return type("R", (), {"estado": EstadoEnvio.enviado, "detalle": "enviado"})()

    monkeypatch.setattr("app.adaptadores.avisos.enviar_correo", _fake)
    r = asyncio.run(
        aviso_marca(
            correos=["ana@example.com", ""],
            nombre_perfil="Ana",
            codigo="x",
            descripcion="d",
            bloqueado=True,
        )
    )
    assert r.estado == EstadoEnvio.enviado
    assert enviados == ["ana@example.com"]


def test_aplicar_marca_vale_sin_smtp(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config_mod.settings, "google_smtp_user", "")
    monkeypatch.setattr(config_mod.settings, "google_smtp_password", "")
    sesion = SesionMemoria()
    perfil = PerfilCliente(tipo=TipoPerfilCliente.persona)
    usuario = Usuario(
        id=uuid4(),
        nombre="Ana",
        correo="ana@example.com",
        contrasena_hash=hash_password("secreto12"),
        telefono="5512345678",
        tipo_cuenta=TipoCuenta.cliente,
        perfil_cliente_id=perfil.id,
    )
    sesion.add(perfil)
    sesion.add(usuario)
    marca = asyncio.run(
        aplicar_marca(
            sesion,
            usuario,
            MarcaIn(
                tipo=TipoMarca.advertencia,
                codigo=CodigoMarca.uso_indebido_reclamacion,
                descripcion="Uso indebido",
            ),
        )
    )
    assert marca.codigo == CodigoMarca.uso_indebido_reclamacion
    assert perfil.conteo_marcas == 1
    assert perfil.bloqueado is False


def test_aviso_denegar_hook_firma() -> None:
    import inspect

    assert "correo_cliente" in inspect.signature(aviso_denegar_solicitud).parameters
    assert "correo_cliente" in inspect.signature(aviso_vencimiento_cotizacion).parameters
    assert "correo_contraparte" in inspect.signature(aviso_cancelar_servicio).parameters
