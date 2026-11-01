/**
 * game/ai.js
 * ------------------------------------------------------------------
 * La paleta controlada por la CPU (y la gemela del dúo de jefes).
 *
 * La dificultad sale de dos números: la velocidad de la paleta y una
 * zona muerta (errorMargin) en la que no corrige. Los jefes además
 * apuntan con un desvío (bossAim) que se renueva en cada golpe: una zona
 * muerta menor que media paleta no provoca fallos por sí sola, así que
 * sin ese desvío la CPU sería imbatible.
 *
 * En VS CPU y en el Modo Hachepe la CPU usa además las mecánicas de
 * golpe: cada vez que una bola empieza a venir hacia ella elige un plan
 * (MECH.cpu, con Math.random) — dar efecto, usar el smash si su energía
 * está llena y apuntar al centro de la paleta prediciendo el rebote. La predicción no
 * tiene en cuenta los portales. Los jefes de campaña no planifican:
 * conservan su IA.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Plan de la CPU para la bola que viene hacia ella.
 * @typedef {object} CpuPlan
 * @property {boolean} spin       dar efecto al devolver
 * @property {boolean} useSmash   usar el smash si la energía está llena
 * @property {number|null} aimOffset  desvío al apuntar al centro de la paleta; null = persigue la bola
 */

/** @type {CpuPlan|null} */
let cpuPlan = null;
/** La bola objetivo venía hacia la CPU en el fotograma anterior. */
let cpuBallWasComing = false;
/** ms desde que la bola objetivo empezó a venir hacia la CPU. */
let cpuComingMs = 0;
/** La última llegada prevista antes de que la bola cruzara un portal. */
/** @type {number|null} */
let cpuLastPredY = null;

/**
 * Plan de una pala de jefe con mecánicas (`spin`/`smash` en su config):
 * se elige cuando la bola empieza a venir hacia ella. Cada pala lleva el
 * suyo (el dúo tiene dos).
 * @typedef {{ plan: { spin: boolean, smash: boolean }|null, wasComing: boolean }} BossPlanSlot
 */

/** @type {BossPlanSlot} El plan de p2. */
const bossPlanP2 = { plan: null, wasComing: false };

/** Sin plan: la próxima bola que venga hace elegir uno nuevo (al empezar partida). */
function resetCpuPlan() {
    cpuPlan = null;
    cpuBallWasComing = false;
    cpuComingMs = 0;
    cpuLastPredY = null;
    bossPlanP2.plan = null;
    bossPlanP2.wasComing = false;
}

/**
 * Jefe con mecánicas (p2): ver bossPlayPaddle.
 * @param {Ball|undefined} ball
 * @param {number} aiSpeed
 * @param {number} errorMargin
 * @param {BossConfig} cfg
 * @param {number} dt
 */
function bossPlay(ball, aiSpeed, errorMargin, cfg, dt) {
    bossPlayPaddle(p2, ball, aiSpeed, errorMargin, cfg, dt, bossPlanP2);
}

/**
 * Una pala de jefe con mecánicas: persigue la bola con su desvío de
 * puntería (como los demás jefes) y, según el plan de esta bola, da
 * efecto barriendo en los últimos fotogramas o carga el smash si su
 * barra está llena. El plan pide siempre dos números aleatorios.
 * @param {Paddle} p la pala (p2 o la gemela)
 * @param {Ball|undefined} ball la bola que persigue
 * @param {number} aiSpeed
 * @param {number} errorMargin
 * @param {BossConfig} cfg
 * @param {number} dt
 * @param {BossPlanSlot} slot su plan
 * @param {{ goal?: number|null, home?: number }} [opts] goal: otro objetivo
 *        (en lugar de la bola + su desvío); home: dónde espera sin bola
 */
function bossPlayPaddle(p, ball, aiSpeed, errorMargin, cfg, dt, slot, opts = {}) {
    const coming = !!ball && ball.dx > 0;
    if (coming && !slot.wasComing) {
        const spinRoll = Math.random();
        const smashRoll = Math.random();
        slot.plan = { spin: spinRoll < (cfg.spin || 0), smash: smashRoll < (cfg.smash || 0) };
    }
    slot.wasComing = coming;

    const center = p.y + p.height / 2;
    const speed = aiSpeed * (p.smashHeld ? MECH.smashSlowK : 1);
    let hold = false;
    if (coming && slot.plan) {
        const frames = (p.x - ball.x) / Math.max(0.1, ball.dx);
        const msLeft = frames * MS_PER_FRAME;
        if (slot.plan.smash && superReadyFor(p)) {
            hold = msLeft <= MECH.cpu.smashLeadMs && msLeft > MECH.cpu.smashReleaseMs;
        }
        const goal = typeof opts.goal === 'number' ? opts.goal : ball.y + bossAim();
        const sweep = slot.plan.spin && !hold ? cpuSpinSweep(goal, aiSpeed) : 0;
        if (sweep !== 0 && frames <= MECH.cpu.spinFrames
            && Math.abs(goal - (center + sweep * aiSpeed * dt)) <= p.height / 2 * MECH.cpu.spinMaxContact) {
            p.y += sweep * aiSpeed * dt;
        } else if (center < goal - errorMargin) {
            p.y += speed * dt;
        } else if (center > goal + errorMargin) {
            p.y -= speed * dt;
        }
    } else {
        const home = opts.home ?? GAME_HEIGHT / 2;
        if (center < home - 5) p.y += speed * 0.5 * dt;
        else if (center > home + 5) p.y -= speed * 0.5 * dt;
    }
    updateSmash(p, hold, dt);
}

/**
 * Tras un cruce de portal, cuánto sigue la CPU yendo a donde iba la bola:
 * en Imposible y en el Modo Hachepe recalcula enseguida; en el resto, ya
 * no corrige en esa jugada (es intencionado: los portales la engañan).
 */
function cpuPortalBlindMs() {
    return state.mode === 'hachepe' || settings.difficulty === 3 ? CPU_PORTAL_RECALC_MS : Infinity;
}

/** @returns {CpuPlanTuning} los números del plan según el modo y la dificultad */
function cpuTuning() {
    if (state.mode === 'hachepe') return MECH.cpu.hachepe;
    return MECH.cpu.byDifficulty[settings.difficulty] || MECH.cpu.byDifficulty[2];
}

/**
 * Elige el plan. Siempre pide los mismos tres números aleatorios, sea
 * cual sea la dificultad.
 * @param {CpuPlanTuning} t
 * @returns {CpuPlan}
 */
function makeCpuPlan(t) {
    const spinRoll = Math.random();
    const smashRoll = Math.random();
    const aimRoll = Math.random();
    return {
        spin: spinRoll < t.spin,
        useSmash: smashRoll < t.useSmash,
        aimOffset: t.aim === null ? null : (aimRoll * 2 - 1) * t.aim
    };
}

/**
 * Predice dónde llegará la bola a x = targetX simulando su vuelo
 * fotograma a fotograma, con los rebotes en las paredes y su efecto
 * (multiplicado por `read`: 0 lo ignora, 1 lo lee entero).
 * @param {Ball} b
 * @param {number} targetX
 * @param {number} read
 * @returns {{y: number, frames: number}}
 */
function predictBallY(b, targetX, read) {
    let x = b.x, y = b.y, dx = b.dx, dy = b.dy, spin = b.spin * read;
    const r = b.radius;
    const lim = b.speed * MECH.spinMaxSlope;
    for (let n = 1; n <= 600; n++) {
        x += dx;
        y += dy;
        if (spin !== 0) {
            dy = mechClamp(dy + spin * MECH.spinAccel, -lim, lim);
            spin *= MECH.spinDecay;
        }
        if (y - r < 0 || y + r > GAME_HEIGHT) {
            dy = -dy;
            spin *= MECH.spinWallK;
            y = mechClamp(y, r, GAME_HEIGHT - r);
        }
        if (x + r >= targetX) return { y, frames: n };
    }
    return { y, frames: 600 };
}

/**
 * Sentido del barrido para dar efecto: lejos del jugador (1 abajo, -1
 * arriba). Si junto a una pared no cabe la colocación previa (medio
 * barrido hacia el otro lado), prueba el sentido contrario; si tampoco
 * cabe, 0: esta vez no da efecto.
 * @param {number} contactY dónde llegará la bola
 * @param {number} aiSpeed
 */
function cpuSpinSweep(contactY, aiSpeed) {
    const half = aiSpeed * MECH.cpu.spinFrames / 2;
    const fits = (dir) => {
        const start = contactY - dir * half;
        return start >= p2.height / 2 && start <= GAME_HEIGHT - p2.height / 2;
    };
    const away = p1.y + p1.height / 2 < GAME_HEIGHT / 2 ? 1 : -1;
    if (fits(away)) return away;
    if (fits(-away)) return -away;
    return 0;
}

/**
 * VS CPU y Hachepe: la CPU sigue su plan para la bola que viene. La
 * velocidad y la zona muerta son las de su dificultad.
 * @param {Ball|undefined} ball la bola objetivo
 * @param {number} aiSpeed
 * @param {number} errorMargin
 * @param {number} dt
 */
function cpuPlay(ball, aiSpeed, errorMargin, dt) {
    const t = cpuTuning();
    const coming = !!ball && ball.dx > 0;
    if (coming && !cpuBallWasComing) {
        cpuPlan = makeCpuPlan(t);
        cpuComingMs = 0;
    }
    cpuBallWasComing = coming;
    if (coming) cpuComingMs += dt * MS_PER_FRAME;

    const center = p2.y + p2.height / 2;
    // Cargar el smash la ralentiza, como al jugador
    const speed = aiSpeed * (p2.smashHeld ? MECH.smashSlowK : 1);
    let holdSmash = false;

    if (coming && cpuPlan) {
        // La predicción no sabe de portales: si la bola ha cruzado uno en
        // esta jugada, la CPU sigue apuntando a donde iba a llegar antes
        const fresh = predictBallY(ball, p2.x, t.read);
        const blind = cpuLastPredY !== null && ball.warpMs < Math.min(cpuComingMs, cpuPortalBlindMs());
        const pred = blind ? { y: cpuLastPredY, frames: fresh.frames } : fresh;
        if (!blind) cpuLastPredY = fresh.y;
        const msLeft = pred.frames * MS_PER_FRAME;
        // El smash solo se carga con la energía llena, y si el plan lo usa
        const trySmash = superReadyFor(p2) && cpuPlan.useSmash;
        if (trySmash) {
            const near = p2.x - ball.x < MECH.cpu.smashRange || msLeft <= MECH.cpu.smashLeadMs;
            holdSmash = near && msLeft > MECH.cpu.smashReleaseMs;
        }

        // Efecto: en los últimos fotogramas barre a toda velocidad, lejos de
        // donde está el jugador. Antes se coloca medio barrido hacia el otro
        // lado, para que la bola acabe dando dentro de la paleta.
        const sweep = cpuSpinSweep(pred.y, aiSpeed);
        const spin = cpuPlan.spin && !trySmash && sweep !== 0;
        if (spin && pred.frames <= MECH.cpu.spinFrames) {
            // Solo mientras la bola siga cayendo dentro de la paleta
            const next = center + sweep * aiSpeed * dt;
            if (Math.abs(pred.y - next) <= p2.height / 2 * MECH.cpu.spinMaxContact) p2.y += sweep * aiSpeed * dt;
        } else {
            // Apunta a que la bola dé en el centro de la paleta; sin
            // puntería (Fácil), persigue la bola como siempre
            let goal = cpuPlan.aimOffset === null ? ball.y : pred.y + cpuPlan.aimOffset;
            if (spin) goal -= sweep * aiSpeed * MECH.cpu.spinFrames / 2;
            if (center < goal - errorMargin) p2.y += speed * dt;
            else if (center > goal + errorMargin) p2.y -= speed * dt;
        }
    } else {
        if (center < GAME_HEIGHT / 2 - 5) p2.y += speed * 0.5 * dt;
        else if (center > GAME_HEIGHT / 2 + 5) p2.y -= speed * 0.5 * dt;
    }
    updateSmash(p2, holdSmash, dt);
}

/**
 * Mueve la paleta de la CPU (p2). Un jefe con IA propia (el dúo, que
 * mueve también la gemela) lo hace con su gancho `ai`.
 * @param {number} dt
 * @param {BossConfig|null} bcfg config del jefe en curso (bossConfig())
 */
function moveCpu(dt, bcfg) {
    let aiSpeed = paddleSpeed, errorMargin = 0;
    if (bcfg) {
        // Cada jefe de campaña tiene su propia habilidad: esa es la curva
        // de dificultad que el lore promete (⭐⭐ a ⭐⭐⭐⭐⭐).
        aiSpeed = paddleSpeed * bcfg.aiSpeed;
        errorMargin = bcfg.aiError;
    } else if (state.mode === 'hachepe') {
        aiSpeed = paddleSpeed * 1.15; // Velocidad alta pero superable
        errorMargin = 10; // Un ligero margen de error
    } else {
        if (settings.difficulty === 1) { aiSpeed = paddleSpeed * 0.45; errorMargin = 30; }
        else if (settings.difficulty === 2) { aiSpeed = paddleSpeed * 0.65; errorMargin = 15; }
        else { aiSpeed = paddleSpeed * 0.95; errorMargin = 0; }
    }

    // La CPU persigue la bola más cercana que vaya hacia ella
    let targetBall = state.balls[0];
    let closestDist = Infinity;
    for (const b of state.balls) {
        if (b.dx > 0) { // va hacia la CPU
            const dist = Math.abs(b.x - p2.x);
            if (dist < closestDist) { closestDist = dist; targetBall = b; }
        }
    }
    if (!targetBall) targetBall = state.balls[0];

    // Un jefe con IA propia (el dúo, la predicción de Fano) mueve sus palas
    if (bcfg && bossMoveAi(targetBall, aiSpeed, errorMargin, bcfg, dt)) return;

    // VS CPU y Hachepe: con las mecánicas. Los jefes, con su IA de siempre;
    // los que traen `spin`/`smash` en su config, con su plan (bossPlay).
    if (!bcfg) {
        cpuPlay(targetBall, aiSpeed, errorMargin, dt);
        return;
    }
    if ((bcfg.spin || 0) > 0 || (bcfg.smash || 0) > 0) {
        bossPlay(targetBall, aiSpeed, errorMargin, bcfg, dt);
        return;
    }

    const p2Center = p2.y + p2.height / 2;
    // Los jefes apuntan con un desvío que se renueva en cada golpe: sin él
    // la CPU es literalmente imbatible y el combate no termina nunca.
    const aim = bcfg ? bossAim() : 0;
    if (targetBall && targetBall.dx > 0) {
        const objetivo = targetBall.y + aim;
        if (p2Center < objetivo - errorMargin) p2.y += aiSpeed * dt;
        else if (p2Center > objetivo + errorMargin) p2.y -= aiSpeed * dt;
    } else {
        if (p2Center < GAME_HEIGHT / 2 - 5) p2.y += aiSpeed * 0.5 * dt;
        else if (p2Center > GAME_HEIGHT / 2 + 5) p2.y -= aiSpeed * 0.5 * dt;
    }
}
