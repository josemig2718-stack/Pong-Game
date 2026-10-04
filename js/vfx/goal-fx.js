/**
 * vfx/goal-fx.js
 * ------------------------------------------------------------------
 * Efectos al marcar gol (destello con cámara lenta, confeti, onda
 * expansiva). Cada efecto del catálogo (data/shop.js, categoría
 * goalEffects) tiene aquí su entrada en GOAL_FX.
 * ------------------------------------------------------------------
 */

import { GAME_HEIGHT, GAME_WIDTH, MS_PER_FRAME } from '../core/constants.js';
import { playerProgression } from '../systems/progression.js';

// Estado de los efectos de gol
let goalFlashAlpha = 0;
export let goalSlowmoTimer = 0;
export let confettiParticles = [];
export let shockwave = null; // { x, y, radius, maxRadius, alpha }

function triggerGoalFlash(goalX, goalY) {
    goalFlashAlpha = 0.3;
    goalSlowmoTimer = 300;
}
function renderGoalFlash(ctx) {
    if (goalFlashAlpha > 0) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = goalFlashAlpha;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.restore();
    }
}

/** Confeti: también lo usa la secuencia del falso final de la campaña. */
export function triggerGoalConfetti(goalX, goalY) {
    confettiParticles = [];
    const colors = ['#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff','#ffffff'];
    for (let i = 0; i < 50; i++) {
        confettiParticles.push({
            x: goalX,
            y: goalY,
            dx: (Math.random() - 0.5) * 6, // de -3 a 3
            dy: -1 - Math.random() * 5,    // de -6 a -1
            gravity: 0.15,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 1.0,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.4
        });
    }
}
function updateGoalConfetti(dt) {
    for (let i = confettiParticles.length - 1; i >= 0; i--) {
        const p = confettiParticles[i];
        p.x += p.dx * dt;
        p.y += p.dy * dt;
        p.dy += p.gravity * dt;
        p.rotation += p.rotSpeed * dt;
        p.life -= 0.01 * dt; // Decremento de vida
        if (p.life <= 0) {
            confettiParticles.splice(i, 1);
        }
    }
}
function renderGoalConfetti(ctx) {
    for (let i = 0; i < confettiParticles.length; i++) {
        const p = confettiParticles[i];
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-1.5, -3, 3, 6);
        ctx.restore();
    }
}

function triggerGoalShockwave(goalX, goalY) {
    shockwave = {
        x: goalX,
        y: GAME_HEIGHT / 2, // Se especifica que empiece a la mitad de la altura
        radius: 10,
        maxRadius: 500,
        alpha: 0.6
    };
}
function updateGoalShockwave(dt) {
    if (shockwave) {
        shockwave.radius += 8 * dt;
        // El alpha decrece de manera proporcional al radio
        shockwave.alpha = 0.6 * (1 - (shockwave.radius / shockwave.maxRadius));
        if (shockwave.alpha <= 0 || shockwave.radius >= shockwave.maxRadius) {
            shockwave = null;
        }
    }
}
function renderGoalShockwave(ctx) {
    if (shockwave && shockwave.alpha > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(shockwave.x, shockwave.y, shockwave.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.globalAlpha = shockwave.alpha;
        ctx.stroke();
        ctx.restore();
    }
}

const noop = () => {};

/**
 * Efecto de cada gol, por `id` del catálogo. El clásico no añade nada
 * (las partículas y la vibración del gol las pone siempre game/). El
 * destello y su cámara lenta se desvanecen en updateGoalVFX(), no en su
 * update(), para que no se queden congelados si se cambia de efecto a
 * mitad de la animación.
 */
const GOAL_FX = {
    classic:     { trigger: noop,                  update: noop,                 render: noop },
    epic_flash:  { trigger: triggerGoalFlash,      update: noop,                 render: renderGoalFlash },
    confetti:    { trigger: triggerGoalConfetti,   update: updateGoalConfetti,   render: renderGoalConfetti },
    shockwave:   { trigger: triggerGoalShockwave,  update: updateGoalShockwave,  render: renderGoalShockwave }
};

/** Lanza el efecto de gol equipado en la posición del gol. */
export function triggerGoalVFX(goalX, goalY) {
    const fxId = playerProgression.selectedGoalFx || 'classic';

    if (GOAL_FX[fxId]) {
        GOAL_FX[fxId].trigger(goalX, goalY);
    }
}

/**
 * Avanza el efecto de gol equipado y los temporizadores comunes.
 * @param {number} dt
 */
export function updateGoalVFX(dt) {
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
export function renderGoalVFX(ctx) {
    const fxId = playerProgression.selectedGoalFx || 'classic';

    if (GOAL_FX[fxId]) {
        GOAL_FX[fxId].render(ctx);
    }
}

/** Multiplicador de dt: 0.3 mientras dura la cámara lenta del destello épico. */
export function getGoalSlowmo() {
    return goalSlowmoTimer > 0 ? 0.3 : 1.0;
}
