import { type FormEvent, useState } from "react";
import {
  cerrarReclamacionAdmin,
  codigosMarcaTrabajosPara,
  ETIQUETAS_MARCA,
  registrarMarcaTrabajo,
  type CodigoMarca,
  type ExpedienteTrabajo,
  type PerfilAfectadoMarca,
  type TipoMarca,
} from "./api";
import { texto } from "./validarAlta";

export function FormCerrarReclamacion({
  solicitudId,
  reclamacion,
  marcasExistentes,
  onActualizado,
}: {
  solicitudId: string;
  reclamacion: ExpedienteTrabajo["reclamaciones"][number];
  marcasExistentes: ExpedienteTrabajo["marcas"];
  onActualizado: (e: ExpedienteTrabajo) => Promise<void>;
}) {
  const [desenlace, setDesenlace] = useState<"sin_marca" | "con_marca">("sin_marca");
  const [perfil, setPerfil] = useState<PerfilAfectadoMarca>("cliente");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  const codigos = codigosMarcaTrabajosPara(perfil);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    setError("");
    setAviso("");
    const form = new FormData(formulario);

    if (desenlace === "sin_marca") {
      setEnviando(true);
      try {
        const siguiente = await cerrarReclamacionAdmin(solicitudId, reclamacion.id, { desenlace: "sin_marca" });
        setAviso("Reclamación cerrada sin marca.");
        await onActualizado(siguiente);
      } catch (causa) {
        setError(causa instanceof Error ? causa.message : "No se pudo cerrar la reclamación");
      } finally {
        setEnviando(false);
      }
      return;
    }

    const datos = {
      tipo: texto(form.get("tipo")) as TipoMarca,
      codigo: texto(form.get("codigo")) as CodigoMarca,
      descripcion: texto(form.get("descripcion")),
      perfil_afectado: perfil,
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
      const siguiente = await cerrarReclamacionAdmin(solicitudId, reclamacion.id, {
        desenlace: "con_marca",
        ...datos,
      });
      setAviso("Reclamación cerrada y marca registrada.");
      await onActualizado(siguiente);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo cerrar la reclamación");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="form-expediente form-detalle-caso" onSubmit={(e) => void enviar(e)}>
      <p className="crm-meta">
        <strong>Cerrar reclamación abierta</strong> (el administrador no abre reclamaciones desde aquí).
      </p>
      <fieldset className="campo-crm">
        <legend>Desenlace</legend>
        <label>
          <input
            type="radio"
            name="desenlace"
            checked={desenlace === "sin_marca"}
            onChange={() => setDesenlace("sin_marca")}
          />
          Cerrar sin marca
        </label>
        <label>
          <input
            type="radio"
            name="desenlace"
            checked={desenlace === "con_marca"}
            onChange={() => setDesenlace("con_marca")}
          />
          Cerrar con marca
        </label>
      </fieldset>

      {desenlace === "con_marca" ? (
        <>
          <label className="campo-crm">
            Perfil afectado
            <select value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilAfectadoMarca)}>
              <option value="cliente">Cliente</option>
              <option value="proveedor">Proveedor</option>
            </select>
          </label>
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
              {codigos.map((codigo) => (
                <option key={codigo} value={codigo}>
                  {marcasExistentes.some((m) => m.codigo === codigo)
                    ? `${ETIQUETAS_MARCA[codigo]} (ya en este caso)`
                    : ETIQUETAS_MARCA[codigo]}
                </option>
              ))}
            </select>
          </label>
          <label className="campo-crm">
            Descripción
            <textarea name="descripcion" required rows={2} autoComplete="off" />
          </label>
        </>
      ) : null}

      <button type="submit" className="btn-crm btn-crm-principal" disabled={enviando}>
        {enviando ? "Cerrando…" : "Cerrar reclamación"}
      </button>
      {error ? <p className="error-crm">{error}</p> : null}
      {aviso ? <p className="aviso-crm">{aviso}</p> : null}
    </form>
  );
}

export function FormMarcaCaso({
  solicitudId,
  marcasExistentes,
  onActualizado,
}: {
  solicitudId: string;
  marcasExistentes: ExpedienteTrabajo["marcas"];
  onActualizado: (e: ExpedienteTrabajo) => Promise<void>;
}) {
  const [perfil, setPerfil] = useState<PerfilAfectadoMarca>("proveedor");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const codigos = codigosMarcaTrabajosPara(perfil);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    setError("");
    setAviso("");
    const form = new FormData(formulario);
    const datos = {
      tipo: texto(form.get("tipo")) as TipoMarca,
      codigo: texto(form.get("codigo")) as CodigoMarca,
      descripcion: texto(form.get("descripcion")),
      perfil_afectado: perfil,
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
      const siguiente = await registrarMarcaTrabajo(solicitudId, datos);
      formulario.reset();
      setAviso("Marca del caso registrada.");
      await onActualizado(siguiente);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo registrar la marca");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="form-expediente form-detalle-caso" onSubmit={(e) => void enviar(e)}>
      <p className="crm-meta">
        <strong>Registrar marca del caso</strong>
      </p>
      <label className="campo-crm">
        Perfil afectado
        <select value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilAfectadoMarca)}>
          <option value="cliente">Cliente</option>
          <option value="proveedor">Proveedor</option>
        </select>
      </label>
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
          {codigos.map((codigo) => (
            <option key={codigo} value={codigo}>
              {marcasExistentes.some((m) => m.codigo === codigo)
                ? `${ETIQUETAS_MARCA[codigo]} (ya en este caso)`
                : ETIQUETAS_MARCA[codigo]}
            </option>
          ))}
        </select>
      </label>
      <label className="campo-crm">
        Descripción
        <textarea name="descripcion" required rows={2} autoComplete="off" />
      </label>
      <button type="submit" className="btn-crm btn-crm-principal" disabled={enviando}>
        {enviando ? "Registrando…" : "Registrar marca del caso"}
      </button>
      {error ? <p className="error-crm">{error}</p> : null}
      {aviso ? <p className="aviso-crm">{aviso}</p> : null}
    </form>
  );
}
