/**
 * tests/runner.js
 * ------------------------------------------------------------------
 * Ejecuta escenarios deterministas contra el juego real y los compara
 * con las referencias grabadas (tests/golden).
 *
 * Cómo funciona:
 *   1. Se descarga index.html y se carga en un iframe (srcdoc) con el
 *      harness inyectado antes de cualquier script del juego y un
 *      adaptador de lectura inyectado después.
 *   2. El juego avanza SOLO cuando el runner llama a step(): un fotograma
 *      del reloj virtual, sus temporizadores y su requestAnimationFrame.
 *   3. Se maneja como caja negra: eventos de teclado reales para jugar y
 *      clics sobre botones localizados por su texto visible.
 *   4. En cada paso se guarda el hash del estado de la partida; cada 120
 *      pasos, y tras cada acción de interfaz, una instantánea completa
 *      (estado, almacenamiento, DOM visible, audio y píxeles del canvas).
 * ------------------------------------------------------------------
 */
import { canonical, fnv, fnvBytes, mulberry32, diff } from './lib/canonical.js';
import { snapshotDom } from './lib/dom.js';

/** Raíz del juego (la carpeta que contiene index.html). */
const GAME_ROOT = new URL('../', import.meta.url).href;
const CHECKPOINT_EVERY = 120;
const VIEWPORT = { width: 1024, height: 768 };

/** Época virtual: mediodía UTC, para que la zona horaria no cambie las fechas. */
const EPOCH_MS = Date.UTC(2026, 0, 15, 12, 0, 0);

// ==================================================================
//  Carga del juego
// ==================================================================

/**
 * Carga el juego en un iframe con el harness instalado.
 * @param {HTMLElement} host contenedor donde se monta el iframe
 * @param {{seed:number, storage?:Record<string,string>, width?:number, height?:number, traceRandom?:number}} opts
 */
export async function loadGame(host, opts) {
    const html = await (await fetch(GAME_ROOT + 'index.html', { cache: 'no-store' })).text();
    const adapter = 'globals';

    const config = { seed: opts.seed, storage: opts.storage || {}, epochMs: EPOCH_MS, traceRandom: opts.traceRandom || 0 };
    const head = `<base href="${GAME_ROOT}">`
        + `<script>window.__HARNESS_CONFIG__ = ${JSON.stringify(config)};<\/script>`
        + `<script src="tests/harness/install.js"><\/script>`;
    const adapterTag = '<script src="tests/adapters/globals.js"><\/script>';
    const srcdoc = html
        .replace(/<head>/i, '<head>' + head)
        .replace(/<\/body>/i, adapterTag + '</body>');

    const iframe = document.createElement('iframe');
    iframe.width = String(opts.width || VIEWPORT.width);
    iframe.height = String(opts.height || VIEWPORT.height);
    iframe.style.border = '0';
    await new Promise((resolve) => {
        iframe.addEventListener('load', resolve, { once: true });
        iframe.srcdoc = srcdoc;
        host.appendChild(iframe);
    });

    const win = /** @type {any} */ (iframe.contentWindow);
    const doc = /** @type {Document} */ (iframe.contentDocument);
    // El canvas dibuja con estas fuentes: sin esperarlas, los píxeles
    // dependerían de la velocidad de la red.
    await Promise.all([
        doc.fonts.load('20px "Press Start 2P"'),
        doc.fonts.load('16px "Space Grotesk"')
    ]).catch(() => {});
    await doc.fonts.ready;
    if (!doc.fonts.check('20px "Press Start 2P"')) {
        throw new Error('La fuente "Press Start 2P" no cargó (¿sin conexión?): los píxeles del canvas no serían comparables');
    }

    if (!win.__harness) throw new Error('El harness no se instaló');
    if (!win.__pong) throw new Error('El adaptador no se cargó (¿error en el juego?): ' + win.__harness.errors.join(' | '));
    return { iframe, win, doc, adapter };
}

// ==================================================================
//  Grabación del estado
// ==================================================================

class Recorder {
    /** @param {{win:any, doc:Document, adapter:string}} game */
    constructor(game) {
        this.win = game.win;
        this.doc = game.doc;
        this.H = game.win.__harness;
        this.P = game.win.__pong;
        /** @type {string[]} */
        this.light = [];
        /** @type {Array<[number, string, Record<string,string>]>} */
        this.checkpoints = [];
        /** @type {Array<[number, string]>} */
        this.diag = [];
        this.events = new Set();
        this.prev = null;
        this.final = null;
    }

    /** Estado de la partida que se hashea en cada paso. */
    lightState() {
        return {
            match: this.P.match(),
            boss: this.P.boss(),
            powerups: this.P.powerups(),
            campaign: this.P.campaign(),
            particles: fnv(canonical(this.P.particles())),
            // Cuántos números aleatorios ha pedido el juego: si el refactor
            // cambia una sola llamada, se ve en el fotograma exacto.
            rng: this.H.randomCalls
        };
    }

    async step() {
        this.H.step();
        await null;
        const s = this.lightState();
        this.light.push(fnv(canonical(s)));
        this.detectEvents(s);
        this.prev = s;
        if (this.H.frame % CHECKPOINT_EVERY === 0) this.checkpoint('auto');
    }

    /** @param {string} id */
    isScreen(id) {
        const el = this.doc.getElementById(id);
        return !!el && el.classList.contains('active-screen');
    }

    /** Eventos observados: sirven para comprobar que el escenario cubre lo que dice. */
    detectEvents(s) {
        const p = this.prev;
        const ev = (e) => this.events.add(e);
        const m = s.match;
        if (m.isPlaying && !(p && p.match.isPlaying)) ev('start:' + m.mode);
        if (!m.isPlaying && p && p.match.isPlaying) ev('end:' + m.mode);
        if (m.isPaused) ev('paused');
        if (m.balls.length > 1) ev('multiball');
        if (s.powerups.effect) ev('effect:' + s.powerups.effect.type);
        if (p && p.powerups.field && s.powerups.collectedThisGame > p.powerups.collectedThisGame) {
            ev('collect:' + p.powerups.field.type);
        }
        if (s.campaign.isDialogueActive) ev('dialogue');
        // Mecánicas de golpe: los contadores de game/mechanics.js
        const hits = this.P.diag().mechHits;
        for (const k of ['perfect', 'edge', 'block', 'smash', 'super', 'spin']) if (hits[k] > 0) ev('mech:' + k);
        if (m.fever) ev('mech:fever');
        // El escudo se rompe tras gastar su último bloqueo
        if (p && p.powerups.shield && p.powerups.shield.hp === 1 && !s.powerups.shield) ev('shield:spent');
        // Cámara lenta del Flash Épico: no debe pasar de una partida a la siguiente
        if (this.P.diag().goalSlowmoTimer > 0) {
            ev('goal:slowmo');
            if (m.isPlaying && !(p && p.match.isPlaying)) ev('slowmo-al-empezar');
        }
        if (s.boss) {
            ev('boss:' + s.boss.level);
            if (s.boss.hidesBall) ev('boss:hidesBall');
            if (s.boss.freezesPlayer) ev('boss:freezes');
            if (s.boss.invertsControls) ev('boss:inverts');
            if (s.boss.armored.some(Boolean)) ev('boss:armored');
            if (s.boss.config.useHealth && s.boss.health <= 0) ev('boss:defeated');
            if (m.twin.retreatMs > 0) ev('duo:retreat');
            const bs = this.P.diag().bossState;
            if (bs && s.boss.level === 6) {
                ev('creator:phase' + bs.phase);
                if (bs.warpPhase === 'warning') ev('creator:warp');
                if (bs.beamPhase === 'fire') ev('creator:beam');
            }
        }
        for (const id of ['game-over-screen', 'finale-screen', 'vs-screen', 'pause-menu', 'news-screen', 'howto-menu']) {
            if (this.isScreen(id)) ev('screen:' + id);
        }
        // Aviso de reinicio del progreso (fase 4) dentro de las Novedades
        const reset = this.doc.getElementById('news-reset');
        if (this.isScreen('news-screen') && reset && !reset.classList.contains('hidden')) ev('news:reset');
    }

    /**
     * Píxeles del canvas del juego.
     *
     * Nunca se lee del canvas del juego directamente: tras varias lecturas
     * el navegador lo pasa a renderizado por software de forma permanente.
     * Eso hace cada fotograma ~40 veces más lento y, peor, cambia los
     * píxeles (GPU y CPU no antialiasan igual), con lo que el resultado
     * dependería de en qué momento ocurriera el cambio. Se copia a un
     * canvas propio y se lee de la copia.
     */
    canvasHash() {
        const canvas = /** @type {HTMLCanvasElement|null} */ (this.doc.getElementById('pongCanvas'));
        if (!canvas) return 'none';
        if (!this.copy) {
            this.copy = document.createElement('canvas');
            this.copyCtx = this.copy.getContext('2d', { willReadFrequently: true });
        }
        this.copy.width = canvas.width;
        this.copy.height = canvas.height;
        this.copyCtx.drawImage(canvas, 0, 0);
        return fnvBytes(this.copyCtx.getImageData(0, 0, canvas.width, canvas.height).data);
    }

    /** Instantánea completa en el paso actual. */
    sections() {
        return {
            match: { match: this.P.match(), particles: this.P.particles() },
            boss: this.P.boss(),
            powerups: this.P.powerups(),
            campaign: this.P.campaign(),
            storage: parseStorage(this.H.storage()),
            memory: this.P.memory(),
            dom: snapshotDom(this.doc),
            audio: this.H.drainAudio()
        };
    }

    /** @param {string} label */
    checkpoint(label) {
        const sections = this.sections();
        /** @type {Record<string,string>} */
        const hashes = {};
        for (const [k, v] of Object.entries(sections)) hashes[k] = fnv(canonical(v));
        hashes.canvas = this.canvasHash();
        this.checkpoints.push([this.H.frame, label, hashes]);
        this.diag.push([this.H.frame, fnv(canonical(this.P.diag()))]);
        // Se conserva entera la última para poder dar un diff legible.
        this.final = JSON.parse(canonical({ ...sections, canvas: hashes.canvas }));
    }
}

/** @param {Record<string,string>} raw */
function parseStorage(raw) {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
        try { out[k] = JSON.parse(v); } catch { out[k] = v; }
    }
    return out;
}

// ==================================================================
//  Bot de juego
// ==================================================================

/**
 * Jugador automático que pulsa teclas reales. Usa su propio generador
 * aleatorio para no consumir los números del juego.
 */
class Bot {
    /**
     * @param {{side:'p1'|'p2', seed:number, react?:number, noise?:number, deadzone?:number, edge?:number, mouse?:boolean, touch?:boolean, smash?:boolean, smashChance?:number, brake?:boolean}} opts
     */
    constructor(opts) {
        this.side = opts.side;
        this.mouse = !!opts.mouse;           // mueve el ratón en vez de pulsar teclas
        this.touch = !!opts.touch;           // arrastra un dedo en vez de pulsar teclas
        this.touching = false;
        this.rand = mulberry32(opts.seed);
        this.react = opts.react ?? 1;        // cada cuántos fotogramas decide
        this.noise = opts.noise ?? 0;        // error de puntería en píxeles
        this.deadzone = opts.deadzone ?? 6;
        this.edge = opts.edge ?? 0;          // golpear con el borde: devoluciones con ángulo
        this.brake = opts.brake ?? true;     // con teclado, suelta antes contando la inercia de la paleta
        this.smash = !!opts.smash;           // mantiene el smash cuando viene la bola y suelta justo antes
        this.smashChance = opts.smashChance ?? 0.6;   // en qué fracción de las devoluciones lo intenta
        this.smashThis = false;
        this.smashHeld = false;
        this.smashKey = null;
        this.wasToward = false;
        this.offset = 0;
        this.held = null;                    // tecla pulsada ahora
        this.frame = 0;
    }

    /**
     * @param {any} match estado de la partida
     * @param {any} settings ajustes del juego (para las teclas asignadas)
     * @param {any} H harness
     */
    act(match, settings, H, doc) {
        if (this.frame++ % this.react !== 0) return;
        const me = this.side === 'p1' ? match.p1 : match.p2;
        const balls = match.balls;
        if (!balls.length) return;
        const toward = (b) => (this.side === 'p1' ? b.dx < 0 : b.dx > 0);
        const target = balls.find(toward) || balls[0];
        const isToward = toward(target);
        if (this.edge && isToward && !this.wasToward) {
            // Al venir la bola, elige con qué borde la golpeará esta vez.
            this.offset = (this.rand() < 0.5 ? -1 : 1) * this.edge + (this.rand() * 2 - 1) * this.noise;
        } else if (!this.edge && this.rand() < 0.08) {
            this.offset = (this.rand() * 2 - 1) * this.noise;
        }
        if (this.smash && isToward && !this.wasToward) this.smashThis = this.rand() < this.smashChance;
        this.wasToward = isToward;

        const rotated = this.side === 'p1' && me.height < me.width;   // arena del Creador
        const center = rotated ? me.x + me.width / 2 : me.y + me.height / 2;
        const goal = (rotated ? target.x : target.y) + this.offset;

        if (this.smash) this.actSmash(me, target, isToward, rotated, settings, H);

        if (this.mouse) {
            moveMouse(doc, rotated ? goal : null, rotated ? null : goal);
            return;
        }
        if (this.touch) {
            // Cada jugador arrastra en su mitad: así el juego asigna bien la paleta.
            const gx = rotated ? goal : (this.side === 'p1' ? 100 : 700);
            touch(doc, this.touching ? 'touchmove' : 'touchstart', this.side === 'p1' ? 1 : 2, gx, rotated ? 300 : goal);
            this.touching = true;
            return;
        }

        const upKey = settings.bindings[this.side === 'p1' ? 'p1Up' : 'p2Up'];
        const downKey = settings.bindings[this.side === 'p1' ? 'p1Down' : 'p2Down'];
        // La paleta tiene inercia: sigue avanzando ~1,2 fotogramas de su
        // velocidad tras soltar, así que se decide con dónde se parará.
        const stop = this.brake ? center + (rotated ? me.vx : me.vy) * 1.2 : center;
        let want = null;
        if (stop < goal - this.deadzone) want = downKey;          // abajo / derecha
        else if (stop > goal + this.deadzone) want = upKey;       // arriba / izquierda

        if (want === this.held) return;
        if (this.held) H.key(this.held, 'keyup');
        if (want) H.key(want, 'keydown');
        this.held = want;
    }

    /**
     * Smash con la tecla: mantiene cuando faltan 40 fotogramas o menos para
     * el contacto y suelta a 6 (unos 100 ms), dentro de la ventana.
     */
    actSmash(me, target, isToward, rotated, settings, H) {
        let ttc = Infinity;
        if (isToward) {
            if (rotated) ttc = (me.y - (target.y + target.radius)) / Math.max(0.1, target.dy);
            else if (this.side === 'p1') ttc = (target.x - target.radius - (me.x + me.width)) / Math.max(0.1, -target.dx);
            else ttc = (me.x - (target.x + target.radius)) / Math.max(0.1, target.dx);
        }
        const want = this.smashThis && ttc <= 40 && ttc > 6;
        if (want === this.smashHeld) return;
        this.smashKey = settings.bindings[this.side === 'p1' ? 'p1Smash' : 'p2Smash'];
        H.key(this.smashKey, want ? 'keydown' : 'keyup');
        this.smashHeld = want;
    }

    /**
     * @param {any} H
     * @param {Document} doc
     */
    release(H, doc) {
        if (this.held) H.key(this.held, 'keyup');
        this.held = null;
        if (this.smashHeld) H.key(this.smashKey, 'keyup');
        this.smashHeld = false;
        if (this.touching) touch(doc, 'touchend', this.side === 'p1' ? 1 : 2, 400, 300);
        this.touching = false;
    }
}

/**
 * Mueve el ratón sobre el canvas a unas coordenadas lógicas del juego
 * (800x600). La coordenada que falte se deja en el centro.
 * @param {Document} doc
 * @param {number|null} gx
 * @param {number|null} gy
 */
function moveMouse(doc, gx, gy) {
    const canvas = /** @type {HTMLCanvasElement} */ (doc.getElementById('pongCanvas'));
    const r = canvas.getBoundingClientRect();
    const x = r.left + ((gx ?? 400) / 800) * r.width;
    const y = r.top + ((gy ?? 300) / 600) * r.height;
    const win = /** @type {any} */ (doc.defaultView);
    win.__harness.inGame(() => {
        canvas.dispatchEvent(new win.MouseEvent('mouseenter', { clientX: x, clientY: y }));
        canvas.dispatchEvent(new win.MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
    });
}

/**
 * Lanza un evento táctil sobre el canvas en coordenadas lógicas del juego.
 * @param {Document} doc
 * @param {'touchstart'|'touchmove'|'touchend'} type
 * @param {number} id identificador del dedo
 * @param {number} gx
 * @param {number} gy
 */
function touch(doc, type, id, gx, gy) {
    const canvas = /** @type {HTMLCanvasElement} */ (doc.getElementById('pongCanvas'));
    const r = canvas.getBoundingClientRect();
    const win = /** @type {any} */ (doc.defaultView);
    const t = new win.Touch({
        identifier: id, target: canvas,
        clientX: r.left + (gx / 800) * r.width,
        clientY: r.top + (gy / 600) * r.height
    });
    win.__harness.inGame(() => canvas.dispatchEvent(new win.TouchEvent(type, {
        changedTouches: [t], touches: type === 'touchend' ? [] : [t],
        bubbles: true, cancelable: true
    })));
}

// ==================================================================
//  Acciones de los escenarios
// ==================================================================

/** @param {string} s */
const norm = (s) => s.replace(/\s+/g, ' ').trim();

/** @param {Element} el */
function isVisible(el) {
    const style = el.ownerDocument.defaultView.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return /** @type {HTMLElement} */ (el).offsetParent !== null || style.position === 'fixed';
}

/**
 * Localiza un control por su nombre dentro de la pantalla activa: su
 * aria-label si lo tiene (botones de solo icono, tiles con subtítulo) y
 * si no, su texto visible.
 * @param {Document} doc
 * @param {string} text
 */
function findByText(doc, text) {
    const roots = [...doc.querySelectorAll('.screen.active-screen')];
    const container = doc.getElementById('game-container');
    if (container && !container.classList.contains('hidden')) roots.push(container);
    const found = [];
    for (const root of roots) {
        for (const el of root.querySelectorAll('button, [onclick], [data-action]')) {
            const name = el.getAttribute('aria-label') ?? el.textContent ?? '';
            if (norm(name) === text && isVisible(el)) found.push(el);
        }
    }
    if (found.length !== 1) {
        throw new Error(`Se esperaba 1 control visible con el nombre "${text}" y hay ${found.length}`);
    }
    return /** @type {HTMLElement} */ (found[0]);
}

/**
 * @param {Document} doc
 * @param {string} sel
 */
function findBySelector(doc, sel) {
    const el = doc.querySelector(sel);
    if (!el) throw new Error(`No existe "${sel}"`);
    if (!isVisible(el)) throw new Error(`"${sel}" no está visible`);
    return /** @type {HTMLElement} */ (el);
}

/**
 * Ejecuta una acción de un escenario.
 * @param {Recorder} rec
 * @param {any} a
 * @param {number} index
 */
async function perform(rec, a, index) {
    const { doc, win, H } = rec;
    switch (a.type) {
        case 'click': {
            const el = findByText(doc, a.text);
            H.inGame(() => el.click());
            break;
        }
        case 'clickSel': {
            const el = findBySelector(doc, a.sel);
            H.inGame(() => el.click());
            break;
        }
        case 'input': {
            const el = /** @type {HTMLInputElement} */ (findBySelector(doc, '#' + a.id));
            el.value = String(a.value);
            H.inGame(() => el.dispatchEvent(new win.Event('input', { bubbles: true })));
            break;
        }
        case 'change': {
            const el = /** @type {HTMLInputElement} */ (findBySelector(doc, '#' + a.id));
            if ('checked' in a) el.checked = a.checked;
            else el.value = String(a.value);
            H.inGame(() => el.dispatchEvent(new win.Event('change', { bubbles: true })));
            break;
        }
        case 'key':
            H.key(a.code, 'keydown');
            H.key(a.code, 'keyup');
            break;
        case 'steps':
            for (let i = 0; i < a.n; i++) await rec.step();
            return;   // los pasos ya graban sus propias instantáneas
        case 'play':
            await play(rec, a);
            return;
        case 'checkpoint':
            break;
        default:
            throw new Error('Acción desconocida: ' + a.type);
    }
    rec.checkpoint(a.label || `${a.type}#${index}`);
}

/**
 * Juega con uno o dos bots hasta que se cumpla la condición.
 * @param {Recorder} rec
 * @param {any} a
 */
async function play(rec, a) {
    const bots = [new Bot({ side: 'p1', seed: 1000 + (a.seed || 0), ...a.bot })];
    if (a.bot2) bots.push(new Bot({ side: 'p2', seed: 2000 + (a.seed || 0), ...a.bot2 }));
    const max = a.max || 20000;
    for (let i = 0; i < max; i++) {
        const match = rec.P.match();
        const settings = rec.P.memory().settings;
        for (const b of bots) b.act(match, settings, rec.H, rec.doc);
        await rec.step();
        if (until(rec, a.until)) break;
    }
    for (const b of bots) b.release(rec.H, rec.doc);
    rec.checkpoint('play-end');
}

/**
 * @param {Recorder} rec
 * @param {string} cond
 */
function until(rec, cond) {
    if (!cond) return false;
    if (cond.includes('|')) return cond.split('|').some((c) => until(rec, c));
    if (cond === 'gameover') return rec.isScreen('game-over-screen');
    if (cond === 'finale') return rec.isScreen('finale-screen');
    if (cond === 'stopped') return !rec.P.match().isPlaying;
    if (cond === 'goal') { const m = rec.P.match(); return m.p1Score + m.p2Score > 0; }
    if (cond.startsWith('event:')) return rec.events.has(cond.slice(6));
    if (cond.startsWith('screen:')) return rec.isScreen(cond.slice(7));
    throw new Error('Condición desconocida: ' + cond);
}

// ==================================================================
//  Escenarios y comparación
// ==================================================================

/**
 * Ejecuta un escenario completo.
 * @param {HTMLElement} host
 * @param {any} scn
 */
export async function runScenario(host, scn) {
    const game = await loadGame(host, { seed: scn.seed, storage: scn.storage });
    const rec = new Recorder(game);
    let failure = null;
    try {
        rec.checkpoint('load');
        for (const [i, a] of scn.actions.entries()) await perform(rec, a, i);
        rec.checkpoint('end');
    } catch (err) {
        failure = String(err && err.stack || err);
    } finally {
        game.iframe.remove();
    }
    return {
        format: 1,
        scenario: scn.name,
        seed: scn.seed,
        adapter: game.adapter,
        env: environment(),
        frames: rec.H.frame,
        light: rec.light.join(''),
        checkpoints: rec.checkpoints,
        diag: rec.diag,
        events: [...rec.events].sort(),
        errors: [...rec.H.errors, ...(failure ? [failure] : [])],
        final: rec.final
    };
}

function environment() {
    return {
        ua: navigator.userAgent,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dpr: window.devicePixelRatio
    };
}

/**
 * Compara un resultado con su referencia.
 * Devuelve errores (bloquean) y avisos (solo informan).
 * @param {any} golden
 * @param {any} got
 * @param {any} scn
 */
export function compare(golden, got, scn) {
    const errors = [];
    const warnings = [];
    if (got.errors.length) errors.push('Errores del juego: ' + got.errors.join(' | '));

    for (const e of scn.expect || []) {
        if (!got.events.includes(e)) errors.push(`El escenario no pasó por "${e}"`);
    }
    for (const e of scn.expectNot || []) {
        if (got.events.includes(e)) errors.push(`El escenario pasó por "${e}" y no debía`);
    }
    if (!golden) return { errors, warnings: ['Sin referencia grabada'] };

    const sameEnv = golden.env.ua === got.env.ua && golden.env.dpr === got.env.dpr;
    if (!sameEnv) warnings.push('Navegador distinto al de la grabación: se ignoran los píxeles del canvas');

    if (golden.frames !== got.frames) errors.push(`Fotogramas: esperados ${golden.frames}, obtenidos ${got.frames}`);

    // Primer paso con un estado distinto.
    const n = Math.min(golden.light.length, got.light.length) / 8;
    for (let i = 0; i < n; i++) {
        if (golden.light.substr(i * 8, 8) !== got.light.substr(i * 8, 8)) {
            errors.push(`El estado de la partida diverge en el fotograma ${i + 1}`);
            break;
        }
    }

    // Primera instantánea distinta, por secciones.
    const m = Math.min(golden.checkpoints.length, got.checkpoints.length);
    if (golden.checkpoints.length !== got.checkpoints.length) {
        errors.push(`Instantáneas: esperadas ${golden.checkpoints.length}, obtenidas ${got.checkpoints.length}`);
    }
    for (let i = 0; i < m; i++) {
        const [gf, gl, gh] = golden.checkpoints[i];
        const [of, ol, oh] = got.checkpoints[i];
        const bad = Object.keys(gh).filter((k) => gh[k] !== oh[k] && (k !== 'canvas' || sameEnv));
        if (gf !== of || gl !== ol || bad.length) {
            errors.push(`Instantánea ${i} (fotograma ${gf}, "${gl}") distinta en: ${bad.join(', ') || 'posición'}`);
            break;
        }
    }

    if (canonical(golden.events) !== canonical(got.events)) {
        errors.push(`Eventos distintos: ${diff(golden.events, got.events).join('; ')}`);
    }

    if (golden.final && got.final) {
        const { canvas: gc, ...gRest } = golden.final;
        const { canvas: oc, ...oRest } = got.final;
        const d = diff(gRest, oRest);
        if (d.length) errors.push('Estado final distinto:\n  ' + d.join('\n  '));
        if (sameEnv && gc !== oc) errors.push('Píxeles finales del canvas distintos');
    }

    const diagMismatch = golden.diag.findIndex((g, i) => !got.diag[i] || got.diag[i][1] !== g[1]);
    if (diagMismatch >= 0) warnings.push(`Diagnóstico interno distinto desde el fotograma ${golden.diag[diagMismatch][0]}`);

    return { errors, warnings };
}
