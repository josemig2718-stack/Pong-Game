/**
 * bosses/duo.js
 * ------------------------------------------------------------------
 * 3 · MARIO Y VALENTÍN — El Dúo Letal
 * Dos paletas repartiéndose el campo. Al encajar gol, una se
 * retira unos segundos: esa es la ventana del jugador.
 *
 * Lo registra bosses/index.js en BOSS_MECHANICS, que se carga después
 * (ver el comentario de esa tabla).
 * ------------------------------------------------------------------
 */

'use strict';

/** @type {BossMechanics} */
const bossDuo = {
    config: { targetScore: 6, aiSpeed: 0.9,  aiError: 14, aiBias: 58 },

    init() {
        p2Twin.active = true;
        p2Twin.y = GAME_HEIGHT / 2 + 50;
        p2Twin.retreatMs = 0;
    },

    update(dt) {
        if (p2Twin.retreatMs > 0) {
            p2Twin.retreatMs -= dt * MS_PER_FRAME;
            if (p2Twin.retreatMs <= 0) {
                p2Twin.retreatMs = 0;
            }
        }
    },

    /** Tras encajar gol, el gemelo se retira 3s. */
    onGoal(scorerIsP1) {
        if (!scorerIsP1) return;
        p2Twin.retreatMs = 3000;
        soundEffects.bossRetreat();
    },

    render(ctx) {
        // Marca visual de qué mitad cubre cada uno
        ctx.save();
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.15)';
        ctx.setLineDash([6, 10]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(GAME_WIDTH / 2, GAME_HEIGHT / 2);
        ctx.lineTo(GAME_WIDTH, GAME_HEIGHT / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    },

    renderOverlay(ctx) {
        if (p2Twin.retreatMs > 0) {
            drawText('¡MARIO SE RETIRA!', GAME_WIDTH * 0.72, 130, '#f97316', 18);
        }
    }
};
