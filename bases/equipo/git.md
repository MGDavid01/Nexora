# Git (borrador)

- Repo: `https://github.com/MGDavid01/Nexora.git`
- Se trabaja contra `master`. Nadie hace push a `master`.
- No `push --force` a `master`.

## Rama

```text
{quien}/{actividad}
```

`david` · `ariel` · `andres` · `hector`. Una rama = una actividad = una fila de [`actividades.md`](actividades.md).

```text
git fetch origin
git checkout master
git pull origin master
git checkout -b {quien}/{actividad}
```

## PR

PR a `master`: qué hiciste, qué RN, qué no tocaste.

- **No mergeas tu propio PR.** Lo revisa y mergea otro (en el plan: David, D0).
- Misma actividad: puedes seguir empujando commits a la rama; el PR abierto los acumula.
- Otra actividad: otra rama desde `master` actualizado. No sigas en la rama del PR ya abierto o ya mergeado.
- Tras el merge se **borra** la feature branch (local y remota). En GitHub: «Delete branch». En remoto, si aún existe:

```text
git push origin --delete {quien}/{actividad}
```

- Siguiente actividad: nueva rama desde `master` actualizado (mismo bloque `fetch` + `checkout master` + `pull` + `checkout -b` de arriba). No se reutiliza la rama mergeada.

## Conflictos

Si `master` avanzó (p. ej. ya entró el PR de otro) y tu PR marca conflicto:

1. **No cierres el PR.** “Abortar” = no forzar el merge a ciegas; avisar si el choque es gordo o toca código ajeno.
2. Trae `master` a **tu** rama (`merge` o `rebase` de `origin/master`). Nadie edita `master` a mano para “limpiar”.
3. Resuelves **tú** (autor) archivo por archivo: conviene lo de ambos cuando aplica; no borrar a ciegas lo del otro.
4. Commit de la resolución → push a tu rama → el mismo PR se actualiza.
5. Otro revisa/mergea (D0).

## Capa

PR de API: sin archivos en `frontend/`. PR de pantalla: sin archivos en `backend/`. Ariel pone la ruta cuando la API ya está en `master`.

## Orden

1. Héctor: H1, luego H2. Andrés: seed. David: D2 baja de perfil (luego externos).
2. Ariel conecta cuando esa API está en `master`.
3. Google, Cloudinary, OSM, Deepseek: David. H1 no los espera.
4. Andrés no empieza el ESP32 hasta H5.
