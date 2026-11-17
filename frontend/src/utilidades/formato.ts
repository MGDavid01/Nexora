export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function fechaDia(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function horaCorta(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function dineroMxn(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const n = typeof valor === "number" ? valor : Number(valor);
  if (Number.isNaN(n)) return String(valor);
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const ETIQUETAS_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  pendiente_informe: "Pendiente de informe",
  pendiente_historial: "Pendiente de informe",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
  por_cotizar: "Por cotizar",
  cotizada: "Cotizada",
  abierta: "Abierta",
  asignada: "Asignada",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
  enviada: "Enviada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  descartada: "Descartada",
  vencida: "Vencida",
  retirada: "Retirada",
};

export function tituloEstado(estado: string): string {
  const clave = estado.toLowerCase();
  if (ETIQUETAS_ESTADO[clave]) return ETIQUETAS_ESTADO[clave];
  const texto = estado.replaceAll("_", " ").trim();
  if (!texto) return estado;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const ETIQUETAS_INFORME: Record<string, string> = {
  mantenimiento: "Mantenimiento",
  cambio_de_pieza: "Cambio de pieza",
  otro_servicio: "Otro servicio",
};

export function tituloTipoInforme(tipo: string): string {
  return ETIQUETAS_INFORME[tipo] ?? tituloEstado(tipo);
}

export function esPendienteInforme(estado: string): boolean {
  const k = estado.toLowerCase();
  return k === "pendiente_informe" || k === "pendiente_historial";
}

export function plazoRestante(aceptadaEn: string | null | undefined, ahora = Date.now()): string {
  if (!aceptadaEn) return "24 h para cotizar";
  const inicio = new Date(aceptadaEn).getTime();
  if (Number.isNaN(inicio)) return "24 h para cotizar";
  const ms = inicio + 24 * 60 * 60 * 1000 - ahora;
  if (ms <= 0) return "Plazo vencido";
  const horas = Math.floor(ms / 3_600_000);
  const minutos = Math.floor((ms % 3_600_000) / 60_000);
  if (horas > 0) return `${horas} h ${minutos} min`;
  return `${minutos} min`;
}

export function proximoPasoServicio(
  estado: string,
  opts?: { tecnico?: string | null; lado?: "cliente" | "proveedor" },
): string {
  const k = estado.toLowerCase();
  const cliente = opts?.lado !== "proveedor";
  if (k === "por_cotizar") return "Cotizar";
  if (k === "cotizada") return "Esperando al cliente";
  if (k === "pendiente") {
    if (!opts?.tecnico) return cliente ? "Esperando asignación" : "Asignar técnico";
    return cliente ? "Esperando inicio" : "Iniciar";
  }
  if (k === "en_curso") return cliente ? "Trabajo en sitio" : "Terminar trabajo";
  if (esPendienteInforme(k)) return cliente ? "Esperando informe" : "Registrar informe";
  if (k === "cerrado") return "Cerrado";
  if (k === "cancelado") return "Cancelado";
  return "";
}