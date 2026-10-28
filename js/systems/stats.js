/**
 * systems/stats.js
 * ------------------------------------------------------------------
 * Sistema de estadísticas persistentes. Almacena en localStorage
 * contadores de partidas, puntos, rachas, récords y tiempo jugado.
 * ------------------------------------------------------------------
 */

'use strict';

const STATS_STORAGE_KEY = 'pongGame.stats.v2';
const STATS_STORAGE_KEY_V1 = 'pongGame.stats.v1';   // borrada por el reinicio de la fase 4

const DEFAULT_STATS = {
    // General
    totalGamesPlayed:    0,
    totalTimePlayedMs:   0,
    totalPointsScored:   0,
    totalPointsConceded: 0,

    // VS CPU
    cpuWins:          0,
    cpuLosses:        0,
    cpuCurrentStreak: 0,
    cpuBestStreak:    0,
    cpuPerfectGames:  0,

    // VS CPU por dificultad
    cpuWinsEasy:   0,
    cpuWinsNormal: 0,
    cpuWinsHard:   0,

    // Local
    localGamesPlayed: 0,
    localP1Wins:      0,
    localP2Wins:      0,

    // Récords
    longestRally: 0,
    maxBallSpeed: 0,

    // Power-ups
    totalPowerupsCollected: 0,

    // Mecánicas de golpe (jugador 1)
    totalPerfectHits: 0,
    totalSpinHits:    0,
    totalSmashGoals:  0,
    totalSuperGoals:  0,
    totalFevers:      0,

    // Misiones diarias completadas (systems/missions.js)
    dailyMissionsDone: 0,

    // Temas usados (para logro "Explorador")
    themesUsed: [],

    // Logros desbloqueados: { id: "ISO-date-string" }
    achievements: {}
};

function loadStats() {
    const stored = readJSON(STATS_STORAGE_KEY, null, 'No se pudieron leer las estadísticas:');
    if (!stored) discardOldSave(STATS_STORAGE_KEY_V1);
    const saved = stored || {};
    return {
        ...DEFAULT_STATS,
        ...saved,
        achievements: { ...(saved.achievements || {}) },
        themesUsed:   [...(saved.themesUsed || [])]
    };
}

/** Guarda `gameStats` en localStorage. */
function saveStats() {
    writeJSON(STATS_STORAGE_KEY, gameStats, 'No se pudieron guardar las estadísticas:');
}

/** Borra solo las estadísticas numéricas, manteniendo los logros intactos */
function resetStats() {
    const preserved = { ...gameStats.achievements };
    Object.assign(gameStats, DEFAULT_STATS);
    gameStats.themesUsed = [];   // array propio: no compartir el de DEFAULT_STATS
    gameStats.achievements = preserved;
    saveStats();
}

// Estadísticas activas durante la sesión
const gameStats = loadStats();

// --- Variables de tracking en tiempo real (durante una partida) ---
let currentRally    = 0;   // golpes consecutivos en la ronda actual
let maxDeficit      = 0;   // mayor diferencia adversa (para logro remontada)
// Desde cuándo corre el reloj del tiempo jugado; -1 = parado (pausa, fuera de
// partida). No vale 0 como "parado": performance.now() puede valer 0.
let gameStartTimeMs = -1;
let matchElapsedMs  = 0;   // tiempo jugado en la partida (sin pausas, diálogos ni saques)
let matchBestRally  = 0;   // rally más largo de la partida
let matchReachedMaxSpeed = false;   // una bola llegó al máximo del preset en esta partida ("Demonio Veloz")
// Mecánicas de golpe en la partida (del jugador 1; la fiebre, de los dos)
let matchPerfect     = 0;   // golpes perfectos
let matchSpin        = 0;   // golpes con efecto
let matchSmashGoals  = 0;   // goles con la bola en smash
let matchSuperGoals  = 0;   // goles con la bola en súper
let matchFeverCount  = 0;   // fiebres del rally
let matchFeverPoints = 0;   // puntos del jugador 1 durante la fiebre (XP doble, fase 4)
let matchSmashUsed   = false;   // el jugador 1 hizo algún smash o súper (misión d_win_smash)

/** Llamar al iniciar una nueva partida */
function statsOnGameStart() {
    currentRally    = 0;
    maxDeficit      = 0;
    gameStartTimeMs = statsCountMatch() ? performance.now() : -1;
    matchElapsedMs  = 0;
    matchBestRally  = 0;
    matchReachedMaxSpeed = false;
    matchPerfect     = 0;
    matchSpin        = 0;
    matchSmashGoals  = 0;
    matchSuperGoals  = 0;
    matchFeverCount  = 0;
    matchFeverPoints = 0;
    matchSmashUsed   = false;
}

/** Una bola acaba de alcanzar la velocidad máxima del preset (desde hitPaddles). */
function statsOnMaxSpeed() {
    matchReachedMaxSpeed = true;
}

/**
 * Guarda la velocidad de una bola como récord si lo supera.
 * @param {number} speed
 */
function statsRecordBallSpeed(speed) {
    if (speed > gameStats.maxBallSpeed) {
        gameStats.maxBallSpeed = Math.round(speed * 10) / 10;
    }
}

/**
 * Suma tiempo de juego al reloj de la partida (HUD y fin de partida).
 * @param {number} ms
 */
function statsTickMatchClock(ms) {
    matchElapsedMs += ms;
}

/** El rally vuelve a cero sin guardar nada (un fallo en el modo práctica). */
function statsResetRally() {
    currentRally = 0;
}

/**
 * ¿La partida cuenta para las estadísticas guardadas? La práctica no:
 * ni tiempo jugado ni totales.
 */
function statsCountMatch() {
    return state.mode !== 'practice';
}

/** Llamar cuando la bola golpea una paleta */
function statsOnPaddleHit() {
    currentRally++;
    if (currentRally > matchBestRally) matchBestRally = currentRally;
    missionEvent('rally', currentRally);
}

/**
 * Tipo de golpe (desde resolveHit): cuenta los perfectos y los golpes con
 * efecto del jugador 1, y lo pasa a las misiones. Los totales se guardan
 * con el siguiente gol o al terminar.
 * @param {'p1'|'p2'} side
 * @param {HitType} type
 * @param {number} spin
 */
function statsOnHitType(side, type, spin) {
    if (side !== 'p1') return;
    const total = statsCountMatch() ? 1 : 0;
    if (type === 'perfect') { matchPerfect++; gameStats.totalPerfectHits += total; }
    if (Math.abs(spin) > MECH.spinSoundMin) { matchSpin++; gameStats.totalSpinHits += total; }
    if (type === 'smash' || type === 'super') matchSmashUsed = true;

    if (type === 'perfect' || type === 'block' || type === 'edge') missionEvent(type);
    if (Math.abs(spin) > MECH.spinSoundMin) missionEvent('spin');
}

/** Empieza una fiebre del rally. */
function statsOnFeverStart() {
    matchFeverCount++;
    if (statsCountMatch()) gameStats.totalFevers++;
    missionEvent('fever');
}

/**
 * Llamar cuando se anota un punto (antes de resetBall).
 * @param {boolean} scorerIsP1
 * @param {Ball} ball la bola que salió del campo (con multibola puede no ser la primera)
 */
function statsOnScore(scorerIsP1, ball) {
    // Actualizar rally más largo
    if (currentRally > gameStats.longestRally) {
        gameStats.longestRally = currentRally;
    }
    currentRally = 0;

    // Actualizar puntos (desde perspectiva de P1)
    if (scorerIsP1) {
        gameStats.totalPointsScored++;
    } else {
        gameStats.totalPointsConceded++;
    }

    // Rastrear mayor déficit (para comeback)
    const deficit = state.p2Score - state.p1Score;
    if (deficit > maxDeficit) maxDeficit = deficit;

    // Rastrear velocidad máxima de la bola que marcó
    statsRecordBallSpeed(ball.speed);

    // Goles del jugador 1 con smash o súper, y puntos durante la fiebre
    if (scorerIsP1 && ball.owner === 'p1') {
        if (ball.power === 'smash') { matchSmashGoals++; gameStats.totalSmashGoals++; }
        if (ball.power === 'super') { matchSuperGoals++; gameStats.totalSuperGoals++; }
    }
    if (scorerIsP1 && state.fever) matchFeverPoints++;

    if (scorerIsP1) missionEvent('point');
    if (scorerIsP1 && ball.owner === 'p1' && ball.power === 'smash') missionEvent('smash_goal');
    if (scorerIsP1 && ball.owner === 'p1' && ball.power === 'super') missionEvent('super_goal');

    saveStats();
}

/**
 * Llamar cuando termina una partida (checkWin).
 * @param {GameMode} mode
 * @param {boolean} p1Won
 * @param {number} p2FinalScore puntos del rival (0 = juego perfecto)
 */
function statsOnGameEnd(mode, p1Won, p2FinalScore) {
    gameStats.totalGamesPlayed++;

    // Tiempo jugado (con el reloj parado no hay nada que sumar). El reloj
    // se para aquí: si después se sale con "MENÚ PRINCIPAL", quitGame() no
    // vuelve a contar este tiempo.
    if (gameStartTimeMs >= 0) {
        gameStats.totalTimePlayedMs += performance.now() - gameStartTimeMs;
        gameStartTimeMs = -1;
    }

    // Último rally de la partida
    if (currentRally > gameStats.longestRally) {
        gameStats.longestRally = currentRally;
    }

    // Velocidad máxima: la más rápida de las bolas que queden (si no queda ninguna, nada)
    if (state.balls.length > 0) {
        statsRecordBallSpeed(Math.max(...state.balls.map(b => b.speed)));
    }

    if (mode === 'cpu') {
        if (p1Won) {
            gameStats.cpuWins++;
            gameStats.cpuCurrentStreak++;
            if (gameStats.cpuCurrentStreak > gameStats.cpuBestStreak) {
                gameStats.cpuBestStreak = gameStats.cpuCurrentStreak;
            }
            // Juego perfecto
            if (p2FinalScore === 0) {
                gameStats.cpuPerfectGames++;
            }
            // Victorias por dificultad
            if (settings.difficulty === 1)      gameStats.cpuWinsEasy++;
            else if (settings.difficulty === 2) gameStats.cpuWinsNormal++;
            else if (settings.difficulty === 3) gameStats.cpuWinsHard++;
        } else {
            gameStats.cpuLosses++;
            gameStats.cpuCurrentStreak = 0;
        }
    } else if (mode === 'local') {
        // Hachepe y campaña solo cuentan en los totales de arriba
        gameStats.localGamesPlayed++;
        if (p1Won) gameStats.localP1Wins++;
        else       gameStats.localP2Wins++;
    }

    // Misiones: las de victoria solo cuentan contra la máquina
    const info = { mode, difficulty: settings.difficulty, smashUsed: matchSmashUsed };
    missionEvent('game_end', 1, info);
    if (mode === 'local') {
        missionEvent('local_end', 1, info);
    } else if (p1Won) {
        missionEvent('win', 1, info);
        if (p2FinalScore === 0) missionEvent('perfect_game', 1, info);
        if (mode === 'campaign') missionEvent('campaign_win', 1, info);
    }

    saveStats();

    // Verificar logros después de guardar stats
    checkAllAchievements(mode, p1Won);
}

/** Registrar que se usó un tema (para logro Explorador) */
function statsTrackTheme(themeKey) {
    if (!gameStats.themesUsed.includes(themeKey)) {
        gameStats.themesUsed.push(themeKey);
        saveStats();
        // Verificar logro explorador
        checkAllAchievements();
    }
}

/** Guarda el tiempo acumulado (llamar periódicamente durante gameplay) */
function statsFlushTime() {
    if (gameStartTimeMs > 0) {
        const now = performance.now();
        gameStats.totalTimePlayedMs += (now - gameStartTimeMs);
        gameStartTimeMs = now;
        saveStats();
    }
}

/** Para el reloj del tiempo jugado (al pausar o abandonar): guarda lo que llevaba. */
function statsPauseClock() {
    statsFlushTime();
    gameStartTimeMs = -1;
}

/** Vuelve a poner en marcha el reloj al reanudar: el tiempo en pausa no cuenta. */
function statsResumeClock() {
    gameStartTimeMs = statsCountMatch() ? performance.now() : -1;
}

/** Formatea milisegundos a texto legible "Xh Ym" */
function formatPlayTime(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const hours     = Math.floor(totalSecs / 3600);
    const minutes   = Math.floor((totalSecs % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${totalSecs}s`;
}
