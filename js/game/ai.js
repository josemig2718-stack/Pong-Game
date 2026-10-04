/**
 * game/ai.js
 * ------------------------------------------------------------------
 * La paleta controlada por la CPU (y la gemela del dúo de jefes).
 *
 * La dificultad sale de dos números: la velocidad de la paleta y una
 * zona muerta (errorMargin) en la que no corrige. Los jefes además
 * apuntan con un desvío (bossAim) que se renueva en cada golpe: una zona
 * muerta menor que media paleta no provoca fallos por sí sola, así que
 * sin ese desvío la CPU sería imbatible.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Mueve la paleta de la CPU (p2) y, en el combate del dúo, la gemela.
 * @param {number} dt
 * @param {object|null} bcfg config del jefe en curso (bossConfig())
 */
function moveCpu(dt, bcfg) {
    let aiSpeed = paddleSpeed, errorMargin = 0;
    if (bcfg) {
        // Cada jefe de campaña tiene su propia habilidad: esa es la curva
        // de dificultad que el lore promete (⭐⭐ a ⭐⭐⭐⭐⭐).
        aiSpeed = paddleSpeed * bcfg.aiSpeed;
        errorMargin = bcfg.aiError;
    } else if (state.mode === 'hachepe') {
        aiSpeed = paddleSpeed * 1.15; // Velocidad alta pero superable
        errorMargin = 10; // Un ligero margen de error
    } else {
        if (settings.difficulty === 1) { aiSpeed = paddleSpeed * 0.45; errorMargin = 30; }
        else if (settings.difficulty === 2) { aiSpeed = paddleSpeed * 0.65; errorMargin = 15; }
        else { aiSpeed = paddleSpeed * 0.95; errorMargin = 0; }
    }

    // La CPU persigue la bola más cercana que vaya hacia ella
    let targetBall = state.balls[0];
    let closestDist = Infinity;
    for (const b of state.balls) {
        if (b.dx > 0) { // va hacia la CPU
            const dist = Math.abs(b.x - p2.x);
            if (dist < closestDist) { closestDist = dist; targetBall = b; }
        }
    }
    if (!targetBall) targetBall = state.balls[0];

    const p2Center = p2.y + p2.height / 2;
    // Los jefes apuntan con un desvío que se renueva en cada golpe: sin él
    // la CPU es literalmente imbatible y el combate no termina nunca.
    const aim = bcfg ? bossAim() : 0;
    if (targetBall && targetBall.dx > 0) {
        const objetivo = targetBall.y + aim;
        if (p2Center < objetivo - errorMargin) p2.y += aiSpeed * dt;
        else if (p2Center > objetivo + errorMargin) p2.y -= aiSpeed * dt;
    } else {
        if (p2Center < GAME_HEIGHT / 2 - 5) p2.y += aiSpeed * 0.5 * dt;
        else if (p2Center > GAME_HEIGHT / 2 + 5) p2.y -= aiSpeed * 0.5 * dt;
    }

    // Lógica para el clon (Mario y Valen)
    if (p2Twin.active && p2Twin.retreatMs > 0) {
        // Retirado tras encajar gol: sale del campo por abajo. Esa es la
        // ventana del jugador para volver a anotar.
        p2Twin.y += paddleSpeed * 1.5 * dt;
    } else if (p2Twin.active) {
        const twinCenter = p2Twin.y + p2Twin.height / 2;

        // Valen (p2) cubrirá de la mitad de la cancha hacia arriba
        // Mario (p2Twin) cubrirá de la mitad de la cancha hacia abajo
        const twinSpeed = paddleSpeed * 1.25; // Mario es un poco más rápido pero solo cubre abajo

        if (targetBall && targetBall.dx > 0) {
            // Si la bola está en la mitad superior, Mario baja al centro para esperar
            if (targetBall.y < GAME_HEIGHT / 2) {
                if (twinCenter < GAME_HEIGHT * 0.75 - 10) p2Twin.y += twinSpeed * dt;
                else if (twinCenter > GAME_HEIGHT * 0.75 + 10) p2Twin.y -= twinSpeed * dt;
            } else {
                // Si está en la mitad inferior, Mario ataca
                if (twinCenter < targetBall.y - 10) p2Twin.y += twinSpeed * dt;
                else if (twinCenter > targetBall.y + 10) p2Twin.y -= twinSpeed * dt;
            }
        } else {
            // Volver a posición default inferior
            if (twinCenter < GAME_HEIGHT * 0.75 - 10) p2Twin.y += twinSpeed * 0.5 * dt;
            else if (twinCenter > GAME_HEIGHT * 0.75 + 10) p2Twin.y -= twinSpeed * 0.5 * dt;
        }

        // Y Valen (p2) modifica su comportamiento para priorizar arriba
        if (targetBall && targetBall.dx > 0 && targetBall.y >= GAME_HEIGHT / 2) {
            // Si la bola va muy abajo, Valen se queda en el centro alto
            if (p2Center < GAME_HEIGHT * 0.25 - 10) p2.y += aiSpeed * dt;
            else if (p2Center > GAME_HEIGHT * 0.25 + 10) p2.y -= aiSpeed * dt;
        }
    }
}
