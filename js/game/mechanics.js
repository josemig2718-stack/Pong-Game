/**
 * game/mechanics.js
 * ------------------------------------------------------------------
 * Las mecánicas de golpe de la fase 2, para que physics.js siga siendo
 * una lista de pasos:
 *
 *   cinemática  la paleta con inercia (teclado) y la velocidad medida
 *               (dedo, ratón y CPU)
 *
 * Todos los números salen de MECH (data/mechanics.js). Nada aquí usa
 * vfxRandom: el azar de la física y de la CPU es Math.random.
 * ------------------------------------------------------------------
 */

'use strict';

/** @param {number} v @param {number} lo @param {number} hi */
function mechClamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

// ------------------------------------------------------------------
//  Cinemática de las paletas
// ------------------------------------------------------------------

/**
 * Velocidad de la paleta normalizada a su velocidad máxima, de -1 a 1
 * (en el eje X en la arena rotada).
 * @param {Paddle} p
 * @param {boolean} [rotated]
 */
function vNorm(p, rotated = false) {
    return mechClamp((rotated ? p.vx : p.vy) / paddleSpeed, -1, 1);
}

/** Guarda la posición de cada paleta antes de moverlas, para medir su velocidad. */
function rememberPaddlePositions() {
    for (const p of [p1, p2, p2Twin]) {
        p.prevY = p.y;
        p.prevX = p.x;
    }
}

/**
 * Teclado: la paleta acelera hacia la velocidad pedida y frena al
 * soltar. Cargar el smash la ralentiza.
 * @param {Paddle} p
 * @param {number} dir -1 arriba (o izquierda), 1 abajo (o derecha), 0 quieta
 * @param {number} dt
 * @param {'x'|'y'} axis
 */
function movePaddleKeys(p, dir, dt, axis) {
    const target = dir * paddleSpeed * (p.smashHeld ? MECH.smashSlowK : 1);
    const v = axis === 'x' ? p.vx : p.vy;
    const k = target === 0 ? MECH.decelK : MECH.accelK;
    const next = v + (target - v) * (1 - Math.pow(1 - k, dt));
    if (axis === 'x') {
        p.vx = next;
        p.x += next * dt;
    } else {
        p.vy = next;
        p.y += next * dt;
    }
}

/**
 * Dedo o ratón: la paleta va directa a donde pide el puntero, salvo
 * mientras se carga el smash, que la limita a paddleSpeed·smashSlowK por
 * fotograma. Su velocidad se mide después (measurePaddleSpeeds).
 * @param {Paddle} p
 * @param {number} target posición pedida (y, o x en la arena rotada)
 * @param {number} dt
 * @param {'x'|'y'} axis
 */
function followPointer(p, target, dt, axis) {
    const cur = axis === 'x' ? p.x : p.y;
    let next = target;
    if (p.smashHeld) {
        const max = paddleSpeed * MECH.smashSlowK * dt;
        next = cur + mechClamp(target - cur, -max, max);
    }
    if (axis === 'x') p.x = next;
    else p.y = next;
}

/**
 * Velocidad medida como diferencia de posición desde rememberPaddlePositions().
 * @param {Paddle} p
 * @param {number} dt
 * @param {'x'|'y'} axis
 */
function measurePaddle(p, dt, axis) {
    const max = MECH.pointerMaxVy;
    if (axis === 'x') p.vx = dt > 0 ? mechClamp((p.x - p.prevX) / dt, -max, max) : 0;
    else p.vy = dt > 0 ? mechClamp((p.y - p.prevY) / dt, -max, max) : 0;
}

/**
 * Tras mover y acotar las paletas: mide la velocidad de las que no lleva
 * el teclado (puntero y CPU). La del teclado es la de su integrador.
 * @param {number} playerDt dt del jugador 1 (0 si está congelado)
 * @param {number} dt
 * @param {boolean} rotatedArena
 */
function measurePaddleSpeeds(playerDt, dt, rotatedArena) {
    if (rotatedArena) {
        if (p1.touchX !== undefined && p1.touchX !== null) measurePaddle(p1, playerDt, 'x');
    } else if (p1.touchY !== null) {
        measurePaddle(p1, playerDt, 'y');
    }
    if (state.mode !== 'local' || p2.touchY !== null) measurePaddle(p2, dt, 'y');
    if (p2Twin.active) measurePaddle(p2Twin, dt, 'y');
}
