/**
 * game/hints.js
 * ------------------------------------------------------------------
 * Avisos de primera vez: un mensaje corto arriba del campo
 * (#hint-toast) la primera vez que el jugador hace algo nuevo (golpe con
 * efecto, perfecto, fiebre, cada power-up). Dura 3 s y no pausa la
 * partida; si salta otro mientras se ve uno, espera su turno.
 *
 * Las claves vistas se guardan en settings.seenHints (son preferencias,
 * no progreso). El ajuste «Consejos en partida» los apaga todos. En el
 * modo práctica salen siempre, una vez por sesión.
 *
 * La energía llena usa su propio aviso, #super-hint (game/hud.js), que
 * solo sale las ENERGY_HINT_TIMES primeras veces.
 *
 * Solo lee el estado y escribe en el DOM: nada aquí consume Math.random.
 * ------------------------------------------------------------------
 */

'use strict';

/** Cuánto se ve cada aviso (ms). */
const HINT_MS = 3000;

/** Veces que sale el aviso de súper listo antes de dejar de mostrarse. */
const ENERGY_HINT_TIMES = 3;

/** Texto de cada aviso; los de power-up (pu_<id>) salen de POWERUP_TYPES. */
const HINTS = {
    spin:    '¡Golpe con efecto! Muévete al golpear para curvar la bola',
    perfect: '¡Perfecto! El centro de la paleta da más velocidad y energía',
    fever:   '¡Fiebre! Cada punto vale el doble de XP hasta que alguien marque'
};

/** Avisos que esperan turno (claves). */
/** @type {string[]} */
let hintQueue = [];
/** Hasta cuándo (performance.now) se ve el aviso actual; 0 = no hay ninguno. */
let hintUntil = 0;
/** Claves ya mostradas en esta sesión de práctica. */
const practiceHintsShown = new Set();

/**
 * Texto de un aviso.
 * @param {string} key
 * @returns {string}
 */
function hintText(key) {
    if (key.startsWith('pu_')) {
        const type = POWERUP_TYPES.find((t) => t.id === key.slice(3));
        return type ? `Nuevo power-up: ${type.name}: ${type.hint}` : '';
    }
    return HINTS[key] || '';
}

/**
 * ¿Toca mostrar este aviso? En práctica, una vez por sesión; si no, solo
 * con los consejos activados y si no se ha visto ya.
 * @param {string} key
 * @param {number} [times] veces que puede salir (la energía, varias)
 */
function hintDue(key, times = 1) {
    if (state.mode === 'practice') return !practiceHintsShown.has(key);
    if (!settings.showHints) return false;
    return settings.seenHints.filter((k) => k === key).length < times;
}

/**
 * Apunta que se ha mostrado un aviso (y lo guarda).
 * @param {string} key
 */
function markHintSeen(key) {
    practiceHintsShown.add(key);
    settings.seenHints.push(key);
    saveSettings();
}

/**
 * Muestra un aviso de primera vez si toca.
 * @param {string} key spin, perfect, fever o pu_<id>
 */
function showHint(key) {
    if (!hintDue(key) || hintQueue.includes(key)) return;
    markHintSeen(key);
    hintQueue.push(key);
    if (hintUntil === 0) nextHint();
}

/** Pasa al siguiente aviso de la cola (o la oculta si no queda ninguno). */
function nextHint() {
    const toast = document.getElementById('hint-toast');
    if (hintQueue.length === 0) {
        hintUntil = 0;
        toast.classList.add('hidden');
        return;
    }
    document.getElementById('hint-toast-text').textContent = hintText(hintQueue[0]);
    // Se vuelve a crear la animación de entrada
    toast.classList.add('hidden');
    void toast.offsetWidth;
    toast.classList.remove('hidden');
    hintUntil = performance.now() + HINT_MS;
}

/** Desde updateHud(): cambia de aviso cuando se acaba el tiempo del actual. */
function updateHintToast() {
    if (hintUntil === 0 || performance.now() < hintUntil) return;
    hintQueue.shift();
    nextHint();
}

/** Al empezar una partida: sin avisos pendientes (y la práctica, de cero). */
function resetHints() {
    hintQueue = [];
    hintUntil = 0;
    practiceHintsShown.clear();
    document.getElementById('hint-toast').classList.add('hidden');
}
