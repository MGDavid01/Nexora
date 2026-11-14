import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  cotizacionesSolicitud,
  historialPropio,
  listarSolicitudes,
  mercadoProveedor,
  servicioEstaActivo,
  type HistorialItem,
  type Solicitud,
} from "../api";
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
  const [servicios, setServicios] = useState<HistorialItem[]>([]);
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
        const hist = await historialPropio();
        setServicios(hist.filter((h) => servicioEstaActivo(h.estado)));
      } else {
        setMercado(await mercadoProveedor());
        const hist = await historialPropio();
        setServicios(hist.filter((h) => servicioEstaActivo(h.estado)));
      }
    }
    cargar().catch(() => undefined);
  }, [lugar]);

  const abiertas = solicitudes.length;
  const mercadoCount = mercado.length;
  const activos = servicios.length;
  const cerrados = 0;

  const metricas =
    lugar === "cliente"
      ? [
          { etiqueta: "Solicitudes abiertas", valor: abiertas },
          { etiqueta: "Cotizaciones por elegir", valor: cotizaciones },
          { etiqueta: "Servicios activos", valor: activos },
          { etiqueta: "Historial", valor: cerrados },
        ]
      : [
          { etiqueta: "Mercado visible", valor: mercadoCount },
          { etiqueta: "Servicios activos", valor: activos },
          { etiqueta: "En curso", valor: servicios.filter((s) => s.estado === "en_curso").length },
          { etiqueta: "Por informe", valor: servicios.filter((s) => s.estado === "pendiente_informe").length },
        ];

  const enlaceRapido =
    lugar === "cliente" ? "/cliente/solicitudes" : lugar === "tecnico" ? "/proveedor/servicios" : "/proveedor/solicitudes";

  return (
    <section className="tablero">
      <header className="tablero-encabezado">
        <div>
          <p className="kicker">{etiquetaLugar(lugar)}</p>
          <h1>
            {saludo(fecha)}, {nombre}
          </h1>
        </div>
        <p className="tablero-fecha">{fechaLegible(fecha)}</p>
      </header>
      <div className="metricas">
        {metricas.map((m) => (
          <article key={m.etiqueta} className="metrica">
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

function etiquetaLugar(lugar: Exclude<Lugar, "administrador">): string {
  if (lugar === "cliente") return "Cliente";
  if (lugar === "tecnico") return "Técnico en campo";
  return "Administrativo del proveedor";
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