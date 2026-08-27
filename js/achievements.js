/**
 * achievements.js
 * ------------------------------------------------------------------
 * Catálogo de 20 logros, verificación de condiciones de desbloqueo,
 * y notificación visual (toast). Debe cargarse después de stats.js.
 * ------------------------------------------------------------------
 */

// --- Catálogo de logros ---
const ACHIEVEMENTS = [
    // 🏁 Inicio
    { id: 'first_win',      emoji: '🏓', name: 'Primer Victoria',  desc: 'Gana tu primera partida vs CPU',           category: 'Inicio' },
    { id: 'first_local',    emoji: '🤝', name: 'En Compañía',      desc: 'Juega tu primera partida local',            category: 'Inicio' },

    // 🔥 Rachas
    { id: 'streak_3',       emoji: '🔥', name: 'En Racha',         desc: 'Gana 3 partidas seguidas vs CPU',           category: 'Rachas' },
    { id: 'streak_5',       emoji: '💥', name: 'Imparable',        desc: 'Gana 5 partidas seguidas vs CPU',           category: 'Rachas' },
    { id: 'streak_10',      emoji: '⚡', name: 'Leyenda',          desc: 'Gana 10 partidas seguidas vs CPU',          category: 'Rachas' },

    // ⭐ Habilidad
    { id: 'perfect_game',   emoji: '⭐', name: 'Juego Perfecto',   desc: 'Gana sin que el rival anote un punto',      category: 'Habilidad' },
    { id: 'perfect_3',      emoji: '💎', name: 'Diamante',         desc: 'Consigue 3 juegos perfectos',               category: 'Habilidad' },
    { id: 'beat_impossible', emoji: '🧠', name: 'Gran Maestro',    desc: 'Vence a la CPU en dificultad Imposible',    category: 'Habilidad' },
    { id: 'rally_15',       emoji: '🏸', name: 'Peloteo',          desc: 'Consigue un rally de 15 golpes',            category: 'Habilidad' },
    { id: 'rally_30',       emoji: '🌪️', name: 'Tornado',         desc: 'Consigue un rally de 30 golpes',            category: 'Habilidad' },

    // 📊 Veteranía
    { id: 'games_10',       emoji: '🎮', name: 'Aficionado',       desc: 'Juega 10 partidas',                         category: 'Veteranía' },
    { id: 'games_50',       emoji: '🕹️', name: 'Veterano',        desc: 'Juega 50 partidas',                         category: 'Veteranía' },
    { id: 'games_100',      emoji: '👾', name: 'Adicto al Pong',   desc: 'Juega 100 partidas',                        category: 'Veteranía' },
    { id: 'points_100',     emoji: '💯', name: 'Centenar',         desc: 'Anota 100 puntos en total',                 category: 'Veteranía' },
    { id: 'points_500',     emoji: '🎯', name: 'Francotirador',    desc: 'Anota 500 puntos en total',                 category: 'Veteranía' },
    { id: 'time_1h',        emoji: '⏰', name: 'Pongmaníaco',      desc: 'Juega 1 hora en total',                     category: 'Veteranía' },

    // 🎲 Especiales
    { id: 'win_all_diff',   emoji: '🏆', name: 'Todoterreno',      desc: 'Gana al menos una vez en cada dificultad',  category: 'Especiales' },
    { id: 'comeback',       emoji: '🔄', name: 'Remontada',        desc: 'Gana tras ir perdiendo por 3+ puntos',      category: 'Especiales' },
    { id: 'speed_demon',    emoji: '🚀', name: 'Demonio Veloz',    desc: 'Alcanza la velocidad máxima de la bola',    category: 'Especiales' },
    { id: 'explorer',       emoji: '🎨', name: 'Explorador',       desc: 'Prueba todos los temas de color',           category: 'Especiales' },
    { id: 'beat_hachepe',   emoji: '👑', name: 'El Hachepe Definitivo', desc: 'Vence a la CPU en el Modo Hachepe', category: 'Especiales' }
];

/** Cola de notificaciones de logros pendientes */
const achievementQueue = [];
let isShowingAchievement = false;

/**
 * Desbloquea un logro si no estaba ya desbloqueado.
 * @returns {boolean} true si se desbloqueó ahora
 */
function unlockAchievement(id) {
    if (gameStats.achievements[id]) return false; // ya desbloqueado

    gameStats.achievements[id] = new Date().toISOString();
    saveStats();

    // Encolar notificación
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (achievement) {
        achievementQueue.push(achievement);
        processAchievementQueue();
    }
    return true;
}

/** Muestra las notificaciones de logros una por una */
function processAchievementQueue() {
    if (isShowingAchievement || achievementQueue.length === 0) return;
    isShowingAchievement = true;

    const achievement = achievementQueue.shift();
    showAchievementToast(achievement);
}

/** Muestra el toast visual de logro desbloqueado */
function showAchievementToast(achievement) {
    const toast = document.getElementById('achievement-toast');
    if (!toast) { isShowingAchievement = false; return; }

    const emojiEl = toast.querySelector('.achievement-toast__emoji');
    const nameEl  = toast.querySelector('.achievement-toast__name');
    const descEl  = toast.querySelector('.achievement-toast__desc');

    emojiEl.textContent = achievement.emoji;
    nameEl.textContent  = achievement.name;
    descEl.textContent  = achievement.desc;

    // SFX
    soundEffects.achievementUnlock();

    // Animación: aparecer
    toast.classList.remove('achievement-toast--hidden');
    toast.classList.add('achievement-toast--visible');

    // Desaparecer después de 3.5 segundos
    setTimeout(() => {
        toast.classList.remove('achievement-toast--visible');
        toast.classList.add('achievement-toast--hidden');

        setTimeout(() => {
            isShowingAchievement = false;
            processAchievementQueue(); // siguiente en cola
        }, 500); // esperar a que termine la animación de salida
    }, 3500);
}

/**
 * Verifica todas las condiciones de logros.
 * Se llama al terminar una partida y al cambiar tema.
 */
function checkAllAchievements(mode, p1Won, p1FinalScore, p2FinalScore) {
    const s = gameStats;

    // --- Inicio ---
    if (s.cpuWins >= 1)                                    unlockAchievement('first_win');
    if (s.localGamesPlayed >= 1)                           unlockAchievement('first_local');

    // --- Rachas ---
    if (s.cpuCurrentStreak >= 3 || s.cpuBestStreak >= 3)   unlockAchievement('streak_3');
    if (s.cpuCurrentStreak >= 5 || s.cpuBestStreak >= 5)   unlockAchievement('streak_5');
    if (s.cpuCurrentStreak >= 10 || s.cpuBestStreak >= 10) unlockAchievement('streak_10');

    // --- Habilidad ---
    if (s.cpuPerfectGames >= 1)                            unlockAchievement('perfect_game');
    if (s.cpuPerfectGames >= 3)                            unlockAchievement('perfect_3');
    if (s.cpuWinsHard >= 1)                                unlockAchievement('beat_impossible');
    if (s.longestRally >= 15)                              unlockAchievement('rally_15');
    if (s.longestRally >= 30)                              unlockAchievement('rally_30');

    // --- Veteranía ---
    if (s.totalGamesPlayed >= 10)                          unlockAchievement('games_10');
    if (s.totalGamesPlayed >= 50)                          unlockAchievement('games_50');
    if (s.totalGamesPlayed >= 100)                         unlockAchievement('games_100');
    if (s.totalPointsScored >= 100)                        unlockAchievement('points_100');
    if (s.totalPointsScored >= 500)                        unlockAchievement('points_500');
    if (s.totalTimePlayedMs >= 3600000)                    unlockAchievement('time_1h');

    // --- Especiales ---
    if (s.cpuWinsEasy >= 1 && s.cpuWinsNormal >= 1 && s.cpuWinsHard >= 1) {
        unlockAchievement('win_all_diff');
    }

    // Comeback: verificar solo si se acaba de terminar una partida CPU y P1 ganó
    if (mode === 'cpu' && p1Won && maxDeficit >= 3) {
        unlockAchievement('comeback');
    }

    // Speed demon: verificar si alcanzó la velocidad máxima del preset actual
    const speedPreset = BALL_SPEED_PRESETS[settings.ballSpeed] || BALL_SPEED_PRESETS[2];
    if (s.maxBallSpeed >= speedPreset.max) {
        unlockAchievement('speed_demon');
    }

    // Explorador: todos los temas probados
    if (s.themesUsed.length >= Object.keys(THEMES).length) {
        unlockAchievement('explorer');
    }
}

/** Cuenta cuántos logros están desbloqueados */
function getUnlockedCount() {
    return Object.keys(gameStats.achievements).length;
}

/** Retorna info de un logro por ID */
function getAchievementById(id) {
    return ACHIEVEMENTS.find(a => a.id === id) || null;
}
