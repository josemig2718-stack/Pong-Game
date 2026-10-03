/**
 * tests/adapters/esm.js
 * ------------------------------------------------------------------
 * Adaptador de lectura para el juego en ES modules. Se inyecta como
 * <script type="module"> al final del <body>, después de main.js, e
 * importa los mismos módulos que el juego: el mapa de imports de
 * index.html resuelve estas rutas a las mismas URL (con ?v=N), así que
 * son las mismas instancias, no copias.
 *
 * Solo LEE estado. Expone window.__pong con el contrato que espera
 * tests/runner.js: si un módulo cambia de sitio en el refactor, se
 * actualizan aquí los import y el resto de los tests no se entera.
 * ------------------------------------------------------------------
 */

import { GAME_WIDTH } from '../../js/core/constants.js';
import { settings } from '../../js/core/settings.js';
import { p1, p2, p2Twin, state } from '../../js/core/state.js';
import { playerProgression } from '../../js/systems/progression.js';
import { currentRally, gameStats, maxDeficit } from '../../js/systems/stats.js';
import { confettiParticles, goalSlowmoTimer, shockwave } from '../../js/vfx/goal-fx.js';
import {
    bossAim,
    bossConfig,
    bossFreezesPlayer,
    bossHealth,
    bossHidesBall,
    bossInvertsControls,
    bossIsRotatedArena,
    bossSegmentArmored,
    bossState
} from '../../js/bosses.js';
import {
    carouselIndex,
    currentCampaignLevel,
    isDialogueActive,
    isReplayingBoss,
    midDialogueShown
} from '../../js/campaign.js';
import {
    activeEffect,
    activePowerup,
    lastHitter,
    powerupCooldownMs,
    powerupsThisGame,
    shieldWall,
    slowmoActive
} from '../../js/powerups.js';

const paddle = (p) => ({
    x: p.x, y: p.y, width: p.width, height: p.height,
    touchX: p.touchX ?? null, touchY: p.touchY ?? null
});

const ball = (b) => {
    const last = b.trail.length ? b.trail[b.trail.length - 1] : null;
    return {
        x: b.x, y: b.y, dx: b.dx, dy: b.dy, speed: b.speed, radius: b.radius,
        trailN: b.trail.length, trailLast: last ? [last.x, last.y] : null
    };
};

/** @type {any} */ (window).__pong = {
    kind: 'esm',

    /** Estado de la partida en curso. */
    match() {
        return {
            mode: state.mode,
            isPlaying: state.isPlaying, isPaused: state.isPaused,
            p1Score: state.p1Score, p2Score: state.p2Score,
            serveCountdownMs: state.serveCountdownMs,
            shakeTimeMs: state.shakeTimeMs, shakeIntensity: state.shakeIntensity,
            frameCount: state.frameCount,
            balls: state.balls.map(ball),
            p1: paddle(p1),
            p2: paddle(p2),
            twin: {
                x: p2Twin.x, y: p2Twin.y, width: p2Twin.width, height: p2Twin.height,
                active: p2Twin.active, retreatMs: p2Twin.retreatMs
            }
        };
    },

    /** Partículas como lista plana [x, y, dx, dy, life, color, ...]. */
    particles() {
        const out = [];
        for (const p of state.particles) out.push(p.x, p.y, p.dx, p.dy, p.life, p.color);
        return out;
    },

    /** Jefe en curso, leído solo a través de sus despachadores públicos. */
    boss() {
        const config = bossConfig();
        if (!config) return null;
        const armored = [];
        for (let i = 0; i < 5; i++) armored.push(bossSegmentArmored((i + 0.5) * GAME_WIDTH / 5));
        return {
            level: currentCampaignLevel,
            config,
            health: bossHealth(),
            rotated: bossIsRotatedArena(),
            hidesBall: bossHidesBall(),
            freezesPlayer: bossFreezesPlayer(),
            invertsControls: bossInvertsControls(),
            aim: bossAim(),
            armored
        };
    },

    powerups() {
        return {
            field: activePowerup && {
                type: activePowerup.type.id, x: activePowerup.x, y: activePowerup.y,
                spawnTime: activePowerup.spawnTime, maxLifetime: activePowerup.maxLifetime
            },
            effect: activeEffect && {
                type: activeEffect.type.id, target: activeEffect.target,
                remainingMs: activeEffect.remainingMs, originalValues: activeEffect.originalValues
            },
            shield: shieldWall,
            slowmo: slowmoActive,
            cooldownMs: powerupCooldownMs,
            lastHitter,
            collectedThisGame: powerupsThisGame
        };
    },

    campaign() {
        return {
            level: currentCampaignLevel,
            isReplayingBoss,
            isDialogueActive,
            midDialogueShown
        };
    },

    /** Objetos persistentes tal como están en memoria. */
    memory() {
        return { settings, gameStats, playerProgression };
    },

    /** Diagnóstico: detalles internos que el refactor puede renombrar. No bloquea. */
    diag() {
        return {
            bossState: bossConfig() ? bossState : null,
            currentRally, maxDeficit, goalSlowmoTimer,
            confetti: confettiParticles.length,
            shockwave,
            carouselIndex
        };
    }
};
