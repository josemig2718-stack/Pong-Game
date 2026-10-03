/**
 * bosses/creator.js
 * ------------------------------------------------------------------
 * 6 · EL CREADOR — El Arquitecto del Sufrimiento
 * Arena rotada, barra de vida y tres fases. Único jefe que se gana
 * vaciando su vida, no por marcador.
 *
 * Lo registra bosses/index.js en BOSS_MECHANICS; ningún otro módulo debe
 * importarlo (ver el comentario de esa tabla).
 * ------------------------------------------------------------------
 */

import { GAME_HEIGHT, GAME_WIDTH, MS_PER_FRAME } from '../core/constants.js';
import { p1, state } from '../core/state.js';
import { soundEffects } from '../systems/audio.js';
import { bossState, CREATOR_BAND_H } from './shared.js';
import { drawText, spawnExtraBalls, spawnParticles, triggerShake } from '../game.js';

const CREATOR_MAX_HEALTH = 200;
const CREATOR_EYE_CY = CREATOR_BAND_H / 2 - 6; // centro vertical del ojo
const CREATOR_EYE_R = 92;                      // radio horizontal del ojo

// El ojo se altera conforme pierde vida: verde → ámbar → rojo inyectado.
const CREATOR_TONES = {
    1: { band: '#0b2a16', sclera: '#e8f5e9', iris: '#22c55e', lid: '#22c55e' },
    2: { band: '#2a1f05', sclera: '#f5efe0', iris: '#eab308', lid: '#eab308' },
    3: { band: '#2a0808', sclera: '#f7e3e3', iris: '#ef4444', lid: '#ef4444' }
};

export const bossCreator = {
    config: {
        targetScore: 8,        // aquí es el nº de fallos permitidos al jugador
        aiSpeed: 1.0,
        aiError: 0,
        hitDamage: 10,         // 20 impactos: con tanta presión encima, 25 era demasiado
        paddleAxis: 'x',
        useHealth: true
    },

    init() {
        bossState.health = CREATOR_MAX_HEALTH;
        bossState.maxHealth = CREATOR_MAX_HEALTH;
        bossState.phase = 1;
        bossState.invertMs = 0;
        bossState.invertCd = 9000;
        bossState.glitchMs = 0;
        bossState.fakeErrors = [];
        bossState.errorTimer = 4000;
        bossState.announce = '';
        bossState.announceMs = 0;

        // --- El ojo ---
        bossState.blink = 0;               // 0 = abierto, 1 = cerrado del todo
        bossState.blinkTimer = 3000;
        bossState.pupil = { x: GAME_WIDTH / 2, y: CREATOR_EYE_CY };

        // --- Fase 1: tramos blindados ---
        bossState.armor = [false, false, true, false, false];
        bossState.armorTimer = 5000;

        // --- Fase 2: teletransporte glitch de la bola ---
        bossState.warpPhase = 'idle';      // idle → warning
        bossState.warpTimer = 7000;

        // --- Fase 3: el rayo del ojo ---
        bossState.beamPhase = 'idle';      // idle → charge → fire
        bossState.beamTimer = 6000;
        bossState.beamX = GAME_WIDTH / 2;
        bossState.freezeMs = 0;
    },

    update(dt) {
        const ms = dt * MS_PER_FRAME;
        if (bossState.glitchMs > 0) bossState.glitchMs -= ms;
        if (bossState.announceMs > 0) bossState.announceMs -= ms;
        if (bossState.freezeMs > 0) bossState.freezeMs -= ms;

        const b = state.balls[0];

        // --- El ojo: la pupila persigue la bola, y parpadea ---
        if (b) {
            const dx = b.x - GAME_WIDTH / 2;
            const dy = b.y - CREATOR_EYE_CY;
            const dist = Math.hypot(dx, dy) || 1;
            const alcance = Math.min(dist, CREATOR_EYE_R * 0.42);
            bossState.pupil.x = GAME_WIDTH / 2 + (dx / dist) * alcance;
            bossState.pupil.y = CREATOR_EYE_CY + (dy / dist) * alcance * 0.5;
        }
        bossState.blinkTimer -= ms;
        if (bossState.blinkTimer <= 0) {
            bossState.blinkTimer = 2600 + Math.random() * 3200;
            bossState.blink = 1;
        }
        if (bossState.blink > 0) bossState.blink = Math.max(0, bossState.blink - dt * 0.14);

        // --- Cambio de fase según la vida restante ---
        const ratio = bossState.health / bossState.maxHealth;
        const newPhase = ratio > 0.66 ? 1 : (ratio > 0.33 ? 2 : 3);
        if (newPhase !== bossState.phase) {
            bossState.phase = newPhase;
            bossState.glitchMs = 900;
            bossState.blink = 1;              // el ojo se cierra y se abre de golpe
            triggerShake(14, 500);
            soundEffects.glitch();
            bossState.announce = newPhase === 2 ? 'TE VEO' : 'FIN DE LA SIMULACIÓN';
            bossState.announceMs = 2200;
            if (newPhase === 3) spawnExtraBalls();
        }

        // --- Blindaje rotatorio: obliga a apuntar en vez de repetir el golpe ---
        bossState.armorTimer -= ms;
        if (bossState.armorTimer <= 0) {
            // Nunca más de 2 tramos: con 3 de 5 blindados casi no queda hueco
            const cuantos = bossState.phase === 1 ? 1 : 2;
            bossState.armorTimer = 4200 + Math.random() * 2200;
            bossState.armor = [false, false, false, false, false];
            while (bossState.armor.filter(Boolean).length < cuantos) {
                bossState.armor[Math.floor(Math.random() * 5)] = true;
            }
            soundEffects.bossShield();
        }

        // --- Fase 2+: controles invertidos, falsos errores y teletransporte ---
        if (bossState.phase >= 2) {
            if (bossState.invertMs > 0) {
                bossState.invertMs -= ms;
            } else {
                bossState.invertCd -= ms;
                if (bossState.invertCd <= 0) {
                    bossState.invertCd = 9000 + Math.random() * 5000;
                    bossState.invertMs = 3000;
                    bossState.announce = 'CONTROLES INVERTIDOS';
                    bossState.announceMs = 1400;
                    soundEffects.glitch();
                }
            }

            bossState.errorTimer -= ms;
            if (bossState.errorTimer <= 0) {
                bossState.errorTimer = 2600 + Math.random() * 2600;
                if (bossState.fakeErrors.length < 4) {
                    const msgs = [
                        'ERR: player.exe no responde',
                        'FATAL: esperanza no definida',
                        'WARN: sé dónde vives',
                        'ERR: no puedes cerrar esto',
                        'SYS: sigo mirándote'
                    ];
                    bossState.fakeErrors.push({
                        text: msgs[Math.floor(Math.random() * msgs.length)],
                        x: 40 + Math.random() * (GAME_WIDTH - 300),
                        y: 150 + Math.random() * (GAME_HEIGHT - 320),
                        life: 2600
                    });
                }
            }
            for (let i = bossState.fakeErrors.length - 1; i >= 0; i--) {
                bossState.fakeErrors[i].life -= ms;
                if (bossState.fakeErrors[i].life <= 0) bossState.fakeErrors.splice(i, 1);
            }

            // Teletransporte de la bola, avisando medio segundo antes
            bossState.warpTimer -= ms;
            if (bossState.warpPhase === 'idle' && bossState.warpTimer <= 0) {
                bossState.warpPhase = 'warning';
                bossState.warpTimer = 500;
                soundEffects.bossWarning();
            } else if (bossState.warpPhase === 'warning' && bossState.warpTimer <= 0) {
                bossState.warpPhase = 'idle';
                bossState.warpTimer = 8000 + Math.random() * 5000;
                // Nunca justo encima de la paleta: sería un punto robado
                if (b && b.y < GAME_HEIGHT - 160) {
                    spawnParticles(b.x, b.y, '#22c55e', 16);
                    b.x = 80 + Math.random() * (GAME_WIDTH - 160);
                    spawnParticles(b.x, b.y, '#22c55e', 16);
                    soundEffects.glitch();
                }
            }
        }

        // --- Fase 3: el rayo del ojo ---
        if (bossState.phase === 3) {
            bossState.beamTimer -= ms;
            if (bossState.beamPhase === 'idle' && bossState.beamTimer <= 0) {
                bossState.beamPhase = 'charge';
                bossState.beamTimer = 1200;                 // aviso largo: da tiempo a salir
                bossState.beamX = p1.x + p1.width / 2;
                soundEffects.bossWarning();
            } else if (bossState.beamPhase === 'charge' && bossState.beamTimer <= 0) {
                bossState.beamPhase = 'fire';
                bossState.beamTimer = 320;
                soundEffects.timeStop();
                triggerShake(10, 260);
                // Solo congela si te pilla dentro. Nunca quita vida: castiga, no mata.
                if (bossState.beamX > p1.x && bossState.beamX < p1.x + p1.width) {
                    bossState.freezeMs = 800;
                    bossState.announce = '¡ATRAPADO!';
                    bossState.announceMs = 900;
                }
            } else if (bossState.beamPhase === 'fire' && bossState.beamTimer <= 0) {
                bossState.beamPhase = 'idle';
                bossState.beamTimer = 5000 + Math.random() * 3000;
            }
        }
    },

    invertsControls() {
        return bossState.invertMs > 0;
    },

    /** El rayo deja la paleta clavada un instante. */
    freezesPlayer() {
        return bossState.freezeMs > 0;
    },

    /** Los tramos blindados no reciben daño: hay que buscar el hueco. */
    segmentIsArmored(x) {
        const i = Math.max(0, Math.min(4, Math.floor((x / GAME_WIDTH) * 5)));
        return !!(bossState.armor && bossState.armor[i]);
    },

    render(ctx) {
        const jitter = bossState.glitchMs > 0 ? (Math.random() - 0.5) * 8 : 0;
        const pct = Math.max(0, bossState.health / bossState.maxHealth);
        const tono = CREATOR_TONES[bossState.phase] || CREATOR_TONES[1];

        ctx.save();
        ctx.translate(jitter, 0);

        // --- Franja del jefe, con sus tramos blindados ---
        ctx.fillStyle = tono.band;
        ctx.fillRect(0, 0, GAME_WIDTH, CREATOR_BAND_H);
        const segW = GAME_WIDTH / 5;
        for (let i = 0; i < 5; i++) {
            if (!bossState.armor[i]) continue;
            // Recortado al propio tramo: si no, las diagonales se derraman
            // fuera de la franja y por encima del ojo.
            ctx.save();
            ctx.beginPath();
            ctx.rect(i * segW, 0, segW, CREATOR_BAND_H);
            ctx.clip();
            ctx.fillStyle = 'rgba(90,95,105,0.92)';
            ctx.fillRect(i * segW, 0, segW, CREATOR_BAND_H);
            ctx.strokeStyle = 'rgba(255,255,255,0.28)';
            ctx.lineWidth = 2;
            for (let d = -CREATOR_BAND_H; d < segW; d += 16) {
                ctx.beginPath();
                ctx.moveTo(i * segW + d, 0);
                ctx.lineTo(i * segW + d + CREATOR_BAND_H, CREATOR_BAND_H);
                ctx.stroke();
            }
            ctx.restore();
        }

        // --- El ojo ---
        const abierto = 1 - bossState.blink;
        const rx = CREATOR_EYE_R;
        const ry = CREATOR_EYE_R * 0.55 * Math.max(0.04, abierto);
        const cx = GAME_WIDTH / 2;

        ctx.beginPath();
        ctx.ellipse(cx, CREATOR_EYE_CY, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = tono.sclera;
        ctx.fill();

        // Venas: el ojo se inyecta conforme se altera
        if (bossState.phase >= 2 && abierto > 0.2) {
            ctx.strokeStyle = `rgba(190, 30, 30, ${bossState.phase === 3 ? 0.8 : 0.45})`;
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 7; i++) {
                const a = (Math.PI * 2 / 7) * i + 0.4;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(a) * rx * 0.95, CREATOR_EYE_CY + Math.sin(a) * ry * 0.95);
                ctx.lineTo(cx + Math.cos(a) * rx * 0.45, CREATOR_EYE_CY + Math.sin(a) * ry * 0.45);
                ctx.stroke();
            }
        }

        if (abierto > 0.1) {
            // Iris y pupila, siguiendo la bola
            const px = bossState.pupil.x;
            const py = Math.max(CREATOR_EYE_CY - ry * 0.35, Math.min(CREATOR_EYE_CY + ry * 0.35, bossState.pupil.y));
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(cx, CREATOR_EYE_CY, rx, ry, 0, 0, Math.PI * 2);
            ctx.clip();

            ctx.beginPath();
            ctx.arc(px, py, 30, 0, Math.PI * 2);
            ctx.fillStyle = tono.iris;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(px, py, 14, 0, Math.PI * 2);
            ctx.fillStyle = '#000';
            ctx.fill();

            // El brillo es lo que lo hace parecer vivo
            ctx.beginPath();
            ctx.arc(px - 9, py - 9, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fill();
            ctx.restore();
        }

        ctx.beginPath();
        ctx.ellipse(cx, CREATOR_EYE_CY, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = tono.lid;
        ctx.lineWidth = 4;
        ctx.stroke();

        // --- Vida: se lee como el párpado inferior del ojo ---
        const bw = rx * 2;
        const bx = cx - rx;
        const by = CREATOR_EYE_CY + CREATOR_EYE_R * 0.55 + 10;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(bx, by, bw, 10);
        ctx.fillStyle = tono.iris;
        ctx.fillRect(bx, by, bw * pct, 10);
        ctx.strokeStyle = tono.lid;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, 10);

        ctx.restore();
    },

    renderOverlay(ctx) {
        // Rayo del ojo: primero marca la columna, luego dispara
        if (bossState.beamPhase === 'charge') {
            const t = 1 - (bossState.beamTimer / 1200);
            ctx.fillStyle = `rgba(239, 68, 68, ${0.12 + t * 0.2})`;
            ctx.fillRect(bossState.beamX - 22, CREATOR_BAND_H, 44, GAME_HEIGHT);
            ctx.strokeStyle = `rgba(255,255,255,${0.35 + t * 0.4})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(bossState.beamX - 22, CREATOR_BAND_H, 44, GAME_HEIGHT);
        } else if (bossState.beamPhase === 'fire') {
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fillRect(bossState.beamX - 26, CREATOR_BAND_H, 52, GAME_HEIGHT);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.75)';
            ctx.fillRect(bossState.beamX - 14, CREATOR_BAND_H, 28, GAME_HEIGHT);
        }

        // Aviso del teletransporte
        if (bossState.warpPhase === 'warning' && state.balls[0]) {
            const b = state.balls[0];
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius + 12 + Math.sin(Date.now() / 40) * 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Fase 3: la pantalla se rompe
        if (bossState.phase === 3) {
            ctx.fillStyle = 'rgba(34, 197, 94, 0.05)';
            for (let i = 0; i < GAME_HEIGHT; i += 3) ctx.fillRect(0, i, GAME_WIDTH, 1);
            ctx.font = '10px "Courier New", monospace';
            ctx.fillStyle = 'rgba(34, 197, 94, 0.5)';
            ctx.textAlign = 'left';
            for (let i = 0; i < 22; i++) {
                const x = (i * 41 + (Date.now() / 9) % 41) % GAME_WIDTH;
                const y = ((i * 137 + Date.now() / 4) % GAME_HEIGHT);
                ctx.fillText(Math.random().toString(16).slice(2, 6), x, y);
            }
        }

        for (const e of bossState.fakeErrors) {
            ctx.font = 'bold 13px "Courier New", monospace';
            ctx.textAlign = 'left';
            const w = ctx.measureText(e.text).width + 12;
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(e.x - 6, e.y - 14, w, 22);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1;
            ctx.strokeRect(e.x - 6, e.y - 14, w, 22);
            ctx.fillStyle = '#ef4444';
            ctx.fillText(e.text, e.x, e.y);
        }

        if (bossState.announceMs > 0 && bossState.announce) {
            drawText(bossState.announce, GAME_WIDTH / 2, GAME_HEIGHT / 2, '#22c55e', 34);
        }

        if (bossState.glitchMs > 0) {
            ctx.fillStyle = `rgba(34, 197, 94, ${0.18 * (bossState.glitchMs / 900)})`;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }
    }
};
