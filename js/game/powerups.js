/**
 * game/powerups.js
 * ------------------------------------------------------------------
 * Power-ups en partida: aparición, recogida, efectos y su reversión.
 *
 * Hay como mucho un orbe en el campo y POWERUP_MAX_ACTIVE efectos
 * activos a la vez (activeEffects): el orbe solo sale si queda sitio.
 * Recoger un efecto que ya está activo lo renueva, sin acumularlo; la
 * paleta grande y la mini sobre la misma paleta se sustituyen. Turbo y
 * multibola son instantáneos y no ocupan sitio.
 *
 * Los efectos que cambian el tamaño de las paletas o de las bolas
 * guardan el valor original en effect.originalValues, enforcePowerups()
 * los reaplica en cada fotograma y revertPowerup(effect) restaura solo
 * ese. Al empezar una partida (también al cambiar de jefe) y al salir se
 * revierten todos; startGame/quitGame/checkWin además reponen el tamaño
 * de las paletas.
 *
 * Los tipos están en data/powerups.js. El orbe del campo, el estallido
 * al recogerlo y el dibujo de los efectos (escudo, aura de la bola
 * gigante, cámara lenta, líneas de velocidad) están al final; su azar
 * sale de vfxRandom, nunca de Math.random.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Muro del escudo delante de una portería.
 * @typedef {object} ShieldWall
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {'p1'|'p2'} owner
 * @property {number} hp  bloqueos que le quedan
 */

/**
 * Un efecto activo.
 * @typedef {object} PowerupEffect
 * @property {PowerupType} type
 * @property {'p1'|'p2'} beneficiary  quien lo recogió: su píldora va en su lado
 * @property {'p1'|'p2'} target  la paleta a la que afecta (en la paleta mini, la del rival)
 * @property {number} remainingMs
 * @property {{height?: number, radius?: number}} originalValues
 * @property {{wall?: ShieldWall}} data  lo propio de cada tipo (el muro del escudo)
 */

// Variables de estado del sistema de power-ups
let activePowerup = null;       // { type, x, y, ageMs, maxLifetime }
/** @type {PowerupEffect[]} */
let activeEffects = [];         // como mucho POWERUP_MAX_ACTIVE
let powerupCooldownMs = 0;      // Tiempo hasta el próximo intento de aparición
/** @type {'p1'|'p2'} */
let lastHitter = 'p1';          // Último jugador en golpear la pelota
let powerupsThisGame = 0;       // Contador por partida (para logros)
let powerupsSpawnedThisGame = 0; // Cuántos aparecieron en la partida ("Sin Ayuda")

/** Tipos que afectan a todo el campo: hay uno de cada como mucho, sea quien sea el que lo recoja. */
const GLOBAL_POWERUPS = ['big_ball', 'slowmo'];

/** Espera hasta el próximo power-up: entre 6 y 12 segundos de juego. */
function nextPowerupCooldown() {
    return 6000 + Math.random() * 6000;
}

/**
 * Inicializa o reinicia el sistema de power-ups al empezar una partida
 */
function initPowerups() {
    revertAllPowerups();
    activePowerup = null;
    lastHitter = 'p1';
    powerupsThisGame = 0;
    powerupsSpawnedThisGame = 0;
    powerupBursts = [];
    powerupCooldownMs = nextPowerupCooldown();
    updatePowerupPills();   // las de la partida anterior no siguen a la vista
}

/**
 * Actualiza la lógica de los power-ups (aparición, expiración, colisiones)
 * @param {number} dt Delta time normalizado a 60 FPS
 * @param {number} realDt el mismo dt sin la cámara lenta: con él se
 *     descuenta la propia cámara lenta, que dura 10 s reales
 */
function updatePowerups(dt, realDt) {
    if (!settings.powerupsEnabled || state.mode === 'practice') return;
    if (state.isPaused) return;
    if (!state.isPlaying) return;

    const dtMs = dt * MS_PER_FRAME;

    // 1. Manejo del cooldown y aparición: solo si queda sitio para otro efecto
    if (!activePowerup && activeEffects.length < POWERUP_MAX_ACTIVE) {
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
            powerupCooldownMs = nextPowerupCooldown();
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
    for (const effect of activeEffects.slice()) {
        effect.remainingMs -= effect.type.id === 'slowmo' ? realDt * MS_PER_FRAME : dtMs;
        if (effect.remainingMs <= 0) {
            revertPowerup(effect);
        }
    }

    // 4. Lógica de los escudos
    for (const effect of effectsOf('shield')) {
        const wall = effect.data.wall;
        for (let i = 0; i < state.balls.length; i++) {
            const b = state.balls[i];
            // Detección de colisión AABB simple
            if (b.x + b.radius > wall.x &&
                b.x - b.radius < wall.x + wall.width &&
                b.y + b.radius > wall.y &&
                b.y - b.radius < wall.y + wall.height) {

                // Rebotar y reposicionar para evitar que se quede pegado
                b.dx *= -1;
                if (wall.owner === 'p1') {
                    b.x = wall.x + wall.width + b.radius;
                } else {
                    b.x = wall.x - b.radius;
                }

                // Cada bloqueo lo agrieta; al gastar el último, desaparece
                soundEffects.paddleHit({ x: b.x });
                soundEffects.shieldCrack();
                wall.hp--;
                if (wall.hp <= 0) {
                    revertPowerup(effect);
                    break;
                }
            }
        }
    }

    // 5. Los efectos activos se reaplican en cada fotograma
    enforcePowerups();
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
        maxLifetime: 15000 // 15 segundos antes de desaparecer
    };
    powerupsSpawnedThisGame++;

    soundEffects.powerupSpawn();
    showHint('pu_' + selectedType.id);
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
    if (beneficiary === 'p1') missionEvent('powerup');

    // Aplicar efecto
    applyPowerup(type, beneficiary);

    // Limpiar entidad de power-up y establecer nuevo cooldown
    activePowerup = null;
    powerupCooldownMs = nextPowerupCooldown();
}

/**
 * ¿Es el mismo efecto? Los globales, por tipo; los de una paleta, por
 * tipo y paleta (la paleta grande de cada jugador es un efecto distinto).
 * @param {PowerupEffect} effect
 * @param {string} id
 * @param {'p1'|'p2'} target
 */
function samePowerup(effect, id, target) {
    return effect.type.id === id && (GLOBAL_POWERUPS.includes(id) || effect.target === target);
}

/** @param {string} id @returns {PowerupEffect[]} los efectos activos de ese tipo */
function effectsOf(id) {
    return activeEffects.filter((e) => e.type.id === id);
}

/** @param {string} id ¿Hay algún efecto activo de ese tipo? */
function powerupActive(id) {
    return activeEffects.some((e) => e.type.id === id);
}

/**
 * Aplica los efectos del power-up a los jugadores o la pelota
 * @param {PowerupType} type Tipo de power-up (de POWERUP_TYPES)
 * @param {'p1'|'p2'} beneficiary
 */
function applyPowerup(type, beneficiary) {
    const rival = beneficiary === 'p1' ? 'p2' : 'p1';

    // Instantáneos: no ocupan sitio
    switch (type.id) {
        case 'turbo':
            // Acelera, pero no cuenta como smash
            state.balls.forEach(b => {
                b.dx *= 1.4;
                b.dy *= 1.4;
                b.power = null;
            });
            return;

        case 'multi_ball':
            spawnExtraBalls();
            return;
    }

    const target = type.id === 'paddle_mini' ? rival : beneficiary;

    // El mismo efecto otra vez: se renueva, no se acumula
    const same = activeEffects.find((e) => samePowerup(e, type.id, target));
    if (same) {
        renewPowerup(same);
        return;
    }

    // Paleta grande y mini sobre la misma paleta: el nuevo sustituye al viejo
    if (type.id === 'paddle_xl' || type.id === 'paddle_mini') {
        const other = activeEffects.find((e) => (e.type.id === 'paddle_xl' || e.type.id === 'paddle_mini') && e.target === target);
        if (other) revertPowerup(other, { silent: true });
    }

    /** @type {PowerupEffect} */
    const effect = { type, beneficiary, target, remainingMs: type.duration, originalValues: {}, data: {} };
    activeEffects.push(effect);

    switch (type.id) {
        case 'paddle_xl': {
            const paddle = sidePaddle(target);
            effect.originalValues.height = paddle.height;
            paddle.height = paddleHeight * 1.6;
            break;
        }

        case 'paddle_mini': {
            const paddle = sidePaddle(target);
            effect.originalValues.height = paddle.height;
            paddle.height = paddleHeight * 0.6;
            break;
        }

        case 'big_ball':
            effect.originalValues.radius = state.balls[0].radius; // Asume que todas tienen el mismo radio base
            state.balls.forEach(b => b.radius = 27); // 9 * 3 = 27
            break;

        case 'shield':
            effect.data.wall = target === 'p1'
                ? { x: 50, y: 0, width: 8, height: GAME_HEIGHT, owner: 'p1', hp: SHIELD_HP }
                : { x: GAME_WIDTH - 58, y: 0, width: 8, height: GAME_HEIGHT, owner: 'p2', hp: SHIELD_HP };
            break;
    }
}

/**
 * Un efecto que ya estaba activo vuelve a empezar: su tiempo entero y, el
 * escudo, sus SHIELD_HP bloqueos.
 * @param {PowerupEffect} effect
 */
function renewPowerup(effect) {
    effect.remainingMs = effect.type.duration;
    if (effect.data.wall) effect.data.wall.hp = SHIELD_HP;
}

/**
 * Revierte un efecto activo (solo ese) y restaura sus valores originales.
 * @param {PowerupEffect} effect
 * @param {{silent?: boolean}} [opts] silent: sin el sonido de fin
 */
function revertPowerup(effect, { silent = false } = {}) {
    const i = activeEffects.indexOf(effect);
    if (i === -1) return;
    activeEffects.splice(i, 1);

    switch (effect.type.id) {
        case 'paddle_xl':
        case 'paddle_mini':
            sidePaddle(effect.target).height = effect.originalValues.height;
            break;

        case 'big_ball':
            state.balls.forEach(b => b.radius = effect.originalValues.radius);
            break;
    }

    if (!silent) soundEffects.powerupExpire();
}

/** Revierte todos los efectos, sin sonido (al empezar una partida o al salir). */
function revertAllPowerups() {
    for (const effect of activeEffects.slice()) revertPowerup(effect, { silent: true });
}

/**
 * Reaplica los efectos activos en cada fotograma (y después de un
 * resetBall): la altura de las paletas y el radio de la bola gigante. En
 * la arena rotada del Creador la paleta es horizontal y cada saque le
 * repone su forma: ahí no se reaplica la altura.
 */
function enforcePowerups() {
    for (const effect of activeEffects) {
        switch (effect.type.id) {
            case 'paddle_xl':
                if (!bossIsRotatedArena()) sidePaddle(effect.target).height = paddleHeight * 1.6;
                break;
            case 'paddle_mini':
                if (!bossIsRotatedArena()) sidePaddle(effect.target).height = paddleHeight * 0.6;
                break;
            case 'big_ball':
                state.balls.forEach(b => b.radius = 27);
                break;
        }
    }
}

/**
 * Establece el último jugador en golpear la pelota
 * @param {'p1'|'p2'} player
 */
function setLastHitter(player) {
    lastHitter = player;
}

/**
 * Retorna el multiplicador de tiempo para la cámara lenta
 * @returns {number} 0.5 si está activo, 1.0 si no
 */
function getSlowmoMultiplier() {
    return powerupActive('slowmo') ? 0.5 : 1.0;
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

/** Qué efectos tienen píldora, en orden, para rehacerlas solo si cambian. */
let powerupPillsKey = null;
/** @type {{bar: HTMLElement, secs: Element, last: string}[]} una por efecto, en el orden de activeEffects */
let powerupPillEls = [];

/**
 * Píldoras de los efectos activos (capturas/54): una por efecto, en el
 * contenedor del lado del que lo recogió (#powerup-pills-p1/-p2): icono,
 * nombre, barra y segundos restantes (el escudo, los bloqueos que le
 * quedan: "3/5"). Solo toca el DOM cuando algo cambia.
 */
function updatePowerupPills() {
    const key = activeEffects.map((e) => `${e.type.id}|${e.beneficiary}|${e.target}`).join(',');
    if (key !== powerupPillsKey) {
        powerupPillsKey = key;
        document.getElementById('powerup-pills-p1').replaceChildren();
        document.getElementById('powerup-pills-p2').replaceChildren();
        powerupPillEls = activeEffects.map(buildPowerupPill);
    }

    activeEffects.forEach((effect, i) => {
        const shieldHp = effect.data.wall ? effect.data.wall.hp : null;
        const pct = shieldHp !== null
            ? Math.round(shieldHp / SHIELD_HP * 100)
            : Math.max(0, Math.round(effect.remainingMs / effect.type.duration * 100));
        const label = shieldHp !== null
            ? `${shieldHp}/${SHIELD_HP}`
            : `${Math.max(0, Math.ceil(effect.remainingMs / 1000))}s`;
        const el = powerupPillEls[i];
        const last = `${pct}|${label}`;
        if (el.last === last) return;
        el.last = last;
        el.bar.style.width = `${pct}%`;
        el.secs.textContent = label;
    });
}

/**
 * Crea la píldora de un efecto en el contenedor de su lado.
 * @param {PowerupEffect} effect
 */
function buildPowerupPill(effect) {
    const pill = document.createElement('div');
    pill.className = 'powerup-pill';
    pill.style.setProperty('--pu-color', effect.type.color);
    pill.innerHTML =
        `<span class="powerup-pill__icon"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${effect.type.icon}"/></svg></span>` +
        '<span class="powerup-pill__body"><span class="px powerup-pill__name"></span><span class="powerup-pill__bar"><i></i></span></span>' +
        '<span class="px powerup-pill__secs"></span>';
    pill.querySelector('.powerup-pill__name').textContent = effect.type.name;
    document.getElementById(`powerup-pills-${effect.beneficiary}`).appendChild(pill);
    return {
        bar: /** @type {HTMLElement} */ (pill.querySelector('.powerup-pill__bar i')),
        secs: pill.querySelector('.powerup-pill__secs'),
        last: ''
    };
}

/**
 * Renderiza los escudos activos
 * @param {CanvasRenderingContext2D} ctx Contexto 2D
 */
function renderShield(ctx) {
    for (const effect of effectsOf('shield')) drawShieldWallV2(ctx, effect.data.wall, effect.data.wall.hp);
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

/**
 * Escudo: muro de energía con panal hexagonal y bordes que laten.
 * @param {string} [c] color (el del escudo, o el del tema en la pared de práctica)
 */
function drawShieldWall(ctx, wall, c = SHIELD_COLOR) {
    const now = performance.now();
    const pulse = 0.5 + 0.5 * Math.sin(now / 160);
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

/**
 * Escudo de SHIELD_HP bloqueos (laboratorio v2, vfx-v2-d.js): con cada
 * bloqueo pierde brillo y se agrieta, y desde el tercero le faltan trozos.
 * Los huecos se recortan del muro (no se borra el campo de debajo) y las
 * marcas de al lado cuentan los bloqueos que quedan. Las grietas salen
 * de vfxHash: siempre las mismas, sin parpadeo. La pared del modo
 * práctica lo reutiliza con su color y sin las marcas.
 * @param {{color?: string, counter?: boolean}} [opts]
 */
function drawShieldWallV2(ctx, wall, hp, maxHp = SHIELD_HP, opts = {}) {
    const k = hp / maxHp;
    ctx.save();
    // Huecos, unidos si se solapan (con evenodd, dos huecos solapados se anularían)
    const holes = [];
    for (let i = 0; i < Math.max(0, (maxHp - hp) - 2) * 2; i++) {
        const y0 = wall.y + vfxHash(i * 31 + 9) * (wall.height - 30);
        holes.push([y0, y0 + 10 + vfxHash(i) * 16]);
    }
    holes.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const h of holes) {
        const last = merged[merged.length - 1];
        if (last && h[0] <= last[1]) last[1] = Math.max(last[1], h[1]);
        else merged.push([h[0], h[1]]);
    }
    if (merged.length) {
        const clip = new Path2D();
        clip.rect(wall.x - 30, wall.y, wall.width + 60, wall.height);
        for (const [a, b] of merged) clip.rect(wall.x - 30, a, wall.width + 60, b - a);
        ctx.clip(clip, 'evenodd');
    }
    ctx.globalAlpha = 0.45 + 0.55 * k;
    drawShieldWall(ctx, wall, opts.color);
    ctx.globalAlpha = 1;
    // Grietas: más cuantas más veces ha bloqueado
    ctx.strokeStyle = 'rgba(239, 246, 255, 0.9)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < (maxHp - hp) * 3; i++) {
        const y0 = wall.y + vfxHash(i * 13 + 1) * wall.height;
        ctx.beginPath(); ctx.moveTo(wall.x, y0);
        ctx.lineTo(wall.x + wall.width * 0.5, y0 + (vfxHash(i * 7) - 0.5) * 18);
        ctx.lineTo(wall.x + wall.width, y0 + (vfxHash(i * 5) - 0.5) * 26);
        ctx.stroke();
    }
    ctx.restore();
    if (opts.counter === false) return;
    // Bloqueos que quedan, al lado del campo
    ctx.save();
    const side = wall.x < GAME_WIDTH / 2 ? wall.x + wall.width + 6 : wall.x - 11;
    for (let i = 0; i < maxHp; i++) {
        ctx.fillStyle = i < hp ? SHIELD_COLOR : hexToRgba(SHIELD_COLOR, 0.2);
        ctx.fillRect(side, wall.y + wall.height / 2 - maxHp * 7 + i * 14, 5, 10);
    }
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
