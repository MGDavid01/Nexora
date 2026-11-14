"""D8 — OpenStreetMap: geocodificar (Nominatim), teselas y URL para mostrar.

Nominatim: User-Agent + email de contacto, máximo 1 petición/s, caché en memoria.
Lat/lon no se persisten si `ubicacion` no tiene columnas (Andrés). El adaptador
devuelve el punto; `persistir_coordenadas` es el hook para cuando existan.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote_plus

import httpx

from app.adaptadores._resultado import EstadoEnvio, ResultadoExterno
from app.core.config import settings

logger = logging.getLogger(__name__)

_ultimo_nominatim = 0.0
_rate_lock = asyncio.Lock()


@dataclass(frozen=True, slots=True)
class PuntoMapa:
    latitud: float | None
    longitud: float | None
    etiqueta: str
    mapa_url: str
    geocodificacion: ResultadoExterno


_cache: dict[str, "PuntoMapa"] = {}


@dataclass(frozen=True, slots=True)
class VistaMapa:
    """Datos para pintar el mapa en Nexora (tesela OSM + atribución)."""

    punto: PuntoMapa
    tesela_url: str
    atribucion: str


def _consulta_direccion(
    *,
    calle_numero: str,
    colonia: str,
    ciudad: str,
    estado: str,
    codigo_postal: str,
) -> str:
    partes = [calle_numero, colonia, ciudad, estado, codigo_postal, "México"]
    return ", ".join(p.strip() for p in partes if p and p.strip())


def user_agent_nominatim() -> str:
    base = settings.osm_user_agent.strip() or "Nexora/0.1"
    email = settings.osm_contact_email.strip()
    if email and email.lower() not in base.lower():
        return f"{base} (contacto: {email})"
    return base


def url_mapa(*, latitud: float | None = None, longitud: float | None = None, etiqueta: str = "") -> str:
    """URL pública de OSM para mostrar el punto (o la búsqueda por texto)."""
    if latitud is not None and longitud is not None:
        return f"https://www.openstreetmap.org/?mlat={latitud}&mlon={longitud}#map=17/{latitud}/{longitud}"
    if etiqueta.strip():
        return f"https://www.openstreetmap.org/search?query={quote_plus(etiqueta.strip())}"
    return "https://www.openstreetmap.org/"


def tesela_url() -> str:
    return settings.osm_tile_url.strip() or "https://tile.openstreetmap.org/{z}/{x}/{y}.png"


def atribucion_osm() -> str:
    return settings.osm_attribution.strip() or "© OpenStreetMap contributors"


def persistir_coordenadas(ubicacion: Any, punto: PuntoMapa) -> ResultadoExterno:
    """Hook: escribe lat/lon si el modelo ya las tiene. No crea tablas."""
    if punto.latitud is None or punto.longitud is None:
        return ResultadoExterno(EstadoEnvio.omitido, "sin coordenadas para persistir")
    if not hasattr(ubicacion, "latitud") or not hasattr(ubicacion, "longitud"):
        logger.info(
            "OSM: no se guardan lat/lon; `ubicacion` no tiene columnas (Andrés / RN-012)"
        )
        return ResultadoExterno(
            EstadoEnvio.omitido,
            "ubicacion sin latitud/longitud — Andrés debe agregar columnas",
            referencia=punto.mapa_url,
        )
    setattr(ubicacion, "latitud", punto.latitud)
    setattr(ubicacion, "longitud", punto.longitud)
    return ResultadoExterno(EstadoEnvio.enviado, "coordenadas guardadas", referencia=punto.mapa_url)


async def _respetar_un_por_segundo() -> None:
    global _ultimo_nominatim
    async with _rate_lock:
        if _ultimo_nominatim == 0.0:
            _ultimo_nominatim = time.monotonic()
            return
        ahora = time.monotonic()
        espera = 1.0 - (ahora - _ultimo_nominatim)
        if espera > 0:
            await asyncio.sleep(espera)
        _ultimo_nominatim = time.monotonic()


def _punto_sin_coords(etiqueta: str, geocodificacion: ResultadoExterno) -> PuntoMapa:
    return PuntoMapa(
        latitud=None,
        longitud=None,
        etiqueta=etiqueta,
        mapa_url=url_mapa(etiqueta=etiqueta),
        geocodificacion=geocodificacion,
    )


async def geocodificar_ubicacion(
    *,
    calle_numero: str,
    colonia: str,
    ciudad: str,
    estado: str,
    codigo_postal: str,
) -> PuntoMapa:
    """Geocodifica con Nominatim. Caché por dirección; máx. 1 req/s hacia Nominatim."""
    etiqueta = _consulta_direccion(
        calle_numero=calle_numero,
        colonia=colonia,
        ciudad=ciudad,
        estado=estado,
        codigo_postal=codigo_postal,
    )
    cached = _cache.get(etiqueta.casefold())
    if cached is not None:
        return cached

    if not settings.osm_geocoding_enabled:
        punto = _punto_sin_coords(
            etiqueta, ResultadoExterno(EstadoEnvio.omitido, "geocodificación desactivada")
        )
        _cache[etiqueta.casefold()] = punto
        return punto

    params = {
        "q": etiqueta,
        "format": "json",
        "limit": "1",
        "addressdetails": "0",
    }
    email = settings.osm_contact_email.strip()
    if email:
        params["email"] = email
    headers = {"User-Agent": user_agent_nominatim()}
    try:
        await _respetar_un_por_segundo()
        async with httpx.AsyncClient(timeout=20.0, headers=headers) as cliente:
            respuesta = await cliente.get(settings.osm_nominatim_url, params=params)
            respuesta.raise_for_status()
            filas = respuesta.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("OSM Nominatim falló | %s: %s", etiqueta, exc)
        return _punto_sin_coords(etiqueta, ResultadoExterno(EstadoEnvio.fallido, str(exc)))

    if not filas:
        punto = _punto_sin_coords(etiqueta, ResultadoExterno(EstadoEnvio.omitido, "sin coincidencias"))
        _cache[etiqueta.casefold()] = punto
        return punto

    primero = filas[0]
    try:
        lat = float(primero["lat"])
        lon = float(primero["lon"])
    except (KeyError, TypeError, ValueError) as exc:
        return _punto_sin_coords(
            etiqueta, ResultadoExterno(EstadoEnvio.fallido, f"coords inválidas: {exc}")
        )

    display = str(primero.get("display_name") or etiqueta)
    punto = PuntoMapa(
        latitud=lat,
        longitud=lon,
        etiqueta=display,
        mapa_url=url_mapa(latitud=lat, longitud=lon),
        geocodificacion=ResultadoExterno(EstadoEnvio.enviado, "geocodificado"),
    )
    _cache[etiqueta.casefold()] = punto
    return punto


async def vista_mapa(
    *,
    calle_numero: str,
    colonia: str,
    ciudad: str,
    estado: str,
    codigo_postal: str,
) -> VistaMapa:
    punto = await geocodificar_ubicacion(
        calle_numero=calle_numero,
        colonia=colonia,
        ciudad=ciudad,
        estado=estado,
        codigo_postal=codigo_postal,
    )
    return VistaMapa(punto=punto, tesela_url=tesela_url(), atribucion=atribucion_osm())


async def guardar_ubicacion(ubicacion: Any) -> tuple[PuntoMapa, ResultadoExterno]:
    """Geocodifica y, si el modelo tiene lat/lon, las escribe. No crea tablas."""
    punto = await geocodificar_ubicacion(
        calle_numero=ubicacion.calle_numero,
        colonia=ubicacion.colonia,
        ciudad=ubicacion.ciudad,
        estado=ubicacion.estado,
        codigo_postal=ubicacion.codigo_postal,
    )
    return punto, persistir_coordenadas(ubicacion, punto)
