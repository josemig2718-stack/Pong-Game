/**
 * bosses/dani.js
 * ------------------------------------------------------------------
 * 2 · DANI — El Arquitecto del Caos
 * Escudo telegrafiado (2 impactos) y teletransporte a la posición
 * prevista de la bola. Escudo propio, aislado de los power-ups.
 *
 * Lo registra bosses/index.js en BOSS_MECHANICS, que se carga después
 * (ver el comentario de esa tabla).
 * ------------------------------------------------------------------
 */

'use strict';

/** @type {BossMechanics} */
const bossDani = {
    config: { targetScore: 6, aiSpeed: 0.85, aiError: 16, aiBias: 66 },

    init() {
        bossState.shieldPhase = 'idle';   // idle → warning → active
        bossState.shieldTimer = 7000;
        bossState.shieldHp = 0;
        bossState.teleportTimer = 9000;
        bossState.teleportFlash = 0;
        bossState.gridOffset = 0;
    },

    update(dt) {
        const ms = dt * MS_PER_FRAME;
        bossState.gridOffset = (bossState.gridOffset + dt * 0.3) % 40;
        if (bossState.teleportFlash > 0) bossState.teleportFlash -= ms;

        bossState.shieldTimer -= ms;
        if (bossState.shieldTimer <= 0) {
            if (bossState.shieldPhase === 'idle') {
                bossState.shieldPhase = 'warning';
                bossState.shieldTimer = 1000;              // 1s de aviso antes de aparecer
                soundEffects.bossWarning();
            } else if (bossState.shieldPhase === 'warning') {
                bossState.shieldPhase = 'active';
                bossState.shieldHp = 2;
                bossState.shieldTimer = 6000;
                soundEffects.bossShield();
            } else {
                bossState.shieldPhase = 'idle';
                bossState.shieldTimer = 8000;
            }
        }

        // Teletransporte: solo cuando no hay escudo, para no acumular presión.
        bossState.teleportTimer -= ms;
        if (bossState.teleportTimer <= 0 && bossState.shieldPhase === 'idle') {
            bossState.teleportTimer = 7000 + Math.random() * 4000;
            const b = state.balls[0];
            if (b && b.dx > 0) {
                spawnParticles(p2.x + p2.width / 2, p2.y + p2.height / 2, '#3b82f6', 14);
                p2.y = Math.max(0, Math.min(GAME_HEIGHT - p2.height, b.y - p2.height / 2));
                bossState.teleportFlash = 320;
                spawnParticles(p2.x + p2.width / 2, p2.y + p2.height / 2, '#3b82f6', 14);
                soundEffects.bossTeleport();
            }
        }
    },

    /** El escudo de Dani vive delante de su paleta y aguanta 2 impactos. */
    collide(b) {
        if (bossState.shieldPhase !== 'active' || bossState.shieldHp <= 0) return false;
        const sx = p2.x - 34;
        if (b.dx <= 0) return false;
        if (b.x + b.radius < sx || b.x - b.radius > sx + 10) return false;

        b.dx = -Math.abs(b.dx);
        b.x = sx - b.radius;
        bossState.shieldHp--;
        triggerShake(5, 140);
        spawnParticles(sx, b.y, '#3b82f6', 18);
        soundEffects.shieldBlock();
        if (bossState.shieldHp <= 0) {
            bossState.shieldPhase = 'idle';
            bossState.shieldTimer = 8000;
        }
        return true;
    },

    render(ctx) {
        // Rejilla de planos en la mitad de Dani
        ctx.save();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = GAME_WIDTH / 2; x < GAME_WIDTH; x += 40) {
            ctx.moveTo(x + bossState.gridOffset, 0);
            ctx.lineTo(x + bossState.gridOffset, GAME_HEIGHT);
        }
        for (let y = 0; y < GAME_HEIGHT; y += 40) {
            ctx.moveTo(GAME_WIDTH / 2, y);
            ctx.lineTo(GAME_WIDTH, y);
        }
        ctx.stroke();

        const sx = p2.x - 34;
        if (bossState.shieldPhase === 'warning') {
            // Aviso parpadeante: el jugador tiene 1s para reaccionar
            const blink = Math.sin(Date.now() / 60) > 0 ? 0.5 : 0.15;
            ctx.fillStyle = `rgba(59, 130, 246, ${blink})`;
            ctx.fillRect(sx, 0, 10, GAME_HEIGHT);
        } else if (bossState.shieldPhase === 'active' && bossState.shieldHp > 0) {
            // Agrietado cuando le queda un solo impacto
            ctx.fillStyle = bossState.shieldHp > 1 ? 'rgba(59,130,246,0.75)' : 'rgba(59,130,246,0.35)';
            ctx.fillRect(sx, 0, 10, GAME_HEIGHT);
            ctx.shadowColor = '#3b82f6';
            ctx.shadowBlur = 16;
            ctx.fillRect(sx, 0, 10, GAME_HEIGHT);
            ctx.shadowBlur = 0;
            if (bossState.shieldHp === 1) {
                ctx.strokeStyle = 'rgba(255,255,255,0.7)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const y = (GAME_HEIGHT / 6) * i + 20;
                    ctx.moveTo(sx, y);
                    ctx.lineTo(sx + 10, y + 14);
                }
                ctx.stroke();
            }
        }

        if (bossState.teleportFlash > 0) {
            ctx.globalAlpha = Math.min(1, bossState.teleportFlash / 320) * 0.6;
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(p2.x - 8, p2.y - 8, p2.width + 16, p2.height + 16);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }
};
