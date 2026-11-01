/**
 * campaign/menu.js
 * ------------------------------------------------------------------
 * El menú de campaña: la Torre Hachepe y el prólogo (la primera vez que
 * se entra y con VER HISTORIA).
 *
 * La torre tiene un piso por jefe, de abajo arriba: PB (Chemi), 1, 2, 3
 * y 4 (Yisus), con el techo encima y, solo cuando el progreso llega al
 * Creador, el sótano debajo. A la izquierda va el ascensor (hueco,
 * cabina e indicador LED); a la derecha (o abajo en vertical), la ficha
 * del piso elegido.
 *
 * Cada piso es un canvas (imagen base + su máscara teñida, vfx/tint.js):
 *   liberado   máscara del color del tema
 *   siguiente  máscara dorada, con un pulso suave del borde (CSS)
 *   bloqueado  la base oscurecida, sin máscara
 *
 * Se elige piso con cuatro vías: toque o clic, ↑ ↓, deslizar en vertical
 * y la rueda. Al tocarlo, mantén las cuatro. ENTER o SUBIR cierran las
 * puertas, el LED cuenta los pisos y empieza el combate. La primera vez
 * que se llega a un piso con escena (LLEGADAS: 1, 2 y 3) se ve su
 * llegada antes de la VS; VER ESCENA, en la ficha, la repite.
 *
 * Nada del Creador debe verse antes de que la historia lo revele: el
 * sótano no existe en el DOM hasta que campaignProgress llega a 6.
 * ------------------------------------------------------------------
 */

'use strict';

/** Pisos de arriba abajo (niveles de campaña); el sótano, solo tras la revelación. */
const TOWER_ORDER = [5, 4, 3, 2, 1, CAMPAIGN_CREATOR];

/** Imagen de cada nivel en CAMPAIGN_ART.torre. */
const TOWER_FLOOR_ART = { 1: 'piso_pb', 2: 'piso_1', 3: 'piso_2', 4: 'piso_3', 5: 'piso_4', 6: 'sotano' };

/** Colores de las máscaras de los pisos. */
const TOWER_GOLD = '#FACC15';
const TOWER_BASEMENT = '#7DD3FC';

/** El ascensor: s por piso, y la entrada (normal y con movimiento reducido). */
const TOWER_CAB_S_PER_FLOOR = 0.35;
const TOWER_ENTER_MS = 1600;
const TOWER_ENTER_REDUCED_MS = 300;

/** Nivel del piso elegido. */
let towerLevel = 1;
/** Niveles que se ven ahora, de arriba abajo. */
let towerLevels = [];
/** true mientras el ascensor sube a un combate (se ignoran los controles). */
let towerEntering = false;
/** Bucle de la ciudad (lluvia) mientras se ve el menú. */
let towerRaf = 0;
/** Ciudad pintada a su tamaño (sin la lluvia): se repinta al cambiar tamaño o tema. */
let towerCityCache = null;
let towerCityKey = '';
/** Última rueda atendida (performance.now), para no saltar pisos de golpe. */
let towerWheelAt = 0;
/**
 * El premio de las luces está pendiente de verse: lo pide
 * recordCampaignBest() al vencer a Fano por primera vez (towerQueueLights)
 * y la torre lo muestra al volver. No se guarda: después, la ciudad
 * encendida sale de campaignBest[4].won.
 */
let towerLightsPending = false;
/** Cuándo empezó el destello de las ventanas (segundos del bucle), o null. */
let towerLightsT0 = null;

/** Nivel de Fano: vencerlo enciende las luces de Barks City. */
const TOWER_LIGHTS_LEVEL = 4;
/** El destello recorre las ventanas de abajo arriba en 1,5 s. */
const TOWER_LIGHTS_SWEEP_S = 1.5;
/** Cuánto se ve el aviso (ms). */
const TOWER_NOTICE_MS = 4000;

const DANGER_STAR_PATH = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z';
const TOWER_ICON_LOCK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const TOWER_ICON_UP = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
const TOWER_ICON_REPEAT = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 4v5h-5M20 12a8 8 0 0 1-14 5.3M4 20v-5h5"/></svg>';

/**
 * Peligro de un jefe como cinco estrellas SVG (las ⭐ de su lore). El
 * Creador no tiene estrellas: su peligro es un ERROR. Lo usan la ficha de
 * la torre y la pantalla VS.
 * @param {string} danger
 * @returns {string} HTML
 */
function dangerStarsHTML(danger) {
    if (!danger.includes('⭐')) return `<span class="danger-error">${danger}</span>`;
    const filled = danger.split('⭐').length - 1;
    let html = `<span class="danger-stars" role="img" aria-label="${filled} de 5">`;
    for (let i = 0; i < 5; i++) {
        const empty = i < filled ? '' : ' danger-star--empty';
        html += `<svg class="danger-star${empty}" viewBox="0 0 24 24" aria-hidden="true"><path d="${DANGER_STAR_PATH}"/></svg>`;
    }
    return html + '</span>';
}

/**
 * Qué hay que hacer para desbloquear un nivel: «Vence a Hachepe Chemi».
 * @param {number} nivel
 */
function campaignUnlockHint(nivel) {
    return 'Vence a ' + HACHEPES_LORE[nivel - 1].name;
}

/** ¿Está vencido el jefe de este nivel? (El Creador no mueve el progreso: va por su récord.) */
function towerBeaten(level) {
    return level < playerProgression.campaignProgress || campaignBestOf(level).won;
}

/** @returns {'free'|'next'|'locked'} estado de un piso */
function towerFloorState(level) {
    if (towerBeaten(level)) return 'free';
    return level === playerProgression.campaignProgress ? 'next' : 'locked';
}

/** El nivel pendiente: donde arranca la cabina al abrir el menú. */
function towerPendingLevel() {
    return Math.min(playerProgression.campaignProgress, CAMPAIGN_CREATOR);
}

/** Construye la torre (al entrar en el menú de campaña). */
function renderCampaignMap() {
    const floors = document.getElementById('tower-floors');
    if (!floors) return;

    if (!playerProgression.campaignIntroSeen) playCampaignPrologue();

    towerEntering = false;
    const cab = document.getElementById('tower-cab');
    cab.classList.remove('is-closed');
    towerLevels = TOWER_ORDER.filter((l) => l !== CAMPAIGN_CREATOR || playerProgression.campaignProgress >= CAMPAIGN_CREATOR);
    floors.replaceChildren();

    const roof = document.createElement('canvas');
    roof.className = 'tower__roof';
    roof.width = 960;
    roof.height = 320;
    roof.setAttribute('aria-hidden', 'true');
    floors.appendChild(roof);

    for (const level of towerLevels) {
        const lore = HACHEPES_LORE[level];
        const st = towerFloorState(level);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `tower__floor tower__floor--${st}` + (level === CAMPAIGN_CREATOR ? ' tower__floor--basement' : '');
        btn.dataset.action = 'towerSelect';
        btn.dataset.arg = String(level);
        btn.dataset.level = String(level);
        btn.setAttribute('aria-label', `${towerFloorName(level)} · ${st === 'locked' ? 'bloqueado' : lore.name}`);
        const cv = document.createElement('canvas');
        cv.width = 960;
        cv.height = 240;
        cv.setAttribute('aria-hidden', 'true');
        btn.appendChild(cv);
        const tag = document.createElement('span');
        tag.className = 'px tower__tag';
        tag.textContent = lore.floor;
        btn.appendChild(tag);
        floors.appendChild(btn);
    }

    towerLevel = towerPendingLevel();
    if (!towerLevels.includes(towerLevel)) towerLevel = towerLevels[towerLevels.length - 1];
    paintTower();
    layoutTower();
    towerSelect(towerLevel, { instant: true });
    startTowerCity();
    if (towerLightsPending && !cutscenePlaying()) towerShowLights();
}

/** Lo llama recordCampaignBest() al vencer a Fano por primera vez. */
function towerQueueLights() {
    towerLightsPending = true;
}

/**
 * El premio de las luces: un destello recorre las ventanas de la ciudad
 * de abajo arriba (sin él con movimiento reducido) y sale el aviso.
 */
function towerShowLights() {
    towerLightsPending = false;
    towerLightsT0 = prefersReducedMotion() ? null : -1;   // el bucle pone la hora de inicio
    bossSfx('lightsOn');
    const notice = document.getElementById('tower-notice');
    notice.textContent = 'Las luces de Barks City volvieron a encenderse';
    notice.classList.add('is-on');
    setTimeout(() => notice.classList.remove('is-on'), TOWER_NOTICE_MS);
}

/** «PB · RECEPCIÓN». */
function towerFloorName(level) {
    const lore = HACHEPES_LORE[level];
    return lore.floor === 'PB' ? 'PB' : lore.floor === 'S' ? 'SÓTANO' : `PISO ${lore.floor}`;
}

/** Pinta el techo y los pisos (una vez por render; al cargar las imágenes, otra). */
function paintTower() {
    const floors = document.getElementById('tower-floors');
    if (!floors) return;
    const theme = currentThemeHex();
    const art = CAMPAIGN_ART.torre;
    let pending = false;

    const roof = /** @type {HTMLCanvasElement} */ (floors.querySelector('.tower__roof'));
    if (roof) {
        const rctx = roof.getContext('2d');
        rctx.clearRect(0, 0, roof.width, roof.height);
        const roofColor = playerProgression.campaignProgress > CAMPAIGN_LAST_BOSS ? theme : TOWER_GOLD;
        // Vencido el Creador, la torre ya es de Barks: letras BARKS y «TORRE BARKS»
        const roofArt = towerBeaten(CAMPAIGN_CREATOR) ? art.techo_barks : art.techo;
        if (!drawTintedArt(rctx, roofArt, roofColor, 0, 0, roof.width, roof.height)) pending = true;
    }

    floors.querySelectorAll('.tower__floor').forEach((btn) => {
        const level = Number(/** @type {HTMLElement} */ (btn).dataset.level);
        const cv = btn.querySelector('canvas');
        const ctx = cv.getContext('2d');
        const info = art[TOWER_FLOOR_ART[level]];
        const st = towerFloorState(level);
        ctx.clearRect(0, 0, cv.width, cv.height);
        const color = st === 'locked' ? null
            : level === CAMPAIGN_CREATOR && st !== 'free' ? TOWER_BASEMENT
            : st === 'next' ? TOWER_GOLD : theme;
        if (!drawTintedArt(ctx, info, color, 0, 0, cv.width, cv.height)) {
            pending = true;
            return;
        }
        if (st === 'locked') {
            // Igual que brightness(.22): la base al 22 %, sin máscara
            ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
            ctx.fillRect(0, 0, cv.width, cv.height);
            ctx.font = "64px 'Press Start 2P', monospace";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(232, 236, 244, 0.35)';
            ctx.fillText('?', cv.width / 2, cv.height / 2 + 4);
        }
    });

    if (pending) {
        const srcs = [art.techo, art.techo_barks, ...Object.values(TOWER_FLOOR_ART).map((k) => art[k])]
            .flatMap((i) => [i.src, i.theme]).filter(Boolean);
        Promise.all(srcs.map(artLoad)).then(() => {
            if (document.getElementById('campaign-menu').classList.contains('active-screen')) paintTower();
        });
    }
}

/**
 * Ajusta el tamaño de la torre: los pisos se escalan por igual (4:1) para
 * que quepa en alto; en vertical ocupa el ancho y hace scroll si hace falta.
 */
function layoutTower() {
    const wrap = document.getElementById('tower-wrap');
    const tower = document.getElementById('tower');
    if (!wrap || !tower || !wrap.clientWidth) return;
    const tall = window.innerHeight > window.innerWidth;
    const n = towerLevels.length;
    // Ancho total = piso × (1 + 0,13 del ascensor); alto = techo (1/3) + n pisos (1/4) + el LED
    const style = getComputedStyle(wrap);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const byWidth = (wrap.clientWidth - 4) / 1.13;
    const byHeight = (wrap.clientHeight - padY - 30) / (1 / 3 + n / 4);
    // En vertical se prefiere caber en alto, pero sin bajar de un tamaño
    // legible: en un móvil estrecho manda el ancho y la torre hace scroll
    const w = Math.max(160, Math.floor(tall ? Math.min(byWidth, Math.max(byHeight, 260)) : Math.min(byWidth, byHeight)));
    tower.style.setProperty('--floor-w', w + 'px');
    tower.style.setProperty('--floors', String(n));
    towerPlaceCab(towerLevel, true);
}

/**
 * Coloca la cabina a la altura de un piso.
 * @param {number} level
 * @param {boolean} instant
 * @param {number} [floors] cuántos pisos recorre (para la duración)
 */
function towerPlaceCab(level, instant, floors = 1) {
    const cab = document.getElementById('tower-cab');
    const idx = Math.max(0, towerLevels.indexOf(level));
    cab.style.transitionDuration = instant ? '0s' : (TOWER_CAB_S_PER_FLOOR * Math.max(1, floors)) + 's';
    cab.style.setProperty('--cab-i', String(idx));
}

/**
 * Elige un piso: la cabina se desliza hasta él, suena el «ding» al
 * llegar y la ficha muestra su jefe.
 * @param {number} level
 * @param {{ instant?: boolean }} [opts]
 */
function towerSelect(level, opts = {}) {
    if (towerEntering || !towerLevels.includes(level)) return;
    const from = towerLevels.indexOf(towerLevel);
    const to = towerLevels.indexOf(level);
    const dist = Math.abs(to - from);
    towerLevel = level;
    const instant = !!opts.instant || prefersReducedMotion();
    towerPlaceCab(level, instant, dist);
    document.getElementById('tower-led').textContent = HACHEPES_LORE[level].floor;
    document.querySelectorAll('#tower-floors .tower__floor').forEach((btn) => {
        const on = Number(/** @type {HTMLElement} */ (btn).dataset.level) === level;
        btn.classList.toggle('is-selected', on);
        btn.setAttribute('aria-pressed', String(on));
    });
    renderFloorSheet(level);
    if (!opts.instant && dist > 0) {
        soundEffects.uiClick();
        setTimeout(() => {
            if (towerLevel === level && soundEffects.elevatorDing) soundEffects.elevatorDing();
        }, instant ? 0 : TOWER_CAB_S_PER_FLOOR * dist * 1000);
        // Que el piso elegido se vea (vertical con scroll)
        const btn = document.querySelector(`#tower-floors .tower__floor[data-level="${level}"]`);
        if (btn) btn.scrollIntoView({ block: 'nearest', behavior: instant ? 'auto' : 'smooth' });
    }
}

/**
 * Sube o baja un piso (teclado, deslizar, rueda).
 * @param {number} dir -1 arriba, 1 abajo (en el orden de la torre)
 */
function towerMove(dir) {
    const idx = towerLevels.indexOf(towerLevel) + dir;
    if (idx < 0 || idx >= towerLevels.length) return;
    towerSelect(towerLevels[idx]);
    // Si el foco estaba en un piso, pasa al nuevo (ENTER entra en el enfocado)
    const focused = document.activeElement;
    if (focused && focused.classList && focused.classList.contains('tower__floor')) {
        const btn = /** @type {HTMLElement|null} */ (document.querySelector(`#tower-floors .tower__floor[data-level="${towerLevel}"]`));
        if (btn) btn.focus({ preventScroll: true });
    }
}

/**
 * La ficha del piso elegido.
 * @param {number} level
 */
function renderFloorSheet(level) {
    const sheet = document.getElementById('floor-sheet');
    if (!sheet) return;
    const lore = HACHEPES_LORE[level];
    const st = towerFloorState(level);
    const isCreator = level === CAMPAIGN_CREATOR;
    const locked = st === 'locked';
    sheet.dataset.state = st;
    sheet.classList.toggle('is-creator', isCreator);

    document.getElementById('floor-sheet-floor').textContent = `${towerFloorName(level)} · ${locked ? '???' : lore.room.toUpperCase()}`;

    const busts = [lore.bust, lore.bust2].filter(Boolean);
    document.getElementById('floor-sheet-bust').innerHTML = busts.map((id) =>
        `<img src="${CAMPAIGN_ART.bustos[id].src}" alt="" class="${isCreator ? 'avatar-corrupted' : ''}">`).join('');

    const name = document.getElementById('floor-sheet-name');
    const alias = document.getElementById('floor-sheet-alias');
    const danger = document.getElementById('floor-sheet-danger');
    const desc = document.getElementById('floor-sheet-desc');
    const phasesEl = document.getElementById('floor-sheet-phases');
    const record = document.getElementById('floor-sheet-record');
    const go = /** @type {HTMLButtonElement} */ (document.getElementById('floor-sheet-go'));
    // VER ESCENA: solo si el piso tiene llegada y ya se vio
    document.getElementById('floor-sheet-scene').classList.toggle('hidden',
        locked || !LLEGADAS[level] || !playerProgression.campaignArrivals[level]);

    if (locked) {
        name.textContent = 'NIVEL ?';
        alias.textContent = 'Sin identificar';
        danger.innerHTML = '';
        desc.textContent = `${campaignUnlockHint(level)} para descubrir quién te espera aquí.`;
        phasesEl.replaceChildren();
        record.textContent = '';
        go.disabled = true;
        go.innerHTML = `${TOWER_ICON_LOCK}<span>BLOQUEADO</span>`;
        return;
    }

    name.textContent = lore.name;
    alias.textContent = lore.title;
    danger.innerHTML = '<span class="lbl">Peligro</span>' + dangerStarsHTML(lore.danger);
    desc.textContent = lore.desc;
    const boss = BOSS_MECHANICS[level];
    const names = boss && boss.phases ? boss.phases.map((p, i) => `${i + 1} · ${p.name}`) : ['Combate'];
    phasesEl.replaceChildren(...names.map((n) => {
        const chip = document.createElement('span');
        chip.className = 'floor-sheet__chip';
        chip.textContent = n;
        return chip;
    }));

    const best = campaignBestOf(level);
    const beaten = st === 'free';
    if (beaten) record.textContent = best.flawless ? 'Vencido sin un rasguño' : 'Vencido';
    else if (boss && boss.phases && best.bestPhase > 0) record.textContent = `Llegaste a la fase ${best.bestPhase}`;
    else record.textContent = '';
    go.disabled = false;
    go.innerHTML = beaten
        ? `${TOWER_ICON_REPEAT}<span>REPETIR</span><small>recompensa reducida</small>`
        : `${TOWER_ICON_UP}<span>SUBIR</span>`;
}

/** SUBIR / REPETIR / ENTER: el ascensor lleva al piso elegido y empieza el combate. */
function towerEnter() {
    const level = towerLevel;
    if (towerEntering || towerFloorState(level) === 'locked') return;
    towerEntering = true;
    soundEffects.uiClick();
    const cab = document.getElementById('tower-cab');
    const led = document.getElementById('tower-led');
    const reduced = prefersReducedMotion();
    const total = reduced ? TOWER_ENTER_REDUCED_MS : TOWER_ENTER_MS;
    cab.classList.add('is-closed');
    if (!reduced) {
        // El LED cuenta los pisos desde PB hasta el elegido
        const labels = ['PB', '1', '2', '3', '4'];
        const target = HACHEPES_LORE[level].floor;
        const steps = level === CAMPAIGN_CREATOR ? ['PB', 'S'] : labels.slice(0, labels.indexOf(target) + 1);
        steps.forEach((label, i) => setTimeout(() => { led.textContent = label; }, 400 + (800 / steps.length) * i));
        setTimeout(() => {
            if (soundEffects.elevatorDing) soundEffects.elevatorDing();
            cab.classList.remove('is-closed');
        }, 1200);
    }
    setTimeout(() => {
        towerEntering = false;
        if (!document.getElementById('campaign-menu').classList.contains('active-screen')) return;
        campaignEnterFloor(level);
    }, total);
}

/**
 * Llega a un piso: la primera vez, su escena de llegada (LLEGADAS); al
 * terminarla o saltarla queda vista y sigue a la pantalla VS. Si ya se
 * vio, o el piso no tiene escena, directo a la VS. Lo usan el ascensor y
 * «SIGUIENTE HACHEPE» (campaign/progress.js).
 * @param {number} level
 */
function campaignEnterFloor(level) {
    const arrival = LLEGADAS[level];
    if (!arrival || playerProgression.campaignArrivals[level]) {
        prepareCampaignMatch(level);
        return;
    }
    playCutscene(arrival, {
        onEnd: () => {
            playerProgression.campaignArrivals[level] = true;
            saveProgression();
            prepareCampaignMatch(level);
        }
    });
}

/** VER ESCENA en la ficha: vuelve a ver la llegada del piso elegido y regresa a la torre. */
function towerScene() {
    const arrival = LLEGADAS[towerLevel];
    if (towerEntering || !arrival) return;
    soundEffects.uiClick();
    playCutscene(arrival, { onEnd: () => showScreen('campaign-menu') });
}

/** En vertical, la ficha es una hoja abajo que se pliega y se despliega. */
function toggleFloorSheet() {
    const sheet = document.getElementById('floor-sheet');
    const open = !sheet.classList.contains('is-open');
    sheet.classList.toggle('is-open', open);
    document.getElementById('floor-sheet-grip').setAttribute('aria-expanded', String(open));
}

// ------------------------------------------------------------------
//  La ciudad de fondo
// ------------------------------------------------------------------

/** Arranca el bucle de la ciudad (se para solo al salir del menú). */
function startTowerCity() {
    cancelAnimationFrame(towerRaf);
    towerCityKey = '';
    towerRaf = requestAnimationFrame(towerCityFrame);
}

/** @param {number} now */
function towerCityFrame(now) {
    const menu = document.getElementById('campaign-menu');
    if (!menu.classList.contains('active-screen')) return;
    drawTowerCity(now / 1000);
    if (!prefersReducedMotion()) towerRaf = requestAnimationFrame(towerCityFrame);
}

/**
 * La ciudad: la del Sindicato debajo y la liberada encima, con opacidad
 * = jefes vencidos / 5 (y su máscara del tema), a cover; encima, lluvia.
 * @param {number} t segundos
 */
function drawTowerCity(t) {
    const cv = /** @type {HTMLCanvasElement} */ (document.getElementById('tower-city'));
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cv.clientWidth * dpr);
    const h = Math.round(cv.clientHeight * dpr);
    if (!w || !h) return;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const defeated = Math.max(0, Math.min(CAMPAIGN_LAST_BOSS, playerProgression.campaignProgress - 1));
    // Vencido Fano, la ciudad se enciende: como mínimo al 80 % y con su
    // máscara un 30 % más brillante
    const lit = campaignBestOf(TOWER_LIGHTS_LEVEL).won;
    const key = `${w}x${h}|${currentThemeHex()}|${defeated}|${lit}`;
    if (key !== towerCityKey || !towerCityCache) {
        const art = CAMPAIGN_ART.torre;
        const off = towerCityCache || document.createElement('canvas');
        off.width = w;
        off.height = h;
        const o = off.getContext('2d');
        const k = Math.max(w / art.ciudad_sindicato.w, h / art.ciudad_sindicato.h);
        const dw = art.ciudad_sindicato.w * k;
        const dh = art.ciudad_sindicato.h * k;
        const dx = (w - dw) / 2;
        const dy = h - dh;
        o.fillStyle = '#05060A';
        o.fillRect(0, 0, w, h);
        let ok = drawTintedArt(o, art.ciudad_sindicato, null, dx, dy, dw, dh);
        if (defeated > 0 || lit) {
            const alpha = lit ? Math.max(defeated / CAMPAIGN_LAST_BOSS, 0.8) : defeated / CAMPAIGN_LAST_BOSS;
            o.globalAlpha = alpha;
            ok = drawTintedArt(o, art.ciudad_libre, currentThemeHex(), dx, dy, dw, dh) && ok;
            const mask = lit && art.ciudad_libre.theme ? tintedMask(art.ciudad_libre.theme, currentThemeHex()) : null;
            if (mask) {
                o.globalAlpha = alpha * 0.3;
                o.globalCompositeOperation = 'lighter';
                o.drawImage(mask, dx, dy, dw, dh);
                o.globalCompositeOperation = 'source-over';
            }
            o.globalAlpha = 1;
        }
        // Un velo: la ciudad es fondo, la torre y la ficha mandan
        o.fillStyle = 'rgba(5, 6, 10, 0.35)';
        o.fillRect(0, 0, w, h);
        towerCityCache = off;
        towerCityKey = ok ? key : '';
        if (!ok) Promise.all([art.ciudad_sindicato.src, art.ciudad_libre.src, art.ciudad_libre.theme].map(artLoad))
            .then(() => { towerCityKey = ''; drawTowerCity(t); });
    }
    const ctx = cv.getContext('2d');
    ctx.drawImage(towerCityCache, 0, 0);
    if (prefersReducedMotion()) return;
    if (towerLightsT0 !== null) drawTowerLightsSweep(ctx, t, w, h);
    // Lluvia (las capas del prólogo), en unidades de 960 de ancho
    const k = w / 960;
    const uh = h / k;
    ctx.save();
    ctx.scale(k, k);
    ctx.lineCap = 'round';
    CUTSCENE_RAIN_LAYERS.forEach((L, li) => {
        ctx.strokeStyle = `rgba(170, 180, 215, ${L.alpha * 0.8})`;
        ctx.lineWidth = L.width;
        ctx.beginPath();
        const span = uh + L.len;
        for (let i = 0; i < L.count * 0.6; i++) {
            const u = vfxHash(i * 7 + li * 1009);
            const v = vfxHash(i * 13 + li * 2003 + 1);
            const y = ((v * span + t * L.speed) % span) - L.len;
            const x = u * (960 + uh * L.tilt) - y * L.tilt;
            ctx.moveTo(x + L.len * L.tilt, y - L.len);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    });
    ctx.restore();
}

/**
 * El destello del premio de las luces: una franja brillante que sube por
 * las ventanas (la máscara de la ciudad liberada, en blanco) en 1,5 s.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} t segundos del bucle
 * @param {number} w
 * @param {number} h
 */
function drawTowerLightsSweep(ctx, t, w, h) {
    if (towerLightsT0 === -1) towerLightsT0 = t;
    const p = (t - towerLightsT0) / TOWER_LIGHTS_SWEEP_S;
    if (p >= 1) {
        towerLightsT0 = null;
        return;
    }
    const art = CAMPAIGN_ART.torre.ciudad_libre;
    const mask = art.theme ? tintedMask(art.theme, '#FFFFFF') : null;
    if (!mask) return;
    const k = Math.max(w / art.w, h / art.h);
    const dw = art.w * k, dh = art.h * k;
    const band = h * 0.22;
    const cy = h + band / 2 - p * (h + band);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Tres capas: el centro de la franja brilla más que los bordes
    for (const [half, alpha] of [[band / 2, 0.35], [band / 3, 0.45], [band / 6, 0.6]]) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, cy - half, w, half * 2);
        ctx.clip();
        ctx.globalAlpha = alpha;
        ctx.drawImage(mask, (w - dw) / 2, h - dh, dw, dh);
        ctx.restore();
    }
    ctx.restore();
}

// ------------------------------------------------------------------
//  Controles
// ------------------------------------------------------------------

/**
 * Teclado (↑ ↓, ENTER), deslizar en vertical y la rueda: la torre se
 * maneja sin ratón. El clic en un piso es data-action="towerSelect".
 */
function initTowerControls() {
    const menu = document.getElementById('campaign-menu');
    if (!menu) return;
    const active = () => menu.classList.contains('active-screen') && !isDialogueActive && !cutscenePlaying();

    document.addEventListener('keydown', (e) => {
        if (!active()) return;
        if (e.code === 'ArrowUp')   { towerMove(-1); e.preventDefault(); }
        if (e.code === 'ArrowDown') { towerMove(1);  e.preventDefault(); }
        if (e.code === 'Enter' || e.code === 'Space') {
            // Un botón enfocado hace lo suyo; un piso enfocado que ya es el
            // elegido entra (si no, el clic del navegador lo elige)
            const target = /** @type {HTMLElement} */ (e.target);
            const btn = target && target.closest ? /** @type {HTMLElement|null} */ (target.closest('button')) : null;
            if (btn && !(btn.classList.contains('tower__floor') && Number(btn.dataset.level) === towerLevel)) return;
            towerEnter();
            e.preventDefault();
        }
    });

    const scene = document.getElementById('tower-wrap');
    if (!scene) return;
    const scrollable = () => scene.scrollHeight > scene.clientHeight + 2;
    let startY = null;
    scene.addEventListener('touchstart', (/** @type {TouchEvent} */ e) => { startY = e.touches[0].clientY; }, { passive: true });
    scene.addEventListener('touchend', (/** @type {TouchEvent} */ e) => {
        if (startY === null) return;
        const dy = e.changedTouches[0].clientY - startY;
        startY = null;
        // Si la torre hace scroll, el dedo la desplaza; si no, cambia de piso
        if (Math.abs(dy) > 40 && !scrollable()) towerMove(dy < 0 ? -1 : 1);
    }, { passive: true });
    scene.addEventListener('wheel', (/** @type {WheelEvent} */ e) => {
        if (!active() || scrollable() || Math.abs(e.deltaY) < 4) return;
        e.preventDefault();
        const now = performance.now();
        if (now - towerWheelAt < 260) return;
        towerWheelAt = now;
        towerMove(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    window.addEventListener('resize', () => {
        if (menu.classList.contains('active-screen')) layoutTower();
    });
}

/**
 * El prólogo de la campaña (data/cutscenes/prologo.js). Al terminar o
 * saltarlo queda visto y se vuelve al menú de campaña, con su música.
 */
function playCampaignPrologue() {
    playCutscene(PROLOGO, {
        onEnd: () => {
            playerProgression.campaignIntroSeen = true;
            saveProgression();
            showScreen('campaign-menu');
        }
    });
}
