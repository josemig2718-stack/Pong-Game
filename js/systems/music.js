/**
 * systems/music.js
 * ------------------------------------------------------------------
 * Reproductor de música: bucles sin cortes con intro, fundidos cruzados
 * entre pistas y una posición guardada por pista (volver a una pista la
 * retoma donde iba). Las pistas y sus puntos de bucle están en
 * data/music.js.
 *
 * Dos motores, elegidos por pista:
 *   A · Web Audio: AudioBufferSourceNode con loopStart/loopEnd exactos.
 *       Solo con http(s), decodeAudioData y fetch; si la carga falla,
 *       la pista pasa al motor B.
 *   B · <audio>: con file:// (donde fetch de un MP3 local falla), sin
 *       decodeAudioData o como respaldo. Un vigilante salta de loopEnd
 *       a loopStart.
 *
 * El reproductor respeta settings.musicEnabled: con la música apagada,
 * musicPlay() solo anota qué pista toca y musicResume() la arranca.
 *
 * Música dinámica (settings.dynamicMusic): un multiplicador más sobre las
 * pistas en bucle (los jingles no se tocan) que baja con musicDuck() y
 * musicDuckHold() —manda la bajada más fuerte— y sube con musicSetBoost().
 * En el motor A es un GainNode entre las pistas y musicBus; en el B
 * multiplica el volume de cada <audio>, a pasos de 50 ms. El volumen de la
 * configuración y la bajada de la pausa van aparte y se multiplican.
 * ------------------------------------------------------------------
 */

'use strict';

/** Volumen de la música durante la pausa: −8 dB. */
const MUSIC_DUCK_GAIN = Math.pow(10, -8 / 20);
/** Paso de los fundidos del motor B (ms). */
const MUSIC_FADE_STEP_MS = 50;
/** Cada cuánto mira el vigilante de bucle del motor B (ms). */
const MUSIC_LOOP_WATCH_MS = 25;
/** Antelación con la que salta el vigilante (s): el empalme del archivo tapa el error. */
const MUSIC_LOOP_MARGIN = 0.03;

/**
 * Estado de una pista.
 * @typedef {{
 *   id: string,
 *   engine: 'webaudio'|'media',
 *   running: boolean,
 *   level: number,
 *   rate: number,
 *   fadeTimer: number|null,
 *   el: HTMLAudioElement|null,
 *   watchTimer: number|null,
 *   blocked: boolean,
 *   buffer: AudioBuffer|null,
 *   loading: Promise<any>|null,
 *   gain: GainNode|null,
 *   source: AudioBufferSourceNode|null,
 *   startedAt: number,
 *   startOffset: number,
 *   offset: number,
 *   fadeIn: number
 * }} MusicChannel
 */

/** @type {Record<string, MusicChannel>} */
const musicChannels = {};
/** @type {string|null} La pista que toca aquí, suene o no (con la música apagada no suena). */
let musicCurrentId = null;
/** ¿Está sonando de verdad la pista actual? */
let musicIsPlaying = false;
/** Volumen de la música, de 0 a 1. */
let musicVolumeLevel = settings.musicVolume / 100;
/** ¿Está la música rebajada (pausa)? */
let musicDucked = false;

/** @type {{ gain: number }[]} Bajadas con tiempo en curso (musicDuck), como multiplicadores. */
const musicDucks = [];
/** Bajada sin tiempo (punto de partido) y subida (fiebre larga), como multiplicadores. */
let musicHoldGain = 1;
let musicBoostGain = 1;
/** Multiplicador dinámico que aplica el motor B ahora mismo (avanza a pasos hacia el objetivo). */
let musicDynLevel = 1;
/** Intervalo de esos pasos. */
let musicDynTimer = null;
/** @type {GainNode|null} El multiplicador dinámico del motor A, entre las pistas en bucle y musicBus. */
let musicDynNode = null;

/** ¿Puede usarse el motor A en esta página? */
function musicCanUseWebAudio() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return false;
    if (typeof fetch !== 'function') return false;
    const Ctx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    return !!Ctx && typeof Ctx.prototype.decodeAudioData === 'function';
}

/**
 * El canal de una pista, creado la primera vez (sin tocar nada aún).
 * @param {string} id
 * @returns {MusicChannel}
 */
function musicChannel(id) {
    if (!musicChannels[id]) {
        musicChannels[id] = {
            id,
            engine: musicCanUseWebAudio() ? 'webaudio' : 'media',
            running: false, level: 0, rate: 1, fadeTimer: null,
            el: null, watchTimer: null, blocked: false,
            buffer: null, loading: null, gain: null, source: null,
            startedAt: 0, startOffset: 0, offset: 0, fadeIn: 0
        };
    }
    return musicChannels[id];
}

/** Multiplicador de la pausa para un canal. */
function musicDuckFor(ch) {
    return musicDucked && ch.id === musicCurrentId ? MUSIC_DUCK_GAIN : 1;
}

/** Multiplicador de la música dinámica para un canal: solo las pistas en bucle. */
function musicDynFor(ch) {
    return MUSIC_TRACKS[ch.id].loop ? musicDynLevel : 1;
}

/** Aplica volumen, fundido, pausa y música dinámica al elemento <audio> de un canal. */
function musicApplyVolume(ch) {
    if (!ch.el) return;
    ch.el.volume = Math.max(0, Math.min(1, musicVolumeLevel * ch.level * musicDuckFor(ch) * musicDynFor(ch)));
}

/** Aplica volumen y pausa al bus de la música Web Audio. */
function musicApplyBus() {
    if (musicBus) musicBus.gain.value = musicVolumeLevel * (musicDucked ? MUSIC_DUCK_GAIN : 1);
}

/** @param {MusicChannel} ch */
function musicCancelFade(ch) {
    if (ch.fadeTimer !== null) {
        clearTimeout(ch.fadeTimer);
        clearInterval(ch.fadeTimer);
        ch.fadeTimer = null;
    }
}

/**
 * Lleva el nivel de un canal a `target` en `seconds` y luego llama a `onDone`.
 * @param {MusicChannel} ch
 * @param {number} target 0 a 1
 * @param {number} seconds
 * @param {() => void} [onDone]
 */
function musicFade(ch, target, seconds, onDone) {
    musicCancelFade(ch);
    if (ch.engine === 'webaudio' && ch.gain) {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        ch.gain.gain.cancelScheduledValues(now);
        ch.gain.gain.setValueAtTime(ch.gain.gain.value, now);
        ch.gain.gain.linearRampToValueAtTime(target, now + Math.max(0.001, seconds));
        ch.level = target;
        if (onDone) {
            ch.fadeTimer = setTimeout(() => { ch.fadeTimer = null; onDone(); }, seconds * 1000);
        }
        return;
    }
    if (seconds <= 0 || ch.engine === 'webaudio') {
        // Sin fundido, o motor A aún cargando: el fundido de entrada lo hace al empezar
        if (ch.engine === 'webaudio' && target > ch.level) ch.fadeIn = seconds;
        ch.level = target;
        musicApplyVolume(ch);
        if (onDone) onDone();
        return;
    }
    const from = ch.level;
    const steps = Math.max(1, Math.round(seconds * 1000 / MUSIC_FADE_STEP_MS));
    let i = 0;
    ch.fadeTimer = setInterval(() => {
        i++;
        ch.level = from + (target - from) * (i / steps);
        musicApplyVolume(ch);
        if (i >= steps) {
            clearInterval(ch.fadeTimer);
            ch.fadeTimer = null;
            if (onDone) onDone();
        }
    }, MUSIC_FADE_STEP_MS);
}

// -----------------------------------------------------------------
//  Motor A · Web Audio
// -----------------------------------------------------------------

/**
 * Carga y decodifica una pista una vez. Si falla, la pista pasa al motor B.
 * @param {MusicChannel} ch
 * @returns {Promise<any>}
 */
function musicLoad(ch) {
    if (ch.buffer) return Promise.resolve(ch.buffer);
    if (ch.loading) return ch.loading;
    const ctx = getAudioContext();
    ch.loading = fetch(MUSIC_TRACKS[ch.id].file)
        .then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.arrayBuffer();
        })
        // La forma con callbacks también funciona en Safari antiguo
        .then(data => new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject)))
        .then(buffer => {
            ch.buffer = /** @type {AudioBuffer} */ (buffer);
            ch.loading = null;
            return buffer;
        })
        .catch(err => {
            console.warn(`Música: "${ch.id}" no carga con Web Audio; pasa a <audio>.`, err);
            ch.engine = 'media';
            ch.loading = null;
            return null;
        });
    return ch.loading;
}

/** Fin del bucle de una pista en el motor A (segundos). */
function musicLoopEnd(ch) {
    const track = MUSIC_TRACKS[ch.id];
    return track.loopEnd === null ? ch.buffer.duration : track.loopEnd;
}

/**
 * Posición actual de un canal del motor A, reducida al bucle.
 * @param {MusicChannel} ch
 */
function musicPosition(ch) {
    if (!ch.source) return ch.offset;
    const track = MUSIC_TRACKS[ch.id];
    let pos = ch.startOffset + (getAudioContext().currentTime - ch.startedAt) * ch.rate;
    if (track.loop) {
        const end = musicLoopEnd(ch);
        const span = end - track.loopStart;
        if (pos >= end && span > 0) pos = track.loopStart + ((pos - track.loopStart) % span);
    } else {
        pos = Math.min(pos, ch.buffer.duration);
    }
    return pos;
}

/** Crea el source del motor A y empieza en `ch.offset`. */
function musicBeginWebAudio(ch) {
    const ctx = getAudioContext();
    const track = MUSIC_TRACKS[ch.id];
    if (!ch.gain) {
        ch.gain = ctx.createGain();
        ch.gain.connect(track.loop ? musicDynBus() : musicBus);
    }
    const src = ctx.createBufferSource();
    src.buffer = ch.buffer;
    src.loop = track.loop;
    if (track.loop) {
        src.loopStart = track.loopStart;
        src.loopEnd = musicLoopEnd(ch);
    }
    src.playbackRate.value = ch.rate;
    src.connect(ch.gain);
    if (!track.loop) {
        src.onended = () => {
            if (ch.source !== src) return;
            ch.source = null;
            ch.running = false;
            ch.offset = 0;
        };
    }

    const now = ctx.currentTime;
    ch.gain.gain.cancelScheduledValues(now);
    if (ch.fadeIn > 0) {
        ch.gain.gain.setValueAtTime(0, now);
        ch.gain.gain.linearRampToValueAtTime(ch.level, now + ch.fadeIn);
        ch.fadeIn = 0;
    } else {
        ch.gain.gain.setValueAtTime(ch.level, now);
    }

    ch.source = src;
    ch.startedAt = now;
    ch.startOffset = ch.offset;
    src.start(0, ch.offset);
}

// -----------------------------------------------------------------
//  Motor B · <audio>
// -----------------------------------------------------------------

/** Crea el <audio> de un canal la primera vez que se usa. */
function musicElement(ch) {
    if (ch.el) return ch.el;
    const track = MUSIC_TRACKS[ch.id];
    const el = new Audio(track.file);
    el.loop = track.loop && track.loopEnd === null;
    // Respaldo del vigilante: si el archivo llega al final, vuelve al bucle
    el.onended = () => {
        if (!ch.running || !track.loop) {
            ch.running = false;
            return;
        }
        el.currentTime = track.loopStart;
        el.play().catch(() => { ch.blocked = true; });
    };
    ch.el = el;
    return el;
}

/** Arranca el <audio> de un canal donde se quedó. */
function musicBeginMedia(ch) {
    const track = MUSIC_TRACKS[ch.id];
    const el = musicElement(ch);
    if (el.playbackRate !== ch.rate) el.playbackRate = ch.rate;
    musicApplyVolume(ch);
    ch.blocked = false;
    el.play().catch(() => { ch.blocked = true; });   // autoplay bloqueado: se reintenta con la primera interacción

    // Bucle con puntos: salta de loopEnd a loopStart conservando lo que se haya pasado
    if (track.loop && track.loopEnd !== null && ch.watchTimer === null) {
        const end = track.loopEnd;
        ch.watchTimer = setInterval(() => {
            if (el.currentTime >= end - MUSIC_LOOP_MARGIN) {
                el.currentTime = track.loopStart + (el.currentTime - end);
            }
        }, MUSIC_LOOP_WATCH_MS);
    }
}

// -----------------------------------------------------------------
//  Canales
// -----------------------------------------------------------------

/** Empieza a sonar un canal (con el motor que le toque). */
function musicStartChannel(ch) {
    ch.running = true;
    if (ch.engine === 'media') {
        musicBeginMedia(ch);
        return;
    }
    if (ch.source) return;
    if (ch.buffer) {
        musicBeginWebAudio(ch);
        return;
    }
    musicLoad(ch).then(() => {
        if (!ch.running || ch.source) return;
        if (ch.engine === 'media') {
            musicBeginMedia(ch);
        } else {
            musicBeginWebAudio(ch);
        }
    });
}

/**
 * Para un canal. Con `forget`, olvida su posición (la próxima vez empieza
 * desde el principio) y su velocidad.
 * @param {MusicChannel} ch
 * @param {boolean} forget
 */
function musicHaltChannel(ch, forget) {
    ch.running = false;
    musicCancelFade(ch);
    if (ch.watchTimer !== null) {
        clearInterval(ch.watchTimer);
        ch.watchTimer = null;
    }
    if (ch.el) {
        ch.el.pause();
        if (forget && ch.el.currentTime !== 0) ch.el.currentTime = 0;
    }
    if (ch.source) {
        ch.offset = musicPosition(ch);
        const src = ch.source;
        ch.source = null;
        src.onended = null;
        try { src.stop(); } catch (err) { /* ya parado */ }
        src.disconnect();
    }
    if (forget) {
        ch.offset = 0;
        if (ch.rate !== 1) {
            ch.rate = 1;
            if (ch.el) ch.el.playbackRate = 1;
        }
    }
}

// -----------------------------------------------------------------
//  API
// -----------------------------------------------------------------

/**
 * Pone una pista con un fundido cruzado desde la que suene. Si ya está
 * sonando no hace nada; si se dejó a medias, la retoma donde iba.
 * @param {string} id clave de MUSIC_TRACKS
 * @param {{ fade?: number }} [opts] segundos de fundido
 */
function musicPlay(id, { fade = 0.5 } = {}) {
    if (id === musicCurrentId) {
        if (!musicIsPlaying) musicResume({ fade });
        return;
    }
    const prevId = musicCurrentId;
    musicCurrentId = id;
    musicDucked = false;
    musicApplyBus();

    // La anterior se funde a silencio y se para guardando su posición
    if (prevId && musicChannels[prevId] && musicChannels[prevId].running) {
        const prev = musicChannels[prevId];
        musicFade(prev, 0, fade, () => musicHaltChannel(prev, false));
    }
    musicIsPlaying = false;
    musicResume({ fade });
}

/**
 * Fundido a silencio de la pista actual; olvida su posición.
 * @param {{ fade?: number }} [opts]
 */
function musicStop({ fade = 0.5 } = {}) {
    if (!musicCurrentId) return;
    const ch = musicChannel(musicCurrentId);
    musicCurrentId = null;
    musicIsPlaying = false;
    musicDucked = false;
    musicApplyBus();
    if (ch.running) {
        musicFade(ch, 0, fade, () => musicHaltChannel(ch, true));
    } else {
        musicHaltChannel(ch, true);
    }
}

/** Pausa toda la música sin perder la posición (el interruptor de música). */
function musicPause() {
    musicIsPlaying = false;
    for (const ch of Object.values(musicChannels)) {
        if (ch.running) musicHaltChannel(ch, false);
    }
}

/**
 * Hace sonar la pista actual donde iba (si la música está activada). Si
 * el navegador bloqueó su arranque, lo reintenta.
 * @param {{ fade?: number }} [opts]
 */
function musicResume({ fade = 0 } = {}) {
    if (!settings.musicEnabled || !musicCurrentId) return;
    const ch = musicChannel(musicCurrentId);
    if (musicIsPlaying) {
        if (ch.blocked && ch.el) {
            ch.blocked = false;
            ch.el.play().catch(() => { ch.blocked = true; });
        }
        return;
    }
    musicIsPlaying = true;
    if (!ch.running) {
        ch.level = fade > 0 ? 0 : 1;
        if (ch.engine === 'webaudio' && fade > 0) ch.fadeIn = fade;
        musicStartChannel(ch);
    }
    musicFade(ch, 1, fade);
}

/**
 * Suena una vez, sin bucle (los jingles). No toca la pista actual.
 * @param {string} id
 */
function musicPlayOneShot(id) {
    if (!settings.musicEnabled) return;
    const ch = musicChannel(id);
    if (ch.running) musicHaltChannel(ch, true);
    ch.level = 1;
    musicStartChannel(ch);
}

/**
 * Velocidad de reproducción de la pista actual (el falso final la usa).
 * Sin pista actual no hace nada.
 * @param {number} r
 */
function musicSetRate(r) {
    if (!musicCurrentId) return;
    const ch = musicChannel(musicCurrentId);
    if (ch.rate === r) return;
    if (ch.source) {
        // Pliega el tramo sonado a la velocidad anterior antes de cambiarla
        ch.startOffset = musicPosition(ch);
        ch.startedAt = getAudioContext().currentTime;
        ch.source.playbackRate.value = r;
    }
    ch.rate = r;
    try {
        if (ch.el) ch.el.playbackRate = r;
    } catch (err) { /* navegador quisquilloso con velocidades bajas */ }
}

/**
 * Volumen de la música, de 0 a 1.
 * @param {number} v
 */
function musicSetVolume(v) {
    musicVolumeLevel = v;
    musicApplyBus();
    for (const ch of Object.values(musicChannels)) musicApplyVolume(ch);
}

/**
 * Rebaja la música (−8 dB) mientras la partida está en pausa.
 * @param {boolean} on
 */
function musicSetDuck(on) {
    if (musicDucked === !!on) return;
    musicDucked = !!on;
    musicApplyBus();
    if (musicCurrentId && musicChannels[musicCurrentId]) musicApplyVolume(musicChannels[musicCurrentId]);
}

// -----------------------------------------------------------------
//  Música dinámica
// -----------------------------------------------------------------

/** Decibelios a multiplicador de ganancia. */
function musicDbGain(db) {
    return Math.pow(10, db / 20);
}

/** El multiplicador al que tiene que ir la música: la bajada más fuerte por la subida. */
function musicDynTarget() {
    let g = musicHoldGain;
    for (const d of musicDucks) g = Math.min(g, d.gain);
    return g * musicBoostGain;
}

/** El GainNode dinámico del motor A, creado la primera vez. */
function musicDynBus() {
    if (!musicDynNode) {
        musicDynNode = getAudioContext().createGain();
        musicDynNode.gain.value = musicDynLevel;
        musicDynNode.connect(musicBus);
    }
    return musicDynNode;
}

/**
 * Lleva el multiplicador dinámico a su objetivo en `seconds`: rampa en el
 * reloj de audio (motor A) y pasos de 50 ms sobre cada <audio> (motor B).
 * @param {number} seconds
 */
function musicDynRetarget(seconds) {
    const target = musicDynTarget();
    if (musicDynNode) {
        const g = musicDynNode.gain;
        const now = getAudioContext().currentTime;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(target, now + Math.max(0.001, seconds));
    }
    if (musicDynTimer !== null) {
        clearInterval(musicDynTimer);
        musicDynTimer = null;
    }
    const apply = () => { for (const ch of Object.values(musicChannels)) musicApplyVolume(ch); };
    const from = musicDynLevel;
    if (seconds <= 0 || from === target) {
        musicDynLevel = target;
        apply();
        return;
    }
    const steps = Math.max(1, Math.round(seconds * 1000 / MUSIC_FADE_STEP_MS));
    let i = 0;
    musicDynTimer = setInterval(() => {
        i++;
        musicDynLevel = from + (target - from) * (i / steps);
        apply();
        if (i >= steps) {
            clearInterval(musicDynTimer);
            musicDynTimer = null;
        }
    }, MUSIC_FADE_STEP_MS);
}

/**
 * Baja la música `db` decibelios durante `holdMs`, con fundidos (gol,
 * smash). Varios a la vez: manda el más fuerte. Sin música dinámica
 * no hace nada.
 * @param {number} db
 * @param {number} holdMs
 * @param {{ attack?: number, release?: number }} [opts] segundos del fundido al bajar y al subir
 */
function musicDuck(db, holdMs, { attack = 0.08, release = 0.4 } = {}) {
    if (!settings.dynamicMusic || db <= 0) return;
    const duck = { gain: musicDbGain(-db) };
    musicDucks.push(duck);
    musicDynRetarget(attack);
    setTimeout(() => {
        const i = musicDucks.indexOf(duck);
        if (i < 0) return;   // musicDuckReset() ya la quitó
        musicDucks.splice(i, 1);
        musicDynRetarget(release);
    }, attack * 1000 + holdMs);
}

/**
 * Bajada sin tiempo (el punto de partido): se queda hasta que se pida 0.
 * Cuenta con las de musicDuck: manda la más fuerte.
 * @param {number} db 0 la quita
 */
function musicDuckHold(db) {
    const g = db > 0 && settings.dynamicMusic ? musicDbGain(-db) : 1;
    if (g === musicHoldGain) return;
    musicHoldGain = g;
    musicDynRetarget(g < 1 ? 0.3 : 0.4);
}

/**
 * Subida de la música (la fiebre larga). Con el motor B no pasa del
 * volumen 1 del <audio>.
 * @param {number} db 0 la quita
 */
function musicSetBoost(db) {
    const g = db > 0 && settings.dynamicMusic ? musicDbGain(db) : 1;
    if (g === musicBoostGain) return;
    musicBoostGain = g;
    musicDynRetarget(0.4);
}

/** Quita toda la música dinámica al momento (empezar o abandonar una partida, apagar el ajuste). */
function musicDuckReset() {
    musicDucks.length = 0;
    musicHoldGain = 1;
    musicBoostGain = 1;
    musicDynRetarget(0);
}

/**
 * Adelanta la carga de una pista (solo el motor A carga por adelantado).
 * @param {string} id
 */
function musicPreload(id) {
    const ch = musicChannel(id);
    if (ch.engine === 'webaudio') musicLoad(ch);
}

/** @returns {string|null} la pista actual, o null */
function musicCurrent() {
    return musicCurrentId;
}
