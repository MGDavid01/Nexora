import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  abrirReclamacionServicio,
  asignarTecnicoServicio,
  calificarServicio,
  cancelarServicio,
  CATEGORIAS_RECLAMACION,
  type HistorialItem,
  iniciarServicio,
  obtenerServicio,
  registrarInforme,
  terminarServicio,
  type Usuario,
  esProveedor,
} from "../../api";
import { fechaCorta } from "../../utilidades/formato";
import { useSesion } from "../../sesion";

type Props = {
  item: HistorialItem;
  tecnicos?: { id: string; nombre: string }[];
  volverA: string;
};

export function ServicioDetalle({ item, tecnicos = [], volverA }: Props) {
  const { usuario } = useSesion();
  const [estado, setEstado] = useState(item.estado);
  const [tecnicoId, setTecnicoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    obtenerServicio(item.servicio_id)
      .then((s) => {
        if (!vivo) return;
        setEstado(s.estado);
        setTecnicoId(s.tecnico_usuario_id);
      })
      .catch(() => {
        /* el ítem del historial basta si falla */
      });
    return () => {
      vivo = false;
    };
  }, [item.servicio_id]);

  if (!usuario) return null;

  const rol = rolEnServicio(usuario);
  const k = estado.toLowerCase();

  async function conAccion(accion: () => Promise<unknown>, ok: string) {
    setError("");
    setMensaje("");
    setOcupado(true);
    try {
      const salida = (await accion()) as { estado?: string; tecnico_usuario_id?: string | null };
      if (salida.estado) setEstado(salida.estado);
      if ("tecnico_usuario_id" in salida) setTecnicoId(salida.tecnico_usuario_id ?? null);
      setMensaje(ok);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo completar");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <article className="ficha-servicio">
      <header className="encabezado-vista">
        <div>
          <p className="kicker">Servicio</p>
          <h2>{item.titulo}</h2>
          <p className="meta-fila">
            <span className={`estado-chip estado-${k.replace(/[^a-z]/g, "")}`}>{estado}</span>
            <span>{fechaCorta(item.creado_en)}</span>
          </p>
        </div>
        <Link className="enlace-secundario" to={volverA}>
          ← Volver
        </Link>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {mensaje ? <p className="aviso">{mensaje}</p> : null}

      {item.informe ? (
        <section className="bloque-datos">
          <h3>Informe de servicio</h3>
          <p>{item.informe.descripcion}</p>
          <p className="ayuda">
            Tipo: {item.informe.tipo}
            {item.informe.detalle_pieza ? ` · Pieza: ${item.informe.detalle_pieza}` : ""}
          </p>
        </section>
      ) : null}

      {rol === "admin_proveedor" && k === "pendiente" ? (
        <form
          className="bloque-accion"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const id = String(fd.get("tecnico") ?? "");
            if (!id) return;
            void conAccion(() => asignarTecnicoServicio(item.servicio_id, id), "Técnico asignado.");
          }}
        >
          <h3>Asignar técnico</h3>
          <label>
            Técnico del perfil
            <select name="tecnico" required defaultValue="">
              <option value="" disabled>
                Elegir…
              </option>
              {usuario.tipo_cuenta === "negocio" ? (
                <option value={usuario.id}>{usuario.nombre} (campo)</option>
              ) : (
                tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))
              )}
            </select>
          </label>
          <button type="submit" disabled={ocupado}>
            Asignar
          </button>
        </form>
      ) : null}

      {rol === "tecnico" && k === "pendiente" && tecnicoId === usuario.id ? (
        <p className="aviso">Técnico asignado. Puedes iniciar el trabajo en sitio.</p>
      ) : null}

      {puedeIniciar(rol, k, tecnicoId, usuario) ? (
        <div className="bloque-accion">
          <button type="button" disabled={ocupado} onClick={() => void conAccion(() => iniciarServicio(item.servicio_id), "Servicio en curso.")}>
            Iniciar servicio
          </button>
        </div>
      ) : null}

      {puedeTerminar(rol, k, tecnicoId, usuario) ? (
        <div className="bloque-accion">
          <button type="button" disabled={ocupado} onClick={() => void conAccion(() => terminarServicio(item.servicio_id), "Trabajo terminado; falta el informe.")}>
            Terminar trabajo en sitio
          </button>
        </div>
      ) : null}

      {puedeInforme(rol, k, tecnicoId, usuario) ? (
        <FormInforme
          ocupado={ocupado}
          onEnviar={(datos) =>
            conAccion(() => registrarInforme(item.servicio_id, datos), "Informe registrado.")
          }
        />
      ) : null}

      {puedeCalificar(rol, k) ? (
        <FormCalificacion
          ocupado={ocupado}
          onEnviar={(datos) =>
            conAccion(() => calificarServicio(item.servicio_id, datos), "Calificación enviada.")
          }
        />
      ) : null}

      {puedeCancelar(rol, k) ? (
        <div className="bloque-accion">
          <button
            type="button"
            className="secundario"
            disabled={ocupado}
            onClick={() => {
              if (!window.confirm("¿Cancelar este servicio?")) return;
              void conAccion(() => cancelarServicio(item.servicio_id), "Servicio cancelado.");
            }}
          >
            Cancelar servicio
          </button>
        </div>
      ) : null}

      {puedeReclamar(rol, k) ? (
        <FormReclamacion
          ocupado={ocupado}
          onEnviar={(datos) =>
            conAccion(() => abrirReclamacionServicio(item.servicio_id, datos), "Reclamación abierta.")
          }
        />
      ) : null}
    </article>
  );
}

function FormInforme({
  ocupado,
  onEnviar,
}: {
  ocupado: boolean;
  onEnviar: (datos: { descripcion: string; tipo: "mantenimiento" | "cambio_de_pieza" | "otro_servicio"; detalle_pieza?: string }) => void;
}) {
  return (
    <form
      className="bloque-accion"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const tipo = String(fd.get("tipo")) as "mantenimiento" | "cambio_de_pieza" | "otro_servicio";
        onEnviar({
          descripcion: String(fd.get("descripcion") ?? "").trim(),
          tipo,
          detalle_pieza: tipo === "cambio_de_pieza" ? String(fd.get("pieza") ?? "").trim() : undefined,
        });
      }}
    >
      <h3>Informe de servicio</h3>
      <label>
        Descripción
        <textarea name="descripcion" required rows={3} />
      </label>
      <label>
        Tipo
        <select name="tipo" defaultValue="mantenimiento">
          <option value="mantenimiento">Mantenimiento</option>
          <option value="cambio_de_pieza">Cambio de pieza</option>
          <option value="otro_servicio">Otro servicio</option>
        </select>
      </label>
      <label>
        Detalle de pieza (si aplica)
        <input name="pieza" />
      </label>
      <button type="submit" disabled={ocupado}>
        Registrar informe
      </button>
    </form>
  );
}

function FormCalificacion({
  ocupado,
  onEnviar,
}: {
  ocupado: boolean;
  onEnviar: (datos: { valor: number; comentario?: string }) => void;
}) {
  return (
    <form
      className="bloque-accion"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onEnviar({
          valor: Number(fd.get("valor")),
          comentario: String(fd.get("comentario") ?? "").trim() || undefined,
        });
      }}
    >
      <h3>Calificar</h3>
      <label>
        Valor (1–5)
        <input name="valor" type="number" min={1} max={5} step={0.5} defaultValue={5} required />
      </label>
      <label>
        Comentario (opcional)
        <textarea name="comentario" rows={2} />
      </label>
      <button type="submit" disabled={ocupado}>
        Enviar calificación
      </button>
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
  return (
    <form
      className="bloque-accion"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onEnviar({
          categoria: String(fd.get("categoria")),
          motivo: String(fd.get("motivo") ?? "").trim(),
        });
      }}
    >
      <h3>Abrir reclamación</h3>
      <label>
        Categoría
        <select name="categoria" required>
          {CATEGORIAS_RECLAMACION.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label>
        Motivo
        <textarea name="motivo" required rows={3} />
      </label>
      <button type="submit" className="secundario" disabled={ocupado}>
        Abrir reclamación
      </button>
    </form>
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

function puedeIniciar(_rol: string, estado: string, tecnicoId: string | null, usuario: Usuario): boolean {
  if (estado !== "pendiente" || !tecnicoId) return false;
  return esTecnicoAsignado(usuario, tecnicoId);
}

function puedeTerminar(_rol: string, estado: string, tecnicoId: string | null, usuario: Usuario): boolean {
  if (estado !== "en_curso") return false;
  return esTecnicoAsignado(usuario, tecnicoId);
}

function puedeInforme(_rol: string, estado: string, _tecnicoId: string | null, usuario: Usuario): boolean {
  if (estado !== "pendiente_informe") return false;
  return usuario.funcion === "tecnico" || usuario.funcion === "administrativo_campo";
}

function puedeCalificar(rol: string, estado: string) {
  return estado === "pendiente_informe" && (rol === "cliente" || rol === "admin_proveedor");
}

function puedeCancelar(rol: string, estado: string) {
  return rol === "cliente" && (estado === "pendiente" || estado === "en_curso");
}

function puedeReclamar(rol: string, estado: string) {
  return (rol === "cliente" || rol === "admin_proveedor") && estado !== "cerrado" && estado !== "cancelado";
}