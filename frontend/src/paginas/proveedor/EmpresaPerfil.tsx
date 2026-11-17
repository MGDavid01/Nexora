import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { MapPinIcon, UserPlusIcon } from "lucide-react";
import {
  altaUsuarioEmpresa,
  bajaUsuarioEmpresa,
  listarReportesPerfil,
  listarUsuariosEmpresa,
  pedirConversion,
  type EmpresaUsuario,
  type Usuario,
} from "../../api";
import { useSesion } from "../../sesion";
import { digitos, texto } from "../../validarAlta";
import {
  AvisoLista,
  BarraLista,
  BotonTexto,
  CeldaPrincipal,
  CuerpoLista,
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
import { VistaReportes } from "../../vista-lista/VistaReportes";
import { coincideBusqueda, ordenarPor, useOrden } from "../../vista-lista/orden";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import "./proveedor-listas.css";

type ColEquipo = "usuario" | "funcion" | "accion";
type FiltroFuncion = "todas" | "administrativo" | "tecnico";

const COLUMNAS_EQUIPO: ColumnaLista<ColEquipo>[] = [
  { id: "usuario", etiqueta: "Usuario", ancho: "52%" },
  { id: "funcion", etiqueta: "Función", ancho: "22%" },
  { id: "accion", etiqueta: "Acción", ancho: "26%", ordenable: false },
];

const FILTROS_FUNCION: { valor: FiltroFuncion; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "administrativo", etiqueta: "Administrativo" },
  { valor: "tecnico", etiqueta: "Técnico" },
];

export function EquipoProveedor() {
  const { usuario } = useSesion();
  const [usuarios, setUsuarios] = useState<EmpresaUsuario[]>([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [funcion, setFuncion] = useState<FiltroFuncion>("todas");
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [bajaDe, setBajaDe] = useState<EmpresaUsuario | null>(null);
  const orden = useOrden<ColEquipo>("usuario", "asc");

  const recargar = useCallback(async () => {
    try {
      setUsuarios(await listarUsuariosEmpresa());
      setError("");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo cargar el equipo");
    }
  }, []);

  useEffect(() => {
    if (usuario?.tipo_cuenta !== "empresa") {
      setCargando(false);
      return;
    }
    setCargando(true);
    void recargar().finally(() => setCargando(false));
  }, [usuario?.tipo_cuenta, recargar]);

  const acciones = useMemo(
    () => (
      <Button type="button" size="sm" onClick={() => setAltaAbierta(true)}>
        <UserPlusIcon data-icon="inline-start" />
        Agregar usuario
      </Button>
    ),
    [],
  );

  const visibles = useMemo(
    () =>
      ordenarPor(
        usuarios.filter(
          (u) =>
            (funcion === "todas" || u.funcion === funcion) &&
            coincideBusqueda(busqueda, u.nombre, u.correo, u.funcion, etiquetaFuncion(u.funcion)),
        ),
        orden,
        {
          usuario: (u) => u.nombre,
          funcion: (u) => u.funcion,
          accion: () => "",
        },
      ),
    [usuarios, funcion, busqueda, orden],
  );

  const tecnicos = useMemo(
    () => usuarios.filter((u) => u.funcion === "tecnico" && !u.baja_procesada),
    [usuarios],
  );

  function restablecer() {
    setBusqueda("");
    setFuncion("todas");
  }

  if (usuario?.tipo_cuenta !== "empresa") {
    return (
      <VistaLista
        titulo="Equipo"
        descripcion="Usuarios administrativos y técnicos del perfil."
        antes={usuario ? <ConversionTipo usuario={usuario} /> : null}
      >
        <CuerpoLista>
          <AvisoLista>Solo las cuentas de empresa pueden administrar usuarios extras.</AvisoLista>
        </CuerpoLista>
      </VistaLista>
    );
  }

  return (
    <VistaLista
      titulo="Equipo del perfil"
      descripcion="Usuarios administrativos y técnicos del perfil."
      acciones={acciones}
      antes={<ConversionTipo usuario={usuario} />}
    >
      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar nombre, correo o función"
        onActualizar={recargar}
      >
        <FiltroLista
          id="filtro-funcion-equipo"
          etiqueta="Función"
          valor={funcion}
          opciones={FILTROS_FUNCION}
          onCambio={setFuncion}
        />
      </BarraLista>
      {error ? <AvisoLista tono="error">{error}</AvisoLista> : null}
      {!error && aviso ? <AvisoLista tono="ok">{aviso}</AvisoLista> : null}
      <ListaScroll>
        {cargando ? (
          <EstadoLista>Cargando…</EstadoLista>
        ) : visibles.length === 0 ? (
          usuarios.length === 0 ? (
            <EstadoLista>Aún no hay usuarios en el equipo.</EstadoLista>
          ) : (
            <EstadoLista onRestablecer={restablecer}>
              {busqueda.trim()
                ? `Ningún usuario coincide con «${busqueda.trim()}».`
                : "Ningún usuario está en este filtro."}
            </EstadoLista>
          )
        ) : (
          <TablaLista columnas={COLUMNAS_EQUIPO} orden={orden}>
            {visibles.map((u) => (
              <FilaLista key={u.id}>
                <td>
                  <CeldaPrincipal
                    titulo={u.nombre}
                    meta={u.correo || undefined}
                    avatar={{ nombre: u.nombre, semilla: u.id }}
                    pastillas={
                      <>
                        {u.primera ? <Pastilla tono="acento">Primera cuenta</Pastilla> : null}
                        {u.baja_procesada ? <Pastilla tono="alerta">Baja procesada</Pastilla> : null}
                      </>
                    }
                  />
                </td>
                <td>
                  <Pastilla tono={tonoFuncion(u.funcion)}>{etiquetaFuncion(u.funcion)}</Pastilla>
                </td>
                <td>
                  {!u.primera && !u.baja_procesada && u.id !== usuario.id ? (
                    <BotonTexto peligro onClick={() => setBajaDe(u)}>
                      Dar de baja
                    </BotonTexto>
                  ) : null}
                </td>
              </FilaLista>
            ))}
          </TablaLista>
        )}
      </ListaScroll>
      {!cargando && usuarios.length > 0 ? <PieLista>{visibles.length} en esta vista</PieLista> : null}
      {altaAbierta ? (
        <DialogAltaEquipo
          onCerrar={() => setAltaAbierta(false)}
          onCreado={async () => {
            setAltaAbierta(false);
            setAviso("Usuario creado.");
            setError("");
            await recargar();
          }}
        />
      ) : null}
      {bajaDe ? (
        <DialogBajaEquipo
          usuario={bajaDe}
          tecnicos={tecnicos.filter((t) => t.id !== bajaDe.id)}
          onCerrar={() => setBajaDe(null)}
          onConfirmada={async () => {
            setBajaDe(null);
            setAviso("Baja procesada.");
            setError("");
            await recargar();
          }}
        />
      ) : null}
    </VistaLista>
  );
}

function ConversionTipo({ usuario }: { usuario: Usuario }) {
  const [mensaje, setMensaje] = useState("");
  const [fallo, setFallo] = useState(false);
  const hacia = usuario.tipo_cuenta === "empresa" ? "negocio" : "empresa";
  if (usuario.tipo_cuenta !== "empresa" && usuario.tipo_cuenta !== "negocio") return null;
  return (
    <div className="pv-conversion">
      <p>
        Pide convertir el perfil a <strong>{hacia}</strong>. El administrador de plataforma autoriza o rechaza.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await pedirConversion(hacia);
            setFallo(false);
            setMensaje("Pedido registrado.");
          } catch (causa) {
            setFallo(true);
            setMensaje(causa instanceof Error ? causa.message : "No se pudo pedir");
          }
        }}
      >
        Pedir conversión a {hacia}
      </Button>
      {mensaje ? (
        <p className={fallo ? "pv-conversion-msg pv-conversion-error" : "pv-conversion-msg"}>{mensaje}</p>
      ) : null}
    </div>
  );
}

function DialogAltaEquipo({
  onCerrar,
  onCreado,
}: {
  onCerrar: () => void;
  onCreado: () => Promise<void>;
}) {
  const [funcion, setFuncion] = useState<"administrativo" | "tecnico">("administrativo");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    const nombre = texto(fd.get("nombre"));
    const correo = texto(fd.get("correo")).toLowerCase();
    const contrasena = String(fd.get("contrasena") ?? "");
    const telefono = digitos(fd.get("telefono"));
    if (!nombre) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!correo.includes("@")) {
      setError("El correo no es válido");
      return;
    }
    if (telefono.length !== 10) {
      setError("El teléfono debe tener 10 dígitos");
      return;
    }
    if (contrasena.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setError("");
    setEnviando(true);
    try {
      await altaUsuarioEmpresa({
        nombre,
        correo,
        contrasena,
        telefono,
        funcion,
      });
      await onCreado();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo crear");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(siguiente) => {
        if (!siguiente && !enviando) onCerrar();
      }}
    >
      <DialogContent className="flex max-h-[min(720px,calc(100svh-2rem))] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="gap-1 border-b px-6 py-5">
          <DialogTitle>Agregar usuario</DialogTitle>
          <DialogDescription>Crea una cuenta administrativa o técnica de este perfil.</DialogDescription>
        </DialogHeader>
        <form className="flex min-h-0 flex-1 flex-col" autoComplete="off" onSubmit={(e) => void onSubmit(e)}>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="equipo-nombre">Nombre</FieldLabel>
                <Input id="equipo-nombre" name="nombre" required autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel htmlFor="equipo-correo">Correo</FieldLabel>
                <Input id="equipo-correo" name="correo" type="email" required autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel htmlFor="equipo-telefono">Teléfono</FieldLabel>
                <Input id="equipo-telefono" name="telefono" inputMode="numeric" required autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel htmlFor="equipo-contrasena">Contraseña</FieldLabel>
                <Input
                  id="equipo-contrasena"
                  name="contrasena"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
                <FieldDescription>Mínimo 8 caracteres.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="equipo-funcion">Función</FieldLabel>
                <Select value={funcion} onValueChange={(v) => setFuncion(v as "administrativo" | "tecnico")}>
                  <SelectTrigger id="equipo-funcion" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="administrativo">Administrativo</SelectItem>
                      <SelectItem value="tecnico">Técnico</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            {error ? (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Creando…" : "Crear cuenta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogBajaEquipo({
  usuario,
  tecnicos,
  onCerrar,
  onConfirmada,
}: {
  usuario: EmpresaUsuario;
  tecnicos: EmpresaUsuario[];
  onCerrar: () => void;
  onConfirmada: () => Promise<void>;
}) {
  const [reemplazo, setReemplazo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const hayTecnicos = tecnicos.length > 0;

  async function confirmar() {
    setError("");
    setEnviando(true);
    const id = hayTecnicos ? (reemplazo === "ninguno" || !reemplazo ? "" : reemplazo) : reemplazo.trim();
    try {
      await bajaUsuarioEmpresa(usuario.id, id || undefined);
      await onConfirmada();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo dar de baja");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(siguiente) => {
        if (!siguiente && !enviando) onCerrar();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dar de baja a {usuario.nombre}</DialogTitle>
          <DialogDescription>
            Si el usuario tiene servicios asignados, elige un técnico de reemplazo. Si no aplica, déjalo vacío.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          {hayTecnicos ? (
            <Field>
              <FieldLabel htmlFor="baja-reemplazo">Técnico de reemplazo</FieldLabel>
              <Select value={reemplazo || "ninguno"} onValueChange={setReemplazo}>
                <SelectTrigger id="baja-reemplazo" className="w-full">
                  <SelectValue placeholder="Sin reemplazo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="ninguno">Sin reemplazo</SelectItem>
                    {tecnicos.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="baja-reemplazo-id">ID del técnico de reemplazo</FieldLabel>
              <Input
                id="baja-reemplazo-id"
                value={reemplazo}
                onChange={(e) => setReemplazo(e.target.value)}
                placeholder="Opcional"
                autoComplete="off"
              />
              <FieldDescription>Si no hay técnicos en el equipo, puedes indicar el ID a mano.</FieldDescription>
            </Field>
          )}
        </FieldGroup>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={() => void confirmar()} disabled={enviando}>
            {enviando ? "Procesando…" : "Dar de baja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MapaProveedor() {
  const [enlace, setEnlace] = useState("");

  return (
    <VistaLista
      titulo="Mapa del perfil"
      descripcion="Abre la ubicación del perfil en OpenStreetMap (D8 expone geocódigo en admin)."
    >
      <CuerpoLista>
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const q = [
              texto(fd.get("calle_numero")),
              texto(fd.get("colonia")),
              texto(fd.get("ciudad")),
              texto(fd.get("estado")),
              digitos(fd.get("codigo_postal")),
            ].join(", ");
            setEnlace(`https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`);
          }}
        >
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="mapa-calle">Calle y número</FieldLabel>
                <Input id="mapa-calle" name="calle_numero" required autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel htmlFor="mapa-colonia">Colonia</FieldLabel>
                <Input id="mapa-colonia" name="colonia" required autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel htmlFor="mapa-ciudad">Ciudad</FieldLabel>
                <Input id="mapa-ciudad" name="ciudad" required autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel htmlFor="mapa-estado">Estado</FieldLabel>
                <Input id="mapa-estado" name="estado" required autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel htmlFor="mapa-cp">C.P.</FieldLabel>
                <Input id="mapa-cp" name="codigo_postal" required pattern="\d{5}" inputMode="numeric" maxLength={5} />
              </Field>
            </div>
            <Button type="submit" className="w-fit">
              <MapPinIcon data-icon="inline-start" />
              Buscar en mapa
            </Button>
          </FieldGroup>
        </form>
        {enlace ? (
          <AvisoLista tono="ok">
            <a href={enlace} target="_blank" rel="noreferrer">
              Ver en OpenStreetMap
            </a>
          </AvisoLista>
        ) : null}
      </CuerpoLista>
    </VistaLista>
  );
}

export function ReportesProveedor() {
  return (
    <VistaReportes
      cargar={listarReportesPerfil}
      descripcion="Mediciones del perfil empresa o negocio. Las genera el sistema."
      vacio="Aún no hay mediciones en este perfil."
      filtroId="filtro-metrica-reportes-proveedor"
    />
  );
}

export function CapturaCampo() {
  return (
    <VistaLista titulo="Captura en campo" descripcion="Voz en campo con el dispositivo autorizado.">
      <CuerpoLista>
        <AvisoLista>
          La captura por voz usa el ESP32 autorizado del perfil. Sin credenciales configuradas, la transcripción y
          la respuesta de voz son simuladas. La web funciona igual sin el aparato.
        </AvisoLista>
      </CuerpoLista>
    </VistaLista>
  );
}

function etiquetaFuncion(funcion: EmpresaUsuario["funcion"]): string {
  if (funcion === "tecnico") return "Técnico";
  if (funcion === "administrativo") return "Administrativo";
  if (funcion === "administrativo_campo") return "Administrativo de campo";
  return funcion ?? "—";
}

function tonoFuncion(funcion: EmpresaUsuario["funcion"]): TonoPastilla {
  if (funcion === "tecnico") return "acento";
  if (funcion === "administrativo") return "neutra";
  return "neutra";
}
