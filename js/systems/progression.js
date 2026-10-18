/**
 * systems/progression.js
 * ------------------------------------------------------------------
 * Progresión del jugador: XP, nivel, Chemi Coins, objetos comprados,
 * cosméticos equipados y avance de la campaña. Se guarda en
 * localStorage (clave pongGame.progression.v2).
 *
 * La fase 4 de la v2 reinició el progreso: una partida guardada con la
 * clave v1 se borra al cargar (ver discardOldSave en core/settings.js).
 * Las compras se guardan con su categoría ('trails:neon'): hay ids
 * repetidos entre categorías ('classic' es paleta y efecto de gol).
 *
 * Las tablas de niveles y recompensas están en data/levels.js.
 * ------------------------------------------------------------------
 */

'use strict';

const PROG_STORAGE_KEY = 'pongGame.progression.v2';
const PROG_STORAGE_KEY_V1 = 'pongGame.progression.v1';

const DEFAULT_PROGRESSION = {
    totalXP: 0,
    level: 1,                 // 1–50
    prestige: 0,              // estrellas de prestigio
    coins: 0,                 // Chemi Coins
    owned: ['trails:default', 'backgrounds:none', 'paddles:classic', 'goalEffects:classic',
            'balls:classic', 'super:energy', 'music:partida_synthwave'],
    equipped: { trails: 'default', backgrounds: 'none', paddles: 'classic', goalEffects: 'classic',
                balls: 'classic', super: 'energy', music: 'partida_synthwave' },
    rewardedLevel: 1,         // hasta qué nivel se han cobrado ya las recompensas
    campaignProgress: 1,      // nivel de la campaña (1 a 6)
    campaignIntroSeen: false, // si ya vio la historia inicial
    missions: null,           // misiones del día y de la semana (systems/missions.js)
    missionsCompleted: 0,
    weeklyCompleted: 0
};

const playerProgression = loadProgression();

// Session trackers for end-of-game summary
let sessionXPGained = 0;
let sessionCoinsGained = 0;
let sessionLeveledUp = false;
let sessionNewTitle = '';

/**
 * Carga la progresión desde localStorage y combina con los valores por defecto.
 * No usa readJSON(): aquí la combinación va dentro del try, así que una
 * partida guardada ilegible (incluido el JSON `null`) vuelve a los valores
 * por defecto en vez de romper la carga. Sin partida v2, se descarta la v1.
 */
function loadProgression() {
    try {
        const saved = localStorage.getItem(PROG_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            const owned = [...(parsed.owned || DEFAULT_PROGRESSION.owned)];
            // Los artículos gratuitos siempre están en propiedad
            for (const cat in SHOP_CATALOG) {
                for (const item of SHOP_CATALOG[cat]) {
                    const key = `${cat}:${item.id}`;
                    if (item.price === 0 && !owned.includes(key)) owned.push(key);
                }
            }
            return {
                ...DEFAULT_PROGRESSION,
                ...parsed,
                owned,
                // Una categoría nueva toma su valor por defecto
                equipped: { ...DEFAULT_PROGRESSION.equipped, ...parsed.equipped }
            };
        }
        discardOldSave(PROG_STORAGE_KEY_V1);
    } catch (e) {
        console.warn("Error cargando progresión:", e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_PROGRESSION));
}

/**
 * Guarda la progresión en localStorage
 */
function saveProgression() {
    writeJSON(PROG_STORAGE_KEY, playerProgression, 'Error guardando progresión:');
}

/**
 * Reinicia las variables de sesión
 */
function resetSessionTrackers() {
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
    playerProgression.coins += amount;
    sessionCoinsGained += amount;
    saveProgression();
}

/**
 * Gasta Chemi Coins
 */
function spendCoins(amount) {
    if (playerProgression.coins >= amount) {
        playerProgression.coins -= amount;
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
        if (achievementGoalMet('reach_level_5')) unlockAchievement('reach_level_5');
        if (achievementGoalMet('reach_level_10')) unlockAchievement('reach_level_10');
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
 * ¿Tiene el jugador este objeto?
 * @param {string} cat clave de SHOP_CATALOG ('trails', 'paddles'…)
 * @param {string} id
 */
function hasItem(cat, id) {
    return playerProgression.owned.includes(`${cat}:${id}`);
}

/**
 * Compra un objeto de la tienda.
 * @param {string} cat clave de SHOP_CATALOG
 * @param {string} id
 * @param {number} cost
 */
function purchaseItem(cat, id, cost) {
    if (spendCoins(cost)) {
        playerProgression.owned.push(`${cat}:${id}`);
        saveProgression();

        // Cuenta solo los objetos de pago: la lista guardada puede traer
        // otro número de gratuitos
        if (getTotalPurchasedItems() >= 1) {
            unlockAchievement('grow_partner');
        }
        return true;
    }
    return false;
}

/**
 * Equipa un cosmético.
 * @param {string} cat clave de SHOP_CATALOG
 * @param {string} id
 */
function selectCosmetic(cat, id) {
    playerProgression.equipped[cat] = id;
    if (cat === 'backgrounds') setActiveBg(id);
    saveProgression();
}

/**
 * Id del cosmético equipado en una categoría (lo leen los renderizadores
 * de vfx/ en cada fotograma).
 * @param {string} cat clave de SHOP_CATALOG
 * @returns {string}
 */
function equippedId(cat) {
    return playerProgression.equipped[cat];
}

/**
 * Entrega recompensas de final de partida
 */
function awardGameRewards(mode, p1Won, p1Score, p2Score) {
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
        // El modo local no da monedas, tampoco por juego perfecto
        if (mode !== 'local') addCoins(COIN_REWARDS.perfectGame);
    }

    saveProgression();
}

/**
 * Obtiene el número total de artículos en la tienda
 */
function getTotalShopItems() {
    let count = 0;
    for (const key in SHOP_CATALOG) {
        SHOP_CATALOG[key].forEach(item => {
            if (item.price > 0) count++;
        });
    }
    return count;
}

/**
 * Obtiene el número de artículos comprados
 */
function getTotalPurchasedItems() {
    let count = 0;
    playerProgression.owned.forEach(key => {
        const [cat, id] = key.split(':');
        const item = (SHOP_CATALOG[cat] || []).find(i => i.id === id);
        if (item && item.price > 0) count++;
    });
    return count;
}

/**
 * Determina si todos los objetos han sido comprados
 */
function isAllItemsPurchased() {
    const total = getTotalShopItems();
    const purchased = getTotalPurchasedItems();
    return total > 0 && purchased >= total;
}
