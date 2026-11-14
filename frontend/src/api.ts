export type TipoCuenta = "cliente" | "proveedor" | "empresa" | "negocio" | "administrador";
export type FuncionProveedor = "administrativo" | "tecnico" | "administrativo_campo";

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
  if (tipo === "proveedor" || tipo === "empresa" || tipo === "negocio") return CODIGOS_MARCA_PROVEEDOR;
  return [];
}

export function esProveedor(tipo: TipoCuenta): boolean {
  return tipo === "proveedor" || tipo === "empresa" || tipo === "negocio";
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

/* —— Flujo cliente / proveedor —— */

export type UbicacionSolicitud = Ubicacion & { id: string };

export type Solicitud = {
  id: string;
  titulo: string;
  descripcion: string;
  categoria_id: string;
  categoria: string;
  estado: string;
  datos_cerrados: boolean;
  creado_en: string | null;
  ubicacion: UbicacionSolicitud;
};

export type SolicitudCrearIn = {
  titulo: string;
  descripcion: string;
  categoria?: string;
  categoria_id?: string;
  dirigida_a_perfil_proveedor_id?: string | null;
  ubicacion: Ubicacion;
};

export type Participacion = {
  id: string;
  solicitud_id: string;
  perfil_proveedor_id: string;
  estado: string;
  aceptada_en: string | null;
};

export type Cotizacion = {
  id: string;
  solicitud_id: string;
  perfil_proveedor_id: string;
  participacion_id: string;
  descripcion: string;
  costo_mxn: string;
  condiciones: string;
  estado: string;
  creado_en: string | null;
};

export type CotizacionCrearIn = {
  descripcion: string;
  costo_mxn: string;
  condiciones: string;
};

export type ServicioFlujo = {
  id: string;
  solicitud_id: string;
  cotizacion_id: string;
  perfil_proveedor_id: string;
  tecnico_usuario_id: string | null;
  estado: string;
  creado_en: string | null;
};

export type HistorialItem = {
  servicio_id: string;
  solicitud_id: string;
  titulo: string;
  estado: string;
  perfil_proveedor_id: string;
  costo_mxn: string | null;
  creado_en: string | null;
  informe: {
    id: string;
    descripcion: string;
    tipo: string;
    detalle_pieza: string | null;
    fecha: string;
  } | null;
};

export type InformeIn = {
  descripcion: string;
  tipo: "mantenimiento" | "cambio_de_pieza" | "otro_servicio";
  detalle_pieza?: string | null;
  fecha?: string | null;
};

export type CalificacionIn = {
  valor: number;
  comentario?: string | null;
};

export const CATEGORIAS_RECLAMACION: { valor: string; etiqueta: string }[] = [
  { valor: "sin_iniciar", etiqueta: "El servicio no se inició" },
  { valor: "informe_pendiente", etiqueta: "Informe pendiente" },
  { valor: "estancado_en_curso", etiqueta: "Estancado en curso" },
  { valor: "alcance_distinto", etiqueta: "Alcance distinto" },
  { valor: "impedimento_ejecucion", etiqueta: "Impedimento de ejecución" },
  { valor: "cancelacion_servicio", etiqueta: "Cancelación del servicio" },
];

export function listarSolicitudes() {
  return api<Solicitud[]>("/api/v1/solicitudes");
}

export function publicarSolicitud(datos: SolicitudCrearIn) {
  return api<Solicitud>("/api/v1/solicitudes", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function cancelarSolicitud(solicitudId: string) {
  return api<Solicitud>(`/api/v1/solicitudes/${solicitudId}/cancelar`, { method: "POST" });
}

export function cotizacionesSolicitud(solicitudId: string) {
  return api<Cotizacion[]>(`/api/v1/solicitudes/${solicitudId}/cotizaciones`);
}

export function elegirCotizacion(cotizacionId: string) {
  return api<ServicioFlujo>(`/api/v1/cotizaciones/${cotizacionId}/elegir`, { method: "POST" });
}

export function rechazarCotizacion(cotizacionId: string) {
  return api<Cotizacion>(`/api/v1/cotizaciones/${cotizacionId}/rechazar`, { method: "POST" });
}

export function retirarParticipacion(participacionId: string) {
  return api<Participacion>(`/api/v1/participaciones/${participacionId}/retirar`, { method: "POST" });
}

export function mercadoProveedor() {
  return api<Solicitud[]>("/api/v1/proveedor/solicitudes");
}

export function aceptarSolicitudProveedor(solicitudId: string) {
  return api<Participacion>(`/api/v1/solicitudes/${solicitudId}/aceptar`, { method: "POST" });
}

export function denegarSolicitudProveedor(solicitudId: string) {
  return api<Participacion>(`/api/v1/solicitudes/${solicitudId}/denegar`, { method: "POST" });
}

export function cotizarSolicitud(solicitudId: string, datos: CotizacionCrearIn) {
  return api<Cotizacion>(`/api/v1/solicitudes/${solicitudId}/cotizar`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function historialPropio() {
  return api<HistorialItem[]>("/api/v1/historial");
}

export function obtenerServicio(servicioId: string) {
  return api<ServicioFlujo>(`/api/v1/servicios/${servicioId}`);
}

export function asignarTecnicoServicio(servicioId: string, tecnicoUsuarioId: string) {
  return api<ServicioFlujo>(`/api/v1/servicios/${servicioId}/tecnico`, {
    method: "POST",
    body: JSON.stringify({ tecnico_usuario_id: tecnicoUsuarioId }),
  });
}

export function iniciarServicio(servicioId: string) {
  return api<ServicioFlujo>(`/api/v1/servicios/${servicioId}/iniciar`, { method: "POST" });
}

export function terminarServicio(servicioId: string) {
  return api<ServicioFlujo>(`/api/v1/servicios/${servicioId}/terminar`, { method: "POST" });
}

export function cancelarServicio(servicioId: string) {
  return api<ServicioFlujo>(`/api/v1/servicios/${servicioId}/cancelar`, { method: "POST" });
}

export function registrarInforme(servicioId: string, datos: InformeIn) {
  return api<{ id: string }>(`/api/v1/servicios/${servicioId}/informe`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function calificarServicio(servicioId: string, datos: CalificacionIn) {
  return api<{ id: string }>(`/api/v1/servicios/${servicioId}/calificar`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function abrirReclamacionServicio(
  servicioId: string,
  datos: { categoria: string; motivo: string },
) {
  return api<unknown>(`/api/v1/servicios/${servicioId}/reclamaciones`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

/* —— Empresa / negocio —— */

export type EmpresaUsuario = {
  id: string;
  nombre: string;
  correo: string;
  telefono: string;
  tipo_cuenta: TipoCuenta;
  funcion: FuncionProveedor | null;
  primera: boolean;
  baja_procesada: boolean;
};

export type Conversion = {
  perfil_proveedor_id: string;
  desde: TipoCuenta;
  hacia: TipoCuenta;
  estado: "solicitada" | "autorizada" | "rechazada";
  extras: string[];
  detalle: string | null;
  pedido_en: string | null;
  actor_usuario_id: string | null;
};

export function listarUsuariosEmpresa() {
  return api<EmpresaUsuario[]>("/api/v1/empresa/usuarios");
}

export function altaUsuarioEmpresa(datos: {
  nombre: string;
  correo: string;
  contrasena: string;
  telefono: string;
  funcion: "administrativo" | "tecnico";
}) {
  return api<EmpresaUsuario>("/api/v1/empresa/usuarios", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function bajaUsuarioEmpresa(usuarioId: string, tecnicoReemplazoId?: string) {
  return api<EmpresaUsuario>(`/api/v1/empresa/usuarios/${usuarioId}/baja`, {
    method: "POST",
    body: JSON.stringify({ tecnico_reemplazo_id: tecnicoReemplazoId ?? null }),
  });
}

export type EquipoComputo = {
  id: string;
  perfil_cliente_id: string;
  nombre: string;
};

export function listarEquipos() {
  return api<EquipoComputo[]>("/api/v1/equipos");
}

export function altaEquipo(nombre: string) {
  return api<EquipoComputo>("/api/v1/equipos", {
    method: "POST",
    body: JSON.stringify({ nombre }),
  });
}

export function borrarEquipo(equipoId: string) {
  return api<void>(`/api/v1/equipos/${equipoId}`, { method: "DELETE" });
}

export function pedirConversion(hacia: "empresa" | "negocio") {
  return api<Conversion>("/api/v1/empresa/conversion", {
    method: "POST",
    body: JSON.stringify({ hacia }),
  });
}

/* —— Admin extendido —— */

export type Reporte = {
  id: string;
  perfil_cliente_id: string | null;
  perfil_proveedor_id: string | null;
  accion: string;
  metrica: string;
  valor: string;
  fecha: string;
};

export type IngresosAdmin = {
  comision_total_mxn: number;
  comision_base_mxn: number;
  cierres: number;
  comisiones: {
    servicio_id: string;
    costo_mxn: number;
    porcentaje: number;
    comision_mxn: number;
    cerrado_en: string | null;
  }[];
  alquiler: {
    total_mxn: number;
    dispositivos_asignados: number;
    detalle: string;
  };
};

export type Dispositivo = {
  id: string;
  identificador: string;
  nombre: string;
  perfil_cliente_id: string | null;
  perfil_proveedor_id: string | null;
  perfil_nombre: string | null;
  estatus: "pool" | "asignado_cliente" | "asignado_proveedor";
  tokens_consumidos: number;
  online: boolean;
  visto_en: string | null;
  clave_api?: string | null;
};

export type DispositivoEstatus = Dispositivo & {
  asignado: boolean;
  consultado_en: string;
  ultimo_dato: string | null;
};

export type AuditoriaLista = {
  total: number;
  eventos: {
    id: string;
    actor_usuario_id: string | null;
    accion: string;
    entidad: string;
    entidad_id: string | null;
    detalle: string | null;
    creado_en: string | null;
  }[];
};

export type MapaVista = {
  latitud: number | null;
  longitud: number | null;
  etiqueta: string;
  mapa_url: string;
  tesela_url: string;
  atribucion: string;
  estado: string;
  detalle: string;
};

export function registrarClienteAdmin(datos: Record<string, unknown>) {
  return api<Usuario>("/api/v1/admin/clientes", { method: "POST", body: JSON.stringify(datos) });
}

export function registrarEmpresaAdmin(datos: Record<string, unknown>) {
  return api<Usuario>("/api/v1/admin/empresas", { method: "POST", body: JSON.stringify(datos) });
}

export function registrarNegocioAdmin(datos: Record<string, unknown>) {
  return api<Usuario>("/api/v1/admin/negocios", { method: "POST", body: JSON.stringify(datos) });
}

export function listarReportesPerfil() {
  return api<Reporte[]>("/api/v1/reportes");
}

export function listarReportesAdmin(filtros?: { perfil_cliente_id?: string; perfil_proveedor_id?: string }) {
  const params = new URLSearchParams();
  if (filtros?.perfil_cliente_id) params.set("perfil_cliente_id", filtros.perfil_cliente_id);
  if (filtros?.perfil_proveedor_id) params.set("perfil_proveedor_id", filtros.perfil_proveedor_id);
  const qs = params.toString();
  return api<Reporte[]>(`/api/v1/admin/reportes${qs ? `?${qs}` : ""}`);
}

export function obtenerIngresosAdmin() {
  return api<IngresosAdmin>("/api/v1/admin/ingresos");
}

export function listarDispositivosAdmin() {
  return api<Dispositivo[]>("/api/v1/admin/dispositivos");
}

export function altaDispositivoAdmin(datos: { identificador: string; nombre: string }) {
  return api<Dispositivo>("/api/v1/admin/dispositivos", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function asignarDispositivoAdmin(
  dispositivoId: string,
  datos: { perfil_cliente_id?: string; perfil_proveedor_id?: string },
) {
  return api<Dispositivo>(`/api/v1/admin/dispositivos/${dispositivoId}/asignar`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function desasignarDispositivoAdmin(dispositivoId: string) {
  return api<Dispositivo>(`/api/v1/admin/dispositivos/${dispositivoId}/desasignar`, { method: "POST" });
}

export function estatusDispositivoAdmin(dispositivoId: string) {
  return api<DispositivoEstatus>(`/api/v1/admin/dispositivos/${dispositivoId}/estatus`);
}

export function listarAuditoriaAdmin(accion?: string) {
  const qs = accion ? `?accion=${encodeURIComponent(accion)}` : "";
  return api<AuditoriaLista>(`/api/v1/admin/auditoria${qs}`);
}

export function listarConversionesAdmin(pendientes = true) {
  return api<Conversion[]>(`/api/v1/admin/conversiones?pendientes=${pendientes ? "true" : "false"}`);
}

export function autorizarConversionAdmin(perfilId: string, extrasAEliminar: string[] = []) {
  return api<Conversion>(`/api/v1/admin/conversiones/${perfilId}/autorizar`, {
    method: "POST",
    body: JSON.stringify({ extras_a_eliminar: extrasAEliminar }),
  });
}

export function rechazarConversionAdmin(perfilId: string) {
  return api<Conversion>(`/api/v1/admin/conversiones/${perfilId}/rechazar`, { method: "POST" });
}

export function consultarMapaAdmin(ubicacion: Ubicacion) {
  const params = new URLSearchParams({
    calle_numero: ubicacion.calle_numero,
    colonia: ubicacion.colonia,
    ciudad: ubicacion.ciudad,
    estado: ubicacion.estado,
    codigo_postal: ubicacion.codigo_postal,
  });
  return api<MapaVista>(`/api/v1/admin/mapa?${params}`);
}

export function desbloquearUsuarioAdmin(id: string) {
  return api<UsuarioDetalle>(`/api/v1/admin/usuarios/${id}/desbloqueo`, { method: "POST" });
}

export function procesarBajaPerfilAdmin(id: string) {
  return api<UsuarioDetalle>(`/api/v1/admin/usuarios/${id}/baja`, { method: "POST" });
}

const ACTIVOS_SERVICIO = new Set(["pendiente", "en_curso", "pendiente_informe"]);

export function servicioEstaActivo(estado: string): boolean {
  return ACTIVOS_SERVICIO.has(estado);
}

export function servicioEstaCerrado(estado: string): boolean {
  const k = estado.toLowerCase();
  return k === "cerrado" || k === "cancelado";
}
