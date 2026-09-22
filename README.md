# IAFAS Intelligence Hub v4.2.138

## LISTAS AB vigentes
La versión incluye como base oficial `LISTAS-AB-ACTUALIZADO.xlsx`, con 1,142 registros del archivo final recibido el 22/09/2026.

### Actualización recomendada desde GitHub
1. Reemplaza `LISTAS-AB-ACTUALIZADO.xlsx` en la raíz del repositorio.
2. Conserva exactamente ese nombre para la fuente automática.
3. Haz Commit en `main`.
4. Netlify ejecuta `npm run build:data` y reconstruye `static/listas-ab-data.js` automáticamente.
5. El navegador recibe la base sin caché persistente para ese archivo.

El nombre del archivo que se carga manualmente desde el Centro de Fuentes puede ser distinto; lo que se valida es la estructura interna del Excel.

## Estructura mínima reconocida
La hoja puede llamarse libremente. Debe contener encabezados equivalentes a: COMPAÑÍA, SUB CIA, ID, LISTA, SERVICIO O PROCEDIMIENTO, COBERTURA, CONDICIONES, EXCEPCIONES, DETALLES, PALABRAS CLAVE y REQUIERE CG.

## Netlify
`netlify.toml` ejecuta el generador de datos antes de publicar y conserva las Functions para la carga avanzada desde Gestión de fuentes.
