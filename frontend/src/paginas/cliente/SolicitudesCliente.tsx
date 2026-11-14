import { type FormEvent, useCallback, useEffect, useState } from "react";
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
import { CamposUbicacion } from "../FormularioRegistro";
import { digitos, texto } from "../../validarAlta";
import { dineroMxn, fechaCorta } from "../../utilidades/formato";

const CATEGORIAS_SUGERIDAS = ["Soporte técnico", "Redes", "Software", "Hardware", "Ciberseguridad"];

export function SolicitudesCliente() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [proveedoresCerrados, setProveedoresCerrados] = useState<{ id: string; titulo: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [expandida, setExpandida] = useState<string | null>(null);
  const [cotizaciones, setCotizaciones] = useState<Record<string, Cotizacion[]>>({});
  const [publicar, setPublicar] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError("");
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
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo cargar");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  async function abrirCotizaciones(id: string) {
    setExpandida(id);
    if (cotizaciones[id]) return;
    try {
      const lista = await cotizacionesSolicitud(id);
      setCotizaciones((prev) => ({ ...prev, [id]: lista }));
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudieron cargar las cotizaciones");
    }
  }

  return (
    <section className="vista-operacion">
      <header className="encabezado-vista hero-soporte">
        <div>
          <p className="kicker">Cliente</p>
          <h1>Solicitudes</h1>
          <p className="lede">Publica el soporte que necesitas y elige entre las cotizaciones enviadas.</p>
        </div>
        <button type="button" onClick={() => setPublicar((v) => !v)}>
          {publicar ? "Cerrar formulario" : "Publicar solicitud"}
        </button>
      </header>

      {error ? <p className="error">{error}</p> : null}

      {publicar ? (
        <form
          className="formulario-flujo panel-superficie"
          onSubmit={async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            setError("");
            const fd = new FormData(e.currentTarget);
            try {
              await publicarSolicitud({
                titulo: texto(fd.get("titulo")),
                descripcion: texto(fd.get("descripcion")),
                categoria: texto(fd.get("categoria")),
                dirigida_a_perfil_proveedor_id: texto(fd.get("dirigida")) || undefined,
                ubicacion: {
                  calle_numero: texto(fd.get("calle_numero")),
                  colonia: texto(fd.get("colonia")),
                  ciudad: texto(fd.get("ciudad")),
                  estado: texto(fd.get("estado")),
                  codigo_postal: digitos(fd.get("codigo_postal")),
                },
              });
              setPublicar(false);
              await recargar();
            } catch (causa) {
              setError(causa instanceof Error ? causa.message : "No se pudo publicar");
            }
          }}
        >
          <h2>Nueva solicitud</h2>
          <label>
            Título
            <input name="titulo" required maxLength={120} />
          </label>
          <label>
            Descripción
            <textarea name="descripcion" required rows={4} />
          </label>
          <label>
            Categoría
            <input name="categoria" list="categorias-nexora" required />
            <datalist id="categorias-nexora">
              {CATEGORIAS_SUGERIDAS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          {proveedoresCerrados.length > 0 ? (
            <label>
              Solicitar para (opcional)
              <select name="dirigida" defaultValue="">
                <option value="">Mercado abierto</option>
                {proveedoresCerrados.map((p) => (
                  <option key={p.id} value={p.id}>
                    Proveedor de «{p.titulo}»
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <fieldset>
            <legend>Ubicación del servicio</legend>
            <CamposUbicacion />
          </fieldset>
          <button type="submit">Publicar</button>
        </form>
      ) : null}

      {cargando ? <p className="ayuda">Cargando solicitudes…</p> : null}

      <section className="lista-casos">
        {solicitudes.map((s) => (
          <article key={s.id} className="caso-fila">
            <div className="caso-principal">
              <h2>{s.titulo}</h2>
              <p className="meta-fila">
                <span className="estado-chip">{s.estado}</span>
                <span>{s.categoria}</span>
                <span>{fechaCorta(s.creado_en)}</span>
              </p>
              <p className="ayuda">{s.descripcion}</p>
            </div>
            <div className="caso-acciones">
              {s.estado === "abierta" ? (
                <>
                  <button type="button" onClick={() => void abrirCotizaciones(s.id)}>
                    Ver cotizaciones
                  </button>
                  <button
                    type="button"
                    className="secundario"
                    onClick={async () => {
                      if (!window.confirm("¿Cancelar esta solicitud?")) return;
                      try {
                        await cancelarSolicitud(s.id);
                        await recargar();
                      } catch (causa) {
                        setError(causa instanceof Error ? causa.message : "No se pudo cancelar");
                      }
                    }}
                  >
                    Cancelar
                  </button>
                </>
              ) : null}
            </div>
            {expandida === s.id ? (
              <ListaCotizaciones
                solicitudId={s.id}
                items={cotizaciones[s.id] ?? []}
                onElegir={async (c) => {
                  try {
                    await elegirCotizacion(c.id);
                    await recargar();
                    setExpandida(null);
                  } catch (causa) {
                    setError(causa instanceof Error ? causa.message : "No se pudo elegir");
                  }
                }}
                onRechazar={async (c) => {
                  try {
                    await rechazarCotizacion(c.id);
                    const lista = await cotizacionesSolicitud(s.id);
                    setCotizaciones((prev) => ({ ...prev, [s.id]: lista }));
                  } catch (causa) {
                    setError(causa instanceof Error ? causa.message : "No se pudo rechazar");
                  }
                }}
                onRetirar={async (c) => {
                  try {
                    await retirarParticipacion(c.participacion_id);
                    const lista = await cotizacionesSolicitud(s.id);
                    setCotizaciones((prev) => ({ ...prev, [s.id]: lista }));
                  } catch (causa) {
                    setError(causa instanceof Error ? causa.message : "No se pudo retirar");
                  }
                }}
              />
            ) : null}
          </article>
        ))}
        {!cargando && solicitudes.length === 0 ? <p className="ayuda">Aún no tienes solicitudes.</p> : null}
      </section>
    </section>
  );
}

function ListaCotizaciones({
  solicitudId,
  items,
  onElegir,
  onRechazar,
  onRetirar,
}: {
  solicitudId: string;
  items: Cotizacion[];
  onElegir: (c: Cotizacion) => void;
  onRechazar: (c: Cotizacion) => void;
  onRetirar: (c: Cotizacion) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="ayuda" id={`cot-${solicitudId}`}>
        Todavía no hay cotizaciones enviadas.
      </p>
    );
  }
  return (
    <ul className="lista-cotizaciones" id={`cot-${solicitudId}`}>
      {items.map((c) => (
        <li key={c.id}>
          <div>
            <strong>{dineroMxn(c.costo_mxn)}</strong>
            <span className="estado-chip">{c.estado}</span>
          </div>
          <p>{c.descripcion}</p>
          <p className="ayuda">{c.condiciones}</p>
          {c.estado === "enviada" ? (
            <div className="fila-botones">
              <button type="button" onClick={() => onElegir(c)}>
                Elegir cotización
              </button>
              <button type="button" className="secundario" onClick={() => onRechazar(c)}>
                Rechazar
              </button>
              <button type="button" className="secundario" onClick={() => onRetirar(c)}>
                Retirar proveedor
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}