/**
 * main.js
 * ------------------------------------------------------------------
 * Punto de entrada (el único <script type="module"> de index.html).
 * Ningún otro módulo registra listeners ni toca el DOM al evaluarse:
 * todo arranca desde aquí, en este orden.
 *
 * El orden importa. Varios listeners comparten objetivo y tipo de
 * evento (p. ej. keydown en window: primero el desbloqueo del audio,
 * después el teclado de juego), y se ejecutan en el orden en que se
 * registran.
 * ------------------------------------------------------------------
 */

import { initAudio } from './systems/audio.js';
import { initInput } from './systems/input.js';
import { initPointer } from './systems/pointer.js';
import { initCanvas } from './game/canvas.js';
import { initActions } from './actions.js';
import { initCarouselControls } from './campaign.js';
import { initUI } from './ui.js';

initAudio();             // desbloqueo del audio con la primera interacción
initInput();             // teclado de juego y reasignación de teclas
initCanvas();            // redimensionado del canvas con la ventana
initPointer();           // ratón y dedo sobre el canvas, botón de pausa
initCarouselControls();  // teclado y deslizamiento del selector de jefes
initActions();           // botones, sliders e interruptores del HTML (data-action…)
initUI();                // interfaz inicial y menú principal
