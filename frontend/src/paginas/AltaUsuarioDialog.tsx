import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { Building2Icon, ShieldIcon, StoreIcon, UserRoundIcon, XIcon } from "lucide-react";
import {
  api,
  registrarAdministrador,
  registrarEmpresaAdmin,
  registrarNegocioAdmin,
} from "../api";
import { digitos, texto, validarAlta } from "../validarAlta";
import { ubicacionDe } from "./FormularioRegistro";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";

export type FamiliaAlta = "cliente" | "proveedor" | "administrador";

type PasoDef = { id: string; etiqueta: string };
type FormaCliente = "persona" | "empresa";
type FormaProveedor = "negocio" | "empresa";

const PASO_TIPO: PasoDef = { id: "tipo", etiqueta: "Tipo" };

function pasosTrasTipo(familia: FamiliaAlta | null): PasoDef[] {
  if (familia === "administrador") {
    return [
      { id: "identidad", etiqueta: "Identidad" },
      { id: "acceso", etiqueta: "Acceso" },
    ];
  }
  if (familia === "proveedor") {
    return [
      { id: "perfil", etiqueta: "Negocio" },
      { id: "cuenta", etiqueta: "Cuenta" },
      { id: "ubicacion", etiqueta: "Ubicación" },
    ];
  }
  if (familia === "cliente") {
    return [
      { id: "cuenta", etiqueta: "Cuenta" },
      { id: "ubicacion", etiqueta: "Ubicación" },
    ];
  }
  return [];
}

export function AltaUsuarioDialog({
  abierto,
  onCerrar,
  onCreado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: (familia: FamiliaAlta) => Promise<void>;
}) {
  if (!abierto) return null;
  return <AltaUsuarioCuerpo onCerrar={onCerrar} onCreado={onCreado} />;
}

function AltaUsuarioCuerpo({
  onCerrar,
  onCreado,
}: {
  onCerrar: () => void;
  onCreado: (familia: FamiliaAlta) => Promise<void>;
}) {
  const [paso, setPaso] = useState(0);
  const [familia, setFamilia] = useState<FamiliaAlta | null>(null);
  const [formaCliente, setFormaCliente] = useState<FormaCliente>("persona");
  const [formaProveedor, setFormaProveedor] = useState<FormaProveedor>("empresa");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmCierre, setConfirmCierre] = useState(false);

  const pasos = useMemo(() => [PASO_TIPO, ...pasosTrasTipo(familia)], [familia]);
  const actual = pasos[Math.min(paso, pasos.length - 1)];
  const ultimo = paso === pasos.length - 1 && familia !== null;

  function elegirFamilia(siguiente: FamiliaAlta) {
    setFamilia(siguiente);
    setError("");
    setPaso(0);
  }

  function irAtras() {
    setError("");
    setPaso((n) => Math.max(0, n - 1));
  }

  function irSiguiente(formulario: HTMLFormElement) {
    const fallo = validarPasoAlta(actual.id, new FormData(formulario), {
      familia,
      formaCliente,
      formaProveedor,
    });
    if (fallo) {
      setError(fallo);
      return;
    }
    setError("");
    setPaso((n) => Math.min(pasos.length - 1, n + 1));
  }

  function solicitarCierre() {
    if (enviando) return;
    setConfirmCierre(true);
  }

  function descartarRegistro() {
    setConfirmCierre(false);
    onCerrar();
  }

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (!ultimo) {
      irSiguiente(formulario);
      return;
    }
    const falloPaso = validarPasoAlta(actual.id, new FormData(formulario), {
      familia,
      formaCliente,
      formaProveedor,
    });
    if (falloPaso) {
      setError(falloPaso);
      return;
    }
    if (!familia) {
      setError("Elige un tipo de usuario");
      return;
    }
    setError("");
    setEnviando(true);
    try {
      await enviarAlta(new FormData(formulario), familia, formaCliente, formaProveedor);
      await onCreado(familia);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo registrar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(siguiente) => {
          if (!siguiente) solicitarCierre();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[min(860px,calc(100svh-2rem))] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
          onInteractOutside={(evento) => {
            evento.preventDefault();
            solicitarCierre();
          }}
          onEscapeKeyDown={(evento) => {
            evento.preventDefault();
            solicitarCierre();
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2"
            onClick={solicitarCierre}
          >
            <XIcon />
            <span className="sr-only">Cerrar</span>
          </Button>
          <DialogHeader className="gap-3 border-b px-6 py-5">
        <div className="flex flex-col gap-1 pr-8">
          <DialogTitle>Registrar usuario</DialogTitle>
          <DialogDescription>
            Elige el tipo de cuenta y completa los datos por secciones.
          </DialogDescription>
        </div>
        <IndicadorPasos pasos={pasos} actual={Math.min(paso, pasos.length - 1)} />
      </DialogHeader>

      <form className="flex min-h-0 flex-1 flex-col" autoComplete="off" noValidate onSubmit={(e) => void onSubmit(e)}>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <Seccion visible={actual.id === "tipo"}>
            <CamposTipoUsuario
              familia={familia}
              formaCliente={formaCliente}
              formaProveedor={formaProveedor}
              onFamilia={elegirFamilia}
              onFormaCliente={setFormaCliente}
              onFormaProveedor={setFormaProveedor}
            />
          </Seccion>
          {familia === "administrador" ? (
            <>
              <Seccion visible={actual.id === "identidad"}>
                <CamposIdentidad />
              </Seccion>
              <Seccion visible={actual.id === "acceso"}>
                <CamposAcceso />
              </Seccion>
            </>
          ) : null}
          {familia === "proveedor" ? (
            <Seccion visible={actual.id === "perfil"}>
              <CamposPerfilProveedor />
            </Seccion>
          ) : null}
          {familia === "cliente" || familia === "proveedor" ? (
            <>
              <Seccion visible={actual.id === "cuenta"}>
                <CamposCuentaAlta
                  empresaCliente={familia === "cliente" && formaCliente === "empresa"}
                />
              </Seccion>
              <Seccion visible={actual.id === "ubicacion"}>
                <CamposUbicacionAlta />
              </Seccion>
            </>
          ) : null}
          {error ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter className="mx-0 mb-0 sm:justify-between">
          <Button type="button" variant="ghost" onClick={solicitarCierre}>
            Cancelar
          </Button>
          <div className="flex justify-end gap-2">
            {paso > 0 ? (
              <Button type="button" variant="outline" onClick={irAtras}>
                Atrás
              </Button>
            ) : null}
            {ultimo ? (
              <Button type="submit" disabled={enviando}>
                {enviando ? "Registrando…" : "Registrar"}
              </Button>
            ) : (
              <Button type="submit">Siguiente</Button>
            )}
          </div>
        </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCierre} onOpenChange={setConfirmCierre}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Cancelar el registro?</DialogTitle>
            <DialogDescription>Los datos no guardados se perderán.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setConfirmCierre(false)}>
              Seguir editando
            </Button>
            <Button type="button" variant="destructive" onClick={descartarRegistro}>
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CamposTipoUsuario({
  familia,
  formaCliente,
  formaProveedor,
  onFamilia,
  onFormaCliente,
  onFormaProveedor,
}: {
  familia: FamiliaAlta | null;
  formaCliente: FormaCliente;
  formaProveedor: FormaProveedor;
  onFamilia: (v: FamiliaAlta) => void;
  onFormaCliente: (v: FormaCliente) => void;
  onFormaProveedor: (v: FormaProveedor) => void;
}) {
  return (
    <FieldGroup className="gap-4">
      <BloqueTipo etiqueta="Cliente" activo={familia === "cliente"}>
        <div className="flex gap-2">
          <BotonOpcionTipo
            activo={familia === "cliente" && formaCliente === "persona"}
            onClick={() => {
              onFamilia("cliente");
              onFormaCliente("persona");
            }}
          >
            <UserRoundIcon className="size-4" aria-hidden />
            Persona
          </BotonOpcionTipo>
          <BotonOpcionTipo
            activo={familia === "cliente" && formaCliente === "empresa"}
            onClick={() => {
              onFamilia("cliente");
              onFormaCliente("empresa");
            }}
          >
            <Building2Icon className="size-4" aria-hidden />
            Empresa
          </BotonOpcionTipo>
        </div>
      </BloqueTipo>

      <BloqueTipo etiqueta="Proveedor" activo={familia === "proveedor"}>
        <div className="flex gap-2">
          <BotonOpcionTipo
            activo={familia === "proveedor" && formaProveedor === "negocio"}
            onClick={() => {
              onFamilia("proveedor");
              onFormaProveedor("negocio");
            }}
          >
            <StoreIcon className="size-4" aria-hidden />
            Negocio
          </BotonOpcionTipo>
          <BotonOpcionTipo
            activo={familia === "proveedor" && formaProveedor === "empresa"}
            onClick={() => {
              onFamilia("proveedor");
              onFormaProveedor("empresa");
            }}
          >
            <Building2Icon className="size-4" aria-hidden />
            Empresa
          </BotonOpcionTipo>
        </div>
      </BloqueTipo>

      <div
        className={cn(
          "rounded-xl border p-3 transition-colors",
          familia === "administrador" ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <BotonOpcionTipo
          activo={familia === "administrador"}
          onClick={() => onFamilia("administrador")}
          className="w-full"
        >
          <ShieldIcon className="size-4" aria-hidden />
          Administrador
        </BotonOpcionTipo>
      </div>
    </FieldGroup>
  );
}

function BloqueTipo({
  etiqueta,
  activo,
  children,
}: {
  etiqueta: string;
  activo: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-3 transition-colors",
        activo ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <p className="text-center text-sm font-medium">{etiqueta}</p>
      {children}
    </div>
  );
}

function BotonOpcionTipo({
  activo,
  onClick,
  children,
  className,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-slot="tipo-alta-opcion"
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
        activo
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-background text-foreground hover:bg-muted/60",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function IndicadorPasos({ pasos, actual }: { pasos: PasoDef[]; actual: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Pasos del alta">
      {pasos.map((paso, indice) => {
        const hecho = indice < actual;
        const activo = indice === actual;
        return (
          <li key={paso.id} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                activo && "bg-primary text-primary-foreground",
                hecho && "bg-primary/15 text-primary",
                !activo && !hecho && "bg-muted text-muted-foreground",
              )}
            >
              {indice + 1}
            </span>
            <span
              className={cn(
                "truncate text-xs font-medium",
                activo ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {paso.etiqueta}
            </span>
            {indice < pasos.length - 1 ? <span className="h-px min-w-4 flex-1 bg-border" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function Seccion({ visible, children }: { visible: boolean; children: ReactNode }) {
  return (
    <div hidden={!visible} className={visible ? "flex flex-col gap-4" : undefined}>
      {children}
    </div>
  );
}

function CamposPerfilProveedor() {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="alta-razon">Nombre comercial o razón social</FieldLabel>
        <Input id="alta-razon" name="nombre_comercial" autoComplete="off" />
      </Field>
      <Field>
        <FieldLabel htmlFor="alta-descripcion">Descripción de servicios</FieldLabel>
        <Textarea id="alta-descripcion" name="descripcion" rows={3} />
      </Field>
      <Field>
        <FieldLabel htmlFor="alta-categorias">Categorías</FieldLabel>
        <Input id="alta-categorias" name="categorias" placeholder="Redes, mantenimiento" autoComplete="off" />
        <FieldDescription>Separa con comas. Hace falta al menos una.</FieldDescription>
      </Field>
    </FieldGroup>
  );
}

function CamposIdentidad() {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="alta-nombre">Nombre de la persona</FieldLabel>
        <Input id="alta-nombre" name="nombre" autoComplete="off" />
      </Field>
      <Field>
        <FieldLabel htmlFor="alta-telefono">Teléfono</FieldLabel>
        <Input id="alta-telefono" name="telefono" inputMode="numeric" placeholder="10 dígitos" autoComplete="off" />
      </Field>
    </FieldGroup>
  );
}

function CamposAcceso() {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="alta-correo">Correo</FieldLabel>
        <Input id="alta-correo" name="correo" type="email" autoComplete="off" />
      </Field>
      <Field>
        <FieldLabel htmlFor="alta-contrasena">Contraseña inicial</FieldLabel>
        <Input id="alta-contrasena" name="contrasena" type="password" autoComplete="new-password" />
        <FieldDescription>Mínimo 8 caracteres. Se la entregas a quien va a entrar.</FieldDescription>
      </Field>
    </FieldGroup>
  );
}

function CamposCuentaAlta({ empresaCliente = false }: { empresaCliente?: boolean }) {
  return (
    <FieldGroup>
      {empresaCliente ? (
        <Field>
          <FieldLabel htmlFor="alta-nombre-comercial">Nombre comercial</FieldLabel>
          <Input id="alta-nombre-comercial" name="nombre_comercial" autoComplete="off" />
        </Field>
      ) : null}
      <Field>
        <FieldLabel htmlFor="alta-nombre">Nombre de la persona</FieldLabel>
        <Input id="alta-nombre" name="nombre" autoComplete="off" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="alta-correo">Correo</FieldLabel>
          <Input id="alta-correo" name="correo" type="email" autoComplete="off" />
        </Field>
        <Field>
          <FieldLabel htmlFor="alta-telefono">Teléfono</FieldLabel>
          <Input id="alta-telefono" name="telefono" inputMode="numeric" placeholder="10 dígitos" autoComplete="off" />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="alta-contrasena">Contraseña inicial</FieldLabel>
        <Input id="alta-contrasena" name="contrasena" type="password" autoComplete="new-password" />
        <FieldDescription>Mínimo 8 caracteres. Se la entregas a quien va a entrar.</FieldDescription>
      </Field>
    </FieldGroup>
  );
}

function CamposUbicacionAlta() {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="alta-calle">Calle y número</FieldLabel>
        <Input id="alta-calle" name="calle_numero" autoComplete="off" />
      </Field>
      <Field>
        <FieldLabel htmlFor="alta-colonia">Colonia</FieldLabel>
        <Input id="alta-colonia" name="colonia" autoComplete="off" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="alta-ciudad">Ciudad</FieldLabel>
          <Input id="alta-ciudad" name="ciudad" autoComplete="off" />
        </Field>
        <Field>
          <FieldLabel htmlFor="alta-estado">Estado</FieldLabel>
          <Input id="alta-estado" name="estado" autoComplete="off" />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="alta-cp">Código postal</FieldLabel>
        <Input id="alta-cp" name="codigo_postal" inputMode="numeric" maxLength={5} placeholder="22000" autoComplete="off" />
      </Field>
    </FieldGroup>
  );
}

function validarPasoAlta(
  pasoId: string,
  formulario: FormData,
  ctx: { familia: FamiliaAlta | null; formaCliente: FormaCliente; formaProveedor: FormaProveedor },
): string | null {
  if (pasoId === "tipo") {
    if (!ctx.familia) return "Elige un tipo de usuario";
    return null;
  }
  if (pasoId === "perfil") {
    if (!texto(formulario.get("nombre_comercial"))) return "El nombre comercial es obligatorio";
    if (!texto(formulario.get("descripcion"))) return "La descripción de servicios es obligatoria";
    const categorias = String(formulario.get("categorias") ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (categorias.length === 0) return "Indica al menos una categoría";
    return null;
  }
  if (pasoId === "identidad") {
    if (!texto(formulario.get("nombre"))) return "El nombre es obligatorio";
    if (digitos(formulario.get("telefono")).length !== 10) return "El teléfono debe tener 10 dígitos";
    return null;
  }
  if (pasoId === "acceso") {
    if (!texto(formulario.get("correo")).includes("@")) return "El correo no es válido";
    if (String(formulario.get("contrasena") ?? "").length < 8) {
      return "La contraseña debe tener al menos 8 caracteres";
    }
    return null;
  }
  if (pasoId === "cuenta") {
    if (
      ctx.familia === "cliente" &&
      ctx.formaCliente === "empresa" &&
      !texto(formulario.get("nombre_comercial"))
    ) {
      return "La empresa necesita nombre comercial";
    }
    if (!texto(formulario.get("nombre"))) return "El nombre es obligatorio";
    if (!texto(formulario.get("correo")).includes("@")) return "El correo no es válido";
    if (String(formulario.get("contrasena") ?? "").length < 8) {
      return "La contraseña debe tener al menos 8 caracteres";
    }
    if (digitos(formulario.get("telefono")).length !== 10) return "El teléfono debe tener 10 dígitos";
    return null;
  }
  if (pasoId === "ubicacion") {
    const ubicacion = ubicacionDe(formulario);
    if (!ubicacion.calle_numero || !ubicacion.colonia || !ubicacion.ciudad || !ubicacion.estado) {
      return "La ubicación está incompleta";
    }
    if (!/^\d{5}$/.test(ubicacion.codigo_postal)) return "El código postal debe tener 5 dígitos";
  }
  return null;
}

async function enviarAlta(
  formulario: FormData,
  familia: FamiliaAlta,
  formaCliente: FormaCliente,
  formaProveedor: FormaProveedor,
) {
  if (familia === "administrador") {
    await registrarAdministrador({
      nombre: texto(formulario.get("nombre")),
      correo: texto(formulario.get("correo")).toLowerCase(),
      contrasena: String(formulario.get("contrasena") ?? ""),
      telefono: digitos(formulario.get("telefono")),
    });
    return;
  }

  const datosBase = {
    nombre: texto(formulario.get("nombre")),
    correo: texto(formulario.get("correo")).toLowerCase(),
    contrasena: String(formulario.get("contrasena") ?? ""),
    telefono: digitos(formulario.get("telefono")),
    nombre_comercial: texto(formulario.get("nombre_comercial")) || null,
    ubicacion: ubicacionDe(formulario),
  };

  if (familia === "cliente") {
    const datos = { ...datosBase, tipo: formaCliente };
    const fallo = validarAlta(datos, "cliente");
    if (fallo) throw new Error(fallo);
    await api("/api/v1/admin/clientes", { method: "POST", body: JSON.stringify(datos) });
    return;
  }

  const datosProveedor = {
    ...datosBase,
    tipo: "empresa",
    nombre_comercial: texto(formulario.get("nombre_comercial")),
    descripcion: texto(formulario.get("descripcion")),
    categorias: String(formulario.get("categorias") ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
    tipo_cuenta: formaProveedor,
  };
  const fallo = validarAlta(datosProveedor, "proveedor");
  if (fallo) throw new Error(fallo);
  if (formaProveedor === "negocio") await registrarNegocioAdmin(datosProveedor);
  else await registrarEmpresaAdmin(datosProveedor);
}
