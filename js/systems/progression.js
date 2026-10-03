/**
 * systems/progression.js
 * ------------------------------------------------------------------
 * Progresión del jugador: XP, nivel, Chemi Coins, objetos comprados,
 * cosméticos equipados y avance de la campaña. Se guarda en
 * localStorage (clave pongGame.progression.v1).
 *
 * Las tablas de niveles y recompensas están en data/levels.js.
 * ------------------------------------------------------------------
 */

import { settings } from '../core/settings.js';
import { writeJSON } from '../core/storage.js';
import { CAMPAIGN_REPLAY_FACTOR, COIN_REWARDS, LEVELS, XP_REWARDS } from '../data/levels.js';
import { CAMPAIGN_CREATOR } from '../data/lore.js';
import { unlockAchievement } from './achievements.js';
import { soundEffects } from './audio.js';
import { setActiveBg } from '../vfx/backgrounds.js';
import { currentCampaignLevel, isReplayingBoss } from '../campaign/progress.js';

const PROG_STORAGE_KEY = 'pongGame.progression.v1';

const DEFAULT_PROGRESSION = {
    totalXP: 0,
    level: 1,
    chemiCoins: 0,
    selectedTrail: 'default',
    selectedBg: 'none',
    selectedPaddle: 'classic',
    selectedGoalFx: 'classic',
    purchasedItems: ['default', 'none', 'classic'],  // Free items pre-purchased
    campaignProgress: 1, // Nivel de la campaña (1 a 6)
    campaignIntroSeen: false // Si ya vio la historia inicial
};

export const playerProgression = loadProgression();

// Session trackers for end-of-game summary
export let sessionXPGained = 0;
export let sessionCoinsGained = 0;
export let sessionLeveledUp = false;
export let sessionNewTitle = '';

/**
 * Carga la progresión desde localStorage y combina con los valores por defecto.
 * No usa readJSON(): aquí la combinación va dentro del try, así que una
 * partida guardada ilegible (incluido el JSON `null`) vuelve a los valores
 * por defecto en vez de romper la carga.
 */
function loadProgression() {
    try {
        const saved = localStorage.getItem(PROG_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return { ...DEFAULT_PROGRESSION, ...parsed, purchasedItems: parsed.purchasedItems || DEFAULT_PROGRESSION.purchasedItems };
        }
    } catch (e) {
        console.warn("Error cargando progresión:", e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_PROGRESSION));
}

/**
 * Guarda la progresión en localStorage
 */
export function saveProgression() {
    writeJSON(PROG_STORAGE_KEY, playerProgression, 'Error guardando progresión:');
}

/**
 * Reinicia las variables de sesión
 */
export function resetSessionTrackers() {
    sessionXPGained = 0;
    sessionCoinsGained = 0;
    sessionLeveledUp = false;
    sessionNewTitle = '';
}

/**
 * Agrega experiencia al jugador
 */
function addXP(amount) {
    if (amount <= 0) return;
    playerProgression.totalXP += amount;
    sessionXPGained += amount;
    checkLevelUp();
    saveProgression();
}

/**
 * Agrega Chemi Coins
 */
function addCoins(amount) {
    if (amount <= 0) return;
    playerProgression.chemiCoins += amount;
    sessionCoinsGained += amount;
    saveProgression();
}

/**
 * Gasta Chemi Coins
 */
function spendCoins(amount) {
    if (playerProgression.chemiCoins >= amount) {
        playerProgression.chemiCoins -= amount;
        saveProgression();
        return true;
    }
    return false;
}

/**
 * Comprueba si el jugador subió de nivel
 */
function checkLevelUp() {
    let currentLevelObj = getCurrentLevel();
    
    let newLevelObj = currentLevelObj;
    for (let i = 0; i < LEVELS.length; i++) {
        if (playerProgression.totalXP >= LEVELS[i].xpRequired) {
            newLevelObj = LEVELS[i];
        }
    }

    if (newLevelObj.level > playerProgression.level) {
        playerProgression.level = newLevelObj.level;
        sessionLeveledUp = true;
        sessionNewTitle = newLevelObj.title;
        
        addCoins(newLevelObj.coinBonus);
        
        soundEffects.levelUp();
        
        // Los ids del catálogo son reach_level_*, no level_*
        if (playerProgression.level >= 5) unlockAchievement('reach_level_5');
        if (playerProgression.level >= 10) unlockAchievement('reach_level_10');
    }
}

/**
 * Devuelve el objeto del nivel actual
 */
export function getCurrentLevel() {
    let current = LEVELS[0];
    for (let i = 0; i < LEVELS.length; i++) {
        if (playerProgression.totalXP >= LEVELS[i].xpRequired) {
            current = LEVELS[i];
        } else {
            break;
        }
    }
    return current;
}

/**
 * Calcula el progreso hacia el siguiente nivel
 */
export function getXPProgress() {
    let currentLvl = getCurrentLevel();
    let nextLvlIndex = currentLvl.level; // porque el index es nivel-1
    
    if (nextLvlIndex >= LEVELS.length) {
        return { current: 0, required: 1, percentage: 100 };
    }
    
    let nextLvl = LEVELS[nextLvlIndex];
    let xpInCurrentLevel = playerProgression.totalXP - currentLvl.xpRequired;
    let xpNeededForNext = nextLvl.xpRequired - currentLvl.xpRequired;
    let percentage = (xpInCurrentLevel / xpNeededForNext) * 100;
    
    return {
        current: xpInCurrentLevel,
        required: xpNeededForNext,
        percentage: Math.min(Math.max(percentage, 0), 100)
    };
}

/**
 * Comprueba si tiene un objeto
 */
export function hasItem(itemId) {
    return playerProgression.purchasedItems.includes(itemId);
}

/**
 * Compra un objeto de la tienda
 */
export function purchaseItem(itemId, cost) {
    if (spendCoins(cost)) {
        playerProgression.purchasedItems.push(itemId);
        saveProgression();
        
        if (playerProgression.purchasedItems.length === DEFAULT_PROGRESSION.purchasedItems.length + 1) {
            unlockAchievement('grow_partner');
        }
        return true;
    }
    return false;
}

/**
 * Selecciona un cosmético para usar
 */
export function selectCosmetic(category, id) {
    switch (category) {
        case 'trail':
            playerProgression.selectedTrail = id;
            break;
        case 'bg':
            playerProgression.selectedBg = id;
            setActiveBg(id);
            break;
        case 'paddle':
            playerProgression.selectedPaddle = id;
            break;
        case 'goalFx':
            playerProgression.selectedGoalFx = id;
            break;
    }
    saveProgression();
}

/**
 * Entrega recompensas de final de partida
 */
export function awardGameRewards(mode, p1Won, p1Score, p2Score) {
    addXP(p1Score * XP_REWARDS.scorePoint);
    
    if (mode === 'cpu' && p1Won) {
        let diff = (settings.difficulty) ? settings.difficulty : 2;
        if (diff === 1) addXP(XP_REWARDS.winCpuEasy);
        else if (diff === 3) addXP(XP_REWARDS.winCpuHard);
        else addXP(XP_REWARDS.winCpuNormal);
        
        addCoins(COIN_REWARDS.winCpu);
    } 
    else if (mode === 'hachepe' && p1Won) {
        addXP(XP_REWARDS.winHachepe);
        addCoins(COIN_REWARDS.winHachepe);
    }
    else if (mode === 'local') {
        addXP(XP_REWARDS.completeLocal);
    }
    else if (mode === 'campaign' && p1Won) {
        const level = currentCampaignLevel;
        const isCreator = level === CAMPAIGN_CREATOR;
        // Repetir un jefe ya vencido paga mucho menos
        const factor = (isReplayingBoss) ? CAMPAIGN_REPLAY_FACTOR : 1;

        const xp = isCreator ? XP_REWARDS.winCreator : XP_REWARDS.winCampaignBase * level;
        const coins = isCreator ? COIN_REWARDS.winCreator : COIN_REWARDS.winCampaignBase * level;

        addXP(Math.round(xp * factor));
        addCoins(Math.round(coins * factor));
    }
    
    if (p1Won && p2Score === 0) {
        addXP(XP_REWARDS.perfectGame);
        addCoins(COIN_REWARDS.perfectGame);
    }
    
    saveProgression();
}
