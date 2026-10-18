/**
 * vfx/backgrounds.js
 * ------------------------------------------------------------------
 * Fondos animados del campo (estrellas, lluvia digital, aurora). Cada
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
    const t = performance.now() / 1000;
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
    const t = performance.now();
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

/**
 * Fondos animados, por `id` del catálogo. Son los únicos efectos con
 * estado propio: init() lo crea (con vfxRandom), update(dt) lo avanza y
 * render(ctx) lo dibuja leyendo el color del tema.
 */
const BG_RENDERERS = {
    none:   { init: () => {}, update: () => {}, render: () => {} },
    stars:  { init: initStars,  update: updateStars, render: renderStars },
    rain:   { init: initRain,   update: updateRain,  render: renderRain },
    aurora: { init: initAurora, update: () => {},    render: renderAurora }   // la anima el reloj
};

/** Arranca el fondo equipado (al empezar cada partida). */
function initBackground() {
    const bgId = equippedId('backgrounds') || 'none';
    currentBgId = bgId;
    if (BG_RENDERERS[bgId]) {
        BG_RENDERERS[bgId].init();
    }
}

/** Avanza el fondo activo. */
function updateBackground(dt) {
    if (BG_RENDERERS[currentBgId]) {
        BG_RENDERERS[currentBgId].update(dt);
    }
}

/** Dibuja el fondo activo. */
function renderBackground(ctx) {
    if (BG_RENDERERS[currentBgId]) {
        BG_RENDERERS[currentBgId].render(ctx);
    }
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
