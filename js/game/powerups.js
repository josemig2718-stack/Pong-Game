/**
 * game/powerups.js
 * ------------------------------------------------------------------
 * Power-ups en partida: aparición, recogida, efectos y su reversión.
 *
 * Solo hay un power-up en el campo y un efecto activo a la vez. Los
 * efectos que cambian el tamaño de las paletas o de las bolas guardan el
 * valor original en activeEffect.originalValues y revertPowerup() lo
 * restaura; por eso startGame/quitGame/checkWin también reponen el
 * tamaño de las paletas por si una partida acaba con un efecto activo.
 *
 * Los tipos están en data/powerups.js. El orbe del campo, el estallido
 * al recogerlo y el dibujo de los efectos (escudo, aura de la bola
 * gigante, cámara lenta, líneas de velocidad) están al final; su azar
 * sale de vfxRandom, nunca de Math.random.
 * ------------------------------------------------------------------
 */

'use strict';

// Variables de estado del sistema de power-ups
let activePowerup = null;       // { type, x, y, ageMs, maxLifetime }
let activeEffect = null;        // { type, target, remainingMs, originalValues: {} }
let powerupCooldownMs = 0;      // Tiempo hasta el próximo intento de aparición
let shieldWall = null;          // { x, y, width, height, owner }
let lastHitter = 'p1';          // Último jugador en golpear la pelota ('p1' o 'p2')
let powerupsThisGame = 0;       // Contador por partida (para logros)
let powerupsSpawnedThisGame = 0; // Cuántos aparecieron en la partida ("Sin Ayuda")
let slowmoActive = false;       // Indica si la cámara lenta está activa

/**
 * Inicializa o reinicia el sistema de power-ups al empezar una partida
 */
function initPowerups() {
    activePowerup = null;
    activeEffect = null;
    shieldWall = null;
    slowmoActive = false;
    lastHitter = 'p1';
    powerupsThisGame = 0;
    powerupsSpawnedThisGame = 0;
    powerupBursts = [];
    // Tiempo inicial aleatorio entre 8 y 15 segundos
    powerupCooldownMs = 8000 + Math.random() * 7000;
    updatePowerupPill();   // la de la partida anterior no sigue a la vista
}

/**
 * Actualiza la lógica de los power-ups (aparición, expiración, colisiones)
 * @param {number} dt Delta time normalizado a 60 FPS
 */
function updatePowerups(dt) {
    if (!settings.powerupsEnabled) return;
    if (state.isPaused) return;
    if (!state.isPlaying) return;

    const dtMs = dt * MS_PER_FRAME;

    // 1. Manejo del cooldown y aparición
    if (!activePowerup && !activeEffect) {
        powerupCooldownMs -= dtMs;
        if (powerupCooldownMs <= 0 && state.serveCountdownMs <= 0) {
            spawnPowerup();
        }
    }

    // 2. Lógica del power-up en el campo
    if (activePowerup) {
        // Verificar si ha expirado
        // Su vida se mide en tiempo de juego: no corre en pausa ni en el saque
        activePowerup.ageMs += dtMs;
        if (activePowerup.ageMs > activePowerup.maxLifetime) {
            activePowerup = null;
            // Nuevo cooldown tras desaparecer
            powerupCooldownMs = 8000 + Math.random() * 7000;
        } else {
            // Comprobar colisiones con todas las pelotas
            for (let i = 0; i < state.balls.length; i++) {
                const b = state.balls[i];
                if (powerupCollision(b.x, b.y, b.radius, activePowerup.x, activePowerup.y, 22)) {
                    collectPowerup();
                    break; // Solo puede ser recogido por una pelota a la vez
                }
            }
        }
    }

    // 3. Lógica de los efectos activos
    if (activeEffect) {
        activeEffect.remainingMs -= dtMs;
        if (activeEffect.remainingMs <= 0) {
            revertPowerup();
        }
    }

    // 4. Lógica del escudo
    if (shieldWall) {
        for (let i = 0; i < state.balls.length; i++) {
            const b = state.balls[i];
            // Detección de colisión AABB simple
            if (b.x + b.radius > shieldWall.x &&
                b.x - b.radius < shieldWall.x + shieldWall.width &&
                b.y + b.radius > shieldWall.y &&
                b.y - b.radius < shieldWall.y + shieldWall.height) {

                // Rebotar y reposicionar para evitar que se quede pegado
                b.dx *= -1;
                if (shieldWall.owner === 'p1') {
                    b.x = shieldWall.x + shieldWall.width + b.radius;
                } else {
                    b.x = shieldWall.x - b.radius;
                }

                // Efecto de sonido si existe
                soundEffects.paddleHit({ x: b.x });
            }
        }
    }
}

/**
 * Hace aparecer un nuevo power-up en el campo de forma aleatoria
 */
function spawnPowerup() {
    // Selección ponderada
    let totalWeight = POWERUP_TYPES.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedType = POWERUP_TYPES[0];

    for (const p of POWERUP_TYPES) {
        if (random < p.weight) {
            selectedType = p;
            break;
        }
        random -= p.weight;
    }

    // Posición aleatoria en la zona central
    activePowerup = {
        type: selectedType,
        x: 200 + Math.random() * 400, // Entre 200 y 600
        y: 100 + Math.random() * 400, // Entre 100 y 500
        ageMs: 0,
        maxLifetime: 12000 // 12 segundos antes de desaparecer
    };
    powerupsSpawnedThisGame++;

    soundEffects.powerupSpawn();
}

/**
 * Recoge el power-up activo y aplica su efecto
 */
function collectPowerup() {
    if (!activePowerup) return;

    const type = activePowerup.type;
    const beneficiary = lastHitter; // 'p1' o 'p2'

    // Partículas, estallido y sonido
    spawnParticles(activePowerup.x, activePowerup.y, type.color, 20);
    triggerPowerupBurst(activePowerup.x, activePowerup.y, type.color);
    soundEffects.powerupCollect();

    // Actualizar contadores
    powerupsThisGame++;
    gameStats.totalPowerupsCollected++;   // para el logro "Coleccionista"
    saveStats();

    // Aplicar efecto
    applyPowerup(type, beneficiary);

    // Limpiar entidad de power-up y establecer nuevo cooldown
    activePowerup = null;
    powerupCooldownMs = 8000 + Math.random() * 7000;
}

/**
 * Aplica los efectos del power-up a los jugadores o la pelota
 * @param {Object} type Tipo de power-up (de POWERUP_TYPES)
 * @param {string} beneficiary 'p1' o 'p2'
 */
function applyPowerup(type, beneficiary) {
    const rival = beneficiary === 'p1' ? 'p2' : 'p1';

    // Preparar el estado del efecto si tiene duración
    if (type.duration > 0) {
        activeEffect = {
            type: type,
            target: beneficiary,
            remainingMs: type.duration,
            originalValues: {}
        };
    }

    switch (type.id) {
        case 'paddle_xl':
            const targetPaddle = beneficiary === 'p1' ? p1 : p2;
            activeEffect.originalValues.height = targetPaddle.height;
            targetPaddle.height = paddleHeight * 1.6;
            break;

        case 'paddle_mini':
            const rivalPaddle = rival === 'p1' ? p1 : p2;
            activeEffect.target = rival; // El objetivo visual es el rival
            activeEffect.originalValues.height = rivalPaddle.height;
            rivalPaddle.height = paddleHeight * 0.6;
            break;

        case 'big_ball':
            activeEffect.target = rival; // Cuenta como efecto negativo visualmente
            activeEffect.originalValues.radius = state.balls[0].radius; // Asume que todas tienen el mismo radio base
            state.balls.forEach(b => b.radius = 27); // 9 * 3 = 27
            break;

        case 'turbo':
            // Acelera, pero no cuenta como smash
            state.balls.forEach(b => {
                b.dx *= 1.4;
                b.dy *= 1.4;
                b.power = null;
            });
            break;

        case 'shield':
            if (beneficiary === 'p1') {
                shieldWall = { x: 50, y: 0, width: 8, height: GAME_HEIGHT, owner: 'p1' };
            } else {
                shieldWall = { x: GAME_WIDTH - 58, y: 0, width: 8, height: GAME_HEIGHT, owner: 'p2' };
            }
            break;

        case 'slowmo':
            slowmoActive = true;
            break;

        case 'multi_ball':
            spawnExtraBalls();
            break;
    }
}

/**
 * Revierte los efectos activos y restaura valores originales
 */
function revertPowerup() {
    if (!activeEffect) return;

    const type = activeEffect.type;

    switch (type.id) {
        case 'paddle_xl':
        case 'paddle_mini':
            const targetPaddle = activeEffect.target === 'p1' ? p1 : p2;
            targetPaddle.height = activeEffect.originalValues.height;
            break;

        case 'big_ball':
            state.balls.forEach(b => b.radius = activeEffect.originalValues.radius);
            break;

        case 'shield':
            shieldWall = null;
            break;

        case 'slowmo':
            slowmoActive = false;
            break;
    }

    soundEffects.powerupExpire();

    activeEffect = null;
}

/**
 * Fuerza los efectos activos sobre las bolas (útil después de un resetBall)
 */
function enforcePowerups() {
    if (!activeEffect) return;
    if (activeEffect.type.id === 'big_ball') {
        state.balls.forEach(b => b.radius = 27);
    }
}

/**
 * Establece el último jugador en golpear la pelota
 * @param {string} player 'p1' o 'p2'
 */
function setLastHitter(player) {
    lastHitter = player;
}

/**
 * Retorna el multiplicador de tiempo para la cámara lenta
 * @returns {number} 0.5 si está activo, 1.0 si no
 */
function getSlowmoMultiplier() {
    return slowmoActive ? 0.5 : 1.0;
}

/**
 * Ayudante para comprobar colisiones circulares
 */
function powerupCollision(bx, by, bradius, px, py, pradius) {
    const dx = bx - px;
    const dy = by - py;
    return Math.sqrt(dx * dx + dy * dy) < bradius + pradius;
}

/**
 * Dibuja el power-up del campo: un orbe con el glifo de su tipo y un arco
 * con la vida que le queda.
 * @param {CanvasRenderingContext2D} ctx Contexto 2D del canvas
 */
function renderPowerup(ctx) {
    if (!activePowerup) return;
    drawPowerupOrb(ctx, activePowerup.type, activePowerup.x, activePowerup.y, activePowerup.ageMs, activePowerup.maxLifetime);
}

/** Lo último que se pintó en la píldora, para tocar el DOM solo si cambia. */
let powerupPillKey = '';

/**
 * Píldora del efecto activo (#powerup-pill, sobre el campo y en el lado
 * del jugador afectado): icono, nombre, barra y segundos restantes. Los
 * efectos instantáneos no tienen píldora.
 */
function updatePowerupPill() {
    const pill = document.getElementById('powerup-pill');
    if (!pill) return;
    if (!activeEffect || activeEffect.type.duration === 0) {
        if (powerupPillKey) pill.classList.add('hidden');
        powerupPillKey = '';
        return;
    }

    const type = activeEffect.type;
    const pct = Math.max(0, Math.round(activeEffect.remainingMs / type.duration * 100));
    const secs = Math.max(0, Math.ceil(activeEffect.remainingMs / 1000));
    const who = `${type.id}|${activeEffect.target}`;
    const key = `${who}|${pct}|${secs}`;
    if (key === powerupPillKey) return;

    if (!powerupPillKey.startsWith(who + '|')) {
        pill.style.setProperty('--pu-color', type.color);
        pill.dataset.side = activeEffect.target;
        pill.querySelector('.powerup-pill__icon').innerHTML =
            `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${type.icon}"/></svg>`;
        pill.querySelector('.powerup-pill__name').textContent = type.name;
        pill.classList.remove('hidden');
    }
    /** @type {HTMLElement} */ (pill.querySelector('.powerup-pill__bar i')).style.width = `${pct}%`;
    pill.querySelector('.powerup-pill__secs').textContent = `${secs}s`;
    powerupPillKey = key;
}

/**
 * Renderiza el escudo si está activo
 * @param {CanvasRenderingContext2D} ctx Contexto 2D
 */
function renderShield(ctx) {
    if (!shieldWall) return;
    drawShieldWall(ctx, shieldWall);
}

// ------------------------------------------------------------------
//  Dibujo de los power-ups y de sus efectos (azar: vfxRandom)
// ------------------------------------------------------------------

/** Color del escudo, el mismo que su orbe y su píldora. */
const SHIELD_COLOR = POWERUP_TYPES.find((t) => t.id === 'shield').color;
/** Color del aura de la bola gigante. */
const BIG_BALL_COLOR = POWERUP_TYPES.find((t) => t.id === 'big_ball').color;

/**
 * Orbe del power-up en el campo: núcleo oscuro, anillo de color, órbita
 * punteada que gira, arco de vida restante (parpadea los últimos 2 s) y el
 * glifo del tipo, el mismo de la píldora. Flota y entra con un rebote.
 * @param {CanvasRenderingContext2D} ctx
 * @param {PowerupType} type
 */
function drawPowerupOrb(ctx, type, x, y, ageMs, maxLifetime) {
    const now = performance.now();
    const life = Math.max(0, 1 - ageMs / maxLifetime);
    const appear = Math.min(1, ageMs / 260);
    const pop = appear < 1 ? 0.6 + 0.4 * appear + Math.sin(appear * Math.PI) * 0.15 : 1;
    const bob = Math.sin(now / 420) * 3;
    const c = type.color;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(pop, pop);
    // Halo
    const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 44);
    g.addColorStop(0, hexToRgba(c, 0.32));
    g.addColorStop(1, hexToRgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-44, -44, 88, 88);
    // Núcleo
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(11, 15, 23, 0.94)';
    ctx.fill();
    ctx.fillStyle = hexToRgba(c, 0.14);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = c;
    ctx.stroke();
    // Órbita punteada que gira
    ctx.setLineDash([3, 6]);
    ctx.lineDashOffset = -now / 28;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = hexToRgba(c, 0.5);
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // Arco de vida: se vacía; en los últimos 2 s parpadea
    const warn = maxLifetime - ageMs < 2000;
    ctx.globalAlpha = warn ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now / 70)) : 1;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = c;
    ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * life); ctx.stroke();
    ctx.globalAlpha = 1;
    // Glifo
    ctx.scale(1.12, 1.12);
    ctx.translate(-12, -12);
    ctx.lineWidth = 2.1;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = c;
    ctx.shadowColor = c;
    ctx.shadowBlur = 8;
    ctx.stroke(vfxPath(type.icon));
    ctx.restore();
}

/** Estallidos al recoger un power-up: anillo y 10 chispas en su color. */
let powerupBursts = [];
/** `n` chispas repartidas en círculo (menos con "menos movimiento"). */
function burstSparks(n) {
    return Array.from({ length: n }, (_, i) => ({ a: (i / n) * Math.PI * 2 + vfxRandom() * 0.3, d: 20, v: 3 + vfxRandom() * 2 }));
}
function triggerPowerupBurst(x, y, color) {
    powerupBursts.push({
        x, y, color, r: 18, life: 1,
        sparks: burstSparks(prefersReducedMotion() ? 5 : 10)
    });
}
/** Avanza los estallidos (desde updateVFX, también durante el saque). */
function updatePowerupBursts(dt) {
    for (const b of powerupBursts) {
        b.r += 4 * dt;
        b.life -= 0.045 * dt;
        for (const s of b.sparks) { s.d += s.v * dt; s.v *= Math.pow(0.92, dt); }
    }
    powerupBursts = powerupBursts.filter((b) => b.life > 0);
}
/** Quita los estallidos en curso (al abandonar la partida, desde resetVFX). */
function clearPowerupBursts() {
    powerupBursts = [];
}
function renderPowerupBursts(ctx) {
    if (powerupBursts.length === 0) return;
    ctx.save();
    for (const b of powerupBursts) {
        ctx.globalAlpha = b.life;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = b.color;
        for (const s of b.sparks) {
            ctx.save();
            ctx.translate(b.x + Math.cos(s.a) * s.d, b.y + Math.sin(s.a) * s.d);
            ctx.rotate(s.a);
            ctx.fillRect(-4, -1, 8, 2);
            ctx.restore();
        }
    }
    ctx.restore();
}

/** Escudo: muro de energía con panal hexagonal y bordes que laten. */
function drawShieldWall(ctx, wall) {
    const now = performance.now();
    const pulse = 0.5 + 0.5 * Math.sin(now / 160);
    const c = SHIELD_COLOR;
    ctx.save();
    const g = ctx.createLinearGradient(wall.x, 0, wall.x + wall.width, 0);
    g.addColorStop(0, hexToRgba(c, 0.1));
    g.addColorStop(0.5, hexToRgba(c, 0.32 + 0.1 * pulse));
    g.addColorStop(1, hexToRgba(c, 0.1));
    ctx.fillStyle = g;
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    // Panal
    ctx.beginPath();
    ctx.rect(wall.x, wall.y, wall.width, wall.height);
    ctx.clip();
    ctx.strokeStyle = hexToRgba(c, 0.35);
    ctx.lineWidth = 1;
    const s = 7, off = (now / 40) % (s * 3);
    for (let yy = wall.y - s * 3 + off; yy < wall.y + wall.height + s * 3; yy += s * 3) {
        for (let k = 0; k < 2; k++) {
            const cx = wall.x + wall.width / 2 + (k ? s * 0.9 : -s * 0.9);
            const cy = yy + (k ? s * 1.5 : 0);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = Math.PI / 3 * i;
                const px = cx + Math.cos(a) * s, py = cy + Math.sin(a) * s;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
        }
    }
    ctx.restore();
    // Bordes que laten
    ctx.save();
    ctx.shadowColor = c;
    ctx.shadowBlur = 12 + 8 * pulse;
    ctx.fillStyle = hexToRgba(c, 0.85);
    ctx.fillRect(wall.x, wall.y, 2, wall.height);
    ctx.fillRect(wall.x + wall.width - 2, wall.y, 2, wall.height);
    ctx.restore();
}

/** Bola gigante: anillo rojo que late alrededor de la bola. */
function drawBigBallAura(ctx, b) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 140);
    ctx.save();
    ctx.strokeStyle = hexToRgba(BIG_BALL_COLOR, 0.35 + 0.35 * pulse);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 6 + 3 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
}

/** Cámara lenta: viñeta naranja en los bordes y líneas de escaneo que bajan despacio. */
function drawSlowmoOverlay(ctx) {
    const now = performance.now();
    ctx.save();
    const g = ctx.createRadialGradient(GAME_WIDTH / 2, GAME_HEIGHT / 2, 220, GAME_WIDTH / 2, GAME_HEIGHT / 2, 520);
    g.addColorStop(0, 'rgba(251, 146, 60, 0)');
    g.addColorStop(1, 'rgba(251, 146, 60, 0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = 'rgba(251, 146, 60, 0.05)';
    const off = (now / 30) % 24;
    for (let y = -24 + off; y < GAME_HEIGHT; y += 24) ctx.fillRect(0, y, GAME_WIDTH, 2);
    ctx.restore();
}

/**
 * Líneas de velocidad detrás de la bola cuando va a más del 80% de su
 * máximo (el turbo las hace evidentes).
 * @param {number} speedRatio velocidad actual / máxima del preset
 */
function drawSpeedLines(ctx, b, speedRatio) {
    if (speedRatio < 0.8) return;
    const k = Math.min(1, (speedRatio - 0.8) / 0.2);
    const sp = Math.hypot(b.dx, b.dy) || 1;
    const ux = -b.dx / sp, uy = -b.dy / sp;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * k})`;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let o = -1; o <= 1; o++) {
        const nx = -uy * o * (b.radius + 3), ny = ux * o * (b.radius + 3);
        const len = (o === 0 ? 46 : 30) * k;
        ctx.beginPath();
        ctx.moveTo(b.x + nx + ux * (b.radius + 4), b.y + ny + uy * (b.radius + 4));
        ctx.lineTo(b.x + nx + ux * (b.radius + 4 + len), b.y + ny + uy * (b.radius + 4 + len));
        ctx.stroke();
    }
    ctx.restore();
}
