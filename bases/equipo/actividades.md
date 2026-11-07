# Actividades

Estados: `pendiente` · `en curso` · `en PR` · `hecho`.

Orden del producto: publicar → aceptar/denegar → cotizar → elegir → servicio → informe → calificar → historial.

Héctor: API cliente/`empresa`/`negocio`. Ariel: pantallas. David: admin y externos. Andrés: datos, tablas, ESP32.

`tipo_cuenta` vigente: `cliente | empresa | negocio | administrador` (ADR-044). El valor `proveedor` queda fuera de uso.

## Ahora

| ID | Quién | Qué | Rama | Espera | Estado |
|----|-------|-----|------|--------|--------|
| H1 | Héctor | API: publicar, listar, cancelar solicitud | `hector/api-solicitudes` | — | pendiente |
| H2 | Héctor | API: listar mercado, aceptar, denegar | `hector/api-participaciones` | H1 (o datos en el test) | pendiente |
| R1 | Ariel | Pantalla cliente: publicar y listar | `ariel/cliente-solicitudes` | H1 en `master` | pendiente |
| R2 | Ariel | Pantalla proveedor: listar, aceptar, denegar | `ariel/proveedor-solicitudes` | H2 en `master` | pendiente |
| D1 | David | API: desbloquear perfil | `david/admin-desbloqueo` | — | pendiente |
| N1 | Andrés | Más datos de prueba | `andres/seed` | — | pendiente |
| N7 | Andrés | Migración: `tipo_cuenta` (`proveedor`→`empresa`, añadir `negocio`), función `administrativo_campo`, invariante 1 usuario en negocio | `andres/tipo-cuenta` | — | pendiente |
| D0 | David | Revisar PRs | — | — | continua |

H1 no espera correo ni Cloudinary. Ariel puede maquetar antes; no da por lista la pantalla sin la API. N7 no bloquea H1/D1; sí hace falta antes de altas `negocio`, conversión y seed de unipersonal.

## Luego

| ID | Quién | Qué |
|----|-------|-----|
| H3 | Héctor | API cotizar |
| H4 | Héctor | API elegir cotización (nace el servicio) |
| R3 | Ariel | Cliente: ver y elegir cotización |
| R4 | Ariel | Proveedor: cotizar |
| D2 | David | API: procesar baja de perfil (corte al procesar). Si es `negocio`: cancelar servicios `pendiente`/`en_curso`; en `pendiente_informe` informe default y servicio `cancelado`; cotización aceptada se conserva (ADR-044) |
| D11 | David | API: autorizar o rechazar conversión `empresa` ↔ `negocio` (pedido visible; a negocio queda la primera cuenta y se confirman extras a eliminar) |
| H8 | Héctor | API usuarios de `empresa`: alta de extras + baja de usuario (nunca la primera; si técnico con servicio activo, reasignar en el mismo acto o rechazar; ADR-043) |
| H9 | Héctor | API: pedir conversión `empresa` ↔ `negocio` (administrativo o `administrativo_campo`; el admin de plataforma autoriza en D11) |
| N5 | Andrés | Tablas de tarifa (tramos RN-016 y N % RN-018) |
| N6 | Andrés | Tablas de alquiler ESP32 |
| D6 | David | Correo Google y recuperar contraseña |
| D7 | David | Cloudinary (`POST` archivos) |
| D8 | David | OSM: guardar y mostrar ubicación |
| D9 | David | Deepseek (estimaciones y agente de voz) |
| D10 | David | Avisos: marcas, denegar, vencimiento, cancelar |

D6–D10 no bloquean R1. Héctor los llama cuando existan. D11 espera N7. H8/H9 esperan N7 para `negocio`/`administrativo_campo`.

## Después

| ID | Quién | Qué |
|----|-------|-----|
| H5 | Héctor | API servicio: estados, técnico (en `negocio` = `administrativo_campo`), informe, calificar |
| H14 | Héctor | Aplicar comisión al cerrar y N % de alquiler (hace falta N5) |
| H6 | Héctor | Vencer a las 24 h |
| H7 | Héctor | API historial |
| R5 | Ariel | Pantallas de servicio |
| R6 | Ariel | Historial, equipos, mapa, reclamación |
| R7 | Ariel | Admin vacío: Reportes, Ingresos, Dispositivos, Auditoría |
| R8 | Ariel | Admin Usuarios: altas `cliente` / `empresa` / `negocio`; autorizar o rechazar conversión (contra D11) |
| R9 | Ariel | `empresa`/`negocio`: pedir conversión de tipo; `empresa`: baja de usuario extra (contra H8/H9) |
| D3 | David | API asignar ESP32 al perfil y consulta de ingresos |
| D4 | David | API auditoría y reportes |
| D5 | David | Estatus de dispositivos ESP32 |
| N2 | Andrés | Seed de un flujo completo (hace falta H4 y H5); incluir un `negocio` de prueba |
| N3 | Andrés | API del aparato (autorizar, datos, comandos) |
| N4 | Andrés | Firmware ESP32, canal de voz (RN-019). Usa Deepseek de David. Después de H5 |

## Ya está (no repetir)

Login, marco, paleta, Usuarios, Trabajos, modelos, seed mínimo, abrir reclamación.

Usuarios/Trabajos cubren el padrón previo (`proveedor`). El discriminante `empresa`/`negocio`, la conversión y el desbloqueo/baja nueva son D1, D2, D11, N7, R8 — no rehacer el panel desde cero.

## No va

Pagos reales, app nativa, inventario, RFC, chat, sensores extra, borrar el frontend. Cliente que pide cambio de `tipo_cuenta` (P-025 si se abre después).
