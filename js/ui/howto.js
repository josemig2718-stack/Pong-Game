/**
 * ui/howto.js
 * ------------------------------------------------------------------
 * Pantalla «Cómo jugar»: las mecánicas de golpe con su diagrama y las
 * teclas que el jugador tiene asignadas.
 *
 * Se abre desde el menú principal, la pausa o Novedades, y VOLVER
 * regresa allí. Desde la pausa no pasa por showScreen(): la partida
 * sigue parada debajo, su música sigue atenuada y PRACTICAR no se
 * ofrece (abandonaría la partida en curso).
 * ------------------------------------------------------------------
 */

'use strict';

/** @typedef {'main-menu' | 'pause-menu' | 'news-screen'} HowtoOrigin */

/** Pantalla desde la que se abrió «Cómo jugar». */
/** @type {HowtoOrigin} */
let howtoOrigin = 'main-menu';

/** Texto de la línea táctil del smash según el ajuste de smash táctil. */
const HOWTO_SMASH_TOUCH = {
    button: 'botón SMASH',
    finger: 'segundo dedo',
    auto:   'automático con la energía llena'
};

/** Rellena las teclas y la línea táctil con la configuración actual. */
function refreshHowtoKeys() {
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#howto-menu [data-key-label]')).forEach(kbd => {
        kbd.textContent = keyLabel(settings.bindings[kbd.dataset.keyLabel]);
    });
    document.getElementById('howto-smash-touch').textContent =
        HOWTO_SMASH_TOUCH[settings.smashTouch] || HOWTO_SMASH_TOUCH.button;
}

/** ¿Está «Cómo jugar» abierto encima de la pausa? */
function howtoOverPause() {
    return howtoOrigin === 'pause-menu' && document.getElementById('howto-menu').classList.contains('active-screen');
}

/**
 * Abre «Cómo jugar».
 * @param {HowtoOrigin} from
 */
function openHowto(from) {
    howtoOrigin = from;
    refreshHowtoKeys();
    const screen = document.getElementById('howto-menu');
    screen.dataset.from = from;
    screen.scrollTop = 0;
    if (from === 'pause-menu') {
        document.getElementById('pause-menu').classList.remove('active-screen');
        screen.classList.add('active-screen');
        syncResultClass();
        soundEffects.uiClick();
    } else {
        showScreen('howto-menu');
    }
}

/** VOLVER: regresa a la pantalla de origen. */
function closeHowto() {
    if (howtoOrigin === 'pause-menu') {
        document.getElementById('howto-menu').classList.remove('active-screen');
        document.getElementById('pause-menu').classList.add('active-screen');
        syncResultClass();
        soundEffects.uiClick();
    } else {
        showScreen(howtoOrigin);
    }
}
