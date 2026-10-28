import { useEffect, useRef, useState } from "react";
import { LuLogOut } from "react-icons/lu";
import { NavLink } from "react-router-dom";
import type { Usuario } from "./api";
import { BotonTema } from "./BotonTema";
import { herramientasDe } from "./herramientas";
import { useSesion } from "./sesion";

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "");
  return letras.join("") || "N";
}

export function Barra({ usuario }: { usuario: Usuario }) {
  const { salir, cerrarCuenta } = useSesion();
  const entradas = herramientasDe(usuario);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const cuenta = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function alPulsar(evento: PointerEvent) {
      if (!cuenta.current?.contains(evento.target as Node)) setAbierto(false);
    }
    function alTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAbierto(false);
    }
    document.addEventListener("pointerdown", alPulsar);
    document.addEventListener("keydown", alTeclar);
    return () => {
      document.removeEventListener("pointerdown", alPulsar);
      document.removeEventListener("keydown", alTeclar);
    };
  }, [abierto]);

  async function onBaja() {
    if (!window.confirm("La cuenta dejará de poder entrar. ¿Continuar?")) return;
    setError("");
    setCerrando(true);
    try {
      await cerrarCuenta();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo dar de baja");
      setCerrando(false);
    }
  }

  return (
    <nav className="barra-flotante" aria-label="Herramientas">
      <ul className="barra-nav">
        {entradas.map((entrada) => {
          const Icono = entrada.icono;
          return (
            <li key={entrada.to}>
              <NavLink to={entrada.to} end title={entrada.etiqueta} aria-label={entrada.etiqueta}>
                <Icono size={20} aria-hidden />
              </NavLink>
            </li>
          );
        })}
      </ul>
      <div className="barra-cuenta" ref={cuenta}>
        <BotonTema />
        <button type="button" onClick={salir} aria-label="Salir" title="Salir">
          <LuLogOut size={20} aria-hidden />
        </button>
        <button
          type="button"
          className="barra-avatar"
          aria-haspopup="menu"
          aria-expanded={abierto}
          aria-label={`Cuenta de ${usuario.nombre}`}
          title={usuario.nombre}
          onClick={() => setAbierto((actual) => !actual)}
        >
          {iniciales(usuario.nombre)}
        </button>
        {abierto ? (
          <div className="menu-cuenta" role="menu">
            <p className="menu-nombre">{usuario.nombre}</p>
            <p className="menu-correo">{usuario.correo}</p>
            {error ? <p className="error">{error}</p> : null}
            <button type="button" role="menuitem" disabled={cerrando} onClick={onBaja}>
              {cerrando ? "Cerrando…" : "Dar de baja la cuenta"}
            </button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
