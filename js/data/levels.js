/**
 * data/levels.js
 * ------------------------------------------------------------------
 * Niveles del jugador y tablas de recompensas (XP y Chemi Coins).
 * ------------------------------------------------------------------
 */

export const LEVELS = [
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

export const XP_REWARDS = {
    winCpuEasy: 15,
    winCpuNormal: 25,
    winCpuHard: 40,
    winHachepe: 100,
    perfectGame: 20,
    scorePoint: 2,
    completeLocal: 10,
    winCampaignBase: 40,     // se multiplica por el nº de jefe (1 a 5)
    winCreator: 300
};

export const COIN_REWARDS = {
    winCpu: 5,
    winHachepe: 20,
    // NO coins for local mode (user explicitly requested this to prevent exploitation)
    perfectGame: 10,
    winCampaignBase: 10,     // se multiplica por el nº de jefe (1 a 5)
    winCreator: 100
};

// Al repetir un jefe ya vencido solo se recibe esta fracción: evita farmear
// la campaña, igual que el modo local no da monedas.
export const CAMPAIGN_REPLAY_FACTOR = 0.25;
