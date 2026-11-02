import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { obtenerTrabajoAdmin, type ExpedienteTrabajo } from "../api";
import { FormCerrarReclamacion, FormMarcaCaso } from "../trabajos-expediente-formularios";
import "../tablero-admin.css";
import "../detalle-trabajo-admin.css";
import "../usuarios-admin.css";
import "../trabajos-admin.css";

type Escena = "caso" | "atencion";
type Nivel = "info" | "ok" | "medio" | "alto" | "critico";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const fechaCorta = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const fechaHora = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function etiquetaEstado(valor: string): string {
  return valor.replaceAll("_", " ");
}

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return fechaCorta.format(d);
}

function formatearFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return fechaHora.format(d);
}

function inferirEtapa(exp: ExpedienteTrabajo): string {
  if (exp.servicio) return "Servicio";
  if (exp.cotizaciones.length > 0) return "Cotización";
  return "Solicitud";
}

function textoReclamacion(exp: ExpedienteTrabajo): string {
  if (exp.reclamaciones.some((r) => r.estado === "abierta")) return "Abierta";
  if (exp.reclamaciones.some((r) => r.estado === "cerrada")) return "Cerrada";
  return "—";
}

export function DetalleTrabajoAdmin() {
  const { solicitudId } = useParams<{ solicitudId: string }>();
  const [expediente, setExpediente] = useState<ExpedienteTrabajo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [escena, setEscena] = useState<Escena>("caso");

  const viewport = useRef<HTMLDivElement>(null);
  const escenaCaso = useRef<HTMLElement>(null);
  const escenaAtencion = useRef<HTMLElement>(null);
  const escenaActual = useRef<Escena>("caso");
  const animando = useRef(false);
  const irRef = useRef<(nombre: Escena) => void>(() => undefined);

  useEffect(() => {
    if (!solicitudId) return;
    let activo = true;
    setCargando(true);
    setError("");
    obtenerTrabajoAdmin(solicitudId)
      .then((exp) => {
        if (activo) setExpediente(exp);
      })
      .catch((causa) => {
        if (activo) {
          setError(causa instanceof Error ? causa.message : "No se pudo cargar el caso");
          setExpediente(null);
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [solicitudId]);

  function irAEscena(nombre: Escena) {
    if (animando.current || escenaActual.current === nombre) return;
    animando.current = true;
    escenaActual.current = nombre;
    setEscena(nombre);
    const destino = nombre === "atencion" ? escenaAtencion.current : escenaCaso.current;
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
        escenaActual.current === "atencion" ? escenaAtencion.current : escenaCaso.current;
      if (!activa) return;
      if (animando.current) {
        evento.preventDefault();
        return;
      }
      if (evento.deltaY > 0 && escenaActual.current === "caso" && enFondo(activa)) {
        evento.preventDefault();
        irRef.current("atencion");
      } else if (evento.deltaY < 0 && escenaActual.current === "atencion" && enTope(activa)) {
        evento.preventDefault();
        irRef.current("caso");
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
        escenaActual.current === "atencion" ? escenaAtencion.current : escenaCaso.current;
      if (!activa) return;
      if (dy > 0 && escenaActual.current === "caso" && enFondo(activa)) irRef.current("atencion");
      if (dy < 0 && escenaActual.current === "atencion" && enTope(activa)) irRef.current("caso");
    }

    nodo.addEventListener("wheel", alRueda, { passive: false });
    nodo.addEventListener("touchstart", alTocar, { passive: true });
    nodo.addEventListener("touchend", alSoltar, { passive: true });
    return () => {
      nodo.removeEventListener("wheel", alRueda);
      nodo.removeEventListener("touchstart", alTocar);
      nodo.removeEventListener("touchend", alSoltar);
    };
  }, [cargando, expediente]);

  const statsCotizaciones = useMemo(() => {
    if (!expediente) return { total: 0, aceptadas: 0, rechazadas: 0, costoAceptada: "—" };
    const total = expediente.cotizaciones.length;
    const aceptadas = expediente.cotizaciones.filter((c) => c.estado === "aceptada").length;
    const rechazadas = expediente.cotizaciones.filter((c) => c.estado === "rechazada").length;
    const aceptada = expediente.cotizaciones.find((c) => c.estado === "aceptada");
    const costoAceptada = aceptada ? mxn.format(Number(aceptada.costo_mxn)) : "—";
    return { total, aceptadas, rechazadas, costoAceptada };
  }, [expediente]);

  if (!solicitudId) {
    return (
      <section className="vista-inicio vista-detalle-caso vista-padron-crm">
        <p className="error">Identificador de caso no válido.</p>
        <Link to="/admin/trabajos" className="volver-trabajos">
          ← Volver a Trabajos
        </Link>
      </section>
    );
  }

  const titulo = expediente?.solicitud.titulo ?? (cargando ? "Cargando…" : "Caso");
  const reclamacionAbierta = expediente?.reclamaciones.find((r) => r.estado === "abierta") ?? null;
  const servicio = expediente?.servicio ?? null;

  return (
    <section className="vista-inicio vista-detalle-caso vista-padron-crm" aria-labelledby="titulo-caso">
      <header className="cabecera-caso">
        <h1 id="titulo-caso">{titulo}</h1>
        <Link to="/admin/trabajos" className="volver-trabajos">
          ← Volver a Trabajos
        </Link>
      </header>

      {error ? <p className="error">{error}</p> : null}

      {cargando || !expediente ? (
        <p className="vacio">{cargando ? "Cargando expediente…" : "Sin datos del caso."}</p>
      ) : (
        <div className="escenas-viewport" ref={viewport}>
          <EscenaCaso
            ref={escenaCaso}
            activa={escena === "caso"}
            expediente={expediente}
            stats={statsCotizaciones}
            onIrAtencion={() => irAEscena("atencion")}
          />
          <EscenaAtencion
            ref={escenaAtencion}
            activa={escena === "atencion"}
            expediente={expediente}
            reclamacionAbierta={reclamacionAbierta}
            servicio={servicio}
            onIrCaso={() => irAEscena("caso")}
            onActualizado={(siguiente) => setExpediente(siguiente)}
          />
        </div>
      )}
    </section>
  );
}

const EscenaCaso = forwardRef<
  HTMLElement,
  {
    activa: boolean;
    expediente: ExpedienteTrabajo;
    stats: { total: number; aceptadas: number; rechazadas: number; costoAceptada: string };
    onIrAtencion: () => void;
  }
>(function EscenaCaso({ activa, expediente, stats, onIrAtencion }, ref) {
  const { solicitud, participaciones } = expediente;
  const reclTexto = textoReclamacion(expediente);
  const ubicacion = solicitud.ubicacion;

  return (
    <section
      className={activa ? "escena escena-caso activa" : "escena escena-caso"}
      ref={ref}
      aria-label="Caso"
    >
      <button type="button" className="pista-scroll" aria-label="Ir a Atención" onClick={onIrAtencion}>
        <Chevron abajo />
        Atención
      </button>

      <div className="fila-arriba">
        <section className="card celda-kpis" aria-labelledby="titulo-resumen-caso">
          <div className="card-cab">
            <h2 id="titulo-resumen-caso">Resumen del caso</h2>
          </div>
          <div className="kpis">
            <Kpi etiqueta="Etapa" valor={inferirEtapa(expediente)} />
            <Kpi etiqueta="Estado solicitud" valor={etiquetaEstado(solicitud.estado)} />
            <Kpi etiqueta="Cotizaciones" valor={stats.total} />
            <Kpi etiqueta="Reclamación" valor={reclTexto} />
          </div>
        </section>

        <section className="card" aria-labelledby="titulo-problema">
          <div className="card-cab">
            <h2 id="titulo-problema">Problema</h2>
          </div>
          <p className="problema-texto">{solicitud.descripcion}</p>
          <p className="problema-meta">
            <strong>{solicitud.categoria}</strong>
            {ubicacion
              ? ` · ${ubicacion.calle_numero}, ${ubicacion.colonia}, ${ubicacion.ciudad}`
              : ""}
          </p>
        </section>
      </div>

      <div className="fila-abajo">
        <section className="card" aria-labelledby="titulo-participaciones">
          <div className="card-cab">
            <h2 id="titulo-participaciones">Participaciones</h2>
          </div>
          {participaciones.length === 0 ? (
            <p className="vacio">Sin participaciones aún.</p>
          ) : (
            <div className="riesgos-grid" data-cols="2">
              <Tile nivel="info" etiqueta="Proveedores" valor={participaciones.length} />
              <Tile
                nivel="ok"
                etiqueta="Aceptaron"
                valor={participaciones.filter((p) => p.estado === "aceptada").length}
              />
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="titulo-cotiz-resumen">
          <div className="card-cab">
            <h2 id="titulo-cotiz-resumen">Cotizaciones</h2>
          </div>
          <div className="riesgos-grid" data-cols="4">
            <Tile nivel="info" etiqueta="Total" valor={stats.total} />
            <Tile nivel="ok" etiqueta="Aceptada" valor={stats.aceptadas} />
            <Tile nivel="alto" etiqueta="Rechazadas" valor={stats.rechazadas} />
            <Tile nivel="info" etiqueta="Costo aceptada" valor={stats.costoAceptada} />
          </div>
        </section>
      </div>
    </section>
  );
});

const EscenaAtencion = forwardRef<
  HTMLElement,
  {
    activa: boolean;
    expediente: ExpedienteTrabajo;
    reclamacionAbierta: ExpedienteTrabajo["reclamaciones"][number] | null;
    servicio: ExpedienteTrabajo["servicio"];
    onIrCaso: () => void;
    onActualizado: (e: ExpedienteTrabajo) => void;
  }
>(function EscenaAtencion(
  { activa, expediente, reclamacionAbierta, servicio, onIrCaso, onActualizado },
  ref,
) {
  const calCliente = servicio?.calificaciones.find((c) => c.lado === "cliente");
  const calProveedor = servicio?.calificaciones.find((c) => c.lado === "proveedor");

  return (
    <section
      className={activa ? "escena escena-atencion activa" : "escena escena-atencion"}
      ref={ref}
      aria-label="Atención"
    >
      <button type="button" className="pista-scroll" aria-label="Ir a Caso" onClick={onIrCaso}>
        <Chevron />
        Caso
      </button>

      {!servicio ? (
        <section className="card card-vacio-servicio" aria-labelledby="titulo-sin-servicio">
          <h2 id="titulo-sin-servicio">Servicio</h2>
          <p>Aún no hay servicio (sin cotización aceptada).</p>
        </section>
      ) : (
        <>
          <div className="fila-arriba">
            <section className="card" aria-labelledby="titulo-servicio-det">
              <div className="card-cab">
                <h2 id="titulo-servicio-det">Servicio</h2>
              </div>
              <p className="problema-texto">
                <strong>{etiquetaEstado(servicio.estado)}</strong>
                {servicio.proveedor ? ` · ${servicio.proveedor}` : ""}
                {servicio.tecnico ? ` · Técnico: ${servicio.tecnico}` : ""}
              </p>
              {servicio.informe ? (
                <p className="problema-meta">
                  Informe ({etiquetaEstado(servicio.informe.tipo)}): {servicio.informe.descripcion}
                  {servicio.informe.detalle_pieza ? ` · ${servicio.informe.detalle_pieza}` : ""}
                </p>
              ) : (
                <p className="problema-meta">Sin informe registrado.</p>
              )}
            </section>

            <section className="card" aria-labelledby="titulo-calificaciones-det">
              <div className="card-cab">
                <h2 id="titulo-calificaciones-det">Calificaciones</h2>
              </div>
              {servicio.calificaciones.length === 0 ? (
                <p className="vacio">Pendientes o no aplican hasta cerrar el servicio.</p>
              ) : (
                <>
                  <div className="riesgos-grid" data-cols="2">
                    <Tile
                      nivel="ok"
                      etiqueta="Cliente"
                      valor={
                        calCliente
                          ? `${calCliente.valor}${calCliente.es_automatica ? " · auto" : ""}`
                          : "—"
                      }
                    />
                    <Tile
                      nivel="info"
                      etiqueta="Proveedor"
                      valor={
                        calProveedor
                          ? `${calProveedor.valor}${calProveedor.es_automatica ? " · auto" : ""}`
                          : "—"
                      }
                    />
                  </div>
                  {(calCliente?.es_automatica || calProveedor?.es_automatica) && (
                    <p className="problema-meta">4.5 si no calificó (automática).</p>
                  )}
                </>
              )}
            </section>
          </div>

          <div className="fila-abajo fila-atencion-extra">
            <section className="card" aria-labelledby="titulo-reclamacion-det">
              <div className="card-cab">
                <h2 id="titulo-reclamacion-det">Reclamación</h2>
              </div>
              {expediente.reclamaciones.length === 0 ? (
                <p className="problema-meta">Sin reclamación. Cancelar el servicio no es reclamar.</p>
              ) : (
                <ul className="lista-detalle">
                  {expediente.reclamaciones.map((r) => (
                    <li key={r.id}>
                      <strong>{r.estado === "abierta" ? "Abierta" : "Cerrada"}</strong> · {r.categoria_etiqueta}:{" "}
                      {r.motivo}
                      <span className="block-meta">
                        {r.reclamante ? `${r.reclamante} · ` : ""}
                        {formatearFechaHora(r.creada_en)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {reclamacionAbierta ? (
                <FormCerrarReclamacion
                  solicitudId={expediente.solicitud.id}
                  reclamacion={reclamacionAbierta}
                  marcasExistentes={expediente.marcas}
                  onActualizado={async (siguiente) => onActualizado(siguiente)}
                />
              ) : null}
            </section>

            <section className="card" aria-labelledby="titulo-marcas-det">
              <div className="card-cab">
                <h2 id="titulo-marcas-det">Marcas del caso</h2>
              </div>
              {expediente.marcas.length === 0 ? (
                <p className="problema-meta">Sin marcas sobre este caso.</p>
              ) : (
                <ul className="lista-detalle">
                  {expediente.marcas.map((m) => (
                    <li key={m.id}>
                      <strong>{m.tipo === "advertencia" ? "Advertencia" : "Sanción"}</strong> ({m.perfil_afectado}):{" "}
                      {m.etiqueta}
                      <span className="block-meta">{formatearFechaHora(m.creada_en)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <FormMarcaCaso
                solicitudId={expediente.solicitud.id}
                marcasExistentes={expediente.marcas}
                onActualizado={async (siguiente) => onActualizado(siguiente)}
              />
            </section>
          </div>

          {expediente.historial_perfiles ? (
            <section className="card fila-atencion-extra" aria-labelledby="titulo-historial-det">
              <div className="card-cab">
                <h2 id="titulo-historial-det">Historial acotado (RN-015)</h2>
              </div>
              <p className="problema-meta">
                Visible solo por reclamación o marca en este caso; no es un padrón libre.
              </p>
              {expediente.historial_perfiles.cliente.length > 0 ? (
                <>
                  <h3 className="problema-meta">Cliente</h3>
                  <ul className="lista-detalle">
                    {expediente.historial_perfiles.cliente.map((h) => (
                      <li key={h.servicio_id}>
                        {h.titulo} — {etiquetaEstado(h.estado)} · {formatearFecha(h.creado_en)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {expediente.historial_perfiles.proveedor.length > 0 ? (
                <>
                  <h3 className="problema-meta">Proveedor</h3>
                  <ul className="lista-detalle">
                    {expediente.historial_perfiles.proveedor.map((h) => (
                      <li key={h.servicio_id}>
                        {h.titulo} — {etiquetaEstado(h.estado)} · {formatearFecha(h.creado_en)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </section>
  );
});

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
