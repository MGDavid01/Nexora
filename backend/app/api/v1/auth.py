from fastapi import APIRouter, HTTPException, status

from app.api.deps import SessionDep, UsuarioActual, buscar_por_correo, perfil_esta_bloqueado
from app.core.security import create_access_token, verify_password
from app.schemas.auth import Login, TokenResponse, UsuarioOut
from app.services.registro import marcar_baja

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(datos: Login, session: SessionDep) -> TokenResponse:
    usuario = await buscar_por_correo(session, datos.correo)
    if usuario is None or usuario.baja_solicitada_en is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Correo o contraseña incorrectos")
    if not verify_password(datos.contrasena, usuario.contrasena_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Correo o contraseña incorrectos")
    if await perfil_esta_bloqueado(session, usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El perfil está bloqueado. Contacta a Nexora",
        )
    return TokenResponse(access_token=create_access_token(usuario.id))


@router.get("/yo", response_model=UsuarioOut)
async def yo(usuario: UsuarioActual) -> UsuarioOut:
    return UsuarioOut.model_validate(usuario, from_attributes=True)


@router.post("/baja", status_code=status.HTTP_204_NO_CONTENT)
async def baja(usuario: UsuarioActual) -> None:
    marcar_baja(usuario)
