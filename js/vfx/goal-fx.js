/**
 * vfx/goal-fx.js
 * ------------------------------------------------------------------
 * Efectos al marcar gol (anillo clásico, destello con cámara lenta,
 * confeti, onda expansiva, fuegos artificiales, pantalla rota, agujero
 * negro, tormenta, GOOOL 8-bit y corona). Cada efecto del catálogo (data/shop.js,
 * categoría goalEffects) tiene aquí su entrada en GOAL_FX. Salen del
 * borde por el que salió la bola y a la altura del gol.
 * ------------------------------------------------------------------
 */

'use strict';

// Estado de los efectos de gol
let goalFlashAlpha = 0;
let goalSlowmoTimer = 0;
let goalSquares = [];
let goalRing = null;          // { x, y, r, life, color }
let goalFlashRays = null;     // { x, y, life }
let confettiParticles = [];
let confettiStreamers = [];
let shockwave = null;         // { x, y, t, color }

/**
 * Vacía el estado de todos los efectos de gol (el reset() de cada uno y
 * los temporizadores comunes): al empezar, reiniciar o abandonar una
 * partida, y al cambiar de efecto, no queda ninguno a medias ni la cámara
 * lenta del destello.
 */
function resetGoalVFX() {
    goalFlashAlpha = 0;
    goalSlowmoTimer = 0;
    for (const fx of Object.values(GOAL_FX)) fx.reset();
}

// --- Clásico: anillo del color del tema y cuadrados disparados ---
function triggerGoalClassic(goalX, goalY, color) {
    goalSquares = [];
    const dir = goalX < GAME_WIDTH / 2 ? 1 : -1;
    const n = prefersReducedMotion() ? 10 : 20;
    for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + vfxRandom() * 0.25;
        const sp = 3 + vfxRandom() * 3.5;
        goalSquares.push({
            x: goalX, y: goalY,
            dx: Math.cos(ang) * sp * (Math.cos(ang) * dir < 0 ? 0.35 : 1), dy: Math.sin(ang) * sp,
            s: 5 + vfxRandom() * 5, c: i % 2 ? '#ffffff' : color, life: 1
        });
    }
    goalRing = { x: goalX, y: goalY, r: 6, life: 1, color };
}
function updateGoalClassic(dt) {
    for (const q of goalSquares) {
        q.x += q.dx * dt; q.y += q.dy * dt;
        q.dx *= Math.pow(0.94, dt); q.dy *= Math.pow(0.94, dt);
        q.life -= 0.028 * dt;
    }
    goalSquares = goalSquares.filter((q) => q.life > 0);
    if (goalRing) {
        goalRing.r += 7 * dt;
        goalRing.life -= 0.04 * dt;
        if (goalRing.life <= 0) goalRing = null;
    }
}
function resetGoalClassic() { goalSquares = []; goalRing = null; }
function renderGoalClassic(ctx) {
    ctx.save();
    if (goalRing) {
        ctx.globalAlpha = goalRing.life;
        ctx.strokeStyle = goalRing.color;
        ctx.shadowColor = goalRing.color;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(goalRing.x, goalRing.y, goalRing.r, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
    }
    for (const q of goalSquares) {
        ctx.globalAlpha = Math.max(0, q.life);
        ctx.fillStyle = q.c;
        ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
    }
    ctx.restore();
}

// --- Flash épico: destello blanco, rayos y el rayo amarillo ---
/** El rayo del icono de la tienda (viewBox de 96). */
const GOAL_BOLT_PATH = 'M56 8L30 52H46L40 88L68 40H52L60 8Z';
function triggerGoalFlash(goalX, goalY) {
    // La cámara lenta afecta a la física: estos dos valores no cambian
    goalFlashAlpha = 0.3;
    goalSlowmoTimer = 300;
    goalFlashRays = { x: goalX, y: goalY, life: 1 };
}
function updateGoalFlash(dt) {
    if (!goalFlashRays) return;
    goalFlashRays.life -= 0.022 * dt;
    if (goalFlashRays.life <= 0) goalFlashRays = null;
}
function resetGoalFlash() { goalFlashRays = null; }
function renderGoalFlash(ctx) {
    // Con "menos movimiento": destello a media intensidad y sin rayos
    const reduced = prefersReducedMotion();
    if (goalFlashAlpha > 0) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = reduced ? goalFlashAlpha / 2 : goalFlashAlpha;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.restore();
    }
    if (!goalFlashRays) return;
    const f = goalFlashRays;
    const ease = 1 - Math.pow(f.life, 3);
    ctx.save();
    if (!reduced) {
        // Rayos desde el punto del gol
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = hexToRgba('#FDE047', 0.55 * f.life);
        ctx.lineWidth = 3;
        const r0 = 30 + 200 * ease, r1 = 60 + 520 * ease;
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0);
            ctx.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1);
            ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
    }
    // El rayo aparece junto al gol y se encoge
    const bx = Math.max(90, Math.min(GAME_WIDTH - 90, f.x + (f.x < GAME_WIDTH / 2 ? 90 : -90)));
    const scale = 1.8 * (0.8 + 0.4 * f.life);
    ctx.translate(bx, Math.max(110, Math.min(GAME_HEIGHT - 110, f.y)));
    ctx.scale(scale, scale);
    ctx.translate(-48, -48);
    ctx.globalAlpha = Math.min(1, f.life * 1.6);
    const bolt = vfxPath(GOAL_BOLT_PATH);
    ctx.shadowColor = '#FDE047';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#FDE047';
    ctx.fill(bolt);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.stroke(bolt);
    ctx.restore();
}

// --- Confeti: papeles que dan vueltas y serpentinas ---
const CONFETTI_COLORS = ['#F472B6', '#FACC15', '#22D3EE', '#A3E635', '#FB923C', '#A78BFA', '#ffffff'];

/** Confeti: también lo usa la secuencia del falso final de la campaña. */
function triggerGoalConfetti(goalX, goalY) {
    const dir = goalX < GAME_WIDTH / 2 ? 1 : -1;
    const reduced = prefersReducedMotion();   // la mitad de papeles y serpentinas
    confettiParticles = Array.from({ length: reduced ? 40 : 80 }, () => ({
        x: goalX, y: goalY,
        dx: dir * (1.5 + vfxRandom() * 9), dy: -3 - vfxRandom() * 9,
        w: 5 + vfxRandom() * 5, h: 3 + vfxRandom() * 2.5,
        rot: vfxRandom() * Math.PI * 2, rs: (vfxRandom() - 0.5) * 0.3,
        flip: vfxRandom() * Math.PI * 2, fs: 0.15 + vfxRandom() * 0.2,
        c: CONFETTI_COLORS[Math.floor(vfxRandom() * CONFETTI_COLORS.length)], life: 1
    }));
    confettiStreamers = Array.from({ length: reduced ? 2 : 4 }, (_, i) => ({
        x: goalX, y: goalY, dx: dir * (2 + i * 1.3), dy: -6 - vfxRandom() * 3, ph: vfxRandom() * 6,
        c: CONFETTI_COLORS[i], life: 1, pts: []
    }));
}
function updateGoalConfetti(dt) {
    for (const p of confettiParticles) {
        p.x += p.dx * dt; p.y += p.dy * dt;
        p.dx *= Math.pow(0.985, dt); p.dy += 0.16 * dt;
        p.rot += p.rs * dt; p.flip += p.fs * dt;
        p.life -= 0.007 * dt;
    }
    confettiParticles = confettiParticles.filter((p) => p.life > 0 && p.y < GAME_HEIGHT + 40);
    for (const s of confettiStreamers) {
        s.x += s.dx * dt; s.y += s.dy * dt; s.dy += 0.14 * dt; s.dx *= Math.pow(0.99, dt);
        s.pts.push({ x: s.x, y: s.y });
        if (s.pts.length > 22) s.pts.shift();
        s.life -= 0.01 * dt;
    }
    confettiStreamers = confettiStreamers.filter((s) => s.life > 0);
}
function resetGoalConfetti() { confettiParticles = []; confettiStreamers = []; }
function renderGoalConfetti(ctx) {
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (const s of confettiStreamers) {
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.strokeStyle = s.c;
        ctx.beginPath();
        s.pts.forEach((p, i) => {
            const wob = Math.sin(i * 0.8 + s.ph) * 5;
            if (i === 0) ctx.moveTo(p.x + wob, p.y); else ctx.lineTo(p.x + wob, p.y);
        });
        ctx.stroke();
    }
    for (const p of confettiParticles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.flip));    // el papel "da vueltas"
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
    }
    ctx.restore();
}

// --- Onda expansiva: tres anillos con retraso y un destello central ---
const SHOCKWAVE_MAX_RADIUS = 560;
/** [retraso en fotogramas, grosor, color o null para el del tema] de cada anillo. */
/** @type {Array<[number, number, string | null]>} */
const SHOCKWAVE_RINGS = [[0, 4, '#ffffff'], [7, 2.5, null], [14, 1.5, null]];
function triggerGoalShockwave(goalX, goalY, color) {
    shockwave = { x: goalX, y: goalY, t: 0, color };
}
function updateGoalShockwave(dt) {
    if (!shockwave) return;
    shockwave.t += dt;
    if (shockwave.t > 80) shockwave = null;
}
function resetGoalShockwave() { shockwave = null; }
function renderGoalShockwave(ctx) {
    if (!shockwave) return;
    const s = shockwave;
    ctx.save();
    // Destello central
    const core = Math.max(0, 1 - s.t / 18);
    if (core > 0) {
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 120);
        g.addColorStop(0, hexToRgba(s.color, 0.45 * core));
        g.addColorStop(1, hexToRgba(s.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(s.x - 120, s.y - 120, 240, 240);
    }
    for (const [delay, w, c] of SHOCKWAVE_RINGS) {
        const tt = s.t - delay;
        if (tt <= 0) continue;
        const r = SHOCKWAVE_MAX_RADIUS * (1 - Math.pow(1 - Math.min(1, tt / 60), 2.2));
        const a = Math.max(0, 1 - r / SHOCKWAVE_MAX_RADIUS);
        ctx.globalAlpha = a * (c ? 0.95 : 0.7);
        ctx.strokeStyle = c || s.color;
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
}

// --- Fuegos artificiales ---
let fwRockets = [], fwSparks = [];
const FW_COLORS = ['#F472B6', '#FACC15', '#22D3EE', '#A3E635', '#FB923C', '#C4B5FD'];
function fwLaunch(gx, gy, delay, tx, ty, col) {
    fwRockets.push({ x: gx, y: gy, sx: gx, sy: gy, tx, ty, t: -delay, col });
}
function triggerFireworks(gx, gy, color, power = 0) {
    fwRockets = []; fwSparks = [];
    const side = gx < GAME_WIDTH / 2 ? 1 : -1;
    const n = 3 + power;                             // dos cohetes más en un gol de smash
    for (let i = 0; i < n; i++) {
        fwLaunch(gx, gy, i * 7, gx + side * (150 + i * 90 + vfxRandom() * 40), 90 + vfxRandom() * 160, i === 0 ? color : FW_COLORS[Math.floor(vfxRandom() * FW_COLORS.length)]);
    }
}
function updateFireworks(dt) {
    for (const r of fwRockets) {
        r.t += dt;
        if (r.t < 0) continue;
        const k = Math.min(1, r.t / 18), e = 1 - Math.pow(1 - k, 3);
        r.x = r.sx + (r.tx - r.sx) * e; r.y = r.sy + (r.ty - r.sy) * e - Math.sin(k * Math.PI) * 30;
        if (k < 1) for (let q = 0; q < 2; q++) fwSparks.push({ x: r.x, y: r.y, dx: (vfxRandom() - 0.5) * 1.2, dy: (vfxRandom() - 0.5) * 1.2 + 0.4, life: 0.6, c: q ? '#FDE68A' : r.col, s: 2 });
        if (k >= 1 && !r.done) {
            r.done = true;
            const m = 70;
            for (let i = 0; i < m; i++) {
                const a = (i / m) * Math.PI * 2, sp = 2.8 + vfxRandom() * 3.4;
                fwSparks.push({ x: r.x, y: r.y, dx: Math.cos(a) * sp, dy: Math.sin(a) * sp, life: 1, c: i % 5 ? r.col : '#ffffff', s: 2.4, tw: vfxRandom() * 6 });
            }
            fwSparks.push({ x: r.x, y: r.y, dx: 0, dy: 0, life: 1, c: '#ffffff', flash: true });
        }
    }
    fwRockets = fwRockets.filter((r) => !r.done);
    for (const s of fwSparks) {
        s.x += s.dx * dt; s.y += s.dy * dt;
        s.dx *= Math.pow(0.955, dt); s.dy = s.dy * Math.pow(0.955, dt) + 0.05 * dt;
        s.life -= (s.flash ? 0.09 : 0.016) * dt;
    }
    fwSparks = fwSparks.filter((s) => s.life > 0);
}
function renderFireworks(ctx) {
    const t = vfxT();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of fwRockets) {
        if (r.t < 0) continue;
        const rg = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, 14);
        rg.addColorStop(0, 'rgba(255,255,255,0.9)'); rg.addColorStop(1, hexToRgba(r.col, 0));
        ctx.fillStyle = rg; ctx.fillRect(r.x - 14, r.y - 14, 28, 28);
    }
    for (const s of fwSparks) {
        if (s.flash) {
            const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 70);
            g.addColorStop(0, `rgba(255,255,255,${0.5 * s.life})`); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.fillRect(s.x - 70, s.y - 70, 140, 140);
            continue;
        }
        const tw = s.tw !== undefined && s.life < 0.4 ? (Math.sin(t * 30 + s.tw) > 0 ? 1 : 0.2) : 1;
        ctx.globalAlpha = Math.min(1, s.life * 1.3) * tw;
        ctx.strokeStyle = s.c; ctx.lineWidth = s.s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.dx * 3, s.y - s.dy * 3); ctx.stroke();
    }
    ctx.restore();
}
function resetFireworks() { fwRockets = []; fwSparks = []; }

// --- Pantalla rota: el campo se agrieta y se recompone ---
let goalShatter = null;
function crackFrom(x, y, a, len, depth, out) {
    const pts = [{ x, y }];
    let cx = x, cy = y, ang = a;
    const steps = 6 + Math.floor(vfxRandom() * 4);
    for (let i = 0; i < steps; i++) {
        ang += (vfxRandom() - 0.5) * 0.7;
        const l = len / steps * (0.6 + vfxRandom() * 0.8);
        cx += Math.cos(ang) * l; cy += Math.sin(ang) * l;
        pts.push({ x: cx, y: cy });
        if (depth > 0 && vfxRandom() < 0.25) crackFrom(cx, cy, ang + (vfxRandom() < 0.5 ? 0.9 : -0.9), len * 0.4, depth - 1, out);
    }
    out.push({ pts, w: depth + 0.8 });
}
function triggerShatter(gx, gy, color, power = 0) {
    const cracks = [];
    const x = gx < GAME_WIDTH / 2 ? 6 : 794;
    const base = gx < GAME_WIDTH / 2 ? 0 : Math.PI;
    const n = 7 + power;
    for (let i = 0; i < n; i++) crackFrom(x, gy, base + (i / (n - 1) - 0.5) * Math.PI * 0.9, 170 + vfxRandom() * 190, 1, cracks);
    const shards = Array.from({ length: 16 }, () => {
        const a = base + (vfxRandom() - 0.5) * 2.4, sp = 1.5 + vfxRandom() * 4;
        return { x, y: gy, dx: Math.cos(a) * sp, dy: Math.sin(a) * sp - 1.5, r: vfxRandom() * 6, rs: (vfxRandom() - 0.5) * 0.3, s: 5 + vfxRandom() * 9, life: 1 };
    });
    goalShatter = { cracks, shards, t: 0, x, y: gy, color };
}
function updateShatter(dt) {
    if (!goalShatter) return;
    goalShatter.t += dt;
    for (const s of goalShatter.shards) { s.x += s.dx * dt; s.y += s.dy * dt; s.dy += 0.22 * dt; s.r += s.rs * dt; s.life -= 0.016 * dt; }
    if (goalShatter.t > 95) goalShatter = null;
}
function renderShatter(ctx) {
    if (!goalShatter) return;
    const S = goalShatter, t = S.t;
    const grow = Math.min(1, t / 6);                       // se agrieta en 6 fotogramas
    const heal = t < 40 ? 1 : Math.max(0, 1 - (t - 40) / 45);  // se recompone
    ctx.save();
    if (t < 8) { ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - t / 8)})`; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const c of S.cracks) {
        const n = c.pts.length, show = Math.max(1, Math.floor(n * grow * heal));
        ctx.beginPath();
        for (let i = 0; i < show; i++) (i ? ctx.lineTo(c.pts[i].x, c.pts[i].y) : ctx.moveTo(c.pts[i].x, c.pts[i].y));
        ctx.strokeStyle = `rgba(148, 163, 184, ${0.3 * heal})`; ctx.lineWidth = c.w + 3; ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.85 * heal})`; ctx.lineWidth = Math.max(0.8, c.w * 0.6); ctx.stroke();
    }
    for (const s of S.shards) {
        if (s.life <= 0) continue;
        ctx.save();
        ctx.translate(s.x, s.y); ctx.rotate(s.r);
        ctx.globalAlpha = s.life;
        ctx.fillStyle = 'rgba(226, 232, 240, 0.35)'; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -s.s); ctx.lineTo(s.s * 0.7, s.s * 0.6); ctx.lineTo(-s.s * 0.5, s.s * 0.4); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}
function resetShatter() { goalShatter = null; }

// --- Agujero negro: lo absorbe todo hacia el gol ---
let goalBlackHole = null;
function triggerBlackHole(gx, gy, color, power = 0) {
    const x = gx < GAME_WIDTH / 2 ? 60 : 740;
    goalBlackHole = {
        x, y: Math.max(90, Math.min(510, gy)), t: 0, color, big: 1 + 0.15 * power,
        motes: Array.from({ length: 110 }, () => {
            const a = vfxRandom() * Math.PI * 2, r = 80 + vfxRandom() * 420;
            return { a, r, sp: 0.02 + vfxRandom() * 0.03, c: vfxRandom() < 0.5 ? '#C4B5FD' : vfxRandom() < 0.5 ? '#FDBA74' : '#ffffff', s: 1.5 + vfxRandom() * 2.2 };
        })
    };
}
function updateBlackHole(dt) {
    if (!goalBlackHole) return;
    const B = goalBlackHole;
    B.t += dt;
    for (const m of B.motes) { m.a += (m.sp + 6 / Math.max(20, m.r)) * dt; m.r -= (1.5 + 260 / Math.max(30, m.r)) * dt * (B.t < 70 ? 1 : 0); }
    B.motes = B.motes.filter((m) => m.r > 12);
    if (B.t > 100) goalBlackHole = null;
}
function renderBlackHole(ctx) {
    if (!goalBlackHole) return;
    const B = goalBlackHole, t = B.t;
    const size = (t < 14 ? t / 14 : t < 70 ? 1 : Math.max(0, 1 - (t - 70) / 30)) * 46 * B.big;
    ctx.save();
    // Oscurece el campo alrededor
    const dim = ctx.createRadialGradient(B.x, B.y, 0, B.x, B.y, 300 * B.big);
    dim.addColorStop(0, `rgba(0,0,0,${0.55 * size / 38})`); dim.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = dim; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Partículas en espiral
    ctx.globalCompositeOperation = 'lighter';
    for (const m of B.motes) {
        const x = B.x + Math.cos(m.a) * m.r, y = B.y + Math.sin(m.a) * m.r * 0.75;
        ctx.globalAlpha = Math.min(1, m.r / 60);
        ctx.fillStyle = m.c; ctx.fillRect(x, y, m.s, m.s);
    }
    // Disco de acreción
    if (size > 1) {
        ctx.globalAlpha = 1;
        const halo = ctx.createRadialGradient(B.x, B.y, size, B.x, B.y, size * 3.2);
        halo.addColorStop(0, 'rgba(251, 146, 60, 0.45)'); halo.addColorStop(0.4, 'rgba(168, 85, 247, 0.25)'); halo.addColorStop(1, 'rgba(168, 85, 247, 0)');
        ctx.fillStyle = halo; ctx.fillRect(B.x - size * 3.2, B.y - size * 3.2, size * 6.4, size * 6.4);
        for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = i === 0 ? 'rgba(253, 186, 116, 0.85)' : i === 1 ? 'rgba(196, 181, 253, 0.6)' : hexToRgba(B.color, 0.45);
            ctx.lineWidth = 6 - i * 1.5;
            ctx.beginPath(); ctx.ellipse(B.x, B.y, size * (1.6 + i * 0.35), size * (0.55 + i * 0.12), -0.35 + t * 0.002, t * 0.12 + i, t * 0.12 + i + Math.PI * 1.5); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        const core = ctx.createRadialGradient(B.x, B.y, size * 0.6, B.x, B.y, size * 1.15);
        core.addColorStop(0, '#000'); core.addColorStop(0.8, '#000'); core.addColorStop(1, 'rgba(253, 186, 116, 0.9)');
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(B.x, B.y, size * 1.15, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}
function resetBlackHole() { goalBlackHole = null; }

// --- Tormenta: rayos que caen sobre la portería ---
let goalStorm = null;
function boltPath(x0, y0, x1, y1) {
    const pts = [{ x: x0, y: y0 }];
    const n = 14;
    for (let i = 1; i < n; i++) {
        const k = i / n;
        pts.push({ x: x0 + (x1 - x0) * k + (vfxRandom() - 0.5) * 46 * (1 - k * 0.6), y: y0 + (y1 - y0) * k });
    }
    pts.push({ x: x1, y: y1 });
    return pts;
}
function triggerStorm(gx, gy, color, power = 0) {
    const x = gx < GAME_WIDTH / 2 ? 18 : 782;
    goalStorm = { x, y: gy, t: 0, color, strikes: [0, 10, 22].concat(power >= 1 ? [30] : [], power >= 2 ? [38] : []).map((d, i) => ({ d, x0: x + (gx < GAME_WIDTH / 2 ? 1 : -1) * (40 + i * 70 + vfxRandom() * 40), pts: null })), sparks: [] };
}
function updateStorm(dt) {
    if (!goalStorm) return;
    goalStorm.t += dt;
    for (const s of goalStorm.strikes) {
        if (!s.pts && goalStorm.t >= s.d) {
            s.pts = boltPath(s.x0, -10, goalStorm.x, goalStorm.y);
            for (let i = 0; i < 18; i++) {
                const a = vfxRandom() * Math.PI * 2, sp = 1 + vfxRandom() * 4;
                goalStorm.sparks.push({ x: goalStorm.x, y: goalStorm.y, dx: Math.cos(a) * sp, dy: Math.sin(a) * sp - 1, life: 1 });
            }
        }
    }
    for (const p of goalStorm.sparks) { p.x += p.dx * dt; p.y += p.dy * dt; p.dy += 0.15 * dt; p.life -= 0.035 * dt; }
    goalStorm.sparks = goalStorm.sparks.filter((p) => p.life > 0);
    if (goalStorm.t > 70) goalStorm = null;
}
function renderStorm(ctx) {
    if (!goalStorm) return;
    const S = goalStorm;
    ctx.save();
    // Cielo que oscurece y relampaguea
    const dark = Math.min(1, S.t / 6) * (S.t > 50 ? Math.max(0, 1 - (S.t - 50) / 20) : 1);
    ctx.fillStyle = `rgba(2, 6, 23, ${0.4 * dark})`; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (const s of S.strikes) {
        if (!s.pts) continue;
        const age = S.t - s.d;
        if (age < 3) { ctx.fillStyle = `rgba(191, 219, 254, ${0.16 * (1 - age / 3)})`; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); }
        const a = Math.max(0, 1 - age / 14);
        if (a <= 0) continue;
        ctx.lineJoin = 'round';
        const path = () => { ctx.beginPath(); s.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); };
        ctx.globalCompositeOperation = 'lighter';
        path(); ctx.strokeStyle = `rgba(96, 165, 250, ${0.45 * a})`; ctx.lineWidth = 9; ctx.stroke();
        path(); ctx.strokeStyle = `rgba(255, 255, 255, ${a})`; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
    }
    // Impacto
    const g = ctx.createRadialGradient(S.x, S.y, 0, S.x, S.y, 80);
    g.addColorStop(0, hexToRgba(S.color, 0.5 * dark)); g.addColorStop(1, hexToRgba(S.color, 0));
    ctx.fillStyle = g; ctx.fillRect(S.x - 80, S.y - 80, 160, 160);
    ctx.fillStyle = '#E0F2FE';
    for (const p of S.sparks) { ctx.globalAlpha = p.life; ctx.fillRect(p.x, p.y, 2.5, 2.5); }
    ctx.restore();
}
function resetStorm() { goalStorm = null; }

// --- GOOOL 8-bit: letras pixeladas gigantes que rebotan ---
const PIXEL_FONT = {
    G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    '!': ['1', '1', '1', '1', '1', '0', '1']
};
let goal8bit = null;
function triggerGoal8bit(gx, gy, color, power = 0) {
    const word = 'G' + 'O'.repeat(3 + power) + 'L!';
    goal8bit = { word, t: 0, color, cx: gx < GAME_WIDTH / 2 ? 220 : 580, blocks: [] };
}
function updateGoal8bit(dt) {
    if (!goal8bit) return;
    goal8bit.t += dt;
    if (goal8bit.t > 64 && !goal8bit.blocks.length) {     // al final, las letras estallan en bloques
        const L = goal8LayoutBlocks();
        goal8bit.blocks = L.map((b) => ({ ...b, dx: (vfxRandom() - 0.5) * 6, dy: -2 - vfxRandom() * 4, life: 1 }));
    }
    for (const b of goal8bit.blocks) { b.x += b.dx * dt; b.y += b.dy * dt; b.dy += 0.3 * dt; b.life -= 0.04 * dt; }
    if (goal8bit.t > 95) goal8bit = null;
}
function goal8LayoutBlocks() {
    const G = goal8bit, px = 9, gap = px;
    const widths = [...G.word].map((ch) => PIXEL_FONT[ch][0].length * px);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (G.word.length - 1);
    let x = G.cx - total / 2;
    const out = [];
    [...G.word].forEach((ch, li) => {
        // Cada letra cae con retraso y rebota (muelle amortiguado)
        const tt = Math.max(0, G.t - li * 3);
        const k = Math.min(1, tt / 16);
        const bounce = k < 1 ? -260 * Math.pow(1 - k, 2) : -Math.abs(Math.sin((tt - 16) * 0.35)) * 26 * Math.exp(-(tt - 16) * 0.08);
        const y0 = 240 + bounce;
        PIXEL_FONT[ch].forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '1') out.push({ x: x + rx * px, y: y0 + ry * px, s: px, li }); }));
        x += widths[li] + gap;
    });
    return out;
}
function renderGoal8bit(ctx) {
    if (!goal8bit) return;
    const G = goal8bit;
    ctx.save();
    if (G.blocks.length) {
        for (const b of G.blocks) { ctx.globalAlpha = Math.max(0, b.life); ctx.fillStyle = b.li % 2 ? '#ffffff' : G.color; ctx.fillRect(b.x, b.y, b.s - 1, b.s - 1); }
    } else {
        const L = goal8LayoutBlocks();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        for (const b of L) ctx.fillRect(b.x + 5, b.y + 5, b.s - 1, b.s - 1);   // sombra dura
        ctx.shadowColor = G.color; ctx.shadowBlur = 12;
        for (const b of L) { ctx.fillStyle = b.li === 0 || b.li === G.word.length - 2 ? G.color : '#ffffff'; ctx.fillRect(b.x, b.y, b.s - 1, b.s - 1); }
    }
    ctx.restore();
}
function resetGoal8bit() { goal8bit = null; }

// --- Corona: corona dorada que baja sobre el lado del que anota (exclusivo) ---
let goalCrown = null;
function triggerCrown(gx, gy, color, power = 0) {
    goalCrown = { x: gx > GAME_WIDTH / 2 ? 200 : GAME_HEIGHT, t: 0, color, sparks: [] };   // gol por la derecha = anota el jugador de la izquierda
}
function updateCrown(dt) {
    if (!goalCrown) return;
    goalCrown.t += dt;
    if (goalCrown.t > 18 && goalCrown.t < 60 && vfxRandom() < 0.5 * dt) goalCrown.sparks.push({ x: goalCrown.x + (vfxRandom() - 0.5) * 90, y: 90 + (vfxRandom() - 0.5) * 60, life: 1, s: 3 + vfxRandom() * 4 });
    for (const s of goalCrown.sparks) s.life -= 0.04 * dt;
    goalCrown.sparks = goalCrown.sparks.filter((s) => s.life > 0);
    if (goalCrown.t > 90) goalCrown = null;
}
function renderCrown(ctx) {
    if (!goalCrown) return;
    const C = goalCrown, t = C.t;
    const k = Math.min(1, t / 18), drop = 1 - Math.pow(1 - k, 3);
    const y = -70 + drop * 180 + (k >= 1 ? Math.sin((t - 18) * 0.12) * 4 : 0);
    const alpha = t > 70 ? Math.max(0, 1 - (t - 70) / 20) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Rayos dorados detrás
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t * 0.02;
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.18)'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(C.x + Math.cos(a) * 55, y + Math.sin(a) * 55); ctx.lineTo(C.x + Math.cos(a) * 150, y + Math.sin(a) * 150); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // Corona
    ctx.translate(C.x, y);
    const w = 96, h = 62;
    ctx.beginPath();
    ctx.moveTo(-w / 2, h / 2); ctx.lineTo(-w / 2, -h / 4); ctx.lineTo(-w / 4, h / 10); ctx.lineTo(0, -h / 2); ctx.lineTo(w / 4, h / 10); ctx.lineTo(w / 2, -h / 4); ctx.lineTo(w / 2, h / 2); ctx.closePath();
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#FEF3C7'); g.addColorStop(0.4, '#FACC15'); g.addColorStop(1, '#B45309');
    ctx.shadowColor = '#FACC15'; ctx.shadowBlur = 22;
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#78350F'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#92400E'; ctx.fillRect(-w / 2, h / 2 - 9, w, 9);
    for (const [gx2, col] of [[-22, '#EF4444'], [0, C.color], [22, '#3B82F6']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(gx2, h / 2 - 4.5, 3.5, 0, Math.PI * 2); ctx.fill(); }
    for (const px of [-w / 2, 0, w / 2]) { ctx.fillStyle = '#FEF3C7'; ctx.beginPath(); ctx.arc(px, px === 0 ? -h / 2 : -h / 4, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#FEF9C3';
    for (const s of C.sparks) { ctx.globalAlpha = Math.sin(s.life * Math.PI) * alpha; vfxSparkle(ctx, s.x, s.y, s.s); ctx.fill(); }
    ctx.restore();
}
function resetCrown() { goalCrown = null; }

/**
 * Efecto de cada gol, por `id` del catálogo: trigger(x, y, color del tema,
 * power), update(dt), render(ctx) y reset(). `power` es 0 en un gol
 * normal y 2 en uno de smash (goalPower): a más poder, efecto más
 * grande. Las partículas y la vibración del gol las pone siempre
 * game/. El destello blanco y su cámara lenta se desvanecen en
 * updateGoalVFX(), no en su update(), para que no se queden congelados si
 * se cambia de efecto a mitad de la animación.
 * @type {Record<string, {trigger: (x: number, y: number, color: string, power: number) => void, update: (dt: number) => void, render: (ctx: CanvasRenderingContext2D) => void, reset: () => void}>}
 */
const GOAL_FX = {
    classic:    { trigger: triggerGoalClassic,   update: updateGoalClassic,   render: renderGoalClassic,   reset: resetGoalClassic },
    epic_flash: { trigger: triggerGoalFlash,     update: updateGoalFlash,     render: renderGoalFlash,     reset: resetGoalFlash },
    confetti:   { trigger: triggerGoalConfetti,  update: updateGoalConfetti,  render: renderGoalConfetti,  reset: resetGoalConfetti },
    shockwave:  { trigger: triggerGoalShockwave, update: updateGoalShockwave, render: renderGoalShockwave, reset: resetGoalShockwave },
    fireworks:  { trigger: triggerFireworks,     update: updateFireworks,     render: renderFireworks,     reset: resetFireworks },
    shatter:    { trigger: triggerShatter,       update: updateShatter,       render: renderShatter,       reset: resetShatter },
    black_hole: { trigger: triggerBlackHole,     update: updateBlackHole,     render: renderBlackHole,     reset: resetBlackHole },
    storm:      { trigger: triggerStorm,         update: updateStorm,         render: renderStorm,         reset: resetStorm },
    goal_8bit:  { trigger: triggerGoal8bit,      update: updateGoal8bit,      render: renderGoal8bit,      reset: resetGoal8bit },
    crown:      { trigger: triggerCrown,         update: updateCrown,         render: renderCrown,         reset: resetCrown }
};

/**
 * Poder de un gol para su efecto: 0 normal, 2 de smash (el 1 era el
 * antiguo smash sin energía, que ya no existe).
 * @param {Ball} b
 */
function goalPower(b) {
    return b.power === 'super' ? 2 : 0;
}

/**
 * Lanza el efecto de gol equipado en la posición del gol.
 * @param {number} [power] goalPower() de la bola que entró
 */
function triggerGoalVFX(goalX, goalY, power = 0) {
    const fxId = equippedId('goalEffects') || 'classic';

    if (GOAL_FX[fxId]) {
        GOAL_FX[fxId].trigger(goalX, goalY, currentThemeHex(), power);
    }
}

/**
 * Avanza todos los efectos de gol, no solo el equipado: si se cambia de
 * efecto a mitad de una animación, la anterior termina en vez de quedarse
 * congelada (los que no tienen nada en curso salen al momento).
 * @param {number} dt
 */
function updateGoalVFX(dt) {
    for (const fx of Object.values(GOAL_FX)) {
        fx.update(dt);
    }

    // Los temporizadores comunes avanzan siempre, sea cual sea el efecto
    // equipado: si se cambia a mitad de la animación no se quedan colgados.
    if (goalSlowmoTimer > 0) {
        goalSlowmoTimer -= dt * MS_PER_FRAME;
        if (goalSlowmoTimer < 0) goalSlowmoTimer = 0;
    }
    if (goalFlashAlpha > 0) {
        goalFlashAlpha -= 0.02 * dt;
        if (goalFlashAlpha < 0) goalFlashAlpha = 0;
    }
}

/**
 * Dibuja el efecto de gol equipado.
 * @param {CanvasRenderingContext2D} ctx
 */
function renderGoalVFX(ctx) {
    const fxId = equippedId('goalEffects') || 'classic';

    if (GOAL_FX[fxId]) {
        GOAL_FX[fxId].render(ctx);
    }
}

/** Multiplicador de dt: 0.3 mientras dura la cámara lenta del destello épico. */
function getGoalSlowmo() {
    return goalSlowmoTimer > 0 ? 0.3 : 1.0;
}
