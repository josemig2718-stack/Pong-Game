/**
 * bosses/chemi.js
 * ------------------------------------------------------------------
 * 1 · CHEMI — The Black (PB, Recepción de la Torre Hachepe)
 *
 * Combate por fases (bosses/phases.js) en la recepción:
 *   1 · ¿Tiene cita?          dos torniquetes giratorios en su campo; cada
 *                             6 s uno se pone en verde y pliega los brazos
 *   2 · Control de seguridad  un arco detector que sube y baja en el
 *                             centro: la bola que lo cruza por el hueco
 *                             hace BIP y va ×1,35 hasta el siguiente golpe;
 *                             cada 4.º golpe de Chemi, el sello «DENEGADO»
 *   3 · Código negro          su portería son tres ascensores: solo cuenta
 *                             el gol por el hueco del que está abierto;
 *                             el resto es persiana y rebota
 * Su K.O.: la bola entra en el ascensor, las puertas se cierran y el
 * indicador sube de PB a 1.
 *
 * Reglas de los obstáculos (bosses/index.js): todo está en su campo, el
 * pasillo central (y 212–388) nunca se cierra y cada rebote perturba dy.
 * El azar de la física es Math.random (como el resto de jefes); el
 * dibujo solo lee el estado y el reloj del combate (bossState.time).
 *
 * Lo registra bosses/index.js en BOSS_MECHANICS, que se carga después.
 * ------------------------------------------------------------------
 */

'use strict';

/** Medidas y tiempos del combate de Chemi (unidades del campo, ms). */
const CHEMI = {
    color: '#E5E7EB',
    gold: '#FACC15',
    green: '#4ADE80',
    red: '#EF4444',
    // Fase 1 · torniquetes
    turnstiles: [{ x: 580, y: 150, dir: 1 }, { x: 580, y: 450, dir: -1 }],
    armLen: 62,
    armFolded: 26,
    armWidth: 7,
    armSpin: 0.9,           // rad/s
    armTangentK: 0.3,       // parte de la velocidad del brazo que se lleva la bola
    greenEvery: 6000,
    greenFirst: 2000,
    greenFor: 2500,
    blinkMs: 600,
    foldMs: 250,
    // Fase 2 · arco detector y sello
    archX: 400,
    archGap: 150,
    archMid: 300,
    archAmp: 150,
    archPeriod: 5000,
    bipK: 1.35,
    aimShare: 0.5,          // la mitad de sus golpes apuntan al arco
    stampEvery: 4,
    stampAngle: 62 * Math.PI / 180,
    stampSpeedK: 1.1,
    stampPathMs: 400,
    // Fase 3 · ascensores
    elevators: [[0, 200], [200, 400], [400, 600]],
    elevatorGap: 160,
    elevatorEvery: 6000,
    elevatorWarn: 1000,
    shutterX: 793,          // línea de choque de las persianas
    shutterDrawX: 780,      // desde aquí se dibujan (detrás de la pala de Chemi)
    redPulseMs: 1200,
    // K.O.: puertas 0,6 s y el indicador sube
    koDoorsMs: 600,
    koLeadMs: 1400
};

/** Tiempo de combate (ms). */
function chemiNow() {
    return bossState.time || 0;
}

// ------------------------------------------------------------------
//  Fase 1 · torniquetes
// ------------------------------------------------------------------

/**
 * ¿Está en verde el torniquete i (0 arriba, 1 abajo)? Cada 6 s se pone
 * uno en verde 2,5 s, alternando; el primero, arriba, a los 2 s.
 * @param {number} i
 * @param {number} t ms desde que empezó la fase
 */
function chemiTurnstileGreen(i, t) {
    const k = Math.floor((t - CHEMI.greenFirst) / CHEMI.greenEvery);
    if (k < 0 || k % 2 !== i) return false;
    return t - (CHEMI.greenFirst + k * CHEMI.greenEvery) < CHEMI.greenFor;
}

/**
 * ¿Parpadea su luz? (los 0,6 s antes de cambiar)
 * @param {number} i
 * @param {number} t
 */
function chemiTurnstileBlink(i, t) {
    return chemiTurnstileGreen(i, t) !== chemiTurnstileGreen(i, t + CHEMI.blinkMs);
}

/**
 * Choque de la bola con los brazos de un torniquete: segmento contra
 * círculo. Refleja respecto a la normal, suma parte de la velocidad del
 * brazo, perturba dy y saca la bola fuera.
 * @param {Ball} b
 * @returns {boolean}
 */
function chemiCollideTurnstiles(b) {
    const rad = b.radius + CHEMI.armWidth / 2;
    for (const ts of bossState.turnstiles) {
        if (ts.green || ts.len < CHEMI.armLen * 0.9) continue;   // plegado: no choca
        if (Math.abs(b.x - ts.x) > ts.len + rad || Math.abs(b.y - ts.y) > ts.len + rad) continue;
        for (let a = 0; a < 3; a++) {
            const ang = ts.angle + a * Math.PI * 2 / 3;
            const ex = Math.cos(ang), ey = Math.sin(ang);
            const proj = Math.max(0, Math.min(ts.len, (b.x - ts.x) * ex + (b.y - ts.y) * ey));
            const qx = ts.x + ex * proj, qy = ts.y + ey * proj;
            const d = Math.hypot(b.x - qx, b.y - qy);
            if (d >= rad) continue;
            const nx = d > 0.001 ? (b.x - qx) / d : -ey, ny = d > 0.001 ? (b.y - qy) / d : ex;
            // Velocidad del brazo en el punto de contacto (px por fotograma)
            const w = ts.dir * CHEMI.armSpin / 60;
            const vax = -w * (qy - ts.y), vay = w * (qx - ts.x);
            if ((b.dx - vax) * nx + (b.dy - vay) * ny >= 0) continue;   // ya se aleja
            const dot = b.dx * nx + b.dy * ny;
            b.dx = b.dx - 2 * dot * nx + vax * CHEMI.armTangentK;
            b.dy = b.dy - 2 * dot * ny + vay * CHEMI.armTangentK;
            // La regla de los obstáculos: perturbar dy, o el rebote se repite
            b.dy += (Math.random() * 2 - 1) * b.speed * 0.3;
            bossNormalizeBall(b);
            b.x = qx + nx * (rad + 0.5);
            b.y = qy + ny * (rad + 0.5);
            b.spin *= MECH.spinWallK;
            if (soundEffects.turnstile) soundEffects.turnstile();
            spawnParticles(b.x, b.y, CHEMI.gold, 8);
            if (!bossState.turnstileTaunted) {
                bossState.turnstileTaunted = true;
                bossTaunt('turnstile', true);
            }
            return true;
        }
    }
    return false;
}


// ------------------------------------------------------------------
//  Fase 2 · arco detector y sello
// ------------------------------------------------------------------

/**
 * Centro del hueco del arco en un instante.
 * @param {number} t ms de combate
 */
function chemiArchY(t) {
    return CHEMI.archMid + CHEMI.archAmp * Math.sin(2 * Math.PI * (t - (bossState.archT0 || 0)) / CHEMI.archPeriod);
}

/**
 * Si la bola acaba de cruzar x 400 con el centro dentro del hueco: BIP.
 * @param {Ball} b
 */
function chemiCheckArch(b) {
    const prev = b.trail.length ? b.trail[b.trail.length - 1] : null;
    if (!prev || b.bip) return;
    const crossed = (prev.x < CHEMI.archX) !== (b.x < CHEMI.archX);
    if (!crossed || Math.abs(b.y - chemiArchY(chemiNow())) > CHEMI.archGap / 2) return;
    b.bip = true;
    b.dx *= CHEMI.bipK;
    b.dy *= CHEMI.bipK;
    bossState.bipAt = chemiNow();
    if (soundEffects.bip) soundEffects.bip();
    if (b.owner === 'p1') bossTaunt('detector');
}

/**
 * Chemi apunta su golpe al arco: dy para que la bola cruce x 400 por la
 * altura que tendrá el centro del hueco en ese momento.
 * @param {Ball} b
 */
function chemiAimAtArch(b) {
    const frames = (b.x - CHEMI.archX) / Math.max(0.5, Math.abs(b.dx));
    const target = chemiArchY(chemiNow() + frames * MS_PER_FRAME);
    const dy = (target - b.y) / frames;
    const speed = Math.hypot(b.dx, b.dy);
    if (Math.abs(dy) > speed * 0.8) return;   // demasiado inclinado: no
    b.dy = dy;
    b.dx = -Math.sqrt(speed * speed - dy * dy);
}

/**
 * El sello: golpe a 62° hacia la pared más lejana de la pala del jugador,
 * ×1,1, y su trayectoria punteada hasta el borde del jugador.
 * @param {Ball} b
 */
function chemiStamp(b) {
    const down = p1.y + p1.height / 2 < GAME_HEIGHT / 2;   // pala arriba: hacia abajo
    b.speed *= CHEMI.stampSpeedK;
    b.dx = -Math.cos(CHEMI.stampAngle) * b.speed;
    b.dy = (down ? 1 : -1) * Math.sin(CHEMI.stampAngle) * b.speed;
    b.spin = 0;
    // La trayectoria, con sus rebotes, hasta el borde del jugador
    const pts = [{ x: b.x, y: b.y }];
    let x = b.x, y = b.y, dx = b.dx, dy = b.dy;
    const edge = p1.x + p1.width;
    for (let n = 0; n < 2000 && x > edge; n++) {
        x += dx;
        y += dy;
        if (y < b.radius || y > GAME_HEIGHT - b.radius) {
            y = Math.max(b.radius, Math.min(GAME_HEIGHT - b.radius, y));
            dy = -dy;
            pts.push({ x, y });
        }
    }
    pts.push({ x, y });
    bossState.stampPath = pts;
    bossState.stampAt = chemiNow();
    bossState.stampShown = false;
    if (soundEffects.stamp) soundEffects.stamp();
}

// ------------------------------------------------------------------
//  Fase 3 · ascensores
// ------------------------------------------------------------------

/** @param {number} i ascensor @returns {[number, number]} el hueco abierto */
function chemiElevatorGap(i) {
    const [a, z] = CHEMI.elevators[i];
    const mid = (a + z) / 2;
    return [mid - CHEMI.elevatorGap / 2, mid + CHEMI.elevatorGap / 2];
}

/**
 * La persiana: la bola que llega a la pared de Chemi fuera del hueco
 * abierto rebota. Solo cuenta el gol por el hueco.
 * @param {Ball} b
 * @returns {boolean}
 */
function chemiCollideShutters(b) {
    if (b.dx <= 0 || b.x + b.radius < CHEMI.shutterX) return false;
    const [g0, g1] = chemiElevatorGap(bossState.openElevator);
    if (b.y >= g0 && b.y <= g1) return false;   // por el hueco: gol
    b.x = CHEMI.shutterX - b.radius;
    b.dx = -Math.abs(b.dx);
    b.dy += (Math.random() * 2 - 1) * b.speed * 0.3;
    bossNormalizeBall(b);
    b.dx = -Math.abs(b.dx);
    b.spin *= MECH.spinWallK;
    if (soundEffects.clang) soundEffects.clang();
    spawnParticles(b.x, b.y, CHEMI.gold, 12);
    return true;
}

/** Cada 6 s se abre otro ascensor (nunca el mismo); 1 s antes, el aviso. */
function chemiTickElevators() {
    const now = chemiNow();
    if (bossState.nextElevator === null && now >= bossState.elevatorAt - CHEMI.elevatorWarn) {
        const others = [0, 1, 2].filter((i) => i !== bossState.openElevator);
        bossState.nextElevator = others[Math.random() < 0.5 ? 0 : 1];
        if (soundEffects.elevatorDing) soundEffects.elevatorDing();
    }
    if (now >= bossState.elevatorAt) {
        bossState.openElevator = bossState.nextElevator;
        bossState.nextElevator = null;
        bossState.elevatorAt = now + CHEMI.elevatorEvery;
    }
}

// ------------------------------------------------------------------
//  Dibujo
// ------------------------------------------------------------------

/** @param {CanvasRenderingContext2D} ctx */
function chemiDrawTurnstiles(ctx) {
    const sink = bossState.sink || 0;
    if (!bossState.turnstilesOn || sink >= 1) return;
    const t = chemiNow() - bossState.phaseT0;
    bossState.turnstiles.forEach((ts, i) => {
        const blink = chemiTurnstileBlink(i, t) && Math.floor(t / 100) % 2 === 0;
        const green = ts.green;
        const light = blink ? '#FDE68A' : green ? CHEMI.green : CHEMI.red;
        ctx.save();
        ctx.globalAlpha = 1 - sink;
        ctx.translate(ts.x, ts.y);
        ctx.scale(1 - sink * 0.6, 1 - sink * 0.6);
        // Círculo punteado del alcance
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = light;
        ctx.globalAlpha = (1 - sink) * 0.55;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, CHEMI.armLen + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1 - sink;
        // Brazos
        ctx.strokeStyle = '#E5E0D0';
        ctx.lineCap = 'round';
        ctx.lineWidth = CHEMI.armWidth;
        ctx.shadowColor = light;
        ctx.shadowBlur = 6;
        for (let a = 0; a < 3; a++) {
            const ang = ts.angle + a * Math.PI * 2 / 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(ang) * ts.len, Math.sin(ang) * ts.len);
            ctx.stroke();
        }
        // Eje dorado
        ctx.shadowColor = CHEMI.gold;
        ctx.fillStyle = '#1A1405';
        ctx.strokeStyle = CHEMI.gold;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        if (sink < 0.3) bossSign(ctx, green ? 'PASE' : 'ALTO', ts.x, ts.y - CHEMI.armLen - 22, light, 8);
    });
}

/** @param {CanvasRenderingContext2D} ctx */
function chemiDrawArch(ctx) {
    const drop = bossState.archDrop ?? 1;
    if (!bossState.archOn && drop <= 0) return;
    const now = chemiNow();
    const y = chemiArchY(now) - (1 - drop) * 420;
    const top = y - CHEMI.archGap / 2, bottom = y + CHEMI.archGap / 2;
    const bip = now - (bossState.bipAt ?? -9999) < 500;
    ctx.save();
    // El haz del detector
    ctx.strokeStyle = bip ? '#FFFFFF' : CHEMI.red;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 6;
    ctx.shadowColor = CHEMI.red;
    ctx.shadowBlur = bip ? 24 : 12;
    ctx.strokeRect(CHEMI.archX - 8, top, 16, CHEMI.archGap);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = CHEMI.red;
    ctx.fillRect(CHEMI.archX - 8, top, 16, CHEMI.archGap);
    ctx.globalAlpha = 1;
    // Remates dorados
    ctx.shadowColor = CHEMI.gold;
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#2A2006';
    ctx.strokeStyle = CHEMI.gold;
    ctx.lineWidth = 2;
    for (const yy of [top - 6, bottom - 2]) {
        ctx.fillRect(CHEMI.archX - 17, yy, 34, 8);
        ctx.strokeRect(CHEMI.archX - 17, yy, 34, 8);
    }
    // Flechas: hacia dónde se mueve
    ctx.strokeStyle = CHEMI.red;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CHEMI.archX - 7, top - 14); ctx.lineTo(CHEMI.archX, top - 21); ctx.lineTo(CHEMI.archX + 7, top - 14);
    ctx.moveTo(CHEMI.archX - 7, bottom + 14); ctx.lineTo(CHEMI.archX, bottom + 21); ctx.lineTo(CHEMI.archX + 7, bottom + 14);
    ctx.stroke();
    ctx.restore();
    if (bip) bossSign(ctx, 'BIP ×1,35', CHEMI.archX + 70, y, CHEMI.red, 8);
}

/** El sello «HP» sobre la pala de Chemi y la trayectoria «DENEGADO». */
function chemiDrawStamp(ctx) {
    if (bossState.phase !== 1 || !bossState.archOn) return;
    if (bossState.stampWarn) {
        const pulse = 0.75 + 0.25 * Math.sin(chemiNow() / 90);
        ctx.save();
        ctx.globalAlpha = pulse;
        bossSign(ctx, 'HP', p2.x - 30, p2.y + p2.height / 2, CHEMI.gold, 11);
        ctx.restore();
    }
    const since = chemiNow() - (bossState.stampAt ?? -9999);
    if (since < CHEMI.stampPathMs && bossState.stampPath) {
        const pts = bossState.stampPath;
        ctx.save();
        ctx.globalAlpha = 1 - since / CHEMI.stampPathMs;
        ctx.strokeStyle = CHEMI.red;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 7]);
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        bossSign(ctx, 'DENEGADO', 640, 40, CHEMI.red, 9);
    }
}

/** La pared de Chemi en la fase 3: tres ascensores, persianas y el abierto. */
function chemiDrawElevators(ctx) {
    const drop = bossState.shutterDrop ?? 0;
    if (!bossState.shuttersOn && drop <= 0) return;
    const now = chemiNow();
    const ko = bossState.ko;
    const X = CHEMI.shutterDrawX;
    const W = GAME_WIDTH - X;
    ctx.save();
    CHEMI.elevators.forEach(([a, z], i) => {
        const open = bossState.shuttersOn && i === bossState.openElevator;
        const [g0, g1] = chemiElevatorGap(i);
        // Persiana: lamas doradas que bajan desde arriba en la transición
        const h = (z - a) * (bossState.shuttersOn ? 1 : drop);
        ctx.fillStyle = 'rgba(30, 24, 10, 0.92)';
        ctx.fillRect(X, a, W, h);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.55)';
        for (let y = a + 4; y < a + h; y += 8) ctx.fillRect(X, y, W, 2);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.9)';
        ctx.fillRect(X - 2, a, 2, h);
        if (h >= z - a - 1) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
            ctx.fillRect(X - 2, a + 1, 2, 3);   // separación entre ascensores
        }
        if (open) {
            // El hueco abierto, con luz verde; en el K.O. las puertas se cierran
            ctx.fillStyle = '#020604';
            ctx.fillRect(X, g0, W, g1 - g0);
            ctx.save();
            ctx.strokeStyle = CHEMI.green;
            ctx.shadowColor = CHEMI.green;
            ctx.shadowBlur = 12;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(X + W, g0); ctx.lineTo(X - 4, g0); ctx.lineTo(X - 4, g1); ctx.lineTo(X + W, g1);
            ctx.stroke();
            ctx.restore();
            if (ko) {
                const k = Math.min(1, ko.ms / CHEMI.koDoorsMs);
                const half = (g1 - g0) / 2 * k;
                ctx.fillStyle = '#5B6170';
                ctx.fillRect(X - 4, g0, W + 4, half);
                ctx.fillRect(X - 4, g1 - half, W + 4, half);
                const led = ko.ms >= CHEMI.koDoorsMs + 200 ? '1' : 'PB';
                bossSign(ctx, led, X - 26, Math.max(16, g0 - 16), CHEMI.red, 10);
            } else {
                bossSign(ctx, 'ABIERTO', X - 50, (g0 + g1) / 2, CHEMI.green, 7);
            }
        } else if (bossState.shuttersOn) {
            bossSign(ctx, 'PERSIANA', X - 50, (a + z) / 2, 'rgba(250, 204, 21, 0.6)', 6);
        }
        // La flecha del siguiente, que parpadea el segundo antes
        if (bossState.shuttersOn && i === bossState.nextElevator && Math.floor(now / 120) % 2 === 0) {
            const cy = (a + z) / 2;
            ctx.fillStyle = CHEMI.green;
            ctx.shadowColor = CHEMI.green;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(X - 22, cy - 10);
            ctx.lineTo(X - 10, cy);
            ctx.lineTo(X - 22, cy + 10);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    });
    ctx.restore();
}

// ------------------------------------------------------------------
//  El jefe
// ------------------------------------------------------------------

/** @type {BossMechanics} */
const bossChemi = {
    config: { targetScore: 8, aiSpeed: 0.76, aiError: 22, aiBias: 70 },
    color: CHEMI.color,
    lives: 5,
    koLeadMs: CHEMI.koLeadMs,

    phases: [
        {
            name: '¿Tiene cita?',
            goals: 3,
            config: { aiSpeed: 0.76, aiError: 22, aiBias: 70, spin: 0.2, smash: 0 }
        },
        {
            name: 'Control de seguridad',
            goals: 3,
            config: { aiSpeed: 0.82, aiError: 18, aiBias: 62, spin: 0.4, smash: 0 },
            transition(t) {
                bossState.sink = t;          // los torniquetes se hunden
                bossState.archDrop = t;      // y el arco baja del techo
            },
            enter() {
                bossState.turnstilesOn = false;
                bossState.archOn = true;
                bossState.archDrop = 1;
                bossState.archT0 = chemiNow();
                bossState.chemiHits = 0;
                bossState.stampWarn = false;
            }
        },
        {
            name: 'Código negro',
            goals: 2,
            config: { aiSpeed: 0.88, aiError: 14, aiBias: 54, spin: 0.55, smash: 0.35 },
            transition(t) {
                // La alarma (2 s) suena una vez al empezar la transformación
                if (!bossState.alarmPlayed) {
                    bossState.alarmPlayed = true;
                    if (soundEffects.alarm) soundEffects.alarm();
                }
                bossState.archDrop = 1 - t;  // el arco sube
                bossState.shutterDrop = t;   // bajan las persianas
                bossState.redLights = t;     // se encienden las luces rojas
            },
            enter() {
                bossState.archOn = false;
                bossState.shuttersOn = true;
                bossState.redLights = 1;
                bossState.openElevator = 1;
                bossState.nextElevator = null;
                bossState.elevatorAt = chemiNow() + CHEMI.elevatorEvery;
            }
        }
    ],

    init() {
        Object.assign(bossState, {
            time: 0, phaseT0: 0,
            turnstilesOn: true,
            turnstiles: CHEMI.turnstiles.map((ts) => ({ ...ts, angle: ts.dir > 0 ? 0 : Math.PI / 3, len: CHEMI.armLen, green: false })),
            turnstileTaunted: false, sink: 0,
            archOn: false, archDrop: 0, archT0: 0, bipAt: -9999,
            chemiHits: 0, stampWarn: false, stampAt: -9999, stampPath: null,
            shuttersOn: false, shutterDrop: 0, redLights: 0, openElevator: 1, nextElevator: null, elevatorAt: 0,
            alarmPlayed: false
        });
        const arena = CAMPAIGN_ART.chemi.arena_chemi;
        artLoad(arena.src);
        artLoad(arena.theme);
    },

    update(dt) {
        bossState.time = chemiNow() + dt * MS_PER_FRAME;
        if (bossState.turnstilesOn) {
            const t = chemiNow() - bossState.phaseT0;
            bossState.turnstiles.forEach((ts, i) => {
                ts.angle += ts.dir * CHEMI.armSpin * dt / 60;
                ts.green = chemiTurnstileGreen(i, t);
                const target = ts.green ? CHEMI.armFolded : CHEMI.armLen;
                const step = (CHEMI.armLen - CHEMI.armFolded) * dt * MS_PER_FRAME / CHEMI.foldMs;
                ts.len = ts.len < target ? Math.min(target, ts.len + step) : Math.max(target, ts.len - step);
            });
        }
        if (bossState.shuttersOn && !bossState.ko) chemiTickElevators();
    },

    collide(b) {
        if (bossState.turnstilesOn && chemiCollideTurnstiles(b)) return true;
        if (bossState.archOn) chemiCheckArch(b);
        if (bossState.shuttersOn) return chemiCollideShutters(b);
        return false;
    },

    onHit(b, side) {
        b.bip = false;   // el BIP dura hasta el siguiente golpe de pala
        if (!bossState.archOn) return;
        if (side === 'p1') {
            // El sello se anuncia cuando la bola sale hacia Chemi
            bossState.stampWarn = (bossState.chemiHits + 1) % CHEMI.stampEvery === 0;
            return;
        }
        bossState.chemiHits++;
        if (bossState.stampWarn) {
            bossState.stampWarn = false;
            chemiStamp(b);
        } else if (Math.random() < CHEMI.aimShare) {
            chemiAimAtArch(b);
        }
    },

    renderArena(ctx) {
        const arena = CAMPAIGN_ART.chemi.arena_chemi;
        drawTintedArt(ctx, arena, currentThemeHex(), 0, 0, GAME_WIDTH, GAME_HEIGHT);
        const red = bossState.redLights || 0;
        if (red > 0) {
            // Código negro: la sala late en rojo
            const k = 0.5 + 0.5 * Math.sin(2 * Math.PI * chemiNow() / CHEMI.redPulseMs);
            ctx.save();
            ctx.globalAlpha = red * (0.05 + 0.05 * k);
            ctx.fillStyle = CHEMI.red;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            ctx.restore();
        }
        if (bossState.turnstilesOn && (bossState.sink || 0) < 0.3) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = CHEMI.green;
            ctx.fillText('PASILLO LIBRE', 650, 303);
            ctx.restore();
        }
    },

    render(ctx) {
        chemiDrawTurnstiles(ctx);
        chemiDrawArch(ctx);
        chemiDrawElevators(ctx);
    },

    renderOverlay(ctx) {
        // La bola del BIP va roja hasta el siguiente golpe
        for (const b of state.balls) {
            if (!b.bip) continue;
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = CHEMI.red;
            ctx.shadowColor = CHEMI.red;
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius + 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        chemiDrawStamp(ctx);
        // En las luces rojas, también se ven sobre el campo
        if ((bossState.redLights || 0) > 0) {
            ctx.save();
            const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * chemiNow() / CHEMI.redPulseMs);
            ctx.fillStyle = `rgba(239, 68, 68, ${0.55 * bossState.redLights * pulse})`;
            for (const x of [120, 400, 680]) {
                ctx.beginPath();
                ctx.arc(x, 6, 5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }
};
