/**
 * bosses/index.js
 * ------------------------------------------------------------------
 * Mecánicas de los jefes de la campaña: la tabla BOSS_MECHANICS y los
 * despachadores que usa game/.
 *
 * Cada jefe vive en su archivo con la forma
 *   { config, init, update, render, renderOverlay, collide, onGoal,
 *     hidesBall, freezesPlayer, invertsControls, segmentIsArmored,
 *     phases, lives, color, renderArena, onHit, koLeadMs }
 * donde todo salvo `config` es opcional. Un jefe con `phases` se juega
 * por fases y con vidas (bosses/phases.js). game/ nunca nombra a un jefe:
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
 * @property {number} [spin]       probabilidad de dar efecto en cada devolución (game/ai.js)
 * @property {number} [smash]      probabilidad de usar el smash con la barra llena
 */

/**
 * Una fase de un jefe (bosses/phases.js).
 * @typedef {object} BossPhase
 * @property {string} name        nombre del letrero («¿Tiene cita?»)
 * @property {number} goals       goles del jugador para superarla
 * @property {Partial<BossConfig>} [config]  IA de esta fase (aiSpeed, aiError, aiBias, spin, smash)
 * @property {() => void} [enter] al empezar la fase (tras la transición)
 * @property {(t: number) => void} [transition]  animación de entrada, t de 0 a 1 (1,5 s)
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
 * @property {BossPhase[]} [phases]      combate por fases (bosses/phases.js)
 * @property {number} [lives]            vidas del jugador (BOSS_LIVES por defecto)
 * @property {string} [color]            color del jefe: barra, destellos y K.O.
 * @property {(ctx: CanvasRenderingContext2D) => void} [renderArena]  suelo propio, justo después del fondo
 * @property {(b: Ball, side: 'p1'|'p2', type: HitType) => void} [onHit]  tras cada golpe de pala
 * @property {number} [koLeadMs]         remate propio antes del K.O. común (ms)
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

/**
 * Config del jefe activo (con los valores por defecto rellenados y, si
 * juega por fases, la de la fase en curso encima), o null.
 * @returns {BossConfig|null}
 */
function bossConfig() {
    const boss = currentBoss();
    if (!boss) return null;
    const phase = boss.phases ? boss.phases[bossState.phase || 0] : null;
    return { ...BOSS_DEFAULT_CONFIG, ...(boss.config || {}), ...((phase && phase.config) || {}) };
}

/** true si la arena está rotada (paleta del jugador horizontal). */
function bossIsRotatedArena() {
    const cfg = bossConfig();
    return !!cfg && cfg.paddleAxis === 'x';
}

/** Vacía el estado del jefe y arma el del jefe en curso (al empezar la partida). */
function bossInit() {
    resetBossState();
    bossPhasesInit();
    const boss = currentBoss();
    if (boss && boss.init) boss.init();
    bossPhasesStart();
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
 * Avisa al jefe de un gol (el dúo retira a Mario al encajarlo) y, en un
 * combate por fases, cuenta la fase y las vidas.
 * @param {boolean} scorerIsP1
 * @param {Ball} [b] la bola que entró
 */
function bossOnGoal(scorerIsP1, b) {
    const boss = currentBoss();
    if (boss && boss.onGoal) boss.onGoal(scorerIsP1);
    if (boss) bossPhaseGoal(scorerIsP1, b);
}

/**
 * Tras cada golpe de pala en campaña: el gancho del jefe y las pullas
 * del rally y del smash del jugador.
 * @param {Ball} b
 * @param {'p1'|'p2'} side
 * @param {HitType} type
 */
function bossOnHit(b, side, type) {
    const boss = currentBoss();
    if (!boss) return;
    if (boss.onHit) boss.onHit(b, side, type);
    if (currentRally === 15) bossTaunt('rally15');
    if (side === 'p1' && type === 'super') bossTaunt('playerSmash');
}

/** Suelo propio del jefe, justo después del fondo (debajo de la red). */
function bossRenderArena(ctx) {
    const boss = currentBoss();
    if (boss && boss.renderArena) boss.renderArena(ctx);
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
    bossRenderPhaseOverlay(ctx);
}

/** ¿Este jefe oculta la bola real? (Fano; y cualquiera durante su K.O.) */
function bossHidesBall() {
    const boss = currentBoss();
    if (boss && bossState.ko) return true;
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
