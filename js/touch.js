/**
 * touch.js
 * ------------------------------------------------------------------
 * Detección automática de dispositivo táctil y controles por arrastre
 * ("tocar y deslizar el dedo") para jugar desde el celular, sin tocar
 * el comportamiento existente por teclado en PC. Ambos esquemas de
 * control conviven: si hay un dedo activo sobre una paleta, manda el
 * dedo (ver game.js -> update()); si no, manda el teclado.
 * ------------------------------------------------------------------
 */

/** Heurística estándar para saber si el dispositivo es "táctil primario" */
function isTouchDevice() {
    return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches
    );
}

const touchDevice = isTouchDevice();

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

function clampPaddleY(y) {
    return Math.max(0, Math.min(GAME_HEIGHT - paddleHeight, y));
}

function assignTouch(touch) {
    const canvasX = touchToCanvasX(touch.clientX);
    const canvasY = touchToCanvasY(touch.clientY);

    // En modo Local, la mitad izquierda de la pantalla mueve a P1 y la
    // derecha a P2. En modo VS CPU, cualquier toque mueve a P1.
    const target = (gameMode === 'local' && canvasX >= GAME_WIDTH / 2) ? 'p2' : 'p1';

    activeTouches.set(touch.identifier, target);
    updatePaddleFromTouch(target, canvasY);
    hideTouchHint(target);
}

function updatePaddleFromTouch(target, canvasY) {
    const paddle = target === 'p1' ? p1 : p2;
    paddle.touchY = clampPaddleY(canvasY - paddleHeight / 2);
}

function releaseTouch(touch) {
    const target = activeTouches.get(touch.identifier);
    if (!target) return;
    activeTouches.delete(touch.identifier);

    // Solo suelta la paleta si ningún OTRO dedo activo sigue controlándola
    // (relevante si, por accidente, dos dedos tocan el mismo lado).
    const stillHeld = [...activeTouches.values()].includes(target);
    if (!stillHeld) {
        (target === 'p1' ? p1 : p2).touchY = null;
    }
}

function handleTouchStart(e) {
    if (!isPlaying || isPaused) return;
    e.preventDefault();
    for (const touch of e.changedTouches) assignTouch(touch);
}

function handleTouchMove(e) {
    if (!isPlaying || isPaused) return;
    e.preventDefault();
    for (const touch of e.changedTouches) {
        const target = activeTouches.get(touch.identifier);
        if (!target) continue;
        updatePaddleFromTouch(target, touchToCanvasY(touch.clientY));
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

function setupTouchControls() {
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    setupMobilePauseButton();
    setupOrientationHint();

    if (touchDevice) {
        document.body.classList.add('touch-device');
    }
}

document.addEventListener('DOMContentLoaded', setupTouchControls);

