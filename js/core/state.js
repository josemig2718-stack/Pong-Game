/**
 * core/state.js
 * ------------------------------------------------------------------
 * Estado de la partida en curso, compartido por todos los archivos.
 *
 * Todo lo que cambia durante una partida y se lee desde más de un
 * archivo vive en el objeto `state`: así cualquier sistema puede
 * escribirlo (p. ej. la campaña detiene la partida al lanzar el final)
 * sin reasignar variables declaradas en otro archivo.
 *
 * Las paletas son objetos estables: se mutan sus propiedades, nunca se
 * sustituyen, así que se declaran aparte como constantes.
 *
 * Capa base: solo usa core/constants.js, que se carga antes.
 * ------------------------------------------------------------------
 */

'use strict';

/** @typedef {'cpu' | 'local' | 'hachepe' | 'campaign' | 'practice'} GameMode */

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
 * @property {number} spin  efecto, de -1 a 1: curva la trayectoria (game/mechanics.js)
 * @property {BallPower} power  smash o súper golpe en curso; null = golpe normal
 * @property {'p1'|'p2'|null} owner  quién la golpeó por última vez (null hasta el primer golpe)
 * @property {number} squash  aplastamiento del último golpe, de 1 a 0. Solo visual
 */

/** @typedef {null | 'smash' | 'super'} BallPower */

/**
 * Una paleta. touchX/touchY es la posición que pide el dedo o el ratón:
 * si tiene valor manda sobre el teclado; null = manda el teclado.
 * @typedef {object} Paddle
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number|null} [touchY]
 * @property {number|null} [touchX]
 * @property {number} vy  velocidad vertical real (px/fotograma): la integra el teclado o se mide con el dedo, el ratón y la CPU
 * @property {number} prevY  posición del fotograma anterior, para medir vy
 * @property {number} vx  como vy, en el eje X de la arena rotada
 * @property {number} prevX
 * @property {number} charge  carga del smash, de 0 a 1
 * @property {boolean} smashHeld  se está manteniendo el smash
 * @property {boolean} smashTouchHeld  el control táctil del smash está pulsado
 * @property {number} releaseMs  ms desde que se soltó el smash (Infinity = no hay ventana abierta)
 * @property {number} energy  energía del súper golpe, de 0 a MECH.energy.max
 * @property {boolean} superArmed  el siguiente golpe es súper sin gastar energía
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
 * Estado mutable de la partida (ver el comentario del archivo).
 * @typedef {object} GameState
 * @property {GameMode} mode
 * @property {boolean} isPlaying
 * @property {boolean} isPaused
 * @property {number} p1Score
 * @property {number} p2Score  contra el Creador cuenta los fallos del jugador, no puntos del rival
 * @property {number} frameCount
 * @property {number} serveCountdownMs
 * @property {number} goTextMs  tras el saque, tiempo que queda mostrando "¡YA!" (ms)
 * @property {number} shakeIntensity
 * @property {number} shakeTimeMs
 * @property {number} hitStopMs  congelación breve tras un golpe fuerte (ms reales); update() no avanza mientras dure
 * @property {boolean} fever  fiebre del rally: desde MECH.feverRally golpes seguidos hasta el siguiente gol
 * @property {number} feverHeat  intensidad visual de la fiebre, de 0 a 1 (sube y baja en MECH.feverFadeMs)
 * @property {Ball[]} balls
 * @property {Particle[]} particles
 */

/** @type {GameState} */
const state = {
    mode: 'cpu',
    isPlaying: false,
    isPaused: false,
    p1Score: 0,
    p2Score: 0,
    /** Contador de fotogramas dibujados (anima la red y algunas estelas). */
    frameCount: 0,
    /** Cuenta regresiva antes de que la bola se mueva (ms). 0 = bola en juego. */
    serveCountdownMs: 0,
    /** Tras el saque, tiempo que queda mostrando "¡YA!" (ms). */
    goTextMs: 0,
    /** Vibración de pantalla: amplitud en px y tiempo restante en ms. */
    shakeIntensity: 0,
    shakeTimeMs: 0,
    /** Hit-stop: tras un golpe fuerte la partida se congela unos fotogramas (ms). */
    hitStopMs: 0,
    /** Fiebre del rally y su intensidad visual (0–1). */
    fever: false,
    feverHeat: 0,
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
/**
 * Campos de las mecánicas de golpe con su valor de reposo. startGame()
 * los repone con resetPaddleMechanics().
 */
function paddleMechanicsRest() {
    return { vy: 0, prevY: 0, vx: 0, prevX: 0, charge: 0, smashHeld: false, smashTouchHeld: false, releaseMs: Infinity, energy: 0, superArmed: false };
}

/** @type {Paddle} */
const p1 = { x: 24, y: GAME_HEIGHT / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, touchY: null, ...paddleMechanicsRest() };
/** @type {Paddle} */
const p2 = { x: GAME_WIDTH - 24 - paddleWidth, y: GAME_HEIGHT / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, touchY: null, ...paddleMechanicsRest() };

/**
 * Paleta gemela del rival (Mario, en el combate del dúo). Las mecánicas
 * del jefe viven en bosses/duo.js; está aquí porque la mueven y la
 * golpean game/ai.js y game/physics.js.
 * @type {Paddle & {active: boolean, retreatMs: number}}
 */
const p2Twin = { x: GAME_WIDTH - 24 - 15 - 40, y: 0, width: 15, height: 100, active: false, retreatMs: 0, ...paddleMechanicsRest() };

/** Repone los campos de las mecánicas de las tres paletas (al empezar una partida). */
function resetPaddleMechanics() {
    for (const p of [p1, p2, p2Twin]) Object.assign(p, paddleMechanicsRest());
}
