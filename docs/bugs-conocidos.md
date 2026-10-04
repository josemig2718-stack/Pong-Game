# Bugs conocidos

## Corregidos (octubre de 2026)

La refactorización de 2026 encontró estos fallos y los **conservó** a propósito,
porque prometía no cambiar el comportamiento. Después se corrigieron uno a
uno, cada grupo en su propio commit y regrabando solo las referencias de
`tests/golden/` cuyo cambio explica el arreglo.

| Bug | Dónde | Arreglo | Commit |
|---|---|---|---|
| Al rendirse no se restauraba `p2.x`; al terminar no se restauraba `p2.width` | `game/match.js` | Se restauran ambos | `dedd1b7` |
| Un JSON `null` guardado en estadísticas o configuración rompía la carga | `core/storage.js` | `readJSON()` solo devuelve objetos; si no, usa el valor por defecto | `dedd1b7` |
| Borrar estadísticas enlazaba `themesUsed` con los valores por defecto | `systems/stats.js` | `resetStats()` le da un array propio | `dedd1b7` |
| Reactivar la música en Hachepe o campaña ponía la pista genérica | `ui/settings-panel.js` | `playGameplayMusic(state.mode)` | `dedd1b7` |
| El emoji de respaldo de la tienda no quedaba centrado | `ui/shop-ui.js` | `display: flex` | `dedd1b7` |
| Tres reglas de la tienda usaban `var(--font-main)`, que no existe | `css/style.css` | `var(--font-display)` (la misma fuente que ya se heredaba) | `dedd1b7` |
| Sin `purchasedItems` guardado, comprar modificaba los valores por defecto y "Grow Partner" no saltaba | `systems/progression.js` | Copia propia del array | `dedd1b7` |
| Abrir una pestaña de la tienda guardaba la progresión | `ui/shop-ui.js`, `systems/progression.js` | Los artículos gratuitos se añaden al cargar, no al dibujar | `dedd1b7` |
| El control táctil ignoraba el tamaño real de la paleta | `systems/pointer.js` | Límite y centrado con la altura actual | `dedd1b7` |
| El logro "Coleccionista" era inalcanzable | `game/powerups.js` | Cada power-up recogido suma a `totalPowerupsCollected` | `3f5f772` |
| Las partidas Hachepe y de campaña contaban como locales | `systems/stats.js` | Solo cuentan en los totales | `3f5f772` |
| La vida de un power-up en el campo seguía corriendo en pausa | `game/powerups.js` | Se mide en tiempo de juego (`ageMs`) | `534eb44` |
| Las pestañas de la tienda perdían el resaltado tras el primer clic | `ui/shop-ui.js` | Compara con el `data-arg` de cada botón | `83fecd5` |
| Algunas descripciones de la tienda no describían lo que se dibuja | `data/shop.js` | Textos de la estela Clásica y las paletas Pixel y Gradiente | `83fecd5` |
| "Restablecer todo" no actualizaba el volumen de los efectos | `ui/settings-panel.js` | Llama a `setMasterVolume()` | `83fecd5` |
| La cuenta atrás nunca mostraba "¡YA!" | `game/physics.js`, `game/render.js` | Se muestra 0,6 s al sacar | `ca7a095` |

Si aparece un bug nuevo que convenga conservar temporalmente, márcalo en el
código con `BUG conocido (conservado)` y añádelo aquí en una sección propia.
