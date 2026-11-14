"""Adaptadores a servicios externos (David).

Sin credencial configurada el acto de negocio sigue valiendo; el aviso o el
archivo no salen. Héctor llama estas funciones desde sus routers.
"""

from app.adaptadores.archivos import ReferenciaArchivo, subir_archivo
from app.adaptadores._resultado import EstadoEnvio, ResultadoExterno

__all__ = [
    "EstadoEnvio",
    "ResultadoExterno",
    "ReferenciaArchivo",
    "subir_archivo",
]
