"""Adaptadores a servicios externos (David).

Sin credencial configurada el acto de negocio sigue valiendo; el aviso o el
archivo no salen. Héctor llama estas funciones desde sus routers.
"""

from app.adaptadores.osm import (
    PuntoMapa,
    VistaMapa,
    atribucion_osm,
    geocodificar_ubicacion,
    guardar_ubicacion,
    persistir_coordenadas,
    tesela_url,
    url_mapa,
    vista_mapa,
)
from app.adaptadores._resultado import EstadoEnvio, ResultadoExterno

__all__ = [
    "EstadoEnvio",
    "ResultadoExterno",
    "PuntoMapa",
    "VistaMapa",
    "geocodificar_ubicacion",
    "guardar_ubicacion",
    "persistir_coordenadas",
    "url_mapa",
    "tesela_url",
    "atribucion_osm",
    "vista_mapa",
]
