import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  cotizacionesSolicitud,
  historialPropio,
  listarSolicitudes,
  mercadoProveedor,
  servicioEstaActivo,
  servicioEstaCerrado,
  type HistorialItem,
  type Solicitud,
} from "../api";
import { useAdminTopbarAcciones, useAdminTopbarTitulo } from "../admin/AdminTopbar";
import { lugarDe, type Lugar } from "../herramientas";
import { useSesion } from "../sesion";
import { TableroAdmin } from "./TableroAdmin";
export function Inicio() {
  const { usuario, listo } = useSesion();
  if (!listo) return <p className="ayuda">Cargando…</p>;
  if (!usuario) return <Navigate to="/" replace />;

  const lugar = lugarDe(usuario);
  const ahora = new Date();

  if (lugar === "administrador") {
    return <TableroAdmin />;
  }

  return (
    <TableroRol
      lugar={lugar}
      nombre={usuario.nombre}
      fecha={ahora}
    />
  );
}

function TableroRol({ lugar, nombre, fecha }: { lugar: Exclude<Lugar, "administrador">; nombre: string; fecha: Date }) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [mercado, setMercado] = useState<Solicitud[]>([]);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [cotizaciones, setCotizaciones] = useState(0);

  useEffect(() => {
    async function cargar() {
      if (lugar === "cliente") {
        const sol = await listarSolicitudes();
        setSolicitudes(sol.filter((s) => s.estado === "abierta"));
        let total = 0;
        for (const s of sol.filter((x) => x.estado === "abierta")) {
          const cots = await cotizacionesSolicitud(s.id);
          total += cots.filter((c) => c.estado === "enviada").length;
        }
        setCotizaciones(total);
      } else {
        setMercado(await mercadoProveedor());
      }
      setHistorial(await historialPropio());
    }
    cargar().catch(() => undefined);
  }, [lugar]);

  const servicios = historial.filter((h) => servicioEstaActivo(h.estado));
  const abiertas = solicitudes.length;
  const mercadoCount = mercado.length;
  const activos = servicios.length;
  const cerrados = historial.filter((h) => servicioEstaCerrado(h.estado)).length;

  const porInforme = servicios.filter((s) => s.estado === "pendiente_informe").length;

  const metricas: { etiqueta: string; valor: number; tono?: "alerta" }[] =
    lugar === "cliente"
      ? [
          { etiqueta: "Solicitudes abiertas", valor: abiertas },
          { etiqueta: "Cotizaciones por elegir", valor: cotizaciones, tono: cotizaciones > 0 ? "alerta" : undefined },
          { etiqueta: "Servicios activos", valor: activos },
          { etiqueta: "Historial", valor: cerrados },
        ]
      : [
          { etiqueta: "Mercado visible", valor: mercadoCount },
          { etiqueta: "Servicios activos", valor: activos },
          { etiqueta: "En curso", valor: servicios.filter((s) => s.estado === "en_curso").length },
          { etiqueta: "Por informe", valor: porInforme, tono: porInforme > 0 ? "alerta" : undefined },
        ];

  const enlaceRapido =
    lugar === "cliente" ? "/cliente/solicitudes" : lugar === "tecnico" ? "/proveedor/servicios" : "/proveedor/solicitudes";

  const tituloTopbar = `${saludo(fecha)}, ${nombre}`;
  useAdminTopbarTitulo(tituloTopbar);

  const accionesTopbar = useMemo(() => <p className="dash-fecha tablero-fecha">{fechaLegible(fecha)}</p>, [fecha]);
  useAdminTopbarAcciones(accionesTopbar);

  return (
    <section className="hub-page tablero">
      <div className="metricas">
        {metricas.map((m) => (
          <article key={m.etiqueta} className="metrica" data-tono={m.tono}>
            <span>{m.etiqueta}</span>
            <strong>{m.valor}</strong>
          </article>
        ))}
      </div>
      <p>
        <Link to={enlaceRapido}>Ir al módulo principal →</Link>
      </p>
    </section>
  );
}

function saludo(fecha: Date): string {
  const hora = fecha.getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

function fechaLegible(fecha: Date): string {
  const texto = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}