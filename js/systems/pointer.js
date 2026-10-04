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
 * P2; en el resto, cualquier toque mueve a P1. Incluye el botón de
 * pausa en pantalla (imprescindible en móvil, sin tecla ESC) y el aviso
 * de girar el dispositivo.
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

// BUG conocido (conservado, ver docs/bugs-conocidos.md): usa paddleHeight fijo, no la altura
// actual de la paleta (los power-ups de tamaño la cambian).
function clampPaddleY(y) {
    return Math.max(0, Math.min(GAME_HEIGHT - paddleHeight, y));
}

function assignTouch(touch) {
    const canvasX = touchToCanvasX(touch.clientX);
    const canvasY = touchToCanvasY(touch.clientY);

    // En modo Local, la mitad izquierda de la pantalla mueve a P1 y la
    // derecha a P2. En modo VS CPU, cualquier toque mueve a P1.
    const target = (state.mode === 'local' && canvasX >= GAME_WIDTH / 2) ? 'p2' : 'p1';

    activeTouches.set(touch.identifier, target);
    updatePaddleFromTouch(target, canvasY, canvasX);
    hideTouchHint(target);
}

function updatePaddleFromTouch(target, canvasY, canvasX) {
    const paddle = target === 'p1' ? p1 : p2;
    paddle.touchY = clampPaddleY(canvasY - paddleHeight / 2);
    if (canvasX !== undefined) {
        // Arena rotada (El Creador): la paleta se controla en el eje X
        paddle.touchX = Math.max(0, Math.min(GAME_WIDTH - paddle.width, canvasX - paddle.width / 2));
    }
}

function releaseTouch(touch) {
    const target = activeTouches.get(touch.identifier);
    if (!target) return;
    activeTouches.delete(touch.identifier);

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
        if (!target) continue;
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

/** Registra el ratón y el táctil sobre el canvas, el botón de pausa y el aviso de orientación. */
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

    if (isTouchDevice()) {
        document.body.classList.add('touch-device');
    }
}

