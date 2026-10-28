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
    reach_level_5:     { target: 21,  value: () => playerProgression.level },   // rango Experto
    reach_level_10:    { target: 50,  value: () => playerProgression.level },
    level_25:          { target: 25,  value: () => playerProgression.level },
    prestige_1:        { target: 1,   value: () => playerProgression.prestige },
    // Solo los objetos de pago: los exclusivos no entran
    fashionista:       { target: () => getTotalShopItems(), value: () => getTotalPurchasedItems() },
    perfect_100:       { target: 100, value: () => gameStats.totalPerfectHits },
    smash_goals_25:    { target: 25,  value: () => gameStats.totalSmashGoals },
    super_goals_10:    { target: 10,  value: () => gameStats.totalSuperGoals },
    rally_50:          { target: 50,  value: () => gameStats.longestRally },
    missions_10:       { target: 10,  value: () => playerProgression.missionsCompleted },
    missions_50:       { target: 50,  value: () => playerProgression.missionsCompleted },
    weekly_first:      { target: 1,   value: () => playerProgression.weeklyCompleted }
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

/** Glifo y color (el de Progreso) de la medalla del aviso de misión completada. */
const MISSION_TOAST_COLOR = '#818CF8';
const MISSION_TOAST_ICON = 'M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9';

/**
 * Aviso de misión completada: con el estilo del de logro, en la misma
 * cola, pero con su propia cabecera, el texto de la misión y lo que paga.
 * @param {Mission} mission
 */
function showMissionToast(mission) {
    const reward = `+${mission.xp} XP` + (mission.coins > 0 ? ` · +${mission.coins} monedas` : '');
    achievementQueue.push(/** @type {Achievement} */ ({
        id: mission.id, category: 'especiales', name: mission.text, desc: reward,
        icon: MISSION_TOAST_ICON, color: MISSION_TOAST_COLOR, mission: true
    }));
    processAchievementQueue();
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
    const titleEl = toast.querySelector('.achievement-toast__title');
    const nameEl  = toast.querySelector('.achievement-toast__name');
    const descEl  = toast.querySelector('.achievement-toast__desc');

    medalEl.innerHTML = achievementMedalSVG(achievement, 'unlocked');
    toast.style.setProperty('--ach-color', achievementColor(achievement));
    titleEl.textContent = achievement.mission ? '¡MISIÓN COMPLETADA!' : '¡LOGRO DESBLOQUEADO!';
    nameEl.textContent  = achievement.name;
    descEl.textContent  = achievement.desc;

    // SFX (la misión ya sonó al completarse)
    if (!achievement.mission) soundEffects.achievementUnlock();

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

    // Demonio Veloz: una bola llegó al máximo del preset en esta misma partida
    // (no vale el récord histórico, que puede ser de un preset más rápido)
    if (matchReachedMaxSpeed) {
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

    // --- Mecánicas ---
    if (s.totalSpinHits >= 1)                              unlockAchievement('spin_first');
    if (matchPerfect >= 10)                                unlockAchievement('perfect_10');
    if (achievementGoalMet('perfect_100'))                 unlockAchievement('perfect_100');
    if (s.totalSmashGoals >= 1)                            unlockAchievement('smash_first');
    if (achievementGoalMet('smash_goals_25'))              unlockAchievement('smash_goals_25');
    if (s.totalSuperGoals >= 1)                            unlockAchievement('super_first');
    if (achievementGoalMet('super_goals_10'))              unlockAchievement('super_goals_10');
    if (s.totalFevers >= 1)                                unlockAchievement('fever_first');
    if (achievementGoalMet('rally_50'))                    unlockAchievement('rally_50');

    // Nivel y tienda: también al terminar una partida (con `mode`), no solo
    // al subir de nivel o al comprar, para que se pongan al día. No al
    // estrenar un tema: eso pasa al abrir el juego y no debe dar avisos.
    if (mode) {
        checkLevelAchievements();
        checkMissionAchievements();
        if (achievementGoalMet('fashionista'))    unlockAchievement('fashionista');
        if (getTotalPurchasedItems() >= 1)        unlockAchievement('grow_partner');
    }
    
    // Sin Ayuda: ganó contra la máquina con power-ups activados, apareció al
    // menos uno y eligió no cogerlo
    const vsMachine = mode === 'cpu' || mode === 'hachepe' || mode === 'campaign';
    if (vsMachine && p1Won && settings.powerupsEnabled &&
        powerupsSpawnedThisGame >= 1 && powerupsThisGame === 0) {
        unlockAchievement('no_powerups_win');
    }
}

/** Logros de nivel y prestigio (al subir de nivel y al terminar una partida). */
function checkLevelAchievements() {
    for (const id of ['reach_level_5', 'level_25', 'reach_level_10', 'prestige_1']) {
        if (achievementGoalMet(id)) unlockAchievement(id);
    }
}

/** Logros de misiones (al completar una y al terminar una partida). */
function checkMissionAchievements() {
    for (const id of ['missions_10', 'missions_50', 'weekly_first']) {
        if (achievementGoalMet(id)) unlockAchievement(id);
    }
}

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
