/**
 * vfx/trails.js
 * ------------------------------------------------------------------
 * Estelas de la bola. Cada estela del catálogo (data/shop.js,
 * categoría trails) tiene aquí su renderizador en TRAIL_RENDERERS;
 * renderBallTrail() usa el equipado en cada fotograma. `trail` son los
 * puntos {x, y} del más viejo al más nuevo. Todas usan colores fijos,
 * los mismos que su icono de la tienda.
 * ------------------------------------------------------------------
 */

'use strict';

/** Recorre los segmentos de la estela llamando a fn(p0, p1, pct), con pct de 0 (cola) a 1 (bola). */
function vfxEachSegment(trail, fn) {
    const n = trail.length;
    for (let i = 1; i < n; i++) fn(trail[i - 1], trail[i], i / (n - 1));
}

/** Clásica: círculos blancos que se encogen y se apagan. */
function drawTrailDefault(ctx, trail, radius, color) {
    const n = trail.length;
    if (n < 2) return;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (let i = n - 2; i >= 0; i -= 2) {
        const pct = i / n;
        ctx.globalAlpha = 0.55 * pct * pct;
        ctx.beginPath();
        ctx.arc(trail[i].x, trail[i].y, radius * (0.25 + 0.7 * pct), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

/** Neón (cian fijo): halo ancho, tubo y núcleo blanco, todos con desvanecimiento. */
const NEON_TRAIL_COLOR = '#22D3EE';
function drawTrailNeon(ctx, trail, radius, color) {
    if (trail.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    const pass = (width, alpha, col) => vfxEachSegment(trail, (a, b, pct) => {
        ctx.strokeStyle = hexToRgba(col, alpha * pct);
        ctx.lineWidth = Math.max(1, width * (0.35 + 0.65 * pct));
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    pass(radius * 3.2, 0.16, NEON_TRAIL_COLOR);
    pass(radius * 1.3, 0.85, NEON_TRAIL_COLOR);
    pass(radius * 0.45, 0.9, '#ECFEFF');
    ctx.restore();
}

/** Fuego: lengua de llama (rojo → naranja → amarillo) que parpadea, con brasas. */
/** @type {Array<[number, string]>} */
const FIRE_TRAIL_STOPS = [[0, '#7F1D1D'], [0.35, '#DC2626'], [0.65, '#F97316'], [0.88, '#FDE047'], [1, '#FEF9C3']];
function drawTrailFire(ctx, trail, radius, color) {
    const n = trail.length;
    if (n < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    vfxEachSegment(trail, (a, b, pct) => {
        const flick = 0.8 + 0.4 * vfxRandom();
        ctx.strokeStyle = vfxLerpColor(FIRE_TRAIL_STOPS, pct, 0.75 * pct + 0.1);
        ctx.lineWidth = Math.max(1, radius * 2.3 * pct * flick);
        const rise = (1 - pct) * 6;   // la cola sube un poco, como una llama
        ctx.beginPath(); ctx.moveTo(a.x, a.y - rise); ctx.lineTo(b.x, b.y - rise * 0.8); ctx.stroke();
    });
    // Brasas: chispas sueltas en la mitad vieja de la estela
    for (let k = 0; k < 4; k++) {
        const i = Math.floor(vfxRandom() * n * 0.6);
        const p = trail[i];
        const up = (n - i) * 0.9 + vfxRandom() * radius;
        ctx.fillStyle = hexToRgba(vfxRandom() < 0.5 ? '#FDBA74' : '#FDE047', 0.5 + 0.5 * vfxRandom());
        ctx.beginPath();
        ctx.arc(p.x + (vfxRandom() - 0.5) * radius * 2, p.y - up, 1 + vfxRandom() * 1.4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

/** Hielo: estela escarchada, esquirlas de diamante que giran y destellos. */
function drawTrailIce(ctx, trail, radius, color) {
    const n = trail.length;
    if (n < 2) return;
    const now = performance.now();
    ctx.save();
    ctx.lineCap = 'round';
    vfxEachSegment(trail, (a, b, pct) => {
        ctx.strokeStyle = `rgba(186, 230, 253, ${0.32 * pct})`;
        ctx.lineWidth = Math.max(1, radius * 1.6 * pct);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    for (let i = n - 3; i >= 0; i -= 3) {
        const pct = i / n;
        const p = trail[i];
        const s = radius * 0.85 * pct + 1;
        ctx.save();
        ctx.translate(p.x + Math.sin(i * 1.7) * radius * 0.9, p.y + Math.cos(i * 2.3) * radius * 0.6);
        ctx.rotate(i * 0.7 + now / 450);
        ctx.globalAlpha = 0.9 * pct;
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.4); ctx.lineTo(s, 0); ctx.lineTo(0, s * 1.4); ctx.lineTo(-s, 0); ctx.closePath();
        ctx.fillStyle = '#BAE6FD';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }
    for (let k = 0; k < 3; k++) {
        const p = trail[Math.floor(vfxRandom() * n)];
        ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + 0.6 * vfxRandom()})`;
        vfxSparkle(ctx, p.x + (vfxRandom() - 0.5) * radius * 3, p.y + (vfxRandom() - 0.5) * radius * 3, 2 + vfxRandom() * 3);
        ctx.fill();
    }
    ctx.restore();
}

/** Arcoíris: 6 bandas paralelas a la trayectoria. */
const RAINBOW_TRAIL_BANDS = ['#EF4444', '#F97316', '#FACC15', '#22C55E', '#3B82F6', '#A855F7'];
function drawTrailRainbow(ctx, trail, radius, color) {
    if (trail.length < 2) return;
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    const step = radius * 0.42;
    for (let k = 0; k < RAINBOW_TRAIL_BANDS.length; k++) {
        const off = (k - (RAINBOW_TRAIL_BANDS.length - 1) / 2) * step;
        ctx.strokeStyle = RAINBOW_TRAIL_BANDS[k];
        ctx.lineWidth = step + 0.6;
        vfxEachSegment(trail, (a, b, pct) => {
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len * off, ny = dx / len * off;
            ctx.globalAlpha = 0.85 * pct;
            ctx.beginPath(); ctx.moveTo(a.x + nx, a.y + ny); ctx.lineTo(b.x + nx, b.y + ny); ctx.stroke();
        });
    }
    ctx.restore();
}

/**
 * Renderizador de cada estela, por `id` del catálogo de la tienda.
 * @type {Record<string, (ctx: CanvasRenderingContext2D, trail: Array<{x: number, y: number}>, radius: number, color: string, fx?: {spin: number, power: number}) => void>}
 */
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
 *
 * `fx` lleva el estado de la bola para las estelas que reaccionan (fase
 * 5): `spin` (efecto, -1–1) y `power` (1 en smash o súper). Las actuales
 * lo ignoran.
 * @param {{spin: number, power: number}} [fx]
 */
function renderBallTrail(ctx, trail, radius, fx) {
    const color = currentThemeHex();
    const trailId = equippedId('trails') || 'default';

    if (TRAIL_RENDERERS[trailId]) {
        TRAIL_RENDERERS[trailId](ctx, trail, radius, color, fx);
    } else {
        TRAIL_RENDERERS['default'](ctx, trail, radius, color, fx);
    }
}
