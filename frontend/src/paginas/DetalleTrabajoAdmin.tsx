import { forwardRef, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LuTriangleAlert } from "react-icons/lu";
import { useAdminTopbarContexto } from "../admin/AdminTopbar";
import { obtenerTrabajoAdmin, type ExpedienteTrabajo } from "../api";
import { esPendienteInforme, tituloEstado } from "../utilidades/formato";
import { Pastilla, type TonoPastilla } from "../vista-lista/VistaLista";
import { tonoEstadoServicio } from "./flujo/servicio-ui";
import { FormCerrarReclamacion, FormMarcaCaso } from "../trabajos-expediente-formularios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  return tituloEstado(valor);
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

  const statsCotizaciones = useMemo(() => {
    if (!expediente) return { total: 0, aceptadas: 0, rechazadas: 0, costoAceptada: "—" };
    const total = expediente.cotizaciones.length;
    const aceptadas = expediente.cotizaciones.filter((c) => c.estado === "aceptada").length;
    const rechazadas = expediente.cotizaciones.filter((c) => c.estado === "rechazada").length;
    const aceptada = expediente.cotizaciones.find((c) => c.estado === "aceptada");
    const costoAceptada = aceptada ? mxn.format(Number(aceptada.costo_mxn)) : "—";
    return { total, aceptadas, rechazadas, costoAceptada };
  }, [expediente]);

  const titulo = expediente?.solicitud.titulo ?? (cargando ? "Cargando…" : "Caso");
  const etapa = expediente ? inferirEtapa(expediente) : null;
  const volver = useMemo(
    () => (
      <>
        <Link to="/admin/trabajos" className="hub-volver">
          ← Trabajos
        </Link>
        {etapa ? <Badge variant="secondary">{etapa}</Badge> : null}
      </>
    ),
    [etapa],
  );
  useAdminTopbarContexto({ volver, titulo });

  if (!solicitudId) {
    return (
      <section className="hub-page vista-inicio vista-detalle-caso vista-padron-crm">
        <p className="error">Identificador de caso no válido.</p>
      </section>
    );
  }

  const reclamacionAbierta = expediente?.reclamaciones.find((r) => r.estado === "abierta") ?? null;
  const servicio = expediente?.servicio ?? null;

  return (
    <section className="hub-page vista-inicio vista-detalle-caso vista-padron-crm" aria-label={titulo}>
      {error ? <p className="error">{error}</p> : null}

      {reclamacionAbierta ? (
        <div className="aviso-detalle" role="status">
          <LuTriangleAlert aria-hidden />
          <div>
            <strong>Reclamación abierta</strong>
            <span>Revisa la pestaña Atención para resolverla.</span>
          </div>
        </div>
      ) : null}

      {servicio && esPendienteInforme(servicio.estado) ? (
        <div className="aviso-detalle" role="status">
          <LuTriangleAlert aria-hidden />
          <div>
            <strong>Servicio pendiente de informe</strong>
            <span>El proveedor debe registrar el informe para cerrar el servicio.</span>
          </div>
        </div>
      ) : null}

      {cargando || !expediente ? (
        <p className="hub-vacio">{cargando ? "Cargando expediente…" : "Sin datos del caso."}</p>
      ) : (
        <Tabs
          value={escena}
          onValueChange={(valor) => setEscena(valor as Escena)}
          className="hub-tabs-caso"
        >
          <TabsList variant="line">
            <TabsTrigger value="caso">Caso</TabsTrigger>
            <TabsTrigger value="atencion">Atención</TabsTrigger>
          </TabsList>
          <TabsContent value="caso">
            <EscenaCaso
              activa
              expediente={expediente}
              stats={statsCotizaciones}
              onIrAtencion={() => setEscena("atencion")}
            />
          </TabsContent>
          <TabsContent value="atencion">
            <EscenaAtencion
              activa
              expediente={expediente}
              reclamacionAbierta={reclamacionAbierta}
              servicio={servicio}
              onIrCaso={() => setEscena("caso")}
              onActualizado={(siguiente) => setExpediente(siguiente)}
            />
          </TabsContent>
        </Tabs>
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
  const { solicitud, participaciones, cotizaciones, servicio } = expediente;
  const reclTexto = textoReclamacion(expediente);
  const ubicacion = solicitud.ubicacion;
  const direccion = ubicacion
    ? [ubicacion.calle_numero, ubicacion.colonia, ubicacion.ciudad, ubicacion.estado, ubicacion.codigo_postal]
        .filter(Boolean)
        .join(", ")
    : "Sin ubicación registrada";
  const dirigidaId = solicitud.dirigida_a_perfil_proveedor_id;
  const dirigidaNombre = dirigidaId
    ? participaciones.find((p) => p.perfil_proveedor_id === dirigidaId)?.proveedor ??
      cotizaciones.find((c) => c.perfil_proveedor_id === dirigidaId)?.proveedor ??
      "Proveedor específico"
    : "Todos los proveedores";
  const cotizacionAceptada = servicio
    ? cotizaciones.find((c) => c.id === servicio.cotizacion_id) ?? null
    : null;
  const costoAceptado = cotizacionAceptada ? mxn.format(Number(cotizacionAceptada.costo_mxn)) : "—";
  const [indiceCot, setIndiceCot] = useState(0);
  const indiceActual =
    cotizaciones.length === 0 ? 0 : Math.min(Math.max(indiceCot, 0), cotizaciones.length - 1);
  const cotizacionActual = cotizaciones[indiceActual] ?? null;

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

      <div className="fila-media">
        <section className="card" aria-labelledby="titulo-solicitante">
          <div className="card-cab">
            <h2 id="titulo-solicitante">Solicitante</h2>
          </div>
          <dl className="detalle-datos">
            <div>
              <dt>Cliente</dt>
              <dd>{solicitud.cliente}</dd>
            </div>
            <div>
              <dt>Creada</dt>
              <dd>{formatearFechaHora(solicitud.creado_en)}</dd>
            </div>
            <div>
              <dt>Categoría</dt>
              <dd>{solicitud.categoria || "—"}</dd>
            </div>
            <div>
              <dt>Dirigida a</dt>
              <dd>{dirigidaNombre}</dd>
            </div>
            <div>
              <dt>Datos</dt>
              <dd>{solicitud.datos_cerrados ? "Cerrados" : "Abiertos"}</dd>
            </div>
            <div className="detalle-datos-ancho">
              <dt>Dirección</dt>
              <dd>{direccion}</dd>
            </div>
          </dl>
        </section>

        <section className="card" aria-labelledby="titulo-servicio-caso">
          <div className="card-cab">
            <h2 id="titulo-servicio-caso">Servicio</h2>
            {servicio ? (
              <Pastilla tono={tonoEstadoServicio(servicio.estado)}>{etiquetaEstado(servicio.estado)}</Pastilla>
            ) : null}
          </div>
          {servicio ? (
            <>
              <dl className="detalle-datos">
                <div>
                  <dt>Proveedor</dt>
                  <dd>{servicio.proveedor || "—"}</dd>
                </div>
                <div>
                  <dt>Técnico</dt>
                  <dd>{servicio.tecnico ?? "Sin asignar"}</dd>
                </div>
                <div>
                  <dt>Costo aceptado</dt>
                  <dd>{costoAceptado}</dd>
                </div>
                <div>
                  <dt>Inicio</dt>
                  <dd>{formatearFechaHora(servicio.creado_en)}</dd>
                </div>
              </dl>
              {servicio.informe ? (
                <p className="problema-meta">
                  Informe ({etiquetaEstado(servicio.informe.tipo)}): {servicio.informe.descripcion}
                  {servicio.informe.detalle_pieza ? ` · ${servicio.informe.detalle_pieza}` : ""} ·{" "}
                  {formatearFecha(servicio.informe.fecha)}
                </p>
              ) : (
                <p className="problema-meta">Sin informe registrado.</p>
              )}
              {servicio.calificaciones.length > 0 ? (
                <p className="problema-meta">
                  Calificaciones:{" "}
                  {servicio.calificaciones
                    .map(
                      (c) =>
                        `${c.lado === "cliente" ? "Cliente" : "Proveedor"} ${c.valor}${c.es_automatica ? " (auto)" : ""}`,
                    )
                    .join(" · ")}
                </p>
              ) : null}
            </>
          ) : (
            <p className="vacio">Aún no hay servicio: no se ha aceptado una cotización.</p>
          )}
        </section>
      </div>

      <div className="fila-abajo">
        <section className="card card-ancho" aria-labelledby="titulo-cotiz-resumen">
          <div className="card-cab">
            <h2 id="titulo-cotiz-resumen">Cotizaciones</h2>
          </div>
          <div className="riesgos-grid" data-cols="4">
            <Tile nivel="info" etiqueta="Total" valor={stats.total} />
            <Tile nivel="ok" etiqueta="Aceptada" valor={stats.aceptadas} />
            <Tile nivel={stats.rechazadas > 0 ? "alto" : "info"} etiqueta="Rechazadas" valor={stats.rechazadas} />
            <Tile nivel="info" etiqueta="Costo aceptada" valor={stats.costoAceptada} />
          </div>
          {cotizaciones.length === 0 ? (
            <p className="vacio">Sin cotizaciones aún.</p>
          ) : (
            <>
              <div className="cotizacion-selector">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={indiceActual <= 0}
                  onClick={() => setIndiceCot((i) => Math.max(0, i - 1))}
                >
                  Anterior
                </Button>
                <div className="cotizacion-selector-centro">
                  <span className="problema-meta">
                    Cotización {indiceActual + 1} de {cotizaciones.length}
                  </span>
                  <Select
                    value={cotizacionActual?.id}
                    onValueChange={(id) => setIndiceCot(cotizaciones.findIndex((c) => c.id === id))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cotizaciones.map((c, i) => (
                        <SelectItem key={c.id} value={c.id}>
                          {`Cotización ${i + 1} · ${c.proveedor || "Proveedor"} · ${mxn.format(
                            Number(c.costo_mxn),
                          )}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={indiceActual >= cotizaciones.length - 1}
                  onClick={() => setIndiceCot((i) => Math.min(cotizaciones.length - 1, i + 1))}
                >
                  Siguiente
                </Button>
              </div>
              {cotizacionActual ? (
                <div className="cotizacion-detalle">
                  <dl className="detalle-datos">
                    <div>
                      <dt>Proveedor</dt>
                      <dd>{cotizacionActual.proveedor || "—"}</dd>
                    </div>
                    <div>
                      <dt>Estado</dt>
                      <dd>
                        <Pastilla tono={tonoCotizacion(cotizacionActual.estado)}>
                          {etiquetaEstado(cotizacionActual.estado)}
                        </Pastilla>
                      </dd>
                    </div>
                    <div>
                      <dt>Costo</dt>
                      <dd>{mxn.format(Number(cotizacionActual.costo_mxn))}</dd>
                    </div>
                    <div>
                      <dt>Creada</dt>
                      <dd>{formatearFechaHora(cotizacionActual.creado_en)}</dd>
                    </div>
                  </dl>
                  {cotizacionActual.descripcion ? (
                    <p className="problema-meta">{cotizacionActual.descripcion}</p>
                  ) : null}
                  {cotizacionActual.condiciones ? (
                    <p className="problema-meta">Condiciones: {cotizacionActual.condiciones}</p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
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

function tonoCotizacion(estado: string): TonoPastilla {
  const k = estado.toLowerCase();
  if (k === "aceptada" || k === "elegida") return "positiva";
  if (k === "rechazada" || k === "vencida") return "negativa";
  if (k === "enviada") return "acento";
  return "neutra";
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
