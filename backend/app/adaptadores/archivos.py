"""D7 — Cloudinary: subida de archivos. En BD solo se guarda la referencia (URL/public_id).

Credenciales (cualquiera de las dos formas):
- CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
- o CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET

Sin credencial: el acto de negocio vale; el archivo no sale (EstadoEnvio.omitido).
"""

from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass
from urllib.parse import unquote, urlparse

import httpx

from app.adaptadores._resultado import EstadoEnvio, ResultadoExterno
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class ReferenciaArchivo:
    public_id: str
    url_segura: str
    formato: str | None = None
    bytes: int | None = None


@dataclass(frozen=True, slots=True)
class CredencialesCloudinary:
    cloud_name: str
    api_key: str
    api_secret: str


def _desde_url(url: str) -> CredencialesCloudinary | None:
    crudo = url.strip()
    if not crudo:
        return None
    parsed = urlparse(crudo)
    if parsed.scheme.lower() != "cloudinary":
        return None
    cloud_name = unquote(parsed.hostname or "").strip()
    api_key = unquote(parsed.username or "").strip()
    api_secret = unquote(parsed.password or "").strip()
    if cloud_name and api_key and api_secret:
        return CredencialesCloudinary(cloud_name, api_key, api_secret)
    return None


def credenciales_cloudinary() -> CredencialesCloudinary | None:
    desde_url = _desde_url(settings.cloudinary_url)
    if desde_url is not None:
        return desde_url
    cloud_name = settings.cloudinary_cloud_name.strip()
    api_key = settings.cloudinary_api_key.strip()
    api_secret = settings.cloudinary_api_secret.strip()
    if cloud_name and api_key and api_secret:
        return CredencialesCloudinary(cloud_name, api_key, api_secret)
    return None


def cloudinary_configurado() -> bool:
    return credenciales_cloudinary() is not None


def _firmar(params: dict[str, str], secret: str) -> str:
    # Cloudinary: claves alfabéticas, key=value unidos con &, SHA-1 de (cuerpo + secret).
    cuerpo = "&".join(f"{k}={params[k]}" for k in sorted(params))
    return hashlib.sha1(f"{cuerpo}{secret}".encode("utf-8")).hexdigest()


async def subir_archivo(
    *,
    contenido: bytes,
    nombre_archivo: str,
    carpeta: str = "nexora",
    resource_type: str = "auto",
) -> ResultadoExterno:
    """POST a Cloudinary. Sin credencial → omitido (el caller no debe fallar el negocio)."""
    if not contenido:
        return ResultadoExterno(EstadoEnvio.omitido, "archivo vacío")
    creds = credenciales_cloudinary()
    if creds is None:
        logger.info("Cloudinary omitido (sin credencial) | %s", nombre_archivo)
        return ResultadoExterno(EstadoEnvio.omitido, "Cloudinary no configurado")

    timestamp = str(int(time.time()))
    firmar: dict[str, str] = {"folder": carpeta, "timestamp": timestamp}
    firma = _firmar(firmar, creds.api_secret)
    url = f"https://api.cloudinary.com/v1_1/{creds.cloud_name}/{resource_type}/upload"
    data = {
        "api_key": creds.api_key,
        "timestamp": timestamp,
        "folder": carpeta,
        "signature": firma,
    }
    files = {"file": (nombre_archivo, contenido)}

    try:
        async with httpx.AsyncClient(timeout=60.0) as cliente:
            respuesta = await cliente.post(url, data=data, files=files)
            respuesta.raise_for_status()
            cuerpo = respuesta.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Cloudinary falló | %s: %s", nombre_archivo, exc)
        return ResultadoExterno(EstadoEnvio.fallido, str(exc))

    public_id = str(cuerpo.get("public_id") or "")
    url_segura = str(cuerpo.get("secure_url") or cuerpo.get("url") or "")
    if not public_id or not url_segura:
        return ResultadoExterno(EstadoEnvio.fallido, "respuesta Cloudinary incompleta")

    ref = ReferenciaArchivo(
        public_id=public_id,
        url_segura=url_segura,
        formato=cuerpo.get("format"),
        bytes=cuerpo.get("bytes"),
    )
    logger.info("Cloudinary subido | %s → %s", nombre_archivo, ref.public_id)
    return ResultadoExterno(EstadoEnvio.enviado, "subido", referencia=ref.url_segura)
