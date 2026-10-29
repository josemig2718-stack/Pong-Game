/**
 * systems/audio.js
 * ------------------------------------------------------------------
 * Sintetizador de efectos 100% generado por JavaScript (Web Audio API):
 * dos primitivas, sfxVoice() y sfxNoise(), programadas con el reloj de
 * audio, y los efectos de soundEffects. Su azar sale de sfxRandom(),
 * nunca de Math.random (la física) ni de vfxRandom (los cosméticos).
 * La música la toca systems/music.js; aquí quedan sus envoltorios de
 * siempre (playMenuMusic, playGameplayMusic...).
 * ------------------------------------------------------------------
 */

'use strict';

let audioCtx = null;
/** @type {DynamicsCompressorNode|null} Compresor final: evita que se sature con varias cosas a la vez. */
let masterComp = null;
/** @type {GainNode|null} Bus de los efectos: su ganancia es el volumen de efectos. */
let sfxBus = null;
/** @type {GainNode|null} Bus de la música Web Audio: su ganancia es el volumen de música. */
let musicBus = null;

/**
 * Crea el AudioContext la primera vez y lo reanuda si el navegador lo suspendió.
 * Con él se monta la cadena de mezcla:
 *
 *   voces de efectos → sfxBus  ─┐
 *                               ├→ masterComp → destination
 *   música Web Audio → musicBus ─┘
 * @returns {AudioContext}
 */
function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();

        masterComp = audioCtx.createDynamicsCompressor();
        masterComp.threshold.value = -14;
        masterComp.knee.value = 12;
        masterComp.ratio.value = 3;
        masterComp.attack.value = 0.003;
        masterComp.release.value = 0.25;
        masterComp.connect(audioCtx.destination);

        sfxBus = audioCtx.createGain();
        sfxBus.gain.value = settings.volume / 100;
        sfxBus.connect(masterComp);

        musicBus = audioCtx.createGain();
        musicBus.gain.value = settings.musicVolume / 100;
        musicBus.connect(masterComp);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

/**
 * ¿Suenan los efectos? Desactivados o a volumen 0 no se crea ninguna voz
 * (no basta con bajar el bus a cero).
 */
function sfxActive() {
    return settings.sfxEnabled && settings.volume > 0;
}

/**
 * Conecta la salida de una voz al bus de efectos, con panorama si el
 * navegador lo tiene (Safari antiguo no tiene createStereoPanner).
 * @param {AudioContext} ctx
 * @param {AudioNode} node
 * @param {number} pan de -1 (izquierda) a 1 (derecha)
 * @param {number} t0 segundos del reloj de audio
 */
function sfxOut(ctx, node, pan, t0) {
    if (pan && typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t0);
        node.connect(panner);
        panner.connect(sfxBus);
    } else {
        node.connect(sfxBus);
    }
}

/**
 * Voz tonal: oscilador → envolvente → filtro opcional → panorama → sfxBus.
 * La envolvente va antes del filtro (los dos son lineales: suena igual).
 * Todo se programa con el reloj de audio; las secuencias usan `when`,
 * nunca setTimeout.
 * @param {{ type?: OscillatorType, freq: number, freqEnd?: number|null, when?: number,
 *           attack?: number, decay?: number, gain?: number, pan?: number,
 *           lowpass?: number|null, detune?: number }} voice
 * @returns {OscillatorNode|null} el oscilador, o null si los efectos están apagados
 */
function sfxVoice({ type = 'square', freq, freqEnd = null, when = 0, attack = 0.004,
                    decay = 0.12, gain = 0.5, pan = 0, lowpass = null, detune = 0 }) {
    if (!sfxActive()) return null;
    const ctx = getAudioContext();
    const t0 = ctx.currentTime + when;
    const tPeak = t0 + attack;
    const tEnd = tPeak + decay;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) {
        osc.frequency.setValueAtTime(freq, tPeak);
        osc.frequency.exponentialRampToValueAtTime(freqEnd, tEnd);
    }
    if (detune) osc.detune.setValueAtTime(detune, t0);

    // De casi 0 al pico y de vuelta: sin chasquidos al empezar ni al acabar
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, tPeak);
    env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    osc.connect(env);

    /** @type {AudioNode} */
    let out = env;
    if (lowpass) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(lowpass, t0);
        env.connect(filter);
        out = filter;
    }
    sfxOut(ctx, out, pan, t0);

    osc.start(t0);
    osc.stop(tEnd + 0.02);
    return osc;
}

/** @type {AudioBuffer|null} Un segundo de ruido blanco, creado una vez y reutilizado. */
let sfxNoiseBuffer = null;

/**
 * @param {AudioContext} ctx
 * @returns {AudioBuffer}
 */
function getNoiseBuffer(ctx) {
    if (!sfxNoiseBuffer) {
        const length = ctx.sampleRate;
        sfxNoiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = sfxNoiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = sfxRandom() * 2 - 1;
    }
    return sfxNoiseBuffer;
}

/**
 * Ráfaga de ruido blanco filtrado (el "chasquido" del impacto).
 * `bandpassEnd` barre el filtro durante la ráfaga.
 * @param {{ when?: number, dur?: number, bandpass?: number, bandpassEnd?: number|null,
 *           q?: number, gain?: number, pan?: number }} burst
 */
function sfxNoise({ when = 0, dur = 0.03, bandpass = 2500, bandpassEnd = null, q = 1.2, gain = 0.35, pan = 0 }) {
    if (!sfxActive()) return;
    const ctx = getAudioContext();
    const t0 = ctx.currentTime + when;
    const buffer = getNoiseBuffer(ctx);

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(bandpass, t0);
    if (bandpassEnd) filter.frequency.exponentialRampToValueAtTime(bandpassEnd, t0 + dur);
    filter.Q.setValueAtTime(q, t0);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter);
    filter.connect(env);
    sfxOut(ctx, env, pan, t0);

    // Cada ráfaga lee un trozo distinto del mismo buffer
    const offset = sfxRandom() * Math.max(0, buffer.duration - dur);
    src.start(t0, offset, dur);
}

/**
 * Desafinado aleatorio de ±n cents, para que dos golpes seguidos no suenen idénticos.
 * @param {number} n
 */
function sfxVary(n) {
    return (sfxRandom() - 0.5) * 2 * n;
}

/**
 * Panorama según la x del campo: lo que pasa a la izquierda suena a la izquierda.
 * @param {number|undefined} x
 */
function sfxPanX(x) {
    if (typeof x !== 'number') return 0;
    return Math.max(-0.6, Math.min(0.6, (x / (GAME_WIDTH / 2) - 1) * 0.6));
}

/**
 * Arpegio: una nota cada `step` segundos.
 * @param {number[]} notes hercios
 * @param {number} step segundos entre notas
 * @param {{ type?: OscillatorType, decay?: number, gain?: number, when?: number }} [voice]
 */
function sfxArpeggio(notes, step, { type = 'triangle', decay = 0.12, gain = 0.5, when = 0 } = {}) {
    notes.forEach((f, i) => sfxVoice({ type, freq: f, decay, gain, when: when + i * step }));
}

/**
 * Arpegio con brillo: cada nota lleva un `sine` una octava arriba.
 * @param {number[]} notes
 * @param {number} step
 */
function sfxSparkleArpeggio(notes, step) {
    sfxArpeggio(notes, step, { type: 'triangle', decay: 0.18 });
    sfxArpeggio(notes.map(f => f * 2), step, { type: 'sine', decay: 0.18, gain: 0.15 });
}

/** @type {{ osc: OscillatorNode, env: GainNode }|null} La carga del smash en curso. */
let smashChargeVoice = null;

/** @typedef {{ x?: number, speedRatio?: number }} HitInfo */

const soundEffects = {
    /** @param {HitInfo} [info] x del golpe y velocidad de la bola (0 a 1) */
    paddleHit: (info = {}) => {
        const pan = sfxPanX(info.x);
        const f = 420 + 260 * Math.max(0, Math.min(1, info.speedRatio || 0));
        sfxNoise({ dur: 0.025, bandpass: 2800, pan });
        sfxVoice({ type: 'square', freq: f, freqEnd: f * 0.85, decay: 0.07, detune: sfxVary(25), pan });
    },
    /** @param {HitInfo} [info] */
    wallHit: (info = {}) => {
        const pan = sfxPanX(info.x);
        sfxNoise({ dur: 0.018, bandpass: 1800, gain: 0.25, pan });
        sfxVoice({ type: 'triangle', freq: 300, freqEnd: 240, decay: 0.06, pan });
    },
    score: () => {
        sfxVoice({ type: 'sawtooth', freq: 392, freqEnd: 523, decay: 0.12 });
        sfxArpeggio([523, 659, 784], 0.07, { type: 'square', gain: 0.35, decay: 0.1, when: 0.12 });
    },
    uiClick:   () => sfxVoice({ type: 'triangle', freq: 520, freqEnd: 480, decay: 0.04, gain: 0.25 }),
    countdown: () => sfxVoice({ type: 'square', freq: 440, decay: 0.06, lowpass: 3000 }),
    go: () => {
        sfxVoice({ type: 'square', freq: 880, decay: 0.16 });
        sfxVoice({ type: 'triangle', freq: 1320, decay: 0.16 });
    },
    /** Victoria sintetizada: con la música activada suena el jingle en su lugar. */
    win:  () => sfxArpeggio([523, 659, 784, 1046], 0.12, { type: 'square', decay: 0.2 }),
    /** Derrota sintetizada: con la música activada suena el jingle en su lugar. */
    lose: () => sfxArpeggio([400, 300, 200], 0.15, { type: 'sawtooth', decay: 0.25 }),
    achievementUnlock: () => sfxSparkleArpeggio([660, 880, 1100, 1320], 0.07),

    // --- Power-ups ---
    powerupSpawn: () => {
        sfxVoice({ type: 'triangle', freq: 350, decay: 0.12 });
        sfxVoice({ type: 'triangle', freq: 500, decay: 0.08, when: 0.08 });
    },
    powerupCollect: () => sfxArpeggio([700, 900, 1100], 0.06, { type: 'square', decay: 0.1 }),
    powerupExpire: () => {
        sfxVoice({ type: 'sawtooth', freq: 400, decay: 0.1 });
        sfxVoice({ type: 'sawtooth', freq: 300, decay: 0.1, when: 0.08 });
    },
    multiBallSplit: () => sfxArpeggio([600, 800, 600], 0.05, { type: 'square', decay: 0.06 }),
    shieldBlock: () => sfxVoice({ type: 'square', freq: 200, decay: 0.15 }),

    // --- Progresión y Tienda ---
    levelUp: () => {
        sfxArpeggio([523, 659, 784, 1046, 1318], 0.09, { type: 'triangle', decay: 0.25 });
        sfxNoise({ when: 0.45, dur: 0.12, bandpass: 6000, gain: 0.12 });
    },
    /** Compra sin monedas suficientes: un «no» corto y grave. */
    denied: () => sfxVoice({ type: 'square', freq: 160, decay: 0.12, lowpass: 1200, gain: 0.3 }),

    shopBuy: () => {
        sfxVoice({ type: 'square', freq: 800, decay: 0.08 });
        sfxVoice({ type: 'triangle', freq: 1000, decay: 0.12, when: 0.06 });
        sfxVoice({ type: 'triangle', freq: 1200, decay: 0.08, when: 0.12 });
    },

    // --- Campaña: todo sintetizado, sin archivos nuevos ---
    /** Aviso previo de un ataque de jefe (escudo de Dani, parada de tiempo). */
    bossWarning: () => sfxArpeggio([220, 220], 0.16, { type: 'square', decay: 0.09 }),
    /** El escudo de Dani se materializa. */
    bossShield: () => {
        sfxVoice({ type: 'sawtooth', freq: 180, decay: 0.18 });
        sfxVoice({ type: 'square', freq: 260, decay: 0.14, when: 0.09 });
    },
    /** Teletransporte de Dani. */
    bossTeleport: () => {
        sfxVoice({ type: 'triangle', freq: 900, decay: 0.05 });
        sfxVoice({ type: 'triangle', freq: 500, decay: 0.08, when: 0.05 });
    },
    /** Uno del dúo se retira del campo. */
    bossRetreat: () => sfxArpeggio([520, 420, 330], 0.07, { type: 'triangle', decay: 0.1 }),
    /** La bola desaparece (Fano): un latido grave. */
    bossVanish: () => {
        sfxVoice({ type: 'sine', freq: 120, decay: 0.3 });
        sfxVoice({ type: 'sine', freq: 90, decay: 0.35, when: 0.18 });
    },
    /** Parada de tiempo de Yisus. */
    timeStop: () => sfxArpeggio([660, 550, 440, 330], 0.06, { type: 'sine', decay: 0.3 }),
    /** Ruido de glitch del Creador: disonancia deliberada. */
    glitch: () => {
        for (let i = 0; i < 5; i++) {
            sfxVoice({ type: 'sawtooth', freq: 90 + sfxRandom() * 900, decay: 0.05, when: i * 0.045 });
        }
    },
    /** Pitido suave de la máquina de escribir en los diálogos. */
    dialogueBlip: () => sfxVoice({ type: 'square', freq: 680, decay: 0.02 }),

    // --- Efectos nuevos: se definen ya y se usan en fases posteriores ---
    /** @param {HitInfo} [info] Golpe con efecto: el silbido del giro. */
    spinHit: (info = {}) => {
        soundEffects.paddleHit(info);
        sfxVoice({ type: 'sine', freq: 900, freqEnd: 1400, decay: 0.09, gain: 0.15, pan: sfxPanX(info.x) });
    },
    /** @param {HitInfo} [info] Golpe perfecto: una campana encima del golpe. */
    perfectHit: (info = {}) => {
        soundEffects.paddleHit(info);
        const pan = sfxPanX(info.x);
        sfxVoice({ type: 'sine', freq: 1568, decay: 0.35, gain: 0.25, pan });
        sfxVoice({ type: 'sine', freq: 2093, decay: 0.35, gain: 0.25, pan });
    },
    /**
     * Carga del smash: con `true` arranca un zumbido que sube; con `false`
     * lo apaga con un fundido de 40 ms.
     * @param {boolean} on
     * @param {'p1'|'p2'} side
     */
    smashCharge: (on, side) => {
        if (on) {
            if (smashChargeVoice || !sfxActive()) return;
            const ctx = getAudioContext();
            const t0 = ctx.currentTime;
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(110, t0);
            osc.frequency.exponentialRampToValueAtTime(330, t0 + 0.7);
            const env = ctx.createGain();
            env.gain.setValueAtTime(0.0001, t0);
            env.gain.exponentialRampToValueAtTime(0.3, t0 + 0.05);
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, t0);
            filter.frequency.exponentialRampToValueAtTime(2400, t0 + 0.7);
            osc.connect(env);
            env.connect(filter);
            sfxOut(ctx, filter, 0, t0);
            osc.start(t0);
            smashChargeVoice = { osc, env };
        } else if (smashChargeVoice) {
            const ctx = getAudioContext();
            const t = ctx.currentTime;
            const { osc, env } = smashChargeVoice;
            smashChargeVoice = null;
            env.gain.cancelScheduledValues(t);
            env.gain.setValueAtTime(Math.max(0.0001, env.gain.value), t);
            env.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
            osc.stop(t + 0.05);
        }
    },
    /** La energía del smash está llena. */
    superReady: () => sfxArpeggio([784, 988, 1175], 0.06, { type: 'triangle' }),
    /** @param {HitInfo} [info] Smash: el impacto con un golpe grave debajo. */
    superHit: (info = {}) => {
        const pan = sfxPanX(info.x);
        sfxNoise({ dur: 0.06, bandpass: 1200, gain: 0.5, pan });
        sfxVoice({ type: 'square', freq: 220, freqEnd: 110, decay: 0.16, pan });
        sfxVoice({ type: 'sawtooth', freq: 110, freqEnd: 55, decay: 0.4, lowpass: 900, pan });
    },
    /** Empieza la fiebre del rally. */
    feverStart: () => {
        sfxNoise({ dur: 0.5, bandpass: 400, bandpassEnd: 4000, gain: 0.3 });
        sfxVoice({ type: 'square', freq: 523, decay: 0.2 });
        sfxVoice({ type: 'square', freq: 784, decay: 0.2 });
    },
    /** Se gasta un bloqueo del escudo. */
    shieldCrack: () => {
        sfxNoise({ dur: 0.04, bandpass: 3500 });
        sfxVoice({ type: 'triangle', freq: 1200, freqEnd: 600, decay: 0.08 });
    },
    /** Power-up Congelar. */
    freeze: () => {
        sfxVoice({ type: 'sine', freq: 2400, freqEnd: 1200, decay: 0.25 });
        sfxNoise({ dur: 0.15, bandpass: 7000, gain: 0.15 });
    },
    /** La bola atraviesa un portal. */
    portalWarp: () => {
        sfxVoice({ type: 'sine', freq: 300, freqEnd: 1200, decay: 0.18 });
        sfxVoice({ type: 'sine', freq: 1200, freqEnd: 300, decay: 0.18, when: 0.18 });
    },
    /** La bola choca con el Muro. */
    wallBlock: () => {
        sfxVoice({ type: 'square', freq: 180, decay: 0.08 });
        sfxNoise({ dur: 0.03 });
    },
    /** Punto de partido: dos golpes graves de 55 Hz, como un latido. */
    heartbeat: () => {
        sfxVoice({ type: 'sine', freq: 55, attack: 0.005, decay: 0.085, gain: 0.5 });
        sfxVoice({ type: 'sine', freq: 55, attack: 0.005, decay: 0.085, gain: 0.5, when: 0.18 });
    },
    /** Misión completada. */
    missionComplete: () => sfxSparkleArpeggio([659, 784, 1046], 0.07),
    /** Recompensa recogida: como la compra, una quinta más arriba. */
    rewardClaim: () => {
        sfxVoice({ type: 'square', freq: 1200, decay: 0.08 });
        sfxVoice({ type: 'triangle', freq: 1500, decay: 0.12, when: 0.06 });
        sfxVoice({ type: 'triangle', freq: 1800, decay: 0.08, when: 0.12 });
    }
};

/**
 * Volumen de los efectos, de 0 a 100. Lo guarda en `settings`.
 * @param {number} val
 */
function setMasterVolume(val) {
    settings.volume = val;
    if (sfxBus) sfxBus.gain.value = val / 100;
    saveSettings();
}

/**
 * @param {boolean} enabled
 */
function setSfxEnabled(enabled) {
    settings.sfxEnabled = enabled;
    saveSettings();
}

// =================================================================
//  Música de fondo: envoltorios del reproductor (systems/music.js)
// =================================================================

/** Pone la música del menú (o la retoma donde iba). */
function playMenuMusic() {
    musicPlay('musica_menu');
}

/** Para la música del menú si es la que suena. */
function stopMenuMusic() {
    if (musicCurrent() === 'musica_menu') musicStop();
}

/**
 * La pista de la Rockola para una partida: la equipada o, con
 * «Aleatoria», una de las propias.
 * @returns {string} clave de MUSIC_TRACKS
 */
function matchTrack() {
    const eq = equippedId('music');
    if (eq === SHOP_RANDOM_MUSIC) return pickRandomTrack();
    return MUSIC_TRACKS[eq] ? eq : 'partida_synthwave';
}

/**
 * «Aleatoria»: una de las pistas que tiene el jugador, sin repetir la de
 * la vez anterior (state.lastRandomTrack). Elige con vfxRandom(), nunca
 * con Math.random: ese lo comparte la física.
 * @returns {string}
 */
function pickRandomTrack() {
    const owned = SHOP_CATALOG.music
        .filter(item => MUSIC_TRACKS[item.id] && (shopIsFree(item) || hasItem('music', item.id)))
        .map(item => item.id);
    if (!owned.length) return 'partida_synthwave';
    const fresh = owned.filter(id => id !== state.lastRandomTrack);
    const pool = fresh.length ? fresh : owned;
    const pick = pool[Math.floor(vfxRandom() * pool.length)];
    state.lastRandomTrack = pick;
    return pick;
}

/**
 * Música de partida según el modo: el rap de los Hachepes en Hachepe y
 * campaña, silencio contra el Creador y la de la Rockola
 * (state.matchTrack) en el resto.
 * @param {string} [mode]
 */
function playGameplayMusic(mode = 'cpu') {
    // El combate contra El Creador va en silencio: la tensión la llevan
    // los tonos sintetizados del propio jefe.
    if (mode === 'campaign' && currentCampaignLevel === CAMPAIGN_CREATOR) {
        musicStop();
        return;
    }
    // El resto de jefes comparten el rap de los Hachepes
    musicPlay(mode === 'hachepe' || mode === 'campaign' ? 'hachepe_rap' : (state.matchTrack || 'partida_synthwave'));
}

/** Para la música de partida (la de los menús no la toca). */
function stopGameplayMusic() {
    const current = musicCurrent();
    if (current && current !== 'musica_menu' && current !== 'musica_tienda') musicStop();
}

/** Para toda la música. */
function stopAllMusic() {
    musicStop();
}

/**
 * Pausa toda la música sin rebobinarla: al reactivarla, la pista que toca
 * sigue donde iba.
 */
function pauseAllMusic() {
    musicPause();
}

/**
 * Volumen de la música, de 0 a 100. Lo aplica y lo guarda.
 * @param {number} val
 */
function setMusicVolume(val) {
    settings.musicVolume = val;
    musicSetVolume(val / 100);
    saveSettings();
}

/**
 * Activa o desactiva la música (al desactivarla, la pausa sin rebobinar).
 * @param {boolean} enabled
 */
function setMusicEnabled(enabled) {
    settings.musicEnabled = enabled;
    saveSettings();
    if (!enabled) {
        musicPause();
    }
}

// --- Autoplay workaround ---
// Los navegadores bloquean el audio hasta la primera interacción del
// usuario. Este listener one-shot reanuda el AudioContext, precarga la
// música del menú y reintenta la pista que no pudo arrancar en cuanto el
// usuario hace click, toca la pantalla o presiona una tecla por primera vez.
function onFirstInteraction() {
    getAudioContext();
    musicPreload('musica_menu');
    musicResume();
    window.removeEventListener('click', onFirstInteraction);
    window.removeEventListener('keydown', onFirstInteraction);
    window.removeEventListener('touchstart', onFirstInteraction);
}

/** Registra el desbloqueo del audio. Debe ir antes que initInput(). */
function initAudio() {
    window.addEventListener('click', onFirstInteraction);
    window.addEventListener('keydown', onFirstInteraction);
    window.addEventListener('touchstart', onFirstInteraction);
}
