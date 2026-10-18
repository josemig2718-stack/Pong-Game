/**
 * ui/progress-ui.js
 * ------------------------------------------------------------------
 * Emblema de rango (SVG generado) para el menú principal, el fin de
 * partida y el aviso de subir de nivel.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Emblema de un rango: el escudo, con galones según el rango, una
 * estrella o una corona en los altos y los puntos del subnivel.
 * @param {number} rankIdx 0–9
 * @param {number} sub subnivel 1–5 (0 = sin puntos)
 * @param {number} [size]
 * @param {boolean} [unlocked] false = al 35 %
 */
function rankEmblemSVG(rankIdx, sub, size = 56, unlocked = true) {
    const c = RANKS[rankIdx].color;
    const op = unlocked ? '' : ' opacity=".35"';
    const n = rankIdx < 9 ? (rankIdx % 3) + 1 : 3;
    let chev = '';
    for (let k = 0; k < n; k++) chev += `<path d="M19 ${30 - k * 7}l9 6 9-6" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="square"/>`;
    let top = '';
    if (rankIdx >= 3 && rankIdx < 6) top = `<path d="M28 9l2 4 4 .5-3 3 1 4-4-2-4 2 1-4-3-3 4-.5z" fill="${c}"/>`;
    if (rankIdx >= 6 && rankIdx < 9) top = `<path d="M22 9l3 3 3-4 3 4 3-3v5H22z" fill="${c}"/>`;
    if (rankIdx === 9) top = `<path d="M20 8l4 4 4-5 4 5 4-4v6H20z" fill="${c}"/>`;
    let pips = '';
    if (sub) for (let k = 0; k < 5; k++) pips += `<rect x="${(15 + k * 5.6).toFixed(1)}" y="44" width="4" height="4" fill="${k < sub ? c : 'rgba(255,255,255,.18)'}"/>`;
    return `<svg viewBox="0 0 56 56" width="${size}" height="${size}" aria-hidden="true"${op}>` +
        `<path d="M28 3l21 7v15c0 14-9 23-21 28C16 48 7 39 7 25V10z" fill="color-mix(in srgb, ${c} 14%, #0B0E15)" stroke="${c}" stroke-width="2.5"/>` +
        `${top}<g transform="translate(0 4)">${chev}</g>${pips}</svg>`;
}

