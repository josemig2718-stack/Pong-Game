/**
 * bosses/yisus.js
 * ------------------------------------------------------------------
 * 5 · YISUS — El Aura (piso 4, El trono)
 * Telekinesis sobre la bola y parada de tiempo sobre tu paleta.
 * El muro final antes del giro.
 *
 * Lo registra bosses/index.js en BOSS_MECHANICS, que se carga después
 * (ver el comentario de esa tabla).
 * ------------------------------------------------------------------
 */

'use strict';

/** @type {BossMechanics} */
const bossYisus = {
    config: { targetScore: 7, aiSpeed: 0.98, aiError: 9,  aiBias: 48 },
    // Arranca en su llegada (LLEGADAS[5]) y sigue sin cortarse por la VS
    music: 'yisus_trono',

    init() {
        bossState.telekinesis = 0;
        bossState.telekinesisCd = 6000;
        bossState.timeStopPhase = 'idle';  // idle → warning → active
        bossState.timeStopTimer = 11000;
        bossState.tint = 0;
    },

    update(dt) {
        const ms = dt * MS_PER_FRAME;
        const b = state.balls[0];

        // --- Telekinesis: desvía la bola cuando va hacia el jugador ---
        if (bossState.telekinesis > 0) {
            bossState.telekinesis -= ms;
        } else {
            bossState.telekinesisCd -= ms;
            if (bossState.telekinesisCd <= 0 && b && b.dx < 0 && b.x > GAME_WIDTH * 0.45 && b.x < GAME_WIDTH * 0.8) {
                bossState.telekinesisCd = 5000 + Math.random() * 4000;
                bossState.telekinesis = 600;
                const dir = Math.random() > 0.5 ? 1 : -1;
                b.dy = dir * b.speed * 0.65;
                soundEffects.wallHit({ x: b.x });
                triggerShake(4, 100);
            }
        }

        // --- Parada de tiempo: avisa antes de congelar, nunca sorprende ---
        bossState.timeStopTimer -= ms;
        if (bossState.timeStopTimer <= 0) {
            if (bossState.timeStopPhase === 'idle') {
                bossState.timeStopPhase = 'warning';
                bossState.timeStopTimer = 800;
                soundEffects.bossWarning();
            } else if (bossState.timeStopPhase === 'warning') {
                bossState.timeStopPhase = 'active';
                bossState.timeStopTimer = 600;
                soundEffects.timeStop();
            } else {
                bossState.timeStopPhase = 'idle';
                bossState.timeStopTimer = 10000 + Math.random() * 5000;
            }
        }
        const targetTint = bossState.timeStopPhase === 'active' ? 1 : 0;
        bossState.tint += (targetTint - bossState.tint) * Math.min(1, 0.2 * dt);
    },

    /** game.js consulta esto: mientras es true, la paleta del jugador no responde. */
    freezesPlayer() {
        return bossState.timeStopPhase === 'active';
    },

    render(ctx) {
        if (bossState.telekinesis > 0 && state.balls.length > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p2.x, p2.y + p2.height / 2);
            ctx.lineTo(state.balls[0].x, state.balls[0].y);
            ctx.strokeStyle = 'rgba(234, 179, 8, 0.55)';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
        }
    },

    renderOverlay(ctx) {
        if (bossState.tint > 0.01) {
            ctx.fillStyle = `rgba(234, 179, 8, ${0.16 * bossState.tint})`;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }
        if (bossState.timeStopPhase === 'warning') {
            const blink = Math.sin(Date.now() / 70) > 0 ? '#eab308' : '#78350f';
            drawText('EL TIEMPO SE DETIENE...', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, blink, 26);
        } else if (bossState.timeStopPhase === 'active') {
            drawText('TIEMPO DETENIDO', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, '#eab308', 30);
        }
        if (bossState.telekinesis > 0) {
            drawText('¡TELEKINESIS!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, '#eab308', 24);
        }
    }
};
