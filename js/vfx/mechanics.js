/**
 * vfx/mechanics.js
 * ------------------------------------------------------------------
 * Lo que se ve de las mecánicas de golpe (laboratorio v2, vfx-v2-d.js):
 *
 *   MECH_FX.perfect / smash  anillo y texto flotante (¡PERFECTO!, ¡SMASH!)
 *   MECH_FX.spin             flechas que giran alrededor de una bola con efecto
 *   MECH_FX.charge           anillo de carga del smash junto a la paleta
 *   MECH_FX.fever            bordes del campo que arden en la fiebre del rally
 *   MECH_FX.update / render  avanzan y dibujan anillos, textos y los
 *                            estallidos del súper golpe (vfx/super.js)
 *
 * mechPaddleHit guarda el destello de cada paleta al golpear (1 → 0),
 * que los estilos de paleta reciben como fx.hit.
 *
 * Azar: vfxRandom; tiempo: vfxT(). Nunca Math.random. Con "menos
 * movimiento" la fiebre se queda en el degradado, sin llamas.
 * ------------------------------------------------------------------
 */

'use strict';

/** @typedef {{ x: number, y: number, text: string, color: string, t: number }} MechText */
/** @typedef {{ x: number, y: number, t: number, color: string, w: number, max: number }} MechRing */

/** Textos flotantes: ¡PERFECTO!, ¡SMASH! @type {MechText[]} */
let mechTexts = [];
/** @type {MechRing[]} */
let mechRings = [];
/** Destello de cada paleta al golpear: 1 recién golpeada → 0. */
const mechPaddleHit = { p1: 0, p2: 0 };

function mechPopText(x, y, text, color) {
    mechTexts.push({ x, y, text, color, t: 0 });
}

/** @param {'p1'|'p2'} side */
function mechFlashPaddle(side) {
    mechPaddleHit[side] = 1;
}

/** Vacía anillos, textos, destellos y estallidos (al empezar o abandonar una partida). */
function clearMechFX() {
    mechTexts = [];
    mechRings = [];
    mechPaddleHit.p1 = 0;
    mechPaddleHit.p2 = 0;
    clearSuperBursts();
}

const MECH_FX = {
    /** Golpe perfecto: anillo blanco y "¡PERFECTO!" que sube. */
    perfect(x, y, color) {
        mechRings.push({ x, y, t: 0, color: '#ffffff', w: 3, max: 60 });
        mechPopText(x + (x < GAME_WIDTH / 2 ? 110 : -110), y - 30, '¡PERFECTO!', color);
    },
    /** Salida del smash: onda y "¡SMASH!". */
    smash(x, y, color) {
        mechRings.push({ x, y, t: 0, color, w: 5, max: 110 });
        mechPopText(x + (x < GAME_WIDTH / 2 ? 110 : -110), y - 30, '¡SMASH!', '#FDE047');
    },
    update(dt) {
        for (const r of mechRings) r.t += dt;
        mechRings = mechRings.filter((r) => r.t < 22);
        for (const m of mechTexts) m.t += dt;
        mechTexts = mechTexts.filter((m) => m.t < 50);
        mechPaddleHit.p1 *= Math.pow(0.8, dt);
        mechPaddleHit.p2 *= Math.pow(0.8, dt);
        updateSuperBursts(dt);
    },
    /** @param {CanvasRenderingContext2D} ctx */
    render(ctx) {
        ctx.save();
        for (const r of mechRings) {
            const k = r.t / 22;
            ctx.strokeStyle = hexToRgba(r.color, 0.9 * (1 - k)); ctx.lineWidth = r.w * (1 - k) + 1;
            ctx.beginPath(); ctx.arc(r.x, r.y, 8 + k * r.max, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.font = '14px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const m of mechTexts) {
            const k = m.t / 50;
            const s = m.t < 6 ? 0.6 + m.t / 6 * 0.6 : 1.2 - Math.min(0.2, (m.t - 6) / 20);
            ctx.save();
            ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
            ctx.translate(m.x, m.y - k * 30);
            ctx.scale(s, s);
            ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(m.text, 3, 3);
            ctx.shadowColor = m.color; ctx.shadowBlur = 12; ctx.fillStyle = m.color; ctx.fillText(m.text, 0, 0);
            ctx.restore();
        }
        ctx.restore();
        renderSuperBursts(ctx);
    },
    /**
     * Efecto de la bola: flechas curvas que giran a su alrededor, del lado de la curva.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Ball} b
     */
    spin(ctx, b, color) {
        const s = b.spin || 0;
        if (Math.abs(s) < 0.08) return;
        const t = vfxT();
        const k = Math.min(1, Math.abs(s));
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(t * 10 * Math.sign(s));
        ctx.strokeStyle = hexToRgba('#ffffff', 0.3 + 0.5 * k); ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
            ctx.rotate(Math.PI);
            ctx.beginPath(); ctx.arc(0, 0, b.radius + 5, 0, 1.1 * k + 0.4); ctx.stroke();
            const a = 1.1 * k + 0.4, ex = Math.cos(a) * (b.radius + 5), ey = Math.sin(a) * (b.radius + 5);
            ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.sin(a) * -4 - Math.cos(a) * 3, ey + Math.cos(a) * -4 - Math.sin(a) * 3); ctx.stroke();
        }
        ctx.restore();
    },
    /**
     * Carga del smash: anillo que se llena junto a la paleta y chispas que convergen.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Paddle} p
     * @param {string} color
     * @param {number} charge 0..1
     */
    charge(ctx, p, color, charge) {
        if (charge <= 0) return;
        const cx = p.x < GAME_WIDTH / 2 ? p.x + p.width + 18 : p.x - 18, cy = p.y + p.height / 2;
        const full = charge >= 1;
        ctx.save();
        ctx.strokeStyle = hexToRgba(color, 0.25); ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = full ? '#FDE047' : color; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = full ? 14 : 6;
        ctx.beginPath(); ctx.arc(cx, cy, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = hexToRgba(full ? '#FDE047' : color, 0.9);
        for (let i = 0; i < 5; i++) {
            const ph = (vfxT() * 2 + i / 5) % 1, a = i * 1.26;
            const r = 30 * (1 - ph);
            ctx.globalAlpha = ph;
            ctx.fillRect(p.x + p.width / 2 + Math.cos(a) * r, cy + Math.sin(a) * r * 2.4, 2, 2);
        }
        ctx.restore();
    },
    /**
     * Fiebre del rally: bordes del campo que arden en el color del tema.
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} color
     * @param {number} heat 0..1
     */
    fever(ctx, color, heat) {
        if (heat <= 0) return;
        const t = vfxT();
        const flames = !prefersReducedMotion();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const [y0, dir] of [[0, 1], [GAME_HEIGHT, -1]]) {
            const g = ctx.createLinearGradient(0, y0, 0, y0 + dir * 70);
            g.addColorStop(0, hexToRgba(color, 0.35 * heat)); g.addColorStop(1, hexToRgba(color, 0));
            ctx.fillStyle = g; ctx.fillRect(0, Math.min(y0, y0 + dir * 70), GAME_WIDTH, 70);
            if (!flames) continue;
            // Lenguas que suben
            for (let i = 0; i < 26; i++) {
                const x = i * 32 + 16, fl = 0.5 + 0.5 * Math.sin(t * 9 + i * 1.7);
                const h = (14 + 26 * fl) * heat;
                ctx.fillStyle = hexToRgba(i % 3 ? color : '#FDE047', 0.25 * heat);
                ctx.beginPath(); ctx.moveTo(x - 10, y0); ctx.quadraticCurveTo(x, y0 + dir * h * 1.4, x + 10, y0); ctx.closePath(); ctx.fill();
            }
        }
        ctx.restore();
    }
};
