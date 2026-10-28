import { type FormEvent, type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Ubicacion, type Usuario } from "../api";
import { validarAlta, type PerfilAlta } from "../validarAlta";

type Props = {
  titulo: string;
  texto: string;
  ruta: string;
  perfil: PerfilAlta;
  children: ReactNode;
  armar: (formulario: FormData) => Record<string, unknown>;
};

export function FormularioRegistro({ titulo, texto, ruta, perfil, children, armar }: Props) {
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError("");
    setAviso("");
    const formulario = evento.currentTarget;
    const datos = armar(new FormData(formulario));
    const fallo = validarAlta(datos, perfil);
    if (fallo) {
      setError(fallo);
      return;
    }
    setEnviando(true);
    try {
      const creado = await api<Usuario>(ruta, { method: "POST", body: JSON.stringify(datos) });
      formulario.reset();
      setAviso(`${creado.nombre} ya puede entrar con ${creado.correo} y la contraseña que definiste.`);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo registrar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="panel">
      <h1>{titulo}</h1>
      <p className="ayuda">{texto}</p>
      <form autoComplete="off" onSubmit={onSubmit}>
        {children}
        <CamposCuenta />
        <CamposUbicacion />
        {error ? <p className="error">{error}</p> : null}
        {aviso ? <p className="aviso">{aviso}</p> : null}
        <button type="submit" disabled={enviando}>
          {enviando ? "Registrando…" : "Registrar"}
        </button>
      </form>
      <p className="pie-form">
        <Link to="/inicio">Volver al inicio</Link>
      </p>
    </section>
  );
}

export function ubicacionDe(formulario: FormData): Ubicacion {
  return {
    calle_numero: String(formulario.get("calle_numero") ?? "").trim(),
    colonia: String(formulario.get("colonia") ?? "").trim(),
    ciudad: String(formulario.get("ciudad") ?? "").trim(),
    estado: String(formulario.get("estado") ?? "").trim(),
    codigo_postal: String(formulario.get("codigo_postal") ?? "").trim(),
  };
}

function CamposCuenta() {
  return (
    <>
      <label>
        Nombre de la persona
        <input name="nombre" required autoComplete="off" />
      </label>
      <label>
        Correo
        <input name="correo" type="email" required autoComplete="off" />
      </label>
      <label>
        Contraseña inicial
        <input name="contrasena" type="password" required minLength={8} autoComplete="new-password" />
        <span className="pista">Mínimo 8 caracteres. Se la entregas a quien va a entrar.</span>
      </label>
      <label>
        Teléfono
        <input name="telefono" required inputMode="numeric" autoComplete="off" placeholder="10 dígitos" />
      </label>
    </>
  );
}

function CamposUbicacion() {
  return (
    <fieldset>
      <legend>Ubicación</legend>
      <label>
        Calle y número
        <input name="calle_numero" required autoComplete="off" />
      </label>
      <label>
        Colonia
        <input name="colonia" required autoComplete="off" />
      </label>
      <div className="fila">
        <label>
          Ciudad
          <input name="ciudad" required autoComplete="off" />
        </label>
        <label>
          Estado
          <input name="estado" required autoComplete="off" />
        </label>
      </div>
      <label>
        Código postal
        <input name="codigo_postal" required inputMode="numeric" maxLength={5} placeholder="22000" autoComplete="off" />
      </label>
    </fieldset>
  );
}
