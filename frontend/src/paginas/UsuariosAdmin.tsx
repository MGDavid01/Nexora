import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  api,
  codigosMarcaPara,
  editarUsuarioAdmin,
  ETIQUETAS_MARCA,
  listarUsuariosAdmin,
  obtenerUsuarioAdmin,
  registrarAdministrador,
  registrarEmpresaAdmin,
  registrarMarca,
  registrarNegocioAdmin,
  desbloquearUsuarioAdmin,
  procesarBajaPerfilAdmin,
  type FuncionProveedor,
  type Marca,
  type TipoCuenta,
  type UsuarioDetalle,
  type UsuarioLista,
} from "../api";
import { digitos, texto, validarAlta, validarContrasenaOpcional } from "../validarAlta";
import { CamposCuenta, CamposUbicacion, ubicacionDe } from "./FormularioRegistro";
import { ConversionesAdmin } from "./admin/AdminExtension";
import "../usuarios-admin.css";
import "../usuarios-v2.css";

type TipoPerfil = "cliente" | "proveedor" | "plataforma";
type ModoAlta = "cliente" | "empresa" | "negocio" | "administrador";
type TabAcceso = "todas" | "operan" | "marca" | "bloqueadas" | "baja";
type LugarFiltro = "todos" | "cliente" | "proveedor" | "administrador";
type OrdenLista = "marcas" | "nombre" | "alta";

type PerfilGrupo = {
  id: string;
  nombre: string;
  tipo: TipoPerfil;
  forma: "persona" | "empresa";
  bloqueado: boolean;
  baja: boolean;
  conteo_marcas: number;
  usuarios: UsuarioLista[];
};

const ID_PLATAFORMA = "plataforma";

const PESTANIAS: { id: TabAcceso; etiqueta: string; badge?: boolean }[] = [
  { id: "todas", etiqueta: "Todas" },
  { id: "operan", etiqueta: "Operan" },
  { id: "marca", etiqueta: "A una marca", badge: true },
  { id: "bloqueadas", etiqueta: "Bloqueadas", badge: true },
  { id: "baja", etiqueta: "Baja pedida", badge: true },
];

export function UsuariosAdmin() {
  const [cuentas, setCuentas] = useState<UsuarioLista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [tabAcceso, setTabAcceso] = useState<TabAcceso>("todas");
  const [lugarFiltro, setLugarFiltro] = useState<LugarFiltro>("todos");
  const [orden, setOrden] = useState<OrdenLista>("marcas");
  const [controlesAbiertos, setControlesAbiertos] = useState(false);
  const [sello, setSello] = useState(() => formatearSello(new Date()));
  const [avisoLista, setAvisoLista] = useState("");

  const [perfilActivoId, setPerfilActivoId] = useState<string | null>(null);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [modoAlta, setModoAlta] = useState<ModoAlta | null>(null);
  const [detalle, setDetalle] = useState<UsuarioDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const perfiles = useMemo(() => agruparPerfiles(cuentas), [cuentas]);

  const perfilActivo = useMemo(
    () => perfiles.find((p) => p.id === perfilActivoId) ?? null,
    [perfiles, perfilActivoId],
  );

  const cuentasBase = useMemo(
    () => cuentas.filter((c) => pasaLugar(c, lugarFiltro) && pasaBusquedaCuenta(c, busqueda)),
    [cuentas, lugarFiltro, busqueda],
  );

  const cuentasVisibles = useMemo(
    () =>
      cuentasBase
        .filter((c) => pasaTabAcceso(c, tabAcceso))
        .sort((a, b) => compararCuentas(orden, a, b)),
    [cuentasBase, tabAcceso, orden],
  );

  const kpis = useMemo(() => calcularKpis(cuentas, perfiles), [cuentas, perfiles]);

  const cuentaActiva = useMemo(
    () => cuentas.find((c) => c.id === seleccionId) ?? null,
    [cuentas, seleccionId],
  );

  const recargar = useCallback(async (mantenerId?: string) => {
    const lista = await listarUsuariosAdmin();
    setCuentas(lista);
    const id = mantenerId ?? seleccionId ?? undefined;
    if (id && lista.some((c) => c.id === id)) {
      setDetalle(await obtenerUsuarioAdmin(id));
    }
  }, [seleccionId]);

  useEffect(() => {
    let vivo = true;
    listarUsuariosAdmin()
      .then((lista) => {
        if (vivo) setCuentas(lista);
      })
      .catch((causa) => {
        if (vivo) setErrorGlobal(causa instanceof Error ? causa.message : "No se pudieron cargar las cuentas");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (modoAlta) {
      setDetalle(null);
      return;
    }
    if (!seleccionId) {
      setDetalle(null);
      return;
    }
    let vivo = true;
    setCargandoDetalle(true);
    obtenerUsuarioAdmin(seleccionId)
      .then((d) => {
        if (vivo) setDetalle(d);
      })
      .catch((causa) => {
        if (vivo) setErrorGlobal(causa instanceof Error ? causa.message : "No se pudo cargar el detalle");
      })
      .finally(() => {
        if (vivo) setCargandoDetalle(false);
      });
    return () => {
      vivo = false;
    };
  }, [seleccionId, modoAlta]);

  useEffect(() => {
    if (cargando || modoAlta) return;
    if (cuentasVisibles.length === 0) {
      setSeleccionId(null);
      setPerfilActivoId(null);
      return;
    }
    const vigente = seleccionId && cuentasVisibles.some((c) => c.id === seleccionId);
    if (!vigente) {
      const id = cuentasVisibles[0].id;
      const cuenta = cuentas.find((c) => c.id === id);
      if (!cuenta) return;
      const perfil =
        perfiles.find((p) => p.usuarios.some((u) => u.id === id)) ??
        (cuenta.tipo_cuenta === "administrador" ? perfiles.find((p) => p.id === ID_PLATAFORMA) : null);
      setPerfilActivoId(perfil?.id ?? (cuenta.tipo_cuenta === "administrador" ? ID_PLATAFORMA : null));
      setSeleccionId(id);
    }
  }, [cargando, cuentasVisibles, modoAlta, seleccionId, cuentas, perfiles]);

  useEffect(() => {
    function escape(evento: KeyboardEvent) {
      if (evento.key === "Escape" && modoAlta) setModoAlta(null);
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [modoAlta]);

  function abrirCuenta(id: string) {
    setErrorGlobal("");
    const cuenta = cuentas.find((c) => c.id === id);
    if (!cuenta) return;
    const perfil =
      perfiles.find((p) => p.usuarios.some((u) => u.id === id)) ??
      (cuenta.tipo_cuenta === "administrador" ? perfiles.find((p) => p.id === ID_PLATAFORMA) : null);
    if (perfil) setPerfilActivoId(perfil.id);
    else if (cuenta.tipo_cuenta === "administrador") setPerfilActivoId(ID_PLATAFORMA);
    setSeleccionId(id);
  }

  function conteoTab(tab: TabAcceso) {
    return cuentasBase.filter((c) => pasaTabAcceso(c, tab)).length;
  }

  async function actualizarLista() {
    setAvisoLista("");
    try {
      await recargar(seleccionId ?? undefined);
      setSello(formatearSello(new Date()));
    } catch (causa) {
      setErrorGlobal(causa instanceof Error ? causa.message : "No se pudo actualizar");
    }
  }

  function restablecerFiltros() {
    setBusqueda("");
    setTabAcceso("todas");
    setLugarFiltro("todos");
    setAvisoLista("");
  }

  function alternarFiltroMarcas() {
    setTabAcceso((t) => (t === "marca" ? "todas" : "marca"));
  }

  async function onActualizadoDetalle(siguiente: UsuarioDetalle) {
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
          siguiente.perfil_cliente_id !== null &&
          cuenta.perfil_cliente_id === siguiente.perfil_cliente_id;
        const mismoPerfilProveedor =
          siguiente.perfil_proveedor_id !== null &&
          cuenta.perfil_proveedor_id === siguiente.perfil_proveedor_id;
        if (mismoPerfilCliente || mismoPerfilProveedor) {
          return { ...cuenta, bloqueado: siguiente.bloqueado, conteo_marcas: siguiente.conteo_marcas };
        }
        return cuenta;
      }),
    );
  }

  return (
    <section className="vista-usuarios-v2" aria-labelledby="titulo-usuarios">
      <div className="titulo-fila">
        <div>
          <h1 id="titulo-usuarios">Usuarios</h1>
          <p className="subtitulo-pagina">{kpis.subtitulo}</p>
        </div>
        <div className="acciones-titulo">
          <button type="button" className="btn btn-alto" onClick={() => setModoAlta("administrador")}>
            Administrador
          </button>
          <button type="button" className="btn btn-alto" onClick={() => setModoAlta("empresa")}>
            Empresa
          </button>
          <button type="button" className="btn btn-alto" onClick={() => setModoAlta("negocio")}>
            Negocio
          </button>
          <button type="button" className="btn btn-primario btn-alto" onClick={() => setModoAlta("cliente")}>
            Registrar cliente
          </button>
        </div>
      </div>

      <ConversionesAdmin />

      {errorGlobal ? <p className="error-crm">{errorGlobal}</p> : null}

      <section className="kpis" aria-label="Resumen de cuentas">
        <div className="kpi kpi-principal">
          <p className="kpi-etiqueta">Cuentas registradas</p>
          <p className="kpi-valor num">
            <span>{kpis.total}</span>
            <span className="kpi-unidad">cuentas</span>
          </p>
          <p className="kpi-nota">{kpis.notaTotal}</p>
        </div>
        <div className="kpi">
          <p className="kpi-etiqueta">Pueden entrar</p>
          <p className="kpi-valor num">
            <span>{kpis.operan}</span>
            <span className="kpi-unidad">activas</span>
          </p>
          <p className="kpi-nota">{kpis.notaOperan}</p>
        </div>
        <div className="kpi">
          <p className="kpi-etiqueta">A una marca del bloqueo</p>
          <p className="kpi-valor num">
            <span>{kpis.riesgoCuentas}</span>
            <span className="kpi-unidad">cuentas</span>
          </p>
          <p className="kpi-nota">{kpis.notaRiesgo}</p>
        </div>
        <div className="kpi">
          <p className="kpi-etiqueta">Sin acceso activo</p>
          <p className="kpi-valor num">
            <span>{kpis.inactivas}</span>
            <span className="kpi-unidad">cuentas</span>
          </p>
          <p className="kpi-nota">{kpis.notaInactivas}</p>
        </div>
      </section>

      <div className="mesa">
        <section className="columna-lista" aria-label="Directorio de cuentas">
          {cuentaActiva && perfilActivo ? (
            <div className="resumen-movil-perfil" id="resumen-movil">
              <span>
                Ficha activa: {perfilActivo.nombre} ({perfilActivo.tipo === "plataforma" ? "plataforma" : `${perfilActivo.conteo_marcas} /3 marcas`})
              </span>
              <a className="btn-texto" href="#bloque-ficha">
                Ver ficha
              </a>
            </div>
          ) : null}

          <div className="pestanias" role="tablist" aria-label="Estado de acceso">
            {PESTANIAS.map((p) => {
              const n = conteoTab(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="pestania"
                  role="tab"
                  aria-selected={tabAcceso === p.id}
                  onClick={() => setTabAcceso(p.id)}
                >
                  {p.etiqueta}
                  {p.badge && n > 0 ? <span className="cuenta-tab num">{n}</span> : null}
                </button>
              );
            })}
          </div>

          <div className="herramientas">
            <div className="herramientas-izq">
              <label className="buscar">
                <span className="sr">Buscar cuentas</span>
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="6" />
                  <path d="m16 16 4 4" />
                </svg>
                <input
                  type="search"
                  placeholder="Buscar cuenta, correo o perfil"
                  autoComplete="off"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn-filtros"
                aria-expanded={controlesAbiertos}
                aria-controls="controles-usuarios"
                onClick={() => setControlesAbiertos((v) => !v)}
              >
                Filtros
              </button>
            </div>

            <div
              className={controlesAbiertos ? "herramientas-controles abiertas" : "herramientas-controles"}
              id="controles-usuarios"
            >
              <p className="conteo num">{cuentasVisibles.length === 1 ? "1 cuenta" : `${cuentasVisibles.length} cuentas`}</p>
              <label className="filtro">
                Lugar
                <select value={lugarFiltro} onChange={(e) => setLugarFiltro(e.target.value as LugarFiltro)}>
                  <option value="todos">Todos</option>
                  <option value="cliente">Clientes</option>
                  <option value="proveedor">Proveedores</option>
                  <option value="administrador">Administradores</option>
                </select>
              </label>
              <label className="filtro">
                Orden
                <select value={orden} onChange={(e) => setOrden(e.target.value as OrdenLista)}>
                  <option value="marcas">Más marcas primero</option>
                  <option value="nombre">Nombre</option>
                  <option value="alta">Alta más reciente</option>
                </select>
              </label>
              <button type="button" className="btn" onClick={() => void actualizarLista()}>
                Actualizar
              </button>
              <p className="sello">{sello}</p>
            </div>
          </div>

          {avisoLista ? (
            <p className="estado-alta" role="status">
              {avisoLista}
            </p>
          ) : null}

          {cargando ? (
            <p className="vacio">Cargando padrón…</p>
          ) : cuentasVisibles.length === 0 ? (
            <div className="vacio">
              <p>
                {busqueda.trim()
                  ? `Ninguna cuenta coincide con «${busqueda.trim()}».`
                  : "Ninguna cuenta está en este filtro."}
              </p>
              <button type="button" className="btn-texto" onClick={restablecerFiltros}>
                Restablecer filtros
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Cuenta</th>
                  <th scope="col">Lugar</th>
                  <th scope="col">Perfil</th>
                  <th className="marcas-col">Marcas</th>
                  <th className="num">Alta</th>
                </tr>
              </thead>
              <tbody>
                {cuentasVisibles.map((cuenta) => {
                  const seleccionada = cuenta.id === seleccionId;
                  const perfil = perfiles.find((p) => p.usuarios.some((u) => u.id === cuenta.id));
                  return (
                    <tr
                      key={cuenta.id}
                      aria-selected={seleccionada}
                      tabIndex={0}
                      onClick={() => abrirCuenta(cuenta.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          abrirCuenta(cuenta.id);
                        }
                      }}
                    >
                      <td className="cuenta-col">
                        <div className="cuenta">
                          <span className="avatar" style={{ ["--h" as string]: hueDeId(cuenta.id) }}>
                            {iniciales(cuenta.nombre)}
                          </span>
                          <span className="cuenta-texto">
                            <span className="cuenta-nombre">
                              {cuenta.nombre}
                              <PastillaEstadoCuenta cuenta={cuenta} />
                            </span>
                            <span className="cuenta-meta">{cuenta.correo}</span>
                          </span>
                        </div>
                      </td>
                      <td className="lugar-col">{lugarCuenta(cuenta)}</td>
                      <td className="perfil-col">
                        {cuenta.tipo_cuenta === "administrador" ? (
                          <span className="ausente">—</span>
                        ) : (
                          <>
                            <span className="perfil-celda-nombre">{nombrePerfilDeCuenta(cuenta)}</span>
                            {perfil ? (
                              <span className="perfil-meta">
                                {perfil.forma === "empresa" ? "Empresa" : perfil.tipo === "cliente" ? "Un usuario" : "Proveedor"}
                              </span>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td className="marcas-col">
                        <MarcasCelda cuenta={cuenta} />
                      </td>
                      <td className="alta-col num">
                        <span className="ausente" title="La API aún no expone fecha de alta en el listado">
                          —
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <aside className="riel" aria-label="Inspección de perfil y marcas">
          <section className="riel-bloque" id="bloque-ficha">
            <h2 className="riel-titulo">Ficha del perfil seleccionado</h2>
            <div className="panel">
              <RielFichaPerfil
                perfil={perfilActivo}
                cuentaActiva={cuentaActiva}
                seleccionId={seleccionId}
                onSeleccionar={abrirCuenta}
                onAltaMiembroPlaceholder={() =>
                  setAvisoLista("Sumar cuentas a un proveedor existente: la API aún no expone este alta; queda pendiente.")
                }
              />
            </div>
          </section>

          <section className="riel-bloque">
            <h2 className="riel-titulo">Perfiles según marcas</h2>
            <div className="panel">
              <ListaPerfilesMarcas
                perfiles={perfiles}
                perfilActivoId={perfilActivoId}
                onSeleccionar={(id) => abrirCuenta(id)}
              />
              <button type="button" className="btn btn-bloque" onClick={alternarFiltroMarcas}>
                {tabAcceso === "marca"
                  ? `Ver las ${kpis.total} cuentas registradas`
                  : `Filtrar las ${kpis.riesgoCuentas} cuentas a una marca`}
              </button>
            </div>
          </section>

          {seleccionId && perfilActivo && !modoAlta ? (
            <section className="riel-bloque panel-edicion-cuenta" aria-label="Edición de cuenta y marcas">
              <h2 className="riel-titulo">Cuenta seleccionada</h2>
              <div className="panel">
                {cargandoDetalle || !detalle ? (
                  <p className="crm-meta">Cargando cuenta…</p>
                ) : (
                  <FichaCuenta
                    detalle={detalle}
                    perfil={perfilActivo}
                    onVolver={() => undefined}
                    onActualizado={onActualizadoDetalle}
                    compacto
                  />
                )}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <ModalCapa
        abierto={modoAlta === "cliente"}
        titulo="Alta de cliente"
        meta="La persona o la empresa no se registran por su cuenta. El perfil cliente queda con un solo usuario."
        onCerrar={() => setModoAlta(null)}
      >
        <AltaClienteForm
          onCreado={async (id) => {
            await recargar(id);
            setModoAlta(null);
            setAvisoLista("Cliente registrado correctamente.");
            abrirCuenta(id);
          }}
        />
      </ModalCapa>

      <ModalCapa
        abierto={modoAlta === "empresa" || modoAlta === "negocio"}
        titulo={modoAlta === "negocio" ? "Alta de negocio" : "Alta de empresa"}
        meta={
          modoAlta === "negocio"
            ? "Un solo usuario administrativo de campo. Sin cuentas extra."
            : "Primera cuenta administrativa; después sumas técnicos o administrativos."
        }
        onCerrar={() => setModoAlta(null)}
      >
        <AltaProveedorForm
          tipoCuenta={modoAlta === "negocio" ? "negocio" : "empresa"}
          onCreado={async (id) => {
            await recargar(id);
            setModoAlta(null);
            setAvisoLista(modoAlta === "negocio" ? "Negocio registrado." : "Empresa registrada.");
            abrirCuenta(id);
          }}
        />
      </ModalCapa>

      <ModalCapa
        abierto={modoAlta === "administrador"}
        titulo="Alta de administrador"
        meta="Cuenta de plataforma, sin perfil cliente ni proveedor."
        onCerrar={() => setModoAlta(null)}
      >
        <AltaAdministradorForm
          onCreado={async (id) => {
            await recargar(id);
            setModoAlta(null);
            setAvisoLista("Administrador registrado correctamente.");
            abrirCuenta(id);
          }}
        />
      </ModalCapa>
    </section>
  );
}


function ModalCapa({
  abierto,
  titulo,
  meta,
  onCerrar,
  children,
}: {
  abierto: boolean;
  titulo: string;
  meta?: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  if (!abierto) return null;
  return (
    <div
      className="capa"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        className="dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-usuarios"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="titulo-modal-usuarios">{titulo}</h2>
        {meta ? <p>{meta}</p> : null}
        {children}
      </div>
    </div>
  );
}

function AltaClienteForm({
  onCreado,
}: {
  onCreado?: (id: string) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const formulario = new FormData(evento.currentTarget);
      const datos = {
        nombre: texto(formulario.get("nombre")),
        correo: texto(formulario.get("correo")).toLowerCase(),
        contrasena: String(formulario.get("contrasena") ?? ""),
        telefono: digitos(formulario.get("telefono")),
        tipo: formulario.get("tipo"),
        nombre_comercial: texto(formulario.get("nombre_comercial")) || null,
        ubicacion: ubicacionDe(formulario),
      };
      const fallo = validarAlta(datos, "cliente");
      if (fallo) throw new Error(fallo);
      const creado = await api<{ id: string }>("/api/v1/admin/clientes", {
        method: "POST",
        body: JSON.stringify(datos),
      });
      await onCreado?.(creado.id);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo registrar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AltaCamposForm onSubmit={onSubmit} error={error} enviando={enviando} conUbicacion>
      <label className="campo-crm">
        Tipo
        <select name="tipo" defaultValue="persona">
          <option value="persona">Persona</option>
          <option value="empresa">Empresa</option>
        </select>
      </label>
      <label className="campo-crm">
        Nombre comercial
        <input name="nombre_comercial" autoComplete="off" />
        <span className="crm-meta">Obligatorio si no es persona.</span>
      </label>
    </AltaCamposForm>
  );
}

function AltaProveedorForm({
  onCreado,
  tipoCuenta = "empresa",
}: {
  onCreado?: (id: string) => Promise<void>;
  tipoCuenta?: "empresa" | "negocio";
}) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const formulario = new FormData(evento.currentTarget);
      const datos = {
        nombre: texto(formulario.get("nombre")),
        correo: texto(formulario.get("correo")).toLowerCase(),
        contrasena: String(formulario.get("contrasena") ?? ""),
        telefono: digitos(formulario.get("telefono")),
        tipo: formulario.get("tipo"),
        nombre_comercial: texto(formulario.get("nombre_comercial")),
        descripcion: texto(formulario.get("descripcion")),
        categorias: String(formulario.get("categorias") ?? "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        ubicacion: ubicacionDe(formulario),
      };
      const fallo = validarAlta(datos, "proveedor");
      if (fallo) throw new Error(fallo);
      const payload = { ...datos, tipo_cuenta: tipoCuenta };
      const creado =
        tipoCuenta === "negocio"
          ? await registrarNegocioAdmin(payload)
          : await registrarEmpresaAdmin(payload);
      await onCreado?.(creado.id);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo registrar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AltaCamposForm onSubmit={onSubmit} error={error} enviando={enviando} conUbicacion>
      <label className="campo-crm">
        Tipo
        <select name="tipo" defaultValue="empresa">
          <option value="persona">Persona</option>
          <option value="empresa">Empresa</option>
        </select>
      </label>
      <label className="campo-crm">
        Nombre comercial o razón social
        <input name="nombre_comercial" required autoComplete="off" />
      </label>
      <label className="campo-crm">
        Descripción de servicios
        <textarea name="descripcion" required rows={3} />
      </label>
      <label className="campo-crm">
        Categorías
        <input name="categorias" required placeholder="Redes, mantenimiento" autoComplete="off" />
        <span className="crm-meta">Separa con comas. Hace falta al menos una.</span>
      </label>
    </AltaCamposForm>
  );
}

function AltaAdministradorForm({ onCreado }: { onCreado?: (id: string) => Promise<void> }) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const formulario = new FormData(evento.currentTarget);
      const datos = {
        nombre: texto(formulario.get("nombre")),
        correo: texto(formulario.get("correo")).toLowerCase(),
        contrasena: String(formulario.get("contrasena") ?? ""),
        telefono: digitos(formulario.get("telefono")),
      };
      if (!datos.nombre) throw new Error("El nombre es obligatorio");
      if (!datos.correo.includes("@")) throw new Error("El correo no es válido");
      if (datos.contrasena.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
      if (datos.telefono.length !== 10) throw new Error("El teléfono debe tener 10 dígitos");
      const creado = await registrarAdministrador(datos);
      await onCreado?.(creado.id);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo registrar");
    } finally {
      setEnviando(false);
    }
  }

  return <AltaCamposForm onSubmit={onSubmit} error={error} enviando={enviando} conUbicacion={false} />;
}

function AltaCamposForm({
  children,
  onSubmit,
  error,
  enviando,
  conUbicacion,
}: {
  children?: ReactNode;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  error: string;
  enviando: boolean;
  conUbicacion: boolean;
}) {
  return (
    <form className="formulario" autoComplete="off" onSubmit={(e) => void onSubmit(e)}>
      {children}
      <CamposCuenta classNameCampo="campo-crm campo campo-ancho" />
      {conUbicacion ? <CamposUbicacion classNameCampo="campo-crm campo" /> : null}
      {error ? <p className="alerta">{error}</p> : null}
      <div className="dialogo-acciones">
        <button type="submit" className="btn btn-primario" disabled={enviando}>
          {enviando ? "Registrando…" : "Registrar"}
        </button>
      </div>
    </form>
  );
}

function FichaCuenta({
  detalle,
  perfil,
  onVolver,
  onActualizado,
  compacto = false,
}: {
  detalle: UsuarioDetalle;
  perfil: PerfilGrupo;
  onVolver: () => void;
  onActualizado: (d: UsuarioDetalle) => Promise<void>;
  compacto?: boolean;
}) {
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const est = estadoPerfil(perfil);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError("");
    setAviso("");
    const formulario = new FormData(evento.currentTarget);
    const funcion = texto(formulario.get("funcion")) as FuncionProveedor | "";
    const contrasena = String(formulario.get("contrasena") ?? "");
    const falloContrasena = validarContrasenaOpcional(contrasena);
    if (falloContrasena) {
      setError(falloContrasena);
      return;
    }
    setEnviando(true);
    try {
      const payload: Parameters<typeof editarUsuarioAdmin>[1] = {
        nombre: texto(formulario.get("nombre")),
        correo: texto(formulario.get("correo")).toLowerCase(),
        telefono: digitos(formulario.get("telefono")),
      };
      if (detalle.tipo_cuenta === "proveedor" || detalle.tipo_cuenta === "empresa") {
        payload.funcion = funcion as FuncionProveedor;
      }
      if (contrasena) payload.contrasena = contrasena;
      const siguiente = await editarUsuarioAdmin(detalle.id, payload);
      setAviso("Cuenta actualizada.");
      await onActualizado(siguiente);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo guardar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {compacto ? (
        <p className="crm-meta">
          {rolDe(detalle, perfil)} · {perfil.nombre} ·{" "}
          <span className={`pastilla pastilla-${est.cls === "critico" ? "bloqueada" : est.cls === "alerta" ? "baja" : "positiva"}`}>
            {est.txt}
          </span>
        </p>
      ) : (
        <header className="ficha-top">
          <div>
            <h2>{detalle.nombre}</h2>
            <p className="crm-meta">
              {rolDe(detalle, perfil)} · {perfil.nombre} ·{" "}
              <span className={`pill-estado ${est.cls}`}>{est.txt}</span>
            </p>
          </div>
          <button type="button" className="volver-crm" onClick={onVolver}>
            {perfil.forma === "empresa" ? "← Volver a la empresa" : "← Volver al padrón"}
          </button>
        </header>
      )}
      <dl className="props-crm">
        <dt>Correo</dt>
        <dd>{detalle.correo}</dd>
        <dt>Teléfono</dt>
        <dd>{detalle.telefono}</dd>
        <dt>Función</dt>
        <dd>{detalle.funcion ?? "—"}</dd>
        <dt>Marcas</dt>
        <dd>{detalle.tipo_cuenta === "administrador" ? "—" : `${detalle.conteo_marcas}/3`}</dd>
      </dl>
      <BloqueMarcas detalle={detalle} onActualizado={onActualizado} />
      {perfil.bloqueado ? (
        <p className="padron-acciones-form">
          <button
            type="button"
            className="btn-crm"
            onClick={() =>
              void desbloquearUsuarioAdmin(detalle.id)
                .then(onActualizado)
                .then(() => setAviso("Perfil desbloqueado."))
                .catch((causa) => setError(causa instanceof Error ? causa.message : "No se pudo desbloquear"))
            }
          >
            Desbloquear perfil
          </button>
        </p>
      ) : null}
      {perfil.baja ? (
        <p className="padron-acciones-form">
          <button
            type="button"
            className="btn-crm btn-crm-principal"
            onClick={() => {
              if (!window.confirm("¿Procesar la baja de perfil?")) return;
              void procesarBajaPerfilAdmin(detalle.id)
                .then(onActualizado)
                .then(() => setAviso("Baja procesada."))
                .catch((causa) => setError(causa instanceof Error ? causa.message : "No se pudo procesar"));
            }}
          >
            Procesar baja de perfil
          </button>
        </p>
      ) : null}
      <form onSubmit={(e) => void guardar(e)}>
        <label className="campo-crm">
          Nombre
          <input name="nombre" required defaultValue={detalle.nombre} autoComplete="off" key={`${detalle.id}-n`} />
        </label>
        <label className="campo-crm">
          Correo
          <input
            name="correo"
            type="email"
            required
            defaultValue={detalle.correo}
            autoComplete="off"
            key={`${detalle.id}-c`}
          />
        </label>
        <label className="campo-crm">
          Teléfono
          <input
            name="telefono"
            required
            inputMode="numeric"
            defaultValue={detalle.telefono}
            autoComplete="off"
            key={`${detalle.id}-t`}
          />
        </label>
        {detalle.tipo_cuenta === "proveedor" || detalle.tipo_cuenta === "empresa" ? (
          <label className="campo-crm">
            Función
            <select name="funcion" defaultValue={detalle.funcion ?? "administrativo"} key={`${detalle.id}-f`}>
              <option value="administrativo">Administrativo</option>
              <option value="tecnico">Técnico</option>
            </select>
          </label>
        ) : null}
        <label className="campo-crm">
          Contraseña nueva
          <input
            name="contrasena"
            type="password"
            autoComplete="new-password"
            placeholder="Dejar en blanco para no cambiar"
            key={`${detalle.id}-p`}
          />
        </label>
        <button type="submit" className="btn-crm btn-crm-principal" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar cuenta"}
        </button>
      </form>
      {error ? <p className="error-crm">{error}</p> : null}
      {aviso ? <p className="aviso-crm">{aviso}</p> : null}
    </>
  );
}

function BloqueMarcas({
  detalle,
  onActualizado,
}: {
  detalle: UsuarioDetalle;
  onActualizado: (d: UsuarioDetalle) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const codigosMarca = codigosMarcaPara(detalle.tipo_cuenta);

  if (detalle.tipo_cuenta === "administrador") {
    return <p className="crm-meta">Un administrador de plataforma no acumula marcas.</p>;
  }

  async function marcar(formulario: HTMLFormElement) {
    setError("");
    setAviso("");
    const form = new FormData(formulario);
    const datos = {
      tipo: texto(form.get("tipo")) as "advertencia" | "sancion",
      codigo: texto(form.get("codigo")),
      descripcion: texto(form.get("descripcion")),
    };
    if (!datos.codigo) {
      setError("Elige una causa del catálogo");
      return;
    }
    if (!datos.descripcion) {
      setError("La descripción es obligatoria");
      return;
    }
    setEnviando(true);
    try {
      const siguiente = await registrarMarca(detalle.id, datos);
      formulario.reset();
      setAviso(
        siguiente.bloqueado
          ? "Marca registrada. El perfil quedó bloqueado. Deben contactar a equipo Nexora."
          : "Marca registrada. El perfil recibirá aviso de equipo Nexora; no bloquea todavía.",
      );
      await onActualizado(siguiente);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo registrar la marca");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <VisualMarcas marcas={detalle.marcas} perfilNombre={detalle.perfil_nombre} bloqueado={detalle.bloqueado} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void marcar(e.currentTarget);
        }}
      >
        <label className="campo-crm">
          Tipo
          <select name="tipo" defaultValue="advertencia">
            <option value="advertencia">Advertencia</option>
            <option value="sancion">Sanción</option>
          </select>
        </label>
        <label className="campo-crm">
          Causa
          <select name="codigo" required defaultValue="">
            <option value="" disabled>
              Elige del catálogo…
            </option>
            {codigosMarca.map((codigo) => (
              <option key={codigo} value={codigo}>
                {detalle.marcas.some((m) => m.codigo === codigo)
                  ? `${ETIQUETAS_MARCA[codigo]} (ya registrada)`
                  : ETIQUETAS_MARCA[codigo]}
              </option>
            ))}
          </select>
        </label>
        <label className="campo-crm">
          Descripción
          <textarea name="descripcion" required rows={3} autoComplete="off" placeholder="Detalle visible para el perfil" />
        </label>
        <button type="submit" className="btn-crm btn-crm-principal" disabled={enviando || detalle.bloqueado}>
          {detalle.bloqueado ? "Perfil bloqueado" : enviando ? "Registrando…" : "Registrar marca"}
        </button>
      </form>
      {error ? <p className="error-crm">{error}</p> : null}
      {aviso ? <p className="aviso-crm">{aviso}</p> : null}
    </>
  );
}

function VisualMarcas({
  marcas,
  perfilNombre,
  bloqueado,
}: {
  marcas: Marca[];
  perfilNombre: string;
  bloqueado: boolean;
}) {
  return (
    <>
      <div className="casillas-marcas" aria-label={`${marcas.length} de 3 marcas`}>
        {[0, 1, 2].map((i) => {
          const m = marcas[i];
          const cls = m ? `casilla llena${m.tipo === "sancion" ? " sancion" : ""}` : "casilla";
          const titulo = m
            ? `${m.tipo === "advertencia" ? "Advertencia" : "Sanción"}: ${m.etiqueta}`
            : `Marca ${i + 1} vacía`;
          return <span key={i} className={cls} title={titulo} />;
        })}
      </div>
      <p className="crm-meta">
        {marcas.length} de 3. Las marcas son del perfil {perfilNombre}. A la tercera se bloquean todos sus usuarios.
        {bloqueado ? " Este perfil está bloqueado." : ""}
      </p>
      {marcas.map((m) => (
        <article key={m.id} className="marca-item">
          <strong>{m.tipo === "advertencia" ? "Advertencia" : "Sanción"}</strong>
          <span>
            {m.etiqueta}: {m.descripcion}
          </span>
        </article>
      ))}
    </>
  );
}

function PastillaEstadoCuenta({ cuenta }: { cuenta: UsuarioLista }) {
  if (cuenta.bloqueado) return <span className="pastilla pastilla-bloqueada">Bloqueada</span>;
  if (cuenta.baja_solicitada) return <span className="pastilla pastilla-baja">Baja pedida</span>;
  return null;
}

function MarcasCelda({ cuenta }: { cuenta: UsuarioLista }) {
  if (cuenta.tipo_cuenta === "administrador") {
    return <span className="ausente">—</span>;
  }
  const celdas = [0, 1, 2].map((indice) => {
    const llena = indice < cuenta.conteo_marcas;
    const bloquea = cuenta.bloqueado && indice === 2 && llena;
    const clase = bloquea ? "marca marca-bloquea" : llena ? "marca marca-llena" : "marca";
    return <span key={indice} className={clase} />;
  });
  return (
    <span className="marcas-celda">
      <span className="marcas">{celdas}</span>
      <span className="marcas-razon num">
        {cuenta.conteo_marcas}
        <span>/3</span>
      </span>
    </span>
  );
}

function RielFichaPerfil({
  perfil,
  cuentaActiva,
  seleccionId,
  onSeleccionar,
  onAltaMiembroPlaceholder,
}: {
  perfil: PerfilGrupo | null;
  cuentaActiva: UsuarioLista | null;
  seleccionId: string | null;
  onSeleccionar: (id: string) => void;
  onAltaMiembroPlaceholder: () => void;
}) {
  if (!perfil || !cuentaActiva) {
    return <p className="vacio">Selecciona una cuenta del directorio para ver su ficha.</p>;
  }

  if (perfil.tipo === "plataforma") {
    const admins = perfil.usuarios;
    return (
      <>
        <div className="ficha-cabecera">
          <div>
            <h3 className="ficha-nombre">{cuentaActiva.nombre}</h3>
            <p className="ficha-sub">Administrador de plataforma · Sin perfil cliente ni proveedor</p>
          </div>
          <span className="pastilla pastilla-acento">Plataforma</span>
        </div>
        <div className="escalera-box">
          <div className="escalera-tope">
            <span>Régimen de sanciones</span>
            <span>No aplica</span>
          </div>
          <p className="escalera-nota">
            Las cuentas de administración supervisan usuarios, proveedores y trabajos. No acumulan marcas de perfil.
          </p>
        </div>
        <dl className="ficha-datos">
          <div className="ficha-par">
            <dt>Correo y teléfono</dt>
            <dd>
              {cuentaActiva.correo} · <span className="num">{formatearTelefono(cuentaActiva.telefono)}</span>
            </dd>
          </div>
        </dl>
        <div className="ficha-cuentas-cab">
          <span className="ficha-cuentas-titulo">Cuentas de plataforma ({admins.length})</span>
        </div>
        <div className="lista-filas">
          {admins.map((item) => (
            <button
              key={item.id}
              type="button"
              className="fila-compacta fila-compacta-boton"
              aria-current={item.id === seleccionId}
              onClick={() => onSeleccionar(item.id)}
            >
              <span className="fila-compacta-izq">
                <span className="fila-compacta-nombre">{item.nombre}</span>
                <span className="fila-compacta-sub">{item.correo}</span>
              </span>
              <span className="pastilla">Admin</span>
            </button>
          ))}
        </div>
      </>
    );
  }

  const tramos = [0, 1, 2].map((indice) => {
    const activo = indice < perfil.conteo_marcas;
    const clase =
      perfil.bloqueado && activo ? "escalera-tramo bloqueo" : activo ? "escalera-tramo activo" : "escalera-tramo";
    return <span key={indice} className={clase} />;
  });
  const est = estadoPerfil(perfil);
  const pastillaEstado = perfil.bloqueado
    ? "pastilla pastilla-bloqueada"
    : perfil.baja
      ? "pastilla pastilla-baja"
      : "pastilla pastilla-acento";

  return (
    <>
      <div className="ficha-cabecera">
        <div>
          <h3 className="ficha-nombre">{perfil.nombre}</h3>
          <p className="ficha-sub">
            {etiquetaTipoPerfil(perfil.tipo)} ({perfil.forma === "empresa" ? "empresa" : "persona"}) ·{" "}
            {perfil.usuarios.length === 1 ? "1 cuenta ligada" : `${perfil.usuarios.length} cuentas ligadas`}
          </p>
        </div>
        <span className={pastillaEstado}>
          {est.txt === "Activo" ? `${etiquetaTipoPerfil(perfil.tipo)} · ${perfil.forma === "empresa" ? "Empresa" : "Persona"}` : est.txt}
        </span>
      </div>
      <div className={`escalera-box${perfil.bloqueado ? " es-bloqueado" : ""}`}>
        <div className="escalera-tope">
          <span>Escalera de sanciones</span>
          <span className="num">{perfil.conteo_marcas} /3 marcas</span>
        </div>
        <div className="escalera-pista" role="img" aria-label={`${perfil.conteo_marcas} de 3 marcas`}>
          {tramos}
        </div>
        <div className="escalera-extremos">
          <span>0 marcas</span>
          <span>3 · bloqueo del perfil</span>
        </div>
        <p className="escalera-nota">
          Las marcas son del perfil. A la tercera se bloquean todos sus usuarios.
          {perfil.bloqueado ? " Este perfil está bloqueado." : ""}
        </p>
      </div>
      <dl className="ficha-datos">
        <div className="ficha-par">
          <dt>Regla del perfil</dt>
          <dd>
            {perfil.tipo === "cliente"
              ? "Un perfil cliente tiene un solo usuario y no puede pertenecer a un proveedor."
              : "Los usuarios del proveedor comparten marcas y bloqueo del perfil."}
          </dd>
        </div>
      </dl>
      <div className="ficha-cuentas-cab">
        <span className="ficha-cuentas-titulo">Cuentas en esta ficha ({perfil.usuarios.length})</span>
        {perfil.tipo === "proveedor" && !perfil.bloqueado ? (
          <button type="button" className="btn btn-acento-suave" onClick={onAltaMiembroPlaceholder}>
            Sumar cuenta
          </button>
        ) : null}
      </div>
      <div className="lista-filas">
        {perfil.usuarios.map((item) => (
          <button
            key={item.id}
            type="button"
            className="fila-compacta fila-compacta-boton"
            aria-current={item.id === seleccionId}
            onClick={() => onSeleccionar(item.id)}
          >
            <span className="fila-compacta-izq">
              <span className="fila-compacta-nombre">{item.nombre}</span>
              <span className="fila-compacta-sub">
                {item.correo}
                {item.telefono ? ` · ${formatearTelefono(item.telefono)}` : ""}
              </span>
            </span>
            <span className="pastilla">{rolDe(item, perfil)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function ListaPerfilesMarcas({
  perfiles,
  perfilActivoId,
  onSeleccionar,
}: {
  perfiles: PerfilGrupo[];
  perfilActivoId: string | null;
  onSeleccionar: (cuentaId: string) => void;
}) {
  const ordenados = [...perfiles]
    .filter((p) => p.tipo !== "plataforma")
    .sort((a, b) => b.conteo_marcas - a.conteo_marcas || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, 6);

  if (!ordenados.length) {
    return <p className="crm-meta">No hay perfiles con marcas registradas.</p>;
  }

  return (
    <div className="lista-filas">
      {ordenados.map((perfil) => {
        const primera = perfil.usuarios[0];
        const pillClase = perfil.bloqueado
          ? "pastilla pastilla-bloqueada"
          : perfil.conteo_marcas === 2
            ? "pastilla pastilla-acento"
            : "pastilla";
        return (
          <button
            key={perfil.id}
            type="button"
            className="fila-compacta fila-compacta-boton"
            disabled={!primera}
            aria-current={perfil.id === perfilActivoId}
            onClick={() => primera && onSeleccionar(primera.id)}
          >
            <span className="fila-compacta-izq">
              <span className="fila-compacta-nombre">{perfil.nombre}</span>
              <span className="fila-compacta-sub">
                {etiquetaTipoPerfil(perfil.tipo)} · {perfil.usuarios.length === 1 ? "1 cuenta" : `${perfil.usuarios.length} cuentas`}
              </span>
            </span>
            <span className={`${pillClase} num`}>{perfil.tipo === "plataforma" ? "—" : `${perfil.conteo_marcas} /3`}</span>
          </button>
        );
      })}
    </div>
  );
}

function cuentaOpera(cuenta: UsuarioLista) {
  return !cuenta.bloqueado && !cuenta.baja_solicitada;
}

function cuentaAUnaMarca(cuenta: UsuarioLista) {
  return cuenta.tipo_cuenta !== "administrador" && cuenta.conteo_marcas === 2 && !cuenta.bloqueado;
}

function pasaTabAcceso(cuenta: UsuarioLista, tab: TabAcceso) {
  if (tab === "operan") return cuentaOpera(cuenta);
  if (tab === "marca") return cuentaAUnaMarca(cuenta);
  if (tab === "bloqueadas") return cuenta.bloqueado;
  if (tab === "baja") return cuenta.baja_solicitada;
  return true;
}

function pasaLugar(cuenta: UsuarioLista, lugar: LugarFiltro) {
  if (lugar === "todos") return true;
  if (lugar === "administrador") return cuenta.tipo_cuenta === "administrador";
  if (lugar === "cliente") return cuenta.tipo_cuenta === "cliente";
  return cuenta.tipo_cuenta === "proveedor";
}

function pasaBusquedaCuenta(cuenta: UsuarioLista, q: string) {
  const busqueda = q.trim().toLowerCase();
  if (!busqueda) return true;
  const perfil = nombrePerfilDeCuenta(cuenta);
  return `${cuenta.nombre} ${cuenta.correo} ${perfil} ${lugarCuenta(cuenta)}`.toLowerCase().includes(busqueda);
}

function compararCuentas(orden: OrdenLista, a: UsuarioLista, b: UsuarioLista) {
  if (orden === "nombre") return a.nombre.localeCompare(b.nombre, "es");
  if (orden === "alta") return a.nombre.localeCompare(b.nombre, "es");
  const marcasA = a.tipo_cuenta === "administrador" ? -1 : a.conteo_marcas;
  const marcasB = b.tipo_cuenta === "administrador" ? -1 : b.conteo_marcas;
  return marcasB - marcasA || a.nombre.localeCompare(b.nombre, "es");
}

function calcularKpis(cuentas: UsuarioLista[], perfiles: PerfilGrupo[]) {
  const total = cuentas.length;
  const enPerfiles = cuentas.filter((c) => c.tipo_cuenta !== "administrador").length;
  const admins = total - enPerfiles;
  const numPerfiles = perfiles.filter((p) => p.tipo !== "plataforma").length;

  const operanCuentas = cuentas.filter(cuentaOpera);
  const operanCli = operanCuentas.filter((c) => c.tipo_cuenta === "cliente").length;
  const operanPro = operanCuentas.filter((c) => c.tipo_cuenta === "proveedor").length;
  const operanAdm = operanCuentas.filter((c) => c.tipo_cuenta === "administrador").length;

  const cuentasRiesgo = cuentas.filter(cuentaAUnaMarca);
  const perfilesRiesgo = perfiles.filter((p) => p.tipo !== "plataforma" && p.conteo_marcas === 2 && !p.bloqueado).length;

  const bloq = cuentas.filter((c) => c.bloqueado).length;
  const bajas = cuentas.filter((c) => c.baja_solicitada).length;
  const inactivas = bloq + bajas;

  const subtitulo = `${total} cuentas registradas en ${numPerfiles} perfiles y ${admins} de plataforma. ${perfilesRiesgo} perfiles están a una marca del bloqueo y sus ${cuentasRiesgo.length} cuentas siguen entrando.`;

  return {
    total,
    notaTotal: `${enPerfiles} en ${numPerfiles} perfiles y ${admins} de plataforma`,
    operan: operanCuentas.length,
    notaOperan: `${operanCli} clientes, ${operanPro} de proveedor y ${operanAdm} admin`,
    riesgoCuentas: cuentasRiesgo.length,
    notaRiesgo: `En ${perfilesRiesgo} ${perfilesRiesgo === 1 ? "perfil" : "perfiles"} con 2 /3 marcas`,
    inactivas,
    notaInactivas: `${bloq} bloqueadas (3 /3) y ${bajas} baja pedida`,
    subtitulo,
  };
}

function lugarCuenta(cuenta: UsuarioLista) {
  if (cuenta.tipo_cuenta === "administrador") return "Plataforma";
  if (cuenta.tipo_cuenta === "cliente") return "Cliente";
  if (cuenta.tipo_cuenta === "empresa") return cuenta.funcion === "tecnico" ? "Técnico" : "Administrativo";
  if (cuenta.tipo_cuenta === "negocio") return "Administrativo de campo";
  return cuenta.funcion === "tecnico" ? "Técnico" : "Administrativo";
}

function nombrePerfilDeCuenta(cuenta: UsuarioLista) {
  if (cuenta.tipo_cuenta === "administrador") return "Plataforma";
  return cuenta.perfil_nombre;
}

function hueDeId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return hash;
}

function formatearSello(fecha: Date) {
  return `Actualizado ${new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha)}`;
}

function formatearTelefono(tel: string) {
  const limpio = tel.replace(/\D+/g, "");
  if (limpio.length !== 10) return tel;
  return `${limpio.slice(0, 3)} ${limpio.slice(3, 6)} ${limpio.slice(6)}`;
}

function agruparPerfiles(cuentas: UsuarioLista[]): PerfilGrupo[] {
  const map = new Map<string, PerfilGrupo>();
  const admins: UsuarioLista[] = [];

  for (const cuenta of cuentas) {
    if (cuenta.tipo_cuenta === "administrador") {
      admins.push(cuenta);
      continue;
    }
    const id = (cuenta.perfil_cliente_id ?? cuenta.perfil_proveedor_id)!;
    let grupo = map.get(id);
    if (!grupo) {
      const tipo: TipoPerfil =
        cuenta.tipo_cuenta === "cliente"
          ? "cliente"
          : cuenta.tipo_cuenta === "empresa" || cuenta.tipo_cuenta === "negocio" || cuenta.tipo_cuenta === "proveedor"
            ? "proveedor"
            : "proveedor";
      grupo = {
        id,
        nombre: cuenta.perfil_nombre,
        tipo,
        forma: "empresa",
        bloqueado: cuenta.bloqueado,
        baja: cuenta.baja_solicitada,
        conteo_marcas: cuenta.conteo_marcas,
        usuarios: [],
      };
      map.set(id, grupo);
    }
    grupo.usuarios.push(cuenta);
    grupo.bloqueado = grupo.bloqueado || cuenta.bloqueado;
    grupo.baja = grupo.baja || cuenta.baja_solicitada;
  }

  for (const grupo of map.values()) {
    if (grupo.tipo === "cliente" && grupo.usuarios.length === 1 && grupo.usuarios[0].perfil_nombre === "Persona") {
      grupo.forma = "persona";
      grupo.nombre = grupo.usuarios[0].nombre;
    }
  }

  const lista = [...map.values()];
  if (admins.length > 0) {
    lista.push({
      id: ID_PLATAFORMA,
      nombre: "Nexora",
      tipo: "plataforma",
      forma: "empresa",
      bloqueado: false,
      baja: admins.some((a) => a.baja_solicitada),
      conteo_marcas: 0,
      usuarios: admins.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    });
  }

  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function estadoPerfil(p: PerfilGrupo) {
  if (p.bloqueado) return { txt: "Bloqueado", cls: "critico" as const };
  if (p.baja) return { txt: "Baja solicitada", cls: "alerta" as const };
  return { txt: "Activo", cls: "ok" as const };
}

function etiquetaTipoPerfil(tipo: TipoPerfil) {
  if (tipo === "cliente") return "Cliente";
  if (tipo === "proveedor") return "Proveedor";
  return "Plataforma";
}

function rolDe(
  cuenta: { tipo_cuenta: TipoCuenta; funcion: FuncionProveedor | null },
  perfil?: PerfilGrupo | null,
) {
  if (perfil?.tipo === "plataforma" || cuenta.tipo_cuenta === "administrador") return "Administrador";
  if (cuenta.tipo_cuenta === "cliente") return "Cliente";
  return cuenta.funcion === "tecnico" ? "Técnico" : "Administrativo";
}

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
