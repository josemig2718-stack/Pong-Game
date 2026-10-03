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

import { BALL_SPEED_PRESETS, ballRadius, GAME_HEIGHT, GAME_WIDTH } from '../core/constants.js';
import { settings } from '../core/settings.js';
import { p1, state } from '../core/state.js';
import { soundEffects } from '../systems/audio.js';
import { enforcePowerups } from './powerups.js';
import { bossIsRotatedArena } from '../bosses/index.js';

// Duración de la cuenta regresiva antes de que la bola se mueva (ms)
const SERVE_INITIAL = 3000;    // 3 segundos al iniciar partida
const SERVE_AFTER_GOAL = 3000; // 3 segundos tras cada punto

function createBall(x, y, speed, dx, dy) {
    return {
        x: x, y: y,
        radius: ballRadius,
        speed: speed,
        dx: dx, dy: dy,
        trail: []
    };
}

/**
 * Coloca una bola nueva en el centro, con dirección aleatoria, y arranca
 * la cuenta regresiva del saque.
 * @param {boolean} [initialServe] true en el primer saque de la partida
 */
export function resetBall(initialServe = false) {
    const speedPreset = BALL_SPEED_PRESETS[settings.ballSpeed] || BALL_SPEED_PRESETS[2];
    const dir = Math.random() > 0.5 ? 1 : -1;
    const speed = speedPreset.base;
    let dy = (Math.random() * 2 - 1) * speed;
    if (Math.abs(dy) < 2) dy = dy < 0 ? -2 : 2;

    let dx = dir * speed;

    if (bossIsRotatedArena()) {
        // Arena rotada (El Creador): la bola cae y la paleta pasa a horizontal abajo
        dy = speed;
        dx = (Math.random() * 2 - 1) * speed * 0.5;
        p1.width = 100;
        p1.height = 15;
        p1.x = GAME_WIDTH / 2 - p1.width / 2;
        p1.y = GAME_HEIGHT - 30;
    }

    const newBall = createBall(GAME_WIDTH / 2, GAME_HEIGHT / 2, speed, dx, dy);
    state.balls = [newBall];

    // Congela la bola en el centro durante la cuenta regresiva
    state.serveCountdownMs = initialServe ? SERVE_INITIAL : SERVE_AFTER_GOAL;

    // Mantener power-ups persistentes (ej. bola gigante)
    enforcePowerups();
}

/** Divide la primera bola en dos o tres (multi-bola). */
export function spawnExtraBalls() {
    if (state.balls.length === 0) return;
    const source = state.balls[0];
    const count = Math.random() > 0.5 ? 2 : 1; // duplicar o triplicar

    soundEffects.multiBallSplit();

    for (let i = 0; i < count; i++) {
        const angleOffset = (Math.PI / 6) * (i + 1) * (Math.random() > 0.5 ? 1 : -1);
        const speed = source.speed;
        const origAngle = Math.atan2(source.dy, source.dx);
        const newAngle = origAngle + angleOffset;

        const extra = createBall(
            source.x, source.y, speed,
            speed * Math.cos(newAngle),
            speed * Math.sin(newAngle)
        );
        extra.radius = source.radius; // Respetar bola gigante si está activa
        state.balls.push(extra);
    }
}
