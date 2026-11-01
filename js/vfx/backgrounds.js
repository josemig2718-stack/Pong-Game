/**
 * vfx/backgrounds.js
 * ------------------------------------------------------------------
 * Fondos animados del campo (estrellas, lluvia digital, aurora,
 * synthwave, abismo, ciudad neón, nebulosa, bosque, murallas). Cada
 * fondo del catálogo (data/shop.js, categoría backgrounds) tiene aquí
 * su entrada en BG_RENDERERS. Se dibujan sobre el negro base y debajo
 * de la red, siempre discretos para no tapar la bola.
 * ------------------------------------------------------------------
 */

'use strict';

/** Fondo activo: se fija al empezar la partida o al equiparlo en la tienda. */
let currentBgId = 'none';

// --- Estrellas: tres capas en paralaje y destellos de 4 puntas ---
let bgStarLayers = [];
let bgSparkles = [];
const BG_STAR_LAYERS = [
    { n: 70, speed: 0.03, size: 1,   alpha: 0.35 },
    { n: 34, speed: 0.07, size: 1.5, alpha: 0.55 },
    { n: 12, speed: 0.12, size: 2,   alpha: 0.85 }
];
function initStars() {
    bgStarLayers = BG_STAR_LAYERS.map((L) => ({
        ...L,
        stars: Array.from({ length: L.n }, () => ({
            x: vfxRandom() * GAME_WIDTH, y: vfxRandom() * GAME_HEIGHT,
            phase: vfxRandom() * Math.PI * 2, freq: 0.6 + vfxRandom() * 1.6,
            gold: vfxRandom() < 0.08
        }))
    }));
    bgSparkles = [];
}
function updateStars(dt) {
    for (const L of bgStarLayers) {
        for (const s of L.stars) {
            s.x -= L.speed * dt;
            if (s.x < -2) s.x += GAME_WIDTH + 4;
        }
    }
    if (bgSparkles.length < 3 && vfxRandom() < 0.012 * dt) {
        bgSparkles.push({ x: 40 + vfxRandom() * 720, y: 30 + vfxRandom() * 540, life: 0, gold: vfxRandom() < 0.4 });
    }
    for (const sp of bgSparkles) sp.life += 0.012 * dt;
    bgSparkles = bgSparkles.filter((sp) => sp.life < 1);
}
function renderStars(ctx) {
    const t = vfxT();
    ctx.save();
    for (const L of bgStarLayers) {
        for (const s of L.stars) {
            ctx.globalAlpha = L.alpha * (0.6 + 0.4 * Math.sin(t * s.freq + s.phase));
            ctx.fillStyle = s.gold ? '#FDE68A' : '#ffffff';
            ctx.fillRect(s.x, s.y, L.size, L.size);
        }
    }
    for (const sp of bgSparkles) {
        const k = Math.sin(sp.life * Math.PI);   // aparece y se va
        ctx.globalAlpha = 0.9 * k;
        ctx.fillStyle = sp.gold ? '#FDE68A' : '#ffffff';
        vfxSparkle(ctx, sp.x, sp.y, 2 + 6 * k);
        ctx.fill();
    }
    ctx.restore();
}

// --- Lluvia digital: columnas en fuente pixelada, cabeza blanca, color del tema ---
let bgRainColumns = [];
const RAIN_GLYPHS = '0123456789ABCDEF<>=+*/';
const RAIN_COLUMNS = 26;
function newRainColumn(i, fromTop) {
    const len = 8 + Math.floor(vfxRandom() * 12);
    return {
        x: 16 + i * (GAME_WIDTH / RAIN_COLUMNS),
        head: fromTop ? -vfxRandom() * 300 : vfxRandom() * 900 - 150,
        speed: 1.8 + vfxRandom() * 3.2,
        chars: Array.from({ length: len }, () => RAIN_GLYPHS[Math.floor(vfxRandom() * RAIN_GLYPHS.length)])
    };
}
function initRain() {
    bgRainColumns = Array.from({ length: RAIN_COLUMNS }, (_, i) => newRainColumn(i, false));
}
function updateRain(dt) {
    bgRainColumns.forEach((c, i) => {
        c.head += c.speed * dt;
        if (vfxRandom() < 0.06 * dt) c.chars[Math.floor(vfxRandom() * c.chars.length)] = RAIN_GLYPHS[Math.floor(vfxRandom() * RAIN_GLYPHS.length)];
        if (c.head - c.chars.length * 14 > GAME_HEIGHT) bgRainColumns[i] = newRainColumn(i, true);
    });
}
function renderRain(ctx) {
    const color = currentThemeHex();
    ctx.save();
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (const c of bgRainColumns) {
        for (let j = 0; j < c.chars.length; j++) {
            const y = c.head - j * 14;
            if (y < -14 || y > GAME_HEIGHT + 14) continue;
            if (j === 0) {
                ctx.globalAlpha = 0.85;
                ctx.fillStyle = '#ECFDF5';
            } else {
                ctx.globalAlpha = 0.5 * (1 - j / c.chars.length);
                ctx.fillStyle = color;
            }
            ctx.fillText(c.chars[j], c.x, y);
        }
    }
    ctx.restore();
}

// --- Aurora boreal ---
let bgAuroraCurtains = [];
let bgAuroraStars = [];
/** Tiras de degradado que se estiran con drawImage; se crean una sola vez. */
let bgAuroraSprites = null;

/** Tira vertical de 1×128 px con un degradado (mucho más barata que un degradado por rayo). */
function makeAuroraSprite(stops) {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128);
    for (const [t, col] of stops) g.addColorStop(t, col);
    x.fillStyle = g;
    x.fillRect(0, 0, 1, 128);
    return c;
}

/**
 * Cielo nocturno, estrellas y dos cortinas hechas de rayos verticales. Cada
 * rayo brilla en su borde inferior (verde casi blanco) y se apaga hacia
 * arriba, con un velo violeta en lo alto. Ocupa la mitad superior: la mitad
 * baja queda oscura para la bola.
 */
function initAurora() {
    if (!bgAuroraSprites) {
        bgAuroraSprites = {
            curtain: makeAuroraSprite([
                [0, 'rgba(52, 211, 153, 0)'],
                [0.5, 'rgba(52, 211, 153, 0.12)'],
                [0.86, 'rgba(110, 231, 183, 0.5)'],
                [0.96, 'rgba(220, 252, 231, 0.9)'],
                [1, 'rgba(52, 211, 153, 0)']
            ]),
            glow: makeAuroraSprite([
                [0, 'rgba(52, 211, 153, 0.22)'],
                [0.35, 'rgba(52, 211, 153, 0.07)'],
                [1, 'rgba(52, 211, 153, 0)']
            ]),
            veil: makeAuroraSprite([
                [0, 'rgba(244, 114, 182, 0)'],
                [0.45, 'rgba(192, 132, 252, 0.14)'],
                [1, 'rgba(167, 139, 250, 0)']
            ])
        };
    }
    bgAuroraCurtains = [
        { base: 215, amp: 44, k: 0.0042, speed: 0.00022, phase: vfxRandom() * 6, height: 150, alpha: 0.95, veil: true },
        { base: 150, amp: 30, k: 0.0063, speed: 0.00033, phase: vfxRandom() * 6, height: 100, alpha: 0.45, veil: false }
    ];
    bgAuroraStars = Array.from({ length: 70 }, () => ({
        x: vfxRandom() * GAME_WIDTH, y: vfxRandom() * 420,
        a: 0.15 + vfxRandom() * 0.55, ph: vfxRandom() * 6, f: 0.5 + vfxRandom() * 1.5
    }));
}
function renderAurora(ctx) {
    const t = vfxNow();
    ctx.save();
    // Cielo nocturno que se funde con el negro del campo
    const sky = ctx.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, 'rgba(10, 18, 48, 0.95)');
    sky.addColorStop(0.55, 'rgba(7, 16, 36, 0.6)');
    sky.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, GAME_WIDTH, 440);
    // Estrellas que titilan
    ctx.fillStyle = '#ffffff';
    for (const s of bgAuroraStars) {
        ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(t / 1000 * s.f + s.ph));
        ctx.fillRect(s.x, s.y, 1.3, 1.3);
    }
    // Cortinas de rayos
    ctx.globalCompositeOperation = 'lighter';
    for (const c of bgAuroraCurtains) {
        for (let x = 0; x < GAME_WIDTH; x += 3) {
            const y = c.base + Math.sin(x * c.k + t * c.speed + c.phase) * c.amp
                + Math.sin(x * c.k * 2.7 - t * c.speed * 1.6) * c.amp * 0.3;
            const h = c.height * (0.62 + 0.38 * Math.sin(x * 0.021 + t * 0.0011 + c.phase));
            // Brillo que recorre la cortina en pliegues
            const shimmer = 0.5 + 0.5 * Math.sin(x * 0.09 + t * 0.004 + c.phase * 3) * Math.sin(x * 0.013 - t * 0.0013);
            ctx.globalAlpha = c.alpha * (0.25 + 0.75 * shimmer);
            ctx.drawImage(bgAuroraSprites.curtain, x, y - h, 3, h + 6);
            // Luz que cae por debajo del borde: evita el corte duro
            ctx.globalAlpha = c.alpha * (0.5 + 0.5 * shimmer);
            ctx.drawImage(bgAuroraSprites.glow, x, y + 4, 3, 90);
            if (c.veil) {
                ctx.globalAlpha = 0.8 * (0.3 + 0.7 * shimmer);
                ctx.drawImage(bgAuroraSprites.veil, x, y - h * 1.75, 3, h * 0.9);
            }
        }
    }
    ctx.restore();
}

/** Canvas fuera de pantalla de w×h y su contexto: los fondos pintan en init() lo que no cambia y en cada fotograma solo lo copian. */
/** @returns {[HTMLCanvasElement, CanvasRenderingContext2D]} */
function vfxOffscreen(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
}

// --- Synthwave: sol retro, montañas y cuadrícula en perspectiva ---
let bgSynth = null;
const SYNTH_HORIZON = 360;
function initSynthwave() {
    const [c, x] = vfxOffscreen(GAME_WIDTH, GAME_HEIGHT);
    // Cielo
    const sky = x.createLinearGradient(0, 0, 0, SYNTH_HORIZON);
    sky.addColorStop(0, '#05010F'); sky.addColorStop(0.6, '#1A0630'); sky.addColorStop(1, '#3B0A45');
    x.fillStyle = sky; x.fillRect(0, 0, GAME_WIDTH, SYNTH_HORIZON);
    // Estrellas
    for (let i = 0; i < 70; i++) {
        x.globalAlpha = 0.2 + vfxRandom() * 0.5;
        x.fillStyle = '#ffffff';
        x.fillRect(vfxRandom() * GAME_WIDTH, vfxRandom() * (SYNTH_HORIZON - 120), 1.2, 1.2);
    }
    x.globalAlpha = 1;
    // Sol con franjas
    const sun = x.createLinearGradient(0, 170, 0, SYNTH_HORIZON);
    sun.addColorStop(0, '#FDE047'); sun.addColorStop(0.55, '#FB7185'); sun.addColorStop(1, '#C026D3');
    x.save();
    x.beginPath(); x.arc(400, SYNTH_HORIZON - 10, 120, Math.PI, 0); x.closePath(); x.clip();
    x.fillStyle = sun; x.fillRect(260, 170, 280, 200);
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 7; i++) {
        const yy = SYNTH_HORIZON - 70 + i * 9, hh = 1.5 + i * 0.9;
        x.fillRect(260, yy, 280, hh);
    }
    x.restore();
    // Montañas
    x.fillStyle = '#12051F';
    x.beginPath(); x.moveTo(0, SYNTH_HORIZON);
    const peaks = [[0, 300], [90, 268], [170, 318], [250, 280], [330, 330], [470, 330], [540, 286], [620, 322], [700, 262], [GAME_WIDTH, 304]];
    for (const [px, py] of peaks) x.lineTo(px, py);
    x.lineTo(GAME_WIDTH, SYNTH_HORIZON); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(232, 121, 249, 0.55)'; x.lineWidth = 1.2;
    x.beginPath(); peaks.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke();
    // Suelo
    const fl = x.createLinearGradient(0, SYNTH_HORIZON, 0, GAME_HEIGHT);
    fl.addColorStop(0, '#1B0629'); fl.addColorStop(1, '#05010A');
    x.fillStyle = fl; x.fillRect(0, SYNTH_HORIZON, GAME_WIDTH, GAME_HEIGHT - SYNTH_HORIZON);
    bgSynth = { sky: c, off: 0 };
}
function updateSynthwave(dt) { if (bgSynth) bgSynth.off = (bgSynth.off + 0.012 * dt) % 1; }
function renderSynthwave(ctx, color) {
    if (!bgSynth) return;
    ctx.save();
    ctx.globalAlpha = 0.5;                           // discreto: no compite con la bola
    ctx.drawImage(bgSynth.sky, 0, 0);
    // Cuadrícula: líneas hacia el punto de fuga + horizontales que se acercan
    ctx.strokeStyle = '#E879F9'; ctx.lineWidth = 1;
    ctx.shadowColor = '#E879F9'; ctx.shadowBlur = 6;
    ctx.globalAlpha = 0.38;
    for (let i = -14; i <= 14; i++) {
        ctx.beginPath(); ctx.moveTo(400 + i * 14, SYNTH_HORIZON); ctx.lineTo(400 + i * 130, GAME_HEIGHT); ctx.stroke();
    }
    for (let j = 0; j < 12; j++) {
        const z = (j + bgSynth.off) / 12;            // 0 horizonte → 1 primer plano
        const yy = SYNTH_HORIZON + Math.pow(z, 2.2) * (GAME_HEIGHT - SYNTH_HORIZON);
        ctx.globalAlpha = 0.12 + 0.4 * z;
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(GAME_WIDTH, yy); ctx.stroke();
    }
    ctx.restore();
}

// --- Abismo: rayos de luz, burbujas y medusas tenues ---
let bgAbyss = null;
function initAbyss() {
    bgAbyss = {
        bubbles: Array.from({ length: 34 }, () => ({ x: vfxRandom() * GAME_WIDTH, y: vfxRandom() * GAME_HEIGHT, r: 1 + vfxRandom() * 3.5, sp: 0.25 + vfxRandom() * 0.7, ph: vfxRandom() * 6 })),
        jellies: [0, 1, 2].map((i) => ({ x: 120 + i * 280 + vfxRandom() * 60, y: 140 + vfxRandom() * 320, s: 18 + vfxRandom() * 14, ph: vfxRandom() * 6, c: ['#F0ABFC', '#67E8F9', '#A5B4FC'][i] })),
        motes: Array.from({ length: 60 }, () => ({ x: vfxRandom() * GAME_WIDTH, y: vfxRandom() * GAME_HEIGHT, a: 0.1 + vfxRandom() * 0.25 }))
    };
}
function updateAbyss(dt) {
    if (!bgAbyss) return;
    for (const b of bgAbyss.bubbles) { b.y -= b.sp * dt; if (b.y < -8) { b.y = 608; b.x = vfxRandom() * GAME_WIDTH; } }
    for (const j of bgAbyss.jellies) { j.y -= 0.12 * dt; if (j.y < -60) j.y = 660; }
}
function renderAbyss(ctx, color) {
    if (!bgAbyss) return;
    const t = vfxT();
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    g.addColorStop(0, '#062a3f'); g.addColorStop(0.5, '#03141f'); g.addColorStop(1, '#010509');
    ctx.fillStyle = g; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Rayos de luz desde la superficie
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
        const x0 = 80 + i * 170 + Math.sin(t * 0.3 + i) * 30;
        const rg = ctx.createLinearGradient(0, 0, 0, 420);
        rg.addColorStop(0, 'rgba(125, 211, 252, 0.10)'); rg.addColorStop(1, 'rgba(125, 211, 252, 0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.moveTo(x0 - 18, 0); ctx.lineTo(x0 + 22, 0); ctx.lineTo(x0 + 90, 420); ctx.lineTo(x0 + 10, 420); ctx.closePath(); ctx.fill();
    }
    // Medusas
    for (const j of bgAbyss.jellies) {
        const pulse = 1 + 0.12 * Math.sin(t * 2 + j.ph);
        ctx.save();
        ctx.translate(j.x + Math.sin(t * 0.4 + j.ph) * 14, j.y);
        ctx.globalAlpha = 0.28;
        const jg = ctx.createRadialGradient(0, 0, 0, 0, 0, j.s * pulse);
        jg.addColorStop(0, hexToRgba(j.c, 0.8)); jg.addColorStop(1, hexToRgba(j.c, 0.05));
        ctx.fillStyle = jg;
        ctx.beginPath(); ctx.ellipse(0, 0, j.s * pulse, j.s * 0.75 / pulse, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = hexToRgba(j.c, 0.6); ctx.lineWidth = 1.2;
        for (let k = -2; k <= 2; k++) {
            ctx.beginPath(); ctx.moveTo(k * j.s * 0.3, 0);
            for (let s = 1; s <= 6; s++) ctx.lineTo(k * j.s * 0.3 + Math.sin(t * 2.4 + s * 0.8 + k + j.ph) * 4, s * j.s * 0.3);
            ctx.stroke();
        }
        ctx.restore();
    }
    // Burbujas
    for (const b of bgAbyss.bubbles) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#BAE6FD'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(b.x + Math.sin(t * 2 + b.ph) * 3, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const m of bgAbyss.motes) { ctx.globalAlpha = m.a; ctx.fillStyle = '#7DD3FC'; ctx.fillRect(m.x, m.y + Math.sin(t + m.x) * 2, 1, 1); }
    ctx.restore();
}

// --- Ciudad neón: siluetas con ventanas, letreros y lluvia ---
let bgCity = null;
function cityLayer(seedBase, baseY, minH, maxH, col, winA, signs) {
    const [c, x] = vfxOffscreen(GAME_WIDTH, GAME_HEIGHT);
    let px = -10;
    while (px < 810) {
        const w = 40 + vfxRandom() * 70, h = minH + vfxRandom() * (maxH - minH);
        x.fillStyle = col;
        x.fillRect(px, baseY - h, w, h + 10);
        if (vfxRandom() < 0.3) x.fillRect(px + w / 2 - 2, baseY - h - 18, 3, 18);   // antena
        for (let wy = baseY - h + 8; wy < baseY - 6; wy += 9) {
            for (let wx = px + 5; wx < px + w - 6; wx += 8) {
                if (vfxRandom() < winA) {
                    x.fillStyle = vfxRandom() < 0.8 ? 'rgba(253, 230, 138, 0.55)' : 'rgba(103, 232, 249, 0.55)';
                    x.fillRect(wx, wy, 3, 4);
                }
            }
        }
        if (signs && vfxRandom() < 0.35) {
            const sc = ['#F472B6', '#22D3EE', '#A78BFA', '#FB923C'][Math.floor(vfxRandom() * 4)];
            x.save(); x.shadowColor = sc; x.shadowBlur = 10; x.fillStyle = sc;
            x.fillRect(px + 6, baseY - h + 10 + vfxRandom() * 30, 4, 26 + vfxRandom() * 20);
            x.restore();
        }
        px += w + 2 + vfxRandom() * 10;
    }
    return c;
}
function initCity() {
    bgCity = {
        far: cityLayer(1, 470, 90, 220, '#0B1024', 0.18, false),
        near: cityLayer(2, GAME_HEIGHT, 70, 190, '#05070F', 0.22, true),
        drops: Array.from({ length: 90 }, () => ({ x: vfxRandom() * 860, y: vfxRandom() * GAME_HEIGHT, l: 8 + vfxRandom() * 10, sp: 7 + vfxRandom() * 5 }))
    };
}
function updateCity(dt) {
    if (!bgCity) return;
    for (const d of bgCity.drops) { d.y += d.sp * dt; d.x -= d.sp * 0.25 * dt; if (d.y > 610) { d.y = -20; d.x = vfxRandom() * 860; } }
}
function renderCity(ctx, color) {
    if (!bgCity) return;
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    g.addColorStop(0, '#04030C'); g.addColorStop(0.7, '#160A2A'); g.addColorStop(1, '#2A0F35');
    ctx.fillStyle = g; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.globalAlpha = 0.75; ctx.drawImage(bgCity.far, 0, 0);
    ctx.globalAlpha = 0.9; ctx.drawImage(bgCity.near, 0, 0);
    ctx.globalAlpha = 0.22; ctx.strokeStyle = '#A5B4FC'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of bgCity.drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * 0.25, d.y + d.l); }
    ctx.stroke();
    ctx.restore();
}

// --- Nebulosa: gas de colores que deriva despacio y estrellas ---
let bgNebula = null;
function nebulaSprite(palette, n) {
    const [c, x] = vfxOffscreen(1000, 800);
    x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
        const cx = 500 + (vfxRandom() - 0.5) * 900, cy = 400 + (vfxRandom() - 0.5) * 520 * (0.6 + vfxRandom() * 0.4);
        const r = 60 + vfxRandom() * 190;
        const col = palette[Math.floor(vfxRandom() * palette.length)];
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, hexToRgba(col, 0.10 + vfxRandom() * 0.08)); g.addColorStop(1, hexToRgba(col, 0));
        x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    return c;
}
function initNebula() {
    bgNebula = {
        a: nebulaSprite(['#7C3AED', '#C026D3', '#2563EB'], 46),
        b: nebulaSprite(['#14B8A6', '#F472B6', '#6366F1'], 30),
        stars: Array.from({ length: 140 }, () => ({ x: vfxRandom() * GAME_WIDTH, y: vfxRandom() * GAME_HEIGHT, s: vfxRandom() < 0.1 ? 2 : 1, ph: vfxRandom() * 6, f: 0.5 + vfxRandom() * 2 }))
    };
}
function renderNebula(ctx, color) {
    if (!bgNebula) return;
    const t = vfxT();
    ctx.save();
    ctx.fillStyle = '#03020A'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6;
    ctx.drawImage(bgNebula.a, -100 + Math.sin(t * 0.05) * 40, -100 + Math.cos(t * 0.04) * 25);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(bgNebula.b, -100 + Math.cos(t * 0.03) * 60, -100 + Math.sin(t * 0.035) * 35);
    ctx.globalCompositeOperation = 'source-over';
    for (const s of bgNebula.stars) {
        ctx.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * s.f + s.ph));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.restore();
}

// --- Bosque nocturno: luna, pinos y luciérnagas que se apartan de la bola ---
let bgForest = null;
function pineRow(x, baseY, count, minH, maxH, col) {
    for (let i = 0; i < count; i++) {
        const px = vfxRandom() * 840 - 20, h = minH + vfxRandom() * (maxH - minH), w = h * 0.42;
        x.fillStyle = col;
        for (let k = 0; k < 4; k++) {
            const ty = baseY - h + k * h * 0.2;
            x.beginPath(); x.moveTo(px, ty); x.lineTo(px + w * (0.45 + k * 0.18), ty + h * 0.38); x.lineTo(px - w * (0.45 + k * 0.18), ty + h * 0.38); x.closePath(); x.fill();
        }
        x.fillRect(px - 2, baseY - h * 0.1, 4, h * 0.12);
    }
}
function initForest() {
    const [c, x] = vfxOffscreen(GAME_WIDTH, GAME_HEIGHT);
    const g = x.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    g.addColorStop(0, '#020617'); g.addColorStop(0.65, '#06141A'); g.addColorStop(1, '#030A08');
    x.fillStyle = g; x.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Luna
    const mg = x.createRadialGradient(640, 92, 0, 640, 92, 120);
    mg.addColorStop(0, 'rgba(226, 232, 240, 0.22)'); mg.addColorStop(1, 'rgba(226, 232, 240, 0)');
    x.fillStyle = mg; x.fillRect(520, 0, 240, 220);
    x.fillStyle = '#E2E8F0'; x.globalAlpha = 0.75;
    x.beginPath(); x.arc(640, 92, 26, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1; x.fillStyle = '#06141A';
    x.beginPath(); x.arc(652, 84, 24, 0, Math.PI * 2); x.fill();
    // Pinos en tres capas, solo abajo y en los lados
    pineRow(x, GAME_HEIGHT, 18, 120, 210, '#0A1F1E');
    pineRow(x, 610, 14, 90, 170, '#061413');
    x.fillStyle = '#030A08'; x.fillRect(0, 580, GAME_WIDTH, 20);
    bgForest = {
        bg: c,
        flies: Array.from({ length: 26 }, () => ({ x: vfxRandom() * GAME_WIDTH, y: 180 + vfxRandom() * 400, vx: 0, vy: 0, ph: vfxRandom() * 6 }))
    };
}
function updateForest(dt, ball) {
    if (!bgForest) return;
    const t = vfxT();
    for (const f of bgForest.flies) {
        f.vx += Math.cos(t * 0.7 + f.ph * 3) * 0.02 * dt;
        f.vy += Math.sin(t * 0.9 + f.ph * 2) * 0.02 * dt;
        if (ball) {                                   // se apartan de la bola
            const dx = f.x - ball.x, dy = f.y - ball.y, d2 = dx * dx + dy * dy;
            if (d2 < 90 * 90 && d2 > 1) { const d = Math.sqrt(d2), k = (90 - d) / 90 * 0.6; f.vx += dx / d * k * dt; f.vy += dy / d * k * dt; }
        }
        f.vx *= Math.pow(0.95, dt); f.vy *= Math.pow(0.95, dt);
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.x < -10) f.x = 810; if (f.x > 810) f.x = -10;
        f.y = Math.max(120, Math.min(590, f.y));
    }
}
function renderForest(ctx, color) {
    if (!bgForest) return;
    const t = vfxT();
    ctx.save();
    ctx.drawImage(bgForest.bg, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const f of bgForest.flies) {
        const a = 0.25 + 0.75 * Math.max(0, Math.sin(t * 1.6 + f.ph * 4));
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 10);
        g.addColorStop(0, `rgba(217, 249, 157, ${0.75 * a})`); g.addColorStop(1, 'rgba(163, 230, 53, 0)');
        ctx.fillStyle = g; ctx.fillRect(f.x - 10, f.y - 10, 20, 20);
        ctx.fillStyle = `rgba(254, 249, 195, ${a})`; ctx.fillRect(f.x - 1, f.y - 1, 2, 2);
    }
    ctx.restore();
}

// --- Murallas Hachepe: la arena de la campaña (exclusivo) ---
let bgWalls = null;
function initWalls() {
    const [c, x] = vfxOffscreen(GAME_WIDTH, GAME_HEIGHT);
    const g = x.createRadialGradient(400, 300, 60, 400, 300, 520);
    g.addColorStop(0, '#1A0E0E'); g.addColorStop(1, '#070404');
    x.fillStyle = g; x.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Muro de piedra arriba y abajo (donde rebota la bola)
    const band = (y0, h) => {
        x.fillStyle = '#2A1F1D'; x.fillRect(0, y0, GAME_WIDTH, h);
        for (let row = 0; row < h / 12; row++) {
            const off = row % 2 ? 0 : 18;
            for (let bx = -36 + off; bx < GAME_WIDTH; bx += 36) {
                const shade = 0.75 + vfxRandom() * 0.35;
                x.fillStyle = `rgb(${Math.round(68 * shade)}, ${Math.round(52 * shade)}, ${Math.round(48 * shade)})`;
                x.fillRect(bx + 1, y0 + row * 12 + 1, 34, 10);
                x.fillStyle = 'rgba(255, 255, 255, 0.07)'; x.fillRect(bx + 1, y0 + row * 12 + 1, 34, 2);
            }
        }
    };
    band(0, 24); band(576, 24);
    // Almenas
    x.fillStyle = '#3A2B27';
    for (let bx = 0; bx < GAME_WIDTH; bx += 40) { x.fillRect(bx + 4, 24, 20, 6); x.fillRect(bx + 4, 570, 20, 6); }
    // Estandartes rojos de los Hachepe, tenues
    for (const bx of [140, 660]) {
        x.fillStyle = 'rgba(127, 29, 29, 0.55)';
        x.beginPath(); x.moveTo(bx - 22, 30); x.lineTo(bx + 22, 30); x.lineTo(bx + 22, 110); x.lineTo(bx, 96); x.lineTo(bx - 22, 110); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(239, 68, 68, 0.45)'; x.lineWidth = 2;
        x.beginPath(); x.moveTo(bx - 9, 52); x.lineTo(bx - 9, 78); x.moveTo(bx + 9, 52); x.lineTo(bx + 9, 78); x.moveTo(bx - 9, 65); x.lineTo(bx + 9, 65); x.stroke(); // la H
    }
    bgWalls = { bg: c, torches: [[60, 30], [400, 30], [740, 30], [60, 570], [400, 570], [740, 570]] };
}
function renderWalls(ctx, color) {
    if (!bgWalls) return;
    const t = vfxT();
    ctx.save();
    ctx.drawImage(bgWalls.bg, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    bgWalls.torches.forEach(([tx, ty], i) => {
        const fl = 0.75 + 0.25 * Math.sin(t * 13 + i * 2) * Math.sin(t * 7 + i);
        const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, 90 * fl);
        g.addColorStop(0, `rgba(251, 146, 60, ${0.22 * fl})`); g.addColorStop(1, 'rgba(251, 146, 60, 0)');
        ctx.fillStyle = g; ctx.fillRect(tx - 90, ty - 90, 180, 180);
        const dir = ty < 300 ? 1 : -1;               // la llama apunta hacia el campo
        ctx.fillStyle = `rgba(253, 224, 71, ${0.9 * fl})`;
        ctx.beginPath(); ctx.ellipse(tx, ty + dir * 4, 3.5, 7 * fl, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(249, 115, 22, ${0.7 * fl})`;
        ctx.beginPath(); ctx.ellipse(tx, ty + dir * 7, 5, 9 * fl, 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
}

/**
 * Fondos animados, por `id` del catálogo. Son los únicos efectos con
 * estado propio: init() lo crea (con vfxRandom; también los lienzos fuera
 * de pantalla), update(dt, ball) lo avanza (`ball` es la primera bola o
 * null: solo la usa el bosque) y render(ctx, color) lo dibuja con el
 * color del tema. Coordenadas lógicas del campo (GAME_WIDTH × GAME_HEIGHT).
 * @type {Record<string, {init: () => void, update: (dt: number, ball: Ball | null) => void, render: (ctx: CanvasRenderingContext2D, color: string) => void}>}
 */
const BG_RENDERERS = {
    none:          { init: () => {},      update: () => {},        render: () => {} },
    stars:         { init: initStars,     update: updateStars,     render: renderStars },
    rain:          { init: initRain,      update: updateRain,      render: renderRain },
    aurora:        { init: initAurora,    update: () => {},        render: renderAurora },   // la anima el reloj
    synthwave:     { init: initSynthwave, update: updateSynthwave, render: renderSynthwave },
    abyss:         { init: initAbyss,     update: updateAbyss,     render: renderAbyss },
    neon_city:     { init: initCity,      update: updateCity,      render: renderCity },
    nebula:        { init: initNebula,    update: () => {},        render: renderNebula },   // la anima el reloj
    forest:        { init: initForest,    update: updateForest,    render: renderForest },
    hachepe_walls: { init: initWalls,     update: () => {},        render: renderWalls }     // la anima el reloj
};

/** Arranca el fondo equipado (al empezar cada partida). */
function initBackground() {
    const bgId = equippedId('backgrounds') || 'none';
    currentBgId = bgId;
    if (BG_RENDERERS[bgId]) {
        BG_RENDERERS[bgId].init();
    }
}

/** Avanza el fondo activo (con la primera bola, de la que huyen las luciérnagas del bosque). */
function updateBackground(dt) {
    if (BG_RENDERERS[currentBgId]) {
        BG_RENDERERS[currentBgId].update(dt, state.balls[0] || null);
    }
}

/** Dibuja el fondo activo. */
function renderBackground(ctx) {
    if (BG_RENDERERS[currentBgId]) {
        BG_RENDERERS[currentBgId].render(ctx, currentThemeHex());
    }
}

/**
 * Vuelve a crear el fondo activo, con sus lienzos fuera de pantalla: lo
 * llama resizeCanvas() durante la partida.
 */
function refreshBackground() {
    if (BG_RENDERERS[currentBgId]) BG_RENDERERS[currentBgId].init();
}

/**
 * Cambia el fondo activo (al equiparlo en la tienda) y lo reinicia. init()
 * usa vfxRandom, no Math.random, así que no altera la partida.
 */
function setActiveBg(id) {
    if (BG_RENDERERS[id]) {
        currentBgId = id;
        BG_RENDERERS[id].init();
    }
}
