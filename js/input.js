/**
 * input.js
 * ------------------------------------------------------------------
 * Manejo de teclado y sistema de reasignación de teclas ("key rebinding").
 * Usa event.code (posición física de la tecla) en vez de event.key,
 * para que funcione igual sin importar el idioma del teclado.
 * ------------------------------------------------------------------
 */

// Estado de teclas presionadas en este instante (se llena dinámicamente
// según las combinaciones configuradas en `settings.bindings`).
const keysDown = new Set();

// Si distinto de null, el próximo keydown se usará para reasignar esta acción
// en vez de jugar (p. ej. 'p1Up', 'pause', etc.)
let listeningForAction = null;

window.addEventListener('keydown', (e) => {
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

    keysDown.add(e.code);

    if (e.code === settings.bindings.pause && typeof isPlaying !== 'undefined' && isPlaying) {
        togglePause();
    }

    // Evita que el scroll de la página se dispare con flechas/espacio durante el juego
    if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
});

window.addEventListener('keyup', (e) => {
    keysDown.delete(e.code);
});

function isActionPressed(action) {
    return keysDown.has(settings.bindings[action]);
}

function assignBinding(action, code) {
    // Evita que dos acciones queden asignadas a la misma tecla
    for (const key in settings.bindings) {
        if (settings.bindings[key] === code) settings.bindings[key] = null;
    }
    settings.bindings[action] = code;
    saveSettings(settings);
    keysDown.clear();
    refreshBindingButtons();
}

function startListeningFor(action) {
    listeningForAction = action;
    refreshBindingButtons();
}

function resetBindings() {
    settings.bindings = { ...DEFAULT_BINDINGS };
    saveSettings(settings);
    refreshBindingButtons();
}

/** Actualiza el texto de los botones de reasignación en el menú de Controles */
function refreshBindingButtons() {
    document.querySelectorAll('[data-binding-action]').forEach(btn => {
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
