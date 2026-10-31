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
 * Puntos para ganar la partida en curso: el marcador del jefe, 10 en el
 * Modo Hachepe o el de Configuración. En los jefes con barra de vida son
 * los fallos que se le permiten al jugador. La práctica no tiene meta (0).
 * @returns {number}
 */
function matchTargetScore() {
    const bcfg = bossConfig();
    if (bcfg && bossHasPhases()) return bossPhasesGoalTotal();
    if (bcfg) return bcfg.targetScore;
    if (state.mode === 'practice') return 0;
    if (state.mode === 'hachepe') return 10;
    return settings.winningScore;
}

/** Nombre del modo en curso, como en la insignia y en la pausa. */
function matchModeLabel() {
    if (state.mode === 'hachepe') return 'Modo Hachepe';
    if (state.mode === 'local') return 'Local';
    if (state.mode === 'practice') return 'Práctica';
    if (state.mode === 'campaign') return 'Campaña · ' + HACHEPES_LORE[currentCampaignLevel].name;
    return 'VS CPU';
}

/**
 * Modo de la partida, con la dificultad en VS CPU y, si se pide, la
 * meta ("VS CPU · Normal · a 5 puntos").
 * @param {boolean} withTarget
 */
function matchInfoText(withTarget) {
    if (state.mode === 'practice') return `Práctica · mejor rally ${matchBestRally} · ${state.p2Score} ${state.p2Score === 1 ? 'fallo' : 'fallos'}`;
    const parts = [matchModeLabel()];
    if (state.mode === 'cpu') parts.push(DIFFICULTY_NAMES[settings.difficulty] || DIFFICULTY_NAMES[2]);
    if (withTarget) {
        const bcfg = bossConfig();
        const target = matchTargetScore();
        parts.push(bcfg && bcfg.useHealth ? `${target} fallos` : `a ${target} puntos`);
    }
    return parts.join(' · ');
}

/** Nombres de los dos lados del marcador (el jefe, sin "Hachepe": "Dani"). */
function matchSideNames() {
    if (state.mode === 'local') return ['J1', 'J2'];
    if (state.mode === 'practice') return ['TÚ', 'PARED'];
    if (state.mode === 'hachepe') return ['TÚ', 'HACHEPE'];
    if (state.mode === 'campaign') return ['TÚ', HACHEPES_LORE[currentCampaignLevel].name.replace(/^Hachepe /, '')];
    return ['TÚ', 'CPU'];
}

/**
 * Pone el marcador en una pantalla (pausa o fin). Los jefes con barra de
 * vida no tienen marcador de puntos: ahí p2Score son fallos.
 * @param {string} prefix 'pause' o 'final'
 */
function fillMatchScore(prefix) {
    const [name1, name2] = matchSideNames();
    document.getElementById(`${prefix}-name-p1`).textContent = name1;
    document.getElementById(`${prefix}-name-p2`).textContent = name2;
    document.getElementById(`${prefix}-score-p1`).textContent = String(state.p1Score);
    document.getElementById(`${prefix}-score-p2`).textContent = String(state.p2Score);
    const bcfg = bossConfig();
    document.getElementById(`${prefix}-score`).classList.toggle('hidden', !!(bcfg && bcfg.useHealth) || state.mode === 'practice');
}

/**
 * Tiempo de partida como "mm:ss".
 * @param {number} ms
 */
function formatMatchTime(ms) {
    const secs = Math.floor(ms / 1000);
    return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
}

/** Rally máximo, duración y power-ups recogidos, en el fin de partida. */
function fillMatchStats() {
    document.getElementById('go-stat-rally').textContent = String(matchBestRally);
    document.getElementById('go-stat-time').textContent = formatMatchTime(matchElapsedMs);
    document.getElementById('go-stat-powerups').textContent = String(powerupsThisGame);
}

/**
 * body.has-result mientras se ve la pausa o el fin de partida: el aviso
 * de logro baja a una esquina para no tapar el título.
 */
function syncResultClass() {
    const shown = (id) => document.getElementById(id).classList.contains('active-screen');
    document.body.classList.toggle('has-result', shown('pause-menu') || shown('game-over-screen'));
}

// ------------------------------------------------------------------
//  Música dinámica de la partida (los números están en MUSIC_DYNAMIC)
// ------------------------------------------------------------------

/** ¿Suena ya el punto de partido? Y ms hasta el siguiente latido. */
let matchPointOn = false;
let matchPointBeatMs = 0;

/** Punto de partido: a alguien le falta uno para ganar. Solo VS CPU y local (Hachepe y los jefes tienen su tensión). */
function isMatchPoint() {
    if (state.mode !== 'cpu' && state.mode !== 'local') return false;
    const target = matchTargetScore();
    return state.p1Score === target - 1 || state.p2Score === target - 1;
}

/**
 * Un paso del punto de partido, con la bola en juego (update()): la música
 * baja y suena un latido cada MUSIC_DYNAMIC.heartbeatMs. No usa Math.random.
 * @param {number} ms tiempo real
 */
function tickMatchPointMusic(ms) {
    if (!settings.dynamicMusic || !isMatchPoint()) return;
    if (!matchPointOn) {
        matchPointOn = true;
        matchPointBeatMs = 0;
        musicDuckHold(MUSIC_DYNAMIC.matchPointDb);
    }
    matchPointBeatMs -= ms;
    if (matchPointBeatMs <= 0) {
        soundEffects.matchPointBeat();
        matchPointBeatMs += MUSIC_DYNAMIC.heartbeatMs;
    }
}

/** Quita el punto de partido (al marcar: si sigue, vuelve con el saque siguiente). */
function endMatchPointMusic() {
    if (!matchPointOn) return;
    matchPointOn = false;
    musicDuckHold(0);
}

/** Un gol, en cualquier modo: fuera el punto de partido y la música baja para que se oiga el gol. */
function goalMusic() {
    endMatchPointMusic();
    musicDuck(MUSIC_DYNAMIC.goalDb, MUSIC_DYNAMIC.goalHoldMs);
}

/** Sin música dinámica de la partida anterior (al empezar y al abandonar). */
function resetMatchMusic() {
    matchPointOn = false;
    musicDuckReset();
}

/**
 * Empieza una partida.
 * @param {GameMode} mode
 */
function startGame(mode) {
    getAudioContext();

    state.mode = mode;
    state.p1Score = 0;
    state.p2Score = 0;
    state.goTextMs = 0;
    state.particles = [];
    // La vibración del gol que cerró la partida anterior no pasa a esta
    state.shakeTimeMs = 0;
    state.shakeIntensity = 0;
    state.hitStopMs = 0;
    resetFever();
    resetMatchMusic();
    // La intensidad por fase de la partida anterior (revancha sin salir)
    resetMusicRate();

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
    // Inercia, carga del smash y energía: todo de cero
    releaseSmashCharges();
    resetPaddleMechanics();
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
    syncResultClass();

    document.getElementById('game-container').classList.remove('hidden');
    // Los personajes del Modo Hachepe y los colores del HUD salen de aquí (CSS)
    document.body.dataset.gameMode = mode;

    // Resetear mecánicas de jefes: siempre se apaga todo, y el jefe en
    // curso (si lo hay) arma lo suyo en bossInit().
    p2Twin.active = false;
    p2Twin.retreatMs = 0;
    p2.retreatMs = 0;
    bossInit();
    resetCpuPlan();

    setupHud();
    resizeCanvas();
    resetBall(true);

    initPowerups();
    initVFX();
    state.lowFx = false;
    resetFxLoad();
    statsOnGameStart();
    resetSessionTrackers();
    refreshMissions();
    resetSessionMissions();

    // Música: la Rockola manda en VS CPU, local y práctica. La revancha
    // vuelve a pasar por aquí: repite la equipada o, si es aleatoria, elige otra.
    state.matchTrack = (mode === 'cpu' || mode === 'local' || mode === 'practice') ? matchTrack() : null;
    stopMenuMusic();
    playGameplayMusic(mode);

    startLoop();
}

/** Botón "JUGAR DE NUEVO": repite la partida con el mismo modo. */
function restartCurrentGame() {
    startGame(state.mode);
}

/** Abandona la partida y vuelve al menú principal (la práctica, a donde se entró). */
function quitGame() {
    const returnTo = state.mode === 'practice' ? practiceReturnScreen : 'main-menu';
    state.isPlaying = false;
    stopLoop();
    releaseSmashCharges();

    // Guardar el tiempo jugado desde el último guardado y parar el reloj
    statsPauseClock();

    // Cortar diálogos de campaña en curso
    stopDialogue();
    resetMusicRate();

    // Que no quede ningún efecto de gol (ni su cámara lenta) ni vibración
    resetVFX();
    state.shakeTimeMs = 0;
    state.shakeIntensity = 0;
    state.hitStopMs = 0;
    resetFever();
    resetMatchMusic();
    revertAllPowerups();

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

    // Fuera el campo, el HUD y los botones de smash: showScreen solo los
    // ocultaba al volver al menú principal, y la práctica vuelve a otras
    const container = document.getElementById('game-container');
    container.classList.add('hidden');
    delete container.dataset.smash;
    delete document.body.dataset.gameMode;

    showScreen(returnTo);
}

/** Pausa o reanuda la partida (ESC, botón de pausa, menú de pausa). */
function togglePause() {
    if (!state.isPlaying) return;
    // Con «Cómo jugar» abierto desde la pausa, ESC vuelve a la pausa
    if (howtoOverPause()) {
        closeHowto();
        return;
    }
    state.isPaused = !state.isPaused;
    if (state.isPaused) {
        fillMatchScore('pause');
        document.getElementById('pause-info').textContent = matchInfoText(true);
        // En práctica no hay nada que rendir: se sale
        document.getElementById('pause-quit-label').textContent = state.mode === 'practice' ? 'SALIR' : 'RENDIRSE';
        syncAudioToggles();
        document.getElementById('pause-menu').classList.add('active-screen');
        stopLoop();
        releaseSmashCharges();
        statsPauseClock();
        musicSetDuck(true);
    } else {
        document.getElementById('pause-menu').classList.remove('active-screen');
        statsResumeClock();
        resumeLoop();
        musicSetDuck(false);
    }
    syncResultClass();
}

/**
 * Sonido del fin de partida: con la música activada se funde la pista y
 * suena el jingle; sin música, la fanfarria sintetizada (con el volumen
 * de efectos).
 * @param {boolean} won
 */
function playMatchEndSound(won) {
    // También con la música apagada: la pista de partida no se retoma
    musicStop({ fade: 0.25 });
    if (settings.musicEnabled) {
        musicPlayOneShot(won ? 'jingle_victoria' : 'jingle_derrota');
    } else {
        won ? soundEffects.win() : soundEffects.lose();
    }
}

/**
 * Comprueba si la partida ha terminado y, si es así, la cierra.
 * @returns {boolean} true si terminó
 */
function checkWin() {
    // La práctica no termina nunca: se sale desde la pausa
    if (state.mode === 'practice') return false;
    const bcfg = bossConfig();

    // Cada jefe de campaña tiene su propio marcador; el resto usa el de siempre.
    const target = matchTargetScore();

    // Los jefes con barra de vida se ganan vaciándola, no por marcador: aquí
    // state.p2Score cuenta los fallos del jugador, no los puntos del rival.
    let p1Won, finished;
    if (bcfg && bcfg.useHealth) {
        const hp = bossHealth();
        p1Won = hp <= 0;
        finished = p1Won || state.p2Score >= target;
    } else if (bcfg && bossHasPhases()) {
        // Por fases: se gana tras el K.O. de la última fase y se pierde
        // sin vidas. Los marcadores siguen contando goles (estadísticas).
        p1Won = !!bossState.cleared;
        finished = p1Won || bossState.lives <= 0;
    } else {
        p1Won = state.p1Score >= target;
        finished = p1Won || state.p2Score >= target;
    }

    if (!finished) return false;

    state.isPlaying = false;
    releaseSmashCharges();

    const gameOverScreen = document.getElementById('game-over-screen');
    const winnerText = document.getElementById('winner-text');

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
        // La pista vuelve a su velocidad antes de pararse (la usa el siguiente combate)
        resetMusicRate();
        if (!narrativeEnding) playMatchEndSound(p1Won);

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
        winnerText.textContent = p1Won ? '¡GANASTE!' : 'DERROTA';
        playMatchEndSound(p1Won);
    } else {
        winnerText.textContent = p1Won ? 'JUGADOR 1 GANA' : 'JUGADOR 2 GANA';
        playMatchEndSound(true);   // en local siempre gana alguien
    }

    fillMatchScore('final');
    fillMatchStats();
    document.getElementById('game-over-mode').textContent = matchInfoText(false);
    // En local siempre gana alguien: se celebra igual
    gameOverScreen.dataset.result = (p1Won || state.mode === 'local') ? 'win' : 'loss';
    gameOverScreen.dataset.winner = p1Won ? 'p1' : 'p2';
    // Derrota en campaña: el jefe junto al marcador
    const bossSprite = /** @type {HTMLImageElement} */ (document.getElementById('final-boss-sprite'));
    const showBoss = state.mode === 'campaign' && !p1Won && !(bcfg && bcfg.useHealth);
    if (showBoss) {
        bossSprite.src = HACHEPES_LORE[currentCampaignLevel].image;
        bossSprite.alt = HACHEPES_LORE[currentCampaignLevel].name;
    }
    bossSprite.classList.toggle('hidden', !showBoss);
    // En los desenlaces narrados, la pantalla de fin se salta por completo
    if (!narrativeEnding) gameOverScreen.classList.add('active-screen');
    syncResultClass();

    // Estadísticas y logros
    statsOnGameEnd(state.mode, p1Won, state.p2Score);

    if (state.mode === 'hachepe' && p1Won) {
        unlockAchievement('beat_hachepe');
    }

    // Progresión: otorgar XP y Chemi Coins
    awardGameRewards(state.mode, p1Won, state.p1Score, state.p2Score);
    // Récord del jefe en la ficha de la torre (después de las recompensas:
    // la primera victoria paga extra)
    if (state.mode === 'campaign') recordCampaignBest(p1Won);

    // Actualizar displays de progresión
    updateCoinDisplay();
    updateProgressionDisplay();

    // Restaurar paletas por si un power-up las alteró o la arena estaba rotada
    p1.width = paddleWidth;
    p1.height = paddleHeight;
    p1.x = 24;
    p2.height = paddleHeight;
    p2.width = paddleWidth;

    // Música: los desenlaces narrados no tienen jingle y la paran aquí
    // (en el resto ya la paró playMatchEndSound)
    if (narrativeEnding) stopGameplayMusic();

    // Encadenar la secuencia narrativa que corresponda
    if (narrativeEnding === 'finale') {
        runFinaleSequence();
    } else if (narrativeEnding === 'trueEnding') {
        runTrueEndingSequence();
    }
    return true;
}
