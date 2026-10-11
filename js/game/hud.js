/**
 * game/hud.js
 * ------------------------------------------------------------------
 * HUD de la partida en el DOM, fuera del campo: una tarjeta por jugador
 * (nombre, marcador y una marca por punto), el chip del modo, el tiempo
 * y el rally en curso.
 *
 * setupHud() lo prepara al empezar la partida; updateHud() lo refresca
 * desde render() y solo toca el DOM cuando cambia algo. Solo lee estado:
 * nada aquí consume Math.random.
 * ------------------------------------------------------------------
 */

'use strict';

const HUD_CPU_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>';

let hudKey = '';

/** Prepara el HUD para la partida que empieza (startGame). */
function setupHud() {
    const container = document.getElementById('game-container');
    const bcfg = bossConfig();
    const useHealth = !!(bcfg && bcfg.useHealth);
    // En la pelea con barra de vida las tarjetas sobran: los corazones
    // del canvas y la barra del jefe ya cuentan la partida.
    container.toggleAttribute('data-health', useHealth);

    const target = matchTargetScore();
    const mode = document.getElementById('hud-mode');
    mode.textContent = matchModeLabel();
    if (state.mode === 'cpu') {
        const diff = document.createElement('span');
        diff.className = 'hud-mode__diff';
        diff.textContent = ` · ${DIFFICULTY_NAMES[settings.difficulty] || DIFFICULTY_NAMES[2]}`;
        mode.appendChild(diff);
    }
    if (!useHealth) mode.appendChild(document.createTextNode(` · a ${target}`));

    const [name1, name2] = matchSideNames();
    document.getElementById('hud-name-p1').textContent = name1;
    document.getElementById('hud-name-p2').textContent = name2;

    // Insignias: el nivel del jugador; el rival, según el modo
    document.getElementById('hud-badge-p1').textContent = String(getCurrentLevel().level);
    const badge2 = document.getElementById('hud-badge-p2');
    if (state.mode === 'local') {
        badge2.textContent = 'J2';
    } else if (state.mode === 'campaign' && !useHealth) {
        const img = document.createElement('img');
        img.src = HACHEPES_LORE[currentCampaignLevel].image;
        img.alt = '';
        badge2.replaceChildren(img);
    } else {
        badge2.innerHTML = HUD_CPU_ICON;
    }

    for (const side of ['p1', 'p2']) {
        const pips = document.getElementById(`hud-pips-${side}`);
        pips.replaceChildren(...Array.from({ length: target }, () => document.createElement('i')));
    }

    hudKey = '';
    updateHud();
}

/** Refresca marcador, marcas, tiempo y rally si han cambiado. */
function updateHud() {
    const secs = Math.floor(matchElapsedMs / 1000);
    const key = `${state.p1Score}|${state.p2Score}|${currentRally}|${secs}`;
    if (key === hudKey) return;
    hudKey = key;

    for (const side of ['p1', 'p2']) {
        const score = side === 'p1' ? state.p1Score : state.p2Score;
        document.getElementById(`hud-score-${side}`).textContent = String(score);
        const pips = document.getElementById(`hud-pips-${side}`).children;
        for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('is-on', i < score);
    }
    document.getElementById('hud-time').textContent = formatMatchTime(matchElapsedMs);
    document.getElementById('hud-rally').textContent = `Rally ${currentRally}`;
}
