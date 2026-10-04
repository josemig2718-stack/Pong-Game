/**
 * core/constants.js
 * ------------------------------------------------------------------
 * Constantes del campo de juego: dimensiones lógicas, geometría de
 * paletas y bola, velocidades y la duración del fotograma de referencia.
 *
 * Capa base: es el primer script, así que cualquier archivo puede usar
 * estas constantes en su código de primer nivel.
 * ------------------------------------------------------------------
 */

'use strict';

// --- Dimensiones lógicas del campo de juego (resolución interna fija) ---
/** Resolución lógica del campo: el canvas siempre mide esto en píxeles. */
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

// --- Geometría de paletas y bola (en unidades lógicas) ---
const paddleWidth = 15;
const paddleHeight = 100;
const paddleSpeed = 8;   // píxeles por frame a 60 FPS → multiplicado por dt
const ballRadius = 9;

/**
 * Duración de un fotograma de referencia, en ms. La física usa un dt
 * normalizado a 60 FPS (dt = 1 es un fotograma a 60 FPS), así que pasar
 * dt a milisegundos es dt * MS_PER_FRAME.
 */
const MS_PER_FRAME = 1000 / 60;

// Velocidades de bola en píxeles por fotograma (a 60 FPS de referencia).
// base = velocidad inicial; max = velocidad tope tras aceleraciones.
/** @type {Record<number, {base: number, max: number}>} */
const BALL_SPEED_PRESETS = {
    1: { base: 5, max: 11 },
    2: { base: 7, max: 15 },
    3: { base: 9.5, max: 19 }
};
