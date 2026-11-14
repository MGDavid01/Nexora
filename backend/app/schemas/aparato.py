from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AutorizarAparatoIn(BaseModel):
    identificador: str = Field(min_length=1, max_length=120)
    clave: str = Field(min_length=1, max_length=200)


class AutorizarAparatoOut(BaseModel):
    access_token: str
    dispositivo_id: UUID
    identificador: str
    online: bool


class DatoAparatoIn(BaseModel):
    clave: str = Field(min_length=1, max_length=80)
    valor: str = Field(max_length=2000)


class DatoAparatoOut(BaseModel):
    dispositivo_id: UUID
    ultimo_dato: str | None
    ultimo_dato_en: datetime | None
    online: bool


class ComandoAparatoIn(BaseModel):
    tipo: str = Field(min_length=1, max_length=40)
    payload: str = ""


class ComandoAparatoOut(BaseModel):
    id: UUID
    dispositivo_id: UUID
    tipo: str
    payload: str
    estado: str
    creado_en: datetime | None
    acked_en: datetime | None


class VozAparatoIn(BaseModel):
    texto: str | None = None
    audio_b64: str | None = None


class VozAparatoOut(BaseModel):
    transcripcion: str
    respuesta: str
    audio_b64: str
    stt: str
    tts: str
    agente: str
