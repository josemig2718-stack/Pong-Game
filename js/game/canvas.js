/**
 * game/canvas.js
 * ------------------------------------------------------------------
 * El <canvas> del juego y su escalado.
 *
 * El canvas siempre mide GAME_WIDTH × GAME_HEIGHT en píxeles lógicos;
 * resizeCanvas() solo cambia su tamaño CSS para que quepa en la ventana
 * manteniendo 4:3. Quien convierta coordenadas de pantalla (ratón, dedo)
 * debe deshacer esa escala (ver systems/pointer.js).
 * ------------------------------------------------------------------
 */

import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants.js';

export const canvas = document.getElementById('pongCanvas');
export const ctx = canvas.getContext('2d');

/** Ajusta el tamaño CSS del canvas al espacio libre, manteniendo 4:3. */
export function resizeCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');
    const container = document.getElementById('game-container');
    const targetRatio = GAME_WIDTH / GAME_HEIGHT;

    // Calcular el espacio disponible dinámicamente restando los hermanos visibles (ej. mode-badge, orientation-hint)
    let siblingHeight = 0;
    let activeSiblings = 0;
    if (container) {
        Array.from(container.children).forEach(child => {
            if (child.id !== 'canvas-wrapper' && window.getComputedStyle(child).display !== 'none') {
                siblingHeight += child.offsetHeight;
                activeSiblings++;
            }
        });
    }

    // El container tiene p-4 (32px padding vertical/horizontal) y gap-3 (12px por hueco)
    const totalGaps = activeSiblings > 0 ? (activeSiblings) * 12 : 0;
    const verticalPadding = 32;
    const horizontalPadding = 32;

    // 15px de margen extra de seguridad para evitar cualquier scrollbar accidental
    const maxW = window.innerWidth - horizontalPadding - 15;
    const maxH = window.innerHeight - siblingHeight - totalGaps - verticalPadding - 15;

    const viewportRatio = maxW / maxH;

    let drawWidth, drawHeight;
    if (viewportRatio > targetRatio) {
        drawHeight = maxH;
        drawWidth = drawHeight * targetRatio;
    } else {
        drawWidth = maxW;
        drawHeight = drawWidth / targetRatio;
    }

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    canvas.style.width = `${drawWidth}px`;
    canvas.style.height = `${drawHeight}px`;

    wrapper.style.maxWidth = `${drawWidth}px`;
    wrapper.style.maxHeight = `${drawHeight}px`;
}

/** Reajusta el canvas cuando cambia el tamaño de la ventana. */
export function initCanvas() {
    window.addEventListener('resize', resizeCanvas);
}
