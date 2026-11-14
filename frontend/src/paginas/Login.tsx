import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BotonTema } from "../BotonTema";
import { useSesion } from "../sesion";

const correoInicial = import.meta.env.DEV ? "admin@example.com" : "";
const contrasenaInicial = import.meta.env.DEV ? "admin123" : "";

export function Login() {
  const { usuario, entrar } = useSesion();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState(correoInicial);
  const [contrasena, setContrasena] = useState(contrasenaInicial);
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
    <div className="login-split vista-centrada">
      <aside className="login-marca" aria-label="Presentación">
        <p className="barra-wordmark">Nexora</p>
        <h1 className="nexora-wordmark">Soporte técnico, con trazabilidad</h1>
        <p>
          Intermediación entre quien solicita ayuda y quien la resuelve: solicitudes, cotizaciones, servicio en sitio e
          historial auditable.
        </p>
      </aside>
      <section className="login-panel">
        <form onSubmit={onSubmit} aria-labelledby="titulo-login">
          <h2 id="titulo-login">Entrar</h2>
          <p className="ayuda">Las altas las da el administrador de plataforma.</p>
          <label>
            Correo
            <input type="email" autoComplete="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={enviando}>
            {enviando ? "Entrando…" : "Entrar"}
          </button>
          <div className="acciones-tema">
            <BotonTema />
          </div>
        </form>
      </section>
    </div>
  );
}