import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  LuArrowRight,
  LuClipboardList,
  LuEye,
  LuEyeOff,
  LuHistory,
  LuLock,
  LuMail,
  LuWrench,
} from "react-icons/lu";
import { BotonTema } from "../BotonTema";
import { Logo } from "../Logo";
import { useSesion } from "../sesion";
import "../login.css";

const correoInicial = import.meta.env.DEV ? "admin@example.com" : "";
const contrasenaInicial = import.meta.env.DEV ? "admin123" : "";

export function Login() {
  const { usuario, entrar } = useSesion();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState(correoInicial);
  const [contrasena, setContrasena] = useState(contrasenaInicial);
  const [verContrasena, setVerContrasena] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to="/inicio" replace />;

  async function onSubmit(evento: FormEvent) {
    evento.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await entrar(correo, contrasena);
      navigate("/inicio");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo entrar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <aside className="login-brand" aria-label="Acerca de Nexora">
        <div className="login-marca-cabecera">
          <Logo size={40} />
          <span className="login-marca-nombre">NEXORA</span>
        </div>

        <div className="login-marca-cuerpo">
          <p className="login-kicker">Soporte técnico</p>
          <h1 className="login-titulo">
            El soporte técnico que necesitas, <span className="login-resaltado">en un solo lugar</span>.
          </h1>
          <p className="login-subtitulo">
            Conecta con proveedores, sigue cada servicio hasta el cierre y conserva tu historial.
          </p>
          <ul className="login-ventajas">
            <li>
              <LuClipboardList size={20} aria-hidden />
              Publica solicitudes y recibe cotizaciones
            </li>
            <li>
              <LuWrench size={20} aria-hidden />
              Sigue el servicio del pendiente al cierre
            </li>
            <li>
              <LuHistory size={20} aria-hidden />
              Historial y calificación mutua
            </li>
          </ul>
        </div>

        <p className="login-marca-pie">Intermediación de soporte técnico</p>
      </aside>

      <div className="login-acceso">
        <div className="login-tema">
          <BotonTema />
        </div>

        <section className="login-tarjeta">
          <div>
            <p className="login-kicker">Acceso</p>
            <h2 className="login-titulo-acceso">Inicia sesión</h2>
            <p className="login-subtitulo">Usa la cuenta que te dio de alta el administrador.</p>
          </div>

          <form className="login-form" onSubmit={onSubmit}>
            <div className="login-campo">
              <label className="login-etiqueta" htmlFor="login-correo">
                Correo
              </label>
              <div className="login-entrada">
                <LuMail size={18} aria-hidden />
                <input
                  id="login-correo"
                  type="email"
                  autoComplete="email"
                  placeholder="correo@ejemplo.com"
                  required
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
              </div>
            </div>

            <div className="login-campo">
              <label className="login-etiqueta" htmlFor="login-contrasena">
                Contraseña
              </label>
              <div className="login-entrada">
                <LuLock size={18} aria-hidden />
                <input
                  id="login-contrasena"
                  type={verContrasena ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                />
                <button
                  type="button"
                  className="login-ojo"
                  onClick={() => setVerContrasena((actual) => !actual)}
                  aria-label={verContrasena ? "Ocultar contraseña" : "Mostrar contraseña"}
                  title={verContrasena ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {verContrasena ? <LuEyeOff size={18} aria-hidden /> : <LuEye size={18} aria-hidden />}
                </button>
              </div>
            </div>

            {error ? (
              <p className="error login-error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="login-boton" disabled={enviando}>
              {enviando ? "Entrando…" : "Entrar"}
              {enviando ? null : <LuArrowRight size={18} aria-hidden />}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
