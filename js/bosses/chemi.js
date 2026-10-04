/**
 * bosses/chemi.js
 * ------------------------------------------------------------------
 * 1 · CHEMI — El Guardián de la Frontera
 * Escombros fijos en el centro: la primera lección de que los
 * Hachepes no juegan al Pong limpio.
 *
 * Lo registra bosses/index.js en BOSS_MECHANICS, que se carga después
 * (ver el comentario de esa tabla).
 * ------------------------------------------------------------------
 */

'use strict';

/** @type {BossMechanics} */
const bossChemi = {
    config: { targetScore: 5, aiSpeed: 0.7,  aiError: 26, aiBias: 78 },

    init() {
        // Dos reglas que hacen que el combate no se encalle:
        //  1. Los escombros están SOLO en el campo de Chemi (él los custodia).
        //     Un bloque en el lado del jugador crea un bucle paleta↔bloque.
        //  2. Ninguno invade la franja central, para que siempre haya paso.
        bossState.rubble = [
            { x: GAME_WIDTH * 0.60, y: 30,  w: 24, h: 150, seed: Math.random() * 100 },
            { x: GAME_WIDTH * 0.60, y: 420, w: 24, h: 150, seed: Math.random() * 100 },
            { x: GAME_WIDTH * 0.74, y: 0,   w: 24, h: 95,  seed: Math.random() * 100 },
            { x: GAME_WIDTH * 0.74, y: 505, w: 24, h: 95,  seed: Math.random() * 100 }
        ];
        bossState.dust = [];
        bossState.dustTimer = 0;
    },

    update(dt) {
        // Polvo cayendo: ambiente de ciudad en ruinas.
        bossState.dustTimer -= dt * MS_PER_FRAME;
        if (bossState.dustTimer <= 0) {
            bossState.dustTimer = 90 + Math.random() * 140;
            if (bossState.dust.length < 40) {
                bossState.dust.push({
                    x: Math.random() * GAME_WIDTH,
                    y: -5,
                    dy: 0.4 + Math.random() * 0.8,
                    size: 1 + Math.random() * 2,
                    alpha: 0.15 + Math.random() * 0.25
                });
            }
        }
        for (let i = bossState.dust.length - 1; i >= 0; i--) {
            const d = bossState.dust[i];
            d.y += d.dy * dt;
            if (d.y > GAME_HEIGHT) bossState.dust.splice(i, 1);
        }
    },

    /**
     * Rebote contra los escombros. Devuelve true si hubo impacto.
     * Saca la bola del bloque por el lado por el que entró y fuerza que la
     * velocidad apunte hacia fuera: si no, se queda atrapada rebotando dentro.
     */
    collide(b) {
        for (const r of bossState.rubble) {
            if (b.x + b.radius < r.x || b.x - b.radius > r.x + r.w) continue;
            if (b.y + b.radius < r.y || b.y - b.radius > r.y + r.h) continue;

            // Distancia a cada cara: se sale por la más cercana
            const fromLeft   = (b.x + b.radius) - r.x;
            const fromRight  = (r.x + r.w) - (b.x - b.radius);
            const fromTop    = (b.y + b.radius) - r.y;
            const fromBottom = (r.y + r.h) - (b.y - b.radius);
            const minPen = Math.min(fromLeft, fromRight, fromTop, fromBottom);

            if (minPen === fromLeft) {
                b.x = r.x - b.radius - 0.5;
                b.dx = -Math.abs(b.dx);
            } else if (minPen === fromRight) {
                b.x = r.x + r.w + b.radius + 0.5;
                b.dx = Math.abs(b.dx);
            } else if (minPen === fromTop) {
                b.y = r.y - b.radius - 0.5;
                b.dy = -Math.abs(b.dy);
            } else {
                b.y = r.y + r.h + b.radius + 0.5;
                b.dy = Math.abs(b.dy);
            }

            // Desvío al rebotar: sin esto, un intercambio plano se repite
            // idéntico para siempre y la bola nunca sale del bucle.
            b.dy += (Math.random() * 2 - 1) * b.speed * 0.35;
            const vel = Math.hypot(b.dx, b.dy) || 1;
            b.dx = (b.dx / vel) * b.speed;
            b.dy = (b.dy / vel) * b.speed;

            soundEffects.wallHit();
            spawnParticles(b.x, b.y, '#a8a29e', 10);
            return true;
        }
        return false;
    },

    render(ctx) {
        for (const r of bossState.rubble) {
            ctx.fillStyle = '#57534e';
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.fillStyle = '#78716c';
            ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
            // Grietas deterministas por bloque (el seed evita que parpadeen)
            ctx.strokeStyle = 'rgba(0,0,0,0.55)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const gy = r.y + ((r.h / 4) * (i + 1));
                const wob = Math.sin(r.seed + i) * 6;
                ctx.moveTo(r.x + 2, gy);
                ctx.lineTo(r.x + r.w - 2, gy + wob);
            }
            ctx.stroke();
        }
    },

    renderOverlay(ctx) {
        for (const d of bossState.dust) {
            ctx.fillStyle = `rgba(214, 211, 209, ${d.alpha})`;
            ctx.fillRect(d.x, d.y, d.size, d.size);
        }
    }
};
