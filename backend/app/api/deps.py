from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_session
from app.models.entities import PerfilCliente, PerfilProveedor, Usuario
from app.models.enums import TipoCuenta

bearer = HTTPBearer(auto_error=False)
SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def usuario_actual(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> Usuario:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falta el token")
    try:
        usuario_id: UUID = decode_access_token(credentials.credentials)
    except (jwt.PyJWTError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido") from exc
    usuario = await session.get(Usuario, usuario_id)
    if usuario is None or usuario.baja_solicitada_en is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    if await perfil_esta_bloqueado(session, usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El perfil está bloqueado. Contacta a Nexora",
        )
    return usuario


async def perfil_esta_bloqueado(session: AsyncSession, usuario: Usuario) -> bool:
    if usuario.perfil_cliente_id is not None:
        perfil = await session.get(PerfilCliente, usuario.perfil_cliente_id)
        return perfil is not None and perfil.bloqueado
    if usuario.perfil_proveedor_id is not None:
        perfil = await session.get(PerfilProveedor, usuario.perfil_proveedor_id)
        return perfil is not None and perfil.bloqueado
    return False


UsuarioActual = Annotated[Usuario, Depends(usuario_actual)]


async def administrador_actual(usuario: UsuarioActual) -> Usuario:
    if usuario.tipo_cuenta != TipoCuenta.administrador:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el administrador de plataforma puede registrar clientes y proveedores",
        )
    return usuario


AdministradorActual = Annotated[Usuario, Depends(administrador_actual)]


async def buscar_por_correo(session: AsyncSession, correo: str) -> Usuario | None:
    return (await session.exec(select(Usuario).where(Usuario.correo == correo))).first()
