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
 * Lee y parsea una clave que guarda un objeto. Devuelve `fallback` si no
 * existe, si falla la lectura o el parseo (avisando por consola) o si lo
 * guardado no es un objeto (p. ej. el JSON `null`).
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @param {string} warning mensaje de consola si falla
 * @returns {any}
 */
function readJSON(key, fallback, warning) {
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const value = JSON.parse(raw);
            if (value !== null && typeof value === 'object') return value;
        }
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
