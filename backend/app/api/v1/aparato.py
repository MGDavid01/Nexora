from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.deps import SessionDep
from app.models.entities import DispositivoEsp32
from app.schemas.aparato import (
    AutorizarAparatoIn,
    AutorizarAparatoOut,
    ComandoAparatoOut,
    DatoAparatoIn,
    DatoAparatoOut,
    VozAparatoIn,
    VozAparatoOut,
)
from app.services.aparato import (
    acusar_comando,
    aparato_actual,
    autorizar,
    canal_voz,
    esta_online,
    leer_dato,
    listar_comandos,
    marcar_visto,
    registrar_dato,
)

bearer_aparato = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/aparato", tags=["aparato"])


async def dispositivo_actual(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_aparato)],
) -> DispositivoEsp32:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falta el token del aparato")
    return await aparato_actual(session, credentials.credentials)


AparatoActual = Annotated[DispositivoEsp32, Depends(dispositivo_actual)]


@router.post("/autorizar", response_model=AutorizarAparatoOut)
async def autorizar_aparato(datos: AutorizarAparatoIn, session: SessionDep) -> AutorizarAparatoOut:
    return await autorizar(session, datos)


@router.post("/latido", response_model=DatoAparatoOut)
async def latido_aparato(session: SessionDep, dispositivo: AparatoActual) -> DatoAparatoOut:
    await marcar_visto(session, dispositivo)
    return await leer_dato(session, dispositivo)


@router.post("/datos", response_model=DatoAparatoOut)
async def subir_datos(datos: DatoAparatoIn, session: SessionDep, dispositivo: AparatoActual) -> DatoAparatoOut:
    return await registrar_dato(session, dispositivo, datos)


@router.get("/datos", response_model=DatoAparatoOut)
async def consultar_datos(session: SessionDep, dispositivo: AparatoActual) -> DatoAparatoOut:
    return await leer_dato(session, dispositivo)


@router.get("/comandos", response_model=list[ComandoAparatoOut])
async def consultar_comandos(session: SessionDep, dispositivo: AparatoActual) -> list[ComandoAparatoOut]:
    return await listar_comandos(session, dispositivo)


@router.post("/comandos/{comando_id}/ack", response_model=ComandoAparatoOut)
async def ack_comando(
    comando_id: UUID, session: SessionDep, dispositivo: AparatoActual
) -> ComandoAparatoOut:
    return await acusar_comando(session, dispositivo, comando_id)


@router.post("/voz", response_model=VozAparatoOut)
async def canal_voz_aparato(
    datos: VozAparatoIn, session: SessionDep, dispositivo: AparatoActual
) -> VozAparatoOut:
    return await canal_voz(session, dispositivo, datos)


@router.get("/estatus")
async def estatus_propio(session: SessionDep, dispositivo: AparatoActual) -> dict[str, bool | str]:
    await marcar_visto(session, dispositivo)
    return {
        "online": esta_online(dispositivo),
        "identificador": dispositivo.identificador,
    }
