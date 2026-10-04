/**
 * game/effects.js
 * ------------------------------------------------------------------
 * Efectos de impacto que no son cosméticos de la tienda: partículas y
 * vibración de pantalla. Los usan la física, los jefes y los power-ups.
 * ------------------------------------------------------------------
 */

'use strict';

/** Lanza `count` partículas en todas direcciones desde (x, y). */
function spawnParticles(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        state.particles.push({
            x, y,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            life: 1,
            color
        });
    }
}

/** Hace vibrar la pantalla (si el jugador no lo ha desactivado). */
function triggerShake(intensity = 8, durationMs = 200) {
    if (!settings.screenShake) return;
    state.shakeIntensity = intensity;
    state.shakeTimeMs = durationMs;
}

/** Física simple de las partículas: se mueven y se desvanecen. */
function updateParticles(dt) {
    state.particles.forEach(p => {
        p.x += p.dx * dt;
        p.y += p.dy * dt;
        p.life -= 0.04 * dt;
    });
    state.particles = state.particles.filter(p => p.life > 0);
}

/** Consume el tiempo de vibración (basado en tiempo, no en fotogramas). */
function updateShake(dt) {
    if (state.shakeTimeMs > 0) {
        state.shakeTimeMs -= dt * MS_PER_FRAME;
        if (state.shakeTimeMs < 0) state.shakeTimeMs = 0;
    }
}
