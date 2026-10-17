/**
 * main.js
 * ------------------------------------------------------------------
 * Punto de entrada: el último script de index.html. Ningún otro archivo
 * registra listeners ni toca el DOM al cargarse: todo arranca desde
 * aquí, en este orden.
 *
 * El orden importa. Varios listeners comparten objetivo y tipo de
 * evento (p. ej. keydown en window: primero el desbloqueo del audio,
 * después el teclado de juego), y se ejecutan en el orden en que se
 * registran.
 * ------------------------------------------------------------------
 */

'use strict';

initAudio();             // desbloqueo del audio con la primera interacción
initInput();             // teclado de juego y reasignación de teclas
initCanvas();            // redimensionado del canvas con la ventana
initPointer();           // ratón y dedo sobre el canvas, botón de pausa
initCarouselControls();  // teclado y deslizamiento del selector de jefes
initActions();           // botones, sliders e interruptores del HTML (data-action…)
initUI();                // interfaz inicial y menú principal
initNews();              // Novedades encima del menú, si esta versión es nueva
