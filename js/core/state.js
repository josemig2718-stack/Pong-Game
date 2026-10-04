/**
 * core/state.js
 * ------------------------------------------------------------------
 * Estado de la partida en curso, compartido por todos los módulos.
 *
 * Todo lo que cambia durante una partida y se lee desde más de un
 * módulo vive en el objeto `state`: así cualquier sistema puede
 * escribirlo (p. ej. la campaña detiene la partida al lanzar el final).
 * Un `export let` no serviría: quien lo importa no puede reasignarlo.
 *
 * Las paletas son objetos estables: se mutan sus propiedades, nunca se
 * sustituyen, así que se declaran aparte como constantes.
 *
 * Capa base: solo importa core/constants.js.
 * ------------------------------------------------------------------
 */

import { GAME_HEIGHT, GAME_WIDTH, paddleHeight, paddleWidth } from './constants.js';

/** @typedef {'cpu' | 'local' | 'hachepe' | 'campaign'} GameMode */

/**
 * Una bola en juego. Posición y velocidad en píxeles lógicos; dx/dy en
 * píxeles por fotograma a 60 FPS.
 * @typedef {object} Ball
 * @property {number} x
 * @property {number} y
 * @property {number} radius
 * @property {number} speed  módulo de la velocidad: crece con cada golpe hasta el máximo del preset
 * @property {number} dx
 * @property {number} dy
 * @property {Array<{x: number, y: number}>} trail  últimas posiciones, para dibujar la estela
 */

/**
 * Una paleta. touchX/touchY es la posición que pide el dedo o el ratón:
 * si tiene valor manda sobre el teclado; null = manda el teclado.
 * @typedef {object} Paddle
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} dy
 * @property {number} [dx]  solo en la arena rotada, donde la paleta se mueve en X
 * @property {number|null} [touchY]
 * @property {number|null} [touchX]
 */

/**
 * Partícula de impacto.
 * @typedef {object} Particle
 * @property {number} x
 * @property {number} y
 * @property {number} dx
 * @property {number} dy
 * @property {number} life  de 1 a 0; al llegar a 0 desaparece
 * @property {string} color
 */

/**
 * Estado mutable de la partida (ver el comentario del módulo).
 * @typedef {object} GameState
 * @property {GameMode} mode
 * @property {boolean} isPlaying
 * @property {boolean} isPaused
 * @property {number} p1Score
 * @property {number} p2Score  contra el Creador cuenta los fallos del jugador, no puntos del rival
 * @property {number} frameCount
 * @property {number} serveCountdownMs
 * @property {number} shakeIntensity
 * @property {number} shakeTimeMs
 * @property {Ball[]} balls
 * @property {Particle[]} particles
 */

/** @type {GameState} */
export const state = {
    mode: 'cpu',
    isPlaying: false,
    isPaused: false,
    p1Score: 0,
    p2Score: 0,
    /** Contador de fotogramas dibujados (anima la red y algunas estelas). */
    frameCount: 0,
    /** Cuenta regresiva antes de que la bola se mueva (ms). 0 = bola en juego. */
    serveCountdownMs: 0,
    /** Vibración de pantalla: amplitud en px y tiempo restante en ms. */
    shakeIntensity: 0,
    shakeTimeMs: 0,
    /**
     * Bolas en juego (el power-up multi-bola añade hasta dos más).
     * resetBall() sustituye el array entero: no guardes una referencia a
     * él entre llamadas, léelo siempre como state.balls.
     */
    balls: [],
    /** Partículas de impacto. */
    particles: []
};

// --- Paletas ---
/** @type {Paddle} */
export const p1 = { x: 24, y: GAME_HEIGHT / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, dy: 0, touchY: null };
/** @type {Paddle} */
export const p2 = { x: GAME_WIDTH - 24 - paddleWidth, y: GAME_HEIGHT / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, dy: 0, touchY: null };

/**
 * Paleta gemela del rival (Mario, en el combate del dúo). Las mecánicas
 * del jefe viven en bosses/duo.js; está aquí porque la mueven y la
 * golpean game/ai.js y game/physics.js.
 * @type {Paddle & {active: boolean, retreatMs: number}}
 */
export const p2Twin = { x: GAME_WIDTH - 24 - 15 - 40, y: 0, width: 15, height: 100, dy: 0, active: false, retreatMs: 0 };
