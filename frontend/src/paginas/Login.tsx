import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BotonTema } from "../BotonTema";
import { useSesion } from "../sesion";

const correoInicial = import.meta.env.DEV ? "admin@example.com" : "";
const contrasenaInicial = import.meta.env.DEV ? "AdminNexora1" : "";

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
    <div className="vista-centrada">
      <section className="panel">
        <h1>Nexora</h1>
        <form onSubmit={onSubmit}>
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
        </form>
      </section>
      <div className="acciones-tema">
        <BotonTema />
      </div>
    </div>
  );
}
