// ==========================================
// progression.js
// Sistema de Progresión, Niveles, y Monedas
// ==========================================

const PROG_STORAGE_KEY = 'pongGame.progression.v1';

const LEVELS = [
    { level: 1,  title: 'Novato',        xpRequired: 0,    coinBonus: 0 },
    { level: 2,  title: 'Aprendiz',       xpRequired: 141,  coinBonus: 20 },
    { level: 3,  title: 'Jugador',        xpRequired: 259,  coinBonus: 30 },
    { level: 4,  title: 'Competidor',     xpRequired: 400,  coinBonus: 40 },
    { level: 5,  title: 'Experto',        xpRequired: 559,  coinBonus: 50 },
    { level: 6,  title: 'Veterano',       xpRequired: 735,  coinBonus: 60 },
    { level: 7,  title: 'Campeón',        xpRequired: 926,  coinBonus: 80 },
    { level: 8,  title: 'Maestro',        xpRequired: 1131, coinBonus: 100 },
    { level: 9,  title: 'Gran Maestro',   xpRequired: 1350, coinBonus: 120 },
    { level: 10, title: 'Leyenda',        xpRequired: 1581, coinBonus: 200 }
];

const XP_REWARDS = {
    winCpuEasy: 15,
    winCpuNormal: 25,
    winCpuHard: 40,
    winHachepe: 100,
    perfectGame: 20,
    scorePoint: 2,
    completeLocal: 10,
    unlockAchievement: 30
};

const COIN_REWARDS = {
    winCpu: 5,
    winHachepe: 20,
    // NO coins for local mode (user explicitly requested this to prevent exploitation)
    perfectGame: 10,
    unlockAchievement: 8
};

const DEFAULT_PROGRESSION = {
    totalXP: 0,
    level: 1,
    chemiCoins: 0,
    selectedTrail: 'default',
    selectedBg: 'none',
    selectedPaddle: 'classic',
    selectedGoalFx: 'classic',
    purchasedItems: ['default', 'none', 'classic']  // Free items pre-purchased
};

let playerProgression = loadProgression();

// Session trackers for end-of-game summary
let sessionXPGained = 0;
let sessionCoinsGained = 0;
let sessionLeveledUp = false;
let sessionNewLevel = 0;
let sessionNewTitle = '';

/**
 * Carga la progresión desde localStorage y combina con los valores por defecto
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
function saveProgression() {
    try {
        localStorage.setItem(PROG_STORAGE_KEY, JSON.stringify(playerProgression));
    } catch (e) {
        console.warn("Error guardando progresión:", e);
    }
}

/**
 * Reinicia las variables de sesión
 */
function resetSessionTrackers() {
    sessionXPGained = 0;
    sessionCoinsGained = 0;
    sessionLeveledUp = false;
    sessionNewLevel = 0;
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
        sessionNewLevel = newLevelObj.level;
        sessionNewTitle = newLevelObj.title;
        
        addCoins(newLevelObj.coinBonus);
        
        if (typeof soundEffects !== 'undefined' && soundEffects.levelUp) {
            soundEffects.levelUp();
        }
        
        if (typeof unlockAchievement === 'function') {
            if (playerProgression.level >= 5) unlockAchievement('level_5');
            if (playerProgression.level >= 10) unlockAchievement('level_10');
        }
    }
}

/**
 * Devuelve el objeto del nivel actual
 */
function getCurrentLevel() {
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
function getXPProgress() {
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
function hasItem(itemId) {
    return playerProgression.purchasedItems.includes(itemId);
}

/**
 * Compra un objeto de la tienda
 */
function purchaseItem(itemId, cost) {
    if (spendCoins(cost)) {
        playerProgression.purchasedItems.push(itemId);
        saveProgression();
        
        if (playerProgression.purchasedItems.length === DEFAULT_PROGRESSION.purchasedItems.length + 1) {
            if (typeof unlockAchievement === 'function') unlockAchievement('grow_partner');
        }
        return true;
    }
    return false;
}

/**
 * Selecciona un cosmético para usar
 */
function selectCosmetic(category, id) {
    switch (category) {
        case 'trail':
            playerProgression.selectedTrail = id;
            if (typeof setActiveTrail === 'function') setActiveTrail(id);
            break;
        case 'bg':
            playerProgression.selectedBg = id;
            if (typeof setActiveBg === 'function') setActiveBg(id);
            break;
        case 'paddle':
            playerProgression.selectedPaddle = id;
            if (typeof setActivePaddle === 'function') setActivePaddle(id);
            break;
        case 'goalFx':
            playerProgression.selectedGoalFx = id;
            if (typeof setActiveGoalFx === 'function') setActiveGoalFx(id);
            break;
    }
    saveProgression();
}

/**
 * Entrega recompensas de final de partida
 */
function awardGameRewards(mode, p1Won, p1Score, p2Score) {
    addXP(p1Score * XP_REWARDS.scorePoint);
    
    if (mode === 'cpu' && p1Won) {
        let diff = (typeof settings !== 'undefined' && settings.difficulty) ? settings.difficulty : 2;
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
    
    if (p1Won && p2Score === 0) {
        addXP(XP_REWARDS.perfectGame);
        addCoins(COIN_REWARDS.perfectGame);
    }
    
    saveProgression();
}
