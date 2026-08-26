/**
 * ui.js
 * ------------------------------------------------------------------
 * Navegación entre pantallas/menús y conexión de los controles de la
 * pantalla de Configuración y Controles con el estado en `settings`.
 * ------------------------------------------------------------------
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
    }
    soundEffects.uiClick();
}

function closeGame() {
    showScreen('exit-menu');
}

function forceClose() {
    stopAllMusic();
    document.body.innerHTML = `<div class="flex w-full h-full items-center justify-center text-center text-lg md:text-2xl px-8" style="color: var(--primary)">EL JUEGO SE HA CERRADO.<br>PUEDES CERRAR ESTA PESTAÑA.</div>`;
}

// --- Configuración: dificultad, volumen y demás opciones ---
function updateDifficulty(val) {
    settings.difficulty = parseInt(val, 10);
    saveSettings(settings);
}

function updateVolume(val) {
    setMasterVolume(parseInt(val, 10));
    document.getElementById('vol-display').textContent = `${val}%`;
    getAudioContext();
    if (val > 0) playTone(400, 'square', 0.05);
}

function updateMusicVolume(val) {
    setMusicVolume(parseInt(val, 10));
    document.getElementById('music-vol-display').textContent = `${val}%`;
}

function toggleMusic(enabled) {
    setMusicEnabled(enabled);
    if (enabled) {
        // Reanudar la música que corresponda según el estado actual
        if (isPlaying) {
            playGameplayMusic();
        } else {
            playMenuMusic();
        }
    }
}

function updateWinningScore(val) {
    settings.winningScore = parseInt(val, 10);
    saveSettings(settings);
    document.querySelectorAll('[data-winning-score]').forEach(btn => {
        btn.classList.toggle('option-pill--active', parseInt(btn.dataset.winningScore, 10) === settings.winningScore);
    });
}

function updateBallSpeed(val) {
    settings.ballSpeed = parseInt(val, 10);
    saveSettings(settings);
    document.querySelectorAll('[data-ball-speed]').forEach(btn => {
        btn.classList.toggle('option-pill--active', parseInt(btn.dataset.ballSpeed, 10) === settings.ballSpeed);
    });
}

function toggleSfx(enabled) {
    setSfxEnabled(enabled);
    if (enabled) playTone(500, 'triangle', 0.05);
}

function toggleCrtEffect(enabled) {
    settings.crtEffect = enabled;
    saveSettings(settings);
    document.body.classList.toggle('crt-effect', enabled);
}

function toggleScreenShake(enabled) {
    settings.screenShake = enabled;
    saveSettings(settings);
}

function toggleMouseControl(enabled) {
    settings.mouseControl = enabled;
    saveSettings(settings);
    if (!enabled && typeof clearMouseControl === 'function') {
        clearMouseControl();
    }
}

function resetAllSettings() {
    Object.assign(settings, DEFAULT_SETTINGS, { bindings: { ...DEFAULT_BINDINGS } });
    saveSettings(settings);
    populateSettingsUI();
    applyTheme(settings.theme);
    stopAllMusic();
    playMenuMusic();
}

/** Sincroniza todos los controles del menú de configuración con `settings` al iniciar */
function populateSettingsUI() {
    document.getElementById('difficulty-slider').value      = settings.difficulty;
    document.getElementById('volume-slider').value          = settings.volume;
    document.getElementById('vol-display').textContent      = `${settings.volume}%`;
    document.getElementById('sfx-toggle').checked           = settings.sfxEnabled;
    document.getElementById('crt-toggle').checked           = settings.crtEffect;
    document.getElementById('shake-toggle').checked         = settings.screenShake;
    document.getElementById('music-toggle').checked         = settings.musicEnabled;
    document.getElementById('music-volume-slider').value    = settings.musicVolume;
    document.getElementById('music-vol-display').textContent = `${settings.musicVolume}%`;
    document.getElementById('mouse-toggle').checked         = settings.mouseControl;
    document.body.classList.toggle('crt-effect', settings.crtEffect);

    updateWinningScore(settings.winningScore);
    updateBallSpeed(settings.ballSpeed);
    refreshBindingButtons();
}

document.addEventListener('DOMContentLoaded', () => {
    buildThemeSwatches(document.getElementById('theme-swatches'));
    applyTheme(settings.theme);
    populateSettingsUI();
    showScreen('main-menu');

    document.querySelectorAll('[data-binding-action]').forEach(btn => {
        btn.addEventListener('click', () => startListeningFor(btn.dataset.bindingAction));
    });
});
