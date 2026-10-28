import type { IconType } from "react-icons";
import {
  LuBuilding2,
  LuChartColumn,
  LuClipboardList,
  LuCpu,
  LuHistory,
  LuHouse,
  LuMap,
  LuMic,
  LuMonitor,
  LuReceipt,
  LuShieldAlert,
  LuStar,
  LuUserPlus,
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
  if (usuario.funcion === "tecnico") return "tecnico";
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
    secciones: [
      {
        titulo: "Abiertas",
        texto: "Cuando publiques una, queda abierta hasta que elijas una cotización o la canceles.",
      },
      {
        titulo: "Cotizaciones por elegir",
        texto: "Solo puedes elegir entre cotizaciones ya enviadas.",
      },
    ],
  },
  {
    to: "/cliente/servicios",
    etiqueta: "Servicios",
    icono: LuWrench,
    resumen: "Seguimiento hasta el cierre y la calificación.",
    texto: "Al aceptar una cotización nace el servicio. Lo sigues hasta el cierre. Puedes cancelarlo solo si sigue pendiente o en curso. Al cerrar puedes calificar al proveedor de 1 a 5; si no calificas, queda 4.5.",
    lugares: ["cliente"],
    secciones: [
      {
        titulo: "En seguimiento",
        texto: "Pendiente, en curso o pendiente de historial.",
      },
    ],
  },
  {
    to: "/cliente/historial",
    etiqueta: "Historial",
    icono: LuHistory,
    resumen: "Servicios ya dados. No es el reporte.",
    texto: "El historial registra los servicios que ya se dieron. El reporte es otra cosa: mide acciones del perfil.",
    lugares: ["cliente"],
    secciones: [
      {
        titulo: "Servicios cerrados",
        texto: "Cada servicio cerrado conserva la calificación de ese cierre.",
      },
    ],
  },
  {
    to: "/cliente/equipos",
    etiqueta: "Equipos",
    icono: LuMonitor,
    resumen: "Equipos de cómputo de tu perfil.",
    texto: "Equipos de cómputo registrados en tu perfil.",
    lugares: ["cliente"],
    accion: "Agregar equipo",
    secciones: [
      {
        titulo: "Del perfil",
        texto: "Cuando registres un equipo, aparece aquí.",
      },
    ],
  },
  {
    to: "/cliente/reportes",
    etiqueta: "Reportes",
    icono: LuChartColumn,
    resumen: "Mediciones de tu perfil.",
    texto: "Mediciones de las acciones de tu perfil. Las genera el sistema. No sustituyen al historial.",
    lugares: ["cliente"],
    secciones: [
      {
        titulo: "Mediciones",
        texto: "Cada medición guarda la acción, la métrica, el valor y la fecha.",
      },
    ],
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
    secciones: [
      {
        titulo: "Por decidir",
        texto: "Todavía no hay una decisión de tu perfil.",
      },
      {
        titulo: "Dentro del plazo",
        texto: "Aceptadas y todavía a tiempo de cotizar.",
      },
    ],
  },
  {
    to: "/proveedor/servicios",
    etiqueta: "Servicios",
    icono: LuWrench,
    resumen: "Del pendiente al cierre.",
    texto: "Servicios asignados a tu perfil. El recorrido es pendiente, en curso, pendiente de historial y cerrado. Para empezar hace falta un técnico de este perfil.",
    lugares: ["administrativo", "tecnico"],
    secciones: [
      {
        titulo: "Del perfil",
        texto: "Cuando un cliente acepte una cotización, el servicio aparece aquí.",
      },
      {
        titulo: "Detalle del cliente",
        texto: "El técnico asignado y los administrativos lo ven solo con un servicio activo. Cada consulta queda auditada.",
      },
    ],
  },
  {
    to: "/proveedor/historial",
    etiqueta: "Historial",
    icono: LuHistory,
    resumen: "Servicios dados por tu perfil.",
    texto: "Registro de los servicios que tu perfil ya dio. No es el reporte de mediciones.",
    lugares: ["administrativo"],
    secciones: [
      {
        titulo: "Servicios dados",
        texto: "Al cerrar un servicio queda el registro de lo realizado.",
      },
    ],
  },
  {
    to: "/proveedor/equipo",
    etiqueta: "Equipo",
    icono: LuUsers,
    resumen: "Usuarios y categorías del perfil.",
    texto: "Usuarios administrativos y técnicos de tu perfil, y las categorías de servicio que atiendes.",
    lugares: ["administrativo"],
    accion: "Agregar usuario",
    secciones: [
      {
        titulo: "Usuarios",
        texto: "Cada usuario es administrativo o técnico.",
      },
      {
        titulo: "Categorías",
        texto: "El perfil declara al menos una categoría.",
      },
    ],
  },
  {
    to: "/proveedor/mapa",
    etiqueta: "Mapa",
    icono: LuMap,
    resumen: "Ubicación del perfil.",
    texto: "Ubicación de tu perfil. El mapa es OpenStreetMap.",
    lugares: ["administrativo"],
    secciones: [
      {
        titulo: "Ubicación",
        texto: "Calle, colonia, ciudad, estado y código postal del perfil.",
      },
    ],
  },
  {
    to: "/proveedor/reportes",
    etiqueta: "Reportes",
    icono: LuChartColumn,
    resumen: "Mediciones del perfil.",
    texto: "Mediciones de las acciones de tu perfil. No son el historial de servicios.",
    lugares: ["administrativo"],
    secciones: [
      {
        titulo: "Mediciones",
        texto: "Las genera el sistema al ocurrir la acción.",
      },
    ],
  },
  {
    to: "/proveedor/captura",
    etiqueta: "Captura",
    icono: LuMic,
    resumen: "Voz en campo con el dispositivo autorizado.",
    texto: "Captura de voz en campo. La hace el dispositivo ESP32 autorizado, conectado al sistema.",
    lugares: ["tecnico"],
    secciones: [
      {
        titulo: "En campo",
        texto: "Cuando haya un dispositivo autorizado para el servicio, la captura entra por aquí.",
      },
    ],
  },
];

const administrador: Herramienta[] = [
  {
    to: "/admin/clientes",
    etiqueta: "Clientes",
    icono: LuUserPlus,
    resumen: "Alta de un perfil cliente.",
    texto: "",
    lugares: ["administrador"],
    secciones: [],
    existente: true,
  },
  {
    to: "/admin/proveedores",
    etiqueta: "Proveedores",
    icono: LuBuilding2,
    resumen: "Alta de un perfil proveedor.",
    texto: "",
    lugares: ["administrador"],
    secciones: [],
    existente: true,
  },
  {
    to: "/admin/usuarios",
    etiqueta: "Usuarios",
    icono: LuUsers,
    resumen: "Consulta de cuentas.",
    texto: "Consulta de usuarios. El alta de clientes y proveedores sigue en sus propias herramientas.",
    lugares: ["administrador"],
    secciones: [
      {
        titulo: "Cuentas",
        texto: "Clientes, usuarios de proveedor y administradores de plataforma.",
      },
    ],
  },
  {
    to: "/admin/solicitudes",
    etiqueta: "Solicitudes",
    icono: LuClipboardList,
    resumen: "Consulta de solicitudes.",
    texto: "Consulta de solicitudes publicadas.",
    lugares: ["administrador"],
    secciones: [{ titulo: "Publicadas", texto: "Abiertas, asignadas, cerradas o canceladas." }],
  },
  {
    to: "/admin/cotizaciones",
    etiqueta: "Cotizaciones",
    icono: LuReceipt,
    resumen: "Consulta de cotizaciones.",
    texto: "Consulta de cotizaciones enviadas.",
    lugares: ["administrador"],
    secciones: [{ titulo: "Enviadas", texto: "Enviada, aceptada, rechazada o descartada." }],
  },
  {
    to: "/admin/servicios",
    etiqueta: "Servicios",
    icono: LuWrench,
    resumen: "Consulta de servicios.",
    texto: "Consulta de servicios, del pendiente al cierre o a la cancelación.",
    lugares: ["administrador"],
    secciones: [{ titulo: "En curso y cerrados", texto: "Ligados a la cotización que el cliente aceptó." }],
  },
  {
    to: "/admin/reportes",
    etiqueta: "Reportes",
    icono: LuChartColumn,
    resumen: "Mediciones de los perfiles.",
    texto: "Consulta de reportes. Miden acciones de un perfil. No son el historial de servicios.",
    lugares: ["administrador"],
    secciones: [{ titulo: "Mediciones", texto: "Perfil, acción, métrica, valor y fecha." }],
  },
  {
    to: "/admin/calificaciones",
    etiqueta: "Calificaciones",
    icono: LuStar,
    resumen: "Consulta de calificaciones.",
    texto: "Consulta de calificaciones. Cada lado califica de 1 a 5 al cerrar. Si no calificó, el valor queda en 4.5.",
    lugares: ["administrador"],
    secciones: [{ titulo: "Por servicio", texto: "Una de cada lado, ligadas al servicio." }],
  },
  {
    to: "/admin/sanciones",
    etiqueta: "Sanciones",
    icono: LuShieldAlert,
    resumen: "Advertencias, sanciones y bloqueos.",
    texto: "Advertencias y sanciones de un perfil. Cada marca se notifica y suma al mismo conteo. A la tercera se bloquean sus usuarios. Levantar el bloqueo no vuelve el conteo a cero. El historial de ese perfil se consulta solo al atender una advertencia, sanción, bloqueo o reclamación.",
    lugares: ["administrador"],
    accion: "Registrar marca",
    secciones: [
      {
        titulo: "Marcas",
        texto: "Advertencia o sanción. Una misma causa no suma más de una.",
      },
      {
        titulo: "Bloqueos",
        texto: "Perfiles con tres marcas distintas. El desbloqueo lo haces tú.",
      },
    ],
  },
  {
    to: "/admin/ingresos",
    etiqueta: "Ingresos",
    icono: LuWallet,
    resumen: "Comisión simulada de servicios cerrados.",
    texto: "Comisión simulada sobre el costo de la cotización de cada servicio cerrado, con la escala de 5 % a 9 %. No hay cobro ni pasarela. El inicio muestra los últimos 30 días.",
    lugares: ["administrador"],
    secciones: [
      {
        titulo: "Servicios cerrados",
        texto: "Solo un servicio cerrado suma comisión. Uno cancelado o todavía abierto no entra.",
      },
    ],
  },
  {
    to: "/admin/dispositivos",
    etiqueta: "Dispositivos",
    icono: LuCpu,
    resumen: "Dispositivos de campo autorizados.",
    texto: "Dispositivos ESP32 autorizados para la captura en campo. Qué más entra además de la voz sigue abierto.",
    lugares: ["administrador"],
    secciones: [
      {
        titulo: "Autorizados",
        texto: "Registrar, recibir datos, enviar comandos y consultar estado.",
      },
    ],
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
