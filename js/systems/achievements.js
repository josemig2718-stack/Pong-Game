/**
 * systems/achievements.js
 * ------------------------------------------------------------------
 * Desbloqueo de logros, verificación de sus condiciones y aviso visual
 * (toast). El catálogo está en data/achievements.js.
 * ------------------------------------------------------------------
 */

'use strict';

/** Cola de notificaciones de logros pendientes */
const achievementQueue = [];
let isShowingAchievement = false;

/**
 * Metas de los logros que se consiguen acumulando algo. La misma tabla
 * decide el desbloqueo (achievementGoalMet) y pinta la barra de progreso
 * (getAchievementProgress), para que nunca usen números distintos.
 * Las metas que dependen de otro catálogo se calculan al pedirlas.
 * @type {Record<string, {target: number | (() => number), value: () => number}>}
 */
const ACHIEVEMENT_GOALS = {
    // Vale la racha actual o la mejor: basta con haberla alcanzado alguna vez
    streak_3:          { target: 3,   value: () => Math.max(gameStats.cpuCurrentStreak, gameStats.cpuBestStreak) },
    streak_5:          { target: 5,   value: () => Math.max(gameStats.cpuCurrentStreak, gameStats.cpuBestStreak) },
    streak_10:         { target: 10,  value: () => Math.max(gameStats.cpuCurrentStreak, gameStats.cpuBestStreak) },
    perfect_3:         { target: 3,   value: () => gameStats.cpuPerfectGames },
    rally_15:          { target: 15,  value: () => gameStats.longestRally },
    rally_30:          { target: 30,  value: () => gameStats.longestRally },
    games_10:          { target: 10,  value: () => gameStats.totalGamesPlayed },
    games_50:          { target: 50,  value: () => gameStats.totalGamesPlayed },
    games_100:         { target: 100, value: () => gameStats.totalGamesPlayed },
    points_100:        { target: 100, value: () => gameStats.totalPointsScored },
    points_500:        { target: 500, value: () => gameStats.totalPointsScored },
    time_1h:           { target: 60,  value: () => Math.floor(gameStats.totalTimePlayedMs / 60000) },   // minutos
    win_all_diff:      { target: 3,   value: () => [gameStats.cpuWinsEasy, gameStats.cpuWinsNormal, gameStats.cpuWinsHard].filter(n => n > 0).length },
    explorer:          { target: () => Object.keys(THEMES).length, value: () => gameStats.themesUsed.length },
    powerup_collector: { target: 50,  value: () => gameStats.totalPowerupsCollected },
    reach_level_5:     { target: 5,   value: () => playerProgression.level },
    reach_level_10:    { target: 10,  value: () => playerProgression.level },
    fashionista:       { target: () => getTotalShopItems(), value: () => getTotalPurchasedItems() }
};

/** Meta numérica de un logro acumulativo. */
function achievementGoalTarget(id) {
    const target = ACHIEVEMENT_GOALS[id].target;
    return typeof target === 'function' ? target() : target;
}

/** ¿Se ha alcanzado ya la meta de este logro? */
function achievementGoalMet(id) {
    return ACHIEVEMENT_GOALS[id].value() >= achievementGoalTarget(id);
}

/**
 * Progreso hacia un logro acumulativo, o null si es de una sola vez.
 * @returns {{current: number, target: number} | null}
 */
function getAchievementProgress(id) {
    const goal = ACHIEVEMENT_GOALS[id];
    if (!goal) return null;
    const target = achievementGoalTarget(id);
    return { current: Math.min(goal.value(), target), target };
}

/**
 * Estado de un logro para la pantalla: desbloqueado, en progreso (algo
 * avanzado), bloqueado, o secreto (bloqueado y sin revelar nada).
 * @param {Achievement} ach
 * @returns {'unlocked'|'progress'|'locked'|'secret'}
 */
function getAchievementState(ach) {
    if (gameStats.achievements[ach.id]) return 'unlocked';
    if (ach.secret) return 'secret';
    const progress = getAchievementProgress(ach.id);
    return progress && progress.current > 0 ? 'progress' : 'locked';
}

/**
 * El último logro desbloqueado (la fecha más reciente), o null.
 * @returns {Achievement | null}
 */
function getLastUnlockedAchievement() {
    let last = null, lastDate = '';
    ACHIEVEMENTS.forEach(ach => {
        const date = gameStats.achievements[ach.id];
        if (date && date >= lastDate) { last = ach; lastDate = date; }
    });
    return last;
}

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

    const medalEl = toast.querySelector('.achievement-toast__medal');
    const nameEl  = toast.querySelector('.achievement-toast__name');
    const descEl  = toast.querySelector('.achievement-toast__desc');

    medalEl.innerHTML = achievementMedalSVG(achievement, 'unlocked');
    toast.style.setProperty('--ach-color', achievementColor(achievement));
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
function checkAllAchievements(mode, p1Won) {
    const s = gameStats;

    // --- Inicio ---
    if (s.cpuWins >= 1)                                    unlockAchievement('first_win');
    if (s.localGamesPlayed >= 1)                           unlockAchievement('first_local');

    // --- Rachas ---
    if (achievementGoalMet('streak_3'))                    unlockAchievement('streak_3');
    if (achievementGoalMet('streak_5'))                    unlockAchievement('streak_5');
    if (achievementGoalMet('streak_10'))                   unlockAchievement('streak_10');

    // --- Habilidad ---
    if (s.cpuPerfectGames >= 1)                            unlockAchievement('perfect_game');
    if (achievementGoalMet('perfect_3'))                   unlockAchievement('perfect_3');
    if (s.cpuWinsHard >= 1)                                unlockAchievement('beat_impossible');
    if (achievementGoalMet('rally_15'))                    unlockAchievement('rally_15');
    if (achievementGoalMet('rally_30'))                    unlockAchievement('rally_30');

    // --- Veteranía ---
    if (achievementGoalMet('games_10'))                    unlockAchievement('games_10');
    if (achievementGoalMet('games_50'))                    unlockAchievement('games_50');
    if (achievementGoalMet('games_100'))                   unlockAchievement('games_100');
    if (achievementGoalMet('points_100'))                  unlockAchievement('points_100');
    if (achievementGoalMet('points_500'))                  unlockAchievement('points_500');
    if (achievementGoalMet('time_1h'))                     unlockAchievement('time_1h');

    // --- Especiales ---
    if (achievementGoalMet('win_all_diff')) {
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
    if (achievementGoalMet('explorer')) {
        unlockAchievement('explorer');
    }

    // --- Nuevos (Power-ups) ---
    if (achievementGoalMet('powerup_collector')) {
        unlockAchievement('powerup_collector');
    }
    
    // Sin ayuda (si ganó y no recogió power-ups en esta partida)
    if (p1Won && powerupsThisGame === 0) {
        unlockAchievement('no_powerups_win');
    }
}

/** Cuenta cuántos logros están desbloqueados */
/**
 * Total de logros a efectos de contador. Un secreto aún bloqueado no se
 * cuenta: si no, el marcador delataría que existe algo escondido.
 */
function getVisibleAchievementsTotal() {
    return ACHIEVEMENTS.filter(a => !a.secret || gameStats.achievements[a.id]).length;
}

/**
 * @returns {number} logros desbloqueados, secretos incluidos
 */
function getUnlockedCount() {
    return Object.keys(gameStats.achievements).length;
}
