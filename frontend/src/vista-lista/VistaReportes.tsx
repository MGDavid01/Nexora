import { useCallback, useEffect, useMemo, useState } from "react";
import type { Reporte } from "../api";
import { dineroMxn } from "../utilidades/formato";
import { coincideBusqueda, marcaTiempo, ordenarPor, useOrden } from "./orden";
import {
  AvisoLista,
  BarraLista,
  CeldaFecha,
  CeldaPrincipal,
  EstadoLista,
  FiltroLista,
  FilaLista,
  ListaScroll,
  PieLista,
  TablaLista,
  VistaLista,
  type ColumnaLista,
} from "./VistaLista";

type ColReporte = "accion" | "metrica" | "valor" | "fecha";

const COLUMNAS: ColumnaLista<ColReporte>[] = [
  { id: "accion", etiqueta: "Acción", ancho: "34%" },
  { id: "metrica", etiqueta: "Métrica", ancho: "24%" },
  { id: "valor", etiqueta: "Valor", ancho: "22%", alinear: "derecha" },
  { id: "fecha", etiqueta: "Fecha", ancho: "20%", alinear: "derecha" },
];

/** Las acciones llegan como `tipo:uuid` desde services/reportes del backend. */
const ACCIONES: Record<string, string> = {
  cierre_servicio: "Cierre de servicio",
  cotizacion: "Cotización enviada",
  solicitud: "Solicitud publicada",
};

const METRICAS: Record<string, string> = {
  comision_mxn: "Comisión",
  comision_pct: "Porcentaje de comisión",
  costo_mxn: "Costo del servicio",
  alquiler_n_mxn: "Alquiler ESP32 (N %)",
  cotizacion_id: "Cotización",
  enviar: "Monto cotizado",
  publicar: "Publicación",
};

function humanizar(clave: string): string {
  const texto = clave.replaceAll("_", " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function idCorto(id: string): string {
  return `#${id.slice(0, 8)}`;
}

export function etiquetaMetrica(metrica: string): string {
  return METRICAS[metrica] ?? humanizar(metrica);
}

function partirAccion(accion: string): { titulo: string; referencia?: string } {
  const [tipo, id] = accion.split(":", 2);
  return { titulo: ACCIONES[tipo] ?? humanizar(tipo), referencia: id ? idCorto(id) : undefined };
}

function esMonto(metrica: string): boolean {
  return metrica.endsWith("_mxn") || metrica === "enviar";
}

function valorLegible(metrica: string, valor: string): string {
  if (esMonto(metrica)) return dineroMxn(valor);
  if (metrica.endsWith("_pct")) return `${Number(valor)} %`;
  if (metrica.endsWith("_id")) return idCorto(valor);
  return valor;
}

function valorParaOrden(metrica: string, valor: string): string | number {
  const n = Number(valor);
  return !metrica.endsWith("_id") && valor !== "" && !Number.isNaN(n) ? n : valor;
}

/** Lista de reportes compartida por admin, cliente y proveedor; solo cambia de dónde salen. */
export function VistaReportes({
  cargar,
  descripcion,
  vacio,
  filtroId,
}: {
  cargar: () => Promise<Reporte[]>;
  descripcion: string;
  vacio: string;
  filtroId: string;
}) {
  const [items, setItems] = useState<Reporte[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [metrica, setMetrica] = useState("todas");
  const orden = useOrden<ColReporte>("fecha", "desc", ["fecha", "valor"]);

  const recargar = useCallback(async () => {
    try {
      setItems(await cargar());
      setError("");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudieron cargar los reportes");
    }
  }, [cargar]);

  useEffect(() => {
    void recargar().finally(() => setCargando(false));
  }, [recargar]);

  const metricas = useMemo(
    () => [
      { valor: "todas", etiqueta: "Todas" },
      ...[...new Set(items.map((r) => r.metrica))]
        .map((m) => ({ valor: m, etiqueta: etiquetaMetrica(m) }))
        .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es")),
    ],
    [items],
  );

  const visibles = useMemo(
    () =>
      ordenarPor(
        items.filter((r) => {
          if (metrica !== "todas" && r.metrica !== metrica) return false;
          const accion = partirAccion(r.accion);
          return coincideBusqueda(
            busqueda,
            r.accion,
            accion.titulo,
            r.metrica,
            etiquetaMetrica(r.metrica),
            r.valor,
            valorLegible(r.metrica, r.valor),
          );
        }),
        orden,
        {
          accion: (r) => partirAccion(r.accion).titulo,
          metrica: (r) => etiquetaMetrica(r.metrica),
          valor: (r) => valorParaOrden(r.metrica, r.valor),
          fecha: (r) => marcaTiempo(r.fecha),
        },
      ),
    [items, metrica, busqueda, orden],
  );

  function restablecer() {
    setBusqueda("");
    setMetrica("todas");
  }

  return (
    <VistaLista titulo="Reportes" descripcion={descripcion}>
      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar acción, métrica o valor"
        onActualizar={recargar}
      >
        <FiltroLista id={filtroId} etiqueta="Métrica" valor={metrica} opciones={metricas} onCambio={setMetrica} />
      </BarraLista>
      {error ? <AvisoLista tono="error">{error}</AvisoLista> : null}
      <ListaScroll>
        {cargando ? (
          <EstadoLista>Cargando reportes…</EstadoLista>
        ) : visibles.length === 0 ? (
          items.length === 0 ? (
            <EstadoLista>{vacio}</EstadoLista>
          ) : (
            <EstadoLista onRestablecer={restablecer}>
              {busqueda.trim() ? `Ningún reporte coincide con «${busqueda.trim()}».` : "Ningún reporte está en este filtro."}
            </EstadoLista>
          )
        ) : (
          <TablaLista columnas={COLUMNAS} orden={orden}>
            {visibles.map((r) => {
              const accion = partirAccion(r.accion);
              return (
                <FilaLista key={r.id}>
                  <td>
                    <CeldaPrincipal titulo={accion.titulo} meta={accion.referencia} />
                  </td>
                  <td>{etiquetaMetrica(r.metrica)}</td>
                  <td className="vl-derecha">{valorLegible(r.metrica, r.valor)}</td>
                  <td className="vl-derecha">
                    <CeldaFecha iso={r.fecha} />
                  </td>
                </FilaLista>
              );
            })}
          </TablaLista>
        )}
      </ListaScroll>
      {!cargando && items.length > 0 ? <PieLista>{visibles.length} en esta vista</PieLista> : null}
    </VistaLista>
  );
}
