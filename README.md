# Respira

App web de respiración guiada con 9 técnicas (4-7-8, cuadrada, coherente, diafragmática, suspiro cíclico, labios fruncidos, respiración alterna, abeja y oceánica) con guía visual, tonos, voz y vibración. Sin dependencias ni paso de compilación: es HTML, CSS y JavaScript servidos tal cual desde GitHub Pages.

## Estructura

```
index.html                 Interfaz, estilos y lógica
data/techniques.json       Datos que no dependen del idioma
data/locales/es.json       Textos en español
manifest.webmanifest       Datos para instalar la app
sw.js                      Service worker (uso sin conexión)
icons/                     Íconos de la app instalada
```

Al iniciar, la app carga ambos JSON y los combina por `id` (`loadContent` y `buildContent` en `index.html`). Si falta un texto, sobra uno o una fase es inválida, la carga falla y la consola lista todos los errores.

## Probar en local

La app carga los JSON con `fetch`, así que **no funciona abriendo `index.html` con doble clic**. Hay que servirla:

```bash
python -m http.server 8000
```

Luego abre <http://localhost:8000/>. Para correr la autoverificación del motor y de los datos, ejecuta en la consola del navegador:

```js
await __respiraSelfTest()
```

## Uso sin conexión e instalación (PWA)

`sw.js` guarda en caché todos los archivos de la app en la primera visita. Usa **red primero**: con conexión siempre sirve lo publicado (revalidando con el servidor), y sin conexión, o si la red tarda más de 4 segundos, usa la última copia guardada.

- **Al publicar cambios de contenido o código no hay que tocar `sw.js`.**
- **Si agregas, renombras o eliminas un archivo**, actualiza la lista `PRECACHE` y sube la versión de `CACHE` (`respira-v1` → `respira-v2`), para que la caché vieja se borre.
- El service worker solo funciona con HTTPS o en `localhost`. Para probarlo sin conexión: abre la app una vez, detén el servidor y recarga.
- La voz usa las voces del sistema; algunas se descargan de internet y pueden no estar disponibles sin conexión. Los tonos funcionan siempre.

## Añadir o editar una técnica

Cada técnica tiene una entrada en **cada uno** de los dos archivos, con el mismo `id`.

### `data/techniques.json`

| Campo | Descripción |
|---|---|
| `id` | Identificador único. También se usa en la URL (`#/tecnica/<id>`) y en el historial: no lo cambies una vez publicado. |
| `visual` | `circle` o `box`. |
| `tags` | Ids de `taxonomy` por grupo (`focus`, `moment`, `benefit`), para los filtros. |
| `defaults` | `mode` (`cycles` o `minutes`), `cycles`, `minutes` y `variant` iniciales. |
| `limits` | Rango `[mín, máx]` de `cycles` y `minutes`. |
| `refs` | Ids de `references` (al menos uno), en el orden en que se muestran. |
| `recommendedCycles` | Opcional. Sobre este número se muestra `recommendNote`. |
| `variantControl` | Opcional, si hay más de una variante. `kind`: `switch` (con `on`/`off` = ids de variante) o `radio`. |
| `variants[]` | `id`, `maxCycles` opcional y `phases[]` con `type` (`inhale`, `hold`, `exhale`, `holdEmpty`), `seconds` y `to` opcional. |

`to` es el nivel de llenado de los pulmones al terminar la fase, de 0 (vacíos) a 1 (llenos). Por defecto, inhalar termina en 1, exhalar en 0 y las retenciones mantienen el nivel. Úsalo para fases parciales: el suspiro cíclico inhala hasta `0.7` y luego hasta `1`. Una inhalación siempre debe subir el nivel y una exhalación, bajarlo.

### `data/locales/es.json` → `techniques.<id>`

| Campo | Descripción |
|---|---|
| `name`, `tagline` | Nombre y subtítulo. |
| `summary` | `benefit` y `moment` para la tarjeta. |
| `focusText`, `why` | Foco fisiológico y cómo actúa. |
| `evidence` | Resumen honesto de la evidencia: qué se estudió, con cuántas personas y qué no está demostrado. |
| `moments`, `benefits` | Listas. |
| `dose`, `posture` | Textos. |
| `steps`, `precautions` | Listas. Si la técnica tiene retenciones, se agrega sola la precaución común `notices.holds` y se repiten antes de practicar. |
| `recommendNote` | Obligatorio si hay `recommendedCycles`. |
| `variantControl` | `label` y `description` opcional. |
| `variants.<id>` | `label`; `tag` y `description` opcionales; `cues`: una indicación por fase, en el mismo orden que `phases`; y `labels` opcional: el nombre de cada fase cuando el genérico no basta (por ejemplo, «Inhala por la izquierda»). Se muestra en pantalla y lo dice la voz. |

Opcionalmente, agrega la ilustración `art_<id>` en el objeto `ICON` de `index.html`. Sin ella, la tarjeta se muestra sin dibujo.

### Referencias

`references` en `techniques.json` es el catálogo común: `id`, `type`, `title` (en su idioma original), `source`, `url` (https), y opcionalmente `authors` y `year`. Los tipos son `meta-analysis`, `review`, `study` y `outreach` (divulgación); sus nombres visibles están en `referenceTypes` de `es.json`.

Criterios para el contenido de salud:

- Cada afirmación de beneficio debe poder rastrearse a una referencia de la técnica.
- Prefiere metaanálisis, revisiones y estudios con DOI. La divulgación sirve para explicar la técnica, no como evidencia.
- Usa lenguaje prudente («se asocia a», «puede ayudar») y menciona los límites: tamaño del estudio, si fue una sola sesión, si se probó en personas sanas.

### Filtros y asistente

- `taxonomy` lista los ids de cada grupo de filtros en `techniques.json`, y sus textos en `es.json`.
- `needs` define las opciones de «¿Qué necesitas ahora?» y a qué técnica lleva cada una. Su ícono es `need_<id>` en `ICON`.

## Publicación

El sitio se publica con GitHub Pages desde este repositorio. Usa siempre rutas relativas, porque vive en `/respira/` y no en la raíz del dominio.
