"""Adaptadores a servicios externos (David).

Sin credencial configurada el acto de negocio sigue valiendo; el aviso o el
archivo no salen. Héctor llama estas funciones desde sus routers.
"""

from app.adaptadores.avisos import (
    aviso_cancelar_servicio,
    aviso_denegar_solicitud,
    aviso_marca,
    aviso_vencimiento_cotizacion,
)
from app.adaptadores.correo import ResultadoCorreo, enviar_correo
from app.adaptadores._resultado import EstadoEnvio, ResultadoExterno

__all__ = [
    "EstadoEnvio",
    "ResultadoExterno",
    "ResultadoCorreo",
    "enviar_correo",
    "aviso_marca",
    "aviso_denegar_solicitud",
    "aviso_vencimiento_cotizacion",
    "aviso_cancelar_servicio",
]
