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
 * refresca sus tiles, la selección de modo refresca sus tarjetas y
 * precarga la música de partida, y la tienda, la campaña y Progreso se
 * redibujan.
 * Cada pantalla pone su música (screenMusic).
 */
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active-screen'));
    const requested = document.getElementById(screenId);
    if (requested) requested.classList.add('active-screen');
    syncResultClass();

    if (screenId === 'main-menu') {
        document.getElementById('game-container').classList.add('hidden');
        updateMenuTiles();
    } else if (screenId === 'mode-select-menu') {
        updateModeCards();
        musicPreload('partida_synthwave');
    } else if (screenId === 'shop-menu') {
        showShopScreen();
    } else if (screenId === 'campaign-menu') {
        renderCampaignMap();
    } else if (screenId === 'progress-menu') {
        renderProgressScreen();
    }
    // Lo que se escuchaba en la Rockola no sale de la tienda
    if (screenId !== 'shop-menu') endShopListen();
    const track = screenMusic(screenId);
    if (track) musicPlay(track);
    soundEffects.uiClick();
}

/** Música de cada pantalla. Las que no salen aquí no cambian la que suena. */
const SCREEN_MUSIC = {
    'main-menu':         'musica_menu',
    'mode-select-menu':  'musica_menu',
    'campaign-menu':     'musica_menu',
    'controls-menu':     'musica_menu',
    'howto-menu':        'musica_menu',
    'settings-menu':     'musica_menu',
    'exit-menu':         'musica_menu',
    'shop-menu':         'musica_tienda',
    'progress-menu':     'musica_tienda',
    'achievements-menu': 'musica_tienda',
    'stats-menu':        'musica_tienda'
};

/**
 * La pista de una pantalla, o null si al entrar no cambia la música (la
 * pausa, el fin de partida, el VS o el falso final).
 * @param {string} screenId
 * @returns {string|null}
 */
function screenMusic(screenId) {
    return SCREEN_MUSIC[screenId] || null;
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
