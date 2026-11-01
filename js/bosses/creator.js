/**
 * bosses/creator.js
 * ------------------------------------------------------------------
 * 6 · EL CREADOR (el sótano) — es Chemi
 *
 * Combate por fases (bosses/phases.js) como los demás, con 5 vidas, en su
 * arena. Su pala es blanca con un rayo celeste.
 *   1 · Código           cada 4 s sin regla escribe en su campo una línea
 *                        de código que se cumple 8 s; una bola tuya que
 *                        atraviesa su caja la tacha y cancela la regla
 *   2 · Los cinco        cada 12 s invoca 10 s, en fantasma, la mecánica de
 *                        un Hachepe: torniquetes de Chemi → celdas de Dani
 *                        → bumpers del dúo → apagón de Fano → halo de Yisus
 *   3 · Cuarta pared     cada 9 s un ataque avisado: gira la pantalla (la
 *                        arena girada, 8 s), un GAME OVER falso o el
 *                        marcador que miente; tus goles agrietan la pantalla
 *   4 · La paleta de     su pala mide 300 y vuelven las líneas; cada golpe
 *       Pedro            perfecto tuyo enciende una voz (niño, madre,
 *                        Pedro) y con las tres tu pala es dorada: su
 *                        siguiente golpe atraviesa la pala del Creador
 * Su K.O.: se deshace en líneas de código y la pantalla se funde a blanco.
 *
 * Las invocaciones reutilizan el código de cada jefe con estado propio
 * (chemiTurnstiles*, daniCells*, duoBumpers*, fanoDark*, yisusHalo*).
 *
 * El azar de la física es Math.random (qué regla, dónde, qué ataque: todo
 * cambia la partida); lo visual (el eco, el marcador barajado, el código
 * que cae), vfxRandom y vfxHash.
 *
 * Lo registra bosses/index.js en BOSS_MECHANICS, que se carga después.
 * ------------------------------------------------------------------
 */

'use strict';

/** Medidas y tiempos del combate del Creador (unidades del campo, ms). */
const CREATOR = {
    color: '#E0F2FE',
    white: '#E0F2FE',
    cyan: '#7DD3FC',
    green: '#4ADE80',
    gold: '#FACC15',
    // Fase 1 (y 4) · las líneas de código
    ruleEvery: 4000,
    ruleTypeMs: 1000,
    ruleMs: 8000,
    ruleStrikeMs: 800,
    ruleFadeMs: 300,
    ruleArea: { x0: 470, x1: 760, y0: 60, y1: 540 },
    ruleFont: 16,
    ruleCharW: 9.6,           // letra monoespaciada de 16: el ancho de la caja no depende del navegador
    rulePad: 12,
    fastK: 1.4,
    fastCapK: 1.3,
    smallPaddle: 60,
    bigPaddle: 160,
    gravity: 0.15,
    blinkMs: 300,
    // Fase 2 · los cinco
    summonFirst: 1500,
    summonEvery: 12000,
    summonMs: 10000,
    echoMs: 2500,
    cellRefillMs: 5000,
    // Fase 3 · cuarta pared
    attackFirst: 4000,
    attackGap: 9000,
    warnMs: 1500,
    rotAnimMs: 600,
    rotMs: 8000,
    gameOverMs: 2000,
    scrambleMs: 4000,
    // Fase 4 · la paleta de Pedro
    finalPaddle: 300,
    sayMs: 3000,
    koLeadMs: 2000
};

/** Las reglas de la fase 1 (y 4), una a la vez. */
const CREATOR_RULES = [
    { id: 'fast', text: 'bola.velocidad *= 1.4;' },
    { id: 'small', text: 'jugador.pala.alto = 60;' },
    { id: 'invert', text: 'controles.invertidos = true;' },
    { id: 'blink', text: 'bola.visible = parpadeo;' },
    { id: 'gravity', text: 'gravedad = 0.15;' },
    { id: 'big', text: 'creador.pala.alto = 160;' }
];

/** Los cinco, por orden: su eco (busto, color y frase). */
const CREATOR_SUMMONS = [
    { kind: 'chemi', bust: 'chemi', color: '#E5E7EB', line: '¿Tiene cita?' },
    { kind: 'dani', bust: 'dani', color: '#D4A72C', line: '¡Facturamos!' },
    { kind: 'duo', bust: 'valen', color: '#C98A4B', line: 'DINDINDIN.' },
    { kind: 'fano', bust: 'fano', color: '#8B5CF6', line: 'Noooo bro.' },
    { kind: 'yisus', bust: 'yisus', color: '#FACC15', line: 'Aura.' }
];

/** Las voces de Barks City (fase 4), en el orden en que se encienden. */
const CREATOR_VOICES = [
    { id: 'nino', color: '#93C5FD' },
    { id: 'madre', color: '#F9A8D4' },
    { id: 'pedro', color: '#60A5FA' }
];

/** Icono de rotación del aviso de giro. */
const CREATOR_ROT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v5h-5"/></svg>';

/** Tiempo de combate (ms). */
function creatorNow() {
    return bossState.time || 0;
}

/** Tope de velocidad normal de la partida. */
function creatorMaxSpeed() {
    return currentSpeedPreset().max * (state.fever ? MECH.feverMaxSpeedK : 1);
}

/**
 * Cambia el largo de una pala sin mover su centro (en la arena girada, el
 * ancho).
 * @param {Paddle} p
 * @param {number} len
 */
function creatorSetLength(p, len) {
    if (bossState.rotated) {
        if (p.width === len) return;
        const cx = p.x + p.width / 2;
        p.width = len;
        p.x = Math.max(0, Math.min(GAME_WIDTH - len, cx - len / 2));
        return;
    }
    if (p.height === len) return;
    const cy = p.y + p.height / 2;
    p.height = len;
    p.y = Math.max(0, Math.min(GAME_HEIGHT - len, cy - len / 2));
}

/**
 * Una pieza DOM del combate sobre el campo (.boss-fx: se quita al empezar
 * y al terminar cualquier partida).
 * @param {string} cls
 */
function creatorFxEl(cls) {
    const el = document.createElement('div');
    el.className = cls + ' boss-fx';
    el.setAttribute('aria-hidden', 'true');
    document.getElementById('canvas-wrapper').appendChild(el);
    return el;
}

// ------------------------------------------------------------------
//  Fase 1 (y 4) · las líneas de código
// ------------------------------------------------------------------

/** La regla en vigor (escrita y sin tachar), o null. */
function creatorActiveRule() {
    const r = bossState.rule;
    if (!r || r.deletedAt !== null) return null;
    const now = creatorNow();
    return now >= r.activeAt && now < r.endAt ? r.id : null;
}

/** ¿Está en vigor esa regla? @param {string} id */
function creatorRuleOn(id) {
    return creatorActiveRule() === id;
}

/** Escribe una línea nueva (qué regla y dónde, con Math.random: cambia la partida). */
function creatorSpawnRule() {
    const now = creatorNow();
    // En la fase 4 su pala ya mide 300: sin la regla de los 160
    const pool = CREATOR_RULES.filter((r) => r.id !== bossState.lastRule && !(bossState.finalPaddle && r.id === 'big'));
    const rule = pool[Math.floor(Math.random() * pool.length)];
    const w = rule.text.length * CREATOR.ruleCharW + CREATOR.rulePad * 2;
    const h = CREATOR.ruleFont + CREATOR.rulePad * 2;
    const a = CREATOR.ruleArea;
    const x = a.x0 + Math.random() * Math.max(0, a.x1 - a.x0 - w);
    const y = a.y0 + Math.random() * (a.y1 - a.y0 - h);
    bossState.rule = { id: rule.id, text: rule.text, x, y, w, h, born: now,
                       activeAt: now + CREATOR.ruleTypeMs, endAt: now + CREATOR.ruleTypeMs + CREATOR.ruleMs, deletedAt: null };
    bossState.lastRule = rule.id;
}

/** Una línea nace cada 4 s sin regla; la que acaba se borra sola. @param {number} now */
function creatorTickRules(now) {
    const r = bossState.rule;
    if (r) {
        const gone = r.deletedAt !== null ? now >= r.deletedAt + CREATOR.ruleStrikeMs : now >= r.endAt + CREATOR.ruleFadeMs;
        if (gone) {
            bossState.rule = null;
            bossState.ruleAt = now + CREATOR.ruleEvery;
        }
    } else if (now >= bossState.ruleAt) {
        creatorSpawnRule();
    }
}

/** Una bola tuya atraviesa la caja: la línea se tacha y la regla se cancela. @param {Ball} b */
function creatorCheckRuleHit(b) {
    const r = bossState.rule;
    if (!r || r.deletedAt !== null || b.owner !== 'p1') return;
    if (creatorNow() >= r.endAt) return;
    const qx = Math.max(r.x, Math.min(r.x + r.w, b.x));
    const qy = Math.max(r.y, Math.min(r.y + r.h, b.y));
    if (Math.hypot(b.x - qx, b.y - qy) > b.radius) return;
    r.deletedAt = creatorNow();
    bossSfx('codeDelete');
    spawnParticles(b.x, b.y, CREATOR.green, 12);
    bossTaunt('codeDeleted');
}

/**
 * Lo que hace la regla en vigor cada paso: la bola rápida, las palas, la
 * gravedad. Al acabar, todo vuelve.
 * @param {number} dt
 */
function creatorApplyRules(dt) {
    const rule = creatorActiveRule();
    for (const b of state.balls) {
        // Bola ×1,4 (con tope del preset × 1,3)
        if (rule === 'fast' && !b.ruleFast) {
            b.ruleFast = true;
            creatorSetBallSpeed(b, Math.min(b.speed * CREATOR.fastK, currentSpeedPreset().max * CREATOR.fastCapK));
        } else if (rule !== 'fast' && b.ruleFast) {
            b.ruleFast = false;
            if (b.power !== 'super' && b.speed > creatorMaxSpeed()) creatorSetBallSpeed(b, creatorMaxSpeed());
        }
        if (rule === 'gravity') {
            b.dy += CREATOR.gravity * dt;
            bossNormalizeBall(b, 0.42);
        }
    }
    // Las palas
    creatorSetLength(p1, rule === 'small' ? CREATOR.smallPaddle : creatorBaseLength('p1'));
    creatorSetLength(p2, bossState.finalPaddle ? CREATOR.finalPaddle : rule === 'big' ? CREATOR.bigPaddle : creatorBaseLength('p2'));
}

/**
 * El largo normal de una pala: el de siempre o el de un power-up de
 * tamaño (game/powerups.js) que la tenga como objetivo.
 * @param {'p1'|'p2'} side
 */
function creatorBaseLength(side) {
    for (const e of effectsOf('paddle_xl')) if (e.target === side) return paddleHeight * 1.6;
    for (const e of effectsOf('paddle_mini')) if (e.target === side) return paddleHeight * 0.6;
    return paddleHeight;
}

/**
 * Cambia la velocidad de una bola sin cambiar su dirección.
 * @param {Ball} b
 * @param {number} speed
 */
function creatorSetBallSpeed(b, speed) {
    const v = Math.hypot(b.dx, b.dy) || 1;
    b.speed = speed;
    b.dx = b.dx / v * speed;
    b.dy = b.dy / v * speed;
}

/** La línea de código: caja oscura, letra de consola y su diana. @param {CanvasRenderingContext2D} ctx */
function creatorDrawRule(ctx) {
    const r = bossState.rule;
    if (!r) return;
    const now = creatorNow();
    const deleted = r.deletedAt !== null;
    let alpha = 1;
    if (deleted) alpha = 1 - Math.max(0, (now - r.deletedAt) / CREATOR.ruleStrikeMs);
    else if (now >= r.endAt) alpha = 1 - (now - r.endAt) / CREATOR.ruleFadeMs;
    if (alpha <= 0) return;
    const typed = Math.min(r.text.length, Math.floor((now - r.born) / CREATOR.ruleTypeMs * r.text.length));
    const color = deleted ? CREATOR.green : CREATOR.white;
    // Tachada, la caja crece para «// borrado» (sin salirse del campo)
    const note = '// borrado';
    const noteW = note.length * CREATOR.ruleCharW * 0.75;
    const bw = deleted ? r.w + noteW + CREATOR.ruleCharW : r.w;
    const bx = Math.min(r.x, GAME_WIDTH - 6 - bw);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#05070F';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = CREATOR.cyan;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(bx, r.y, bw, r.h, 4);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = `bold ${CREATOR.ruleFont}px "Courier New", ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    const tx = bx + CREATOR.rulePad, ty = r.y + r.h / 2;
    const shown = deleted ? r.text : r.text.slice(0, typed);
    ctx.fillText(shown, tx, ty);
    const w = shown.length * CREATOR.ruleCharW;
    if (!deleted && typed < r.text.length) {
        // Cursor de bloque mientras se escribe
        ctx.fillRect(tx + w + 1, ty - CREATOR.ruleFont / 2, CREATOR.ruleCharW, CREATOR.ruleFont);
    }
    if (deleted) {
        ctx.fillRect(tx, ty, w, 2);
        ctx.font = `bold ${CREATOR.ruleFont * 0.75}px "Courier New", ui-monospace, monospace`;
        ctx.fillText(note, tx + w + CREATOR.ruleCharW, ty);
    }
    ctx.restore();
}

// ------------------------------------------------------------------
//  Fase 2 · los cinco
// ------------------------------------------------------------------

/** Invoca al siguiente de los cinco durante 10 s. @param {number} now */
function creatorStartSummon(now) {
    const s = CREATOR_SUMMONS[bossState.summonIdx % CREATOR_SUMMONS.length];
    bossState.summonIdx++;
    /** @type {any} */
    let st = null;
    if (s.kind === 'chemi') st = { list: chemiTurnstilesMake(), t0: now };
    else if (s.kind === 'dani') st = { cells: daniCellsMake() };
    else if (s.kind === 'duo') st = duoBumpersMake();
    else if (s.kind === 'fano') st = fanoDarkMake(now, Infinity, CREATOR.summonMs);
    else st = yisusHaloMake();
    bossState.summon = { kind: s.kind, start: now, end: now + CREATOR.summonMs, st };
    bossState.summonAt = now + CREATOR.summonEvery;
    // El eco: su busto y su frase, 2,5 s arriba a la izquierda
    if (bossState.echoEl) bossState.echoEl.remove();
    const echo = creatorFxEl('boss-echo');
    echo.style.setProperty('--c', s.color);
    const face = document.createElement('img');
    face.className = 'boss-echo__face';
    face.src = CAMPAIGN_ART.bustos[s.bust].src;
    face.alt = '';
    echo.append(face, document.createTextNode(s.line));
    bossState.echoEl = echo;
    bossState.echoUntil = now + CREATOR.echoMs;
    bossSfx('glitch');
}

/** @param {number} now @param {number} dt */
function creatorTickSummon(now, dt) {
    const sm = bossState.summon;
    if (sm && now >= sm.end) bossState.summon = null;
    if (!bossState.summon && now >= bossState.summonAt) creatorStartSummon(now);
    const cur = bossState.summon;
    if (!cur) return;
    if (cur.kind === 'chemi') chemiTurnstilesTick(cur.st.list, now - cur.st.t0, dt);
    else if (cur.kind === 'dani') daniCellsTick(cur.st.cells, now);
    else if (cur.kind === 'duo') cur.st.pops = cur.st.pops.filter((p) => now - p.at < 700);
    else if (cur.kind === 'fano') fanoDarkTick(cur.st, now);
    else yisusHaloTick(cur.st, now);
}

/** @param {Ball} b @returns {boolean} */
function creatorCollideSummon(b) {
    const cur = bossState.summon;
    if (!cur) return false;
    const now = creatorNow();
    if (cur.kind === 'chemi') return chemiTurnstilesCollide(cur.st.list, b);
    if (cur.kind === 'dani') return daniCellsCollide(cur.st.cells, b, (x, y, cell) => { cell.refillAt = now + CREATOR.cellRefillMs; });
    if (cur.kind === 'duo') return duoBumpersCollide(cur.st, b, now);
    if (cur.kind === 'yisus') return yisusHaloCollide(cur.st, p2, b, now, (broke) => bossSfx(broke ? 'auraBreak' : 'auraCrack'));
    return false;
}

/** La mecánica invocada, en blanco y celeste al 55–70 % con un parpadeo leve. @param {CanvasRenderingContext2D} ctx */
function creatorDrawSummon(ctx) {
    const cur = bossState.summon;
    if (!cur) return;
    const now = creatorNow();
    if (cur.kind === 'fano') {
        fanoDrawDark(ctx, cur.st, now, CREATOR.white);
        return;
    }
    const flick = vfxHash(Math.floor(now / 90)) < 0.12 ? 0.12 : 0;
    const alpha = 0.55 + 0.15 * (0.5 + 0.5 * Math.sin(now / 160)) - flick;
    drawDimmed(alpha, (lc) => {
        if (cur.kind === 'chemi') chemiTurnstilesDraw(lc, cur.st.list, now - cur.st.t0, 0, CREATOR.white);
        else if (cur.kind === 'dani') daniCellsDraw(lc, cur.st.cells, now, 0, CREATOR.white);
        else if (cur.kind === 'duo') duoBumpersDraw(lc, cur.st, now, 1, [false, false, false], CREATOR.white);
        else yisusHaloRender(lc, cur.st, p2, now, CREATOR.white);
    });
}

// ------------------------------------------------------------------
//  Fase 3 · cuarta pared
// ------------------------------------------------------------------

/**
 * Gira la arena (o la devuelve): la bola conserva su posición relativa y
 * su velocidad gira con la pantalla. Con la arena girada tu pala va
 * horizontal abajo y la suya arriba.
 * @param {boolean} on
 */
function creatorRotate(on) {
    if (bossState.rotated === on) return;
    bossState.rotated = on;
    for (const b of state.balls) {
        const { x, y, dx, dy } = b;
        if (on) {
            b.x = y / GAME_HEIGHT * GAME_WIDTH;
            b.y = (1 - x / GAME_WIDTH) * GAME_HEIGHT;
            b.dx = dy;
            b.dy = -dx;
        } else {
            b.x = (1 - y / GAME_HEIGHT) * GAME_WIDTH;
            b.y = x / GAME_WIDTH * GAME_HEIGHT;
            b.dx = -dy;
            b.dy = dx;
        }
        b.trail = [];
    }
    for (const p of [p1, p2]) {
        if (on) {
            const len = p.height;
            const cx = (p.y + p.height / 2) / GAME_HEIGHT * GAME_WIDTH;
            p.width = len;
            p.height = paddleWidth;
            p.x = Math.max(0, Math.min(GAME_WIDTH - len, cx - len / 2));
            p.y = p === p1 ? GAME_HEIGHT - 30 : 15;
        } else {
            const len = p.width;
            const cy = (p.x + p.width / 2) / GAME_WIDTH * GAME_HEIGHT;
            p.height = len;
            p.width = paddleWidth;
            p.x = p === p1 ? 24 : bossState.p2X;
            p.y = Math.max(0, Math.min(GAME_HEIGHT - len, cy - len / 2));
        }
        p.vx = 0;
        p.vy = 0;
        p.touchX = null;
        p.touchY = null;
    }
    // Los power-ups no saben de la arena girada: fuera los de los dos
    clearPowerupsForPhase();
}

/**
 * Empieza la animación de giro (0,6 s con la partida quieta). Con
 * movimiento reducido no hay animación: devuelve false y gira de golpe.
 * @param {boolean} on
 * @returns {boolean}
 */
function creatorStartRotAnim(on) {
    if (prefersReducedMotion()) {
        creatorRotate(on);
        return false;
    }
    const wrapper = document.getElementById('canvas-wrapper');
    state.hitStopMs = Math.max(state.hitStopMs, CREATOR.rotAnimMs);
    wrapper.classList.remove('fw-rot-in', 'fw-rot-out');
    void wrapper.offsetWidth;
    wrapper.classList.add(on ? 'fw-rot-in' : 'fw-rot-out');
    bossSfx('glitch');
    return true;
}

/** El aviso de giro (1,5 s). */
function creatorShowWarn() {
    creatorHideWarn();
    const warn = creatorFxEl('fw-warn');
    warn.innerHTML = CREATOR_ROT_ICON;
    warn.appendChild(document.createTextNode('GIRANDO…'));
    bossState.warnEl = warn;
    bossSfx('bossWarning');
}

/** Quita el aviso de giro. */
function creatorHideWarn() {
    if (bossState.warnEl) bossState.warnEl.remove();
    bossState.warnEl = null;
}

/** Elige el siguiente ataque, sin repetir el anterior (Math.random: el giro cambia la partida). @param {number} now */
function creatorStartAttack(now) {
    const kinds = ['rotate', 'gameover', 'scramble'].filter((k) => k !== bossState.lastAttack);
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    bossState.lastAttack = kind;
    bossState.attack = { kind, stage: kind === 'rotate' ? 'warn' : kind === 'gameover' ? 'wait' : 'on', t0: now };
    if (kind === 'rotate') creatorShowWarn();
    if (kind === 'scramble') creatorScramble(true);
}

/** Termina el ataque en curso y programa el siguiente. @param {number} now */
function creatorEndAttack(now) {
    bossState.attack = null;
    bossState.attackAt = now + CREATOR.attackGap;
}

/** @param {number} now */
function creatorTickAttack(now) {
    const a = bossState.attack;
    if (!a) {
        if (now >= bossState.attackAt && state.serveCountdownMs <= 0) creatorStartAttack(now);
        return;
    }
    const e = now - a.t0;
    if (a.kind === 'rotate') {
        if (a.stage === 'warn' && e >= CREATOR.warnMs) {
            creatorHideWarn();
            a.stage = creatorStartRotAnim(true) ? 'animIn' : 'rotated';
            a.t0 = now;
        } else if (a.stage === 'animIn' && state.hitStopMs <= 0) {
            // La animación (con la partida quieta) acabó: la arena ya está girada
            document.getElementById('canvas-wrapper').classList.remove('fw-rot-in');
            creatorRotate(true);
            a.stage = 'rotated';
            a.t0 = now;
        } else if (a.stage === 'rotated' && e >= CREATOR.rotMs) {
            creatorShowWarn();
            a.stage = 'warnBack';
            a.t0 = now;
        } else if (a.stage === 'warnBack' && e >= CREATOR.warnMs) {
            creatorHideWarn();
            if (creatorStartRotAnim(false)) {
                a.stage = 'animOut';
                a.t0 = now;
            } else {
                creatorEndAttack(now);
            }
        } else if (a.stage === 'animOut' && state.hitStopMs <= 0) {
            document.getElementById('canvas-wrapper').classList.remove('fw-rot-out');
            creatorRotate(false);
            creatorEndAttack(now);
        }
    } else if (a.kind === 'gameover') {
        // A mitad de un rally
        if (a.stage === 'wait' && (currentRally >= 2 || e >= 4000)) {
            const go = creatorFxEl('fw-gameover');
            const big = document.createElement('p');
            big.className = 'fw-gameover__big';
            big.textContent = 'GAME OVER';
            const sub = document.createElement('p');
            sub.className = 'fw-gameover__sub';
            sub.textContent = 'NO TE DETENGAS';
            go.append(big, sub);
            bossState.gameOverEl = go;
            bossSfx('glitch');
            a.stage = 'on';
            a.t0 = now;
        } else if (a.stage === 'on' && e >= CREATOR.gameOverMs) {
            if (bossState.gameOverEl) bossState.gameOverEl.remove();
            bossState.gameOverEl = null;
            creatorEndAttack(now);
        }
    } else if (a.kind === 'scramble' && e >= CREATOR.scrambleMs) {
        creatorScramble(false);
        creatorEndAttack(now);
    }
}

/**
 * El marcador miente 4 s: «???» en los dos marcadores y tus corazones
 * barajados (solo visual: las vidas reales no cambian).
 * @param {boolean} on
 */
function creatorScramble(on) {
    const container = document.getElementById('game-container');
    const s1 = document.getElementById('hud-score-p1');
    const s2 = document.getElementById('hud-score-p2');
    const pips = document.getElementById('hud-pips-p1');
    if (on) {
        container.classList.add('hud-scrambled');
        s1.textContent = '???';
        s2.textContent = '???';
        const hearts = [...pips.children];
        bossState.heartOrder = hearts;
        hearts.map((h) => ({ h, k: vfxRandom() })).sort((a, b) => a.k - b.k).forEach(({ h }) => pips.appendChild(h));
        bossSfx('glitch');
    } else {
        container.classList.remove('hud-scrambled');
        s1.textContent = String(state.p1Score);
        s2.textContent = String(state.p2Score);
        if (bossState.heartOrder) bossState.heartOrder.forEach((h) => pips.appendChild(h));
        bossState.heartOrder = null;
    }
}

/** Corta el ataque en curso (un gol, el cambio de fase): todo vuelve a su sitio. */
function creatorCancelAttack() {
    const a = bossState.attack;
    if (!a) return;
    creatorHideWarn();
    document.getElementById('canvas-wrapper').classList.remove('fw-rot-in', 'fw-rot-out');
    if (bossState.rotated) creatorRotate(false);
    if (bossState.gameOverEl) bossState.gameOverEl.remove();
    bossState.gameOverEl = null;
    if (a.kind === 'scramble') creatorScramble(false);
    creatorEndAttack(creatorNow());
}

/** Cada gol tuyo en la fase 3 agrieta un poco más la pantalla (solo visual). */
function creatorAddCrack() {
    bossState.cracks = Math.min(3, bossState.cracks + 1);
    let el = /** @type {HTMLElement|null} */ (document.querySelector('#canvas-wrapper .fw-cracks'));
    if (!el) el = creatorFxEl('fw-cracks');
    el.style.backgroundImage = `url("${CAMPAIGN_ART.juego['grietas_' + bossState.cracks].src}")`;
}

// ------------------------------------------------------------------
//  Fase 4 · la paleta de Pedro
// ------------------------------------------------------------------

/** Un golpe perfecto tuyo enciende la siguiente voz; con las tres, la paleta dorada. */
function creatorVoiceOn() {
    if (bossState.voices >= CREATOR_VOICES.length) return;
    const v = CREATOR_VOICES[bossState.voices++];
    const el = document.querySelector(`#boss-side-player [data-who="${v.id}"]`);
    if (el) {
        el.classList.remove('is-off');
        el.classList.add('is-on');
    }
    bossSfx('voiceOn');
    if (bossState.voices < CREATOR_VOICES.length) return;
    bossState.golden = true;
    bossSfx('goldenPaddle');
    // La voz del niño, en el HUD y sin parar la partida
    const line = HACHEPES_LORE[CAMPAIGN_CREATOR].dialogues.golden;
    const say = creatorFxEl('hud-say');
    const img = document.createElement('img');
    img.src = CAMPAIGN_ART.bustos.nino.src;
    img.alt = '';
    say.append(img, document.createTextNode(line.t));
    bossState.sayEl = say;
    bossState.sayUntil = creatorNow() + CREATOR.sayMs;
}

/**
 * La paleta de Pedro: madera arriba y abajo, goma azul en medio, brillo
 * dorado y un filo blanco.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Paddle} p
 */
function creatorDrawGoldenPaddle(ctx, p) {
    const rotated = !!bossState.rotated;
    const len = rotated ? p.width : p.height;
    const cap = len * 0.2;
    ctx.save();
    ctx.shadowColor = CREATOR.gold;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(p.x - 4, p.y - 4, p.width + 8, p.height + 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#C68A52';
    ctx.fillRect(p.x, p.y, p.width, p.height);
    ctx.fillStyle = '#3B82F6';
    if (rotated) ctx.fillRect(p.x + cap, p.y, p.width - cap * 2, p.height);
    else ctx.fillRect(p.x, p.y + cap, p.width, p.height - cap * 2);
    ctx.restore();
}

/**
 * La pala del Creador: blanca, con un rayo celeste que la recorre.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Paddle} p
 */
function creatorDrawPaddle(ctx, p) {
    const now = creatorNow();
    ctx.save();
    ctx.shadowColor = CREATOR.cyan;
    ctx.shadowBlur = 16;
    ctx.fillStyle = CREATOR.white;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 4);
    ctx.fill();
    ctx.shadowBlur = 8;
    ctx.strokeStyle = CREATOR.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const vertical = p.height >= p.width;
    const len = vertical ? p.height : p.width;
    const thick = vertical ? p.width : p.height;
    const steps = Math.max(4, Math.floor(len / 14));
    for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        const j = (vfxHash(i * 7 + Math.floor(now / 80)) - 0.5) * thick * 0.8;
        const x = vertical ? p.x + thick / 2 + j : p.x + k * len;
        const y = vertical ? p.y + k * len : p.y + thick / 2 + j;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
}

/** El K.O.: la pala se deshace en código que cae y la pantalla se funde a blanco. @param {CanvasRenderingContext2D} ctx */
function creatorDrawKo(ctx) {
    const ko = bossState.ko;
    if (!ko) return;
    const t = ko.ms;
    const chars = '01{};=<>/pala.alto';
    ctx.save();
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < 40; i++) {
        const x = bossState.koX + (vfxHash(i * 13) - 0.5) * 60;
        const y0 = bossState.koY + vfxHash(i * 29 + 3) * bossState.koH;
        const y = y0 + (t / 1000) * (120 + vfxHash(i * 5) * 260);
        ctx.globalAlpha = Math.max(0, 1 - t / CREATOR.koLeadMs);
        ctx.fillStyle = i % 3 ? CREATOR.green : CREATOR.white;
        ctx.fillText(chars[Math.floor(vfxHash(i * 3 + Math.floor(t / 120)) * chars.length)], x, y);
    }
    // Se funde a blanco (y así se queda: enlaza con el final verdadero)
    ctx.globalAlpha = Math.min(1, t / CREATOR.koLeadMs);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.restore();
}

// ------------------------------------------------------------------
//  El jefe
// ------------------------------------------------------------------

/** @type {BossMechanics} */
const bossCreator = {
    config: { targetScore: 10, aiSpeed: 0.84, aiError: 16, aiBias: 40 },
    color: CREATOR.color,
    lives: 5,
    koLeadMs: CREATOR.koLeadMs,
    music: 'creador_batalla',

    // IA de la tabla de la guía (F.6), un escalón más que Yisus, con aiBias
    // bajado en la misma proporción que el suyo (58/54/50/44 → 40/36/32/28).
    // El bot de prueba gana ~21 de 24 en ~5 min con cualquier aiBias (también
    // con 0): sus golpes de esquina dejan bolas rápidas y casi verticales que
    // la IA no alcanza. Su dificultad hay que juzgarla a mano.
    phases: [
        {
            name: 'Código',
            goals: 3,
            config: { aiSpeed: 0.84, aiError: 16, aiBias: 40, spin: 0.40, smash: 0.10 },
            enter() {
                bossState.rulesOn = true;
                bossState.ruleAt = creatorNow() + CREATOR.ruleEvery;
            }
        },
        {
            name: 'Los cinco',
            goals: 3,
            config: { aiSpeed: 0.88, aiError: 14, aiBias: 36, spin: 0.50, smash: 0.20 },
            transition() {
                bossState.rule = null;
                creatorApplyRules(0);   // sin regla: todo vuelve
                bossState.rulesOn = false;
            },
            enter() {
                bossState.summonOn = true;
                bossState.summonAt = creatorNow() + CREATOR.summonFirst;
            }
        },
        {
            name: 'Cuarta pared',
            goals: 3,
            config: { aiSpeed: 0.92, aiError: 12, aiBias: 32, spin: 0.60, smash: 0.35 },
            transition() {
                bossState.summonOn = false;
                bossState.summon = null;
                if (bossState.echoEl) bossState.echoEl.remove();
                bossState.echoEl = null;
            },
            enter() {
                bossState.attackOn = true;
                bossState.attackAt = creatorNow() + CREATOR.attackFirst;
            }
        },
        {
            name: 'La paleta de Pedro',
            goals: 1,
            config: { aiSpeed: 0.96, aiError: 10, aiBias: 28, spin: 0.70, smash: 0.50 },
            transition() {
                creatorCancelAttack();
                bossState.attackOn = false;
            },
            enter() {
                bossState.finalPaddle = true;
                creatorSetLength(p2, CREATOR.finalPaddle);
                bossState.rulesOn = true;
                bossState.rule = null;
                bossState.ruleAt = creatorNow() + CREATOR.ruleEvery;
                // Las voces de Barks City, apagadas, en tu lado del campo
                const side = bossSideMake('boss-side-player', 'boss-side--player boss-fx',
                    CREATOR_VOICES.map((v) => ({ ...v, cls: 'is-off' })));
                document.getElementById('canvas-wrapper').appendChild(side);
            }
        }
    ],

    init() {
        Object.assign(bossState, {
            time: 0, p2X: p2.x,
            rulesOn: false, rule: null, ruleAt: 0, lastRule: null,
            summonOn: false, summon: null, summonAt: 0, summonIdx: 0, echoEl: null, echoUntil: 0,
            attackOn: false, attack: null, attackAt: 0, lastAttack: null, rotated: false,
            warnEl: null, gameOverEl: null, heartOrder: null, cracks: 0,
            finalPaddle: false, voices: 0, golden: false, sayEl: null, sayUntil: 0,
            koX: 0, koY: 0, koH: 0
        });
        document.getElementById('canvas-wrapper').classList.remove('fw-rot-in', 'fw-rot-out');
        // En la pausa de este combate, una frase suya encima de los botones
        const panel = document.querySelector('#pause-menu .pause-panel');
        const taunt = document.createElement('p');
        taunt.className = 'pause-taunt boss-fx';
        taunt.textContent = 'No hay pausa para ti.';
        panel.prepend(taunt);
        const arena = CAMPAIGN_ART.final.arena_creador;
        const j = CAMPAIGN_ART.juego;
        for (const src of [arena.src, arena.theme, j.grietas_1.src, j.grietas_2.src, j.grietas_3.src]) artLoad(src);
    },

    update(dt) {
        const ms = dt * MS_PER_FRAME;
        bossState.time = creatorNow() + ms;
        const now = creatorNow();
        const live = state.serveCountdownMs <= 0;
        if (bossState.rulesOn && live) creatorTickRules(now);
        if (bossState.rulesOn) creatorApplyRules(dt);
        if (bossState.summonOn && live) creatorTickSummon(now, dt);
        if (bossState.echoEl && now >= bossState.echoUntil) {
            bossState.echoEl.remove();
            bossState.echoEl = null;
        }
        if (bossState.attackOn) creatorTickAttack(now);
        if (bossState.sayEl && now >= bossState.sayUntil) {
            bossState.sayEl.remove();
            bossState.sayEl = null;
        }
    },

    rotated() {
        return !!bossState.rotated;
    },

    invertsControls() {
        return creatorRuleOn('invert');
    },

    collide(b) {
        if (bossState.rulesOn) creatorCheckRuleHit(b);
        if (bossState.summonOn) return creatorCollideSummon(b);
        return false;
    },

    ai(target, aiSpeed, errorMargin, cfg, dt) {
        if (!bossState.rotated) {
            bossPlay(target, aiSpeed, errorMargin, cfg, dt);
            return;
        }
        // Arena girada: persigue en x la bola que sube hacia su pala
        let t = null;
        for (const b of state.balls) if (b.dy < 0 && (!t || b.y < t.y)) t = b;
        const goal = (t ? t.x + bossAim() : GAME_WIDTH / 2) - p2.width / 2;
        const diff = goal - p2.x;
        if (Math.abs(diff) > errorMargin) p2.x += Math.sign(diff) * Math.min(Math.abs(diff), aiSpeed * dt);
    },

    onHit(b, side, type) {
        if (side !== 'p1') return;
        if (bossState.golden && !b.golden) {
            // La paleta dorada: un smash dorado que atraviesa su pala
            b.golden = true;
            b.power = 'super';
            creatorSetBallSpeed(b, Math.min(b.speed * MECH.superSpeedK, creatorMaxSpeed() * MECH.superCapK));
            bossSfx('superHit', { x: b.x, speedRatio: 1 });
        } else if (bossState.finalPaddle && type === 'perfect') {
            creatorVoiceOn();
        }
    },

    onGoal(scorerIsP1) {
        if (!bossState.attackOn) return;
        // Un gol devuelve la arena a su sitio y corta el ataque; los tuyos agrietan la pantalla
        creatorCancelAttack();
        if (scorerIsP1) creatorAddCrack();
    },

    passesPaddle(b, p) {
        return !!b.golden && p === p2;
    },

    ballAlpha(b) {
        let a = 1;
        if (creatorRuleOn('blink') && Math.floor(creatorNow() / CREATOR.blinkMs) % 2 === 1) a = 0;
        const sm = bossState.summon;
        if (sm && sm.kind === 'fano' && fanoDarkHas(sm.st, creatorNow(), b)) a = Math.min(a, FANO.ballDim);
        // La bola parpadea; la estela, siempre
        return a < 1 ? { ball: a, trail: a === 0 ? 1 : FANO.trailDim } : null;
    },

    trailStyle(b) {
        return b.golden ? { tint: CREATOR.gold } : null;
    },

    paddleColor() {
        return CREATOR.white;
    },

    paddleHidden(p) {
        return p === p2 && !!bossState.ko;
    },

    drawPaddle(ctx, p) {
        if (p === p1 && bossState.golden) {
            creatorDrawGoldenPaddle(ctx, p);
            return true;
        }
        if (p === p2) {
            creatorDrawPaddle(ctx, p);
            return true;
        }
        return false;
    },

    koTick() {
        if (!bossState.koH) {
            bossState.koX = p2.x + p2.width / 2;
            bossState.koY = p2.y;
            bossState.koH = p2.height;
            bossState.rule = null;
            bossSfx('codeDelete');
        }
    },

    renderArena(ctx) {
        drawTintedArt(ctx, CAMPAIGN_ART.final.arena_creador, currentThemeHex(), 0, 0, GAME_WIDTH, GAME_HEIGHT);
        // En la arena girada, la red va de lado a lado
        if (bossState.rotated) {
            ctx.save();
            ctx.fillStyle = hexToRgba(currentThemeHex(), 0.35);
            for (let x = 0; x < GAME_WIDTH; x += 30) ctx.fillRect(x, GAME_HEIGHT / 2 - 2, 14, 4);
            ctx.restore();
        }
    },

    render(ctx) {
        creatorDrawSummon(ctx);
        creatorDrawRule(ctx);
    },

    renderOverlay(ctx) {
        creatorDrawKo(ctx);
    }
};
