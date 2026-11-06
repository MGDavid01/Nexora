export type TipoCuenta = "cliente" | "proveedor" | "administrador";
export type FuncionProveedor = "administrativo" | "tecnico";

export type Usuario = {
  id: string;
  nombre: string;
  correo: string;
  telefono: string;
  tipo_cuenta: TipoCuenta;
  funcion: FuncionProveedor | null;
  perfil_cliente_id: string | null;
  perfil_proveedor_id: string | null;
};

export type Ubicacion = {
  calle_numero: string;
  colonia: string;
  ciudad: string;
  estado: string;
  codigo_postal: string;
};

const TOKEN_KEY = "nexora_token";

export function leerToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function guardarToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function borrarToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const token = leerToken();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const respuesta = await fetch(path, { ...options, headers });
  if (!respuesta.ok) {
    throw new Error(await leerError(respuesta));
  }
  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

async function leerError(respuesta: Response): Promise<string> {
  try {
    const data = (await respuesta.json()) as { detail?: unknown };
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      const primero = data.detail[0] as { msg?: string };
      if (primero.msg) return primero.msg;
    }
  } catch {
    /* la respuesta no traía JSON */
  }
  return "No se pudo completar la solicitud";
}

export function login(correo: string, contrasena: string) {
  return api<{ access_token: string }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ correo, contrasena }),
  });
}

export function yo() {
  return api<Usuario>("/api/v1/auth/yo");
}

export function baja() {
  return api<void>("/api/v1/auth/baja", { method: "POST" });
}

export type KpisTableroAdmin = {
  solicitudes_abiertas: number;
  solicitudes_sin_cotizacion: number;
  solicitudes_rezagadas_24h: number;
  solicitudes_dirigidas_abiertas: number;
  solicitudes_con_cotizacion_por_elegir: number;

  participaciones_en_plazo: number;
  participaciones_por_vencer_6h: number;
  participaciones_vencidas_total: number;
  cotizaciones_enviadas_activas: number;

  servicios_activos: number;
  servicios_sin_tecnico: number;
  servicios_en_curso: number;
  servicios_pendiente_historial: number;
  servicios_cerrados: number;
  servicios_cancelados: number;

  perfiles_bloqueados: number;
  perfiles_en_riesgo: number;
  proveedores_reincidentes_vencimiento: number;
  marcas_totales: number;

  promedio_calificacion: number | null;
  calificaciones_totales: number;
  calificaciones_manuales: number;
  calificaciones_automaticas_45: number;
  calificaciones_bajas: number;

  clientes_activos: number;
  proveedores_activos: number;
  usuarios_administrativos: number;
  usuarios_tecnicos: number;
  dispositivos_esp32: number;
  cuentas_en_baja: number;
};

export type VigilanciaPerfilItem = {
  perfil_id: string;
  nombre: string;
  tipo_perfil: string;
  conteo_marcas: number;
  bloqueado: boolean;
  vencimientos_24h: number;
  ultima_causa: string | null;
  motivo_atencion: string;
};

export type SolicitudAbiertaItem = {
  id: string;
  titulo: string;
  cliente: string;
  categoria: string;
  es_dirigida: boolean;
  aceptadas_en_plazo: number;
  vencidas: number;
  cotizaciones_enviadas: number;
  horas_abierta: number;
  rezagada_24h: boolean;
  horas_restantes_plazo_min: number | null;
};

export type EstadoServicio =
  | "pendiente"
  | "en_curso"
  | "pendiente_historial"
  | "cerrado"
  | "cancelado";

export type ServicioActivoItem = {
  id: string;
  solicitud_titulo: string;
  proveedor: string;
  tecnico: string | null;
  estado: EstadoServicio;
  requisito_avance: string;
  creado_en: string | null;
};

export type CoberturaCategoriaItem = {
  id: string;
  nombre: string;
  proveedores_activos: number;
  solicitudes_abiertas: number;
  sin_cobertura: boolean;
};

export type PadronRecienteItem = {
  perfil_id: string;
  nombre: string;
  rol: string;
  subtipo: string;
  ubicacion: string;
  detalle: string;
  bloqueado: boolean;
  creado_en: string | null;
};

export type SerieComision = {
  total: number;
  base: number;
  cierres: number;
  serie: number[];
  etiquetas: string[];
};

export type CategoriaInicio = {
  nombre: string;
  solicitudes_abiertas: number;
  comision: SerieComision;
};

export type SerieAltas = {
  total: number;
  meta: string;
  serie: number[];
  etiquetas: string[];
};

export type MixAltas = {
  nombre: string;
  altas: number;
  crecimiento: SerieAltas;
};

export type InicioAdmin = {
  nuevas_24h: number;
  en_proceso: number;
  rechazadas_7d: number;
  porcentaje_con_cotizacion: number | null;
  categorias: CategoriaInicio[];
  comision: SerieComision;
  cotizaciones_total: number;
  cotizaciones_aceptadas: number;
  cotizaciones_rechazadas: number;
  promedio_cotizaciones: number;
  solicitudes_sobre_promedio: number;
  plazos_hasta_6h: number;
  plazos_6_a_12h: number;
  plazos_12_a_24h: number;
  plazos_vencidas: number;
  clientes: number;
  proveedores: number;
  altas_30d: number;
  en_baja: number;
  crecimiento: SerieAltas;
  mix: MixAltas[];
  bloqueados: number;
  en_riesgo: number;
  marcas_30d: number;
  reincidentes_24h: number;
  promedio_calificacion: number | null;
  sin_calificar: number;
  calificaciones_menores_2: number;
  calificaciones_mayores_45: number;
};

export type TableroAdminOut = {
  kpis: KpisTableroAdmin;
  vigilancia: VigilanciaPerfilItem[];
  solicitudes_atencion: SolicitudAbiertaItem[];
  servicios_activos: ServicioActivoItem[];
  cobertura_categorias: CoberturaCategoriaItem[];
  padron_reciente: PadronRecienteItem[];
  inicio: InicioAdmin;
};

export function obtenerTableroAdmin() {
  return api<TableroAdminOut>("/api/v1/admin/tablero");
}

export type TipoMarca = "advertencia" | "sancion";

export type CodigoMarca =
  | "cancelacion_reiterada_servicio"
  | "uso_indebido_reclamacion"
  | "alcance_distinto_solicitud"
  | "reiteracion_vencimiento_24h"
  | "servicio_sin_iniciar"
  | "informe_no_completado";

export const ETIQUETAS_MARCA: Record<CodigoMarca, string> = {
  reiteracion_vencimiento_24h: "Reiteración de vencimientos sin cotizar",
  servicio_sin_iniciar: "Servicio asignado sin iniciar",
  informe_no_completado: "Informe de servicio no completado",
  cancelacion_reiterada_servicio: "Cancelación reiterada de servicio",
  uso_indebido_reclamacion: "Uso indebido de reclamación",
  alcance_distinto_solicitud: "El trabajo pedido no corresponde a la solicitud",
};

export const CODIGOS_MARCA_CLIENTE: CodigoMarca[] = [
  "cancelacion_reiterada_servicio",
  "uso_indebido_reclamacion",
  "alcance_distinto_solicitud",
];

export const CODIGOS_MARCA_PROVEEDOR: CodigoMarca[] = [
  "reiteracion_vencimiento_24h",
  "servicio_sin_iniciar",
  "informe_no_completado",
  "cancelacion_reiterada_servicio",
  "uso_indebido_reclamacion",
];

export function codigosMarcaPara(tipo: TipoCuenta): CodigoMarca[] {
  if (tipo === "cliente") return CODIGOS_MARCA_CLIENTE;
  if (tipo === "proveedor") return CODIGOS_MARCA_PROVEEDOR;
  return [];
}

export type UsuarioLista = Usuario & {
  perfil_nombre: string;
  bloqueado: boolean;
  conteo_marcas: number;
  baja_solicitada: boolean;
};

export type Marca = {
  id: string;
  tipo: TipoMarca;
  codigo: string;
  etiqueta: string;
  descripcion: string;
  creada_en: string | null;
};

export type UsuarioDetalle = UsuarioLista & {
  marcas: Marca[];
};

export function listarUsuariosAdmin() {
  return api<UsuarioLista[]>("/api/v1/admin/usuarios");
}

export function obtenerUsuarioAdmin(id: string) {
  return api<UsuarioDetalle>(`/api/v1/admin/usuarios/${id}`);
}

export type EditarUsuarioAdminIn = {
  nombre: string;
  correo: string;
  telefono: string;
  funcion?: FuncionProveedor | null;
  contrasena?: string;
};

export function editarUsuarioAdmin(id: string, datos: EditarUsuarioAdminIn) {
  return api<UsuarioDetalle>(`/api/v1/admin/usuarios/${id}`, {
    method: "PATCH",
    body: JSON.stringify(datos),
  });
}

export function registrarAdministrador(datos: Record<string, unknown>) {
  return api<Usuario>("/api/v1/admin/administradores", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function registrarMarca(
  id: string,
  datos: { tipo: TipoMarca; codigo: string; descripcion: string },
) {
  return api<UsuarioDetalle>(`/api/v1/admin/usuarios/${id}/marcas`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export type EtapaTrabajo = "solicitud" | "cotizacion" | "servicio";
export type PerfilAfectadoMarca = "cliente" | "proveedor";

export const CODIGOS_MARCA_TRABAJOS_PROVEEDOR: CodigoMarca[] = CODIGOS_MARCA_PROVEEDOR.filter(
  (c) => c !== "reiteracion_vencimiento_24h",
);

export function codigosMarcaTrabajosPara(perfil: PerfilAfectadoMarca): CodigoMarca[] {
  if (perfil === "cliente") return CODIGOS_MARCA_CLIENTE;
  return CODIGOS_MARCA_TRABAJOS_PROVEEDOR;
}

export type TrabajoLista = {
  solicitud_id: string;
  titulo: string;
  cliente: string;
  categoria: string;
  etapa: EtapaTrabajo;
  estado_solicitud: string;
  cierre: "abierto" | "cerrado";
  estado_servicio: string | null;
  proveedor: string | null;
  reclamacion: "abierta" | "cerrada" | null;
  hay_marca: boolean;
  creado_en: string | null;
};

export type FiltrosTrabajosAdmin = {
  etapa?: EtapaTrabajo;
  reclamacion?: "abierta" | "cerrada";
  cierre?: "abierto" | "cerrado";
  marca?: "con" | "sin";
  q?: string;
};

export function listarTrabajosAdmin(filtros: FiltrosTrabajosAdmin = {}) {
  const params = new URLSearchParams();
  if (filtros.etapa) params.set("etapa", filtros.etapa);
  if (filtros.reclamacion) params.set("reclamacion", filtros.reclamacion);
  if (filtros.cierre) params.set("cierre", filtros.cierre);
  if (filtros.marca) params.set("marca", filtros.marca);
  const q = filtros.q?.trim();
  if (q) params.set("q", q);
  const qs = params.toString();
  return api<TrabajoLista[]>(`/api/v1/admin/trabajos${qs ? `?${qs}` : ""}`);
}

export type UbicacionTrabajo = Ubicacion & { id: string };

export type SolicitudTrabajo = {
  id: string;
  titulo: string;
  descripcion: string;
  estado: string;
  categoria: string;
  categoria_id: string;
  cliente: string;
  perfil_cliente_id: string;
  dirigida_a_perfil_proveedor_id: string | null;
  datos_cerrados: boolean;
  creado_en: string | null;
  ubicacion: UbicacionTrabajo | null;
};

export type ParticipacionTrabajo = {
  id: string;
  perfil_proveedor_id: string;
  proveedor: string;
  estado: string;
  aceptada_en: string | null;
};

export type CotizacionTrabajo = {
  id: string;
  perfil_proveedor_id: string;
  proveedor: string;
  descripcion: string;
  costo_mxn: string;
  condiciones: string;
  estado: string;
  creado_en: string | null;
};

export type InformeTrabajo = {
  id: string;
  tecnico_usuario_id: string;
  tecnico: string | null;
  descripcion: string;
  tipo: string;
  detalle_pieza: string | null;
  fecha: string;
};

export type CalificacionTrabajo = {
  id: string;
  lado: "cliente" | "proveedor";
  valor: string;
  comentario: string | null;
  es_automatica: boolean;
};

export type ServicioTrabajo = {
  id: string;
  perfil_proveedor_id: string;
  proveedor: string;
  tecnico_usuario_id: string | null;
  tecnico: string | null;
  estado: string;
  cotizacion_id: string;
  creado_en: string | null;
  informe: InformeTrabajo | null;
  calificaciones: CalificacionTrabajo[];
};

export type ReclamacionTrabajo = {
  id: string;
  servicio_id: string;
  reclamante_usuario_id: string;
  reclamante: string | null;
  categoria: string;
  categoria_etiqueta: string;
  motivo: string;
  estado: string;
  creada_en: string | null;
  cerrada_en: string | null;
};

export type MarcaCaso = {
  id: string;
  tipo: TipoMarca;
  codigo: CodigoMarca;
  etiqueta: string;
  descripcion: string;
  perfil_afectado: PerfilAfectadoMarca;
  servicio_id: string | null;
  reclamacion_id: string | null;
  creada_en: string | null;
};

export type HistorialServicioResumen = {
  servicio_id: string;
  solicitud_id: string;
  titulo: string;
  estado: string;
  creado_en: string | null;
};

export type HistorialAcotado = {
  cliente: HistorialServicioResumen[];
  proveedor: HistorialServicioResumen[];
};

export type ExpedienteTrabajo = {
  solicitud: SolicitudTrabajo;
  participaciones: ParticipacionTrabajo[];
  cotizaciones: CotizacionTrabajo[];
  servicio: ServicioTrabajo | null;
  reclamaciones: ReclamacionTrabajo[];
  marcas: MarcaCaso[];
  historial_perfiles: HistorialAcotado | null;
};

export function obtenerTrabajoAdmin(solicitudId: string) {
  return api<ExpedienteTrabajo>(`/api/v1/admin/trabajos/${solicitudId}`);
}

export type CerrarReclamacionTrabajoIn =
  | { desenlace: "sin_marca" }
  | {
      desenlace: "con_marca";
      tipo: TipoMarca;
      codigo: CodigoMarca;
      descripcion: string;
      perfil_afectado: PerfilAfectadoMarca;
    };

export function cerrarReclamacionAdmin(
  solicitudId: string,
  reclamacionId: string,
  datos: CerrarReclamacionTrabajoIn,
) {
  return api<ExpedienteTrabajo>(
    `/api/v1/admin/trabajos/${solicitudId}/reclamaciones/${reclamacionId}/cerrar`,
    { method: "POST", body: JSON.stringify(datos) },
  );
}

export type MarcaTrabajoIn = {
  tipo: TipoMarca;
  codigo: CodigoMarca;
  descripcion: string;
  perfil_afectado: PerfilAfectadoMarca;
};

export function registrarMarcaTrabajo(solicitudId: string, datos: MarcaTrabajoIn) {
  return api<ExpedienteTrabajo>(`/api/v1/admin/trabajos/${solicitudId}/marcas`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
}
