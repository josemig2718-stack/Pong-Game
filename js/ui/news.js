/**
 * ui/news.js
 * ------------------------------------------------------------------
 * Novedades de la versión (contenido en data/news.js).
 *
 * Se abre sola al cargar mientras settings.seenNewsVersion no sea
 * NEWS_VERSION, y siempre con el botón del documento del menú principal
 * (#news-btn, que lleva un punto mientras no se haya visto). No es una
 * pantalla más: se pone encima del menú principal, que sigue activo
 * debajo (inert). En móvil la tapa entera; desde 900px es un diálogo
 * sobre el menú oscurecido.
 *
 * El aviso de reinicio solo sale la primera vez, y solo si la fase 4
 * reinició un progreso anterior (progressWasReset).
 * ------------------------------------------------------------------
 */

'use strict';

/** El aviso de reinicio sigue pendiente hasta que se cierre la primera vez. */
let newsResetPending = false;

/** Rellena la lista de novedades (una vez) y el aviso de reinicio. */
function renderNews() {
    const list = document.getElementById('news-list');
    if (!list.children.length) {
        list.replaceChildren(...NEWS_ITEMS.map((item) => {
            const li = document.createElement('li');
            li.className = 'news-item';
            li.style.setProperty('--c', item.color);
            li.innerHTML = `<span class="news-item__icon"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg></span>`
                + '<span class="news-item__text"><b></b><span></span></span>';
            li.querySelector('b').textContent = item.title;
            li.querySelector('.news-item__text span').textContent = item.text;
            return li;
        }));
        // La primera frase del aviso, en negrita
        const cut = NEWS_RESET_NOTE.indexOf('. ') + 1;
        const bold = document.createElement('b');
        bold.textContent = NEWS_RESET_NOTE.slice(0, cut);
        document.getElementById('news-reset-text').replaceChildren(bold, NEWS_RESET_NOTE.slice(cut));
    }
    document.getElementById('news-reset').classList.toggle('hidden', !newsResetPending);
}

/** ¿Están las Novedades a la vista? */
function newsIsOpen() {
    return document.getElementById('news-screen').classList.contains('active-screen');
}

/** Muestra las Novedades encima del menú principal. */
function openNews() {
    renderNews();
    const menu = document.getElementById('main-menu');
    if (!menu.classList.contains('active-screen')) showScreen('main-menu');
    menu.inert = true;
    const screen = document.getElementById('news-screen');
    screen.classList.add('active-screen');
    screen.scrollTop = 0;
}

/** Quita las Novedades sin darlas por vistas (al ir a «Cómo jugar»). */
function hideNews() {
    document.getElementById('news-screen').classList.remove('active-screen');
    document.getElementById('main-menu').inert = false;
}

/** ¡A JUGAR!, cerrar o ESC: vuelve al menú y apunta la versión como vista. */
function closeNews() {
    hideNews();
    newsResetPending = false;
    if (settings.seenNewsVersion !== NEWS_VERSION) {
        settings.seenNewsVersion = NEWS_VERSION;
        saveSettings();
    }
    updateNewsButton();
    soundEffects.uiClick();
}

/** CÓMO JUGAR: abre esa pantalla; su VOLVER regresa a las Novedades. */
function newsToHowto() {
    hideNews();
    openHowto('news-screen');
}

/** El punto de aviso del botón, mientras esta versión no se haya visto. */
function updateNewsButton() {
    document.getElementById('news-btn').classList.toggle('is-new', settings.seenNewsVersion !== NEWS_VERSION);
}

/** Al cargar (después de initUI): abre las Novedades si esta versión es nueva. */
function initNews() {
    updateNewsButton();
    if (settings.seenNewsVersion === NEWS_VERSION) return;
    newsResetPending = progressWasReset;
    openNews();
}
