import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileBarChartIcon, PlusIcon } from "lucide-react";
import {
  altaDispositivoAdmin,
  asignarDispositivoAdmin,
  autorizarConversionAdmin,
  desasignarDispositivoAdmin,
  esProveedor,
  estatusDispositivoAdmin,
  listarAuditoriaAdmin,
  listarConversionesAdmin,
  listarDispositivosAdmin,
  listarReportesAdmin,
  listarUsuariosAdmin,
  obtenerIngresosAdmin,
  rechazarConversionAdmin,
  type Conversion,
  type Dispositivo,
  type UsuarioLista,
} from "../../api";
import { dineroMxn, fechaCorta } from "../../utilidades/formato";
import {
  Ausente,
  AvisoLista,
  BarraLista,
  AccionesFila,
  BotonTexto,
  CeldaDoble,
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
  type TonoPastilla,
} from "../../vista-lista/VistaLista";
import { VistaReportes } from "../../vista-lista/VistaReportes";
import { coincideBusqueda, marcaTiempo, ordenarPor, useOrden } from "../../vista-lista/orden";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ReportesAdmin() {
  return (
    <VistaReportes
      cargar={listarReportesAdmin}
      descripcion="Mediciones de las acciones de un perfil. No sustituyen al historial de servicios."
      vacio="Cuando el sistema registre mediciones, aparecerán aquí."
      filtroId="filtro-metrica-reportes"
    />
  );
}

type DatosIngresos = Awaited<ReturnType<typeof obtenerIngresosAdmin>>;
type ColIngreso = "servicio" | "costo" | "porcentaje" | "comision";
const COLUMNAS_INGRESO: ColumnaLista<ColIngreso>[] = [
  { id: "servicio", etiqueta: "Servicio", ancho: "40%" },
  { id: "costo", etiqueta: "Costo", ancho: "20%", alinear: "derecha" },
  { id: "porcentaje", etiqueta: "Porcentaje", ancho: "16%", alinear: "derecha" },
  { id: "comision", etiqueta: "Comisión", ancho: "24%", alinear: "derecha" },
];

export function IngresosAdmin() {
  const navigate = useNavigate();
  const [datos, setDatos] = useState<DatosIngresos | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const orden = useOrden<ColIngreso>("comision", "desc", ["costo", "porcentaje", "comision"]);

  async function recargar() {
    try {
      const ingresos = await obtenerIngresosAdmin();
      setDatos(ingresos);
      setError("");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudieron cargar los ingresos");
    }
  }

  useEffect(() => {
    void recargar().finally(() => setCargando(false));
  }, []);

  const comisiones = datos?.comisiones ?? [];

  const visibles = useMemo(
    () =>
      ordenarPor(
        comisiones.filter((c) =>
          coincideBusqueda(
            busqueda,
            c.servicio_id,
            idCorto(c.servicio_id),
            c.titulo,
            String(c.costo_mxn),
            String(c.porcentaje),
            String(c.comision_mxn),
          ),
        ),
        orden,
        {
          servicio: (c) => c.titulo ?? c.servicio_id,
          costo: (c) => c.costo_mxn,
          porcentaje: (c) => c.porcentaje,
          comision: (c) => c.comision_mxn,
        },
      ),
    [comisiones, busqueda, orden],
  );

  function restablecer() {
    setBusqueda("");
  }

  const kpis = datos ? (
    <KpisLista
      items={[
        { etiqueta: "Comisión acumulada", valor: dineroMxn(datos.comision_total_mxn) },
        { etiqueta: "Base cobrada", valor: dineroMxn(datos.comision_base_mxn) },
        { etiqueta: "Cierres", valor: datos.cierres },
        {
          etiqueta: "Alquiler ESP32",
          valor: dineroMxn(datos.alquiler.total_mxn),
          nota: `${datos.alquiler.dispositivos_asignados} dispositivos asignados`,
        },
      ]}
    />
  ) : undefined;

  return (
    <VistaLista
      titulo="Ingresos"
      descripcion="Comisión simulada sobre servicios cerrados. No hay cobro ni pasarela."
      kpis={kpis}
    >
      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar servicio, título o monto"
        onActualizar={recargar}
      />
      {error ? <AvisoLista tono="error">{error}</AvisoLista> : null}
      <ListaScroll>
        {cargando ? (
          <EstadoLista>Cargando ingresos…</EstadoLista>
        ) : visibles.length === 0 ? (
          comisiones.length === 0 ? (
            <EstadoLista>Cuando se cierren servicios, las comisiones aparecerán aquí.</EstadoLista>
          ) : (
            <EstadoLista onRestablecer={restablecer}>
              {busqueda.trim()
                ? `Ninguna comisión coincide con «${busqueda.trim()}».`
                : "Ninguna comisión está en este filtro."}
            </EstadoLista>
          )
        ) : (
          <TablaLista columnas={COLUMNAS_INGRESO} orden={orden}>
            {visibles.map((c) => {
              const corto = idCorto(c.servicio_id);
              const solicitudId = c.solicitud_id;
              return (
                <FilaLista
                  key={c.servicio_id}
                  onAbrir={solicitudId ? () => navigate(`/admin/trabajos/${solicitudId}`) : undefined}
                >
                  <td>
                    <CeldaPrincipal titulo={c.titulo ?? corto} meta={c.titulo ? corto : undefined} />
                  </td>
                  <td className="vl-derecha">{dineroMxn(c.costo_mxn)}</td>
                  <td className="vl-derecha">{formatoPorcentaje(c.porcentaje)}</td>
                  <td className="vl-derecha">{dineroMxn(c.comision_mxn)}</td>
                </FilaLista>
              );
            })}
          </TablaLista>
        )}
      </ListaScroll>
      {!cargando && comisiones.length > 0 ? <PieLista>{visibles.length} en esta vista</PieLista> : null}
    </VistaLista>
  );
}

type ColDispositivo = "dispositivo" | "estatus" | "conexion" | "asignado" | "acciones";
type FiltroEstatusDisp = "todos" | Dispositivo["estatus"];
type FiltroConexion = "todos" | "online" | "offline";
type TipoAsignacion = "cliente" | "proveedor";
type AvisoVista = { tono: "info" | "ok" | "error"; texto: string };

const COLUMNAS_DISPOSITIVO: ColumnaLista<ColDispositivo>[] = [
  { id: "dispositivo", etiqueta: "Dispositivo", ancho: "27%" },
  { id: "estatus", etiqueta: "Estatus", ancho: "17%" },
  { id: "conexion", etiqueta: "Conexión", ancho: "13%" },
  { id: "asignado", etiqueta: "Asignado a", ancho: "18%" },
  { id: "acciones", etiqueta: "Acciones", ordenable: false, ancho: "25%" },
];

const OPCIONES_ESTATUS: { valor: FiltroEstatusDisp; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "pool", etiqueta: "En pool" },
  { valor: "asignado_cliente", etiqueta: "Con cliente" },
  { valor: "asignado_proveedor", etiqueta: "Con proveedor" },
];

const OPCIONES_CONEXION: { valor: FiltroConexion; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todas" },
  { valor: "online", etiqueta: "En línea" },
  { valor: "offline", etiqueta: "Fuera de línea" },
];

export function DispositivosAdmin() {
  const [items, setItems] = useState<Dispositivo[]>([]);
  const [cuentas, setCuentas] = useState<UsuarioLista[]>([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState<AvisoVista | null>(null);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstatus, setFiltroEstatus] = useState<FiltroEstatusDisp>("todos");
  const [filtroConexion, setFiltroConexion] = useState<FiltroConexion>("todos");
  const orden = useOrden<ColDispositivo>("dispositivo", "asc", []);

  const [altaAbierta, setAltaAbierta] = useState(false);
  const [identificador, setIdentificador] = useState("");
  const [nombreAlta, setNombreAlta] = useState("");
  const [claveNueva, setClaveNueva] = useState<string | null>(null);
  const [enviandoAlta, setEnviandoAlta] = useState(false);
  const [errorAlta, setErrorAlta] = useState("");

  const [asignando, setAsignando] = useState<Dispositivo | null>(null);
  const [tipoAsignacion, setTipoAsignacion] = useState<TipoAsignacion>("proveedor");
  const [perfilId, setPerfilId] = useState("");
  const [enviandoAsignar, setEnviandoAsignar] = useState(false);
  const [errorAsignar, setErrorAsignar] = useState("");

  const acciones = useMemo(
    () => (
      <Button type="button" size="sm" onClick={() => setAltaAbierta(true)}>
        <PlusIcon data-icon="inline-start" />
        Alta en pool
      </Button>
    ),
    [],
  );

  async function recargar() {
    try {
      const [dispositivos, usuarios] = await Promise.all([
        listarDispositivosAdmin(),
        listarUsuariosAdmin().catch(() => [] as UsuarioLista[]),
      ]);
      setItems(dispositivos);
      setCuentas(usuarios);
      setError("");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudieron cargar los dispositivos");
    }
  }

  useEffect(() => {
    void recargar().finally(() => setCargando(false));
  }, []);

  const perfilesOpcion = useMemo(
    () => perfilesParaAsignar(cuentas, tipoAsignacion),
    [cuentas, tipoAsignacion],
  );

  const nombresCliente = useMemo(
    () => new Map(perfilesParaAsignar(cuentas, "cliente").map((o) => [o.valor, o.etiqueta])),
    [cuentas],
  );

  const asignadoA = useCallback(
    (d: Dispositivo): string | null =>
      (d.perfil_cliente_id && nombresCliente.get(d.perfil_cliente_id)) || d.perfil_nombre,
    [nombresCliente],
  );

  const visibles = useMemo(
    () =>
      ordenarPor(
        items.filter((d) => {
          if (filtroEstatus !== "todos" && d.estatus !== filtroEstatus) return false;
          if (filtroConexion === "online" && !d.online) return false;
          if (filtroConexion === "offline" && d.online) return false;
          return coincideBusqueda(busqueda, d.nombre, d.identificador, asignadoA(d), etiquetaEstatus(d.estatus));
        }),
        orden,
        {
          dispositivo: (d) => d.nombre,
          estatus: (d) => etiquetaEstatus(d.estatus),
          conexion: (d) => (d.online ? 1 : 0),
          asignado: (d) => asignadoA(d),
          acciones: () => "",
        },
      ),
    [items, filtroEstatus, filtroConexion, busqueda, orden, asignadoA],
  );

  function restablecer() {
    setBusqueda("");
    setFiltroEstatus("todos");
    setFiltroConexion("todos");
  }

  function cerrarAlta(abierto: boolean) {
    if (abierto) return;
    setAltaAbierta(false);
    setIdentificador("");
    setNombreAlta("");
    setClaveNueva(null);
    setErrorAlta("");
    setEnviandoAlta(false);
  }

  async function onAlta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoAlta) return;
    setEnviandoAlta(true);
    setErrorAlta("");
    try {
      const creado = await altaDispositivoAdmin({
        identificador: identificador.trim(),
        nombre: nombreAlta.trim(),
      });
      await recargar();
      if (creado.clave_api) {
        setClaveNueva(creado.clave_api);
      } else {
        cerrarAlta(false);
      }
    } catch (causa) {
      setErrorAlta(causa instanceof Error ? causa.message : "No se pudo dar de alta el dispositivo");
    } finally {
      setEnviandoAlta(false);
    }
  }

  function abrirAsignar(dispositivo: Dispositivo) {
    setAsignando(dispositivo);
    setTipoAsignacion("proveedor");
    setPerfilId("");
    setErrorAsignar("");
    setEnviandoAsignar(false);
  }

  function cerrarAsignar(abierto: boolean) {
    if (abierto) return;
    setAsignando(null);
    setPerfilId("");
    setErrorAsignar("");
    setEnviandoAsignar(false);
  }

  async function onAsignar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!asignando || enviandoAsignar) return;
    const id = perfilId.trim();
    if (!id) {
      setErrorAsignar("Elige un perfil");
      return;
    }
    setEnviandoAsignar(true);
    setErrorAsignar("");
    try {
      await asignarDispositivoAdmin(
        asignando.id,
        tipoAsignacion === "cliente" ? { perfil_cliente_id: id } : { perfil_proveedor_id: id },
      );
      cerrarAsignar(false);
      setAviso(null);
      await recargar();
    } catch (causa) {
      setErrorAsignar(causa instanceof Error ? causa.message : "No se pudo asignar el dispositivo");
    } finally {
      setEnviandoAsignar(false);
    }
  }

  async function onDesasignar(dispositivo: Dispositivo) {
    setAviso(null);
    try {
      await desasignarDispositivoAdmin(dispositivo.id);
      await recargar();
    } catch (causa) {
      setAviso({
        tono: "error",
        texto: causa instanceof Error ? causa.message : "No se pudo desasignar el dispositivo",
      });
    }
  }

  async function onEstatus(dispositivo: Dispositivo) {
    setAviso(null);
    try {
      const estado = await estatusDispositivoAdmin(dispositivo.id);
      setAviso({
        tono: "info",
        texto: `${dispositivo.nombre}: ${estado.online ? "en línea" : "fuera de línea"} · ${fechaCorta(estado.consultado_en)}`,
      });
    } catch (causa) {
      setAviso({
        tono: "error",
        texto: causa instanceof Error ? causa.message : "No se pudo consultar el estatus",
      });
    }
  }

  const avisoVisible = error
    ? { tono: "error" as const, texto: error }
    : aviso;

  return (
    <VistaLista
      titulo="Dispositivos"
      descripcion="Pool de ESP32 autorizados para captura en campo."
      acciones={acciones}
    >
      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar nombre, identificador o perfil"
        onActualizar={recargar}
      >
        <FiltroLista
          id="filtro-estatus-dispositivos"
          etiqueta="Estatus"
          valor={filtroEstatus}
          opciones={OPCIONES_ESTATUS}
          onCambio={setFiltroEstatus}
        />
        <FiltroLista
          id="filtro-conexion-dispositivos"
          etiqueta="Conexión"
          valor={filtroConexion}
          opciones={OPCIONES_CONEXION}
          onCambio={setFiltroConexion}
          ancho="9rem"
        />
      </BarraLista>
      {avisoVisible ? <AvisoLista tono={avisoVisible.tono}>{avisoVisible.texto}</AvisoLista> : null}
      <ListaScroll>
        {cargando ? (
          <EstadoLista>Cargando dispositivos…</EstadoLista>
        ) : visibles.length === 0 ? (
          items.length === 0 ? (
            <EstadoLista>Da de alta un ESP32 en el pool para asignarlo a un perfil.</EstadoLista>
          ) : (
            <EstadoLista onRestablecer={restablecer}>
              {busqueda.trim()
                ? `Ningún dispositivo coincide con «${busqueda.trim()}».`
                : "Ningún dispositivo está en este filtro."}
            </EstadoLista>
          )
        ) : (
          <TablaLista columnas={COLUMNAS_DISPOSITIVO} orden={orden}>
            {visibles.map((d) => (
              <FilaLista key={d.id}>
                <td>
                  <CeldaPrincipal titulo={d.nombre} meta={d.identificador} />
                </td>
                <td>
                  <Pastilla tono={tonoEstatus(d.estatus)}>{etiquetaEstatus(d.estatus)}</Pastilla>
                </td>
                <td>
                  <Pastilla tono={d.online ? "positiva" : "neutra"}>
                    {d.online ? "En línea" : "Fuera de línea"}
                  </Pastilla>
                </td>
                <td>{asignadoA(d) ?? <Ausente />}</td>
                <td>
                  <AccionesFila>
                    <BotonTexto onClick={() => abrirAsignar(d)}>
                      {d.estatus === "pool" ? "Asignar" : "Reasignar"}
                    </BotonTexto>
                    {d.estatus !== "pool" ? (
                      <BotonTexto onClick={() => void onDesasignar(d)}>Desasignar</BotonTexto>
                    ) : null}
                    <BotonTexto onClick={() => void onEstatus(d)}>Estatus</BotonTexto>
                  </AccionesFila>
                </td>
              </FilaLista>
            ))}
          </TablaLista>
        )}
      </ListaScroll>
      {!cargando && items.length > 0 ? <PieLista>{visibles.length} en esta vista</PieLista> : null}

      <Dialog open={altaAbierta} onOpenChange={cerrarAlta}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{claveNueva ? "Dispositivo dado de alta" : "Alta en pool"}</DialogTitle>
            <DialogDescription>
              {claveNueva
                ? "Guarda la clave del aparato; no se vuelve a mostrar."
                : "Identificador y nombre del ESP32 que entra al pool."}
            </DialogDescription>
          </DialogHeader>
          {claveNueva ? (
            <>
              <Alert>
                <AlertTitle>Clave del aparato</AlertTitle>
                <AlertDescription>
                  Cópiala ahora. Si la pierdes, hay que dar de alta otro dispositivo.
                  <code className="mt-2 block break-all font-mono text-foreground">{claveNueva}</code>
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button type="button" onClick={() => cerrarAlta(false)}>
                  Listo
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={(e) => void onAlta(e)}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="disp-alta-id">Identificador</FieldLabel>
                  <Input
                    id="disp-alta-id"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="disp-alta-nombre">Nombre</FieldLabel>
                  <Input
                    id="disp-alta-nombre"
                    value={nombreAlta}
                    onChange={(e) => setNombreAlta(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </Field>
              </FieldGroup>
              {errorAlta ? (
                <Alert variant="destructive" className="mt-3">
                  <AlertTitle>No se pudo crear</AlertTitle>
                  <AlertDescription>{errorAlta}</AlertDescription>
                </Alert>
              ) : null}
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => cerrarAlta(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={enviandoAlta}>
                  {enviandoAlta ? "Creando…" : "Dar de alta"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={asignando !== null} onOpenChange={cerrarAsignar}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Asignar dispositivo</DialogTitle>
            <DialogDescription>
              {asignando ? `Elige el perfil para «${asignando.nombre}».` : "Elige el perfil destino."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void onAsignar(e)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="disp-asig-tipo">Tipo</FieldLabel>
                <Select
                  value={tipoAsignacion}
                  onValueChange={(v) => {
                    setTipoAsignacion(v as TipoAsignacion);
                    setPerfilId("");
                  }}
                >
                  <SelectTrigger id="disp-asig-tipo" className="w-full">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="proveedor">Proveedor</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {perfilesOpcion.length > 0 ? (
                <Field>
                  <FieldLabel htmlFor="disp-asig-perfil">Perfil</FieldLabel>
                  <Select value={perfilId || undefined} onValueChange={setPerfilId}>
                    <SelectTrigger id="disp-asig-perfil" className="w-full">
                      <SelectValue placeholder="Elegir perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {perfilesOpcion.map((p) => (
                        <SelectItem key={p.valor} value={p.valor}>
                          {p.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="disp-asig-perfil-id">
                    {tipoAsignacion === "cliente" ? "perfil_cliente_id" : "perfil_proveedor_id"}
                  </FieldLabel>
                  <Input
                    id="disp-asig-perfil-id"
                    value={perfilId}
                    onChange={(e) => setPerfilId(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </Field>
              )}
            </FieldGroup>
            {errorAsignar ? (
              <Alert variant="destructive" className="mt-3">
                <AlertTitle>No se pudo asignar</AlertTitle>
                <AlertDescription>{errorAsignar}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => cerrarAsignar(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={enviandoAsignar}>
                {enviandoAsignar ? "Asignando…" : "Asignar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </VistaLista>
  );
}

type EventoAuditoria = Awaited<ReturnType<typeof listarAuditoriaAdmin>>["eventos"][number];
type ColAuditoria = "accion" | "entidad" | "detalle" | "fecha";

const COLUMNAS_AUDITORIA: ColumnaLista<ColAuditoria>[] = [
  { id: "accion", etiqueta: "Acción", ancho: "22%" },
  { id: "entidad", etiqueta: "Entidad", ancho: "22%" },
  { id: "detalle", etiqueta: "Detalle", ancho: "36%" },
  { id: "fecha", etiqueta: "Fecha", ancho: "20%", alinear: "derecha" },
];

export function AuditoriaAdmin() {
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [accionesVistas, setAccionesVistas] = useState<string[]>([]);
  const [filtroAccion, setFiltroAccion] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const orden = useOrden<ColAuditoria>("fecha", "desc", ["fecha"]);

  async function recargar() {
    try {
      const datos = await listarAuditoriaAdmin(filtroAccion === "todas" ? undefined : filtroAccion);
      setEventos(datos.eventos);
      setAccionesVistas((prev) => fusionarAcciones(prev, datos.eventos.map((e) => e.accion)));
      setError("");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudieron cargar los eventos");
    }
  }

  useEffect(() => {
    void recargar().finally(() => setCargando(false));
  }, [filtroAccion]);

  const opcionesAccion = useMemo(
    () => [
      { valor: "todas", etiqueta: "Todas" },
      ...accionesVistas.map((a) => ({ valor: a, etiqueta: etiquetaAccion(a) })),
    ],
    [accionesVistas],
  );

  const visibles = useMemo(
    () =>
      ordenarPor(
        eventos.filter((ev) =>
          coincideBusqueda(busqueda, ev.accion, etiquetaAccion(ev.accion), ev.entidad, etiquetaEntidad(ev.entidad), ev.detalle, ev.entidad_id),
        ),
        orden,
        {
          accion: (ev) => etiquetaAccion(ev.accion),
          entidad: (ev) => `${etiquetaEntidad(ev.entidad)} ${ev.entidad_id ?? ""}`,
          detalle: (ev) => ev.detalle,
          fecha: (ev) => marcaTiempo(ev.creado_en),
        },
      ),
    [eventos, busqueda, orden],
  );

  function restablecer() {
    setBusqueda("");
    setFiltroAccion("todas");
  }

  return (
    <VistaLista titulo="Auditoría" descripcion="Registro de altas, marcas, dispositivos y consultas de historial.">
      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar acción, entidad o detalle"
        onActualizar={recargar}
      >
        <FiltroLista
          id="filtro-accion-auditoria"
          etiqueta="Acción"
          valor={filtroAccion}
          opciones={opcionesAccion}
          onCambio={setFiltroAccion}
        />
      </BarraLista>
      {error ? <AvisoLista tono="error">{error}</AvisoLista> : null}
      <ListaScroll>
        {cargando ? (
          <EstadoLista>Cargando auditoría…</EstadoLista>
        ) : visibles.length === 0 ? (
          eventos.length === 0 && !busqueda.trim() && filtroAccion === "todas" ? (
            <EstadoLista>Cuando se registren acciones, aparecerán aquí.</EstadoLista>
          ) : (
            <EstadoLista onRestablecer={restablecer}>
              {busqueda.trim()
                ? `Ningún evento coincide con «${busqueda.trim()}».`
                : "Ningún evento está en este filtro."}
            </EstadoLista>
          )
        ) : (
          <TablaLista columnas={COLUMNAS_AUDITORIA} orden={orden}>
            {visibles.map((ev) => (
              <FilaLista key={ev.id}>
                <td>
                  <Pastilla tono={tonoAccion(ev.accion)}>{etiquetaAccion(ev.accion)}</Pastilla>
                </td>
                <td>
                  <CeldaDoble
                    arriba={etiquetaEntidad(ev.entidad)}
                    abajo={ev.entidad_id ? idCorto(ev.entidad_id) : undefined}
                  />
                </td>
                <td>{ev.detalle ? ev.detalle : <Ausente />}</td>
                <td className="vl-derecha"><CeldaFecha iso={ev.creado_en} /></td>
              </FilaLista>
            ))}
          </TablaLista>
        )}
      </ListaScroll>
      {!cargando && eventos.length > 0 ? <PieLista>{visibles.length} en esta vista</PieLista> : null}
    </VistaLista>
  );
}

export function ConversionesAdmin() {
  const [items, setItems] = useState<Conversion[]>([]);
  const [pendiente, setPendiente] = useState<Conversion | null>(null);
  const [extrasTexto, setExtrasTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function recargar() {
    setItems(await listarConversionesAdmin(true));
  }

  useEffect(() => {
    void recargar().catch((causa) => {
      setError(causa instanceof Error ? causa.message : "No se pudieron cargar las conversiones");
    });
  }, []);

  async function autorizar(conversion: Conversion, extras: string[]) {
    setError("");
    setEnviando(true);
    try {
      await autorizarConversionAdmin(conversion.perfil_proveedor_id, extras);
      setPendiente(null);
      await recargar();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo autorizar la conversión");
    } finally {
      setEnviando(false);
    }
  }

  async function onAutorizarClick(conversion: Conversion) {
    if (conversion.extras.length === 0) {
      await autorizar(conversion, []);
      return;
    }
    setExtrasTexto(conversion.extras.join(","));
    setPendiente(conversion);
  }

  async function onConfirmarExtras(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!pendiente) return;
    const extras = extrasTexto
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    await autorizar(pendiente, extras);
  }

  if (items.length === 0 && !error) return null;

  return (
    <div className="flex flex-col gap-2 px-6 py-3">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Conversiones</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {items.map((c) => (
        <Alert key={c.perfil_proveedor_id}>
          <FileBarChartIcon />
          <AlertTitle>
            Conversión {c.desde} → {c.hacia}
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{c.detalle}</span>
            <span className="flex gap-1">
              <Button type="button" size="sm" onClick={() => void onAutorizarClick(c)} disabled={enviando}>
                Autorizar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={enviando}
                onClick={() =>
                  rechazarConversionAdmin(c.perfil_proveedor_id)
                    .then(recargar)
                    .catch((causa) => {
                      setError(causa instanceof Error ? causa.message : "No se pudo rechazar la conversión");
                    })
                }
              >
                Rechazar
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ))}

      <Dialog open={pendiente !== null} onOpenChange={(abierto) => { if (!abierto) setPendiente(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>IDs extra a eliminar</DialogTitle>
            <DialogDescription>
              Sepáralos por coma. Quedarán fuera del perfil al autorizar la conversión.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void onConfirmarExtras(e)}>
            <Field>
              <FieldLabel htmlFor="conv-extras">Identificadores</FieldLabel>
              <Input
                id="conv-extras"
                value={extrasTexto}
                onChange={(e) => setExtrasTexto(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setPendiente(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={enviando}>
                {enviando ? "Autorizando…" : "Autorizar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function idCorto(id: string): string {
  return `#${id.slice(0, 8)}`;
}

function formatoPorcentaje(valor: number): string {
  return `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(valor)} %`;
}

function etiquetaEstatus(estatus: Dispositivo["estatus"]): string {
  if (estatus === "pool") return "En pool";
  if (estatus === "asignado_cliente") return "Con cliente";
  return "Con proveedor";
}

function tonoEstatus(estatus: Dispositivo["estatus"]): TonoPastilla {
  if (estatus === "pool") return "neutra";
  return "acento";
}

const ACCIONES_AUDITORIA: Record<string, string> = {
  alta_cuenta: "Alta de cuenta",
  edicion_cuenta: "Edición de cuenta",
  baja_procesada: "Baja procesada",
  marca: "Marca",
  desbloqueo: "Desbloqueo",
  consulta_historial: "Consulta de historial",
  operacion_dispositivo: "Operación de dispositivo",
  conversion_solicitada: "Conversión solicitada",
  conversion_autorizada: "Conversión autorizada",
  conversion_rechazada: "Conversión rechazada",
  edicion_tarifas: "Edición de tarifas",
};

const ENTIDADES_AUDITORIA: Record<string, string> = {
  usuario: "Usuario",
  sancion: "Sanción",
  solicitud: "Solicitud",
  dispositivo_esp32: "Dispositivo ESP32",
  perfil_cliente: "Perfil de cliente",
  perfil_proveedor: "Perfil de proveedor",
  tarifa_tramo: "Tramo de tarifa",
  tarifa_alquiler: "Tarifa de alquiler",
};

function legible(clave: string, mapa: Record<string, string>): string {
  if (mapa[clave]) return mapa[clave];
  const texto = clave.replaceAll("_", " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function etiquetaAccion(accion: string): string {
  return legible(accion, ACCIONES_AUDITORIA);
}

function etiquetaEntidad(entidad: string): string {
  return legible(entidad, ENTIDADES_AUDITORIA);
}

function tonoAccion(accion: string): TonoPastilla {
  if (accion.includes("baja") || accion.includes("rechaz")) return "negativa";
  if (accion.includes("marca") || accion.includes("desbloqueo")) return "alerta";
  if (accion.includes("alta") || accion.includes("autoriz")) return "positiva";
  return "neutra";
}

function fusionarAcciones(previas: string[], nuevas: string[]): string[] {
  const set = new Set(previas);
  for (const a of nuevas) {
    if (a) set.add(a);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

function perfilesParaAsignar(
  cuentas: UsuarioLista[],
  tipo: TipoAsignacion,
): { valor: string; etiqueta: string }[] {
  const map = new Map<string, string>();
  for (const cuenta of cuentas) {
    if (tipo === "cliente") {
      if (cuenta.tipo_cuenta === "cliente" && cuenta.perfil_cliente_id) {
        const nombre = cuenta.perfil_nombre === "Persona" ? cuenta.nombre : cuenta.perfil_nombre;
        map.set(cuenta.perfil_cliente_id, nombre || cuenta.nombre);
      }
    } else if (esProveedor(cuenta.tipo_cuenta) && cuenta.perfil_proveedor_id) {
      map.set(cuenta.perfil_proveedor_id, cuenta.perfil_nombre || cuenta.nombre);
    }
  }
  return [...map.entries()]
    .map(([valor, etiqueta]) => ({ valor, etiqueta }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}
