import logging

from app.adaptadores.osm import guardar_ubicacion
from app.core.config import settings
from app.models.entities import Ubicacion

logger = logging.getLogger(__name__)


async def intentar_geocodificar(ubicacion: Ubicacion) -> None:
    """D8: guarda lat/lon si Nominatim responde. Un fallo no revierte el alta."""
    if not settings.osm_geocoding_enabled:
        return
    try:
        await guardar_ubicacion(ubicacion)
    except Exception as exc:  # noqa: BLE001
        logger.info("OSM omitido al persistir ubicación: %s", exc)
