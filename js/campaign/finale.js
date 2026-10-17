/**
 * campaign/finale.js
 * ------------------------------------------------------------------
 * Los desenlaces de la campaña.
 *
 * Vencer a Yisus no lleva a la pantalla de fin: dispara el falso final
 * (victoria falsa → la música se deforma → apagón CRT → el Creador se
 * revela → VS). Vencer al Creador dispara el final verdadero. checkWin()
 * los reconoce con su `narrativeEnding` y se salta la pantalla normal.
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

/** Apagado / encendido del tubo. */
function crtShutdown() {
    const el = document.getElementById('crt-collapse');
    if (!el) return;
    el.className = '';
    void el.offsetWidth;          // reinicia la animación si se repite
    el.classList.add('shutdown');
    playCrtShutdownSound();
}

/** El punto del tubo apagado, encendido o no. */
function crtDot(on) {
    const el = document.getElementById('crt-collapse');
    if (!el) return;
    el.classList.toggle('dot', !!on);
}

/** Reencendido del monitor. */
function crtTurnOn() {
    const el = document.getElementById('crt-collapse');
    if (!el) return;
    el.classList.remove('dot', 'shutdown');
    void el.offsetWidth;
    el.classList.add('turn-on');
    sfxVoice({ type: 'square', freq: 90, decay: 0.05 });
    sfxVoice({ type: 'square', freq: 1400, decay: 0.03, when: 0.06 });
    setTimeout(() => { el.className = 'hidden'; }, 900);
}

/** Zumbido descendente de un tubo apagándose: 450 → 100 Hz y un golpe grave. */
function playCrtShutdownSound() {
    const PASO = 0.055;
    let i = 1;
    for (let f = 450; f > 60; f -= 70, i++) {
        sfxVoice({ type: 'sine', freq: f, decay: 0.09, when: i * PASO });
    }
    sfxVoice({ type: 'sine', freq: 45, decay: 0.5, when: i * PASO });
}

/**
 * Falso final tras vencer a Yisus.
 * victoria falsa → la señal se corrompe → apagón CRT → silencio →
 * reencendido en terminal → el ojo → VS El Creador.
 */
function runFinaleSequence() {
    stopDialogue();
    clearFinaleTimers();
    state.isPlaying = false;

    playerProgression.campaignProgress = CAMPAIGN_CREATOR;
    saveProgression();

    const screen = document.getElementById('finale-screen');
    const eye = document.getElementById('finale-eye');
    if (eye) eye.classList.add('hidden');

    // --- 1. Victoria falsa: cuanto más sincera, más duele lo que viene ---
    showScreen('finale-screen');
    if (screen) screen.classList.remove('glitching');
    showFinaleText(
        '<h2>HAS RECUPERADO<br>TU CIUDAD</h2>' +
        '<p>Los cinco Hachepes han caído.</p>' +
        '<p>Nadie sabe tu nombre, pero hoy todos te lo deben.</p>',
        'finale-victory'
    );
    triggerGoalConfetti(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    soundEffects.win();
    playVictoryJingle();

    // --- 2. La señal se corrompe ---
    finaleStep(3600, () => {
        warpMusic();
        if (screen) screen.classList.add('glitching');
        soundEffects.glitch();
    });

    // --- 3. La voz que no debería estar ahí ---
    finaleStep(4600, () => {
        showFinaleText(
            '<p class="finale-voice">"Buen trabajo, amigo.<br>' +
            'Los derrotaste a todos, eres un héroe y salvaste tu ciudad.<br>' +
            'Eres el protagonista del día de hoy...<br><br>' +
            '...o eso parece."</p>',
            'finale-crack'
        );
    });

    // --- 4. Apagado del monitor ---
    finaleStep(11000, () => {
        stopAllMusic();
        hideFinaleText();
        if (screen) screen.classList.remove('glitching');
        crtShutdown();
    });

    // --- 5. Negro y silencio: el punto del tubo aún late ---
    finaleStep(12100, () => crtDot(true));

    // --- 6. Reencendido: ya no es el juego, es una consola ---
    finaleStep(15000, () => {
        crtDot(false);
        crtTurnOn();
        showFinaleText('', 'finale-reveal finale-caret');
    });

    finaleStep(15700, () => {
        typeRevealText(
            'Pero todo esto no es real. Solo es un videojuego.\n' +
            'Te veo a través de la pantalla. Sé que estás ahí.\n' +
            'Sé cómo eres.\n\n' +
            'Después de todo...\n\n' +
            'Yo... soy El Creador.'
        );
    });

    // --- 7. El ojo se abre y te mira ---
    finaleStep(24000, () => {
        if (!eye) return;
        eye.classList.remove('hidden');
        eye.classList.add('opening');
        soundEffects.bossVanish();
    });

    // --- 8. Golpe a la pantalla VS ---
    finaleStep(27000, () => {
        if (eye) { eye.classList.add('hidden'); eye.classList.remove('opening'); }
        hideFinaleText();
        soundEffects.glitch();
        prepareCampaignMatch(CAMPAIGN_CREATOR, { slam: true });
    });
}

/** Escribe el texto de la revelación con ruido que se asienta. */
function typeRevealText(text) {
    const el = document.getElementById('finale-text');
    if (!el) return;
    const GLITCH = '#@%&$?/\\|<>*';
    let i = 0;
    clearTypewriter();
    startTypewriter(() => {
        if (i > text.length) {
            clearTypewriter();
            el.textContent = text;
            return;
        }
        const asentado = text.slice(0, i);
        const ruido = text.slice(i, i + 3).replace(/[^\n]/g, () => GLITCH[Math.floor(Math.random() * GLITCH.length)]);
        el.textContent = asentado + ruido;
        if (i % 5 === 0 && soundEffects.dialogueBlip) soundEffects.dialogueBlip();
        if (i % 23 === 0 && soundEffects.glitch) soundEffects.glitch();
        i++;
    }, 45);
}

/** Deforma la música en curso bajando su velocidad hasta desafinarla. */
function warpMusic() {
    const tracks = [menuMusic, gameplayMusic, hachepeMusic];
    let rate = 1;
    const warp = setInterval(() => {
        rate -= 0.06;
        if (rate <= 0.35) {
            clearInterval(warp);
            rate = 0.35;
        }
        tracks.forEach(t => {
            try { if (!t.paused) t.playbackRate = rate; } catch (err) { /* navegador quisquilloso */ }
        });
    }, 220);
}

/** Restaura la velocidad normal (al salir de la secuencia). */
function resetMusicRate() {
    [menuMusic, gameplayMusic, hachepeMusic].forEach(t => {
        try { t.playbackRate = 1; } catch (err) { /* ignorar */ }
    });
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
