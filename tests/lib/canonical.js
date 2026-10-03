/**
 * tests/lib/canonical.js
 * ------------------------------------------------------------------
 * Serialización canónica y hash, para comparar estados exactos.
 *
 * - canonical(): JSON con las claves ordenadas. Así reordenar las
 *   propiedades de un objeto (que no cambia el comportamiento) no se
 *   confunde con un cambio real. Los números usan la representación
 *   más corta que identifica el double, de modo que dos doubles
 *   distintos nunca producen el mismo texto: la comparación es exacta.
 * - fnv(): hash FNV-1a de 32 bits, en hexadecimal de 8 caracteres.
 * ------------------------------------------------------------------
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
export function canonical(value) {
    return JSON.stringify(sortKeys(value));
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === 'object') {
        /** @type {Record<string, unknown>} */
        const out = {};
        for (const k of Object.keys(value).sort()) {
            const v = /** @type {Record<string, unknown>} */ (value)[k];
            if (v !== undefined && typeof v !== 'function') out[k] = sortKeys(v);
        }
        return out;
    }
    return value;
}

/**
 * Hash FNV-1a de 32 bits sobre las unidades UTF-16 de un texto.
 * @param {string} text
 * @returns {string} 8 caracteres hexadecimales
 */
export function fnv(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Hash FNV-1a de 32 bits sobre bytes (p. ej. los píxeles de un canvas).
 * @param {ArrayLike<number>} bytes
 * @returns {string}
 */
export function fnvBytes(bytes) {
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
        h ^= bytes[i];
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generador mulberry32 con semilla: el bot usa uno propio, distinto
 * del del juego, para no consumir sus números aleatorios.
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Primeras diferencias entre dos valores, como rutas legibles.
 * @param {unknown} a
 * @param {unknown} b
 * @param {string} [path]
 * @param {string[]} [out]
 * @param {number} [limit]
 * @returns {string[]}
 */
export function diff(a, b, path = '', out = [], limit = 20) {
    if (out.length >= limit) return out;
    if (canonical(a) === canonical(b)) return out;
    const isObj = (v) => v && typeof v === 'object';
    if (isObj(a) && isObj(b) && Array.isArray(a) === Array.isArray(b)) {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const k of keys) diff(a[k], b[k], path ? `${path}.${k}` : k, out, limit);
        return out;
    }
    out.push(`${path || '(raíz)'}: esperado ${short(a)} · obtenido ${short(b)}`);
    return out;
}

/** @param {unknown} v */
function short(v) {
    const s = JSON.stringify(v);
    return s === undefined ? 'undefined' : (s.length > 120 ? s.slice(0, 117) + '...' : s);
}
