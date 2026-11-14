import hashlib
import json
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.security import create_aparato_token, decode_aparato_token
from app.models.entities import ComandoEsp32, DispositivoEsp32
from app.schemas.aparato import (
    AutorizarAparatoIn,
    AutorizarAparatoOut,
    ComandoAparatoIn,
    ComandoAparatoOut,
    DatoAparatoIn,
    DatoAparatoOut,
    VozAparatoIn,
    VozAparatoOut,
)
from app.services.canal_voz import responder_agente, sintetizar, transcribir


def hash_clave_aparato(clave: str) -> str:
    return hashlib.sha256(clave.encode("utf-8")).hexdigest()


def generar_clave_aparato() -> str:
    return secrets.token_urlsafe(24)


def clave_valida(clave: str, dispositivo: DispositivoEsp32) -> bool:
    digest = hash_clave_aparato(clave)
    if dispositivo.clave_api_hash and secrets.compare_digest(digest, dispositivo.clave_api_hash):
        return True
    maestra = settings.aparato_clave_maestra.strip()
    return bool(maestra) and secrets.compare_digest(clave, maestra)


def esta_online(dispositivo: DispositivoEsp32, *, ahora: datetime | None = None) -> bool:
    if dispositivo.visto_en is None:
        return False
    instante = ahora or datetime.now(UTC)
    visto = dispositivo.visto_en
    if visto.tzinfo is None:
        visto = visto.replace(tzinfo=UTC)
    return instante - visto <= timedelta(seconds=max(1, settings.esp32_online_segundos))


async def autorizar(session: AsyncSession, datos: AutorizarAparatoIn) -> AutorizarAparatoOut:
    dispositivo = next(
        (
            item
            for item in (await session.exec(select(DispositivoEsp32))).all()
            if item.identificador.casefold() == datos.identificador.strip().casefold()
        ),
        None,
    )
    if dispositivo is None or not clave_valida(datos.clave, dispositivo):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Aparato no autorizado")
    await marcar_visto(session, dispositivo)
    return AutorizarAparatoOut(
        access_token=create_aparato_token(dispositivo.id),
        dispositivo_id=dispositivo.id,
        identificador=dispositivo.identificador,
        online=True,
    )


async def aparato_actual(session: AsyncSession, token: str) -> DispositivoEsp32:
    try:
        dispositivo_id = decode_aparato_token(token)
    except (jwt.PyJWTError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de aparato inválido") from exc
    dispositivo = await session.get(DispositivoEsp32, dispositivo_id)
    if dispositivo is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de aparato inválido")
    return dispositivo


async def marcar_visto(session: AsyncSession, dispositivo: DispositivoEsp32) -> None:
    dispositivo.visto_en = datetime.now(UTC)
    await session.flush()


async def registrar_dato(session: AsyncSession, dispositivo: DispositivoEsp32, datos: DatoAparatoIn) -> DatoAparatoOut:
    await marcar_visto(session, dispositivo)
    dispositivo.ultimo_dato = json.dumps({"clave": datos.clave, "valor": datos.valor}, ensure_ascii=False)
    dispositivo.ultimo_dato_en = datetime.now(UTC)
    await session.flush()
    return DatoAparatoOut(
        dispositivo_id=dispositivo.id,
        ultimo_dato=dispositivo.ultimo_dato,
        ultimo_dato_en=dispositivo.ultimo_dato_en,
        online=esta_online(dispositivo),
    )


async def leer_dato(session: AsyncSession, dispositivo: DispositivoEsp32) -> DatoAparatoOut:
    await marcar_visto(session, dispositivo)
    return DatoAparatoOut(
        dispositivo_id=dispositivo.id,
        ultimo_dato=dispositivo.ultimo_dato,
        ultimo_dato_en=dispositivo.ultimo_dato_en,
        online=esta_online(dispositivo),
    )


async def encolar_comando(
    session: AsyncSession,
    dispositivo: DispositivoEsp32,
    datos: ComandoAparatoIn,
) -> ComandoAparatoOut:
    comando = ComandoEsp32(
        dispositivo_id=dispositivo.id,
        tipo=datos.tipo.strip(),
        payload=datos.payload,
        estado="pendiente",
        creado_en=datetime.now(UTC),
    )
    session.add(comando)
    await session.flush()
    return _comando_out(comando)


async def listar_comandos(session: AsyncSession, dispositivo: DispositivoEsp32) -> list[ComandoAparatoOut]:
    await marcar_visto(session, dispositivo)
    filas = [
        item
        for item in (await session.exec(select(ComandoEsp32))).all()
        if item.dispositivo_id == dispositivo.id and item.estado == "pendiente"
    ]
    filas.sort(key=lambda item: str(item.creado_en))
    return [_comando_out(item) for item in filas]


async def acusar_comando(session: AsyncSession, dispositivo: DispositivoEsp32, comando_id: UUID) -> ComandoAparatoOut:
    comando = await session.get(ComandoEsp32, comando_id)
    if comando is None or comando.dispositivo_id != dispositivo.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ese comando")
    comando.estado = "acked"
    comando.acked_en = datetime.now(UTC)
    await marcar_visto(session, dispositivo)
    await session.flush()
    return _comando_out(comando)


async def canal_voz(session: AsyncSession, dispositivo: DispositivoEsp32, datos: VozAparatoIn) -> VozAparatoOut:
    if dispositivo.perfil_cliente_id is None and dispositivo.perfil_proveedor_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El aparato debe estar asignado a un perfil para el canal de voz",
        )
    transcripcion, origen_stt = transcribir(datos.audio_b64, datos.texto)
    if not transcripcion:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Falta texto o audio")
    respuesta, origen_agente = responder_agente(transcripcion, dispositivo)
    audio_b64, origen_tts = sintetizar(respuesta)
    await encolar_comando(session, dispositivo, ComandoAparatoIn(tipo="hablar", payload=respuesta))
    await marcar_visto(session, dispositivo)
    return VozAparatoOut(
        transcripcion=transcripcion,
        respuesta=respuesta,
        audio_b64=audio_b64,
        stt=origen_stt,
        tts=origen_tts,
        agente=origen_agente,
    )


def _comando_out(comando: ComandoEsp32) -> ComandoAparatoOut:
    return ComandoAparatoOut(
        id=comando.id,
        dispositivo_id=comando.dispositivo_id,
        tipo=comando.tipo,
        payload=comando.payload,
        estado=comando.estado,
        creado_en=comando.creado_en,
        acked_en=comando.acked_en,
    )
