# Visión — Nexora

## En una frase

Nexora es una aplicación web de intermediación de servicios de soporte técnico: conecta a quien necesita asistencia tecnológica con proveedores que pueden atenderla, y deja registro del trabajo realizado.

## Problema que resuelve

Centralizar solicitud, cotización, aceptación, ejecución y seguimiento de soporte técnico en un solo entorno, con historial de lo atendido (mantenimientos, cambios de piezas y servicios) para consulta, recontratación y análisis.

## Para quién

Decisión de equipo (2026-10-22): el solicitante puede ser **persona, establecimiento o empresa**, como define el SRS. El plan básico enfatiza PyMEs; eso no restringe el registro a solo empresas.

| Rol | Necesidad principal |
|-----|---------------------|
| Usuario solicitante | Publicar una necesidad, revisar cotizaciones, dar seguimiento, calificar y volver a contratar. Un perfil cliente tiene un solo usuario. |
| Proveedor | Organización que recibe solicitudes y cotiza. Tiene varios usuarios: administrativos y técnicos. |
| Técnico | Usuario del perfil proveedor que realiza el servicio. |
| Administrador de plataforma | Supervisa usuarios, proveedores, servicios, reportes, calificaciones y sanciones. No es un perfil cliente ni un perfil proveedor. |

## Qué no es Nexora

- Administración financiera o contable interna de las empresas proveedoras.
- Tienda en línea de productos o refacciones.
- Sustituto físico del técnico en el lugar del servicio.
- Gestión integral de inventarios empresariales del proveedor.

El ESP32-S3 con ESP-Claw **sí entra en el MVP**, como complemento de captura en campo, no como el núcleo de la intermediación. Ver ADR-003.

## Objetivos del plan básico (materia)

Tomados del plan del 17/09/2026. Son metas del proyecto, no criterios técnicos ya diseñados:

- Reducir a menos de 24 horas el tiempo en que una empresa cliente contacta a un soporte disponible.
- Incrementar en un 80 % la visibilidad de las empresas de soporte ante clientes potenciales.
- Documentar el 100 % de las soluciones brindadas.
- Que el 100 % de las solicitudes cuenten con al menos un soporte disponible.
- Calificación mutua en el 100 % de los casos atendidos.
- Incrementar en un 60 % las oportunidades de contacto de soportes con baja visibilidad previa.

La certificación legal de proveedores (RFC, acta) queda fuera de esta fase. Ver ADR-013.

## Principios ya visibles en las fuentes

1. Idioma de la interfaz y del producto: español (México).
2. El acceso a funciones depende del rol autenticado.
3. El historial guarda los servicios dados. Los reportes son mediciones de las acciones de un perfil, y son otra cosa.
4. La plataforma facilita contacto y trazabilidad; la calidad técnica del servicio la da el proveedor, no el sistema.
