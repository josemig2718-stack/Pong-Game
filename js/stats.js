/**
 * stats.js
 * ------------------------------------------------------------------
 * Sistema de estadísticas persistentes. Almacena en localStorage
 * contadores de partidas, puntos, rachas, récords y tiempo jugado.
 * Debe cargarse después de config.js.
 * ------------------------------------------------------------------
 */

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

    // Temas usados (para logro "Explorador")
    themesUsed: [],

    // Logros desbloqueados: { id: "ISO-date-string" }
    achievements: {}
};

function loadStats() {
    let saved = {};
    try {
        const raw = localStorage.getItem(STATS_STORAGE_KEY);
        if (raw) saved = JSON.parse(raw);
    } catch (err) {
        console.warn('No se pudieron leer las estadísticas:', err);
    }
    return {
        ...DEFAULT_STATS,
        ...saved,
        achievements: { ...(saved.achievements || {}) },
        themesUsed:   [...(saved.themesUsed || [])]
    };
}

function saveStats() {
    try {
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(gameStats));
    } catch (err) {
        console.warn('No se pudieron guardar las estadísticas:', err);
    }
}

/** Borra solo las estadísticas numéricas, manteniendo los logros intactos */
function resetStats() {
    const preserved = { ...gameStats.achievements };
    Object.assign(gameStats, DEFAULT_STATS);
    gameStats.achievements = preserved;
    saveStats();
}

// Estadísticas activas durante la sesión
const gameStats = loadStats();

// --- Variables de tracking en tiempo real (durante una partida) ---
let currentRally    = 0;   // golpes consecutivos en la ronda actual
let maxDeficit      = 0;   // mayor diferencia adversa (para logro remontada)
let gameStartTimeMs = 0;   // timestamp de inicio de partida (para tiempo jugado)

/** Llamar al iniciar una nueva partida */
function statsOnGameStart() {
    currentRally    = 0;
    maxDeficit      = 0;
    gameStartTimeMs = performance.now();
}

/** Llamar cuando la bola golpea una paleta */
function statsOnPaddleHit() {
    currentRally++;
}

/** Llamar cuando se anota un punto (antes de resetBall) */
function statsOnScore(scorerIsP1) {
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
    if (typeof p2Score !== 'undefined' && typeof p1Score !== 'undefined') {
        const deficit = p2Score - p1Score;
        if (deficit > maxDeficit) maxDeficit = deficit;
    }

    // Rastrear velocidad máxima de la bola
    if (typeof ball !== 'undefined' && ball.speed > gameStats.maxBallSpeed) {
        gameStats.maxBallSpeed = Math.round(ball.speed * 10) / 10;
    }

    saveStats();
}

/** Llamar cuando termina una partida (checkWin) */
function statsOnGameEnd(mode, p1Won, p1FinalScore, p2FinalScore) {
    gameStats.totalGamesPlayed++;

    // Tiempo jugado
    const elapsed = performance.now() - gameStartTimeMs;
    gameStats.totalTimePlayedMs += elapsed;

    // Último rally de la partida
    if (currentRally > gameStats.longestRally) {
        gameStats.longestRally = currentRally;
    }

    // Velocidad máxima
    if (typeof ball !== 'undefined' && ball.speed > gameStats.maxBallSpeed) {
        gameStats.maxBallSpeed = Math.round(ball.speed * 10) / 10;
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
    } else {
        gameStats.localGamesPlayed++;
        if (p1Won) gameStats.localP1Wins++;
        else       gameStats.localP2Wins++;
    }

    saveStats();

    // Verificar logros después de guardar stats
    if (typeof checkAllAchievements === 'function') {
        checkAllAchievements(mode, p1Won, p1FinalScore, p2FinalScore);
    }
}

/** Registrar que se usó un tema (para logro Explorador) */
function statsTrackTheme(themeKey) {
    if (!gameStats.themesUsed.includes(themeKey)) {
        gameStats.themesUsed.push(themeKey);
        saveStats();
        // Verificar logro explorador
        if (typeof checkAllAchievements === 'function') {
            checkAllAchievements();
        }
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
