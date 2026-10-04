/**
 * bosses/shared.js
 * ------------------------------------------------------------------
 * Estado y constantes compartidos por los jefes. Se carga antes que
 * ellos, así que pueden usarlo en su código de primer nivel.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Estado vivo del jefe en curso. Cada jefe guarda aquí lo suyo en init().
 * @type {Record<string, any>}
 */
let bossState = {};

/** Vacía el estado del jefe (al empezar cada partida, en bossInit()). */
function resetBossState() {
    bossState = {};
}

/** Alto de la franja del Creador. game/ lo usa para el rebote contra ella. */
const CREATOR_BAND_H = 110;
