import { type FormEvent, useState } from "react";
import { cotizarSolicitud, type Solicitud } from "../../api";
import { plazoRestante } from "../../utilidades/formato";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function DialogCotizar({
  solicitud,
  onCerrar,
  onEnviada,
}: {
  solicitud: Solicitud;
  onCerrar: () => void;
  onEnviada: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    const descripcion = String(fd.get("descripcion") ?? "").trim();
    const costo_mxn = String(fd.get("costo") ?? "").trim();
    const condiciones = String(fd.get("condiciones") ?? "").trim();
    if (!descripcion || !costo_mxn || !condiciones) {
      setError("Completa la descripción, el costo y las condiciones.");
      return;
    }
    const costo = Number(costo_mxn);
    if (!Number.isFinite(costo) || costo < 0.01) {
      setError("El costo debe ser mayor a 0.");
      return;
    }
    setError("");
    setEnviando(true);
    try {
      await cotizarSolicitud(solicitud.id, { descripcion, costo_mxn, condiciones });
      await onEnviada();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo cotizar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(siguiente) => {
        if (!siguiente && !enviando) onCerrar();
      }}
    >
      <DialogContent className="flex max-h-[min(640px,calc(100svh-2rem))] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="gap-1 border-b px-6 py-5">
          <DialogTitle>Cotización única</DialogTitle>
          <DialogDescription>
            {solicitud.titulo}. Quedan {plazoRestante(solicitud.aceptada_en)} para enviar.
          </DialogDescription>
        </DialogHeader>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => void onSubmit(e)}>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="cotizar-descripcion">Descripción</FieldLabel>
                <Textarea id="cotizar-descripcion" name="descripcion" rows={3} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="cotizar-costo">Costo (MXN)</FieldLabel>
                <Input id="cotizar-costo" name="costo" type="number" min="0.01" step="0.01" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="cotizar-condiciones">Condiciones</FieldLabel>
                <Textarea id="cotizar-condiciones" name="condiciones" rows={2} required />
              </Field>
            </FieldGroup>
            {error ? (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={enviando}>
              Cerrar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Enviando…" : "Enviar cotización"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
