# Establecido

Hechos cerrados al 2026-10-27. Lo que sigue en duda está en `02-pendiente.md`. Los porqués están en `06-decisiones.md`.

## Producto

- Aplicación web de intermediación de soporte técnico.
- Solicitante: persona, establecimiento o empresa.
- Un usuario pertenece a un perfil cliente o a un perfil proveedor, nunca a los dos. Un perfil cliente tiene un usuario. Un perfil proveedor tiene muchos usuarios, administrativos y técnicos.
- El administrador de la plataforma no es ninguno de esos dos perfiles.
- Clientes y proveedores se dan de alta desde la vista de ese administrador. No hay auto-registro (ADR-025).
- Flujo: solicitud abierta → varios proveedores pueden aceptarla y cotizar → el solicitante elige una cotización enviada → seguimiento del servicio → registro en el historial → calificación mutua.
- Aceptar no aparta la solicitud. Sigue visible para los demás proveedores hasta que el cliente elige una cotización enviada.
- Tras aceptar, el proveedor tiene 24 horas para cotizar. Si no lo hace, su participación vence, la solicitud sigue abierta y el cliente recibe aviso.
- El cliente puede quitar a ese proveedor antes de las 24 horas, sin cerrar la solicitud para los demás.
- Denegar una solicitud la oculta para ese proveedor y avisa al cliente que ese proveedor la rechazó. La solicitud sigue abierta para los demás.
- Repetir el vencimiento de las 24 horas sin cotizar es causa de sanción. No bloquea en el primer vencimiento.
- La máquina de estados de participación, solicitud, cotización y servicio está cerrada. Vive en `04-logica-negocio.md` (ADR-016).
- Los campos obligatorios de usuario, perfiles, ubicación, solicitud, cotización, historial y reporte están cerrados. Viven en `04-logica-negocio.md` (ADR-017).
- Calificación mutua de 1 a 5 estrellas. El comentario es opcional. El servicio se cierra aunque una parte no califique; si no hay calificación manual, queda 4.5 y ya no se puede cambiar.
- Un proveedor ve el historial del cliente, durante un servicio activo, por el técnico asignado y por los usuarios administrativos de ese perfil. Los demás técnicos de la misma empresa no. Cada consulta se audita.
- Los huecos de carrera, cancelación, cotización única y bloqueo están cerrados en `04-logica-negocio.md` (ADR-019).
- Historial y reporte son distintos. El historial es el registro de los servicios dados. El reporte son las mediciones relevantes de las acciones de un perfil cliente o proveedor.
- Recontratación: al publicar una solicitud, si el cliente ya cerró servicios, ve «Solicitar para:» con los proveedores con los que trabajó. Elegir uno dirige la solicitud a ese proveedor, sin saltarse la cotización ni las 24 horas. Filtrar esa lista por el área de la solicitud queda para una fase posterior.
- Una advertencia o una sanción se notifica al proveedor o al cliente y no bloquea en el momento. Cada una suma al mismo conteo. A la tercera marca distinta se bloquean todos los usuarios de ese perfil y se les pide contactar a Nexora. El administrador levanta el bloqueo; el conteo no vuelve a cero por eso.
- La frase del plan sobre «reservaciones de recursos o servicios compartidos» no describe a Nexora. El producto es intermediación de soporte técnico.
- Datos personales: se conservan mientras la cuenta está activa. Al pedir la baja, deja de entrar en el momento. A los 12 meses se borran nombre, correo, teléfono y archivos de perfil. El historial cerrado se queda sin esos datos de contacto. El detalle está en `04-logica-negocio.md` (ADR-024).
- El DER de `bases/` es una base. Se agregan, modifican o eliminan entidades cuando el desarrollo lo pida.
- Panel de administración para consultar usuarios, proveedores, solicitudes, cotizaciones, servicios, reportes, calificaciones, sanciones e ingresos simulados de la plataforma.
- No hay pasarela de pagos en esta fase (proyecto académico). Sí hay una herramienta de ingresos para el administrador que calcula comisión «como si» los pagos fueran reales, sobre el costo de las cotizaciones ligadas a servicios cerrados (ADR-026). La comisión es escalonada (5 % a 9 % por defecto) y el administrador la edita en la UI (ADR-027). El detalle vive en `04-logica-negocio.md`.
- Idioma: español.
- La interfaz del MVP es responsive (escritorio y celular).

## Stack

Decisión de equipo: vale lo nombrado en el SRS §3.1.3, por encima del §2.1 que lo dejaba pendiente.

| Capa | Decisión |
|------|----------|
| Aplicación | Web. API REST JSON sobre HTTPS. Documentación OpenAPI/Swagger. |
| Backend | FastAPI |
| Base de datos | PostgreSQL |
| Acceso a datos | SQLModel, Alembic, asyncpg y psycopg2-binary |
| Auth | JWT (clientes web y dispositivos). Contraseñas con hash, nunca en texto plano. |
| Archivos | Cloudinary (fotos de perfil, documentación, evidencias). En BD solo la referencia. |
| Mapas | OpenStreetMap para ubicación de proveedor o empresa. |
| Correo | SMTP o API (SendGrid o Mailgun) para notificaciones, confirmaciones, recordatorios y recuperación de contraseña. El proveedor concreto de correo no está elegido. |
| IA | API externa para estimaciones y análisis a partir de reportes. El proveedor del modelo no está elegido. |
| Campo | ESP32-S3 + framework ESP-Claw, dentro del MVP. Wi-Fi, backend por REST/JSON y autenticación por JWT o API key. |

## Interfaz

- Mockups en Figma antes de la UI funcional.
- Paleta: `#0A0A0A` Onyx, `#FBFBFB` White, `#3573A4` Rich Cerulean, `#FFD342` Golden Pollen, `#6795BA` Blue Grey, `#FFD753` Mustard, `#98B7D0` Powder Blue, `#FFDB63` Mustard terciario.
- Cada rol ve solo las opciones de sus módulos.
- Contraste, texto legible y controles identificables.
- Responsive: usable en escritorio y en celular.

## Límites duros

- Sin contabilidad de proveedores.
- Sin venta directa de refacciones o productos.
- Sin hardware especializado como núcleo del producto. El ESP32 es complemento de captura, y sí entra en esta fase.
- Sin sustituir al técnico en sitio.
- Sin inventario empresarial completo del proveedor.
- Funciones limitadas por rol.
- Sin certificación de proveedores en esta fase (ni RFC ni acta ni sello).
- Historial y reportes se conservan ligados al perfil y, cuando aplica, al servicio.

## Requisitos no funcionales (SRS §3.3)

- Mínimo 100 usuarios simultáneos sin degradación significativa.
- Al menos el 95 % de las solicitudes en menos de 2 s en condiciones normales.
- Ninguna operación común por encima de 3 s, salvo dependencia de servicios externos.
- Disponibilidad objetivo: 95 %.
- Auditoría de acciones administrativas relevantes.
- Validar datos antes de guardarlos.
- Datos personales según la normativa aplicable y las políticas del proyecto (la política concreta no está redactada).

## Módulos del SRS (prioridad alta en el documento)

1. Gestión de usuarios y roles.
2. Publicación y gestión de solicitudes.
3. Ejecución y seguimiento (incluye reporte, IA, ESP32, Swagger y archivos).
4. Calificaciones e historial.
5. Sanciones y advertencias.
6. Administración y análisis de datos.

## Referencias

| Tema | Fuente |
|------|--------|
| Requisitos | `bases/SRS_Nexora.docx.pdf` |
| Modelo | `bases/NEXORA_DR_ER-DER.jpg` |
| Objetivos de proyecto | `bases/PLAN_BASICO_SOPORTE_TECNICO.pdf` |
