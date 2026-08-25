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
    }
    soundEffects.uiClick();
}

function closeGame() {
    showScreen('exit-menu');
}

function forceClose() {
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

function resetAllSettings() {
    Object.assign(settings, DEFAULT_SETTINGS, { bindings: { ...DEFAULT_BINDINGS } });
    saveSettings(settings);
    populateSettingsUI();
    applyTheme(settings.theme);
}

/** Sincroniza todos los controles del menú de configuración con `settings` al iniciar */
function populateSettingsUI() {
    document.getElementById('difficulty-slider').value = settings.difficulty;
    document.getElementById('volume-slider').value = settings.volume;
    document.getElementById('vol-display').textContent = `${settings.volume}%`;
    document.getElementById('sfx-toggle').checked = settings.sfxEnabled;
    document.getElementById('crt-toggle').checked = settings.crtEffect;
    document.getElementById('shake-toggle').checked = settings.screenShake;
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
