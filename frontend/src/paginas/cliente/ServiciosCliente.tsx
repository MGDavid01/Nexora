import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PlusIcon } from "lucide-react";
import {
  altaEquipo,
  borrarEquipo,
  historialPropio,
  listarEquipos,
  listarReportesPerfil,
  type EquipoComputo,
  type HistorialItem,
  servicioEstaActivo,
} from "../../api";
import { dineroMxn, esPendienteInforme, proximoPasoServicio, tituloEstado } from "../../utilidades/formato";
import { ServicioDetalle } from "../flujo/ServicioDetalle";
import { recortar, tonoEstadoServicio } from "../flujo/servicio-ui";
import {
  AvisoLista,
  BarraLista,
  BotonTexto,
  CeldaFecha,
  CeldaPrincipal,
  EstadoLista,
  FiltroLista,
  FilaLista,
  KpisLista,
  ListaScroll,
  Pastilla,
  PieLista,
  TablaLista,
  VistaLista,
  type ColumnaLista,
} from "../../vista-lista/VistaLista";
import { VistaReportes } from "../../vista-lista/VistaReportes";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type ColServicio = "servicio" | "estado" | "costo" | "creado";
type ColHistorial = "servicio" | "estado" | "costo" | "fecha";
type ColEquipo = "equipo" | "acciones";

const COLUMNAS_SERVICIO: ColumnaLista<ColServicio>[] = [
  { id: "servicio", etiqueta: "Servicio", ancho: "40%" },
  { id: "estado", etiqueta: "Estado", ancho: "18%" },
  { id: "costo", etiqueta: "Costo", ancho: "20%", alinear: "derecha" },
  { id: "creado", etiqueta: "Creado", ancho: "22%", alinear: "derecha" },
];

const COLUMNAS_HISTORIAL: ColumnaLista<ColHistorial>[] = [
  { id: "servicio", etiqueta: "Servicio", ancho: "40%" },
  { id: "estado", etiqueta: "Estado", ancho: "16%" },
  { id: "costo", etiqueta: "Costo", ancho: "20%", alinear: "derecha" },
  { id: "fecha", etiqueta: "Fecha", ancho: "24%", alinear: "derecha" },
];

const COLUMNAS_EQUIPO: ColumnaLista<ColEquipo>[] = [
  { id: "equipo", etiqueta: "Equipo", ancho: "78%" },
  { id: "acciones", etiqueta: "Acciones", ancho: "22%", ordenable: false },
];

export function ServiciosCliente() {
  const { servicioId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const orden = useOrden<ColServicio>("creado", "desc", ["creado", "costo"]);

  const recargar = useCallback(async () => {
    try {
      const lista = await historialPropio();
      setItems(lista.filter((i) => servicioEstaActivo(i.estado)));
      setError("");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo cargar");
    }
  }, []);

  useEffect(() => {
    void recargar().finally(() => setCargando(false));
  }, [recargar]);

  const opcionesEstado = useMemo(
    () => opcionesConPresentes(items.map((i) => i.estado), filtroEstado, tituloEstado),
    [items, filtroEstado],
  );

  const visibles = useMemo(
    () =>
      ordenarPor(
        items.filter(
          (i) =>
            (filtroEstado === "todas" || i.estado === filtroEstado) &&
            coincideBusqueda(busqueda, i.titulo, i.estado, i.proveedor, i.categoria, proximoPasoServicio(i.estado)),
        ),
        orden,
        {
          servicio: (i) => i.titulo,
          estado: (i) => i.estado,
          costo: (i) => numeroOpcional(i.costo_mxn),
          creado: (i) => marcaTiempo(i.creado_en),
        },
      ),
    [items, filtroEstado, busqueda, orden],
  );

  function restablecer() {
    setBusqueda("");
    setFiltroEstado("todas");
  }

  if (servicioId) {
    return <ServicioDetalle servicioId={servicioId} volverA="/cliente/servicios" />;
  }

  const kpis = (
    <KpisLista
      items={[
        { etiqueta: "Activos", valor: items.length },
        { etiqueta: "En curso", valor: items.filter((i) => i.estado === "en_curso").length },
        { etiqueta: "Por informe", valor: items.filter((i) => esPendienteInforme(i.estado)).length },
      ]}
    />
  );

  return (
    <VistaLista
      titulo="Servicios"
      descripcion="Trabajo ya contratado. Abre el caso para ver el avance."
      kpis={!cargando ? kpis : undefined}
    >
      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar servicio o proveedor"
        onActualizar={recargar}
      >
        <FiltroLista
          id="filtro-estado-servicios"
          etiqueta="Estado"
          valor={filtroEstado}
          opciones={opcionesEstado}
          onCambio={setFiltroEstado}
        />
      </BarraLista>
      {error ? <AvisoLista tono="error">{error}</AvisoLista> : null}
      <ListaScroll>
        {cargando ? (
          <EstadoLista>Cargando…</EstadoLista>
        ) : visibles.length === 0 ? (
          items.length === 0 ? (
            <EstadoLista>
              No hay servicios activos.{" "}
              <Link to="/cliente/solicitudes">Ver solicitudes</Link>
            </EstadoLista>
          ) : (
            <EstadoLista onRestablecer={restablecer}>
              {busqueda.trim()
                ? `Ningún servicio coincide con «${busqueda.trim()}».`
                : "Ningún servicio está en este filtro."}
            </EstadoLista>
          )
        ) : (
          <TablaLista columnas={COLUMNAS_SERVICIO} orden={orden}>
            {visibles.map((i) => (
              <FilaLista key={i.servicio_id} onAbrir={() => navigate(`/cliente/servicios/${i.servicio_id}`)}>
                <td>
                  <CeldaPrincipal
                    titulo={i.titulo}
                    meta={metaServicio(i, "cliente")}
                    avatar={i.proveedor ? { nombre: i.proveedor } : undefined}
                  />
                </td>
                <td>
                  <Pastilla tono={tonoEstadoServicio(i.estado)}>{tituloEstado(i.estado)}</Pastilla>
                </td>
                <td className="vl-derecha">{dineroMxn(i.costo_mxn)}</td>
                <td className="vl-derecha"><CeldaFecha iso={i.creado_en} /></td>
              </FilaLista>
            ))}
          </TablaLista>
        )}
      </ListaScroll>
      {!cargando && items.length > 0 ? <PieLista>{visibles.length} en esta vista</PieLista> : null}
    </VistaLista>
  );
}

export function HistorialCliente() {
  const { servicioId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const orden = useOrden<ColHistorial>("fecha", "desc", ["fecha", "costo"]);

  const recargar = useCallback(async () => {
    try {
      const lista = await historialPropio();
      setItems(lista.filter((i) => !servicioEstaActivo(i.estado)));
      setError("");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo cargar");
    }
  }, []);

  useEffect(() => {
    void recargar().finally(() => setCargando(false));
  }, [recargar]);

  const opcionesEstado = useMemo(
    () => [
      { valor: "todas", etiqueta: "Todos" },
      { valor: "cerrado", etiqueta: tituloEstado("cerrado") },
      { valor: "cancelado", etiqueta: tituloEstado("cancelado") },
    ],
    [],
  );

  const visibles = useMemo(
    () =>
      ordenarPor(
        items.filter(
          (i) =>
            (filtroEstado === "todas" || i.estado === filtroEstado) &&
            coincideBusqueda(busqueda, i.titulo, i.informe?.descripcion, i.estado, i.proveedor),
        ),
        orden,
        {
          servicio: (i) => i.titulo,
          estado: (i) => i.estado,
          costo: (i) => numeroOpcional(i.costo_mxn),
          fecha: (i) => marcaTiempo(i.informe?.fecha ?? i.creado_en),
        },
      ),
    [items, filtroEstado, busqueda, orden],
  );

  function restablecer() {
    setBusqueda("");
    setFiltroEstado("todas");
  }

  if (servicioId) {
    return <ServicioDetalle servicioId={servicioId} volverA="/cliente/historial" />;
  }

  return (
    <VistaLista titulo="Historial" descripcion="Servicios ya cerrados o cancelados. Abre uno para ver el informe.">
      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar servicio o informe"
        onActualizar={recargar}
      >
        <FiltroLista
          id="filtro-estado-historial"
          etiqueta="Estado"
          valor={filtroEstado}
          opciones={opcionesEstado}
          onCambio={setFiltroEstado}
        />
      </BarraLista>
      {error ? <AvisoLista tono="error">{error}</AvisoLista> : null}
      <ListaScroll>
        {cargando ? (
          <EstadoLista>Cargando…</EstadoLista>
        ) : visibles.length === 0 ? (
          items.length === 0 ? (
            <EstadoLista>Sin servicios cerrados todavía.</EstadoLista>
          ) : (
            <EstadoLista onRestablecer={restablecer}>
              {busqueda.trim()
                ? `Ningún servicio coincide con «${busqueda.trim()}».`
                : "Ningún servicio está en este filtro."}
            </EstadoLista>
          )
        ) : (
          <TablaLista columnas={COLUMNAS_HISTORIAL} orden={orden}>
            {visibles.map((i) => (
              <FilaLista key={i.servicio_id} onAbrir={() => navigate(`/cliente/historial/${i.servicio_id}`)}>
                <td>
                  <CeldaPrincipal
                    titulo={i.titulo}
                    meta={metaHistorial(i)}
                    avatar={i.proveedor ? { nombre: i.proveedor } : undefined}
                  />
                </td>
                <td>
                  <Pastilla tono={tonoEstadoServicio(i.estado)}>{tituloEstado(i.estado)}</Pastilla>
                </td>
                <td className="vl-derecha">{dineroMxn(i.costo_mxn)}</td>
                <td className="vl-derecha"><CeldaFecha iso={i.informe?.fecha ?? i.creado_en} /></td>
              </FilaLista>
            ))}
          </TablaLista>
        )}
      </ListaScroll>
      {!cargando && items.length > 0 ? <PieLista>{visibles.length} en esta vista</PieLista> : null}
    </VistaLista>
  );
}

export function EquiposCliente() {
  const [items, setItems] = useState<EquipoComputo[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [altaAbierta, setAltaAbierta] = useState(false);
  const orden = useOrden<ColEquipo>("equipo", "asc");

  const recargar = useCallback(async () => {
    try {
      setItems(await listarEquipos());
      setError("");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo cargar");
    }
  }, []);

  useEffect(() => {
    void recargar().finally(() => setCargando(false));
  }, [recargar]);

  const visibles = useMemo(
    () =>
      ordenarPor(
        items.filter((eq) => coincideBusqueda(busqueda, eq.nombre)),
        orden,
        {
          equipo: (eq) => eq.nombre,
          acciones: () => null,
        },
      ),
    [items, busqueda, orden],
  );

  const acciones = useMemo(
    () => (
      <Button type="button" size="sm" onClick={() => setAltaAbierta(true)}>
        <PlusIcon data-icon="inline-start" />
        Agregar equipo
      </Button>
    ),
    [],
  );

  return (
    <>
      <VistaLista
        titulo="Equipos"
        descripcion="Equipos de cómputo registrados en tu perfil."
        acciones={acciones}
      >
        <BarraLista
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar equipo"
          onActualizar={recargar}
        />
        {error ? <AvisoLista tono="error">{error}</AvisoLista> : null}
        <ListaScroll>
          {cargando ? (
            <EstadoLista>Cargando…</EstadoLista>
          ) : visibles.length === 0 ? (
            items.length === 0 ? (
              <EstadoLista>No hay equipos registrados.</EstadoLista>
            ) : (
              <EstadoLista onRestablecer={() => setBusqueda("")}>
                {`Ningún equipo coincide con «${busqueda.trim()}».`}
              </EstadoLista>
            )
          ) : (
            <TablaLista columnas={COLUMNAS_EQUIPO} orden={orden}>
              {visibles.map((eq) => (
                <FilaLista key={eq.id}>
                  <td>
                    <CeldaPrincipal titulo={eq.nombre} />
                  </td>
                  <td>
                    <BotonTexto
                      peligro
                      onClick={() => {
                        void (async () => {
                          if (!window.confirm(`¿Quitar el equipo «${eq.nombre}»?`)) return;
                          try {
                            await borrarEquipo(eq.id);
                            await recargar();
                          } catch (causa) {
                            setError(causa instanceof Error ? causa.message : "No se pudo borrar");
                          }
                        })();
                      }}
                    >
                      Quitar
                    </BotonTexto>
                  </td>
                </FilaLista>
              ))}
            </TablaLista>
          )}
        </ListaScroll>
        {!cargando && items.length > 0 ? <PieLista>{visibles.length} en esta vista</PieLista> : null}
      </VistaLista>

      <AltaEquipoDialog
        abierto={altaAbierta}
        onCerrar={() => setAltaAbierta(false)}
        onCreado={async () => {
          setAltaAbierta(false);
          await recargar();
        }}
      />
    </>
  );
}

export function ReportesCliente() {
  return (
    <VistaReportes
      cargar={listarReportesPerfil}
      descripcion="Mediciones que genera el sistema sobre tu perfil. No sustituyen al historial."
      vacio="Aún no hay mediciones en este perfil."
      filtroId="filtro-metrica-reportes-cliente"
    />
  );
}

function AltaEquipoDialog({
  abierto,
  onCerrar,
  onCreado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!abierto) {
      setError("");
      setEnviando(false);
    }
  }, [abierto]);

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nombre = String(new FormData(evento.currentTarget).get("nombre") ?? "").trim();
    if (!nombre) return;
    setError("");
    setEnviando(true);
    try {
      await altaEquipo(nombre);
      await onCreado();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo registrar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(siguiente) => (!siguiente ? onCerrar() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar equipo</DialogTitle>
          <DialogDescription>Escribe el nombre con el que identificas el equipo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="eq-nombre">Nombre</FieldLabel>
              <Input id="eq-nombre" name="nombre" required maxLength={120} autoComplete="off" />
            </Field>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Agregando…" : "Agregar"}
            </Button>
          </DialogFooter>
        </form>
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
  return [{ valor: "todas", etiqueta: "Todos" }, ...presentes.map((v) => ({ valor: v, etiqueta: etiqueta(v) }))];
}

function metaServicio(item: HistorialItem, lado: "cliente" | "proveedor"): string {
  const contraparte = lado === "cliente" ? item.proveedor : item.cliente;
  const paso = proximoPasoServicio(item.estado, { tecnico: item.tecnico, lado });
  return [contraparte, paso].filter(Boolean).join(" · ");
}

function metaHistorial(item: HistorialItem): string | undefined {
  const informe = item.informe?.descripcion ? recortar(item.informe.descripcion) : undefined;
  const contraparte = item.proveedor || item.cliente;
  return [contraparte, informe].filter(Boolean).join(" · ") || undefined;
}

function numeroOpcional(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isNaN(n) ? null : n;
}
