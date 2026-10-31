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

    // --- Silueta blanca entre rayos (El Creador tras el cristal) ------
    silhouette(step, cs) {
        const t0 = cs.t;
        const info = cutsceneActorInfo(cs, step.sprite);
        return {
            type: 'silhouette', layer: 'world',
            done: (c) => c.t - t0 >= step.dur,
            render(ctx, c) {
                if (!info) return;
                const s = step.s || 1;
                const white = tintedMask(info.src, '#FFFFFF');
                const left = step.x - info.ax * s;
                const top = step.y - info.ay * s;
                if (white) ctx.drawImage(white, left, top, info.w * s, info.h * s);
                if (!step.lightning) return;
                // Tres rayos pequeños alrededor, que cambian cada 60 ms
                const frame = Math.floor((c.t - t0) / 0.06);
                const w = info.w * s;
                const h = info.h * s;
                const ends = [[left - 4, top + h * 0.2, left + w * 0.15, top + h * 0.55],
                              [left + w + 4, top + h * 0.15, left + w * 0.85, top + h * 0.5],
                              [left + w * 0.5, top - 12, left + w * 0.45, top + h * 0.18]];
                ends.forEach(([x0, y0, x1, y1], i) => {
                    if (!c.reduced && vfxHash(frame * 3 + i) < 0.3) return;
                    const j = (k) => (vfxHash(frame * 17 + i * 5 + k) - 0.5) * 10;
                    const pts = [{ x: x0, y: y0 }, { x: (x0 * 2 + x1) / 3 + j(1), y: (y0 * 2 + y1) / 3 + j(2) },
                                 { x: (x0 + x1 * 2) / 3 + j(3), y: (y0 + y1 * 2) / 3 + j(4) }, { x: x1, y: y1 }];
                    cutsceneDrawBolt(ctx, pts, '#DCE3FF', 1.2);
                });
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
    balls(step, cs) {
        const t0 = cs.t;
        const from = /** @type {string[]} */ (step.from) || [];
        const dir = step.to === 'right' ? 1 : -1;
        const volleys = step.volleys || 1;
        const gap = step.gap || 0.4;
        /** @type {{ at: number, id: string }[]} */
        const queue = [];
        for (let v = 0; v < volleys; v++) {
            from.forEach((id, i) => queue.push({ at: t0 + v * gap + i * 0.05, id }));
        }
        /** @type {{ x: number, y: number, vx: number, vy: number, color: string, trail: { x: number, y: number }[] }[]} */
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
                    live.push({ x: box.left + box.w * 0.7, y: box.top + box.h * 0.25,
                                vx: dir * cutsceneRand(950, 1150), vy: cutsceneRand(-40, 90),
                                color: a.color || cutsceneColor('theme'), trail: [] });
                }
                for (const b of live) {
                    b.trail.unshift({ x: b.x, y: b.y });
                    if (b.trail.length > 8) b.trail.pop();
                    b.x += b.vx * dt;
                    b.y += b.vy * dt;
                }
                for (let i = live.length - 1; i >= 0; i--) {
                    if (live[i].x < -60 || live[i].x > 1020) live.splice(i, 1);
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

    // --- Peloteo sobre la mesa: cada llegada al lado x1 es un punto ---
    rally(step, cs) {
        const t0 = cs.t;
        const legs = 10;
        // Cada tramo dura un 85 % del anterior: cada vez más rápido
        const raw = Array.from({ length: legs }, (_, i) => Math.pow(0.85, i));
        const total = raw.reduce((a, b) => a + b, 0);
        const durs = raw.map((d) => d / total * step.dur * 0.94);
        cs.rallyScore = 0;
        let leg = 0;
        let legStart = t0;
        return {
            type: 'rally', layer: 'world',
            done: (c) => c.t - t0 >= step.dur + 0.4,
            update(c) {
                while (leg < legs && c.t - legStart >= durs[leg]) {
                    legStart += durs[leg];
                    if (leg % 2 === 0) c.rallyScore++;   // llega al lado del alcalde
                    leg++;
                }
            },
            render(ctx, c) {
                if (leg >= legs) return;
                const p = Math.min(1, (c.t - legStart) / durs[leg]);
                const goingRight = leg % 2 === 0;
                const x = goingRight ? step.x0 + (step.x1 - step.x0) * p : step.x1 + (step.x0 - step.x1) * p;
                const y = step.y - Math.sin(p * Math.PI) * 26;
                ctx.save();
                ctx.fillStyle = '#FFFFFF';
                ctx.shadowColor = '#FFFFFF';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        };
    },

    // --- Marcador de neón --------------------------------------------
    scoreboard(step, cs) {
        const t0 = cs.t;
        const to = /** @type {number[]} */ (step.to) || [0, 0];
        return {
            type: 'scoreboard', layer: 'world',
            done: () => false,   // hasta el siguiente clear
            render(ctx, c) {
                const hasRally = c.fx.some((f) => f.type === 'rally');
                const p = Math.min(1, (c.t - t0) / step.dur);
                const left = Math.min(to[0], hasRally || c.rallyScore ? c.rallyScore : Math.round(to[0] * p));
                const right = Math.min(to[1], Math.round(to[1] * p));
                const color = cutsceneColor(step.color);
                const text = `${step.left} ${left} – ${right} ${step.right}`;
                ctx.save();
                ctx.font = "16px 'Press Start 2P', monospace";
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const w = ctx.measureText(text).width + 40;
                ctx.fillStyle = 'rgba(6, 7, 12, 0.78)';
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.shadowColor = color;
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.rect(step.x - w / 2, step.y - 22, w, 44);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = color;
                ctx.fillText(text, step.x, step.y + 1);
                ctx.restore();
            }
        };
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
        const sheets = Array.from({ length: step.count }, (_, i) => ({
            at: t0 + i * (step.dur - fly) / Math.max(1, step.count - 1),
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
    }
};
