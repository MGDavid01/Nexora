import type { IconType } from "react-icons";
import {
  LuChartColumn,
  LuClipboardList,
  LuCpu,
  LuHistory,
  LuHouse,
  LuMap,
  LuMic,
  LuMonitor,
  LuScrollText,
  LuUsers,
  LuWallet,
  LuWrench,
} from "react-icons/lu";
import type { Usuario } from "./api";

export type Lugar = "cliente" | "administrativo" | "tecnico" | "administrador";

export type Seccion = {
  titulo: string;
  texto: string;
};

export type Herramienta = {
  to: string;
  etiqueta: string;
  icono: IconType;
  resumen: string;
  texto: string;
  lugares: Lugar[];
  accion?: string;
  secciones: Seccion[];
  /** La ruta ya tiene pantalla propia. La barra solo enlaza. */
  existente?: boolean;
};

export function lugarDe(usuario: Usuario): Lugar {
  if (usuario.tipo_cuenta === "cliente") return "cliente";
  if (usuario.tipo_cuenta === "administrador") return "administrador";
  if (usuario.funcion === "tecnico" || usuario.funcion === "administrativo_campo") return "tecnico";
  return "administrativo";
}

const cliente: Herramienta[] = [
  {
    to: "/cliente/solicitudes",
    etiqueta: "Solicitudes",
    icono: LuClipboardList,
    resumen: "Publicar soporte y elegir una cotización.",
    texto: "Publicas una solicitud abierta con el problema, la categoría y la ubicación. Si ya cerraste servicios, al publicar ves «Solicitar para:» con esos proveedores. Aquí también consultas las cotizaciones enviadas y eliges una.",
    lugares: ["cliente"],
    accion: "Publicar solicitud",
    secciones: [],
    existente: true,
  },
  {
    to: "/cliente/servicios",
    etiqueta: "Servicios",
    icono: LuWrench,
    resumen: "Seguimiento hasta el cierre y la calificación.",
    texto: "Al aceptar una cotización nace el servicio. Lo sigues hasta el cierre. Puedes cancelarlo solo si sigue pendiente o en curso. Al cerrar puedes calificar al proveedor de 1 a 5; si no calificas, queda 4.5.",
    lugares: ["cliente"],
    secciones: [],
    existente: true,
  },
  {
    to: "/cliente/historial",
    etiqueta: "Historial",
    icono: LuHistory,
    resumen: "Servicios ya dados. No es el reporte.",
    texto: "El historial registra los servicios que ya se dieron. El reporte es otra cosa: mide acciones del perfil.",
    lugares: ["cliente"],
    secciones: [],
    existente: true,
  },
  {
    to: "/cliente/equipos",
    etiqueta: "Equipos",
    icono: LuMonitor,
    resumen: "Equipos de cómputo de tu perfil.",
    texto: "Equipos de cómputo registrados en tu perfil.",
    lugares: ["cliente"],
    accion: "Agregar equipo",
    secciones: [],
    existente: true,
  },
  {
    to: "/cliente/reportes",
    etiqueta: "Reportes",
    icono: LuChartColumn,
    resumen: "Mediciones de tu perfil.",
    texto: "Mediciones de las acciones de tu perfil. Las genera el sistema. No sustituyen al historial.",
    lugares: ["cliente"],
    secciones: [],
    existente: true,
  },
];

const proveedor: Herramienta[] = [
  {
    to: "/proveedor/solicitudes",
    etiqueta: "Solicitudes",
    icono: LuClipboardList,
    resumen: "Aceptar, denegar o cotizar.",
    texto: "Solicitudes abiertas que tu perfil puede atender. Aceptar abre 24 horas para cotizar y no reserva la solicitud. Denegar la oculta para tu perfil. La cotización es una por solicitud y no se modifica.",
    lugares: ["administrativo", "tecnico"],
    secciones: [],
    existente: true,
  },
  {
    to: "/proveedor/servicios",
    etiqueta: "Servicios",
    icono: LuWrench,
    resumen: "Del pendiente al cierre.",
    texto: "Servicios asignados a tu perfil. El recorrido es pendiente, en curso, pendiente de historial y cerrado. Para empezar hace falta un técnico de este perfil.",
    lugares: ["administrativo", "tecnico"],
    secciones: [],
    existente: true,
  },
  {
    to: "/proveedor/historial",
    etiqueta: "Historial",
    icono: LuHistory,
    resumen: "Servicios dados por tu perfil.",
    texto: "Registro de los servicios que tu perfil ya dio. No es el reporte de mediciones.",
    lugares: ["administrativo"],
    secciones: [],
    existente: true,
  },
  {
    to: "/proveedor/equipo",
    etiqueta: "Equipo",
    icono: LuUsers,
    resumen: "Usuarios y categorías del perfil.",
    texto: "Usuarios administrativos y técnicos de tu perfil, y las categorías de servicio que atiendes.",
    lugares: ["administrativo"],
    accion: "Agregar usuario",
    secciones: [],
    existente: true,
  },
  {
    to: "/proveedor/mapa",
    etiqueta: "Mapa",
    icono: LuMap,
    resumen: "Ubicación del perfil.",
    texto: "Ubicación de tu perfil. El mapa es OpenStreetMap.",
    lugares: ["administrativo"],
    secciones: [],
    existente: true,
  },
  {
    to: "/proveedor/reportes",
    etiqueta: "Reportes",
    icono: LuChartColumn,
    resumen: "Mediciones del perfil.",
    texto: "Mediciones de las acciones de tu perfil. No son el historial de servicios.",
    lugares: ["administrativo"],
    secciones: [],
    existente: true,
  },
  {
    to: "/proveedor/captura",
    etiqueta: "Captura",
    icono: LuMic,
    resumen: "Voz en campo con el dispositivo autorizado.",
    texto: "Captura de voz en campo. La hace el dispositivo ESP32 autorizado, conectado al sistema.",
    lugares: ["tecnico"],
    secciones: [],
    existente: true,
  },
];

const administrador: Herramienta[] = [
  {
    to: "/admin/usuarios",
    etiqueta: "Usuarios",
    icono: LuUsers,
    resumen: "Padrón, altas, edición y marcas del perfil.",
    texto: "Padrón de perfiles y cuentas: altas, edición, marcas y bloqueo del perfil.",
    lugares: ["administrador"],
    secciones: [],
    existente: true,
  },
  {
    to: "/admin/trabajos",
    etiqueta: "Trabajos",
    icono: LuClipboardList,
    resumen: "Solicitudes, cotizaciones, servicios y reclamaciones por caso.",
    texto: "Cada fila es un caso: la solicitud, sus cotizaciones, el servicio si hubo aceptación, calificaciones, reclamación y marcas de ese caso. Cancelar un servicio no es lo mismo que reclamar.",
    lugares: ["administrador"],
    secciones: [
      { titulo: "Expediente", texto: "Solicitud, cotizaciones, servicio, calificaciones y reclamación ligados al mismo caso." },
      { titulo: "Marcas del caso", texto: "Advertencias o sanciones sobre el caso (RN-011), distintas del padrón de marcas del perfil." },
    ],
    existente: true,
  },
  {
    to: "/admin/reportes",
    etiqueta: "Reportes",
    icono: LuChartColumn,
    resumen: "Mediciones de los perfiles.",
    texto: "Consulta de reportes. Miden acciones de un perfil. No son el historial de servicios.",
    lugares: ["administrador"],
    secciones: [],
    existente: true,
  },
  {
    to: "/admin/ingresos",
    etiqueta: "Ingresos",
    icono: LuWallet,
    resumen: "Comisión simulada de servicios cerrados.",
    texto: "Comisión simulada sobre el costo de la cotización de cada servicio cerrado, con la escala de 5 % a 9 %. No hay cobro ni pasarela. El inicio muestra los últimos 30 días.",
    lugares: ["administrador"],
    secciones: [],
    existente: true,
  },
  {
    to: "/admin/dispositivos",
    etiqueta: "Dispositivos",
    icono: LuCpu,
    resumen: "Dispositivos de campo autorizados.",
    texto: "Dispositivos ESP32 autorizados para la captura en campo. Qué más entra además de la voz sigue abierto.",
    lugares: ["administrador"],
    secciones: [],
    existente: true,
  },
  {
    to: "/admin/auditoria",
    etiqueta: "Auditoría",
    icono: LuScrollText,
    resumen: "Log de acciones administrativas.",
    texto: "Registro de altas, ediciones, marcas, desbloqueo, baja procesada, tramos, dispositivos y consultas de historial acotadas. No es historial de servicios, reporte ni SIEM.",
    lugares: ["administrador"],
    secciones: [],
    existente: true,
  },
];

const inicio: Herramienta = {
  to: "/inicio",
  etiqueta: "Inicio",
  icono: LuHouse,
  resumen: "Tu cuenta.",
  texto: "",
  lugares: ["cliente", "administrativo", "tecnico", "administrador"],
  secciones: [],
  existente: true,
};

export const herramientas: Herramienta[] = [inicio, ...cliente, ...proveedor, ...administrador];

export function herramientasDe(usuario: Usuario): Herramienta[] {
  const lugar = lugarDe(usuario);
  return herramientas.filter((herramienta) => herramienta.lugares.includes(lugar));
}
