import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AdminTopbarContextValue = {
  acciones: ReactNode;
  setAcciones: (node: ReactNode) => void;
  volver: ReactNode;
  setVolver: (node: ReactNode) => void;
  titulo: string | null;
  setTitulo: (titulo: string | null) => void;
};

const AdminTopbarContext = createContext<AdminTopbarContextValue | null>(null);
/** Solo el setter (estable): quien lo consume no se re-renderiza cuando cambian las acciones. */
const AdminTopbarSetterContext = createContext<((node: ReactNode) => void) | null>(null);

export function AdminTopbarProvider({ children }: { children: ReactNode }) {
  const [acciones, setAcciones] = useState<ReactNode>(null);
  const [volver, setVolver] = useState<ReactNode>(null);
  const [titulo, setTitulo] = useState<string | null>(null);
  const value = useMemo(
    () => ({ acciones, setAcciones, volver, setVolver, titulo, setTitulo }),
    [acciones, volver, titulo],
  );
  return (
    <AdminTopbarSetterContext.Provider value={setAcciones}>
      <AdminTopbarContext.Provider value={value}>{children}</AdminTopbarContext.Provider>
    </AdminTopbarSetterContext.Provider>
  );
}

function useAdminTopbarCtx() {
  const ctx = useContext(AdminTopbarContext);
  if (!ctx) {
    throw new Error("Los hooks de topbar deben usarse dentro de AdminShell");
  }
  return ctx;
}

export function AdminTopbarIzq({ lugarPorDefecto }: { lugarPorDefecto: string }) {
  const ctx = useContext(AdminTopbarContext);
  const lugar = ctx?.titulo ?? lugarPorDefecto;
  return (
    <>
      {ctx?.volver ? <div className="admin-topbar-volver">{ctx.volver}</div> : null}
      <p className="admin-topbar-lugar">{lugar}</p>
    </>
  );
}

export function AdminTopbarAcciones() {
  const ctx = useContext(AdminTopbarContext);
  if (!ctx?.acciones) return null;
  return <div className="admin-topbar-der">{ctx.acciones}</div>;
}

/** Coloca acciones en la topbar del admin hasta salir de la vista. */
export function useAdminTopbarAcciones(acciones: ReactNode) {
  const { setAcciones } = useAdminTopbarCtx();
  useEffect(() => {
    setAcciones(acciones);
    return () => setAcciones(null);
  }, [acciones, setAcciones]);
}

/**
 * Como useAdminTopbarAcciones, pero tolera vivir fuera de AdminShell.
 * Devuelve true si las acciones quedaron en la topbar del admin.
 */
export function useAccionesEnTopbar(acciones: ReactNode): boolean {
  const setAcciones = useContext(AdminTopbarSetterContext);
  useEffect(() => {
    if (!setAcciones) return;
    setAcciones(acciones);
    return () => setAcciones(null);
  }, [acciones, setAcciones]);
  return setAcciones !== null;
}

/** Solo el título contextual en la topbar (p. ej. panel de control o inicio por rol). */
export function useAdminTopbarTitulo(titulo: string) {
  const { setTitulo } = useAdminTopbarCtx();
  useEffect(() => {
    setTitulo(titulo);
    return () => setTitulo(null);
  }, [titulo, setTitulo]);
}

/** Enlace de retorno y título contextual en la topbar (p. ej. ficha de usuario). */
export function useAdminTopbarContexto({
  volver,
  titulo,
}: {
  volver: ReactNode;
  titulo: string;
}) {
  const { setVolver, setTitulo } = useAdminTopbarCtx();
  useEffect(() => {
    setVolver(volver);
    setTitulo(titulo);
    return () => {
      setVolver(null);
      setTitulo(null);
    };
  }, [volver, titulo, setVolver, setTitulo]);
}