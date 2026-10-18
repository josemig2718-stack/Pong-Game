/**
 * systems/missions.js
 * ------------------------------------------------------------------
 * Misiones diarias (3 al día) y semanal (1 a la semana). El catálogo
 * está en data/missions.js y el estado en playerProgression.missions:
 *
 *   { day: 'AAAA-MM-DD', daily: [{ id, progress, done }],
 *     week: 'AAAA-Www',  weekly: { id, progress, done } }
 *
 * La elección sale de la fecha local (y de la semana ISO) con un
 * generador propio: nunca Math.random, que es de la partida, ni los de
 * los efectos o el audio. Las misiones se renuevan al cargar y al
 * empezar cada partida; las completadas ya se cobraron.
 *
 * missionEvent() lo llaman los mismos sitios que las estadísticas.
 * ------------------------------------------------------------------
 */

'use strict';

/** Misiones completadas en la partida en curso (fin de partida). @type {Mission[]} */
let sessionMissions = [];

/** Hash FNV-1a de 32 bits de un texto (la semilla del día o la semana). */
function missionHash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** Generador mulberry32 con semilla: devuelve números en [0, 1). */
function missionRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** @param {number} n */
const missionPad = (n) => String(n).padStart(2, '0');

/** Fecha local 'AAAA-MM-DD'. @param {Date} d */
function missionDayKey(d) {
    return `${d.getFullYear()}-${missionPad(d.getMonth() + 1)}-${missionPad(d.getDate())}`;
}

/** Semana ISO 'AAAA-Www' de la fecha local. @param {Date} d */
function missionWeekKey(d) {
    // El jueves de esa semana decide el año ISO
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
    return `${t.getUTCFullYear()}-W${missionPad(week)}`;
}

/**
 * Las 3 diarias de un día: las 18 barajadas con la fecha como semilla,
 * quedándose con las primeras que no repiten evento.
 * @param {string} day
 * @returns {Mission[]}
 */
function pickDailyMissions(day) {
    const rng = missionRng(missionHash(day));
    const list = [...DAILY_MISSIONS];
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    const picked = [];
    for (const m of list) {
        if (picked.length < 3 && !picked.some(p => p.event === m.event)) picked.push(m);
    }
    return picked;
}

/** La semanal de una semana ISO. @param {string} week */
function pickWeeklyMission(week) {
    const rng = missionRng(missionHash(week));
    return WEEKLY_MISSIONS[Math.floor(rng() * WEEKLY_MISSIONS.length)];
}

/**
 * Si cambió el día o la semana, elige las misiones nuevas (las
 * anteriores se pierden). Al cargar y al empezar cada partida.
 */
function refreshMissions() {
    const now = new Date();
    const day = missionDayKey(now);
    const week = missionWeekKey(now);
    const p = playerProgression;
    const m = p.missions || { day: '', daily: [], week: '', weekly: null };
    let changed = !p.missions;
    if (m.day !== day) {
        m.day = day;
        m.daily = pickDailyMissions(day).map(mi => ({ id: mi.id, progress: 0, done: false }));
        changed = true;
    }
    if (m.week !== week) {
        m.week = week;
        m.weekly = { id: pickWeeklyMission(week).id, progress: 0, done: false };
        changed = true;
    }
    p.missions = m;
    if (changed) saveProgression();
}

/** Definición de una misión por su id. @param {string} id */
function missionDef(id) {
    return DAILY_MISSIONS.find(m => m.id === id) || WEEKLY_MISSIONS.find(m => m.id === id);
}

/** Vacía la lista de misiones de la partida (startGame). */
function resetSessionMissions() {
    sessionMissions = [];
}

/**
 * Avance de las misiones.
 * @param {string} type evento (ver data/missions.js)
 * @param {number} [amount] cuánto suma; en las de récord, el valor alcanzado
 * @param {MissionInfo} [info]
 */
function missionEvent(type, amount = 1, info = {}) {
    if (state.mode === 'practice' || !playerProgression.missions) return;
    const m = playerProgression.missions;
    const entries = [...m.daily.map(e => [e, false]), ...(m.weekly ? [[m.weekly, true]] : [])];
    let changed = false;
    for (const [entry, weekly] of entries) {
        if (entry.done) continue;
        const def = missionDef(entry.id);
        if (!def || def.event !== type || (def.test && !def.test(info))) continue;
        const progress = Math.min(def.max ? Math.max(entry.progress, amount) : entry.progress + amount, def.goal);
        if (progress === entry.progress) continue;
        entry.progress = progress;
        changed = true;
        if (entry.progress >= def.goal) completeMission(entry, def, weekly);
    }
    if (changed) saveProgression();
}

/**
 * Cobra una misión al completarla: XP y monedas al momento, sonido,
 * aviso y contadores. Las diarias cuentan para la semanal w_daily10.
 * @param {{id: string, progress: number, done: boolean}} entry
 * @param {Mission} def
 * @param {boolean} weekly
 */
function completeMission(entry, def, weekly) {
    entry.done = true;
    sessionMissions.push(def);
    playerProgression.missionsCompleted++;
    if (weekly) playerProgression.weeklyCompleted++;
    addXP(def.xp);
    addCoins(def.coins);
    soundEffects.missionComplete();
    showMissionToast(def);
    if (!weekly) {
        gameStats.dailyMissionsDone++;
        saveStats();
        missionEvent('daily_done');
    }
    checkMissionAchievements();
}
