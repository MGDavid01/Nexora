from dataclasses import dataclass
from enum import StrEnum


class EstadoEnvio(StrEnum):
    enviado = "enviado"
    omitido = "omitido"  # sin credencial o deshabilitado a propósito
    fallido = "fallido"  # hubo credencial pero el proveedor falló


@dataclass(frozen=True, slots=True)
class ResultadoExterno:
    """Resultado de un acto externo. El caller no debe abortar el negocio por esto."""

    estado: EstadoEnvio
    detalle: str = ""
    referencia: str | None = None

    @property
    def ok(self) -> bool:
        return self.estado == EstadoEnvio.enviado

    @property
    def omitido(self) -> bool:
        return self.estado == EstadoEnvio.omitido
