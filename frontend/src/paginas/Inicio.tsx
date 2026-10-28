import { Navigate } from "react-router-dom";
import { type Usuario } from "../api";
import { lugarDe, type Lugar } from "../herramientas";
import { useSesion } from "../sesion";
import { TableroAdmin } from "./TableroAdmin";

type Metrica = {
  etiqueta: string;
  detalle: string;
};

type Panel = {
  titulo: string;
  columnas: string[];
  vacio: string;
};

const tablerosRol: Record<Exclude<Lugar, "administrador">, { metricas: Metrica[]; paneles: Panel[] }> = {
  cliente: {
    metricas: [
      { etiqueta: "Solicitudes abiertas", detalle: "Publicadas y sin cotización elegida" },
      { etiqueta: "Cotizaciones por elegir", detalle: "Enviadas y todavía abiertas" },
      { etiqueta: "Servicios en seguimiento", detalle: "Pendiente, en curso o por historial" },
      { etiqueta: "Servicios cerrados", detalle: "Quedan en el historial" },
    ],
    paneles: [
      {
        titulo: "Solicitudes abiertas",
        columnas: ["Título", "Categoría", "Estado"],
        vacio: "No tienes solicitudes abiertas.",
      },
      {
        titulo: "Cotizaciones por elegir",
        columnas: ["Proveedor", "Estado"],
        vacio: "No hay cotizaciones enviadas.",
      },
      {
        titulo: "Servicios en seguimiento",
        columnas: ["Servicio", "Estado"],
        vacio: "No hay un servicio activo.",
      },
    ],
  },
  administrativo: {
    metricas: [
      { etiqueta: "Por decidir", detalle: "Solicitudes que tu perfil aún no responde" },
      { etiqueta: "Plazo de cotización", detalle: "Aceptadas, dentro de las 24 horas" },
      { etiqueta: "Servicios del perfil", detalle: "Asignados a tu organización" },
      { etiqueta: "Por cerrar", detalle: "Pendientes de historial" },
    ],
    paneles: [
      {
        titulo: "Por decidir",
        columnas: ["Solicitud", "Categoría"],
        vacio: "No hay solicitudes pendientes de tu perfil.",
      },
      {
        titulo: "Dentro de las 24 horas",
        columnas: ["Solicitud", "Plazo"],
        vacio: "Ninguna aceptación está dentro del plazo.",
      },
      {
        titulo: "Servicios del perfil",
        columnas: ["Servicio", "Estado", "Técnico"],
        vacio: "No hay servicios asignados.",
      },
    ],
  },
  tecnico: {
    metricas: [
      { etiqueta: "Asignados", detalle: "Servicios en los que realizas el trabajo" },
      { etiqueta: "En curso", detalle: "El trabajo ya empezó" },
      { etiqueta: "Por historial", detalle: "Falta el registro para cerrar" },
      { etiqueta: "Captura", detalle: "Voz en campo con dispositivo autorizado" },
    ],
    paneles: [
      {
        titulo: "Servicios asignados",
        columnas: ["Servicio", "Estado"],
        vacio: "No tienes un servicio asignado.",
      },
      {
        titulo: "Pendiente de historial",
        columnas: ["Servicio", "Fecha"],
        vacio: "Nada esperando el registro de cierre.",
      },
      {
        titulo: "Captura en campo",
        columnas: ["Dispositivo", "Estado"],
        vacio: "Sin captura de un dispositivo autorizado.",
      },
    ],
  },
};

export function Inicio() {
  const { usuario, listo } = useSesion();
  if (!listo) return <p className="ayuda">Cargando…</p>;
  if (!usuario) return <Navigate to="/" replace />;

  const lugar = lugarDe(usuario);
  const ahora = new Date();

  if (lugar === "administrador") {
    return <TableroAdmin />;
  }

  const tablero = tablerosRol[lugar];
  const [principal, ...lateral] = tablero.paneles;

  return (
    <section className="tablero">
      <header className="tablero-encabezado">
        <div>
          <p className="kicker">{etiqueta(usuario)}</p>
          <h1>
            {saludo(ahora)}, {usuario.nombre}
          </h1>
        </div>
        <p className="tablero-fecha">{fechaLegible(ahora)}</p>
      </header>
      <div className="metricas">
        {tablero.metricas.map((metrica) => (
          <article key={metrica.etiqueta} className="metrica">
            <span>{metrica.etiqueta}</span>
            <strong>—</strong>
            <p>{metrica.detalle}</p>
          </article>
        ))}
      </div>
      <div className="tablero-cuerpo">
        <PanelOperacion panel={principal} />
        <div className="tablero-lateral">
          {lateral.map((panel) => (
            <PanelOperacion key={panel.titulo} panel={panel} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PanelOperacion({ panel }: { panel: Panel }) {
  return (
    <section className="panel-dash">
      <h2>{panel.titulo}</h2>
      <table>
        <thead>
          <tr>
            {panel.columnas.map((columna) => (
              <th key={columna} scope="col">
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={panel.columnas.length}>{panel.vacio}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function etiqueta(usuario: Usuario): string {
  if (usuario.tipo_cuenta === "cliente") return "Cliente";
  if (usuario.tipo_cuenta === "administrador") return "Administrador de plataforma";
  if (usuario.funcion === "tecnico") return "Técnico";
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
