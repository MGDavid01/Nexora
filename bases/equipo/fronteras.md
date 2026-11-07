# Fronteras

No edites archivos de otro. En un archivo compartido: una línea, sin reformatear.

## Ariel

Todo `frontend/`. Cliente, proveedor y admin que falte. Paleta de `01-establecido.md`. Usuarios y Trabajos se quedan (puedes cambiar CSS, no el flujo).

No: `backend/`, `firmware/`, registro público.

## Andrés

`entities.py`, Alembic, `seed.py`. Tarifas (tramos RN-016 y N % RN-018), alquiler ESP32, lat/long si el mapa las necesita. Sin `DROP` salvo que se pida.

`firmware/` y API del aparato (autorizar, datos, comandos). Canal de voz RN-019. El estatus en admin es de David.

No: pantallas, flujo de solicitudes, adaptadores externos, aplicar comisión.

## Héctor

Backend de **cliente y proveedor**. Routers nuevos. No `admin.py`. No sustituyas `servicios.py` (reclamaciones).

- Solicitud, aceptar/denegar, cotizar, elegir, servicio, informe, calificar, historial, 24 h
- Usuarios extra del proveedor
- Al cerrar: aplicar comisión (RN-016) y, si hay alquiler, tokens + N % (RN-018). No recalcular el pasado.

Llama a los adaptadores de David; no los implementes. El primer PR de solicitudes no espera correo.

No: React, ESP32, `adaptadores/`, panel Usuarios/Trabajos.

## David

`backend/app/api/v1/admin.py` y `backend/app/adaptadores/`.

Admin: desbloqueo, baja, asignar ESP32 al perfil, estatus del aparato, auditoría, reportes, consulta de ingresos, editar tarifas.

Externos: Google (correo y recuperación), Cloudinary, OSM (guardar y mostrar), Deepseek. Sin credencial: el acto de negocio igual vale; el aviso o el archivo no salen.

No: React, flujo de solicitudes, firmware, crear tablas, Usuarios/Trabajos de nuevo.

## Compartido

| Archivo | Quién | Qué |
|---------|-------|-----|
| `App.tsx` | Ariel | Una ruta nueva |
| `herramientas.ts` | Ariel | Marcar la herramienta como hecha |
| `api.ts` | Ariel | Llamadas a API ya en `master` |
| `router.py` | Dueño del router | Un `include_router` |
| `entities.py` y Alembic | Andrés | Tablas nuevas o columnas |
| `adaptadores/` | David | Google, Cloudinary, OSM, Deepseek |
| `contexto/` | Nadie | No se cambia para que el código “cuadre” |

## Primera API (Héctor)

Campos: título, descripción, categoría, ubicación (`contexto/04`). Aún no: «Solicitar para:», cotizar, elegir.

| Método | Path | Pantalla |
|--------|------|----------|
| `POST` | `/api/v1/solicitudes` | Cliente |
| `GET` | `/api/v1/solicitudes` | Cliente |
| `POST` | `/api/v1/solicitudes/{id}/cancelar` | Cliente |
| `GET` | `/api/v1/proveedor/solicitudes` | Proveedor |
| `POST` | `/api/v1/solicitudes/{id}/aceptar` | Proveedor |
| `POST` | `/api/v1/solicitudes/{id}/denegar` | Proveedor |
| `POST` | `/api/v1/participaciones/{id}/retirar` | Cliente |
