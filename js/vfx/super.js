/**
 * vfx/super.js
 * ------------------------------------------------------------------
 * Súper golpe: el aura de la bola mientras va en súper y el estallido
 * al golpear y al marcar. Cada estilo tiene { aura(ctx, b, color),
 * burst(x, y, color) }; los estallidos viven en superBursts y avanzan con
 * MECH_FX.update (vfx/mechanics.js).
 *
 * Energía es el gratuito; Llamas, Hielo y Rayo se compran en la tienda
 * (categoría super). Cada súper usa el estilo de quien lo lanzó
 * (superStyleId): el equipado para el jugador, Energía para la máquina.
 *
 * Azar: vfxRandom; tiempo: vfxT(). Nunca Math.random.
 * ------------------------------------------------------------------
 */

'use strict';

/** @typedef {{ x: number, y: number, dx: number, dy: number, life: number, s: number, r: number }} SuperSpark */
/** @typedef {{ x: number, y: number, kind: string, color: string, t: number, parts: SuperSpark[] }} SuperBurst */

/** @type {SuperBurst[]} */
let superBursts = [];

/** Colores de cada estilo: c1 el anillo y las chispas que se apagan (null = el color del tema), c2 las chispas vivas. */
const SUPER_STYLE = {
    energy:    { c1: null,      c2: '#ffffff' },
    fire:      { c1: '#F97316', c2: '#FDE047' },
    ice:       { c1: '#7DD3FC', c2: '#F0F9FF' },
    lightning: { c1: '#818CF8', c2: '#E0E7FF' }
};

/**
 * Estilo del súper golpe que lanzó `owner`: el equipado si es un jugador
 * (el 1, o el 2 en local); la CPU, Hachepe y los jefes usan siempre
 * Energía.
 * @param {'p1'|'p2'|null} owner
 */
function superStyleId(owner) {
    const human = owner === 'p1' || (owner === 'p2' && state.mode === 'local');
    const id = human ? equippedId('super') : 'energy';
    return SUPER_FX[id] ? id : 'energy';
}

/** Un estallido: anillo de choque y 26 chispas en todas direcciones. */
function pushSuperBurst(x, y, kind, color) {
    const parts = [];
    const n = 26;
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + vfxRandom() * 0.2, sp = 2 + vfxRandom() * 5;
        parts.push({ x, y, dx: Math.cos(a) * sp, dy: Math.sin(a) * sp, life: 1, s: 2 + vfxRandom() * 3, r: vfxRandom() * 6 });
    }
    superBursts.push({ x, y, kind, color, t: 0, parts });
}

function updateSuperBursts(dt) {
    for (const B of superBursts) {
        B.t += dt;
        for (const p of B.parts) {
            p.x += p.dx * dt; p.y += p.dy * dt;
            p.dx *= Math.pow(0.92, dt); p.dy *= Math.pow(0.92, dt);
            p.life -= 0.03 * dt; p.r += 0.1 * dt;
        }
    }
    superBursts = superBursts.filter((B) => B.t < 40);
}

/** Quita los estallidos en curso (al empezar o abandonar una partida). */
function clearSuperBursts() {
    superBursts = [];
}

/** @param {CanvasRenderingContext2D} ctx */
function renderSuperBursts(ctx) {
    for (const B of superBursts) {
        const st = SUPER_STYLE[B.kind];
        const k = B.t / 40;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // Anillo de choque
        ctx.strokeStyle = hexToRgba(st.c1 || B.color, 0.8 * (1 - k)); ctx.lineWidth = 4 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(B.x, B.y, 10 + k * 90, 0, Math.PI * 2); ctx.stroke();
        for (const p of B.parts) {
            if (p.life <= 0) continue;
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.life > 0.6 ? st.c2 : (st.c1 || B.color);
            if (B.kind === 'ice') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillRect(-p.s, -0.8, p.s * 2, 1.6); ctx.fillRect(-0.8, -p.s, 1.6, p.s * 2); ctx.restore(); }
            else if (B.kind === 'lightning') { ctx.fillRect(p.x, p.y, 2, 2); }
            else { ctx.beginPath(); ctx.arc(p.x, p.y, p.s * p.life, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.restore();
    }
}

/** @type {Record<string, {aura: (ctx: CanvasRenderingContext2D, b: Ball, color: string) => void, burst: (x: number, y: number, color: string) => void}>} */
const SUPER_FX = {
    /** Energía (gratuito): anillos del color del tema que giran alrededor de la bola. */
    energy: {
        /** @param {CanvasRenderingContext2D} ctx @param {Ball} b @param {string} color */
        aura(ctx, b, color) {
            const t = vfxT();
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(b.x, b.y, b.radius, b.x, b.y, b.radius * 3);
            g.addColorStop(0, hexToRgba(color, 0.5)); g.addColorStop(1, hexToRgba(color, 0));
            ctx.fillStyle = g; ctx.fillRect(b.x - b.radius * 3, b.y - b.radius * 3, b.radius * 6, b.radius * 6);
            ctx.strokeStyle = hexToRgba(color, 0.9); ctx.lineWidth = 2;
            for (let i = 0; i < 2; i++) {
                ctx.beginPath(); ctx.ellipse(b.x, b.y, b.radius * 1.9, b.radius * 0.8, t * 6 + i * Math.PI / 2, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
        },
        burst(x, y, color) { pushSuperBurst(x, y, 'energy', color); }
    },
    /** Llamas: la bola arde. */
    fire: {
        aura(ctx, b) {
            const t = vfxT();
            const sp = Math.hypot(b.dx || 0, b.dy || 0) || 1;
            const ux = -(b.dx || 1) / sp, uy = -(b.dy || 0) / sp;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const halo = ctx.createRadialGradient(b.x, b.y, b.radius * 0.5, b.x, b.y, b.radius * 3);
            halo.addColorStop(0, 'rgba(253, 224, 71, 0.6)'); halo.addColorStop(0.5, 'rgba(249, 115, 22, 0.35)'); halo.addColorStop(1, 'rgba(220, 38, 38, 0)');
            ctx.fillStyle = halo; ctx.fillRect(b.x - b.radius * 3, b.y - b.radius * 3, b.radius * 6, b.radius * 6);
            // Lenguas de fuego hacia atrás
            for (let i = 0; i < 7; i++) {
                const fl = 0.6 + 0.4 * Math.sin(t * 28 + i * 2.3);
                const off = (i - 3) * b.radius * 0.28;
                const len = b.radius * (2.2 + fl * 1.6) * (1 - Math.abs(i - 3) * 0.15);
                const x0 = b.x - uy * off, y0 = b.y + ux * off;
                const g = ctx.createLinearGradient(x0, y0, x0 + ux * len, y0 + uy * len);
                g.addColorStop(0, 'rgba(254, 240, 138, 0.8)'); g.addColorStop(0.4, 'rgba(249, 115, 22, 0.6)'); g.addColorStop(1, 'rgba(185, 28, 28, 0)');
                ctx.strokeStyle = g; ctx.lineWidth = b.radius * 0.55; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + ux * len * 0.5 + Math.sin(t * 20 + i) * 4, y0 + uy * len * 0.5 + Math.cos(t * 20 + i) * 4, x0 + ux * len, y0 + uy * len); ctx.stroke();
            }
            ctx.restore();
        },
        burst(x, y, color) { pushSuperBurst(x, y, 'fire', color); }
    },
    /** Hielo: escarcha que gira y cristales alrededor. */
    ice: {
        aura(ctx, b) {
            const t = vfxT();
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(b.x, b.y, b.radius, b.x, b.y, b.radius * 2.8);
            g.addColorStop(0, 'rgba(125, 211, 252, 0.45)'); g.addColorStop(1, 'rgba(125, 211, 252, 0)');
            ctx.fillStyle = g; ctx.fillRect(b.x - b.radius * 3, b.y - b.radius * 3, b.radius * 6, b.radius * 6);
            ctx.strokeStyle = '#E0F2FE'; ctx.lineWidth = 1.5;
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 + t * 2;
                const x0 = b.x + Math.cos(a) * b.radius * 1.5, y0 = b.y + Math.sin(a) * b.radius * 1.5;
                ctx.beginPath(); ctx.moveTo(x0 - Math.cos(a) * 4, y0 - Math.sin(a) * 4); ctx.lineTo(x0 + Math.cos(a) * 4, y0 + Math.sin(a) * 4);
                ctx.moveTo(x0 - Math.sin(a) * 3, y0 + Math.cos(a) * 3); ctx.lineTo(x0 + Math.sin(a) * 3, y0 - Math.cos(a) * 3); ctx.stroke();
            }
            ctx.restore();
        },
        burst(x, y, color) { pushSuperBurst(x, y, 'ice', color); }
    },
    /** Rayo: arcos eléctricos que saltan de la bola. */
    lightning: {
        aura(ctx, b) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = '#C7D2FE'; ctx.lineWidth = 1.6; ctx.shadowColor = '#818CF8'; ctx.shadowBlur = 10;
            for (let i = 0; i < 4; i++) {
                const a = vfxRandom() * Math.PI * 2;
                let x = b.x + Math.cos(a) * b.radius, y = b.y + Math.sin(a) * b.radius;
                ctx.beginPath(); ctx.moveTo(x, y);
                for (let s = 0; s < 4; s++) { x += Math.cos(a) * 5 + (vfxRandom() - 0.5) * 8; y += Math.sin(a) * 5 + (vfxRandom() - 0.5) * 8; ctx.lineTo(x, y); }
                ctx.stroke();
            }
            ctx.shadowBlur = 0;
            const g = ctx.createRadialGradient(b.x, b.y, b.radius, b.x, b.y, b.radius * 2.6);
            g.addColorStop(0, 'rgba(129, 140, 248, 0.5)'); g.addColorStop(1, 'rgba(129, 140, 248, 0)');
            ctx.fillStyle = g; ctx.fillRect(b.x - b.radius * 3, b.y - b.radius * 3, b.radius * 6, b.radius * 6);
            ctx.restore();
        },
        burst(x, y, color) { pushSuperBurst(x, y, 'lightning', color); }
    }
};
