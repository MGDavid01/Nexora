import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  aceptarSolicitudProveedor,
  denegarSolicitudProveedor,
  mercadoProveedor,
  type Solicitud,
} from "../../api";
import {
  AccionesFila,
  AvisoLista,
  BarraLista,
  BotonTexto,
  EstadoLista,
  FiltroLista,
  PieLista,
  VistaLista,
} from "../../vista-lista/VistaLista";
import { coincideBusqueda, marcaTiempo, ordenarPor, useOrden } from "../../vista-lista/orden";
import { fechaDia, horaCorta, tituloEstado } from "../../utilidades/formato";
import { MapaSolicitudes, type PinSolicitud } from "./MapaSolicitudes";
import "./proveedor-listas.css";

type ColSolicitud = "solicitud" | "categoria" | "ubicacion" | "creada" | "accion";

export function SolicitudesProveedor() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const orden = useOrden<ColSolicitud>("creada", "desc", ["creada"]);

  const recargar = useCallback(async () => {
    try {
      setLista(await mercadoProveedor());
      setError("");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo cargar el mercado");
    }
  }, []);

  useEffect(() => {
    void recargar().finally(() => setCargando(false));
  }, [recargar]);

  const enTijuana = useMemo(() => lista.filter((s) => esTijuana(s.ubicacion?.ciudad)), [lista]);

  const categorias = useMemo(
    () => [
      { valor: "todas", etiqueta: "Todas" },
      ...[...new Set(enTijuana.map((s) => s.categoria).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "es"))
        .map((c) => ({ valor: c, etiqueta: c })),
    ],
    [enTijuana],
  );

  const visibles = useMemo(
    () =>
      ordenarPor(
        enTijuana.filter(
          (s) =>
            (categoria === "todas" || s.categoria === categoria) &&
            coincideBusqueda(
              busqueda,
              s.titulo,
              s.descripcion,
              s.categoria,
              s.ubicacion?.colonia,
              s.ubicacion?.ciudad,
              s.ubicacion?.codigo_postal,
            ),
        ),
        orden,
        {
          solicitud: (s) => s.titulo,
          categoria: (s) => s.categoria,
          ubicacion: (s) => lugarSolicitud(s),
          creada: (s) => marcaTiempo(s.creado_en),
          accion: () => "",
        },
      ),
    [enTijuana, categoria, busqueda, orden],
  );

  const pines = useMemo(() => separarSolapes(visibles.map((s, i) => pinDe(s, i + 1))), [visibles]);

  useEffect(() => {
    if (seleccionada && !visibles.some((s) => s.id === seleccionada)) setSeleccionada(null);
  }, [visibles, seleccionada]);

  useEffect(() => {
    if (!seleccionada) return;
    document
      .querySelector<HTMLElement>(`[data-solicitud="${seleccionada}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [seleccionada]);

  function restablecer() {
    setBusqueda("");
    setCategoria("todas");
  }

  async function aceptar(s: Solicitud) {
    setAviso("");
    try {
      await aceptarSolicitudProveedor(s.id);
      navigate("/proveedor/servicios", { state: { cotizarId: s.id } });
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo aceptar");
    }
  }

  async function denegar(s: Solicitud) {
    setAviso("");
    try {
      await denegarSolicitudProveedor(s.id);
      setAviso("Solicitud denegada.");
      setSeleccionada((actual) => (actual === s.id ? null : actual));
      await recargar();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo denegar");
    }
  }

  return (
    <VistaLista
      className="sol-mapa-vista"
      titulo="Solicitudes del mercado"
      descripcion="Solo Tijuana. Acepta o deniega; si aceptas, cotizas en Servicios dentro de 24 horas."
    >
      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar título, categoría o colonia"
        onActualizar={recargar}
      >
        <FiltroLista
          id="filtro-categoria-solicitudes"
          etiqueta="Categoría"
          valor={categoria}
          opciones={categorias}
          onCambio={setCategoria}
        />
      </BarraLista>
      {error ? <AvisoLista tono="error">{error}</AvisoLista> : null}
      {!error && aviso ? <AvisoLista tono="ok">{aviso}</AvisoLista> : null}
      <div className="sol-mapa-cuerpo">
        <div className="sol-mapa">
          <MapaSolicitudes pines={pines} seleccionada={seleccionada} onSeleccionar={setSeleccionada} />
        </div>
        <aside className="sol-mapa-lista" aria-label="Solicitudes en Tijuana">
          {cargando ? (
            <EstadoLista>Cargando…</EstadoLista>
          ) : visibles.length === 0 ? (
            enTijuana.length === 0 ? (
              <EstadoLista>No hay solicitudes en Tijuana para tu perfil.</EstadoLista>
            ) : (
              <EstadoLista onRestablecer={restablecer}>
                {busqueda.trim()
                  ? `Ninguna solicitud coincide con «${busqueda.trim()}».`
                  : "Ninguna solicitud está en este filtro."}
              </EstadoLista>
            )
          ) : (
            <ul className="sol-mapa-items">
              {visibles.map((s, i) => (
                <li key={s.id}>
                  <article
                    data-solicitud={s.id}
                    className={s.id === seleccionada ? "sol-mapa-card sol-mapa-card-activa" : "sol-mapa-card"}
                  >
                    <button
                      type="button"
                      data-slot="sol-mapa-card"
                      className="sol-mapa-card-cuerpo"
                      onClick={() => setSeleccionada(s.id)}
                      aria-pressed={s.id === seleccionada}
                    >
                      <span className="sol-mapa-num" aria-hidden>
                        {i + 1}
                      </span>
                      <span className="sol-mapa-card-textos">
                        <strong>{s.titulo}</strong>
                        {s.descripcion ? <span className="sol-mapa-card-meta">{s.descripcion}</span> : null}
                        <span className="sol-mapa-card-lugar">
                          {s.categoria || "Sin categoría"}
                          {s.ubicacion?.colonia ? ` · ${s.ubicacion.colonia}` : ""}
                          {s.ubicacion?.codigo_postal ? ` · CP ${s.ubicacion.codigo_postal}` : ""}
                        </span>
                        <span className="sol-mapa-card-fecha">
                          {fechaDia(s.creado_en)}
                          {horaCorta(s.creado_en) ? ` · ${horaCorta(s.creado_en)}` : ""}
                        </span>
                      </span>
                    </button>
                    <AccionesFila>
                      <BotonTexto onClick={() => void aceptar(s)}>Aceptar</BotonTexto>
                      <BotonTexto peligro onClick={() => void denegar(s)}>
                        Denegar
                      </BotonTexto>
                    </AccionesFila>
                    {s.id === seleccionada ? (
                      <div className="sol-mapa-detalle">
                        <dl>
                          <div>
                            <dt>Dirección</dt>
                            <dd>
                              {[
                                s.ubicacion?.calle_numero,
                                s.ubicacion?.colonia,
                                s.ubicacion?.ciudad,
                                s.ubicacion?.estado,
                                s.ubicacion?.codigo_postal,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </dd>
                          </div>
                          <div>
                            <dt>Coordenadas</dt>
                            <dd>
                              {s.ubicacion?.latitud != null && s.ubicacion?.longitud != null
                                ? `${s.ubicacion.latitud}, ${s.ubicacion.longitud}`
                                : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt>Categoría</dt>
                            <dd>{s.categoria || "—"}</dd>
                          </div>
                          <div>
                            <dt>Creada</dt>
                            <dd>
                              {fechaDia(s.creado_en)}
                              {horaCorta(s.creado_en) ? ` · ${horaCorta(s.creado_en)}` : ""}
                            </dd>
                          </div>
                          <div>
                            <dt>Datos</dt>
                            <dd>{s.datos_cerrados ? "Cerrados" : "Abiertos"}</dd>
                          </div>
                          <div>
                            <dt>Tu participación</dt>
                            <dd>
                              {s.participacion_estado
                                ? tituloEstado(s.participacion_estado)
                                : "Sin participación"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    ) : null}
                  </article>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
      {!cargando ? (
        <PieLista>
          {visibles.length} en Tijuana
          {visibles.length !== enTijuana.length ? ` · ${enTijuana.length} en total` : ""}
        </PieLista>
      ) : null}
    </VistaLista>
  );
}

function esTijuana(ciudad?: string | null): boolean {
  return (ciudad ?? "").trim().toLowerCase() === "tijuana";
}

function lugarSolicitud(s: Solicitud): string {
  if (!s.ubicacion) return "";
  return [s.ubicacion.colonia, s.ubicacion.ciudad, s.ubicacion.codigo_postal].filter(Boolean).join(" ");
}

function pinDe(s: Solicitud, numero: number): PinSolicitud {
  const punto = coordsDe(s);
  return {
    id: s.id,
    numero,
    titulo: s.titulo,
    categoria: s.categoria,
    colonia: s.ubicacion?.colonia ?? "",
    lat: punto.lat,
    lng: punto.lng,
  };
}

function coordsDe(s: Solicitud): { lat: number; lng: number } {
  const lat = numero(s.ubicacion?.latitud);
  const lng = numero(s.ubicacion?.longitud);
  if (lat != null && lng != null) return { lat, lng };
  const colonia = (s.ubicacion?.colonia ?? "").trim().toLowerCase();
  const porColonia = COLONIA_COORDS[colonia];
  if (porColonia) return { lat: porColonia[0], lng: porColonia[1] };
  const porCp = CP_COORDS[s.ubicacion?.codigo_postal ?? ""];
  if (porCp) return { lat: porCp[0], lng: porCp[1] };
  return { lat: 32.5149, lng: -117.0382 };
}

function numero(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

function separarSolapes(pines: PinSolicitud[]): PinSolicitud[] {
  const grupos = new Map<string, PinSolicitud[]>();
  for (const pin of pines) {
    const clave = `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`;
    const grupo = grupos.get(clave) ?? [];
    grupo.push(pin);
    grupos.set(clave, grupo);
  }
  const separados: PinSolicitud[] = [];
  for (const grupo of grupos.values()) {
    if (grupo.length === 1) {
      separados.push(grupo[0]);
      continue;
    }
    grupo.forEach((pin, i) => {
      const angulo = (2 * Math.PI * i) / grupo.length;
      const radio = 0.0018;
      separados.push({
        ...pin,
        lat: pin.lat + Math.cos(angulo) * radio,
        lng: pin.lng + Math.sin(angulo) * radio,
      });
    });
  }
  return separados;
}

const COLONIA_COORDS: Record<string, [number, number]> = {
  "playas de tijuana": [32.5305, -117.1173],
  "otay constituyentes": [32.5476, -116.938],
  "zona centro": [32.5149, -117.0382],
  "zona río": [32.5301, -117.0198],
  "zona rio": [32.5301, -117.0198],
  "la mesa": [32.5024, -116.9782],
};

const CP_COORDS: Record<string, [number, number]> = {
  "22504": [32.5305, -117.1173],
  "22457": [32.5476, -116.938],
  "22000": [32.5149, -117.0382],
  "22010": [32.5301, -117.0198],
  "22650": [32.5024, -116.9782],
};
