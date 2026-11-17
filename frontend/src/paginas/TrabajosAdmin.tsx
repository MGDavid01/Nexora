import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listarTrabajosAdmin, type TrabajoLista } from "../api";
import {
  Ausente,
  AvisoLista,
  BarraLista,
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
} from "../vista-lista/VistaLista";
import { marcaTiempo, ordenarPor, useOrden } from "../vista-lista/orden";

type FiltroEtapa = "todas" | "solicitud" | "cotizacion" | "servicio";
type FiltroReclamacion = "todas" | "abierta" | "cerrada";
type FiltroCierre = "todos" | "abierto" | "cerrado";
type FiltroMarca = "todas" | "con" | "sin";
type ColTrabajo = "caso" | "etapa" | "cliente" | "categoria" | "creado" | "reclamacion";

const fechaCorta = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const COLUMNAS: ColumnaLista<ColTrabajo>[] = [
  { id: "caso", etiqueta: "Caso", ancho: "28%" },
  { id: "etapa", etiqueta: "Etapa", ancho: "12%" },
  { id: "cliente", etiqueta: "Cliente", ancho: "16%" },
  { id: "categoria", etiqueta: "Categoría", ancho: "16%" },
  { id: "creado", etiqueta: "Creado", ancho: "14%", alinear: "derecha" },
  { id: "reclamacion", etiqueta: "Reclamación", ancho: "14%" },
];

const OPCIONES_ETAPA: { valor: FiltroEtapa; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "solicitud", etiqueta: "Solicitud" },
  { valor: "cotizacion", etiqueta: "Cotización" },
  { valor: "servicio", etiqueta: "Servicio" },
];

const OPCIONES_RECLAMACION: { valor: FiltroReclamacion; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "abierta", etiqueta: "Abierta" },
  { valor: "cerrada", etiqueta: "Cerrada" },
];

const OPCIONES_CIERRE: { valor: FiltroCierre; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "abierto", etiqueta: "Abierto" },
  { valor: "cerrado", etiqueta: "Cerrado" },
];

const OPCIONES_MARCA: { valor: FiltroMarca; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "con", etiqueta: "Con marca" },
  { valor: "sin", etiqueta: "Sin marca" },
];

function etiquetaEtapa(etapa: TrabajoLista["etapa"]): string {
  if (etapa === "solicitud") return "Solicitud";
  if (etapa === "cotizacion") return "Cotización";
  return "Servicio";
}

function tonoEtapa(etapa: TrabajoLista["etapa"]): TonoPastilla {
  if (etapa === "servicio") return "positiva";
  if (etapa === "cotizacion") return "acento";
  return "neutra";
}

function etiquetaReclamacion(reclamacion: TrabajoLista["reclamacion"]): string {
  if (reclamacion === "abierta") return "Abierta";
  if (reclamacion === "cerrada") return "Cerrada";
  return "";
}

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return fechaCorta.format(d);
}

export function TrabajosAdmin() {
  const navigate = useNavigate();
  const [filtroEtapa, setFiltroEtapa] = useState<FiltroEtapa>("todas");
  const [filtroReclamacion, setFiltroReclamacion] = useState<FiltroReclamacion>("todas");
  const [filtroCierre, setFiltroCierre] = useState<FiltroCierre>("todos");
  const [filtroMarca, setFiltroMarca] = useState<FiltroMarca>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaApi, setBusquedaApi] = useState("");
  const [casos, setCasos] = useState<TrabajoLista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState("");
  const orden = useOrden<ColTrabajo>("creado", "desc", ["creado"]);

  useEffect(() => {
    const t = window.setTimeout(() => setBusquedaApi(busqueda.trim()), 320);
    return () => window.clearTimeout(t);
  }, [busqueda]);

  const filtrosApi = useMemo(
    () => ({
      etapa: filtroEtapa === "todas" ? undefined : filtroEtapa,
      reclamacion: filtroReclamacion === "todas" ? undefined : filtroReclamacion,
      cierre: filtroCierre === "todos" ? undefined : filtroCierre,
      marca: filtroMarca === "todas" ? undefined : filtroMarca,
      q: busquedaApi || undefined,
    }),
    [filtroEtapa, filtroReclamacion, filtroCierre, filtroMarca, busquedaApi],
  );

  useLayoutEffect(() => {
    setCargando(true);
    setErrorGlobal("");
  }, [filtrosApi]);

  useEffect(() => {
    let vivo = true;
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

  const recargar = useCallback(async () => {
    try {
      const lista = await listarTrabajosAdmin(filtrosApi);
      setCasos(lista);
      setErrorGlobal("");
    } catch (causa) {
      setErrorGlobal(causa instanceof Error ? causa.message : "No se pudieron cargar los casos");
      throw causa;
    }
  }, [filtrosApi]);

  const visibles = useMemo(
    () =>
      ordenarPor(casos, orden, {
        caso: (c) => c.titulo,
        etapa: (c) => etiquetaEtapa(c.etapa),
        cliente: (c) => c.cliente,
        categoria: (c) => c.categoria,
        creado: (c) => marcaTiempo(c.creado_en),
        reclamacion: (c) => etiquetaReclamacion(c.reclamacion),
      }),
    [casos, orden],
  );

  const hayFiltros = Boolean(
    filtroEtapa !== "todas" ||
      filtroReclamacion !== "todas" ||
      filtroCierre !== "todos" ||
      filtroMarca !== "todas" ||
      busquedaApi,
  );

  function restablecer() {
    setFiltroEtapa("todas");
    setFiltroReclamacion("todas");
    setFiltroCierre("todos");
    setFiltroMarca("todas");
    setBusqueda("");
    setBusquedaApi("");
  }

  return (
    <VistaLista titulo="Trabajos" descripcion="Solicitudes, cotizaciones, servicios y reclamaciones por caso.">
      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar caso, cliente o categoría"
        onActualizar={recargar}
      >
        <FiltroLista
          id="filtro-etapa-trabajos"
          etiqueta="Etapa"
          valor={filtroEtapa}
          opciones={OPCIONES_ETAPA}
          onCambio={setFiltroEtapa}
        />
        <FiltroLista
          id="filtro-reclamacion-trabajos"
          etiqueta="Reclamación"
          valor={filtroReclamacion}
          opciones={OPCIONES_RECLAMACION}
          onCambio={setFiltroReclamacion}
        />
        <FiltroLista
          id="filtro-cierre-trabajos"
          etiqueta="Estado"
          valor={filtroCierre}
          opciones={OPCIONES_CIERRE}
          onCambio={setFiltroCierre}
        />
        <FiltroLista
          id="filtro-marca-trabajos"
          etiqueta="Marca"
          valor={filtroMarca}
          opciones={OPCIONES_MARCA}
          onCambio={setFiltroMarca}
        />
      </BarraLista>
      {errorGlobal ? <AvisoLista tono="error">{errorGlobal}</AvisoLista> : null}
      <ListaScroll>
        {cargando ? (
          <EstadoLista>Cargando casos…</EstadoLista>
        ) : visibles.length === 0 ? (
          hayFiltros ? (
            <EstadoLista onRestablecer={restablecer}>Sin casos con estos filtros.</EstadoLista>
          ) : (
            <EstadoLista>Aún no hay casos que mostrar.</EstadoLista>
          )
        ) : (
          <TablaLista columnas={COLUMNAS} orden={orden}>
            {visibles.map((c) => (
              <FilaLista key={c.solicitud_id} onAbrir={() => navigate(`/admin/trabajos/${c.solicitud_id}`)}>
                <td>
                  <CeldaPrincipal titulo={c.titulo} meta={c.categoria} />
                </td>
                <td>
                  <Pastilla tono={tonoEtapa(c.etapa)}>{etiquetaEtapa(c.etapa)}</Pastilla>
                </td>
                <td>{c.cliente}</td>
                <td>{c.categoria}</td>
                <td className="vl-derecha">
                  {formatearFecha(c.creado_en) || <Ausente />}
                </td>
                <td>
                  {c.reclamacion === "abierta" ? (
                    <Pastilla tono="alerta">Abierta</Pastilla>
                  ) : c.reclamacion === "cerrada" ? (
                    <Pastilla tono="positiva">Cerrada</Pastilla>
                  ) : (
                    <Ausente />
                  )}
                </td>
              </FilaLista>
            ))}
          </TablaLista>
        )}
      </ListaScroll>
      {!cargando && visibles.length > 0 ? <PieLista>{visibles.length} en esta vista</PieLista> : null}
    </VistaLista>
  );
}
