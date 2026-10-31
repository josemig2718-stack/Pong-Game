/**
 * game/hud.js
 * ------------------------------------------------------------------
 * HUD de la partida en el DOM, fuera del campo: una tarjeta por jugador
 * (nombre, marcador y una marca por punto), el chip del modo, el tiempo,
 * el rally en curso (o la fiebre), la energía del smash de cada
 * jugador, el aviso de smash listo y, en pantallas táctiles, los botones
 * de smash.
 *
 * setupHud() lo prepara al empezar la partida; updateHud() lo refresca
 * desde render() y solo toca el DOM cuando cambia algo. Solo lee estado:
 * nada aquí consume Math.random.
 * ------------------------------------------------------------------
 */

'use strict';

/** La pared del modo práctica: unos ladrillos. */
const HUD_WALL_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 9.3v5.4M9 14.7V20"/></svg>';

const HUD_CPU_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>';

let hudKey = '';
/** Lo último que se pintó en los botones de smash, para tocar el DOM solo si cambia. */
let smashButtonsKey = '';
/** Hasta cuándo (performance.now) se ve el aviso de smash listo; 0 = oculto. */
let superHintUntil = 0;

/** Prepara el HUD para la partida que empieza (startGame). */
function setupHud() {
    const container = document.getElementById('game-container');
    const bcfg = bossConfig();
    const useHealth = !!(bcfg && bcfg.useHealth);
    // En la pelea con barra de vida las tarjetas sobran: los corazones
    // del canvas y la barra del jefe ya cuentan la partida.
    container.toggleAttribute('data-health', useHealth);

    // Botones de smash: con pantalla táctil y el ajuste "botón"; el del
    // J2 solo en local. Antes de resizeCanvas(), que mide el campo con ellos.
    if (isTouchDevice() && settings.smashTouch === 'button') {
        container.dataset.smash = state.mode === 'local' ? '2' : '1';
    } else {
        delete container.dataset.smash;
    }

    const target = matchTargetScore();
    const mode = document.getElementById('hud-mode');
    mode.textContent = matchModeLabel();
    if (state.mode === 'cpu') {
        const diff = document.createElement('span');
        diff.className = 'hud-mode__diff';
        diff.textContent = ` · ${DIFFICULTY_NAMES[settings.difficulty] || DIFFICULTY_NAMES[2]}`;
        mode.appendChild(diff);
    }
    const practice = state.mode === 'practice';
    if (!useHealth && !practice) mode.appendChild(document.createTextNode(` · a ${target}`));

    const [name1, name2] = matchSideNames();
    document.getElementById('hud-name-p1').textContent = name1;
    document.getElementById('hud-name-p2').textContent = name2;

    // Insignias: el nivel del jugador; el rival, según el modo
    document.getElementById('hud-badge-p1').textContent = String(getCurrentLevel().level);
    const badge2 = document.getElementById('hud-badge-p2');
    if (state.mode === 'local') {
        badge2.textContent = 'J2';
    } else if (practice) {
        badge2.innerHTML = HUD_WALL_ICON;
    } else if (state.mode === 'campaign' && !useHealth) {
        const img = document.createElement('img');
        img.src = HACHEPES_LORE[currentCampaignLevel].image;
        img.alt = '';
        badge2.replaceChildren(img);
    } else {
        badge2.innerHTML = HUD_CPU_ICON;
    }

    // Una marca por punto; en práctica, en su lugar, qué cuenta cada tarjeta
    for (const side of ['p1', 'p2']) {
        const pips = document.getElementById(`hud-pips-${side}`);
        if (practice) {
            const label = document.createElement('span');
            label.className = 'px hud-pips__lbl';
            label.textContent = side === 'p1' ? 'MEJOR RALLY' : 'FALLOS';
            pips.replaceChildren(label);
        } else {
            pips.replaceChildren(...Array.from({ length: target }, () => document.createElement('i')));
        }
    }

    // Combate por fases: barra del jefe y corazones (bosses/phases.js)
    setupBossHud();

    hudKey = '';
    smashButtonsKey = '';
    superHintUntil = 0;
    document.getElementById('super-hint').classList.add('hidden');
    resetHints();
    updateHud();
}

/**
 * Texto del aviso de smash listo según cómo juega el jugador 1: el botón
 * táctil, un segundo dedo, el smash automático o la tecla de smash.
 * @param {HTMLElement} el
 */
function fillSuperHintText(el) {
    if (isTouchDevice() && settings.smashTouch === 'auto') {
        el.textContent = 'Tu siguiente golpe será un smash';
    } else if (isTouchDevice() && settings.smashTouch === 'finger') {
        el.textContent = 'Mantén un segundo dedo y suelta al golpear';
    } else if (isTouchDevice() && !settings.mouseControl) {
        el.textContent = 'Mantén SMASH y suelta al golpear';
    } else {
        const kbd = document.createElement('kbd');
        kbd.textContent = keyLabel(settings.bindings.p1Smash);
        el.replaceChildren('Mantén ', kbd, ' y suelta al golpear');
    }
}

/**
 * La energía del jugador 1 acaba de llenarse: el aviso se ve
 * MECH.superHintMs, solo las ENERGY_HINT_TIMES primeras veces (y si los
 * consejos están activados; en práctica, una vez por sesión).
 */
function showSuperHint() {
    if (!hintDue('energy', ENERGY_HINT_TIMES)) return;
    markHintSeen('energy');
    fillSuperHintText(document.getElementById('super-hint-text'));
    document.getElementById('super-hint').classList.remove('hidden');
    superHintUntil = performance.now() + MECH.superHintMs;
}

/** Oculta el aviso de smash listo cuando se acaba su tiempo. */
function updateSuperHint() {
    if (superHintUntil === 0 || performance.now() < superHintUntil) return;
    superHintUntil = 0;
    document.getElementById('super-hint').classList.add('hidden');
}

/**
 * Botones de smash (solo si cambian). Sin la energía llena están apagados
 * (aria-disabled) y el anillo enseña cuánta energía hay; llena, se
 * encienden en amarillo (.is-super) y el anillo enseña la carga.
 */
function updateSmashButtons() {
    if (!document.getElementById('game-container').dataset.smash) return;
    const key = [p1, p2].map((p) => `${Math.round(p.charge * 50)}|${Math.round(p.energy)}|${superReadyFor(p)}`).join('|');
    if (key === smashButtonsKey) return;
    smashButtonsKey = key;
    for (const [side, p] of /** @type {Array<[string, Paddle]>} */ ([['p1', p1], ['p2', p2]])) {
        const btn = document.getElementById(`smash-btn-${side}`);
        const full = superReadyFor(p);
        const ring = full ? p.charge : Math.min(1, p.energy / MECH.energy.max);
        btn.style.setProperty('--charge', p.charge.toFixed(2));
        /** @type {SVGElement} */ (btn.querySelector('.smash-btn__fill')).style.strokeDasharray = `${(ring * 100).toFixed(1)} 100`;
        btn.classList.toggle('is-super', full);
        btn.setAttribute('aria-disabled', String(!full));
        if (!full) btn.classList.remove('is-held');
    }
}

/** Segmentos de energía encendidos (de 10). */
function energySegments(p) {
    return Math.floor(p.energy / (MECH.energy.max / 10));
}

/** Refresca marcador, marcas, tiempo, rally, fiebre, energía y botones de smash si han cambiado. */
function updateHud() {
    updateSmashButtons();
    updateSuperHint();
    updateHintToast();
    updateBossHud();
    const secs = Math.floor(matchElapsedMs / 1000);
    const energyKey = [p1, p2].map((p) => `${energySegments(p)}${superReadyFor(p) ? '!' : ''}`).join('|');
    const key = `${state.p1Score}|${state.p2Score}|${currentRally}|${secs}|${state.fever}|${energyKey}`;
    if (key === hudKey) return;
    hudKey = key;

    // En práctica: el mejor rally de la sesión y los fallos (p2Score)
    const practice = state.mode === 'practice';
    for (const side of ['p1', 'p2']) {
        const score = side === 'p1' ? (practice ? matchBestRally : state.p1Score) : state.p2Score;
        document.getElementById(`hud-score-${side}`).textContent = String(score);
        // En práctica no hay marcas; por fases, son los corazones (updateBossHud)
        if (practice || bossHasPhases()) continue;
        const pips = document.getElementById(`hud-pips-${side}`).children;
        for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('is-on', i < score);
    }
    document.getElementById('hud-time').textContent = formatMatchTime(matchElapsedMs);
    document.getElementById('hud-rally-chip').classList.toggle('is-fever', state.fever);
    document.getElementById('hud-rally').textContent = state.fever ? `FIEBRE ${currentRally}` : `Rally ${currentRally}`;

    // Energía: 10 segmentos; llena, la tarjeta pasa a amarillo y dice SMASH
    for (const [side, p] of /** @type {Array<[string, Paddle]>} */ ([['p1', p1], ['p2', p2]])) {
        const full = superReadyFor(p);
        const on = full ? 10 : energySegments(p);
        document.getElementById(`hud-${side}`).classList.toggle('is-super', full);
        const energy = document.getElementById(`hud-energy-${side}`);
        energy.querySelector('.hud-energy__lbl').textContent = full ? 'SMASH' : 'ENERGÍA';
        const segs = energy.querySelector('.hud-energy__seg').children;
        for (let i = 0; i < segs.length; i++) segs[i].classList.toggle('is-on', i < on);
    }
}
