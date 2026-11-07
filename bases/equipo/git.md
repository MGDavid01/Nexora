# Git (borrador)

- Repo: `https://github.com/MGDavid01/Nexora.git`
- Se trabaja contra `master`. Nadie hace push a `master`.
- No se borran ramas remotas ni PRs. No `push --force`.

## Rama

```text
{quien}/{actividad}
```

`david` · `ariel` · `andres` · `hector`. Una rama = una fila de [`actividades.md`](actividades.md).

```text
git fetch origin
git checkout master
git pull origin master
git checkout -b {quien}/{actividad}
```

PR a `master`: qué hiciste, qué RN, qué no tocaste. No lo mergeas tú. Conflicto: abortar y avisar.

Tras el merge, la rama remota se queda. La siguiente sale de `master` otra vez.

## Capa

PR de API: sin archivos en `frontend/`. PR de pantalla: sin archivos en `backend/`. Ariel pone la ruta cuando la API ya está en `master`.

## Orden

1. Héctor: H1, luego H2. Andrés: seed. David: desbloqueo (luego externos).
2. Ariel conecta cuando esa API está en `master`.
3. Google, Cloudinary, OSM, Deepseek: David. H1 no los espera.
4. Andrés no empieza el ESP32 hasta H5.
