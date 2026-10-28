/**
 * vfx/random.js
 * ------------------------------------------------------------------
 * Azar propio de los efectos visuales. Math.random es de la física: si
 * una estela o un fondo lo consumiera, cambiaría la partida. Los efectos usan vfxRandom(), un
 * generador aparte, y nunca Math.random.
 * ------------------------------------------------------------------
 */

'use strict';

let vfxSeedState = 0x2F6B1D3;

/** Reinicia el generador visual. */
function vfxSeed(n) { vfxSeedState = (n >>> 0) || 1; }

/** Número pseudoaleatorio en [0, 1) (Mulberry32). Sustituye a Math.random en los efectos. */
function vfxRandom() {
    vfxSeedState = (vfxSeedState + 0x6D2B79F5) >>> 0;
    let t = vfxSeedState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Pseudoaleatorio ESTABLE en [0, 1) a partir de un número: el mismo n da
 * siempre el mismo valor. Sirve para decorar sin que parpadee (las
 * grietas del escudo, por ejemplo) y no consume vfxRandom.
 * @param {number} n
 */
function vfxHash(n) {
    let t = (Math.imul((n | 0) ^ 0x9E3779B9, 0x85EBCA6B)) >>> 0;
    t = Math.imul(t ^ (t >>> 13), 0xC2B2AE35) >>> 0;
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

/** Segundos del reloj de los efectos (performance.now()). */
function vfxT() {
    return performance.now() / 1000;
}

// El audio tiene su propio generador, con el mismo algoritmo. Si usara
// vfxRandom, cada golpe (y el buffer de ruido, que pide 44.100 números de
// una vez) cambiaría lo que dibujan los cosméticos, y activar o desactivar
// los efectos de sonido cambiaría la imagen.
let sfxSeedState = 0x51A7E5;

/** Número pseudoaleatorio en [0, 1) para el audio (Mulberry32). Ni Math.random ni vfxRandom. */
function sfxRandom() {
    sfxSeedState = (sfxSeedState + 0x6D2B79F5) >>> 0;
    let t = sfxSeedState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
