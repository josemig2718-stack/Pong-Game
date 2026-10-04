# Bugs conocidos

Fallos detectados durante la refactorización de 2026 (rama `refactor/es-modules`).
**Se conservaron a propósito**: el objetivo de aquella refactorización era no
cambiar el comportamiento, y los tests de regresión (`tests/`) lo garantizan
comparando cada partida con referencias grabadas sobre el código original.

Cada uno está marcado en el código con un comentario `BUG conocido (conservado)`.
Arreglar uno es un cambio de comportamiento: probablemente obligue a regrabar
alguna referencia de `tests/golden/`, y conviene hacerlo en un commit propio que
lo diga.

## Partida

| Bug | Dónde | Efecto |
|---|---|---|
| Al rendirse no se restaura `p2.x` | `game/match.js`, `quitGame()` | Sin efecto visible hoy (nada mueve `p2.x`), pero el restablecimiento de paletas está incompleto. |
| Al terminar la partida no se restaura `p2.width` | `game/match.js`, `checkWin()` | Igual que el anterior: `startGame()` lo repone después. |
| La vida de un power-up en el campo usa el reloj real | `game/powerups.js`, `updatePowerups()` y `renderPowerup()` | Usa `Date.now()`, así que sigue corriendo con el juego en pausa; la duración del efecto, en cambio, se mide con `dt` y sí se detiene. |
| El control táctil ignora el tamaño real de la paleta | `systems/pointer.js`, `clampPaddleY()` y `updatePaddleFromTouch()` | Usa `paddleHeight` fijo (100): con una paleta agrandada o encogida por un power-up, la paleta no queda centrada bajo el dedo, y una encogida no llega al borde inferior. |
| La cuenta atrás nunca muestra "¡YA!" | `game/render.js`, `render()` | Solo dibuja los segundos (3, 2, 1). La rama que mostraba "¡YA!" era inalcanzable y se eliminó; el comportamiento es el mismo. |

## Estadísticas y logros

| Bug | Dónde | Efecto |
|---|---|---|
| El logro "Coleccionista" es inalcanzable | `systems/achievements.js`, `checkAllAchievements()` | Comprueba `gameStats.totalPowerupsCollected`, que nada incrementa. |
| Las partidas Hachepe y de campaña cuentan como locales | `systems/stats.js`, `statsOnGameEnd()` | Todo lo que no es `cpu` cae en la rama de partidas locales (y suma victorias de J1/J2). |
| Borrar estadísticas enlaza `themesUsed` con los valores por defecto | `systems/stats.js`, `resetStats()` | `Object.assign` copia la referencia del array: los temas que se prueben después se añaden también a `DEFAULT_STATS.themesUsed`. |
| Un `null` guardado en las estadísticas rompe la carga | `systems/stats.js`, `loadStats()` | Si la clave contiene el JSON `null`, `saved.achievements` lanza un error y el juego no arranca. |
| Un `null` guardado en la configuración rompe la carga | `core/settings.js`, `loadSettings()` | Igual: `saved.bindings` sobre `null`. (La progresión, en cambio, vuelve a los valores por defecto.) |

## Progresión y tienda

| Bug | Dónde | Efecto |
|---|---|---|
| Con una partida guardada sin `purchasedItems`, comprar modifica los valores por defecto | `systems/progression.js`, `loadProgression()` y `purchaseItem()` | La progresión cargada comparte el array de `DEFAULT_PROGRESSION`; al comprar crecen los dos a la vez y el logro "Grow Partner" (comparar longitudes) nunca salta. |
| Abrir una pestaña de la tienda guarda la progresión | `ui/shop-ui.js`, `populateShopTab()` | Añade los artículos gratuitos que falten y guarda, como efecto secundario de dibujar. |
| Las pestañas de la tienda pierden el resaltado tras el primer clic | `ui/shop-ui.js`, `switchShopTab()` | Busca `data-category` en los botones, que el HTML no tiene: quita `active` a todas y no se lo da a ninguna. (No añadas `data-category` al HTML sin decidir arreglarlo: lo arreglaría en silencio.) |
| El emoji de respaldo de la tienda no queda centrado | `ui/shop-ui.js`, manejador `error` de la imagen | Pone `display: block` sobre un elemento pensado para `flex`. |
| Algunas descripciones de la tienda no describen lo que se dibuja | `data/shop.js` frente a `vfx/` | P. ej. "Gradiente" dice "del tema al blanco" y dibuja un arcoíris fijo; "Clásica" (estela) dice "círculos" y dibuja segmentos. |
| Tres reglas de la tienda usan una variable CSS que no existe | `css/style.css` (`var(--font-main)`) | La declaración es inválida y esos elementos heredan la fuente del padre. |

## Configuración y audio

| Bug | Dónde | Efecto |
|---|---|---|
| Reactivar la música en una partida Hachepe o de campaña pone la pista genérica | `ui/settings-panel.js`, `toggleMusic()` | Llama a `playGameplayMusic()` sin el modo de juego. |
| "Restablecer todo" no actualiza el volumen de los efectos | `ui/settings-panel.js`, `resetAllSettings()` | Cambia `settings.volume` pero no `masterVolume` (en `systems/audio.js`) hasta que se mueve el slider. |
