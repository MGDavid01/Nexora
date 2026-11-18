import type { TonoPastilla } from "../../vista-lista/VistaLista";
import { esPendienteInforme } from "../../utilidades/formato";

export function tonoEstadoServicio(estado: string): TonoPastilla {
  const k = estado.toLowerCase();
  if (esPendienteInforme(k)) return "negativa";
  if (k === "por_cotizar" || k === "pendiente") return "alerta";
  if (k === "cotizada" || k === "en_curso") return "acento";
  if (k === "cerrado") return "positiva";
  if (k === "cancelado") return "neutra";
  return "neutra";
}

export function recortar(texto: string, max = 90): string {
  const t = texto.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}
