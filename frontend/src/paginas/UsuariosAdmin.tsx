import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  api,
  editarUsuarioAdmin,
  listarUsuariosAdmin,
  obtenerUsuarioAdmin,
  registrarAdministrador,
  registrarMarca,
  type FuncionProveedor,
  type TipoCuenta,
  type UsuarioDetalle,
  type UsuarioLista,
} from "../api";
import { digitos, texto, validarAlta } from "../validarAlta";
import { CamposCuenta, CamposUbicacion, ubicacionDe } from "./FormularioRegistro";

type Panel = "lista" | "cliente" | "proveedor" | "administrador";

export function UsuariosAdmin() {
  const [cuentas, setCuentas] = useState<UsuarioLista[]>([]);
  const [detalle, setDetalle] = useState<UsuarioDetalle | null>(null);
  const [panel, setPanel] = useState<Panel>("lista");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function recargar(seleccion?: string) {
    const lista = await listarUsuariosAdmin();
    setCuentas(lista);
    const id = seleccion ?? detalle?.id;
    if (id && lista.some((cuenta) => cuenta.id === id)) {
      setDetalle(await obtenerUsuarioAdmin(id));
      setPanel("lista");
    }
  }

  useEffect(() => {
    let vivo = true;
    listarUsuariosAdmin()
      .then((lista) => {
        if (vivo) setCuentas(lista);
      })
      .catch((causa) => {
        if (vivo) setError(causa instanceof Error ? causa.message : "No se pudieron cargar las cuentas");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function abrir(id: string) {
    setError("");
    setPanel("lista");
    try {
      setDetalle(await obtenerUsuarioAdmin(id));
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo abrir la cuenta");
    }
  }

  return (
    <section className="padron">
      <header className="padron-encabezado">
        <div>
          <h1>Usuarios</h1>
          <p>
            Padrón de cuentas. Desde aquí das de alta cliente, proveedor o administrador, editas nombre, correo,
            teléfono y función, y registras marcas del perfil ligado.
          </p>
        </div>
        <div className="padron-altas" role="group" aria-label="Dar de alta">
          <button type="button" className={panel === "cliente" ? undefined : "secundario"} onClick={() => setPanel("cliente")}>
            Cliente
          </button>
          <button type="button" className={panel === "proveedor" ? undefined : "secundario"} onClick={() => setPanel("proveedor")}>
            Proveedor
          </button>
          <button
            type="button"
            className={panel === "administrador" ? undefined : "secundario"}
            onClick={() => setPanel("administrador")}
          >
            Administrador
          </button>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className="padron-cuerpo">
        <section className="panel-dash padron-tabla" aria-labelledby="titulo-padron">
          <h2 id="titulo-padron">Cuentas</h2>
          {cargando ? (
            <div className="padron-esqueleto" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : cuentas.length === 0 ? (
            <p className="ayuda">Todavía no hay cuentas. Da de alta un cliente, un proveedor o un administrador.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Perfil</th>
                  <th scope="col">Marcas</th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map((cuenta) => {
                  const abierta = detalle?.id === cuenta.id && panel === "lista";
                  return (
                    <tr key={cuenta.id}>
                      <td>
                        <button
                          type="button"
                          className={abierta ? "padron-cuenta actual" : "padron-cuenta"}
                          onClick={() => void abrir(cuenta.id)}
                          aria-current={abierta ? "true" : undefined}
                        >
                          {cuenta.nombre}
                          <span>{cuenta.correo}</span>
                        </button>
                      </td>
                      <td>{rolDe(cuenta)}</td>
                      <td>
                        {cuenta.perfil_nombre}
                        {cuenta.bloqueado ? <span className="padron-marca">Bloqueado</span> : null}
                        {cuenta.baja_solicitada ? <span className="padron-marca">Baja</span> : null}
                      </td>
                      <td className="padron-num">{cuenta.tipo_cuenta === "administrador" ? "—" : `${cuenta.conteo_marcas}/3`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
        <aside className="padron-lado">
          {panel === "cliente" ? (
            <AltaCliente
              onCancelar={() => setPanel("lista")}
              onCreado={async (id) => {
                await recargar(id);
                await abrir(id);
              }}
            />
          ) : null}
          {panel === "proveedor" ? (
            <AltaProveedor
              onCancelar={() => setPanel("lista")}
              onCreado={async (id) => {
                await recargar(id);
                await abrir(id);
              }}
            />
          ) : null}
          {panel === "administrador" ? (
            <AltaAdministrador
              onCancelar={() => setPanel("lista")}
              onCreado={async (id) => {
                await recargar(id);
                await abrir(id);
              }}
            />
          ) : null}
          {panel === "lista" && detalle ? (
            <FichaCuenta
              detalle={detalle}
              onActualizado={async (siguiente) => {
                setDetalle(siguiente);
                setCuentas((previas) => previas.map((cuenta) => (cuenta.id === siguiente.id ? siguiente : cuenta)));
              }}
            />
          ) : null}
          {panel === "lista" && !detalle ? (
            <section className="panel-dash">
              <h2>Detalle</h2>
              <p className="ayuda">Elige una cuenta del padrón para verla, editarla o registrar una marca.</p>
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function rolDe(cuenta: { tipo_cuenta: TipoCuenta; funcion: FuncionProveedor | null }) {
  if (cuenta.tipo_cuenta === "cliente") return "Cliente";
  if (cuenta.tipo_cuenta === "administrador") return "Administrador";
  return cuenta.funcion === "tecnico" ? "Técnico" : "Administrativo";
}

function AltaCliente({ onCancelar, onCreado }: { onCancelar: () => void; onCreado: (id: string) => Promise<void> }) {
  return (
    <AltaFormulario
      titulo="Alta de cliente"
      texto="Crea el perfil y la única cuenta de esa persona o empresa."
      onCancelar={onCancelar}
      extra={
        <>
          <label>
            Tipo
            <select name="tipo" defaultValue="persona">
              <option value="persona">Persona</option>
              <option value="empresa">Empresa</option>
            </select>
          </label>
          <label>
            Nombre comercial
            <input name="nombre_comercial" autoComplete="off" />
            <span className="pista">Obligatorio si no es persona.</span>
          </label>
        </>
      }
      enviar={async (formulario) => {
        const datos = {
          nombre: texto(formulario.get("nombre")),
          correo: texto(formulario.get("correo")).toLowerCase(),
          contrasena: String(formulario.get("contrasena") ?? ""),
          telefono: digitos(formulario.get("telefono")),
          tipo: formulario.get("tipo"),
          nombre_comercial: texto(formulario.get("nombre_comercial")) || null,
          ubicacion: ubicacionDe(formulario),
        };
        const fallo = validarAlta(datos, "cliente");
        if (fallo) throw new Error(fallo);
        const creado = await api<{ id: string }>("/api/v1/admin/clientes", { method: "POST", body: JSON.stringify(datos) });
        await onCreado(creado.id);
      }}
    />
  );
}

function AltaProveedor({ onCancelar, onCreado }: { onCancelar: () => void; onCreado: (id: string) => Promise<void> }) {
  return (
    <AltaFormulario
      titulo="Alta de proveedor"
      texto="Crea el perfil. La primera cuenta queda como administrativa."
      onCancelar={onCancelar}
      extra={
        <>
          <label>
            Tipo
            <select name="tipo" defaultValue="empresa">
              <option value="persona">Persona</option>
              <option value="empresa">Empresa</option>
            </select>
          </label>
          <label>
            Nombre comercial o razón social
            <input name="nombre_comercial" required autoComplete="off" />
          </label>
          <label>
            Descripción de servicios
            <textarea name="descripcion" required rows={3} />
          </label>
          <label>
            Categorías
            <input name="categorias" required placeholder="Redes, mantenimiento" autoComplete="off" />
            <span className="pista">Separa con comas. Hace falta al menos una.</span>
          </label>
        </>
      }
      enviar={async (formulario) => {
        const datos = {
          nombre: texto(formulario.get("nombre")),
          correo: texto(formulario.get("correo")).toLowerCase(),
          contrasena: String(formulario.get("contrasena") ?? ""),
          telefono: digitos(formulario.get("telefono")),
          tipo: formulario.get("tipo"),
          nombre_comercial: texto(formulario.get("nombre_comercial")),
          descripcion: texto(formulario.get("descripcion")),
          categorias: String(formulario.get("categorias") ?? "")
            .split(",")
            .map((categoria) => categoria.trim())
            .filter(Boolean),
          ubicacion: ubicacionDe(formulario),
        };
        const fallo = validarAlta(datos, "proveedor");
        if (fallo) throw new Error(fallo);
        const creado = await api<{ id: string }>("/api/v1/admin/proveedores", { method: "POST", body: JSON.stringify(datos) });
        await onCreado(creado.id);
      }}
    />
  );
}

function AltaAdministrador({ onCancelar, onCreado }: { onCancelar: () => void; onCreado: (id: string) => Promise<void> }) {
  return (
    <AltaFormulario
      titulo="Alta de administrador"
      texto="Cuenta de plataforma. No queda ligada a un perfil cliente ni proveedor."
      onCancelar={onCancelar}
      conUbicacion={false}
      enviar={async (formulario) => {
        const datos = {
          nombre: texto(formulario.get("nombre")),
          correo: texto(formulario.get("correo")).toLowerCase(),
          contrasena: String(formulario.get("contrasena") ?? ""),
          telefono: digitos(formulario.get("telefono")),
        };
        if (!datos.nombre) throw new Error("El nombre es obligatorio");
        if (!datos.correo.includes("@")) throw new Error("El correo no es válido");
        if (datos.contrasena.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
        if (datos.telefono.length !== 10) throw new Error("El teléfono debe tener 10 dígitos");
        const creado = await registrarAdministrador(datos);
        await onCreado(creado.id);
      }}
    />
  );
}

function AltaFormulario({
  titulo,
  texto,
  extra,
  conUbicacion = true,
  onCancelar,
  enviar,
}: {
  titulo: string;
  texto: string;
  extra?: ReactNode;
  conUbicacion?: boolean;
  onCancelar: () => void;
  enviar: (formulario: FormData) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await enviar(new FormData(evento.currentTarget));
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo registrar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="panel-dash padron-ficha">
      <h2>{titulo}</h2>
      <p className="ayuda">{texto}</p>
      <form autoComplete="off" onSubmit={(evento) => void onSubmit(evento)}>
        {extra}
        <CamposCuenta />
        {conUbicacion ? <CamposUbicacion /> : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="padron-acciones-form">
          <button type="submit" disabled={enviando} onClick={(evento) => evento.stopPropagation()}>
            {enviando ? "Registrando…" : "Registrar"}
          </button>
          <button type="button" className="secundario" onClick={onCancelar}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

function FichaCuenta({
  detalle,
  onActualizado,
}: {
  detalle: UsuarioDetalle;
  onActualizado: (detalle: UsuarioDetalle) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [marcaEnviando, setMarcaEnviando] = useState(false);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError("");
    setAviso("");
    const formulario = new FormData(evento.currentTarget);
    const funcion = texto(formulario.get("funcion")) as FuncionProveedor | "";
    setEnviando(true);
    try {
      const siguiente = await editarUsuarioAdmin(detalle.id, {
        nombre: texto(formulario.get("nombre")),
        correo: texto(formulario.get("correo")).toLowerCase(),
        telefono: digitos(formulario.get("telefono")),
        funcion: detalle.tipo_cuenta === "proveedor" ? (funcion as FuncionProveedor) : null,
      });
      setAviso("Cuenta actualizada.");
      await onActualizado(siguiente);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo guardar");
    } finally {
      setEnviando(false);
    }
  }

  async function marcar(formulario: HTMLFormElement) {
    setError("");
    setAviso("");
    const datos = {
      tipo: texto(new FormData(formulario).get("tipo")) as "advertencia" | "sancion",
      causa: texto(new FormData(formulario).get("causa")),
    };
    if (!datos.causa) {
      setError("La causa es obligatoria");
      return;
    }
    setMarcaEnviando(true);
    try {
      const siguiente = await registrarMarca(detalle.id, datos);
      formulario.reset();
      setAviso(
        siguiente.bloqueado
          ? "Marca registrada. El perfil quedó bloqueado. Deben contactar a Nexora."
          : "Marca registrada. Se notificará al perfil; no bloquea todavía.",
      );
      await onActualizado(siguiente);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo registrar la marca");
    } finally {
      setMarcaEnviando(false);
    }
  }

  return (
    <section className="panel-dash padron-ficha">
      <h2>{detalle.nombre}</h2>
      <p className="ayuda">
        {rolDe(detalle)} · {detalle.perfil_nombre}
        {detalle.bloqueado ? " · Perfil bloqueado" : ""}
        {detalle.baja_solicitada ? " · Pidió baja" : ""}
      </p>
      <form onSubmit={(evento) => void guardar(evento)}>
        <label>
          Nombre
          <input name="nombre" required defaultValue={detalle.nombre} autoComplete="off" key={`${detalle.id}-nombre`} />
        </label>
        <label>
          Correo
          <input name="correo" type="email" required defaultValue={detalle.correo} autoComplete="off" key={`${detalle.id}-correo`} />
        </label>
        <label>
          Teléfono
          <input name="telefono" required inputMode="numeric" defaultValue={detalle.telefono} autoComplete="off" key={`${detalle.id}-tel`} />
        </label>
        {detalle.tipo_cuenta === "proveedor" ? (
          <label>
            Función
            <select name="funcion" defaultValue={detalle.funcion ?? "administrativo"} key={`${detalle.id}-fn`}>
              <option value="administrativo">Administrativo</option>
              <option value="tecnico">Técnico</option>
            </select>
          </label>
        ) : null}
        <button type="submit" disabled={enviando} onClick={(evento) => evento.stopPropagation()}>
          {enviando ? "Guardando…" : "Guardar cuenta"}
        </button>
      </form>
      {detalle.tipo_cuenta === "administrador" ? (
        <p className="ayuda">Un administrador de plataforma no acumula advertencias ni sanciones.</p>
      ) : (
        <>
          <h3>Marcas del perfil</h3>
          <p className="ayuda">
            Advertencia y sanción suman al mismo conteo. Una misma causa no suma dos veces. A la tercera, se bloquean
            todos los usuarios de este perfil.
          </p>
          {detalle.marcas.length === 0 ? (
            <p className="ayuda">Este perfil no tiene marcas.</p>
          ) : (
            <ul className="padron-marcas">
              {detalle.marcas.map((marca) => (
                <li key={marca.id}>
                  <strong>{marca.tipo === "advertencia" ? "Advertencia" : "Sanción"}</strong>
                  <span>{marca.causa}</span>
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={(evento) => {
              evento.preventDefault();
              void marcar(evento.currentTarget);
            }}
          >
            <label>
              Tipo
              <select name="tipo" defaultValue="advertencia">
                <option value="advertencia">Advertencia</option>
                <option value="sancion">Sanción</option>
              </select>
            </label>
            <label>
              Causa
              <input name="causa" required autoComplete="off" />
            </label>
            <button
              type="button"
              disabled={marcaEnviando || detalle.bloqueado}
              onClick={(evento) => {
                const formulario = evento.currentTarget.form;
                if (formulario) void marcar(formulario);
              }}
            >
              {detalle.bloqueado ? "Perfil bloqueado" : marcaEnviando ? "Registrando…" : "Registrar marca"}
            </button>
          </form>
        </>
      )}
      {error ? <p className="error">{error}</p> : null}
      {aviso ? <p className="aviso">{aviso}</p> : null}
    </section>
  );
}
