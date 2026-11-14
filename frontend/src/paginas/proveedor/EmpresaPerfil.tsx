import { type FormEvent, useEffect, useState } from "react";
import {
  altaUsuarioEmpresa,
  bajaUsuarioEmpresa,
  listarUsuariosEmpresa,
  pedirConversion,
  type EmpresaUsuario,
  type Usuario,
} from "../../api";
import { useSesion } from "../../sesion";
import { digitos, texto } from "../../validarAlta";

export function EquipoProveedor() {
  const { usuario } = useSesion();
  const [usuarios, setUsuarios] = useState<EmpresaUsuario[]>([]);
  const [error, setError] = useState("");

  async function recargar() {
    try {
      setUsuarios(await listarUsuariosEmpresa());
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo cargar el equipo");
    }
  }

  useEffect(() => {
    if (usuario?.tipo_cuenta === "empresa") void recargar();
  }, [usuario?.tipo_cuenta]);

  if (usuario?.tipo_cuenta !== "empresa") {
    return (
      <section className="vista-operacion">
        <h1>Equipo</h1>
        <p className="aviso">Solo las cuentas de empresa pueden administrar usuarios extras.</p>
      </section>
    );
  }

  return (
    <section className="vista-operacion">
      <header className="encabezado-vista">
        <div>
          <p className="kicker">Empresa</p>
          <h1>Equipo del perfil</h1>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <ConversionTipo usuario={usuario} />
      <ul className="lista-casos">
        {usuarios.map((u) => (
          <li key={u.id} className="caso-fila">
            <strong>{u.nombre}</strong>
            <span className="meta-fila">
              {u.funcion}
              {u.primera ? " · primera cuenta" : ""}
            </span>
            {!u.primera && !u.baja_procesada ? (
              <button
                type="button"
                className="secundario"
                onClick={async () => {
                  const reemplazo = window.prompt("ID del técnico de reemplazo (si aplica)");
                  try {
                    await bajaUsuarioEmpresa(u.id, reemplazo?.trim() || undefined);
                    await recargar();
                  } catch (causa) {
                    setError(causa instanceof Error ? causa.message : "No se pudo dar de baja");
                  }
                }}
              >
                Dar de baja usuario
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <form
        className="formulario-flujo panel-superficie"
        onSubmit={async (e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          try {
            await altaUsuarioEmpresa({
              nombre: texto(fd.get("nombre")),
              correo: texto(fd.get("correo")).toLowerCase(),
              contrasena: String(fd.get("contrasena") ?? ""),
              telefono: digitos(fd.get("telefono")),
              funcion: fd.get("funcion") === "tecnico" ? "tecnico" : "administrativo",
            });
            e.currentTarget.reset();
            await recargar();
          } catch (causa) {
            setError(causa instanceof Error ? causa.message : "No se pudo crear");
          }
        }}
      >
        <h2>Agregar usuario</h2>
        <label>
          Nombre
          <input name="nombre" required />
        </label>
        <label>
          Correo
          <input name="correo" type="email" required />
        </label>
        <label>
          Teléfono
          <input name="telefono" required />
        </label>
        <label>
          Contraseña
          <input name="contrasena" type="password" minLength={8} required />
        </label>
        <label>
          Función
          <select name="funcion" defaultValue="administrativo">
            <option value="administrativo">Administrativo</option>
            <option value="tecnico">Técnico</option>
          </select>
        </label>
        <button type="submit">Crear cuenta</button>
      </form>
    </section>
  );
}

function ConversionTipo({ usuario }: { usuario: Usuario }) {
  const [mensaje, setMensaje] = useState("");
  const hacia = usuario.tipo_cuenta === "empresa" ? "negocio" : "empresa";
  if (usuario.tipo_cuenta !== "empresa" && usuario.tipo_cuenta !== "negocio") return null;
  return (
    <section className="panel-superficie">
      <h2>Conversión de tipo</h2>
      <p className="ayuda">
        Pide convertir el perfil a <strong>{hacia}</strong>. El administrador de plataforma autoriza o rechaza.
      </p>
      <button
        type="button"
        className="secundario"
        onClick={async () => {
          try {
            await pedirConversion(hacia);
            setMensaje("Pedido registrado.");
          } catch (causa) {
            setMensaje(causa instanceof Error ? causa.message : "No se pudo pedir");
          }
        }}
      >
        Pedir conversión a {hacia}
      </button>
      {mensaje ? <p className="aviso">{mensaje}</p> : null}
    </section>
  );
}

export function MapaProveedor() {
  const [enlace, setEnlace] = useState("");

  return (
    <section className="vista-operacion">
      <header className="encabezado-vista">
        <div>
          <p className="kicker">Proveedor</p>
          <h1>Mapa del perfil</h1>
          <p className="lede">Abre la ubicación del perfil en OpenStreetMap (D8 expone geocódigo en admin).</p>
        </div>
      </header>
      <form
        className="formulario-flujo panel-superficie"
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
        <label>
          Calle y número
          <input name="calle_numero" required />
        </label>
        <label>
          Colonia
          <input name="colonia" required />
        </label>
        <label>
          Ciudad
          <input name="ciudad" required />
        </label>
        <label>
          Estado
          <input name="estado" required />
        </label>
        <label>
          C.P.
          <input name="codigo_postal" required pattern="\d{5}" />
        </label>
        <button type="submit">Buscar en mapa</button>
      </form>
      {enlace ? (
        <p className="aviso">
          <a href={enlace} target="_blank" rel="noreferrer">
            Ver en OpenStreetMap
          </a>
        </p>
      ) : null}
    </section>
  );
}

export function ReportesProveedor() {
  return (
    <section className="vista-operacion">
      <h1>Reportes</h1>
      <p className="aviso">Gap: consulta de reportes por perfil proveedor pendiente de endpoint dedicado.</p>
    </section>
  );
}

export function CapturaCampo() {
  return (
    <section className="vista-operacion">
      <h1>Captura en campo</h1>
      <p className="aviso">
        El canal de voz usa el ESP32 autorizado (API del aparato, N3/N4). La web enlaza aquí cuando el dispositivo esté
        asociado al servicio activo.
      </p>
    </section>
  );
}