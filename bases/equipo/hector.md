# Héctor

GitHub: [HectorMtz01](https://github.com/HectorMtz01). Rama: `hector/{actividad}`.

Backend de cliente y proveedor. Sin React. Sin ESP32. Sin adaptadores externos.

## Hace

1. **H1** Publicar, listar, cancelar solicitud.
2. **H2** Mercado: aceptar y denegar (una vez por perfil; 24 h no se reinician; aceptar no reserva).
3. **H3** Cotizar (una, no se edita).
4. **H4** Elegir cotización → nace el servicio.
5. **H5** Servicio: técnico, estados, informe, calificar.
6. **H6–H8** Vencer 24 h, historial, usuarios del proveedor.
7. **H14** Al cerrar: comisión RN-016 y N % de alquiler RN-018. No recalcular el pasado.

Cada PR lleva tests. Si el adaptador de David aún no está, el acto igual se completa.

## No toca

`frontend/`, `firmware/`, `admin.py`, `adaptadores/`, Google, Cloudinary, OSM, Deepseek.

## Archivos

Nuevos: `backend/app/api/v1/solicitudes.py`, `proveedor.py`. No reescribas `servicios.py` (reclamaciones).

## Primero

`hector/api-solicitudes`

Listo: un cliente crea y lista su solicitud; otro no la ve; un proveedor recibe 403. Tests. Sin frontend. Sin correo.
