# IAFAS Intelligence Hub v4.2.142

## LISTAS AB vigentes
La versión incluye como base oficial `LISTAS-AB-ACTUALIZADO.xlsx`, con 1,142 registros del archivo final recibido el 22/09/2026.

### Publicación
1. Sube el contenido completo de esta versión a la raíz del repositorio.
2. Haz un único Commit en `main`.
3. Netlify publicará el sitio y las Functions sin ejecutar un build de datos adicional.
4. La base vigente de LISTAS AB ya está incluida en `static/listas-ab-data.js`.

El nombre del archivo que se carga manualmente desde el Centro de Fuentes puede ser distinto; lo que se valida es la estructura interna del Excel.

## Estructura mínima reconocida
La hoja puede llamarse libremente. Debe contener encabezados equivalentes a: COMPAÑÍA, SUB CIA, ID, LISTA, SERVICIO O PROCEDIMIENTO, COBERTURA, CONDICIONES, EXCEPCIONES, DETALLES, PALABRAS CLAVE y REQUIERE CG.

## Netlify
`netlify.toml` ejecuta el generador de datos antes de publicar y conserva las Functions para la carga avanzada desde Gestión de fuentes.


## Corrección Netlify v4.2.142
Se retiró el build previo `npm run build:data`. La base vigente de LISTAS AB ya se incluye preprocesada en `static/listas-ab-data.js` con 1,142 registros, evitando el fallo de deploy por `scripts/build-data.mjs`. Las Netlify Functions se conservan para Gestión de fuentes.

## v4.2.142 - Usuarios centralizados en Supabase
La versión publicada usa una Netlify Function segura para autenticar y administrar usuarios en Supabase. La clave secreta permanece exclusivamente en las variables de entorno de Netlify. Los usuarios creados desde Gestión de usuarios quedan disponibles para cualquier equipo que acceda al Hub publicado.


## FIX v4.2.142 - Usuarios en Netlify
- El frontend publicado llama directamente a `/.netlify/functions/users` y ya no depende de redirects `/api/*`.
- Se elimina la llamada automática a `/api/users/import-local`, que generaba 404.
- Se conserva `/api/*` solamente para localhost, donde el servidor local puede atender esas rutas.
- No cambia la estructura de Supabase ni requiere volver a ejecutar SQL.
