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

### Actualización v2 · Fase 0

Fallos encontrados en la revisión previa a la actualización v2
(`design/actualizacion-v2/fase-0-bugs.md`), uno o varios por commit.

| Bug | Dónde | Arreglo | Commit |
|---|---|---|---|
| Apagar y encender la música la volvía a empezar desde el principio | `systems/audio.js`, `ui/settings-panel.js` | `pauseAllMusic()` pausa sin rebobinar; "Restablecer todo" tampoco rebobina | `534c128` |
| Los efectos de gol seguían en pantalla en la partida siguiente, y la cámara lenta del Flash Épico pasaba a ella; al cambiar de efecto a mitad de animación, el anterior se congelaba | `vfx/goal-fx.js`, `vfx/index.js`, `game/match.js` | `resetGoalVFX()` al empezar y al salir (`resetVFX()`); `updateGoalVFX()` avanza todos los efectos | `ee06571` |
| La pantalla temblaba durante toda la cuenta atrás tras cada gol (y a veces al empezar la partida siguiente) | `game/physics.js`, `game/match.js` | La vibración avanza durante el saque; `startGame()` y `quitGame()` la ponen a cero | `4931149` |
| Las partículas del gol se quedaban quietas en el aire durante el saque | `game/physics.js` | Las partículas avanzan durante el saque | `4931149` |
| Desactivar "Vibración de pantalla" no cortaba una vibración en curso | `ui/settings-panel.js` | `toggleScreenShake(false)` pone `shakeTimeMs` a 0 | `4931149` |
| "Sin Ayuda" salía con cualquier victoria sin power-ups recogidos: en local, con los power-ups desactivados o sin que apareciera ninguno | `systems/achievements.js`, `game/powerups.js` | Exige modo contra la máquina, power-ups activados y al menos uno aparecido (`powerupsSpawnedThisGame`) sin recoger | `ee02342` |
| "Demonio Veloz" comparaba el récord histórico (de cualquier preset) con el máximo del preset actual | `systems/achievements.js`, `systems/stats.js`, `game/physics.js` | Cuenta si una bola llega al máximo en esa partida (`matchReachedMaxSpeed`) | `ee02342` |
| El récord de velocidad se leía siempre de la primera bola, también con multibola | `systems/stats.js`, `game/physics.js` | `statsOnScore()` recibe la bola que marcó; al terminar, la más rápida de las que quedan | `ee02342` |
| "Rango Experto", "Leyenda Definitiva", "Fashionista" y "Grow Partner" podían no salir nunca: los de nivel solo se miraban al subir de nivel, "Fashionista" solo al comprar y "Grow Partner" exigía un número exacto de objetos | `systems/achievements.js`, `systems/progression.js` | Se comprueban también en `checkAllAchievements()`; "Grow Partner" pide al menos un objeto de pago | (este commit) |
| El tiempo en pausa contaba como tiempo jugado (inflaba "Pongmaníaco") y "Salir" perdía el tiempo desde el último guardado | `systems/stats.js`, `game/match.js` | `statsPauseClock()`/`statsResumeClock()` al pausar y reanudar; `quitGame()` guarda el tiempo y para el reloj (-1); el fin de partida también lo para, para no contarlo dos veces | (este commit) |

Si aparece un bug nuevo que convenga conservar temporalmente, márcalo en el
código con `BUG conocido (conservado)` y añádelo aquí en una sección propia.
