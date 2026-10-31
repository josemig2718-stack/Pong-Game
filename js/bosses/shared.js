/**
 * bosses/shared.js
 * ------------------------------------------------------------------
 * Estado y constantes compartidos por los jefes. Se carga antes que
 * ellos, así que pueden usarlo en su código de primer nivel.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Estado vivo del jefe en curso. Cada jefe guarda aquí lo suyo en init().
 * @type {Record<string, any>}
 */
let bossState = {};

/** Vacía el estado del jefe (al empezar cada partida, en bossInit()). */
function resetBossState() {
    bossState = {};
}

/** Alto de la franja del Creador. game/ lo usa para el rebote contra ella. */
const CREATOR_BAND_H = 110;

/**
 * Reparte la velocidad de la bola (b.speed) en su dirección actual, sin
 * dejarla casi vertical: así nunca se queda rebotando de pared a pared.
 * La usan los obstáculos de los jefes después de desviar la bola.
 * @param {Ball} b
 * @param {number} [minX] lo mínimo de la velocidad que va en horizontal
 *        (0,42 por defecto; los rebotes que vuelven al jugador, más planos)
 */
function bossNormalizeBall(b, minX = 0.42) {
    const v = Math.hypot(b.dx, b.dy) || 1;
    let dx = b.dx / v, dy = b.dy / v;
    if (Math.abs(dx) < minX) {
        dx = (dx < 0 ? -1 : 1) * minX;
        dy = (dy < 0 ? -1 : 1) * Math.sqrt(1 - minX * minX);
    }
    b.dx = dx * b.speed;
    b.dy = dy * b.speed;
}

/**
 * Un cartel pequeño de neón (PASE, ALTO, DENEGADO, PAGADO…), común a los
 * jefes.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {string} color
 * @param {number} [size]
 */
function bossSign(ctx, text, x, y, color, size = 9) {
    ctx.save();
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = 'rgba(6, 7, 12, 0.85)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillRect(x - w / 2, y - size, w, size * 2);
    ctx.strokeRect(x - w / 2, y - size, w, size * 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y + 1);
    ctx.restore();
}

/**
 * Hace sonar un efecto de soundEffects por su nombre, si existe (los
 * jefes lo usan para sus sonidos propios).
 * @param {string} name
 * @param {any} [arg]
 */
function bossSfx(name, arg) {
    const fn = /** @type {Record<string, any>} */ (soundEffects)[name];
    if (typeof fn === 'function') fn(arg);
}
