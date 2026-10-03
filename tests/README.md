# Tests de regresión

Partidas deterministas que se reproducen contra el juego real y se comparan,
fotograma a fotograma, con referencias grabadas (`golden/`). Sirven para
cambiar el código con la garantía de que el comportamiento no cambia.

No hace falta instalar nada: es una página web.

## Ejecutar

```bash
python tests/serve.py
```

Abre <http://127.0.0.1:8000/tests/> y pulsa **Ejecutar todos**. Con
`?only=jefe-3,pausa` se ejecutan solo esos escenarios.

> Usa `tests/serve.py` y no `python -m http.server`: este último no envía
> cabeceras de caché, el navegador cachea los archivos de forma heurística y,
> tras editar el código, los tests pueden pasar **midiendo la versión
> anterior**. `serve.py` responde siempre con `Cache-Control: no-store`.

Necesita conexión: el juego carga Tailwind y sus fuentes desde la red, y sin
la fuente "Press Start 2P" los píxeles del canvas no serían comparables (el
runner lo detecta y falla con un mensaje claro).

## Cómo funciona

1. `runner.js` descarga `index.html` y lo carga en un iframe (`srcdoc`)
   inyectando dos scripts: `harness/install.js` **antes** que cualquier script
   del juego y el adaptador de lectura (`adapters/esm.js`) **después**. El
   adaptador importa los módulos del juego por las mismas rutas, que el mapa
   de imports resuelve a las mismas URL: lee las instancias reales.
2. `harness/install.js` sustituye todo lo que no es determinista:
   - `Math.random` por un generador con semilla;
   - `Date` y `performance.now` por un reloj virtual;
   - `setTimeout`/`setInterval` y `requestAnimationFrame` por colas virtuales;
   - `localStorage` por un almacén en memoria (no toca tu progreso real);
   - el audio por versiones que registran lo que suena.
3. El juego **solo avanza cuando el runner llama a `step()`**: un fotograma del
   reloj virtual, con sus temporizadores y su `requestAnimationFrame`.
4. Se maneja como una caja negra: un bot que pulsa teclas reales (o mueve el
   ratón, o arrastra el dedo) y clics sobre botones localizados por su **texto
   visible**.
5. En cada fotograma se guarda un hash del estado de la partida; cada 120
   fotogramas, y tras cada acción de interfaz, una instantánea completa:
   estado, almacenamiento, DOM visible, audio y píxeles del canvas.

### Dos generadores aleatorios

Tailwind por CDN también llama a `Math.random`, desde callbacks del navegador
cuyo número no es estable entre ejecuciones. Si compartiera generador con el
juego le robaría números y ninguna partida sería reproducible. Por eso el
generador del juego solo responde mientras el harness ejecuta código del juego
(`__harness.inGame`); todo lo demás recibe números de otro generador.

El número de llamadas que hace el juego forma parte del estado de cada
fotograma (`rng`): si un cambio de código altera una sola llamada a
`Math.random`, el test lo señala en el fotograma exacto.

## Qué se compara

| Sección | Contenido |
|---|---|
| `match` | modo, pausa, marcadores, cuenta atrás, bolas, paletas, gemelo, partículas |
| `boss` | el jefe a través de sus funciones públicas: config, vida, arena, apuntado, tramos blindados |
| `powerups` | power-up en el campo, efecto activo, escudo, cámara lenta |
| `campaign` | nivel, repetición, diálogo |
| `storage` / `memory` | las tres claves de `localStorage` y los objetos en memoria |
| `dom` | pantallas activas y su contenido visible, normalizado |
| `audio` | tonos sintetizados y operaciones sobre la música |
| `canvas` | hash de los píxeles |

El DOM se normaliza para no atarse a detalles que no se ven: la etiqueta de
los contenedores (`div`, `section`... cuentan igual), los manejadores en
línea, los atributos `data-*` de acciones, `type`, `role` y `aria-*`.

El hash del canvas **solo vale en el navegador donde se grabó**: otro
navegador antialiasa distinto. Si cambia el navegador, el runner lo avisa e
ignora los píxeles; el resto de secciones se sigue comparando.

### El mapa de imports

Antes de los escenarios se ejecuta una comprobación estática,
`mapa-de-imports` (`lib/importmap.js`): todo módulo alcanzable desde
`js/main.js` está en el mapa de `index.html` con el mismo `?v=N`, ningún
`import` lleva versión, no sobra ninguna entrada y `style.css` usa el mismo N.
Un módulo olvidado en el mapa funcionaría en local pero GitHub Pages podría
servir una copia vieja.

## Grabar referencias

**Grabar referencias** ejecuta cada escenario dos veces y solo graba si ambas
coinciden exactamente: una referencia que no se reproduce a sí misma no sirve.
Descarga un JSON por escenario que va a `golden/`.

> Regrabar una referencia significa aceptar que el comportamiento cambió.
> Hazlo solo cuando el cambio es intencionado, nunca para que un test pase.

## Añadir un escenario

Edita `scenarios.js`. Cada escenario tiene una semilla, un almacenamiento
inicial y una lista de acciones (`click`, `clickSel`, `input`, `change`, `key`,
`steps`, `play`). `expect` declara eventos por los que debe pasar (por ejemplo
`boss:3` o `screen:finale-screen`): si un cambio hace que ya no pase por ellos,
el test lo detecta aunque el estado coincida.

## Archivos

| Archivo | Función |
|---|---|
| `index.html`, `app.js` | la página y su interfaz |
| `runner.js` | carga del juego, grabación, bot, acciones y comparación |
| `scenarios.js` | los escenarios |
| `harness/install.js` | sustituciones deterministas dentro del iframe |
| `adapters/esm.js` | lectura del estado del juego (lo único que conoce sus módulos) |
| `lib/` | JSON canónico, hashes, serialización del DOM y comprobación del mapa de imports |
| `golden/` | referencias grabadas |
