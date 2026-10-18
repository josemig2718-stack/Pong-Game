/**
 * ui/progress-ui.js
 * ------------------------------------------------------------------
 * Pantalla de Progreso (#progress-menu): rango, los 10 rangos, camino
 * de recompensas, misiones y prestigio. También el emblema de rango
 * (SVG generado) del menú principal, el fin de partida y el aviso de
 * subir de nivel.
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

/** Moneda pequeña de las recompensas. */
const PROGRESS_COIN = '<img src="assets/chemi_coin.png" alt="">';
const PROGRESS_CHECK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
const PROGRESS_CHEST = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8c-2-4-6-4-6-1s4 1 6 1zM12 8c2-4 6-4 6-1s-4 1-6 1z"/></svg>';
const PROGRESS_STAR = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z"/></svg>';

/** Color de la misión semanal. */
const WEEKLY_COLOR = '#C084FC';

/** Intervalo de la cuenta atrás de las diarias (solo con la pantalla abierta). */
let progressTimer = null;

/** Rellena la pantalla de Progreso (al entrar, desde showScreen). */
function renderProgressScreen() {
    refreshMissions();
    const lvl = getCurrentLevel();
    const prog = getXPProgress();
    const p = playerProgression;
    const color = RANKS[lvl.rank].color;

    setMenuText('progress-coins', String(p.coins));

    // Tarjeta de rango
    const card = document.getElementById('progress-rank');
    card.style.setProperty('--rank', color);
    document.getElementById('progress-rank-emblem').innerHTML = rankEmblemSVG(lvl.rank, lvl.sub);
    setMenuText('progress-rank-title', lvl.title.toUpperCase());
    document.getElementById('progress-stars').innerHTML = PROGRESS_STAR.repeat(p.prestige);
    document.getElementById('progress-xp-bar').style.width = `${prog.percentage}%`;
    setMenuText('progress-level', lvl.level >= MAX_LEVEL && p.prestige ? `Nivel ${lvl.level} · ${p.prestige} ★` : `Nivel ${lvl.level}`);
    setMenuText('progress-xp', `${prog.current} / ${prog.required} XP`);

    // Los 10 rangos
    document.getElementById('progress-ranks').innerHTML = RANKS.map((r, i) => {
        const reached = i <= lvl.rank;
        return `<div class="prog-ranks__item${reached ? '' : ' is-locked'}" style="--rank: ${r.color};">`
            + `${rankEmblemSVG(i, 0, 40, reached)}<span>${r.name}</span></div>`;
    }).join('');

    // Prestigio (escritorio): las estrellas conseguidas y la siguiente
    const stars = Math.max(3, p.prestige + 1);
    document.getElementById('progress-prestige-stars').innerHTML = Array.from({ length: stars },
        (_, i) => PROGRESS_STAR.replace('class="ico"', `class="ico${i < p.prestige ? '' : ' is-empty'}"`)).join('');

    renderRewardPath(lvl.level);
    renderMissionCards();
    tickProgressTimer();
    if (!progressTimer) progressTimer = setInterval(tickProgressTimer, 1000);
}

/**
 * Texto e icono de la recompensa de un nivel (camino de recompensas y
 * fin de partida).
 * @param {number} n
 * @returns {{icon: string, label: string}}
 */
function levelRewardView(n) {
    const r = levelReward(n);
    if (r.rank !== null) return { icon: rankEmblemSVG(r.rank, 0, 40), label: `Rango ${RANKS[r.rank].name} · ${r.coins} monedas` };
    if (r.chest) return { icon: PROGRESS_CHEST, label: `Cofre · ${r.coins}` };
    return { icon: PROGRESS_COIN, label: `${r.coins} monedas` };
}

/**
 * Camino de recompensas: del nivel actual −2 al actual +3, dentro de
 * 2–50. Cobrado, actual (el siguiente por alcanzar) o futuro.
 * @param {number} level
 */
function renderRewardPath(level) {
    const first = Math.max(2, Math.min(level - 2, MAX_LEVEL - 5));
    const nodes = [];
    for (let n = first; n <= first + 5; n++) {
        const status = n <= playerProgression.rewardedLevel ? 'done' : (n === level + 1 ? 'next' : 'todo');
        const view = levelRewardView(n);
        const chest = levelReward(n).chest && status !== 'done' ? ' prog-node--chest' : '';
        nodes.push(`<div class="prog-node prog-node--${status}${chest}">`
            + `<span class="px prog-node__lvl">NV ${n}</span>`
            + `<span class="prog-node__dot">${view.icon}${status === 'done' ? `<span class="prog-node__check">${PROGRESS_CHECK}</span>` : ''}</span>`
            + `<small>${view.label}</small></div>`);
    }
    const path = document.getElementById('progress-path');
    path.innerHTML = nodes.join('<span class="prog-path__link" aria-hidden="true"></span>');
    // Los tramos entre nodos cobrados van del color del tema
    path.querySelectorAll('.prog-path__link').forEach((link, i) => {
        link.classList.toggle('is-done', first + i + 1 <= playerProgression.rewardedLevel);
    });
}

/**
 * Tarjeta de una misión: texto, progreso o HECHA, barra y recompensa.
 * @param {{id: string, progress: number, done: boolean}} entry
 * @param {string} color
 */
function missionCardHTML(entry, color) {
    const def = missionDef(entry.id);
    const pct = Math.round(entry.progress / def.goal * 100);
    const state = entry.done
        ? `<span class="px prog-mission__done">${PROGRESS_CHECK}HECHA</span>`
        : `<span class="prog-mission__count">${entry.progress} / ${def.goal}</span>`;
    const coins = def.coins ? `<span class="px prog-mission__coins">${PROGRESS_COIN}${def.coins}</span>` : '';
    return `<div class="prog-mission${entry.done ? ' is-done' : ''}" style="--mc: ${color};">`
        + `<div class="prog-mission__head"><b>${def.text}</b>${state}</div>`
        + `<div class="prog-bar"><i style="width: ${pct}%;"></i></div>`
        + `<div class="prog-mission__rew"><span class="px prog-mission__xp">+${def.xp} XP</span>${coins}</div></div>`;
}

/** Las 3 diarias y la semanal. */
function renderMissionCards() {
    const m = playerProgression.missions;
    document.getElementById('progress-daily').innerHTML = m.daily.map(e => missionCardHTML(e, 'var(--primary)')).join('');
    document.getElementById('progress-weekly').innerHTML = m.weekly ? missionCardHTML(m.weekly, WEEKLY_COLOR) : '';
}

/**
 * Cuenta atrás hasta la medianoche local y días que le quedan a la
 * semanal. Se para sola al salir de la pantalla; si cambia el día con
 * la pantalla abierta, se vuelve a pintar con las misiones nuevas.
 */
function tickProgressTimer() {
    if (!document.getElementById('progress-menu').classList.contains('active-screen')) {
        clearInterval(progressTimer);
        progressTimer = null;
        return;
    }
    const now = new Date();
    if (playerProgression.missions && missionDayKey(now) !== playerProgression.missions.day) {
        renderProgressScreen();
        return;
    }
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const secs = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
    setMenuText('progress-daily-timer', `${missionPad(Math.floor(secs / 3600))}:${missionPad(Math.floor(secs / 60) % 60)}:${missionPad(secs % 60)}`);
    // Días hasta el lunes, contando hoy
    const days = 8 - (now.getDay() || 7);
    setMenuText('progress-weekly-left', days === 1 ? 'Queda 1 día' : `Quedan ${days} días`);
}
