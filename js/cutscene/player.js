/**
 * cutscene/player.js
 * ------------------------------------------------------------------
 * Reproductor de escenas: interpreta una Cutscene (data/cutscenes/)
 * paso a paso sobre su propio canvas (#cutscene-canvas), con el
 * diálogo, la narración y las tarjetas en el DOM.
 *
 *   playCutscene(def, { onEnd })  reproduce; onEnd al terminar o saltar
 *   stopCutscene()                corta sin llamar a onEnd
 *   cutscenePlaying()             ¿hay una escena en curso?
 *
 * La escena mide 960×540 unidades (las imágenes van a 2 px por unidad).
 * Los pasos de cada escena se ejecutan en orden; `say`, `narrate`,
 * `card` y `wait` bloquean y el resto arranca al momento (o tras su
 * `delay`). Los efectos están en cutscene/fx.js.
 *
 * Imágenes con new Image(), nunca fetch, y nunca getImageData: con
 * file:// el canvas quedaría «contaminado» y daría error.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Una imagen del manifiesto, en unidades de escena (960×540). Los
 * actores llevan su punto de apoyo (ax, ay: los pies); `theme` es la
 * máscara que se tiñe con el color del tema, o null.
 * @typedef {{ src: string, w: number, h: number, ax?: number, ay?: number,
 *             desc?: string, theme: string|null }} CutsceneImage
 */

/**
 * Manifiesto de recursos de una escena (generado: prologo-assets.js).
 * @typedef {{ unit: string, pxPerUnit: number,
 *             backgrounds: Record<string, CutsceneImage>,
 *             actors: Record<string, CutsceneImage> }} CutsceneAssets
 */

/**
 * Un paso de una escena. `do` dice qué hace y el resto de campos
 * depende de él (tabla en design/campana/prologo/guia-implementacion.md).
 * @typedef {{
 *   do: string,
 *   id?: string, type?: string, name?: string, who?: string, actor?: string,
 *   sprite?: string, frames?: string[], fps?: number, portrait?: string,
 *   x?: number, y?: number, s?: number, flip?: boolean, alpha?: number, bob?: number,
 *   zoom?: number, dur?: number, ease?: string, delay?: number, fade?: number,
 *   text?: string, sub?: string, color?: string, radio?: boolean, auto?: number,
 *   alias?: string, line?: string, sfx?: string, after?: string,
 *   track?: string, loop?: boolean, from?: string[]|number, stop?: boolean,
 *   keep?: string[], on?: boolean, density?: number, amp?: number, dir?: number,
 *   lightning?: boolean, to?: string|number[], volleys?: number, gap?: number,
 *   x0?: number, x1?: number, left?: string, right?: string, count?: number,
 *   cx?: number, cy?: number, factor?: number,
 *   pairs?: { x: number, y: number, color: string }[]
 * }} CutsceneStep
 */

/** @typedef {{ id: string, steps: CutsceneStep[] }} CutsceneScene */

/**
 * Una película: sus escenas y el nombre de la constante global con su
 * manifiesto (así los datos no dependen del orden de carga).
 * @typedef {{ id: string, assets: string, endCard?: string, scenes: CutsceneScene[] }} Cutscene
 */

/**
 * Un actor en escena. `sprite` o `frames` (con `fps`; 0 = quieto en el
 * primero). `color` lo pone la tarjeta del actor: es el de sus pelotas.
 * @typedef {{ id: string, sprite: string|null, frames: string[]|null, fps: number,
 *             x: number, y: number, s: number, flip: boolean, alpha: number, bob: number|null,
 *             moving: boolean, flashAt: number, color: string|null, phase: number }} CutsceneActor
 */

/**
 * Una interpolación: lleva obj[key] a `to` en `dur` segundos de escena,
 * empezando en t0 (con su retraso ya sumado).
 * @typedef {{ obj: any, key: string, from: number, to: number, t0: number, dur: number,
 *             ease: string, started: boolean, dead: boolean, actor: boolean,
 *             onDone: (() => void)|null }} CutsceneTween
 */

/**
 * Rectángulo de la escena dentro del canvas (px CSS), px por unidad y
 * tamaño visible en unidades (uw × uh: 960×540 en horizontal).
 * @typedef {{ x: number, y: number, w: number, h: number, k: number, dpr: number,
 *             uw: number, uh: number, mode: 'wide'|'band'|'tall' }} CutsceneView
 */

/**
 * Lo que bloquea los pasos siguientes: una espera, la línea que se
 * escribe (diálogo o narración) o la tarjeta en curso.
 * @typedef {{ kind: 'wait'|'say'|'narrate'|'card', until?: number, step?: CutsceneStep,
 *             full?: string, n?: number, shown?: number, complete?: boolean,
 *             autoAt?: number|null, shownEl?: HTMLElement, restEl?: HTMLElement,
 *             portrait?: string|null }} CutsceneBlock
 */

/**
 * Una reproducción en curso. `t` es el reloj de la escena (s): se para
 * con las tarjetas y va despacio con la cámara lenta; `realT` es el
 * tiempo real desde que empezó.
 * @typedef {{
 *   def: Cutscene, assets: CutsceneAssets|null, onEnd: (() => void)|null,
 *   phase: 'loading'|'playing'|'chapter',
 *   sceneIdx: number, stepIdx: number, sceneT0: number, t: number, realT: number,
 *   block: CutsceneBlock|null,
 *   timers: { at: number, fn: () => void }[], realTimers: { at: number, fn: () => void }[],
 *   tweens: CutsceneTween[], actors: Map<string, CutsceneActor>, fx: CutsceneFx[],
 *   bg: { id: string, t0: number, fade: number }|null, prevBg: string|null,
 *   camera: { x: number, y: number, zoom: number }, shakeX: number, shakeY: number,
 *   slowmo: { factor: number, from: number, until: number }|null, frozen: boolean,
 *   loops: Map<string, () => void>, unduck: (() => void)|null, rallyScore: number,
 *   view: CutsceneView, dom: CutsceneDom, raf: number, lastNow: number,
 *   hold: { key: boolean, pointer: boolean, t: number }, blips: number,
 *   reduced: boolean, chapterEnd: number, loadTotal: number, loadDone: number,
 *   aux: HTMLCanvasElement|null
 * }} CutsceneRun
 */

/**
 * Los elementos de #cutscene-screen.
 * @typedef {{ section: HTMLElement, stage: HTMLElement, canvas: HTMLCanvasElement,
 *             ctx: CanvasRenderingContext2D, loading: HTMLElement,
 *             narration: HTMLElement, narrationShown: HTMLElement, narrationRest: HTMLElement,
 *             dialogue: HTMLElement, portrait: HTMLCanvasElement, speaker: HTMLElement,
 *             lineShown: HTMLElement, lineRest: HTMLElement,
 *             card: HTMLElement, cardName: HTMLElement, cardAlias: HTMLElement, cardLine: HTMLElement,
 *             title: HTMLElement, chapter: HTMLElement, chapterTitle: HTMLElement, chapterSub: HTMLElement,
 *             crt: HTMLElement, ring: SVGCircleElement }} CutsceneDom
 */

/** Tamaño de la escena en unidades. */
const CUTSCENE_W = 960;
const CUTSCENE_H = 540;

/** Velocidad del texto: letras por segundo y factor del avance automático. */
const CUTSCENE_TEXT_SPEEDS = {
    slow:   { cps: 20, autoK: 1.3 },
    normal: { cps: 35, autoK: 1 },
    fast:   { cps: 60, autoK: 0.75 }
};

/** Manifiestos por el nombre que da Cutscene.assets. */
const CUTSCENE_ASSET_SETS = { PROLOGO_ASSETS };

/** Segundos: mantener para saltar, tarjeta, capítulo tras saltar. */
const CUTSCENE_HOLD_S = 1;
const CUTSCENE_CARD_S = 3;
const CUTSCENE_SKIP_CHAPTER_S = 1.5;
/** Tope de la carga inicial (ms): el prólogo nunca se cuelga por un recurso. */
const CUTSCENE_LOAD_TIMEOUT_MS = 10000;
/** Escenas que se cargan antes de empezar (con la barra de carga). */
const CUTSCENE_PRELOAD_SCENES = 3;
/** Ancho mínimo de las bandas laterales (px) para poner SALTAR en la de la derecha. */
const CUTSCENE_BAND_MIN = 64;
/** Pasos que bloquean: el siguiente espera a que terminen. */
const CUTSCENE_BLOCKING = ['say', 'narrate', 'card', 'wait'];

/** @type {CutsceneRun|null} La reproducción en curso. */
let cutsceneRun = null;

/** @type {Map<string, { img: HTMLImageElement, ok: boolean, promise: Promise<boolean> }>} */
const cutsceneImages = new Map();
/** @type {Map<string, HTMLCanvasElement>} Máscaras e imágenes teñidas, por "src|color". */
const cutsceneTints = new Map();
/** Color del tema con el que se tiñó la caché. */
let cutsceneTintHex = null;

// -----------------------------------------------------------------
//  Utilidades
// -----------------------------------------------------------------

/** @param {string|undefined} c color o 'theme' */
function cutsceneColor(c) {
    return !c || c === 'theme' ? currentThemeHex() : c;
}

/**
 * Curvas de las interpolaciones.
 * @param {string} name linear, in, out, inOut
 * @param {number} p 0…1
 */
function cutsceneEase(name, p) {
    switch (name) {
        case 'in':    return p * p;
        case 'out':   return 1 - (1 - p) * (1 - p);
        case 'inOut': return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        default:      return p;
    }
}

/** Velocidad del texto elegida en Configuración (settings.textSpeed). */
function cutsceneTextSpeed() {
    return CUTSCENE_TEXT_SPEEDS[settings.textSpeed] || CUTSCENE_TEXT_SPEEDS.normal;
}

/**
 * Reinicia una animación CSS: pone --dur y vuelve a poner la clase.
 * @param {Element} el
 * @param {string} cls
 * @param {number} dur segundos
 */
function cutsceneDomAnim(el, cls, dur) {
    /** @type {HTMLElement} */ (el).style.setProperty('--dur', dur + 's');
    el.classList.remove(cls);
    void (/** @type {HTMLElement} */ (el).offsetWidth);
    el.classList.add(cls);
}

/**
 * Un canvas auxiliar del tamaño pedido, reutilizado (el corte de señal).
 * @param {CutsceneRun} cs
 * @param {number} w
 * @param {number} h
 */
function cutsceneAuxCanvas(cs, w, h) {
    if (!cs.aux) cs.aux = document.createElement('canvas');
    if (cs.aux.width !== w || cs.aux.height !== h) {
        cs.aux.width = w;
        cs.aux.height = h;
    }
    return cs.aux;
}

/** @param {string} id @returns {any} */
function cutsceneById(id) {
    return document.getElementById(id);
}

/** @returns {CutsceneDom} */
function cutsceneDom() {
    const canvas = /** @type {HTMLCanvasElement} */ (cutsceneById('cutscene-canvas'));
    return {
        section: cutsceneById('cutscene-screen'),
        stage: cutsceneById('cutscene-stage'),
        canvas,
        ctx: canvas.getContext('2d'),
        loading: cutsceneById('cutscene-loading'),
        narration: cutsceneById('cutscene-narration'),
        narrationShown: cutsceneById('cutscene-narration-shown'),
        narrationRest: cutsceneById('cutscene-narration-rest'),
        dialogue: cutsceneById('cutscene-dialogue'),
        portrait: cutsceneById('cutscene-portrait'),
        speaker: cutsceneById('cutscene-speaker'),
        lineShown: cutsceneById('cutscene-line-shown'),
        lineRest: cutsceneById('cutscene-line-rest'),
        card: cutsceneById('cutscene-card'),
        cardName: cutsceneById('cutscene-card-name'),
        cardAlias: cutsceneById('cutscene-card-alias'),
        cardLine: cutsceneById('cutscene-card-line'),
        title: cutsceneById('cutscene-title'),
        chapter: cutsceneById('cutscene-chapter'),
        chapterTitle: cutsceneById('cutscene-chapter-title'),
        chapterSub: cutsceneById('cutscene-chapter-sub'),
        crt: cutsceneById('cutscene-crt'),
        ring: cutsceneById('cutscene-skip-ring')
    };
}

// -----------------------------------------------------------------
//  Imágenes
// -----------------------------------------------------------------

/**
 * Carga una imagen una sola vez. La promesa siempre se cumple: si la
 * imagen falla, avisa en consola y la escena sigue sin ella.
 * @param {string} src
 * @returns {Promise<boolean>}
 */
function cutsceneLoad(src) {
    let entry = cutsceneImages.get(src);
    if (!entry) {
        const img = new Image();
        const e = { img, ok: false, promise: null };
        e.promise = new Promise((resolve) => {
            img.onload = () => { e.ok = true; resolve(true); };
            img.onerror = () => {
                console.warn('Escena: no se pudo cargar', src);
                resolve(false);
            };
        });
        img.src = src;
        cutsceneImages.set(src, e);
        entry = e;
    }
    return entry.promise;
}

/**
 * La imagen si ya cargó (si no, pide cargarla y devuelve null).
 * @param {string} src
 * @returns {HTMLImageElement|null}
 */
function cutsceneImage(src) {
    const entry = cutsceneImages.get(src);
    if (!entry) {
        cutsceneLoad(src);
        return null;
    }
    return entry.ok ? entry.img : null;
}

/**
 * La imagen pintada de un color, conservando su forma: canvas auxiliar,
 * fillRect del color y 'destination-in' con la imagen. En caché por
 * imagen y color; se vacía al cambiar el tema.
 * @param {string} src
 * @param {string} color
 * @returns {HTMLCanvasElement|null}
 */
function cutsceneTinted(src, color) {
    const theme = currentThemeHex();
    if (theme !== cutsceneTintHex) {
        cutsceneTints.clear();
        cutsceneTintHex = theme;
    }
    const key = src + '|' + color;
    const hit = cutsceneTints.get(key);
    if (hit) return hit;
    const img = cutsceneImage(src);
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(img, 0, 0);
    cutsceneTints.set(key, c);
    return c;
}

/**
 * Las imágenes que usa una escena (fondos, sprites, retratos y sus máscaras).
 * @param {CutsceneRun} cs
 * @param {number} idx
 * @returns {string[]}
 */
function cutsceneSceneSources(cs, idx) {
    const scene = cs.def.scenes[idx];
    if (!scene || !cs.assets) return [];
    const out = new Set();
    /** @param {CutsceneImage|undefined} info */
    const add = (info) => {
        if (!info) return;
        out.add(info.src);
        if (info.theme) out.add(info.theme);
    };
    for (const s of scene.steps) {
        if (s.do === 'bg') add(cs.assets.backgrounds[s.id]);
        if (s.do === 'fx' && s.type === 'wipe') add(cs.assets.backgrounds[/** @type {string} */ (s.to)]);
        for (const id of [s.sprite, s.portrait, ...(s.frames || [])]) {
            if (id) add(cs.assets.actors[id]);
        }
    }
    return [...out];
}

// -----------------------------------------------------------------
//  Actores
// -----------------------------------------------------------------

/** @param {CutsceneRun} cs @param {string} id */
function cutsceneActorInfo(cs, id) {
    return (cs.assets && cs.assets.actors[id]) || null;
}

/**
 * El sprite que toca ahora (el fotograma, si tiene varios).
 * @param {CutsceneRun} cs
 * @param {CutsceneActor} a
 */
function cutsceneActorSprite(cs, a) {
    if (a.frames && a.frames.length) {
        if (!a.fps) return a.frames[0];
        return a.frames[Math.floor((cs.t + a.phase) * a.fps) % a.frames.length];
    }
    return a.sprite;
}

/**
 * Caja del actor en unidades de escena (con su escala y su reflejo).
 * @param {CutsceneRun} cs
 * @param {CutsceneActor} a
 * @returns {{ left: number, top: number, w: number, h: number }|null}
 */
function cutsceneActorBox(cs, a) {
    const info = cutsceneActorInfo(cs, cutsceneActorSprite(cs, a));
    if (!info) return null;
    const left = a.flip ? a.x - (info.w - info.ax) * a.s : a.x - info.ax * a.s;
    return { left, top: a.y - info.ay * a.s, w: info.w * a.s, h: info.h * a.s };
}

/**
 * Dibuja un sprite con los pies en (x, y). Con `tint`, la silueta de ese
 * color; sin él, la imagen y su máscara del tema con 'lighter'.
 * @param {CanvasRenderingContext2D} ctx
 * @param {CutsceneRun} cs
 * @param {string} id
 * @param {number} x
 * @param {number} y
 * @param {number} s
 * @param {boolean} flip
 * @param {number} alpha
 * @param {string|null} [tint]
 * @param {number} [scaleY] respiración (desde los pies)
 */
function cutsceneDrawSprite(ctx, cs, id, x, y, s, flip, alpha, tint = null, scaleY = 1) {
    const info = cutsceneActorInfo(cs, id);
    if (!info || alpha <= 0) return;
    const img = tint ? cutsceneTinted(info.src, tint) : cutsceneImage(info.src);
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    if (scaleY !== 1) ctx.scale(1, scaleY);
    const dx = -info.ax * s;
    const dy = -info.ay * s;
    ctx.drawImage(img, dx, dy, info.w * s, info.h * s);
    if (!tint && info.theme) {
        const mask = cutsceneTinted(info.theme, cutsceneColor('theme'));
        if (mask) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(mask, dx, dy, info.w * s, info.h * s);
        }
    }
    ctx.restore();
}

/**
 * Un actor: balanceo al paso mientras se mueve, respiración si está
 * quieto y el destello blanco de `pose`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {CutsceneRun} cs
 * @param {CutsceneActor} a
 */
function cutsceneDrawActor(ctx, cs, a) {
    const sprite = cutsceneActorSprite(cs, a);
    let y = a.y;
    let sy = 1;
    const bob = a.bob ?? (a.frames ? 1.5 : 0);
    if (a.moving) {
        if (bob) y -= Math.abs(Math.sin((cs.t + a.phase) * (a.fps || 4) * Math.PI)) * bob;
    } else if (!cs.reduced) {
        sy = 1 + 0.008 * Math.sin((cs.t + a.phase) * 2 * Math.PI / 3);
    }
    cutsceneDrawSprite(ctx, cs, sprite, a.x, y, a.s, a.flip, a.alpha, null, sy);
    const flash = cs.t - a.flashAt;
    if (!cs.reduced && flash >= 0 && flash < 0.1) {
        cutsceneDrawSprite(ctx, cs, sprite, a.x, y, a.s, a.flip, a.alpha * (1 - flash / 0.1), '#FFFFFF', sy);
    }
}

// -----------------------------------------------------------------
//  Fondos y cámara
// -----------------------------------------------------------------

/**
 * Dibuja un fondo a 960×540 con su máscara del tema.
 * @param {CanvasRenderingContext2D} ctx
 * @param {CutsceneRun} cs
 * @param {string} id
 * @param {number} alpha
 */
function cutsceneDrawBackground(ctx, cs, id, alpha) {
    const info = cs.assets && cs.assets.backgrounds[id];
    const img = info && cutsceneImage(info.src);
    if (!img || alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, 0, 0, CUTSCENE_W, CUTSCENE_H);
    const mask = info.theme && cutsceneTinted(info.theme, cutsceneColor('theme'));
    if (mask) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(mask, 0, 0, CUTSCENE_W, CUTSCENE_H);
    }
    ctx.restore();
}

/**
 * Cambia el fondo con un fundido cruzado de `fade` s. Con movimiento
 * reducido, un corte pasa a ser un fundido de 0,3 s (salvo `instant`).
 * @param {CutsceneRun} cs
 * @param {string} id
 * @param {number} fade
 * @param {boolean} [instant]
 */
function cutsceneSetBackground(cs, id, fade, instant = false) {
    if (cs.bg && cs.bg.id === id) return;
    const f = instant ? 0 : fade > 0 ? fade : cs.reduced ? 0.3 : 0;
    cs.prevBg = f > 0 && cs.bg ? cs.bg.id : null;
    cs.bg = { id, t0: cs.t, fade: f };
}

/**
 * Aplica la cámara: el centro de la vista en (x, y) con su aumento, sin
 * salirse de la escena, más el temblor.
 * @param {CanvasRenderingContext2D} ctx
 * @param {CutsceneRun} cs
 */
function cutsceneApplyCamera(ctx, cs) {
    const v = cs.view;
    const kz = v.k * cs.camera.zoom;
    const hw = v.w / 2 / kz;
    const hh = v.h / 2 / kz;
    const clamp = (c, half, size) => (half * 2 >= size ? size / 2 : Math.max(half, Math.min(size - half, c)));
    const cx = clamp(cs.camera.x, hw, CUTSCENE_W);
    const cy = clamp(cs.camera.y, hh, CUTSCENE_H);
    ctx.translate(v.x + v.w / 2, v.y + v.h / 2);
    ctx.scale(kz, kz);
    ctx.translate(-cx + cs.shakeX, -cy + cs.shakeY);
}

/**
 * Pasa al dibujo de la capa 'screen': unidades de la vista sin cámara
 * (0…uw × 0…uh).
 * @param {CanvasRenderingContext2D} ctx
 * @param {CutsceneRun} cs
 */
function cutsceneScreenUnits(ctx, cs) {
    ctx.translate(cs.view.x, cs.view.y);
    ctx.scale(cs.view.k, cs.view.k);
}

// -----------------------------------------------------------------
//  Pasos
// -----------------------------------------------------------------

/**
 * Programa algo en el reloj de la escena.
 * @param {CutsceneRun} cs
 * @param {number} delay segundos
 * @param {() => void} fn
 */
function cutsceneLater(cs, delay, fn) {
    cs.timers.push({ at: cs.t + delay, fn });
}

/**
 * Interpola una propiedad. Al empezar sustituye a la que ya movía esa
 * misma propiedad.
 * @param {CutsceneRun} cs
 * @param {any} obj
 * @param {string} key
 * @param {number} to
 * @param {number} dur
 * @param {string} [ease]
 * @param {number} [delay]
 * @param {(() => void)|null} [onDone]
 */
function cutsceneTween(cs, obj, key, to, dur, ease = 'linear', delay = 0, onDone = null) {
    cs.tweens.push({ obj, key, from: 0, to, t0: cs.t + (delay || 0), dur: Math.max(0.0001, dur || 0),
                     ease: ease || 'linear', started: false, dead: false, actor: obj !== cs.camera, onDone });
}

/**
 * Corta las interpolaciones de una propiedad (un `actor` con x o y nuevas).
 * @param {CutsceneRun} cs
 * @param {any} obj
 * @param {string} key
 */
function cutsceneCancelTweens(cs, obj, key) {
    for (const tw of cs.tweens) {
        if (tw.obj === obj && tw.key === key) tw.dead = true;
    }
}

/**
 * Paso `actor`: lo crea o actualiza lo que se indique.
 * @param {CutsceneRun} cs
 * @param {CutsceneStep} step
 */
function cutsceneActorStep(cs, step) {
    let a = cs.actors.get(step.id);
    if (!a) {
        let h = 0;
        for (const ch of step.id) h = (h * 31 + ch.charCodeAt(0)) | 0;
        a = { id: step.id, sprite: null, frames: null, fps: 3, x: 0, y: 0, s: 1, flip: false, alpha: 1,
              bob: null, moving: false, flashAt: -9, color: null, phase: vfxHash(h) * 3 };
        cs.actors.set(step.id, a);
    }
    if (step.sprite) { a.sprite = step.sprite; a.frames = null; }
    if (step.frames) { a.frames = step.frames; a.sprite = null; }
    if (step.fps !== undefined) a.fps = step.fps;
    if (step.x !== undefined) { cutsceneCancelTweens(cs, a, 'x'); a.x = step.x; }
    if (step.y !== undefined) { cutsceneCancelTweens(cs, a, 'y'); a.y = step.y; }
    if (step.s !== undefined) { cutsceneCancelTweens(cs, a, 's'); a.s = step.s; }
    if (step.alpha !== undefined) { cutsceneCancelTweens(cs, a, 'alpha'); a.alpha = step.alpha; }
    if (step.flip !== undefined) a.flip = step.flip;
    if (step.bob !== undefined) a.bob = step.bob;
}

/**
 * Paso `clear`: quita actores y efectos; los de `keep` (y sus bucles de
 * sonido del mismo nombre) siguen.
 * @param {CutsceneRun} cs
 * @param {string[]} keep
 */
function cutsceneClear(cs, keep) {
    cs.actors.clear();
    cs.tweens = cs.tweens.filter((tw) => !tw.actor);
    cs.fx = cs.fx.filter((f) => {
        if (keep.includes(f.type)) return true;
        if (f.end) f.end(cs, false);
        return false;
    });
    for (const [name, stop] of cs.loops) {
        if (keep.includes(name)) continue;
        stop();
        cs.loops.delete(name);
    }
}

/**
 * Paso `fx`. La lluvia es una sola: otro paso `rain` cambia su densidad
 * o la apaga (`on: false`).
 * @param {CutsceneRun} cs
 * @param {CutsceneStep} step
 */
function cutsceneStartFx(cs, step) {
    if (step.type === 'rain') {
        const rain = cs.fx.find((f) => f.type === 'rain');
        if (step.on === false) {
            cs.fx = cs.fx.filter((f) => f !== rain);
            return;
        }
        if (rain) {
            rain.setDensity(step.density ?? 1);
            return;
        }
    }
    const make = CUTSCENE_FX[step.type];
    if (!make) {
        console.warn('Escena: efecto desconocido', step.type);
        return;
    }
    const fx = make(step, cs);
    if (fx) cs.fx.push(fx);
}

/**
 * Hace sonar un efecto de soundEffects. Si devuelve una función es un
 * bucle: se guarda para pararlo (al saltar, al terminar, con clear o
 * con un paso `sfx` con `stop`).
 * @param {CutsceneRun} cs
 * @param {string} name
 * @param {any} [arg]
 */
function cutscenePlaySfx(cs, name, arg) {
    const fn = soundEffects[name];
    if (typeof fn !== 'function') return;
    const stop = fn(arg);
    if (typeof stop === 'function') {
        if (cs.loops.has(name)) cs.loops.get(name)();
        cs.loops.set(name, stop);
    }
}

/** @param {CutsceneRun} cs @param {string} name */
function cutsceneStopLoop(cs, name) {
    const stop = cs.loops.get(name);
    if (!stop) return;
    stop();
    cs.loops.delete(name);
}

/**
 * Ejecuta un paso. Devuelve lo que bloquea (o null si no bloquea).
 * @param {CutsceneRun} cs
 * @param {CutsceneStep} step
 * @returns {CutsceneBlock|null}
 */
function cutsceneRunStep(cs, step) {
    const a = step.id ? cs.actors.get(step.id) : null;
    switch (step.do) {
        case 'bg':
            cutsceneSetBackground(cs, step.id, step.fade || 0);
            break;
        case 'camera':
            for (const key of ['x', 'y', 'zoom']) {
                const to = key === 'x' ? step.x : key === 'y' ? step.y : step.zoom;
                if (to === undefined) continue;
                cutsceneCancelTweens(cs, cs.camera, key);
                if (step.dur) cutsceneTween(cs, cs.camera, key, to, step.dur, step.ease);
                else cs.camera[key] = to;
            }
            break;
        case 'actor':
            cutsceneActorStep(cs, step);
            break;
        case 'move':
            if (!a) break;
            if (step.x !== undefined) cutsceneTween(cs, a, 'x', step.x, step.dur, step.ease, step.delay);
            if (step.y !== undefined) cutsceneTween(cs, a, 'y', step.y, step.dur, step.ease, step.delay);
            if (step.s !== undefined) cutsceneTween(cs, a, 's', step.s, step.dur, step.ease, step.delay);
            break;
        case 'fade':
            if (a) cutsceneTween(cs, a, 'alpha', step.alpha, step.dur, 'linear', step.delay);
            break;
        case 'pose':
            if (!a) break;
            a.sprite = step.sprite;
            a.frames = null;
            a.flashAt = cs.t;
            break;
        case 'remove':
            if (!a) break;
            if (step.fade) cutsceneTween(cs, a, 'alpha', 0, step.fade, 'linear', 0, () => cs.actors.delete(a.id));
            else cs.actors.delete(a.id);
            break;
        case 'clear':
            cutsceneClear(cs, step.keep || []);
            break;
        case 'say':
        case 'narrate':
            return cutsceneStartText(cs, step);
        case 'card':
            return cutsceneStartCard(cs, step);
        case 'wait':
            return { kind: 'wait', until: cs.t + (step.dur || 0) };
        case 'fx':
            if (step.delay) cutsceneLater(cs, step.delay, () => cutsceneStartFx(cs, step));
            else cutsceneStartFx(cs, step);
            break;
        case 'music':
            if (step.stop) musicStop({ fade: step.fade ?? 0.5 });
            else if (MUSIC_TRACKS[step.track]) musicPlay(step.track, { fade: step.fade ?? 0.5, from: /** @type {number} */ (step.from) });
            break;
        case 'sfx':
            if (step.stop) cutsceneStopLoop(cs, step.name);
            else if (step.delay) cutsceneLater(cs, step.delay, () => cutscenePlaySfx(cs, step.name));
            else cutscenePlaySfx(cs, step.name);
            break;
        default:
            console.warn('Escena: paso desconocido', step.do);
    }
    return null;
}

/**
 * El siguiente paso que bloquea en la escena actual (para no ocultar el
 * cuadro entre dos líneas seguidas).
 * @param {CutsceneRun} cs
 * @returns {CutsceneStep|null}
 */
function cutsceneNextBlocking(cs) {
    const steps = cs.def.scenes[cs.sceneIdx].steps;
    for (let i = cs.stepIdx; i < steps.length; i++) {
        if (CUTSCENE_BLOCKING.includes(steps[i].do)) return steps[i];
    }
    return null;
}

/**
 * Ejecuta pasos hasta que uno bloquee; al acabar una escena empieza la
 * siguiente, y al acabar la última, el final.
 * @param {CutsceneRun} cs
 */
function cutsceneAdvanceSteps(cs) {
    while (cutsceneRun === cs && cs.phase === 'playing' && !cs.block) {
        const scene = cs.def.scenes[cs.sceneIdx];
        if (cs.stepIdx >= scene.steps.length) {
            if (cs.sceneIdx + 1 >= cs.def.scenes.length) {
                cutsceneFinish(cs);
                return;
            }
            cutsceneStartScene(cs, cs.sceneIdx + 1);
            continue;
        }
        const step = scene.steps[cs.stepIdx++];
        // Un paso que falla se salta: la escena nunca se queda colgada
        try {
            cs.block = cutsceneRunStep(cs, step);
        } catch (err) {
            console.error('Escena: falló el paso', step, err);
        }
    }
}

/**
 * Empieza una escena y precarga la siguiente.
 * @param {CutsceneRun} cs
 * @param {number} idx
 */
function cutsceneStartScene(cs, idx) {
    cs.sceneIdx = idx;
    cs.stepIdx = 0;
    cs.sceneT0 = cs.t;
    cutsceneSceneSources(cs, idx + 1).forEach(cutsceneLoad);
}

// -----------------------------------------------------------------
//  Texto: diálogo y narración
// -----------------------------------------------------------------

/**
 * Pinta el retrato: el 45 % superior del sprite, centrado, con su
 * máscara del tema. Devuelve false si la imagen aún no ha cargado.
 * @param {CutsceneRun} cs
 * @param {string} id
 */
function cutsceneDrawPortrait(cs, id) {
    const cv = cs.dom.portrait;
    const pctx = cv.getContext('2d');
    pctx.clearRect(0, 0, cv.width, cv.height);
    const info = cutsceneActorInfo(cs, id);
    const img = info && cutsceneImage(info.src);
    if (!img) return false;
    const sh = img.naturalHeight * 0.42;
    const sw = sh * cv.width / cv.height;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = img.naturalHeight * 0.03;
    pctx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    const mask = info.theme && cutsceneTinted(info.theme, cutsceneColor('theme'));
    if (mask) {
        const r = mask.width / img.naturalWidth;
        pctx.globalCompositeOperation = 'lighter';
        pctx.drawImage(mask, sx * r, sy * r, sw * r, sh * r, 0, 0, cv.width, cv.height);
        pctx.globalCompositeOperation = 'source-over';
    }
    return true;
}

/**
 * Empieza una línea de diálogo (`say`) o de narración (`narrate`).
 * @param {CutsceneRun} cs
 * @param {CutsceneStep} step
 * @returns {CutsceneBlock}
 */
function cutsceneStartText(cs, step) {
    const d = cs.dom;
    const narrate = step.do === 'narrate';
    /** @type {CutsceneBlock} */
    const b = { kind: narrate ? 'narrate' : 'say', step, full: step.text || '', n: 0, shown: -1, complete: false,
                autoAt: narrate && step.auto ? cs.realT + step.auto : null,
                shownEl: narrate ? d.narrationShown : d.lineShown, restEl: narrate ? d.narrationRest : d.lineRest,
                portrait: narrate ? null : step.portrait || null };
    if (narrate) {
        d.narration.classList.add('is-on');
        d.narration.classList.remove('is-done');
    } else {
        const color = cutsceneColor(step.color);
        d.dialogue.style.setProperty('--c', color);
        d.speaker.textContent = step.name || '';
        d.dialogue.classList.toggle('has-portrait', !!b.portrait);
        d.dialogue.classList.toggle('is-radio', !!step.radio);
        d.dialogue.classList.remove('is-done');
        d.dialogue.classList.add('is-on');
        if (b.portrait && cutsceneDrawPortrait(cs, b.portrait)) b.portrait = null;
        if (step.radio) soundEffects.radioClick();
    }
    cutsceneShowLine(b, 0);
    if (!cs.unduck && musicCurrent()) cs.unduck = musicDuckWhile(3);
    return b;
}

/**
 * Muestra las primeras `count` letras. El resto va en un <span>
 * invisible, para que las palabras no salten de línea al escribirse.
 * @param {CutsceneBlock} b
 * @param {number} count
 */
function cutsceneShowLine(b, count) {
    if (count === b.shown) return;
    b.shown = count;
    b.shownEl.textContent = b.full.slice(0, count);
    b.restEl.textContent = b.full.slice(count);
}

/**
 * La línea ya está entera: aparece el ▼ y cuenta el avance automático
 * (2 s + 50 ms por letra, según la velocidad del texto).
 * @param {CutsceneRun} cs
 * @param {CutsceneBlock} b
 */
function cutsceneCompleteText(cs, b) {
    b.complete = true;
    b.n = b.full.length;
    cutsceneShowLine(b, b.full.length);
    (b.kind === 'narrate' ? cs.dom.narration : cs.dom.dialogue).classList.add('is-done');
    if (b.autoAt === null) b.autoAt = cs.realT + (2 + 0.05 * b.full.length) * cutsceneTextSpeed().autoK;
}

/**
 * Termina la línea: el cuadro se oculta si no le sigue otra igual.
 * @param {CutsceneRun} cs
 */
function cutsceneEndText(cs) {
    const b = cs.block;
    cs.block = null;
    const next = cutsceneNextBlocking(cs);
    if (!next || next.do !== b.kind) cutsceneHideText(cs, b.kind);
}

/**
 * Oculta el diálogo o la narración (los dos sin `kind`) y devuelve la
 * música a su volumen.
 * @param {CutsceneRun} cs
 * @param {string} [kind]
 */
function cutsceneHideText(cs, kind) {
    if (kind !== 'narrate') cs.dom.dialogue.classList.remove('is-on');
    if (kind !== 'say') cs.dom.narration.classList.remove('is-on');
    if (cs.unduck) {
        cs.unduck();
        cs.unduck = null;
    }
}

/**
 * Escribe la línea en curso (tiempo real) y la avanza sola si toca.
 * @param {CutsceneRun} cs
 * @param {number} dt segundos reales
 */
function cutsceneTickText(cs, dt) {
    const b = cs.block;
    if (b.portrait && cutsceneDrawPortrait(cs, b.portrait)) b.portrait = null;
    if (!b.complete) {
        b.n += cutsceneTextSpeed().cps * dt;
        const count = Math.min(b.full.length, Math.floor(b.n));
        for (let i = Math.max(0, b.shown); i < count; i++) {
            if (b.kind === 'say' && b.full[i] !== ' ' && ++cs.blips % 2 === 0) soundEffects.dialogueBlip();
        }
        cutsceneShowLine(b, count);
        if (count >= b.full.length) cutsceneCompleteText(cs, b);
    }
    if (b.autoAt !== null && cs.realT >= b.autoAt) {
        if (!b.complete) cutsceneCompleteText(cs, b);
        cutsceneEndText(cs);
    }
}

// -----------------------------------------------------------------
//  Tarjeta de presentación
// -----------------------------------------------------------------

/**
 * Paso `card`: congela el tiempo, oscurece todo menos el actor y entra
 * la tarjeta. Dura CUTSCENE_CARD_S o hasta que el jugador avance.
 * @param {CutsceneRun} cs
 * @param {CutsceneStep} step
 * @returns {CutsceneBlock}
 */
function cutsceneStartCard(cs, step) {
    const d = cs.dom;
    const color = cutsceneColor(step.color);
    const a = cs.actors.get(step.actor);
    if (a) a.color = color;
    d.cardName.textContent = step.name || '';
    d.cardAlias.textContent = step.alias || '';
    d.cardLine.textContent = step.line ? `«${step.line}»` : '';
    d.card.style.setProperty('--c', color);
    cutsceneDomAnim(d.card, 'is-on', 0.25);
    cs.frozen = true;
    if (step.sfx) cutscenePlaySfx(cs, step.sfx, { color, major: CUTSCENE_MAJOR_CARDS.includes(step.actor) });
    if (step.after) cs.realTimers.push({ at: cs.realT + 0.6, fn: () => cutscenePlaySfx(cs, step.after) });
    return { kind: 'card', step, until: cs.realT + CUTSCENE_CARD_S };
}

/** Actores cuya tarjeta suena en mayor (el resto, en menor). */
const CUTSCENE_MAJOR_CARDS = ['valen', 'dani'];

/** @param {CutsceneRun} cs */
function cutsceneEndCard(cs) {
    cs.block = null;
    cs.frozen = false;
    cs.dom.card.classList.remove('is-on');
}

// -----------------------------------------------------------------
//  Bucle
// -----------------------------------------------------------------

/**
 * Avanza la reproducción `realDt` segundos reales.
 * @param {CutsceneRun} cs
 * @param {number} realDt
 */
function cutsceneTick(cs, realDt) {
    cs.realT += realDt;

    // Mantener ESPACIO o el dedo: el anillo de SALTAR se llena
    cs.hold.t = cs.hold.key || cs.hold.pointer ? cs.hold.t + realDt : 0;
    cs.dom.ring.style.strokeDashoffset = String(100 * (1 - Math.min(1, cs.hold.t / CUTSCENE_HOLD_S)));
    if (cs.hold.t >= CUTSCENE_HOLD_S && cs.phase !== 'chapter') {
        cutsceneSkip();
        return;
    }

    if (cs.phase === 'loading') {
        cs.dom.loading.style.setProperty('--p', String(cs.loadTotal ? cs.loadDone / cs.loadTotal : 1));
        return;
    }
    if (cs.phase === 'chapter') {
        if (cs.realT >= cs.chapterEnd) cutsceneFinish(cs);
        return;
    }

    for (const tm of cs.realTimers.filter((x) => cs.realT >= x.at)) tm.fn();
    cs.realTimers = cs.realTimers.filter((x) => cs.realT < x.at);

    // Reloj de la escena: parado con la tarjeta, despacio con la cámara lenta
    let factor = 1;
    if (cs.slowmo) {
        if (cs.realT >= cs.slowmo.until) {
            cs.slowmo = null;
        } else {
            // Vuelve a la velocidad normal en los últimos 0,3 s
            const left = cs.slowmo.until - cs.realT;
            factor = left < 0.3 ? cs.slowmo.factor + (1 - cs.slowmo.factor) * (1 - left / 0.3) : cs.slowmo.factor;
        }
    }
    const dt = cs.frozen ? 0 : realDt * factor;
    cs.t += dt;

    const due = cs.timers.filter((x) => cs.t >= x.at);
    cs.timers = cs.timers.filter((x) => cs.t < x.at);
    due.forEach((x) => x.fn());

    // Interpolaciones; un actor se mueve mientras le cambian x o y
    for (const a of cs.actors.values()) a.moving = false;
    for (const tw of cs.tweens) {
        if (tw.dead || cs.t < tw.t0) continue;
        if (!tw.started) {
            for (const other of cs.tweens) {
                if (other !== tw && other.started && other.obj === tw.obj && other.key === tw.key) other.dead = true;
            }
            tw.started = true;
            tw.from = tw.obj[tw.key];
        }
        const p = Math.min(1, (cs.t - tw.t0) / tw.dur);
        tw.obj[tw.key] = tw.from + (tw.to - tw.from) * cutsceneEase(tw.ease, p);
        if (tw.actor && (tw.key === 'x' || tw.key === 'y') && p < 1) tw.obj.moving = true;
        if (p >= 1) {
            tw.dead = true;
            if (tw.onDone) tw.onDone();
        }
    }
    cs.tweens = cs.tweens.filter((tw) => !tw.dead);

    // Efectos
    let shake = 0;
    for (const f of cs.fx) {
        if (f.update && dt > 0) f.update(cs, dt);
        if (f.shakeAmp) shake += f.shakeAmp(cs);
    }
    const ended = cs.fx.filter((f) => f.done(cs));
    cs.fx = cs.fx.filter((f) => !ended.includes(f));
    ended.forEach((f) => f.end && f.end(cs, true));
    if (cs.reduced || dt === 0) shake = 0;
    cs.shakeX = shake ? (vfxRandom() * 2 - 1) * shake : 0;
    cs.shakeY = shake ? (vfxRandom() * 2 - 1) * shake : 0;
    if (cs.prevBg && cs.bg && cs.t - cs.bg.t0 >= cs.bg.fade) cs.prevBg = null;

    // Lo que bloquea
    const b = cs.block;
    if (b) {
        if (b.kind === 'wait' && cs.t >= b.until) cs.block = null;
        else if (b.kind === 'say' || b.kind === 'narrate') cutsceneTickText(cs, realDt);
        else if (b.kind === 'card' && cs.realT >= b.until) cutsceneEndCard(cs);
    }
    cutsceneAdvanceSteps(cs);
}

/**
 * Dibuja el fotograma: fondo, efectos 'bg', actores por su y, efectos
 * 'world', capa 'screen' y, con una tarjeta, el velo y su actor encima.
 * @param {CutsceneRun} cs
 */
function cutsceneRender(cs) {
    const { ctx, canvas } = cs.dom;
    const v = cs.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (cs.phase !== 'playing') return;

    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x, v.y, v.w, v.h);
    ctx.clip();

    ctx.save();
    cutsceneApplyCamera(ctx, cs);
    if (cs.prevBg) cutsceneDrawBackground(ctx, cs, cs.prevBg, 1);
    if (cs.bg) cutsceneDrawBackground(ctx, cs, cs.bg.id, cs.bg.fade ? Math.min(1, (cs.t - cs.bg.t0) / cs.bg.fade) : 1);
    for (const f of cs.fx) if (f.layer === 'bg' && f.render) f.render(ctx, cs);
    const actors = [...cs.actors.values()].sort((a, b) => a.y - b.y);
    for (const a of actors) cutsceneDrawActor(ctx, cs, a);
    for (const f of cs.fx) if (f.layer === 'world' && f.render) f.render(ctx, cs);
    ctx.restore();

    ctx.save();
    cutsceneScreenUnits(ctx, cs);
    for (const f of cs.fx) if (f.layer === 'screen' && f.render) f.render(ctx, cs);
    ctx.restore();

    const b = cs.block;
    if (b && b.kind === 'card') {
        ctx.fillStyle = 'rgba(6, 7, 12, 0.7)';
        ctx.fillRect(v.x, v.y, v.w, v.h);
        const a = cs.actors.get(b.step.actor);
        if (a) {
            ctx.save();
            cutsceneApplyCamera(ctx, cs);
            cutsceneDrawActor(ctx, cs, a);
            ctx.restore();
        }
    }
    ctx.restore();
}

/** @param {number} now */
function cutsceneFrame(now) {
    const cs = cutsceneRun;
    if (!cs) return;
    const realDt = Math.min(0.1, Math.max(0, (now - cs.lastNow) / 1000));
    cs.lastNow = now;
    cutsceneTick(cs, realDt);
    if (cutsceneRun !== cs) return;
    cutsceneRender(cs);
    cs.raf = requestAnimationFrame(cutsceneFrame);
}

// -----------------------------------------------------------------
//  Pantalla
// -----------------------------------------------------------------

/**
 * Coloca la escena según la pantalla:
 *   wide  horizontal: la escena entera (contain), diálogo arriba
 *   band  horizontal con bandas laterales anchas: SALTAR en la derecha
 *   tall  vertical: la escena a lo ancho (cover, centrada en la cámara)
 *         y debajo el diálogo y los botones
 * El canvas va a devicePixelRatio, con un máximo de 2.
 */
function cutsceneLayout() {
    const cs = cutsceneRun;
    if (!cs) return;
    const { section, canvas } = cs.dom;
    const tall = window.innerHeight > window.innerWidth;
    section.dataset.layout = tall ? 'tall' : 'wide';
    const cw = canvas.clientWidth || 1;
    const ch = canvas.clientHeight || 1;
    /** @type {CutsceneView['mode']} */
    let mode = tall ? 'tall' : 'wide';
    let k;
    let rect;
    if (tall) {
        k = Math.max(cw / CUTSCENE_W, ch / CUTSCENE_H);
        rect = { x: 0, y: 0, w: cw, h: ch };
    } else {
        k = Math.min(cw / CUTSCENE_W, ch / CUTSCENE_H);
        const w = CUTSCENE_W * k;
        const h = CUTSCENE_H * k;
        rect = { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
        if (rect.x >= CUTSCENE_BAND_MIN) mode = 'band';
    }
    section.dataset.layout = mode;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    cs.view = { ...rect, k, dpr, uw: rect.w / k, uh: rect.h / k, mode };
    section.style.setProperty('--cs-x', rect.x + 'px');
    section.style.setProperty('--cs-y', rect.y + 'px');
    section.style.setProperty('--cs-w', rect.w + 'px');
    section.style.setProperty('--cs-h', rect.h + 'px');
}

/**
 * La tarjeta final: «CAPÍTULO 1» y su subtítulo sobre negro.
 * @param {CutsceneRun} cs
 * @param {string} text
 * @param {string} sub
 */
function cutsceneShowChapter(cs, text, sub) {
    cs.dom.chapterTitle.textContent = text || '';
    cs.dom.chapterSub.textContent = sub || '';
    cs.dom.chapter.classList.add('is-on');
}

/** Quita del DOM todo lo que la reproducción encendió. */
function cutsceneResetDom() {
    const d = cutsceneDom();
    for (const el of [d.dialogue, d.narration, d.card, d.title, d.chapter, d.crt]) el.classList.remove('is-on', 'is-done');
    d.canvas.classList.remove('is-off');
    d.section.classList.remove('is-loading');
    d.ring.style.strokeDashoffset = '100';
}

// -----------------------------------------------------------------
//  Controles
// -----------------------------------------------------------------

/**
 * Toque, clic, ESPACIO o ENTER: completa la línea que se escribe o pasa
 * a la siguiente; también cierra una tarjeta.
 */
function cutsceneAdvance() {
    const cs = cutsceneRun;
    if (!cs || cs.phase !== 'playing' || !cs.block) return;
    const b = cs.block;
    if (b.kind === 'say' || b.kind === 'narrate') {
        if (!b.complete) cutsceneCompleteText(cs, b);
        else cutsceneEndText(cs);
    } else if (b.kind === 'card') {
        cutsceneEndCard(cs);
    }
    cutsceneAdvanceSteps(cs);
}

/**
 * SALTAR, ESC o mantener 1 s: corta todo y va directo al capítulo
 * (CUTSCENE_SKIP_CHAPTER_S) y de ahí a onEnd.
 */
function cutsceneSkip() {
    const cs = cutsceneRun;
    if (!cs || cs.phase === 'chapter') return;
    soundEffects.uiClick();
    cutsceneClear(cs, []);
    cs.timers = [];
    cs.realTimers = [];
    cs.block = null;
    cs.frozen = false;
    cs.hold = { key: false, pointer: false, t: 0 };
    cutsceneHideText(cs);
    cutsceneResetDom();
    musicStop({ fade: 0.3 });
    const chapter = cs.def.scenes.flatMap((s) => s.steps).find((s) => s.do === 'fx' && s.type === 'chapter');
    cutsceneShowChapter(cs, chapter ? chapter.text : cs.def.endCard, chapter ? chapter.sub : '');
    cs.phase = 'chapter';
    cs.chapterEnd = cs.realT + CUTSCENE_SKIP_CHAPTER_S;
}

/**
 * El teclado durante una escena (desde systems/input.js): nada llega al
 * juego. ESPACIO y ENTER avanzan, mantener ESPACIO salta, ESC salta.
 * @param {KeyboardEvent} e
 * @param {boolean} down
 */
function cutsceneKey(e, down) {
    const cs = cutsceneRun;
    if (!cs) return;
    if (['Space', 'Enter', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!down) {
        if (e.code === 'Space') cs.hold.key = false;
        return;
    }
    if (e.repeat) return;
    if (e.code === 'Escape') {
        cutsceneSkip();
    } else if (e.code === 'Space') {
        cs.hold.key = true;
        cutsceneAdvance();
    } else if (e.code === 'Enter') {
        cutsceneAdvance();
    }
}

// -----------------------------------------------------------------
//  API
// -----------------------------------------------------------------

/**
 * Reproduce una escena. onEnd se llama al terminar o al saltar.
 * @param {Cutscene} def
 * @param {{ onEnd?: () => void }} [opts]
 */
function playCutscene(def, { onEnd } = {}) {
    if (cutsceneRun) stopCutscene();
    const dom = cutsceneDom();
    const assets = CUTSCENE_ASSET_SETS[def.assets] || null;
    if (!assets) console.warn('Escena: no hay manifiesto', def.assets);
    cutsceneResetDom();

    /** @type {CutsceneRun} */
    const cs = {
        def, assets, onEnd: onEnd || null, phase: 'loading',
        sceneIdx: 0, stepIdx: 0, sceneT0: 0, t: 0, realT: 0, block: null,
        timers: [], realTimers: [], tweens: [], actors: new Map(), fx: [],
        bg: null, prevBg: null, camera: { x: CUTSCENE_W / 2, y: CUTSCENE_H / 2, zoom: 1 },
        shakeX: 0, shakeY: 0, slowmo: null, frozen: false, loops: new Map(), unduck: null, rallyScore: 0,
        view: null, dom, raf: 0, lastNow: performance.now(),
        hold: { key: false, pointer: false, t: 0 }, blips: 0,
        reduced: prefersReducedMotion(), chapterEnd: 0, loadTotal: 0, loadDone: 0, aux: null
    };
    cutsceneRun = cs;

    // Su pantalla, encima de todo (sin pasar por showScreen: la escena
    // pone su propia música)
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active-screen'));
    dom.section.classList.add('active-screen');
    dom.section.classList.toggle('is-reduced', cs.reduced);
    dom.section.classList.add('is-loading');
    musicStop();
    cutsceneLayout();

    // Antes de empezar, lo que usan las primeras escenas (con un tope)
    const first = new Set();
    for (let i = 0; i < CUTSCENE_PRELOAD_SCENES; i++) cutsceneSceneSources(cs, i).forEach((s) => first.add(s));
    cs.loadTotal = first.size;
    const loads = [...first].map((src) => cutsceneLoad(src).then(() => { cs.loadDone++; }));
    const timeout = new Promise((resolve) => setTimeout(resolve, CUTSCENE_LOAD_TIMEOUT_MS));
    Promise.race([Promise.all(loads), timeout]).then(() => {
        if (cutsceneRun !== cs || cs.phase !== 'loading') return;
        dom.section.classList.remove('is-loading');
        cs.phase = 'playing';
        cutsceneStartScene(cs, 0);
        cutsceneSceneSources(cs, CUTSCENE_PRELOAD_SCENES).forEach(cutsceneLoad);
    });

    cs.raf = requestAnimationFrame(cutsceneFrame);
}

/** Corta la reproducción (sin llamar a onEnd). */
function stopCutscene() {
    const cs = cutsceneRun;
    if (!cs) return;
    cutsceneRun = null;
    cancelAnimationFrame(cs.raf);
    for (const stop of cs.loops.values()) stop();
    cs.loops.clear();
    for (const f of cs.fx) if (f.end) f.end(cs, false);
    if (cs.unduck) cs.unduck();
    cutsceneResetDom();
    cutsceneTints.clear();
}

/** ¿Hay una escena en curso? */
function cutscenePlaying() {
    return cutsceneRun !== null;
}

/**
 * Dónde va la reproducción (para comprobarla desde Playwright).
 * @returns {{ phase: string, scene: number, id: string, t: number }|null}
 */
function cutsceneProgress() {
    const cs = cutsceneRun;
    if (!cs) return null;
    return { phase: cs.phase, scene: cs.sceneIdx, id: cs.def.scenes[cs.sceneIdx].id, t: cs.t - cs.sceneT0 };
}

/**
 * Termina: corta y llama a onEnd.
 * @param {CutsceneRun} cs
 */
function cutsceneFinish(cs) {
    if (cutsceneRun !== cs) return;
    const onEnd = cs.onEnd;
    stopCutscene();
    if (onEnd) onEnd();
}

/**
 * Mantener el dedo (o el ratón) sobre la escena llena el anillo de
 * SALTAR; y la escena se recoloca al girar o cambiar el tamaño.
 */
function initCutscene() {
    const section = document.getElementById('cutscene-screen');
    section.addEventListener('pointerdown', (e) => {
        if (!cutsceneRun || /** @type {Element} */ (e.target).closest('button')) return;
        cutsceneRun.hold.pointer = true;
    });
    const release = () => {
        if (cutsceneRun) cutsceneRun.hold.pointer = false;
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('resize', cutsceneLayout);
}
