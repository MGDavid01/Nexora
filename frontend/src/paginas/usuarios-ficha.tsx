import { type FormEvent, useEffect, useState } from "react";
import {
  codigosMarcaPara,
  editarUsuarioAdmin,
  ETIQUETAS_MARCA,
  registrarMarca,
  desbloquearUsuarioAdmin,
  procesarBajaPerfilAdmin,
  type FuncionProveedor,
  type Marca,
  type TipoCuenta,
  type UsuarioDetalle,
  type UsuarioLista,
} from "../api";
import { digitos, texto, validarContrasenaOpcional } from "../validarAlta";

export type TipoPerfil = "cliente" | "proveedor" | "plataforma";

export type PerfilGrupo = {
  id: string;
  nombre: string;
  tipo: TipoPerfil;
  forma: "persona" | "empresa";
  bloqueado: boolean;
  baja: boolean;
  conteo_marcas: number;
  usuarios: UsuarioLista[];
};

export const ID_PLATAFORMA = "plataforma";

export function agruparPerfiles(cuentas: UsuarioLista[]): PerfilGrupo[] {
  const map = new Map<string, PerfilGrupo>();
  const admins: UsuarioLista[] = [];

  for (const cuenta of cuentas) {
    if (cuenta.tipo_cuenta === "administrador") {
      admins.push(cuenta);
      continue;
    }
    const id = (cuenta.perfil_cliente_id ?? cuenta.perfil_proveedor_id)!;
    let grupo = map.get(id);
    if (!grupo) {
      const tipo: TipoPerfil =
        cuenta.tipo_cuenta === "cliente"
          ? "cliente"
          : cuenta.tipo_cuenta === "empresa" || cuenta.tipo_cuenta === "negocio" || cuenta.tipo_cuenta === "proveedor"
            ? "proveedor"
            : "proveedor";
      grupo = {
        id,
        nombre: cuenta.perfil_nombre,
        tipo,
        forma: "empresa",
        bloqueado: cuenta.bloqueado,
        baja: cuenta.baja_solicitada,
        conteo_marcas: cuenta.conteo_marcas,
        usuarios: [],
      };
      map.set(id, grupo);
    }
    grupo.usuarios.push(cuenta);
    grupo.bloqueado = grupo.bloqueado || cuenta.bloqueado;
    grupo.baja = grupo.baja || cuenta.baja_solicitada;
  }

  for (const grupo of map.values()) {
    if (grupo.tipo === "cliente" && grupo.usuarios.length === 1 && grupo.usuarios[0].perfil_nombre === "Persona") {
      grupo.forma = "persona";
      grupo.nombre = grupo.usuarios[0].nombre;
    }
  }

  const lista = [...map.values()];
  if (admins.length > 0) {
    lista.push({
      id: ID_PLATAFORMA,
      nombre: "Nexora",
      tipo: "plataforma",
      forma: "empresa",
      bloqueado: false,
      baja: admins.some((a) => a.baja_solicitada),
      conteo_marcas: 0,
      usuarios: admins.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    });
  }

  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export function perfilDeCuenta(perfiles: PerfilGrupo[], cuenta: UsuarioLista | null): PerfilGrupo | null {
  if (!cuenta) return null;
  return (
    perfiles.find((p) => p.usuarios.some((u) => u.id === cuenta.id)) ??
    (cuenta.tipo_cuenta === "administrador" ? perfiles.find((p) => p.id === ID_PLATAFORMA) ?? null : null)
  );
}

export function FichaCuenta({
  detalle,
  perfil,
  onVolver,
  onActualizado,
  compacto = false,
  editando = false,
  onCerrarEdicion,
  ocultarMarcas = false,
  ocultarAccionesPerfil = false,
  ocultarCabecera = false,
}: {
  detalle: UsuarioDetalle;
  perfil: PerfilGrupo;
  onVolver: () => void;
  onActualizado: (d: UsuarioDetalle) => Promise<void>;
  compacto?: boolean;
  editando?: boolean;
  onCerrarEdicion?: () => void;
  ocultarMarcas?: boolean;
  ocultarAccionesPerfil?: boolean;
  ocultarCabecera?: boolean;
}) {
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const est = estadoPerfil(perfil);

  useEffect(() => {
    setError("");
    setAviso("");
  }, [detalle.id, editando]);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError("");
    setAviso("");
    const formulario = new FormData(evento.currentTarget);
    const funcion = texto(formulario.get("funcion")) as FuncionProveedor | "";
    const contrasena = String(formulario.get("contrasena") ?? "");
    const falloContrasena = validarContrasenaOpcional(contrasena);
    if (falloContrasena) {
      setError(falloContrasena);
      return;
    }
    setEnviando(true);
    try {
      const payload: Parameters<typeof editarUsuarioAdmin>[1] = {
        nombre: texto(formulario.get("nombre")),
        correo: texto(formulario.get("correo")).toLowerCase(),
        telefono: digitos(formulario.get("telefono")),
      };
      if (detalle.tipo_cuenta === "proveedor" || detalle.tipo_cuenta === "empresa") {
        payload.funcion = funcion as FuncionProveedor;
      }
      if (contrasena) payload.contrasena = contrasena;
      const siguiente = await editarUsuarioAdmin(detalle.id, payload);
      setAviso("Cuenta actualizada.");
      await onActualizado(siguiente);
      onCerrarEdicion?.();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo guardar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {ocultarCabecera ? null : compacto ? (
        <p className="crm-meta cuenta-meta-compacta" aria-hidden>
          {rolDe(detalle, perfil)} · {perfil.nombre} ·{" "}
          <span className={`pastilla pastilla-${est.cls === "critico" ? "bloqueada" : est.cls === "alerta" ? "baja" : "positiva"}`}>
            {est.txt}
          </span>
        </p>
      ) : (
        <header className="ficha-top">
          <div>
            <h2>{detalle.nombre}</h2>
            <p className="crm-meta">
              {rolDe(detalle, perfil)} · {perfil.nombre} ·{" "}
              <span className={`pill-estado ${est.cls}`}>{est.txt}</span>
            </p>
          </div>
          <button type="button" className="volver-crm" onClick={onVolver}>
            {perfil.forma === "empresa" ? "← Volver a la empresa" : "← Volver al padrón"}
          </button>
        </header>
      )}

      {editando ? (
        <form className="cuenta-form-edicion" onSubmit={(e) => void guardar(e)} key={`editar-${detalle.id}`}>
          <label className="campo-crm">
            Nombre
            <input name="nombre" required defaultValue={detalle.nombre} autoComplete="off" />
          </label>
          <label className="campo-crm">
            Correo
            <input name="correo" type="email" required defaultValue={detalle.correo} autoComplete="off" />
          </label>
          <label className="campo-crm">
            Teléfono
            <input name="telefono" required inputMode="numeric" defaultValue={detalle.telefono} autoComplete="off" />
          </label>
          {detalle.tipo_cuenta === "proveedor" || detalle.tipo_cuenta === "empresa" ? (
            <label className="campo-crm">
              Función
              <select name="funcion" defaultValue={detalle.funcion ?? "administrativo"}>
                <option value="administrativo">Administrativo</option>
                <option value="tecnico">Técnico</option>
              </select>
            </label>
          ) : null}
          <label className="campo-crm">
            Contraseña nueva
            <input
              name="contrasena"
              type="password"
              autoComplete="new-password"
              placeholder="Dejar en blanco para no cambiar"
            />
          </label>
          <div className="cuenta-form-acciones">
            {onCerrarEdicion ? (
              <button type="button" className="btn-crm" onClick={onCerrarEdicion} disabled={enviando}>
                Cancelar
              </button>
            ) : null}
            <button type="submit" className="btn-crm btn-crm-principal" disabled={enviando}>
              {enviando ? "Guardando…" : "Guardar cuenta"}
            </button>
          </div>
        </form>
      ) : (
        <dl className="props-crm cuenta-datos-lectura">
          <dt>Nombre</dt>
          <dd>{detalle.nombre}</dd>
          <dt>Correo</dt>
          <dd>{detalle.correo}</dd>
          <dt>Teléfono</dt>
          <dd>{formatearTelefono(detalle.telefono)}</dd>
          <dt>Función</dt>
          <dd>{etiquetaFuncion(detalle.funcion)}</dd>
          <dt>Marcas</dt>
          <dd>{detalle.tipo_cuenta === "administrador" ? "—" : `${detalle.conteo_marcas}/3`}</dd>
        </dl>
      )}

      {ocultarAccionesPerfil ? null : perfil.bloqueado ? (
        <p className="padron-acciones-form">
          <button
            type="button"
            className="btn-crm"
            onClick={() =>
              void desbloquearUsuarioAdmin(detalle.id)
                .then(onActualizado)
                .then(() => setAviso("Perfil desbloqueado."))
                .catch((causa) => setError(causa instanceof Error ? causa.message : "No se pudo desbloquear"))
            }
          >
            Desbloquear perfil
          </button>
        </p>
      ) : null}
      {ocultarAccionesPerfil ? null : perfil.baja ? (
        <p className="padron-acciones-form">
          <button
            type="button"
            className="btn-crm btn-crm-principal"
            onClick={() => {
              if (!window.confirm("¿Procesar la baja de perfil?")) return;
              void procesarBajaPerfilAdmin(detalle.id)
                .then(onActualizado)
                .then(() => setAviso("Baja procesada."))
                .catch((causa) => setError(causa instanceof Error ? causa.message : "No se pudo procesar"));
            }}
          >
            Procesar baja de perfil
          </button>
        </p>
      ) : null}

      {editando || ocultarMarcas ? null : <BloqueMarcas detalle={detalle} onActualizado={onActualizado} />}
      {error ? <p className="error-crm">{error}</p> : null}
      {aviso ? <p className="aviso-crm">{aviso}</p> : null}
    </>
  );
}

export function BloqueMarcas({
  detalle,
  onActualizado,
  compacto = false,
}: {
  detalle: UsuarioDetalle;
  onActualizado: (d: UsuarioDetalle) => Promise<void>;
  compacto?: boolean;
}) {
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [abriendoMarca, setAbriendoMarca] = useState(false);
  const codigosMarca = codigosMarcaPara(detalle.tipo_cuenta);

  useEffect(() => {
    setAbriendoMarca(false);
    setError("");
    setAviso("");
  }, [detalle.id]);

  if (detalle.tipo_cuenta === "administrador") {
    return <p className="crm-meta">Un administrador de plataforma no acumula marcas.</p>;
  }

  async function marcar(formulario: HTMLFormElement) {
    setError("");
    setAviso("");
    const form = new FormData(formulario);
    const datos = {
      tipo: texto(form.get("tipo")) as "advertencia" | "sancion",
      codigo: texto(form.get("codigo")),
      descripcion: texto(form.get("descripcion")),
    };
    if (!datos.codigo) {
      setError("Elige una causa del catálogo");
      return;
    }
    if (!datos.descripcion) {
      setError("La descripción es obligatoria");
      return;
    }
    setEnviando(true);
    try {
      const siguiente = await registrarMarca(detalle.id, datos);
      formulario.reset();
      setAbriendoMarca(false);
      setAviso(
        siguiente.bloqueado
          ? "Marca registrada. El perfil quedó bloqueado. Deben contactar a equipo Nexora."
          : "Marca registrada. El perfil recibirá aviso de equipo Nexora; no bloquea todavía.",
      );
      await onActualizado(siguiente);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo registrar la marca");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="cuenta-marcas" aria-label="Marcas del perfil">
      <div className={compacto ? "cuenta-marcas-cab cuenta-marcas-cab-compacta" : "cuenta-marcas-cab"}>
        {compacto ? null : <h3 className="cuenta-marcas-titulo">Marcas del perfil</h3>}
        {detalle.bloqueado || abriendoMarca ? null : (
          <button type="button" className="btn-crm" onClick={() => setAbriendoMarca(true)}>
            Registrar marca
          </button>
        )}
      </div>
      <VisualMarcas
        marcas={detalle.marcas}
        perfilNombre={detalle.perfil_nombre}
        bloqueado={detalle.bloqueado}
        compacto={compacto}
      />
      {abriendoMarca && !detalle.bloqueado ? (
        <form
          className="cuenta-form-marca"
          onSubmit={(e) => {
            e.preventDefault();
            void marcar(e.currentTarget);
          }}
        >
          <label className="campo-crm">
            Tipo
            <select name="tipo" defaultValue="advertencia">
              <option value="advertencia">Advertencia</option>
              <option value="sancion">Sanción</option>
            </select>
          </label>
          <label className="campo-crm">
            Causa
            <select name="codigo" required defaultValue="">
              <option value="" disabled>
                Elige del catálogo…
              </option>
              {codigosMarca.map((codigo) => (
                <option key={codigo} value={codigo}>
                  {detalle.marcas.some((m) => m.codigo === codigo)
                    ? `${ETIQUETAS_MARCA[codigo]} (ya registrada)`
                    : ETIQUETAS_MARCA[codigo]}
                </option>
              ))}
            </select>
          </label>
          <label className="campo-crm">
            Descripción
            <textarea name="descripcion" required rows={3} autoComplete="off" placeholder="Detalle visible para el perfil" />
          </label>
          <div className="cuenta-form-acciones">
            <button type="button" className="btn-crm" onClick={() => setAbriendoMarca(false)} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" className="btn-crm btn-crm-principal" disabled={enviando}>
              {enviando ? "Registrando…" : "Registrar marca"}
            </button>
          </div>
        </form>
      ) : null}
      {error ? <p className="error-crm">{error}</p> : null}
      {aviso ? <p className="aviso-crm">{aviso}</p> : null}
    </section>
  );
}

function VisualMarcas({
  marcas,
  perfilNombre,
  bloqueado,
  compacto = false,
}: {
  marcas: Marca[];
  perfilNombre: string;
  bloqueado: boolean;
  compacto?: boolean;
}) {
  return (
    <>
      <div className="casillas-marcas" data-marcas={marcas.length} aria-label={`${marcas.length} de 3 marcas`}>
        {[0, 1, 2].map((i) => {
          const m = marcas[i];
          const cls = m ? `casilla llena${m.tipo === "sancion" ? " sancion" : ""}` : "casilla";
          const titulo = m
            ? `${m.tipo === "advertencia" ? "Advertencia" : "Sanción"}: ${m.etiqueta}`
            : `Marca ${i + 1} vacía`;
          return <span key={i} className={cls} title={titulo} />;
        })}
      </div>
      <p className="crm-meta">
        {compacto
          ? `${marcas.length} de 3. A la tercera se bloquean todas las cuentas del perfil.`
          : `${marcas.length} de 3. Las marcas son del perfil ${perfilNombre}. A la tercera se bloquean todos sus usuarios.`}
        {bloqueado ? " Este perfil está bloqueado." : ""}
      </p>
      {marcas.map((m) => (
        <article key={m.id} className="marca-item">
          <strong>{m.tipo === "advertencia" ? "Advertencia" : "Sanción"}</strong>
          <span>
            {m.etiqueta}: {m.descripcion}
          </span>
        </article>
      ))}
    </>
  );
}

export function RielFichaPerfil({
  perfil,
  cuentaActiva,
  seleccionId,
  onSeleccionar,
  onAltaMiembroPlaceholder,
  mostrarListado = true,
}: {
  perfil: PerfilGrupo | null;
  cuentaActiva: UsuarioLista | null;
  seleccionId: string | null;
  onSeleccionar: (id: string) => void;
  onAltaMiembroPlaceholder: () => void;
  mostrarListado?: boolean;
}) {
  if (!perfil || !cuentaActiva) {
    return <p className="vacio">Selecciona una cuenta del directorio para ver su ficha.</p>;
  }

  if (perfil.tipo === "plataforma") {
    const admins = perfil.usuarios;
    return (
      <>
        <div className="ficha-cabecera">
          <div>
            <h3 className="ficha-nombre">{cuentaActiva.nombre}</h3>
            <p className="ficha-sub">Administrador de plataforma · Sin perfil cliente ni proveedor</p>
          </div>
          <span className="pastilla pastilla-acento">Plataforma</span>
        </div>
        <div className="escalera-box">
          <div className="escalera-tope">
            <span>Régimen de sanciones</span>
            <span>No aplica</span>
          </div>
          <p className="escalera-nota">
            Las cuentas de administración supervisan usuarios, proveedores y trabajos. No acumulan marcas de perfil.
          </p>
        </div>
        <dl className="ficha-datos">
          <div className="ficha-par">
            <dt>Correo y teléfono</dt>
            <dd>
              {cuentaActiva.correo} · <span className="num">{formatearTelefono(cuentaActiva.telefono)}</span>
            </dd>
          </div>
        </dl>
        {mostrarListado ? (
          <>
            <div className="ficha-cuentas-cab">
              <span className="ficha-cuentas-titulo">Cuentas de plataforma ({admins.length})</span>
            </div>
            <div className="lista-filas">
              {admins.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="fila-compacta fila-compacta-boton"
                  aria-current={item.id === seleccionId}
                  onClick={() => onSeleccionar(item.id)}
                >
                  <span className="fila-compacta-izq">
                    <span className="fila-compacta-nombre">{item.nombre}</span>
                    <span className="fila-compacta-sub">{item.correo}</span>
                  </span>
                  <span className="pastilla">Admin</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </>
    );
  }

  const tramos = [0, 1, 2].map((indice) => {
    const activo = indice < perfil.conteo_marcas;
    const clase =
      perfil.bloqueado && activo ? "escalera-tramo bloqueo" : activo ? "escalera-tramo activo" : "escalera-tramo";
    return <span key={indice} className={clase} />;
  });
  const est = estadoPerfil(perfil);
  const pastillaEstado = perfil.bloqueado
    ? "pastilla pastilla-bloqueada"
    : perfil.baja
      ? "pastilla pastilla-baja"
      : "pastilla pastilla-acento";

  return (
    <>
      <div className="ficha-cabecera">
        <div>
          <h3 className="ficha-nombre">{perfil.nombre}</h3>
          <p className="ficha-sub">
            {etiquetaTipoPerfil(perfil.tipo)} ({perfil.forma === "empresa" ? "empresa" : "persona"}) ·{" "}
            {perfil.usuarios.length === 1 ? "1 cuenta ligada" : `${perfil.usuarios.length} cuentas ligadas`}
          </p>
        </div>
        <span className={pastillaEstado}>
          {est.txt === "Activo" ? `${etiquetaTipoPerfil(perfil.tipo)} · ${perfil.forma === "empresa" ? "Empresa" : "Persona"}` : est.txt}
        </span>
      </div>
      <div className={`escalera-box${perfil.bloqueado ? " es-bloqueado" : ""}`}>
        <div className="escalera-tope">
          <span>Escalera de sanciones</span>
          <span className="num">{perfil.conteo_marcas} /3 marcas</span>
        </div>
        <div className="escalera-pista" role="img" aria-label={`${perfil.conteo_marcas} de 3 marcas`}>
          {tramos}
        </div>
        <div className="escalera-extremos">
          <span>0 marcas</span>
          <span>3 · bloqueo del perfil</span>
        </div>
        <p className="escalera-nota">
          Las marcas son del perfil. A la tercera se bloquean todos sus usuarios.
          {perfil.bloqueado ? " Este perfil está bloqueado." : ""}
        </p>
      </div>
      <dl className="ficha-datos">
        <div className="ficha-par">
          <dt>Regla del perfil</dt>
          <dd>
            {perfil.tipo === "cliente"
              ? "Un perfil cliente tiene un solo usuario y no puede pertenecer a un proveedor."
              : "Los usuarios del proveedor comparten marcas y bloqueo del perfil."}
          </dd>
        </div>
      </dl>
      {mostrarListado ? (
        <>
          <div className="ficha-cuentas-cab">
            <span className="ficha-cuentas-titulo">Cuentas en esta ficha ({perfil.usuarios.length})</span>
            {perfil.tipo === "proveedor" && !perfil.bloqueado ? (
              <button type="button" className="btn btn-acento-suave" onClick={onAltaMiembroPlaceholder}>
                Sumar cuenta
              </button>
            ) : null}
          </div>
          <div className="lista-filas">
            {perfil.usuarios.map((item) => (
              <button
                key={item.id}
                type="button"
                className="fila-compacta fila-compacta-boton"
                aria-current={item.id === seleccionId}
                onClick={() => onSeleccionar(item.id)}
              >
                <span className="fila-compacta-izq">
                  <span className="fila-compacta-nombre">{item.nombre}</span>
                  <span className="fila-compacta-sub">
                    {item.correo}
                    {item.telefono ? ` · ${formatearTelefono(item.telefono)}` : ""}
                  </span>
                </span>
                <span className="pastilla">{rolDe(item, perfil)}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

export function textoEstadoPerfil(perfil: PerfilGrupo) {
  if (perfil.bloqueado) return "Bloqueado";
  if (perfil.baja) return "Baja solicitada";
  return "Operando";
}

export function estadoPerfil(p: PerfilGrupo) {
  if (p.bloqueado) return { txt: "Bloqueado", cls: "critico" as const };
  if (p.baja) return { txt: "Baja solicitada", cls: "alerta" as const };
  return { txt: "Activo", cls: "ok" as const };
}

export function etiquetaTipoPerfil(tipo: TipoPerfil) {
  if (tipo === "cliente") return "Cliente";
  if (tipo === "proveedor") return "Proveedor";
  return "Plataforma";
}

export function rolDe(
  cuenta: { tipo_cuenta: TipoCuenta; funcion: FuncionProveedor | null },
  perfil?: PerfilGrupo | null,
) {
  if (perfil?.tipo === "plataforma" || cuenta.tipo_cuenta === "administrador") return "Administrador";
  if (cuenta.tipo_cuenta === "cliente") return "Cliente";
  return cuenta.funcion === "tecnico" ? "Técnico" : "Administrativo";
}

export function etiquetaFuncion(funcion: FuncionProveedor | null) {
  if (funcion === "tecnico") return "Técnico";
  if (funcion === "administrativo") return "Administrativo";
  if (funcion === "administrativo_campo") return "Administrativo de campo";
  return "—";
}

export function formatearTelefono(tel: string) {
  const limpio = tel.replace(/\D+/g, "");
  if (limpio.length !== 10) return tel;
  return `${limpio.slice(0, 3)} ${limpio.slice(3, 6)} ${limpio.slice(6)}`;
}
