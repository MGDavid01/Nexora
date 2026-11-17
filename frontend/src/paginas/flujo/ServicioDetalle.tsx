import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDownIcon } from "lucide-react";
import {
  abrirReclamacionServicio,
  asignarTecnicoServicio,
  calificarServicio,
  cancelarServicio,
  CATEGORIAS_RECLAMACION,
  esProveedor,
  iniciarServicio,
  obtenerServicio,
  registrarInforme,
  terminarServicio,
  type ServicioDetalle as ServicioDetalleDatos,
  type Usuario,
} from "../../api";
import { useAdminTopbarAcciones, useAdminTopbarContexto } from "../../admin/AdminTopbar";
import { useSesion } from "../../sesion";
import {
  dineroMxn,
  esPendienteInforme,
  fechaCorta,
  fechaDia,
  horaCorta,
  tituloEstado,
  tituloTipoInforme,
} from "../../utilidades/formato";
import { tonoEstadoServicio } from "./servicio-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, Pastilla } from "../../vista-lista/VistaLista";
import "./servicio-detalle.css";

type Props = {
  servicioId: string;
  tecnicos?: { id: string; nombre: string }[];
  volverA: string;
};

const PASOS = [
  { id: "pendiente", etiqueta: "Pendiente" },
  { id: "en_curso", etiqueta: "En curso" },
  { id: "informe", etiqueta: "Informe" },
  { id: "cerrado", etiqueta: "Cerrado" },
] as const;

export function ServicioDetalle({ servicioId, tecnicos = [], volverA }: Props) {
  const { usuario } = useSesion();
  const [detalle, setDetalle] = useState<ServicioDetalleDatos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const recargar = useCallback(async () => {
    const siguiente = await obtenerServicio(servicioId);
    setDetalle(siguiente);
    return siguiente;
  }, [servicioId]);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError("");
    recargar()
      .catch((causa) => {
        if (!vivo) return;
        setDetalle(null);
        setError(causa instanceof Error ? causa.message : "No se encontró ese servicio");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [recargar]);

  const volver = useMemo(
    () => (
      <Link to={volverA} className="hub-volver">
        ← Volver
      </Link>
    ),
    [volverA],
  );
  useAdminTopbarContexto({ volver, titulo: detalle?.titulo ?? (cargando ? "Cargando…" : "Servicio") });
  const pastillaTopbar = useMemo(
    () =>
      detalle ? (
        <Pastilla tono={tonoEstadoServicio(detalle.estado)}>{tituloEstado(detalle.estado)}</Pastilla>
      ) : null,
    [detalle],
  );
  useAdminTopbarAcciones(pastillaTopbar);

  if (!usuario) return null;

  if (cargando && !detalle) {
    return (
      <article className="ficha-servicio hub-page">
        <div className="ficha-cuerpo">
          <Skeleton className="h-full w-full rounded-none" />
          <Skeleton className="h-full w-full rounded-none" />
        </div>
      </article>
    );
  }

  if (!detalle) {
    return (
      <article className="ficha-servicio hub-page">
        <div className="ficha-cuerpo">
          <Alert variant="destructive">
            <AlertDescription>{error || "No se encontró ese servicio."}</AlertDescription>
          </Alert>
        </div>
      </article>
    );
  }

  const rol = rolEnServicio(usuario);
  const estado = detalle.estado;
  const k = estado.toLowerCase();
  const cerrado = k === "cerrado" || k === "cancelado";
  const miLado = rol === "cliente" ? "cliente" : "proveedor";
  const yaCalifique = detalle.calificaciones.some((c) => c.lado === miLado);
  const leyenda = leyendaAvance(rol, k, detalle.tecnico);
  const asignar = puedeAsignar(rol, k, detalle.tecnico_usuario_id, usuario);
  const iniciar = puedeIniciar(rol, k, detalle.tecnico_usuario_id, usuario);
  const terminar = puedeTerminar(rol, k, detalle.tecnico_usuario_id, usuario);
  const informe = puedeInforme(k, usuario);
  const calificar = puedeCalificar(rol, k, yaCalifique);
  const reclamar = puedeReclamar(rol, k, detalle.reclamacion_abierta);
  const cancelar = puedeCancelar(rol, k);
  const hayHerramientas = asignar || iniciar || terminar || informe || (!cerrado && (calificar || reclamar || cancelar));

  async function conAccion(accion: () => Promise<unknown>, ok: string) {
    setError("");
    setMensaje("");
    setOcupado(true);
    try {
      await accion();
      await recargar();
      setMensaje(ok);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo completar");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <article className="ficha-servicio hub-page">
      <div className={`ficha-cuerpo${hayHerramientas ? "" : " ficha-cuerpo-sin-herramientas"}`}>
        <section className="ficha-caso" aria-labelledby="ficha-caso">
          {error || mensaje || detalle.reclamacion_abierta ? (
            <div className="ficha-avisos">
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {mensaje ? (
                <Alert>
                  <AlertDescription>{mensaje}</AlertDescription>
                </Alert>
              ) : null}
              {detalle.reclamacion_abierta ? (
                <Alert>
                  <AlertDescription>
                    Reclamación abierta: {detalle.reclamacion_abierta.categoria_etiqueta}. {detalle.reclamacion_abierta.motivo}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}
          {k !== "cancelado" ? (
            <ol className="ficha-etapas" aria-label="Etapas del servicio">
              {PASOS.map((paso) => {
                const marca = estadoPaso(k, paso.id);
                return (
                  <li key={paso.id} data-estado={marca} aria-current={marca === "actual" ? "step" : undefined}>
                    <span className="ficha-marca" />
                    <strong>{paso.etiqueta}</strong>
                  </li>
                );
              })}
            </ol>
          ) : null}
          {leyenda && !asignar && !iniciar && !terminar && !informe ? (
            <p className="ficha-etapas-leyenda">{leyenda}</p>
          ) : null}
          <div className="ficha-caso-intro">
            <h2 id="ficha-caso" className="ficha-kicker">
              Descripción
            </h2>
            <p className="ficha-problema">{detalle.descripcion}</p>
          </div>
          <div className="ficha-hechos">
            <div className="ficha-hecho">
              <span>Costo</span>
              <strong>{dineroMxn(detalle.costo_mxn)}</strong>
            </div>
            <div className="ficha-hecho">
              <span>Categoría</span>
              <strong>{detalle.categoria || "—"}</strong>
            </div>
            <div className="ficha-hecho">
              <span>Creado</span>
              <strong>{fechaDia(detalle.creado_en)}</strong>
              {horaCorta(detalle.creado_en) ? <em>{horaCorta(detalle.creado_en)}</em> : null}
            </div>
          </div>
          <div className="ficha-partes">
            <Parte etiqueta="Cliente" nombre={detalle.cliente} />
            <Parte etiqueta="Proveedor" nombre={detalle.proveedor} />
            <Parte etiqueta="Técnico" nombre={detalle.tecnico} vacio="Sin asignar" />
          </div>
          {detalle.informe ? (
            <div className="ficha-bloque">
              <h3>Informe de servicio</h3>
              <p className="ficha-bloque-meta">
                {tituloTipoInforme(detalle.informe.tipo)}
                {detalle.informe.detalle_pieza ? ` · Pieza: ${detalle.informe.detalle_pieza}` : ""}
                {detalle.informe.fecha ? ` · ${fechaCorta(detalle.informe.fecha)}` : ""}
              </p>
              <p>{detalle.informe.descripcion}</p>
            </div>
          ) : null}
          {detalle.calificaciones.length > 0 ? (
            <div className="ficha-bloque">
              <h3>Calificaciones</h3>
              <div className="ficha-califs">
                {detalle.calificaciones.map((c) => (
                  <div key={c.id} className="ficha-calif">
                    <span>
                      {c.lado === "cliente" ? "Cliente" : "Proveedor"}
                      {c.es_automatica ? " · automática" : ""}
                    </span>
                    <strong>
                      <span className="ficha-estrellas">{estrellas(Number(c.valor))}</span> {Number(c.valor).toFixed(1)}
                    </strong>
                    {c.comentario ? <p>{c.comentario}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {hayHerramientas ? (
        <aside className="ficha-avance" aria-label="Herramientas">
          {asignar ? (
            <Herramienta titulo="Asignar técnico">
              <FormAsignar
                ocupado={ocupado}
                usuario={usuario}
                tecnicos={tecnicos}
                onEnviar={(id) => conAccion(() => asignarTecnicoServicio(detalle.id, id), "Técnico asignado.")}
              />
            </Herramienta>
          ) : null}
          {iniciar ? (
            <Herramienta titulo="Iniciar servicio">
              <p>El técnico asignado puede empezar el trabajo en sitio.</p>
              <Button type="button" className="w-full" disabled={ocupado} onClick={() => void conAccion(() => iniciarServicio(detalle.id), "Servicio en curso.")}>
                Iniciar servicio
              </Button>
            </Herramienta>
          ) : null}
          {terminar ? (
            <Herramienta titulo="Terminar trabajo">
              <p>Cuando termines en sitio, cierra el trabajo para pasar al informe.</p>
              <Button type="button" className="w-full" disabled={ocupado} onClick={() => void conAccion(() => terminarServicio(detalle.id), "Trabajo terminado; falta el informe.")}>
                Terminar trabajo en sitio
              </Button>
            </Herramienta>
          ) : null}
          {informe ? (
            <Herramienta titulo="Registrar informe">
              <FormInforme ocupado={ocupado} onEnviar={(datos) => conAccion(() => registrarInforme(detalle.id, datos), "Informe registrado.")} />
            </Herramienta>
          ) : null}
          {calificar ? (
            <Herramienta titulo="Calificar">
              <FormCalificar ocupado={ocupado} onEnviar={(datos) => conAccion(() => calificarServicio(detalle.id, datos), "Calificación enviada.")} />
            </Herramienta>
          ) : null}
          {reclamar ? (
            <Herramienta titulo="Abrir reclamación">
              <FormReclamacion ocupado={ocupado} onEnviar={(datos) => conAccion(() => abrirReclamacionServicio(detalle.id, datos), "Reclamación abierta.")} />
            </Herramienta>
          ) : null}
          {cancelar ? (
            <Herramienta titulo="Cancelar servicio" defaultOpen={false}>
              <FormCancelar ocupado={ocupado} onConfirmar={() => conAccion(() => cancelarServicio(detalle.id), "Servicio cancelado.")} />
            </Herramienta>
          ) : null}
        </aside>
        ) : null}
      </div>
    </article>
  );
}

function Herramienta({ titulo, defaultOpen = true, children }: { titulo: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="ficha-herramienta">
      <CollapsibleTrigger className="ficha-herramienta-cab">
        <h3>{titulo}</h3>
        <ChevronDownIcon className="ficha-herramienta-chevron" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ficha-herramienta-cuerpo">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Parte({ etiqueta, nombre, vacio = "—" }: { etiqueta: string; nombre: string | null; vacio?: string }) {
  return (
    <div className="ficha-parte">
      {nombre ? <Avatar nombre={nombre} /> : <span className="ficha-parte-hueco">?</span>}
      <div className="ficha-parte-textos">
        <span className="ficha-parte-rol">{etiqueta}</span>
        <strong>{nombre || vacio}</strong>
      </div>
    </div>
  );
}

function leyendaAvance(rol: string, estado: string, tecnico: string | null): string {
  const cliente = rol === "cliente";
  if (estado === "cancelado") return "La cotización aceptada se conserva como antecedente.";
  if (estado === "cerrado") return "El informe quedó registrado. Las calificaciones ya no se cambian.";
  if (estado === "pendiente" && !tecnico) {
    return cliente ? "El proveedor asigna un técnico de su perfil." : "Asigna un técnico de este perfil para poder iniciar.";
  }
  if (estado === "pendiente") {
    return cliente ? "El técnico asignado puede iniciar el trabajo en sitio." : "Inicia el trabajo cuando estés en el sitio.";
  }
  if (estado === "en_curso") {
    return cliente ? "El técnico está en el sitio." : "Cuando termines en sitio, cierra el trabajo para pasar al informe.";
  }
  if (esPendienteInforme(estado)) {
    return cliente ? "Falta el informe de servicio para cerrar." : "Registra el informe. Al hacerlo, el servicio se cierra.";
  }
  return "";
}

function FormAsignar({
  ocupado,
  usuario,
  tecnicos,
  onEnviar,
}: {
  ocupado: boolean;
  usuario: Usuario;
  tecnicos: { id: string; nombre: string }[];
  onEnviar: (id: string) => void;
}) {
  const [tecnico, setTecnico] = useState(usuario.tipo_cuenta === "negocio" ? usuario.id : "");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!tecnico) return;
        onEnviar(tecnico);
      }}
    >
      <Field>
        <FieldLabel htmlFor="ficha-tecnico">Técnico del perfil</FieldLabel>
        <Select value={tecnico} onValueChange={setTecnico} disabled={ocupado}>
          <SelectTrigger id="ficha-tecnico" className="w-full">
            <SelectValue placeholder="Elegir…" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {usuario.tipo_cuenta === "negocio" ? (
                <SelectItem value={usuario.id}>{usuario.nombre} (campo)</SelectItem>
              ) : (
                tecnicos.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre}
                  </SelectItem>
                ))
              )}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Button type="submit" className="w-full" disabled={ocupado || !tecnico}>
        Asignar
      </Button>
    </form>
  );
}

function FormInforme({
  ocupado,
  onEnviar,
}: {
  ocupado: boolean;
  onEnviar: (datos: { descripcion: string; tipo: "mantenimiento" | "cambio_de_pieza" | "otro_servicio"; detalle_pieza?: string }) => void;
}) {
  const [tipo, setTipo] = useState<"mantenimiento" | "cambio_de_pieza" | "otro_servicio">("mantenimiento");
  const [error, setError] = useState("");

  function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    const descripcion = String(fd.get("descripcion") ?? "").trim();
    const pieza = String(fd.get("pieza") ?? "").trim();
    if (!descripcion) return;
    if (tipo === "cambio_de_pieza" && !pieza) {
      setError("El cambio de pieza requiere el detalle.");
      return;
    }
    setError("");
    onEnviar({
      descripcion,
      tipo,
      detalle_pieza: tipo === "cambio_de_pieza" ? pieza : undefined,
    });
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <p>Qué se hizo en el sitio. Al registrar, el servicio se cierra.</p>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="inf-descripcion">Descripción</FieldLabel>
          <Textarea id="inf-descripcion" name="descripcion" required rows={3} />
        </Field>
        <Field>
          <FieldLabel htmlFor="inf-tipo">Tipo</FieldLabel>
          <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
            <SelectTrigger id="inf-tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                <SelectItem value="cambio_de_pieza">Cambio de pieza</SelectItem>
                <SelectItem value="otro_servicio">Otro servicio</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        {tipo === "cambio_de_pieza" ? (
          <Field>
            <FieldLabel htmlFor="inf-pieza">Detalle de pieza</FieldLabel>
            <Input id="inf-pieza" name="pieza" required />
          </Field>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </FieldGroup>
      <Button type="submit" className="w-full" disabled={ocupado}>
        {ocupado ? "Registrando…" : "Registrar informe"}
      </Button>
    </form>
  );
}

function FormCalificar({
  ocupado,
  onEnviar,
}: {
  ocupado: boolean;
  onEnviar: (datos: { valor: number; comentario?: string }) => void;
}) {
  function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    onEnviar({
      valor: Number(fd.get("valor")),
      comentario: String(fd.get("comentario") ?? "").trim() || undefined,
    });
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <p>De 1 a 5. Si no calificas, al cerrar queda 4.5.</p>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="cal-valor">Valor</FieldLabel>
          <Input id="cal-valor" name="valor" type="number" min={1} max={5} step={0.5} defaultValue={5} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="cal-comentario">Comentario (opcional)</FieldLabel>
          <Textarea id="cal-comentario" name="comentario" rows={2} />
        </Field>
      </FieldGroup>
      <Button type="submit" className="w-full" disabled={ocupado}>
        {ocupado ? "Enviando…" : "Enviar calificación"}
      </Button>
    </form>
  );
}

function FormReclamacion({
  ocupado,
  onEnviar,
}: {
  ocupado: boolean;
  onEnviar: (datos: { categoria: string; motivo: string }) => void;
}) {
  const [categoria, setCategoria] = useState(CATEGORIAS_RECLAMACION[0]?.valor ?? "");

  function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    onEnviar({
      categoria,
      motivo: String(fd.get("motivo") ?? "").trim(),
    });
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <p>No cancela el servicio. El administrador atiende el trámite.</p>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="rec-categoria">Categoría</FieldLabel>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger id="rec-categoria" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {CATEGORIAS_RECLAMACION.map((c) => (
                  <SelectItem key={c.valor} value={c.valor}>
                    {c.etiqueta}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="rec-motivo">Motivo</FieldLabel>
          <Textarea id="rec-motivo" name="motivo" required rows={3} />
        </Field>
      </FieldGroup>
      <Button type="submit" className="w-full" disabled={ocupado}>
        {ocupado ? "Abriendo…" : "Abrir reclamación"}
      </Button>
    </form>
  );
}

function FormCancelar({ ocupado, onConfirmar }: { ocupado: boolean; onConfirmar: () => void }) {
  return (
    <>
      <p>La otra parte recibe aviso. La cotización aceptada se conserva. Esto no abre una reclamación.</p>
      <Button type="button" variant="destructive" className="w-full" disabled={ocupado} onClick={onConfirmar}>
        {ocupado ? "Cancelando…" : "Cancelar servicio"}
      </Button>
    </>
  );
}

function rolEnServicio(usuario: Usuario): "cliente" | "admin_proveedor" | "tecnico" | "otro" {
  if (usuario.tipo_cuenta === "cliente") return "cliente";
  if (usuario.funcion === "tecnico") return "tecnico";
  if (esProveedor(usuario.tipo_cuenta)) return "admin_proveedor";
  return "otro";
}

function esTecnicoAsignado(usuario: Usuario, tecnicoId: string | null): boolean {
  if (!tecnicoId) return false;
  if (usuario.funcion === "tecnico" || usuario.funcion === "administrativo_campo") {
    return tecnicoId === usuario.id;
  }
  return false;
}

function puedeAsignar(rol: string, estado: string, tecnicoId: string | null, usuario: Usuario): boolean {
  if (rol !== "admin_proveedor" || estado !== "pendiente" || tecnicoId) return false;
  return usuario.tipo_cuenta === "empresa" || usuario.tipo_cuenta === "negocio";
}

function puedeIniciar(rol: string, estado: string, tecnicoId: string | null, usuario: Usuario): boolean {
  if (estado !== "pendiente" || !tecnicoId) return false;
  if (rol === "admin_proveedor") return true;
  return esTecnicoAsignado(usuario, tecnicoId);
}

function puedeTerminar(rol: string, estado: string, tecnicoId: string | null, usuario: Usuario): boolean {
  if (estado !== "en_curso") return false;
  if (rol === "admin_proveedor") return true;
  return esTecnicoAsignado(usuario, tecnicoId);
}

function puedeInforme(estado: string, usuario: Usuario): boolean {
  if (!esPendienteInforme(estado)) return false;
  return usuario.funcion === "tecnico" || usuario.funcion === "administrativo_campo" || usuario.funcion === "administrativo";
}

function puedeCalificar(rol: string, estado: string, yaCalifique: boolean) {
  if (yaCalifique) return false;
  if (estado === "cerrado" || estado === "cancelado") return false;
  return rol === "cliente" || rol === "admin_proveedor";
}

function puedeCancelar(rol: string, estado: string) {
  return (rol === "cliente" || rol === "admin_proveedor" || rol === "tecnico") && (estado === "pendiente" || estado === "en_curso");
}

function puedeReclamar(rol: string, estado: string, abierta: ServicioDetalleDatos["reclamacion_abierta"]) {
  if (abierta) return false;
  return (rol === "cliente" || rol === "admin_proveedor") && estado !== "cerrado" && estado !== "cancelado";
}

function estadoPaso(estado: string, paso: (typeof PASOS)[number]["id"]): "hecho" | "actual" | "pendiente" {
  const orden = ["pendiente", "en_curso", "informe", "cerrado"] as const;
  const actual = esPendienteInforme(estado) ? "informe" : estado === "cerrado" ? "cerrado" : estado;
  const iActual = orden.indexOf(actual as (typeof orden)[number]);
  const iPaso = orden.indexOf(paso);
  if (iActual < 0) return "pendiente";
  if (iPaso < iActual) return "hecho";
  if (iPaso === iActual) return actual === "cerrado" ? "hecho" : "actual";
  return "pendiente";
}

function estrellas(valor: number): string {
  const llenas = Math.round(valor);
  return "★".repeat(Math.min(5, Math.max(0, llenas))) + "☆".repeat(Math.max(0, 5 - llenas));
}
