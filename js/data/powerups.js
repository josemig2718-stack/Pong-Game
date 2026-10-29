/**
 * data/powerups.js
 * ------------------------------------------------------------------
 * Tipos de power-up. `duration` 0 = efecto instantáneo; `weight` es la
 * probabilidad relativa de aparición. La cámara lenta dura 10 s reales
 * (su tiempo no se ralentiza) y el escudo no caduca por tiempo sino tras
 * SHIELD_HP bloqueos: sus 30 s son solo un tope de seguridad. El Rayo
 * dura hasta el siguiente golpe; sus 20 s son también un tope.
 *
 * Los cuatro de la v2 (Congelar, Rayo, Muro y Portales) no salen en la
 * campaña (`campaign: false`): llegarán con su rework.
 *
 * Cada tipo tiene un color propio, distinto de los temas, para
 * reconocerlo de un vistazo, y un glifo que comparten el orbe del campo
 * y la píldora del efecto activo.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * @typedef {object} PowerupType
 * @property {string} id
 * @property {string} name      nombre en la píldora del efecto activo
 * @property {string} hint      qué hace, en pocas palabras (aviso de la primera vez que aparece)
 * @property {string} icon      `d` de un glifo de trazo de 24×24 (orbe del campo y píldora)
 * @property {string} color     '#rrggbb' del orbe, su estallido, sus partículas y la píldora
 * @property {number} duration  ms; 0 = efecto instantáneo
 * @property {number} weight    probabilidad relativa de aparición
 * @property {boolean} [campaign] false: no sale en la campaña
 */

/** Bloqueos que aguanta el escudo antes de romperse. */
const SHIELD_HP = 5;

/** Efectos con duración que pueden estar activos a la vez (los instantáneos no cuentan). */
const POWERUP_MAX_ACTIVE = 2;

/** Congelar: al descongelarse, esa paleta no se puede volver a congelar en este tiempo (ms). */
const FREEZE_IMMUNE_MS = 3000;
/** Congelar: vibración del móvil del jugador congelado (ms). */
const FREEZE_VIBRATE_MS = 40;
/** Muro: ancho (px) del muro pegado a la portería. */
const GOAL_WALL_WIDTH = 12;
/** Portales: radio (px) en el que el centro de la bola entra en un portal. */
const PORTAL_RADIUS = 24;
/** Portales: tras cruzar, ningún portal vuelve a atrapar esa bola en este tiempo (ms). */
const PORTAL_LOCK_MS = 500;
/** Portales: un gol hasta este tiempo después de cruzar da el logro «Atajo» (ms). */
const PORTAL_GOAL_MS = 1500;
/** Portales: en Imposible (y en el Modo Hachepe), la CPU recalcula la bola este tiempo después del cruce (ms). */
const CPU_PORTAL_RECALC_MS = 150;

/** @type {PowerupType[]} */
const POWERUP_TYPES = [
    { id: 'paddle_xl',   name: 'Paleta grande', hint: 'agranda la paleta del último que golpeó', icon: 'M10 7h4v10h-4zM12 1.5v3M9.8 3.3L12 1.2l2.2 2.1M12 22.5v-3M9.8 20.7L12 22.8l2.2-2.1', color: '#4ADE80', duration: 15000, weight: 20 },
    { id: 'paddle_mini', name: 'Paleta mini',   hint: 'encoge la paleta del rival', icon: 'M10 9.5h4v5h-4zM12 2v5M9.8 4.8L12 7l2.2-2.2M12 22v-5M9.8 19.2L12 17l2.2 2.2', color: '#C084FC', duration: 12000, weight: 20 },
    { id: 'big_ball',    name: 'Bola gigante',  hint: 'la bola triplica su tamaño', icon: 'M6 12a6 6 0 1 0 12 0a6 6 0 1 0-12 0M2.5 2.5l3 3M21.5 2.5l-3 3M2.5 21.5l3-3M21.5 21.5l-3-3', color: '#F87171', duration: 15000, weight: 15 },
    { id: 'turbo',       name: 'Turbo',         hint: 'la bola sale disparada', icon: 'M14 2L6.5 13h5.5l-1 9 7.5-11.5H13zM1.5 8.5h3M1 12.5h3.5M1.5 16.5h3', color: '#FACC15', duration: 0, weight: 15 },
    { id: 'shield',      name: 'Escudo',        hint: 'un muro que para 5 bolas delante de tu portería', icon: 'M12 2.5l7.5 3v5.8c0 5-3.3 8.8-7.5 10.2-4.2-1.4-7.5-5.2-7.5-10.2V5.5zM8.6 12l2.4 2.4 4.4-4.6', color: '#60A5FA', duration: 30000, weight: 10 },
    { id: 'slowmo',      name: 'Cámara lenta',  hint: 'todo va más despacio durante 10 s', icon: 'M6.5 2.5h11M6.5 21.5h11M7.5 2.5v3l4.5 6.5-4.5 6.5v3M16.5 2.5v3L12 12l4.5 6.5v3M10 18.5h4', color: '#FB923C', duration: 10000, weight: 10 },
    { id: 'multi_ball',  name: 'Multibola',     hint: 'la bola se divide en dos o tres', icon: 'M4 15.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0M14 15.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0M9 7a3 3 0 1 0 6 0a3 3 0 1 0-6 0', color: '#F472B6', duration: 0, weight: 10 },
    { id: 'freeze',      name: 'Congelar',      hint: 'congela la paleta del rival un momento', icon: 'M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5M3 10.3l3.4.7-1.1 3.3M21 13.7l-3.4-.7 1.1-3.3M3 13.7l3.4-.7-1.1-3.3M21 10.3l-3.4.7 1.1 3.3', color: '#A5F3FC', duration: 1500, weight: 8, campaign: false },
    { id: 'bolt',        name: 'Rayo',          hint: 'tu siguiente golpe será un súper golpe', icon: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M13 5.5L8.5 13h4l-1.5 5.5L15.5 11h-4z', color: '#818CF8', duration: 20000, weight: 6, campaign: false },
    { id: 'wall',        name: 'Muro',          hint: 'tapa media portería durante 8 s', icon: 'M3 5h18v14H3zM3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19', color: '#A3E635', duration: 8000, weight: 8, campaign: false },
    { id: 'portals',     name: 'Portales',      hint: 'la bola viaja de un portal al otro', icon: 'M2.5 12a3.5 6 0 1 0 7 0a3.5 6 0 1 0-7 0M14.5 12a3.5 6 0 1 0 7 0a3.5 6 0 1 0-7 0M6 12h12M15.5 9.5L18 12l-2.5 2.5', color: '#2DD4BF', duration: 10000, weight: 6, campaign: false }
];
