/**
 * ui/screens.js
 * ------------------------------------------------------------------
 * Navegación entre pantallas y arranque de la interfaz.
 *
 * Cada menú es un <div class="screen"> en index.html y solo uno tiene
 * .active-screen. La partida no es una pantalla: startGame() las oculta
 * todas y muestra #game-container; pausa y fin de partida son pantallas
 * superpuestas con más z-index.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Muestra una pantalla (un div.screen) y oculta las demás. Algunas
 * pantallas hacen algo al entrar: el menú principal oculta el juego y
 * pone su música, y la tienda y la campaña se redibujan.
 */
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active-screen'));
    const requested = document.getElementById(screenId);
    if (requested) requested.classList.add('active-screen');

    if (screenId === 'main-menu') {
        document.getElementById('game-container').classList.add('hidden');
        document.getElementById('game-container').classList.remove('flex');

        // Música del menú principal
        playMenuMusic();
    } else if (screenId === 'shop-menu') {
        showShopScreen();
    } else if (screenId === 'campaign-menu') {
        renderCampaignMap();
    }
    soundEffects.uiClick();
}

/** Botón SALIR: pide confirmación. */
function closeGame() {
    showScreen('exit-menu');
}

/** Confirmación de salida: no se puede cerrar la pestaña, así que se vacía la página. */
function forceClose() {
    stopAllMusic();
    document.body.innerHTML = `<div class="flex w-full h-full items-center justify-center text-center text-lg md:text-2xl px-8" style="color: var(--primary)">EL JUEGO SE HA CERRADO.<br>PUEDES CERRAR ESTA PESTAÑA.</div>`;
}

/** Construye la interfaz inicial y muestra el menú principal. */
function initUI() {
    buildThemeSwatches(document.getElementById('theme-swatches'));
    applyTheme(settings.theme);
    populateSettingsUI();

    updateProgressionDisplay();
    updateCoinDisplay();

    showScreen('main-menu');

    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-binding-action]')).forEach(btn => {
        btn.addEventListener('click', () => startListeningFor(btn.dataset.bindingAction));
    });
}
