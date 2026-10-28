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
    const now = vfxNow();
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

/** Pixel: cuadrados alineados a una rejilla de 4 px que se apagan en escalón. */
function drawTrailPixel(ctx, trail, radius, color) {
    const n = trail.length;
    if (n < 2) return;
    const G = 4;
    ctx.save();
    for (let i = 0; i < n; i++) {
        const k = (i + 1) / n;                       // 0 viejo → 1 nuevo
        const step = Math.ceil(k * 4) / 4;           // 4 escalones de tamaño y alfa
        const s = Math.max(G, Math.round(radius * 1.7 * step / G) * G);
        const x = Math.round(trail[i].x / G) * G, y = Math.round(trail[i].y / G) * G;
        ctx.globalAlpha = 0.18 + 0.7 * step;
        ctx.fillStyle = step > 0.75 && i % 2 ? '#ffffff' : color;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
        if (step > 0.5) {                            // luz de 8 bits arriba a la izquierda
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.fillRect(x - s / 2, y - s / 2, s, G / 2);
        }
    }
    ctx.restore();
}

/** Rayo: arco eléctrico que zigzaguea, con ramas y chispas. */
const BOLT_GLOW = '#60A5FA', BOLT_CORE = '#E0F2FE';
function drawTrailLightning(ctx, trail, radius, color, fx) {
    const n = trail.length;
    if (n < 3) return;
    const pts = [];
    for (let i = 0; i < n; i += 2) {
        const p = trail[i], q = trail[Math.min(n - 1, i + 1)];
        const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1;
        const k = i / n;
        const amp = radius * (0.25 + 1.1 * (1 - k)) * (1 + (fx && fx.power || 0));
        const off = (vfxRandom() - 0.5) * 2 * amp;
        pts.push({ x: p.x - dy / L * off, y: p.y + dx / L * off, k });
    }
    pts.push({ x: trail[n - 1].x, y: trail[n - 1].y, k: 1 });
    const stroke = (w, style, a) => {
        ctx.lineWidth = w; ctx.strokeStyle = style; ctx.globalAlpha = a;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
    };
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = BOLT_GLOW; ctx.shadowBlur = 16;
    stroke(radius * 1.1, hexToRgba(BOLT_GLOW, 0.35), 1);
    ctx.shadowBlur = 0;
    stroke(radius * 0.45, BOLT_GLOW, 0.9);
    stroke(Math.max(1.5, radius * 0.18), BOLT_CORE, 1);
    // Ramas cortas
    for (let i = 2; i < pts.length - 2; i += 3) {
        if (vfxRandom() > 0.55) continue;
        const p = pts[i];
        const a = vfxRandom() * Math.PI * 2, l = radius * (1 + vfxRandom() * 1.8);
        ctx.globalAlpha = 0.7 * p.k + 0.2;
        ctx.lineWidth = 1.5; ctx.strokeStyle = BOLT_CORE;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(a) * l * 0.5 + (vfxRandom() - 0.5) * 6, p.y + Math.sin(a) * l * 0.5 + (vfxRandom() - 0.5) * 6);
        ctx.lineTo(p.x + Math.cos(a) * l, p.y + Math.sin(a) * l);
        ctx.stroke();
    }
    // Chispas
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
        const p = trail[Math.floor(n * (0.5 + vfxRandom() * 0.5))];
        ctx.globalAlpha = 0.9;
        ctx.fillRect(p.x + (vfxRandom() - 0.5) * radius * 3, p.y + (vfxRandom() - 0.5) * radius * 3, 2, 2);
    }
    ctx.restore();
}

/** Fantasma: copias translúcidas de la bola, como un eco que se queda atrás. */
function drawTrailGhost(ctx, trail, radius, color) {
    const n = trail.length;
    if (n < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = n - 1, c = 0; i >= 0; i -= 3, c++) {
        const k = i / (n - 1);
        const p = trail[i];
        const r = radius * (1.05 + (1 - k) * 0.35);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(255, 255, 255, ${0.6 * k})`);
        g.addColorStop(0.6, hexToRgba(color, 0.5 * k));
        g.addColorStop(1, hexToRgba(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.25 + 0.65 * k;
        ctx.strokeStyle = hexToRgba(color, 0.9);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.92, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
    }
    ctx.restore();
}

/** Sakura: una cinta rosada suave y pétalos que caen y giran desde la estela. */
const SAKURA_COLORS = ['#FBCFE8', '#F9A8D4', '#F472B6', '#FDF2F8'];
function drawTrailSakura(ctx, trail, radius, color) {
    const n = trail.length;
    if (n < 2) return;
    ctx.save();
    // Cinta
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    vfxEachSegment(trail, (a, b, k) => {
        ctx.strokeStyle = `rgba(249, 168, 212, ${0.4 * k})`;
        ctx.lineWidth = radius * 1.4 * k;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    // Pétalos: cada punto de la estela suelta uno estable (hash por posición)
    for (let i = 0; i < n - 1; i++) {
        const p = trail[i];
        const h = vfxPointHash(p);
        if (h > 0.85) continue;
        const age = n - 1 - i;                       // fotogramas desde que se soltó
        const k = 1 - age / n;
        const sway = Math.sin(age * 0.18 + h * 20) * (4 + age * 0.35);
        const x = p.x + sway + (vfxPointHash(p, 1) - 0.5) * radius * 2;
        const y = p.y + age * 0.9 + (vfxPointHash(p, 2) - 0.5) * radius * 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(h * 6.28 + age * 0.09);
        ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(age * 0.12 + h * 9)));   // da vueltas
        ctx.globalAlpha = Math.min(1, k * 1.4);
        ctx.fillStyle = SAKURA_COLORS[Math.floor(vfxPointHash(p, 3) * SAKURA_COLORS.length)];
        vfxPetal(ctx, radius * (0.75 + h * 0.5));
        ctx.fill();
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.55)'; ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

/** Galaxia: cola oscura con nebulosa violeta y estrellas que titilan dentro (la mitad con state.lowFx). */
function drawTrailGalaxy(ctx, trail, radius, color) {
    const n = trail.length;
    if (n < 2) return;
    const t = vfxT();
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Halo exterior de nebulosa
    ctx.globalCompositeOperation = 'lighter';
    vfxEachSegment(trail, (a, b, k) => {
        ctx.strokeStyle = vfxLerpColor([[0, '#7C3AED'], [0.6, '#C026D3'], [1, '#F472B6']], k, 0.5 * k);
        ctx.lineWidth = radius * 3.6 * (0.3 + 0.7 * k);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    // Cuerpo oscuro
    ctx.globalCompositeOperation = 'source-over';
    vfxEachSegment(trail, (a, b, k) => {
        ctx.strokeStyle = `rgba(30, 18, 72, ${0.9 * k})`;
        ctx.lineWidth = radius * 1.9 * (0.3 + 0.7 * k);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    // Estrellas estables dentro de la cola
    ctx.globalCompositeOperation = 'lighter';
    const perPoint = state.lowFx ? 1 : 2;
    for (let i = 0; i < n; i++) {
        const p = trail[i], k = i / n;
        for (let s = 0; s < perPoint; s++) {
            const h = vfxPointHash(p, s + 5);
            if (h > 0.75) continue;
            const ox = (vfxPointHash(p, s + 7) - 0.5) * radius * 1.5 * k;
            const oy = (vfxPointHash(p, s + 9) - 0.5) * radius * 1.5 * k;
            const tw = 0.5 + 0.5 * Math.sin(t * 6 + h * 40);
            ctx.globalAlpha = k * (0.4 + 0.6 * tw);
            ctx.fillStyle = h < 0.12 ? '#F9A8D4' : '#ffffff';
            if (h < 0.08) { vfxSparkle(ctx, p.x + ox, p.y + oy, 3.2 * k + 1); ctx.fill(); }
            else ctx.fillRect(p.x + ox - 0.8, p.y + oy - 0.8, 1.6, 1.6);
        }
    }
    ctx.restore();
}

/** Glitch: fragmentos RGB desplazados que cambian a saltos. Exclusivo. Con state.lowFx, la mitad de fragmentos. */
function drawTrailGlitch(ctx, trail, radius, color) {
    const n = trail.length;
    if (n < 2) return;
    const tick = Math.floor(vfxT() * 18);           // cambia a saltos, ~18 veces por segundo
    const low = state.lowFx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i += low ? 4 : 2) {
        const p = trail[i], k = (i + 1) / n;
        const h = vfxHash(tick * 131 + i * 7);
        const off = (h - 0.5) * radius * 2.2 * (1 - k * 0.5);
        const r = radius * (0.7 + 0.7 * k);
        ctx.globalAlpha = 0.2 + 0.75 * k;
        ctx.fillStyle = '#FF2D55';
        ctx.fillRect(p.x - r + off - 3, p.y - r * 0.5, r * 2, r);
        ctx.fillStyle = '#00E5FF';
        ctx.fillRect(p.x - r - off + 3, p.y - r * 0.5, r * 2, r);
    }
    // Rebanadas horizontales sueltas
    ctx.globalCompositeOperation = 'source-over';
    for (let s = 0; s < (low ? 3 : 6); s++) {
        const h = vfxHash(tick * 977 + s * 31);
        const p = trail[Math.floor(h * n)];
        const w = 8 + vfxHash(tick + s * 3) * radius * 4, hh = 2 + Math.floor(vfxHash(tick * 3 + s) * 3);
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = s % 3 === 0 ? '#ffffff' : s % 3 === 1 ? '#FF2D55' : '#00E5FF';
        ctx.fillRect(p.x - w / 2 + (vfxHash(s + tick * 5) - 0.5) * 20, p.y + (vfxHash(s * 9 + tick) - 0.5) * radius * 3, w, hh);
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
    rainbow: drawTrailRainbow,
    pixel:     drawTrailPixel,
    lightning: drawTrailLightning,
    ghost:     drawTrailGhost,
    sakura:    drawTrailSakura,
    galaxy:    drawTrailGalaxy,
    glitch:    drawTrailGlitch
};

/**
 * Dibuja la estela de una bola con la estela equipada (o la clásica si el
 * id guardado no existe).
 *
 * `fx` lleva el estado de la bola para las estelas que reaccionan:
 * `spin` (efecto, -1–1) y `power` (1 en smash o súper). Las que no lo
 * usan lo ignoran.
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
