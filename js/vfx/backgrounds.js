/**
 * vfx/backgrounds.js
 * ------------------------------------------------------------------
 * Fondos animados del campo (estrellas, lluvia digital, aurora). Cada
 * fondo del catálogo (data/shop.js, categoría backgrounds) tiene aquí
 * su entrada en BG_RENDERERS.
 * ------------------------------------------------------------------
 */

import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants.js';
import { playerProgression } from '../systems/progression.js';
import { currentThemeHex } from '../systems/theme.js';

/** Fondo activo: se fija al empezar la partida o al equiparlo en la tienda. */
let currentBgId = 'none';

// Estado de cada fondo animado
let bgStars = [];
let bgRainColumns = [];
let bgAuroraWaves = [];

// --- Estrellas ---
function initStars() {
    bgStars = [];
    for (let i = 0; i < 80; i++) {
        bgStars.push({
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * GAME_HEIGHT,
            phase: Math.random() * Math.PI * 2,
            freq: 0.5 + Math.random() * 1.5,
            baseAlpha: 0.2 + Math.random() * 0.4
        });
    }
}
function renderStars(ctx) {
    const timeSec = Date.now() / 1000;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < bgStars.length; i++) {
        const star = bgStars[i];
        const alpha = star.baseAlpha + 0.2 * Math.sin(timeSec * star.freq + star.phase);
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillRect(star.x, star.y, 1.5, 1.5);
    }
    ctx.restore();
}

// --- Lluvia (Matrix) ---
function initRain() {
    bgRainColumns = [];
    const numColumns = 15;
    const colSpacing = GAME_WIDTH / numColumns;
    for (let i = 0; i < numColumns; i++) {
        bgRainColumns.push({
            x: (i * colSpacing) + Math.random() * 20,
            chars: [],
            speed: 2 + Math.random() * 3,
            nextCharTimer: 0
        });
    }
}
function updateRain(dt) {
    for (let i = 0; i < bgRainColumns.length; i++) {
        const col = bgRainColumns[i];

        // Mover caracteres existentes
        for (let j = 0; j < col.chars.length; j++) {
            col.chars[j].y += col.speed * dt;
        }

        // Eliminar caracteres fuera de la pantalla
        col.chars = col.chars.filter(c => c.y < GAME_HEIGHT + 20);

        // Añadir nuevos caracteres periódicamente
        col.nextCharTimer -= dt;
        if (col.nextCharTimer <= 0) {
            // El Y del nuevo caracter siempre es el más alto (menor valor), o desde arriba si no hay
            let topY = col.chars.length > 0 ? col.chars[col.chars.length - 1].y - 12 : -10;
            if (topY > 0 && col.chars.length === 0) topY = -10; // Resetear si la columna está vacía

            const randomHex = Math.floor(Math.random() * 16).toString(16).toUpperCase();
            col.chars.push({ char: randomHex, y: topY });
            col.nextCharTimer = 3 + Math.random() * 4; // Ajustar la densidad vertical
        }

        // Si el último caracter de la cola pasa el fondo, reiniciamos arriba para un flujo continuo
        if (col.chars.length === 0 || col.chars[0].y > GAME_HEIGHT * 1.5) {
            col.chars = [];
            col.nextCharTimer = 0;
        }
    }
}
function renderRain(ctx) {
    ctx.save();
    const themeColor = currentThemeHex();
    ctx.fillStyle = themeColor;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i < bgRainColumns.length; i++) {
        const col = bgRainColumns[i];
        for (let j = 0; j < col.chars.length; j++) {
            const charObj = col.chars[j];
            // Alpha desvanece de arriba hacia abajo de la columna en sí
            // j = 0 es el caracter más bajo (más viejo)
            const pct = j / Math.max(1, col.chars.length - 1);
            ctx.globalAlpha = 0.05 + (0.45 * pct);
            ctx.fillText(charObj.char, col.x, charObj.y);
        }
    }
    ctx.restore();
}

// --- Aurora ---
function initAurora() {
    bgAuroraWaves = [];
    const themeColor = currentThemeHex();
    for (let i = 0; i < 4; i++) {
        bgAuroraWaves.push({
            phase: Math.random() * Math.PI * 2,
            freq: 0.001 + Math.random() * 0.002,
            amplitude: 50 + Math.random() * 100,
            yBase: 100 + Math.random() * 400,
            color: themeColor
        });
    }
}
function updateAurora(dt) {
    for (let i = 0; i < bgAuroraWaves.length; i++) {
        bgAuroraWaves[i].phase += bgAuroraWaves[i].freq * dt * 10; // 10 es factor de velocidad suave
    }
}
function renderAurora(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.04;
    // Las auroras se dibujan con iteraciones a lo ancho
    for (let i = 0; i < bgAuroraWaves.length; i++) {
        const wave = bgAuroraWaves[i];
        ctx.fillStyle = wave.color;

        ctx.beginPath();
        for (let x = 0; x <= GAME_WIDTH; x += 20) {
            const y = wave.yBase + Math.sin(x * 0.005 + wave.phase) * wave.amplitude;
            // Dibujar rectángulo suave simulando parte de la onda
            ctx.fillRect(x, y, 20, 150);
        }
    }
    ctx.restore();
}

/**
 * Fondos animados, por `id` del catálogo. Son los únicos efectos con
 * estado propio: init() lo crea (y consume Math.random), update(dt) lo
 * avanza y render(ctx) lo dibuja.
 */
const BG_RENDERERS = {
    none:   { init: ()=>{}, update: ()=>{}, render: ()=>{} },
    stars:  { init: initStars,  update: () => {},   render: renderStars },  // su animación depende del reloj, no de dt
    rain:   { init: initRain,   update: updateRain,   render: renderRain },
    aurora: { init: initAurora, update: updateAurora, render: renderAurora }
};

/** Arranca el fondo equipado (al empezar cada partida). */
export function initBackground() {
    const bgId = playerProgression.selectedBg || 'none';
    currentBgId = bgId;
    if (BG_RENDERERS[bgId]) {
        BG_RENDERERS[bgId].init();
    }
}

/** Avanza el fondo activo. */
export function updateBackground(dt) {
    if (BG_RENDERERS[currentBgId]) {
        BG_RENDERERS[currentBgId].update(dt);
    }
}

/** Dibuja el fondo activo. */
export function renderBackground(ctx) {
    if (BG_RENDERERS[currentBgId]) {
        BG_RENDERERS[currentBgId].render(ctx);
    }
}

/**
 * Cambia el fondo activo (al equiparlo en la tienda). Llama a init(), que
 * consume Math.random: no se puede quitar aunque parezca redundante.
 */
export function setActiveBg(id) {
    if (BG_RENDERERS[id]) {
        currentBgId = id;
        BG_RENDERERS[id].init();
    }
}
