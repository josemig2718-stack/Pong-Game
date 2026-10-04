/**
 * bosses/shared.js
 * ------------------------------------------------------------------
 * Estado y constantes compartidos por los jefes. Solo importa core/, así
 * que los archivos de cada jefe pueden usarlo en su código de primer
 * nivel sin riesgo de leerlo antes de que se haya evaluado.
 * ------------------------------------------------------------------
 */

/**
 * Estado vivo del jefe en curso. Cada jefe guarda aquí lo suyo en init().
 * @type {Record<string, any>}
 */
export let bossState = {};

/** Vacía el estado del jefe (al empezar cada partida, en bossInit()). */
export function resetBossState() {
    bossState = {};
}

/** Alto de la franja del Creador. game/ lo usa para el rebote contra ella. */
export const CREATOR_BAND_H = 110;
