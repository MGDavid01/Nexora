"""Adaptadores a servicios externos (David).

Sin credencial configurada el acto de negocio sigue valiendo; el aviso o el
archivo no salen. Héctor llama estas funciones desde sus routers.
"""

from app.adaptadores.archivos import ReferenciaArchivo, subir_archivo
from app.adaptadores.avisos import (
    aviso_cancelar_servicio,
    aviso_denegar_solicitud,
    aviso_marca,
    aviso_vencimiento_cotizacion,
)
from app.adaptadores.correo import ResultadoCorreo, enviar_correo
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
from app.adaptadores.recuperacion import confirmar_recuperacion, solicitar_recuperacion
from app.adaptadores._resultado import EstadoEnvio, ResultadoExterno

__all__ = [
    "EstadoEnvio",
    "ResultadoExterno",
    "ResultadoCorreo",
    "enviar_correo",
    "solicitar_recuperacion",
    "confirmar_recuperacion",
    "ReferenciaArchivo",
    "subir_archivo",
    "PuntoMapa",
    "VistaMapa",
    "geocodificar_ubicacion",
    "guardar_ubicacion",
    "persistir_coordenadas",
    "url_mapa",
    "tesela_url",
    "atribucion_osm",
    "vista_mapa",
    "aviso_marca",
    "aviso_denegar_solicitud",
    "aviso_vencimiento_cotizacion",
    "aviso_cancelar_servicio",
]
