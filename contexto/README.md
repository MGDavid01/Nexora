# Contexto Nexora (para la IA)

Capa operativa de contexto. Son bases para decidir y codear sin inventar requisitos.

## Fuentes crudas

Material original (SRS, DER, plan básico) vive en [`../bases/`](../bases/). Este directorio resume y decide; no duplica los PDF.

| Fuente | Uso |
|--------|-----|
| `bases/SRS_Nexora.docx.pdf` | Requisitos, módulos, stack, interfaz |
| `bases/NEXORA_DR_ER-DER.jpg` | Entidades y relaciones |
| `bases/PLAN_BASICO_SOPORTE_TECNICO.pdf` | Objetivos del proyecto y límites de adopción |

## Orden de lectura

1. [`00-vision.md`](00-vision.md)
2. [`01-establecido.md`](01-establecido.md)
3. [`03-dominio.md`](03-dominio.md)
4. [`04-logica-negocio.md`](04-logica-negocio.md)
5. [`05-alcance.md`](05-alcance.md)
6. [`02-pendiente.md`](02-pendiente.md)
7. [`06-decisiones.md`](06-decisiones.md)

## Convenciones

| Archivo | Contiene | No contiene |
|---------|----------|-------------|
| `01-establecido` | Hechos acordados | Ideas a medias |
| `02-pendiente` | Preguntas abiertas | Decisiones tomadas |
| `04-logica-negocio` | Si X entonces Y, estados, permisos | Detalle de UI o código |
| `06-decisiones` | Decisión + motivo + fecha | Discusión larga |

**Flujo pendiente → cerrado:** al resolver un ítem de `02`, pasarlo a `01` y registrar ADR en `06`; quitarlo de `02`.

**Una verdad por tema:** no repetir la misma regla en varios archivos; enlaza.

## Reglas Cursor

Las normas cortas viven en [`.cursor/rules/`](../.cursor/rules/).
