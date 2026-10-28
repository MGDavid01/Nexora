import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { baja, borrarToken, guardarToken, leerToken, login, yo, type Usuario } from "./api";

type Sesion = {
  usuario: Usuario | null;
  listo: boolean;
  entrar: (correo: string, contrasena: string) => Promise<void>;
  salir: () => void;
  cerrarCuenta: () => Promise<void>;
  recargar: () => Promise<void>;
};

const Contexto = createContext<Sesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [listo, setListo] = useState(false);

  async function recargar() {
    if (!leerToken()) {
      setUsuario(null);
      return;
    }
    try {
      setUsuario(await yo());
    } catch {
      borrarToken();
      setUsuario(null);
    }
  }

  useEffect(() => {
    recargar().finally(() => setListo(true));
  }, []);

  async function entrar(correo: string, contrasena: string) {
    const token = await login(correo, contrasena);
    guardarToken(token.access_token);
    setUsuario(await yo());
  }

  function salir() {
    borrarToken();
    setUsuario(null);
  }

  async function cerrarCuenta() {
    await baja();
    salir();
  }

  return (
    <Contexto.Provider value={{ usuario, listo, entrar, salir, cerrarCuenta, recargar }}>
      {children}
    </Contexto.Provider>
  );
}

export function useSesion(): Sesion {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useSesion debe usarse dentro de SesionProvider");
  return valor;
}
