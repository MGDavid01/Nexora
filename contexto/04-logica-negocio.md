# Lógica de negocio

Reglas que el SRS afirma o que el equipo cerró.

## Reglas

### RN-001 Registro de solicitante
- Cuando: el administrador de plataforma registra un solicitante desde su vista.
- Entonces: se crea un perfil cliente con un solo usuario. El alta pide los campos de la sección Campos obligatorios y se rechaza si falta uno o es inválido.
- El solicitante no se registra por su cuenta.

### RN-002 Registro de proveedor
- Cuando: el administrador de plataforma registra un proveedor desde su vista.
- Entonces: se crea un perfil proveedor con al menos un usuario. Ese perfil puede sumar más usuarios, administrativos o técnicos. La ficha describe los servicios que ofrece y se liga a solicitudes, cotizaciones, servicios, calificaciones e historial.
- Un usuario de este perfil no puede ser además perfil cliente.
- La persona o empresa no se registra por su cuenta.

### RN-003 Acceso por rol
- Cuando: un usuario autenticado entra a una función.
- Entonces: solo ve y ejecuta lo de su lugar: cliente, usuario de un proveedor (administrativo o técnico) o administrador de plataforma.
- La API autentica con JWT o API key a clientes web y a dispositivos autorizados.
- Con el perfil bloqueado por tres sanciones, ninguno de sus usuarios opera. Esa cuenta no puede crear ni unirse a otro perfil. El administrador de plataforma levanta el bloqueo cuando Nexora atiende el contacto. El conteo de sanciones no vuelve a cero al desbloquear.

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
- Recorrido: `pendiente` → `en_curso` → `pendiente_historial` → `cerrado`.
- Al pasar a `cerrado` se registra el historial, la solicitud pasa a `cerrada` y cada lado queda calificado (RN-009).
- Cliente o proveedor pueden cancelar solo desde `pendiente` o `en_curso`. La otra parte recibe aviso, el servicio queda `cancelado` y la solicitud pasa de `asignada` a `cancelada`. La cotización aceptada se conserva como antecedente.
- Desde `pendiente_historial` no se cancela: se completa el historial y se cierra.

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
| pendiente_historial | El trabajo terminó y falta el registro en el historial |
| cerrado | El historial ya quedó registrado |
| cancelado | Se canceló desde `pendiente` o `en_curso`. Avisa a la otra parte. La solicitud pasa a `cancelada` |

Servicio activo, para ver el historial del cliente: `pendiente`, `en_curso` o `pendiente_historial`.

Lo mueven los usuarios del perfil proveedor (administrativo o técnico). Para pasar a `en_curso` ya hay un técnico asignado de ese perfil. Cancelar: cliente o proveedor, solo desde `pendiente` o `en_curso`.

### RN-008 Historial al cerrar
- Cuando: termina la atención.
- Entonces: se registra el servicio en el historial (qué se hizo, ligado al proveedor, al cliente y al servicio).
- Los reportes son otra cosa: mediciones de las acciones del perfil, no este registro.

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
- Sin servicio activo, ese acceso no existe. Si el administrador de plataforma también lo ve, sigue en P-015.

### RN-011 Advertencias y sanciones
- Cuando: el administrador de plataforma registra una advertencia o una sanción contra un perfil cliente o proveedor.
- Entonces: se notifica a ese perfil, se guarda y suma uno al mismo conteo. No bloquea en ese momento.
- A la tercera marca distinta de ese perfil: se bloquean todos sus usuarios y se les pide contactar a Nexora.
- Una misma causa no suma más de una marca, sea advertencia o sanción.
- Si el bloqueado es proveedor: deja de ser elegible, sus cotizaciones `enviada` pasan a `descartada` y sus plazos se detienen.
- Si el bloqueado es cliente: sus solicitudes `abierta` pasan a `cancelada` y se aplica el cierre de participaciones y cotizaciones de RN-005 y RN-006.
- Los servicios que ya están activos no se borran. Se avisa a la otra parte, que puede cancelarlos si el servicio sigue en `pendiente` o `en_curso`.
- La reiteración de vencimientos sin cotizar ya es causa (RN-006). El resto de causas no está listado.

### RN-012 Ubicación del proveedor
- Cuando: se consulta un proveedor.
- Entonces: el mapa (OpenStreetMap) muestra su ubicación dentro de Nexora.

### RN-013 Archivos
- Cuando: hay fotos o documentos de perfil, proveedor o evidencia.
- Entonces: se suben a Cloudinary y la base guarda la referencia.

### RN-014 Administración
- Cuando: un administrador de plataforma entra al panel.
- Entonces: registra perfiles cliente y perfiles proveedor (RN-001, RN-002) y consulta usuarios, proveedores, solicitudes, cotizaciones, servicios, reportes, calificaciones, advertencias, sanciones e ingresos simulados de la plataforma, dentro de sus permisos. Esas acciones se auditan.
- El historial de un perfil lo ve solo al atender una advertencia, sanción, bloqueo o reclamación de ese perfil (RN-015).

### RN-016 Ingresos simulados
- Cuando: un servicio queda `cerrado`.
- Entonces: la herramienta de ingresos del administrador contabiliza una comisión simulada sobre el costo (MXN) de la cotización aceptada de ese servicio, «como si» hubiera habido un pago real. No hay cobro, pasarela ni movimiento de dinero.
- Solo entran servicios `cerrado`. Cotizaciones aceptadas con servicio aún abierto no suman al total; no hay vista de proyección en el MVP.
- Un servicio `cancelado` no genera comisión simulada.
- El porcentaje es escalonado según el costo de esa cotización. Valores por defecto (ADR-027):

| Costo de la cotización (MXN) | % comisión |
|------------------------------|------------|
| Hasta $1,999 | 5 % |
| $2,000 – $7,999 | 7 % |
| $8,000 – $24,999 | 8 % |
| $25,000 o más | 9 % |

- El administrador edita en la UI los tramos y sus porcentajes. Cada cambio se audita. Los ingresos ya contabilizados no se recalculan al cambiar la tabla; el % vigente al cerrar el servicio es el que queda registrado.

### RN-015 Datos personales
- Se guardan cuenta (nombre, correo, teléfono, contraseña hasheada), perfil, ubicación, solicitudes, cotizaciones, servicios, historial, calificaciones, advertencias, sanciones y la referencia de archivos en Cloudinary.
- El cliente ve lo suyo.
- Con servicio activo, el técnico asignado y los administrativos de ese proveedor ven el historial de ese cliente. Otros técnicos de la misma empresa no. Cada consulta se audita.
- El administrador de plataforma ve el historial de un perfil solo al atender una advertencia, sanción, bloqueo o reclamación de ese perfil. Cada consulta se audita. No hay un listado libre de historiales ajenos.
- Mientras la cuenta está activa, se conservan sus datos.
- Al pedir la baja, la cuenta deja de entrar en el momento. A los 12 meses se borran nombre, correo, teléfono y archivos de perfil. El historial de servicios ya cerrados se queda sin esos datos de contacto.
- Contraseñas y tokens no se conservan después de la baja.

## Campos obligatorios

**Usuario:** nombre, correo único, contraseña, teléfono.

**Perfil cliente** (un usuario): tipo `persona | establecimiento | empresa`. Si no es persona, nombre comercial.

**Perfil proveedor:** tipo `persona | empresa`, nombre comercial o razón social, descripción de servicios, al menos una categoría.

**Ubicación** (obligatoria en ambos perfiles): calle y número, colonia, ciudad, estado, código postal.

**Usuario del proveedor,** además: función `administrativo | técnico`.

**Solicitud:** título, descripción del problema, categoría, ubicación del servicio (precarga la del cliente y se puede cambiar).

**Cotización:** descripción del trabajo, costo en MXN, condiciones (plazo y alcance en texto).

**Historial** (obligatorio para cerrar el servicio): descripción de lo realizado, tipo `mantenimiento | cambio de pieza | otro servicio`, detalle de la pieza solo si hubo cambio, fecha, usuario técnico que lo realizó.

**Reporte** (medición, no formulario de cierre): perfil medido, acción de referencia, nombre de la métrica, valor, fecha. Lo genera el sistema al ocurrir la acción. El cierre del servicio exige historial, no un reporte capturado a mano.

## Lo que no hay que asumir

- El catálogo cerrado de causas de advertencia y sanción. La reiteración de vencimientos sin cotizar ya es una causa (RN-006).
