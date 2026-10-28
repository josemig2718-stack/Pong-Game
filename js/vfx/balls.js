/**
 * vfx/balls.js
 * ------------------------------------------------------------------
 * Bolas de la tienda (categoría balls). Cada una tiene su renderizador
 * en BALL_RENDERERS: (ctx, b, color, fx?) dibuja la bola `b` centrada en
 * (b.x, b.y) y de radio b.radius, así que la bola gigante y la multibola
 * salen solas. El aplastamiento tras un golpe (b.squash) lo pone
 * renderBallVFX() para todas, estirando el dibujo en la dirección del
 * movimiento sin girarlo.
 *
 * Azar: vfxRandom; tiempo: vfxT(). Nunca Math.random.
 * ------------------------------------------------------------------
 */

'use strict';

/** Ángulo de las bolas que giran: con el efecto (spin) o, si no tiene, con el avance. */
function ballSpinAngle(b) { return vfxT() * (2 + Math.abs(b.spin || 0) * 14) * (b.spin < 0 ? -1 : 1) + b.x * 0.02; }

/** Clásica: bola blanca con el brillo del tema. */
function drawBallClassic(ctx, b, color) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/** Pixel: círculo de bloques de 3 px con luz arriba a la izquierda. */
function drawBallPixel(ctx, b, color) {
    const s = Math.max(2, Math.round(b.radius / 3));
    const r = b.radius;
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 14;
    for (let yy = -r; yy < r; yy += s) {
        for (let xx = -r; xx < r; xx += s) {
            const cx = xx + s / 2, cy = yy + s / 2;
            if (cx * cx + cy * cy > r * r) continue;
            const light = (cx + cy) / (2 * r);       // -1 luz → 1 sombra
            ctx.fillStyle = light < -0.35 ? '#ffffff' : light > 0.35 ? '#C7CDD8' : '#EEF1F6';
            ctx.fillRect(Math.round(b.x + xx), Math.round(b.y + yy), s, s);
        }
    }
    ctx.restore();
}

/** Planeta: esfera con bandas del color del tema y un anillo inclinado. */
function drawBallPlanet(ctx, b, color) {
    const r = b.radius;
    ctx.save();
    ctx.translate(b.x, b.y);
    const tilt = -0.45;
    const ring = (front) => {
        ctx.save();
        ctx.rotate(tilt);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.75, r * 0.5, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
        ctx.strokeStyle = 'rgba(253, 230, 138, 0.9)'; ctx.lineWidth = 2.2; ctx.stroke();
        ctx.strokeStyle = hexToRgba(color, 0.55); ctx.lineWidth = 4.5; ctx.globalCompositeOperation = 'destination-over'; ctx.stroke();
        ctx.restore();
    };
    ring(false);
    ctx.shadowColor = color; ctx.shadowBlur = 14;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, vfxLerpColor([[0, '#ffffff'], [1, color]], 0.5)); g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.clip();
    ctx.rotate(tilt);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    const off = (ballSpinAngle(b) * 3) % (r * 1.2);
    for (let yy = -r * 1.2 + off; yy < r; yy += r * 0.6) ctx.fillRect(-r, yy, r * 2, r * 0.16);
    ctx.restore();
    ring(true);
    ctx.restore();
}

/** Ojo: mira hacia donde va. Esclerótica blanca, iris del tema y pupila. */
function drawBallEye(ctx, b, color) {
    const r = b.radius;
    const sp = Math.hypot(b.dx || 0, b.dy || 0) || 1;
    const lx = (b.dx || 0) / sp * r * 0.38, ly = (b.dy || 0) / sp * r * 0.38;
    const blink = (vfxT() % 3.2) < 0.12;
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    if (blink) {
        ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(b.x - r * 0.7, b.y); ctx.quadraticCurveTo(b.x, b.y + r * 0.35, b.x + r * 0.7, b.y); ctx.stroke();
    } else {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)'; ctx.lineWidth = 0.8;          // venitas
        for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.4; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * r * 0.95, b.y + Math.sin(a) * r * 0.95); ctx.lineTo(b.x + Math.cos(a + 0.2) * r * 0.6, b.y + Math.sin(a + 0.2) * r * 0.6); ctx.stroke(); }
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(b.x + lx, b.y + ly, r * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#020617';
        ctx.beginPath(); ctx.arc(b.x + lx * 1.15, b.y + ly * 1.15, r * 0.24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(b.x + lx - r * 0.15, b.y + ly - r * 0.18, r * 0.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

/** Balón: blanco con pentágonos negros que giran. */
function drawBallSoccer(ctx, b, color) {
    const r = b.radius;
    const a0 = ballSpinAngle(b);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    ctx.rotate(a0);
    const pent = (cx, cy, s) => {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; (i ? ctx.lineTo : ctx.moveTo).call(ctx, cx + Math.cos(a) * s, cy + Math.sin(a) * s); }
        ctx.closePath(); ctx.fill();
    };
    ctx.fillStyle = '#0F172A';
    pent(0, 0, r * 0.36);
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; pent(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, r * 0.3); }
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36); ctx.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); ctx.stroke(); }
    ctx.restore();
    ctx.save();
    const sh = ctx.createRadialGradient(b.x - r * 0.4, b.y - r * 0.4, 0, b.x, b.y, r);
    sh.addColorStop(0, 'rgba(255,255,255,0.0)'); sh.addColorStop(1, 'rgba(15,23,42,0.28)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

/** Cometa: núcleo blanco-azulado con una llamarada corta opuesta a la marcha. */
function drawBallComet(ctx, b, color) {
    const r = b.radius;
    const sp = Math.hypot(b.dx || 0, b.dy || 0) || 1;
    const ux = -(b.dx || 1) / sp, uy = -(b.dy || 0) / sp;
    const t = vfxT();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
        const len = r * (3.2 - i * 0.6) * (0.85 + 0.15 * Math.sin(t * 20 + i));
        const w = r * (0.95 - i * 0.18);
        const g = ctx.createLinearGradient(b.x, b.y, b.x + ux * len, b.y + uy * len);
        g.addColorStop(0, i < 2 ? 'rgba(186, 230, 253, 0.6)' : hexToRgba(color, 0.5)); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(b.x - uy * w, b.y + ux * w);
        ctx.quadraticCurveTo(b.x + ux * len * 0.5 - uy * w * 0.6, b.y + uy * len * 0.5 + ux * w * 0.6, b.x + ux * len, b.y + uy * len);
        ctx.quadraticCurveTo(b.x + ux * len * 0.5 + uy * w * 0.6, b.y + uy * len * 0.5 - ux * w * 0.6, b.x + uy * w, b.y - ux * w);
        ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = '#7DD3FC'; ctx.shadowBlur = 20;
    const core = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    core.addColorStop(0, '#ffffff'); core.addColorStop(0.7, '#E0F2FE'); core.addColorStop(1, '#7DD3FC');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

/**
 * Renderizador de cada bola, por `id` del catálogo de la tienda.
 * @type {Record<string, (ctx: CanvasRenderingContext2D, b: Ball, color: string, fx?: {spin: number, power: number}) => void>}
 */
const BALL_RENDERERS = {
    classic: drawBallClassic,
    pixel:   drawBallPixel,
    planet:  drawBallPlanet,
    eye:     drawBallEye,
    soccer:  drawBallSoccer,
    comet:   drawBallComet
};

/**
 * Dibuja una bola con la bola equipada (o la clásica si el id guardado no
 * existe). Tras un golpe se aplasta: se estira en la dirección del
 * movimiento y se estrecha en la otra.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Ball} b
 * @param {string} color
 */
function renderBallVFX(ctx, b, color) {
    const draw = BALL_RENDERERS[equippedId('balls')] || BALL_RENDERERS.classic;
    const fx = { spin: b.spin, power: b.power ? 1 : 0 };
    if (!(b.squash > 0.001)) {
        draw(ctx, b, color, fx);
        return;
    }
    const a = Math.atan2(b.dy, b.dx);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(a);
    ctx.scale(1 + 0.25 * b.squash, 1 - 0.2 * b.squash);
    ctx.rotate(-a);
    ctx.translate(-b.x, -b.y);
    draw(ctx, b, color, fx);
    ctx.restore();
}
