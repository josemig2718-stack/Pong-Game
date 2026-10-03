/**
 * bosses/index.js
 * ------------------------------------------------------------------
 * Mecánicas de los jefes de la campaña: la tabla BOSS_MECHANICS y los
 * despachadores que usa game/.
 *
 * Cada jefe vive en su archivo con la forma
 *   { config, init, update, render, renderOverlay, collide, onGoal,
 *     hidesBall, freezesPlayer, invertsControls, segmentIsArmored }
 * donde todo salvo `config` es opcional. game/ nunca nombra a un jefe:
 * llama a bossInit/bossUpdate/bossRender/... y lee bossConfig(). Añadir
 * un jefe es añadir su archivo y su entrada en la tabla, nunca un
 * `currentCampaignLevel === N` en game/.
 *
 * Dos reglas aprendidas de bugs:
 *   - aiBias es lo que hace batible a un jefe: aiError es una zona muerta
 *     que, si es menor que media paleta, no provoca ningún fallo.
 *   - Los obstáculos van en el campo del jefe y desvían la bola: en el
 *     del jugador crean un bucle paleta↔bloque sin fin.
 * ------------------------------------------------------------------
 */

import { state } from '../core/state.js';
import { bossChemi } from './chemi.js';
import { bossCreator } from './creator.js';
import { bossDani } from './dani.js';
import { bossDuo } from './duo.js';
import { bossFano } from './fano.js';
import { bossState, resetBossState } from './shared.js';
import { bossYisus } from './yisus.js';
import { currentCampaignLevel } from '../campaign.js';

// Valores por defecto: cualquier campo que un jefe no defina sale de aquí.
const BOSS_DEFAULT_CONFIG = {
    targetScore: 5,      // puntos necesarios para ganar el combate
    aiSpeed: 0.75,       // multiplicador sobre paddleSpeed
    aiError: 18,         // zona muerta en píxeles: no corrige por debajo de esto
    aiBias: 50,          // desvío de puntería en píxeles, renovado en cada golpe.
                         // Es lo que hace fallar de verdad al jefe: la zona muerta
                         // sola no basta, porque cabe dentro de la propia paleta.
    paddleAxis: 'y',     // 'x' invierte la arena (paleta horizontal abajo)
    useHealth: false     // true = se gana vaciando la barra de vida, no por marcador
};

/** Desvío de puntería actual del jefe. Se renueva en cada intercambio. */
let bossAimOffset = 0;

export function bossRefreshAim() {
    const cfg = bossConfig();
    if (!cfg) { bossAimOffset = 0; return; }
    // Sesgo con forma de campana suave: los desvíos grandes son menos frecuentes
    const r = (Math.random() + Math.random() - 1);
    bossAimOffset = r * (cfg.aiBias || 0);
}

export function bossAim() {
    return bossConfig() ? bossAimOffset : 0;
}

/**
 * Mecánicas de cada jefe, por nivel de campaña.
 *
 * Esta tabla se construye al evaluar el módulo, así que necesita que los
 * archivos de los jefes ya estén evaluados. Lo están porque este es el
 * único módulo que los importa: no los importes desde ningún otro sitio
 * (para algo compartido, usa bosses/shared.js).
 */
const BOSS_MECHANICS = {
    1: bossChemi,
    2: bossDani,
    3: bossDuo,
    4: bossFano,
    5: bossYisus,
    6: bossCreator
};

/** Jefe activo, o null si no estamos en un combate de campaña. */
function currentBoss() {
    if (state.mode !== 'campaign') return null;
    return BOSS_MECHANICS[currentCampaignLevel] || null;
}

/** Config del jefe activo (con los valores por defecto rellenados), o null. */
export function bossConfig() {
    const boss = currentBoss();
    if (!boss) return null;
    return { ...BOSS_DEFAULT_CONFIG, ...(boss.config || {}) };
}

/** true si la arena está rotada (paleta del jugador horizontal). */
export function bossIsRotatedArena() {
    const cfg = bossConfig();
    return !!cfg && cfg.paddleAxis === 'x';
}

export function bossInit() {
    resetBossState();
    const boss = currentBoss();
    if (boss && boss.init) boss.init();
}

export function bossUpdate(dt) {
    const boss = currentBoss();
    if (boss && boss.update) boss.update(dt);
}

/** Colisiones extra del jefe (escombros, escudo). true si la bola rebotó. */
export function bossCollide(b) {
    const boss = currentBoss();
    if (boss && boss.collide) return boss.collide(b);
    return false;
}

export function bossOnGoal(scorerIsP1) {
    const boss = currentBoss();
    if (boss && boss.onGoal) boss.onGoal(scorerIsP1);
}

/** Capa que se dibuja junto al campo (debajo de partículas). */
export function bossRender(ctx) {
    const boss = currentBoss();
    if (boss && boss.render) boss.render(ctx);
}

/** Capa por encima de todo (viñetas, tintes, avisos). */
export function bossRenderOverlay(ctx) {
    const boss = currentBoss();
    if (boss && boss.renderOverlay) boss.renderOverlay(ctx);
}

/** ¿Este jefe oculta la bola real? (Fano) */
export function bossHidesBall() {
    const boss = currentBoss();
    return !!(boss && boss.hidesBall && boss.hidesBall());
}

/** ¿Está congelada la paleta del jugador? (Yisus) */
export function bossFreezesPlayer() {
    const boss = currentBoss();
    return !!(boss && boss.freezesPlayer && boss.freezesPlayer());
}

/** ¿Están invertidos los controles? (El Creador, fase 2+) */
export function bossInvertsControls() {
    const boss = currentBoss();
    return !!(boss && boss.invertsControls && boss.invertsControls());
}

/** Aplica daño al jefe con barra de vida. Devuelve la vida restante. */
export function bossDamage(amount) {
    if (typeof bossState.health !== 'number') return 0;
    bossState.health = Math.max(0, bossState.health - amount);
    return bossState.health;
}

/** ¿El tramo del jefe en esa X está blindado? Si lo está, no recibe daño. */
export function bossSegmentArmored(x) {
    const boss = currentBoss();
    return !!(boss && boss.segmentIsArmored && boss.segmentIsArmored(x));
}

export function bossHealth() {
    return typeof bossState.health === 'number' ? bossState.health : 0;
}
