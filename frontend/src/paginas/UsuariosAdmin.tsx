import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listarUsuariosAdmin, type UsuarioLista } from "../api";
import { AltaUsuarioDialog, type FamiliaAlta } from "./AltaUsuarioDialog";
import { agruparPerfiles, type PerfilGrupo } from "./usuarios-ficha";
import {
  FilaCuentaTabla,
  lugarCuenta,
  nombrePerfilDeCuenta,
} from "./usuarios-tabla";
import { CheckIcon, RefreshCwIcon, UserPlusIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminTopbarAcciones } from "../admin/AdminTopbar";
import { ConversionesAdmin } from "./admin/AdminExtension";
import "../usuarios-admin.css";
import "../usuarios-v2.css";

type TabAcceso = "todas" | "operan" | "marca" | "bloqueadas" | "baja";
type LugarFiltro = "todos" | "cliente" | "proveedor" | "administrador" | "negocio";

function lugarFiltroDesdeRuta(pathname: string): LugarFiltro {
  if (pathname.startsWith("/admin/usuarios/clientes")) return "cliente";
  if (pathname.startsWith("/admin/usuarios/negocio")) return "negocio";
  if (pathname.startsWith("/admin/usuarios/administradores")) return "administrador";
  return "todos";
}
type ColumnaOrden = "nombre" | "lugar" | "perfil" | "marcas" | "alta";
type DireccionOrden = "asc" | "desc";

const PESTANIAS: { id: TabAcceso; etiqueta: string; badge?: boolean }[] = [
  { id: "todas", etiqueta: "Todas" },
  { id: "operan", etiqueta: "Operan" },
  { id: "marca", etiqueta: "A una marca", badge: true },
  { id: "bloqueadas", etiqueta: "Bloqueadas", badge: true },
  { id: "baja", etiqueta: "Baja pedida", badge: true },
];

export function UsuariosAdmin() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const lugarDesdeRuta = lugarFiltroDesdeRuta(pathname);
  const filtroPerfilFijado = lugarDesdeRuta !== "todos";
  const [cuentas, setCuentas] = useState<UsuarioLista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [tabAcceso, setTabAcceso] = useState<TabAcceso>("todas");
  const [lugarFiltro, setLugarFiltro] = useState<LugarFiltro>(lugarDesdeRuta);
  const [columnaOrden, setColumnaOrden] = useState<ColumnaOrden>("marcas");
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>("desc");
  const [avisoLista, setAvisoLista] = useState("");
  const [estadoRefresh, setEstadoRefresh] = useState<"idle" | "cargando" | "listo">("idle");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [altaAbierta, setAltaAbierta] = useState(false);

  const accionesTopbar = useMemo(
    () => (
      <Button type="button" size="sm" onClick={() => setAltaAbierta(true)}>
        <UserPlusIcon data-icon="inline-start" />
        Registrar
      </Button>
    ),
    [],
  );
  useAdminTopbarAcciones(accionesTopbar);

  const perfiles = useMemo(() => agruparPerfiles(cuentas), [cuentas]);

  const perfilPorCuentaId = useMemo(() => {
    const map = new Map<string, PerfilGrupo>();
    for (const perfil of perfiles) {
      for (const usuario of perfil.usuarios) {
        map.set(usuario.id, perfil);
      }
    }
    return map;
  }, [perfiles]);

  const cuentasBase = useMemo(
    () => cuentas.filter((c) => pasaLugar(c, lugarFiltro) && pasaBusquedaCuenta(c, busqueda)),
    [cuentas, lugarFiltro, busqueda],
  );

  const cuentasVisibles = useMemo(
    () =>
      cuentasBase
        .filter((c) => pasaTabAcceso(c, tabAcceso))
        .sort((a, b) => compararCuentas(columnaOrden, direccionOrden, a, b)),
    [cuentasBase, tabAcceso, columnaOrden, direccionOrden],
  );

  const recargar = useCallback(async () => {
    const lista = await listarUsuariosAdmin();
    setCuentas(lista);
  }, []);

  useEffect(() => {
    setLugarFiltro(lugarDesdeRuta);
  }, [lugarDesdeRuta]);

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
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

  function abrirCuenta(id: string) {
    navigate(`/admin/usuarios/${id}`);
  }

  function conteoTab(tab: TabAcceso) {
    return cuentasBase.filter((c) => pasaTabAcceso(c, tab)).length;
  }

  async function actualizarLista() {
    if (estadoRefresh === "cargando") return;
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    setAvisoLista("");
    setEstadoRefresh("cargando");
    try {
      await recargar();
      setEstadoRefresh("listo");
      refreshTimer.current = setTimeout(() => setEstadoRefresh("idle"), 2200);
    } catch (causa) {
      setEstadoRefresh("idle");
      setErrorGlobal(causa instanceof Error ? causa.message : "No se pudo actualizar");
    }
  }

  function restablecerFiltros() {
    setBusqueda("");
    setTabAcceso("todas");
    setLugarFiltro(lugarDesdeRuta === "todos" ? "todos" : lugarDesdeRuta);
    setAvisoLista("");
  }

  function alternarOrdenColumna(columna: ColumnaOrden) {
    if (columna === columnaOrden) {
      setDireccionOrden((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setColumnaOrden(columna);
    setDireccionOrden(columna === "marcas" ? "desc" : "asc");
  }

  return (
    <section className="hub-page vista-usuarios-v2" aria-label="Usuarios">
      <ConversionesAdmin />

      {errorGlobal ? <p className="error-crm">{errorGlobal}</p> : null}

      <div className="mesa">
        <section className="columna-lista" aria-label="Directorio de cuentas">
          <div className="pestanias">
            <div className="pestanias-filtro" id="controles-usuarios">
              <label className="buscar pestanias-filtro-buscar">
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

              <label className="pestanias-filtro-etiq" htmlFor="filtro-acceso-usuarios">
                Estado
              </label>
              <Select value={tabAcceso} onValueChange={(v) => setTabAcceso(v as TabAcceso)}>
                <SelectTrigger id="filtro-acceso-usuarios" size="sm" className="min-w-[11rem]">
                  <SelectValue placeholder="Elegir estado" />
                </SelectTrigger>
                <SelectContent align="start" position="popper" className="min-w-[11rem]">
                  {PESTANIAS.map((p) => {
                    const n = conteoTab(p.id);
                    const texto = p.badge && n > 0 ? `${p.etiqueta} (${n})` : p.etiqueta;
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {texto}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {!filtroPerfilFijado ? (
                <>
                  <label className="pestanias-filtro-etiq" htmlFor="filtro-perfil-usuarios">
                    Perfil
                  </label>
                  <Select value={lugarFiltro} onValueChange={(v) => setLugarFiltro(v as LugarFiltro)}>
                    <SelectTrigger id="filtro-perfil-usuarios" size="sm" className="min-w-[9rem]">
                      <SelectValue placeholder="Perfil" />
                    </SelectTrigger>
                    <SelectContent align="start" position="popper" className="min-w-[9rem]">
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="cliente">Clientes</SelectItem>
                      <SelectItem value="negocio">Negocios y empresas</SelectItem>
                      <SelectItem value="administrador">Administradores</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              ) : null}

              <div className="herramientas-iconos">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className={cn("btn-toolbar-icon", estadoRefresh === "listo" && "btn-refresh-listo")}
                      aria-label={
                        estadoRefresh === "listo"
                          ? "Lista actualizada"
                          : estadoRefresh === "cargando"
                            ? "Actualizando lista"
                            : "Actualizar lista"
                      }
                      disabled={estadoRefresh === "cargando"}
                      onClick={() => void actualizarLista()}
                    >
                      {estadoRefresh === "listo" ? (
                        <CheckIcon className="size-4" aria-hidden />
                      ) : (
                        <RefreshCwIcon
                          className={estadoRefresh === "cargando" ? "size-4 animate-spin" : "size-4"}
                          aria-hidden
                        />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {estadoRefresh === "listo" ? "Actualizado" : estadoRefresh === "cargando" ? "Actualizando…" : "Actualizar"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {avisoLista ? (
            <p className="estado-alta" role="status">
              {avisoLista}
            </p>
          ) : null}

          <div className="lista-scroll">
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
                  <CabeceraOrdenable
                    etiqueta="Cuenta"
                    columna="nombre"
                    columnaActiva={columnaOrden}
                    direccion={direccionOrden}
                    onOrdenar={alternarOrdenColumna}
                  />
                  <CabeceraOrdenable
                    etiqueta="Tipo"
                    columna="lugar"
                    columnaActiva={columnaOrden}
                    direccion={direccionOrden}
                    onOrdenar={alternarOrdenColumna}
                  />
                  <CabeceraOrdenable
                    etiqueta="Perfil"
                    columna="perfil"
                    columnaActiva={columnaOrden}
                    direccion={direccionOrden}
                    onOrdenar={alternarOrdenColumna}
                  />
                  <CabeceraOrdenable
                    etiqueta="Marcas"
                    columna="marcas"
                    columnaActiva={columnaOrden}
                    direccion={direccionOrden}
                    onOrdenar={alternarOrdenColumna}
                    className="marcas-col"
                  />
                  <CabeceraOrdenable
                    etiqueta="Alta"
                    columna="alta"
                    columnaActiva={columnaOrden}
                    direccion={direccionOrden}
                    onOrdenar={alternarOrdenColumna}
                    className="num"
                  />
                </tr>
              </thead>
              <tbody>
                {cuentasVisibles.map((cuenta) => (
                  <FilaCuentaTabla
                    key={cuenta.id}
                    cuenta={cuenta}
                    perfil={perfilPorCuentaId.get(cuenta.id)}
                    onAbrir={abrirCuenta}
                  />
                ))}
              </tbody>
            </table>
          )}
          </div>
        </section>
      </div>

      <AltaUsuarioDialog
        abierto={altaAbierta}
        onCerrar={() => setAltaAbierta(false)}
        onCreado={async (familia) => {
          setAltaAbierta(false);
          await recargar();
          navigate(rutaListadoPorAlta(familia));
        }}
      />
    </section>
  );
}

function rutaListadoPorAlta(familia: FamiliaAlta): string {
  if (familia === "cliente") return "/admin/usuarios/clientes";
  if (familia === "administrador") return "/admin/usuarios/administradores";
  return "/admin/usuarios/negocio";
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
  if (lugar === "negocio") {
    return (
      cuenta.tipo_cuenta === "proveedor" ||
      cuenta.tipo_cuenta === "empresa" ||
      cuenta.tipo_cuenta === "negocio"
    );
  }
  return cuenta.tipo_cuenta === "proveedor";
}

function pasaBusquedaCuenta(cuenta: UsuarioLista, q: string) {
  const busqueda = q.trim().toLowerCase();
  if (!busqueda) return true;
  const perfil = nombrePerfilDeCuenta(cuenta);
  return `${cuenta.nombre} ${cuenta.correo} ${perfil} ${lugarCuenta(cuenta)}`.toLowerCase().includes(busqueda);
}

function compararCuentas(columna: ColumnaOrden, direccion: DireccionOrden, a: UsuarioLista, b: UsuarioLista) {
  const factor = direccion === "asc" ? 1 : -1;
  let base = 0;
  if (columna === "nombre") {
    base = a.nombre.localeCompare(b.nombre, "es");
  } else if (columna === "lugar") {
    base = lugarCuenta(a).localeCompare(lugarCuenta(b), "es");
  } else if (columna === "perfil") {
    base = nombrePerfilDeCuenta(a).localeCompare(nombrePerfilDeCuenta(b), "es");
  } else if (columna === "alta") {
    base = a.nombre.localeCompare(b.nombre, "es");
  } else {
    const marcasA = a.tipo_cuenta === "administrador" ? -1 : a.conteo_marcas;
    const marcasB = b.tipo_cuenta === "administrador" ? -1 : b.conteo_marcas;
    base = marcasA - marcasB || a.nombre.localeCompare(b.nombre, "es");
  }
  return base * factor || a.nombre.localeCompare(b.nombre, "es");
}

function CabeceraOrdenable({
  etiqueta,
  columna,
  columnaActiva,
  direccion,
  onOrdenar,
  className,
}: {
  etiqueta: string;
  columna: ColumnaOrden;
  columnaActiva: ColumnaOrden;
  direccion: DireccionOrden;
  onOrdenar: (columna: ColumnaOrden) => void;
  className?: string;
}) {
  const activa = columnaActiva === columna;
  const ariaSort = activa ? (direccion === "asc" ? "ascending" : "descending") : "none";
  return (
    <th scope="col" className={className} aria-sort={ariaSort}>
      <button type="button" className="th-orden" onClick={() => onOrdenar(columna)}>
        <span>{etiqueta}</span>
        {activa ? (
          <span className="th-orden-indicador" aria-hidden>
            {direccion === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
      </button>
    </th>
  );
}

