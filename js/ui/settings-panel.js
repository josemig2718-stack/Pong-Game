/**
 * ui/settings-panel.js
 * ------------------------------------------------------------------
 * Pantalla de configuración: cada control escribe en `settings`, lo
 * guarda y aplica el efecto inmediato que tenga (volumen, CRT, ratón…).
 * Los controles llegan aquí desde ui/actions.js.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * @param {string} val 1 Fácil, 2 Normal, 3 Imposible
 */
function updateDifficulty(val) {
    settings.difficulty = parseInt(val, 10);
    saveSettings();
    markDifficultyLabel();
}

/** Resalta bajo el slider la etiqueta de la dificultad elegida. */
function markDifficultyLabel() {
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-difficulty-label]')).forEach(label => {
        label.classList.toggle('is-active', Number(label.dataset.difficultyLabel) === settings.difficulty);
    });
}

/**
 * Slider de volumen de efectos: aplica, muestra el % y suena una muestra.
 * @param {string} val de 0 a 100
 */
function updateVolume(val) {
    setMasterVolume(parseInt(val, 10));
    document.getElementById('vol-display').textContent = `${val}%`;
    getAudioContext();
    if (Number(val) > 0) sfxVoice({ type: 'square', freq: 400, decay: 0.05 });
}

/**
 * @param {string} val de 0 a 100
 */
function updateMusicVolume(val) {
    setMusicVolume(parseInt(val, 10));
    document.getElementById('music-vol-display').textContent = `${val}%`;
}

/**
 * Activa o desactiva la música; al activarla suena la que toca ahora.
 * @param {boolean} enabled
 */
function toggleMusic(enabled) {
    setMusicEnabled(enabled);
    syncAudioToggles();
    if (enabled) {
        // Reanudar la música que corresponda según el estado actual
        if (state.isPlaying) {
            playGameplayMusic(state.mode);
        } else {
            playMenuMusic();
        }
    }
}

/**
 * Puntos para ganar; resalta la opción elegida.
 * @param {number|string} val
 */
function updateWinningScore(val) {
    settings.winningScore = parseInt(String(val), 10);
    saveSettings();
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-winning-score]')).forEach(btn => {
        btn.classList.toggle('option-pill--active', parseInt(btn.dataset.winningScore, 10) === settings.winningScore);
    });
}

/**
 * Velocidad de la bola (1 a 3); resalta la opción elegida.
 * @param {number|string} val
 */
function updateBallSpeed(val) {
    settings.ballSpeed = parseInt(String(val), 10);
    saveSettings();
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-ball-speed]')).forEach(btn => {
        btn.classList.toggle('option-pill--active', parseInt(btn.dataset.ballSpeed, 10) === settings.ballSpeed);
    });
}

/**
 * @param {boolean} enabled
 */
function toggleSfx(enabled) {
    setSfxEnabled(enabled);
    syncAudioToggles();
    if (enabled) sfxVoice({ type: 'triangle', freq: 500, decay: 0.05 });
}

/**
 * Música y efectos tienen interruptor en Configuración y en la pausa:
 * los dos llaman a las mismas funciones y aquí se igualan.
 */
function syncAudioToggles() {
    ['music-toggle', 'pause-music-toggle'].forEach(id => {
        const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
        if (el) el.checked = settings.musicEnabled;
    });
    ['sfx-toggle', 'pause-sfx-toggle'].forEach(id => {
        const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
        if (el) el.checked = settings.sfxEnabled;
    });
}

/**
 * @param {boolean} enabled
 */
function toggleCrtEffect(enabled) {
    settings.crtEffect = enabled;
    saveSettings();
    document.body.classList.toggle('crt-effect', enabled);
}

/**
 * Al desactivarla corta también la vibración en curso.
 * @param {boolean} enabled
 */
function toggleScreenShake(enabled) {
    settings.screenShake = enabled;
    saveSettings();
    if (!enabled) state.shakeTimeMs = 0;
}

/**
 * Al desactivarlo suelta la paleta, para que vuelva a mandar el teclado.
 * @param {boolean} enabled
 */
function toggleMouseControl(enabled) {
    settings.mouseControl = enabled;
    saveSettings();
    if (!enabled) {
        clearMouseControl();
    }
}

/**
 * @param {boolean} enabled
 */
function togglePowerups(enabled) {
    settings.powerupsEnabled = enabled;
    saveSettings();
}

/** Botón "RESTABLECER TODO": vuelve a la configuración por defecto. */
function resetAllSettings() {
    Object.assign(settings, DEFAULT_SETTINGS, { bindings: { ...DEFAULT_BINDINGS } });
    saveSettings();
    setMasterVolume(settings.volume);   // el volumen de efectos vive aparte, en systems/audio.js
    populateSettingsUI();
    applyTheme(settings.theme);
    // La música del menú sigue donde iba; si queda apagada, se pausa
    if (settings.musicEnabled) playMenuMusic();
    else pauseAllMusic();
}

/** Sincroniza todos los controles del menú de configuración con `settings` al iniciar */
function populateSettingsUI() {
    /** @param {string} id */
    const input = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
    input('difficulty-slider').value      = String(settings.difficulty);
    markDifficultyLabel();
    input('volume-slider').value          = String(settings.volume);
    document.getElementById('vol-display').textContent      = `${settings.volume}%`;
    syncAudioToggles();
    input('crt-toggle').checked           = settings.crtEffect;
    input('shake-toggle').checked         = settings.screenShake;
    input('music-volume-slider').value    = String(settings.musicVolume);
    document.getElementById('music-vol-display').textContent = `${settings.musicVolume}%`;
    input('mouse-toggle').checked         = settings.mouseControl;
    if (input('powerups-toggle')) {
        input('powerups-toggle').checked = settings.powerupsEnabled;
    }
    document.body.classList.toggle('crt-effect', settings.crtEffect);

    updateWinningScore(settings.winningScore);
    updateBallSpeed(settings.ballSpeed);
    refreshBindingButtons();
}
