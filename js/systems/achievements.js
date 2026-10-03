/**
 * systems/achievements.js
 * ------------------------------------------------------------------
 * Desbloqueo de logros, verificación de sus condiciones y aviso visual
 * (toast). El catálogo está en data/achievements.js.
 * ------------------------------------------------------------------
 */

import { BALL_SPEED_PRESETS } from '../core/constants.js';
import { settings } from '../core/settings.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { THEMES } from '../data/themes.js';
import { soundEffects } from './audio.js';
import { gameStats, maxDeficit, saveStats } from './stats.js';
import { powerupsThisGame } from '../game/powerups.js';

/** Cola de notificaciones de logros pendientes */
const achievementQueue = [];
let isShowingAchievement = false;

/**
 * Desbloquea un logro si no estaba ya desbloqueado.
 * @returns {boolean} true si se desbloqueó ahora
 */
export function unlockAchievement(id) {
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
export function checkAllAchievements(mode, p1Won, p1FinalScore, p2FinalScore) {
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

    // --- Nuevos (Power-ups) ---
    if (s.totalPowerupsCollected >= 50) {
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
export function getVisibleAchievementsTotal() {
    return ACHIEVEMENTS.filter(a => !a.secret || gameStats.achievements[a.id]).length;
}

export function getUnlockedCount() {
    return Object.keys(gameStats.achievements).length;
}
