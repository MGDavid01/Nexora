"""D6 — correo vía Google SMTP.

Sin GOOGLE_SMTP_USER / GOOGLE_SMTP_PASSWORD el envío se omite (EstadoEnvio.omitido).
El acto de negocio que dispara el correo sigue valiendo.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.adaptadores._resultado import EstadoEnvio, ResultadoExterno
from app.core.config import settings

logger = logging.getLogger(__name__)

ResultadoCorreo = ResultadoExterno


def correo_configurado() -> bool:
    return bool(settings.google_smtp_user.strip() and settings.google_smtp_password.strip())


def enviar_correo(
    *,
    para: str,
    asunto: str,
    cuerpo_texto: str,
    cuerpo_html: str | None = None,
) -> ResultadoCorreo:
    """Envía un correo. Nunca lanza por falta de credencial o fallo del proveedor."""
    destinatario = para.strip()
    if not destinatario:
        return ResultadoCorreo(EstadoEnvio.omitido, "Sin destinatario")
    if not correo_configurado():
        logger.info("correo omitido (sin credencial Google SMTP) → %s | %s", destinatario, asunto)
        return ResultadoCorreo(EstadoEnvio.omitido, "Google SMTP no configurado")

    remitente = (settings.google_smtp_from or settings.google_smtp_user).strip()
    mensaje = EmailMessage()
    mensaje["Subject"] = asunto
    mensaje["From"] = remitente
    mensaje["To"] = destinatario
    mensaje.set_content(cuerpo_texto)
    if cuerpo_html:
        mensaje.add_alternative(cuerpo_html, subtype="html")

    try:
        contexto = ssl.create_default_context()
        with smtplib.SMTP(settings.google_smtp_host, settings.google_smtp_port, timeout=20) as smtp:
            smtp.ehlo()
            smtp.starttls(context=contexto)
            smtp.ehlo()
            smtp.login(settings.google_smtp_user, settings.google_smtp_password)
            smtp.send_message(mensaje)
    except Exception as exc:  # noqa: BLE001 — el negocio no debe caer por el correo
        logger.warning("correo fallido → %s | %s: %s", destinatario, asunto, exc)
        return ResultadoCorreo(EstadoEnvio.fallido, str(exc))

    logger.info("correo enviado → %s | %s", destinatario, asunto)
    return ResultadoCorreo(EstadoEnvio.enviado, "enviado")
