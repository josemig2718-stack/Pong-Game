/**
 * cutscene/fx-final.js
 * ------------------------------------------------------------------
 * Los efectos de escena del final de la campaña (falso final,
 * introducción del Creador y final verdadero; guía
 * design/campana/final/guia-implementacion.md, F.2). Mismo contrato que
 * CUTSCENE_FX (cutscene/fx.js): una fábrica por tipo que recibe el paso
 * y la reproducción y devuelve un CutsceneFx; el reproductor busca el
 * tipo en las dos tablas (cutsceneFxFactory).
 *
 * La mayoría son DOM, con las clases de la sección «El final de la
 * campaña» de css/style.css; cada elemento lleva .cs-dom-fx para que el
 * reproductor lo quite al terminar, al saltar o con un `clear`. Los
 * textos se ponen con textContent, nunca con innerHTML: la caja del
 * nombre recibe lo que escribe el jugador, y ese texto no se guarda en
 * ningún sitio (ni en localStorage ni en variables que sobrevivan al
 * efecto).
 *
 * Bloquean (CUTSCENE_BLOCKING_FX en cutscene/player.js): console,
 * error_window, name_box y credits en modo 'verdadero'.
 *
 * Azar: vfxRandom() y vfxHash(), nunca Math.random. Tiempo: el reloj de
 * la escena (cs.t).
 * ------------------------------------------------------------------
 */

'use strict';

/** Colores de los personajes en los créditos (por su busto). */
const CREDITS_COLORS = {
    chemi: '#E5E7EB', dani: '#D4A72C', mario: '#E63946', valen: '#C98A4B', fano: '#8B5CF6',
    chayipiti: '#A855F7', yisus: '#FACC15', mariangel: '#F472B6', pedro: '#60A5FA',
    nino: '#93C5FD', madre: '#F9A8D4', alcalde: '#3B82F6', creador: '#E0F2FE'
};

/** Las palabras de las líneas de arranque de la consola que van en color. */
const CS_CONSOLE_MARKS = [
    { re: /OK$/, cls: 'ok' },
    { re: /5\/5 DERROTADOS$/, cls: 'ok' },
    { re: /NO AUTORIZADO$/, cls: 'bad' },
    { re: /CREADOR$/, cls: 'warn' }
];

/** Caracteres con los que se corrompen los textos. */
const CS_GLITCH_CHARS = '▓█░▒¿#@%&$?/\\|<>*';

/** Tiempos de los efectos (s). */
const CS_FINAL = {
    menuEvery: 1.5,         // fake_menu: un botón más dice «NO»
    pokeMs: 360,            // fake_menu: temblor al tocar un botón
    rayMin: 2, rayMax: 3,   // bust_glitch: cada cuánto cae un rayo
    rayDur: 0.25,
    revealFlashAt: 0.4,     // reveal: destello y luego la imagen
    revealFlash: 0.12,
    revealBandsMs: 80,
    replyS: 1.5,            // error_window: la respuesta antes de cerrarse
    falseRollS: 9,          // credits falso: cuándo llega el nombre de la ruptura al centro
    falseSlowS: 2.5,        // …la música frena y se apaga
    falseTailS: 1,          // …y el efecto termina 1 s después
    falseCorruptCps: 12,
    trueRollS: 108,         // credits verdadero: de principio a fin
    trueTailS: 2,
    winkS: 0.08,
    nameBreakS: 0.7,        // name_box: los píxeles vuelan y se quita todo
    flickerHz: 8
};

/**
 * Un elemento DOM de efecto, colgado de la escena (`stage`: el rectángulo
 * del canvas) o de toda la sección.
 * @param {CutsceneRun} cs
 * @param {string} tag
 * @param {string} cls
 * @param {'stage'|'section'} [where]
 * @returns {HTMLElement}
 */
function csFxEl(cs, tag, cls, where = 'section') {
    const el = document.createElement(tag);
    el.className = cls + ' cs-dom-fx';
    (where === 'stage' ? cs.dom.stage : cs.dom.section).appendChild(el);
    return el;
}

/**
 * Un hijo con clase y texto.
 * @param {HTMLElement} parent
 * @param {string} tag
 * @param {string} cls
 * @param {string} [text]
 */
function csChild(parent, tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    parent.appendChild(el);
    return el;
}

/**
 * Pinta en un canvas el busto de los créditos (con la máscara del tema si
 * `theme`); si aún no ha cargado, lo pinta al cargar.
 * @param {HTMLCanvasElement} cv
 * @param {string} id clave de CAMPAIGN_ART.bustos
 * @param {boolean} theme
 */
function csDrawCreditBust(cv, id, theme) {
    const info = CAMPAIGN_ART.bustos[id];
    if (!info) return;
    const draw = () => {
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        if (theme) return drawTintedArt(ctx, info, currentThemeHex(), 0, 0, cv.width, cv.height);
        const img = artImage(info.src);
        if (img) ctx.drawImage(img, 0, 0, cv.width, cv.height);
        return !!img;
    };
    if (!draw()) Promise.all([artLoad(info.src), info.theme ? artLoad(info.theme) : null]).then(draw);
}

// ------------------------------------------------------------------
//  La consola
// ------------------------------------------------------------------

/**
 * Pinta una línea de la consola con sus primeras `shown` letras, sus
 * palabras de color y, si `cursor`, el cursor al final.
 * @param {HTMLElement} p
 * @param {string} line
 * @param {number} shown
 * @param {boolean} cursor
 */
function csConsolePaint(p, line, shown, cursor) {
    p.replaceChildren();
    let start = line.length;
    let cls = '';
    for (const m of CS_CONSOLE_MARKS) {
        const hit = m.re.exec(line);
        if (hit) { start = hit.index; cls = m.cls; break; }
    }
    const plain = line.slice(0, Math.min(shown, start));
    if (plain) p.appendChild(document.createTextNode(plain));
    if (shown > start) csChild(p, 'span', cls, line.slice(start, shown));
    if (cursor) csChild(p, 'span', 'cs-console__cursor');
}

/** Quita la consola de la escena (cambio de escena, clear, revelación). @param {CutsceneRun} cs */
function csConsoleClear(cs) {
    if (cs.consoleEl) cs.consoleEl.remove();
    cs.consoleEl = null;
}

// ------------------------------------------------------------------
//  El menú roto
// ------------------------------------------------------------------

/**
 * La etiqueta de texto de un botón del menú principal (o null si solo
 * tiene icono).
 * @param {HTMLElement} btn
 * @returns {{ node: Node, text: string }|null}
 */
function csMenuLabel(btn) {
    const el = btn.querySelector('.tile .px, .px, .menu-play > span, .menu-progress__title');
    if (el && el.textContent.trim()) return { node: el, text: el.textContent };
    const texts = [...btn.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    const node = texts[texts.length - 1];
    return node ? { node, text: node.textContent } : null;
}

/** @type {Record<string, (step: CutsceneStep, cs: CutsceneRun) => CutsceneFx|null>} */
const CUTSCENE_FX_FINAL = {
    // --- Texto de consola que se escribe línea a línea (DOM, bloquea) --
    console(step, cs) {
        if (step.clear || !cs.consoleEl) {
            csConsoleClear(cs);
            cs.consoleEl = csFxEl(cs, 'div', 'cs-console', 'stage');
        }
        const box = cs.consoleEl;
        box.classList.toggle('is-center', !!step.center);
        box.classList.toggle('is-dark', !!step.dark);
        box.querySelectorAll('.cs-console__cursor').forEach((c) => c.remove());
        const lines = /** @type {string[]} */ (step.lines || []);
        const cps = step.cps || 30;
        const hold = step.hold || 0;
        const total = lines.reduce((s, l) => s + l.length, 0);
        const t0 = cs.t;
        /** @type {HTMLElement[]} */
        const ps = [];
        let typed = -1;
        const paint = (chars) => {
            if (chars === typed) return;
            if (typed >= 0 && chars > typed) {
                // Un clic de teclado cada dos letras
                for (let i = typed; i < chars; i++) if (i % 2 === 0 && soundEffects.dialogueBlip) soundEffects.dialogueBlip();
            }
            typed = chars;
            // La línea que se escribe ahora (la última, si ya está todo)
            let cur = lines.length - 1;
            for (let i = 0, pre = 0; i < lines.length; pre += lines[i].length, i++) {
                if (chars - pre < lines[i].length) { cur = i; break; }
            }
            for (let i = 0, pre = 0; i <= cur; pre += lines[i].length, i++) {
                if (!ps[i]) ps[i] = csChild(box, 'p', 'cs-console__line');
                csConsolePaint(ps[i], lines[i], Math.max(0, Math.min(lines[i].length, chars - pre)), i === cur);
            }
        };
        paint(0);
        return {
            type: 'console', layer: 'screen',
            done: (c) => c.t - t0 >= total / cps + hold,
            update(c) { paint(Math.min(total, Math.floor((c.t - t0) * cps))); }
        };
    },

    // --- El menú principal de verdad, roto (DOM) ----------------------
    fake_menu(step, cs) {
        const menu = document.getElementById('main-menu');
        menu.classList.add('is-fake-menu');
        cs.dom.section.classList.add('is-fake-menu');
        const buttons = /** @type {HTMLElement[]} */ ([...menu.querySelectorAll('button')]).filter((b) => b.offsetParent !== null);
        // JUGAR primero; el resto, en un orden al azar (vfxRandom)
        const rest = buttons.filter((b) => !b.classList.contains('menu-play'))
            .map((b) => ({ b, k: vfxRandom() })).sort((a, b) => a.k - b.k).map((x) => x.b);
        const order = [...buttons.filter((b) => b.classList.contains('menu-play')), ...rest];
        /** @type {{ node: Node, text: string }[]} */
        const saved = [];
        let broken = 0;
        const t0 = cs.t;
        const dur = step.dur || 10;
        const breakOne = (b) => {
            const label = csMenuLabel(b);
            if (label) {
                saved.push(label);
                label.node.textContent = label.node.nodeType === 3 ? ' NO' : 'NO';
            }
            b.classList.add('fm-no');
            if (soundEffects.glitch) soundEffects.glitch();
        };
        // Tocar un botón no hace nada: solo tiembla. Fuera de los botones, avanza el diálogo
        const onClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const btn = /** @type {HTMLElement} */ (/** @type {Element} */ (e.target).closest('button'));
            if (!btn) {
                cutsceneAdvance();
                return;
            }
            btn.classList.remove('fm-poke');
            void btn.offsetWidth;
            btn.classList.add('fm-poke');
            setTimeout(() => btn.classList.remove('fm-poke'), CS_FINAL.pokeMs);
        };
        menu.addEventListener('click', onClick, true);
        return {
            type: 'fake_menu', layer: 'screen',
            done: () => false,   // hasta su paso con `off`
            update(c) {
                const want = c.t - t0 >= dur ? order.length : Math.min(order.length, 1 + Math.floor((c.t - t0) / CS_FINAL.menuEvery));
                while (broken < want) breakOne(order[broken++]);
            },
            end() {
                menu.removeEventListener('click', onClick, true);
                for (const s of saved) s.node.textContent = s.text;
                menu.classList.remove('is-fake-menu');
                cs.dom.section.classList.remove('is-fake-menu');
                menu.querySelectorAll('.fm-no, .fm-poke').forEach((b) => b.classList.remove('fm-no', 'fm-poke'));
            }
        };
    },

    // --- El busto grande con interferencias (DOM) ----------------------
    bust_glitch(step, cs) {
        const info = CAMPAIGN_ART.bustos[step.bust];
        if (!info) return null;
        const box = csFxEl(cs, 'div', 'cs-bustglitch', 'stage');
        for (const part of ['base', 'r', 'c']) {
            const img = /** @type {HTMLImageElement} */ (csChild(box, 'img', 'cs-bustglitch__' + part));
            img.src = info.src;
            img.alt = '';
        }
        const t0 = cs.t;
        let nextRay = t0 + cutsceneRand(CS_FINAL.rayMin, CS_FINAL.rayMax);
        let rayUntil = -1;
        return {
            type: 'bust_glitch', layer: 'screen',
            done: (c) => !!step.dur && c.t - t0 >= step.dur,
            update(c) {
                if (step.rays && !c.reduced && c.t >= nextRay) {
                    rayUntil = c.t + CS_FINAL.rayDur;
                    nextRay = c.t + cutsceneRand(CS_FINAL.rayMin, CS_FINAL.rayMax);
                    if (soundEffects.glitch) soundEffects.glitch();
                }
                box.classList.toggle('is-ray', c.t < rayUntil);
            },
            end() { box.remove(); }
        };
    },

    // --- «YO SOY EL CREADOR» y el medio segundo de la imagen (DOM) ------
    reveal(step, cs) {
        csConsoleClear(cs);
        const box = csFxEl(cs, 'div', 'cs-reveal' + (cs.reduced ? ' is-reduced' : ''));
        const imgBox = csChild(box, 'div', 'cs-reveal__img');
        imgBox.hidden = true;
        for (const ch of ['r', 'g', 'b']) {
            const img = /** @type {HTMLImageElement} */ (csChild(imgBox, 'img', ch));
            img.src = step.image;
            img.alt = '';
        }
        const text = csChild(box, 'p', 'cs-reveal__text', step.text);
        text.style.position = 'relative';
        text.style.zIndex = '4';
        csChild(box, 'div', 'cs-reveal__flash');
        const t0 = cs.t;
        const imgS = (step.imageMs || 500) / 1000;
        const imgAt = CS_FINAL.revealFlashAt;
        const endAt = imgAt + imgS + CS_FINAL.revealFlash;
        let flashes = 0;
        let bandsAt = -1;
        const flash = () => {
            if (cs.reduced) return;
            box.classList.remove('is-flash');
            void box.offsetWidth;
            box.classList.add('is-flash');
        };
        return {
            type: 'reveal', layer: 'screen',
            done: (c) => c.t - t0 >= endAt,
            update(c) {
                const e = c.t - t0;
                if (e >= imgAt && flashes === 0) { flashes = 1; flash(); imgBox.hidden = false; }
                if (e >= imgAt + imgS && flashes === 1) { flashes = 2; flash(); imgBox.hidden = true; }
                if (!imgBox.hidden) {
                    if (c.reduced) {
                        imgBox.style.opacity = String(Math.min(1, (e - imgAt) / 0.15) * Math.min(1, (imgAt + imgS - e) / 0.15));
                    } else if (e - bandsAt >= CS_FINAL.revealBandsMs / 1000) {
                        // Cuatro bandas desplazadas, cada 80 ms con vfxRandom
                        bandsAt = e;
                        for (let i = 1; i <= 4; i++) {
                            imgBox.style.setProperty(`--b${i}`, (i * 20 - 14 + vfxRandom() * 12).toFixed(1) + '%');
                            imgBox.style.setProperty(`--h${i}`, (2 + vfxRandom() * 6).toFixed(1) + '%');
                            imgBox.style.setProperty(`--x${i}`, ((vfxRandom() - 0.5) * 40).toFixed(0) + 'px');
                        }
                    }
                }
            },
            end() { box.remove(); }
        };
    },

    // --- Grietas blancas desde el centro (capa screen, hasta el clear) --
    crack(step, cs) {
        const t0 = cs.t;
        const dur = step.dur || 2;
        /** @type {{ pts: { x: number, y: number }[], at: number, w: number }[]} */
        const cracks = [];
        const R = 620;
        const grow = (x, y, ang, len, depth, at) => {
            const pts = [{ x, y }];
            let px = x, py = y;
            const segs = 6 + Math.floor(vfxRandom() * 4);
            for (let i = 1; i <= segs; i++) {
                const a = ang + cutsceneRand(-0.35, 0.35);
                px += Math.cos(a) * len / segs;
                py += Math.sin(a) * len / segs;
                pts.push({ x: px, y: py });
                if (depth < 2 && vfxRandom() < 0.22) grow(px, py, ang + cutsceneRand(-1, 1), len * 0.45, depth + 1, at + (i / segs) * 0.6);
            }
            cracks.push({ pts, at, w: depth ? 1.2 : 2.4 });
        };
        const n = 9;
        for (let i = 0; i < n; i++) grow(0, 0, (i / n) * Math.PI * 2 + cutsceneRand(-0.2, 0.2), R * cutsceneRand(0.55, 1), 0, 0);
        if (soundEffects.glitch) soundEffects.glitch();
        return {
            type: 'crack', layer: 'screen',
            done: () => false,   // hasta el siguiente clear
            render(ctx, c) {
                const p = Math.min(1, (c.t - t0) / dur);
                const cx = c.view.uw / 2, cy = c.view.uh / 2;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.strokeStyle = '#F8FAFC';
                ctx.shadowColor = '#7DD3FC';
                ctx.shadowBlur = 6;
                ctx.lineJoin = 'round';
                for (const k of cracks) {
                    const q = Math.max(0, Math.min(1, (p - k.at * 0.3) / 0.7));
                    if (q <= 0) continue;
                    const upto = 1 + (k.pts.length - 1) * q;
                    ctx.lineWidth = k.w;
                    ctx.beginPath();
                    ctx.moveTo(k.pts[0].x, k.pts[0].y);
                    for (let i = 1; i < k.pts.length && i < upto + 1; i++) {
                        const f = Math.min(1, upto - i + 1);
                        const a = k.pts[i - 1], b = k.pts[i];
                        ctx.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
                    }
                    ctx.stroke();
                }
                ctx.restore();
            }
        };
    },

    // --- La ventana falsa del sistema (DOM, bloquea) -------------------
    error_window(step, cs) {
        const win = csFxEl(cs, 'div', 'sys-window');
        win.setAttribute('role', 'alertdialog');
        win.setAttribute('aria-labelledby', 'sys-window-title');
        const bar = csChild(win, 'div', 'sys-window__bar');
        csChild(bar, 'span', '', step.title || '').id = 'sys-window-title';
        csChild(bar, 'span', 'sys-window__x', '×').setAttribute('aria-hidden', 'true');
        const body = csChild(win, 'div', 'sys-window__body');
        csChild(body, 'span', 'sys-window__icon', '!').setAttribute('aria-hidden', 'true');
        const text = csChild(body, 'p', 'sys-window__text', step.body || '');
        const actions = csChild(win, 'div', 'sys-window__actions');
        let closeAt = -1;
        for (const b of step.buttons || []) {
            const btn = /** @type {HTMLButtonElement} */ (csChild(actions, 'button', 'sys-window__btn', b.label));
            btn.type = 'button';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (closeAt >= 0) return;
                soundEffects.uiClick();
                text.textContent = b.reply;
                win.classList.add('is-reply');
                if (b.shake && !cs.reduced) win.classList.add('is-shake');
                actions.querySelectorAll('button').forEach((x) => { /** @type {HTMLButtonElement} */ (x).disabled = true; });
                closeAt = cs.t + CS_FINAL.replyS;
            });
        }
        if (soundEffects.denied) soundEffects.denied();
        const first = /** @type {HTMLButtonElement|null} */ (actions.querySelector('button'));
        if (first) setTimeout(() => first.focus({ preventScroll: true }), 0);
        return {
            type: 'error_window', layer: 'screen',
            done: (c) => closeAt >= 0 && c.t >= closeAt,
            end() { win.remove(); }
        };
    },

    // --- Corazones del color del tema que suben (capa world) -----------
    hearts(step, cs) {
        const t0 = cs.t;
        const dur = step.dur || 2.5;
        const color = cutsceneColor('theme');
        const hearts = Array.from({ length: 6 }, (_, i) => ({
            at: i * dur * 0.09, dx: cutsceneRand(-50, 50), sway: cutsceneRand(6, 16), s: cutsceneRand(0.7, 1.2), rise: cutsceneRand(90, 150)
        }));
        return {
            type: 'hearts', layer: 'world',
            done: (c) => c.t - t0 >= dur,
            render(ctx, c) {
                for (const h of hearts) {
                    const e = c.t - t0 - h.at;
                    const life = dur - h.at;
                    if (e < 0 || e > life) continue;
                    const p = e / life;
                    const x = step.x + h.dx + Math.sin(e * 3) * h.sway;
                    const y = step.y - h.rise * p;
                    const s = 9 * h.s;
                    ctx.save();
                    ctx.globalAlpha = Math.min(1, e / 0.2) * (1 - p);
                    ctx.translate(x, y);
                    ctx.fillStyle = color;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.moveTo(0, s * 0.9);
                    ctx.bezierCurveTo(-s * 1.3, 0, -s * 0.7, -s, 0, -s * 0.35);
                    ctx.bezierCurveTo(s * 0.7, -s, s * 1.3, 0, 0, s * 0.9);
                    ctx.fill();
                    ctx.restore();
                }
            }
        };
    },

    // --- Créditos (DOM): falso, que se rompe; verdadero, que bloquea ----
    credits(step, cs) {
        const lines = /** @type {CreditLine[]} */ (step.lines === 'CREDITOS' ? CREDITOS : step.lines || []);
        const box = csFxEl(cs, 'div', 'cs-credits');
        const roll = csChild(box, 'div', 'cs-credits__roll');
        // Los botones de abajo (vertical) no tapan los créditos
        cs.dom.section.classList.add('has-credits');
        /** @type {HTMLElement[]} */
        const named = [];
        /** @type {HTMLElement|null} */
        let wink = null;
        /** @type {HTMLElement|null} */
        let last = null;
        for (const L of lines) {
            if (L.big) last = csChild(roll, 'p', 'cs-credits__big', L.big);
            if (L.small) last = csChild(roll, 'p', 'cs-credits__small', L.small);
            if (L.title) last = csChild(roll, 'p', 'cs-credits__title', L.title);
            if (L.gap) last = csChild(roll, 'div', 'cs-credits__gap');
            if (L.name) {
                const item = csChild(roll, 'div', 'cs-credits__item' + (L.bust ? '' : ' no-bust'));
                const color = L.theme ? 'var(--primary)' : (L.bust && CREDITS_COLORS[L.wink ? 'creador' : L.bust]) || '';
                if (color) item.style.setProperty('--c', color);
                if (L.bust) {
                    const b = csChild(item, 'span', 'cs-credits__bust');
                    const cv = /** @type {HTMLCanvasElement} */ (csChild(b, 'canvas', ''));
                    cv.width = cv.height = 112;
                    csDrawCreditBust(cv, L.bust, !!L.theme);
                }
                const txt = csChild(item, 'span', '');
                csChild(txt, 'span', 'cs-credits__name', L.name);
                if (L.role) csChild(txt, 'span', 'cs-credits__role', L.role);
                named.push(item);
                if (L.wink) wink = item;
                last = item;
            }
        }
        const t0 = cs.t;
        const falso = step.mode === 'falso';
        const target = falso ? named[(step.breakAt || 1) - 1] || last : last;
        // Cuánto tiene que subir la columna para que `target` llegue al centro
        const travel = () => {
            const H = box.clientHeight || window.innerHeight;
            return target ? H / 2 + target.offsetTop + target.offsetHeight / 2 : H;
        };
        const rollS = falso ? CS_FINAL.falseRollS : CS_FINAL.trueRollS;
        let breakAt = -1;
        /** @type {{ name: HTMLElement, text: string, i: number, next: number }|null} */
        let corrupt = null;
        let winked = false;
        let rateCh = null;
        return {
            type: 'credits', layer: 'screen',
            done: (c) => {
                const e = c.t - t0;
                if (!falso) return e >= rollS + CS_FINAL.trueTailS;
                return false;   // el falso se queda (roto) hasta el clear o el final
            },
            update(c) {
                const e = c.t - t0;
                const p = breakAt >= 0 ? 1 : Math.min(1, e / rollS);
                roll.style.transform = `translateX(-50%) translateY(${(-travel() * p).toFixed(1)}px)`;
                if (wink && !winked) {
                    const r = wink.getBoundingClientRect();
                    const b = box.getBoundingClientRect();
                    if (r.top + r.height / 2 <= b.top + b.height / 2) {
                        winked = true;
                        wink.classList.add('is-wink');
                        setTimeout(() => wink.classList.remove('is-wink'), CS_FINAL.winkS * 1000);
                    }
                }
                if (!falso) return;
                if (breakAt < 0 && e >= rollS) {
                    // La ruptura: la música frena y se apaga, la columna se para
                    breakAt = e;
                    const item = named.find((it) => it.querySelector('.cs-credits__name').textContent === step.corrupt) || target;
                    if (item) {
                        item.classList.add('is-corrupt');
                        const name = /** @type {HTMLElement} */ (item.querySelector('.cs-credits__name'));
                        corrupt = { name, text: name.textContent, i: 0, next: e };
                    }
                    const id = musicCurrent();
                    if (id) {
                        rateCh = musicChannel(id);
                        musicFade(rateCh, 0, CS_FINAL.falseSlowS);
                    }
                    if (soundEffects.glitch) soundEffects.glitch();
                }
                if (breakAt >= 0) {
                    const k = Math.min(1, (e - breakAt) / CS_FINAL.falseSlowS);
                    if (rateCh) {
                        musicSetRate(1 - 0.6 * k);
                        if (k >= 1) {
                            musicSetRate(1);
                            musicStop({ fade: 0 });
                            rateCh = null;
                        }
                    }
                    // Una letra más cambia por un carácter de glitch, 12 por segundo
                    if (corrupt && e < breakAt + CS_FINAL.falseSlowS + CS_FINAL.falseTailS) {
                        while (e >= corrupt.next && corrupt.i < corrupt.text.length) {
                            const chars = [...corrupt.name.textContent];
                            if (chars[corrupt.i] !== ' ') chars[corrupt.i] = CS_GLITCH_CHARS[Math.floor(vfxRandom() * CS_GLITCH_CHARS.length)];
                            corrupt.name.textContent = chars.join('');
                            corrupt.i++;
                            corrupt.next += 1 / CS_FINAL.falseCorruptCps;
                        }
                    }
                }
            },
            end() {
                if (rateCh) { musicSetRate(1); musicStop({ fade: 0 }); }
                cs.dom.section.classList.remove('has-credits');
                box.remove();
            }
        };
    },

    // --- La caja del nombre (DOM, bloquea; lo escrito no se guarda) ----
    name_box(step, cs) {
        const box = csFxEl(cs, 'div', 'cs-namebox', 'stage');
        const label = csChild(box, 'label', 'cs-namebox__label', (step.placeholder || '').toUpperCase());
        const row = csChild(box, 'div', 'cs-namebox__row');
        const input = /** @type {HTMLInputElement} */ (csChild(row, 'input', 'cs-namebox__input'));
        input.id = 'cs-namebox-input';
        label.setAttribute('for', input.id);
        input.type = 'text';
        input.maxLength = 16;
        for (const [k, v] of [['autocomplete', 'off'], ['autocapitalize', 'off'], ['spellcheck', 'false'], ['enterkeyhint', 'send'], ['autocorrect', 'off']]) input.setAttribute(k, v);
        const send = /** @type {HTMLButtonElement} */ (csChild(row, 'button', 'btn btn-p cs-namebox__send'));
        send.type = 'button';
        csChild(send, 'span', 'px', 'ENVIAR');
        const breakAfter = step.breakAfter || 2;
        let doneAt = -1;
        const shatter = () => {
            if (doneAt >= 0) return;
            doneAt = cs.t + CS_FINAL.nameBreakS;
            // Lo escrito se borra y el campo sale del DOM: no queda en ningún sitio
            input.value = '';
            input.blur();
            input.remove();
            box.classList.add('is-broken');
            const burst = csFxEl(cs, 'div', 'cs-namebox-burst', 'stage');
            burst.style.cssText = 'position:absolute;left:50%;top:calc(var(--cs-y) + var(--cs-h) * .5);z-index:9;pointer-events:none';
            for (let i = 0; i < 24; i++) {
                const px = csChild(burst, 'span', 'cs-namebox__px');
                const a = vfxRandom() * Math.PI * 2;
                const d = cutsceneRand(80, 260);
                px.style.setProperty('--dx', (Math.cos(a) * d).toFixed(0) + 'px');
                px.style.setProperty('--dy', (Math.sin(a) * d * 0.7).toFixed(0) + 'px');
                px.style.setProperty('--r', Math.floor(cutsceneRand(-360, 360)) + 'deg');
            }
            if (soundEffects.glitch) soundEffects.glitch();
        };
        input.addEventListener('input', () => { if (input.value.length >= breakAfter) shatter(); });
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); shatter(); }
        });
        send.addEventListener('click', (e) => { e.stopPropagation(); shatter(); });
        box.addEventListener('click', (e) => e.stopPropagation());
        setTimeout(() => { if (doneAt < 0) input.focus({ preventScroll: true }); }, 0);
        return {
            type: 'name_box', layer: 'screen',
            done: (c) => doneAt >= 0 && c.t >= doneAt,
            end() {
                input.value = '';
                box.remove();
                cs.dom.stage.querySelectorAll('.cs-namebox-burst').forEach((b) => b.remove());
            }
        };
    },

    // --- Texto enorme centrado (DOM) ----------------------------------
    big_text(step, cs) {
        const box = csFxEl(cs, 'div', 'cs-bigtext');
        csChild(box, 'p', 'cs-bigtext__main', step.text || '');
        if (step.sub) csChild(box, 'p', 'cs-bigtext__sub', step.sub);
        const t0 = cs.t;
        return {
            type: 'big_text', layer: 'screen',
            done: (c) => c.t - t0 >= (step.dur || 4),
            end() { box.remove(); }
        };
    },

    // --- Un actor que parpadea (el logo que se apaga) -----------------
    flicker(step, cs) {
        const t0 = cs.t;
        const dur = step.dur || 1;
        const a = cs.actors.get(step.id);
        if (!a) return null;
        return {
            type: 'flicker', layer: 'world',
            done: (c) => c.t - t0 >= dur,
            update(c) {
                // Saltos irregulares: unos 8 cambios por segundo
                const n = Math.floor((c.t - t0) * CS_FINAL.flickerHz * (0.7 + 0.6 * vfxHash(Math.floor((c.t - t0) * 3) + 17)));
                a.alpha = vfxHash(n * 13 + 5) < 0.5 ? 0.15 : 1;
            },
            end() { a.alpha = 1; }
        };
    }
};
