import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as PunteroReact, type ReactNode } from "react";
import {
  LuArrowUpRight,
  LuBan,
  LuCircleCheck,
  LuCircleX,
  LuFileCheck,
  LuFlag,
  LuInbox,
  LuRepeat,
  LuShieldAlert,
  LuStar,
  LuTimer,
  LuTriangleAlert,
  LuUserMinus,
  LuUserPlus,
  LuUsers,
  LuWrench,
} from "react-icons/lu";
import { Link } from "react-router-dom";
import { useAdminTopbarAcciones, useAdminTopbarTitulo } from "../admin/AdminTopbar";
import { obtenerTableroAdmin, type InicioAdmin, type SerieAltas, type SerieComision, type VigilanciaPerfilItem } from "../api";
import "../tablero-admin.css";

type Escena = "operacion" | "comunidad";
type Tono = "acento" | "info" | "ok" | "medio" | "alto" | "critico" | "neutro";

const ETIQUETAS = ["1", "5", "10", "15", "20", "25", "30"];
const CEROS = Array.from({ length: 30 }, () => 0);

const SERIE_COMISION: SerieComision = { total: 0, base: 0, cierres: 0, serie: CEROS, etiquetas: ETIQUETAS };
const SERIE_ALTAS: SerieAltas = { total: 0, meta: "0 clientes · 0 proveedores", serie: CEROS, etiquetas: ETIQUETAS };

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

/* Datos de muestra para previsualizar el diseño sin backend: /inicio?demo=1 (solo en dev) */
function datosDemo(): InicioAdmin {
  const onda = (base: number, amp: number, fase: number) =>
    Array.from({ length: 30 }, (_, i) => Math.max(0, Math.round(base + amp * Math.sin(i / 3.1 + fase) + amp * 0.4 * Math.sin(i / 1.7))));
  const altas = onda(4, 3, 1);
  return {
    nuevas_24h: 12,
    en_proceso: 31,
    rechazadas_7d: 4,
    porcentaje_con_cotizacion: 78,
    categorias: [
      { nombre: "Plomería", solicitudes_abiertas: 14, comision: { total: 4820, base: 60300, cierres: 21, serie: onda(160, 90, 0), etiquetas: ETIQUETAS } },
      { nombre: "Electricidad", solicitudes_abiertas: 9, comision: { total: 3510, base: 45100, cierres: 15, serie: onda(120, 70, 2), etiquetas: ETIQUETAS } },
      { nombre: "Carpintería", solicitudes_abiertas: 6, comision: { total: 2140, base: 26800, cierres: 8, serie: onda(80, 50, 4), etiquetas: ETIQUETAS } },
      { nombre: "Pintura", solicitudes_abiertas: 4, comision: { total: 1290, base: 16200, cierres: 5, serie: onda(45, 30, 3), etiquetas: ETIQUETAS } },
      { nombre: "Climatización", solicitudes_abiertas: 3, comision: { total: 980, base: 12400, cierres: 4, serie: onda(35, 25, 5), etiquetas: ETIQUETAS } },
    ],
    comision: { total: 12740, base: 160800, cierres: 53, serie: onda(430, 210, 0.6), etiquetas: ETIQUETAS },
    cotizaciones_total: 128,
    cotizaciones_aceptadas: 61,
    cotizaciones_rechazadas: 22,
    promedio_cotizaciones: 3.4,
    solicitudes_sobre_promedio: 9,
    plazos_hasta_6h: 2,
    plazos_6_a_12h: 5,
    plazos_12_a_24h: 8,
    plazos_vencidas: 3,
    clientes: 184,
    proveedores: 37,
    altas_30d: 26,
    en_baja: 2,
    crecimiento: { total: 26, meta: "19 clientes · 7 proveedores", serie: altas, etiquetas: ETIQUETAS },
    mix: [
      { nombre: "Clientes", altas: 19, crecimiento: { total: 19, meta: "Altas de clientes", serie: onda(3, 2, 0.5), etiquetas: ETIQUETAS } },
      { nombre: "Proveedores", altas: 7, crecimiento: { total: 7, meta: "Altas de proveedores", serie: onda(1, 1, 2.2), etiquetas: ETIQUETAS } },
    ],
    bloqueados: 1,
    en_riesgo: 3,
    marcas_30d: 11,
    reincidentes_24h: 2,
    promedio_calificacion: 4.3,
    sin_calificar: 18,
    calificaciones_menores_2: 4,
    calificaciones_mayores_45: 52,
  };
}

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const entero = new Intl.NumberFormat("es-MX");

function tendencia(serie: number[]): number | null {
  if (serie.length < 14) return null;
  const prev = serie.slice(-14, -7).reduce((a, b) => a + b, 0);
  const actual = serie.slice(-7).reduce((a, b) => a + b, 0);
  if (prev <= 0) return null;
  return Math.round(((actual - prev) / prev) * 100);
}

function trayectoriaSuave(pts: readonly (readonly [number, number])[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

export function TableroAdmin() {
  const [datos, setDatos] = useState<InicioAdmin>(VACIO);
  const [vigilancia, setVigilancia] = useState<VigilanciaPerfilItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [mix, setMix] = useState<string | null>(null);
  const [escena, setEscena] = useState<Escena>("operacion");

  useEffect(() => {
    let activo = true;
    const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has("demo");
    const fuente = demo
      ? new Promise<{ inicio: InicioAdmin; vigilancia?: VigilanciaPerfilItem[] }>((resuelve) =>
          window.setTimeout(() => resuelve({ inicio: datosDemo(), vigilancia: [] }), 500),
        )
      : obtenerTableroAdmin();
    fuente
      .then((respuesta) => {
        if (!activo) return;
        setDatos(respuesta.inicio);
        setVigilancia(respuesta.vigilancia ?? []);
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

  const categoriaElegida = datos.categorias.find((item) => item.nombre === categoria) ?? null;
  const comision = categoriaElegida?.comision ?? datos.comision;
  const ambitoComision = categoriaElegida?.nombre ?? "Todas las categorías";
  const mixElegido = datos.mix.find((item) => item.nombre === mix) ?? null;
  const crecimiento = mixElegido?.crecimiento ?? datos.crecimiento;
  const maxCategoria = Math.max(...datos.categorias.map((item) => item.solicitudes_abiertas), 1);
  const umbralCotizaciones = Math.round(datos.promedio_cotizaciones);
  const deltaComision = tendencia(comision.serie);
  const deltaCrecimiento = tendencia(crecimiento.serie);

  const decididas = datos.cotizaciones_aceptadas + datos.cotizaciones_rechazadas;
  const tasaAceptacion = decididas > 0 ? Math.round((datos.cotizaciones_aceptadas / decididas) * 100) : null;
  const plazosTotal = datos.plazos_hasta_6h + datos.plazos_6_a_12h + datos.plazos_12_a_24h + datos.plazos_vencidas;

  const fecha = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const fechaTexto = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  useAdminTopbarTitulo("Panel de control");

  const accionesTopbar = useMemo(
    () => (
      <div className="dash-top-lado">
        <p className="dash-fecha">{fechaTexto}</p>
        <div className="segmentado" role="tablist" aria-label="Secciones del panel">
          <button
            type="button"
            role="tab"
            aria-selected={escena === "operacion"}
            className={escena === "operacion" ? "activo" : ""}
            onClick={() => setEscena("operacion")}
          >
            Operación
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={escena === "comunidad"}
            className={escena === "comunidad" ? "activo" : ""}
            onClick={() => setEscena("comunidad")}
          >
            Comunidad
          </button>
        </div>
      </div>
    ),
    [escena, fechaTexto],
  );
  useAdminTopbarAcciones(accionesTopbar);

  const alertas: { tono: Tono; texto: string; a: string }[] = [];
  const n = (cantidad: number, singular: string, plural: string) => `${cantidad} ${cantidad === 1 ? singular : plural}`;
  if (datos.plazos_vencidas > 0)
    alertas.push({ tono: "critico", texto: `${n(datos.plazos_vencidas, "vencida", "vencidas")} sin cotizar`, a: "/admin/trabajos" });
  if (datos.plazos_hasta_6h > 0)
    alertas.push({ tono: "alto", texto: `${n(datos.plazos_hasta_6h, "vence", "vencen")} en menos de 6 h`, a: "/admin/trabajos" });
  if (datos.reincidentes_24h > 0)
    alertas.push({ tono: "alto", texto: `${n(datos.reincidentes_24h, "reincidencia", "reincidencias")} en 24 h`, a: "/admin/usuarios" });
  if (datos.en_riesgo > 0) {
    const enRiesgo = vigilancia.filter((perfil) => !perfil.bloqueado && perfil.conteo_marcas === 2);
    const tiposCompletos = enRiesgo.length === datos.en_riesgo;
    const soloProveedores =
      tiposCompletos && enRiesgo.length > 0 && enRiesgo.every((perfil) => perfil.tipo_perfil.startsWith("Proveedor"));
    const soloClientes =
      tiposCompletos && enRiesgo.length > 0 && enRiesgo.every((perfil) => perfil.tipo_perfil.startsWith("Cliente"));
    const texto =
      tiposCompletos && enRiesgo.length === 1
        ? `${enRiesgo[0].nombre} en riesgo 2/3`
        : soloProveedores
          ? `${n(datos.en_riesgo, "empresa", "empresas")} en riesgo 2/3`
          : soloClientes
            ? `${n(datos.en_riesgo, "cliente", "clientes")} en riesgo 2/3`
            : `${n(datos.en_riesgo, "perfil", "perfiles")} en riesgo 2/3`;
    const a = soloProveedores
      ? "/admin/usuarios/negocio?tab=marca"
      : soloClientes
        ? "/admin/usuarios/clientes?tab=marca"
        : "/admin/usuarios";
    alertas.push({ tono: "alto", texto, a });
  }
  if (datos.calificaciones_menores_2 > 0)
    alertas.push({ tono: "medio", texto: `${n(datos.calificaciones_menores_2, "servicio", "servicios")} bajo 2 ★`, a: "/admin/trabajos" });

  return (
    <section className="hub-page vista-inicio">
      {error ? <p className="error">{error}</p> : null}

      <div className="cinta" aria-label="Estado general">
        {cargando ? (
          <>
            <span className="hueso hueso-chip" />
            <span className="hueso hueso-chip" />
            <span className="hueso hueso-chip" />
          </>
        ) : alertas.length > 0 ? (
          alertas.map((alerta) => (
            <Link key={alerta.texto} to={alerta.a} className="chip" data-tono={alerta.tono}>
              <LuTriangleAlert aria-hidden />
              {alerta.texto}
              <LuArrowUpRight aria-hidden className="chip-flecha" />
            </Link>
          ))
        ) : (
          <span className="chip chip-plano" data-tono="ok">
            <LuCircleCheck aria-hidden />
            Operación estable · sin pendientes críticos
          </span>
        )}
      </div>

      <div className="escenas">
        {/* ───────────────────────── Operación ───────────────────────── */}
        <div className={escena === "operacion" ? "escena activa" : "escena"} role="tabpanel" aria-label="Operación">
          <div className="stats">
            <Stat icono={<LuInbox aria-hidden />} etiqueta="Nuevas" valor={datos.nuevas_24h} pie="últimas 24 horas" tono="info" cargando={cargando} retraso={0} />
            <Stat icono={<LuTimer aria-hidden />} etiqueta="En proceso" valor={datos.en_proceso} pie="abiertas en la plataforma" tono="acento" cargando={cargando} retraso={40} />
            <Stat icono={<LuCircleX aria-hidden />} etiqueta="Rechazadas" valor={datos.rechazadas_7d} pie="últimos 7 días" tono={datos.rechazadas_7d > 0 ? "critico" : "neutro"} cargando={cargando} retraso={80} />
            <Stat
              icono={<LuFileCheck aria-hidden />}
              etiqueta="Con cotización"
              valor={datos.porcentaje_con_cotizacion === null ? "—" : `${datos.porcentaje_con_cotizacion}%`}
              pie="de las solicitudes abiertas"
              tono="ok"
              cargando={cargando}
              retraso={120}
            />
          </div>

          <div className="zona-principal">
            <article className="card card-hero aparece" style={{ "--d": "140ms" } as CSSProperties}>
              <header className="card-cab">
                <div className="card-titulos">
                  <h2>Comisión</h2>
                  <p>{ambitoComision} · últimos 30 días</p>
                </div>
                <Link to="/admin/ingresos" className="card-link">
                  Ingresos <LuArrowUpRight aria-hidden />
                </Link>
              </header>
              {cargando ? (
                <div className="hero-cuerpo">
                  <span className="hueso hueso-titular" />
                  <span className="hueso hueso-linea" />
                  <span className="hueso hueso-grafica" />
                </div>
              ) : (
                <div className="hero-cuerpo">
                  <div className="hero-titular">
                    <strong className="hero-total">{mxn.format(comision.total)}</strong>
                    {deltaComision !== null ? (
                      <span className="delta" data-sube={deltaComision >= 0}>
                        {deltaComision >= 0 ? "▲" : "▼"} {Math.abs(deltaComision)}%
                        <small>vs. semana anterior</small>
                      </span>
                    ) : null}
                  </div>
                  <p className="hero-meta">
                    {mxn.format(comision.base)} en base · {comision.cierres} cierres · escala 5–9 %
                  </p>
                  <GraficaArea serie={comision.serie} etiquetas={comision.etiquetas} tono="acento" formato={(v) => mxn.format(v)} etiqueta="Comisión diaria de los últimos 30 días" />
                </div>
              )}
            </article>

            <div className="columna-lado">
              <article className="card aparece" style={{ "--d": "180ms" } as CSSProperties}>
                <header className="card-cab">
                  <div className="card-titulos">
                    <h2>Categorías</h2>
                    <p>{categoriaElegida ? `Filtrando: ${categoriaElegida.nombre}` : "Solicitudes abiertas"}</p>
                  </div>
                  {categoriaElegida ? (
                    <button type="button" className="card-link" onClick={() => setCategoria(null)}>
                      Todas
                    </button>
                  ) : null}
                </header>
                {!cargando && datos.categorias.length === 0 ? (
                  <p className="vacio">Aún no hay categorías. Se crean al dar de alta un proveedor.</p>
                ) : (
                  <div className="lista-barras">
                    {(cargando ? Array.from({ length: 5 }, (_, i) => ({ nombre: `cat-${i}`, solicitudes_abiertas: 0 })) : datos.categorias).map((item, i) =>
                      cargando ? (
                        <span key={item.nombre} className="hueso hueso-fila" />
                      ) : (
                        <button
                          key={item.nombre}
                          type="button"
                          className="barra-fila"
                          aria-pressed={categoria === item.nombre}
                          onClick={() => setCategoria((actual) => (actual === item.nombre ? null : item.nombre))}
                        >
                          <span className="barra-rango">{String(i + 1).padStart(2, "0")}</span>
                          <span className="barra-nombre" title={item.nombre}>{item.nombre}</span>
                          <span className="barra-pista" aria-hidden="true">
                            <span className="barra-lleno" style={{ width: `${Math.round((item.solicitudes_abiertas / maxCategoria) * 100)}%` }} />
                          </span>
                          <strong>{item.solicitudes_abiertas}</strong>
                        </button>
                      ),
                    )}
                  </div>
                )}
              </article>

              <article className="card aparece" style={{ "--d": "220ms" } as CSSProperties}>
                <header className="card-cab">
                  <div className="card-titulos">
                    <h2>Plazo de 24 h</h2>
                    <p>Tiempo restante para cotizar</p>
                  </div>
                  <Link to="/admin/trabajos" className="card-link">
                    Ver <LuArrowUpRight aria-hidden />
                  </Link>
                </header>
                {cargando ? (
                  <>
                    <span className="hueso hueso-pista" />
                    <span className="hueso hueso-linea" />
                  </>
                ) : plazosTotal === 0 ? (
                  <p className="vacio">Sin solicitudes esperando cotización.</p>
                ) : (
                  <>
                    <div className="plazo-pista" role="img" aria-label={`${plazosTotal} solicitudes por cotizar`}>
                      {([
                        ["critico", datos.plazos_hasta_6h],
                        ["alto", datos.plazos_6_a_12h],
                        ["medio", datos.plazos_12_a_24h],
                        ["neutro", datos.plazos_vencidas],
                      ] as [Tono, number][])
                        .filter(([, valor]) => valor > 0)
                        .map(([tono, valor]) => (
                          <span key={tono} data-tono={tono} style={{ width: `${(valor / plazosTotal) * 100}%` }} />
                        ))}
                    </div>
                    <ul className="plazo-leyenda">
                      <li data-tono="critico"><i />≤ 6 h<strong>{datos.plazos_hasta_6h}</strong></li>
                      <li data-tono="alto"><i />6–12 h<strong>{datos.plazos_6_a_12h}</strong></li>
                      <li data-tono="medio"><i />12–24 h<strong>{datos.plazos_12_a_24h}</strong></li>
                      <li data-tono="neutro"><i />Vencidas<strong>{datos.plazos_vencidas}</strong></li>
                    </ul>
                  </>
                )}
              </article>
            </div>
          </div>

          <article className="card card-franja aparece" style={{ "--d": "260ms" } as CSSProperties}>
            <header className="card-cab">
              <div className="card-titulos">
                <h2>Cotizaciones</h2>
                <p>Todas las emitidas en la plataforma</p>
              </div>
              <Link to="/admin/trabajos" className="card-link">
                Ver <LuArrowUpRight aria-hidden />
              </Link>
            </header>
            {cargando ? (
              <div className="franja-cuerpo">
                <span className="hueso hueso-anillo" />
                <span className="hueso hueso-bloque" />
              </div>
            ) : (
              <div className="franja-cuerpo">
                <Anillo
                  centroValor={tasaAceptacion === null ? "—" : `${tasaAceptacion}%`}
                  centroEtiqueta="aceptación"
                  segmentos={[
                    { tono: "ok", valor: datos.cotizaciones_aceptadas },
                    { tono: "critico", valor: datos.cotizaciones_rechazadas },
                  ]}
                />
                <div className="franja-stats">
                  <MiniStat etiqueta="Emitidas" valor={datos.cotizaciones_total} tono="info" />
                  <MiniStat etiqueta="Aceptadas" valor={datos.cotizaciones_aceptadas} tono="ok" />
                  <MiniStat etiqueta="Rechazadas" valor={datos.cotizaciones_rechazadas} tono="critico" />
                  <MiniStat etiqueta={`Con más de ${umbralCotizaciones}`} valor={datos.solicitudes_sobre_promedio} tono="medio" />
                </div>
              </div>
            )}
          </article>
        </div>

        {/* ───────────────────────── Comunidad ───────────────────────── */}
        <div className={escena === "comunidad" ? "escena activa" : "escena"} role="tabpanel" aria-label="Comunidad">
          <div className="stats">
            <Stat icono={<LuUsers aria-hidden />} etiqueta="Clientes" valor={datos.clientes} pie="perfiles registrados" tono="info" cargando={cargando} retraso={0} />
            <Stat icono={<LuWrench aria-hidden />} etiqueta="Proveedores" valor={datos.proveedores} pie="perfiles registrados" tono="acento" cargando={cargando} retraso={40} />
            <Stat icono={<LuUserPlus aria-hidden />} etiqueta="Altas" valor={datos.altas_30d} pie="últimos 30 días" tono="ok" cargando={cargando} retraso={80} />
            <Stat icono={<LuUserMinus aria-hidden />} etiqueta="En baja" valor={datos.en_baja} pie="en proceso de salida" tono={datos.en_baja > 0 ? "alto" : "neutro"} cargando={cargando} retraso={120} />
          </div>

          <div className="zona-principal">
            <article className="card card-hero aparece" style={{ "--d": "140ms" } as CSSProperties}>
              <header className="card-cab">
                <div className="card-titulos">
                  <h2>Crecimiento</h2>
                  <p>{mixElegido ? mixElegido.nombre : "Toda la plataforma"} · últimos 30 días</p>
                </div>
                <div className="segmentado segmentado-mini" role="group" aria-label="Filtrar por tipo de perfil">
                  <button type="button" className={mix === null ? "activo" : ""} aria-pressed={mix === null} onClick={() => setMix(null)}>
                    Todos
                  </button>
                  {datos.mix.map((item) => (
                    <button
                      key={item.nombre}
                      type="button"
                      className={mix === item.nombre ? "activo" : ""}
                      aria-pressed={mix === item.nombre}
                      onClick={() => setMix((actual) => (actual === item.nombre ? null : item.nombre))}
                    >
                      {item.nombre}
                    </button>
                  ))}
                </div>
              </header>
              {cargando ? (
                <div className="hero-cuerpo">
                  <span className="hueso hueso-titular" />
                  <span className="hueso hueso-linea" />
                  <span className="hueso hueso-grafica" />
                </div>
              ) : (
                <div className="hero-cuerpo">
                  <div className="hero-titular">
                    <strong className="hero-total">+{entero.format(crecimiento.total)}</strong>
                    {deltaCrecimiento !== null ? (
                      <span className="delta" data-sube={deltaCrecimiento >= 0}>
                        {deltaCrecimiento >= 0 ? "▲" : "▼"} {Math.abs(deltaCrecimiento)}%
                        <small>vs. semana anterior</small>
                      </span>
                    ) : null}
                  </div>
                  <p className="hero-meta">{crecimiento.meta} · altas de perfiles</p>
                  <GraficaArea serie={crecimiento.serie} etiquetas={crecimiento.etiquetas} tono="ok" formato={(v) => `${entero.format(v)} altas`} etiqueta="Altas diarias de los últimos 30 días" />
                </div>
              )}
            </article>

            <article className="card aparece" style={{ "--d": "180ms" } as CSSProperties}>
              <header className="card-cab">
                <div className="card-titulos">
                  <h2>Sanciones y bloqueos</h2>
                  <p>Salud de la comunidad</p>
                </div>
                <Link to="/admin/usuarios" className="card-link">
                  Ver <LuArrowUpRight aria-hidden />
                </Link>
              </header>
              {cargando ? (
                <div className="rejilla-tiles">
                  <span className="hueso hueso-tile" />
                  <span className="hueso hueso-tile" />
                  <span className="hueso hueso-tile" />
                  <span className="hueso hueso-tile" />
                </div>
              ) : (
                <div className="rejilla-tiles">
                  <Tile icono={<LuBan aria-hidden />} tono="critico" etiqueta="Bloqueados" valor={datos.bloqueados} />
                  <Tile icono={<LuShieldAlert aria-hidden />} tono="alto" etiqueta="En riesgo 2/3" valor={datos.en_riesgo} />
                  <Tile icono={<LuFlag aria-hidden />} tono="medio" etiqueta="Marcas · 30 d" valor={datos.marcas_30d} />
                  <Tile icono={<LuRepeat aria-hidden />} tono="info" etiqueta="Reinc. 24 h" valor={datos.reincidentes_24h} />
                </div>
              )}
            </article>
          </div>

          <article className="card card-franja aparece" style={{ "--d": "220ms" } as CSSProperties}>
            <header className="card-cab">
              <div className="card-titulos">
                <h2>Calificaciones</h2>
                <p>Servicios cerrados con evaluación</p>
              </div>
              <Link to="/admin/trabajos" className="card-link">
                Ver <LuArrowUpRight aria-hidden />
              </Link>
            </header>
            {cargando ? (
              <div className="franja-cuerpo">
                <span className="hueso hueso-anillo" />
                <span className="hueso hueso-bloque" />
              </div>
            ) : (
              <div className="franja-cuerpo">
                <Medidor valor={datos.promedio_calificacion} />
                <div className="franja-stats">
                  <MiniStat etiqueta="Sin calificar" valor={datos.sin_calificar} tono="medio" />
                  <MiniStat etiqueta="Menor a 2" valor={datos.calificaciones_menores_2} tono="alto" />
                  <MiniStat etiqueta="Mayor a 4.5" valor={datos.calificaciones_mayores_45} tono="ok" />
                </div>
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Piezas ─────────────────────────── */

function Stat({
  icono,
  etiqueta,
  valor,
  pie,
  tono,
  cargando,
  retraso,
}: {
  icono: ReactNode;
  etiqueta: string;
  valor: string | number;
  pie: string;
  tono: Tono;
  cargando: boolean;
  retraso: number;
}) {
  return (
    <article className="stat aparece" data-tono={tono} style={{ "--d": `${retraso}ms` } as CSSProperties}>
      <span className="stat-icono" aria-hidden>{icono}</span>
      <div className="stat-datos">
        <span className="stat-etiqueta">{etiqueta}</span>
        {cargando ? <span className="hueso hueso-valor" /> : <strong className="stat-valor">{typeof valor === "number" ? entero.format(valor) : valor}</strong>}
        <span className="stat-pie">{pie}</span>
      </div>
    </article>
  );
}

function MiniStat({ etiqueta, valor, tono }: { etiqueta: string; valor: number; tono: Tono }) {
  return (
    <div className="mini-stat" data-tono={tono}>
      <span>{etiqueta}</span>
      <strong>{entero.format(valor)}</strong>
    </div>
  );
}

function Tile({ icono, tono, etiqueta, valor }: { icono: ReactNode; tono: Tono; etiqueta: string; valor: number }) {
  return (
    <div className="tile" data-tono={tono}>
      <span className="tile-icono" aria-hidden>{icono}</span>
      <strong>{entero.format(valor)}</strong>
      <span className="tile-etiqueta">{etiqueta}</span>
    </div>
  );
}

function GraficaArea({
  serie,
  etiquetas,
  tono,
  formato,
  etiqueta,
}: {
  serie: number[];
  etiquetas: string[];
  tono: "acento" | "ok";
  formato: (valor: number) => string;
  etiqueta: string;
}) {
  const id = useId();
  const caja = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const valores = serie.length > 0 ? serie : [0];
  const w = 640;
  const h = 190;
  const pad = { t: 14, r: 10, b: 10, l: 10 };
  const max = Math.max(...valores, 1);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const pts = valores.map((valor, i) => {
    const x = pad.l + (i / Math.max(valores.length - 1, 1)) * innerW;
    const y = pad.t + (1 - valor / max) * innerH;
    return [x, y] as const;
  });
  const linea = trayectoriaSuave(pts);
  const ultimo = pts[pts.length - 1];
  const area = `${linea} L${ultimo[0].toFixed(2)},${h - pad.b} L${pts[0][0].toFixed(2)},${h - pad.b} Z`;
  const marcas = etiquetas.length > 0 ? etiquetas : ETIQUETAS;

  function alMover(evento: PunteroReact<SVGRectElement>) {
    const cajaSvg = evento.currentTarget.ownerSVGElement;
    if (!cajaSvg) return;
    const rect = cajaSvg.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = ((evento.clientX - rect.left) / rect.width) * w;
    const i = Math.round(((x - pad.l) / innerW) * (valores.length - 1));
    setHover(Math.min(Math.max(i, 0), valores.length - 1));
  }

  const punto = hover === null ? null : pts[hover];

  return (
    <div className="grafica" data-tono={tono} ref={caja}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={etiqueta}>
        <defs>
          <linearGradient id={`${id}-relleno`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="grad-a" />
            <stop offset="100%" className="grad-b" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} className="rejilla" x1={pad.l} y1={pad.t + innerH * f} x2={w - pad.r} y2={pad.t + innerH * f} />
        ))}
        <line className="eje" x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} />
        <path className="area" d={area} fill={`url(#${id}-relleno)`} />
        <path className="linea" d={linea} vectorEffect="non-scaling-stroke" />
        {punto ? (
          <>
            <line className="guia" x1={punto[0]} y1={pad.t} x2={punto[0]} y2={h - pad.b} />
            <circle className="punto-hover" cx={punto[0]} cy={punto[1]} r="5" />
          </>
        ) : null}
        <circle className="punto-fin" cx={ultimo[0]} cy={ultimo[1]} r="4.5" />
        <rect
          className="captura"
          x={pad.l}
          y={0}
          width={innerW}
          height={h}
          onPointerMove={alMover}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {punto && hover !== null ? (
        <div
          className="grafica-tooltip"
          style={{
            left: `${(punto[0] / w) * 100}%`,
            top: `${(punto[1] / h) * 100}%`,
            transform: `translate(${punto[0] / w > 0.72 ? "calc(-100% - 12px)" : "12px"}, -50%)`,
          }}
        >
          <strong>{formato(valores[hover])}</strong>
          <span>Día {hover + 1}</span>
        </div>
      ) : null}
      <div className="grafica-dias" aria-hidden="true">
        {marcas.map((marca) => (
          <span key={marca}>{marca}</span>
        ))}
      </div>
    </div>
  );
}

function Anillo({
  segmentos,
  centroValor,
  centroEtiqueta,
}: {
  segmentos: { tono: Tono; valor: number }[];
  centroValor: string;
  centroEtiqueta: string;
}) {
  const total = Math.max(
    segmentos.reduce((a, s) => a + s.valor, 0),
    1,
  );
  const r = 40;
  const perimetro = 2 * Math.PI * r;
  let acumulado = 0;

  return (
    <div className="anillo">
      <svg viewBox="0 0 110 110" role="img" aria-label={`${centroValor} ${centroEtiqueta}`}>
        <circle className="anillo-fondo" cx="55" cy="55" r={r} />
        {segmentos
          .filter((s) => s.valor > 0)
          .map((s) => {
            const fraccion = s.valor / total;
            const trazo = (
              <circle
                key={s.tono}
                className="anillo-seg"
                data-tono={s.tono}
                cx="55"
                cy="55"
                r={r}
                strokeDasharray={`${(fraccion * perimetro).toFixed(2)} ${perimetro.toFixed(2)}`}
                strokeDashoffset={(-acumulado * perimetro).toFixed(2)}
              />
            );
            acumulado += fraccion;
            return trazo;
          })}
      </svg>
      <div className="anillo-centro">
        <strong>{centroValor}</strong>
        <span>{centroEtiqueta}</span>
      </div>
    </div>
  );
}

function Medidor({ valor }: { valor: number | null }) {
  const t = valor === null ? 0 : Math.min(Math.max(valor / 5, 0), 1);
  const angulo = Math.PI * (1 - t);
  const x = 60 + 46 * Math.cos(angulo);
  const y = 62 - 46 * Math.sin(angulo);

  return (
    <div className="medidor">
      <svg viewBox="0 0 120 70" role="img" aria-label={valor === null ? "Sin calificaciones" : `Promedio ${valor.toFixed(1)} de 5`}>
        <path className="medidor-fondo" d="M14,62 A46,46 0 0 1 106,62" pathLength={100} strokeDasharray="100 100" />
        {valor !== null ? (
          <path className="medidor-valor" d="M14,62 A46,46 0 0 1 106,62" pathLength={100} strokeDasharray={`${(t * 100).toFixed(1)} 100`} />
        ) : null}
        {[0, 1, 2, 3, 4, 5].map((marca) => {
          const a = Math.PI * (1 - marca / 5);
          return (
            <circle key={marca} className="medidor-marca" cx={60 + 46 * Math.cos(a)} cy={62 - 46 * Math.sin(a)} r={marca % 5 === 0 ? 0 : 1.4} />
          );
        })}
        {valor !== null ? <circle className="medidor-agujas" cx={x} cy={y} r="4" /> : null}
      </svg>
      <div className="medidor-centro">
        <strong>{valor === null ? "—" : valor.toFixed(1)}</strong>
        <span>
          <LuStar aria-hidden /> promedio
        </span>
      </div>
    </div>
  );
}
