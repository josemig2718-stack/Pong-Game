/**
 * game/loop.js
 * ------------------------------------------------------------------
 * El bucle requestAnimationFrame: update(dt) + render() por fotograma.
 * ------------------------------------------------------------------
 */

'use strict';

let animationFrameId;
let lastTimestamp = 0;

/** Tiempo de fotograma medio (ms, media móvil) y cuánto lleva por debajo de 45 fps. */
let fxFrameMsAvg = MS_PER_FRAME;
let fxSlowMs = 0;
const FX_LOW_FPS = 45;
const FX_LOW_AFTER_MS = 3000;

/** Vuelve a medir desde cero (al empezar una partida). */
function resetFxLoad() {
    fxFrameMsAvg = MS_PER_FRAME;
    fxSlowMs = 0;
}

/**
 * Mide los fps de la partida: si la media se queda por debajo de 45
 * durante 3 s seguidos, pone state.lowFx y los cosméticos más pesados
 * (galaxia, glitch) dibujan la mitad. Solo cambia el dibujo; los saltos
 * de más de 250 ms (pestaña en segundo plano) no cuentan.
 * @param {number} elapsedMs
 */
function measureFxLoad(elapsedMs) {
    if (state.lowFx || elapsedMs <= 0 || elapsedMs > 250) return;
    fxFrameMsAvg += (elapsedMs - fxFrameMsAvg) * 0.1;
    if (fxFrameMsAvg > 1000 / FX_LOW_FPS) {
        fxSlowMs += elapsedMs;
        if (fxSlowMs >= FX_LOW_AFTER_MS) state.lowFx = true;
    } else {
        fxSlowMs = 0;
    }
}

function gameLoop(timestamp) {
    if (!state.isPlaying || state.isPaused) return;

    if (lastTimestamp === 0) lastTimestamp = timestamp;
    const elapsedMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    measureFxLoad(elapsedMs);

    // dt en fotogramas de 60 FPS, acotado: tras una pausa larga del
    // navegador la física no da un salto de más de 3 fotogramas.
    let dt = elapsedMs / MS_PER_FRAME;
    if (dt > 3) dt = 3;
    if (dt <= 0) dt = 1;

    update(dt);
    render();

    // Guardar tiempo jugado de vez en cuando (1 de cada 1000 fotogramas: ~17 s de media)
    if (Math.random() < 0.001) statsFlushTime();

    animationFrameId = requestAnimationFrame(gameLoop);
}

/** Arranca el bucle desde cero (al empezar una partida). */
function startLoop() {
    cancelAnimationFrame(animationFrameId);
    lastTimestamp = 0;
    animationFrameId = requestAnimationFrame(gameLoop);
}

/** Reanuda el bucle tras una pausa, sin contar el tiempo pausado. */
function resumeLoop() {
    lastTimestamp = 0;
    animationFrameId = requestAnimationFrame(gameLoop);
}

/** Detiene el bucle (pausa o salida). */
function stopLoop() {
    cancelAnimationFrame(animationFrameId);
}
