/**
 * tests/harness/install.js
 * ------------------------------------------------------------------
 * Se ejecuta DENTRO del iframe del juego, antes que cualquier script
 * del propio juego. Sustituye todo lo que no es determinista por una
 * versión controlada, para que una misma partida produzca exactamente
 * el mismo estado en cada ejecución:
 *
 *   Math.random            → mulberry32 con semilla
 *   Date / performance.now → reloj virtual (avanza un fotograma por paso)
 *   setTimeout/Interval    → cola virtual ordenada por vencimiento
 *   requestAnimationFrame  → cola que solo avanza con step()
 *   localStorage           → almacén en memoria (no toca el progreso real)
 *   AudioContext / Audio   → versiones que registran lo que suena
 *   confirm, matchMedia, maxTouchPoints → valores fijos
 *
 * La configuración llega en window.__HARNESS_CONFIG__ y el control se
 * expone en window.__harness. Ver tests/README.md.
 * ------------------------------------------------------------------
 */
(function () {
    'use strict';

    /** El harness sustituye globales del navegador a propósito: sin tipos. */
    const win = /** @type {any} */ (window);
    const cfg = win.__HARNESS_CONFIG__ || {};
    const MS_PER_FRAME = 1000 / 60;

    /** Errores no capturados del juego: un test con errores falla. */
    const errors = [];
    window.addEventListener('error', (e) => {
        errors.push(String(e.message || e.error || e));
    });
    window.addEventListener('unhandledrejection', (e) => {
        errors.push('Promesa rechazada: ' + String(e.reason));
    });

    // ------------------------------------------------------------------
    //  Azar
    // ------------------------------------------------------------------
    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    // Dos generadores. El del juego solo responde mientras el harness está
    // ejecutando código del juego (un fotograma, un clic, una tecla): Tailwind
    // por CDN también llama a Math.random cuando reprocesa clases, desde
    // callbacks del navegador cuyo número no es estable, y si compartiera
    // generador con el juego le robaría números de forma impredecible.
    const gamePrng = mulberry32(cfg.seed || 1);
    const otherPrng = mulberry32((cfg.seed || 1) ^ 0x9E3779B9);
    let inGameCode = false;
    let randomCalls = 0;
    /** Con cfg.traceRandom se guarda quién pidió cada número (para depurar). */
    const randomTrace = [];
    Math.random = function () {
        if (!inGameCode) return otherPrng();
        randomCalls++;
        if (cfg.traceRandom && randomTrace.length < cfg.traceRandom) {
            randomTrace.push((new Error().stack || '').split('\n').slice(2, 5).join(' | '));
        }
        return gamePrng();
    };

    /**
     * Ejecuta `fn` marcándolo como código del juego (usa su generador).
     * @template T
     * @param {() => T} fn
     * @returns {T}
     */
    function inGame(fn) {
        const prev = inGameCode;
        inGameCode = true;
        try {
            return fn();
        } finally {
            inGameCode = prev;
        }
    }

    // ------------------------------------------------------------------
    //  Reloj virtual
    // ------------------------------------------------------------------
    let frame = 0;
    let clock = 0;                       // ms virtuales desde el inicio
    const EPOCH = cfg.epochMs || Date.UTC(2026, 0, 15, 12, 0, 0);

    const RealDate = Date;
    class VirtualDate extends RealDate {
        constructor(...args) {
            if (args.length === 0) super(EPOCH + clock);
            else super(.../** @type {[any]} */ (args));
        }
        static now() { return EPOCH + clock; }
    }
    win.Date = VirtualDate;
    Object.defineProperty(window.performance, 'now', {
        value: () => clock,
        configurable: true
    });

    // ------------------------------------------------------------------
    //  Temporizadores virtuales
    // ------------------------------------------------------------------
    let seq = 0;
    let nextTimerId = 1;
    /** @type {Map<number, {due:number, seq:number, fn:Function, args:any[], interval:number|null}>} */
    const timers = new Map();

    win.setTimeout = function (fn, delay, ...args) {
        const id = nextTimerId++;
        timers.set(id, { due: clock + Math.max(0, Number(delay) || 0), seq: seq++, fn, args, interval: null });
        return id;
    };
    win.setInterval = function (fn, delay, ...args) {
        const id = nextTimerId++;
        // Un intervalo de 0 ms colgaría el paso: el mínimo es 1 ms virtual.
        const every = Math.max(1, Number(delay) || 0);
        timers.set(id, { due: clock + every, seq: seq++, fn, args, interval: every });
        return id;
    };
    window.clearTimeout = window.clearInterval = function (id) {
        timers.delete(id);
    };

    /** Ejecuta, en orden, todos los temporizadores que vencen hasta `clock`. */
    function runDueTimers() {
        let guard = 0;
        for (;;) {
            let bestId = null;
            let best = null;
            for (const [id, t] of timers) {
                if (t.due > clock) continue;
                if (!best || t.due < best.due || (t.due === best.due && t.seq < best.seq)) {
                    best = t;
                    bestId = id;
                }
            }
            if (!best) return;
            if (best.interval !== null) {
                best.due += best.interval;
                best.seq = seq++;
            } else {
                timers.delete(bestId);
            }
            best.fn.apply(window, best.args);
            if (++guard > 20000) throw new Error('harness: bucle infinito de temporizadores');
        }
    }

    // ------------------------------------------------------------------
    //  requestAnimationFrame virtual
    // ------------------------------------------------------------------
    let rafQueue = [];
    let nextRafId = 1;
    window.requestAnimationFrame = function (cb) {
        const id = nextRafId++;
        rafQueue.push({ id, cb });
        return id;
    };
    window.cancelAnimationFrame = function (id) {
        rafQueue = rafQueue.filter((r) => r.id !== id);
    };

    /** Avanza un fotograma: reloj, temporizadores vencidos y callbacks de rAF. */
    function step() {
        inGame(() => {
            frame++;
            clock = frame * MS_PER_FRAME;     // multiplicar, no acumular
            runDueTimers();
            const queue = rafQueue;
            rafQueue = [];
            for (const r of queue) r.cb(clock);
        });
    }

    // ------------------------------------------------------------------
    //  localStorage en memoria
    // ------------------------------------------------------------------
    const store = new Map(Object.entries(cfg.storage || {}));
    const memoryStorage = {
        getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
        setItem: (k, v) => { store.set(String(k), String(v)); },
        removeItem: (k) => { store.delete(String(k)); },
        clear: () => { store.clear(); },
        key: (i) => [...store.keys()][i] ?? null,
        get length() { return store.size; }
    };
    Object.defineProperty(window, 'localStorage', { value: memoryStorage, configurable: true });

    // ------------------------------------------------------------------
    //  Diálogos y entorno
    // ------------------------------------------------------------------
    window.confirm = () => true;
    window.alert = () => {};
    window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false; }
    });
    Object.defineProperty(window.navigator, 'maxTouchPoints', { get: () => 0, configurable: true });

    // ------------------------------------------------------------------
    //  Audio que registra
    // ------------------------------------------------------------------
    /** Cada entrada: [tipo, fotograma, ...datos]. */
    const audioLog = [];

    /**
     * Parámetro de audio. `value` es el último valor fijado con
     * setValueAtTime; las rampas guardan su destino en `end` sin tocarlo.
     * `peak` es el mayor valor programado (fijado o de rampa): para una
     * envolvente 0 → pico → 0 es lo que se registra como volumen del tono.
     */
    class FakeParam {
        constructor(value) { this.value = value; this.end = value; this.peak = -Infinity; }
        _note(v) { if (v > this.peak) this.peak = v; }
        setValueAtTime(v) { this.value = v; this.end = v; this._note(v); return this; }
        exponentialRampToValueAtTime(v) { this.end = v; this._note(v); return this; }
        linearRampToValueAtTime(v) { this.end = v; this._note(v); return this; }
        setTargetAtTime(v) { this.end = v; this._note(v); return this; }
        cancelScheduledValues() { return this; }
    }

    /** Nodo genérico: se conecta a lo que sea y no suena. */
    const fakeNode = (fields) => Object.assign({ connect() {}, disconnect() {} }, fields);

    /** El volumen que se registra de un nodo de ganancia. */
    const gainOf = (node) => {
        if (!node || !node.gain) return null;
        return Number.isFinite(node.gain.peak) ? node.gain.peak : node.gain.value;
    };

    /*
     * A propósito NO tiene decodeAudioData: sin él, el reproductor de música
     * elige siempre el motor de <audio> (FakeAudio, que ya se registra) y la
     * música es determinista sin simular fetch.
     */
    class FakeAudioContext {
        constructor() {
            this.state = 'running';
            this.sampleRate = 44100;
            this.destination = fakeNode({});
        }
        get currentTime() { return clock / 1000; }
        resume() { return Promise.resolve(); }
        createGain() {
            return fakeNode({ gain: new FakeParam(1) });
        }
        createBiquadFilter() {
            return fakeNode({
                type: 'lowpass',
                frequency: new FakeParam(350), Q: new FakeParam(1), gain: new FakeParam(0)
            });
        }
        createDynamicsCompressor() {
            return fakeNode({
                threshold: new FakeParam(-24), knee: new FakeParam(30), ratio: new FakeParam(12),
                attack: new FakeParam(0.003), release: new FakeParam(0.25)
            });
        }
        createStereoPanner() {
            return fakeNode({ pan: new FakeParam(0) });
        }
        createBuffer(channels, length, sampleRate) {
            const data = new Float32Array(length);
            return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: () => data };
        }
        createBufferSource() {
            const ctx = this;
            const src = fakeNode({
                buffer: null, loop: false, loopStart: 0, loopEnd: 0,
                playbackRate: new FakeParam(1),
                start(when = 0, offset = 0, dur) {
                    const length = dur !== undefined ? dur : (src.buffer ? src.buffer.duration : null);
                    audioLog.push(['noise', frame, length, when - ctx.currentTime]);
                },
                stop() {}
            });
            return src;
        }
        createOscillator() {
            const ctx = this;
            const osc = {
                type: 'sine',
                frequency: new FakeParam(440),
                detune: new FakeParam(0),
                _gain: null,
                connect(node) { osc._gain = node; },
                disconnect() {},
                start() {},
                stop(when) {
                    audioLog.push(['tone', frame, osc.type, osc.frequency.value,
                        when - ctx.currentTime, gainOf(osc._gain)]);
                }
            };
            return osc;
        }
    }
    win.AudioContext = FakeAudioContext;
    win.webkitAudioContext = FakeAudioContext;

    class FakeAudio {
        constructor(src) {
            this._name = String(src || '').split('/').pop();
            this._paused = true;
            this._currentTime = 0;
            this._volume = 1;
            this._loop = false;
            this._rate = 1;
            audioLog.push(['media', frame, this._name, 'new']);
        }
        get paused() { return this._paused; }
        play() {
            this._paused = false;
            audioLog.push(['media', frame, this._name, 'play']);
            return Promise.resolve();
        }
        pause() {
            this._paused = true;
            audioLog.push(['media', frame, this._name, 'pause']);
        }
        get currentTime() { return this._currentTime; }
        set currentTime(v) { this._currentTime = v; audioLog.push(['media', frame, this._name, 'currentTime', v]); }
        get volume() { return this._volume; }
        set volume(v) { this._volume = v; audioLog.push(['media', frame, this._name, 'volume', v]); }
        get loop() { return this._loop; }
        set loop(v) { this._loop = v; audioLog.push(['media', frame, this._name, 'loop', v]); }
        get playbackRate() { return this._rate; }
        set playbackRate(v) { this._rate = v; audioLog.push(['media', frame, this._name, 'playbackRate', v]); }
    }
    win.Audio = FakeAudio;

    // ------------------------------------------------------------------
    //  Teclado: se lanza sobre el elemento con foco para que burbujee
    //  igual que una tecla real (document antes que window).
    // ------------------------------------------------------------------
    function key(code, type) {
        const target = document.activeElement || document.body;
        inGame(() => target.dispatchEvent(new KeyboardEvent(type, {
            code, key: code, bubbles: true, cancelable: true
        })));
    }

    win.__harness = {
        step,
        key,
        inGame,
        get frame() { return frame; },
        get clock() { return clock; },
        get randomCalls() { return randomCalls; },
        randomTrace,
        errors,
        drainAudio: () => audioLog.splice(0),
        storage: () => Object.fromEntries(store),
        pendingTimers: () => timers.size,
        pendingFrames: () => rafQueue.length
    };
})();
