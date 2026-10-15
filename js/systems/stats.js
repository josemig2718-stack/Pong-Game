/**
 * systems/stats.js
 * ------------------------------------------------------------------
 * Sistema de estadísticas persistentes. Almacena en localStorage
 * contadores de partidas, puntos, rachas, récords y tiempo jugado.
 * ------------------------------------------------------------------
 */

'use strict';

const STATS_STORAGE_KEY = 'pongGame.stats.v1';

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

    // Temas usados (para logro "Explorador")
    themesUsed: [],

    // Logros desbloqueados: { id: "ISO-date-string" }
    achievements: {}
};

function loadStats() {
    const saved = readJSON(STATS_STORAGE_KEY, {}, 'No se pudieron leer las estadísticas:');
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
let gameStartTimeMs = 0;   // timestamp de inicio de partida (para tiempo jugado)
let matchElapsedMs  = 0;   // tiempo jugado en la partida (sin pausas, diálogos ni saques)
let matchBestRally  = 0;   // rally más largo de la partida
let matchReachedMaxSpeed = false;   // una bola llegó al máximo del preset en esta partida ("Demonio Veloz")

/** Llamar al iniciar una nueva partida */
function statsOnGameStart() {
    currentRally    = 0;
    maxDeficit      = 0;
    gameStartTimeMs = performance.now();
    matchElapsedMs  = 0;
    matchBestRally  = 0;
    matchReachedMaxSpeed = false;
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

/** Llamar cuando la bola golpea una paleta */
function statsOnPaddleHit() {
    currentRally++;
    if (currentRally > matchBestRally) matchBestRally = currentRally;
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

    saveStats();
}

/**
 * Llamar cuando termina una partida (checkWin).
 * @param {string} mode
 * @param {boolean} p1Won
 * @param {number} p2FinalScore puntos del rival (0 = juego perfecto)
 */
function statsOnGameEnd(mode, p1Won, p2FinalScore) {
    gameStats.totalGamesPlayed++;

    // Tiempo jugado
    const elapsed = performance.now() - gameStartTimeMs;
    gameStats.totalTimePlayedMs += elapsed;

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

/** Formatea milisegundos a texto legible "Xh Ym" */
function formatPlayTime(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const hours     = Math.floor(totalSecs / 3600);
    const minutes   = Math.floor((totalSecs % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${totalSecs}s`;
}
