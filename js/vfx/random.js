/**
 * vfx/random.js
 * ------------------------------------------------------------------
 * Azar propio de los efectos visuales. Math.random lo comparten la
 * física y los tests (que lo siembran): si una estela o un fondo lo
 * consumiera, cambiaría la partida. Los efectos usan vfxRandom(), un
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
