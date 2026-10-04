/**
 * data/powerups.js
 * ------------------------------------------------------------------
 * Tipos de power-up. `duration` 0 = efecto instantáneo; `weight` es la
 * probabilidad relativa de aparición.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * @typedef {object} PowerupType
 * @property {string} id
 * @property {string} emoji     icono en el campo y en el indicador
 * @property {string} color     '#rrggbb' (se le añade alfa en hex al dibujar)
 * @property {number} duration  ms; 0 = efecto instantáneo
 * @property {number} weight    probabilidad relativa de aparición
 */

/** @type {PowerupType[]} */
const POWERUP_TYPES = [
    { id: 'paddle_xl',    emoji: '⬆️', color: '#22c55e', duration: 8000,  weight: 20 },
    { id: 'paddle_mini',  emoji: '⬇️', color: '#a855f7', duration: 8000,  weight: 20 },
    { id: 'big_ball',     emoji: '🔴', color: '#ef4444', duration: 6000,  weight: 15 },
    { id: 'turbo',        emoji: '⚡', color: '#eab308', duration: 0,     weight: 15 },
    { id: 'shield',       emoji: '🛡️', color: '#3b82f6', duration: 5000,  weight: 10 },
    { id: 'slowmo',       emoji: '🌀', color: '#f97316', duration: 4000,  weight: 10 },
    { id: 'multi_ball',   emoji: '✨', color: '#ffffff', duration: 0,     weight: 10 }
];
