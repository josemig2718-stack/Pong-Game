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
 * Los tipos están en data/powerups.js.
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
                soundEffects.paddleHit();
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

    soundEffects.powerupSpawn();
}

/**
 * Recoge el power-up activo y aplica su efecto
 */
function collectPowerup() {
    if (!activePowerup) return;

    const type = activePowerup.type;
    const beneficiary = lastHitter; // 'p1' o 'p2'

    // Partículas y sonido
    spawnParticles(activePowerup.x, activePowerup.y, type.color, 20);
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
            state.balls.forEach(b => {
                b.dx *= 1.4;
                b.dy *= 1.4;
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
 * Renderiza el power-up en el campo de juego
 * @param {CanvasRenderingContext2D} ctx Contexto 2D del canvas
 */
function renderPowerup(ctx) {
    if (!activePowerup) return;

    const remainingTime = activePowerup.maxLifetime - activePowerup.ageMs;

    // Parpadeo cuando queda poco tiempo (< 2000ms)
    if (remainingTime < 2000 && Math.floor(Date.now() / 200) % 2 === 0) {
        return;
    }

    const x = activePowerup.x;
    const y = activePowerup.y;
    const radius = 22;
    const type = activePowerup.type;

    ctx.save();

    // Efecto de pulso en la escala
    const scale = 1.0 + 0.1 * Math.sin(Date.now() / 300);
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Configurar resplandor
    ctx.shadowBlur = 15;
    ctx.shadowColor = type.color;

    // Dibujar hexágono
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - (Math.PI / 6);
        const hx = radius * Math.cos(angle);
        const hy = radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
    }
    ctx.closePath();

    // Relleno al 20% de opacidad
    ctx.fillStyle = type.color + '33'; // 33 en hex es ~20%
    ctx.fill();

    // Borde al 80% de opacidad
    ctx.lineWidth = 2;
    ctx.strokeStyle = type.color + 'CC'; // CC en hex es ~80%
    ctx.stroke();

    // Dibujar emoji
    ctx.shadowBlur = 0; // Quitar resplandor para el texto
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type.emoji, 0, 0);

    ctx.restore();
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

    ctx.save();

    // Resplandor
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#3b82f6'; // Color del escudo

    // Relleno con transparencia y posible animación de pulso sutil
    const opacity = 0.3 + 0.05 * Math.sin(Date.now() / 150);
    ctx.fillStyle = `rgba(59, 130, 246, ${opacity})`;

    ctx.fillRect(shieldWall.x, shieldWall.y, shieldWall.width, shieldWall.height);

    ctx.restore();
}
