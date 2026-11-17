"""Canal de voz RN-019: STT → agente → TTS.

Sin URLs configuradas usa mocks. No llama a DeepSeek (D9).
"""

from app.core.config import settings
from app.models.entities import DispositivoEsp32


def transcribir(audio_b64: str | None, texto: str | None) -> tuple[str, str]:
    if texto and texto.strip():
        return texto.strip(), "texto"
    if settings.aparato_stt_url.strip():
        return "[stt externo no ejecutado en este entorno]", "omitido"
    if audio_b64 and audio_b64.strip():
        return "audio simulado: describe el problema o dicta el informe", "mock"
    return "", "vacio"


def responder_agente(transcripcion: str, dispositivo: DispositivoEsp32) -> tuple[str, str]:
    """Ayuda a armar solicitud (cliente) o informe (proveedor). Sin DeepSeek."""
    _ = transcripcion
    if dispositivo.perfil_cliente_id is not None:
        return (
            "Puedes publicar una solicitud con título, descripción, categoría y ubicación. "
            "La web también sirve sin el aparato.",
            "mock_cliente",
        )
    if dispositivo.perfil_proveedor_id is not None:
        return (
            "Dicta el informe de servicio: qué se hizo y el tipo "
            "(mantenimiento, cambio de pieza u otro servicio).",
            "mock_proveedor",
        )
    return ("El aparato está en el pool. El administrador debe asignarlo a un perfil.", "mock_pool")


def sintetizar(respuesta: str) -> tuple[str, str]:
    if settings.aparato_tts_url.strip():
        return "", "omitido"
    return "", "mock"
