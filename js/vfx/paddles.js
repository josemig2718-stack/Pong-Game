/**
 * vfx/paddles.js
 * ------------------------------------------------------------------
 * Estilos de paleta. Cada paleta del catálogo (data/shop.js, categoría
 * paddles) tiene aquí su renderizador en PADDLE_RENDERERS. Solo cambian
 * el dibujo: el tamaño de colisión es siempre el de la paleta.
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

function drawPaddleClassic(ctx, x, y, w, h, color) {
    ctx.save();
    ctx.fillStyle = color;
    roundRectHelper(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.restore();
}

function drawPaddlePixel(ctx, x, y, w, h, color) {
    ctx.save();
    ctx.fillStyle = color;
    // Bloques de 5×5 px
    const blockSize = 5;
    for (let i = 0; i < w; i += blockSize) {
        for (let j = 0; j < h; j += blockSize) {
            // Sin las esquinas, para que parezca un óvalo de 8 bits
            if ((i < blockSize || i >= w - blockSize) && (j < blockSize || j >= h - blockSize)) continue;
            // Damero en el interior
            if ((i/blockSize + j/blockSize) % 2 === 0) {
                ctx.fillStyle = color;
            } else {
                ctx.fillStyle = '#ffffff';
            }
            ctx.fillRect(x + i, y + j, blockSize, blockSize);
        }
    }
    ctx.restore();
}

function drawPaddleGradient(ctx, x, y, w, h, color) {
    ctx.save();
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#ff0000');
    grad.addColorStop(0.33, '#00ff00');
    grad.addColorStop(0.66, '#0000ff');
    grad.addColorStop(1, '#ffff00');
    ctx.fillStyle = grad;
    roundRectHelper(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.restore();
}

function drawPaddleNeon(ctx, x, y, w, h, color) {
    ctx.save();
    // Resplandor intenso
    const glow = 15 + 10 * Math.sin(Date.now() / 200);
    ctx.shadowBlur = glow;
    ctx.shadowColor = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;

    // Contorno
    roundRectHelper(ctx, x, y, w, h, 6);
    ctx.stroke();

    // Relleno transparente
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.fill();

    ctx.restore();
}

function drawPaddleSlim(ctx, x, y, w, h, color) {
    ctx.save();
    ctx.fillStyle = color;
    const slimW = w * 0.65;
    const offsetX = (w - slimW) / 2;
    roundRectHelper(ctx, x + offsetX, y, slimW, h, 6);
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

/** Dibuja una paleta con el estilo equipado (o el clásico si el id guardado no existe). */
function renderPaddleVFX(ctx, x, y, w, h, color) {
    const paddleId = playerProgression.selectedPaddle || 'classic';

    if (PADDLE_RENDERERS[paddleId]) {
        PADDLE_RENDERERS[paddleId](ctx, x, y, w, h, color);
    } else {
        PADDLE_RENDERERS['classic'](ctx, x, y, w, h, color);
    }
}
