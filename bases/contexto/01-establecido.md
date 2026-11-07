# Establecido

Hechos cerrados al 2026-11-07. Lo que sigue en duda está en `02-pendiente.md`. Los porqués están en `06-decisiones.md`. Esta entrega de cuatrimestre es el **producto**, no un MVP recortado.

## Producto

- Aplicación web de intermediación de soporte técnico.
- Solicitante: persona o empresa (ADR-028).
- Un usuario pertenece a un perfil cliente o a un perfil proveedor, nunca a los dos (ADR-007). `tipo_cuenta`: `cliente | empresa | negocio | administrador`. El valor `proveedor` queda fuera de uso (ADR-044). `cliente`: un usuario, perfil cliente. `empresa`: perfil proveedor con muchos usuarios (administrativos y técnicos). `negocio`: perfil proveedor con un usuario, función `administrativo_campo`. `administrador`: sin esos perfiles.
- El administrador de la plataforma no es ninguno de esos dos perfiles. Puede registrar a otros administradores desde el panel. No hay auto-registro de administradores (ADR-030).
- Altas desde la vista de ese administrador: elige `tipo_cuenta` cliente, empresa o negocio, u otro administrador. No hay auto-registro (ADR-025).
- Tras el alta de una `empresa`, un administrativo de ese perfil suma usuarios (administrativos o técnicos). El administrador de plataforma también puede crearlos y editarlos. Un `negocio` no suma usuarios. No hay flujo de petición empresa → Nexora para altas de extras (ADR-031, ADR-044).
- El administrador de plataforma edita cuentas ya dadas de alta: nombre, correo (sigue único), teléfono y contraseña (hasheada). No cambia `tipo_cuenta` salvo **empresa ↔ negocio** (ADR-044). No pasa un usuario de cliente a empresa/negocio ni hacia administrador (ADR-029 acotado).
- Conversión empresa ↔ negocio: la pide un administrativo de esa `empresa` o el `administrativo_campo` de ese `negocio`. El administrador de plataforma autoriza o rechaza. El pedido queda visible; el cambio corre al autorizar. A negocio: solo la primera cuenta del alta; las extras se eliminan y esa eliminación se confirma en la autorización si hay más de un usuario.
- `administrativo_campo` (etiqueta «Administrativo de Campo»): hace lo de administrativo y es el técnico del servicio (estados, informe, historial como asignado). Puede abrir reclamación.
- Flujo: solicitud abierta → varios proveedores pueden aceptarla y cotizar → el solicitante elige una cotización enviada → seguimiento del servicio → informe de servicio al cerrar → calificación mutua → queda en el historial.
- Aceptar no aparta la solicitud. Sigue visible para los demás proveedores hasta que el cliente elige una cotización enviada.
- Tras aceptar, el proveedor tiene 24 horas para cotizar. Si no lo hace, su participación vence, la solicitud sigue abierta y el cliente recibe aviso.
- El cliente puede quitar a ese proveedor antes de las 24 horas, sin cerrar la solicitud para los demás.
- Denegar una solicitud la oculta para ese proveedor y avisa al cliente que ese proveedor la rechazó. La solicitud sigue abierta para los demás.
- Repetir el vencimiento de las 24 horas sin cotizar es causa de sanción. No bloquea en el primer vencimiento.
- La máquina de estados de participación, solicitud, cotización y servicio está cerrada. Vive en `04-logica-negocio.md` (ADR-016).
- Los campos obligatorios de usuario, perfiles, ubicación, solicitud, cotización, informe de servicio y reporte están cerrados. Viven en `04-logica-negocio.md` (ADR-017, ADR-038).
- Calificación mutua de 1 a 5 estrellas. El comentario es opcional. El servicio se cierra aunque una parte no califique; si no hay calificación manual, queda 4.5 y ya no se puede cambiar.
- Un proveedor ve el historial del cliente, durante un servicio activo, por el técnico asignado y por los usuarios administrativos de ese perfil. Los demás técnicos de la misma empresa no. Cada consulta se audita.
- Los huecos de carrera, cancelación, cotización única y bloqueo están cerrados en `04-logica-negocio.md` (ADR-019).
- Historial, informe de servicio y reporte son distintos. El historial es la lista de servicios dados. El informe de servicio es el documento de campo al cerrar. El reporte son las mediciones de las acciones de un perfil (ADR-038).
- Recontratación: al publicar una solicitud, si el cliente ya cerró servicios, ve «Solicitar para:» con los proveedores con los que trabajó. Elegir uno dirige la solicitud a ese proveedor, sin saltarse la cotización ni las 24 horas. Filtrar esa lista por el área de la solicitud queda para una fase posterior.
- Una advertencia o una sanción se notifica al proveedor o al cliente y no bloquea en el momento. Cada una suma al mismo conteo. A la tercera marca distinta se bloquean todos los usuarios de ese perfil y se les pide contactar a Nexora. El administrador levanta el bloqueo; el conteo no vuelve a cero por eso. Tres marcas son bloqueo, no baja (ADR-032). El catálogo de causas es fijo (ADR-036); el detalle vive en `04-logica-negocio.md`.
- Reclamación: trámite sobre un servicio. Al abrir: categoría de un catálogo fijo y texto de motivo (ADR-037). La abren el usuario del perfil cliente o un administrativo del proveedor. Retirarse del servicio y reclamar son actos distintos (ADR-035). El detalle vive en `04-logica-negocio.md`.
- La frase del plan sobre «reservaciones de recursos o servicios compartidos» no describe a Nexora. El producto es intermediación de soporte técnico.
- Datos personales: se conservan mientras la cuenta está activa. Hay dos actos. Baja de perfil (voluntaria): la pide el usuario del perfil cliente, un administrativo de una `empresa` o el `administrativo_campo` de un `negocio`; el administrador de plataforma la procesa. El corte de acceso y el reloj de 12 meses corren al procesar, no al pedir (ADR-032). A los 12 meses se borran nombre, correo, teléfono y archivos de perfil; el historial cerrado se queda sin esos datos de contacto. Baja de usuario: solo cuentas extra de una `empresa`, nunca la primera del alta; la ejecuta un administrativo de ese perfil; esa cuenta deja de entrar al momento y no corre el reloj de 12 meses. Si ese técnico tiene un servicio activo, en el mismo acto se asigna otro técnico del mismo perfil; si no, la baja se rechaza. Un `negocio` no tiene baja de usuario. Al procesar baja de perfil `negocio`: servicios `pendiente` o `en_curso` se cancelan; la cotización aceptada se conserva; si está `pendiente_informe`, se registra el informe por defecto y el servicio queda `cancelado` (ADR-044). El detalle está en `04-logica-negocio.md` (ADR-024, ADR-032, ADR-043, ADR-044).
- El DER de `bases/` es una base. Se agregan, modifican o eliminan entidades cuando el desarrollo lo pida.
- Panel de administración: las mismas facultades de RN-014. En la barra del administrador: Inicio, Usuarios, Trabajos, Reportes, Ingresos, Dispositivos y Auditoría. Usuarios es el padrón (altas, edición, marcas y bloqueo del perfil). Trabajos junta solicitud, cotización y servicio; el detalle de ese caso muestra calificación, reclamación y la marca originada en ese caso. Auditoría es el log (ADR-034), no el historial. El detalle vive en `04-logica-negocio.md` (RN-014, ADR-029 a ADR-034, ADR-039).
- No hay pasarela de pagos en esta fase (proyecto académico). Sí hay ingresos simulados: comisión escalonada 5–9 % sobre la cotización al cerrar el servicio (ADR-026, ADR-027) y, aparte, tokens de IA + N % por el alquiler del ESP32 (ADR-042). El administrador edita tramos y N % en tarifas. El detalle vive en `04-logica-negocio.md`.
- El administrador asigna un ESP32 a un perfil cliente o proveedor (alquiler, no suscripción). Canal de voz en esta fase: audio → texto → agente Deepseek → voz → bocina (ADR-041). La web no depende del aparato (ADR-003).
- Idioma: español.
- La interfaz es responsive (escritorio y celular).

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
| Mapas | OpenStreetMap: guardar y mostrar ubicaciones (ADR-040). |
| Correo | Google (notificaciones, confirmaciones, recordatorios, recuperación de contraseña). |
| IA | Deepseek (API key). Estimaciones a partir de reportes y agente de voz del ESP32 (ADR-040, ADR-041). |
| Campo | ESP32-S3 + ESP-Claw. Wi-Fi, REST/JSON, JWT o API key. Canal de voz ida y vuelta. El admin asigna el aparato al perfil. |

## Interfaz

- Mockups en Figma antes de la UI funcional.
- Paleta: `#0A0A0A` Onyx, `#FBFBFB` White, `#3573A4` Rich Cerulean, `#FFD342` Golden Pollen, `#6795BA` Blue Grey, `#FFD753` Mustard, `#98B7D0` Powder Blue, `#FFDB63` Mustard terciario.
- Cada rol ve solo las opciones de sus módulos.
- Contraste, texto legible y controles identificables.
- Responsive: usable en escritorio y en celular.

## Límites duros

- Sin contabilidad de proveedores.
- Sin venta directa de refacciones o productos.
- Sin hardware especializado como núcleo del producto. El ESP32 es canal de voz alquilado; la intermediación web no depende de él.
- Sin sustituir al técnico en sitio.
- Sin inventario empresarial completo del proveedor.
- Funciones limitadas por rol.
- Sin certificación de proveedores en esta fase (ni RFC ni acta ni sello).
- Historial, informes de servicio y reportes se conservan ligados al perfil y, cuando aplica, al servicio.

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
