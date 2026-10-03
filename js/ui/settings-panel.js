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

export function updateDifficulty(val) {
    settings.difficulty = parseInt(val, 10);
    saveSettings();
}

export function updateVolume(val) {
    setMasterVolume(parseInt(val, 10));
    document.getElementById('vol-display').textContent = `${val}%`;
    getAudioContext();
    if (val > 0) playTone(400, 'square', 0.05);
}

export function updateMusicVolume(val) {
    setMusicVolume(parseInt(val, 10));
    document.getElementById('music-vol-display').textContent = `${val}%`;
}

export function toggleMusic(enabled) {
    setMusicEnabled(enabled);
    if (enabled) {
        // Reanudar la música que corresponda según el estado actual
        if (state.isPlaying) {
            playGameplayMusic();
        } else {
            playMenuMusic();
        }
    }
}

export function updateWinningScore(val) {
    settings.winningScore = parseInt(val, 10);
    saveSettings();
    document.querySelectorAll('[data-winning-score]').forEach(btn => {
        btn.classList.toggle('option-pill--active', parseInt(btn.dataset.winningScore, 10) === settings.winningScore);
    });
}

export function updateBallSpeed(val) {
    settings.ballSpeed = parseInt(val, 10);
    saveSettings();
    document.querySelectorAll('[data-ball-speed]').forEach(btn => {
        btn.classList.toggle('option-pill--active', parseInt(btn.dataset.ballSpeed, 10) === settings.ballSpeed);
    });
}

export function toggleSfx(enabled) {
    setSfxEnabled(enabled);
    if (enabled) playTone(500, 'triangle', 0.05);
}

export function toggleCrtEffect(enabled) {
    settings.crtEffect = enabled;
    saveSettings();
    document.body.classList.toggle('crt-effect', enabled);
}

export function toggleScreenShake(enabled) {
    settings.screenShake = enabled;
    saveSettings();
}

export function toggleMouseControl(enabled) {
    settings.mouseControl = enabled;
    saveSettings();
    if (!enabled) {
        clearMouseControl();
    }
}

export function togglePowerups(enabled) {
    settings.powerupsEnabled = enabled;
    saveSettings();
}

export function resetAllSettings() {
    Object.assign(settings, DEFAULT_SETTINGS, { bindings: { ...DEFAULT_BINDINGS } });
    saveSettings();
    populateSettingsUI();
    applyTheme(settings.theme);
    stopAllMusic();
    playMenuMusic();
}

/** Sincroniza todos los controles del menú de configuración con `settings` al iniciar */
export function populateSettingsUI() {
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
    if (document.getElementById('powerups-toggle')) {
        document.getElementById('powerups-toggle').checked = settings.powerupsEnabled;
    }
    document.body.classList.toggle('crt-effect', settings.crtEffect);

    updateWinningScore(settings.winningScore);
    updateBallSpeed(settings.ballSpeed);
    refreshBindingButtons();
}
