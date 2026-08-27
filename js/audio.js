/**
 * audio.js
 * ------------------------------------------------------------------
 * Sintetizador de audio 100% generado por JavaScript (Web Audio API)
 * para efectos de sonido, más reproducción de música de fondo con
 * elementos <audio> HTML5 para menú y gameplay.
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
    paddleHit:  () => playTone(600, 'square', 0.1),
    wallHit:    () => playTone(300, 'square', 0.1),
    score:      () => {
        playTone(400, 'sawtooth', 0.15);
        setTimeout(() => playTone(600, 'sawtooth', 0.4), 100);
    },
    uiClick:    () => playTone(500, 'triangle', 0.05),
    countdown:  () => playTone(440, 'square', 0.08),
    go:         () => playTone(880, 'square', 0.15),
    win:        () => {
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.2), i * 120));
    },
    lose:       () => {
        [400, 300, 200].forEach((f, i) => setTimeout(() => playTone(f, 'sawtooth', 0.25), i * 150));
    },
    achievementUnlock: () => {
        [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.18), i * 80));
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

// =================================================================
//  Música de fondo (HTML5 Audio)
// =================================================================
const menuMusic     = new Audio('assets/audio/musica_menuprincipal.mp3');
const gameplayMusic = new Audio('assets/audio/musica_gameplay.mp3');

menuMusic.loop     = true;
gameplayMusic.loop = true;

// Aplica el volumen de música almacenado al iniciar
menuMusic.volume     = settings.musicVolume / 100;
gameplayMusic.volume = settings.musicVolume / 100;

function playMenuMusic() {
    if (!settings.musicEnabled) return;
    gameplayMusic.pause();
    gameplayMusic.currentTime = 0;
    menuMusic.volume = settings.musicVolume / 100;
    menuMusic.play().catch(() => {});  // Silencia el autoplay-block
}

function stopMenuMusic() {
    menuMusic.pause();
    menuMusic.currentTime = 0;
}

function playGameplayMusic() {
    if (!settings.musicEnabled) return;
    menuMusic.pause();
    menuMusic.currentTime = 0;
    gameplayMusic.volume = settings.musicVolume / 100;
    gameplayMusic.play().catch(() => {});
}

function stopGameplayMusic() {
    gameplayMusic.pause();
    gameplayMusic.currentTime = 0;
}

function stopAllMusic() {
    stopMenuMusic();
    stopGameplayMusic();
}

function setMusicVolume(val) {
    settings.musicVolume = val;
    menuMusic.volume     = val / 100;
    gameplayMusic.volume = val / 100;
    saveSettings(settings);
}

function setMusicEnabled(enabled) {
    settings.musicEnabled = enabled;
    saveSettings(settings);
    if (!enabled) {
        stopAllMusic();
    }
}

// --- Autoplay workaround ---
// Los navegadores bloquean el autoplay de audio hasta la primera
// interacción del usuario. Este listener one-shot arranca la música
// del menú en cuanto el usuario hace click, toca la pantalla o
// presiona una tecla por primera vez.
function onFirstInteraction() {
    playMenuMusic();
    window.removeEventListener('click', onFirstInteraction);
    window.removeEventListener('keydown', onFirstInteraction);
    window.removeEventListener('touchstart', onFirstInteraction);
}
window.addEventListener('click', onFirstInteraction, { once: false });
window.addEventListener('keydown', onFirstInteraction, { once: false });
window.addEventListener('touchstart', onFirstInteraction, { once: false });
