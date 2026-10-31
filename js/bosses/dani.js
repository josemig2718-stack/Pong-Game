/**
 * bosses/dani.js
 * ------------------------------------------------------------------
 * 2 · DANI — Grow Partner (piso 1, Contaduría)
 *
 * Combate por fases (bosses/phases.js) en la contaduría:
 *   1 · Hoja de cálculo   un muro de 6 celdas delante de Dani, de un solo
 *                         sentido: tus bolas lo rompen, las suyas lo
 *                         atraviesan; solo un gol de Dani rellena una
 *   2 · Intereses         cada golpe de Dani sube el interés (+4 %, hasta
 *                         40) y la bola sale más rápida; la moneda lo
 *                         paga, tu golpe perfecto lo divide entre dos y
 *                         cualquier gol lo pone a 0
 *   3 · La caja fuerte    su portería es la puerta de una caja fuerte:
 *                         tocar los botones 1-2-3 en orden la abre hasta
 *                         el siguiente gol
 * Su K.O.: la caja se abre del todo y llueven billetes y monedas.
 *
 * El azar de la física es Math.random (como el resto de jefes); los
 * números que saltan del muro y la lluvia del K.O., vfxRandom/vfxHash.
 *
 * Lo registra bosses/index.js en BOSS_MECHANICS, que se carga después.
 * ------------------------------------------------------------------
 */

'use strict';

/** Medidas y tiempos del combate de Dani (unidades del campo, ms). */
const DANI = {
    color: '#D4A72C',
    gold: '#FACC15',
    green: '#4ADE80',
    red: '#EF4444',
    // Fase 1 · el muro de celdas
    cellX: 700,
    cellW: 34,
    cellH: 94,
    cellStep: 100,
    cellTop: 3,
    cells: 6,
    refillMs: 1000,
    flatX: 0.7,               // el rebote vuelve al jugador: nunca más vertical que ~45°
    jitter: 0.15,             // perturbación de dy en los rebotes (× velocidad)
    // Fase 2 · intereses y moneda
    interestStep: 4,
    interestMax: 40,
    capK: 1.2,                // tope: el del preset × 1,2
    chartPoints: 14,
    coinEvery: 6000,
    coinLife: 5000,
    coinBlinkMs: 1000,
    coinR: 14,
    coinArea: { x0: 300, x1: 500, y0: 120, y1: 480 },
    coinEnergy: 10,
    signMs: 1200,
    // Fase 3 · la caja fuerte
    doorX: 793,               // línea de choque de la puerta
    doorDrawX: 780,
    doorMs: 600,
    btnR: 22,
    btnArea: { x0: 480, x1: 700, y0: 80, y1: 520 },
    btnGap: 120,
    btnFallback: [{ x: 520, y: 150 }, { x: 670, y: 300 }, { x: 540, y: 450 }],
    koLeadMs: 1200
};

/** ¿Estaba la bola ya dentro del botón i? (para contar solo al entrar) */
/** @type {WeakMap<Ball, number>} */
const daniBallInside = new WeakMap();

/** Tiempo de combate (ms). */
function daniNow() {
    return bossState.time || 0;
}

/** @param {number} k celda (0 arriba) @returns {[number, number]} su y de arriba y de abajo */
function daniCellY(k) {
    const y0 = k * DANI.cellStep + DANI.cellTop;
    return [y0, y0 + DANI.cellH];
}

// ------------------------------------------------------------------
//  Fase 1 · el muro
// ------------------------------------------------------------------

/**
 * Las celdas solo chocan con bolas que van hacia Dani: la rompen y la
 * bola rebota (de frente: hacia atrás; de lado: hacia arriba o abajo).
 * @param {Ball} b
 * @returns {boolean}
 */
function daniCollideCells(b) {
    if (b.dx <= 0) return false;
    const x0 = DANI.cellX, x1 = DANI.cellX + DANI.cellW;
    if (b.x + b.radius < x0 || b.x - b.radius > x1) return false;
    for (let k = 0; k < DANI.cells; k++) {
        const cell = bossState.cells[k];
        if (!cell.alive) continue;
        const [y0, y1] = daniCellY(k);
        const qx = Math.max(x0, Math.min(x1, b.x));
        const qy = Math.max(y0, Math.min(y1, b.y));
        if (Math.hypot(b.x - qx, b.y - qy) >= b.radius) continue;
        cell.alive = false;
        cell.refillAt = null;
        const front = b.x - b.dx + b.radius <= x0 + 2;
        if (front) {
            b.x = x0 - b.radius;
            b.dx = -Math.abs(b.dx);
        } else {
            const up = b.y < (y0 + y1) / 2;
            b.y = up ? y0 - b.radius : y1 + b.radius;
            b.dy = up ? -Math.abs(b.dy) : Math.abs(b.dy);
        }
        // La regla de los obstáculos: perturbar dy, o el rebote se repite
        // (poco y sin dejarla vertical: la bola vuelve directa al jugador)
        b.dy += (Math.random() * 2 - 1) * b.speed * DANI.jitter;
        bossNormalizeBall(b, front ? DANI.flatX : undefined);
        if (front) b.dx = -Math.abs(b.dx);
        b.spin *= MECH.spinWallK;
        bossSfx('cellBreak');
        spawnParticles(b.x, b.y, DANI.gold, 8);
        daniSpawnDigits(x0 + DANI.cellW / 2, (y0 + y1) / 2);
        return true;
    }
    return false;
}

/**
 * La lluvia de números de una celda rota (solo visual: vfxRandom).
 * @param {number} x
 * @param {number} y
 */
function daniSpawnDigits(x, y) {
    const chars = '0123456789$%';
    for (let i = 0; i < 12; i++) {
        bossState.digits.push({
            x: x + (vfxRandom() - 0.5) * 24, y: y + (vfxRandom() - 0.5) * 70,
            vx: (vfxRandom() - 0.7) * 3, vy: -vfxRandom() * 3,
            ch: chars[Math.floor(vfxRandom() * chars.length)], life: 1
        });
    }
}

/** Un gol de Dani: una celda rota al azar se rellena (parpadea 1 s). */
function daniRefillCell() {
    const broken = bossState.cells.map((c, k) => (!c.alive && c.refillAt === null ? k : -1)).filter((k) => k >= 0);
    if (!broken.length) return;
    const k = broken[Math.floor(Math.random() * broken.length)];
    bossState.cells[k].refillAt = daniNow() + DANI.refillMs;
    bossSfx('cellRefill');
}

// ------------------------------------------------------------------
//  Fase 2 · intereses
// ------------------------------------------------------------------

/** @param {number} v nuevo interés (%) */
function daniSetInterest(v) {
    bossState.interest = Math.max(0, Math.min(DANI.interestMax, v));
    bossState.interestHist.push(bossState.interest);
    if (bossState.interestHist.length > DANI.chartPoints) bossState.interestHist.shift();
    bossState.interestAt = daniNow();
}

/**
 * Cambia el módulo de la velocidad de la bola sin cambiar su dirección.
 * @param {Ball} b
 * @param {number} speed
 */
function daniSetSpeed(b, speed) {
    const k = speed / (b.speed || 1);
    b.dx *= k;
    b.dy *= k;
    b.speed = speed;
}

/** Cada 6 s, si no hay ninguna, aparece una moneda que dura 5 s. */
function daniTickCoin() {
    const now = daniNow();
    const coin = bossState.coin;
    if (coin && now - coin.t0 >= DANI.coinLife) bossState.coin = null;
    if (now >= bossState.coinTick) {
        bossState.coinTick = now + DANI.coinEvery;
        if (!bossState.coin) {
            const a = DANI.coinArea;
            bossState.coin = { x: a.x0 + Math.random() * (a.x1 - a.x0), y: a.y0 + Math.random() * (a.y1 - a.y0), t0: now };
        }
    }
}

/**
 * Una bola golpeada por el jugador que pasa junto a la moneda la cobra:
 * PAGADO, el interés a 0 y +10 de barra de smash.
 * @param {Ball} b
 */
function daniCheckCoin(b) {
    const coin = bossState.coin;
    if (!coin || b.owner !== 'p1') return;
    if (Math.hypot(b.x - coin.x, b.y - coin.y) >= DANI.coinR + b.radius) return;
    bossState.coin = null;
    bossState.paid = { x: coin.x, y: coin.y, at: daniNow() };
    daniSetInterest(0);
    addEnergy(p1, DANI.coinEnergy);
    bossSfx('coin');
    spawnParticles(coin.x, coin.y, DANI.gold, 14);
    bossTaunt('coin');
}

// ------------------------------------------------------------------
//  Fase 3 · la caja fuerte
// ------------------------------------------------------------------

/** Coloca los tres botones (separados al menos 120) y los apaga. */
function daniPlaceButtons() {
    const a = DANI.btnArea;
    /** @type {{ x: number, y: number }[]} */
    const pts = [];
    for (let tries = 0; tries < 60 && pts.length < 3; tries++) {
        const p = { x: a.x0 + Math.random() * (a.x1 - a.x0), y: a.y0 + Math.random() * (a.y1 - a.y0) };
        if (pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= DANI.btnGap)) pts.push(p);
    }
    const use = pts.length === 3 ? pts : DANI.btnFallback;
    bossState.buttons = use.map((p) => ({ x: p.x, y: p.y, lit: false, badAt: -9999 }));
    bossState.nextBtn = 0;
}

/**
 * Los botones son dianas: la bola del jugador los atraviesa y, al entrar
 * en uno, enciende el siguiente en orden (o parpadea en rojo si no toca).
 * @param {Ball} b
 */
function daniCheckButtons(b) {
    const prev = daniBallInside.has(b) ? daniBallInside.get(b) : -1;
    let inside = -1;
    bossState.buttons.forEach((btn, i) => {
        if (Math.hypot(b.x - btn.x, b.y - btn.y) < DANI.btnR + b.radius) inside = i;
    });
    daniBallInside.set(b, inside);
    if (inside < 0 || inside === prev || b.owner !== 'p1' || bossState.doorTarget === 1) return;
    const btn = bossState.buttons[inside];
    if (btn.lit) return;
    if (inside === bossState.nextBtn) {
        btn.lit = true;
        bossState.nextBtn++;
        bossSfx('click');
        spawnParticles(btn.x, btn.y, DANI.green, 8);
        if (bossState.nextBtn === 3) {
            bossState.doorTarget = 1;
            bossTaunt('vaultOpen');
        }
    } else {
        btn.badAt = daniNow();
        bossSfx('buzz');
    }
}

/**
 * La puerta de la caja: cerrada (o moviéndose), la bola que llega a la
 * pared de Dani rebota y no es gol.
 * @param {Ball} b
 * @returns {boolean}
 */
function daniCollideDoor(b) {
    if (bossState.door >= 1 || b.dx <= 0 || b.x + b.radius < DANI.doorX) return false;
    b.x = DANI.doorX - b.radius;
    b.dx = -Math.abs(b.dx);
    b.dy += (Math.random() * 2 - 1) * b.speed * DANI.jitter;
    bossNormalizeBall(b, DANI.flatX);
    b.dx = -Math.abs(b.dx);
    b.spin *= MECH.spinWallK;
    bossSfx('clang');
    spawnParticles(b.x, b.y, DANI.gold, 12);
    return true;
}

// ------------------------------------------------------------------
//  Dibujo
// ------------------------------------------------------------------

/** @param {CanvasRenderingContext2D} ctx */
function daniDrawCells(ctx) {
    const erase = bossState.wallErase || 0;
    if (!bossState.wallOn && erase >= 1) return;
    const now = daniNow();
    ctx.save();
    for (let k = 0; k < DANI.cells; k++) {
        const cell = bossState.cells[k];
        const [y0] = daniCellY(k);
        // En la transición se borran en cascada, de arriba abajo
        const a = Math.max(0, Math.min(1, 1 - (erase * (DANI.cells + 1) - k)));
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        const refilling = cell.refillAt !== null;
        if (cell.alive || (refilling && Math.floor(now / 110) % 2 === 0)) {
            ctx.fillStyle = 'rgba(38, 30, 8, 0.9)';
            ctx.fillRect(DANI.cellX, y0, DANI.cellW, DANI.cellH);
            ctx.strokeStyle = DANI.gold;
            ctx.lineWidth = 2;
            ctx.shadowColor = DANI.gold;
            ctx.shadowBlur = cell.alive ? 8 : 14;
            ctx.strokeRect(DANI.cellX + 1, y0 + 1, DANI.cellW - 2, DANI.cellH - 2);
            ctx.shadowBlur = 0;
            ctx.fillStyle = DANI.gold;
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', DANI.cellX + DANI.cellW / 2, y0 + DANI.cellH / 2);
        } else if (!refilling) {
            ctx.setLineDash([3, 5]);
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
            ctx.lineWidth = 1;
            ctx.strokeRect(DANI.cellX + 1, y0 + 1, DANI.cellW - 2, DANI.cellH - 2);
            ctx.setLineDash([]);
            if (erase === 0) {
                ctx.font = '7px "Press Start 2P", monospace';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = DANI.green;
                ctx.fillText('HUECO', DANI.cellX - 8, y0 + DANI.cellH / 2);
            }
        }
        if (refilling) bossSign(ctx, '=SUMA', DANI.cellX - 34, y0 + DANI.cellH / 2, DANI.gold, 7);
    }
    ctx.restore();
}

/** Los números que saltan de una celda rota. @param {CanvasRenderingContext2D} ctx */
function daniDrawDigits(ctx) {
    if (!bossState.digits.length) return;
    ctx.save();
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = DANI.gold;
    for (const d of bossState.digits) {
        ctx.globalAlpha = Math.max(0, d.life);
        ctx.fillText(d.ch, d.x, d.y);
    }
    ctx.restore();
}

/** La gráfica roja de la pared del fondo (sube con el interés). @param {CanvasRenderingContext2D} ctx */
function daniDrawChart(ctx) {
    const grow = bossState.chartGrow || 0;
    if (grow <= 0) return;
    const hist = bossState.interestHist;
    const x0 = 430, x1 = 790, yBase = 540, yTop = 150;
    const pts = hist.map((v, i) => ({
        x: x0 + (x1 - x0) * (hist.length > 1 ? i / (hist.length - 1) : 1),
        y: yBase - (yBase - yTop) * (0.08 + 0.92 * v / DANI.interestMax)
    }));
    if (pts.length === 1) pts.unshift({ x: x0, y: pts[0].y });
    ctx.save();
    ctx.globalAlpha = 0.85 * grow;
    // Ejes tenues
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, yTop); ctx.lineTo(x0, yBase); ctx.lineTo(x1, yBase);
    ctx.stroke();
    // La línea, que crece de izquierda a derecha en la transición
    ctx.beginPath();
    ctx.rect(0, 0, x0 + (x1 - x0) * grow, GAME_HEIGHT);
    ctx.clip();
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.shadowColor = DANI.red;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
}

/** La moneda (PAGAR) y el aviso PAGADO. @param {CanvasRenderingContext2D} ctx */
function daniDrawCoin(ctx) {
    const now = daniNow();
    const coin = bossState.coin;
    if (coin) {
        const left = DANI.coinLife - (now - coin.t0);
        const blink = left < DANI.coinBlinkMs && Math.floor(now / 100) % 2 === 0;
        if (!blink) {
            const bob = Math.sin(now / 250) * 2;
            ctx.save();
            ctx.fillStyle = DANI.gold;
            ctx.shadowColor = DANI.gold;
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(coin.x, coin.y + bob, DANI.coinR, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#A16207';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#5C3D02';
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', coin.x, coin.y + bob + 1);
            ctx.font = '7px "Press Start 2P", monospace';
            ctx.fillStyle = DANI.gold;
            ctx.fillText('PAGAR', coin.x, coin.y + bob + DANI.coinR + 12);
            ctx.restore();
        }
    }
    const paid = bossState.paid;
    if (paid && now - paid.at < 900) {
        ctx.save();
        ctx.globalAlpha = 1 - (now - paid.at) / 900;
        bossSign(ctx, 'PAGADO', paid.x, paid.y - 20 - (now - paid.at) * 0.03, DANI.green, 9);
        ctx.restore();
    }
}

/** «+N %» junto a la pala de Dani. @param {CanvasRenderingContext2D} ctx */
function daniDrawInterest(ctx) {
    if (!bossState.interestOn || bossState.interest <= 0) return;
    const since = daniNow() - bossState.interestAt;
    const pop = since < DANI.signMs ? 1 + 0.25 * (1 - since / DANI.signMs) : 1;
    ctx.save();
    ctx.translate(p2.x - 46, Math.max(24, p2.y - 18));
    ctx.scale(pop, pop);
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = DANI.red;
    ctx.shadowColor = DANI.red;
    ctx.shadowBlur = 8;
    ctx.fillText(`+${Math.round(bossState.interest)} %`, 0, 0);
    ctx.restore();
}

/** Los botones 1, 2 y 3. @param {CanvasRenderingContext2D} ctx */
function daniDrawButtons(ctx) {
    if (!bossState.vaultOn) return;
    const now = daniNow();
    ctx.save();
    ctx.font = '11px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    bossState.buttons.forEach((btn, i) => {
        const bad = now - btn.badAt < 500 && Math.floor(now / 90) % 2 === 0;
        const next = i === bossState.nextBtn && bossState.doorTarget !== 1;
        const color = bad ? DANI.red : btn.lit ? DANI.green : next ? '#E5E7EB' : '#9CA3AF';
        ctx.globalAlpha = btn.lit || next || bad ? 1 : 0.7;
        ctx.fillStyle = btn.lit ? 'rgba(74, 222, 128, 0.18)' : 'rgba(10, 12, 18, 0.75)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = btn.lit || next ? 12 : 0;
        ctx.beginPath();
        ctx.arc(btn.x, btn.y, DANI.btnR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = color;
        ctx.fillText(String(i + 1), btn.x, btn.y + 1);
    });
    ctx.restore();
}

/** La puerta de la caja fuerte, en la pared de Dani. @param {CanvasRenderingContext2D} ctx */
function daniDrawDoor(ctx) {
    const drop = bossState.vaultDrop || 0;
    if (!bossState.vaultOn && drop <= 0) return;
    const open = bossState.ko ? 1 : bossState.door;
    const X = DANI.doorDrawX, W = GAME_WIDTH - X;
    const reveal = bossState.vaultOn ? 1 : drop;
    ctx.save();
    ctx.globalAlpha = reveal;
    // Dentro de la caja: oro, que solo se ve con la puerta abierta
    if (open > 0) {
        ctx.fillStyle = '#120D02';
        ctx.fillRect(X, 0, W, GAME_HEIGHT);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.55)';
        for (let y = 40; y < GAME_HEIGHT; y += 46) ctx.fillRect(X + 4, y, W - 6, 10);
    }
    // Las dos hojas se apartan arriba y abajo
    const half = GAME_HEIGHT / 2;
    const off = open * half;
    const g = ctx.createLinearGradient(X, 0, GAME_WIDTH, 0);
    g.addColorStop(0, '#3A3F48');
    g.addColorStop(1, '#6B7280');
    ctx.fillStyle = g;
    ctx.fillRect(X, -off, W, half);
    ctx.fillRect(X, half + off, W, half);
    ctx.fillStyle = DANI.gold;
    ctx.fillRect(X - 2, -off, 2, half);
    ctx.fillRect(X - 2, half + off, 2, half);
    // La rueda de la combinación (media rueda asomando), gira al abrir
    if (open < 1) {
        ctx.globalAlpha = reveal * (1 - open);
        ctx.translate(GAME_WIDTH, half);
        ctx.strokeStyle = DANI.gold;
        ctx.lineWidth = 4;
        ctx.shadowColor = DANI.gold;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 34, Math.PI / 2, Math.PI * 1.5);
        ctx.stroke();
        ctx.rotate(open * Math.PI * 2);
        ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
            const a = Math.PI / 2 + i * Math.PI / 5;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
            ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28);
            ctx.stroke();
        }
    }
    ctx.restore();
    if (bossState.vaultOn && bossState.doorTarget === 1 && !bossState.ko) bossSign(ctx, 'ABIERTA', X - 44, 40, DANI.green, 7);
}

/** El K.O.: llueven billetes y monedas sobre el campo. @param {CanvasRenderingContext2D} ctx */
function daniDrawCashRain(ctx) {
    const ko = bossState.ko;
    if (!ko) return;
    const t = ko.ms / 1000;
    ctx.save();
    for (let i = 0; i < 40; i++) {
        const hx = vfxHash(i * 3 + 1), hs = vfxHash(i * 7 + 2), hd = vfxHash(i * 11 + 5);
        const y = -30 - hd * 260 + t * (160 + hs * 180);
        if (y < -30 || y > GAME_HEIGHT + 30) continue;
        const x = hx * GAME_WIDTH + Math.sin(t * 2 + i) * 12;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * (2 + hs * 4) + i);
        if (i % 3) {
            ctx.fillStyle = '#16A34A';
            ctx.fillRect(-12, -6, 24, 12);
            ctx.strokeStyle = '#BBF7D0';
            ctx.lineWidth = 1;
            ctx.strokeRect(-9, -4, 18, 8);
        } else {
            ctx.fillStyle = DANI.gold;
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
    ctx.restore();
}

// ------------------------------------------------------------------
//  El jefe
// ------------------------------------------------------------------

/** @type {BossMechanics} */
const bossDani = {
    config: { targetScore: 8, aiSpeed: 0.76, aiError: 22, aiBias: 70 },
    color: DANI.color,
    lives: 5,
    koLeadMs: DANI.koLeadMs,

    phases: [
        {
            name: 'Hoja de cálculo',
            goals: 3,
            config: { aiSpeed: 0.76, aiError: 22, aiBias: 70, spin: 0.2, smash: 0 }
        },
        {
            name: 'Intereses',
            goals: 3,
            config: { aiSpeed: 0.82, aiError: 18, aiBias: 62, spin: 0.4, smash: 0 },
            transition(t) {
                bossState.wallErase = t;     // el muro se borra en cascada
                bossState.chartGrow = t;     // y crece la gráfica roja
            },
            enter() {
                bossState.wallOn = false;
                bossState.interestOn = true;
                bossState.interest = 0;
                bossState.interestHist = [0];
                bossState.coin = null;
                bossState.coinTick = daniNow() + DANI.coinEvery;
                bossState.interest20Taunted = false;
            }
        },
        {
            name: 'La caja fuerte',
            goals: 2,
            config: { aiSpeed: 0.88, aiError: 14, aiBias: 54, spin: 0.55, smash: 0.35 },
            transition(t) {
                bossState.interestOn = false;
                bossState.coin = null;
                bossState.chartGrow = 1 - t;  // la gráfica se apaga
                bossState.vaultDrop = t;      // y aparece la puerta
            },
            enter() {
                bossState.vaultOn = true;
                bossState.door = 0;
                bossState.doorTarget = 0;
                daniPlaceButtons();
            }
        }
    ],

    init() {
        Object.assign(bossState, {
            time: 0,
            wallOn: true, wallErase: 0,
            cells: Array.from({ length: DANI.cells }, () => ({ alive: true, refillAt: null })),
            digits: [],
            interestOn: false, interest: 0, interestHist: [0], interestAt: -9999, interest20Taunted: false,
            coin: null, coinTick: 0, paid: null, chartGrow: 0,
            vaultOn: false, vaultDrop: 0, door: 0, doorTarget: 0, buttons: [], nextBtn: 0,
            koCash: false
        });
        const arena = CAMPAIGN_ART.pisos.arena_dani;
        artLoad(arena.src);
        artLoad(arena.theme);
    },

    update(dt) {
        bossState.time = daniNow() + dt * MS_PER_FRAME;
        const now = daniNow();
        for (const cell of bossState.cells) {
            if (cell.refillAt !== null && now >= cell.refillAt) {
                cell.alive = true;
                cell.refillAt = null;
            }
        }
        for (const d of bossState.digits) {
            d.x += d.vx * dt;
            d.y += d.vy * dt;
            d.vy += 0.18 * dt;
            d.life -= 0.02 * dt;
        }
        bossState.digits = bossState.digits.filter((d) => d.life > 0);
        if (bossState.interestOn) daniTickCoin();
        if (bossState.vaultOn) {
            const step = dt * MS_PER_FRAME / DANI.doorMs;
            const target = bossState.doorTarget;
            bossState.door = bossState.door < target ? Math.min(target, bossState.door + step) : Math.max(target, bossState.door - step);
        }
    },

    collide(b) {
        if (bossState.wallOn && daniCollideCells(b)) return true;
        if (bossState.interestOn) daniCheckCoin(b);
        if (bossState.vaultOn) {
            daniCheckButtons(b);
            return daniCollideDoor(b);
        }
        return false;
    },

    onHit(b, side, type) {
        if (!bossState.interestOn) return;
        if (side === 'p2') {
            // Cada golpe de Dani sube el interés, y la bola sale más rápida
            daniSetInterest(bossState.interest + DANI.interestStep);
            const cap = currentSpeedPreset().max * DANI.capK;
            const target = Math.min(b.speed * (1 + bossState.interest / 100), cap);
            if (target > b.speed) daniSetSpeed(b, target);
            if (bossState.interest >= 20 && !bossState.interest20Taunted) {
                bossState.interest20Taunted = true;
                bossTaunt('interest20');
            }
            return;
        }
        // El jugador devuelve al tope normal; su golpe perfecto divide el interés
        if (type === 'perfect' && bossState.interest > 0) daniSetInterest(bossState.interest / 2);
        const max = currentSpeedPreset().max * (state.fever ? MECH.feverMaxSpeedK : 1);
        if (b.power !== 'super' && b.speed > max) daniSetSpeed(b, max);
    },

    onGoal(scorerIsP1) {
        if (bossState.wallOn && !scorerIsP1) daniRefillCell();
        if (bossState.interestOn) daniSetInterest(0);
        if (bossState.vaultOn && (bossState.doorTarget === 1 || bossState.door > 0)) {
            // Tras cualquier gol la puerta se cierra y los botones cambian de sitio
            bossState.doorTarget = 0;
            daniPlaceButtons();
        }
    },

    koTick() {
        if (bossState.koCash) return;
        bossState.koCash = true;
        bossSfx('cashRain');
    },

    renderArena(ctx) {
        drawTintedArt(ctx, CAMPAIGN_ART.pisos.arena_dani, currentThemeHex(), 0, 0, GAME_WIDTH, GAME_HEIGHT);
        daniDrawChart(ctx);
    },

    render(ctx) {
        daniDrawCells(ctx);
        daniDrawButtons(ctx);
        daniDrawCoin(ctx);
        daniDrawDoor(ctx);
    },

    renderOverlay(ctx) {
        daniDrawDigits(ctx);
        daniDrawInterest(ctx);
        daniDrawCashRain(ctx);
    }
};
