/**
 * game/draw.js
 * ------------------------------------------------------------------
 * Primitivas de dibujo sobre el canvas del juego, compartidas por el
 * render de la partida y por los jefes.
 * ------------------------------------------------------------------
 */

import { ctx } from './canvas.js';

export function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

/** Texto centrado con la fuente arcade del juego. */
export function drawText(text, x, y, color, size) {
    ctx.fillStyle = color;
    ctx.font = `${size}px "Press Start 2P", cursive`;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
}

/** '#rrggbb' + alfa → 'rgba(r, g, b, a)'. */
export function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
