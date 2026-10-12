/**
 * vfx/trails.js
 * ------------------------------------------------------------------
 * Estelas de la bola. Cada estela del catálogo (data/shop.js,
 * categoría trails) tiene aquí su renderizador en TRAIL_RENDERERS;
 * renderBallTrail() usa el equipado en cada fotograma.
 * ------------------------------------------------------------------
 */

'use strict';

/** Clásica: segmentos que se estrechan y desvanecen hacia la cola. */
function drawTrailDefault(ctx, trail, radius, color) {
    if (trail.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 1; i < trail.length; i++) {
        const p1 = trail[i-1];
        const p2 = trail[i];
        const pct = i / trail.length; // 0 (el más viejo) a 1 (el más nuevo)

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5 * pct;
        ctx.lineWidth = Math.max(1, radius * 2 * pct);
        ctx.stroke();
    }
    ctx.restore();
}

/** Neón: línea gruesa con resplandor y un núcleo blanco. */
function drawTrailNeon(ctx, trail, radius, color) {
    if (trail.length < 2) return;

    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = radius * 0.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Línea gruesa de neón (color principal)
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
    }
    ctx.stroke();

    // Línea blanca delgada en el centro para el brillo
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = radius * 0.3;
    ctx.stroke();

    ctx.restore();
}

/** Fuego: partículas aleatorias que suben (vfxRandom al dibujar). */
function drawTrailFire(ctx, trail, radius, color) {
    ctx.save();
    for (let i = 0; i < trail.length; i++) {
        const point = trail[i];
        const pct = i / trail.length; // 0 a 1
        const alpha = 0.8 * pct;

        ctx.globalAlpha = alpha;

        // 2-3 partículas por punto de la estela
        const particleCount = 2 + Math.floor(vfxRandom() * 2);
        for (let p = 0; p < particleCount; p++) {
            // Desplazamiento aleatorio y "subida" (deriva hacia arriba en y)
            const offsetX = (vfxRandom() - 0.5) * radius * 1.5;
            const offsetY = (vfxRandom() - 0.5) * radius * 1.5 - ((trail.length - i) * 1.5); // deriva hacia arriba

            // Gradiente simple aproximado por color
            let fireColor = '#ff0000'; // Rojo por defecto
            const randColor = vfxRandom();
            if (randColor < 0.3) fireColor = '#ff6600'; // Naranja
            else if (randColor > 0.8) fireColor = '#330000'; // Rojo oscuro

            ctx.fillStyle = fireColor;
            ctx.beginPath();
            ctx.arc(point.x + offsetX, point.y + offsetY, radius * 0.5 * pct, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

/** Hielo: destellos cuadrados con deriva lateral (vfxRandom al dibujar). */
function drawTrailIce(ctx, trail, radius, color) {
    ctx.save();
    for (let i = 0; i < trail.length; i++) {
        const point = trail[i];
        const pct = i / trail.length;
        const alpha = 0.8 * pct;

        ctx.globalAlpha = alpha;

        const particleCount = 2 + Math.floor(vfxRandom() * 2);
        for (let p = 0; p < particleCount; p++) {
            // Deriva lateral (hacia los lados)
            const offsetX = (vfxRandom() - 0.5) * radius * 3;
            const offsetY = (vfxRandom() - 0.5) * radius;

            let iceColor = '#00ffff';
            if (vfxRandom() > 0.5) iceColor = '#ffffff';

            ctx.fillStyle = iceColor;

            // Dibujar cuadrados pequeños rotados
            ctx.save();
            ctx.translate(point.x + offsetX, point.y + offsetY);
            ctx.rotate(Math.PI / 4); // 45 grados
            const size = radius * 0.6 * pct;
            ctx.fillRect(-size/2, -size/2, size, size);
            ctx.restore();
        }
    }
    ctx.restore();
}

/** Arcoíris: el tono rota con el contador de fotogramas. */
function drawTrailRainbow(ctx, trail, radius, color) {
    if (trail.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 1; i < trail.length; i++) {
        const p1 = trail[i-1];
        const p2 = trail[i];
        const pct = i / trail.length;

        const hue = (i * 15 + state.frameCount * 3) % 360;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
        ctx.globalAlpha = 0.8 * pct;
        ctx.lineWidth = Math.max(1, radius * 2 * pct);
        ctx.stroke();
    }
    ctx.restore();
}

/** Renderizador de cada estela, por `id` del catálogo de la tienda. */
const TRAIL_RENDERERS = {
    default: drawTrailDefault,
    neon:    drawTrailNeon,
    fire:    drawTrailFire,
    ice:     drawTrailIce,
    rainbow: drawTrailRainbow
};

/**
 * Dibuja la estela de una bola con la estela equipada (o la clásica si el
 * id guardado no existe).
 */
function renderBallTrail(ctx, trail, radius) {
    const color = currentThemeHex();
    const trailId = playerProgression.selectedTrail || 'default';

    if (TRAIL_RENDERERS[trailId]) {
        TRAIL_RENDERERS[trailId](ctx, trail, radius, color);
    } else {
        TRAIL_RENDERERS['default'](ctx, trail, radius, color);
    }
}
