# Tests de regresión

Partidas deterministas que se reproducen contra el juego real y se comparan,
fotograma a fotograma, con referencias grabadas (`golden/`). Sirven para
cambiar el código con la garantía de que el comportamiento no cambia.

No hace falta instalar nada: es una página web.

## Ejecutar

```bash
python tests/serve.py
```

Abre <http://127.0.0.1:8000/tests/> y pulsa **Ejecutar todos** (unos 5
minutos). Con `?only=jefe-3,pausa` se ejecutan solo esos escenarios; el test
de estilos solo corre con `?only=` si se incluye `estilos-computados`. La
comprobación de los scripts corre siempre (necesita `serve.py`).

Desde Playwright o la consola: `window.__tests.runAll()` y esperar a
`window.__done` (`{ passed, total }`); los resultados quedan en
`window.__lastResults`.

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
   del juego y el adaptador de lectura (`adapters/globals.js`) **después**.
   El juego son scripts clásicos que comparten el ámbito global, así que el
   adaptador lee su estado directamente.
2. `harness/install.js` sustituye todo lo que no es determinista:
   - `Math.random` por un generador con semilla;
   - `Date` y `performance.now` por un reloj virtual;
   - `setTimeout`/`setInterval` y `requestAnimationFrame` por colas virtuales;
   - `localStorage` por un almacén en memoria (no toca tu progreso real);
   - el audio por versiones que registran lo que suena. El `AudioContext`
     falso **no tiene `decodeAudioData` a propósito**: así el reproductor
     de música elige siempre el motor de `<audio>` (que ya se registra)
     y la música es determinista sin simular `fetch`.
3. El juego **solo avanza cuando el runner llama a `step()`**: un fotograma del
   reloj virtual, con sus temporizadores y su `requestAnimationFrame`.
4. Se maneja como una caja negra: un bot que pulsa teclas reales (o mueve el
   ratón, o arrastra el dedo) y clics sobre botones localizados por su **texto
   visible** (o por su `aria-label`, si lo tienen: botones de solo icono y
   tiles con subtítulo). Con teclado, el bot frena contando la inercia de la
   paleta (`brake`, por defecto) y puede mantener el smash al venir la bola
   (`smash`, en una fracción `smashChance` de las devoluciones).
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
| `match` | modo, pausa, marcadores, cuenta atrás, fiebre, hit-stop, bolas (con efecto, smash/súper y dueño), paletas (con velocidad, carga y energía), gemelo, partículas |
| `boss` | el jefe a través de sus funciones públicas: config, vida, arena, apuntado, tramos blindados |
| `powerups` | power-up en el campo, efecto activo, escudo, cámara lenta |
| `campaign` | nivel, repetición, diálogo |
| `storage` / `memory` | las tres claves de `localStorage` y los objetos en memoria |
| `dom` | pantallas activas y su contenido visible, normalizado |
| `audio` | tonos (`tone`) y ráfagas de ruido (`noise`) sintetizados, y operaciones sobre los `<audio>` de la música (`media`) |
| `canvas` | hash de los píxeles |

El DOM se normaliza para no atarse a detalles que no se ven: la etiqueta de
los contenedores (`div`, `section`... cuentan igual), los manejadores en
línea, los atributos `data-*` de acciones, `type`, `role` y `aria-*`.

El hash del canvas **solo vale en el navegador donde se grabó**: otro
navegador antialiasa distinto. Si cambia el navegador, el runner lo avisa e
ignora los píxeles; el resto de secciones se sigue comparando.

### Los scripts del juego

Antes de los escenarios se ejecuta una comprobación estática,
`scripts-del-juego` (`lib/scripts.js`): cada archivo de `js/` se carga
exactamente una vez desde `index.html` (la lista de archivos existentes la da
`serve.py` en `/tests/js-files`), ninguno es un módulo (no cargaría desde
`file://`), todos llevan el mismo `?v=N` que `style.css` y `main.js` va el
último. El orden entre capas lo vigilan los escenarios: un script cargado
antes de lo que necesita rompe la carga y fallan todos.

### Estilos computados

`estilos-computados` (`styles.js`) protege los cambios de HTML y CSS que no
deben verse: para 20 estados de la interfaz (cada pantalla, «Cómo jugar»,
las Novedades, la partida, la práctica, la pausa, el fin de partida, el
diálogo, el aviso de logro, la intro y el falso final) y 4 tamaños de ventana (1280×800, 800×600, 390×844, 844×390), guarda
un hash de **todas** las propiedades de `getComputedStyle` de cada elemento y
de sus `::before`/`::after`. La clave de cada elemento es su posición en el
árbol, no su etiqueta, así que cambiar un `<div>` por un `<section>` no la
altera, pero sí cualquier estilo distinto. Las transiciones se desactivan y
las animaciones duran 0 s para que la captura sea estable.

Para ver qué cambió en un elemento: `window.__tests.inspectStyle(estado,
"390x844", clave)` devuelve todas sus propiedades actuales. La referencia
(`golden/styles.json`) se graba con `window.__tests.recordStyles()`, que
captura dos veces y solo acepta el resultado si coinciden. Como los hashes
del canvas, solo vale en el navegador donde se grabó.

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
el test lo detecta aunque el estado coincida. Las mecánicas de golpe dan
`mech:perfect`, `mech:edge`, `mech:block`, `mech:smash`, `mech:super` y
`mech:spin` (de los contadores `mechHits` de `game/mechanics.js`, que el
adaptador expone en `diag`), `mech:fever` y `shield:spent` (el escudo se
rompe tras su último bloqueo); también `screen:news-screen` y
`screen:howto-menu`. Todos los escenarios empiezan con las Novedades de esta
versión ya vistas (`seenNewsVersion`), salvo los que llevan `news: true`
(`novedades`, `reinicio`). `mission:done` marca que se completó una misión (contador `missionsDone` de
`diag`); `misiones` lo exige. Las misiones salen de la fecha virtual del
harness (15-01-2026, en la zona horaria del equipo). `news:reset` señala el aviso de reinicio del
progreso dentro de las Novedades: `reinicio` arranca con las claves v1 de
antes de la fase 4 y comprueba que se borran. `expectNot` declara eventos por
los que no debe pasar: así `salir-tras-gol` vigila que una partida nunca
empiece con la cámara lenta del gol anterior (`slowmo-al-empezar`). `play`
puede jugar hasta `goal` (el primer gol) o hasta un evento (`event:<nombre>`),
además de hasta una pantalla o el final de la partida. Los eventos solo se detectan al avanzar un fotograma:
entre dos acciones de interfaz sin `steps` no se registra nada.

## Archivos

| Archivo | Función |
|---|---|
| `index.html`, `app.js` | la página y su interfaz |
| `runner.js` | carga del juego, grabación, bot, acciones y comparación |
| `scenarios.js` | los escenarios |
| `styles.js` | el test de estilos computados |
| `serve.py` | servidor de desarrollo sin caché (también para jugar) |
| `harness/install.js` | sustituciones deterministas dentro del iframe |
| `adapters/globals.js` | lectura del estado del juego (lo único que conoce sus nombres internos) |
| `lib/` | JSON canónico, hashes, serialización del DOM y comprobación de los scripts |
| `golden/` | referencias grabadas |
