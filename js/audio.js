/**
 * audio.js
 * ------------------------------------------------------------------
 * Sintetizador de audio 100% generado por JavaScript (Web Audio API).
 * No requiere ningún archivo de sonido externo.
 * ------------------------------------------------------------------
 */

let audioCtx = null;
let masterVolume = settings.volume / 100;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function playTone(freq, type = 'square', duration = 0.1) {
    if (!settings.sfxEnabled || masterVolume === 0) return;
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime);

    gainNode.gain.setValueAtTime(masterVolume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
}

const soundEffects = {
    paddleHit: () => playTone(600, 'square', 0.1),
    wallHit: () => playTone(300, 'square', 0.1),
    score: () => {
        playTone(400, 'sawtooth', 0.15);
        setTimeout(() => playTone(600, 'sawtooth', 0.4), 100);
    },
    uiClick: () => playTone(500, 'triangle', 0.05),
    countdown: () => playTone(440, 'square', 0.08),
    go: () => playTone(880, 'square', 0.15),
    win: () => {
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.2), i * 120));
    },
    lose: () => {
        [400, 300, 200].forEach((f, i) => setTimeout(() => playTone(f, 'sawtooth', 0.25), i * 150));
    }
};

function setMasterVolume(val) {
    masterVolume = val / 100;
    settings.volume = val;
    saveSettings(settings);
}

function setSfxEnabled(enabled) {
    settings.sfxEnabled = enabled;
    saveSettings(settings);
}
