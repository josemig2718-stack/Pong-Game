/**
 * vfx/paddles.js
 * ------------------------------------------------------------------
 * Estilos de paleta. Cada paleta del catálogo (data/shop.js, categoría
 * paddles) tiene aquí su renderizador en PADDLE_RENDERERS. Solo cambian
 * el dibujo: la caja de colisión es siempre (x, y, w, h).
 *
 * El color lo decide game/render.js: el del tema para el jugador 1,
 * '#CBD5E1' para la CPU, Hachepe o el jefe, '#38BDF8' para el jugador 2
 * en local y '#ef4444' para el gemelo.
 * ------------------------------------------------------------------
 */

'use strict';

/** Abre un trazado con un rectángulo redondeado (con alternativa si el navegador no tiene roundRect). */
function roundRectHelper(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        return;
    }
    // Fallback si roundRect no existe
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

/** roundRectHelper con el radio limitado a la mitad del lado menor (y nunca negativo). */
function paddleRoundRect(ctx, x, y, w, h, r) {
    roundRectHelper(ctx, x, y, w, h, Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)));
}

/** Clásica: barra sólida redondeada, brillo suave y un reflejo vertical. */
function drawPaddleClassic(ctx, x, y, w, h, color) {
    const r = Math.min(6, w / 2);
    ctx.save();
    ctx.shadowColor = hexToRgba(color, 0.55);
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    paddleRoundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    paddleRoundRect(ctx, x + w * 0.18, y + 6, Math.max(2, w * 0.2), h - 12, 1.5);
    ctx.fill();
    ctx.restore();
}

/** [fila, alfa] de las luces y [filas desde abajo, alfa] de las sombras de la paleta pixel. */
const PIXEL_PADDLE_LIGHTS = [[2, 0.55], [4, 0.32], [6, 0.16]];
const PIXEL_PADDLE_SHADOWS = [[3, 0.35], [5, 0.18]];

/** Pixel: bloques de 5 px, esquinas recortadas, luces arriba a la izquierda y sombras abajo a la derecha. */
function drawPaddlePixel(ctx, x, y, w, h, color) {
    const cols = Math.max(1, Math.round(w / 5));
    const rows = Math.max(2, Math.round(h / 5));
    const bw = w / cols, bh = h / rows;
    ctx.save();
    ctx.fillStyle = color;
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const corner = (i === 0 || i === cols - 1) && (j === 0 || j === rows - 1);
            if (!corner) ctx.fillRect(Math.floor(x + i * bw), Math.floor(y + j * bh), Math.ceil(bw), Math.ceil(bh));
        }
    }
    // Luces de 8 bits (columna izquierda, arriba) y sombras (columna derecha, abajo)
    for (const [j, a] of PIXEL_PADDLE_LIGHTS) {
        if (j >= rows - 1) continue;
        ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
        ctx.fillRect(Math.floor(x), Math.floor(y + j * bh), Math.ceil(bw), Math.ceil(bh));
    }
    for (const [back, a] of PIXEL_PADDLE_SHADOWS) {
        const j = rows - back;
        if (j <= 0) continue;
        ctx.fillStyle = `rgba(0, 0, 0, ${a})`;
        ctx.fillRect(Math.floor(x + (cols - 1) * bw), Math.floor(y + j * bh), Math.ceil(bw), Math.ceil(bh));
    }
    // Rejilla de píxel muy sutil
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    for (let i = 1; i < cols; i++) ctx.fillRect(Math.floor(x + i * bw), y + bh, 1, h - 2 * bh);
    for (let j = 1; j < rows; j++) {
        const edge = j === 1 || j === rows - 1;
        ctx.fillRect(x + (edge ? bw : 0), Math.floor(y + j * bh), w - (edge ? 2 * bw : 0), 1);
    }
    ctx.restore();
}

/** Gradiente: del blanco (arriba) al color del jugador, con brillo. */
function drawPaddleGradient(ctx, x, y, w, h, color) {
    const r = Math.min(6, w / 2);
    ctx.save();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, color);
    g.addColorStop(1, hexToRgba(color, 0.6));
    ctx.shadowColor = hexToRgba(color, 0.5);
    ctx.shadowBlur = 14;
    ctx.fillStyle = g;
    paddleRoundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();
}

/** Neón: contorno de 3 px, núcleo blanco y halo doble que pulsa. */
function drawPaddleNeon(ctx, x, y, w, h, color) {
    const r = Math.min(7, w / 2);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
    ctx.save();
    ctx.fillStyle = hexToRgba(color, 0.06 + 0.05 * pulse);
    paddleRoundRect(ctx, x - 8, y - 8, w + 16, h + 16, r + 8);
    ctx.fill();
    ctx.fillStyle = hexToRgba(color, 0.14 + 0.08 * pulse);
    paddleRoundRect(ctx, x - 4, y - 4, w + 8, h + 8, r + 4);
    ctx.fill();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 + 10 * pulse;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    paddleRoundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    const cw = Math.max(3, w * 0.34);
    paddleRoundRect(ctx, x + (w - cw) / 2, y + 8, cw, h - 16, cw / 2);
    ctx.fill();
    ctx.restore();
}

/** Delgada Pro: barra fina con brillo y la caja de golpe real insinuada (fantasma y discontinua). */
function drawPaddleSlim(ctx, x, y, w, h, color) {
    const r = Math.min(6, w / 2);
    ctx.save();
    ctx.fillStyle = hexToRgba(color, 0.07);
    paddleRoundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(color, 0.22);
    paddleRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
    ctx.setLineDash([]);
    const sw = Math.max(4, w * 0.3);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    paddleRoundRect(ctx, x + (w - sw) / 2, y, sw, h, sw / 2);
    ctx.fill();
    ctx.restore();
}

/** Renderizador de cada paleta, por `id` del catálogo de la tienda. */
const PADDLE_RENDERERS = {
    classic:      drawPaddleClassic,
    pixel:        drawPaddlePixel,
    gradient:     drawPaddleGradient,
    neon_paddle:  drawPaddleNeon,
    slim:         drawPaddleSlim
};

/**
 * Dibuja una paleta con el estilo equipado (o el clásico si el id guardado
 * no existe). Los estilos están pensados en vertical: una paleta horizontal
 * (la del jugador en la arena rotada del Creador) se dibuja girada 90° sobre
 * su centro, con la misma caja.
 *
 * `fx` lleva el estado de las mecánicas para los estilos que reaccionan
 * (fase 5): `charge` (smash cargando, 0–1) y `hit` (destello al golpear,
 * 1 → 0). Los estilos actuales lo ignoran.
 * @param {{charge: number, hit: number}} [fx]
 */
function renderPaddleVFX(ctx, x, y, w, h, color, fx) {
    const paddleId = equippedId('paddles') || 'classic';
    const draw = PADDLE_RENDERERS[paddleId] || PADDLE_RENDERERS['classic'];

    if (w <= h) {
        draw(ctx, x, y, w, h, color, fx);
        return;
    }
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(Math.PI / 2);
    draw(ctx, -h / 2, -w / 2, h, w, color, fx);
    ctx.restore();
}
