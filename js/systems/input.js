/**
 * systems/input.js
 * ------------------------------------------------------------------
 * Manejo de teclado y sistema de reasignación de teclas ("key rebinding").
 * Usa event.code (posición física de la tecla) en vez de event.key,
 * para que funcione igual sin importar el idioma del teclado.
 * ------------------------------------------------------------------
 */

'use strict';

// Estado de teclas presionadas en este instante (se llena dinámicamente
// según las combinaciones configuradas en `settings.bindings`).
const keysDown = new Set();

// Si distinto de null, el próximo keydown se usará para reasignar esta acción
// en vez de jugar (p. ej. 'p1Up', 'pause', etc.)
let listeningForAction = null;

function handleKeyDown(e) {
    if (listeningForAction) {
        e.preventDefault();
        // FIX: limpiar listeningForAction ANTES de llamar a assignBinding
        // para que refreshBindingButtons() vea el estado correcto y
        // muestre la nueva tecla inmediatamente.
        const action = listeningForAction;
        listeningForAction = null;
        assignBinding(action, e.code);
        return;
    }

    // Durante una escena las teclas son suyas: nada llega al juego
    if (cutscenePlaying()) {
        cutsceneKey(e, true);
        return;
    }

    keysDown.add(e.code);

    // ESC cierra las Novedades (un diálogo encima del menú)
    if (e.code === 'Escape' && newsIsOpen()) {
        closeNews();
        return;
    }

    if (e.code === settings.bindings.pause && state.isPlaying) {
        togglePause();
    }

    // Evita que el scroll de la página se dispare con flechas/espacio durante el juego
    if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    // Enter es el smash del jugador 2: en partida no debe activar el botón
    // que tenga el foco. En los menús sigue funcionando como siempre.
    if (e.code === 'Enter' && state.isPlaying && !state.isPaused) e.preventDefault();
}

/** Registra el teclado de juego y de reasignación. */
function initInput() {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', (e) => {
        keysDown.delete(e.code);
        if (cutscenePlaying()) cutsceneKey(e, false);
    });
}

/**
 * ¿Está pulsada la tecla asignada a esta acción?
 * @param {string} action p1Up, p1Down, p2Up, p2Down, p1Smash, p2Smash o pause
 * @returns {boolean}
 */
function isActionPressed(action) {
    return keysDown.has(settings.bindings[action]);
}

function assignBinding(action, code) {
    // Evita que dos acciones queden asignadas a la misma tecla
    for (const key in settings.bindings) {
        if (settings.bindings[key] === code) settings.bindings[key] = null;
    }
    settings.bindings[action] = code;
    saveSettings();
    keysDown.clear();
    refreshBindingButtons();
}

/**
 * La próxima tecla pulsada se asignará a esta acción.
 * @param {string} action
 */
function startListeningFor(action) {
    listeningForAction = action;
    refreshBindingButtons();
}

/** Vuelve a las teclas por defecto. */
function resetBindings() {
    settings.bindings = { ...DEFAULT_BINDINGS };
    saveSettings();
    refreshBindingButtons();
}

/** Actualiza el texto de los botones de reasignación en el menú de Controles */
function refreshBindingButtons() {
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-binding-action]')).forEach(btn => {
        const action = btn.dataset.bindingAction;
        if (listeningForAction === action) {
            btn.textContent = 'PULSA UNA TECLA...';
            btn.classList.add('key-btn--listening');
        } else {
            btn.textContent = keyLabel(settings.bindings[action]);
            btn.classList.remove('key-btn--listening');
        }
    });
}
