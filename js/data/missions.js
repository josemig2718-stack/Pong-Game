/**
 * data/missions.js
 * ------------------------------------------------------------------
 * Catálogo de misiones (la lógica está en systems/missions.js). Cada
 * día se eligen 3 diarias, sin dos del mismo `event`, y cada semana una
 * semanal.
 *
 * `event` es el tipo que se pasa a missionEvent(); `test(info)`, si lo
 * hay, filtra qué avisos de ese tipo cuentan. Los eventos de victoria
 * solo llegan en VS CPU, Hachepe y campaña; los demás, también en
 * local. La práctica no cuenta nunca. `max: true` = la meta es un
 * récord (el rally más largo del día), no una suma.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * @typedef {object} MissionInfo
 * @property {GameMode} [mode]
 * @property {number} [difficulty]
 * @property {boolean} [smashUsed]   el J1 hizo al menos un smash en la partida
 */

/**
 * @typedef {object} Mission
 * @property {string} id
 * @property {string} text
 * @property {string} event
 * @property {number} goal
 * @property {number} xp
 * @property {number} coins
 * @property {boolean} [max]
 * @property {(info: MissionInfo) => boolean} [test]
 */

/** @type {Mission[]} */
const DAILY_MISSIONS = [
    { id: 'd_win2',         text: 'Gana 2 partidas',                     event: 'win',          goal: 2,  xp: 40, coins: 15 },
    { id: 'd_win_hard',     text: 'Gana 1 partida en Normal o Imposible', event: 'win',          goal: 1,  xp: 30, coins: 12,
      test: (info) => info.mode === 'cpu' && info.difficulty >= 2 },
    { id: 'd_win_smash',    text: 'Gana 1 partida usando el smash',      event: 'win',          goal: 1,  xp: 40, coins: 15,
      test: (info) => !!info.smashUsed },
    { id: 'd_rally20',      text: 'Consigue un rally de 20 golpes',      event: 'rally',        goal: 20, xp: 50, coins: 20, max: true },
    { id: 'd_fever',        text: 'Entra en fiebre del rally',           event: 'fever',        goal: 1,  xp: 40, coins: 15 },
    { id: 'd_perfect5',     text: 'Haz 5 golpes perfectos',              event: 'perfect',      goal: 5,  xp: 30, coins: 10 },
    { id: 'd_perfect10',    text: 'Haz 10 golpes perfectos',             event: 'perfect',      goal: 10, xp: 45, coins: 15 },
    { id: 'd_spin10',       text: 'Da efecto a la bola 10 veces',        event: 'spin',         goal: 10, xp: 30, coins: 10 },
    { id: 'd_block5',       text: 'Devuelve 5 bolas con bloqueo',        event: 'block',        goal: 5,  xp: 30, coins: 10 },
    { id: 'd_edge5',        text: 'Haz 5 roces de esquina',              event: 'edge',         goal: 5,  xp: 30, coins: 10 },
    { id: 'd_smash_goal',   text: 'Marca 1 gol de smash',                event: 'smash_goal',   goal: 1,  xp: 40, coins: 15 },
    { id: 'd_smash_use3',   text: 'Usa el smash 3 veces',                event: 'smash_use',    goal: 3,  xp: 40, coins: 15 },
    { id: 'd_points15',     text: 'Anota 15 puntos',                     event: 'point',        goal: 15, xp: 30, coins: 10 },
    { id: 'd_powerups5',    text: 'Recoge 5 power-ups',                  event: 'powerup',      goal: 5,  xp: 30, coins: 10 },
    { id: 'd_play3',        text: 'Juega 3 partidas',                    event: 'game_end',     goal: 3,  xp: 25, coins: 10 },
    { id: 'd_perfect_game', text: 'Gana sin que el rival anote',         event: 'perfect_game', goal: 1,  xp: 60, coins: 25 },
    { id: 'd_campaign',     text: 'Vence a un Hachepe de la campaña',    event: 'campaign_win', goal: 1,  xp: 50, coins: 20 },
    { id: 'd_local',        text: 'Juega 1 partida local',               event: 'local_end',    goal: 1,  xp: 25, coins: 0 }
];

/** @type {Mission[]} */
const WEEKLY_MISSIONS = [
    { id: 'w_win10',     text: 'Gana 10 partidas en Normal o Imposible', event: 'win',        goal: 10, xp: 250, coins: 80,
      test: (info) => info.mode === 'cpu' && info.difficulty >= 2 },
    { id: 'w_smash5',    text: 'Marca 5 goles de smash',                 event: 'smash_goal', goal: 5,  xp: 200, coins: 70 },
    { id: 'w_rally30',   text: 'Consigue un rally de 30 golpes',         event: 'rally',      goal: 30, xp: 220, coins: 70, max: true },
    { id: 'w_daily10',   text: 'Completa 10 misiones diarias',           event: 'daily_done', goal: 10, xp: 300, coins: 100 },
    { id: 'w_perfect50', text: 'Haz 50 golpes perfectos',                event: 'perfect',    goal: 50, xp: 200, coins: 70 },
    { id: 'w_hachepe',   text: 'Vence al Modo Hachepe',                  event: 'win',        goal: 1,  xp: 250, coins: 80,
      test: (info) => info.mode === 'hachepe' }
];
