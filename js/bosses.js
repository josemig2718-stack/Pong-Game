/**
 * bosses.js
 * ------------------------------------------------------------------
 * Mecánicas de los jefes de la Campaña.
 *
 * Sigue el mismo patrón de tabla que vfx.js usa para BG_RENDERERS /
 * TRAIL_RENDERERS / GOAL_FX: cada jefe es una entrada con su propia
 * config y sus funciones init/update/render, y game.js solo llama a
 * los despachadores de abajo. Así game.js no necesita saber nada de
 * cada jefe en concreto.
 *
 * Debe cargarse después de campaign.js y antes de game.js.
 * ------------------------------------------------------------------
 */

// Valores por defecto: cualquier campo que un jefe no defina sale de aquí.
const BOSS_DEFAULT_CONFIG = {
    targetScore: 5,      // puntos necesarios para ganar el combate
    aiSpeed: 0.75,       // multiplicador sobre paddleSpeed
    aiError: 18,         // zona muerta en píxeles: no corrige por debajo de esto
    aiBias: 50,          // desvío de puntería en píxeles, renovado en cada golpe.
                         // Es lo que hace fallar de verdad al jefe: la zona muerta
                         // sola no basta, porque cabe dentro de la propia paleta.
    paddleAxis: 'y',     // 'x' invierte la arena (paleta horizontal abajo)
    useHealth: false,    // true = se gana vaciando la barra de vida, no por marcador
    accent: '#ef4444'
};

/** Desvío de puntería actual del jefe. Se renueva en cada intercambio. */
let bossAimOffset = 0;

function bossRefreshAim() {
    const cfg = bossConfig();
    if (!cfg) { bossAimOffset = 0; return; }
    // Sesgo con forma de campana suave: los desvíos grandes son menos frecuentes
    const r = (Math.random() + Math.random() - 1);
    bossAimOffset = r * (cfg.aiBias || 0);
}

function bossAim() {
    return bossConfig() ? bossAimOffset : 0;
}

/** Estado vivo del jefe en curso. Se vacía en cada bossInit(). */
let bossState = {};

/** Duración de un frame de referencia en ms (el dt del juego es en unidades de 60 FPS). */
const BOSS_MS_PER_DT = 1000 / 60;

// ==================================================================
//  1 · CHEMI — El Guardián de la Frontera
//  Escombros fijos en el centro: la primera lección de que los
//  Hachepes no juegan al Pong limpio.
// ==================================================================
const bossChemi = {
    config: { targetScore: 5, aiSpeed: 0.7,  aiError: 26, aiBias: 78, accent: '#a8a29e' },

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
        bossState.dustTimer -= dt * BOSS_MS_PER_DT;
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

// ==================================================================
//  2 · DANI — El Arquitecto del Caos
//  Escudo telegrafiado (2 impactos) y teletransporte a la posición
//  prevista de la bola. Escudo propio, aislado de los power-ups.
// ==================================================================
const bossDani = {
    config: { targetScore: 6, aiSpeed: 0.85, aiError: 16, aiBias: 66, accent: '#3b82f6' },

    init() {
        bossState.shieldPhase = 'idle';   // idle → warning → active
        bossState.shieldTimer = 7000;
        bossState.shieldHp = 0;
        bossState.teleportTimer = 9000;
        bossState.teleportFlash = 0;
        bossState.gridOffset = 0;
    },

    update(dt) {
        const ms = dt * BOSS_MS_PER_DT;
        bossState.gridOffset = (bossState.gridOffset + dt * 0.3) % 40;
        if (bossState.teleportFlash > 0) bossState.teleportFlash -= ms;

        bossState.shieldTimer -= ms;
        if (bossState.shieldTimer <= 0) {
            if (bossState.shieldPhase === 'idle') {
                bossState.shieldPhase = 'warning';
                bossState.shieldTimer = 1000;              // 1s de aviso antes de aparecer
                if (soundEffects.bossWarning) soundEffects.bossWarning();
            } else if (bossState.shieldPhase === 'warning') {
                bossState.shieldPhase = 'active';
                bossState.shieldHp = 2;
                bossState.shieldTimer = 6000;
                if (soundEffects.bossShield) soundEffects.bossShield();
            } else {
                bossState.shieldPhase = 'idle';
                bossState.shieldTimer = 8000;
            }
        }

        // Teletransporte: solo cuando no hay escudo, para no acumular presión.
        bossState.teleportTimer -= ms;
        if (bossState.teleportTimer <= 0 && bossState.shieldPhase === 'idle') {
            bossState.teleportTimer = 7000 + Math.random() * 4000;
            const b = balls[0];
            if (b && b.dx > 0) {
                spawnParticles(p2.x + p2.width / 2, p2.y + p2.height / 2, '#3b82f6', 14);
                p2.y = Math.max(0, Math.min(GAME_HEIGHT - p2.height, b.y - p2.height / 2));
                bossState.teleportFlash = 320;
                spawnParticles(p2.x + p2.width / 2, p2.y + p2.height / 2, '#3b82f6', 14);
                if (soundEffects.bossTeleport) soundEffects.bossTeleport();
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
        if (soundEffects.shieldBlock) soundEffects.shieldBlock();
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

// ==================================================================
//  3 · MARIO Y VALENTÍN — El Dúo Letal
//  Dos paletas repartiéndose el campo. Al encajar gol, una se
//  retira unos segundos: esa es la ventana del jugador.
// ==================================================================
const bossDuo = {
    config: { targetScore: 6, aiSpeed: 0.9,  aiError: 14, aiBias: 58, accent: '#f97316' },

    init() {
        p2_twin.active = true;
        p2_twin.y = GAME_HEIGHT / 2 + 50;
        p2_twin.retreatMs = 0;
        bossState.retreatWho = null;
    },

    update(dt) {
        if (p2_twin.retreatMs > 0) {
            p2_twin.retreatMs -= dt * BOSS_MS_PER_DT;
            if (p2_twin.retreatMs <= 0) {
                p2_twin.retreatMs = 0;
                bossState.retreatWho = null;
            }
        }
    },

    /** Tras encajar gol, el gemelo se retira 3s. */
    onGoal(scorerIsP1) {
        if (!scorerIsP1) return;
        p2_twin.retreatMs = 3000;
        bossState.retreatWho = 'mario';
        if (soundEffects.bossRetreat) soundEffects.bossRetreat();
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
        if (p2_twin.retreatMs > 0) {
            drawText('¡MARIO SE RETIRA!', GAME_WIDTH * 0.72, 130, '#f97316', 18);
        }
    }
};

// ==================================================================
//  4 · FANO — El Guardián de las Sombras
//  La bola desaparece al cruzar la mitad y aparecen señuelos.
//  Difícil, pero no injusto: siempre queda un rastro tenue.
// ==================================================================
const bossFano = {
    config: { targetScore: 7, aiSpeed: 0.9,  aiError: 12, aiBias: 50, accent: '#7c3aed' },

    init() {
        bossState.invisible = false;
        bossState.invisTimer = 2600;      // reseteado siempre: evita el arranque errático
        bossState.illusions = [];
        bossState.illusionCooldown = 900;
        bossState.vignette = 0;
    },

    update(dt) {
        const ms = dt * BOSS_MS_PER_DT;

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
        const b = balls[0];
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
        const b = balls[0];
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

// ==================================================================
//  5 · YISUS — El Falso Rey
//  Telekinesis sobre la bola y parada de tiempo sobre tu paleta.
//  El muro final antes del giro.
// ==================================================================
const bossYisus = {
    config: { targetScore: 7, aiSpeed: 0.98, aiError: 9,  aiBias: 48, accent: '#eab308' },

    init() {
        bossState.telekinesis = 0;
        bossState.telekinesisCd = 6000;
        bossState.timeStopPhase = 'idle';  // idle → warning → active
        bossState.timeStopTimer = 11000;
        bossState.tint = 0;
    },

    update(dt) {
        const ms = dt * BOSS_MS_PER_DT;
        const b = balls[0];

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
                soundEffects.wallHit();
                triggerShake(4, 100);
            }
        }

        // --- Parada de tiempo: avisa antes de congelar, nunca sorprende ---
        bossState.timeStopTimer -= ms;
        if (bossState.timeStopTimer <= 0) {
            if (bossState.timeStopPhase === 'idle') {
                bossState.timeStopPhase = 'warning';
                bossState.timeStopTimer = 800;
                if (soundEffects.bossWarning) soundEffects.bossWarning();
            } else if (bossState.timeStopPhase === 'warning') {
                bossState.timeStopPhase = 'active';
                bossState.timeStopTimer = 600;
                if (soundEffects.timeStop) soundEffects.timeStop();
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
        if (bossState.telekinesis > 0 && balls.length > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p2.x, p2.y + p2.height / 2);
            ctx.lineTo(balls[0].x, balls[0].y);
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

// ==================================================================
//  6 · EL CREADOR — El Arquitecto del Sufrimiento
//  Arena rotada, barra de vida y tres fases. Único jefe que se gana
//  vaciando su vida, no por marcador.
// ==================================================================
const CREATOR_MAX_HEALTH = 200;

const bossCreator = {
    config: {
        targetScore: 6,        // aquí es el nº de fallos permitidos al jugador
        aiSpeed: 1.0,
        aiError: 0,
        hitDamage: 8,          // 25 impactos para vaciarlo: ~40s de combate
        paddleAxis: 'x',
        useHealth: true,
        accent: '#22c55e'
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
    },

    update(dt) {
        const ms = dt * BOSS_MS_PER_DT;
        if (bossState.glitchMs > 0) bossState.glitchMs -= ms;
        if (bossState.announceMs > 0) bossState.announceMs -= ms;

        // --- Cambio de fase según la vida restante ---
        const ratio = bossState.health / bossState.maxHealth;
        const newPhase = ratio > 0.66 ? 1 : (ratio > 0.33 ? 2 : 3);
        if (newPhase !== bossState.phase) {
            bossState.phase = newPhase;
            bossState.glitchMs = 900;
            triggerShake(14, 500);
            if (soundEffects.glitch) soundEffects.glitch();
            bossState.announce = newPhase === 2 ? 'TE VEO' : 'FIN DE LA SIMULACIÓN';
            bossState.announceMs = 2200;
            // Fase 3: el Creador ataca con una bola extra
            if (newPhase === 3 && typeof spawnExtraBalls === 'function') spawnExtraBalls();
        }

        // --- Fase 2+: invierte los controles, siempre avisando antes ---
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
                    if (soundEffects.glitch) soundEffects.glitch();
                }
            }

            // Falsos mensajes de error del "sistema"
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
                        y: 120 + Math.random() * (GAME_HEIGHT - 300),
                        life: 2600
                    });
                }
            }
            for (let i = bossState.fakeErrors.length - 1; i >= 0; i--) {
                bossState.fakeErrors[i].life -= ms;
                if (bossState.fakeErrors[i].life <= 0) bossState.fakeErrors.splice(i, 1);
            }
        }
    },

    /** game.js consulta esto para invertir el eje del control. */
    invertsControls() {
        return bossState.invertMs > 0;
    },

    render(ctx) {
        // Franja del jefe arriba
        ctx.save();
        const jitter = bossState.glitchMs > 0 ? (Math.random() - 0.5) * 8 : 0;
        ctx.fillStyle = bossState.phase === 3 ? '#7f1d1d' : '#ef4444';
        ctx.fillRect(jitter, 0, GAME_WIDTH, 80);

        ctx.fillStyle = '#000';
        ctx.font = 'bold 30px "Courier New", monospace';
        ctx.textAlign = 'center';
        const label = Math.random() > 0.9 ? 'E R R O R' : 'EL CREADOR';
        ctx.fillText(label, GAME_WIDTH / 2 + jitter, 50);

        // Barra de vida
        const pct = Math.max(0, bossState.health / bossState.maxHealth);
        ctx.fillStyle = '#333';
        ctx.fillRect(GAME_WIDTH / 2 - 200, 85, 400, 15);
        ctx.fillStyle = pct > 0.33 ? '#22c55e' : '#ef4444';
        ctx.fillRect(GAME_WIDTH / 2 - 200, 85, 400 * pct, 15);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(GAME_WIDTH / 2 - 200, 85, 400, 15);
        ctx.restore();
    },

    renderOverlay(ctx) {
        // Fase 3: la pantalla "se rompe"
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
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(e.x - 6, e.y - 14, ctx.measureText(e.text).width + 12, 22);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1;
            ctx.strokeRect(e.x - 6, e.y - 14, ctx.measureText(e.text).width + 12, 22);
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

// ==================================================================
//  Tabla y despachadores
// ==================================================================
const BOSS_MECHANICS = {
    1: bossChemi,
    2: bossDani,
    3: bossDuo,
    4: bossFano,
    5: bossYisus,
    6: bossCreator
};

/** Jefe activo, o null si no estamos en un combate de campaña. */
function currentBoss() {
    if (gameMode !== 'campaign') return null;
    return BOSS_MECHANICS[currentCampaignLevel] || null;
}

/** Config del jefe activo (con los valores por defecto rellenados), o null. */
function bossConfig() {
    const boss = currentBoss();
    if (!boss) return null;
    return { ...BOSS_DEFAULT_CONFIG, ...(boss.config || {}) };
}

/** true si la arena está rotada (paleta del jugador horizontal). */
function bossIsRotatedArena() {
    const cfg = bossConfig();
    return !!cfg && cfg.paddleAxis === 'x';
}

function bossInit() {
    bossState = {};
    const boss = currentBoss();
    if (boss && boss.init) boss.init();
}

function bossUpdate(dt) {
    const boss = currentBoss();
    if (boss && boss.update) boss.update(dt);
}

/** Colisiones extra del jefe (escombros, escudo). true si la bola rebotó. */
function bossCollide(b) {
    const boss = currentBoss();
    if (boss && boss.collide) return boss.collide(b);
    return false;
}

function bossOnGoal(scorerIsP1) {
    const boss = currentBoss();
    if (boss && boss.onGoal) boss.onGoal(scorerIsP1);
}

/** Capa que se dibuja junto al campo (debajo de partículas). */
function bossRender(ctx) {
    const boss = currentBoss();
    if (boss && boss.render) boss.render(ctx);
}

/** Capa por encima de todo (viñetas, tintes, avisos). */
function bossRenderOverlay(ctx) {
    const boss = currentBoss();
    if (boss && boss.renderOverlay) boss.renderOverlay(ctx);
}

/** ¿Este jefe oculta la bola real? (Fano) */
function bossHidesBall() {
    const boss = currentBoss();
    return !!(boss && boss.hidesBall && boss.hidesBall());
}

/** ¿Está congelada la paleta del jugador? (Yisus) */
function bossFreezesPlayer() {
    const boss = currentBoss();
    return !!(boss && boss.freezesPlayer && boss.freezesPlayer());
}

/** ¿Están invertidos los controles? (El Creador, fase 2+) */
function bossInvertsControls() {
    const boss = currentBoss();
    return !!(boss && boss.invertsControls && boss.invertsControls());
}

/** Aplica daño al jefe con barra de vida. Devuelve la vida restante. */
function bossDamage(amount) {
    if (typeof bossState.health !== 'number') return 0;
    bossState.health = Math.max(0, bossState.health - amount);
    return bossState.health;
}

function bossHealth() {
    return typeof bossState.health === 'number' ? bossState.health : 0;
}
