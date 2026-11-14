import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { historialPropio, listarUsuariosEmpresa, type HistorialItem, servicioEstaActivo } from "../../api";
import { useSesion } from "../../sesion";
import { fechaCorta, dineroMxn } from "../../utilidades/formato";
import { ServicioDetalle } from "../flujo/ServicioDetalle";

export function ServiciosProveedor() {
  const { usuario } = useSesion();
  const { servicioId } = useParams();
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    historialPropio()
      .then((lista) => setItems(lista.filter((i) => servicioEstaActivo(i.estado))))
      .catch((causa) => setError(causa instanceof Error ? causa.message : "No se pudo cargar"));
    if (usuario?.tipo_cuenta === "empresa") {
      listarUsuariosEmpresa()
        .then((usuarios) =>
          setTecnicos(usuarios.filter((u) => u.funcion === "tecnico" && !u.baja_procesada).map((u) => ({ id: u.id, nombre: u.nombre }))),
        )
        .catch(() => {
          /* sin lista de técnicos */
        });
    }
  }, [usuario?.tipo_cuenta]);

  const detalle = servicioId ? items.find((i) => i.servicio_id === servicioId) : null;
  if (servicioId && detalle) {
    return <ServicioDetalle item={detalle} tecnicos={tecnicos} volverA="/proveedor/servicios" />;
  }

  return (
    <section className="vista-operacion">
      <header className="encabezado-vista">
        <div>
          <p className="kicker">Proveedor</p>
          <h1>Servicios del perfil</h1>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <ul className="lista-casos">
        {items.map((i) => (
          <li key={i.servicio_id}>
            <Link to={`/proveedor/servicios/${i.servicio_id}`} className="enlace-caso">
              <strong>{i.titulo}</strong>
              <span className="meta-fila">
                <span className="estado-chip">{i.estado}</span>
                {dineroMxn(i.costo_mxn)}
                {fechaCorta(i.creado_en)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {items.length === 0 ? <p className="ayuda">Sin servicios activos.</p> : null}
    </section>
  );
}

export function HistorialProveedor() {
  const [items, setItems] = useState<HistorialItem[]>([]);
  useEffect(() => {
    historialPropio()
      .then((lista) => setItems(lista.filter((i) => !servicioEstaActivo(i.estado))))
      .catch(() => undefined);
  }, []);

  return (
    <section className="vista-operacion">
      <header className="encabezado-vista">
        <div>
          <p className="kicker">Proveedor</p>
          <h1>Historial</h1>
        </div>
      </header>
      <ul className="lista-casos">
        {items.map((i) => (
          <li key={i.servicio_id} className="caso-fila">
            <strong>{i.titulo}</strong>
            <span className="estado-chip">{i.estado}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}