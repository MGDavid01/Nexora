import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  registrarMarca,
  type FuncionProveedor,
  type Marca,
  type TipoCuenta,
  type UsuarioDetalle,
  type UsuarioLista,
} from "../api";
import { digitos, texto, validarAlta, validarContrasenaOpcional } from "../validarAlta";
import { CamposCuenta, CamposUbicacion, ubicacionDe } from "./FormularioRegistro";
import "../usuarios-admin.css";

type TipoPerfil = "cliente" | "proveedor" | "plataforma";
type ModoAlta = "cliente" | "proveedor" | "administrador";
type FiltroMarcas = "" | "con" | "sin";

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

type ColumnaId = "nombre" | "forma" | "rol" | "cuentas" | "marcas" | "estado";

const COLUMNAS: { id: ColumnaId; etiqueta: string; fija?: boolean }[] = [
  { id: "nombre", etiqueta: "Nombre", fija: true },
  { id: "forma", etiqueta: "Forma" },
  { id: "rol", etiqueta: "Rol" },
  { id: "cuentas", etiqueta: "Cuentas" },
  { id: "marcas", etiqueta: "Marcas" },
  { id: "estado", etiqueta: "Estado" },
];

const COLUMNAS_INICIAL: ColumnaId[] = ["nombre", "forma", "rol", "cuentas", "marcas", "estado"];

export function UsuariosAdmin() {
  const [cuentas, setCuentas] = useState<UsuarioLista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState<Set<TipoPerfil>>(new Set());
  const [filtroEstado, setFiltroEstado] = useState<Set<string>>(new Set());
  const [filtroForma, setFiltroForma] = useState<Set<string>>(new Set());
  const [filtroMarcas, setFiltroMarcas] = useState<FiltroMarcas>("");
  const [columnasVisibles, setColumnasVisibles] = useState<Set<ColumnaId>>(() => new Set(COLUMNAS_INICIAL));

  const [perfilActivoId, setPerfilActivoId] = useState<string | null>(null);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [modoAlta, setModoAlta] = useState<ModoAlta | null>(null);
  const [detalle, setDetalle] = useState<UsuarioDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [menuAltaAbierto, setMenuAltaAbierto] = useState(false);
  const [modalColumnas, setModalColumnas] = useState(false);
  const [ddAbierto, setDdAbierto] = useState<string | null>(null);

  const accionesRef = useRef<HTMLDivElement>(null);

  const perfiles = useMemo(() => agruparPerfiles(cuentas), [cuentas]);

  const perfilActivo = useMemo(
    () => perfiles.find((p) => p.id === perfilActivoId) ?? null,
    [perfiles, perfilActivoId],
  );

  const perfilesFiltrados = useMemo(
    () => filtrarPerfiles(perfiles, busqueda, filtroRol, filtroEstado, filtroForma, filtroMarcas),
    [perfiles, busqueda, filtroRol, filtroEstado, filtroForma, filtroMarcas],
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
    const idDetalle =
      seleccionId ??
      (perfilActivo && perfilActivo.forma === "empresa" && !seleccionId
        ? perfilActivo.usuarios[0]?.id
        : null);
    if (!idDetalle) {
      setDetalle(null);
      return;
    }
    let vivo = true;
    setCargandoDetalle(true);
    obtenerUsuarioAdmin(idDetalle)
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
  }, [seleccionId, perfilActivoId, perfilActivo, modoAlta]);

  useEffect(() => {
    function cerrarMenus(evento: MouseEvent) {
      const target = evento.target as Node;
      if (accionesRef.current && !accionesRef.current.contains(target)) {
        setMenuAltaAbierto(false);
      }
      if (!(evento.target as HTMLElement).closest?.(".dd-filtro")) {
        setDdAbierto(null);
      }
    }
    document.addEventListener("pointerdown", cerrarMenus);
    return () => document.removeEventListener("pointerdown", cerrarMenus);
  }, []);

  useEffect(() => {
    function escape(evento: KeyboardEvent) {
      if (evento.key === "Escape" && modalColumnas) setModalColumnas(false);
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [modalColumnas]);

  function col(id: ColumnaId) {
    return columnasVisibles.has(id);
  }

  function abrirPerfil(id: string) {
    setModoAlta(null);
    setErrorGlobal("");
    const p = perfiles.find((perfil) => perfil.id === id);
    if (!p) return;
    setPerfilActivoId(id);
    if (p.forma === "persona" && p.usuarios[0]) {
      setSeleccionId(p.usuarios[0].id);
      return;
    }
    setSeleccionId(null);
  }

  function abrirCuenta(id: string) {
    setModoAlta(null);
    setErrorGlobal("");
    const perfil =
      perfiles.find((p) => p.usuarios.some((u) => u.id === id)) ??
      (perfilActivo?.usuarios.some((u) => u.id === id) ? perfilActivo : null);
    if (perfil) setPerfilActivoId(perfil.id);
    setSeleccionId(id);
  }

  function cerrarDetalle() {
    setModoAlta(null);
    setSeleccionId(null);
    setPerfilActivoId(null);
    setDetalle(null);
  }

  function volverDesdeFicha() {
    setModoAlta(null);
    if (seleccionId && perfilActivo?.forma === "empresa") {
      setSeleccionId(null);
      return;
    }
    cerrarDetalle();
  }

  const conDetalle = Boolean(modoAlta || perfilActivoId);
  const sinLista = Boolean(perfilActivo && perfilActivo.forma === "persona" && seleccionId);
  const listandoEmpresa = Boolean(perfilActivo?.forma === "empresa" && !seleccionId && !modoAlta);

  const usuariosLaterales = perfilActivo ? usuariosVisiblesEnPerfil(perfilActivo, busqueda) : [];

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
    <section className="vista-padron-crm" aria-labelledby="titulo-padron-crm">
      <header className="crm-top">
        <div className="crm-titulo">
          <h1 id="titulo-padron-crm">Usuarios</h1>
        </div>
        <div className="crm-acciones" ref={accionesRef}>
          <button
            type="button"
            className="btn-crm btn-crm-principal"
            aria-haspopup="menu"
            aria-expanded={menuAltaAbierto}
            onClick={() => setMenuAltaAbierto((v) => !v)}
          >
            Crear cuenta
          </button>
          <div className={menuAltaAbierto ? "menu-alta abierto" : "menu-alta"} role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuAltaAbierto(false);
                cerrarDetalle();
                setModoAlta("cliente");
              }}
            >
              Cliente (perfil + cuenta)
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuAltaAbierto(false);
                cerrarDetalle();
                setModoAlta("proveedor");
              }}
            >
              Proveedor (perfil + cuenta)
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuAltaAbierto(false);
                cerrarDetalle();
                setModoAlta("administrador");
              }}
            >
              Administrador de plataforma
            </button>
          </div>
        </div>
      </header>

      {errorGlobal ? <p className="error-crm">{errorGlobal}</p> : null}

      <div className="crm-filtros" aria-label="Filtros del padrón">
        <FiltroDesplegable
          clave="rol"
          etiqueta="Rol"
          abierto={ddAbierto === "rol"}
          activo={filtroRol.size > 0}
          texto={etiquetaMulti("Rol", filtroRol, {
            cliente: "Cliente",
            proveedor: "Proveedor",
            plataforma: "Plataforma",
          })}
          onToggle={() => setDdAbierto((d) => (d === "rol" ? null : "rol"))}
        >
          {(["cliente", "proveedor", "plataforma"] as TipoPerfil[]).map((valor) => (
            <label key={valor}>
              <input
                type="checkbox"
                checked={filtroRol.has(valor)}
                onChange={() => {
                  setFiltroRol((prev) => {
                    const sig = new Set(prev);
                    if (sig.has(valor)) sig.delete(valor);
                    else sig.add(valor);
                    return sig;
                  });
                }}
              />
              {valor === "cliente" ? "Cliente" : valor === "proveedor" ? "Proveedor" : "Plataforma"}
            </label>
          ))}
        </FiltroDesplegable>

        <FiltroDesplegable
          clave="estado"
          etiqueta="Estado de cuenta"
          abierto={ddAbierto === "estado"}
          activo={filtroEstado.size > 0}
          texto={etiquetaMulti("Estado de cuenta", filtroEstado, {
            activo: "Activo",
            bloqueado: "Bloqueado",
            baja: "Baja solicitada",
          })}
          onToggle={() => setDdAbierto((d) => (d === "estado" ? null : "estado"))}
        >
          {[
            ["activo", "Activo"],
            ["bloqueado", "Bloqueado"],
            ["baja", "Baja solicitada"],
          ].map(([valor, etiqueta]) => (
            <label key={valor}>
              <input
                type="checkbox"
                checked={filtroEstado.has(valor)}
                onChange={() => {
                  setFiltroEstado((prev) => {
                    const sig = new Set(prev);
                    if (sig.has(valor)) sig.delete(valor);
                    else sig.add(valor);
                    return sig;
                  });
                }}
              />
              {etiqueta}
            </label>
          ))}
        </FiltroDesplegable>

        <FiltroDesplegable
          clave="forma"
          etiqueta="Forma"
          abierto={ddAbierto === "forma"}
          activo={filtroForma.size > 0}
          texto={etiquetaMulti("Forma", filtroForma, { persona: "Persona", empresa: "Empresa" })}
          onToggle={() => setDdAbierto((d) => (d === "forma" ? null : "forma"))}
        >
          {[
            ["persona", "Persona"],
            ["empresa", "Empresa"],
          ].map(([valor, etiqueta]) => (
            <label key={valor}>
              <input
                type="checkbox"
                checked={filtroForma.has(valor)}
                onChange={() => {
                  setFiltroForma((prev) => {
                    const sig = new Set(prev);
                    if (sig.has(valor)) sig.delete(valor);
                    else sig.add(valor);
                    return sig;
                  });
                }}
              />
              {etiqueta}
            </label>
          ))}
        </FiltroDesplegable>

        <FiltroDesplegable
          clave="marcas"
          etiqueta="Marcas"
          abierto={ddAbierto === "marcas"}
          activo={Boolean(filtroMarcas)}
          texto={
            filtroMarcas
              ? `Marcas: ${filtroMarcas === "con" ? "Con marcas" : "Sin marcas"}`
              : "Marcas"
          }
          onToggle={() => setDdAbierto((d) => (d === "marcas" ? null : "marcas"))}
        >
          {[
            ["", "Todas"],
            ["con", "Con marcas"],
            ["sin", "Sin marcas"],
          ].map(([valor, etiqueta]) => (
            <label key={valor || "todas"}>
              <input
                type="radio"
                name="filtro-marcas"
                checked={filtroMarcas === valor}
                onChange={() => setFiltroMarcas(valor as FiltroMarcas)}
              />
              {etiqueta}
            </label>
          ))}
        </FiltroDesplegable>

        <label className="crm-buscar">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <input
            type="search"
            placeholder="Buscar persona, empresa o correo"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn-crm btn-columnas"
          title="Columnas"
          aria-label="Mostrar u ocultar columnas"
          onClick={() => setModalColumnas(true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16M15 4v16M3 10h18" />
          </svg>
        </button>
      </div>

      {modalColumnas ? (
        <div
          className="modal-fondo"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalColumnas(false);
          }}
        >
          <div className="modal-caja" role="dialog" aria-modal="true" aria-labelledby="titulo-columnas">
            <h2 id="titulo-columnas">Columnas</h2>
            <p className="crm-meta">Elige qué columnas se muestran en la tabla. Nombre no se puede ocultar.</p>
            <div className="modal-lista">
              {COLUMNAS.map((c) => (
                <label key={c.id} className={c.fija ? "fija" : undefined}>
                  <input
                    type="checkbox"
                    checked={col(c.id)}
                    disabled={c.fija}
                    onChange={(e) => {
                      if (c.fija) return;
                      setColumnasVisibles((prev) => {
                        const sig = new Set(prev);
                        if (e.target.checked) sig.add(c.id);
                        else sig.delete(c.id);
                        return sig;
                      });
                    }}
                  />
                  {c.etiqueta}
                  {c.fija ? " (siempre visible)" : ""}
                </label>
              ))}
            </div>
            <div className="modal-acciones">
              <button type="button" className="btn-crm" onClick={() => setModalColumnas(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={[
          "tablero-crm",
          conDetalle ? "con-detalle" : "",
          sinLista ? "sin-lista" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {conDetalle ? (
          <aside className="crm-panel lista-compacta" aria-label="Lista lateral">
            {modoAlta
              ? perfilesFiltrados.map((p) => (
                  <button key={p.id} type="button" className="item-compacto" onClick={() => abrirPerfil(p.id)}>
                    <strong>{p.nombre}</strong>
                    <span>
                      {p.forma === "persona" ? "Persona" : "Empresa"} · {etiquetaTipoPerfil(p.tipo)}
                    </span>
                  </button>
                ))
              : usuariosLaterales.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={u.id === seleccionId ? "item-compacto activo" : "item-compacto"}
                    onClick={() => abrirCuenta(u.id)}
                  >
                    <strong>{u.nombre}</strong>
                    <span>{rolDe(u, perfilActivo!)}</span>
                  </button>
                ))}
          </aside>
        ) : null}

        {!conDetalle || modoAlta ? (
          <section className="crm-panel tabla-completa" aria-label="Tabla de perfiles">
            <div className="tabla-wrap">
              {cargando ? (
                <p className="crm-cargando">Cargando padrón…</p>
              ) : perfilesFiltrados.length === 0 ? (
                <p className="crm-cargando">No hay perfiles con estos filtros.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      {col("nombre") ? <th scope="col">Nombre</th> : null}
                      {col("forma") ? <th scope="col">Forma</th> : null}
                      {col("rol") ? <th scope="col">Rol</th> : null}
                      {col("cuentas") ? <th scope="col">Cuentas</th> : null}
                      {col("marcas") ? <th scope="col">Marcas</th> : null}
                      {col("estado") ? <th scope="col">Estado</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {perfilesFiltrados.map((p) => {
                      const est = estadoPerfil(p);
                      const marcasTxt = p.tipo === "plataforma" ? "—" : `${p.conteo_marcas}/3`;
                      return (
                        <tr key={p.id}>
                          {col("nombre") ? (
                            <td>
                              <div className="identidad">
                                <span className={`avatar ${p.tipo}`}>{iniciales(p.nombre)}</span>
                                <button type="button" className="fila-cuenta" onClick={() => abrirPerfil(p.id)}>
                                  {p.nombre}
                                </button>
                              </div>
                            </td>
                          ) : null}
                          {col("forma") ? (
                            <td>
                              <span className={`chip-forma ${p.forma}`}>
                                {p.forma === "persona" ? "Persona" : "Empresa"}
                              </span>
                            </td>
                          ) : null}
                          {col("rol") ? (
                            <td>
                              <span className="chip-rol">{etiquetaTipoPerfil(p.tipo)}</span>
                            </td>
                          ) : null}
                          {col("cuentas") ? <td className="dato">{p.usuarios.length}</td> : null}
                          {col("marcas") ? <td className="dato">{marcasTxt}</td> : null}
                          {col("estado") ? (
                            <td>
                              <span className={`pill-estado ${est.cls}`}>{est.txt}</span>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="crm-pie">
              <span>
                {perfilesFiltrados.length} persona{perfilesFiltrados.length === 1 ? "" : "s"} o empresa
                {perfilesFiltrados.length === 1 ? "" : "s"}
              </span>
              <span>{perfilesFiltrados.length} en esta vista</span>
            </div>
          </section>
        ) : null}

        {conDetalle ? (
          <section className="crm-panel" aria-label="Detalle">
            <div className="crm-detalle-scroll">
              {modoAlta === "cliente" ? (
                <PanelAlta titulo="Alta de cliente" meta="Crea el perfil y la única cuenta de esa persona o empresa." onVolver={() => setModoAlta(null)}>
                  <AltaClienteForm
                    onCreado={async (id) => {
                      await recargar(id);
                      setModoAlta(null);
                      const p = agruparPerfiles(await listarUsuariosAdmin()).find((g) =>
                        g.usuarios.some((u) => u.id === id),
                      );
                      if (p?.forma === "persona") {
                        setPerfilActivoId(p.id);
                        setSeleccionId(id);
                      } else if (p) {
                        setPerfilActivoId(p.id);
                        setSeleccionId(null);
                      }
                    }}
                  />
                </PanelAlta>
              ) : null}
              {modoAlta === "proveedor" ? (
                <PanelAlta
                  titulo="Alta de proveedor"
                  meta="Crea el perfil. La primera cuenta queda como administrativa."
                  onVolver={() => setModoAlta(null)}
                >
                  <AltaProveedorForm
                    onCreado={async (id) => {
                      await recargar(id);
                      setModoAlta(null);
                      const p = agruparPerfiles(await listarUsuariosAdmin()).find((g) =>
                        g.usuarios.some((u) => u.id === id),
                      );
                      if (p) {
                        setPerfilActivoId(p.id);
                        setSeleccionId(null);
                      }
                    }}
                  />
                </PanelAlta>
              ) : null}
              {modoAlta === "administrador" ? (
                <PanelAlta
                  titulo="Alta de administrador"
                  meta="Cuenta de plataforma, sin perfil cliente ni proveedor."
                  onVolver={() => setModoAlta(null)}
                >
                  <AltaAdministradorForm
                    onCreado={async (id) => {
                      await recargar(id);
                      setModoAlta(null);
                      setPerfilActivoId(ID_PLATAFORMA);
                      setSeleccionId(id);
                    }}
                  />
                </PanelAlta>
              ) : null}

              {!modoAlta && listandoEmpresa && perfilActivo ? (
                <FichaEmpresa
                  perfil={perfilActivo}
                  detalle={detalle}
                  cargando={cargandoDetalle}
                  onVolver={volverDesdeFicha}
                  onActualizado={onActualizadoDetalle}
                />
              ) : null}

              {!modoAlta && seleccionId && detalle && perfilActivo ? (
                <FichaCuenta
                  detalle={detalle}
                  perfil={perfilActivo}
                  onVolver={volverDesdeFicha}
                  onActualizado={onActualizadoDetalle}
                />
              ) : null}

              {!modoAlta && !listandoEmpresa && seleccionId && cargandoDetalle ? (
                <p className="crm-meta">Cargando cuenta…</p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function FiltroDesplegable({
  clave,
  texto,
  abierto,
  activo,
  onToggle,
  children,
}: {
  clave: string;
  etiqueta: string;
  texto: string;
  abierto: boolean;
  activo: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={abierto ? "dd-filtro abierto" : "dd-filtro"} data-filtro={clave}>
      <button
        type="button"
        className={activo ? "filtro-dd activo" : "filtro-dd"}
        aria-expanded={abierto}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {texto}
      </button>
      <div className="dd-panel" role="listbox">
        {children}
      </div>
    </div>
  );
}

function PanelAlta({
  titulo,
  meta,
  onVolver,
  children,
}: {
  titulo: string;
  meta: string;
  onVolver: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <header className="ficha-top">
        <div>
          <h2>{titulo}</h2>
          <p className="crm-meta">{meta}</p>
        </div>
        <button type="button" className="volver-crm" onClick={onVolver}>
          ← Volver al padrón
        </button>
      </header>
      {children}
    </>
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

function AltaProveedorForm({ onCreado }: { onCreado?: (id: string) => Promise<void> }) {
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
      const creado = await api<{ id: string }>("/api/v1/admin/proveedores", {
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
    <form autoComplete="off" onSubmit={(e) => void onSubmit(e)}>
      {children}
      <CamposCuenta classNameCampo="campo-crm" />
      {conUbicacion ? <CamposUbicacion classNameCampo="campo-crm" /> : null}
      {error ? <p className="error-crm">{error}</p> : null}
      <button type="submit" className="btn-crm btn-crm-principal" disabled={enviando}>
        {enviando ? "Registrando…" : "Registrar"}
      </button>
    </form>
  );
}

function FichaEmpresa({
  perfil,
  detalle,
  cargando,
  onVolver,
  onActualizado,
}: {
  perfil: PerfilGrupo;
  detalle: UsuarioDetalle | null;
  cargando: boolean;
  onVolver: () => void;
  onActualizado: (d: UsuarioDetalle) => Promise<void>;
}) {
  const est = estadoPerfil(perfil);
  return (
    <>
      <header className="ficha-top">
        <div>
          <h2>{perfil.nombre}</h2>
          <p className="crm-meta">
            Empresa · {etiquetaTipoPerfil(perfil.tipo)} ·{" "}
            <span className={`pill-estado ${est.cls}`}>{est.txt}</span>
          </p>
        </div>
        <button type="button" className="volver-crm" onClick={onVolver}>
          ← Volver al padrón
        </button>
      </header>
      <dl className="props-crm">
        <dt>Forma</dt>
        <dd>Empresa</dd>
        <dt>Rol</dt>
        <dd>{etiquetaTipoPerfil(perfil.tipo)}</dd>
        <dt>Cuentas</dt>
        <dd>{perfil.usuarios.length}</dd>
        <dt>Marcas</dt>
        <dd>{perfil.tipo === "plataforma" ? "—" : `${perfil.conteo_marcas}/3`}</dd>
      </dl>
      {cargando || !detalle ? (
        <p className="crm-meta">Cargando marcas del perfil…</p>
      ) : (
        <BloqueMarcas detalle={detalle} onActualizado={onActualizado} />
      )}
    </>
  );
}

function FichaCuenta({
  detalle,
  perfil,
  onVolver,
  onActualizado,
}: {
  detalle: UsuarioDetalle;
  perfil: PerfilGrupo;
  onVolver: () => void;
  onActualizado: (d: UsuarioDetalle) => Promise<void>;
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
      if (detalle.tipo_cuenta === "proveedor") {
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
        {detalle.tipo_cuenta === "proveedor" ? (
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
      const tipo: TipoPerfil = cuenta.tipo_cuenta === "cliente" ? "cliente" : "proveedor";
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

function filtrarPerfiles(
  perfiles: PerfilGrupo[],
  q: string,
  rol: Set<TipoPerfil>,
  estado: Set<string>,
  forma: Set<string>,
  marcas: FiltroMarcas,
) {
  const busqueda = q.trim().toLowerCase();
  return perfiles.filter((p) => {
    if (rol.size && !rol.has(p.tipo)) return false;
    if (estado.size && !estado.has(claveEstado(p))) return false;
    if (forma.size && !forma.has(p.forma)) return false;
    const tieneMarcas = p.tipo !== "plataforma" && p.conteo_marcas > 0;
    if (marcas === "con" && !tieneMarcas) return false;
    if (marcas === "sin" && tieneMarcas) return false;
    if (!busqueda) return true;
    const correos = p.usuarios.map((u) => u.correo).join(" ");
    return `${p.nombre} ${correos} ${etiquetaTipoPerfil(p.tipo)} ${p.forma}`.toLowerCase().includes(busqueda);
  });
}

function usuariosVisiblesEnPerfil(perfil: PerfilGrupo, q: string) {
  const busqueda = q.trim().toLowerCase();
  return perfil.usuarios.filter((u) => {
    if (!busqueda) return true;
    return `${u.nombre} ${u.correo} ${u.telefono} ${rolDe(u, perfil)}`.toLowerCase().includes(busqueda);
  });
}

function claveEstado(p: PerfilGrupo) {
  if (p.bloqueado) return "bloqueado";
  if (p.baja) return "baja";
  return "activo";
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

function etiquetaMulti(clave: string, set: Set<string>, etiquetas: Record<string, string>) {
  if (!set.size) return clave;
  const nombres = [...set].map((v) => etiquetas[v] ?? v);
  return nombres.length === 1 ? `${clave}: ${nombres[0]}` : `${clave} (${nombres.length})`;
}
