/**
 * campaign/finale.js
 * ------------------------------------------------------------------
 * Los desenlaces de la campaña.
 *
 * Vencer a Yisus no lleva a la pantalla de fin: tras su diálogo `lose`
 * empiezan el falso final y la introducción del Creador (películas de
 * data/cutscenes/final.js) y luego su VS. Vencer al Creador dispara el
 * final verdadero. checkWin() los reconoce con su `narrativeEnding` y se
 * salta la pantalla normal.
 *
 * El giro sostiene la historia: nada del Creador debe filtrarse antes.
 * ------------------------------------------------------------------
 */

'use strict';

/** Overlay negro a pantalla completa. amount: 0 (transparente) a 1 (negro). */
function setFadeOverlay(amount, ms) {
    const el = document.getElementById('fade-overlay');
    if (!el) return;
    el.style.transitionDuration = `${ms || 800}ms`;
    if (amount > 0) el.classList.remove('hidden');
    // Forzar reflow para que la transición arranque desde el estado actual
    void el.offsetWidth;
    el.style.opacity = String(amount);
    if (amount === 0) setTimeout(() => el.classList.add('hidden'), ms || 800);
}

/** Texto grande de la secuencia (HTML propio, nunca datos del jugador). */
function showFinaleText(html, className) {
    const el = document.getElementById('finale-text');
    if (!el) return;
    el.className = 'finale-text ' + (className || '');
    el.innerHTML = html;
    el.classList.remove('hidden');
}

function hideFinaleText() {
    const el = document.getElementById('finale-text');
    if (el) el.classList.add('hidden');
}

/** Encadena los pasos de la secuencia sin anidar setTimeout ilegibles. */
let finaleTimers = [];

function finaleStep(ms, fn) {
    finaleTimers.push(setTimeout(fn, ms));
}

/** Cancela los pasos pendientes de cualquier secuencia final. */
function clearFinaleTimers() {
    finaleTimers.forEach(clearTimeout);
    finaleTimers = [];
}

/**
 * Falso final tras vencer a Yisus (al cerrarse su diálogo `lose`):
 *   campaignProgress = 6 (se guarda ya: si se cierra el juego aquí, el
 *   sótano queda abierto) → FALSO_FINAL → CREADOR_INTRO → VS del Creador.
 * Las dos películas no se pueden saltar la primera vez (noSkipFirstTime);
 * al repetir a Yisus ya vencido sí, y saltar el falso final lleva directo
 * a la introducción. La ruptura de los créditos frena y apaga su música.
 */
function runFinaleSequence() {
    stopDialogue();
    clearFinaleTimers();
    state.isPlaying = false;
    document.getElementById('canvas-wrapper').classList.remove('is-timestop');

    playerProgression.campaignProgress = Math.max(playerProgression.campaignProgress, CAMPAIGN_CREATOR);
    saveProgression();

    playCutscene(FALSO_FINAL, {
        onEnd: () => playCutscene(CREADOR_INTRO, {
            onEnd: () => prepareCampaignMatch(CAMPAIGN_CREATOR, { slam: true })
        })
    });
}

/** Restaura la velocidad normal (al salir de la secuencia). */
function resetMusicRate() {
    musicSetRate(1);
}

/** Fanfarria de victoria sintetizada: no hace falta un MP3 nuevo. */
function playVictoryJingle() {
    sfxArpeggio([523, 659, 784, 1046], 0.16, { type: 'triangle', decay: 0.22 });
}

/** Final verdadero, tras vencer al Creador. */
function runTrueEndingSequence() {
    stopDialogue();
    clearFinaleTimers();
    state.isPlaying = false;
    stopAllMusic();
    resetMusicRate();

    const screen = document.getElementById('finale-screen');
    if (screen) screen.classList.remove('glitching');
    showScreen('finale-screen');
    setFadeOverlay(1, 300);

    finaleStep(1200, () => {
        setFadeOverlay(0, 2500);
        showFinaleText(
            '<h2>LA CIUDAD RESPIRA</h2>' +
            '<p>Las luces vuelven una a una. Alguien, en algún balcón, aplaude.</p>' +
            '<p>Nadie sabrá nunca tu nombre.</p>' +
            '<p class="finale-small">Tú tampoco lo necesitas.</p>',
            'finale-true'
        );
        playVictoryJingle();
    });

    finaleStep(7000, () => {
        const btn = document.getElementById('finale-exit-btn');
        if (btn) btn.classList.remove('hidden');
    });
}

/** Botón "FIN": vuelve al menú de campaña. */
function closeFinale() {
    soundEffects.uiClick();
    hideFinaleText();
    setFadeOverlay(0, 400);
    const btn = document.getElementById('finale-exit-btn');
    if (btn) btn.classList.add('hidden');
    resetMusicRate();
    showScreen('campaign-menu');
}
