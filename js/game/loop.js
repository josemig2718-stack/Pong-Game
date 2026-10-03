/**
 * game/loop.js
 * ------------------------------------------------------------------
 * El bucle requestAnimationFrame: update(dt) + render() por fotograma.
 * ------------------------------------------------------------------
 */

import { MS_PER_FRAME } from '../core/constants.js';
import { state } from '../core/state.js';
import { statsFlushTime } from '../systems/stats.js';
import { update } from './physics.js';
import { render } from './render.js';

let animationFrameId;
let lastTimestamp = 0;

function gameLoop(timestamp) {
    if (!state.isPlaying || state.isPaused) return;

    if (lastTimestamp === 0) lastTimestamp = timestamp;
    const elapsedMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

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
export function startLoop() {
    cancelAnimationFrame(animationFrameId);
    lastTimestamp = 0;
    animationFrameId = requestAnimationFrame(gameLoop);
}

/** Reanuda el bucle tras una pausa, sin contar el tiempo pausado. */
export function resumeLoop() {
    lastTimestamp = 0;
    animationFrameId = requestAnimationFrame(gameLoop);
}

/** Detiene el bucle (pausa o salida). */
export function stopLoop() {
    cancelAnimationFrame(animationFrameId);
}
