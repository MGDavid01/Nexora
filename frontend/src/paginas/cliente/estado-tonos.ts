import type { TonoPastilla } from "../../vista-lista/VistaLista";

export function tonoEstadoSolicitud(estado: string): TonoPastilla {
  const k = estado.toLowerCase();
  if (k === "abierta") return "acento";
  if (k === "asignada") return "alerta";
  if (k === "cerrada") return "positiva";
  return "neutra";
}

export function tonoEstadoCotizacion(estado: string): TonoPastilla {
  const k = estado.toLowerCase();
  if (k === "enviada") return "acento";
  if (k === "elegida" || k === "aceptada") return "positiva";
  if (k === "rechazada" || k === "vencida") return "negativa";
  if (k === "descartada" || k === "retirada") return "neutra";
  return "neutra";
}
