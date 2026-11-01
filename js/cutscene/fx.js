/**
 * cutscene/fx.js
 * ------------------------------------------------------------------
 * Los efectos de las escenas (pasos `fx`). Cada tipo es una fábrica
 * que recibe el paso y la reproducción en curso y devuelve un
 * CutsceneFx; su estado vive en el cierre de la fábrica.
 *
 * Capas, en el orden en que el reproductor las dibuja:
 *   'bg'     detrás de los actores, con la cámara (fundidos, estelas)
 *   'world'  delante de los actores, con la cámara
 *   'screen' sobre la escena sin cámara, en unidades de la vista
 *            (cutsceneScreenUnits): 960×540 en horizontal
 * Los textos (título, capítulo) y el encendido del televisor van en el
 * DOM.
 *
 * Azar: solo vfxRandom() y vfxHash(), nunca Math.random. El tiempo es
 * el reloj de la escena (cs.t, segundos), que se para con las tarjetas
 * y va despacio con la cámara lenta.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Un efecto en curso. `done` dice si ya se puede quitar; `end` se
 * llama al quitarlo (`finished`: porque terminó, no por un clear o un
 * salto). `shakeAmp` suma al temblor de cámara.
 * @typedef {{
 *   type: string,
 *   layer: 'bg'|'world'|'screen',
 *   done: (cs: CutsceneRun) => boolean,
 *   update?: (cs: CutsceneRun, dt: number) => void,
 *   render?: (ctx: CanvasRenderingContext2D, cs: CutsceneRun) => void,
 *   end?: (cs: CutsceneRun, finished: boolean) => void,
 *   shakeAmp?: (cs: CutsceneRun) => number,
 *   setDensity?: (d: number) => void
 * }} CutsceneFx
 */

/** Las dos capas de lluvia: la de delante es más larga, rápida y clara. */
const CUTSCENE_RAIN_LAYERS = [
    { count: 120, tilt: 0.23, len: 26, speed: 1100, alpha: 0.16, width: 1.2 },
    { count: 80,  tilt: 0.17, len: 15, speed: 640,  alpha: 0.10, width: 1 }
];

/** Gravedad de las chispas y los cristales (unidades/s²). */
const CUTSCENE_GRAVITY = 900;

/**
 * Número aleatorio entre a y b (con vfxRandom).
 * @param {number} a
 * @param {number} b
 */
function cutsceneRand(a, b) {
    return a + vfxRandom() * (b - a);
}

/**
 * Rayo quebrado de (x0, y0) a (x1, y1) en `segs` tramos; los puntos
 * intermedios se desvían hasta `jitter` unidades a los lados.
 * @returns {{ x: number, y: number }[]}
 */
function cutsceneBoltPoints(x0, y0, x1, y1, segs, jitter) {
    const pts = [{ x: x0, y: y0 }];
    for (let i = 1; i < segs; i++) {
        const p = i / segs;
        pts.push({ x: x0 + (x1 - x0) * p + cutsceneRand(-jitter, jitter), y: y0 + (y1 - y0) * p + cutsceneRand(-jitter, jitter) * 0.3 });
    }
    pts.push({ x: x1, y: y1 });
    return pts;
}

/**
 * Dibuja un rayo: trazo de color con brillo y alma blanca.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }[]} pts
 * @param {string} color
 * @param {number} width
 */
function cutsceneDrawBolt(ctx, pts, color, width) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = color;
    ctx.lineWidth = width * 2.2;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
}

/**
 * Efecto de un solo trazo que se acaba a los `dur` segundos.
 * @param {string} type
 * @param {'bg'|'world'|'screen'} layer
 * @param {number} t0
 * @param {number} dur
 * @param {(ctx: CanvasRenderingContext2D, p: number, cs: CutsceneRun) => void} draw p = progreso 0…1
 * @returns {CutsceneFx}
 */
function cutsceneTimedFx(type, layer, t0, dur, draw) {
    return {
        type, layer,
        done: (cs) => cs.t - t0 >= dur,
        render: (ctx, cs) => draw(ctx, Math.min(1, (cs.t - t0) / dur), cs)
    };
}

/** @type {Record<string, (step: CutsceneStep, cs: CutsceneRun) => CutsceneFx|null>} */
const CUTSCENE_FX = {
    // --- Encendido y apagado de televisor (DOM) ---------------------
    crt_on(step, cs) {
        const t0 = cs.t;
        cutsceneDomAnim(cs.dom.crt, 'is-on', step.dur);
        return { type: 'crt_on', layer: 'screen', done: (c) => c.t - t0 >= step.dur, end: () => cs.dom.crt.classList.remove('is-on') };
    },
    crt_off(step, cs) {
        const t0 = cs.t;
        cutsceneDomAnim(cs.dom.canvas, 'is-off', step.dur);
        // La imagen se queda apagada hasta el final (la tarjeta del capítulo va encima)
        return { type: 'crt_off', layer: 'screen', done: (c) => c.t - t0 >= step.dur };
    },

    // --- Título de neón (DOM) ---------------------------------------
    title(step, cs) {
        const t0 = cs.t;
        const el = cs.dom.title;
        el.textContent = step.text;
        el.style.setProperty('--c', cutsceneColor(step.color));
        cutsceneDomAnim(el, 'is-on', step.dur);
        return { type: 'title', layer: 'screen', done: (c) => c.t - t0 >= step.dur, end: () => el.classList.remove('is-on') };
    },

    // --- Tarjeta del capítulo sobre negro (DOM) ---------------------
    chapter(step, cs) {
        cutsceneShowChapter(cs, step.text, step.sub);
        return { type: 'chapter', layer: 'screen', done: () => false };
    },

    // --- Puertas del ascensor (llegadas a los pisos) ----------------
    // Tapan la vista desde el primer fotograma: la escena empieza «desde
    // dentro del ascensor». Tras un instante con el LED del piso, se abren
    // hacia los lados en `dur`. Con movimiento reducido, un fundido.
    elevator_open(step, cs) {
        const t0 = cs.t;
        const hold = 0.3;
        const dur = Math.max(0.1, step.dur || 0.9);
        const floor = step.floor || '';
        return {
            type: 'elevator_open', layer: 'screen',
            done: (c) => c.t - t0 >= hold + dur,
            render(ctx, c) {
                const p = Math.max(0, Math.min(1, (c.t - t0 - hold) / dur));
                const k = c.reduced ? 0 : cutsceneEase('inOut', p);
                const W = c.view.uw, H = c.view.uh;
                const half = W / 2;
                ctx.save();
                if (c.reduced) ctx.globalAlpha = 1 - p;
                // Las dos hojas de acero, cada una con su canto dorado
                for (const side of [-1, 1]) {
                    const x = side < 0 ? -k * half : half + k * half;
                    const g = ctx.createLinearGradient(x, 0, x + half, 0);
                    g.addColorStop(0, side < 0 ? '#2B3038' : '#5E6672');
                    g.addColorStop(0.5, '#7D8591');
                    g.addColorStop(1, side < 0 ? '#5E6672' : '#2B3038');
                    ctx.fillStyle = g;
                    ctx.fillRect(x, 0, half, H);
                    // Acero cepillado: unas líneas verticales tenues
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                    for (let lx = x + 6; lx < x + half; lx += 9) ctx.fillRect(lx, 0, 1, H);
                    // Paneles
                    ctx.strokeStyle = 'rgba(10, 12, 16, 0.55)';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x + half * 0.18, H * 0.2, half * 0.64, H * 0.28);
                    ctx.strokeRect(x + half * 0.18, H * 0.55, half * 0.64, H * 0.3);
                    // Canto interior dorado
                    ctx.fillStyle = '#C9A227';
                    ctx.fillRect(side < 0 ? x + half - 4 : x, 0, 4, H);
                }
                // El marco dorado y el LED se van al abrirse
                ctx.globalAlpha *= 1 - k;
                ctx.strokeStyle = '#FACC15';
                ctx.lineWidth = 10;
                ctx.strokeRect(5, 5, W - 10, H - 10);
                const lw = 78, lh = 42;
                ctx.fillStyle = '#07080B';
                ctx.fillRect(half - lw / 2, 18, lw, lh);
                ctx.strokeStyle = '#C9A227';
                ctx.lineWidth = 3;
                ctx.strokeRect(half - lw / 2, 18, lw, lh);
                ctx.font = '22px "Press Start 2P", monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#F87171';
                ctx.shadowColor = '#EF4444';
                ctx.shadowBlur = 10;
                ctx.fillText(floor, half, 18 + lh / 2 + 2);
                ctx.restore();
            }
        };
    },

    // --- Estelas de coches por la autopista --------------------------
    traffic(step, cs) {
        const t0 = cs.t;
        /** @type {{ x: number, y: number, dir: number, speed: number, len: number, red: boolean }[]} */
        const cars = [];
        let acc = 0;
        return {
            type: 'traffic', layer: 'world',
            done: (c) => c.t - t0 >= step.dur && cars.length === 0,
            update(c, dt) {
                if (c.t - t0 < step.dur) {
                    acc += dt * 5;
                    while (acc >= 1) {
                        acc -= 1;
                        const red = vfxRandom() < 0.5;   // rojas se alejan, blancas vienen
                        const dir = red ? 1 : -1;
                        cars.push({ x: dir > 0 ? -120 : 1080, y: step.y + (red ? 6 : 0) + cutsceneRand(-1, 1),
                                    dir, speed: cutsceneRand(380, 620), len: cutsceneRand(40, 95), red });
                    }
                }
                for (const car of cars) car.x += car.dir * car.speed * dt;
                for (let i = cars.length - 1; i >= 0; i--) {
                    if (cars[i].x < -160 || cars[i].x > 1120) cars.splice(i, 1);
                }
            },
            render(ctx) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.lineCap = 'round';
                for (const car of cars) {
                    const tail = car.x - car.dir * car.len;
                    const g = ctx.createLinearGradient(tail, 0, car.x, 0);
                    const rgb = car.red ? '255, 70, 80' : '255, 246, 220';
                    g.addColorStop(0, `rgba(${rgb}, 0)`);
                    g.addColorStop(1, `rgba(${rgb}, 0.9)`);
                    ctx.strokeStyle = g;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(tail, car.y);
                    ctx.lineTo(car.x, car.y);
                    ctx.stroke();
                }
                ctx.restore();
            }
        };
    },

    // --- Chispazo: rayo, destello y chispas que caen -----------------
    spark(step, cs) {
        const t0 = cs.t;
        const color = cutsceneColor(step.color || '#FFFFFF');
        const bolt = cutsceneBoltPoints(step.x + cutsceneRand(-10, 10), step.y - 150, step.x, step.y, 3, 22);
        const bits = Array.from({ length: 14 }, () => ({
            vx: cutsceneRand(-120, 120), vy: cutsceneRand(-220, -40), life: cutsceneRand(0.4, 0.7)
        }));
        return {
            type: 'spark', layer: 'world',
            done: (c) => c.t - t0 >= 0.8,
            render(ctx, c) {
                const e = c.t - t0;
                // Destello de pantalla al 30 % (un rectángulo que cubre toda la escena)
                if (!c.reduced && e < 0.15) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * (1 - e / 0.15)})`;
                    ctx.fillRect(-200, -200, 1360, 940);
                }
                // El rayo parpadea (o se funde con movimiento reducido)
                const on = c.reduced ? e < 0.3 : (e < 0.08 || (e > 0.14 && e < 0.22) || (e > 0.28 && e < 0.34));
                if (on) cutsceneDrawBolt(ctx, bolt, color, 2.5);
                ctx.save();
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 8;
                for (const b of bits) {
                    if (e > b.life) continue;
                    const x = step.x + b.vx * e;
                    const y = step.y + b.vy * e + CUTSCENE_GRAVITY * e * e / 2;
                    ctx.globalAlpha = 1 - e / b.life;
                    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
                }
                ctx.restore();
            }
        };
    },

    // --- Temblor de cámara que se apaga -----------------------------
    shake(step, cs) {
        const t0 = cs.t;
        return {
            type: 'shake', layer: 'screen',
            done: (c) => c.t - t0 >= step.dur,
            shakeAmp: (c) => step.amp * Math.max(0, 1 - (c.t - t0) / step.dur)
        };
    },

    // --- Nube de polvo -----------------------------------------------
    dust(step, cs) {
        const puffs = Array.from({ length: 8 }, (_, i) => ({
            a: (i / 8) * Math.PI + cutsceneRand(-0.2, 0.2), r: cutsceneRand(14, 26)
        }));
        return cutsceneTimedFx('dust', 'world', cs.t, 0.8, (ctx, p) => {
            ctx.save();
            ctx.fillStyle = '#8A8F99';
            for (const f of puffs) {
                const d = 40 * p;
                ctx.globalAlpha = 0.5 * (1 - p);
                ctx.beginPath();
                ctx.arc(step.x + Math.cos(f.a) * d * 1.4, step.y - Math.sin(f.a) * d * 0.6, f.r * (0.5 + p), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });
    },

    // --- Faros pegados a un actor ------------------------------------
    beams(step, cs) {
        const dir = step.dir || -1;
        // Detrás de los actores: la luz no tapa a quien pasa por delante
        return {
            type: 'beams', layer: 'bg',
            done: (c) => !c.actors.has(step.actor),
            render(ctx, c) {
                const a = c.actors.get(step.actor);
                const box = a && cutsceneActorBox(c, a);
                if (!box) return;
                // El faro: al 6 % del morro y al 58 % del alto del sprite
                const x = dir < 0 ? box.left + box.w * 0.06 : box.left + box.w * 0.94;
                const y = box.top + box.h * 0.58;
                const len = 280 * a.s;
                const g = ctx.createLinearGradient(x, 0, x + dir * len, 0);
                g.addColorStop(0, 'rgba(255, 250, 225, 0.55)');
                g.addColorStop(1, 'rgba(255, 250, 225, 0)');
                ctx.save();
                ctx.globalAlpha = a.alpha;
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(x, y - 5 * a.s);
                ctx.lineTo(x + dir * len, y - 46 * a.s);
                ctx.lineTo(x + dir * len, y + 40 * a.s);
                ctx.lineTo(x, y + 5 * a.s);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        };
    },

    // --- Destello y velo de pantalla ---------------------------------
    flash(step, cs) {
        if (cs.reduced) return null;
        const color = cutsceneColor(step.color);
        return cutsceneTimedFx('flash', 'screen', cs.t, step.dur, (ctx, p, c) => {
            ctx.save();
            ctx.globalAlpha = 0.8 * (1 - p);
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, c.view.uw, c.view.uh);
            ctx.restore();
        });
    },
    veil(step, cs) {
        const t0 = cs.t;
        const color = cutsceneColor(step.color);
        return {
            type: 'veil', layer: 'screen',
            done: () => false,   // hasta el siguiente clear
            render(ctx, c) {
                ctx.save();
                ctx.globalAlpha = step.alpha * Math.min(1, (c.t - t0) / Math.max(0.01, step.dur || 0));
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, c.view.uw, c.view.uh);
                ctx.restore();
            }
        };
    },

    // --- Pelotas de energía desde la pala de cada Hachepe -------------
    // `to`: 'left' o 'right' (salen de la escena) o un punto [x, y],
    // donde las pelotas llegan y desaparecen.
    balls(step, cs) {
        const t0 = cs.t;
        const from = /** @type {string[]} */ (step.from) || [];
        const target = Array.isArray(step.to) ? /** @type {number[]} */ (step.to) : null;
        const dir = step.to === 'right' ? 1 : -1;
        const volleys = step.volleys || 1;
        const gap = step.gap || 0.4;
        /** @type {{ at: number, id: string }[]} */
        const queue = [];
        for (let v = 0; v < volleys; v++) {
            from.forEach((id, i) => queue.push({ at: t0 + v * gap + i * 0.05, id }));
        }
        /** @type {{ x: number, y: number, vx: number, vy: number, left: number, color: string, trail: { x: number, y: number }[] }[]} */
        const live = [];
        return {
            type: 'balls', layer: 'world',
            done: () => queue.length === 0 && live.length === 0,
            update(c, dt) {
                while (queue.length && queue[0].at <= c.t) {
                    const { id } = queue.shift();
                    const a = c.actors.get(id);
                    const box = a && cutsceneActorBox(c, a);
                    if (!box) continue;
                    const x = box.left + box.w * (target ? 0.5 : 0.7);
                    const y = box.top + box.h * 0.25;
                    const speed = cutsceneRand(950, 1150);
                    let vx = dir * speed, vy = cutsceneRand(-40, 90), left = Infinity;
                    if (target) {
                        left = Math.hypot(target[0] - x, target[1] - y);
                        vx = (target[0] - x) / (left || 1) * speed;
                        vy = (target[1] - y) / (left || 1) * speed;
                    }
                    live.push({ x, y, vx, vy, left, color: a.color || cutsceneColor('theme'), trail: [] });
                }
                for (const b of live) {
                    b.trail.unshift({ x: b.x, y: b.y });
                    if (b.trail.length > 8) b.trail.pop();
                    b.x += b.vx * dt;
                    b.y += b.vy * dt;
                    b.left -= Math.hypot(b.vx, b.vy) * dt;
                }
                for (let i = live.length - 1; i >= 0; i--) {
                    if (live[i].x < -60 || live[i].x > 1020 || live[i].left <= 0) live.splice(i, 1);
                }
            },
            render(ctx) {
                ctx.save();
                ctx.lineCap = 'round';
                for (const b of live) {
                    ctx.strokeStyle = b.color;
                    ctx.shadowColor = b.color;
                    ctx.shadowBlur = 12;
                    for (let i = 1; i < b.trail.length; i++) {
                        ctx.globalAlpha = 0.7 * (1 - i / b.trail.length);
                        ctx.lineWidth = 9 * (1 - i / b.trail.length);
                        ctx.beginPath();
                        ctx.moveTo(b.trail[i - 1].x, b.trail[i - 1].y);
                        ctx.lineTo(b.trail[i].x, b.trail[i].y);
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = b.color;
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = '#FFFFFF';
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        };
    },

    // --- Cristales rotos ---------------------------------------------
    glass(step, cs) {
        const shards = Array.from({ length: 12 }, () => ({
            vx: cutsceneRand(-160, 160), vy: cutsceneRand(-260, -80), rot: cutsceneRand(0, 6), spin: cutsceneRand(-9, 9),
            size: cutsceneRand(4, 9)
        }));
        return cutsceneTimedFx('glass', 'world', cs.t, 1.2, (ctx, p) => {
            const e = p * 1.2;
            ctx.save();
            ctx.fillStyle = 'rgba(220, 235, 255, 0.85)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 0.6;
            ctx.globalAlpha = 1 - p * p;
            for (const g of shards) {
                ctx.save();
                ctx.translate(step.x + g.vx * e, step.y + g.vy * e + CUTSCENE_GRAVITY * e * e / 2);
                ctx.rotate(g.rot + g.spin * e);
                ctx.beginPath();
                ctx.moveTo(0, -g.size);
                ctx.lineTo(g.size * 0.8, g.size * 0.6);
                ctx.lineTo(-g.size * 0.6, g.size * 0.4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
            ctx.restore();
        });
    },

    // --- Corte de señal ----------------------------------------------
    glitch(step, cs) {
        if (cs.reduced) return null;
        const t0 = cs.t;
        return {
            type: 'glitch', layer: 'screen',
            done: (c) => c.t - t0 >= step.dur,
            render(ctx, c) {
                const canvas = c.dom.canvas;
                const W = canvas.width;
                const H = canvas.height;
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                // Separación RGB: la imagen en rojo a un lado y en cian al otro
                const aux = cutsceneAuxCanvas(c, W, H);
                const actx = aux.getContext('2d');
                const shift = Math.round(5 * c.view.dpr);
                [['#FF0000', shift], ['#00FFFF', -shift]].forEach(([tint, dx]) => {
                    actx.globalCompositeOperation = 'copy';
                    actx.drawImage(canvas, 0, 0);
                    actx.globalCompositeOperation = 'multiply';
                    actx.fillStyle = /** @type {string} */ (tint);
                    actx.fillRect(0, 0, W, H);
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = 0.35;
                    ctx.drawImage(aux, /** @type {number} */ (dx), 0);
                });
                // Franjas horizontales desplazadas
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
                for (let i = 0; i < 6; i++) {
                    const sy = Math.floor(vfxRandom() * H);
                    const sh = Math.max(2, Math.floor(cutsceneRand(0.01, 0.06) * H));
                    const dx = Math.round(cutsceneRand(-28, 28) * c.view.dpr);
                    ctx.drawImage(canvas, 0, sy, W, sh, dx, sy, W, sh);
                }
                ctx.restore();
            }
        };
    },

    // --- Hojas de calendario que vuelan ------------------------------
    calendar(step, cs) {
        const t0 = cs.t;
        const fly = 2.6;
        const count = /** @type {number} */ (step.count);
        const sheets = Array.from({ length: count }, (_, i) => ({
            at: t0 + i * (step.dur - fly) / Math.max(1, count - 1),
            y: cutsceneRand(70, 400), amp: cutsceneRand(14, 36), rot: cutsceneRand(-0.6, 0.6),
            spin: cutsceneRand(-2.4, 2.4), day: 1 + Math.floor(vfxRandom() * 31), s: cutsceneRand(0.8, 1.15)
        }));
        return {
            type: 'calendar', layer: 'world',
            done: (c) => c.t - t0 >= step.dur,
            render(ctx, c) {
                for (const sh of sheets) {
                    const e = c.t - sh.at;
                    if (e < 0 || e > fly) continue;
                    const p = e / fly;
                    ctx.save();
                    ctx.translate(1010 - 1100 * p, sh.y + Math.sin(p * 7) * sh.amp);
                    ctx.rotate(sh.rot + sh.spin * e);
                    ctx.scale(sh.s * Math.max(0.15, Math.abs(Math.cos(e * 3))), sh.s);
                    ctx.fillStyle = '#F4F1EA';
                    ctx.fillRect(-22, -26, 44, 52);
                    ctx.fillStyle = '#E63946';
                    ctx.fillRect(-22, -26, 44, 13);
                    ctx.fillStyle = '#1A1A1A';
                    ctx.font = "14px 'Press Start 2P', monospace";
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(String(sh.day), 0, 7);
                    ctx.restore();
                }
            }
        };
    },

    // --- El fondo cambia con un círculo que crece ---------------------
    wipe(step, cs) {
        const t0 = cs.t;
        const to = /** @type {string} */ (step.to);
        const maxR = Math.max(...[[0, 0], [960, 0], [0, 540], [960, 540]].map(([x, y]) => Math.hypot(x - step.cx, y - step.cy)));
        return {
            type: 'wipe', layer: 'bg',
            done: (c) => c.t - t0 >= step.dur,
            render(ctx, c) {
                const p = cutsceneEase('inOut', Math.min(1, (c.t - t0) / step.dur));
                ctx.save();
                ctx.beginPath();
                ctx.arc(step.cx, step.cy, maxR * p, 0, Math.PI * 2);
                ctx.clip();
                cutsceneDrawBackground(ctx, c, to, 1);
                ctx.restore();
            },
            end(c, finished) {
                if (finished) cutsceneSetBackground(c, to, 0);
            }
        };
    },

    // --- Lluvia en dos capas -----------------------------------------
    rain(step) {
        let density = step.density ?? 1;
        return {
            type: 'rain', layer: 'screen',
            done: () => false,   // hasta rain on:false o un clear sin keep
            setDensity: (d) => { density = d; },
            render(ctx, c) {
                const { uw, uh } = c.view;
                ctx.save();
                ctx.lineCap = 'round';
                CUTSCENE_RAIN_LAYERS.forEach((L, li) => {
                    ctx.strokeStyle = `rgba(170, 180, 215, ${L.alpha})`;
                    ctx.lineWidth = L.width;
                    ctx.beginPath();
                    const n = Math.round(L.count * density * (uw / 960));
                    const span = uh + L.len;
                    for (let i = 0; i < n; i++) {
                        const u = vfxHash(i * 7 + li * 1009);
                        const v = vfxHash(i * 13 + li * 2003 + 1);
                        const y = ((v * span + c.t * L.speed) % span) - L.len;
                        const x = u * (uw + uh * L.tilt) - y * L.tilt;
                        ctx.moveTo(x + L.len * L.tilt, y - L.len);
                        ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                });
                ctx.restore();
            }
        };
    },

    // --- Relámpago: dos destellos azulados ---------------------------
    lightning(step, cs) {
        if (cs.reduced) return null;
        return cutsceneTimedFx('lightning', 'screen', cs.t, step.dur, (ctx, p, c) => {
            const a = p < 0.2 ? 0.35 : (p > 0.45 && p < 0.65) ? 0.22 : 0;
            if (!a) return;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(220, 227, 255, ${a})`;
            ctx.fillRect(0, 0, c.view.uw, c.view.uh);
            ctx.restore();
        });
    },

    // --- Cámara lenta (la aplica el reproductor) ----------------------
    slowmo(step, cs) {
        cs.slowmo = { factor: step.factor, from: cs.realT, until: cs.realT + step.dur };
        return null;
    },

    // --- Estela de color tras un actor que corre ---------------------
    streak(step, cs) {
        const t0 = cs.t;
        /** @type {{ t: number, x: number, y: number, sprite: string, flip: boolean, s: number }[]} */
        const hist = [];
        return {
            type: 'streak', layer: 'bg',
            done: (c) => c.t - t0 >= step.dur,
            update(c) {
                const a = c.actors.get(step.actor);
                if (!a) return;
                hist.unshift({ t: c.t, x: a.x, y: a.y, sprite: cutsceneActorSprite(c, a), flip: a.flip, s: a.s });
                if (hist.length > 90) hist.pop();
            },
            render(ctx, c) {
                const color = cutsceneColor(step.color);
                const lags = c.reduced ? [0.05] : [0.035, 0.07, 0.105];
                const alphas = [0.4, 0.25, 0.12];
                lags.forEach((lag, i) => {
                    const h = hist.find((e) => c.t - e.t >= lag);
                    if (!h || Math.abs(h.x - hist[0].x) < 2) return;   // quieto: sin estela
                    cutsceneDrawSprite(ctx, c, h.sprite, h.x, h.y, h.s, h.flip, alphas[i], color);
                });
            }
        };
    },

    // --- Ojos que se encienden en las ventanas ------------------------
    eyes(step, cs) {
        const t0 = cs.t;
        const pairs = step.pairs || [];
        const gap = step.gap || 0.3;
        return {
            type: 'eyes', layer: 'world',
            done: () => false,   // hasta el siguiente clear
            render(ctx, c) {
                ctx.save();
                pairs.forEach((pr, i) => {
                    const e = c.t - t0 - i * gap;
                    if (e < 0) return;
                    // Parpadeo de vez en cuando (estable: vfxHash, no consume azar)
                    const cycle = 2.3 + i * 0.37;
                    const k = Math.floor((c.t + i * 0.7) / cycle);
                    const inCycle = (c.t + i * 0.7) - k * cycle;
                    const blink = !c.reduced && vfxHash(k * 31 + i) < 0.45 && inCycle < 0.12;
                    ctx.globalAlpha = Math.min(1, e / 0.25);
                    ctx.fillStyle = pr.color;
                    ctx.shadowColor = pr.color;
                    ctx.shadowBlur = 12;
                    const ry = blink ? 0.4 : 1.8;
                    for (const dx of [-5, 5]) {
                        ctx.beginPath();
                        ctx.ellipse(pr.x + dx, pr.y, 3.2, ry, 0, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });
                ctx.restore();
            }
        };
    },

    // --- Ráfaga: partículas del tema desde el cuello del actor --------
    scarf_gust(step, cs) {
        const t0 = cs.t;
        /** @type {{ x: number, y: number, vx: number, vy: number, born: number }[]} */
        const motes = [];
        let acc = 0;
        return {
            type: 'scarf_gust', layer: 'world',
            done: (c) => c.t - t0 >= step.dur && motes.length === 0,
            update(c, dt) {
                const a = c.actors.get(step.actor);
                const box = a && cutsceneActorBox(c, a);
                if (box && c.t - t0 < step.dur) {
                    acc += dt * 34;
                    while (acc >= 1) {
                        acc -= 1;
                        motes.push({ x: box.left + box.w * cutsceneRand(0.42, 0.58), y: box.top + box.h * cutsceneRand(0.2, 0.28),
                                     vx: cutsceneRand(-220, -110), vy: cutsceneRand(-40, 25), born: c.t });
                    }
                }
                for (const m of motes) {
                    m.x += m.vx * dt;
                    m.y += m.vy * dt;
                }
                for (let i = motes.length - 1; i >= 0; i--) {
                    if (c.t - motes[i].born > 0.9) motes.splice(i, 1);
                }
            },
            render(ctx, c) {
                const color = cutsceneColor('theme');
                ctx.save();
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 8;
                for (const m of motes) {
                    ctx.globalAlpha = 0.9 * (1 - (c.t - m.born) / 0.9);
                    ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
                }
                ctx.restore();
            }
        };
    },

    // --- Explosión: destello, anillo y chispas del color --------------
    explosion(step, cs) {
        const t0 = cs.t;
        const color = cutsceneColor(step.color);
        const sparks = Array.from({ length: 24 }, (_, i) => ({
            a: (i / 24) * Math.PI * 2 + cutsceneRand(-0.15, 0.15), v: cutsceneRand(160, 360), life: cutsceneRand(0.45, 0.85)
        }));
        return {
            type: 'explosion', layer: 'world',
            done: (c) => c.t - t0 >= 0.9,
            render(ctx, c) {
                const e = c.t - t0;
                ctx.save();
                if (e < 0.25) {
                    const g = ctx.createRadialGradient(step.x, step.y, 0, step.x, step.y, 70);
                    g.addColorStop(0, `rgba(255, 255, 255, ${0.9 * (1 - e / 0.25)})`);
                    g.addColorStop(0.4, hexToRgba(color, 0.7 * (1 - e / 0.25)));
                    g.addColorStop(1, hexToRgba(color, 0));
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.arc(step.x, step.y, 70, 0, Math.PI * 2);
                    ctx.fill();
                }
                if (e < 0.5) {
                    ctx.strokeStyle = color;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 12;
                    ctx.globalAlpha = 1 - e / 0.5;
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.arc(step.x, step.y, 90 * Math.min(1, e / 0.4), 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.shadowBlur = 0;
                ctx.fillStyle = color;
                for (const s of sparks) {
                    if (e > s.life) continue;
                    ctx.globalAlpha = 1 - e / s.life;
                    const x = step.x + Math.cos(s.a) * s.v * e;
                    const y = step.y + Math.sin(s.a) * s.v * e + CUTSCENE_GRAVITY * 0.4 * e * e / 2;
                    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
                }
                ctx.restore();
            }
        };
    },

    // --- Hojas que caen de la copa con balanceo ------------------------
    leaves(step, cs) {
        const t0 = cs.t;
        const dur = step.dur || 4;
        const leaves = Array.from({ length: /** @type {number} */ (step.count) || 12 }, () => ({
            at: cutsceneRand(0, dur * 0.45), x: step.x + cutsceneRand(-70, 70), y: step.y + cutsceneRand(-30, 30),
            fall: cutsceneRand(35, 70), sway: cutsceneRand(10, 24), freq: cutsceneRand(1.6, 3), rot: cutsceneRand(0, 6),
            life: cutsceneRand(dur * 0.45, dur * 0.55), color: vfxRandom() < 0.5 ? '#2A6236' : '#1C4428'
        }));
        return {
            type: 'leaves', layer: 'world',
            done: (c) => c.t - t0 >= dur,
            render(ctx, c) {
                ctx.save();
                for (const l of leaves) {
                    const e = c.t - t0 - l.at;
                    if (e < 0 || e > l.life) continue;
                    const p = e / l.life;
                    ctx.globalAlpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
                    ctx.fillStyle = l.color;
                    ctx.save();
                    ctx.translate(l.x + Math.sin(e * l.freq) * l.sway, l.y + l.fall * e);
                    ctx.rotate(l.rot + Math.sin(e * l.freq) * 0.8);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                ctx.restore();
            }
        };
    },

    // --- Desmayo: desenfoque, viñeta roja que late y fundido a negro ---
    // El negro se queda hasta el siguiente `bg` o `clear` (los dos quitan
    // el efecto y su filtro). El desenfoque es un filtro CSS del canvas:
    // no lee píxeles, así que vale en file://.
    knockout(step, cs) {
        const t0 = cs.t;
        const dur = step.dur || 4;
        const canvas = cs.dom.canvas;
        return {
            type: 'knockout', layer: 'screen',
            done: () => false,
            update(c) {
                if (c.reduced) return;
                const p = Math.min(1, (c.t - t0) / dur);
                canvas.style.filter = `blur(${(5 * p).toFixed(2)}px)`;
            },
            render(ctx, c) {
                const e = c.t - t0;
                const { uw, uh } = c.view;
                ctx.save();
                if (!c.reduced && e < dur) {
                    const beat = Math.exp(-((e % 0.9) / 0.9) * 5);
                    const a = 0.5 * beat * Math.min(1, e / 0.5);
                    const g = ctx.createRadialGradient(uw / 2, uh / 2, Math.min(uw, uh) * 0.25, uw / 2, uh / 2, Math.max(uw, uh) * 0.7);
                    g.addColorStop(0, 'rgba(150, 0, 0, 0)');
                    g.addColorStop(1, `rgba(150, 0, 0, ${a})`);
                    ctx.fillStyle = g;
                    ctx.fillRect(0, 0, uw, uh);
                }
                const black = Math.max(0, Math.min(1, e - (dur - 1)));
                if (black > 0) {
                    ctx.fillStyle = `rgba(0, 0, 0, ${black})`;
                    ctx.fillRect(0, 0, uw, uh);
                }
                ctx.restore();
            },
            end() {
                canvas.style.filter = '';
            }
        };
    },

    // --- Presentación tipo pantalla VS ---------------------------------
    versus(step, cs) {
        const t0 = cs.t;
        const dur = step.dur || 4;
        return {
            type: 'versus', layer: 'screen',
            done: (c) => c.t - t0 >= dur,
            render(ctx, c) {
                const e = c.t - t0;
                const { uw, uh } = c.view;
                const pin = cutsceneEase('out', Math.min(1, e / 0.4));
                const pout = Math.max(0, Math.min(1, (e - (dur - 0.3)) / 0.3));
                const slide = (1 - pin) + pout;
                const size = Math.min(150, uw * 0.27);
                const cy = uh * 0.36;
                ctx.save();
                ctx.globalAlpha = 1 - pout;
                ctx.fillStyle = 'rgba(4, 5, 10, 0.55)';
                ctx.fillRect(0, 0, uw, uh);
                // Franja diagonal con los dos colores
                const by = uh * 0.74;
                ctx.save();
                ctx.translate(uw / 2, by);
                ctx.rotate(-0.07);
                const band = ctx.createLinearGradient(-uw / 2, 0, uw / 2, 0);
                band.addColorStop(0, hexToRgba(cutsceneColor(step.leftColor), 0.85));
                band.addColorStop(0.5, 'rgba(10, 10, 18, 0.95)');
                band.addColorStop(1, hexToRgba(cutsceneColor(step.rightColor), 0.85));
                ctx.fillStyle = band;
                ctx.fillRect(-uw * 0.6 * pin, -uh * 0.11, uw * 1.2 * pin, uh * 0.22);
                ctx.restore();
                /** @type {Array<[string|undefined, string|undefined, string|undefined, number]>} */
                const sides = [[step.left, step.leftName, step.leftColor, -1], [step.right, step.rightName, step.rightColor, 1]];
                for (const [id, name, col, side] of sides) {
                    const color = cutsceneColor(col);
                    const cx = uw / 2 + side * uw * 0.25 + side * slide * uw * 0.6;
                    if (id) cutsceneDrawBust(ctx, c, id, cx - size / 2, cy - size / 2, size, color, 0);
                    ctx.font = `${Math.round(Math.min(16, uw / 40))}px 'Press Start 2P', monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillStyle = color;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 10;
                    ctx.fillText(name || '', cx, cy + size / 2 + 12);
                    ctx.shadowBlur = 0;
                }
                // Texto central
                const text = step.text || '';
                const fs = Math.round(Math.min(26, (uw * 0.88) / Math.max(1, text.length)));
                ctx.globalAlpha = (1 - pout) * pin;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = `${fs}px 'Press Start 2P', monospace`;
                ctx.fillStyle = '#FFFFFF';
                ctx.shadowColor = '#000000';
                ctx.shadowBlur = 8;
                ctx.fillText(text, uw / 2, by - uh * 0.025);
                if (step.sub) {
                    ctx.font = `${Math.round(Math.max(9, fs * 0.5))}px 'Press Start 2P', monospace`;
                    ctx.fillStyle = '#E8ECF4';
                    ctx.fillText(step.sub, uw / 2, by + uh * 0.055);
                }
                ctx.restore();
            }
        };
    },

    // --- La partida desde arriba, con el aspecto del juego -------------
    // La cancha (palas, bola y estela) va en la capa 'world' sobre el
    // fondo `cancha`; el marcador y los bustos, en un efecto compañero de
    // la capa 'screen'. Todo con el reloj de la escena (cs.t).
    match(step, cs) {
        const m = cutsceneMatchPlan(step, cs);
        cs.fitW = CUTSCENE_MATCH.fitW;
        cs.fx = cs.fx.filter((f) => f.type !== 'match' && f.type !== 'match_hud');
        cs.fx.push({
            type: 'match_hud', layer: 'screen',
            done: () => m.over,
            render: (ctx, c) => cutsceneMatchHud(ctx, c, m)
        });
        return {
            type: 'match', layer: 'world',
            done: (c) => c.t - m.t0 >= m.dur,
            update: (c) => cutsceneMatchUpdate(c, m),
            render: (ctx, c) => cutsceneMatchCourt(ctx, c, m),
            end(c) {
                m.over = true;
                c.fitW = null;
            }
        };
    }
};

// -----------------------------------------------------------------
//  Bustos y la partida del prólogo (efectos versus y match)
// -----------------------------------------------------------------

/** Medidas de la partida de la escena 8, en unidades de escena. */
const CUTSCENE_MATCH = {
    top: 96, bottom: 486, xl: 170, xr: 790, pw: 12, ph: 70, r: 7,
    pointPause: 0.5,
    fitW: 700              // en vertical, la cámara se aleja hasta ver este ancho
};

/**
 * Dibuja un busto (busto_* del manifiesto) en un panel con el borde de su
 * color. `glow` (0…1) le da un pulso de brillo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {CutsceneRun} cs
 * @param {string} id
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {string} color
 * @param {number} glow
 */
function cutsceneDrawBust(ctx, cs, id, x, y, size, color, glow) {
    const info = cutsceneActorInfo(cs, id);
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 18, 0.9)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 + 24 * glow;
    ctx.fillRect(x, y, size, size);
    ctx.strokeRect(x, y, size, size);
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    if (info) drawTintedArt(ctx, info, cutsceneColor('theme'), x, y, size, size);
    ctx.restore();
}

/**
 * Un tramo de la bola en la partida del prólogo: de (x0, y0) a (x1, y1)
 * entre los segundos a y b. `side` es quien golpea al empezarlo; `miss`,
 * que la derecha no llega.
 * @typedef {{ a: number, b: number, x0: number, y0: number, x1: number, y1: number,
 *             side: 'L'|'R', miss: boolean, big: boolean, started: boolean, scored: boolean }} CutsceneMatchLeg
 */

/**
 * La partida en curso (efecto match).
 * @typedef {{ t0: number, dur: number, legs: CutsceneMatchLeg[],
 *             kf: { L: { t: number, y: number }[], R: { t: number, y: number }[] },
 *             breakAt: number, smash: boolean, over: boolean, score: number[],
 *             lc: string, rc: string, left: string|undefined, right: string|undefined,
 *             trail: { x: number, y: number }[], trailColor: string, shakeAt: number, glowAt: number }} CutsceneMatch
 */

/**
 * El plan de la partida: tramos de la bola y puntos clave de cada pala.
 * La izquierda siempre devuelve y la derecha falla al final de cada
 * peloteo (de 3 a 5 golpes). Con `smash`, un único punto: devolución,
 * carga de 1,2 s, bola grande y la pala derecha partida.
 * @param {CutsceneStep} step
 * @param {CutsceneRun} cs
 * @returns {CutsceneMatch}
 */
function cutsceneMatchPlan(step, cs) {
    const M = CUTSCENE_MATCH;
    const dur = step.dur || 10;
    const from = /** @type {number[]} */ (step.from) || [0, 0];
    const to = /** @type {number[]} */ (step.to) || from;
    const mid = (M.top + M.bottom) / 2;
    const yr = () => cutsceneRand(M.top + 40, M.bottom - 40);
    /** @type {CutsceneMatchLeg[]} */
    const legs = [];
    const kf = { L: [{ t: 0, y: mid }], R: [{ t: 0, y: mid }] };
    /** @param {number} a @param {number} b @param {'L'|'R'} side @param {number} y0 @param {number} y1 @param {boolean} miss @param {boolean} [big] */
    const leg = (a, b, side, y0, y1, miss, big = false) => {
        const x0 = side === 'L' ? M.xl + M.pw : M.xr;
        const x1 = miss ? M.xr + 60 : side === 'L' ? M.xr : M.xl + M.pw;
        legs.push({ a, b, x0, y0, x1, y1, side, miss, big, started: false, scored: false });
        kf[side].push({ t: a, y: y0 });
    };
    let breakAt = Infinity;
    if (step.smash) {
        const yHit = mid + cutsceneRand(-40, 40);
        const yBreak = yr();
        leg(0, dur * 0.2, 'R', yr(), yHit, false);
        leg(dur * 0.2, dur * 0.62, 'L', yHit, yBreak, false, true);
        kf.R.push({ t: dur * 0.62, y: yBreak });
        legs.push({ a: dur * 0.62, b: dur * 0.72, x0: M.xr, y0: yBreak, x1: M.xr + 70, y1: yBreak + 10,
                    side: 'L', miss: true, big: true, started: true, scored: false });
        breakAt = dur * 0.62;
    } else {
        const points = Math.max(0, to[0] - from[0]) + Math.max(0, to[1] - from[1]);
        const hits = Array.from({ length: points }, () => 3 + Math.floor(vfxRandom() * 3));
        const total = hits.reduce((s, h) => s + h, 0);
        const legT = (dur - points * M.pointPause) / Math.max(1, total);
        let t = 0;
        for (const h of hits) {
            // El último tramo siempre va hacia la derecha, que falla
            /** @type {'L'|'R'} */
            let side = h % 2 === 1 ? 'L' : 'R';
            let y = yr();
            for (let i = 0; i < h; i++) {
                const last = i === h - 1;
                const y1 = yr();
                leg(t, t + legT, side, y, y1, last);
                if (last) kf.R.push({ t: t + legT * 0.8, y: y1 + (y1 < mid ? 95 : -95) });
                t += legT;
                y = y1;
                side = side === 'L' ? 'R' : 'L';
            }
            t += M.pointPause;
        }
    }
    return {
        t0: cs.t, dur, legs, kf, breakAt, smash: !!step.smash, over: false,
        score: [from[0], from[1]],
        lc: cutsceneColor(step.leftColor), rc: cutsceneColor(step.rightColor),
        left: step.left, right: step.right,
        trail: [], trailColor: '#FFFFFF', shakeAt: -9, glowAt: -9
    };
}

/**
 * La posición de una pala: interpolación suave entre sus puntos clave.
 * @param {{ t: number, y: number }[]} keys
 * @param {number} e segundos desde el inicio
 */
function cutsceneMatchPaddleY(keys, e) {
    let prev = keys[0];
    for (const k of keys) {
        if (k.t > e) {
            const p = (e - prev.t) / Math.max(0.001, k.t - prev.t);
            return prev.y + (k.y - prev.y) * cutsceneEase('inOut', Math.min(1, Math.max(0, p)));
        }
        prev = k;
    }
    return prev.y;
}

/** @param {CutsceneMatch} m @param {number} e */
function cutsceneMatchBall(m, e) {
    const leg = m.legs.find((l) => e >= l.a && e < l.b);
    if (!leg) return null;
    const p = (e - leg.a) / (leg.b - leg.a);
    return { leg, x: leg.x0 + (leg.x1 - leg.x0) * p, y: leg.y0 + (leg.y1 - leg.y0) * p };
}

/**
 * Golpes (sonido y color de la estela), puntos y reacciones.
 * @param {CutsceneRun} c
 * @param {CutsceneMatch} m
 */
function cutsceneMatchUpdate(c, m) {
    const e = c.t - m.t0;
    for (const l of m.legs) {
        if (!l.started && e >= l.a) {
            l.started = true;
            m.trailColor = l.side === 'L' ? m.lc : m.rc;
            if (soundEffects.paddleHit) soundEffects.paddleHit({ x: l.x0 * GAME_WIDTH / CUTSCENE_W });
        }
        if (l.miss && !l.scored && e >= l.b) {
            l.scored = true;
            m.score[0]++;
            m.shakeAt = c.t;
            m.glowAt = c.t;
        }
    }
    const ball = cutsceneMatchBall(m, e);
    if (ball) {
        m.trail.unshift({ x: ball.x, y: ball.y });
        if (m.trail.length > (ball.leg.big ? 14 : 9)) m.trail.pop();
    } else {
        m.trail = [];
    }
}

/**
 * La cancha: palas, aura de la carga, bola con estela y la pala rota.
 * @param {CanvasRenderingContext2D} ctx
 * @param {CutsceneRun} c
 * @param {CutsceneMatch} m
 */
function cutsceneMatchCourt(ctx, c, m) {
    const M = CUTSCENE_MATCH;
    const e = c.t - m.t0;
    const yl = cutsceneMatchPaddleY(m.kf.L, e);
    const yr = cutsceneMatchPaddleY(m.kf.R, Math.min(e, m.breakAt));
    ctx.save();
    // Pala izquierda (y su aura mientras carga el smash)
    if (m.smash && e < m.dur * 0.2 + 0.1) {
        const k = Math.min(1, e / (m.dur * 0.2));
        ctx.fillStyle = hexToRgba(m.lc, 0.18 + 0.3 * k);
        ctx.shadowColor = m.lc;
        ctx.shadowBlur = 10 + 30 * k;
        ctx.beginPath();
        ctx.ellipse(M.xl + M.pw / 2, yl, 14 + 16 * k, M.ph / 2 + 14 + 10 * k, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    /** @param {number} x @param {number} y @param {string} color */
    const paddle = (x, y, color) => {
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.fillRect(x, y - M.ph / 2, M.pw, M.ph);
    };
    paddle(M.xl, yl, m.lc);
    if (e < m.breakAt) {
        paddle(M.xr, yr, m.rc);
    } else {
        // Dos mitades que salen girando
        const t = e - m.breakAt;
        ctx.globalAlpha = Math.max(0, 1 - t / 1.6);
        for (const [half, vx, vy] of [[-1, 120, -110], [1, 150, 90]]) {
            ctx.save();
            ctx.translate(M.xr + M.pw / 2 + vx * t, yr + half * M.ph / 4 + vy * t + 140 * t * t);
            ctx.rotate(half * 5 * t);
            ctx.fillStyle = m.rc;
            ctx.shadowColor = m.rc;
            ctx.shadowBlur = 10;
            ctx.fillRect(-M.pw / 2, -M.ph / 4, M.pw, M.ph / 2);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }
    // Bola y estela
    const ball = cutsceneMatchBall(m, e);
    if (ball) {
        const r = ball.leg.big ? M.r * 1.8 : M.r;
        ctx.lineCap = 'round';
        ctx.strokeStyle = m.trailColor;
        ctx.shadowColor = m.trailColor;
        ctx.shadowBlur = 12;
        for (let i = 1; i < m.trail.length; i++) {
            const k = 1 - i / m.trail.length;
            ctx.globalAlpha = 0.7 * k;
            ctx.lineWidth = r * 1.6 * k;
            ctx.beginPath();
            ctx.moveTo(m.trail[i - 1].x, m.trail[i - 1].y);
            ctx.lineTo(m.trail[i].x, m.trail[i].y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowBlur = ball.leg.big ? 24 : 12;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

/**
 * Marcador arriba (cada número del color de su lado) y los bustos en las
 * esquinas de abajo: el alcalde tiembla y suda al encajar; Yisus brilla
 * al anotar.
 * @param {CanvasRenderingContext2D} ctx
 * @param {CutsceneRun} c
 * @param {CutsceneMatch} m
 */
function cutsceneMatchHud(ctx, c, m) {
    const { uw, uh } = c.view;
    ctx.save();
    const fs = Math.round(Math.min(30, uw / 24));
    ctx.font = `${fs}px 'Press Start 2P', monospace`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    ctx.fillStyle = m.lc;
    ctx.shadowColor = m.lc;
    ctx.shadowBlur = 10;
    ctx.fillText(String(m.score[0]), uw / 2 - fs * 0.8, 18);
    ctx.textAlign = 'left';
    ctx.fillStyle = m.rc;
    ctx.shadowColor = m.rc;
    ctx.fillText(String(m.score[1]), uw / 2 + fs * 0.8, 18);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(232, 236, 244, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('-', uw / 2, 18);
    ctx.restore();

    const size = Math.min(110, uw * 0.16);
    const shake = c.t - m.shakeAt < 0.3 && !c.reduced ? Math.sin((c.t - m.shakeAt) * 90) * 4 : 0;
    const glowT = c.t - m.glowAt;
    const glow = glowT < 0.6 ? Math.sin(Math.PI * glowT / 0.6) : 0;
    const y = uh - size - 12;
    if (m.left) cutsceneDrawBust(ctx, c, m.left, 12, y, size, m.lc, glow);
    if (m.right) {
        const x = uw - size - 12 + shake;
        cutsceneDrawBust(ctx, c, m.right, x, y, size, m.rc, 0);
        // La gota de sudor
        const d = c.t - m.shakeAt;
        if (d >= 0 && d < 0.8) {
            ctx.save();
            ctx.globalAlpha = 1 - d / 0.8;
            ctx.fillStyle = '#7DD3FC';
            const dx = x + size * 0.78;
            const dy = y + size * 0.25 + d * 40;
            ctx.beginPath();
            ctx.moveTo(dx, dy - 7);
            ctx.quadraticCurveTo(dx + 5, dy + 1, dx, dy + 4);
            ctx.quadraticCurveTo(dx - 5, dy + 1, dx, dy - 7);
            ctx.fill();
            ctx.restore();
        }
    }
}
