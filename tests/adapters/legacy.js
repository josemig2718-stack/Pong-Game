/**
 * tests/adapters/legacy.js
 * ------------------------------------------------------------------
 * Adaptador para el juego ANTERIOR al refactor (scripts clásicos con
 * todo en el ámbito global). Se inyecta como script clásico al final
 * del <body>, después de los del juego, y solo LEE su estado.
 *
 * Expone window.__pong con el mismo contrato que adapters/esm.js, de
 * modo que el runner no sabe qué versión del juego está midiendo.
 * Existe solo para grabar las referencias (tests/golden) sobre el
 * código original sin modificarlo.
 * ------------------------------------------------------------------
 */
/* global gameMode, isPlaying, isPaused, p1Score, p2Score, serveCountdownMs,
   shakeTimeMs, shakeIntensity, balls, p1, p2, p2_twin, particles, frameCount,
   bossConfig, bossHealth, bossIsRotatedArena, bossHidesBall, bossFreezesPlayer,
   bossInvertsControls, bossAim, bossSegmentArmored, bossState, GAME_WIDTH,
   activePowerup, activeEffect, shieldWall, slowmoActive, powerupCooldownMs,
   lastHitter, powerupsThisGame, currentCampaignLevel, isReplayingBoss,
   isDialogueActive, midDialogueShown, settings, gameStats, playerProgression,
   currentRally, maxDeficit, goalSlowmoTimer, confettiParticles, shockwave,
   carouselIndex */
(function () {
    'use strict';

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

    window.__pong = {
        kind: 'legacy',

        /** Estado de la partida en curso. */
        match() {
            return {
                mode: gameMode,
                isPlaying, isPaused, p1Score, p2Score, serveCountdownMs,
                shakeTimeMs, shakeIntensity, frameCount,
                balls: balls.map(ball),
                p1: paddle(p1),
                p2: paddle(p2),
                twin: {
                    x: p2_twin.x, y: p2_twin.y, width: p2_twin.width, height: p2_twin.height,
                    active: p2_twin.active, retreatMs: p2_twin.retreatMs
                }
            };
        },

        /** Partículas como lista plana [x, y, dx, dy, life, color, ...]. */
        particles() {
            const out = [];
            for (const p of particles) out.push(p.x, p.y, p.dx, p.dy, p.life, p.color);
            return out;
        },

        /** Jefe en curso, leído solo a través de sus despachadores públicos. */
        boss() {
            const cfg = bossConfig();
            if (!cfg) return null;
            const { accent, ...config } = cfg;     // `accent` es código muerto
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
})();
