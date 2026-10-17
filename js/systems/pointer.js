/**
 * systems/pointer.js
 * ------------------------------------------------------------------
 * Control de las paletas con el dedo y con el ratón.
 *
 * Los dos escriben en el mismo canal, touchY/touchX de la paleta: si
 * tiene valor, manda sobre el teclado (ver movePlayer1 en
 * game/physics.js); si es null, manda el teclado. En la arena rotada
 * del Creador la paleta se mueve en X, así que hay que escribir touchX.
 *
 * Táctil: en modo local la mitad izquierda mueve a P1 y la derecha a
 * P2; en el resto, cualquier toque mueve a P1. El smash se mantiene con
 * su botón (smashTouch 'button') o con un segundo dedo en la mitad del
 * jugador ('finger'); ambos escriben smashTouchHeld de la paleta.
 * Incluye el botón de pausa en pantalla (imprescindible en móvil, sin
 * tecla ESC) y el aviso de girar el dispositivo.
 * ------------------------------------------------------------------
 */

'use strict';

/** Heurística estándar para saber si el dispositivo es "táctil primario" */
function isTouchDevice() {
    return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches
    );
}

// Recuerda qué paleta (p1/p2) está controlando cada dedo (por touch.identifier),
// para que un dedo que se desliza no "salte" de paleta al cruzar el centro.
// Un segundo dedo que mantiene el smash se guarda como 'p1Smash'/'p2Smash'.
/** @type {Map<number, string>} */
const activeTouches = new Map();

/** Convierte la coordenada Y de un evento táctil a coordenadas internas del canvas */
function touchToCanvasY(clientY) {
    const rect = canvas.getBoundingClientRect();
    const ratio = GAME_HEIGHT / rect.height;
    return (clientY - rect.top) * ratio;
}

function touchToCanvasX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const ratio = GAME_WIDTH / rect.width;
    return (clientX - rect.left) * ratio;
}

/** Limita la Y pedida para que la paleta (con su altura actual) no salga del campo. */
function clampPaddleY(y, paddle) {
    return Math.max(0, Math.min(GAME_HEIGHT - paddle.height, y));
}

/**
 * ¿Hay un dedo en pantalla moviendo la paleta de ese jugador? (El ratón
 * también escribe touchY, así que eso no basta para saber si juega con
 * el dedo.)
 * @param {'p1'|'p2'} side
 */
function isFingerOn(side) {
    for (const target of activeTouches.values()) if (target === side) return true;
    return false;
}

function assignTouch(touch) {
    // Un toque que empieza en un botón de smash no mueve ninguna paleta
    if (touch.target instanceof Element && touch.target.closest('.smash-btn')) return;

    const canvasX = touchToCanvasX(touch.clientX);
    const canvasY = touchToCanvasY(touch.clientY);

    // En modo Local, la mitad izquierda de la pantalla mueve a P1 y la
    // derecha a P2. En modo VS CPU, cualquier toque mueve a P1.
    const target = (state.mode === 'local' && canvasX >= GAME_WIDTH / 2) ? 'p2' : 'p1';

    // "Segundo dedo": si ese jugador ya mueve su paleta con un dedo, este
    // otro mantiene el smash mientras dure
    if (settings.smashTouch === 'finger' && isFingerOn(target)) {
        activeTouches.set(touch.identifier, target + 'Smash');
        (target === 'p1' ? p1 : p2).smashTouchHeld = true;
        return;
    }

    activeTouches.set(touch.identifier, target);
    updatePaddleFromTouch(target, canvasY, canvasX);
    hideTouchHint(target);
}

/**
 * Botón de smash táctil: mantenerlo pulsado carga el smash de su paleta.
 * @param {string} id
 * @param {Paddle} paddle
 */
function bindSmashButton(id, paddle) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        paddle.smashTouchHeld = true;
        btn.classList.add('is-held');
        // Así un dedo que se desliza un poco fuera del botón no lo suelta
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* sin captura también funciona */ }
    });
    const release = () => {
        paddle.smashTouchHeld = false;
        btn.classList.remove('is-held');
    };
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(type, release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

function updatePaddleFromTouch(target, canvasY, canvasX) {
    const paddle = target === 'p1' ? p1 : p2;
    paddle.touchY = clampPaddleY(canvasY - paddle.height / 2, paddle);
    if (canvasX !== undefined) {
        // Arena rotada (El Creador): la paleta se controla en el eje X
        paddle.touchX = Math.max(0, Math.min(GAME_WIDTH - paddle.width, canvasX - paddle.width / 2));
    }
}

function releaseTouch(touch) {
    const target = activeTouches.get(touch.identifier);
    if (!target) return;
    activeTouches.delete(touch.identifier);

    if (target.endsWith('Smash')) {
        // Se suelta el smash si no queda otro dedo manteniéndolo
        if (![...activeTouches.values()].includes(target)) (target === 'p1Smash' ? p1 : p2).smashTouchHeld = false;
        return;
    }

    // Solo suelta la paleta si ningún OTRO dedo activo sigue controlándola
    // (relevante si, por accidente, dos dedos tocan el mismo lado).
    const stillHeld = [...activeTouches.values()].includes(target);
    if (!stillHeld) {
        const paddle = target === 'p1' ? p1 : p2;
        paddle.touchY = null;
        // Sin esto la paleta horizontal se queda pegada y el teclado
        // deja de responder hasta recargar la página.
        paddle.touchX = null;
    }
}

function handleTouchStart(e) {
    if (!state.isPlaying || state.isPaused) return;
    e.preventDefault();
    for (const touch of e.changedTouches) assignTouch(touch);
}

function handleTouchMove(e) {
    if (!state.isPlaying || state.isPaused) return;
    e.preventDefault();
    for (const touch of e.changedTouches) {
        const target = activeTouches.get(touch.identifier);
        if (target !== 'p1' && target !== 'p2') continue;   // sin dedo, o el del smash
        updatePaddleFromTouch(target, touchToCanvasY(touch.clientY), touchToCanvasX(touch.clientX));
    }
}

function handleTouchEnd(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) releaseTouch(touch);
}

function hideTouchHint(target) {
    const hint = document.getElementById(target === 'p1' ? 'touch-hint-left' : 'touch-hint-right');
    if (hint) hint.classList.add('touch-hint--gone');
}

/** Vuelve a mostrar los avisos de "toca y arrastra" (nueva partida). */
function resetTouchHints() {
    document.querySelectorAll('.touch-hint').forEach(hint => hint.classList.remove('touch-hint--gone'));
}

/** Botón de pausa en pantalla: imprescindible en móvil (no hay tecla ESC) */
function setupMobilePauseButton() {
    const btn = document.getElementById('mobile-pause-btn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        togglePause();
    });
    // También sirve como acceso rápido de pausa en escritorio (mouse/trackpad).
    btn.classList.remove('hidden');
}

function setupOrientationHint() {
    const closeBtn = document.getElementById('orientation-hint-close');
    const hint = document.getElementById('orientation-hint');
    if (!closeBtn || !hint) return;
    closeBtn.addEventListener('click', () => hint.classList.add('orientation-hint--dismissed'));
}

// ------------------------------------------------------------------
//  Ratón (opcional: settings.mouseControl)
// ------------------------------------------------------------------

let mouseActive = false; // true mientras el mouse está sobre el canvas

function handleMouseMove(e) {
    if (!settings.mouseControl || !state.isPlaying || state.isPaused || !mouseActive) return;

    // La arena rotada (El Creador) mueve la paleta en X: si solo se
    // escribiera touchY, el mouse no controlaría nada en ese combate.
    if (bossIsRotatedArena()) {
        const canvasX = touchToCanvasX(e.clientX);
        p1.touchX = Math.max(0, Math.min(GAME_WIDTH - p1.width, canvasX - p1.width / 2));
        p1.touchY = null;
    } else {
        const canvasY = touchToCanvasY(e.clientY);
        p1.touchY = Math.max(0, Math.min(GAME_HEIGHT - p1.height, canvasY - p1.height / 2));
        p1.touchX = null;
    }
}

// Al desactivar el mouse control, soltar la paleta en ambos ejes: dejar
// touchX puesto la mantendría pegada e ignoraría el teclado.
function clearMouseControl() {
    if (mouseActive) {
        p1.touchY = null;
        p1.touchX = null;
    }
}

/** Registra el ratón y el táctil sobre el canvas, los botones de pausa y de smash y el aviso de orientación. */
function initPointer() {
    canvas.addEventListener('mouseenter', () => { mouseActive = true; });
    canvas.addEventListener('mouseleave', () => {
        mouseActive = false;
    });
    canvas.addEventListener('mousemove', handleMouseMove);

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    setupMobilePauseButton();
    setupOrientationHint();
    bindSmashButton('smash-btn-p1', p1);
    bindSmashButton('smash-btn-p2', p2);

    if (isTouchDevice()) {
        document.body.classList.add('touch-device');
    }
}

