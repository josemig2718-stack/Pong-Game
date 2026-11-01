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
initTowerControls();     // teclado, deslizamiento y rueda de la Torre Hachepe
initCutscene();          // mantener el dedo para saltar y recolocar las escenas
initActions();           // botones, sliders e interruptores del HTML (data-action…)
refreshMissions();       // misiones del día y de la semana (antes de pintar nada)
initUI();                // interfaz inicial y menú principal
initNews();              // Novedades encima del menú, si esta versión es nueva
syncExclusives();        // exclusivos cuya condición ya se cumplía (con su aviso)
