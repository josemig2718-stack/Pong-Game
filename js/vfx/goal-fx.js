/**
 * vfx/goal-fx.js
 * ------------------------------------------------------------------
 * Efectos al marcar gol (anillo clásico, destello con cámara lenta,
 * confeti, onda expansiva). Cada efecto del catálogo (data/shop.js,
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

/**
 * Efecto de cada gol, por `id` del catálogo: trigger(x, y, color del tema),
 * update(dt), render(ctx). Las partículas y la vibración del gol las pone
 * siempre game/. El destello blanco y su cámara lenta se desvanecen en
 * updateGoalVFX(), no en su update(), para que no se queden congelados si
 * se cambia de efecto a mitad de la animación.
 */
const GOAL_FX = {
    classic:     { trigger: triggerGoalClassic,    update: updateGoalClassic,    render: renderGoalClassic },
    epic_flash:  { trigger: triggerGoalFlash,      update: updateGoalFlash,      render: renderGoalFlash },
    confetti:    { trigger: triggerGoalConfetti,   update: updateGoalConfetti,   render: renderGoalConfetti },
    shockwave:   { trigger: triggerGoalShockwave,  update: updateGoalShockwave,  render: renderGoalShockwave }
};

/** Lanza el efecto de gol equipado en la posición del gol. */
function triggerGoalVFX(goalX, goalY) {
    const fxId = playerProgression.selectedGoalFx || 'classic';

    if (GOAL_FX[fxId]) {
        GOAL_FX[fxId].trigger(goalX, goalY, currentThemeHex());
    }
}

/**
 * Avanza el efecto de gol equipado y los temporizadores comunes.
 * @param {number} dt
 */
function updateGoalVFX(dt) {
    const fxId = playerProgression.selectedGoalFx || 'classic';

    if (GOAL_FX[fxId]) {
        GOAL_FX[fxId].update(dt);
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
    const fxId = playerProgression.selectedGoalFx || 'classic';

    if (GOAL_FX[fxId]) {
        GOAL_FX[fxId].render(ctx);
    }
}

/** Multiplicador de dt: 0.3 mientras dura la cámara lenta del destello épico. */
function getGoalSlowmo() {
    return goalSlowmoTimer > 0 ? 0.3 : 1.0;
}
