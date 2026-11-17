import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  historialPropio,
  listarUsuariosEmpresa,
  porCotizarProveedor,
  type HistorialItem,
  type Solicitud,
  servicioEstaActivo,
} from "../../api";
import { useSesion } from "../../sesion";
import {
  dineroMxn,
  esPendienteInforme,
  plazoRestante,
  proximoPasoServicio,
  tituloEstado,
} from "../../utilidades/formato";
import { ServicioDetalle } from "../flujo/ServicioDetalle";
import { recortar, tonoEstadoServicio } from "../flujo/servicio-ui";
import {
  AccionesFila,
  AvisoLista,
  BarraLista,
  BotonTexto,
  CeldaFecha,
  CeldaPrincipal,
  EstadoLista,
  FiltroLista,
  FilaGrupo,
  FilaLista,
  KpisLista,
  ListaScroll,
  Pastilla,
  PieLista,
  TablaLista,
  VistaLista,
  type ColumnaLista,
} from "../../vista-lista/VistaLista";
import { coincideBusqueda, marcaTiempo, ordenarPor, useOrden } from "../../vista-lista/orden";
import { DialogCotizar } from "./DialogCotizar";

type ColServicio = "servicio" | "estado" | "costo" | "creado";

type ColServicioAccion = ColServicio | "accion";

const COLUMNAS: ColumnaLista<ColServicio>[] = [
  { id: "servicio", etiqueta: "Servicio", ancho: "40%" },
  { id: "estado", etiqueta: "Estado", ancho: "18%" },
  { id: "costo", etiqueta: "Costo", ancho: "18%", alinear: "derecha" },
  { id: "creado", etiqueta: "Creado", ancho: "24%", alinear: "derecha" },
];

const COLUMNAS_CON_ACCION: ColumnaLista<ColServicioAccion>[] = [
  { id: "servicio", etiqueta: "Servicio", ancho: "34%" },
  { id: "estado", etiqueta: "Estado", ancho: "16%" },
  { id: "costo", etiqueta: "Costo", ancho: "14%", alinear: "derecha" },
  { id: "creado", etiqueta: "Creado", ancho: "18%", alinear: "derecha" },
  { id: "accion", etiqueta: "Acción", ancho: "18%", ordenable: false },
];

type FilaServicio = {
  clave: string;
  titulo: string;
  estado: string;
  costo_mxn: string | null;
  creado_en: string | null;
  meta?: string;
  cliente?: string | null;
  tecnico?: string | null;
  historial?: HistorialItem;
  solicitud?: Solicitud;
};

export function ServiciosProveedor() {
  const { usuario } = useSesion();
  const { servicioId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [pendientes, setPendientes] = useState<Solicitud[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string }[]>([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(true);
  const [cotizar, setCotizar] = useState<Solicitud | null>(null);

  const recargar = useCallback(async () => {
    try {
      const [lista, porCotizar] = await Promise.all([historialPropio(), porCotizarProveedor()]);
      setItems(lista.filter((i) => servicioEstaActivo(i.estado)));
      setPendientes(porCotizar);
      setError("");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo cargar");
    }
  }, []);

  useEffect(() => {
    void recargar().finally(() => setCargando(false));
  }, [recargar]);

  useEffect(() => {
    if (usuario?.tipo_cuenta !== "empresa") return;
    listarUsuariosEmpresa()
      .then((usuarios) =>
        setTecnicos(
          usuarios.filter((u) => u.funcion === "tecnico" && !u.baja_procesada).map((u) => ({ id: u.id, nombre: u.nombre })),
        ),
      )
      .catch(() => {
        /* sin lista de técnicos */
      });
  }, [usuario?.tipo_cuenta]);

  useEffect(() => {
    const cotizarId = (location.state as { cotizarId?: string } | null)?.cotizarId;
    if (!cotizarId || pendientes.length === 0) return;
    const destino = pendientes.find(
      (s) => s.id === cotizarId && s.participacion_estado !== "cotizada",
    );
    if (destino) setCotizar(destino);
    navigate("/proveedor/servicios", { replace: true, state: {} });
  }, [location.state, pendientes, navigate]);

  if (servicioId) {
    return <ServicioDetalle servicioId={servicioId} tecnicos={tecnicos} volverA="/proveedor/servicios" />;
  }

  return (
    <>
      <TablaServicios
        titulo="Servicios"
        descripcion="Cotiza lo aceptado y sigue el trabajo en curso."
        idFiltro="filtro-estado-servicios"
        items={items}
        pendientes={pendientes}
        cargando={cargando}
        error={error}
        aviso={aviso}
        onActualizar={recargar}
        vacio={
          <>
            Sin servicios activos ni cotizaciones en curso.{" "}
            <Link to="/proveedor/solicitudes">Ver mercado</Link>
          </>
        }
        onAbrir={(item) => navigate(`/proveedor/servicios/${item.servicio_id}`)}
        onCotizar={setCotizar}
        kpis
      />
      {cotizar ? (
        <DialogCotizar
          solicitud={cotizar}
          onCerrar={() => setCotizar(null)}
          onEnviada={async () => {
            setCotizar(null);
            setAviso("Cotización enviada.");
            await recargar();
          }}
        />
      ) : null}
    </>
  );
}

export function HistorialProveedor() {
  const { servicioId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

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

  if (servicioId) {
    return <ServicioDetalle servicioId={servicioId} volverA="/proveedor/historial" />;
  }

  return (
    <TablaServicios
      titulo="Historial"
      descripcion="Servicios que tu perfil ya dio. Abre uno para ver el informe."
      idFiltro="filtro-estado-historial"
      items={items}
      cargando={cargando}
      error={error}
      onActualizar={recargar}
      vacio="Sin servicios en el historial."
      onAbrir={(item) => navigate(`/proveedor/historial/${item.servicio_id}`)}
      metaDe={(item) => item.informe?.descripcion}
    />
  );
}

function TablaServicios({
  titulo,
  descripcion,
  idFiltro,
  items,
  pendientes = [],
  cargando,
  error,
  aviso,
  onActualizar,
  vacio,
  onAbrir,
  onCotizar,
  metaDe,
  kpis,
}: {
  titulo: string;
  descripcion: string;
  idFiltro: string;
  items: HistorialItem[];
  pendientes?: Solicitud[];
  cargando: boolean;
  error: string;
  aviso?: string;
  onActualizar: () => Promise<unknown>;
  vacio: ReactNode;
  onAbrir?: (item: HistorialItem) => void;
  onCotizar?: (solicitud: Solicitud) => void;
  metaDe?: (item: HistorialItem) => string | null | undefined;
  kpis?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("todos");
  const orden = useOrden<ColServicioAccion>("creado", "desc", ["creado", "costo"]);

  const filas = useMemo<FilaServicio[]>(
    () => [
      ...pendientes.map((s) => ({
        clave: `cotizar-${s.id}`,
        titulo: s.titulo,
        estado: s.participacion_estado === "cotizada" ? "cotizada" : "por_cotizar",
        costo_mxn: s.costo_mxn ?? null,
        creado_en: s.aceptada_en ?? s.creado_en,
        meta: metaPendiente(s),
        solicitud: s,
      })),
      ...items.map((i) => ({
        clave: i.servicio_id,
        titulo: i.titulo,
        estado: i.estado,
        costo_mxn: i.costo_mxn,
        creado_en: i.creado_en,
        meta: metaActivo(i, metaDe?.(i)),
        cliente: i.cliente,
        tecnico: i.tecnico,
        historial: i,
      })),
    ],
    [pendientes, items, metaDe],
  );
  const conAccion = Boolean(onCotizar) && filas.some((i) => i.estado === "por_cotizar");
  const columnas = conAccion ? COLUMNAS_CON_ACCION : COLUMNAS;

  const estados = useMemo(
    () => [
      { valor: "todos", etiqueta: "Todos" },
      ...[...new Set(filas.map((i) => i.estado))]
        .sort((a, b) => a.localeCompare(b, "es"))
        .map((e) => ({ valor: e, etiqueta: tituloEstado(e) })),
    ],
    [filas],
  );

  const visibles = useMemo(() => {
    const filtradas = ordenarPor(
      filas.filter(
        (i) =>
          (estado === "todos" || i.estado === estado) &&
          coincideBusqueda(busqueda, i.titulo, i.estado, tituloEstado(i.estado), i.costo_mxn, i.meta, i.cliente),
      ),
      orden,
      {
        servicio: (i) => i.titulo,
        estado: (i) => i.estado,
        costo: (i) => (i.costo_mxn == null || i.costo_mxn === "" ? null : Number(i.costo_mxn)),
        creado: (i) => marcaTiempo(i.creado_en),
        accion: () => "",
      },
    );
    return agruparFilas(filtradas);
  }, [filas, estado, busqueda, orden]);

  function restablecer() {
    setBusqueda("");
    setEstado("todos");
  }

  const tiraKpis = kpis ? (
    <KpisLista
      items={[
        { etiqueta: "Por cotizar", valor: pendientes.filter((s) => s.participacion_estado !== "cotizada").length },
        { etiqueta: "Activos", valor: items.length },
        { etiqueta: "En curso", valor: items.filter((i) => i.estado === "en_curso").length },
        { etiqueta: "Por informe", valor: items.filter((i) => esPendienteInforme(i.estado)).length },
      ]}
    />
  ) : undefined;

  return (
    <VistaLista titulo={titulo} descripcion={descripcion} kpis={!cargando ? tiraKpis : undefined}>
      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar servicio, cliente o estado"
        onActualizar={onActualizar}
      >
        <FiltroLista
          id={idFiltro}
          etiqueta="Estado"
          valor={estado}
          opciones={estados}
          onCambio={setEstado}
        />
      </BarraLista>
      {error ? <AvisoLista tono="error">{error}</AvisoLista> : null}
      {!error && aviso ? <AvisoLista tono="ok">{aviso}</AvisoLista> : null}
      <ListaScroll>
        {cargando ? (
          <EstadoLista>Cargando…</EstadoLista>
        ) : visibles.length === 0 ? (
          filas.length === 0 ? (
            <EstadoLista>{vacio}</EstadoLista>
          ) : (
            <EstadoLista onRestablecer={restablecer}>
              {busqueda.trim()
                ? `Ningún servicio coincide con «${busqueda.trim()}».`
                : "Ningún servicio está en este filtro."}
            </EstadoLista>
          )
        ) : (
          <TablaLista columnas={columnas} orden={orden}>
            {visibles.map((i) => (
              <Fragment key={i.clave}>
                {i.grupo ? <FilaGrupo columnas={columnas.length}>{i.grupo}</FilaGrupo> : null}
                <FilaLista
                  onAbrir={
                    i.solicitud && onCotizar && i.estado === "por_cotizar"
                      ? () => onCotizar(i.solicitud!)
                      : i.historial && onAbrir
                        ? () => onAbrir(i.historial!)
                        : undefined
                  }
                >
                  <td>
                    <CeldaPrincipal
                      titulo={i.titulo}
                      meta={i.meta}
                      avatar={i.cliente ? { nombre: i.cliente } : undefined}
                    />
                  </td>
                  <td>
                    <Pastilla tono={tonoEstadoServicio(i.estado)}>{tituloEstado(i.estado)}</Pastilla>
                  </td>
                  <td className="vl-derecha">{dineroMxn(i.costo_mxn)}</td>
                  <td className="vl-derecha"><CeldaFecha iso={i.creado_en} /></td>
                  {conAccion ? (
                    <td>
                      {i.solicitud && onCotizar && i.estado === "por_cotizar" ? (
                        <AccionesFila>
                          <BotonTexto onClick={() => onCotizar(i.solicitud!)}>Cotizar</BotonTexto>
                        </AccionesFila>
                      ) : null}
                    </td>
                  ) : null}
                </FilaLista>
              </Fragment>
            ))}
          </TablaLista>
        )}
      </ListaScroll>
      {!cargando && filas.length > 0 ? <PieLista>{visibles.length} en esta vista</PieLista> : null}
    </VistaLista>
  );
}

function metaPendiente(s: Solicitud): string {
  if (s.participacion_estado === "cotizada") return "Esperando al cliente";
  return `Cotizar · ${plazoRestante(s.aceptada_en)}`;
}

function metaActivo(item: HistorialItem, extra?: string | null): string {
  const paso = proximoPasoServicio(item.estado, { tecnico: item.tecnico, lado: "proveedor" });
  const informe = extra ? recortar(extra) : undefined;
  return [item.cliente, paso, informe].filter(Boolean).join(" · ");
}

function grupoDe(estado: string): string {
  if (estado === "por_cotizar") return "Por cotizar";
  if (estado === "cotizada") return "En espera del cliente";
  return "En curso";
}

function agruparFilas(filas: FilaServicio[]): (FilaServicio & { grupo?: string })[] {
  const hayCotizar = filas.some((i) => i.estado === "por_cotizar" || i.estado === "cotizada");
  if (!hayCotizar) return filas;
  const porCotizar = filas.filter((i) => i.estado === "por_cotizar");
  const cotizadas = filas.filter((i) => i.estado === "cotizada");
  const resto = filas.filter((i) => i.estado !== "por_cotizar" && i.estado !== "cotizada");
  const ordenadas = [...porCotizar, ...cotizadas, ...resto];
  let grupoActual = "";
  return ordenadas.map((fila) => {
    const grupo = grupoDe(fila.estado);
    const cabecera = grupo !== grupoActual ? grupo : undefined;
    grupoActual = grupo;
    return cabecera ? { ...fila, grupo: cabecera } : fila;
  });
}
