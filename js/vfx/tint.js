/**
 * vfx/tint.js
 * ------------------------------------------------------------------
 * Imágenes del arte de la campaña y su tinte con el color del tema.
 * Lo comparten el prólogo (cutscene/player.js), la Torre Hachepe
 * (campaign/menu.js) y la arena de Chemi (bosses/chemi.js).
 *
 * Las capas `theme` son máscaras blancas con alfa: se pintan de un
 * color en un canvas auxiliar (fillRect + 'destination-in' con la
 * máscara) y se suman con 'lighter' sobre la imagen base.
 *
 * Imágenes con new Image(), nunca fetch, y nunca getImageData ni nada
 * que lea píxeles: con file:// el canvas queda «contaminado» y daría
 * error.
 * ------------------------------------------------------------------
 */

'use strict';

/** @type {Map<string, { img: HTMLImageElement, ok: boolean, promise: Promise<boolean> }>} */
const artImages = new Map();
/** @type {Map<string, HTMLCanvasElement>} Máscaras teñidas, por "src|color". */
const artTints = new Map();
/** Color del tema con el que se tiñó la caché. */
let artTintTheme = null;

/**
 * Carga una imagen una sola vez. La promesa siempre se cumple: si la
 * imagen falla, avisa en consola y quien la use sigue sin ella.
 * @param {string} src
 * @returns {Promise<boolean>}
 */
function artLoad(src) {
    let entry = artImages.get(src);
    if (!entry) {
        const img = new Image();
        const e = { img, ok: false, promise: null };
        e.promise = new Promise((resolve) => {
            img.onload = () => { e.ok = true; resolve(true); };
            img.onerror = () => {
                console.warn('Arte: no se pudo cargar', src);
                resolve(false);
            };
        });
        img.src = src;
        artImages.set(src, e);
        entry = e;
    }
    return entry.promise;
}

/**
 * La imagen si ya cargó (si no, pide cargarla y devuelve null).
 * @param {string} src
 * @returns {HTMLImageElement|null}
 */
function artImage(src) {
    const entry = artImages.get(src);
    if (!entry) {
        artLoad(src);
        return null;
    }
    return entry.ok ? entry.img : null;
}

/**
 * La imagen pintada de un color, conservando su forma: canvas auxiliar,
 * fillRect del color y 'destination-in' con la imagen. En caché por
 * imagen y color; la caché se vacía al cambiar el tema.
 * @param {string} src
 * @param {string} color
 * @returns {HTMLCanvasElement|null}
 */
function tintedMask(src, color) {
    const theme = currentThemeHex();
    if (theme !== artTintTheme) {
        artTints.clear();
        artTintTheme = theme;
    }
    const key = src + '|' + color;
    const hit = artTints.get(key);
    if (hit) return hit;
    const img = artImage(src);
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(img, 0, 0);
    artTints.set(key, c);
    return c;
}

/** Vacía las máscaras teñidas (al terminar una escena). */
function tintCacheClear() {
    artTints.clear();
}

/**
 * Dibuja una imagen del arte y, si tiene, su máscara teñida encima con
 * 'lighter'.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ src: string, theme: string|null }} info
 * @param {string|null} color color de la máscara (null = sin máscara)
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @returns {boolean} false si la imagen aún no ha cargado
 */
function drawTintedArt(ctx, info, color, x, y, w, h) {
    const img = artImage(info.src);
    if (!img) return false;
    ctx.drawImage(img, x, y, w, h);
    const mask = color && info.theme ? tintedMask(info.theme, color) : null;
    if (mask) {
        const op = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(mask, x, y, w, h);
        ctx.globalCompositeOperation = op;
    }
    return true;
}
