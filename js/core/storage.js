/**
 * core/storage.js
 * ------------------------------------------------------------------
 * Lectura y escritura de JSON en localStorage sin que un fallo del
 * almacenamiento (modo privado, cuota, JSON corrupto) rompa el juego.
 *
 * Solo serializa. Cada sistema combina lo leído con sus propios valores
 * por defecto, porque cada clave tiene reglas distintas.
 *
 * Capa base: no usa nada de otros archivos.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Lee y parsea una clave. Devuelve `fallback` si no existe o si falla la
 * lectura o el parseo (avisando por consola).
 *
 * Ojo: si la clave existe y contiene el JSON `null`, devuelve null, no
 * `fallback`. Es intencionado: así se comportaba el código original.
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @param {string} warning mensaje de consola si falla
 * @returns {any}
 */
function readJSON(key, fallback, warning) {
    try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
    } catch (err) {
        console.warn(warning, err);
    }
    return fallback;
}

/**
 * Serializa y guarda un valor. Si falla, avisa por consola y sigue.
 * @param {string} key
 * @param {unknown} value
 * @param {string} warning mensaje de consola si falla
 */
function writeJSON(key, value, warning) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        console.warn(warning, err);
    }
}
