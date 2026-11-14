"""D6 — recuperación de contraseña: token en BD + correo Google.

La tabla `token_recuperacion` ya existe (Andrés). Aquí no se crean tablas.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.adaptadores._resultado import EstadoEnvio, ResultadoExterno
from app.adaptadores.correo import enviar_correo
from app.core.config import settings
from app.core.security import hash_password
from app.models.entities import TokenRecuperacion, Usuario

logger = logging.getLogger(__name__)


def _hash_token(token_plano: str) -> str:
    return hashlib.sha256(token_plano.encode("utf-8")).hexdigest()


def _aware(valor: datetime) -> datetime:
    if valor.tzinfo is None:
        return valor.replace(tzinfo=UTC)
    return valor


async def solicitar_recuperacion(session: AsyncSession, correo: str) -> ResultadoExterno:
    """Crea un token si el correo existe. Siempre responde igual hacia fuera (no filtra)."""
    correo_norm = correo.strip().lower()
    usuario = (await session.exec(select(Usuario).where(Usuario.correo == correo_norm))).first()
    if usuario is None or usuario.baja_procesada_en is not None:
        logger.info("recuperación omitida: correo desconocido o baja procesada")
        return ResultadoExterno(EstadoEnvio.omitido, "correo no elegible")

    for otro in (await session.exec(select(TokenRecuperacion).where(TokenRecuperacion.usuario_id == usuario.id))).all():
        if not otro.usado:
            otro.usado = True

    token_plano = secrets.token_urlsafe(32)
    fila = TokenRecuperacion(
        usuario_id=usuario.id,
        token_hash=_hash_token(token_plano),
        expira_en=datetime.now(UTC) + timedelta(minutes=settings.recuperacion_token_minutos),
        usado=False,
    )
    session.add(fila)
    await session.flush()

    enlace = f"{settings.app_public_url.rstrip('/')}/recuperar?token={token_plano}"
    minutos = settings.recuperacion_token_minutos
    asunto = "Nexora — recupera tu contraseña"
    texto = (
        f"Hola {usuario.nombre},\n\n"
        "Recibimos un pedido para restablecer tu contraseña en Nexora.\n"
        f"Usa este enlace (válido {minutos} minutos):\n\n"
        f"{enlace}\n\n"
        "Si no pediste este cambio, ignora este mensaje.\n"
    )
    html = (
        f"<p>Hola {usuario.nombre},</p>"
        "<p>Recibimos un pedido para restablecer tu contraseña en Nexora.</p>"
        f'<p><a href="{enlace}">Restablecer contraseña</a></p>'
        f"<p>El enlace caduca en {minutos} minutos.</p>"
        "<p>Si no pediste este cambio, ignora este mensaje.</p>"
    )
    resultado = enviar_correo(para=usuario.correo, asunto=asunto, cuerpo_texto=texto, cuerpo_html=html)
    # El token queda creado aunque el correo se omita/falle: el acto de negocio vale.
    return ResultadoExterno(
        estado=resultado.estado,
        detalle=resultado.detalle,
        referencia=str(fila.id),
    )


async def confirmar_recuperacion(
    session: AsyncSession,
    *,
    token: str,
    contrasena_nueva: str,
) -> UUID:
    """Aplica la nueva contraseña si el token es válido. Invalida el token."""
    if len(contrasena_nueva) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La contraseña debe tener al menos 8 caracteres",
        )
    token_hash = _hash_token(token.strip())
    ahora = datetime.now(UTC)
    candidatos = list(
        (await session.exec(select(TokenRecuperacion).where(TokenRecuperacion.token_hash == token_hash))).all()
    )
    fila = next((t for t in candidatos if not t.usado), None)
    if fila is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token inválido o ya usado")
    if _aware(fila.expira_en) < ahora:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token vencido")

    usuario = await session.get(Usuario, fila.usuario_id)
    if usuario is None or usuario.baja_procesada_en is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token inválido o ya usado")

    usuario.contrasena_hash = hash_password(contrasena_nueva)
    fila.usado = True
    for otro in (await session.exec(select(TokenRecuperacion).where(TokenRecuperacion.usuario_id == usuario.id))).all():
        if otro.id != fila.id and not otro.usado:
            otro.usado = True
    await session.flush()
    return usuario.id
