/**
 * game/mechanics.js
 * ------------------------------------------------------------------
 * Las mecánicas de golpe de la fase 2, para que physics.js siga siendo
 * una lista de pasos:
 *
 *   cinemática  la paleta con inercia (teclado) y la velocidad medida
 *               (dedo, ratón y CPU)
 *   smash       updateSmash: carga mientras se mantiene, ventana corta
 *               al soltar
 *   fiebre      startFever / endFever / tickFeverHeat: a los 25 golpes de
 *               rally, bola más rápida, energía doble y su música
 *   golpe       resolveHit: tipo de golpe (súper, smash, perfecto,
 *               esquina, bloqueo, normal), rebote, efecto, energía y
 *               sensación (hit-stop, vibración del móvil, aplastamiento);
 *               applySpin curva la bola en vuelo
 *
 * Todos los números salen de MECH (data/mechanics.js). Nada aquí usa
 * vfxRandom: el azar de la física y de la CPU es Math.random.
 * ------------------------------------------------------------------
 */

'use strict';

/** @param {number} v @param {number} lo @param {number} hi */
function mechClamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

// ------------------------------------------------------------------
//  Cinemática de las paletas
// ------------------------------------------------------------------

/**
 * Velocidad de la paleta normalizada a su velocidad máxima, de -1 a 1
 * (en el eje X en la arena rotada).
 * @param {Paddle} p
 * @param {boolean} [rotated]
 */
function vNorm(p, rotated = false) {
    return mechClamp((rotated ? p.vx : p.vy) / paddleSpeed, -1, 1);
}

/** Guarda la posición de cada paleta antes de moverlas, para medir su velocidad. */
function rememberPaddlePositions() {
    for (const p of [p1, p2, p2Twin]) {
        p.prevY = p.y;
        p.prevX = p.x;
    }
}

/**
 * Teclado: la paleta acelera hacia la velocidad pedida y frena al
 * soltar. Cargar el smash la ralentiza.
 * @param {Paddle} p
 * @param {number} dir -1 arriba (o izquierda), 1 abajo (o derecha), 0 quieta
 * @param {number} dt
 * @param {'x'|'y'} axis
 */
function movePaddleKeys(p, dir, dt, axis) {
    const target = dir * paddleSpeed * (p.smashHeld ? MECH.smashSlowK : 1);
    const v = axis === 'x' ? p.vx : p.vy;
    const k = target === 0 ? MECH.decelK : MECH.accelK;
    const next = v + (target - v) * (1 - Math.pow(1 - k, dt));
    if (axis === 'x') {
        p.vx = next;
        p.x += next * dt;
    } else {
        p.vy = next;
        p.y += next * dt;
    }
}

/**
 * Dedo o ratón: la paleta va directa a donde pide el puntero, salvo
 * mientras se carga el smash, que la limita a paddleSpeed·smashSlowK por
 * fotograma. Su velocidad se mide después (measurePaddleSpeeds).
 * @param {Paddle} p
 * @param {number} target posición pedida (y, o x en la arena rotada)
 * @param {number} dt
 * @param {'x'|'y'} axis
 */
function followPointer(p, target, dt, axis) {
    const cur = axis === 'x' ? p.x : p.y;
    let next = target;
    if (p.smashHeld) {
        const max = paddleSpeed * MECH.smashSlowK * dt;
        next = cur + mechClamp(target - cur, -max, max);
    }
    if (axis === 'x') p.x = next;
    else p.y = next;
}

/**
 * Velocidad medida como diferencia de posición desde rememberPaddlePositions().
 * @param {Paddle} p
 * @param {number} dt
 * @param {'x'|'y'} axis
 */
function measurePaddle(p, dt, axis) {
    const max = MECH.pointerMaxVy;
    if (axis === 'x') p.vx = dt > 0 ? mechClamp((p.x - p.prevX) / dt, -max, max) : 0;
    else p.vy = dt > 0 ? mechClamp((p.y - p.prevY) / dt, -max, max) : 0;
}

/**
 * Tras mover y acotar las paletas: mide la velocidad de las que no lleva
 * el teclado (puntero y CPU). La del teclado es la de su integrador.
 * @param {number} playerDt dt del jugador 1 (0 si está congelado)
 * @param {number} dt
 * @param {boolean} rotatedArena
 */
function measurePaddleSpeeds(playerDt, dt, rotatedArena) {
    if (rotatedArena) {
        if (p1.touchX !== undefined && p1.touchX !== null) measurePaddle(p1, playerDt, 'x');
    } else if (p1.touchY !== null) {
        measurePaddle(p1, playerDt, 'y');
    }
    if (state.mode !== 'local' || p2.touchY !== null) measurePaddle(p2, dt, 'y');
    if (p2Twin.active) measurePaddle(p2Twin, dt, 'y');
}

// ------------------------------------------------------------------
//  Smash
// ------------------------------------------------------------------

/**
 * Carga del smash de una paleta humana (o de la CPU), después de moverla.
 * Mantener carga; al soltar se abre una ventana de MECH.smashWindowMs en
 * la que el golpe sale como smash (o súper). Si la bola llega mientras se
 * mantiene, el golpe es normal y la carga se pierde: la gracia es soltar
 * justo antes.
 * @param {Paddle} p
 * @param {boolean} held
 * @param {number} dt
 */
function updateSmash(p, held, dt) {
    if (held) {
        if (!p.smashHeld) {
            p.smashHeld = true;
            p.releaseMs = Infinity;
            soundEffects.smashCharge(true);
        }
        p.charge = Math.min(1, p.charge + dt * MS_PER_FRAME / MECH.smashChargeMs);
        return;
    }
    if (p.smashHeld) {
        p.smashHeld = false;
        soundEffects.smashCharge(false);
        if (p.charge > 0) p.releaseMs = 0;
        return;
    }
    if (p.releaseMs !== Infinity) {
        p.releaseMs += dt * MS_PER_FRAME;
        if (p.releaseMs > MECH.smashWindowMs) {
            p.charge = 0;
            p.releaseMs = Infinity;
        }
    }
}

/**
 * Corta las cargas en curso sin abrir ventana (pausa, fin o salida): el
 * zumbido no sigue sonando con la partida parada. Al volver, si se sigue
 * manteniendo la tecla, la carga continúa.
 */
function releaseSmashCharges() {
    for (const p of [p1, p2]) {
        if (!p.smashHeld) continue;
        p.smashHeld = false;
        soundEffects.smashCharge(false);
    }
}

/** Un saque nuevo cierra la carga y la ventana del smash de los dos. */
function resetSmashOnServe() {
    for (const p of [p1, p2]) {
        p.charge = 0;
        p.releaseMs = Infinity;
    }
}

// ------------------------------------------------------------------
//  Fiebre del rally
// ------------------------------------------------------------------

/** Pista que sonaba al empezar la fiebre, para retomarla al terminar. */
let feverPrevTrack = null;

/** La fiebre cambia la música solo en VS CPU y local (en Hachepe y campaña, no). */
function feverChangesMusic() {
    return state.mode === 'cpu' || state.mode === 'local';
}

/** Empieza la fiebre del rally (al llegar a MECH.feverRally golpes). */
function startFever() {
    if (state.fever) return;
    state.fever = true;
    soundEffects.feverStart();
    statsOnFeverStart();
    if (feverChangesMusic()) {
        feverPrevTrack = musicCurrent();
        musicPlay('fiebre_rally', { fade: 0.5 });
    }
}

/** Termina la fiebre (al marcar cualquiera): la pista anterior sigue donde iba. */
function endFever() {
    if (!state.fever) return;
    state.fever = false;
    if (feverPrevTrack) musicPlay(feverPrevTrack);
    feverPrevTrack = null;
}

/** Sin fiebre ni su calor, sin tocar la música (al empezar o abandonar una partida). */
function resetFever() {
    state.fever = false;
    state.feverHeat = 0;
    feverPrevTrack = null;
}

/** El calor de la fiebre sube o baja en MECH.feverFadeMs. Es solo visual. */
function tickFeverHeat(dt) {
    const step = dt * MS_PER_FRAME / MECH.feverFadeMs;
    state.feverHeat = state.fever ? Math.min(1, state.feverHeat + step) : Math.max(0, state.feverHeat - step);
}

// ------------------------------------------------------------------
//  Modelo de golpe
// ------------------------------------------------------------------

/** @typedef {'normal' | 'perfect' | 'edge' | 'block' | 'smash' | 'super'} HitType */

/** Lado del marcador al que pertenece una paleta: la gemela juega con p2. */
function paddleSide(paddle) {
    return paddle === p1 ? 'p1' : 'p2';
}

/** La paleta que lleva la energía de un lado. */
function sidePaddle(side) {
    return side === 'p1' ? p1 : p2;
}

/** ¿La energía de esta paleta está llena (o tiene un súper regalado)? */
function superReadyFor(p) {
    return p.energy >= MECH.energy.max || p.superArmed;
}

/**
 * Tipo de golpe, por orden de prioridad: súper, smash, perfecto,
 * esquina, bloqueo y normal. El bloqueo coincide a veces con la
 * esquina; entonces manda la esquina.
 * En el modo táctil automático no hay smash: con la energía llena, el
 * siguiente golpe del que juega con el dedo es súper.
 * @param {Paddle} paddle
 * @param {Paddle} holder la paleta con la energía de ese lado
 * @param {'p1'|'p2'} side
 * @param {number} c punto de contacto, de -1 (un extremo) a 1 (el otro)
 * @param {number} rawV velocidad de la paleta en px/fotograma
 * @returns {HitType}
 */
function classifyHit(paddle, holder, side, c, rawV) {
    const windowOpen = paddle.releaseMs <= MECH.smashWindowMs;
    if (windowOpen && paddle.charge >= MECH.superMinCharge && superReadyFor(holder)) return 'super';
    if (settings.smashTouch === 'auto' && superReadyFor(holder) && isFingerOn(side)) return 'super';
    if (windowOpen && paddle.charge >= MECH.smashMinCharge) return 'smash';
    const ac = Math.abs(c);
    if (ac <= MECH.centerZone) return 'perfect';
    if (ac >= MECH.edgeZone) return 'edge';
    if (Math.abs(rawV) < MECH.blockVy) return 'block';
    return 'normal';
}

/**
 * Ángulo de salida respecto a la perpendicular de la paleta.
 * @param {HitType} type
 * @param {number} c
 */
function hitAngle(type, c) {
    switch (type) {
        case 'edge': {
            const k = (Math.min(1, Math.abs(c)) - MECH.edgeZone) / (1 - MECH.edgeZone);
            return Math.sign(c) * (MECH.baseAngle + (MECH.edgeAngle - MECH.baseAngle) * k);
        }
        case 'smash': return c * MECH.baseAngle * MECH.smashAngleK;
        case 'super': return c * MECH.baseAngle * MECH.superAngleK;
        default: return c * MECH.baseAngle;
    }
}

/**
 * Nueva velocidad de la bola según el tipo de golpe. El roce y el
 * bloqueo frenan, pero nunca por debajo de la velocidad de saque.
 * @param {HitType} type
 * @param {Ball} b
 * @param {Paddle} paddle
 * @param {number} maxBallSpeed
 */
function hitSpeed(type, b, paddle, maxBallSpeed) {
    const base = currentSpeedPreset().base;
    let speed = b.speed;
    switch (type) {
        case 'perfect':
            if (speed < maxBallSpeed) speed = Math.min(maxBallSpeed, speed + 0.5 + MECH.perfectBonus);
            break;
        case 'edge':
            if (speed < maxBallSpeed) speed += 0.5;
            speed = Math.max(base, speed * MECH.edgeSpeedK);
            break;
        case 'block':
            speed = Math.max(base, speed * MECH.blockSpeedK);
            break;
        case 'smash':
            speed = Math.min(speed * (1 + MECH.smashSpeedK * paddle.charge), maxBallSpeed * MECH.smashCapK);
            break;
        case 'super':
            speed = Math.min(speed * MECH.superSpeedK, maxBallSpeed * MECH.superCapK);
            break;
        default:
            if (speed < maxBallSpeed) speed += 0.5;
    }
    return speed;
}

/** Energía que gana el que golpea, según el tipo de golpe (el súper no suma: la gasta). */
const HIT_ENERGY = {
    normal: MECH.energy.hit, edge: MECH.energy.hit, block: MECH.energy.hit,
    perfect: MECH.energy.perfect, smash: MECH.energy.smash, super: 0
};

/**
 * Suma energía a una paleta, hasta el máximo. Al llenarse suena el aviso
 * (una vez por llenado).
 * @param {Paddle} p
 * @param {number} amount
 */
function addEnergy(p, amount) {
    if (amount <= 0) return;
    const wasFull = p.energy >= MECH.energy.max;
    p.energy = Math.min(MECH.energy.max, p.energy + amount);
    if (!wasFull && p.energy >= MECH.energy.max) soundEffects.superReady();
}

/**
 * Chispas del golpe según su tipo.
 * @param {HitType} type
 * @returns {[number, string]} cuántas y de qué color
 */
function hitParticles(type) {
    if (type === 'super') return [30, currentThemeHex()];
    if (type === 'smash') return [24, '#FDE047'];
    if (type === 'perfect') return [20, '#ffffff'];
    return [16, '#ffffff'];
}

/**
 * Una bola acaba de chocar con una paleta: decide el tipo de golpe y
 * calcula el rebote, el efecto, la energía y la sensación del golpe.
 * La detección de la colisión es de hitPaddles (physics.js).
 * @param {Ball} b
 * @param {Paddle} paddle p1, p2 o la gemela
 * @param {number} maxBallSpeed
 * @param {boolean} rotated arena rotada del Creador (la paleta es horizontal, abajo)
 * @returns {HitType}
 */
function resolveHit(b, paddle, maxBallSpeed, rotated) {
    const side = paddleSide(paddle);
    const holder = sidePaddle(side);

    // 1. Punto de contacto y velocidad de la paleta
    const c = rotated
        ? (b.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2)
        : (b.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2);
    const v = vNorm(paddle, rotated);

    // 2-4. Tipo, ángulo y velocidad. Un smash o súper del rival no se
    // devuelve más rápido que el tope normal.
    const type = classifyHit(paddle, holder, side, c, rotated ? paddle.vx : paddle.vy);
    const angle = hitAngle(type, c);
    if (b.power && b.owner && b.owner !== side) b.speed = Math.min(b.speed, maxBallSpeed);
    b.speed = hitSpeed(type, b, paddle, maxBallSpeed);
    if (b.speed >= maxBallSpeed) statsOnMaxSpeed();   // "Demonio Veloz": no toca la partida

    // 5. Efecto: solo si la paleta se movía lo bastante
    const spins = type !== 'block' && type !== 'smash' && type !== 'super' && Math.abs(v) >= MECH.spinMinV;
    b.spin = spins ? mechClamp(v * MECH.spinK, -1, 1) : 0;

    // 6. Dirección, y la bola fuera de la paleta
    if (rotated) {
        b.dx = b.speed * Math.sin(angle);
        b.dy = -b.speed * Math.cos(angle);   // siempre hacia arriba
        b.y = paddle.y - b.radius;
    } else {
        const direction = side === 'p1' ? 1 : -1;
        b.dx = direction * b.speed * Math.cos(angle);
        b.dy = b.speed * Math.sin(angle);
        b.x = direction === 1 ? paddle.x + paddle.width + b.radius : paddle.x - b.radius;
    }
    b.owner = side;
    b.power = type === 'smash' || type === 'super' ? type : null;

    // 7. Energía del que golpea; el súper la gasta (o gasta el súper regalado)
    if (type === 'super') {
        if (holder.superArmed) holder.superArmed = false;
        else holder.energy = 0;
    }
    addEnergy(holder, HIT_ENERGY[type] * (state.fever ? MECH.energy.feverK : 1));

    // 8. Cualquier golpe cierra la carga del smash, se usara o no
    paddle.charge = 0;
    paddle.releaseMs = Infinity;

    // 9. Sensación: sonido, chispas y vibración de pantalla
    const info = { x: b.x, speedRatio: Math.min(1, b.speed / maxBallSpeed) };
    if (type === 'super') soundEffects.superHit(info);
    else if (type === 'smash') soundEffects.smashRelease(info);
    else if (type === 'perfect') soundEffects.perfectHit(info);
    else if (Math.abs(b.spin) > MECH.spinSoundMin) soundEffects.spinHit(info);
    else soundEffects.paddleHit(info);
    const [count, color] = hitParticles(type);
    spawnParticles(b.x, b.y, color, count);
    const shake = MECH.shake[type] || [4, 100];
    triggerShake(shake[0], shake[1]);
    if (MECH.hitStopMs[type]) state.hitStopMs = MECH.hitStopMs[type];
    if (MECH.vibrate[type]) mechVibrate(side, MECH.vibrate[type]);
    b.squash = 1;

    // 10. Efectos visuales (vfx/mechanics.js y vfx/super.js)
    const fxColor = sideColor(side);
    if (type === 'perfect') MECH_FX.perfect(b.x, b.y, fxColor);
    else if (type === 'smash') MECH_FX.smash(b.x, b.y, fxColor);
    else if (type === 'super') SUPER_FX[superStyleId()].burst(b.x, b.y, fxColor);
    mechFlashPaddle(side);

    // 11. Nuevo intercambio: el jefe recalcula su puntería, el último en
    // golpear se queda los power-ups y el rally suma. Cada 10 golpes de
    // rally, los dos ganan energía.
    bossRefreshAim();
    setLastHitter(side);
    statsOnPaddleHit();
    statsOnHitType(side, type, b.spin);
    if (currentRally % 10 === 0) {
        addEnergy(p1, MECH.energy.rally10);
        addEnergy(p2, MECH.energy.rally10);
    }
    if (currentRally === MECH.feverRally) startFever();
    return type;
}

/**
 * Vibra el móvil si el golpe lo dio alguien que juega con el dedo y el
 * jugador no lo ha desactivado.
 * @param {'p1'|'p2'} side
 * @param {number} ms
 */
function mechVibrate(side, ms) {
    if (!settings.haptics || typeof navigator.vibrate !== 'function') return;
    if (!isFingerOn(side)) return;
    navigator.vibrate(ms);
}

/**
 * El aplastamiento del golpe se recupera solo (es solo visual).
 * @param {Ball} b
 * @param {number} dt
 */
function decaySquash(b, dt) {
    if (b.squash === 0) return;
    b.squash *= Math.pow(0.8, dt);
    if (b.squash < 0.001) b.squash = 0;
}

/**
 * El efecto curva la bola en vuelo (dy, o dx en la arena rotada) y se
 * va apagando. La bola nunca llega a ir casi en paralelo a la paleta.
 * @param {Ball} b
 * @param {number} dt
 * @param {boolean} rotated
 */
function applySpin(b, dt, rotated) {
    if (b.spin === 0) return;
    const lim = b.speed * MECH.spinMaxSlope;
    if (rotated) b.dx = mechClamp(b.dx + b.spin * MECH.spinAccel * dt, -lim, lim);
    else b.dy = mechClamp(b.dy + b.spin * MECH.spinAccel * dt, -lim, lim);
    b.spin *= Math.pow(MECH.spinDecay, dt);
    if (Math.abs(b.spin) < 0.001) b.spin = 0;
}
