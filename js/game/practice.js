/**
 * game/practice.js
 * ------------------------------------------------------------------
 * Modo práctica (state.mode === 'practice'): el jugador contra una pared
 * que cubre el borde derecho. Sin CPU, sin marcador, sin power-ups ni
 * recompensas; las mecánicas funcionan todas. Los fallos se cuentan en
 * state.p2Score y la partida nunca termina (checkWin devuelve false):
 * se sale desde la pausa, a la pantalla desde la que se entró.
 *
 * El desvío de la pared usa Math.random, pero solo existe en práctica:
 * los demás modos no lo llaman nunca.
 * ------------------------------------------------------------------
 */

'use strict';

/** La pared: una franja de arriba abajo pegada al borde derecho. */
const PRACTICE_WALL = { x: GAME_WIDTH - 12, y: 0, width: 12, height: GAME_HEIGHT };

/** Desvío máximo de dy en cada rebote en la pared, para que no sea monótono. */
const PRACTICE_WALL_JITTER = 1.5;

/** Pantalla a la que vuelve «Salir» desde la pausa ('howto-menu' o 'mode-select-menu'). */
let practiceReturnScreen = 'mode-select-menu';

/**
 * Empieza una práctica.
 * @param {string} from pantalla desde la que se entra
 */
function startPractice(from) {
    practiceReturnScreen = from;
    startGame('practice');
}

/**
 * La bola rebota en la pared con un pequeño desvío, sin cambiar de
 * velocidad. Un smash o un súper se quedan en ella: vuelve como mucho a
 * la velocidad máxima normal (si no, volvería siempre a la del súper).
 * @param {Ball} b
 * @param {number} maxBallSpeed
 */
function bouncePracticeWall(b, maxBallSpeed) {
    if (b.x + b.radius < PRACTICE_WALL.x || b.dx <= 0) return;
    if (b.power) {
        b.power = null;
        b.speed = Math.min(b.speed, maxBallSpeed);
    }
    const speed = Math.hypot(b.dx, b.dy);
    const limit = speed * 0.8;
    const dy = Math.max(-limit, Math.min(limit, b.dy + (Math.random() * 2 - 1) * PRACTICE_WALL_JITTER));
    const k = b.speed / speed;   // la velocidad que manda es b.speed
    b.dy = dy * k;
    b.dx = -Math.sqrt(speed * speed - dy * dy) * k;
    b.x = PRACTICE_WALL.x - b.radius;
    b.spin *= MECH.spinWallK;
    soundEffects.wallHit({ x: b.x });
    spawnParticles(b.x, b.y, currentThemeHex(), 6);
}

/**
 * La bola se le escapa al jugador: cuenta un fallo y hay saque nuevo.
 * Sin estadísticas: solo se pone el rally a cero.
 * @returns {boolean} true si hay que cortar el paso (nunca: la práctica no termina)
 */
function practiceMiss(b, bi, ballsToRemove) {
    state.p2Score++;
    statsResetRally();
    endFever();
    goalMusic();
    soundEffects.score();
    triggerShake(10, 260);
    triggerGoalVFX(0, b.y, goalPower(b));
    return onBallOut(bi, ballsToRemove);
}

/**
 * La pared: una barra del color del tema al 35 % con el panal del escudo
 * encima (sin su contador de bloqueos).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} color
 */
function drawPracticeWall(ctx, color) {
    ctx.fillStyle = hexToRgba(color, 0.35);
    ctx.fillRect(PRACTICE_WALL.x, PRACTICE_WALL.y, PRACTICE_WALL.width, PRACTICE_WALL.height);
    drawShieldWallV2(ctx, PRACTICE_WALL, SHIELD_HP, SHIELD_HP, { color, counter: false });
}
