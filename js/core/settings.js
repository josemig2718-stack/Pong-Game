/**
 * core/settings.js
 * ------------------------------------------------------------------
 * Configuración del jugador: valores por defecto, teclas, y el objeto
 * `settings` activo durante toda la sesión, persistido en localStorage
 * (clave pongGame.settings.v1).
 *
 * Capa base: solo usa core/storage.js, que se carga antes.
 * ------------------------------------------------------------------
 */

'use strict';

// --- Combinaciones de teclas por defecto ---------------------------
const DEFAULT_BINDINGS = {
    p1Up:   'KeyW',
    p1Down: 'KeyS',
    p2Up:   'ArrowUp',
    p2Down: 'ArrowDown',
    p1Smash: 'Space',
    p2Smash: 'Enter',
    pause:  'Escape'
};

// Nombres legibles para mostrar en pantalla en vez del código crudo (event.code)
const KEY_LABELS = {
    KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Escape: 'ESC', Space: 'ESPACIO', ShiftLeft: 'SHIFT IZQ', ShiftRight: 'SHIFT DER',
    ControlLeft: 'CTRL IZQ', ControlRight: 'CTRL DER', Enter: 'ENTER'
};

/**
 * Nombre legible de una tecla (event.code) para mostrar en pantalla.
 * @param {string|null} code
 * @returns {string}
 */
function keyLabel(code) {
    if (!code) return '---';
    if (KEY_LABELS[code]) return KEY_LABELS[code];
    if (code.startsWith('Key')) return code.replace('Key', '');
    if (code.startsWith('Digit')) return code.replace('Digit', '');
    return code;
}

// --- Configuración por defecto (se combina con lo guardado en localStorage) ---
const DEFAULT_SETTINGS = {
    theme:        'green',
    difficulty:   2,       // 1 Fácil, 2 Normal, 3 Imposible
    volume:       50,      // 0-100 (SFX)
    sfxEnabled:   true,
    musicEnabled: true,
    musicVolume:  50,      // 0-100 (música de fondo)
    winningScore: 5,       // 3, 5, 7, 11
    ballSpeed:    2,       // 1 Lenta, 2 Normal, 3 Rápida
    crtEffect:    true,    // efecto de escaneo estilo monitor CRT
    screenShake:  true,
    mouseControl: false,   // controlar paleta con mouse
    powerupsEnabled: true, // power-ups en partida
    smashTouch:   'button', // smash en táctil: 'button' (botón), 'finger' (segundo dedo) o 'auto' (súper automático)
    haptics:      true,    // vibración del móvil en los golpes fuertes
    showHints:    true,    // avisos de primera vez en partida (game/hints.js)
    seenHints:    [],      // claves de los avisos ya vistos ('energy' se repite: una entrada por vez)
    seenNewsVersion: null, // última versión de Novedades vista (ui/news.js)
    bindings: { ...DEFAULT_BINDINGS }
};

const SETTINGS_STORAGE_KEY = 'pongGame.settings.v1';

/**
 * Carga la configuración guardada y la combina con los valores por
 * defecto (para que versiones nuevas con más opciones no rompan
 * partidas guardadas de versiones anteriores).
 */
function loadSettings() {
    const saved = readJSON(SETTINGS_STORAGE_KEY, {}, 'No se pudo leer la configuración guardada:');
    const savedBindings = saved.bindings || {};
    const bindings = { ...DEFAULT_BINDINGS, ...savedBindings };
    // Una acción nueva no puede quitarle la tecla a otra que el jugador ya
    // tenía asignada: si su tecla por defecto está ocupada, queda libre.
    for (const action in DEFAULT_BINDINGS) {
        if (action in savedBindings) continue;
        const taken = Object.keys(savedBindings).some((a) => savedBindings[a] === bindings[action]);
        if (taken) bindings[action] = null;
    }
    return {
        ...DEFAULT_SETTINGS,
        ...saved,
        // Array propio: no compartir el de DEFAULT_SETTINGS
        seenHints: Array.isArray(saved.seenHints) ? [...saved.seenHints] : [],
        bindings
    };
}

/** Guarda `settings` en localStorage. */
function saveSettings() {
    writeJSON(SETTINGS_STORAGE_KEY, settings, 'No se pudo guardar la configuración:');
}

// Objeto de configuración activo durante toda la sesión.
const settings = loadSettings();

