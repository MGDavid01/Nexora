"""D10 — Avisos por correo: marcas, denegar, vencimiento, cancelar.

David cablea `aviso_marca` al registrar una marca en admin.
Héctor llama los otros hooks desde solicitud/cotización/servicio cuando existan.
Sin SMTP el aviso no sale; el acto de negocio vale.
"""

from __future__ import annotations

import logging

from app.adaptadores._resultado import EstadoEnvio, ResultadoExterno
from app.adaptadores.correo import enviar_correo

logger = logging.getLogger(__name__)


def _multi(resultados: list[ResultadoExterno]) -> ResultadoExterno:
    if not resultados:
        return ResultadoExterno(EstadoEnvio.omitido, "sin destinatarios")
    if any(r.estado == EstadoEnvio.enviado for r in resultados):
        return ResultadoExterno(EstadoEnvio.enviado, "al menos un aviso enviado")
    if all(r.estado == EstadoEnvio.omitido for r in resultados):
        return ResultadoExterno(EstadoEnvio.omitido, resultados[0].detalle)
    return ResultadoExterno(EstadoEnvio.fallido, "falló el envío a uno o más destinatarios")


async def aviso_marca(
    *,
    correos: list[str],
    nombre_perfil: str,
    codigo: str,
    descripcion: str,
    bloqueado: bool,
) -> ResultadoExterno:
    asunto = "Nexora — marca registrada en tu perfil"
    bloqueo = (
        "Tu perfil quedó bloqueado al acumular tres marcas. Contacta a Nexora."
        if bloqueado
        else "Esta marca suma al conteo del perfil; el desbloqueo no lo pone en cero."
    )
    texto = (
        f"El equipo Nexora registró una marca en el perfil «{nombre_perfil}».\n"
        f"Causa: {codigo}\n"
        f"Descripción: {descripcion}\n\n"
        f"{bloqueo}\n"
    )
    html = (
        f"<p>El equipo Nexora registró una marca en el perfil <strong>{nombre_perfil}</strong>.</p>"
        f"<p>Causa: {codigo}</p>"
        f"<p>{descripcion}</p>"
        f"<p>{bloqueo}</p>"
    )
    return _multi(
        [
            enviar_correo(para=c, asunto=asunto, cuerpo_texto=texto, cuerpo_html=html)
            for c in correos
            if c.strip()
        ]
    )


async def aviso_denegar_solicitud(
    *,
    correo_cliente: str,
    titulo_solicitud: str,
    nombre_proveedor: str,
) -> ResultadoExterno:
    """Hook para Héctor: al denegar, el cliente recibe aviso (RN-005)."""
    asunto = "Nexora — un proveedor rechazó tu solicitud"
    texto = (
        f"El proveedor «{nombre_proveedor}» rechazó la solicitud «{titulo_solicitud}».\n"
        "La solicitud sigue abierta para otros proveedores.\n"
    )
    html = (
        f"<p>El proveedor <strong>{nombre_proveedor}</strong> rechazó "
        f"la solicitud <strong>{titulo_solicitud}</strong>.</p>"
        "<p>La solicitud sigue abierta para otros proveedores.</p>"
    )
    return enviar_correo(para=correo_cliente, asunto=asunto, cuerpo_texto=texto, cuerpo_html=html)


async def aviso_vencimiento_cotizacion(
    *,
    correo_cliente: str,
    titulo_solicitud: str,
    nombre_proveedor: str,
) -> ResultadoExterno:
    """Hook para Héctor (H6): participación vencida a las 24 h sin cotizar (RN-006)."""
    asunto = "Nexora — un proveedor no cotizó a tiempo"
    texto = (
        f"El proveedor «{nombre_proveedor}» no cotizó a tiempo la solicitud "
        f"«{titulo_solicitud}». Esa participación venció; la solicitud sigue abierta.\n"
    )
    html = (
        f"<p>El proveedor <strong>{nombre_proveedor}</strong> no cotizó a tiempo "
        f"la solicitud <strong>{titulo_solicitud}</strong>.</p>"
        "<p>Esa participación venció; la solicitud sigue abierta.</p>"
    )
    return enviar_correo(para=correo_cliente, asunto=asunto, cuerpo_texto=texto, cuerpo_html=html)


async def aviso_cancelar_servicio(
    *,
    correo_contraparte: str,
    titulo_solicitud: str,
    quien_cancela: str,
) -> ResultadoExterno:
    """Hook para Héctor: cancelación de servicio desde pendiente/en_curso (RN-007)."""
    asunto = "Nexora — servicio cancelado"
    texto = (
        f"{quien_cancela} canceló el servicio de la solicitud «{titulo_solicitud}».\n"
        "El servicio queda cancelado y la solicitud asignada pasa a cancelada.\n"
    )
    html = (
        f"<p><strong>{quien_cancela}</strong> canceló el servicio de la solicitud "
        f"<strong>{titulo_solicitud}</strong>.</p>"
        "<p>El servicio queda cancelado.</p>"
    )
    return enviar_correo(para=correo_contraparte, asunto=asunto, cuerpo_texto=texto, cuerpo_html=html)
