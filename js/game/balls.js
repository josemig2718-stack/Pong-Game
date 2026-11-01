/**
 * game/balls.js
 * ------------------------------------------------------------------
 * Creación de bolas: el saque (resetBall) y las bolas extra del
 * power-up multi-bola y de la fase 3 del Creador.
 *
 * resetBall() sustituye el array state.balls entero, incluso a mitad
 * de update(): nunca guardes una referencia al array entre llamadas.
 * ------------------------------------------------------------------
 */

'use strict';

// Duración de la cuenta regresiva antes de que la bola se mueva (ms)
const SERVE_INITIAL = 3000;    // 3 segundos al iniciar partida
const SERVE_AFTER_GOAL = 3000; // 3 segundos tras cada punto

/**
 * Velocidades de bola (base y tope) del ajuste en curso. La campaña
 * tiene su propia dificultad: siempre la velocidad normal.
 */
function currentSpeedPreset() {
    if (state.mode === 'campaign') return BALL_SPEED_PRESETS[2];
    return BALL_SPEED_PRESETS[settings.ballSpeed] || BALL_SPEED_PRESETS[2];
}

/** @returns {Ball} una bola sin efecto, sin smash, sin dueño y sin cruzar portales */
function createBall(x, y, speed, dx, dy) {
    return {
        x: x, y: y,
        radius: ballRadius,
        speed: speed,
        dx: dx, dy: dy,
        trail: [],
        spin: 0,
        power: null,
        owner: null,
        squash: 0,
        warpMs: Infinity
    };
}

/**
 * Coloca una bola nueva en el centro, con dirección aleatoria, y arranca
 * la cuenta regresiva del saque.
 * @param {boolean} [initialServe] true en el primer saque de la partida
 * @param {{ toward?: 'p1'|'p2' }} [opts] toward: saca hacia ese lado (pide el mismo azar)
 */
function resetBall(initialServe = false, opts = {}) {
    const speedPreset = currentSpeedPreset();
    let dir = Math.random() > 0.5 ? 1 : -1;
    if (opts.toward) dir = opts.toward === 'p1' ? -1 : 1;
    const speed = speedPreset.base;
    let dy = (Math.random() * 2 - 1) * speed;
    if (Math.abs(dy) < 2) dy = dy < 0 ? -2 : 2;

    let dx = dir * speed;

    if (bossIsRotatedArena()) {
        // Arena girada (el Creador): la bola va hacia la portería de abajo
        // o la de arriba (las palas ya las giró el jefe)
        dy = dir < 0 ? speed : -speed;
        dx = (Math.random() * 2 - 1) * speed * 0.5;
    }

    const newBall = createBall(GAME_WIDTH / 2, GAME_HEIGHT / 2, speed, dx, dy);
    state.balls = [newBall];

    // La carga del smash no pasa de un punto al siguiente
    resetSmashOnServe();

    // Congela la bola en el centro durante la cuenta regresiva
    state.serveCountdownMs = initialServe ? SERVE_INITIAL : SERVE_AFTER_GOAL;

    // Mantener power-ups persistentes (ej. bola gigante)
    enforcePowerups();
}

/**
 * Velocidad de una bola extra. Sumado al ángulo de un roce, el desvío
 * podía dejarla casi paralela a las porterías, rebotando de pared a pared
 * cientos de fotogramas sin llegar a ninguna. Si se abre más que el
 * ángulo de roce respecto al eje del juego, se refleja sobre ese límite.
 * @param {number} speed
 * @param {number} angle radianes, como Math.atan2(dy, dx)
 * @param {boolean} rotated arena rotada del Creador (el eje es vertical)
 * @returns {{dx: number, dy: number}}
 */
function extraBallVelocity(speed, angle, rotated) {
    const maxAngle = rotated ? MECH.rotatedEdgeAngle : MECH.edgeAngle;
    const along = rotated ? Math.sin(angle) : Math.cos(angle);
    const across = rotated ? Math.cos(angle) : Math.sin(angle);
    let off = Math.atan2(Math.abs(across), Math.abs(along));
    if (off > maxAngle) off = 2 * maxAngle - off;
    const a = (along < 0 ? -1 : 1) * speed * Math.cos(off);
    const c = (across < 0 ? -1 : 1) * speed * Math.sin(off);
    return rotated ? { dx: c, dy: a } : { dx: a, dy: c };
}

/** Divide la primera bola en dos o tres (multi-bola). */
function spawnExtraBalls() {
    if (state.balls.length === 0) return;
    const source = state.balls[0];
    let count = Math.random() > 0.5 ? 2 : 1; // duplicar o triplicar
    // Un jefe puede limitar las bolas en juego (el ataúd de Yisus: 2)
    const cfg = bossConfig();
    if (cfg && cfg.maxBalls) count = Math.min(count, cfg.maxBalls - state.balls.length);
    if (count <= 0) return;

    soundEffects.multiBallSplit();

    for (let i = 0; i < count; i++) {
        const angleOffset = (Math.PI / 6) * (i + 1) * (Math.random() > 0.5 ? 1 : -1);
        const speed = source.speed;
        const origAngle = Math.atan2(source.dy, source.dx);
        const newAngle = origAngle + angleOffset;
        const v = extraBallVelocity(speed, newAngle, bossIsRotatedArena());

        const extra = createBall(source.x, source.y, speed, v.dx, v.dy);
        extra.radius = source.radius; // Respetar bola gigante si está activa
        state.balls.push(extra);
    }
}
