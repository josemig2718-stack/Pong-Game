/**
 * game/draw.js
 * ------------------------------------------------------------------
 * Primitivas de dibujo sobre el canvas del juego, compartidas por el
 * render de la partida y por los jefes.
 * ------------------------------------------------------------------
 */

'use strict';

/** Rectángulo relleno. */
function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

/** Texto centrado con la fuente arcade del juego. */
function drawText(text, x, y, color, size) {
    ctx.fillStyle = color;
    ctx.font = `${size}px "Press Start 2P", cursive`;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
}

/**
 * Color interpolado entre paradas [[t, '#rrggbb'], …] ordenadas por t.
 * @param {Array<[number, string]>} stops
 * @param {number} t
 * @param {number} [a] alfa
 */
function vfxLerpColor(stops, t, a = 1) {
    t = Math.max(0, Math.min(1, t));
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    const k = (t - t0) / Math.max(1e-6, t1 - t0);
    const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const A = rgb(c0), B = rgb(c1);
    return `rgba(${Math.round(A[0] + (B[0] - A[0]) * k)}, ${Math.round(A[1] + (B[1] - A[1]) * k)}, ${Math.round(A[2] + (B[2] - A[2]) * k)}, ${a})`;
}

/** Abre un trazado con una estrella de 4 puntas de lados curvos (destellos). */
function vfxSparkle(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y);
    c.quadraticCurveTo(x, y, x, y - r);
    c.closePath();
}

/** '#rrggbb' + alfa → 'rgba(r, g, b, a)'. */
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
