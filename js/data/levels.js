/**
 * data/levels.js
 * ------------------------------------------------------------------
 * Niveles del jugador (50, en 10 rangos de 5), sus recompensas, el
 * prestigio y las tablas de XP y Chemi Coins por partida.
 * ------------------------------------------------------------------
 */

'use strict';

/** Los 10 rangos, de menor a mayor; su color tiñe el emblema y el título. */
const RANKS = [
    { name: 'Novato',       color: '#94A3B8' },
    { name: 'Aprendiz',     color: '#A3E635' },
    { name: 'Jugador',      color: '#22D3EE' },
    { name: 'Competidor',   color: '#60A5FA' },
    { name: 'Experto',      color: '#818CF8' },
    { name: 'Veterano',     color: '#C084FC' },
    { name: 'Campeón',      color: '#F472B6' },
    { name: 'Maestro',      color: '#FB923C' },
    { name: 'Gran Maestro', color: '#FACC15' },
    { name: 'Leyenda',      color: '#FDE68A' }
];
const MAX_LEVEL = 50;
const LEVELS_PER_RANK = 5;
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** XP para pasar del nivel n al n+1. */
function xpToNext(n) { return 100 + 25 * (n - 1); }
/** XP acumulada para llegar al nivel n (nivel 1 = 0, nivel 50 = 34 300). */
function xpForLevel(n) { return 100 * (n - 1) + 25 * (n - 1) * (n - 2) / 2; }

/**
 * { rank, sub, title } del nivel n: el 8 es { rank: 1, sub: 3, title: 'Aprendiz III' }.
 * @param {number} n
 */
function levelInfo(n) {
    const rank = Math.floor((n - 1) / LEVELS_PER_RANK);
    const sub = (n - 1) % LEVELS_PER_RANK + 1;
    return { rank, sub, title: `${RANKS[rank].name} ${ROMAN[sub - 1]}` };
}

/** Nivel (1–50) que corresponde a una XP acumulada. */
function levelForXP(xp) {
    let n = 1;
    while (n < MAX_LEVEL && xp >= xpForLevel(n + 1)) n++;
    return n;
}

/** Por encima del nivel 50, cada PRESTIGE_XP suma una estrella y un cofre de PRESTIGE_COINS. */
const PRESTIGE_XP = 2000;
const PRESTIGE_COINS = 250;

/** Estrellas de prestigio que corresponden a una XP acumulada. */
function prestigeForXP(xp) {
    return Math.max(0, Math.floor((xp - xpForLevel(MAX_LEVEL)) / PRESTIGE_XP));
}

/**
 * Recompensa al llegar al nivel n (2–50): monedas (un cofre en los
 * múltiplos de 5, en lugar de las normales), el rango nuevo en el primer
 * nivel de cada rango y la paleta exclusiva Dorada en el 50.
 * @param {number} n
 * @returns {{coins: number, chest: boolean, rank: number | null, exclusive: string | null}}
 */
function levelReward(n) {
    const chest = n % LEVELS_PER_RANK === 0;
    return {
        coins: chest ? 60 + 6 * n : 20 + 5 * n,
        chest,
        rank: n % LEVELS_PER_RANK === 1 ? levelInfo(n).rank : null,
        exclusive: n === MAX_LEVEL ? 'paddles:gold' : null
    };
}

/** Nombres de settings.difficulty, como en Configuración. */
const DIFFICULTY_NAMES = { 1: 'Fácil', 2: 'Normal', 3: 'Imposible' };

/** XP por partida (ver awardGameRewards en systems/progression.js). */
const XP_REWARDS = {
    winCpu: { 1: 15, 2: 25, 3: 40 },   // por dificultad
    winHachepe: 100,
    winCampaignBase: 40,     // se multiplica por el nº de jefe (1 a 5)
    winCreator: 300,
    firstBossClear: 50,      // la primera victoria contra cada jefe (campaignBest)
    completeLocal: 10,
    loss: 5,                 // consolación (VS CPU, Hachepe o campaña)
    scorePoint: 2,           // ×2 los anotados en fiebre
    perfectHit: 2,
    perfectHitMax: 10,       // por partida
    rally: [[30, 15], [20, 10], [10, 5]],   // [rally mínimo, XP], del mayor al menor
    smashGoal: 5,
    perfectGame: 20
};

/** Chemi Coins por partida. El modo local no da monedas, para que no se pueda farmear. */
const COIN_REWARDS = {
    winCpu: { 1: 5, 2: 8, 3: 12 },
    winHachepe: 25,
    winCampaignBase: 10,     // se multiplica por el nº de jefe (1 a 5)
    winCreator: 100,
    perfectGame: 5
};

// Al repetir un jefe ya vencido solo se recibe esta fracción: evita farmear
// la campaña, igual que el modo local no da monedas.
const CAMPAIGN_REPLAY_FACTOR = 0.25;
