/**
 * ui/settings-panel.js
 * ------------------------------------------------------------------
 * Pantalla de configuración: cada control escribe en `settings`, lo
 * guarda y aplica el efecto inmediato que tenga (volumen, CRT, ratón…).
 * Los controles llegan aquí desde ui/actions.js.
 * ------------------------------------------------------------------
 */

import { DEFAULT_BINDINGS, DEFAULT_SETTINGS, saveSettings, settings } from '../core/settings.js';
import { state } from '../core/state.js';
import {
    getAudioContext,
    playGameplayMusic,
    playMenuMusic,
    playTone,
    setMasterVolume,
    setMusicEnabled,
    setMusicVolume,
    setSfxEnabled,
    stopAllMusic
} from '../systems/audio.js';
import { refreshBindingButtons } from '../systems/input.js';
import { clearMouseControl } from '../systems/pointer.js';
import { applyTheme } from '../systems/theme.js';

/**
 * @param {string} val 1 Fácil, 2 Normal, 3 Imposible
 */
export function updateDifficulty(val) {
    settings.difficulty = parseInt(val, 10);
    saveSettings();
}

/**
 * Slider de volumen de efectos: aplica, muestra el % y suena una muestra.
 * @param {string} val de 0 a 100
 */
export function updateVolume(val) {
    setMasterVolume(parseInt(val, 10));
    document.getElementById('vol-display').textContent = `${val}%`;
    getAudioContext();
    if (Number(val) > 0) playTone(400, 'square', 0.05);
}

/**
 * @param {string} val de 0 a 100
 */
export function updateMusicVolume(val) {
    setMusicVolume(parseInt(val, 10));
    document.getElementById('music-vol-display').textContent = `${val}%`;
}

/**
 * Activa o desactiva la música; al activarla suena la que toca ahora.
 * @param {boolean} enabled
 */
export function toggleMusic(enabled) {
    setMusicEnabled(enabled);
    if (enabled) {
        // Reanudar la música que corresponda según el estado actual
        if (state.isPlaying) {
            // BUG conocido (conservado, ver docs/bugs-conocidos.md): sin el modo: en Hachepe o campaña
            // suena la pista genérica.
            playGameplayMusic();
        } else {
            playMenuMusic();
        }
    }
}

/**
 * Puntos para ganar; resalta la opción elegida.
 * @param {number|string} val
 */
export function updateWinningScore(val) {
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
export function updateBallSpeed(val) {
    settings.ballSpeed = parseInt(String(val), 10);
    saveSettings();
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-ball-speed]')).forEach(btn => {
        btn.classList.toggle('option-pill--active', parseInt(btn.dataset.ballSpeed, 10) === settings.ballSpeed);
    });
}

/**
 * @param {boolean} enabled
 */
export function toggleSfx(enabled) {
    setSfxEnabled(enabled);
    if (enabled) playTone(500, 'triangle', 0.05);
}

/**
 * @param {boolean} enabled
 */
export function toggleCrtEffect(enabled) {
    settings.crtEffect = enabled;
    saveSettings();
    document.body.classList.toggle('crt-effect', enabled);
}

/**
 * @param {boolean} enabled
 */
export function toggleScreenShake(enabled) {
    settings.screenShake = enabled;
    saveSettings();
}

/**
 * Al desactivarlo suelta la paleta, para que vuelva a mandar el teclado.
 * @param {boolean} enabled
 */
export function toggleMouseControl(enabled) {
    settings.mouseControl = enabled;
    saveSettings();
    if (!enabled) {
        clearMouseControl();
    }
}

/**
 * @param {boolean} enabled
 */
export function togglePowerups(enabled) {
    settings.powerupsEnabled = enabled;
    saveSettings();
}

/** Botón "RESTABLECER TODO": vuelve a la configuración por defecto. */
export function resetAllSettings() {
    // BUG conocido (conservado, ver docs/bugs-conocidos.md): no actualiza masterVolume (systems/audio.js):
    // los efectos suenan con el volumen anterior hasta mover el slider.
    Object.assign(settings, DEFAULT_SETTINGS, { bindings: { ...DEFAULT_BINDINGS } });
    saveSettings();
    populateSettingsUI();
    applyTheme(settings.theme);
    stopAllMusic();
    playMenuMusic();
}

/** Sincroniza todos los controles del menú de configuración con `settings` al iniciar */
export function populateSettingsUI() {
    /** @param {string} id */
    const input = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
    input('difficulty-slider').value      = String(settings.difficulty);
    input('volume-slider').value          = String(settings.volume);
    document.getElementById('vol-display').textContent      = `${settings.volume}%`;
    input('sfx-toggle').checked           = settings.sfxEnabled;
    input('crt-toggle').checked           = settings.crtEffect;
    input('shake-toggle').checked         = settings.screenShake;
    input('music-toggle').checked         = settings.musicEnabled;
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
