import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";
import {
  cancelarSolicitud,
  cotizacionesSolicitud,
  type Cotizacion,
  elegirCotizacion,
  historialPropio,
  listarSolicitudes,
  publicarSolicitud,
  rechazarCotizacion,
  retirarParticipacion,
  type Solicitud,
  servicioEstaCerrado,
} from "../../api";
import { digitos, texto } from "../../validarAlta";
import { dineroMxn, tituloEstado } from "../../utilidades/formato";
import {
  AvisoLista,
  BarraLista,
  AccionesFila,
  BotonTexto,
  CeldaFecha,
  CeldaPrincipal,
  EstadoLista,
  FiltroLista,
  FilaLista,
  ListaScroll,
  Pastilla,
  PieLista,
  TablaLista,
  VistaLista,
  type ColumnaLista,
  type TonoPastilla,
} from "../../vista-lista/VistaLista";
import { coincideBusqueda, marcaTiempo, ordenarPor, useOrden } from "../../vista-lista/orden";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import "./cliente-lista.css";

const CATEGORIAS_SUGERIDAS = ["Soporte técnico", "Redes", "Software", "Hardware", "Ciberseguridad"];

type ColSolicitud = "solicitud" | "estado" | "categoria" | "creada" | "acciones";

const COLUMNAS: ColumnaLista<ColSolicitud>[] = [
  { id: "solicitud", etiqueta: "Solicitud", ancho: "32%" },
  { id: "estado", etiqueta: "Estado", ancho: "13%" },
  { id: "categoria", etiqueta: "Categoría", ancho: "16%" },
  { id: "creada", etiqueta: "Creada", ancho: "17%", alinear: "derecha" },
  { id: "acciones", etiqueta: "Acciones", ancho: "22%", ordenable: false },
];

export function SolicitudesCliente() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [proveedoresCerrados, setProveedoresCerrados] = useState<{ id: string; titulo: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [expandida, setExpandida] = useState<string | null>(null);
  const [cotizaciones, setCotizaciones] = useState<Record<string, Cotizacion[]>>({});
  const [cargandoCot, setCargandoCot] = useState(false);
  const [errorCot, setErrorCot] = useState("");
  const [publicar, setPublicar] = useState(false);
  const orden = useOrden<ColSolicitud>("creada", "desc", ["creada"]);

  const recargar = useCallback(async () => {
    try {
      const [sol, hist] = await Promise.all([listarSolicitudes(), historialPropio()]);
      setSolicitudes(sol);
      const vistos = new Set<string>();
      const recontratacion: { id: string; titulo: string }[] = [];
      for (const h of hist) {
        if (!servicioEstaCerrado(h.estado) || !h.perfil_proveedor_id) continue;
        if (vistos.has(h.perfil_proveedor_id)) continue;
        vistos.add(h.perfil_proveedor_id);
        recontratacion.push({ id: h.perfil_proveedor_id, titulo: h.titulo });
      }
      setProveedoresCerrados(recontratacion);
      setError("");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo cargar");
    }
  }, []);

  useEffect(() => {
    void recargar().finally(() => setCargando(false));
  }, [recargar]);

  const opcionesEstado = useMemo(
    () => opcionesConPresentes(solicitudes.map((s) => s.estado), filtroEstado, tituloEstado),
    [solicitudes, filtroEstado],
  );
  const opcionesCategoria = useMemo(
    () => opcionesConPresentes(solicitudes.map((s) => s.categoria), filtroCategoria),
    [solicitudes, filtroCategoria],
  );

  const visibles = useMemo(
    () =>
      ordenarPor(
        solicitudes.filter(
          (s) =>
            (filtroEstado === "todas" || s.estado === filtroEstado) &&
            (filtroCategoria === "todas" || s.categoria === filtroCategoria) &&
            coincideBusqueda(busqueda, s.titulo, s.descripcion, s.categoria),
        ),
        orden,
        {
          solicitud: (s) => s.titulo,
          estado: (s) => s.estado,
          categoria: (s) => s.categoria,
          creada: (s) => marcaTiempo(s.creado_en),
          acciones: () => null,
        },
      ),
    [solicitudes, filtroEstado, filtroCategoria, busqueda, orden],
  );

  const solicitudExpandida = expandida ? solicitudes.find((s) => s.id === expandida) : undefined;

  const acciones = useMemo(
    () => (
      <Button type="button" size="sm" onClick={() => setPublicar(true)}>
        <PlusIcon data-icon="inline-start" />
        Publicar solicitud
      </Button>
    ),
    [],
  );

  function restablecer() {
    setBusqueda("");
    setFiltroEstado("todas");
    setFiltroCategoria("todas");
  }

  async function abrirCotizaciones(id: string) {
    setExpandida(id);
    setErrorCot("");
    if (cotizaciones[id]) return;
    setCargandoCot(true);
    try {
      const lista = await cotizacionesSolicitud(id);
      setCotizaciones((prev) => ({ ...prev, [id]: lista }));
    } catch (causa) {
      setErrorCot(causa instanceof Error ? causa.message : "No se pudieron cargar las cotizaciones");
    } finally {
      setCargandoCot(false);
    }
  }

  async function refrescarCotizaciones(id: string) {
    const lista = await cotizacionesSolicitud(id);
    setCotizaciones((prev) => ({ ...prev, [id]: lista }));
  }

  return (
    <>
      <VistaLista
        titulo="Solicitudes"
        descripcion="Publica el soporte que necesitas y elige entre las cotizaciones enviadas."
        acciones={acciones}
      >
        <BarraLista
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar título, descripción o categoría"
          onActualizar={recargar}
        >
          <FiltroLista
            id="filtro-estado-solicitudes"
            etiqueta="Estado"
            valor={filtroEstado}
            opciones={opcionesEstado}
            onCambio={setFiltroEstado}
          />
          <FiltroLista
            id="filtro-categoria-solicitudes"
            etiqueta="Categoría"
            valor={filtroCategoria}
            opciones={opcionesCategoria}
            onCambio={setFiltroCategoria}
            ancho="9rem"
          />
        </BarraLista>
        {error ? <AvisoLista tono="error">{error}</AvisoLista> : null}
        <ListaScroll>
          {cargando ? (
            <EstadoLista>Cargando…</EstadoLista>
          ) : visibles.length === 0 ? (
            solicitudes.length === 0 ? (
              <EstadoLista>Aún no tienes solicitudes.</EstadoLista>
            ) : (
              <EstadoLista onRestablecer={restablecer}>
                {busqueda.trim()
                  ? `Ninguna solicitud coincide con «${busqueda.trim()}».`
                  : "Ninguna solicitud está en este filtro."}
              </EstadoLista>
            )
          ) : (
            <TablaLista columnas={COLUMNAS} orden={orden}>
              {visibles.map((s) => {
                const abierta = s.estado === "abierta";
                return (
                  <FilaLista key={s.id} onAbrir={() => void abrirCotizaciones(s.id)}>
                    <td>
                      <CeldaPrincipal titulo={s.titulo} meta={recortar(s.descripcion)} />
                    </td>
                    <td>
                      <Pastilla tono={tonoEstadoSolicitud(s.estado)}>{tituloEstado(s.estado)}</Pastilla>
                    </td>
                    <td>{s.categoria}</td>
                    <td className="vl-derecha"><CeldaFecha iso={s.creado_en} /></td>
                    <td>
                      {abierta ? (
                        <AccionesFila>
                          <BotonTexto onClick={() => void abrirCotizaciones(s.id)}>Cotizaciones</BotonTexto>
                          <BotonTexto
                            peligro
                            onClick={() => {
                              void (async () => {
                                if (!window.confirm("¿Cancelar esta solicitud?")) return;
                                try {
                                  await cancelarSolicitud(s.id);
                                  if (expandida === s.id) setExpandida(null);
                                  await recargar();
                                } catch (causa) {
                                  setError(causa instanceof Error ? causa.message : "No se pudo cancelar");
                                }
                              })();
                            }}
                          >
                            Cancelar
                          </BotonTexto>
                        </AccionesFila>
                      ) : null}
                    </td>
                  </FilaLista>
                );
              })}
            </TablaLista>
          )}
        </ListaScroll>
        {!cargando && solicitudes.length > 0 ? <PieLista>{visibles.length} en esta vista</PieLista> : null}
      </VistaLista>

      <PublicarSolicitudDialog
        abierto={publicar}
        proveedores={proveedoresCerrados}
        onCerrar={() => setPublicar(false)}
        onPublicada={async () => {
          setPublicar(false);
          await recargar();
        }}
      />

      <DialogCotizaciones
        abierto={expandida !== null}
        solicitud={solicitudExpandida}
        items={expandida ? (cotizaciones[expandida] ?? []) : []}
        cargando={cargandoCot}
        error={errorCot}
        onCerrar={() => setExpandida(null)}
        onElegir={async (c) => {
          try {
            await elegirCotizacion(c.id);
            setExpandida(null);
            await recargar();
          } catch (causa) {
            setErrorCot(causa instanceof Error ? causa.message : "No se pudo elegir");
          }
        }}
        onRechazar={async (c) => {
          if (!expandida) return;
          try {
            await rechazarCotizacion(c.id);
            await refrescarCotizaciones(expandida);
          } catch (causa) {
            setErrorCot(causa instanceof Error ? causa.message : "No se pudo rechazar");
          }
        }}
        onRetirar={async (c) => {
          if (!expandida) return;
          try {
            await retirarParticipacion(c.participacion_id);
            await refrescarCotizaciones(expandida);
          } catch (causa) {
            setErrorCot(causa instanceof Error ? causa.message : "No se pudo retirar");
          }
        }}
      />
    </>
  );
}

function PublicarSolicitudDialog({
  abierto,
  proveedores,
  onCerrar,
  onPublicada,
}: {
  abierto: boolean;
  proveedores: { id: string; titulo: string }[];
  onCerrar: () => void;
  onPublicada: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [dirigida, setDirigida] = useState("");

  useEffect(() => {
    if (!abierto) {
      setError("");
      setEnviando(false);
      setDirigida("");
    }
  }, [abierto]);

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError("");
    const fd = new FormData(evento.currentTarget);
    setEnviando(true);
    try {
      await publicarSolicitud({
        titulo: texto(fd.get("titulo")),
        descripcion: texto(fd.get("descripcion")),
        categoria: texto(fd.get("categoria")),
        dirigida_a_perfil_proveedor_id: dirigida || undefined,
        ubicacion: {
          calle_numero: texto(fd.get("calle_numero")),
          colonia: texto(fd.get("colonia")),
          ciudad: texto(fd.get("ciudad")),
          estado: texto(fd.get("estado")),
          codigo_postal: digitos(fd.get("codigo_postal")),
        },
      });
      await onPublicada();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo publicar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(siguiente) => (!siguiente ? onCerrar() : undefined)}>
      <DialogContent
        className="flex max-h-[min(860px,calc(100svh-2rem))] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        showCloseButton
      >
        <DialogHeader className="gap-1 border-b px-6 py-5">
          <DialogTitle>Nueva solicitud</DialogTitle>
          <DialogDescription>Describe el soporte que necesitas y la ubicación del servicio.</DialogDescription>
        </DialogHeader>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => void onSubmit(e)}>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="sol-titulo">Título</FieldLabel>
                <Input id="sol-titulo" name="titulo" required maxLength={120} />
              </Field>
              <Field>
                <FieldLabel htmlFor="sol-descripcion">Descripción</FieldLabel>
                <Textarea id="sol-descripcion" name="descripcion" required rows={4} />
              </Field>
              <Field>
                <FieldLabel htmlFor="sol-categoria">Categoría</FieldLabel>
                <Input id="sol-categoria" name="categoria" list="categorias-nexora" required />
                <datalist id="categorias-nexora">
                  {CATEGORIAS_SUGERIDAS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              {proveedores.length > 0 ? (
                <Field>
                  <FieldLabel htmlFor="sol-dirigida">Solicitar para (opcional)</FieldLabel>
                  <Select value={dirigida || "__abierto"} onValueChange={(v) => setDirigida(v === "__abierto" ? "" : v)}>
                    <SelectTrigger id="sol-dirigida" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__abierto">Mercado abierto</SelectItem>
                      {proveedores.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          Proveedor de «{p.titulo}»
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
              <FieldSet>
                <FieldLegend>Ubicación del servicio</FieldLegend>
                <Field>
                  <FieldLabel htmlFor="sol-calle">Calle y número</FieldLabel>
                  <Input id="sol-calle" name="calle_numero" required autoComplete="off" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="sol-colonia">Colonia</FieldLabel>
                  <Input id="sol-colonia" name="colonia" required autoComplete="off" />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="sol-ciudad">Ciudad</FieldLabel>
                    <Input id="sol-ciudad" name="ciudad" required autoComplete="off" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="sol-estado">Estado</FieldLabel>
                    <Input id="sol-estado" name="estado" required autoComplete="off" />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="sol-cp">Código postal</FieldLabel>
                  <Input
                    id="sol-cp"
                    name="codigo_postal"
                    required
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="22000"
                    autoComplete="off"
                  />
                </Field>
              </FieldSet>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Publicando…" : "Publicar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogCotizaciones({
  abierto,
  solicitud,
  items,
  cargando,
  error,
  onCerrar,
  onElegir,
  onRechazar,
  onRetirar,
}: {
  abierto: boolean;
  solicitud: Solicitud | undefined;
  items: Cotizacion[];
  cargando: boolean;
  error: string;
  onCerrar: () => void;
  onElegir: (c: Cotizacion) => void;
  onRechazar: (c: Cotizacion) => void;
  onRetirar: (c: Cotizacion) => void;
}) {
  return (
    <Dialog open={abierto} onOpenChange={(siguiente) => (!siguiente ? onCerrar() : undefined)}>
      <DialogContent className="vista-lista flex max-h-[min(720px,calc(100svh-2rem))] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="gap-1 border-b px-6 py-5">
          <DialogTitle>{solicitud?.titulo ?? "Cotizaciones"}</DialogTitle>
          <DialogDescription>Cotizaciones enviadas para esta solicitud.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {cargando ? (
            <p className="text-muted-foreground text-sm">Cargando cotizaciones…</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">Todavía no hay cotizaciones enviadas.</p>
          ) : (
            <ul className="cl-cotizaciones">
              {items.map((c) => (
                <li key={c.id} className="cl-cotizacion">
                  <div className="cl-cotizacion-cabeza">
                    <strong>{dineroMxn(c.costo_mxn)}</strong>
                    <Pastilla tono={tonoEstadoCotizacion(c.estado)}>{tituloEstado(c.estado)}</Pastilla>
                  </div>
                  <p>{c.descripcion}</p>
                  {c.condiciones ? <p className="cl-cotizacion-condiciones">{c.condiciones}</p> : null}
                  {c.estado === "enviada" ? (
                    <div className="cl-cotizacion-acciones">
                      <Button type="button" size="sm" onClick={() => onElegir(c)}>
                        Elegir cotización
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => onRechazar(c)}>
                        Rechazar
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => onRetirar(c)}>
                        Retirar proveedor
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function opcionesConPresentes(
  valores: string[],
  actual: string,
  etiqueta: (valor: string) => string = (v) => v,
): { valor: string; etiqueta: string }[] {
  const presentes = [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  if (actual !== "todas" && !presentes.includes(actual)) presentes.unshift(actual);
  return [{ valor: "todas", etiqueta: "Todas" }, ...presentes.map((v) => ({ valor: v, etiqueta: etiqueta(v) }))];
}

function tonoEstadoSolicitud(estado: string): TonoPastilla {
  const k = estado.toLowerCase();
  if (k === "abierta") return "acento";
  if (k === "asignada") return "alerta";
  if (k === "cerrada") return "positiva";
  return "neutra";
}

function tonoEstadoCotizacion(estado: string): TonoPastilla {
  const k = estado.toLowerCase();
  if (k === "enviada") return "acento";
  if (k === "elegida" || k === "aceptada") return "positiva";
  if (k === "rechazada" || k === "vencida") return "negativa";
  if (k === "descartada" || k === "retirada") return "neutra";
  return "neutra";
}

function recortar(texto: string, max = 90): string {
  const t = texto.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}
