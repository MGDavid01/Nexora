import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.models.entities import DispositivoEsp32, PerfilCliente, PerfilProveedor
from app.models.enums import TipoPerfilCliente, TipoPerfilProveedor
from app.schemas.aparato import AutorizarAparatoIn, ComandoAparatoIn, DatoAparatoIn, VozAparatoIn
from app.schemas.dispositivos import DispositivoAltaIn, DispositivoAsignarIn
from app.services.aparato import (
    acusar_comando,
    autorizar,
    canal_voz,
    encolar_comando,
    esta_online,
    listar_comandos,
    registrar_dato,
)
from app.services.dispositivos import alta_dispositivo, asignar_dispositivo, estatus_dispositivo
from tests.sesion_memoria import SesionMemoria
from tests.test_admin_d3_d5 import _admin

settings.osm_geocoding_enabled = False
settings.aparato_stt_url = ""
settings.aparato_tts_url = ""
settings.aparato_clave_maestra = ""
settings.esp32_online_segundos = 90


def _alta(sesion: SesionMemoria):
    admin = _admin(sesion)
    out = asyncio.run(alta_dispositivo(sesion, DispositivoAltaIn(identificador="NEX-VOZ", nombre="S3"), admin.id))
    return admin, out


def test_ciclo_aparato() -> None:
    sesion = SesionMemoria()
    admin, alta = _alta(sesion)
    dispositivo = asyncio.run(sesion.get(DispositivoEsp32, alta.id))
    assert dispositivo is not None
    assert alta.clave_api
    assert alta.online is False
    auth = asyncio.run(autorizar(sesion, AutorizarAparatoIn(identificador="nex-voz", clave=alta.clave_api)))
    assert auth.dispositivo_id == alta.id
    assert esta_online(dispositivo) is True
    dato = asyncio.run(registrar_dato(sesion, dispositivo, DatoAparatoIn(clave="rssi", valor="-48")))
    assert "rssi" in (dato.ultimo_dato or "")
    comando = asyncio.run(encolar_comando(sesion, dispositivo, ComandoAparatoIn(tipo="reiniciar", payload="")))
    pendientes = asyncio.run(listar_comandos(sesion, dispositivo))
    assert len(pendientes) == 1
    acked = asyncio.run(acusar_comando(sesion, dispositivo, comando.id))
    assert acked.estado == "acked"
    assert asyncio.run(listar_comandos(sesion, dispositivo)) == []
    estatus = asyncio.run(estatus_dispositivo(sesion, alta.id))
    assert estatus.online is True
    _ = admin


def test_autorizar_clave_mala() -> None:
    sesion = SesionMemoria()
    _admin_u, alta = _alta(sesion)
    with pytest.raises(HTTPException) as error:
        asyncio.run(autorizar(sesion, AutorizarAparatoIn(identificador=alta.identificador, clave="no")))
    assert error.value.status_code == 401


def test_canal_voz_mock_cliente_sin_deepseek() -> None:
    sesion = SesionMemoria()
    admin, alta = _alta(sesion)
    perfil = PerfilCliente(tipo=TipoPerfilCliente.persona)
    sesion.add(perfil)
    asyncio.run(asignar_dispositivo(sesion, alta.id, DispositivoAsignarIn(perfil_cliente_id=perfil.id), admin.id))
    dispositivo = asyncio.run(sesion.get(DispositivoEsp32, alta.id))
    assert dispositivo is not None
    voz = asyncio.run(canal_voz(sesion, dispositivo, VozAparatoIn(texto="no enciende")))
    assert voz.agente == "mock_cliente"
    assert voz.stt == "texto"
    assert "solicitud" in voz.respuesta.lower()
    assert voz.audio_b64 == ""
    assert asyncio.run(listar_comandos(sesion, dispositivo))[0].tipo == "hablar"


def test_canal_voz_exige_asignacion() -> None:
    sesion = SesionMemoria()
    _admin_u, alta = _alta(sesion)
    dispositivo = asyncio.run(sesion.get(DispositivoEsp32, alta.id))
    assert dispositivo is not None
    with pytest.raises(HTTPException) as error:
        asyncio.run(canal_voz(sesion, dispositivo, VozAparatoIn(texto="hola")))
    assert error.value.status_code == 409


def test_canal_voz_proveedor() -> None:
    sesion = SesionMemoria()
    admin, alta = _alta(sesion)
    perfil = PerfilProveedor(tipo=TipoPerfilProveedor.empresa, nombre_comercial="Norte", descripcion="redes")
    sesion.add(perfil)
    asyncio.run(asignar_dispositivo(sesion, alta.id, DispositivoAsignarIn(perfil_proveedor_id=perfil.id), admin.id))
    dispositivo = asyncio.run(sesion.get(DispositivoEsp32, alta.id))
    assert dispositivo is not None
    voz = asyncio.run(canal_voz(sesion, dispositivo, VozAparatoIn(audio_b64="AAAA")))
    assert voz.agente == "mock_proveedor"
    assert "informe" in voz.respuesta.lower()


def test_offline_si_visto_viejo() -> None:
    sesion = SesionMemoria()
    _admin_u, alta = _alta(sesion)
    dispositivo = asyncio.run(sesion.get(DispositivoEsp32, alta.id))
    assert dispositivo is not None
    dispositivo.visto_en = datetime.now(UTC) - timedelta(minutes=10)
    assert esta_online(dispositivo) is False
