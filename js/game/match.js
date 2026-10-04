/**
 * game/match.js
 * ------------------------------------------------------------------
 * Ciclo de vida de una partida: empezar, pausar, salir y decidir el
 * final (checkWin).
 *
 * checkWin() orquesta el final de forma explícita y a propósito: el
 * orden sonido → diálogo → victoria de campaña → estadísticas → logro →
 * recompensas → marcadores → paletas → música → secuencia narrativa es
 * parte del comportamiento.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Empieza una partida.
 * @param {'cpu'|'local'|'hachepe'|'campaign'} mode
 */
function startGame(mode) {
    getAudioContext();

    state.mode = mode;
    state.p1Score = 0;
    state.p2Score = 0;
    state.goTextMs = 0;
    state.particles = [];

    // Restaurar geometría original de las paletas. Hay que reponer también
    // width y x: la arena rotada del Creador convierte a p1 en una paleta
    // horizontal centrada, y si no se deshace queda un cuadrado en mitad
    // del campo en la siguiente partida.
    p1.width = paddleWidth;
    p1.height = paddleHeight;
    p1.x = 24;
    p2.width = paddleWidth;
    p2.height = paddleHeight;
    p2.x = GAME_WIDTH - 24 - paddleWidth;

    p1.y = GAME_HEIGHT / 2 - p1.height / 2;
    p2.y = GAME_HEIGHT / 2 - p2.height / 2;
    p1.dy = 0;
    p2.dy = 0;
    p1.touchY = null;
    p2.touchY = null;
    p1.touchX = null;   // si no se limpia, la paleta horizontal queda pegada al repetir
    p2.touchX = null;
    resetTouchHints();

    state.isPlaying = true;
    state.isPaused = false;

    // Limpiar cualquier diálogo de campaña que quedara de la partida anterior
    stopDialogue();
    resetMidDialogue();

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));

    const container = document.getElementById('game-container');
    container.classList.remove('hidden');
    container.classList.add('flex');

    let badgeText = 'VS CPU';
    if (mode === 'hachepe') badgeText = 'HACHEPE';
    if (mode === 'local') badgeText = 'LOCAL · 2 JUGADORES';
    if (mode === 'campaign') badgeText = 'CAMPAÑA: ' + HACHEPES_LORE[currentCampaignLevel].name;
    document.getElementById('mode-badge').textContent = badgeText;
    document.body.dataset.gameMode = mode;

    const hachepeChars = document.getElementById('hachepe-characters');
    if (hachepeChars) {
        if (mode === 'hachepe') hachepeChars.classList.remove('hidden');
        else hachepeChars.classList.add('hidden');
    }

    // Resetear mecánicas de jefes: siempre se apaga todo, y el jefe en
    // curso (si lo hay) arma lo suyo en bossInit().
    p2Twin.active = false;
    p2Twin.retreatMs = 0;
    bossInit();

    resizeCanvas();
    resetBall(true);

    initPowerups();
    initVFX();
    statsOnGameStart();
    resetSessionTrackers();

    // Música
    stopMenuMusic();
    playGameplayMusic(mode);

    startLoop();
}

/** Botón "JUGAR DE NUEVO": repite la partida con el mismo modo. */
function restartCurrentGame() {
    startGame(state.mode);
}

/** Abandona la partida y vuelve al menú principal. */
function quitGame() {
    state.isPlaying = false;
    stopLoop();

    // Cortar diálogos de campaña en curso
    stopDialogue();
    resetMusicRate();

    // Restaurar paletas (incluida la posición si la arena estaba rotada)
    p1.height = paddleHeight;
    p1.width = paddleWidth;
    p1.x = 24;
    p2.height = paddleHeight;
    p2.width = paddleWidth;
    p2.x = GAME_WIDTH - 24 - paddleWidth;

    // Música
    stopGameplayMusic();
    playMenuMusic();

    const hachepeChars = document.getElementById('hachepe-characters');
    if (hachepeChars) hachepeChars.classList.add('hidden');

    showScreen('main-menu');
}

/** Pausa o reanuda la partida (ESC, botón de pausa, menú de pausa). */
function togglePause() {
    if (!state.isPlaying) return;
    state.isPaused = !state.isPaused;
    if (state.isPaused) {
        document.getElementById('pause-menu').classList.add('active-screen');
        stopLoop();
    } else {
        document.getElementById('pause-menu').classList.remove('active-screen');
        resumeLoop();
    }
}

/**
 * Comprueba si la partida ha terminado y, si es así, la cierra.
 * @returns {boolean} true si terminó
 */
function checkWin() {
    const bcfg = bossConfig();

    // Cada jefe de campaña tiene su propio marcador; el resto usa el de siempre.
    let target = settings.winningScore;
    if (bcfg) target = bcfg.targetScore;
    else if (state.mode === 'hachepe') target = 10;

    // Los jefes con barra de vida se ganan vaciándola, no por marcador: aquí
    // state.p2Score cuenta los fallos del jugador, no los puntos del rival.
    let p1Won, finished;
    if (bcfg && bcfg.useHealth) {
        const hp = bossHealth();
        p1Won = hp <= 0;
        finished = p1Won || state.p2Score >= target;
    } else {
        p1Won = state.p1Score >= target;
        finished = p1Won || state.p2Score >= target;
    }

    if (!finished) return false;

    state.isPlaying = false;

    const gameOverScreen = document.getElementById('game-over-screen');
    const winnerText = document.getElementById('winner-text');
    const scoreText = document.getElementById('final-score');

    const btnNextCampaign = document.getElementById('btn-next-campaign');
    if (btnNextCampaign) btnNextCampaign.classList.add('hidden'); // Ocultar por defecto

    // ¿Este desenlace lo narra la campaña en vez de la pantalla de fin?
    // Vencer a Yisus dispara el falso final; vencer al Creador, el final real.
    let narrativeEnding = null;
    if (state.mode === 'campaign' && p1Won) {
        if (currentCampaignLevel === CAMPAIGN_LAST_BOSS) narrativeEnding = 'finale';
        else if (currentCampaignLevel === CAMPAIGN_CREATOR) narrativeEnding = 'trueEnding';
    }

    if (state.mode === 'campaign') {
        winnerText.textContent = p1Won ? '¡DERROTASTE AL HACHEPE!' : 'HAS CAÍDO...';
        if (!narrativeEnding) p1Won ? soundEffects.win() : soundEffects.lose();

        // Diálogo de despedida del jefe (win/lose desde su punto de vista)
        playBossOutcomeDialogue(p1Won);

        if (p1Won) {
            handleCampaignVictory();
            // El botón solo aparece si de verdad hay un Hachepe siguiente
            // desbloqueado; si no, quedan "jugar de nuevo" y "menú".
            const siguiente = getNextCampaignBoss();
            if (btnNextCampaign && !narrativeEnding && siguiente) {
                btnNextCampaign.classList.remove('hidden');
            }
        }
    } else if (state.mode === 'cpu' || state.mode === 'hachepe') {
        winnerText.textContent = p1Won ? '¡GANASTE!' : 'CPU GANA :(';
        p1Won ? soundEffects.win() : soundEffects.lose();
    } else {
        winnerText.textContent = p1Won ? 'JUGADOR 1 GANA' : 'JUGADOR 2 GANA';
        soundEffects.win();
    }

    scoreText.textContent = `${state.p1Score} - ${state.p2Score}`;
    // En los desenlaces narrados, la pantalla de fin se salta por completo
    if (!narrativeEnding) gameOverScreen.classList.add('active-screen');

    // Estadísticas y logros
    statsOnGameEnd(state.mode, p1Won, state.p2Score);

    if (state.mode === 'hachepe' && p1Won) {
        unlockAchievement('beat_hachepe');
    }

    // Progresión: otorgar XP y Chemi Coins
    awardGameRewards(state.mode, p1Won, state.p1Score, state.p2Score);

    // Actualizar displays de progresión
    updateCoinDisplay();
    updateProgressionDisplay();

    // Restaurar paletas por si un power-up las alteró o la arena estaba rotada
    p1.width = paddleWidth;
    p1.height = paddleHeight;
    p1.x = 24;
    p2.height = paddleHeight;
    p2.width = paddleWidth;

    // Música
    stopGameplayMusic();

    // Encadenar la secuencia narrativa que corresponda
    if (narrativeEnding === 'finale') {
        runFinaleSequence();
    } else if (narrativeEnding === 'trueEnding') {
        runTrueEndingSequence();
    }
    return true;
}
