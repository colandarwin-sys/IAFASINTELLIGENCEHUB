IAFAS Intelligence Hub v4.2.136

Capacitaciones simplificadas: buscar → elegir IAFA → elegir tema → leer respuesta completa.
Botón de actualización enlaza al Centro de Fuentes.

# IAFAS Intelligence Hub

Versión preparada para GitHub + Netlify.

- `index.html` está en la raíz para despliegue estático.
- `static/` contiene lógica, estilos, datos y documentos usados por el portal.
- `netlify.toml` publica la raíz sin proceso de compilación.
- Se eliminaron únicamente copias duplicadas que no eran referenciadas por el portal.
- El PDF de capacitación fue optimizado de peso manteniendo el mismo nombre y ruta.

No se modificó la lógica funcional del Hub.


## Cambio v4.2.107 LOCAL
- Se retiró la Calculadora Kairos interna para evitar confusión operativa.
- El menú ahora muestra “Kairos · Validación tarifaria” como acceso externo directo a https://per.kairosweb.com/.
- Kairos abre en una pestaña nueva, igual que el Validador de cartas de garantía (Pacífico).
- La validación automática queda asociada a la extensión Kairos instalada en cada equipo.
- No se modificaron los demás módulos ni su lógica.


## v4.2.109 LOCAL
Se eliminó el bloque residual de la Calculadora Kairos que aparecía sobre todas las pantallas. Se mantiene únicamente el acceso externo “Kairos · Validación tarifaria” en el menú lateral.


## v4.2.114 LOCAL
Ajuste de escala visual desktop para que Chrome al 100% conserve la densidad visual que antes se obtenia al 90%, sin modificar la logica de los modulos.


## v4.2.123
Portada responsive corregida para mantenerse proporcionada y a pantalla completa con zoom de Chrome al 100%, 90% u otros niveles, sin franjas inferiores ni desalineaciones.

## v4.2.124 - Actualización de Listas AB desde el Hub
El botón local ahora inicia un servidor propio del Hub (hub_local_server.py), no el servidor estático de Python. Esto habilita Gestión de fuentes para cargar un Excel LISTAS AB, previsualizar IAFAS detectadas (incluida MAPFRE), publicar la actualización, respaldar la versión anterior y recargar el portal sin editar código.

## v4.2.125 - LISTAS AB actualizado
- Se incorporó el archivo LISTAS-AB.xlsx entregado por el usuario.
- Total cargado: 837 registros.
- IAFAS detectadas: Pacífico 371, Rímac 305, Mapfre 161.
- El importador local ahora acepta `SERVICIO O PROCEDIMIENTO` como campo principal, además de `TECNOLOGÍA`.


## v4.2.130 - Login funcional a pantalla completa
- Rediseño exclusivo de la pantalla de acceso, inspirado en la referencia visual aprobada.
- El login ocupa todo el viewport y el Hub permanece completamente oculto hasta autenticar.
- No existe scroll hacia el portal antes de iniciar sesión.
- Al autenticar, el login se oculta por completo y recién aparece el Hub.
- No se modificó la lógica de Listas AB, MAPFRE, Darbot, Honorarios, PEAS ni otros módulos.


## Hotfix v4.2.130
- Se corrigió la pantalla de login para que los campos de usuario y contraseña mantengan fondo transparente incluso cuando el navegador autocompleta o conserva credenciales.


## v4.2.131 - Pulido visual del login
- Alineación refinada de textos y campos.
- Iconos de acceso mejor proporcionados.
- Botón de inicio de sesión con transición más suave.
- Se mantiene intacta la lógica funcional del portal.


## v4.2.132
- Se corrigió el fondo blanco que Chrome aplicaba al usuario/contraseña guardados. Los campos mantienen el mismo fondo oscuro del login incluso con autocompletado.


## v4.2.133 - Maestro de Capacitaciones actualizable por Excel
- Gestión de fuentes acepta MAESTRO-CAPACITACIONES-IAFAS.xlsx.
- Vista previa muestra registros, entidades, capa documental y capa curada.
- Publicar actualización genera automáticamente la base usada por Capacitaciones y Darbot.
- Se conserva respaldo de la base anterior.
- Filas con Estado=Inactivo/Eliminado o Acción=Eliminar/Borrar no se publican.
- La hoja MAESTRO_DETALLADO preserva el contenido fuente completo en el Hub.


## v4.2.134 - Capacitaciones por Excel operativo
- Nuevo maestro simple: CAPACITACIONES (10 columnas) + DOCUMENTOS.
- FUENTE_DOCUMENTAL queda oculta para conservar texto completo y trazabilidad.
- Nuevas vistas: Consulta, Por IAFA, Decisiones rápidas, Preguntas frecuentes y Documentos fuente.
- Gestión de fuentes publica el mismo Excel y actualiza el módulo sin tocar código.
