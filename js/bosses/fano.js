/**
 * bosses/fano.js
 * ------------------------------------------------------------------
 * 4 · FANO — El fan del coco (piso 3, Sala de control), con Chayipiti
 *
 * Combate por fases (bosses/phases.js) en la sala de control:
 *   1 · Apagón       el campo son 4 franjas de 200; cada 5 s una de las
 *                    tres de la derecha parpadea 0,8 s y se queda a
 *                    oscuras 2,5 s (la tuya nunca). Dentro, la bola casi
 *                    no se ve; las palas, siempre
 *   2 · Predicción   en cada golpe tuyo Chayipiti predice dónde llegará
 *                    la bola si fuera recta y Fano va directo allí; con
 *                    efecto o con smash se buguea («ERROR 404») y Fano
 *                    no sabe a dónde ir hasta que la bola cruza el centro
 *   3 · Clones       tras cada golpe de Fano salen dos hologramas a ±15°
 *                    que no chocan ni marcan; solo cuenta la bola real.
 *                    Vuelven los apagones: cada 7 s, 5 s a oscuras, y
 *                    dentro la bola real y los hologramas apenas se ven
 * Su K.O.: la cara de Chayipiti da «ERROR FATAL» y se encienden las luces.
 *
 * El azar de la física es Math.random (la franja que se apaga y el
 * objetivo de Fano cuando Chayipiti se buguea); el «N %» de la
 * predicción y el temblor de la línea, vfxRandom.
 *
 * Lo registra bosses/index.js en BOSS_MECHANICS, que se carga después.
 * ------------------------------------------------------------------
 */

'use strict';

/** Medidas y tiempos del combate de Fano (unidades del campo, ms). */
const FANO = {
    color: '#8B5CF6',
    purple: '#A855F7',
    red: '#EF4444',
    lilac: '#E9D5FF',
    // Fase 1 · el apagón (y la fase 3, más largo y más espaciado)
    stripeW: 200,
    stripeFirst: 1500,
    stripeEvery: 5000,
    blinkMs: 800,
    darkMs: 2500,
    clonesDarkEvery: 7000,
    clonesDarkMs: 5000,
    darkAlpha: 0.88,
    ballDim: 0.08,
    trailDim: 0.25,
    // Fase 2 · la predicción
    veil: 0.3,
    predictMs: 500,
    errorMs: 900,
    speedUp: 0.1,             // aiSpeed de más siguiendo la predicción (× paddleSpeed)
    glitchEvery: 250,
    glitchUntilX: GAME_WIDTH / 2,
    // Fase 3 · los clones
    cloneAngle: 15 * Math.PI / 180,
    cloneMinX: 0.45,          // nunca casi verticales
    cloneMax: 6,
    cloneAlpha: 0.55,
    cloneBlinkMs: 400,
    cloneEndX: 30,
    // La cara de Chayipiti en la esquina y el K.O.
    face: { x: 690, y: 12, size: 48 },
    koLeadMs: 1400,
    koErrorMs: 900
};

/** Tiempo de combate (ms). */
function fanoNow() {
    return bossState.time || 0;
}

// ------------------------------------------------------------------
//  Fase 1 · el apagón
// ------------------------------------------------------------------

/**
 * Un apagón: el campo son 4 franjas de 200 y, cada `every` ms, una de las
 * tres de la derecha (nunca la del jugador ni la de la vez anterior)
 * parpadea `blinkMs` y se queda a oscuras `darkMs`. Lo usan la fase 1 y
 * la 3 de Fano y la invocación de Fano del Creador, cada una con su
 * estado y su reloj (`now`, ms).
 * @typedef {{ on: boolean, fade: number, stripe: { idx: number, t0: number }|null,
 *             at: number, every: number, darkMs: number }} FanoDark
 */

/**
 * @param {number} first cuándo se apaga la primera (ms del reloj del dueño)
 * @param {number} every
 * @param {number} darkMs
 * @returns {FanoDark}
 */
function fanoDarkMake(first, every, darkMs) {
    return { on: true, fade: 1, stripe: null, at: first, every, darkMs };
}

/** @param {FanoDark|null} st @param {number} now @returns {number} franja a oscuras ahora (1–3), o -1 */
function fanoDarkStripe(st, now) {
    const s = st && st.stripe;
    if (!st || !st.on || !s) return -1;
    const t = now - s.t0;
    return t >= FANO.blinkMs && t < FANO.blinkMs + st.darkMs ? s.idx : -1;
}

/** @param {FanoDark|null} st @param {number} now @returns {number} franja que parpadea antes de apagarse, o -1 */
function fanoBlinkStripe(st, now) {
    const s = st && st.stripe;
    if (!st || !st.on || !s) return -1;
    return now - s.t0 < FANO.blinkMs ? s.idx : -1;
}

/** Cada `every` ms se apaga otra de las tres franjas de la derecha. @param {FanoDark} st @param {number} now */
function fanoDarkTick(st, now) {
    if (!st.on || now < st.at) return;
    const options = [1, 2, 3].filter((i) => !st.stripe || i !== st.stripe.idx);
    const idx = options[Math.floor(Math.random() * options.length)];
    st.stripe = { idx, t0: now };
    st.at = now + st.every;
    bossSfx('switchClick');
}

/**
 * @param {FanoDark|null} st @param {number} now @param {{ x: number }} b
 * @returns {boolean} ¿está su centro en la franja a oscuras?
 */
function fanoDarkHas(st, now, b) {
    const idx = fanoDarkStripe(st, now);
    return idx > 0 && b.x >= idx * FANO.stripeW && b.x < (idx + 1) * FANO.stripeW;
}

/** @param {{ x: number }} b @returns {boolean} ¿está en la franja a oscuras del combate de Fano? */
function fanoInDark(b) {
    return fanoDarkHas(bossState.dark, fanoNow(), b);
}

// ------------------------------------------------------------------
//  Fase 2 · la predicción
// ------------------------------------------------------------------

/**
 * La trayectoria recta de la bola (con los rebotes en las paredes, sin
 * efecto) hasta la x de Fano: sus puntos y la llegada.
 * @param {Ball} b
 */
function fanoPredict(b) {
    const pts = [{ x: b.x, y: b.y }];
    let x = b.x, y = b.y, dy = b.dy;
    const dx = Math.max(0.5, b.dx);
    const r = b.radius;
    for (let n = 0; n < 2000 && x + r < p2.x; n++) {
        x += dx;
        y += dy;
        if (y - r < 0 || y + r > GAME_HEIGHT) {
            y = Math.max(r, Math.min(GAME_HEIGHT - r, y));
            dy = -dy;
            pts.push({ x, y });
        }
    }
    pts.push({ x, y });
    return { pts, y };
}

/**
 * Un golpe del jugador: Chayipiti predice. Con efecto o con smash, se
 * buguea.
 * @param {Ball} b
 */
function fanoOnPlayerHit(b) {
    const fail = Math.abs(b.spin) > MECH.spinSoundMin || b.power === 'super';
    const { pts, y } = fanoPredict(b);
    bossState.pred = { ball: b, pts, y, at: fanoNow(), pct: 85 + Math.floor(vfxRandom() * 13), fail };
    bossState.glitch = fail;
    bossState.glitchNext = 0;
    if (fail) {
        bossSfx('glitch');
        bossState.errorAt = fanoNow();
        bossTaunt('predictFail');
    }
}

// ------------------------------------------------------------------
//  Fase 3 · los clones
// ------------------------------------------------------------------

/**
 * Tras un golpe de Fano: dos hologramas con la velocidad de la bola real
 * y su ángulo a ±15°.
 * @param {Ball} b
 */
function fanoSpawnClones(b) {
    const speed = Math.hypot(b.dx, b.dy);
    const base = Math.atan2(b.dy, b.dx);
    for (const s of [-1, 1]) {
        const a = base + s * FANO.cloneAngle;
        let dx = Math.cos(a), dy = Math.sin(a);
        if (Math.abs(dx) < FANO.cloneMinX) {
            dx = (dx < 0 ? -1 : 1) * FANO.cloneMinX;
            dy = (dy < 0 ? -1 : 1) * Math.sqrt(1 - FANO.cloneMinX * FANO.cloneMinX);
        }
        bossState.clones.push({ parent: b, x: b.x, y: b.y, dx: dx * speed, dy: dy * speed, radius: b.radius, born: fanoNow() });
    }
    while (bossState.clones.length > FANO.cloneMax) bossState.clones.shift();
}

/** @param {number} dt */
function fanoMoveClones(dt) {
    for (const c of bossState.clones) {
        c.x += c.dx * dt;
        c.y += c.dy * dt;
        if (c.y - c.radius < 0 || c.y + c.radius > GAME_HEIGHT) {
            c.y = Math.max(c.radius, Math.min(GAME_HEIGHT - c.radius, c.y));
            c.dy = -c.dy;
        }
    }
    bossState.clones = bossState.clones.filter((c) => c.x >= FANO.cloneEndX && c.x <= GAME_WIDTH + 20);
}

// ------------------------------------------------------------------
//  Dibujo
// ------------------------------------------------------------------

/**
 * Las franjas de un apagón: la que parpadea y la apagada. `color` es el
 * de los avisos (el morado de Fano, o el blanco de los fantasmas del
 * Creador).
 * @param {CanvasRenderingContext2D} ctx
 * @param {FanoDark|null} st
 * @param {number} now
 * @param {string} [color]
 */
function fanoDrawDark(ctx, st, now, color = FANO.purple) {
    if (!st) return;
    const fade = st.on ? 1 : st.fade || 0;
    if (fade <= 0) return;
    // Mientras se apaga (fade < 1) se dibuja la última franja como estaba
    const view = st.on ? st : { ...st, on: true };
    const dark = fanoDarkStripe(view, now);
    const blink = fanoBlinkStripe(view, now);
    ctx.save();
    if (dark > 0) {
        ctx.globalAlpha = FANO.darkAlpha * fade;
        ctx.fillStyle = '#000';
        ctx.fillRect(dark * FANO.stripeW, 0, FANO.stripeW, GAME_HEIGHT);
        ctx.globalAlpha = 0.7 * fade;
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        ctx.fillText('APAGADA', dark * FANO.stripeW + FANO.stripeW / 2, 40);
    }
    if (blink > 0) {
        const on = Math.floor(now / 100) % 2 === 0;
        const x = blink * FANO.stripeW;
        ctx.globalAlpha = (on ? 0.22 : 0.08) * fade;
        ctx.fillStyle = color;
        ctx.fillRect(x, 0, FANO.stripeW, GAME_HEIGHT);
        ctx.globalAlpha = fade;
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, 1, FANO.stripeW - 2, GAME_HEIGHT - 2);
        ctx.setLineDash([]);
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        ctx.fillText('SIGUIENTE', x + FANO.stripeW / 2, 40);
    }
    ctx.restore();
}

/**
 * Los primeros `k` (0–1) de una línea quebrada, medidos por su longitud.
 * @param {{ x: number, y: number }[]} pts
 * @param {number} k
 */
function fanoCutPath(pts, k) {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    let left = total * k;
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const seg = Math.hypot(b.x - a.x, b.y - a.y);
        if (seg >= left) {
            const t = seg > 0 ? left / seg : 0;
            out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
            return out;
        }
        out.push(b);
        left -= seg;
    }
    return out;
}

/** La línea punteada de la predicción (o su ERROR 404). @param {CanvasRenderingContext2D} ctx */
function fanoDrawPrediction(ctx) {
    const pred = bossState.pred;
    if (!pred || !bossState.predictOn) return;
    const since = fanoNow() - pred.at;
    const life = pred.fail ? FANO.errorMs : FANO.predictMs;
    if (since >= life) return;
    const pts = pred.pts;
    ctx.save();
    ctx.globalAlpha = 1 - since / life;
    ctx.strokeStyle = FANO.purple;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.shadowColor = FANO.purple;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    if (pred.fail) {
        // La línea tiembla y se corta a medio camino
        const path = fanoCutPath(pts, 0.45);
        path.forEach((p, i) => {
            const jx = (vfxRandom() - 0.5) * 8, jy = (vfxRandom() - 0.5) * 8;
            if (i) ctx.lineTo(p.x + jx, p.y + jy); else ctx.moveTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        const tip = path[path.length - 1];
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 1 - since / life;
        bossSign(ctx, 'ERROR 404', Math.min(620, tip.x + 30), Math.max(84, Math.min(GAME_HEIGHT - 24, tip.y + 24)), FANO.red, 9);
    } else {
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        const end = pts[pts.length - 1];
        ctx.font = '9px "Press Start 2P", monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = FANO.purple;
        ctx.fillText(`${pred.pct} %`, end.x - 22, Math.max(18, Math.min(GAME_HEIGHT - 10, end.y - 12)));
    }
    ctx.restore();
}

/** Un holograma: la bola equipada al 55 %, con líneas de escaneo y parpadeo. @param {CanvasRenderingContext2D} ctx */
function fanoDrawClones(ctx) {
    if (!bossState.clones.length) return;
    const now = fanoNow();
    const color = currentThemeHex();
    for (const c of bossState.clones) {
        // Dentro de la franja apagada, tan tenue como la bola real
        const flick = fanoInDark(c) ? FANO.ballDim
            : (now - c.born) % FANO.cloneBlinkMs < 70 ? 0.25 : FANO.cloneAlpha;
        /** @type {Ball} */
        const ghost = { x: c.x, y: c.y, radius: c.radius, speed: 0, dx: c.dx, dy: c.dy, trail: [], spin: 0, power: null, owner: null, squash: 0, warpMs: Infinity };
        drawDimmed(flick, (lc) => renderBallVFX(lc, ghost, color));
        ctx.save();
        ctx.globalAlpha = flick;
        ctx.strokeStyle = 'rgba(233, 213, 255, 0.8)';
        ctx.lineWidth = 1;
        for (let y = c.y - c.radius + 2; y < c.y + c.radius; y += 3) {
            const half = Math.sqrt(Math.max(0, c.radius * c.radius - (y - c.y) * (y - c.y)));
            ctx.beginPath();
            ctx.moveTo(c.x - half, y);
            ctx.lineTo(c.x + half, y);
            ctx.stroke();
        }
        ctx.restore();
    }
}

/** La cara de Chayipiti en la esquina de la arena (y su ERROR FATAL). @param {CanvasRenderingContext2D} ctx */
function fanoDrawFace(ctx) {
    const f = FANO.face;
    const ko = bossState.ko;
    const err = !!ko || fanoNow() - (bossState.errorAt ?? -9999) < 600;
    const info = err ? CAMPAIGN_ART.bustos.chayipiti_error : CAMPAIGN_ART.bustos.chayipiti;
    ctx.save();
    ctx.fillStyle = ko ? '#1D4ED8' : 'rgba(12, 6, 24, 0.85)';
    ctx.strokeStyle = ko ? '#93C5FD' : FANO.purple;
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 10;
    ctx.fillRect(f.x, f.y, f.size, f.size);
    ctx.strokeRect(f.x, f.y, f.size, f.size);
    ctx.shadowBlur = 0;
    const img = artImage(info.src);
    if (img) ctx.drawImage(img, f.x + 2, f.y + 2, f.size - 4, f.size - 4);
    if (ko) {
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('ERROR FATAL', f.x + f.size / 2, f.y + f.size + 12);
    }
    ctx.restore();
}

// ------------------------------------------------------------------
//  El jefe
// ------------------------------------------------------------------

/** @type {BossMechanics} */
const bossFano = {
    config: { targetScore: 9, aiSpeed: 0.78, aiError: 20, aiBias: 40 },
    color: FANO.color,
    lives: 5,
    koLeadMs: FANO.koLeadMs,

    // IA de la tabla de la guía (D.7) con aiBias ajustado al bot de prueba
    // de ±30 px (66/58/50 → 40/32/24): unos 5,2 min por combate. El bot no
    // sufre la oscuridad ni los clones, así que gana casi siempre.
    phases: [
        {
            name: 'Apagón',
            goals: 3,
            config: { aiSpeed: 0.78, aiError: 20, aiBias: 40, spin: 0.25, smash: 0 }
        },
        {
            name: 'Predicción',
            goals: 3,
            config: { aiSpeed: 0.84, aiError: 16, aiBias: 32, spin: 0.45, smash: 0.10 },
            transition(t) {
                bossState.dark.on = false;
                bossState.dark.fade = 1 - t;    // las franjas se apagan
                bossState.veil = FANO.veil * t; // y las luces bajan
            },
            enter() {
                bossState.predictOn = true;
                bossState.veil = FANO.veil;
                bossState.pred = null;
                bossState.glitch = false;
            }
        },
        {
            name: 'Clones',
            goals: 3,
            config: { aiSpeed: 0.90, aiError: 12, aiBias: 24, spin: 0.60, smash: 0.40 },
            transition(t) {
                bossState.predictOn = false;
                bossState.glitch = false;
                bossState.veil = FANO.veil * (1 - t);
            },
            enter() {
                bossState.veil = 0;
                bossState.clonesOn = true;
                bossState.clones = [];
                // Los apagones vuelven, más largos
                bossState.dark = fanoDarkMake(fanoNow() + FANO.stripeFirst, FANO.clonesDarkEvery, FANO.clonesDarkMs);
            }
        }
    ],

    init() {
        Object.assign(bossState, {
            time: 0,
            dark: fanoDarkMake(FANO.stripeFirst, FANO.stripeEvery, FANO.darkMs), darkTaunted: false,
            veil: 0, predictOn: false, pred: null, glitch: false, glitchY: GAME_HEIGHT / 2, glitchNext: 0, errorAt: -9999,
            clonesOn: false, clones: [], koSfx: 0
        });
        const arena = CAMPAIGN_ART.pisos.arena_fano;
        for (const src of [arena.src, arena.theme, CAMPAIGN_ART.bustos.chayipiti.src, CAMPAIGN_ART.bustos.chayipiti_error.src]) artLoad(src);
    },

    update(dt) {
        bossState.time = fanoNow() + dt * MS_PER_FRAME;
        if (bossState.dark.on) {
            fanoDarkTick(bossState.dark, fanoNow());
            if (!bossState.darkTaunted && state.balls.some(fanoInDark)) {
                bossState.darkTaunted = true;
                bossTaunt('dark');
            }
        }
        if (bossState.clonesOn) fanoMoveClones(dt);
    },

    ai(target, aiSpeed, errorMargin, cfg, dt) {
        if (!bossState.predictOn) {
            bossPlay(target, aiSpeed, errorMargin, cfg, dt);
            return;
        }
        const pred = bossState.pred;
        /** @type {number|null} */
        let goal = null;
        let speed = aiSpeed;
        if (target && target.dx > 0 && bossState.glitch && target.x < FANO.glitchUntilX) {
            // Chayipiti se bugueó: Fano no sabe a dónde ir
            if (fanoNow() >= bossState.glitchNext) {
                bossState.glitchY = p2.height / 2 + Math.random() * (GAME_HEIGHT - p2.height);
                bossState.glitchNext = fanoNow() + FANO.glitchEvery;
            }
            goal = bossState.glitchY;
        } else if (target && target.dx > 0 && pred && !pred.fail && pred.ball === target) {
            // Va directo al punto que predijo Chayipiti (con su desvío de siempre)
            goal = pred.y + bossAim();
            speed = aiSpeed + FANO.speedUp * paddleSpeed;
        }
        bossPlayPaddle(p2, target, speed, errorMargin, cfg, dt, bossPlanP2, { goal });
    },

    onHit(b, side) {
        if (side === 'p1') {
            if (bossState.predictOn) fanoOnPlayerHit(b);
            if (bossState.clonesOn) bossState.clones = bossState.clones.filter((c) => c.parent !== b);
            return;
        }
        bossState.pred = null;
        bossState.glitch = false;
        if (bossState.clonesOn) fanoSpawnClones(b);
    },

    onGoal() {
        bossState.clones = [];
        bossState.pred = null;
        bossState.glitch = false;
    },

    ballAlpha(b) {
        return fanoInDark(b) ? { ball: FANO.ballDim, trail: FANO.trailDim } : null;
    },

    koTick(ms) {
        if (bossState.koSfx === 0) {
            bossState.koSfx = 1;
            bossState.clones = [];
            bossSfx('glitch');
        } else if (bossState.koSfx === 1 && ms >= FANO.koErrorMs) {
            bossState.koSfx = 2;
            bossSfx('lightsOn');
        }
    },

    renderArena(ctx) {
        drawTintedArt(ctx, CAMPAIGN_ART.pisos.arena_fano, currentThemeHex(), 0, 0, GAME_WIDTH, GAME_HEIGHT);
    },

    render(ctx) {
        // Las luces bajas y las franjas apagadas van encima del campo y
        // debajo de las palas (que siempre se ven)
        if (bossState.veil > 0 && !bossState.ko) {
            ctx.save();
            ctx.globalAlpha = bossState.veil;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            ctx.restore();
        }
        fanoDrawDark(ctx, bossState.dark, fanoNow());
        fanoDrawFace(ctx);
        fanoDrawPrediction(ctx);
        fanoDrawClones(ctx);
        // La bola real, en la fase de los clones, lleva una sombra pequeña
        if (bossState.clonesOn) {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            for (const b of state.balls) {
                if (fanoInDark(b)) continue;
                ctx.beginPath();
                ctx.ellipse(b.x + 3, b.y + b.radius + 4, b.radius * 0.9, b.radius * 0.35, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    },

    renderOverlay(ctx) {
        // …y el centro blanco
        if (bossState.clonesOn && !bossState.ko) {
            ctx.save();
            ctx.fillStyle = '#FFFFFF';
            for (const b of state.balls) {
                if (fanoInDark(b)) continue;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius * 0.42, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        // K.O.: un destello blanco, se encienden todas las luces
        const ko = bossState.ko;
        if (ko && ko.ms >= FANO.koErrorMs) {
            const t = Math.min(1, (ko.ms - FANO.koErrorMs) / (FANO.koLeadMs - FANO.koErrorMs));
            ctx.save();
            ctx.globalAlpha = 0.85 * (1 - t);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            ctx.restore();
        }
    }
};
