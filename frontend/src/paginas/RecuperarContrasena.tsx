import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LuArrowRight, LuEye, LuEyeOff, LuLock, LuMail } from "react-icons/lu";
import { confirmarRecuperacion, solicitarRecuperacion } from "../api";
import { BotonTema } from "../BotonTema";
import { Logo } from "../Logo";
import "../login.css";

export function RecuperarContrasena() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function pedir(evento: FormEvent) {
    evento.preventDefault();
    setError("");
    setAviso("");
    setEnviando(true);
    try {
      await solicitarRecuperacion(correo);
      setAviso("Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo enviar el enlace");
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    setError("");
    setAviso("");
    if (contrasena.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (contrasena !== repetir) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setEnviando(true);
    try {
      await confirmarRecuperacion(token, contrasena);
      setAviso("Contraseña actualizada. Ya puedes iniciar sesión.");
      setContrasena("");
      setRepetir("");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo actualizar la contraseña");
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
          <p className="login-kicker">Recuperar acceso</p>
          <h1 className="login-titulo">
            {token ? (
              <>
                Define una <span className="login-resaltado">nueva contraseña</span>.
              </>
            ) : (
              <>
                Vuelve a entrar a <span className="login-resaltado">tu cuenta</span>.
              </>
            )}
          </h1>
          <p className="login-subtitulo">
            {token
              ? "Elige una contraseña nueva de al menos 8 caracteres."
              : "Escribe el correo con el que te dieron de alta y te enviaremos un enlace."}
          </p>
        </div>
        <p className="login-marca-pie">Intermediación de soporte técnico</p>
      </aside>

      <div className="login-acceso">
        <div className="login-tema">
          <BotonTema />
        </div>
        <section className="login-tarjeta">
          <div>
            <p className="login-kicker">{token ? "Nueva contraseña" : "Recuperación"}</p>
            <h2 className="login-titulo-acceso">
              {token ? "Restablece tu contraseña" : "¿Olvidaste tu contraseña?"}
            </h2>
            <p className="login-subtitulo">
              {token
                ? "Ingresa y confirma la nueva contraseña."
                : "Te enviaremos un enlace al correo registrado."}
            </p>
          </div>

          {token ? (
            <form className="login-form" onSubmit={confirmar}>
              <CampoContrasena
                id="recuperar-nueva"
                etiqueta="Nueva contraseña"
                valor={contrasena}
                onChange={setContrasena}
              />
              <CampoContrasena
                id="recuperar-repetir"
                etiqueta="Repite la contraseña"
                valor={repetir}
                onChange={setRepetir}
              />
              {error ? (
                <p className="error login-error" role="alert">
                  {error}
                </p>
              ) : null}
              {aviso ? (
                <p className="aviso login-error" role="status">
                  {aviso}
                </p>
              ) : null}
              <button type="submit" className="login-boton" disabled={enviando}>
                {enviando ? "Guardando…" : "Actualizar contraseña"}
                {enviando ? null : <LuArrowRight size={18} aria-hidden />}
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={pedir}>
              <div className="login-campo">
                <label className="login-etiqueta" htmlFor="recuperar-correo">
                  Correo
                </label>
                <div className="login-entrada">
                  <LuMail size={18} aria-hidden />
                  <input
                    id="recuperar-correo"
                    type="email"
                    autoComplete="email"
                    placeholder="correo@ejemplo.com"
                    required
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                  />
                </div>
              </div>
              {error ? (
                <p className="error login-error" role="alert">
                  {error}
                </p>
              ) : null}
              {aviso ? (
                <p className="aviso login-error" role="status">
                  {aviso}
                </p>
              ) : null}
              <button type="submit" className="login-boton" disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar enlace"}
                {enviando ? null : <LuArrowRight size={18} aria-hidden />}
              </button>
            </form>
          )}

          <p className="login-pie">
            <Link to="/">← Volver a iniciar sesión</Link>
          </p>
        </section>
      </div>
    </div>
  );
}

function CampoContrasena({
  id,
  etiqueta,
  valor,
  onChange,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div className="login-campo">
      <label className="login-etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <div className="login-entrada">
        <LuLock size={18} aria-hidden />
        <input
          id={id}
          type={ver ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••"
          required
          minLength={8}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="login-ojo"
          onClick={() => setVer((actual) => !actual)}
          aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {ver ? <LuEyeOff size={18} aria-hidden /> : <LuEye size={18} aria-hidden />}
        </button>
      </div>
    </div>
  );
}
