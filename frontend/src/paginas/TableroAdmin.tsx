import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { obtenerTableroAdmin, type InicioAdmin, type SerieAltas, type SerieComision } from "../api";
import "../tablero-admin.css";

type Nivel = "info" | "ok" | "medio" | "alto" | "critico";
type Escena = "solicitudes" | "usuarios";

const ETIQUETAS = ["1", "5", "10", "15", "20", "25", "30"];
const CEROS = Array.from({ length: 30 }, () => 0);

const SERIE_COMISION: SerieComision = {
  total: 0,
  base: 0,
  cierres: 0,
  serie: CEROS,
  etiquetas: ETIQUETAS,
};

const SERIE_ALTAS: SerieAltas = {
  total: 0,
  meta: "0 clientes · 0 proveedores",
  serie: CEROS,
  etiquetas: ETIQUETAS,
};

const VACIO: InicioAdmin = {
  nuevas_24h: 0,
  en_proceso: 0,
  rechazadas_7d: 0,
  porcentaje_con_cotizacion: null,
  categorias: [],
  comision: SERIE_COMISION,
  cotizaciones_total: 0,
  cotizaciones_aceptadas: 0,
  cotizaciones_rechazadas: 0,
  promedio_cotizaciones: 0,
  solicitudes_sobre_promedio: 0,
  plazos_hasta_6h: 0,
  plazos_6_a_12h: 0,
  plazos_12_a_24h: 0,
  plazos_vencidas: 0,
  clientes: 0,
  proveedores: 0,
  altas_30d: 0,
  en_baja: 0,
  crecimiento: SERIE_ALTAS,
  mix: [
    { nombre: "Clientes", altas: 0, crecimiento: { ...SERIE_ALTAS, meta: "Altas de clientes" } },
    { nombre: "Proveedores", altas: 0, crecimiento: { ...SERIE_ALTAS, meta: "Altas de proveedores" } },
  ],
  bloqueados: 0,
  en_riesgo: 0,
  marcas_30d: 0,
  reincidentes_24h: 0,
  promedio_calificacion: null,
  sin_calificar: 0,
  calificaciones_menores_2: 0,
  calificaciones_mayores_45: 0,
};

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function TableroAdmin() {
  const [datos, setDatos] = useState<InicioAdmin>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [mix, setMix] = useState<string | null>(null);
  const [escena, setEscena] = useState<Escena>("solicitudes");
  const viewport = useRef<HTMLDivElement>(null);
  const escenaSolicitudes = useRef<HTMLElement>(null);
  const escenaUsuarios = useRef<HTMLElement>(null);
  const escenaActual = useRef<Escena>("solicitudes");
  const animando = useRef(false);
  const irRef = useRef<(nombre: Escena) => void>(() => undefined);

  useEffect(() => {
    let activo = true;
    obtenerTableroAdmin()
      .then((respuesta) => {
        if (!activo) return;
        setDatos(respuesta.inicio);
        setCargando(false);
      })
      .catch((causa: unknown) => {
        if (!activo) return;
        setError(causa instanceof Error ? causa.message : "No se pudo consultar el inicio");
        setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  function irAEscena(nombre: Escena) {
    if (animando.current || escenaActual.current === nombre) return;
    animando.current = true;
    escenaActual.current = nombre;
    setEscena(nombre);
    const destino = nombre === "usuarios" ? escenaUsuarios.current : escenaSolicitudes.current;
    if (destino) destino.scrollTop = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(
      () => {
        animando.current = false;
      },
      reduce ? 0 : 360,
    );
  }

  irRef.current = irAEscena;

  useEffect(() => {
    const nodo = viewport.current;
    if (!nodo) return;

    function enTope(el: HTMLElement) {
      return el.scrollTop <= 2;
    }
    function enFondo(el: HTMLElement) {
      return el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    }
    function alRueda(evento: WheelEvent) {
      const activa =
        escenaActual.current === "usuarios" ? escenaUsuarios.current : escenaSolicitudes.current;
      if (!activa) return;
      if (animando.current) {
        evento.preventDefault();
        return;
      }
      if (evento.deltaY > 0 && escenaActual.current === "solicitudes" && enFondo(activa)) {
        evento.preventDefault();
        irRef.current("usuarios");
      } else if (evento.deltaY < 0 && escenaActual.current === "usuarios" && enTope(activa)) {
        evento.preventDefault();
        irRef.current("solicitudes");
      }
    }

    let toqueY: number | null = null;
    function alTocar(evento: TouchEvent) {
      toqueY = evento.changedTouches[0]?.clientY ?? null;
    }
    function alSoltar(evento: TouchEvent) {
      if (toqueY == null || animando.current) return;
      const dy = toqueY - (evento.changedTouches[0]?.clientY ?? toqueY);
      toqueY = null;
      if (Math.abs(dy) < 40) return;
      const activa =
        escenaActual.current === "usuarios" ? escenaUsuarios.current : escenaSolicitudes.current;
      if (!activa) return;
      if (dy > 0 && escenaActual.current === "solicitudes" && enFondo(activa)) irRef.current("usuarios");
      if (dy < 0 && escenaActual.current === "usuarios" && enTope(activa)) irRef.current("solicitudes");
    }

    nodo.addEventListener("wheel", alRueda, { passive: false });
    nodo.addEventListener("touchstart", alTocar, { passive: true });
    nodo.addEventListener("touchend", alSoltar, { passive: true });
    return () => {
      nodo.removeEventListener("wheel", alRueda);
      nodo.removeEventListener("touchstart", alTocar);
      nodo.removeEventListener("touchend", alSoltar);
    };
  }, []);

  const categoriaElegida = datos.categorias.find((item) => item.nombre === categoria) ?? null;
  const comision = categoriaElegida?.comision ?? datos.comision;
  const ambitoComision = categoriaElegida?.nombre ?? "Todas las categorías";
  const mixElegido = datos.mix.find((item) => item.nombre === mix) ?? null;
  const crecimiento = mixElegido?.crecimiento ?? datos.crecimiento;
  const ambitoCrecimiento = mixElegido?.nombre ?? null;
  const maxCategoria = Math.max(...datos.categorias.map((item) => item.solicitudes_abiertas), 1);
  const maxMix = Math.max(...datos.mix.map((item) => item.altas), 1);
  const umbralCotizaciones = Math.round(datos.promedio_cotizaciones);
  const texto = (valor: string | number) => (cargando ? "—" : valor);

  return (
    <section className="vista-inicio">
      <header className="cabecera-dash">
        <h1 className="marca">Nexora</h1>
      </header>
      {error ? <p className="error">{error}</p> : null}

      <div className="escenas-viewport" ref={viewport}>
        <section
          className={escena === "solicitudes" ? "escena escena-solicitudes activa" : "escena escena-solicitudes"}
          ref={escenaSolicitudes}
          aria-label="Solicitudes"
        >
          <button type="button" className="pista-scroll" aria-label="Ir a Usuarios" onClick={() => irAEscena("usuarios")}>
            <Chevron abajo />
            Usuarios
          </button>

          <div className="fila-arriba">
            <div className="col-arriba-izq">
              <section className="card celda-kpis" aria-labelledby="titulo-kpis">
                <div className="card-cab">
                  <h2 id="titulo-kpis">Solicitudes</h2>
                  <Link to="/admin/solicitudes" className="card-link">
                    Ver →
                  </Link>
                </div>
                <div className="kpis">
                  <Kpi etiqueta="Nuevas · 24 h" valor={texto(datos.nuevas_24h)} />
                  <Kpi etiqueta="En proceso" valor={texto(datos.en_proceso)} />
                  <Kpi etiqueta="Rechazadas · 7 d" valor={texto(datos.rechazadas_7d)} />
                  <Kpi
                    etiqueta="Con cotización"
                    valor={texto(
                      datos.porcentaje_con_cotizacion === null ? "—" : `${datos.porcentaje_con_cotizacion} %`,
                    )}
                  />
                </div>
              </section>

              <section className="card" aria-labelledby="titulo-categorias">
                <div className="card-cab">
                  <h2 id="titulo-categorias">Por categoría</h2>
                  <button type="button" className="card-link" onClick={() => setCategoria(null)}>
                    Todas
                  </button>
                </div>
                {!cargando && datos.categorias.length === 0 ? (
                  <p className="vacio">Aún no hay categorías. Se crean al dar de alta un proveedor.</p>
                ) : (
                  <div className="barras-cat">
                    {datos.categorias.map((item) => (
                      <button
                        key={item.nombre}
                        type="button"
                        className="barra-cat"
                        aria-pressed={categoria === item.nombre}
                        onClick={() => setCategoria((actual) => (actual === item.nombre ? null : item.nombre))}
                      >
                        <span title={item.nombre}>{item.nombre}</span>
                        <div className="barra-pista" aria-hidden="true">
                          <div
                            className="barra-lleno"
                            style={{ width: `${Math.round((item.solicitudes_abiertas / maxCategoria) * 100)}%` }}
                          />
                        </div>
                        <strong>{item.solicitudes_abiertas}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="card card-comision" aria-labelledby="titulo-comision">
              <div className="card-cab">
                <h2 id="titulo-comision">
                  {ambitoComision === "Todas las categorías" ? "Comisión · 30 días" : `Comisión · ${ambitoComision}`}
                </h2>
                <Link to="/admin/ingresos" className="card-link">
                  Ver Ingresos
                </Link>
              </div>
              <p className="comision-total">{texto(mxn.format(comision.total))}</p>
              <p className="comision-meta">
                {cargando
                  ? "Servicios cerrados · escala 5–9 %"
                  : `${mxn.format(comision.base)} base · ${comision.cierres} cierres · escala 5–9 % · ${ambitoComision}`}
              </p>
              <GraficaLinea
                serie={comision.serie}
                etiquetas={comision.etiquetas}
                etiqueta="Comisión de los últimos 30 días"
              />
            </section>
          </div>

          <div className="fila-abajo">
            <section className="card" aria-labelledby="titulo-cotizaciones">
              <div className="card-cab">
                <h2 id="titulo-cotizaciones">Cotizaciones</h2>
                <Link to="/admin/cotizaciones" className="card-link">
                  Ver →
                </Link>
              </div>
              <div className="riesgos-grid" data-cols="4">
                <Tile nivel="info" etiqueta="Cotizaciones" valor={texto(datos.cotizaciones_total)} />
                <Tile nivel="ok" etiqueta="Aceptadas" valor={texto(datos.cotizaciones_aceptadas)} />
                <Tile nivel="alto" etiqueta="Rechazadas" valor={texto(datos.cotizaciones_rechazadas)} />
                <Tile
                  nivel="medio"
                  etiqueta={`Con más de ${umbralCotizaciones}`}
                  valor={texto(datos.solicitudes_sobre_promedio)}
                />
              </div>
            </section>

            <section className="card" aria-labelledby="titulo-riesgos">
              <div className="card-cab">
                <h2 id="titulo-riesgos">Plazo de 24 h</h2>
              </div>
              <div className="riesgos-grid" data-cols="4">
                <Tile nivel="critico" etiqueta="≤ 6 h" valor={texto(datos.plazos_hasta_6h)} />
                <Tile nivel="alto" etiqueta="6–12 h" valor={texto(datos.plazos_6_a_12h)} />
                <Tile nivel="medio" etiqueta="12–24 h" valor={texto(datos.plazos_12_a_24h)} />
                <Tile nivel="info" etiqueta="Vencidas" valor={texto(datos.plazos_vencidas)} />
              </div>
            </section>
          </div>
        </section>

        <section
          className={escena === "usuarios" ? "escena escena-usuarios activa" : "escena escena-usuarios"}
          ref={escenaUsuarios}
          aria-label="Usuarios"
        >
          <button
            type="button"
            className="pista-scroll"
            aria-label="Ir a Solicitudes"
            onClick={() => irAEscena("solicitudes")}
          >
            <Chevron />
            Solicitudes
          </button>

          <div className="fila-arriba fila-usuarios-kpis">
            <section className="card celda-kpis" aria-labelledby="titulo-kpis-usuarios">
              <div className="card-cab">
                <h2 id="titulo-kpis-usuarios">Usuarios</h2>
                <Link to="/admin/usuarios" className="card-link">
                  Ver →
                </Link>
              </div>
              <div className="kpis">
                <Kpi etiqueta="Clientes" valor={texto(datos.clientes)} />
                <Kpi etiqueta="Proveedores" valor={texto(datos.proveedores)} />
                <Kpi etiqueta="Altas · 30 d" valor={texto(datos.altas_30d)} />
                <Kpi etiqueta="En baja" valor={texto(datos.en_baja)} />
              </div>
            </section>

            <section className="card celda-kpis" aria-labelledby="titulo-mix">
              <div className="card-cab">
                <h2 id="titulo-mix">Usuarios · 30 días</h2>
                <button type="button" className="card-link" onClick={() => setMix(null)}>
                  Todas
                </button>
              </div>
              <div className="barras-mix">
                {datos.mix.map((item) => (
                  <button
                    key={item.nombre}
                    type="button"
                    className="barra-mix"
                    aria-pressed={mix === item.nombre}
                    onClick={() => setMix((actual) => (actual === item.nombre ? null : item.nombre))}
                  >
                    <span>{item.nombre}</span>
                    <div className="barra-pista" aria-hidden="true">
                      <div className="barra-lleno" style={{ width: `${Math.round((item.altas / maxMix) * 100)}%` }} />
                    </div>
                    <strong>{item.altas}</strong>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="fila-arriba fila-usuarios-bento">
            <section className="card card-comision" aria-labelledby="titulo-crecimiento">
              <div className="card-cab card-cab-crecimiento">
                <h2 id="titulo-crecimiento">
                  {ambitoCrecimiento ? `Crecimiento · ${ambitoCrecimiento}` : "Crecimiento en la plataforma"}
                </h2>
                <div className="crecimiento-resumen">
                  <p className="comision-total">{texto(`+${crecimiento.total}`)}</p>
                  <p className="comision-meta">{crecimiento.meta} · últimos 30 días</p>
                </div>
              </div>
              <GraficaLinea
                serie={crecimiento.serie}
                etiquetas={crecimiento.etiquetas}
                etiqueta="Altas de perfiles en los últimos 30 días"
              />
            </section>

            <div className="col-usuarios-der">
              <section className="card" aria-labelledby="titulo-sanciones">
                <div className="card-cab">
                  <h2 id="titulo-sanciones">Sanciones y bloqueos</h2>
                  <Link to="/admin/sanciones" className="card-link">
                    Ver →
                  </Link>
                </div>
                <div className="riesgos-grid" data-cols="2">
                  <Tile nivel="critico" etiqueta="Bloqueados" valor={texto(datos.bloqueados)} />
                  <Tile nivel="alto" etiqueta="En riesgo 2/3" valor={texto(datos.en_riesgo)} />
                  <Tile nivel="medio" etiqueta="Marcas · 30 d" valor={texto(datos.marcas_30d)} />
                  <Tile nivel="info" etiqueta="Reinc. 24 h" valor={texto(datos.reincidentes_24h)} />
                </div>
              </section>

              <section className="card" aria-labelledby="titulo-calificaciones-inicio">
                <div className="card-cab">
                  <h2 id="titulo-calificaciones-inicio">Calificaciones</h2>
                  <Link to="/admin/calificaciones" className="card-link">
                    Ver →
                  </Link>
                </div>
                <div className="riesgos-grid" data-cols="2">
                  <Tile
                    nivel="ok"
                    etiqueta="Promedio"
                    valor={texto(
                      datos.promedio_calificacion === null ? "—" : datos.promedio_calificacion.toFixed(1),
                    )}
                  />
                  <Tile nivel="medio" etiqueta="Sin calificar" valor={texto(datos.sin_calificar)} />
                  <Tile nivel="alto" etiqueta="Menor a 2" valor={texto(datos.calificaciones_menores_2)} />
                  <Tile nivel="info" etiqueta="Mayor a 4.5" valor={texto(datos.calificaciones_mayores_45)} />
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function Kpi({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <article className="kpi">
      <span className="kpi-etiqueta">{etiqueta}</span>
      <strong>{valor}</strong>
    </article>
  );
}

function Tile({ nivel, etiqueta, valor }: { nivel: Nivel; etiqueta: string; valor: string | number }) {
  return (
    <article className="riesgo-tile" data-nivel={nivel}>
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
    </article>
  );
}

function Chevron({ abajo = false }: { abajo?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={abajo ? "m6 9 6 6 6-6" : "m18 15-6-6-6 6"} />
    </svg>
  );
}

function GraficaLinea({
  serie,
  etiquetas,
  etiqueta,
}: {
  serie: number[];
  etiquetas: string[];
  etiqueta: string;
}) {
  const valores = serie.length > 0 ? serie : [0];
  const w = 320;
  const h = 140;
  const pad = { t: 12, r: 8, b: 8, l: 8 };
  const max = Math.max(...valores, 1);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const pts = valores.map((valor, i) => {
    const x = pad.l + (i / Math.max(valores.length - 1, 1)) * innerW;
    const y = pad.t + (1 - valor / max) * innerH;
    return [x, y] as const;
  });
  const linea = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const ultimo = pts[pts.length - 1];
  const area = `${linea} L${ultimo[0].toFixed(1)},${h - pad.b} L${pts[0][0].toFixed(1)},${h - pad.b} Z`;
  const marcas = etiquetas.length > 0 ? etiquetas : ETIQUETAS;

  return (
    <>
      <svg className="chart-line" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={etiqueta}>
        <line className="eje" x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} />
        <path className="area" d={area} />
        <path className="linea" d={linea} />
        <circle className="punto" cx={ultimo[0].toFixed(1)} cy={ultimo[1].toFixed(1)} r="4.5" />
      </svg>
      <div className="chart-labels">
        {marcas.map((marca) => (
          <span key={marca}>{marca}</span>
        ))}
      </div>
    </>
  );
}
