/**
 * config.js
 * ------------------------------------------------------------------
 * Constantes globales del juego, catálogo de temas de color y
 * utilidades de persistencia (localStorage). No depende de ningún
 * otro archivo: debe cargarse primero.
 * ------------------------------------------------------------------
 */

// --- Dimensiones lógicas del campo de juego (resolución interna fija) ---
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

// --- Catálogo de temas de color -----------------------------------
// Cada tema define el color "primario" (paletas, HUD, marcador) y un
// color de acento opcional para detalles. Se aplican como variables
// CSS (--primary / --primary-rgb) y también se usan directamente al
// dibujar en el <canvas>.
const THEMES = {
    green:  { label: 'Verde',    hex: '#22c55e', rgb: '34, 197, 94' },
    purple: { label: 'Morado',   hex: '#a855f7', rgb: '168, 85, 247' },
    blue:   { label: 'Azul',     hex: '#3b82f6', rgb: '59, 130, 246' },
    red:    { label: 'Rojo',     hex: '#ef4444', rgb: '239, 68, 68' },
    orange: { label: 'Naranja',  hex: '#f97316', rgb: '249, 115, 22' },
    cyan:   { label: 'Cian',     hex: '#06b6d4', rgb: '6, 182, 212' },
    yellow: { label: 'Amarillo', hex: '#eab308', rgb: '234, 179, 8' },
    pink:   { label: 'Rosa',     hex: '#ec4899', rgb: '236, 72, 153' }
};

// --- Combinaciones de teclas por defecto ---------------------------
const DEFAULT_BINDINGS = {
    p1Up:   'KeyW',
    p1Down: 'KeyS',
    p2Up:   'ArrowUp',
    p2Down: 'ArrowDown',
    pause:  'Escape'
};

// Nombres legibles para mostrar en pantalla en vez del código crudo (event.code)
const KEY_LABELS = {
    KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Escape: 'ESC', Space: 'ESPACIO', ShiftLeft: 'SHIFT IZQ', ShiftRight: 'SHIFT DER',
    ControlLeft: 'CTRL IZQ', ControlRight: 'CTRL DER'
};

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
    bindings: { ...DEFAULT_BINDINGS }
};

const STORAGE_KEY = 'pongGame.settings.v1';

/**
 * Carga la configuración guardada y la combina con los valores por
 * defecto (para que versiones nuevas con más opciones no rompan
 * partidas guardadas de versiones anteriores).
 */
function loadSettings() {
    let saved = {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) saved = JSON.parse(raw);
    } catch (err) {
        console.warn('No se pudo leer la configuración guardada:', err);
    }
    return {
        ...DEFAULT_SETTINGS,
        ...saved,
        bindings: { ...DEFAULT_BINDINGS, ...(saved.bindings || {}) }
    };
}

function saveSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
        console.warn('No se pudo guardar la configuración:', err);
    }
}

// Objeto de configuración activo durante toda la sesión.
const settings = loadSettings();

// Velocidades de bola en píxeles/segundo a 60 FPS de referencia.
// base = velocidad inicial; max = velocidad tope tras aceleraciones.
const BALL_SPEED_PRESETS = {
    1: { base: 5, max: 11 },
    2: { base: 7, max: 15 },
    3: { base: 9.5, max: 19 }
};
