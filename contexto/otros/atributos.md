# Atributos de las entidades

Columnas del modelo vigente (`backend/app/models/entities.py`), al 2026-10-27. Las reglas de negocio y los campos que el alta exige están en [`04-logica-negocio.md`](../04-logica-negocio.md). Aquí solo está la forma de cada tabla.

`id` es UUID y clave primaria, salvo en `PerfilProveedorCategoria`, cuya clave es la pareja de las dos columnas.

## PerfilCliente

Tabla `perfil_cliente`.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| tipo | `persona` \| `empresa` | sí | |
| nombre_comercial | texto | no | El alta lo pide si el tipo es `empresa`. |
| bloqueado | booleano | sí | Por defecto `false`. |
| conteo_marcas | entero | sí | Por defecto `0`. Advertencias y sanciones suman aquí. |
| creado_en | fecha-hora | sí | La base lo pone al insertar. |

## PerfilProveedor

Tabla `perfil_proveedor`.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| tipo | `persona` \| `empresa` | sí | |
| nombre_comercial | texto | sí | Nombre comercial o razón social. |
| descripcion | texto | sí | Servicios que ofrece. |
| bloqueado | booleano | sí | Por defecto `false`. |
| conteo_marcas | entero | sí | Por defecto `0`. |
| creado_en | fecha-hora | sí | La base lo pone al insertar. |

## Usuario

Tabla `usuario`. Una cuenta es cliente, proveedor o administrador.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| nombre | texto | sí | |
| correo | texto | sí | Único. |
| contrasena_hash | texto | sí | Nunca la contraseña en claro. |
| telefono | texto | sí | |
| tipo_cuenta | `cliente` \| `proveedor` \| `administrador` | sí | |
| funcion | `administrativo` \| `tecnico` | solo proveedor | Nula en cliente y en administrador. |
| perfil_cliente_id | UUID | solo cliente | Único. Apunta a `perfil_cliente`. |
| perfil_proveedor_id | UUID | solo proveedor | Apunta a `perfil_proveedor`. Varios usuarios pueden compartir el perfil. |
| baja_solicitada_en | fecha-hora | no | Momento en que pidió la baja. |
| creado_en | fecha-hora | sí | La base lo pone al insertar. |

## TokenRecuperacion

Tabla `token_recuperacion`.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| usuario_id | UUID | sí | Apunta a `usuario`. |
| token_hash | texto | sí | |
| expira_en | fecha-hora | sí | |
| usado | booleano | sí | Por defecto `false`. |

## Ubicacion

Tabla `ubicacion`. Cada fila pertenece a un solo dueño: un perfil cliente, un perfil proveedor o una solicitud.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| calle_numero | texto | sí | |
| colonia | texto | sí | |
| ciudad | texto | sí | |
| estado | texto | sí | |
| codigo_postal | texto | sí | |
| perfil_cliente_id | UUID | uno de los tres | Único. Apunta a `perfil_cliente`. |
| perfil_proveedor_id | UUID | uno de los tres | Único. Apunta a `perfil_proveedor`. |
| solicitud_id | UUID | uno de los tres | Único. Apunta a `solicitud`. |

## CategoriaServicio

Tabla `categoria_servicio`.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| nombre | texto | sí | Único. |

## PerfilProveedorCategoria

Tabla `perfil_proveedor_categoria`. Realiza el N:M entre perfil proveedor y categoría.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| perfil_proveedor_id | UUID | sí | Parte de la clave. Apunta a `perfil_proveedor`. |
| categoria_id | UUID | sí | Parte de la clave. Apunta a `categoria_servicio`. |

## EquipoComputo

Tabla `equipo_computo`.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| perfil_cliente_id | UUID | sí | Apunta a `perfil_cliente`. |
| nombre | texto | sí | |

## Solicitud

Tabla `solicitud`.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| perfil_cliente_id | UUID | sí | Quien la crea. Apunta a `perfil_cliente`. |
| categoria_id | UUID | sí | Apunta a `categoria_servicio`. |
| dirigida_a_perfil_proveedor_id | UUID | no | Recontratación. Apunta a `perfil_proveedor`. |
| titulo | texto | sí | |
| descripcion | texto | sí | Problema. |
| estado | `abierta` \| `asignada` \| `cancelada` \| `cerrada` | sí | Por defecto `abierta`. |
| datos_cerrados | booleano | sí | Por defecto `false`. Pasa a `true` cuando algún proveedor acepta: título, descripción, categoría y ubicación ya no cambian. |
| creado_en | fecha-hora | sí | La base lo pone al insertar. |

La ubicación del servicio es una fila de `Ubicacion` con `solicitud_id`.

## Participacion

Tabla `participacion`. Una por perfil proveedor y solicitud.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| solicitud_id | UUID | sí | Apunta a `solicitud`. |
| perfil_proveedor_id | UUID | sí | Apunta a `perfil_proveedor`. |
| estado | `pendiente` \| `rechazada` \| `aceptada` \| `vencida` \| `retirada` \| `cotizada` | sí | Por defecto `pendiente`. |
| aceptada_en | fecha-hora | no | Inicio del plazo de 24 horas. |

## Cotizacion

Tabla `cotizacion`. Una por perfil proveedor y solicitud.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| solicitud_id | UUID | sí | Apunta a `solicitud`. |
| perfil_proveedor_id | UUID | sí | Apunta a `perfil_proveedor`. |
| participacion_id | UUID | sí | Único. Apunta a `participacion`. |
| descripcion | texto | sí | Trabajo propuesto. |
| costo_mxn | decimal (12, 2) | sí | |
| condiciones | texto | sí | Plazo y alcance. |
| estado | `enviada` \| `aceptada` \| `rechazada` \| `descartada` | sí | Por defecto `enviada`. |
| creado_en | fecha-hora | sí | La base lo pone al insertar. |

## Servicio

Tabla `servicio`.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| solicitud_id | UUID | sí | Único. Apunta a `solicitud`. |
| cotizacion_id | UUID | sí | Único. Apunta a `cotizacion`. |
| perfil_proveedor_id | UUID | sí | Apunta a `perfil_proveedor`. |
| tecnico_usuario_id | UUID | no | Apunta a `usuario`. Hace falta antes de pasar a `en_curso`. |
| estado | `pendiente` \| `en_curso` \| `pendiente_historial` \| `cerrado` \| `cancelado` | sí | Por defecto `pendiente`. |
| creado_en | fecha-hora | sí | La base lo pone al insertar. |

## HistorialServicio

Tabla `historial_servicio`. Una por servicio.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| servicio_id | UUID | sí | Único. Apunta a `servicio`. |
| tecnico_usuario_id | UUID | sí | Quien lo realizó. Apunta a `usuario`. |
| descripcion | texto | sí | Lo realizado. |
| tipo | `mantenimiento` \| `cambio_de_pieza` \| `otro_servicio` | sí | |
| detalle_pieza | texto | no | Solo si el tipo es `cambio_de_pieza`. |
| fecha | fecha-hora | sí | |

## Calificacion

Tabla `calificacion`. Una por lado y por servicio.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| servicio_id | UUID | sí | Apunta a `servicio`. |
| lado | `cliente` \| `proveedor` | sí | Quién califica. |
| valor | decimal (2, 1) | sí | De 1 a 5, o 4.5 si ese lado no calificó. |
| comentario | texto | no | |
| es_automatica | booleano | sí | `true` cuando el valor es el 4.5 del sistema. |

## Sancion

Tabla `sancion`. Una fila es advertencia o sanción, y apunta a un solo perfil.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| tipo | `advertencia` \| `sancion` | sí | Las dos suman a `conteo_marcas`. |
| causa | texto | sí | |
| perfil_cliente_id | UUID | uno de los dos | Apunta a `perfil_cliente`. |
| perfil_proveedor_id | UUID | uno de los dos | Apunta a `perfil_proveedor`. |
| creada_en | fecha-hora | sí | La base lo pone al insertar. |

## Reporte

Tabla `reporte`. Lo genera el sistema. Apunta a un solo perfil.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| perfil_cliente_id | UUID | uno de los dos | Apunta a `perfil_cliente`. |
| perfil_proveedor_id | UUID | uno de los dos | Apunta a `perfil_proveedor`. |
| accion | texto | sí | Acción de referencia. |
| metrica | texto | sí | Nombre de la métrica. |
| valor | texto | sí | |
| fecha | fecha-hora | sí | |

## DispositivoEsp32

Tabla `dispositivo_esp32`.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|--------|
| id | UUID | sí | |
| perfil_proveedor_id | UUID | sí | Apunta a `perfil_proveedor`. |
| identificador | texto | sí | Único. |
| nombre | texto | sí | |
