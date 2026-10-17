/**
 * vfx/super.js
 * ------------------------------------------------------------------
 * Súper golpe: el aura de la bola mientras va en súper y el estallido
 * al golpear y al marcar. Cada estilo tiene { aura(ctx, b, color),
 * burst(x, y, color) }; los estallidos viven en superBursts y avanzan con
 * MECH_FX.update (vfx/mechanics.js).
 *
 * De momento solo existe "Energía", el gratuito: la fase 5 añade los
 * estilos de la tienda y superStyleId() pasará a leer el equipado.
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
    energy: { c1: null, c2: '#ffffff' }
};

/** Estilo de súper golpe en uso. */
function superStyleId() {
    return 'energy';
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
            ctx.beginPath(); ctx.arc(p.x, p.y, p.s * p.life, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

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
    }
};
