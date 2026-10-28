import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Tema = "claro" | "oscuro";

const CLAVE = "nexora-tema";

type ContextoTema = {
  tema: Tema;
  alternar: () => void;
  fijar: (tema: Tema) => void;
};

const Contexto = createContext<ContextoTema | null>(null);

function preferenciaSistema(): Tema {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "oscuro"
    : "claro";
}

function leerTemaInicial(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === "claro" || guardado === "oscuro") return guardado;
  } catch {
    /* sin localStorage */
  }
  return preferenciaSistema();
}

function aplicarTema(tema: Tema) {
  document.documentElement.dataset.tema = tema;
  document.documentElement.style.colorScheme = tema === "oscuro" ? "dark" : "light";
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => {
    const inicial = leerTemaInicial();
    aplicarTema(inicial);
    return inicial;
  });

  useEffect(() => {
    aplicarTema(tema);
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      /* sin localStorage */
    }
  }, [tema]);

  function fijar(siguiente: Tema) {
    setTema(siguiente);
  }

  function alternar() {
    setTema((actual) => (actual === "oscuro" ? "claro" : "oscuro"));
  }

  return (
    <Contexto.Provider value={{ tema, alternar, fijar }}>{children}</Contexto.Provider>
  );
}

export function useTema(): ContextoTema {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useTema debe usarse dentro de TemaProvider");
  return valor;
}
