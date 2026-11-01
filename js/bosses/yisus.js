/**
 * bosses/yisus.js
 * ------------------------------------------------------------------
 * 5 · YISUS — El Aura (piso 4, El trono), con Mariangel y Pedro
 *
 * Combate por fases (bosses/phases.js) en el trono:
 *   1 · El Aura           un halo dorado alarga 60 por arriba y por abajo
 *                         la superficie con la que devuelve; cada bola
 *                         tuya que toca el halo (no la pala) lo agrieta, y
 *                         con 3 grietas estalla: 6 s sin halo
 *   2 · El tiempo es mío  cada tercer golpe suyo la bola se congela 0,8 s
 *                         a mitad de camino (reloj dorado, pantalla
 *                         desaturada) y sale con otro ángulo, avisado
 *                         0,3 s antes; tu pala no se congela
 *   3 · El ataúd          un ataúd de 30×140 sube y baja en x 600; cada
 *                         6 s su tapa brilla 1 s y dispara una bola dorada
 *                         real hacia ti (como mucho 2 bolas en juego)
 *   4 · Aura máxima       velo dorado, pala de 130, el halo vuelve y el
 *                         tiempo se para cada cuarto golpe
 * Su K.O.: la pala se parte en dos y Yisus cae de rodillas.
 *
 * Mariangel y Pedro miran desde el marcador del jefe (.boss-side):
 * Mariangel salta con cada «Ji» y se va en el «…Ji.» de su derrota; Pedro
 * está de rodillas hasta la fase 3.
 *
 * El azar de la física es Math.random (el ángulo tras la pausa del
 * tiempo, el desvío del ataúd); lo visual (las grietas del halo, sus
 * fragmentos), vfxRandom.
 *
 * Lo registra bosses/index.js en BOSS_MECHANICS, que se carga después.
 * ------------------------------------------------------------------
 */

'use strict';

/** Medidas y tiempos del combate de Yisus (unidades del campo, ms). */
const YISUS = {
    color: '#FACC15',
    gold: '#FACC15',
    white: '#FFFFFF',
    mariangel: '#F472B6',
    pedro: '#60A5FA',
    // El halo
    haloW: 40,
    haloExtra: 60,
    haloCracks: 3,
    haloOffMs: 6000,
    haloShardsMs: 400,
    // La parada del tiempo
    stopX: GAME_WIDTH / 2,
    stopMs: 800,
    stopWarnMs: 300,
    stopMinDeg: 25,
    stopMaxDeg: 55,
    clockUnits: 80,
    // El ataúd
    coffinX: 600,
    coffinW: 30,
    coffinH: 140,
    coffinTop: 80,
    coffinBottom: 520,
    coffinSpeed: 120 / 60,     // px por fotograma (120 px/s)
    coffinEvery: 6000,
    coffinChargeMs: 1000,
    coffinMaxBalls: 2,
    coffinAimDeg: 30,
    // Aura máxima
    maxPaddleH: 130,
    veil: 0.08,
    // K.O.
    koLeadMs: 1600,
    koKneelAt: 500
};

/** Tiempo de combate (ms). */
function yisusNow() {
    return bossState.time || 0;
}

// ------------------------------------------------------------------
//  El halo (también lo invoca el Creador en su fase 2: estado propio)
// ------------------------------------------------------------------

/**
 * El halo de una pala: grietas (en unidades relativas al centro del
 * halo), cuándo estalló y si está encendido.
 * @typedef {{ on: boolean, cracks: { y: number, pts: { x: number, y: number }[] }[],
 *             brokeAt: number, offUntil: number }} YisusHalo
 */

/** @returns {YisusHalo} */
function yisusHaloMake() {
    return { on: true, cracks: [], brokeAt: -99999, offUntil: 0 };
}

/**
 * La cápsula del halo alrededor de una pala.
 * @param {Paddle} p
 */
function yisusHaloBox(p) {
    const cx = p.x + p.width / 2;
    return { x: cx - YISUS.haloW / 2, y: p.y - YISUS.haloExtra, w: YISUS.haloW, h: p.height + YISUS.haloExtra * 2, cx };
}

/** Vuelve a encender el halo cuando pasa su tiempo apagado. @param {YisusHalo} st @param {number} now */
function yisusHaloTick(st, now) {
    if (!st.on && now >= st.offUntil) {
        st.on = true;
        st.cracks = [];
    }
}

/**
 * La bola contra el halo (no contra la pala, que es de hitPaddles): rebota
 * como un golpe de esa pala y, si era tuya, lo agrieta.
 * @param {YisusHalo} st
 * @param {Paddle} p la pala del halo
 * @param {Ball} b
 * @param {number} now
 * @param {(broke: boolean) => void} [onCrack]
 * @returns {boolean} true si la bola rebotó
 */
function yisusHaloCollide(st, p, b, now, onCrack) {
    if (!st.on || b.dx <= 0) return false;
    const box = yisusHaloBox(p);
    if (b.x + b.radius < box.x || b.x - b.radius > box.x + box.w) return false;
    if (b.y + b.radius < box.y || b.y - b.radius > box.y + box.h) return false;
    // A la altura de la pala manda la pala
    if (b.y + b.radius >= p.y && b.y - b.radius <= p.y + p.height) return false;
    const mine = b.owner === 'p1';
    // Rebota como un golpe de la pala, con la superficie alargada
    const y0 = p.y, h0 = p.height;
    p.y = box.y;
    p.height = box.h;
    resolveHit(b, p, currentSpeedPreset().max * (state.fever ? MECH.feverMaxSpeedK : 1), false);
    p.y = y0;
    p.height = h0;
    b.x = box.x - b.radius;
    if (mine) {
        const rel = b.y - (p.y + p.height / 2);
        const pts = [];
        for (let i = 0; i <= 5; i++) pts.push({ x: -YISUS.haloW / 2 + i * YISUS.haloW / 5, y: rel + (vfxRandom() - 0.5) * 10 });
        st.cracks.push({ y: rel, pts });
        const broke = st.cracks.length >= YISUS.haloCracks;
        if (broke) {
            st.on = false;
            st.brokeAt = now;
            st.offUntil = now + YISUS.haloOffMs;
        }
        if (onCrack) onCrack(broke);
    }
    return true;
}

/**
 * Dibuja el halo, sus grietas y, al estallar, sus 14 fragmentos.
 * @param {CanvasRenderingContext2D} ctx
 * @param {YisusHalo} st
 * @param {Paddle} p
 * @param {number} now
 * @param {string} [color] dorado; el Creador lo invoca en blanco
 */
function yisusHaloRender(ctx, st, p, now, color = YISUS.gold) {
    const box = yisusHaloBox(p);
    const cy = p.y + p.height / 2;
    ctx.save();
    if (st.on) {
        const r = YISUS.haloW / 2;
        ctx.beginPath();
        ctx.moveTo(box.x + r, box.y);
        ctx.arcTo(box.x + box.w, box.y, box.x + box.w, box.y + box.h, r);
        ctx.arcTo(box.x + box.w, box.y + box.h, box.x, box.y + box.h, r);
        ctx.arcTo(box.x, box.y + box.h, box.x, box.y, r);
        ctx.arcTo(box.x, box.y, box.x + box.w, box.y, r);
        ctx.closePath();
        ctx.globalAlpha *= 0.22;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha /= 0.22;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Cada grieta, una línea blanca en zigzag que se queda
        ctx.strokeStyle = YISUS.white;
        ctx.lineWidth = 2.5;
        for (const k of st.cracks) {
            ctx.beginPath();
            k.pts.forEach((pt, i) => (i ? ctx.lineTo(box.cx + pt.x, cy + pt.y) : ctx.moveTo(box.cx + pt.x, cy + pt.y)));
            ctx.stroke();
        }
    }
    // Al estallar: 14 fragmentos durante 0,4 s
    const e = now - st.brokeAt;
    if (e >= 0 && e < YISUS.haloShardsMs) {
        const k = e / YISUS.haloShardsMs;
        ctx.fillStyle = color;
        ctx.globalAlpha *= 1 - k;
        for (let i = 0; i < 14; i++) {
            const a = vfxHash(i * 31 + 7) * Math.PI * 2;
            const d = (40 + vfxHash(i * 17 + 3) * 90) * k;
            ctx.save();
            ctx.translate(box.cx + Math.cos(a) * d, cy + Math.sin(a) * d * 1.6);
            ctx.rotate(a + k * 6);
            ctx.fillRect(-4, -2, 8, 4);
            ctx.restore();
        }
    }
    ctx.restore();
}

// ------------------------------------------------------------------
//  La parada del tiempo
// ------------------------------------------------------------------

/**
 * Congela una bola a mitad de camino. El ángulo de salida (25–55°) se
 * decide ya (Math.random: es física); el lado, 0,3 s antes de salir.
 * @param {Ball} b
 */
function yisusFreeze(b) {
    const deg = YISUS.stopMinDeg + Math.random() * (YISUS.stopMaxDeg - YISUS.stopMinDeg);
    b.frozen = { ms: YISUS.stopMs, angle: deg * Math.PI / 180, dir: 0 };
    b.tsPending = false;
    b.spin = 0;
    b.dx = 0;
    b.dy = 0;
    bossSfx('timeStop');
    bossTaunt('timeStop');
    yisusHop();
}

/**
 * Cuenta la pausa de una bola congelada y la suelta.
 * @param {Ball} b
 * @param {number} ms
 */
function yisusTickFrozen(b, ms) {
    const f = b.frozen;
    f.ms -= ms;
    // 0,3 s antes: hacia el lado contrario de tu pala
    if (f.dir === 0 && f.ms <= YISUS.stopWarnMs) f.dir = p1.y + p1.height / 2 < b.y ? 1 : -1;
    if (f.ms > 0) return;
    if (f.dir === 0) f.dir = p1.y + p1.height / 2 < b.y ? 1 : -1;
    b.dx = -b.speed * Math.cos(f.angle);
    b.dy = f.dir * b.speed * Math.sin(f.angle);
    b.frozen = null;
}

/** ¿Hay alguna bola congelada? */
function yisusAnyFrozen() {
    return state.balls.some((b) => b.frozen);
}

// ------------------------------------------------------------------
//  El ataúd
// ------------------------------------------------------------------

/** Rectángulo del ataúd en el campo. */
function yisusCoffinBox() {
    const c = bossState.coffin;
    return { x: c.x - YISUS.coffinW / 2, y: c.y, w: YISUS.coffinW, h: YISUS.coffinH };
}

/** Sube y baja, y cada 6 s su tapa brilla y dispara. @param {number} dt @param {number} now */
function yisusTickCoffin(dt, now) {
    const c = bossState.coffin;
    c.y += c.dir * YISUS.coffinSpeed * dt;
    if (c.y <= YISUS.coffinTop) { c.y = YISUS.coffinTop; c.dir = 1; }
    if (c.y + YISUS.coffinH >= YISUS.coffinBottom) { c.y = YISUS.coffinBottom - YISUS.coffinH; c.dir = -1; }
    if (c.chargeAt < 0 && now >= c.fireAt - YISUS.coffinChargeMs) {
        // Con 2 bolas en juego la tapa no dispara (esta vez)
        if (state.balls.length >= YISUS.coffinMaxBalls) {
            c.fireAt += YISUS.coffinEvery;
            return;
        }
        c.chargeAt = now;
        bossSfx('coffinCharge');
    }
    if (c.chargeAt >= 0 && now >= c.fireAt) {
        c.chargeAt = -1;
        c.fireAt = now + YISUS.coffinEvery;
        if (state.balls.length < YISUS.coffinMaxBalls) yisusFireGolden();
    }
}

/** La bola dorada: una bola real más, hacia ti, a velocidad normal. */
function yisusFireGolden() {
    const box = yisusCoffinBox();
    const x = box.x - 12;
    const y = box.y + box.h / 2;
    const speed = currentSpeedPreset().base;
    const lim = YISUS.coffinAimDeg * Math.PI / 180;
    const a = Math.max(-lim, Math.min(lim, Math.atan2(p1.y + p1.height / 2 - y, x - (p1.x + p1.width))));
    const b = createBall(x, y, speed, -speed * Math.cos(a), speed * Math.sin(a));
    b.golden = true;
    b.owner = 'p2';
    state.balls.push(b);
    spawnParticles(x, y, YISUS.gold, 18);
    bossSfx('paddleHit', { x, speedRatio: 0.6 });
    bossTaunt('coffin');
}

/**
 * La bola contra el ataúd: rebota y sale con algo de desvío, nunca casi
 * vertical (y casi plana si vuelve hacia ti, como las celdas de Dani).
 * @param {Ball} b
 * @returns {boolean}
 */
function yisusCoffinCollide(b) {
    const r = yisusCoffinBox();
    const nx = Math.max(r.x, Math.min(r.x + r.w, b.x));
    const ny = Math.max(r.y, Math.min(r.y + r.h, b.y));
    if (Math.hypot(b.x - nx, b.y - ny) > b.radius) return false;
    if (b.y > r.y && b.y < r.y + r.h) {
        // Cara lateral
        if (b.x < r.x + r.w / 2) { b.dx = -Math.abs(b.dx); b.x = r.x - b.radius; }
        else { b.dx = Math.abs(b.dx); b.x = r.x + r.w + b.radius; }
    } else {
        // Tapa o pie
        if (b.y < r.y + r.h / 2) { b.dy = -Math.abs(b.dy); b.y = r.y - b.radius; }
        else { b.dy = Math.abs(b.dy); b.y = r.y + r.h + b.radius; }
    }
    const back = b.dx < 0;
    b.dy += (Math.random() - 0.5) * (back ? 0.15 : 0.3) * b.speed;
    bossNormalizeBall(b, back ? 0.7 : 0.42);
    b.spin = 0;
    bossSfx('clang');
    spawnParticles(b.x, b.y, YISUS.gold, 8);
    return true;
}

// ------------------------------------------------------------------
//  Mariangel y Pedro
// ------------------------------------------------------------------

/** Mariangel salta (con cada «Ji» y en cada pausa del tiempo). */
function yisusHop() {
    const el = bossSideWho('mariangel');
    if (!el) return;
    el.classList.remove('is-hop');
    void el.offsetWidth;
    el.classList.add('is-hop');
}

// ------------------------------------------------------------------
//  Dibujo
// ------------------------------------------------------------------

/** El reloj dorado que gira (una vuelta por segundo) alrededor de cada bola congelada. @param {CanvasRenderingContext2D} ctx */
function yisusDrawClocks(ctx) {
    const info = CAMPAIGN_ART.juego.reloj;
    const img = artImage(info.src);
    for (const b of state.balls) {
        const f = b.frozen;
        if (!f) continue;
        const s = YISUS.clockUnits;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate((yisusNow() / 1000) * Math.PI * 2);
        if (img) ctx.drawImage(img, -s / 2, -s / 2, s, s);
        ctx.restore();
        // La línea dorada de salida, 0,3 s antes
        if (f.dir !== 0) {
            const len = 420;
            ctx.save();
            ctx.strokeStyle = YISUS.gold;
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 8]);
            ctx.shadowColor = YISUS.gold;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(b.x - Math.cos(f.angle) * len, b.y + f.dir * Math.sin(f.angle) * len);
            ctx.stroke();
            ctx.restore();
        }
    }
}

/** El ataúd (y su tapa que brilla antes de disparar). @param {CanvasRenderingContext2D} ctx */
function yisusDrawCoffin(ctx) {
    const c = bossState.coffin;
    if (!c || c.alpha <= 0) return;
    const charging = c.chargeAt >= 0;
    const info = charging ? CAMPAIGN_ART.juego.ataud_campo_carga : CAMPAIGN_ART.juego.ataud_campo;
    const img = artImage(info.src);
    const w = info.pxW / 2, h = info.pxH / 2;
    const r = yisusCoffinBox();
    ctx.save();
    ctx.globalAlpha = c.alpha;
    if (img) ctx.drawImage(img, r.x + r.w / 2 - w / 2, r.y + r.h / 2 - h / 2, w, h);
    else {
        ctx.fillStyle = '#3F3F46';
        ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    if (charging) {
        const k = Math.min(1, (yisusNow() - c.chargeAt) / YISUS.coffinChargeMs);
        ctx.globalAlpha = c.alpha * (0.25 + 0.45 * k);
        ctx.fillStyle = YISUS.gold;
        ctx.shadowColor = YISUS.gold;
        ctx.shadowBlur = 24 * k;
        ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    }
    ctx.restore();
}

/** Las dos mitades de la pala y Yisus de rodillas (K.O.). @param {CanvasRenderingContext2D} ctx */
function yisusDrawKo(ctx) {
    const ko = bossState.koHalves;
    if (!ko) return;
    ctx.save();
    ctx.fillStyle = YISUS.gold;
    ctx.shadowColor = YISUS.gold;
    ctx.shadowBlur = 12;
    for (const h of ko.halves) {
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(h.rot);
        ctx.fillRect(-h.w / 2, -h.h / 2, h.w, h.h);
        ctx.restore();
    }
    ctx.restore();
    // Yisus de rodillas, con un fotograma de destello al aparecer
    const t = ko.ms - YISUS.koKneelAt;
    const info = PROLOGO_ASSETS.actors.yisus_rodillas;
    if (t < 0 || !info) return;
    const s = 0.75;
    const x = GAME_WIDTH - 95, y = GAME_HEIGHT - 30;
    const flash = t < 60;
    const img = flash ? tintedMask(info.src, '#FFFFFF') : artImage(info.src);
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = flash ? 1 : Math.min(1, t / 200);
    ctx.drawImage(img, x - info.ax * s, y - info.ay * s, info.w * s, info.h * s);
    ctx.restore();
}

// ------------------------------------------------------------------
//  El jefe
// ------------------------------------------------------------------

/** @type {BossMechanics} */
const bossYisus = {
    config: { targetScore: 11, aiSpeed: 0.80, aiError: 18, aiBias: 44 },
    color: YISUS.color,
    lives: 5,
    koLeadMs: YISUS.koLeadMs,
    // Arranca en su llegada (LLEGADAS[5]) y sigue sin cortarse por la VS
    music: 'yisus_trono',
    companions: [
        { id: 'mariangel', color: YISUS.mariangel },
        { id: 'pedro', color: YISUS.pedro, cls: 'is-kneel' }   // de rodillas hasta la fase 3
    ],

    // IA de la tabla de la guía (F.6), un escalón más que Fano, con aiBias
    // ajustado al bot de prueba (62/56/50/46 → 44/39/34/30): gana unos 3 de
    // cada 6 combates (25 de 48) en 7,6 min de media
    phases: [
        {
            name: 'El Aura',
            goals: 3,
            config: { aiSpeed: 0.80, aiError: 18, aiBias: 44, spin: 0.30, smash: 0 }
        },
        {
            name: 'El tiempo es mío',
            goals: 3,
            config: { aiSpeed: 0.86, aiError: 15, aiBias: 39, spin: 0.50, smash: 0.15 },
            transition(t) {
                bossState.haloOn = false;
                bossState.haloFade = 1 - t;
            },
            enter() {
                bossState.haloOn = false;
                bossState.haloFade = 0;
                bossState.stopEvery = 3;
                bossState.hits = 0;
            }
        },
        {
            name: 'El ataúd',
            goals: 3,
            config: { aiSpeed: 0.90, aiError: 12, aiBias: 34, spin: 0.60, smash: 0.35 },
            transition(t) {
                // Pedro se negó: se pone de pie; el ataúd sale de la espalda de Yisus
                bossSideState('pedro', 'is-kneel', false);
                bossState.stopEvery = 0;
                const c = bossState.coffin;
                c.x = p2.x + (YISUS.coffinX - p2.x) * t;
                c.alpha = t;
            },
            enter() {
                const c = bossState.coffin;
                c.x = YISUS.coffinX;
                c.alpha = 1;
                c.on = true;
                c.chargeAt = -1;
                c.fireAt = yisusNow() + YISUS.coffinEvery;
            }
        },
        {
            name: 'Aura máxima',
            goals: 2,
            config: { aiSpeed: 0.94, aiError: 10, aiBias: 30, spin: 0.65, smash: 0.50 },
            transition(t) {
                bossState.coffin.on = false;
                bossState.coffin.alpha = 1 - t;
                bossState.veil = YISUS.veil * t;
            },
            enter() {
                bossState.coffin.alpha = 0;
                bossState.veil = YISUS.veil;
                bossState.haloOn = true;
                bossState.haloFade = 1;
                bossState.halo = yisusHaloMake();
                bossState.stopEvery = 4;
                bossState.hits = 0;
                // Su pala crece a 130, desde el centro
                const cy = p2.y + p2.height / 2;
                p2.height = YISUS.maxPaddleH;
                p2.y = Math.max(0, Math.min(GAME_HEIGHT - p2.height, cy - p2.height / 2));
            }
        }
    ],

    init() {
        Object.assign(bossState, {
            time: 0,
            halo: yisusHaloMake(), haloOn: true, haloFade: 1,
            stopEvery: 0, hits: 0, tsClass: false,
            coffin: { on: false, x: p2.x, y: (GAME_HEIGHT - YISUS.coffinH) / 2, dir: 1, alpha: 0, chargeAt: -1, fireAt: 0 },
            veil: 0, koHalves: null
        });
        const j = CAMPAIGN_ART.juego;
        const arena = CAMPAIGN_ART.final.arena_yisus;
        for (const src of [arena.src, arena.theme, j.reloj.src, j.ataud_campo.src, j.ataud_campo_carga.src, PROLOGO_ASSETS.actors.yisus_rodillas.src]) artLoad(src);
    },

    update(dt) {
        const ms = dt * MS_PER_FRAME;
        bossState.time = yisusNow() + ms;
        const now = yisusNow();
        // Nada dispara ni se congela durante la cuenta atrás del saque
        const live = state.serveCountdownMs <= 0;
        if (bossState.haloOn) yisusHaloTick(bossState.halo, now);
        if (live) {
            for (const b of state.balls) {
                if (b.frozen) yisusTickFrozen(b, ms);
                else if (b.tsPending && b.dx < 0 && b.x <= YISUS.stopX) yisusFreeze(b);
            }
            if (bossState.coffin.on) yisusTickCoffin(dt, now);
        }
        // La pantalla, desaturada mientras el tiempo está parado
        const frozen = yisusAnyFrozen();
        if (frozen !== bossState.tsClass) {
            bossState.tsClass = frozen;
            document.getElementById('canvas-wrapper').classList.toggle('is-timestop', frozen);
        }
    },

    collide(b) {
        if (b.frozen) return false;
        if (bossState.haloOn && yisusHaloCollide(bossState.halo, p2, b, yisusNow(), (broke) => {
            bossSfx(broke ? 'auraBreak' : 'auraCrack');
            if (broke) bossTaunt('auraBreak');
        })) return true;
        if (bossState.coffin.on && yisusCoffinCollide(b)) return true;
        return false;
    },

    onHit(b, side) {
        if (side === 'p1') {
            b.tsPending = false;
            return;
        }
        // Cada tercer (fase 2) o cuarto (fase 4) golpe suyo, la bola se congela a mitad de camino
        if (!bossState.stopEvery) return;
        bossState.hits++;
        if (bossState.hits % bossState.stopEvery === 0) b.tsPending = true;
    },

    onGoal() {
        // Un gol suelta las bolas congeladas (con multibola, la otra sigue)
        for (const b of state.balls) {
            b.tsPending = false;
            if (b.frozen) {
                b.frozen.ms = 0;
                yisusTickFrozen(b, 0);
            }
        }
        bossState.tsClass = false;
        document.getElementById('canvas-wrapper').classList.remove('is-timestop');
    },

    onLine(line) {
        // Mariangel salta con cada «Ji» y se va en el «…Ji.» de su derrota
        if (typeof line === 'string' || line.s !== 'b') return;
        if (line.t === '…Ji.') bossSideState('mariangel', 'is-gone', true);
        else if (/Ji/.test(line.t)) yisusHop();
    },

    paddleColor() {
        return YISUS.gold;
    },

    paddleHidden(p) {
        return p === p2 && !!bossState.koHalves;
    },

    trailStyle(b) {
        return b.golden ? { tint: YISUS.gold } : null;
    },

    koTick(ms) {
        // La pala se parte en dos mitades que salen girando
        if (!bossState.koHalves) {
            const h = p2.height / 2;
            const cx = p2.x + p2.width / 2;
            bossState.koHalves = {
                ms: 0,
                halves: [
                    { x: cx, y: p2.y + h / 2, w: p2.width, h, rot: 0, vx: -0.05, vy: -0.16, vr: -0.006 },
                    { x: cx, y: p2.y + h * 1.5, w: p2.width, h, rot: 0, vx: -0.035, vy: 0.04, vr: 0.008 }
                ]
            };
            bossState.coffin.on = false;
            bossSfx('paddleBreak');
            spawnParticles(cx, p2.y + h, YISUS.gold, 30);
            triggerShake(8, 250);
        }
        const k = bossState.koHalves;
        const step = ms - k.ms;
        k.ms = ms;
        for (const half of k.halves) {
            half.x += half.vx * step;
            half.y += half.vy * step;
            half.vy += 0.00035 * step;
            half.rot += half.vr * step;
        }
    },

    renderArena(ctx) {
        drawTintedArt(ctx, CAMPAIGN_ART.final.arena_yisus, currentThemeHex(), 0, 0, GAME_WIDTH, GAME_HEIGHT);
    },

    render(ctx) {
        if (!bossState.koHalves && (bossState.haloOn || bossState.haloFade > 0)) {
            ctx.save();
            ctx.globalAlpha = bossState.haloOn ? 1 : bossState.haloFade;
            yisusHaloRender(ctx, bossState.halo, p2, yisusNow());
            ctx.restore();
        }
        yisusDrawCoffin(ctx);
        yisusDrawClocks(ctx);
    },

    renderOverlay(ctx) {
        // Las bolas doradas del ataúd
        if (!bossState.ko) {
            ctx.save();
            for (const b of state.balls) {
                if (!b.golden) continue;
                ctx.fillStyle = YISUS.gold;
                ctx.shadowColor = YISUS.gold;
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        // Aura máxima: la pantalla se tiñe de oro y late
        if (bossState.veil > 0 && !bossState.ko) {
            ctx.save();
            ctx.globalAlpha = bossState.veil * (0.7 + 0.3 * Math.sin(yisusNow() / 400));
            ctx.fillStyle = YISUS.gold;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            ctx.restore();
        }
        yisusDrawKo(ctx);
    }
};
