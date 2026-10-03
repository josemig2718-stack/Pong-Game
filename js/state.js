/**
 * state.js
 * ------------------------------------------------------------------
 * Estado de la partida en curso, compartido por todos los scripts.
 *
 * Todo lo que cambia durante una partida y se lee desde más de un
 * archivo vive en el objeto `state`: así cualquier sistema puede
 * escribirlo (p. ej. la campaña detiene la partida al lanzar el final)
 * sin reasignar variables de otro archivo.
 *
 * Las paletas son objetos estables: se mutan sus propiedades, nunca se
 * sustituyen, así que se declaran aparte como constantes.
 *
 * Depende solo de config.js (dimensiones y geometría).
 * ------------------------------------------------------------------
 */

'use strict';

const state = {
    /** 'cpu' | 'local' | 'hachepe' | 'campaign' */
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
const p1 = { x: 24, y: GAME_HEIGHT / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, dy: 0, touchY: null };
const p2 = { x: GAME_WIDTH - 24 - paddleWidth, y: GAME_HEIGHT / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, dy: 0, touchY: null };

// Paleta gemela del rival (Mario, en el combate del dúo). Las mecánicas
// del jefe viven en bosses.js; aquí está porque participa en el
// movimiento y la colisión de game.js.
const p2Twin = { x: GAME_WIDTH - 24 - 15 - 40, y: 0, width: 15, height: 100, dy: 0, active: false, retreatMs: 0 };
