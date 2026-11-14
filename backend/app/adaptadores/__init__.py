"""Adaptadores a servicios externos (David).

Sin credencial configurada el acto de negocio sigue valiendo; el aviso o el
archivo no salen. Héctor llama estas funciones desde sus routers.
"""

from app.adaptadores.correo import ResultadoCorreo, enviar_correo
from app.adaptadores.recuperacion import confirmar_recuperacion, solicitar_recuperacion
from app.adaptadores._resultado import EstadoEnvio, ResultadoExterno

__all__ = [
    "EstadoEnvio",
    "ResultadoExterno",
    "ResultadoCorreo",
    "enviar_correo",
    "solicitar_recuperacion",
    "confirmar_recuperacion",
]
