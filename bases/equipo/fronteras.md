# Fronteras

No edites archivos de otro. En un archivo compartido: una línea, sin reformatear.

`tipo_cuenta` vigente: `cliente | empresa | negocio | administrador` (ADR-044). No inventes el valor `proveedor`.

## Ariel

Todo `frontend/`. Cliente, `empresa`, `negocio` y admin que falte. Paleta de `01-establecido.md`. Usuarios y Trabajos se quedan (puedes cambiar CSS y cablear altas/conversión nuevas; no rehagas el panel).

No: `backend/`, `firmware/`, registro público.

## Andrés

`entities.py`, Alembic, `seed.py`. Migración ADR-044 (`tipo_cuenta`, `administrativo_campo`). Tarifas (tramos RN-016 y N % RN-018), alquiler ESP32, lat/long si el mapa las necesita. Sin `DROP` salvo que se pida.

`firmware/` y API del aparato (autorizar, datos, comandos). Canal de voz RN-019. El estatus en admin es de David.

No: pantallas, flujo de solicitudes, adaptadores externos, aplicar comisión.

## Héctor

Backend de **cliente**, **`empresa`** y **`negocio`**. Routers nuevos. No `admin.py`. No sustituyas `servicios.py` (reclamaciones).

- Solicitud, aceptar/denegar, cotizar, elegir, servicio, informe, calificar, historial, 24 h
- Usuarios extra de `empresa` y baja de usuario (ADR-043). Pedir conversión `empresa` ↔ `negocio` (ADR-044)
- En `negocio`, el técnico del servicio es el `administrativo_campo`
- Al cerrar: aplicar comisión (RN-016) y, si hay alquiler, tokens + N % (RN-018). No recalcular el pasado

Llama a los adaptadores de David; no los implementes. El primer PR de solicitudes no espera correo.

No: React, ESP32, `adaptadores/`, panel Usuarios/Trabajos, procesar baja de perfil, autorizar conversión.

## David

`backend/app/api/v1/admin.py` y `backend/app/adaptadores/`.

Admin: desbloqueo, procesar baja de perfil (incl. reglas de `negocio`), autorizar/rechazar conversión `empresa` ↔ `negocio`, asignar ESP32 al perfil, estatus del aparato, auditoría, reportes, consulta de ingresos, editar tarifas.

Externos: Google (correo y recuperación), Cloudinary, OSM (guardar y mostrar), Deepseek. Sin credencial: el acto de negocio igual vale; el aviso o el archivo no salen.

No: React, flujo de solicitudes, firmware, crear tablas, Usuarios/Trabajos de nuevo, baja de usuario extra.

## Compartido

| Archivo | Quién | Qué |
|---------|-------|-----|
| `App.tsx` | Ariel | Una ruta nueva |
| `herramientas.ts` | Ariel | Marcar la herramienta como hecha |
| `api.ts` | Ariel | Llamadas a API ya en `master` |
| `router.py` | Dueño del router | Un `include_router` |
| `entities.py` y Alembic | Andrés | Tablas nuevas o columnas; migración ADR-044 |
| `adaptadores/` | David | Google, Cloudinary, OSM, Deepseek |
| `contexto/` | Nadie | No se cambia para que el código “cuadre” |

## Primera API (Héctor)

Campos: título, descripción, categoría, ubicación (`contexto/04`). Aún no: «Solicitar para:», cotizar, elegir.

| Método | Path | Pantalla |
|--------|------|----------|
| `POST` | `/api/v1/solicitudes` | Cliente |
| `GET` | `/api/v1/solicitudes` | Cliente |
| `POST` | `/api/v1/solicitudes/{id}/cancelar` | Cliente |
| `GET` | `/api/v1/proveedor/solicitudes` | Proveedor (`empresa`/`negocio`) |
| `POST` | `/api/v1/solicitudes/{id}/aceptar` | Proveedor |
| `POST` | `/api/v1/solicitudes/{id}/denegar` | Proveedor |
| `POST` | `/api/v1/participaciones/{id}/retirar` | Cliente |
