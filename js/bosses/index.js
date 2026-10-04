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

'use strict';

/**
 * Parámetros de un jefe. Cada jefe define solo los que cambia.
 * @typedef {object} BossConfig
 * @property {number} targetScore  puntos para ganar; contra el Creador, fallos permitidos al jugador
 * @property {number} aiSpeed      multiplicador sobre paddleSpeed
 * @property {number} aiError      zona muerta en píxeles: no corrige por debajo de esto
 * @property {number} aiBias       desvío de puntería en píxeles, renovado en cada golpe
 * @property {'x'|'y'} paddleAxis  'x' rota la arena (paleta del jugador horizontal abajo)
 * @property {boolean} useHealth   true = se gana vaciando la barra de vida, no por marcador
 * @property {number} [hitDamage]  daño por impacto (jefes con vida)
 */

/**
 * Lo que puede definir cada jefe. Todo es opcional salvo `config`.
 * @typedef {object} BossMechanics
 * @property {Partial<BossConfig>} config
 * @property {() => void} [init]                          al empezar el combate
 * @property {(dt: number) => void} [update]              cada paso de física
 * @property {(ctx: CanvasRenderingContext2D) => void} [render]         capa junto al campo
 * @property {(ctx: CanvasRenderingContext2D) => void} [renderOverlay]  capa superior
 * @property {(b: Ball) => boolean} [collide]  obstáculos propios; true si la bola rebotó
 * @property {(scorerIsP1: boolean) => void} [onGoal]
 * @property {() => boolean} [hidesBall]
 * @property {() => boolean} [freezesPlayer]
 * @property {() => boolean} [invertsControls]
 * @property {(x: number) => boolean} [segmentIsArmored]
 */

// Valores por defecto: cualquier campo que un jefe no defina sale de aquí.
/** @type {BossConfig} */
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

/**
 * Renueva el desvío de puntería del jefe (en cada golpe de paleta).
 * Sesgo con forma de campana: los desvíos grandes son menos frecuentes.
 */
function bossRefreshAim() {
    const cfg = bossConfig();
    if (!cfg) { bossAimOffset = 0; return; }
    // Sesgo con forma de campana suave: los desvíos grandes son menos frecuentes
    const r = (Math.random() + Math.random() - 1);
    bossAimOffset = r * (cfg.aiBias || 0);
}

/**
 * @returns {number} desvío actual en píxeles (0 fuera de la campaña)
 */
function bossAim() {
    return bossConfig() ? bossAimOffset : 0;
}

/**
 * Mecánicas de cada jefe, por nivel de campaña.
 *
 * Esta tabla se construye al cargar el archivo, así que los archivos de
 * los jefes tienen que cargarse antes en index.html (para algo que
 * compartan los jefes, usa bosses/shared.js, que va antes de todos).
 */
/** @type {Record<number, BossMechanics>} */
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
function bossConfig() {
    const boss = currentBoss();
    if (!boss) return null;
    return { ...BOSS_DEFAULT_CONFIG, ...(boss.config || {}) };
}

/** true si la arena está rotada (paleta del jugador horizontal). */
function bossIsRotatedArena() {
    const cfg = bossConfig();
    return !!cfg && cfg.paddleAxis === 'x';
}

/** Vacía el estado del jefe y arma el del jefe en curso (al empezar la partida). */
function bossInit() {
    resetBossState();
    const boss = currentBoss();
    if (boss && boss.init) boss.init();
}

/**
 * Avanza las mecánicas del jefe en curso.
 * @param {number} dt
 */
function bossUpdate(dt) {
    const boss = currentBoss();
    if (boss && boss.update) boss.update(dt);
}

/** Colisiones extra del jefe (escombros, escudo). true si la bola rebotó. */
function bossCollide(b) {
    const boss = currentBoss();
    if (boss && boss.collide) return boss.collide(b);
    return false;
}

/**
 * Avisa al jefe de un gol (el dúo retira a Mario al encajarlo).
 * @param {boolean} scorerIsP1
 */
function bossOnGoal(scorerIsP1) {
    const boss = currentBoss();
    if (boss && boss.onGoal) boss.onGoal(scorerIsP1);
}

/** Capa que se dibuja junto al campo (debajo de partículas). */
function bossRender(ctx) {
    const boss = currentBoss();
    if (boss && boss.render) boss.render(ctx);
}

/** Capa por encima de todo (viñetas, tintes, avisos). */
function bossRenderOverlay(ctx) {
    const boss = currentBoss();
    if (boss && boss.renderOverlay) boss.renderOverlay(ctx);
}

/** ¿Este jefe oculta la bola real? (Fano) */
function bossHidesBall() {
    const boss = currentBoss();
    return !!(boss && boss.hidesBall && boss.hidesBall());
}

/** ¿Está congelada la paleta del jugador? (Yisus) */
function bossFreezesPlayer() {
    const boss = currentBoss();
    return !!(boss && boss.freezesPlayer && boss.freezesPlayer());
}

/** ¿Están invertidos los controles? (El Creador, fase 2+) */
function bossInvertsControls() {
    const boss = currentBoss();
    return !!(boss && boss.invertsControls && boss.invertsControls());
}

/** Aplica daño al jefe con barra de vida. Devuelve la vida restante. */
function bossDamage(amount) {
    if (typeof bossState.health !== 'number') return 0;
    bossState.health = Math.max(0, bossState.health - amount);
    return bossState.health;
}

/** ¿El tramo del jefe en esa X está blindado? Si lo está, no recibe daño. */
function bossSegmentArmored(x) {
    const boss = currentBoss();
    return !!(boss && boss.segmentIsArmored && boss.segmentIsArmored(x));
}

/**
 * @returns {number} vida del jefe en curso (0 si no tiene barra de vida)
 */
function bossHealth() {
    return typeof bossState.health === 'number' ? bossState.health : 0;
}
