import type { UsuarioLista } from "../api";
import { etiquetaTipoPerfil, type PerfilGrupo } from "./usuarios-ficha";

export function hueDeId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return hash;
}

export function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function lugarCuenta(cuenta: UsuarioLista) {
  if (cuenta.tipo_cuenta === "administrador") return "Plataforma";
  if (cuenta.tipo_cuenta === "cliente") return "Cliente";
  if (cuenta.tipo_cuenta === "empresa") return cuenta.funcion === "tecnico" ? "Técnico" : "Administrativo";
  if (cuenta.tipo_cuenta === "negocio") return "Administrativo de campo";
  return cuenta.funcion === "tecnico" ? "Técnico" : "Administrativo";
}

export function nombrePerfilDeCuenta(cuenta: UsuarioLista) {
  if (cuenta.tipo_cuenta === "administrador") return "Plataforma";
  return cuenta.perfil_nombre;
}

export function PastillaEstadoCuenta({ cuenta }: { cuenta: UsuarioLista }) {
  if (cuenta.bloqueado) return <span className="pastilla pastilla-bloqueada">Bloqueada</span>;
  if (cuenta.baja_solicitada) return <span className="pastilla pastilla-baja">Baja pedida</span>;
  return null;
}

export function MarcasCelda({ cuenta }: { cuenta: UsuarioLista }) {
  if (cuenta.tipo_cuenta === "administrador") {
    return <span className="ausente">—</span>;
  }
  const celdas = [0, 1, 2].map((indice) => {
    const llena = indice < cuenta.conteo_marcas;
    const bloquea = cuenta.bloqueado && indice === 2 && llena;
    const clase = bloquea ? "marca marca-bloquea" : llena ? "marca marca-llena" : "marca";
    return <span key={indice} className={clase} />;
  });
  return (
    <span className="marcas-celda" data-marcas={cuenta.conteo_marcas}>
      <span className="marcas">{celdas}</span>
      <span className="marcas-razon num">
        {cuenta.conteo_marcas}
        <span>/3</span>
      </span>
    </span>
  );
}

export function CeldaPerfilListado({ cuenta, perfil }: { cuenta: UsuarioLista; perfil?: PerfilGrupo }) {
  if (cuenta.tipo_cuenta === "administrador") {
    return <span className="ausente">—</span>;
  }

  if (perfil?.forma === "empresa") {
    return (
      <span className="perfil-celda-doble">
        <span className="perfil-empresa-nombre">{perfil.nombre}</span>
        <span className="perfil-tipo">{etiquetaTipoPerfil(perfil.tipo)}</span>
      </span>
    );
  }

  const titulo = perfil?.nombre ?? nombrePerfilDeCuenta(cuenta);
  const tipo = perfil ? etiquetaTipoPerfil(perfil.tipo) : "—";

  return (
    <span className="perfil-celda-doble">
      <span className="perfil-celda-nombre">{titulo}</span>
      <span className="perfil-tipo">{tipo}</span>
    </span>
  );
}

export type ModoFilaCuenta = "listado" | "mismo-perfil";

export function FilaCuentaTabla({
  cuenta,
  perfil,
  onAbrir,
  seleccionId,
  modo = "listado",
}: {
  cuenta: UsuarioLista;
  perfil?: PerfilGrupo;
  onAbrir: (id: string) => void;
  seleccionId?: string | null;
  modo?: ModoFilaCuenta;
}) {
  const seleccionada = seleccionId != null && cuenta.id === seleccionId;

  return (
    <tr
      tabIndex={0}
      aria-selected={seleccionada ? true : undefined}
      onClick={() => onAbrir(cuenta.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir(cuenta.id);
        }
      }}
    >
      <td className="cuenta-col">
        <div className="cuenta">
          <span className="avatar" style={{ ["--h" as string]: hueDeId(cuenta.id) }}>
            {iniciales(cuenta.nombre)}
          </span>
          <span className="cuenta-texto">
            <span className="cuenta-nombre">
              {cuenta.nombre}
              <PastillaEstadoCuenta cuenta={cuenta} />
            </span>
            <span className="cuenta-meta">{cuenta.correo}</span>
          </span>
        </div>
      </td>
      <td className="lugar-col">{lugarCuenta(cuenta)}</td>
      {modo === "listado" ? (
        <td className="perfil-col">
          <CeldaPerfilListado cuenta={cuenta} perfil={perfil} />
        </td>
      ) : null}
      <td className="marcas-col">
        <MarcasCelda cuenta={cuenta} />
      </td>
      {modo === "listado" ? (
        <td className="alta-col num">
          <span className="ausente" title="La API aún no expone fecha de alta en el listado">
            —
          </span>
        </td>
      ) : null}
    </tr>
  );
}