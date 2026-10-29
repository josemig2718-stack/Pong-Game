/**
 * data/powerups.js
 * ------------------------------------------------------------------
 * Tipos de power-up. `duration` 0 = efecto instantáneo; `weight` es la
 * probabilidad relativa de aparición. La cámara lenta dura 10 s reales
 * (su tiempo no se ralentiza) y el escudo no caduca por tiempo sino tras
 * SHIELD_HP bloqueos: sus 30 s son solo un tope de seguridad.
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
 */

/** Bloqueos que aguanta el escudo antes de romperse. */
const SHIELD_HP = 5;

/** Efectos con duración que pueden estar activos a la vez (los instantáneos no cuentan). */
const POWERUP_MAX_ACTIVE = 2;

/** @type {PowerupType[]} */
const POWERUP_TYPES = [
    { id: 'paddle_xl',   name: 'Paleta grande', hint: 'agranda la paleta del último que golpeó', icon: 'M10 7h4v10h-4zM12 1.5v3M9.8 3.3L12 1.2l2.2 2.1M12 22.5v-3M9.8 20.7L12 22.8l2.2-2.1', color: '#4ADE80', duration: 15000, weight: 20 },
    { id: 'paddle_mini', name: 'Paleta mini',   hint: 'encoge la paleta del rival', icon: 'M10 9.5h4v5h-4zM12 2v5M9.8 4.8L12 7l2.2-2.2M12 22v-5M9.8 19.2L12 17l2.2 2.2', color: '#C084FC', duration: 12000, weight: 20 },
    { id: 'big_ball',    name: 'Bola gigante',  hint: 'la bola triplica su tamaño', icon: 'M6 12a6 6 0 1 0 12 0a6 6 0 1 0-12 0M2.5 2.5l3 3M21.5 2.5l-3 3M2.5 21.5l3-3M21.5 21.5l-3-3', color: '#F87171', duration: 15000, weight: 15 },
    { id: 'turbo',       name: 'Turbo',         hint: 'la bola sale disparada', icon: 'M14 2L6.5 13h5.5l-1 9 7.5-11.5H13zM1.5 8.5h3M1 12.5h3.5M1.5 16.5h3', color: '#FACC15', duration: 0, weight: 15 },
    { id: 'shield',      name: 'Escudo',        hint: 'un muro que para 5 bolas delante de tu portería', icon: 'M12 2.5l7.5 3v5.8c0 5-3.3 8.8-7.5 10.2-4.2-1.4-7.5-5.2-7.5-10.2V5.5zM8.6 12l2.4 2.4 4.4-4.6', color: '#60A5FA', duration: 30000, weight: 10 },
    { id: 'slowmo',      name: 'Cámara lenta',  hint: 'todo va más despacio durante 10 s', icon: 'M6.5 2.5h11M6.5 21.5h11M7.5 2.5v3l4.5 6.5-4.5 6.5v3M16.5 2.5v3L12 12l4.5 6.5v3M10 18.5h4', color: '#FB923C', duration: 10000, weight: 10 },
    { id: 'multi_ball',  name: 'Multibola',     hint: 'la bola se divide en dos o tres', icon: 'M4 15.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0M14 15.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0M9 7a3 3 0 1 0 6 0a3 3 0 1 0-6 0', color: '#F472B6', duration: 0, weight: 10 }
];
