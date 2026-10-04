/**
 * systems/audio.js
 * ------------------------------------------------------------------
 * Sintetizador de audio 100% generado por JavaScript (Web Audio API)
 * para efectos de sonido, más reproducción de música de fondo con
 * elementos <audio> HTML5 para menú y gameplay.
 * ------------------------------------------------------------------
 */

import { saveSettings, settings } from '../core/settings.js';
import { CAMPAIGN_CREATOR } from '../data/lore.js';
import { currentCampaignLevel } from '../campaign/progress.js';

let audioCtx = null;
let masterVolume = settings.volume / 100;

/**
 * Crea el AudioContext la primera vez y lo reanuda si el navegador lo suspendió.
 * @returns {AudioContext}
 */
export function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

/**
 * Toca un tono sintetizado con el volumen de efectos actual.
 * @param {number} freq hercios
 * @param {OscillatorType} [type]
 * @param {number} [duration] segundos
 */
export function playTone(freq, type = 'square', duration = 0.1) {
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

export const soundEffects = {
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
    },

    // --- Power-ups ---
    powerupSpawn:   () => { playTone(350, 'triangle', 0.12); setTimeout(() => playTone(500, 'triangle', 0.08), 80); },
    powerupCollect: () => { [700, 900, 1100].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.1), i * 60)); },
    powerupExpire:  () => { playTone(400, 'sawtooth', 0.1); setTimeout(() => playTone(300, 'sawtooth', 0.1), 80); },
    multiBallSplit: () => { playTone(600, 'square', 0.06); setTimeout(() => playTone(800, 'square', 0.06), 50); setTimeout(() => playTone(600, 'square', 0.06), 100); },
    shieldBlock:    () => playTone(200, 'square', 0.15),

    // --- Progresión y Tienda ---
    levelUp:   () => { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.25), i * 100)); },
    shopBuy:   () => { playTone(800, 'square', 0.08); setTimeout(() => playTone(1000, 'triangle', 0.12), 60); setTimeout(() => playTone(1200, 'triangle', 0.08), 120); },

    // --- Campaña: todo sintetizado, sin archivos nuevos ---
    /** Aviso previo de un ataque de jefe (escudo de Dani, parada de tiempo). */
    bossWarning: () => { playTone(220, 'square', 0.09); setTimeout(() => playTone(220, 'square', 0.09), 160); },
    /** El escudo de Dani se materializa. */
    bossShield:  () => { playTone(180, 'sawtooth', 0.18); setTimeout(() => playTone(260, 'square', 0.14), 90); },
    /** Teletransporte de Dani. */
    bossTeleport: () => { playTone(900, 'triangle', 0.05); setTimeout(() => playTone(500, 'triangle', 0.08), 50); },
    /** Uno del dúo se retira del campo. */
    bossRetreat: () => { [520, 420, 330].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.1), i * 70)); },
    /** La bola desaparece (Fano): un latido grave. */
    bossVanish:  () => { playTone(120, 'sine', 0.3); setTimeout(() => playTone(90, 'sine', 0.35), 180); },
    /** Parada de tiempo de Yisus. */
    timeStop:    () => { [660, 550, 440, 330].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.3), i * 60)); },
    /** Ruido de glitch del Creador: disonancia deliberada. */
    glitch:      () => {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => playTone(90 + Math.random() * 900, 'sawtooth', 0.05), i * 45);
        }
    },
    /** Pitido suave de la máquina de escribir en los diálogos. */
    dialogueBlip: () => playTone(680, 'square', 0.02)
};

/**
 * Volumen de los efectos, de 0 a 100. Lo guarda en `settings`.
 * @param {number} val
 */
export function setMasterVolume(val) {
    masterVolume = val / 100;
    settings.volume = val;
    saveSettings();
}

/**
 * @param {boolean} enabled
 */
export function setSfxEnabled(enabled) {
    settings.sfxEnabled = enabled;
    saveSettings();
}

// =================================================================
//  Música de fondo (HTML5 Audio)
// =================================================================
export const menuMusic     = new Audio('assets/audio/musica_menuprincipal.mp3');
export const gameplayMusic = new Audio('assets/audio/musica_gameplay.mp3');
export const hachepeMusic  = new Audio('assets/audio/hachepe_rap.mp3');

menuMusic.loop     = true;
gameplayMusic.loop = true;
hachepeMusic.loop  = true;

// Aplica el volumen de música almacenado al iniciar
menuMusic.volume     = settings.musicVolume / 100;
gameplayMusic.volume = settings.musicVolume / 100;
hachepeMusic.volume  = settings.musicVolume / 100;

/** Para la música de partida y pone la del menú (si la música está activada). */
export function playMenuMusic() {
    if (!settings.musicEnabled) return;
    gameplayMusic.pause();
    gameplayMusic.currentTime = 0;
    hachepeMusic.pause();
    hachepeMusic.currentTime = 0;
    menuMusic.volume = settings.musicVolume / 100;
    menuMusic.play().catch(() => {});  // Silencia el autoplay-block
}

/** Para la música del menú y la rebobina. */
export function stopMenuMusic() {
    menuMusic.pause();
    menuMusic.currentTime = 0;
}

/**
 * Música de partida según el modo: el rap de los Hachepes en Hachepe y
 * campaña, silencio contra el Creador y la pista normal en el resto.
 * @param {string} [mode]
 */
export function playGameplayMusic(mode = 'cpu') {
    if (!settings.musicEnabled) return;
    menuMusic.pause();
    menuMusic.currentTime = 0;

    // El combate contra El Creador va en silencio: la tensión la llevan
    // los tonos sintetizados del propio jefe.
    if (mode === 'campaign' && currentCampaignLevel === CAMPAIGN_CREATOR) {
        gameplayMusic.pause();
        gameplayMusic.currentTime = 0;
        hachepeMusic.pause();
        hachepeMusic.currentTime = 0;
        return;
    }

    // El resto de jefes comparten el rap de los Hachepes
    if (mode === 'hachepe' || mode === 'campaign') {
        gameplayMusic.pause();
        gameplayMusic.currentTime = 0;
        hachepeMusic.volume = settings.musicVolume / 100;
        hachepeMusic.play().catch(() => {});
    } else {
        hachepeMusic.pause();
        hachepeMusic.currentTime = 0;
        gameplayMusic.volume = settings.musicVolume / 100;
        gameplayMusic.play().catch(() => {});
    }
}

/** Para las pistas de partida y las rebobina. */
export function stopGameplayMusic() {
    gameplayMusic.pause();
    gameplayMusic.currentTime = 0;
    hachepeMusic.pause();
    hachepeMusic.currentTime = 0;
}

/** Para toda la música. */
export function stopAllMusic() {
    stopMenuMusic();
    stopGameplayMusic();
}

/**
 * Volumen de la música, de 0 a 100. Lo aplica a las tres pistas y lo guarda.
 * @param {number} val
 */
export function setMusicVolume(val) {
    settings.musicVolume = val;
    menuMusic.volume     = val / 100;
    gameplayMusic.volume = val / 100;
    hachepeMusic.volume  = val / 100;
    saveSettings();
}

/**
 * Activa o desactiva la música (al desactivarla, la para).
 * @param {boolean} enabled
 */
export function setMusicEnabled(enabled) {
    settings.musicEnabled = enabled;
    saveSettings();
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

/** Registra el desbloqueo del audio. Debe ir antes que initInput(). */
export function initAudio() {
    window.addEventListener('click', onFirstInteraction);
    window.addEventListener('keydown', onFirstInteraction);
    window.addEventListener('touchstart', onFirstInteraction);
}
