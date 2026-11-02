import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listarTrabajosAdmin, type TrabajoLista } from "../api";
import "../usuarios-admin.css";
import "../trabajos-admin.css";

type FiltroEtapa = "" | "solicitud" | "cotizacion" | "servicio";
type FiltroReclamacion = "" | "abierta" | "cerrada";
type FiltroCierre = "" | "abierto" | "cerrado";
type FiltroMarca = "" | "con" | "sin";

const fechaCorta = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function FiltroDesplegable({
  clave,
  texto: etiqueta,
  abierto,
  activo,
  onToggle,
  children,
}: {
  clave: string;
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
        {etiqueta}
      </button>
      <div className="dd-panel" role="listbox">
        {children}
      </div>
    </div>
  );
}

function etiquetaEtapa(etapa: TrabajoLista["etapa"]): string {
  if (etapa === "solicitud") return "Solicitud";
  if (etapa === "cotizacion") return "Cotización";
  return "Servicio";
}

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return fechaCorta.format(d);
}

export function TrabajosAdmin() {
  const navigate = useNavigate();
  const [ddAbierto, setDdAbierto] = useState<string | null>(null);
  const [filtroEtapa, setFiltroEtapa] = useState<FiltroEtapa>("");
  const [filtroReclamacion, setFiltroReclamacion] = useState<FiltroReclamacion>("");
  const [filtroCierre, setFiltroCierre] = useState<FiltroCierre>("");
  const [filtroMarca, setFiltroMarca] = useState<FiltroMarca>("");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaApi, setBusquedaApi] = useState("");

  const [casos, setCasos] = useState<TrabajoLista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setBusquedaApi(busqueda.trim()), 320);
    return () => window.clearTimeout(t);
  }, [busqueda]);

  const filtrosApi = useMemo(
    () => ({
      etapa: filtroEtapa || undefined,
      reclamacion: filtroReclamacion || undefined,
      cierre: filtroCierre || undefined,
      marca: filtroMarca || undefined,
      q: busquedaApi || undefined,
    }),
    [filtroEtapa, filtroReclamacion, filtroCierre, filtroMarca, busquedaApi],
  );

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setErrorGlobal("");
    listarTrabajosAdmin(filtrosApi)
      .then((lista) => {
        if (vivo) setCasos(lista);
      })
      .catch((causa) => {
        if (vivo) {
          setErrorGlobal(causa instanceof Error ? causa.message : "No se pudieron cargar los casos");
          setCasos([]);
        }
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [filtrosApi]);

  useEffect(() => {
    function cerrarMenus(evento: MouseEvent) {
      if (!(evento.target as HTMLElement).closest?.(".dd-filtro")) {
        setDdAbierto(null);
      }
    }
    document.addEventListener("pointerdown", cerrarMenus);
    return () => document.removeEventListener("pointerdown", cerrarMenus);
  }, []);

  const hayFiltros = Boolean(
    filtroEtapa || filtroReclamacion || filtroCierre || filtroMarca || busquedaApi,
  );

  function abrirCaso(id: string) {
    navigate(`/admin/trabajos/${id}`);
  }

  return (
    <section className="vista-padron-crm vista-trabajos-crm" aria-labelledby="titulo-trabajos">
      <header className="crm-top">
        <div className="crm-titulo">
          <h1 id="titulo-trabajos">Trabajos</h1>
          <p className="crm-subtitulo">Solicitudes, cotizaciones, servicios y reclamaciones por caso.</p>
        </div>
      </header>

      {errorGlobal ? (
        <p className="error-crm" role="alert">
          {errorGlobal}
        </p>
      ) : null}

      <div className="crm-filtros" aria-label="Filtros de trabajos">
        <FiltroDesplegable
          clave="etapa"
          texto={
            filtroEtapa
              ? `Etapa: ${filtroEtapa === "solicitud" ? "Solicitud" : filtroEtapa === "cotizacion" ? "Cotización" : "Servicio"}`
              : "Etapa"
          }
          abierto={ddAbierto === "etapa"}
          activo={Boolean(filtroEtapa)}
          onToggle={() => setDdAbierto((d) => (d === "etapa" ? null : "etapa"))}
        >
          {[
            ["", "Todas"],
            ["solicitud", "Solicitud"],
            ["cotizacion", "Cotización"],
            ["servicio", "Servicio"],
          ].map(([valor, etiqueta]) => (
            <label key={valor || "todas"}>
              <input
                type="radio"
                name="filtro-etapa"
                checked={filtroEtapa === valor}
                onChange={() => setFiltroEtapa(valor as FiltroEtapa)}
              />
              {etiqueta}
            </label>
          ))}
        </FiltroDesplegable>

        <FiltroDesplegable
          clave="reclamacion"
          texto={
            filtroReclamacion
              ? `Reclamación: ${filtroReclamacion === "abierta" ? "Abierta" : "Cerrada"}`
              : "Reclamación"
          }
          abierto={ddAbierto === "reclamacion"}
          activo={Boolean(filtroReclamacion)}
          onToggle={() => setDdAbierto((d) => (d === "reclamacion" ? null : "reclamacion"))}
        >
          {[
            ["", "Todas"],
            ["abierta", "Abierta"],
            ["cerrada", "Cerrada"],
          ].map(([valor, etiqueta]) => (
            <label key={valor || "todas"}>
              <input
                type="radio"
                name="filtro-reclamacion"
                checked={filtroReclamacion === valor}
                onChange={() => setFiltroReclamacion(valor as FiltroReclamacion)}
              />
              {etiqueta}
            </label>
          ))}
        </FiltroDesplegable>

        <FiltroDesplegable
          clave="cierre"
          texto={
            filtroCierre
              ? `Estado: ${filtroCierre === "abierto" ? "Abierto" : "Cerrado"}`
              : "Estado del caso"
          }
          abierto={ddAbierto === "cierre"}
          activo={Boolean(filtroCierre)}
          onToggle={() => setDdAbierto((d) => (d === "cierre" ? null : "cierre"))}
        >
          {[
            ["", "Todos"],
            ["abierto", "Abierto"],
            ["cerrado", "Cerrado"],
          ].map(([valor, etiqueta]) => (
            <label key={valor || "todos"}>
              <input
                type="radio"
                name="filtro-cierre"
                checked={filtroCierre === valor}
                onChange={() => setFiltroCierre(valor as FiltroCierre)}
              />
              {etiqueta}
            </label>
          ))}
        </FiltroDesplegable>

        <FiltroDesplegable
          clave="marca"
          texto={
            filtroMarca
              ? `Marca del caso: ${filtroMarca === "con" ? "Con marca" : "Sin marca"}`
              : "Marca del caso"
          }
          abierto={ddAbierto === "marca"}
          activo={Boolean(filtroMarca)}
          onToggle={() => setDdAbierto((d) => (d === "marca" ? null : "marca"))}
        >
          {[
            ["", "Todas"],
            ["con", "Con marca"],
            ["sin", "Sin marca"],
          ].map(([valor, etiqueta]) => (
            <label key={valor || "todas"}>
              <input
                type="radio"
                name="filtro-marca"
                checked={filtroMarca === valor}
                onChange={() => setFiltroMarca(valor as FiltroMarca)}
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
            placeholder="Buscar caso, cliente o categoría"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            autoComplete="off"
          />
        </label>
      </div>

      <div className="tablero-crm tablero-trabajos tablero-trabajos-solo">
        <section className="crm-panel tabla-completa" aria-label="Lista de casos">
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Caso</th>
                  <th scope="col">Etapa</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Creado</th>
                  <th scope="col">Reclamación</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr className="fila-vacia">
                    <td colSpan={6}>
                      <p className="crm-cargando">Cargando casos…</p>
                    </td>
                  </tr>
                ) : casos.length === 0 ? (
                  <tr className="fila-vacia">
                    <td colSpan={6}>
                      <p className="crm-cargando">
                        {hayFiltros ? "Sin casos con estos filtros." : "Aún no hay casos que mostrar."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  casos.map((c) => (
                    <tr
                      key={c.solicitud_id}
                      className="fila-caso-clic"
                      tabIndex={0}
                      role="link"
                      onClick={() => abrirCaso(c.solicitud_id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          abrirCaso(c.solicitud_id);
                        }
                      }}
                    >
                      <td>
                        <span className="btn-caso-trabajo">{c.titulo}</span>
                      </td>
                      <td>
                        <span className="chip-trabajo">{etiquetaEtapa(c.etapa)}</span>
                      </td>
                      <td>{c.cliente}</td>
                      <td>{c.categoria}</td>
                      <td>{formatearFecha(c.creado_en)}</td>
                      <td>
                        {c.reclamacion === "abierta" ? (
                          <span className="chip-trabajo alerta">Abierta</span>
                        ) : c.reclamacion === "cerrada" ? (
                          <span className="chip-trabajo ok">Cerrada</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="crm-pie">
            <span>
              {casos.length} en esta vista
              {cargando ? " · actualizando…" : ""}
            </span>
          </div>
        </section>
      </div>
    </section>
  );
}
