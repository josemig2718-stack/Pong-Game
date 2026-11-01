/**
 * game/canvas.js
 * ------------------------------------------------------------------
 * El <canvas> del juego y su escalado.
 *
 * El canvas siempre mide GAME_WIDTH × GAME_HEIGHT en píxeles lógicos;
 * resizeCanvas() solo cambia su tamaño CSS para que quepa en su celda
 * del HUD manteniendo 4:3. Quien convierta coordenadas de pantalla
 * (ratón, dedo) debe deshacer esa escala (ver systems/pointer.js).
 * ------------------------------------------------------------------
 */

'use strict';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('pongCanvas'));
const ctx = canvas.getContext('2d');

/**
 * Disposición del HUD según la ventana: "stack" en vertical, "sides" en
 * horizontal con poca altura (el marcador ocupa los márgenes laterales)
 * y "top" en el resto (escritorio y tablet).
 * @returns {'top'|'sides'|'stack'}
 */
function hudLayoutFor(w, h) {
    if (h > w) return 'stack';
    if (w / h > 1.6 && h < 520) return 'sides';
    return 'top';
}

/**
 * Elige la disposición y encaja el campo (4:3) en el tamaño real de su
 * celda. Con data-measuring la celda ocupa todo el sitio libre; después
 * las pistas pasan a medir exactamente el campo (--field-w / --field-h).
 */
function resizeCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');
    const container = document.getElementById('game-container');
    container.dataset.layout = hudLayoutFor(window.innerWidth, window.innerHeight);
    bossSidePlace();

    container.setAttribute('data-measuring', '');
    container.style.removeProperty('--field-w');
    container.style.removeProperty('--field-h');
    wrapper.style.width = '';
    wrapper.style.height = '';
    const cellW = wrapper.clientWidth;
    const cellH = wrapper.clientHeight;
    container.removeAttribute('data-measuring');
    // Con la partida oculta (menús) no hay celda que medir: startGame()
    // vuelve a llamar al mostrarla.
    if (cellW <= 0 || cellH <= 0) return;

    const targetRatio = GAME_WIDTH / GAME_HEIGHT;
    let drawWidth, drawHeight;
    if (cellW / cellH > targetRatio) {
        drawHeight = cellH;
        drawWidth = drawHeight * targetRatio;
    } else {
        drawWidth = cellW;
        drawHeight = drawWidth / targetRatio;
    }

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    canvas.style.width = `${drawWidth}px`;
    canvas.style.height = `${drawHeight}px`;
    wrapper.style.width = `${drawWidth}px`;
    wrapper.style.height = `${drawHeight}px`;
    container.style.setProperty('--field-w', `${drawWidth}px`);
    container.style.setProperty('--field-h', `${drawHeight}px`);

    // El fondo se regenera (lienzos fuera de pantalla incluidos) al cambiar de tamaño
    if (state.isPlaying) refreshBackground();
}

/** Reajusta el canvas cuando cambia el tamaño de la ventana. */
function initCanvas() {
    window.addEventListener('resize', resizeCanvas);
}
