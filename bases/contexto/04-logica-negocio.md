# Lógica de negocio

Reglas que el SRS afirma o que el equipo cerró.

## Reglas

### RN-001 Registro de solicitante
- Cuando: el administrador de plataforma registra un solicitante desde su vista.
- Entonces: se crea un perfil cliente con un solo usuario. El alta pide los campos de la sección Campos obligatorios y se rechaza si falta uno o es inválido.
- El solicitante no se registra por su cuenta.

### RN-002 Registro de proveedor
- Cuando: el administrador de plataforma registra un proveedor desde su vista.
- Entonces: se crea un perfil proveedor con al menos un usuario. La primera cuenta queda como administrativa. La ficha describe los servicios que ofrece y se liga a solicitudes, cotizaciones, servicios, calificaciones e historial.
- Después del alta, un administrativo de ese perfil puede crear más usuarios del mismo perfil, administrativos o técnicos. El administrador de plataforma también puede crearlos y editarlos (RN-014). No hay flujo de petición empresa → Nexora (ADR-031).
- Un usuario de este perfil no puede ser además perfil cliente.
- La persona o empresa no se registra por su cuenta.

### RN-003 Acceso por rol
- Cuando: un usuario autenticado entra a una función.
- Entonces: solo ve y ejecuta lo de su lugar: cliente, usuario de un proveedor (administrativo o técnico) o administrador de plataforma.
- La API autentica con JWT o API key a clientes web y a dispositivos autorizados.
- Con el perfil bloqueado por tres marcas distintas, ninguno de sus usuarios opera. Esa cuenta no puede crear ni unirse a otro perfil. El administrador de plataforma levanta el bloqueo cuando Nexora atiende el contacto. El conteo de marcas no vuelve a cero al desbloquear. Tres marcas son bloqueo, no baja (ADR-032).

### RN-004 Publicar solicitud
- Cuando: el usuario del perfil cliente publica soporte.
- Entonces: la solicitud queda abierta, con el problema, la categoría y la ubicación, validada antes de guardarse.
- Título, descripción, categoría y ubicación dejan de poder cambiarse cuando algún proveedor acepta. Para cambiarlos se cancela y se publica otra solicitud.

### RN-005 Aceptar o denegar
- Cuando: la solicitud está abierta y entra en lo que el proveedor puede atender. Si está dirigida a otro perfil (RN-010), este proveedor no la ve.
- Entonces: hay una sola participación por perfil proveedor y solicitud. La primera decisión válida vale para todo el perfil.
- Si aceptan: empieza un plazo de 24 horas, contado desde esa única aceptación. Aceptar otra vez no reinicia el plazo. La solicitud no queda reservada. Los demás proveedores la siguen viendo, salvo que esté dirigida.
- Si deniegan: deja de aparecerle a ese proveedor. El cliente recibe aviso de que ese proveedor la rechazó. La solicitud sigue abierta.
- El cliente puede quitar la participación de un proveedor que aceptó y aún no cotiza. Esa participación pasa a `retirada`. La solicitud sigue abierta para los demás.
- Si la solicitud pasa a `asignada` o `cancelada`: las participaciones `pendiente` y `aceptada` pasan a `retirada`, su plazo se detiene y ese vencimiento no cuenta para sanción. Las que ya están `rechazada`, `vencida`, `retirada` o `cotizada` no cambian.

### RN-006 Cotización y elección
- Cuando: el proveedor ya aceptó la solicitud, esta sigue abierta y no pasaron 24 horas desde la aceptación.
- Entonces: puede enviar una sola cotización por perfil y solicitud, con el trabajo propuesto, el costo y las condiciones. Una vez enviada no se modifica. Si el cliente la rechaza, la participación sigue `cotizada` y no puede enviar otra.
- Si las 24 horas se cumplen sin cotización: esa participación vence, la solicitud sigue abierta y el cliente recibe aviso de que ese proveedor no cotizó.
- Cotizar, retirar o vencer al mismo tiempo: vale la primera transición cuyo estado de origen todavía coincide. Cotizar solo es válido antes de que venza el plazo.
- El cliente solo elige entre cotizaciones enviadas. Puede rechazar una (la solicitud sigue abierta) o aceptar una.
- Aceptar es una sola operación. Solo ocurre si la solicitud sigue `abierta`. Una segunda aceptación simultánea no crea otro servicio.
- Si aceptar y cancelar la solicitud ocurren a la vez, vale la primera transición. Si queda `cancelada`, aceptar no hace nada. Si queda `asignada`, ya no se cancela como solicitud: se cancela el servicio.
- Al aceptar una, las demás cotizaciones `enviada` pasan a `descartada` y la solicitud queda asignada a ese proveedor.
- Si la solicitud se cancela, las cotizaciones `enviada` pasan a `descartada`.
- Repetir vencimientos sin cotizar es causa para que el administrador sancione a ese perfil. El primer vencimiento no bloquea. Un vencimiento ocurrido cuando ya no se podía cotizar no cuenta.

### RN-007 Confirmación y seguimiento
- Cuando: el cliente acepta una cotización.
- Entonces: la solicitud pasa a `asignada`, nace el servicio en `pendiente` y las demás cotizaciones `enviada` pasan a `descartada`.
- Antes de pasar a `en_curso` el servicio tiene un técnico de ese mismo perfil. Administrativo o técnico pueden mover los estados; el técnico registrado es quien realiza el servicio.
- Recorrido: `pendiente` → `en_curso` → `pendiente_informe` → `cerrado`.
- Al pasar a `cerrado` se registra el informe de servicio, la solicitud pasa a `cerrada` y cada lado queda calificado (RN-009).
- Cliente o proveedor pueden cancelar solo desde `pendiente` o `en_curso`. La otra parte recibe aviso, el servicio queda `cancelado` y la solicitud pasa de `asignada` a `cancelada`. La cotización aceptada se conserva como antecedente.
- Cancelar el servicio y abrir una reclamación son actos distintos (ADR-035). Uno no dispara el otro.
- Desde `pendiente_informe` no se cancela: se completa el informe de servicio y se cierra.

## Estados

### Participación de un proveedor en una solicitud

| Estado | Qué pasa |
|--------|----------|
| pendiente | Le aparece y no ha decidido |
| rechazada | La ocultó; el cliente recibe aviso de ese rechazo |
| aceptada | Aceptó y tiene 24 horas para cotizar. No reserva la solicitud |
| vencida | Pasaron 24 horas sin cotización. El cliente recibe aviso. La solicitud sigue abierta |
| retirada | El cliente la quitó antes de cotizar, o la solicitud se asignó o se canceló mientras esta participación seguía pendiente o aceptada |
| cotizada | Envió su cotización dentro del plazo |

Un rechazo, un vencimiento o un retiro no cambian el estado global de la solicitud. Al asignarla o cancelarla, el plazo de las que pasan a `retirada` se detiene y ese vencimiento no sanciona.

### Solicitud

| De | A | Quién |
|----|---|--------|
| — | abierta | El cliente la publica |
| abierta | asignada | El cliente acepta una cotización. Dejan de entrar cotizaciones nuevas. Las demás enviadas pasan a descartadas |
| abierta | cancelada | El cliente la retira |
| asignada | cancelada | El sistema, cuando el servicio se cancela |
| asignada | cerrada | El sistema, cuando el servicio queda cerrado |

### Cotización

| Estado | Quién lo provoca |
|--------|------------------|
| enviada | Un usuario del proveedor, después de aceptar. Una por perfil y solicitud. No se modifica |
| aceptada | El cliente. Solo una por solicitud |
| rechazada | El cliente rechaza esa propuesta. La solicitud sigue abierta. No se envía otra |
| descartada | El cliente aceptó otra, la solicitud se canceló o el proveedor quedó bloqueado |

### Servicio

Nace al aceptar la cotización.

| Estado | Significado |
|--------|-------------|
| pendiente | Asignado, sin empezar |
| en_curso | El trabajo empezó |
| pendiente_informe | El trabajo terminó y falta el informe de servicio |
| cerrado | El informe de servicio ya quedó registrado |
| cancelado | Se canceló desde `pendiente` o `en_curso`. Avisa a la otra parte. La solicitud pasa a `cancelada` |

Servicio activo, para ver el historial del cliente: `pendiente`, `en_curso` o `pendiente_informe`.

Lo mueven los usuarios del perfil proveedor (administrativo o técnico). Para pasar a `en_curso` ya hay un técnico asignado de ese perfil. Cancelar: cliente o proveedor, solo desde `pendiente` o `en_curso`. Cancelar no abre reclamación.

### Reclamación

| Estado | Quién lo provoca |
|--------|------------------|
| abierta | El cliente o un administrativo del proveedor, sobre un servicio (RN-017) |
| cerrada | El administrador de plataforma, con o sin marca |

### RN-008 Informe de servicio al cerrar
- Cuando: termina la atención.
- Entonces: se registra el **informe de servicio** (qué se hizo, ligado al proveedor, al cliente y al servicio). Ese informe es el documento de campo. No es el reporte ni el historial.
- El **historial** es la lista de servicios dados (cada uno con su informe). El **reporte** es una medición que genera el sistema, no un formulario de cierre.

### RN-009 Calificación mutua
- Cuando: el servicio se cierra.
- Entonces: cada lado puede haber calificado al otro de 1 a 5 estrellas, con comentario opcional. El cierre no espera esa acción.
- Si un lado no calificó a mano, su calificación queda en 4.5. Si calificó, se guarda el valor que eligió.
- Ni la calificación manual ni el 4.5 se cambian después del cierre.
- Cada calificación queda ligada al servicio y a quien la emite.

### RN-010 Historial y recontratación
- Cuando: el cliente consulta su historial.
- Entonces: ve sus servicios previos.
- Cuando: publica una solicitud y ya tiene al menos un servicio cerrado.
- Entonces: ve «Solicitar para:» con los perfiles proveedor de esos servicios.
- Si elige uno: la solicitud queda dirigida a ese perfil. Solo él es notificado y solo él puede aceptarla y cotizarla. Siguen el plazo de 24 horas y la cotización. Elegirlo no asigna el servicio.
- Si ese proveedor rechaza, vence o el cliente lo retira: la solicitud sigue abierta. El cliente puede elegir otro de la lista o publicarla sin destinatario.
- Si no elige ninguno: la solicitud queda abierta para cualquier proveedor.
- En esta fase la lista no se filtra por área. Más adelante solo mostrará proveedores del área de la solicitud.
- Cuando: un proveedor tiene un servicio activo con ese cliente.
- Entonces: el técnico asignado a ese servicio y los usuarios administrativos de ese perfil ven el historial y el detalle. Los demás técnicos de la misma empresa no. Cada consulta queda auditada.
- Sin servicio activo, ese acceso no existe. El administrador de plataforma no lista historiales ajenos; el acceso acotado está en RN-014 y RN-015 (ADR-024).

### RN-011 Advertencias y sanciones
- Cuando: el administrador de plataforma registra una advertencia o una sanción contra un perfil cliente o proveedor.
- Entonces: elige **una** causa del catálogo fijo y escribe una descripción detallada. Se notifica a ese perfil, se guarda y suma uno al mismo conteo. No bloquea en ese momento.
- El notificado ve la etiqueta de la causa y la descripción, atribuidas al **equipo Nexora**, no al administrador concreto. El log interno sí registra qué admin actuó (RN-014).
- A la tercera marca distinta de ese perfil: se bloquean todos sus usuarios y se les pide contactar a Nexora. Eso es bloqueo, no baja (ADR-032).
- Una misma causa no suma más de una marca, sea advertencia o sanción. La identidad de la causa es el **código** del catálogo, por perfil. El texto de la descripción no crea otra marca. Diez participaciones `vencida` siguen siendo un solo `reiteracion_vencimiento_24h`.
- Si el bloqueado es proveedor: deja de ser elegible, sus cotizaciones `enviada` pasan a `descartada` y sus plazos se detienen.
- Si el bloqueado es cliente: sus solicitudes `abierta` pasan a `cancelada` y se aplica el cierre de participaciones y cotizaciones de RN-005 y RN-006.
- Los servicios que ya están activos no se borran. Se avisa a la otra parte, que puede cancelarlos si el servicio sigue en `pendiente` o `en_curso`.
- El admin no edita el catálogo. Causas vigentes (ADR-036):

| Código | Etiqueta | Aplica a |
|--------|----------|----------|
| `reiteracion_vencimiento_24h` | Reiteración de vencimientos sin cotizar | Proveedor. Ya en RN-006: el primer vencimiento no bloquea; un vencimiento con la solicitud ya asignada o cancelada no cuenta. |
| `servicio_sin_iniciar` | Servicio asignado sin iniciar | Proveedor. El servicio se queda en `pendiente` sin pasar a `en_curso`. No hay plazo fijo; es juicio del admin. |
| `informe_no_completado` | Informe de servicio no completado | Proveedor. El servicio se queda en `pendiente_informe`. No hay plazo fijo; es juicio del admin. |
| `cancelacion_reiterada_servicio` | Cancelación reiterada de servicio | Ambos. Cancelar una vez desde `pendiente` o `en_curso` es un derecho (RN-007). La reiteración autoriza a marcar, sin número fijo. |
| `uso_indebido_reclamacion` | Uso indebido de reclamación | Ambos. Abuso del trámite de RN-017. |
| `alcance_distinto_solicitud` | El trabajo pedido no corresponde a la solicitud | Cliente. En el sitio piden algo distinto a lo publicado o cotizado. El proveedor puede cancelar el servicio (RN-007) y, en un acto aparte, abrir reclamación (RN-017). |

### RN-012 Ubicación
- Cuando: hay ubicación de un perfil o de una solicitud.
- Entonces: se **guarda** (OpenStreetMap / geocodificación) y se **muestra** en el mapa dentro de Nexora. Calle, colonia, ciudad, estado y código postal siguen obligatorios. Si hace falta latitud y longitud para el punto, se persisten (Andrés, modelo).

### RN-013 Archivos
- Cuando: hay fotos o documentos de perfil, proveedor o evidencia.
- Entonces: se suben a Cloudinary y la base guarda la referencia.

### RN-014 Administración
- Cuando: un administrador de plataforma entra al panel.
- Entonces, dentro de sus permisos:
  - Registra perfiles cliente y perfiles proveedor (RN-001, RN-002) y a otros administradores de plataforma (ADR-030).
  - Edita cuentas ya dadas de alta: nombre, correo único, teléfono y contraseña. No cambia `tipo_cuenta` ni mueve a un usuario de cliente a proveedor (ADR-029).
  - Crea y edita usuarios de un perfil proveedor, con función `administrativo` o `técnico` (RN-002, ADR-031).
  - Consulta usuarios, proveedores, solicitudes, cotizaciones, servicios, reportes, calificaciones, advertencias, sanciones, reclamaciones e ingresos simulados.
  - Registra advertencias y sanciones (RN-011), levanta un bloqueo (RN-003) y procesa una baja voluntaria (RN-015).
  - Opera dispositivos ESP32: asignar al perfil (alquiler, ADR-042), autorizar, consultar datos, enviar comandos y consultar estado (ADR-033). El flujo web no depende del dispositivo (ADR-003).
  - Edita tarifas: tramos de comisión (RN-016) y N % del alquiler (RN-018 Alquiler de ESP32). Cada cambio se audita.
  - Consulta el log de auditoría: altas, ediciones de cuenta, marcas, desbloqueo, baja procesada, edición de tarifas, operaciones de dispositivos y consultas de historial acotadas (RN-015 y ADR-023). No es un volcado de toda la API ni un listado libre de historiales.
- Esas acciones se auditan.
- En la barra no hay un icono por cada consulta. Agrupación de herramientas: ADR-039. No cambia qué puede hacer el administrador.
- El historial de un perfil lo ve solo al atender una advertencia, sanción, bloqueo o reclamación (RN-015, RN-017).

### RN-016 Ingresos simulados
- Cuando: un servicio queda `cerrado`.
- Entonces: la herramienta de ingresos del administrador contabiliza una comisión simulada sobre el costo (MXN) de la cotización aceptada de ese servicio, «como si» hubiera habido un pago real. No hay cobro, pasarela ni movimiento de dinero.
- Solo entran servicios `cerrado`. Cotizaciones aceptadas con servicio aún abierto no suman al total; no hay vista de proyección en esta fase.
- Un servicio `cancelado` no genera comisión simulada.
- El porcentaje es escalonado según el costo de esa cotización. Valores por defecto (ADR-027):

| Costo de la cotización (MXN) | % comisión |
|------------------------------|------------|
| Hasta $1,999 | 5 % |
| $2,000 – $7,999 | 7 % |
| $8,000 – $24,999 | 8 % |
| $25,000 o más | 9 % |

- El administrador edita en la UI los tramos y sus porcentajes (misma entidad de tarifas que el N % de RN-018 Alquiler de ESP32). Cada cambio se audita. Los ingresos ya contabilizados no se recalculan al cambiar la tabla; el % vigente al cerrar el servicio es el que queda registrado.

### RN-015 Datos personales
- Se guardan cuenta (nombre, correo, teléfono, contraseña hasheada), perfil, ubicación, solicitudes, cotizaciones, servicios, historial, calificaciones, advertencias, sanciones y la referencia de archivos en Cloudinary.
- El cliente ve lo suyo.
- Con servicio activo, el técnico asignado y los administrativos de ese proveedor ven el historial de ese cliente. Otros técnicos de la misma empresa no. Cada consulta se audita.
- El administrador de plataforma ve historial ajeno solo al atender una advertencia, sanción, bloqueo o reclamación. En una reclamación ve el historial de **ambos** perfiles de ese servicio, no un padrón libre (RN-017). Cada consulta se audita.
- Mientras la cuenta está activa, se conservan sus datos.
- Baja voluntaria: la pide el usuario del perfil cliente o un administrativo del perfil proveedor, sobre **ese perfil** (todos sus usuarios). Un técnico que deja la empresa no es baja del perfil. El administrador de plataforma la procesa. El pedido queda registrado y visible; el corte de acceso y el reloj de 12 meses corren al **procesar**, no al pedir (ADR-032).
- Al procesar la baja, las cuentas de ese perfil dejan de entrar. A los 12 meses se borran nombre, correo, teléfono y archivos de perfil. El historial de servicios ya cerrados se queda sin esos datos de contacto.
- Contraseñas y tokens no se conservan después de la baja.
- Tres marcas no disparan baja. El admin no da de baja por el bloqueo; puede levantar el bloqueo (RN-003, RN-011).

### RN-017 Reclamación
- Cuando: hay un servicio (`pendiente`, `en_curso`, `pendiente_informe`, `cerrado` o `cancelado`).
- Entonces: el usuario del perfil cliente o un administrativo del perfil proveedor de **ese** servicio puede abrir una reclamación ligada a ese servicio. El técnico no la abre. No hay reclamación anónima ni de oficio por el administrador.
- Al abrir elige **una** categoría del catálogo fijo y escribe un texto de motivo. El servicio y el reclamante salen del acto. Sin categoría o sin motivo no se abre.
- El admin no edita el catálogo. La categoría no dispara marca ni elige sola la causa de RN-011 Advertencias y sanciones.
- Al cerrar **con marca**, el admin elige tipo y causa de RN-011 Advertencias y sanciones sobre el perfil que corresponda. La categoría solo orienta. Si el trámite se usó de forma indebida, la causa es `uso_indebido_reclamacion`, sea cual sea la categoría.
- Categorías vigentes (ADR-037):

| Código | Etiqueta | Suele abrirla | Encaje RN-011 si hay marca |
|--------|----------|---------------|----------------------------|
| `sin_iniciar` | Servicio asignado sin iniciar | cliente | `servicio_sin_iniciar` |
| `informe_pendiente` | Informe de servicio no completado | cliente | `informe_no_completado` |
| `estancado_en_curso` | Servicio en curso sin avanzar | cliente | ninguna; suele ir sin marca |
| `alcance_distinto` | El trabajo pedido no corresponde a la solicitud | administrativo del proveedor | `alcance_distinto_solicitud` |
| `impedimento_ejecucion` | Impedimento para realizar el servicio | administrativo del proveedor | ninguna; suele ir sin marca |
| `cancelacion_servicio` | Cancelación del servicio | ambos | `cancelacion_reiterada_servicio` |

- Estados: `abierta` → `cerrada`. No se reabre. Un servicio no tiene dos reclamaciones `abierta` a la vez.
- Abrir una reclamación no cancela el servicio. Cancelar el servicio no abre una reclamación. Son dos actos (ADR-035).
- El administrador atiende la reclamación `abierta`. En ese contexto ve el historial de ambos perfiles de ese servicio. Cada consulta se audita. Eso no es un listado libre de historiales.
- Al cerrar elige un desenlace: **sin marca** o **con marca** (advertencia o sanción) sobre el perfil que corresponda. Si hay marca, aplica RN-011.
- Fuera de esta fase: chat o hilo, apelación del 4.5, adjuntos extra (valen las evidencias ya ligadas al servicio), SLA, reasignar técnico, indemnizaciones.

### RN-018 Alquiler de ESP32
- Cuando: el administrador asigna un dispositivo a un perfil cliente o proveedor.
- Entonces: ese perfil **alquila** el aparato (no es una suscripción ni una cuota fija). ADR-033: el admin es quien asigna.
- El cobro es simulado: gasto de tokens de IA + **N %**. El administrador edita N % en tarifas (la misma entidad que los tramos de RN-016 Ingresos simulados). No hay pasarela.
- RN-016 (comisión sobre la cotización al cerrar) es **otra** cuenta. No se mezclan los montos.
- Sin aparato asignado, el perfil sigue usando la web.

### RN-019 Canal de voz
- Cuando: un perfil con ESP32 alquilado habla al aparato.
- Entonces: audio del ESP32 → texto (STT) → agente de IA (Deepseek) → texto → voz (TTS) → bocina del ESP32.
- Cliente: el agente ayuda a dejar una **solicitud** más clara; la solicitud sigue siendo RN-004 Publicar solicitud (mismos campos y estados).
- Proveedor / técnico: el agente ayuda a dictar el **informe de servicio** (RN-008 Informe de servicio al cerrar).
- La web puede publicar, cotizar y cerrar **sin** el aparato (ADR-003).

## Campos obligatorios

**Usuario:** nombre, correo único, contraseña, teléfono.

**Perfil cliente** (un usuario): tipo `persona | empresa`. Si es empresa, nombre comercial.

**Perfil proveedor:** tipo `persona | empresa`, nombre comercial o razón social, descripción de servicios, al menos una categoría.

**Ubicación** (obligatoria en ambos perfiles y en la solicitud): calle y número, colonia, ciudad, estado, código postal. Se guarda y se muestra con OpenStreetMap; latitud y longitud si el punto del mapa las necesita.

**Usuario del proveedor,** además: función `administrativo | técnico`.

**Solicitud:** título, descripción del problema, categoría, ubicación del servicio (precarga la del cliente y se puede cambiar).

**Cotización:** descripción del trabajo, costo en MXN, condiciones (plazo y alcance en texto).

**Informe de servicio** (obligatorio para cerrar): descripción de lo realizado, tipo `mantenimiento | cambio de pieza | otro servicio`, detalle de la pieza solo si hubo cambio, fecha, usuario técnico que lo realizó.

**Reporte** (medición, no formulario de cierre): perfil medido, acción de referencia, nombre de la métrica, valor, fecha. Lo genera el sistema al ocurrir la acción. El cierre del servicio exige el informe de servicio, no un reporte capturado a mano.

**Reclamación** (al abrir): categoría del catálogo fijo de RN-017 Reclamación y texto de motivo. El servicio y el reclamante salen del acto (usuario autenticado sobre ese servicio). Sin categoría o sin motivo se rechaza. El admin no edita el catálogo. No hay ítem «Otro».
