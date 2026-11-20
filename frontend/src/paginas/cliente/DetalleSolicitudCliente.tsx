import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  cancelarSolicitud,
  cotizacionesSolicitud,
  elegirCotizacion,
  historialPropio,
  listarSolicitudes,
  rechazarCotizacion,
  retirarParticipacion,
  type Cotizacion,
  type HistorialItem,
  type Solicitud,
} from "../../api";
import { useAdminTopbarContexto } from "../../admin/AdminTopbar";
import { dineroMxn, fechaCorta, tituloEstado } from "../../utilidades/formato";
import { Pastilla } from "../../vista-lista/VistaLista";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tonoEstadoServicio } from "../flujo/servicio-ui";
import { tonoEstadoCotizacion, tonoEstadoSolicitud } from "./estado-tonos";
import "../../detalle-trabajo-admin.css";

export function DetalleSolicitudCliente() {
  const { solicitudId } = useParams<{ solicitudId: string }>();
  const navigate = useNavigate();
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [servicio, setServicio] = useState<HistorialItem | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [indice, setIndice] = useState(0);

  const recargar = useCallback(async () => {
    if (!solicitudId) return;
    setError("");
    try {
      const [solicitudes, cots, hist] = await Promise.all([
        listarSolicitudes(),
        cotizacionesSolicitud(solicitudId),
        historialPropio(),
      ]);
      setSolicitud(solicitudes.find((s) => s.id === solicitudId) ?? null);
      setCotizaciones(cots);
      setServicio(hist.find((h) => h.solicitud_id === solicitudId) ?? null);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo cargar la solicitud");
    } finally {
      setCargando(false);
    }
  }, [solicitudId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const volver = useMemo(
    () => (
      <Link to="/cliente/solicitudes" className="hub-volver">
        ← Solicitudes
      </Link>
    ),
    [],
  );
  useAdminTopbarContexto({ volver, titulo: solicitud?.titulo ?? (cargando ? "Cargando…" : "Solicitud") });

  const indiceActual =
    cotizaciones.length === 0 ? 0 : Math.min(Math.max(indice, 0), cotizaciones.length - 1);
  const cotizacionActual = cotizaciones[indiceActual] ?? null;

  const direccion = solicitud?.ubicacion
    ? [
        solicitud.ubicacion.calle_numero,
        solicitud.ubicacion.colonia,
        solicitud.ubicacion.ciudad,
        solicitud.ubicacion.estado,
        solicitud.ubicacion.codigo_postal,
      ]
        .filter(Boolean)
        .join(", ")
    : "Sin ubicación registrada";

  const coordenadas =
    solicitud?.ubicacion?.latitud != null && solicitud?.ubicacion?.longitud != null
      ? `${solicitud.ubicacion.latitud}, ${solicitud.ubicacion.longitud}`
      : "—";

  async function conAccion(accion: () => Promise<void>) {
    setOcupado(true);
    setError("");
    try {
      await accion();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo completar la acción");
    } finally {
      setOcupado(false);
    }
  }

  async function elegir(c: Cotizacion) {
    await conAccion(async () => {
      const flujo = await elegirCotizacion(c.id);
      navigate(`/cliente/servicios/${flujo.id}`);
    });
  }

  async function rechazar(c: Cotizacion) {
    await conAccion(async () => {
      await rechazarCotizacion(c.id);
      await recargar();
    });
  }

  async function retirar(c: Cotizacion) {
    await conAccion(async () => {
      await retirarParticipacion(c.participacion_id);
      await recargar();
    });
  }

  async function cancelar() {
    if (!solicitudId || !window.confirm("¿Cancelar esta solicitud?")) return;
    await conAccion(async () => {
      await cancelarSolicitud(solicitudId);
      await recargar();
    });
  }

  if (!solicitudId) {
    return (
      <section className="hub-page vista-detalle-caso">
        <p className="error">Solicitud no válida.</p>
      </section>
    );
  }

  return (
    <section className="hub-page vista-detalle-caso vista-detalle-solicitud" aria-label={solicitud?.titulo ?? "Solicitud"}>
      {error ? <p className="error">{error}</p> : null}

      {cargando || !solicitud ? (
        <p className="hub-vacio">{cargando ? "Cargando solicitud…" : "No se encontró la solicitud."}</p>
      ) : (
        <div className="detalle-solicitud-cuerpo">
          <div className="fila-arriba">
            <section className="card" aria-labelledby="titulo-solicitud-cliente">
              <div className="card-cab">
                <h2 id="titulo-solicitud-cliente">Solicitud</h2>
              </div>
              <dl className="detalle-datos">
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <Pastilla tono={tonoEstadoSolicitud(solicitud.estado)}>
                      {tituloEstado(solicitud.estado)}
                    </Pastilla>
                  </dd>
                </div>
                <div>
                  <dt>Categoría</dt>
                  <dd>{solicitud.categoria || "—"}</dd>
                </div>
                <div>
                  <dt>Creada</dt>
                  <dd>{fechaCorta(solicitud.creado_en)}</dd>
                </div>
                <div>
                  <dt>Cotizaciones</dt>
                  <dd>{cotizaciones.length}</dd>
                </div>
                <div>
                  <dt>Datos</dt>
                  <dd>{solicitud.datos_cerrados ? "Cerrados" : "Abiertos"}</dd>
                </div>
                <div>
                  <dt>Coordenadas</dt>
                  <dd>{coordenadas}</dd>
                </div>
                <div className="detalle-datos-ancho">
                  <dt>Dirección</dt>
                  <dd>{direccion}</dd>
                </div>
              </dl>
              {solicitud.estado === "abierta" ? (
                <div className="detalle-acciones">
                  <Button type="button" variant="outline" size="sm" onClick={() => void cancelar()} disabled={ocupado}>
                    Cancelar solicitud
                  </Button>
                </div>
              ) : null}
            </section>

            <section className="card" aria-labelledby="titulo-problema-cliente">
              <div className="card-cab">
                <h2 id="titulo-problema-cliente">Problema</h2>
              </div>
              <p className="problema-texto">{solicitud.descripcion}</p>
              <p className="problema-meta">
                <strong>{solicitud.categoria}</strong>
                {direccion !== "Sin ubicación registrada" ? ` · ${direccion}` : ""}
              </p>
            </section>
          </div>

          <div className="fila-media">
            <section className="card" aria-labelledby="titulo-servicio-cliente">
              <div className="card-cab">
                <h2 id="titulo-servicio-cliente">Servicio</h2>
              </div>
              {servicio ? (
                <>
                  <dl className="detalle-datos">
                    <div>
                      <dt>Estado</dt>
                      <dd>
                        <Pastilla tono={tonoEstadoServicio(servicio.estado)}>{tituloEstado(servicio.estado)}</Pastilla>
                      </dd>
                    </div>
                    <div>
                      <dt>Proveedor</dt>
                      <dd>{servicio.proveedor || "—"}</dd>
                    </div>
                    <div>
                      <dt>Técnico</dt>
                      <dd>{servicio.tecnico || "Sin asignar"}</dd>
                    </div>
                    <div>
                      <dt>Costo</dt>
                      <dd>{servicio.costo_mxn ? dineroMxn(servicio.costo_mxn) : "—"}</dd>
                    </div>
                    <div>
                      <dt>Creado</dt>
                      <dd>{fechaCorta(servicio.creado_en)}</dd>
                    </div>
                    <div>
                      <dt>Informe</dt>
                      <dd>{servicio.informe?.descripcion ?? "Sin informe"}</dd>
                    </div>
                  </dl>
                  <div className="detalle-acciones">
                    <Button asChild size="sm">
                      <Link to={`/cliente/servicios/${servicio.servicio_id}`}>Ver servicio</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <p className="vacio">Aún no hay servicio: se crea al elegir una cotización.</p>
              )}
            </section>

            <section className="card" aria-labelledby="titulo-cotiz-cliente">
              <div className="card-cab">
                <h2 id="titulo-cotiz-cliente">Cotizaciones</h2>
              </div>
              {cotizaciones.length === 0 ? (
                <p className="vacio">Todavía no hay cotizaciones enviadas.</p>
              ) : (
                <>
                  <div className="cotizacion-selector">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={ocupado || indiceActual <= 0}
                      onClick={() => setIndice((i) => Math.max(0, i - 1))}
                    >
                      Anterior
                    </Button>
                    <div className="cotizacion-selector-centro">
                      <span className="problema-meta">
                        Cotización {indiceActual + 1} de {cotizaciones.length}
                      </span>
                      <Select
                        value={cotizacionActual?.id}
                        onValueChange={(id) => setIndice(cotizaciones.findIndex((c) => c.id === id))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {cotizaciones.map((c, i) => (
                            <SelectItem key={c.id} value={c.id}>
                              {`Cotización ${i + 1} · ${dineroMxn(c.costo_mxn)}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={ocupado || indiceActual >= cotizaciones.length - 1}
                      onClick={() => setIndice((i) => Math.min(cotizaciones.length - 1, i + 1))}
                    >
                      Siguiente
                    </Button>
                  </div>

                  {cotizacionActual ? (
                    <div className="cotizacion-detalle">
                      <dl className="detalle-datos">
                        <div>
                          <dt>Estado</dt>
                          <dd>
                            <Pastilla tono={tonoEstadoCotizacion(cotizacionActual.estado)}>
                              {tituloEstado(cotizacionActual.estado)}
                            </Pastilla>
                          </dd>
                        </div>
                        <div>
                          <dt>Costo</dt>
                          <dd>{dineroMxn(cotizacionActual.costo_mxn)}</dd>
                        </div>
                        <div>
                          <dt>Enviada</dt>
                          <dd>{fechaCorta(cotizacionActual.creado_en)}</dd>
                        </div>
                      </dl>
                      <p className="problema-meta">{cotizacionActual.descripcion}</p>
                      {cotizacionActual.condiciones ? (
                        <p className="problema-meta">Condiciones: {cotizacionActual.condiciones}</p>
                      ) : null}
                      {cotizacionActual.estado === "enviada" ? (
                        <div className="detalle-acciones">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void elegir(cotizacionActual)}
                            disabled={ocupado}
                          >
                            Elegir cotización
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void rechazar(cotizacionActual)}
                            disabled={ocupado}
                          >
                            Rechazar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void retirar(cotizacionActual)}
                            disabled={ocupado}
                          >
                            Retirar proveedor
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
