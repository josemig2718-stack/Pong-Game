/**
 * campaign/progress.js
 * ------------------------------------------------------------------
 * El combate de campaña en curso y el avance del jugador: qué jefe se
 * juega, la pantalla VS, qué desbloquea una victoria y cuál es el
 * siguiente jefe.
 *
 * El progreso guardado (campaignProgress, de 1 a 6) vive en
 * playerProgression; aquí está el jefe del combate actual, que puede
 * ser uno ya vencido que se repite.
 * ------------------------------------------------------------------
 */

'use strict';

/** Nivel (jefe) del combate en curso o del último jugado. */
let currentCampaignLevel = 1;

/** true si el jefe en curso ya estaba vencido: paga menos (ver awardGameRewards). */
let isReplayingBoss = false;

/**
 * Muestra la pantalla VS del jefe y, tras unos segundos, empieza el combate.
 * @param {number} level
 * @param {{slam?: boolean}} [opts] slam: entrada de golpe (tras la revelación del Creador)
 */
function prepareCampaignMatch(level, opts) {
    currentCampaignLevel = level;
    isReplayingBoss = level < playerProgression.campaignProgress;
    const boss = HACHEPES_LORE[level];
    const isCreator = level === CAMPAIGN_CREATOR;

    document.getElementById('vs-boss-name').textContent = boss.name;
    document.getElementById('vs-boss-title').textContent = boss.title;
    document.getElementById('vs-boss-danger').innerHTML = dangerStarsHTML(boss.danger) + '<span class="px">PELIGRO</span>';
    document.getElementById('vs-player-level').textContent = String(getCurrentLevel().level);
    document.getElementById('vs-level').textContent = 'NIVEL ' + (isCreator ? '??' : level);

    const avatar = /** @type {HTMLImageElement} */ (document.getElementById('vs-boss-avatar'));
    const avatar2 = /** @type {HTMLImageElement} */ (document.getElementById('vs-boss-avatar2'));

    avatar.src = boss.image;
    avatar.classList.toggle('avatar-corrupted', isCreator);
    if (boss.image2) avatar2.src = boss.image2;
    avatar2.classList.toggle('hidden', !boss.image2);

    document.getElementById('vs-screen-container').classList.toggle('glitch-mode', isCreator);

    showScreen('vs-screen');

    // Entrada de golpe: solo cuando venimos de la revelación
    const vs = document.getElementById('vs-screen');
    vs.classList.remove('slam');
    if (opts && opts.slam) {
        void vs.offsetWidth;
        vs.classList.add('slam');
    }

    if (isCreator && soundEffects.glitch) soundEffects.glitch();

    setTimeout(() => {
        startCampaignGame();
    }, isCreator ? 3000 : 3200);
}

/** Empieza la partida contra el jefe en curso, con su diálogo de entrada. */
function startCampaignGame() {
    const boss = HACHEPES_LORE[currentCampaignLevel];

    startGame('campaign');

    // El diálogo inicial congela la partida hasta que termina (update() sale
    // temprano mientras isDialogueActive es true).
    queueDialogue(boss.dialogues.start);
}

/** Logros de campaña y avance del progreso al vencer a un jefe. */
function handleCampaignVictory() {
    unlockAchievement('campaign_first');
    if (currentCampaignLevel === CAMPAIGN_LAST_BOSS) unlockAchievement('campaign_clear');
    if (currentCampaignLevel === CAMPAIGN_CREATOR) unlockAchievement('the_creator');

    // Solo avanza si era el jefe pendiente (repetir uno vencido no cuenta)
    if (currentCampaignLevel === playerProgression.campaignProgress && currentCampaignLevel < CAMPAIGN_CREATOR) {
        playerProgression.campaignProgress++;
        saveProgression();
    }
}

/**
 * ¿Cuál es el siguiente Hachepe tras el que se acaba de jugar?
 * Devuelve null si no hay ninguno disponible.
 *
 * Ojo: se calcula desde currentCampaignLevel, NO desde campaignProgress.
 * Usar el progreso mandaba al Creador nada más repetir un jefe antiguo,
 * saltándose media historia.
 */
function getNextCampaignBoss() {
    const next = currentCampaignLevel + 1;
    // Al Creador solo se llega por la secuencia narrativa o por su carta.
    if (next > CAMPAIGN_LAST_BOSS) return null;
    if (next > playerProgression.campaignProgress) return null;
    return next;
}

/** Botón "SIGUIENTE HACHEPE" de la pantalla de fin de combate. */
function nextCampaignLevel() {
    soundEffects.uiClick();
    document.getElementById('game-over-screen').classList.remove('active-screen');
    syncResultClass();
    stopDialogue();
    const next = getNextCampaignBoss();
    if (next) {
        prepareCampaignMatch(next);
    } else {
        showScreen('campaign-menu');
    }
}
