import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PencilIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import {
  desbloquearUsuarioAdmin,
  listarAuditoriaAdmin,
  listarTrabajosAdmin,
  listarUsuariosAdmin,
  obtenerUsuarioAdmin,
  procesarBajaPerfilAdmin,
  type AuditoriaLista,
  type TrabajoLista,
  type UsuarioDetalle,
  type UsuarioLista,
} from "../api";
import { useAdminTopbarContexto } from "../admin/AdminTopbar";
import {
  BloqueMarcas,
  FichaCuenta,
  agruparPerfiles,
  etiquetaTipoPerfil,
  formatearTelefono,
  perfilDeCuenta,
  rolDe,
  textoEstadoPerfil,
  type PerfilGrupo,
} from "./usuarios-ficha";
import { hueDeId, iniciales } from "./usuarios-tabla";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import "../usuarios-admin.css";
import "../usuarios-v2.css";

type TipoVista = "persona" | "negocio" | "empresa" | "administrador";
type PestaniaDetalle = "servicios" | "solicitudes" | "cotizaciones" | "reclamaciones" | "acciones";

const fechaCorta = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function rutaListadoUsuarios(cuenta: UsuarioLista | null): string {
  if (!cuenta) return "/admin/usuarios/clientes";
  if (cuenta.tipo_cuenta === "administrador") return "/admin/usuarios/administradores";
  if (cuenta.tipo_cuenta === "cliente") return "/admin/usuarios/clientes";
  return "/admin/usuarios/negocio";
}

function tipoVistaDe(cuenta: UsuarioLista): TipoVista {
  if (cuenta.tipo_cuenta === "administrador") return "administrador";
  if (cuenta.tipo_cuenta === "cliente") return "persona";
  if (cuenta.tipo_cuenta === "negocio") return "negocio";
  return "empresa";
}

function etiquetaVista(tipo: TipoVista) {
  if (tipo === "persona") return "Persona";
  if (tipo === "negocio") return "Negocio";
  if (tipo === "empresa") return "Empresa";
  return "Administrador";
}

function pestaniasDe(tipo: TipoVista): { id: PestaniaDetalle; etiqueta: string }[] {
  if (tipo === "administrador") return [{ id: "acciones", etiqueta: "Acciones" }];
  if (tipo === "persona") {
    return [
      { id: "solicitudes", etiqueta: "Solicitudes" },
      { id: "servicios", etiqueta: "Servicios" },
      { id: "reclamaciones", etiqueta: "Reclamaciones" },
    ];
  }
  return [
    { id: "servicios", etiqueta: "Servicios" },
    { id: "cotizaciones", etiqueta: "Cotizaciones" },
    { id: "reclamaciones", etiqueta: "Reclamaciones" },
  ];
}

function pestaniaPorDefecto(tipo: TipoVista): PestaniaDetalle {
  if (tipo === "administrador") return "acciones";
  if (tipo === "persona") return "solicitudes";
  return "servicios";
}

function trabajoDePerfil(trabajo: TrabajoLista, perfil: PerfilGrupo) {
  if (perfil.tipo === "cliente") return trabajo.perfil_cliente_id === perfil.id;
  if (perfil.tipo === "proveedor") return trabajo.perfil_proveedor_id === perfil.id;
  return false;
}

function pasaPestania(trabajo: TrabajoLista, pestania: PestaniaDetalle) {
  if (pestania === "servicios") return trabajo.etapa === "servicio";
  if (pestania === "solicitudes") return trabajo.etapa === "solicitud";
  if (pestania === "cotizaciones") return trabajo.etapa === "cotizacion";
  if (pestania === "reclamaciones") return trabajo.reclamacion !== null;
  return false;
}

function formatearFecha(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return fechaCorta.format(d);
}

function etiquetaEtapa(etapa: TrabajoLista["etapa"]) {
  if (etapa === "solicitud") return "Solicitud";
  if (etapa === "cotizacion") return "Cotización";
  return "Servicio";
}

function etiquetaEstadoServicio(estado: string | null, etapa: TrabajoLista["etapa"]) {
  if (!estado) return etiquetaEtapa(etapa);
  const mapa: Record<string, string> = {
    pendiente: "Pendiente",
    en_curso: "En curso",
    pendiente_informe: "Pendiente de informe",
    cerrado: "Cerrado",
    cancelado: "Cancelado",
  };
  return mapa[estado] ?? estado.replaceAll("_", " ");
}

function etiquetaAccion(accion: string) {
  const mapa: Record<string, string> = {
    alta_cuenta: "Alta de cuenta",
    edicion_cuenta: "Edición de cuenta",
    marca: "Registro de marca",
    desbloqueo: "Desbloqueo de perfil",
    baja_procesada: "Baja de perfil",
    consulta_historial: "Consulta de historial",
    operacion_dispositivo: "Operación de dispositivo",
    edicion_tarifas: "Edición de tarifas",
    conversion_solicitada: "Conversión pedida",
    conversion_autorizada: "Conversión autorizada",
    conversion_rechazada: "Conversión rechazada",
  };
  return mapa[accion] ?? accion.replaceAll("_", " ");
}

export function DetalleUsuarioAdmin() {
  const { usuarioId } = useParams<{ usuarioId: string }>();
  const navigate = useNavigate();
  const [cuentas, setCuentas] = useState<UsuarioLista[]>([]);
  const [detalle, setDetalle] = useState<UsuarioDetalle | null>(null);
  const [trabajos, setTrabajos] = useState<TrabajoLista[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaLista | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [editandoCuenta, setEditandoCuenta] = useState(false);
  const [pestania, setPestania] = useState<PestaniaDetalle>("servicios");

  const perfiles = useMemo(() => agruparPerfiles(cuentas), [cuentas]);
  const cuentaActiva = useMemo(
    () => cuentas.find((c) => c.id === usuarioId) ?? null,
    [cuentas, usuarioId],
  );
  const perfilActivo = useMemo(() => perfilDeCuenta(perfiles, cuentaActiva), [perfiles, cuentaActiva]);
  const tipoVista = cuentaActiva ? tipoVistaDe(cuentaActiva) : null;

  const cuentasDelPerfil = useMemo(() => {
    if (!perfilActivo) return [];
    return [...perfilActivo.usuarios].sort((a, b) => {
      if (a.id === usuarioId) return -1;
      if (b.id === usuarioId) return 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
  }, [perfilActivo, usuarioId]);

  const recargar = useCallback(async (id: string) => {
    const lista = await listarUsuariosAdmin();
    setCuentas(lista);
    if (lista.some((c) => c.id === id)) {
      setDetalle(await obtenerUsuarioAdmin(id));
    }
  }, []);

  useEffect(() => {
    setEditandoCuenta(false);
    setAviso("");
  }, [usuarioId]);

  useEffect(() => {
    if (!tipoVista) return;
    setPestania(pestaniaPorDefecto(tipoVista));
  }, [usuarioId, tipoVista]);

  useEffect(() => {
    if (!usuarioId) return;
    let vivo = true;
    setCargando(true);
    setError("");
    Promise.all([listarUsuariosAdmin(), obtenerUsuarioAdmin(usuarioId)])
      .then(([lista, d]) => {
        if (!vivo) return;
        setCuentas(lista);
        setDetalle(d);
      })
      .catch((causa) => {
        if (!vivo) return;
        setError(causa instanceof Error ? causa.message : "No se pudo cargar la ficha");
        setCuentas([]);
        setDetalle(null);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [usuarioId]);

  useEffect(() => {
    if (!perfilActivo || perfilActivo.tipo === "plataforma") {
      setTrabajos([]);
      return;
    }
    let vivo = true;
    listarTrabajosAdmin()
      .then((lista) => {
        if (vivo) setTrabajos(lista.filter((t) => trabajoDePerfil(t, perfilActivo)));
      })
      .catch(() => {
        if (vivo) setTrabajos([]);
      });
    return () => {
      vivo = false;
    };
  }, [perfilActivo]);

  useEffect(() => {
    if (!cuentaActiva || cuentaActiva.tipo_cuenta !== "administrador") {
      setAuditoria(null);
      return;
    }
    let vivo = true;
    listarAuditoriaAdmin()
      .then((lista) => {
        if (!vivo) return;
        const eventos = lista.eventos.filter(
          (ev) =>
            ev.actor_usuario_id === cuentaActiva.id ||
            (ev.entidad === "usuario" && ev.entidad_id === cuentaActiva.id),
        );
        setAuditoria({ total: eventos.length, eventos });
      })
      .catch(() => {
        if (vivo) setAuditoria({ total: 0, eventos: [] });
      });
    return () => {
      vivo = false;
    };
  }, [cuentaActiva]);

  async function onActualizado(siguiente: UsuarioDetalle) {
    setDetalle(siguiente);
    setCuentas((previas) =>
      previas.map((cuenta) => {
        if (cuenta.id === siguiente.id) {
          return {
            ...cuenta,
            nombre: siguiente.nombre,
            correo: siguiente.correo,
            telefono: siguiente.telefono,
            funcion: siguiente.funcion,
            bloqueado: siguiente.bloqueado,
            conteo_marcas: siguiente.conteo_marcas,
            baja_solicitada: siguiente.baja_solicitada,
          };
        }
        const mismoPerfilCliente =
          siguiente.perfil_cliente_id !== null && cuenta.perfil_cliente_id === siguiente.perfil_cliente_id;
        const mismoPerfilProveedor =
          siguiente.perfil_proveedor_id !== null && cuenta.perfil_proveedor_id === siguiente.perfil_proveedor_id;
        if (mismoPerfilCliente || mismoPerfilProveedor) {
          return { ...cuenta, bloqueado: siguiente.bloqueado, conteo_marcas: siguiente.conteo_marcas };
        }
        return cuenta;
      }),
    );
    try {
      await recargar(siguiente.id);
    } catch {
      /* el estado local ya refleja el cambio */
    }
  }

  const titulo = perfilActivo?.nombre ?? detalle?.nombre ?? (cargando ? "Cargando…" : "Ficha");
  const rutaListado = useMemo(() => rutaListadoUsuarios(cuentaActiva), [cuentaActiva]);

  const volver = useMemo(
    () => (
      <Link to={rutaListado} className="hub-volver">
        ← Usuarios
      </Link>
    ),
    [rutaListado],
  );
  useAdminTopbarContexto({ volver, titulo });

  const pestanias = tipoVista ? pestaniasDe(tipoVista) : [];
  const trabajosPestania = useMemo(
    () => trabajos.filter((t) => pasaPestania(t, pestania)),
    [trabajos, pestania],
  );

  if (!usuarioId) {
    return (
      <section className="hub-page vista-usuarios-v2 vista-usuario-detalle">
        <p className="error-crm">Identificador de cuenta no válido.</p>
      </section>
    );
  }

  return (
    <section className="hub-page vista-usuarios-v2 vista-usuario-detalle" aria-label="Ficha de cuenta">
      {error ? <p className="error-crm">{error}</p> : null}
      {aviso ? (
        <p className="aviso-crm" role="status">
          {aviso}
        </p>
      ) : null}

      {cargando && !detalle ? (
        <p className="vacio">Cargando ficha…</p>
      ) : !detalle || !perfilActivo || !cuentaActiva || !tipoVista ? (
        <div className="vacio">
          <p>No se encontró esa cuenta.</p>
          <Link to={rutaListado} className="btn-texto">
            Volver al directorio
          </Link>
        </div>
      ) : (
        <div className={cn("ficha-crm", tipoVista === "administrador" && "ficha-crm-sin-der")}>
          <aside className="ficha-crm-izq" aria-label="Datos de la ficha">
            {tipoVista === "empresa" ? (
              <CabeceraIdentidad
                titulo={perfilActivo.nombre}
                subtitulo={`${etiquetaTipoPerfil(perfilActivo.tipo)} · Empresa`}
                meta={`${perfilActivo.usuarios.length} ${perfilActivo.usuarios.length === 1 ? "cuenta" : "cuentas"}`}
                hue={hueDeId(perfilActivo.id)}
                iniciales={iniciales(perfilActivo.nombre)}
              />
            ) : (
              <CabeceraIdentidad
                titulo={detalle.nombre}
                subtitulo={
                  tipoVista === "administrador"
                    ? "Administrador de plataforma"
                    : `${etiquetaVista(tipoVista)} · ${rolDe(detalle, perfilActivo)}`
                }
                meta={detalle.correo}
                hue={hueDeId(detalle.id)}
                iniciales={iniciales(detalle.nombre)}
                acciones={
                  <BotonEditarCuenta
                    editando={editandoCuenta}
                    onAlternar={() => setEditandoCuenta((abierta) => !abierta)}
                  />
                }
              />
            )}

            <SeccionColapsable titulo={tipoVista === "empresa" ? "Sobre la empresa" : "Sobre este usuario"} abierta>
              {tipoVista === "empresa" ? (
                <dl className="props-crm">
                  <dt>Perfil</dt>
                  <dd>{etiquetaTipoPerfil(perfilActivo.tipo)}</dd>
                  <dt>Forma</dt>
                  <dd>Empresa</dd>
                  <dt>Estado</dt>
                  <dd>{textoEstadoPerfil(perfilActivo)}</dd>
                  <dt>Cuentas</dt>
                  <dd>{perfilActivo.usuarios.length}</dd>
                  <dt>Marcas</dt>
                  <dd>
                    {perfilActivo.conteo_marcas}
                    /3
                  </dd>
                </dl>
              ) : tipoVista === "administrador" && !editandoCuenta ? (
                <dl className="props-crm">
                  <dt>Nombre</dt>
                  <dd>{detalle.nombre}</dd>
                  <dt>Correo</dt>
                  <dd>{detalle.correo}</dd>
                  <dt>Teléfono</dt>
                  <dd>{formatearTelefono(detalle.telefono)}</dd>
                  <dt>Rol</dt>
                  <dd>Administrador</dd>
                </dl>
              ) : (
                <FichaCuenta
                  detalle={detalle}
                  perfil={perfilActivo}
                  onVolver={() => navigate(rutaListado)}
                  onActualizado={onActualizado}
                  compacto
                  editando={editandoCuenta}
                  onCerrarEdicion={() => setEditandoCuenta(false)}
                  ocultarMarcas
                  ocultarAccionesPerfil
                  ocultarCabecera
                />
              )}
            </SeccionColapsable>

            {tipoVista === "empresa" ? (
              <SeccionColapsable
                titulo={`Cuentas (${cuentasDelPerfil.length})`}
                abierta
                  extra={<span className="ficha-crm-seccion-nota">Elige una cuenta para ver y editar sus datos</span>}
              >
                <ul className="ficha-cuentas-asociadas">
                  {cuentasDelPerfil.map((cuenta) => {
                    const activa = cuenta.id === detalle.id;
                    return (
                      <li key={cuenta.id}>
                        <button
                          type="button"
                          className={cn("ficha-cuenta-asociada", activa && "es-activa")}
                          onClick={() => {
                            if (!activa) navigate(`/admin/usuarios/${cuenta.id}`);
                          }}
                        >
                          <span className="avatar" style={{ ["--h" as string]: hueDeId(cuenta.id) }}>
                            {iniciales(cuenta.nombre)}
                          </span>
                          <span className="ficha-cuenta-asociada-texto">
                            <span className="ficha-cuenta-asociada-nombre">
                              {cuenta.nombre}
                              {activa ? <span className="pastilla">Seleccionada</span> : null}
                            </span>
                            <span className="ficha-cuenta-asociada-meta">
                              {rolDe(cuenta, perfilActivo)} · {cuenta.correo}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="ficha-cuenta-seleccionada">
                  <div className="ficha-crm-seccion-cab ficha-cuenta-seleccionada-cab">
                    <h3>Cuenta seleccionada</h3>
                    <BotonEditarCuenta
                      editando={editandoCuenta}
                      onAlternar={() => setEditandoCuenta((abierta) => !abierta)}
                    />
                  </div>
                  <FichaCuenta
                    detalle={detalle}
                    perfil={perfilActivo}
                    onVolver={() => navigate(rutaListado)}
                    onActualizado={onActualizado}
                    compacto
                    editando={editandoCuenta}
                    onCerrarEdicion={() => setEditandoCuenta(false)}
                    ocultarMarcas
                    ocultarAccionesPerfil
                    ocultarCabecera
                  />
                </div>
              </SeccionColapsable>
            ) : null}
          </aside>

          <section className="ficha-crm-centro" aria-label="Actividad de la ficha">
            <div className="ficha-crm-pestanias" role="tablist">
              {pestanias.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={pestania === p.id}
                  className={cn("ficha-crm-pestania", pestania === p.id && "es-activa")}
                  onClick={() => setPestania(p.id)}
                >
                  {p.etiqueta}
                  {p.id !== "acciones" ? (
                    <span className="ficha-crm-pestania-n">
                      {trabajos.filter((t) => pasaPestania(t, p.id)).length}
                    </span>
                  ) : auditoria ? (
                    <span className="ficha-crm-pestania-n">{auditoria.total}</span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="ficha-crm-centro-cuerpo">
              {pestania === "acciones" ? (
                <TablaAccionesAdmin eventos={auditoria?.eventos ?? []} cargando={auditoria === null} />
              ) : (
                <TablaTrabajosFicha
                  pestania={pestania}
                  filas={trabajosPestania}
                  tipoVista={tipoVista}
                  onAbrir={(id) => navigate(`/admin/trabajos/${id}`)}
                />
              )}
            </div>
          </section>

          {tipoVista !== "administrador" ? (
            <aside className="ficha-crm-der" aria-label="Gestión de marcas">
              <PanelMarcas
                detalle={detalle}
                perfil={perfilActivo}
                onActualizado={onActualizado}
                onAviso={setAviso}
                onError={setError}
              />
            </aside>
          ) : null}
        </div>
      )}
    </section>
  );
}

function BotonEditarCuenta({ editando, onAlternar }: { editando: boolean; onAlternar: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={cn("btn-toolbar-icon btn-editar-cuenta", editando && "btn-editar-activo")}
          aria-pressed={editando}
          aria-label={editando ? "Cerrar edición" : "Editar cuenta"}
          onClick={onAlternar}
        >
          {editando ? <XIcon className="size-4" /> : <PencilIcon className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{editando ? "Cerrar edición" : "Editar cuenta"}</TooltipContent>
    </Tooltip>
  );
}

function CabeceraIdentidad({
  titulo,
  subtitulo,
  meta,
  hue,
  iniciales: letras,
  acciones,
}: {
  titulo: string;
  subtitulo: string;
  meta: string;
  hue: number;
  iniciales: string;
  acciones?: ReactNode;
}) {
  return (
    <header className="ficha-crm-identidad">
      <div className="ficha-crm-identidad-fila">
        <span className="avatar ficha-crm-avatar" style={{ ["--h" as string]: hue }}>
          {letras}
        </span>
        {acciones ? <div className="ficha-crm-identidad-acciones">{acciones}</div> : null}
      </div>
      <h2>{titulo}</h2>
      <p className="ficha-crm-identidad-sub">{subtitulo}</p>
      <p className="ficha-crm-identidad-meta">{meta}</p>
    </header>
  );
}

function SeccionColapsable({
  titulo,
  abierta = true,
  extra,
  children,
}: {
  titulo: string;
  abierta?: boolean;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(abierta);
  return (
    <section className="ficha-crm-seccion">
      <button type="button" className="ficha-crm-seccion-cab" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
        <span aria-hidden>{abierto ? "▾" : "▸"}</span>
        <span>{titulo}</span>
      </button>
      {abierto ? (
        <div className="ficha-crm-seccion-cuerpo">
          {extra}
          {children}
        </div>
      ) : null}
    </section>
  );
}

function TablaTrabajosFicha({
  pestania,
  filas,
  tipoVista,
  onAbrir,
}: {
  pestania: PestaniaDetalle;
  filas: TrabajoLista[];
  tipoVista: TipoVista;
  onAbrir: (id: string) => void;
}) {
  const vacio =
    pestania === "solicitudes"
      ? "No hay solicitudes en este perfil."
      : pestania === "cotizaciones"
        ? "No hay cotizaciones en este perfil."
        : pestania === "reclamaciones"
          ? "No hay reclamaciones en este perfil."
          : "No hay servicios en este perfil.";

  const muestraContraparte = tipoVista === "persona";

  return (
    <div className="ficha-crm-tabla-wrap">
      <table className="ficha-crm-tabla">
        <thead>
          <tr>
            <th scope="col">Caso</th>
            <th scope="col">{pestania === "reclamaciones" ? "Reclamación" : "Estado"}</th>
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr className="fila-vacia">
              <td colSpan={2}>
                <p className="vacio">{vacio}</p>
              </td>
            </tr>
          ) : (
            filas.map((fila) => {
              const contraparte = muestraContraparte ? fila.proveedor : fila.cliente;
              const meta = [contraparte, fila.categoria, formatearFecha(fila.creado_en)].filter(Boolean).join(" · ");
              return (
                <tr
                  key={fila.solicitud_id}
                  tabIndex={0}
                  onClick={() => onAbrir(fila.solicitud_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onAbrir(fila.solicitud_id);
                    }
                  }}
                >
                  <td>
                    <span className="ficha-crm-caso">{fila.titulo}</span>
                    <span className="ficha-crm-caso-meta">{meta}</span>
                  </td>
                  <td>
                    {pestania === "reclamaciones" ? (
                      <span className={cn("pastilla", fila.reclamacion === "abierta" && "pastilla-bloqueada")}>
                        {fila.reclamacion === "abierta" ? "Abierta" : "Cerrada"}
                      </span>
                    ) : (
                      <span className="pastilla">{etiquetaEstadoServicio(fila.estado_servicio, fila.etapa)}</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function TablaAccionesAdmin({
  eventos,
  cargando,
}: {
  eventos: AuditoriaLista["eventos"];
  cargando: boolean;
}) {
  return (
    <div className="ficha-crm-tabla-wrap">
      <table className="ficha-crm-tabla ficha-crm-tabla-estatica">
        <thead>
          <tr>
            <th scope="col">Acción</th>
            <th scope="col">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {cargando ? (
            <tr className="fila-vacia">
              <td colSpan={2}>
                <p className="vacio">Cargando historial…</p>
              </td>
            </tr>
          ) : eventos.length === 0 ? (
            <tr className="fila-vacia">
              <td colSpan={2}>
                <p className="vacio">Este administrador aún no tiene acciones registradas a su nombre.</p>
              </td>
            </tr>
          ) : (
            eventos.map((ev) => (
              <tr key={ev.id}>
                <td>
                  <span className="ficha-crm-caso">{etiquetaAccion(ev.accion)}</span>
                  <span className="ficha-crm-caso-meta">
                    {[ev.entidad, ev.detalle].filter(Boolean).join(" · ")}
                  </span>
                </td>
                <td>{formatearFecha(ev.creado_en)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function PanelMarcas({
  detalle,
  perfil,
  onActualizado,
  onAviso,
  onError,
}: {
  detalle: UsuarioDetalle;
  perfil: PerfilGrupo;
  onActualizado: (d: UsuarioDetalle) => Promise<void>;
  onAviso: (texto: string) => void;
  onError: (texto: string) => void;
}) {
  return (
    <>
      <SeccionColapsable titulo="Marcas del perfil" abierta>
        <BloqueMarcas detalle={detalle} onActualizado={onActualizado} compacto />
      </SeccionColapsable>
      {perfil.bloqueado ? (
        <SeccionColapsable titulo="Operaciones" abierta>
          <button
            type="button"
            className="btn-crm"
            onClick={() =>
              void desbloquearUsuarioAdmin(detalle.id)
                .then(onActualizado)
                .then(() => onAviso("Perfil desbloqueado."))
                .catch((causa) => onError(causa instanceof Error ? causa.message : "No se pudo desbloquear"))
            }
          >
            Desbloquear perfil
          </button>
        </SeccionColapsable>
      ) : null}
      {perfil.baja ? (
        <SeccionColapsable titulo="Baja" abierta>
          <button
            type="button"
            className="btn-crm btn-crm-principal"
            onClick={() => {
              if (!window.confirm("¿Procesar la baja de perfil?")) return;
              void procesarBajaPerfilAdmin(detalle.id)
                .then(onActualizado)
                .then(() => onAviso("Baja procesada."))
                .catch((causa) => onError(causa instanceof Error ? causa.message : "No se pudo procesar"));
            }}
          >
            Procesar baja de perfil
          </button>
        </SeccionColapsable>
      ) : null}
    </>
  );
}

