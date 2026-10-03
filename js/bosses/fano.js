/**
 * bosses/fano.js
 * ------------------------------------------------------------------
 * 4 · FANO — El Guardián de las Sombras
 * La bola desaparece al cruzar la mitad y aparecen señuelos.
 * Difícil, pero no injusto: siempre queda un rastro tenue.
 *
 * Lo registra bosses/index.js en BOSS_MECHANICS; ningún otro módulo debe
 * importarlo (ver el comentario de esa tabla).
 * ------------------------------------------------------------------
 */

import { GAME_HEIGHT, GAME_WIDTH, MS_PER_FRAME } from '../core/constants.js';
import { p1, state } from '../core/state.js';
import { soundEffects } from '../systems/audio.js';
import { bossState } from './shared.js';

export const bossFano = {
    config: { targetScore: 7, aiSpeed: 0.9,  aiError: 12, aiBias: 50 },

    init() {
        bossState.invisible = false;
        bossState.invisTimer = 2600;      // reseteado siempre: evita el arranque errático
        bossState.illusions = [];
        bossState.illusionCooldown = 900;
        bossState.vignette = 0;
    },

    update(dt) {
        const ms = dt * MS_PER_FRAME;

        bossState.invisTimer -= ms;
        if (bossState.invisTimer <= 0) {
            bossState.invisible = !bossState.invisible;
            bossState.invisTimer = bossState.invisible
                ? 1400 + Math.random() * 1200
                : 2200 + Math.random() * 2600;
            if (bossState.invisible && soundEffects.bossVanish) soundEffects.bossVanish();
        }
        // La oscuridad se cierra progresivamente mientras la bola está oculta
        const targetVig = bossState.invisible ? 1 : 0.25;
        bossState.vignette += (targetVig - bossState.vignette) * Math.min(1, 0.05 * dt);

        // Señuelos: máximo 3 a la vez y con cooldown, para que no sea ruido puro
        bossState.illusionCooldown -= ms;
        const b = state.balls[0];
        if (bossState.illusionCooldown <= 0 && b && b.dx < 0 && bossState.illusions.length < 3) {
            bossState.illusionCooldown = 700 + Math.random() * 800;
            bossState.illusions.push({
                x: b.x, y: b.y,
                dx: b.dx * (0.85 + Math.random() * 0.3),
                dy: b.dy + (Math.random() * 4 - 2),
                radius: b.radius
            });
        }
        for (let i = bossState.illusions.length - 1; i >= 0; i--) {
            const ill = bossState.illusions[i];
            ill.x += ill.dx * dt;
            ill.y += ill.dy * dt;
            if (ill.y < 0 || ill.y > GAME_HEIGHT) ill.dy *= -1;
            if (ill.x < -20 || ill.x > GAME_WIDTH + 20) bossState.illusions.splice(i, 1);
        }
    },

    /** game.js consulta esto para saber si oculta la bola real. */
    hidesBall() {
        return bossState.invisible;
    },

    render(ctx) {
        for (const ill of bossState.illusions) {
            ctx.beginPath();
            ctx.arc(ill.x, ill.y, ill.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.shadowColor = '#7c3aed';
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        // Rastro tenue de la bola real: la pista justa para que sea jugable
        const b = state.balls[0];
        if (bossState.invisible && b) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius + 2, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(124, 58, 237, 0.28)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    },

    renderOverlay(ctx) {
        if (bossState.vignette <= 0.01) return;
        const cx = p1.x + 60;
        const cy = p1.y + p1.height / 2;
        const g = ctx.createRadialGradient(cx, cy, 40, cx, cy, GAME_WIDTH * 0.85);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${0.82 * bossState.vignette})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
};
