# Actividades

Estados: `pendiente` · `en curso` · `en PR` · `hecho`.

Orden del producto: publicar → aceptar/denegar → cotizar → elegir → servicio → informe → calificar → historial.

Héctor: API cliente/proveedor. Ariel: pantallas. David: admin y externos. Andrés: datos, tablas, ESP32.

## Ahora

| ID | Quién | Qué | Rama | Espera | Estado |
|----|-------|-----|------|--------|--------|
| H1 | Héctor | API: publicar, listar, cancelar solicitud | `hector/api-solicitudes` | — | pendiente |
| H2 | Héctor | API: listar mercado, aceptar, denegar | `hector/api-participaciones` | H1 (o datos en el test) | pendiente |
| R1 | Ariel | Pantalla cliente: publicar y listar | `ariel/cliente-solicitudes` | H1 en `master` | pendiente |
| R2 | Ariel | Pantalla proveedor: listar, aceptar, denegar | `ariel/proveedor-solicitudes` | H2 en `master` | pendiente |
| D1 | David | API: desbloquear perfil | `david/admin-desbloqueo` | — | pendiente |
| N1 | Andrés | Más datos de prueba | `andres/seed` | — | pendiente |
| D0 | David | Revisar PRs | — | — | continua |

H1 no espera correo ni Cloudinary. Ariel puede maquetar antes; no da por lista la pantalla sin la API.

## Luego

| ID | Quién | Qué |
|----|-------|-----|
| H3 | Héctor | API cotizar |
| H4 | Héctor | API elegir cotización (nace el servicio) |
| R3 | Ariel | Cliente: ver y elegir cotización |
| R4 | Ariel | Proveedor: cotizar |
| D2 | David | API: procesar baja |
| N5 | Andrés | Tablas de tarifa (tramos RN-016 y N % RN-018) |
| N6 | Andrés | Tablas de alquiler ESP32 |
| D6 | David | Correo Google y recuperar contraseña |
| D7 | David | Cloudinary (`POST` archivos) |
| D8 | David | OSM: guardar y mostrar ubicación |
| D9 | David | Deepseek (estimaciones y agente de voz) |
| D10 | David | Avisos: marcas, denegar, vencimiento, cancelar |

D6–D10 no bloquean R1. Héctor los llama cuando existan.

## Después

| ID | Quién | Qué |
|----|-------|-----|
| H5 | Héctor | API servicio: estados, técnico, informe, calificar |
| H14 | Héctor | Aplicar comisión al cerrar y N % de alquiler (hace falta N5) |
| H6 | Héctor | Vencer a las 24 h |
| H7 | Héctor | API historial |
| H8 | Héctor | API usuarios del proveedor |
| R5 | Ariel | Pantallas de servicio |
| R6 | Ariel | Historial, equipos, mapa, reclamación |
| R7 | Ariel | Admin vacío: Reportes, Ingresos, Dispositivos, Auditoría |
| D3 | David | API asignar ESP32 al perfil y consulta de ingresos |
| D4 | David | API auditoría y reportes |
| D5 | David | Estatus de dispositivos ESP32 |
| N2 | Andrés | Seed de un flujo completo (hace falta H4 y H5) |
| N3 | Andrés | API del aparato (autorizar, datos, comandos) |
| N4 | Andrés | Firmware ESP32, canal de voz (RN-019). Usa Deepseek de David. Después de H5 |

## Ya está (no repetir)

Login, marco, paleta, Usuarios, Trabajos, modelos, seed mínimo, abrir reclamación.

## No va

Pagos reales, app nativa, inventario, RFC, chat, sensores extra, borrar el frontend.
