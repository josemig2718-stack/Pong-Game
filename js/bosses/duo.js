/**
 * bosses/duo.js
 * ------------------------------------------------------------------
 * 3 · MARIO Y VALEN — El Diablo Rojo y El Relajado (piso 2, Sala de juegos)
 *
 * Dos palas a la misma altura del campo: Mario (p2) defiende arriba y
 * Valen (la gemela, p2Twin) abajo. Mario devuelve ×1,15 y sin efecto;
 * Valen, ×0,85 con mucho efecto. La estela toma el color del que golpeó.
 * Al marcarles, se retira 3 s la pala de la mitad por la que entró el gol.
 *
 * Combate por fases (bosses/phases.js):
 *   1 · Cooperativo   solo lo común
 *   2 · Pinball       tres bumpers en su campo; tus bolas los encienden y
 *                     con los tres, TILT: sus palas se bloquean 4 s. El
 *                     perrito de Valen corre por el borde de abajo
 *   3 · Modo Diablo   Mario arde (más rápido, ×1,2); cada 7 s Valen se
 *                     distrae con el móvil y Mario intenta cubrirlo todo
 * Su K.O.: «YOU WIN» de máquina de arcade, Mario cae y Valen aplaude.
 *
 * Las dos palas usan bossPlayPaddle (game/ai.js), cada una con su plan.
 * El azar de la física es Math.random (el signo del efecto de Valen
 * incluido); el perrito, el fuego y las chispas son solo dibujo.
 *
 * Lo registra bosses/index.js en BOSS_MECHANICS, que se carga después.
 * ------------------------------------------------------------------
 */

'use strict';

/** Medidas y tiempos del combate del dúo (unidades del campo, ms). */
const DUO = {
    mario: '#E63946',
    valen: '#C98A4B',
    gray: '#6B7280',
    lime: '#A3E635',
    gold: '#FACC15',
    phone: '#93C5FD',
    mid: GAME_HEIGHT / 2,
    marioK: 1.15,
    marioK3: 1.2,
    valenK: 0.85,
    valenSpin: 0.8,           // fracción del efecto máximo (b.spin va de -1 a 1)
    capK: 1.2,                // tope: el del preset × 1,2
    retreatMs: 3000,
    // Fase 2 · pinball
    bumpers: [{ x: 540, y: 170 }, { x: 540, y: 430 }, { x: 690, y: 250 }],
    bumperR: 26,
    bumperK: 1.15,
    tiltMs: 4000,
    // Fase 3 · Modo Diablo
    marioBoost: 0.08,         // aiSpeed de más (× paddleSpeed)
    afkEvery: 7000,
    phoneMs: 1000,
    liveMs: 3000,
    driftK: 0.25,             // Valen en directo: baja despacio (× paddleSpeed)
    koLeadMs: 1400
};

/** @type {BossPlanSlot} */
const duoPlanMario = { plan: null, wasComing: false };
/** @type {BossPlanSlot} */
const duoPlanValen = { plan: null, wasComing: false };

/** Tiempo de combate (ms). */
function duoNow() {
    return bossState.time || 0;
}

/** ¿Están bloqueadas sus palas (TILT)? */
function duoTilted() {
    return duoNow() < (bossState.tiltUntil || 0);
}

/**
 * Qué hace Valen en el Modo Diablo: 'play', 'phone' (1 s sacando el
 * móvil) o 'live' (3 s viendo un directo). Cada 7 s desde la fase.
 */
function duoValenMood() {
    if (!bossState.diablo) return 'play';
    const e = duoNow() - bossState.afkT0;
    if (e < DUO.afkEvery) return 'play';
    const c = (e - DUO.afkEvery) % DUO.afkEvery;
    if (c < DUO.phoneMs) return 'phone';
    if (c < DUO.phoneMs + DUO.liveMs) return 'live';
    return 'play';
}

/**
 * Cambia el módulo de la velocidad sin cambiar la dirección.
 * @param {Ball} b
 * @param {number} speed
 */
function duoSetSpeed(b, speed) {
    const k = speed / (b.speed || 1);
    b.dx *= k;
    b.dy *= k;
    b.speed = speed;
}

/**
 * La bola que viene hacia el dúo más cercana, en una mitad del campo.
 * @param {'top'|'bottom'|'all'} half
 * @returns {Ball|undefined}
 */
function duoIncoming(half) {
    let best;
    for (const b of state.balls) {
        if (b.dx <= 0) continue;
        if (half === 'top' && b.y >= DUO.mid) continue;
        if (half === 'bottom' && b.y < DUO.mid) continue;
        if (!best || b.x > best.x) best = b;
    }
    return best;
}

// ------------------------------------------------------------------
//  Fase 2 · pinball
// ------------------------------------------------------------------

/**
 * El estado de unos bumpers: cuándo se golpeó cada uno (su destello) y
 * los «+100» que flotan. Los del dúo viven en bossState; el Creador
 * invoca los suyos en su fase 2.
 * @typedef {{ bumperHitAt: number[], pops: { x: number, y: number, at: number }[] }} DuoBumpers
 */

/** @returns {DuoBumpers} */
function duoBumpersMake() {
    return { bumperHitAt: [-9999, -9999, -9999], pops: [] };
}

/** Los bumpers del dúo: los toques del jugador los encienden (y el TILT). @param {Ball} b @returns {boolean} */
function duoCollideBumpers(b) {
    return duoBumpersCollide(/** @type {DuoBumpers} */ (bossState), b, duoNow(), (i) => {
        if (b.owner === 'p1' && !duoTilted()) {
            bossState.lit[i] = true;
            if (bossState.lit.every(Boolean)) {
                // JACKPOT: las dos palas se quedan bloqueadas 4 s
                bossState.tiltUntil = duoNow() + DUO.tiltMs;
                bossSfx('jackpot');
                bossTaunt('jackpot', true);
            }
        }
    });
}

/**
 * Rebote en un bumper: se refleja respecto a la normal desde su centro y
 * sale ×1,15 (sin pasar del tope del preset × 1,2).
 * @param {DuoBumpers} st
 * @param {Ball} b
 * @param {number} now
 * @param {(i: number) => void} [onHit]
 * @returns {boolean}
 */
function duoBumpersCollide(st, b, now, onHit) {
    for (let i = 0; i < DUO.bumpers.length; i++) {
        const bp = DUO.bumpers[i];
        const rad = DUO.bumperR + b.radius;
        const d = Math.hypot(b.x - bp.x, b.y - bp.y);
        if (d >= rad) continue;
        const nx = d > 0.001 ? (b.x - bp.x) / d : 1, ny = d > 0.001 ? (b.y - bp.y) / d : 0;
        const dot = b.dx * nx + b.dy * ny;
        if (dot >= 0) continue;   // ya se aleja
        b.dx -= 2 * dot * nx;
        b.dy -= 2 * dot * ny;
        b.speed = Math.max(b.speed, Math.min(b.speed * DUO.bumperK, currentSpeedPreset().max * DUO.capK));
        bossNormalizeBall(b);
        b.x = bp.x + nx * (rad + 0.5);
        b.y = bp.y + ny * (rad + 0.5);
        b.spin *= MECH.spinWallK;
        bossSfx('bumper');
        spawnParticles(b.x, b.y, DUO.lime, 8);
        st.bumperHitAt[i] = now;
        st.pops.push({ x: bp.x, y: bp.y - DUO.bumperR - 6, at: now });
        if (onHit) onHit(i);
        return true;
    }
    return false;
}

// ------------------------------------------------------------------
//  Dibujo
// ------------------------------------------------------------------

/** @param {CanvasRenderingContext2D} ctx */
function duoDrawBumpers(ctx) {
    const drop = bossState.bumpDrop || 0;
    if (!bossState.bumpOn && drop <= 0) return;
    const k = bossState.bumpOn ? 1 : drop;
    duoBumpersDraw(ctx, /** @type {DuoBumpers} */ (bossState), duoNow(), k, bossState.lit);
    if (bossState.bumpOn && !duoTilted()) {
        ctx.save();
        ctx.font = '9px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = DUO.lime;
        ctx.fillText(`${bossState.lit.filter(Boolean).length} / 3`, 620, 330);
        ctx.restore();
    }
}

/**
 * Dibuja unos bumpers y sus «+100». Con `ghost` (el Creador), todo de ese
 * color y sin luces.
 * @param {CanvasRenderingContext2D} ctx
 * @param {DuoBumpers} st
 * @param {number} now
 * @param {number} k 0…1, tamaño y opacidad (transición)
 * @param {boolean[]} lit cuáles están encendidos
 * @param {string|null} [ghost]
 */
function duoBumpersDraw(ctx, st, now, k, lit, ghost = null) {
    const glow = ghost || DUO.lime;
    const base = ctx.globalAlpha;
    ctx.save();
    DUO.bumpers.forEach((bp, i) => {
        const on = lit[i];
        const flash = Math.max(0, 1 - (now - st.bumperHitAt[i]) / 200);
        const r = DUO.bumperR * k * (1 + 0.12 * flash);
        ctx.globalAlpha = base * k;
        ctx.fillStyle = on ? 'rgba(101, 130, 30, 0.9)' : 'rgba(17, 19, 26, 0.9)';
        ctx.strokeStyle = on || flash > 0 || ghost ? glow : DUO.gray;
        ctx.lineWidth = 4;
        ctx.shadowColor = glow;
        ctx.shadowBlur = on ? 16 : flash * 16;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = on ? '#BEF264' : '#2A2F3A';
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
    });
    // Los «+100» que flotan
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (const p of st.pops) {
        const t = (now - p.at) / 700;
        if (t >= 1) continue;
        ctx.globalAlpha = base * (1 - t);
        ctx.fillStyle = ghost || DUO.gold;
        ctx.fillText('+100', p.x, p.y - t * 26);
    }
    ctx.restore();
}

/** El perrito de Valen corre por el borde de abajo. @param {CanvasRenderingContext2D} ctx */
function duoDrawPuppy(ctx) {
    if (!bossState.bumpOn) return;
    const x = bossState.puppyX;
    const now = duoNow();
    const run = Math.abs(bossState.puppyV) > 0.3;
    const step = run ? Math.sin(now / 60) : 0;
    const dir = bossState.puppyV < 0 ? -1 : 1;
    const y = GAME_HEIGHT - 14;
    ctx.save();
    ctx.translate(x, y - Math.abs(step) * 2);
    ctx.scale(dir, 1);
    ctx.fillStyle = '#D9A066';
    ctx.strokeStyle = '#7C4A1E';
    ctx.lineWidth = 1.5;
    // Patas
    ctx.fillRect(-8 + step * 2, 3, 3, 7);
    ctx.fillRect(5 - step * 2, 3, 3, 7);
    // Cuerpo y cola
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, -2);
    ctx.lineTo(-15, -7 + step * 2);
    ctx.stroke();
    // Cabeza y oreja
    ctx.beginPath();
    ctx.arc(11, -5, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7C4A1E';
    ctx.beginPath();
    ctx.ellipse(9, -9, 2.5, 4, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(13, -6, 1.5, 1.5);
    ctx.restore();
}

/** Aura de fuego alrededor de la pala de Mario (Modo Diablo). @param {CanvasRenderingContext2D} ctx */
function duoDrawMarioFire(ctx) {
    if (!bossState.diablo && (bossState.diabloIn || 0) <= 0) return;
    const k = bossState.diablo ? 1 : bossState.diabloIn;
    const t = vfxT();
    const cx = p2.x + p2.width / 2, cy = p2.y + p2.height / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, 70);
    g.addColorStop(0, `rgba(239, 68, 68, ${0.45 * k})`);
    g.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 70, cy - 90, 140, 180);
    // Lenguas de fuego que suben por los lados
    for (let i = 0; i < 8; i++) {
        const h = vfxHash(i * 13 + 7);
        const ph = (t * (1.4 + h) + h) % 1;
        const side = i % 2 ? 1 : -1;
        const x = cx + side * (10 + h * 8);
        const y = p2.y + p2.height - ph * (p2.height + 30);
        ctx.fillStyle = `rgba(${250}, ${120 + Math.floor(100 * (1 - ph))}, 40, ${0.6 * (1 - ph) * k})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 4 + 3 * (1 - ph), 9 * (1 - ph) + 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
    if (bossState.diablo) bossSign(ctx, 'MODO DIABLO', p2.x - 50, Math.max(20, p2.y - 16), DUO.mario, 7);
}

/** El móvil de Valen: brillo al sacarlo y «EN DIRECTO» mientras mira. @param {CanvasRenderingContext2D} ctx */
function duoDrawValenPhone(ctx) {
    const mood = duoValenMood();
    if (mood === 'play' || p2Twin.retreatMs > 0) return;
    const cx = p2Twin.x + p2Twin.width / 2;
    const top = p2Twin.y;
    ctx.save();
    // El brillo de la pantalla sobre la pala
    const g = ctx.createRadialGradient(cx, top + 20, 2, cx, top + 20, 40);
    g.addColorStop(0, 'rgba(147, 197, 253, 0.55)');
    g.addColorStop(1, 'rgba(147, 197, 253, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 40, top - 20, 80, 80);
    // El móvil
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = DUO.phone;
    ctx.lineWidth = 1.5;
    ctx.fillRect(cx - 14, top - 30, 12, 20);
    ctx.strokeRect(cx - 14, top - 30, 12, 20);
    ctx.fillStyle = DUO.phone;
    ctx.fillRect(cx - 12, top - 28, 8, 14);
    ctx.restore();
    if (mood === 'live') {
        const y = Math.max(20, top - 22);
        bossSign(ctx, 'EN DIRECTO', cx - 62, y, DUO.mario, 7);
        if (Math.floor(duoNow() / 400) % 2 === 0) {
            ctx.save();
            ctx.fillStyle = DUO.mario;
            ctx.shadowColor = DUO.mario;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(cx - 117, y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

/** TILT sobre su campo mientras las palas están bloqueadas. @param {CanvasRenderingContext2D} ctx */
function duoDrawTilt(ctx) {
    if (!duoTilted()) return;
    const left = bossState.tiltUntil - duoNow();
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(duoNow() / 80);
    ctx.font = '40px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = DUO.lime;
    ctx.shadowColor = DUO.lime;
    ctx.shadowBlur = 18;
    ctx.fillText('TILT', 600, 320);
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.shadowBlur = 0;
    ctx.fillText(`${Math.ceil(left / 1000)}`, 600, 358);
    ctx.restore();
}

/** «YOU WIN» de máquina de arcade al fondo de su campo (K.O.). @param {CanvasRenderingContext2D} ctx */
function duoDrawYouWin(ctx) {
    const ko = bossState.ko;
    if (!ko) return;
    const on = Math.floor(ko.ms / 180) % 2 === 0 || ko.ms > 900;
    if (!on) return;
    ctx.save();
    ctx.font = '34px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = DUO.gold;
    ctx.shadowColor = DUO.gold;
    ctx.shadowBlur = 20;
    ctx.fillText('YOU WIN', 600, 110);
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FDE68A';
    ctx.fillText('INSERT COIN', 600, 150);
    ctx.restore();
}

// ------------------------------------------------------------------
//  El jefe
// ------------------------------------------------------------------

/** Al empezar cada fase, nadie sigue retirado. */
function duoResetRetreats() {
    p2.retreatMs = 0;
    p2Twin.retreatMs = 0;
}

/** @type {BossMechanics} */
const bossDuo = {
    config: { targetScore: 9, aiSpeed: 0.78, aiError: 20, aiBias: 32 },
    color: DUO.mario,
    lives: 5,
    koLeadMs: DUO.koLeadMs,

    // IA de la tabla de la guía (D.7) con aiBias ajustado al bot de prueba
    // de ±30 px (66/58/50 → 32/24/16): unos 5,6 min por combate. Gana igual
    // casi siempre: el aiBias apenas mueve las victorias del bot.
    phases: [
        {
            name: 'Cooperativo',
            goals: 3,
            config: { aiSpeed: 0.78, aiError: 20, aiBias: 32, spin: 0.25, smash: 0 }
        },
        {
            name: 'Pinball',
            goals: 3,
            config: { aiSpeed: 0.84, aiError: 16, aiBias: 24, spin: 0.45, smash: 0.10 },
            transition(t) {
                bossState.bumpDrop = t;      // los bumpers crecen en su campo
            },
            enter() {
                duoResetRetreats();
                bossState.bumpOn = true;
                bossState.lit = [false, false, false];
                bossState.tiltUntil = 0;
            }
        },
        {
            name: 'Modo Diablo',
            goals: 3,
            config: { aiSpeed: 0.90, aiError: 12, aiBias: 16, spin: 0.60, smash: 0.40 },
            transition(t) {
                bossState.bumpOn = false;
                bossState.tiltUntil = 0;
                bossState.bumpDrop = 1 - t;  // los bumpers se van
                bossState.diabloIn = t;      // y Mario empieza a arder
            },
            enter() {
                duoResetRetreats();
                bossState.diablo = true;
                bossState.afkT0 = duoNow();
                bossState.afkCycle = -1;
            }
        }
    ],

    init() {
        p2Twin.active = true;
        p2Twin.x = p2.x;
        p2Twin.y = DUO.mid + 100 - p2Twin.height / 2;
        p2.y = DUO.mid - 100 - p2.height / 2;
        duoResetRetreats();
        for (const slot of [duoPlanMario, duoPlanValen]) {
            slot.plan = null;
            slot.wasComing = false;
        }
        Object.assign(bossState, {
            time: 0,
            bumpOn: false, bumpDrop: 0, lit: [false, false, false], ...duoBumpersMake(),
            tiltUntil: 0, puppyX: 400, puppyV: 0,
            diablo: false, diabloIn: 0, afkT0: 0, afkCycle: -1, koY0: null, koSpark: 0
        });
        const arena = CAMPAIGN_ART.pisos.arena_duo;
        artLoad(arena.src);
        artLoad(arena.theme);
    },

    update(dt) {
        const ms = dt * MS_PER_FRAME;
        bossState.time = duoNow() + ms;
        for (const p of [p2, p2Twin]) if (p.retreatMs > 0) p.retreatMs = Math.max(0, p.retreatMs - ms);
        bossState.pops = bossState.pops.filter((p) => duoNow() - p.at < 700);
        // Tras el TILT, los bumpers se apagan
        if (bossState.bumpOn && bossState.tiltUntil && !duoTilted() && bossState.lit.every(Boolean)) {
            bossState.lit = [false, false, false];
        }
        // El perrito sigue la x de la bola (solo dibujo)
        const b = state.balls[0];
        if (b) {
            const v = Math.max(-4, Math.min(4, (b.x - bossState.puppyX) * 0.05)) * dt;
            bossState.puppyV = v;
            bossState.puppyX += v;
        }
        // Modo Diablo: la pulla del directo, una vez por distracción
        if (bossState.diablo && duoValenMood() === 'live') {
            const cycle = Math.floor((duoNow() - bossState.afkT0 - DUO.afkEvery) / DUO.afkEvery);
            if (cycle !== bossState.afkCycle) {
                bossState.afkCycle = cycle;
                bossTaunt('afk');
            }
        }
    },

    ai(target, aiSpeed, errorMargin, cfg, dt) {
        const tilt = duoTilted();
        const mood = duoValenMood();
        const valenAway = mood === 'live' || p2Twin.retreatMs > 0;
        const cover = bossState.diablo && valenAway && p2.retreatMs <= 0;

        // Mario (arriba; en el Modo Diablo, todo el campo si Valen no está)
        if (p2.retreatMs > 0) {
            p2.y -= paddleSpeed * 1.5 * dt;
            updateSmash(p2, false, dt);
        } else if (tilt) {
            updateSmash(p2, false, dt);
        } else {
            const speed = aiSpeed + (bossState.diablo ? DUO.marioBoost * paddleSpeed : 0);
            bossPlayPaddle(p2, duoIncoming(cover ? 'all' : 'top'), speed, errorMargin, cfg, dt, duoPlanMario,
                { home: cover ? DUO.mid : DUO.mid / 2 });
            const maxY = (cover ? GAME_HEIGHT : DUO.mid + p2.height / 2) - p2.height;
            p2.y = Math.min(p2.y, maxY);
        }

        // Valen (abajo): en directo baja despacio y no persigue la bola
        if (p2Twin.retreatMs > 0) {
            p2Twin.y += paddleSpeed * 1.5 * dt;
        } else if (tilt) {
            // bloqueado
        } else if (mood === 'live') {
            p2Twin.y = Math.min(GAME_HEIGHT - p2Twin.height, p2Twin.y + paddleSpeed * DUO.driftK * dt);
        } else {
            bossPlayPaddle(p2Twin, duoIncoming('bottom'), aiSpeed, errorMargin, cfg, dt, duoPlanValen,
                { home: DUO.mid * 1.5 });
            p2Twin.y = Math.max(p2Twin.y, DUO.mid - p2Twin.height / 2);
        }
    },

    onHit(b, side, type, paddle) {
        if (side === 'p1') {
            b.hitter = null;
            // El jugador devuelve como mucho al tope normal (las devoluciones
            // de Mario no se acumulan)
            const max = currentSpeedPreset().max * (state.fever ? MECH.feverMaxSpeedK : 1);
            if (b.power !== 'super' && b.speed > max) duoSetSpeed(b, max);
            return;
        }
        const cap = currentSpeedPreset().max * DUO.capK;
        if (paddle === p2Twin) {
            // Valen: lenta y con mucho efecto
            b.hitter = 'valen';
            duoSetSpeed(b, Math.max(currentSpeedPreset().base, b.speed * DUO.valenK));
            b.spin = (Math.random() < 0.5 ? -1 : 1) * DUO.valenSpin;
        } else {
            // Mario: rápida y sin efecto (su smash ya va a tope)
            b.hitter = 'mario';
            if (type !== 'super') {
                b.spin = 0;
                duoSetSpeed(b, Math.min(b.speed * (bossState.diablo ? DUO.marioK3 : DUO.marioK), Math.max(cap, b.speed)));
            }
        }
    },

    onGoal(scorerIsP1, b) {
        if (!scorerIsP1 || !b) return;
        // Se retira la pala de la mitad por la que entró el gol
        const p = b.y < DUO.mid ? p2 : p2Twin;
        p.retreatMs = DUO.retreatMs;
        if (soundEffects.bossRetreat) soundEffects.bossRetreat();
    },

    collide(b) {
        return bossState.bumpOn ? duoCollideBumpers(b) : false;
    },

    trailStyle(b) {
        if (b.hitter === 'mario') return b.power === 'super' && bossState.diablo ? { id: 'fire' } : { tint: DUO.mario };
        if (b.hitter === 'valen') return { tint: DUO.valen };
        return null;
    },

    paddleColor(p) {
        if (duoTilted()) return DUO.gray;
        return p === p2Twin ? DUO.valen : DUO.mario;
    },

    koTick(ms) {
        // Mario cae; Valen aplaude con chispas marrones
        if (bossState.koY0 === null) bossState.koY0 = p2.y;
        const t = ms / 1000;
        p2.y = Math.min(GAME_HEIGHT + 20, bossState.koY0 + 900 * t * t);
        if (ms - bossState.koSpark >= 150) {
            bossState.koSpark = ms;
            spawnParticles(p2Twin.x - 6, p2Twin.y + 10, DUO.valen, 6);
        }
    },

    renderArena(ctx) {
        drawTintedArt(ctx, CAMPAIGN_ART.pisos.arena_duo, currentThemeHex(), 0, 0, GAME_WIDTH, GAME_HEIGHT);
    },

    render(ctx) {
        duoDrawYouWin(ctx);
        duoDrawBumpers(ctx);
        duoDrawPuppy(ctx);
        duoDrawMarioFire(ctx);
    },

    renderOverlay(ctx) {
        duoDrawValenPhone(ctx);
        duoDrawTilt(ctx);
        if (!bossState.ko) {
            if (p2.retreatMs > 0) bossSign(ctx, '¡MARIO SE RETIRA!', 600, 120, DUO.mario, 9);
            if (p2Twin.retreatMs > 0) bossSign(ctx, '¡VALEN SE RETIRA!', 600, 480, DUO.valen, 9);
        }
    }
};
