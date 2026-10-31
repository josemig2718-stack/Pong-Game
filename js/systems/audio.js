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

/** @type {AudioBuffer|null} Dos segundos de ruido rosa (más grave que el blanco), creado una vez. */
let sfxPinkBuffer = null;

/**
 * Ruido rosa por el método de Paul Kellet, con sfxRandom().
 * @param {AudioContext} ctx
 * @returns {AudioBuffer}
 */
function getPinkNoiseBuffer(ctx) {
    if (!sfxPinkBuffer) {
        const length = ctx.sampleRate * 2;
        sfxPinkBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = sfxPinkBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < length; i++) {
            const w = sfxRandom() * 2 - 1;
            b0 = 0.99886 * b0 + w * 0.0555179;
            b1 = 0.99332 * b1 + w * 0.0750759;
            b2 = 0.96900 * b2 + w * 0.1538520;
            b3 = 0.86650 * b3 + w * 0.3104856;
            b4 = 0.55000 * b4 + w * 0.5329522;
            b5 = -0.7616 * b5 - w * 0.0168980;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
            b6 = w * 0.115926;
        }
    }
    return sfxPinkBuffer;
}

/**
 * Tono sostenido: sube en `attack`, se mantiene y baja en `release`
 * (sfxVoice cae enseguida, como un golpe). `freqEnd` lo desliza durante
 * `dur`; `vibrato` le añade un LFO a la frecuencia.
 * @param {{ type?: OscillatorType, freq: number, freqEnd?: number|null, when?: number, dur: number,
 *           attack?: number, release?: number, gain?: number, lowpass?: number|null,
 *           vibrato?: { rate: number, depth: number }|null, pan?: number }} voice
 */
function sfxSustain({ type = 'square', freq, freqEnd = null, when = 0, dur, attack = 0.01, release = 0.05,
                      gain = 0.2, lowpass = null, vibrato = null, pan = 0 }) {
    if (!sfxActive()) return;
    const ctx = getAudioContext();
    const t0 = ctx.currentTime + when;
    const tEnd = t0 + dur;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, tEnd);
    if (vibrato) {
        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(vibrato.rate, t0);
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(vibrato.depth, t0);
        lfo.connect(depth);
        depth.connect(osc.frequency);
        lfo.start(t0);
        lfo.stop(tEnd + 0.02);
    }

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + Math.min(attack, dur));
    env.gain.setValueAtTime(gain, Math.max(t0 + attack, tEnd - release));
    env.gain.linearRampToValueAtTime(0.0001, tEnd);
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
}

/**
 * Ruido en bucle por un filtro (los ambientes del prólogo). Devuelve la
 * función que lo para con un fundido corto; con los efectos apagados no
 * suena y la función no hace nada.
 * @param {{ pink?: boolean, filter: BiquadFilterType, freq: number, q?: number, gain: number }} loop
 * @returns {() => void}
 */
function sfxNoiseLoop({ pink = false, filter, freq, q = 1, gain }) {
    if (!sfxActive()) return () => {};
    const ctx = getAudioContext();
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = pink ? getPinkNoiseBuffer(ctx) : getNoiseBuffer(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t0);
    f.Q.setValueAtTime(q, t0);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + 0.6);
    src.connect(f);
    f.connect(env);
    sfxOut(ctx, env, 0, t0);
    src.start(t0, sfxRandom() * 0.5);
    let stopped = false;
    return () => {
        if (stopped) return;
        stopped = true;
        const t = ctx.currentTime;
        env.gain.cancelScheduledValues(t);
        env.gain.setValueAtTime(env.gain.value, t);
        env.gain.linearRampToValueAtTime(0, t + 0.25);
        src.stop(t + 0.3);
    };
}

/**
 * Tono (hue) de un color #RRGGBB, de 0 a 360.
 * @param {string} hex
 */
function sfxHue(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16) || 0;
    const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 0;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
}

/**
 * El golpe de una tarjeta del prólogo: chasquido, bombo que cae y un
 * acorde corto de cuadrada cuya raíz sale del color del Hachepe (cada
 * 30° de tono, un semitono sobre la3), mayor o menor.
 * @param {{ color?: string, major?: boolean, octave?: number, tail?: number, when?: number }} opts
 */
function sfxCardHit({ color = '#FFFFFF', major = false, octave = 1, tail = 0.35, when = 0 }) {
    sfxNoise({ when, dur: 0.06, bandpass: 2200, q: 0.8, gain: 0.35 });
    sfxVoice({ type: 'sine', freq: 90 * octave, freqEnd: 45 * octave, when, decay: 0.3, gain: 0.55 });
    const root = 220 * Math.pow(2, Math.round(sfxHue(color) / 30) / 12) * octave;
    for (const semis of [0, major ? 4 : 3, 7]) {
        sfxVoice({ type: 'square', freq: root * Math.pow(2, semis / 12), when: when + 0.02, decay: tail, gain: 0.07, lowpass: 2400 });
    }
}

/**
 * La carga del smash de un lado: sus fuentes, la ganancia de salida (null
 * con los efectos apagados) y lo que devuelve la bajada de la música.
 * @typedef {{ sources: AudioScheduledSourceNode[], out: GainNode|null, unduck: () => void }} SmashChargeVoice
 */

/** Una voz por jugador: en local pueden cargar los dos a la vez. @type {{ p1: SmashChargeVoice|null, p2: SmashChargeVoice|null }} */
const smashChargeVoices = { p1: null, p2: null };

/**
 * Arranca la carga del smash de un lado, programada con el reloj de audio
 * (T = MECH.smashChargeMs):
 *   aire   ruido compartido por un paso banda (Q 1,5) que sube de 500 a
 *          2 200 Hz y de 0 a 0,05 en T: «tomar aire»
 *   tono   triangle de sol₃ a sol₄ en T, paso bajo a 1 100 Hz, 0 → 0,045
 *          en 0,12 s, con trémolo del 35 % que acelera de 5 a 12 Hz
 *   lista  en T, un clic cristalino (1 568 + 2 349 Hz) y en 0,25 s el aire
 *          y el tono bajan a un susurro (0,012 en total, trémolo a 3 Hz)
 * Todo va a una sola ganancia de salida, con panorama según el lado. Si
 * suena música, baja 2 dB mientras dure (musicDuckWhile).
 * @param {'p1'|'p2'} side
 */
function startSmashChargeVoice(side) {
    const unduck = musicCurrent() ? musicDuckWhile(MUSIC_DYNAMIC.smashChargeDb, { release: MUSIC_DYNAMIC.smashChargeReleaseS }) : () => {};
    if (!sfxActive()) {
        smashChargeVoices[side] = { sources: [], out: null, unduck };
        return;
    }
    const ctx = getAudioContext();
    const t0 = ctx.currentTime;
    const T = MECH.smashChargeMs / 1000;
    const tReady = t0 + T;
    const tWhisper = tReady + 0.25;

    const out = ctx.createGain();
    out.gain.setValueAtTime(1, t0);
    sfxOut(ctx, out, side === 'p1' ? -0.4 : 0.4, t0);

    // Aire que sube
    const air = ctx.createBufferSource();
    air.buffer = getNoiseBuffer(ctx);
    air.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.setValueAtTime(1.5, t0);
    band.frequency.setValueAtTime(500, t0);
    band.frequency.exponentialRampToValueAtTime(2200, tReady);
    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0, t0);
    airGain.gain.linearRampToValueAtTime(0.05, tReady);
    airGain.gain.linearRampToValueAtTime(0.007, tWhisper);
    air.connect(band);
    band.connect(airGain);
    airGain.connect(out);

    // Tono que sube, con trémolo: trem = 0,825 ± 0,175 (35 % de profundidad)
    const tone = ctx.createOscillator();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(196, t0);
    tone.frequency.exponentialRampToValueAtTime(392, tReady);
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.setValueAtTime(1100, t0);
    const toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(0, t0);
    toneGain.gain.linearRampToValueAtTime(0.045, t0 + 0.12);
    toneGain.gain.setValueAtTime(0.045, tReady);
    toneGain.gain.linearRampToValueAtTime(0.005, tWhisper);
    const trem = ctx.createGain();
    trem.gain.setValueAtTime(0.825, t0);
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(5, t0);
    lfo.frequency.linearRampToValueAtTime(12, tReady);
    lfo.frequency.linearRampToValueAtTime(3, tWhisper);
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0.175, t0);
    lfo.connect(depth);
    depth.connect(trem.gain);
    tone.connect(low);
    low.connect(toneGain);
    toneGain.connect(trem);
    trem.connect(out);

    // Lista: el clic, dentro de la misma voz (se cancela con ella)
    const clickEnv = ctx.createGain();
    clickEnv.gain.setValueAtTime(0.0001, tReady);
    clickEnv.gain.exponentialRampToValueAtTime(0.07, tReady + 0.004);
    clickEnv.gain.exponentialRampToValueAtTime(0.0001, tReady + 0.004 + 0.22);
    clickEnv.connect(out);
    const clicks = [1568, 2349].map((f) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, tReady);
        o.connect(clickEnv);
        o.start(tReady);
        o.stop(tReady + 0.25);
        return o;
    });

    air.start(t0, sfxRandom() * Math.max(0, air.buffer.duration - 0.1));
    tone.start(t0);
    lfo.start(t0);
    smashChargeVoices[side] = { sources: [air, tone, lfo, ...clicks], out, unduck };
}

/**
 * Corta la carga de un lado: fundido de 50 ms, para todas sus fuentes
 * (también el clic si aún no había sonado) y la música vuelve en 0,3 s.
 * @param {'p1'|'p2'} side
 */
function stopSmashChargeVoice(side) {
    const voice = smashChargeVoices[side];
    if (!voice) return;
    smashChargeVoices[side] = null;
    voice.unduck();
    if (!voice.out) return;
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    voice.out.gain.cancelScheduledValues(t);
    voice.out.gain.setValueAtTime(voice.out.gain.value, t);
    voice.out.gain.linearRampToValueAtTime(0, t + 0.05);
    for (const src of voice.sources) {
        try { src.stop(t + 0.06); } catch (err) { /* ya parada */ }
    }
}

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
     * Carga del smash de un lado: con `true` arranca la voz que sube y se
     * queda en un susurro (startSmashChargeVoice); con `false` la corta.
     * @param {boolean} on
     * @param {'p1'|'p2'} side
     */
    smashCharge: (on, side) => {
        if (on) {
            if (!smashChargeVoices[side]) startSmashChargeVoice(side);
        } else {
            stopSmashChargeVoice(side);
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
    },

    // --- Prólogo de la campaña (cutscene/player.js) -------------------
    // Los bucles (cityAmbience, rain) devuelven la función que los para.

    /** Encendido del televisor. */
    crtOn: () => {
        sfxNoise({ dur: 0.15, bandpass: 4000, gain: 0.25 });
        sfxVoice({ type: 'sine', freq: 60, freqEnd: 1200, decay: 0.25, gain: 0.25 });
    },
    /** Acorde del título: re, la y re en sierra a la vez. */
    titleChord: () => {
        for (const f of [147, 220, 294]) sfxVoice({ type: 'sawtooth', freq: f, decay: 1.8, gain: 0.08, lowpass: 1200 });
    },
    /** Murmullo de la ciudad (bucle). */
    cityAmbience: () => sfxNoiseLoop({ pink: true, filter: 'lowpass', freq: 600, gain: 0.05 }),
    /** Chispazo eléctrico. */
    spark: () => {
        sfxNoise({ dur: 0.08, bandpass: 6000, gain: 0.3 });
        sfxVoice({ type: 'square', freq: 1800, freqEnd: 200, decay: 0.12, gain: 0.15 });
    },
    /** Frenazo de la camioneta. */
    tireScreech: () => {
        sfxSustain({ type: 'sawtooth', freq: 900, freqEnd: 600, dur: 0.9, attack: 0.02, release: 0.2, gain: 0.3,
                     lowpass: 3500, vibrato: { rate: 30, depth: 25 } });
        sfxNoise({ dur: 0.9, bandpass: 3000, gain: 0.12 });
    },
    /** Sirena: 700 y 950 Hz alternos, 0,25 s cada uno, dos veces. */
    siren: () => {
        [700, 950, 700, 950].forEach((f, i) => sfxSustain({ type: 'square', freq: f, when: i * 0.25, dur: 0.25, gain: 0.09, lowpass: 2500 }));
    },
    /**
     * Tarjeta de un Hachepe.
     * @param {{ color?: string, major?: boolean }} [opts]
     */
    cardHit: (opts = {}) => sfxCardHit(opts),
    /**
     * Tarjeta del jefe: dos golpes una octava más graves, el segundo con
     * 0,8 s de cola.
     * @param {{ color?: string, major?: boolean }} [opts]
     */
    cardHitBig: (opts = {}) => {
        sfxCardHit({ ...opts, octave: 0.5 });
        sfxCardHit({ ...opts, octave: 0.5, tail: 0.8, when: 0.14 });
    },
    /** El cachorro de Valen: dos ladridos. */
    puppyBark: () => {
        for (const when of [0, 0.14]) sfxVoice({ type: 'square', freq: 900, freqEnd: 600, decay: 0.06, gain: 0.18, lowpass: 3000, when });
    },
    /**
     * Pelotas de energía: un silbido por pelota, como las del efecto
     * `balls` (andanadas cada `gap` s, una pelota cada `stagger` s). Cada
     * Hachepe silba un tono más arriba que el anterior.
     * @param {{ volleys?: number, per?: number, gap?: number, stagger?: number }} [opts]
     */
    energyBalls: ({ volleys = 3, per = 6, gap = 0.45, stagger = 0.05 } = {}) => {
        for (let v = 0; v < volleys; v++) {
            for (let i = 0; i < per; i++) {
                const k = Math.pow(2, i * 2 / 12);
                sfxVoice({ type: 'sine', freq: 400 * k, freqEnd: 1400 * k, decay: 0.2, gain: 0.12,
                           detune: sfxVary(50), when: v * gap + i * stagger, pan: (i / (per - 1) - 0.5) * 0.6 });
            }
        }
    },
    /** Cristales rotos: seis chasquidos agudos. */
    glass: () => {
        for (let i = 0; i < 6; i++) {
            sfxNoise({ when: i * 0.04 + sfxRandom() * 0.02, dur: 0.02, bandpass: 5000 + sfxRandom() * 4000, q: 3, gain: 0.3 });
        }
    },
    /** La risa de Valen. */
    valenLaugh: () => {
        for (let i = 0; i < 3; i++) sfxVoice({ type: 'triangle', freq: 300, freqEnd: 250, decay: 0.1, gain: 0.3, when: i * 0.12 });
    },
    /** Se enciende el logo del Sindicato: zumbido grave y un pitido entrecortado. */
    logoOn: () => {
        sfxSustain({ type: 'sine', freq: 50, dur: 0.6, attack: 0.03, release: 0.15, gain: 0.35 });
        for (let i = 0; i < 8; i++) sfxSustain({ type: 'square', freq: 880, when: i * 0.08, dur: 0.04, attack: 0.003, release: 0.005, gain: 0.05 });
    },
    /** Lluvia (bucle). */
    rain: () => sfxNoiseLoop({ filter: 'bandpass', freq: 2000, q: 0.7, gain: 0.06 }),
    /** Persiana metálica que baja: ruido con pulsos de 25 Hz. */
    shutter: () => {
        if (!sfxActive()) return;
        const ctx = getAudioContext();
        const t0 = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = getNoiseBuffer(ctx);
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.setValueAtTime(900, t0);
        const pulses = ctx.createGain();
        pulses.gain.setValueAtTime(0.5, t0);
        const lfo = ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.setValueAtTime(25, t0);
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0.5, t0);
        lfo.connect(depth);
        depth.connect(pulses.gain);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.linearRampToValueAtTime(0.3, t0 + 0.02);
        env.gain.setValueAtTime(0.3, t0 + 0.4);
        env.gain.linearRampToValueAtTime(0.0001, t0 + 0.5);
        src.connect(band);
        band.connect(pulses);
        pulses.connect(env);
        sfxOut(ctx, env, 0, t0);
        src.start(t0, sfxRandom() * 0.4, 0.5);
        lfo.start(t0);
        lfo.stop(t0 + 0.52);
    },
    /** Trueno: ruido grave que se apaga en 1,5 s. */
    thunder: () => {
        if (!sfxActive()) return;
        const ctx = getAudioContext();
        const t0 = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = getPinkNoiseBuffer(ctx);
        const low = ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.setValueAtTime(300, t0);
        low.frequency.exponentialRampToValueAtTime(120, t0 + 1.5);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.exponentialRampToValueAtTime(0.4, t0 + 0.04);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
        src.connect(low);
        low.connect(env);
        sfxOut(ctx, env, 0, t0);
        src.start(t0, sfxRandom() * 0.4, 1.5);
    },
    /** El coche de los locos se acerca. */
    carApproach: () => sfxSustain({ type: 'sawtooth', freq: 80, freqEnd: 160, dur: 1.2, attack: 1.1, release: 0.1, gain: 0.3, lowpass: 700 }),
    /** Entra la cámara lenta. */
    slowmo: () => sfxVoice({ type: 'sine', freq: 200, freqEnd: 60, decay: 0.6, gain: 0.3 }),
    /** El Desconocido coge la paleta: un golpe de pala suave. */
    paddleTake: () => {
        sfxNoise({ dur: 0.025, bandpass: 2800, gain: 0.18 });
        sfxVoice({ type: 'square', freq: 420, freqEnd: 360, decay: 0.07, gain: 0.25 });
    },
    /**
     * Los ojos de la torre: un pitido por par, como el efecto `eyes`.
     * @param {{ count?: number, gap?: number }} [opts]
     */
    eyes: ({ count = 6, gap = 0.35 } = {}) => {
        for (let i = 0; i < count; i++) sfxVoice({ type: 'sine', freq: 1200, attack: 0.003, decay: 0.04, gain: 0.15, when: i * gap });
    },
    /** El altavoz de la torre se enciende. */
    speaker: () => {
        sfxNoise({ dur: 0.3, bandpass: 1500, q: 0.7, gain: 0.2 });
        sfxSustain({ type: 'square', freq: 1000, dur: 0.03, attack: 0.002, release: 0.005, gain: 0.08 });
    },
    /** Chasquido de radio al empezar una línea por el altavoz. */
    radioClick: () => sfxNoise({ dur: 0.05, bandpass: 2500, q: 0.6, gain: 0.25 })
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
