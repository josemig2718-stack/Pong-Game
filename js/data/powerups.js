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
 * @property {string} name      nombre en la píldora del efecto activo
 * @property {string} icon      `d` de un glifo de 24×24 para la píldora
 * @property {string} emoji     icono del power-up en el campo (canvas)
 * @property {string} color     '#rrggbb' (se le añade alfa en hex al dibujar)
 * @property {number} duration  ms; 0 = efecto instantáneo
 * @property {number} weight    probabilidad relativa de aparición
 */

/** @type {PowerupType[]} */
const POWERUP_TYPES = [
    { id: 'paddle_xl',   name: 'Paleta grande', icon: 'M11 3h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM4 8l-2 4 2 4M20 8l2 4-2 4', emoji: '⬆️', color: '#22c55e', duration: 8000, weight: 20 },
    { id: 'paddle_mini', name: 'Paleta mini',   icon: 'M11 8h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zM3 9l3 3-3 3M21 9l-3 3 3 3', emoji: '⬇️', color: '#a855f7', duration: 8000, weight: 20 },
    { id: 'big_ball',    name: 'Bola gigante',  icon: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M8 12a4 4 0 0 1 4-4', emoji: '🔴', color: '#ef4444', duration: 6000, weight: 15 },
    { id: 'turbo',       name: 'Turbo',         icon: 'M13 2L4 14h7l-1 8 9-12h-7z', emoji: '⚡', color: '#eab308', duration: 0, weight: 15 },
    { id: 'shield',      name: 'Escudo',        icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', emoji: '🛡️', color: '#3b82f6', duration: 5000, weight: 10 },
    { id: 'slowmo',      name: 'Cámara lenta',  icon: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7v5l3 2', emoji: '🌀', color: '#f97316', duration: 4000, weight: 10 },
    { id: 'multi_ball',  name: 'Multibola',     icon: 'M4 15a3 3 0 1 0 6 0a3 3 0 1 0-6 0M14 15a3 3 0 1 0 6 0a3 3 0 1 0-6 0M9 7a3 3 0 1 0 6 0a3 3 0 1 0-6 0', emoji: '✨', color: '#ffffff', duration: 0, weight: 10 }
];
