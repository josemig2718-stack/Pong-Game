/**
 * bosses/phases.js
 * ------------------------------------------------------------------
 * Combate por fases, común a cualquier jefe que declare `phases` en su
 * BossMechanics (uno sin fases se juega como siempre, por marcador).
 *
 *   - Cada fase se supera con `goals` goles del jugador. Al superarla:
 *     transición (bola congelada, destello y phaseUp → diálogo de la
 *     fase en el cuadro de siempre → 1,5 s de phase.transition(t) →
 *     phase.enter() y letrero «FASE N · nombre») y saque hacia el jugador.
 *   - Al superar la última: el K.O. (el remate propio del jefe, zoom a su
 *     pala, la pala sale volando y la pantalla se tiñe del tema) y
 *     checkWin().
 *   - El jugador tiene `lives` vidas (5): cada gol del jefe quita una y
 *     superar una fase devuelve una. Con 0, derrota. Reintentar empieza
 *     de cero (startGame → bossInit).
 *   - Pullas (#boss-bubble): frases cortas que no paran la partida.
 *
 * update() llama a bossPhaseHold() justo después del hit-stop: mientras
 * hay transición o K.O. la partida no avanza. Solo pasa en un combate con
 * fases, así que no cambia el azar de ningún otro modo. Las frases de las
 * pullas se eligen con vfxRandom: no tocan Math.random.
 * ------------------------------------------------------------------
 */

'use strict';

/** Vidas del jugador si el jefe no dice otra cosa. */
const BOSS_LIVES = 5;

/** Tiempos del combate por fases (ms reales). */
const BOSS_PHASE_MS = {
    freeze: 600,        // bola congelada y destello antes del diálogo
    morph: 1500,        // phase.transition(t): la arena se transforma
    banner: 1200,       // letrero «FASE N · nombre»
    koZoom: 1200,       // cámara lenta y zoom a la pala del jefe
    koTint: 400,        // la pantalla se tiñe del color del tema
    tauntShow: 2200,    // cada pulla
    tauntGap: 4000      // como mucho una cada tanto
};

/** Música por fase: subida en dB de las fases 2 y 3+, y velocidad de la 3+. */
const BOSS_PHASE_MUSIC = { boost2Db: 2, boost3Db: 3, rate3: 1.04 };

/** Hasta cuándo se ve la pulla y cuándo puede salir la siguiente (performance.now). */
let bossTauntUntil = 0;
let bossTauntReady = 0;
/**
 * Junto a qué pala sale la pulla en curso: la de quien habla en los jefes
 * con `speakers` ('p2' o 'twin'), o null (la esquina de siempre).
 * @type {'p2'|'twin'|null}
 */
let bossTauntPaddle = null;

/** Lo último que pintó el HUD del combate, para tocar el DOM solo si cambia. */
let bossHudKey = '';

/** @returns {BossPhase[]|null} las fases del jefe en curso, o null */
function bossPhases() {
    const boss = currentBoss();
    return boss && boss.phases && boss.phases.length ? boss.phases : null;
}

/** ¿El combate en curso es por fases? */
function bossHasPhases() {
    return !!bossPhases();
}

/** @returns {number} índice de la fase en curso */
function bossPhaseIndex() {
    return bossState.phase || 0;
}

/** Color del jefe en curso (barra, destellos). */
function bossColor() {
    const boss = currentBoss();
    return (boss && boss.color) || '#EF4444';
}

/** Suma de los goles de todas las fases (matchTargetScore, textos). */
function bossPhasesGoalTotal() {
    const phases = bossPhases();
    return phases ? phases.reduce((s, p) => s + p.goals, 0) : 0;
}

/** Arma el estado de las fases (bossInit, antes del init del jefe). */
function bossPhasesInit() {
    const phases = bossPhases();
    if (!phases) return;
    const lives = currentBoss().lives || BOSS_LIVES;
    Object.assign(bossState, {
        phase: 0, phaseGoals: 0, lives, maxLives: lives, livesLost: 0,
        transition: null, ko: null, cleared: false, lastLifeTaunted: false,
        flashMs: 0, maxPhase: 0
    });
}

/** Al empezar el combate, la primera fase entra sin transición. */
function bossPhasesStart() {
    const phases = bossPhases();
    if (phases && phases[0].enter) phases[0].enter();
}

/**
 * Un gol en un combate por fases (después del onGoal del jefe).
 * @param {boolean} scorerIsP1
 * @param {Ball} [b] la bola que entró
 */
function bossPhaseGoal(scorerIsP1, b) {
    const phases = bossPhases();
    if (!phases || bossState.ko || bossState.cleared) return;
    if (!scorerIsP1) {
        bossState.lives = Math.max(0, bossState.lives - 1);
        bossState.livesLost++;
        bossTaunt('playerMiss');
        if (bossState.lives === 1 && !bossState.lastLifeTaunted) {
            bossState.lastLifeTaunted = true;
            bossTaunt('lastLife', true);
        }
        return;
    }
    bossState.phaseGoals++;
    const phase = phases[bossPhaseIndex()];
    if (bossState.phaseGoals < phase.goals) {
        bossTaunt('bossMiss');
        return;
    }
    if (bossPhaseIndex() >= phases.length - 1) bossStartKo(b);
    else bossStartTransition();
}

/** Empieza la transición a la fase siguiente. */
function bossStartTransition() {
    bossState.transition = { stage: 'freeze', ms: 0, next: bossPhaseIndex() + 1 };
    bossState.flashMs = BOSS_PHASE_MS.freeze;
    bossHideTaunt();
    if (soundEffects.phaseUp) soundEffects.phaseUp();
    // Fuera el orbe y los efectos de los dos: la fase nueva empieza limpia
    clearPowerupsForPhase();
    bossState.lives = Math.min(bossState.maxLives, bossState.lives + 1);
}

/**
 * Empieza el K.O. del jefe.
 * @param {Ball} [b]
 */
function bossStartKo(b) {
    const boss = currentBoss();
    bossState.ko = { ms: 0, lead: (boss && boss.koLeadMs) || 0, hit: false, smash: !!b && b.power === 'super',
                     x: b ? b.x : GAME_WIDTH, y: b ? b.y : GAME_HEIGHT / 2 };
    bossHideTaunt();
}

/**
 * Paso de update() para la transición y el K.O.
 * @param {number} dt fotogramas de 60 FPS (tiempo real)
 * @returns {boolean} true si la partida está retenida y update() debe salir
 */
function bossPhaseHold(dt) {
    if (bossState.flashMs > 0) bossState.flashMs = Math.max(0, bossState.flashMs - dt * MS_PER_FRAME);
    const tr = bossState.transition;
    const ko = bossState.ko;
    if (!tr && !ko) return false;
    const ms = dt * MS_PER_FRAME;
    if (tr) bossTickTransition(tr, ms);
    else bossTickKo(ko, ms);
    updateParticles(dt);
    updateShake(dt);
    return true;
}

/**
 * @param {{ stage: string, ms: number, next: number }} tr
 * @param {number} ms
 */
function bossTickTransition(tr, ms) {
    tr.ms += ms;
    if (tr.stage === 'freeze' && tr.ms >= BOSS_PHASE_MS.freeze) {
        tr.stage = 'dialogue';
        const lore = HACHEPES_LORE[currentCampaignLevel];
        const lines = (lore && lore.dialogues['phase' + (tr.next + 1)]) || [];
        // update() no avanza mientras el diálogo esté abierto
        queueDialogue(lines, () => {
            tr.stage = 'morph';
            tr.ms = 0;
            bossState.phase = tr.next;
            bossState.phaseGoals = 0;
            bossState.maxPhase = Math.max(bossState.maxPhase, tr.next);
        });
    } else if (tr.stage === 'morph') {
        const phase = bossPhases()[tr.next];
        const t = Math.min(1, tr.ms / BOSS_PHASE_MS.morph);
        if (phase.transition) phase.transition(t);
        if (t >= 1) {
            bossState.transition = null;
            if (phase.enter) phase.enter();
            bossPhaseMusic(tr.next);
            bossShowPhaseBanner(tr.next);
            resetBall(false, { toward: 'p1' });
        }
    }
}

/**
 * @param {{ ms: number, lead: number, hit: boolean, smash: boolean }} ko
 * @param {number} ms
 */
function bossTickKo(ko, ms) {
    ko.ms += ms;
    const wrapper = document.getElementById('canvas-wrapper');
    // El remate propio del jefe (la caja de Dani, la caída de Mario…)
    const boss = currentBoss();
    if (!ko.hit && boss && boss.koTick) boss.koTick(ko.ms);
    if (!ko.hit && ko.ms >= ko.lead) {
        ko.hit = true;
        wrapper.style.transformOrigin = `${((p2.x + p2.width / 2) / GAME_WIDTH * 100).toFixed(1)}% ${((p2.y + p2.height / 2) / GAME_HEIGHT * 100).toFixed(1)}%`;
        if (!prefersReducedMotion()) wrapper.classList.add('is-ko');
        if (soundEffects.koHit) soundEffects.koHit();
        triggerShake(10, 300);
        if (ko.smash) unlockAchievement('boss_ko_smash');
    }
    if (ko.hit) {
        // La pala del jefe sale despedida hacia la derecha, con chispas
        const t = ko.ms - ko.lead;
        if (t < BOSS_PHASE_MS.koZoom) {
            p2.x += ms * 0.35;
            p2.y += Math.sin(t / 90) * ms * 0.05;
            if (Math.floor(t / 50) !== Math.floor((t - ms) / 50)) spawnParticles(p2.x, p2.y + p2.height / 2, bossColor(), 6);
        }
    }
    if (ko.ms >= ko.lead + BOSS_PHASE_MS.koZoom + BOSS_PHASE_MS.koTint) {
        wrapper.classList.remove('is-ko');
        bossState.ko = null;
        bossState.cleared = true;
        checkWin();
    }
}

/**
 * Capa de las fases sobre todo lo demás: el destello del color del jefe
 * al superar una fase y el tinte del tema al final del K.O.
 * @param {CanvasRenderingContext2D} ctx
 */
function bossRenderPhaseOverlay(ctx) {
    if (!bossHasPhases()) return;
    if (bossState.flashMs > 0) {
        ctx.save();
        ctx.globalAlpha = 0.45 * bossState.flashMs / BOSS_PHASE_MS.freeze;
        ctx.fillStyle = bossColor();
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.restore();
    }
    const ko = bossState.ko;
    if (ko && ko.hit) {
        const t = ko.ms - ko.lead - BOSS_PHASE_MS.koZoom;
        if (t > 0) {
            ctx.save();
            ctx.globalAlpha = 0.55 * Math.sin(Math.PI * Math.min(1, t / BOSS_PHASE_MS.koTint));
            ctx.fillStyle = currentThemeHex();
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            ctx.restore();
        }
    }
}

/**
 * Intensidad de la música por fase (música dinámica, sin cambiar de
 * pista): fase 2, +2 dB; fase 3 y siguientes, +3 dB y un 4 % más rápida.
 * startGame y checkWin lo devuelven todo a la normalidad.
 * @param {number} idx fase que empieza
 */
function bossPhaseMusic(idx) {
    if (idx >= 2) {
        musicSetBoost(BOSS_PHASE_MUSIC.boost3Db);
        musicSetRate(BOSS_PHASE_MUSIC.rate3);
    } else if (idx === 1) {
        musicSetBoost(BOSS_PHASE_MUSIC.boost2Db);
    }
}

/** ¿Está la partida retenida por las fases (transición o K.O.)? */
function bossPhaseBusy() {
    return !!(bossState.transition || bossState.ko);
}

// ------------------------------------------------------------------
//  Pullas
// ------------------------------------------------------------------

/**
 * Una pulla del jefe en la burbuja. Como mucho una cada
 * BOSS_PHASE_MS.tauntGap y nunca durante un diálogo, una transición o
 * el K.O.
 * @param {string} event playerMiss, bossMiss, rally15, playerSmash, lastLife o uno propio
 * @param {boolean} [force] sin esperar a la anterior (lastLife)
 */
function bossTaunt(event, force = false) {
    if (state.mode !== 'campaign' || isDialogueActive || bossPhaseBusy()) return;
    const lore = HACHEPES_LORE[currentCampaignLevel];
    const lines = lore && lore.dialogues.taunts && lore.dialogues.taunts[event];
    if (!lines || lines.length === 0) return;
    const now = performance.now();
    if (!force && now < bossTauntReady) return;
    const line = lines[Math.floor(vfxRandom() * lines.length)];
    const bubble = document.getElementById('boss-bubble');
    document.getElementById('boss-bubble-text').textContent = typeof line === 'string' ? line : line.t;
    // Con varios hablantes, la burbuja va junto a la pala de quien habla, con
    // su color; la voz de altavoz (Chayipiti) lleva su cara dentro
    const who = lore.speakers ? dialogueSpeaker(lore, line) : null;
    bossTauntPaddle = who ? (who.paddle === 'twin' ? 'twin' : 'p2') : null;
    bubble.classList.toggle('has-speaker', !!who);
    if (who) bubble.style.setProperty('--c', who.color || '#FFFFFF');
    else bubble.style.removeProperty('--bubble-y');
    const face = /** @type {HTMLImageElement} */ (document.getElementById('boss-bubble-face'));
    const radio = !!who && who.voice === 'radio';
    face.classList.toggle('hidden', !radio);
    if (radio) face.src = who.src;
    bossPlaceBubble();
    bubble.classList.remove('hidden', 'is-on');
    void bubble.offsetWidth;
    bubble.classList.add('is-on');
    bossTauntUntil = now + BOSS_PHASE_MS.tauntShow;
    bossTauntReady = now + BOSS_PHASE_MS.tauntGap;
}

/** Quita la pulla en pantalla. */
function bossHideTaunt() {
    bossTauntUntil = 0;
    const bubble = document.getElementById('boss-bubble');
    if (bubble) bubble.classList.add('hidden');
}

/** Oculta la pulla cuando se acaba su tiempo (desde updateHud); si no, sigue a su pala. */
function updateBossBubble() {
    if (bossTauntUntil === 0) return;
    if (performance.now() < bossTauntUntil && !isDialogueActive) {
        bossPlaceBubble();
        return;
    }
    bossHideTaunt();
}

/** Pone la burbuja a la altura de la pala de quien habla (--bubble-y, en %). */
function bossPlaceBubble() {
    if (!bossTauntPaddle) return;
    const p = bossTauntPaddle === 'twin' ? p2Twin : p2;
    const y = Math.max(8, Math.min(84, (p.y + p.height / 2) / GAME_HEIGHT * 100));
    document.getElementById('boss-bubble').style.setProperty('--bubble-y', y.toFixed(1) + '%');
}

/**
 * El letrero «FASE N · nombre» en el centro del campo.
 * @param {number} idx
 */
function bossShowPhaseBanner(idx) {
    const phase = bossPhases()[idx];
    const el = document.getElementById('boss-phase-banner');
    document.getElementById('boss-phase-banner-n').textContent = `FASE ${idx + 1}`;
    document.getElementById('boss-phase-banner-name').textContent = phase.name;
    el.style.setProperty('--dur', BOSS_PHASE_MS.banner + 'ms');
    el.classList.remove('hidden', 'is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
    setTimeout(() => el.classList.add('hidden'), BOSS_PHASE_MS.banner);
}

// ------------------------------------------------------------------
//  HUD del combate por fases
// ------------------------------------------------------------------

const BOSS_HEART_SVG = '<svg viewBox="0 0 10 9" aria-hidden="true"><path d="M5 9 .7 4.7A2.6 2.6 0 0 1 5 1.4a2.6 2.6 0 0 1 4.3 3.3z"/></svg>';

/**
 * Prepara el HUD (setupHud): la barra del jefe en #hud-mode y los
 * corazones del jugador en lugar de sus marcas. Sin fases, lo deja todo
 * como estaba.
 */
function setupBossHud() {
    const container = document.getElementById('game-container');
    const phases = bossPhases();
    container.toggleAttribute('data-phases', !!phases);
    document.getElementById('canvas-wrapper').classList.remove('is-ko');
    bossHideTaunt();
    bossTauntReady = 0;
    document.getElementById('boss-phase-banner').classList.add('hidden');
    bossHudKey = '';
    if (!phases) return;

    const lore = HACHEPES_LORE[currentCampaignLevel];
    const mode = document.getElementById('hud-mode');
    mode.style.setProperty('--boss', bossColor());
    mode.innerHTML = `<span class="boss-bar__head"><span class="px boss-bar__name">${lore.name.replace(/^Hachepe /, '').toUpperCase()}</span>`
        + '<span id="boss-bar-phase" class="boss-bar__phase"></span></span>'
        + '<span class="boss-bar__track">'
        + phases.map((p) => `<span class="boss-bar__seg">${'<i></i>'.repeat(p.goals)}</span>`).join('')
        + '</span>';
    const hearts = document.getElementById('hud-pips-p1');
    hearts.replaceChildren();
    for (let i = 0; i < bossState.maxLives; i++) {
        const h = document.createElement('i');
        h.className = 'hud-heart is-on';
        h.innerHTML = BOSS_HEART_SVG;
        hearts.appendChild(h);
    }
    document.getElementById('hud-pips-p2').replaceChildren();
}

/** Refresca la barra del jefe y los corazones si han cambiado (desde updateHud). */
function updateBossHud() {
    updateBossBubble();
    const phases = bossPhases();
    if (!phases) return;
    const idx = bossPhaseIndex();
    const key = `${idx}|${bossState.phaseGoals}|${bossState.lives}`;
    if (key === bossHudKey) return;
    const [, , prevLives] = bossHudKey ? bossHudKey.split('|').map(Number) : [0, 0, bossState.lives];
    bossHudKey = key;

    document.getElementById('boss-bar-phase').textContent = `FASE ${idx + 1} · ${phases[idx].name}`;
    const segs = document.querySelectorAll('#hud-mode .boss-bar__seg');
    segs.forEach((seg, i) => {
        seg.classList.toggle('is-done', i < idx);
        seg.classList.toggle('is-current', i === idx);
        [...seg.children].forEach((notch, n) => {
            const on = i < idx || (i === idx && n < bossState.phaseGoals);
            if (on && !notch.classList.contains('is-on') && i === idx) notch.classList.add('is-pop');
            notch.classList.toggle('is-on', on);
        });
    });

    const hearts = document.getElementById('hud-pips-p1').children;
    for (let i = 0; i < hearts.length; i++) {
        const h = hearts[i];
        const on = i < bossState.lives;
        h.classList.remove('is-breaking', 'is-gain');
        if (!on && i < prevLives) h.classList.add('is-breaking');
        if (on && i >= prevLives) h.classList.add('is-gain');
        h.classList.toggle('is-on', on);
    }
}
