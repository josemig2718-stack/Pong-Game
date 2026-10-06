/**
 * ui/stats-panel.js
 * ------------------------------------------------------------------
 * Pantallas de estadísticas y de logros, y la medalla de cada logro
 * (también la usa el aviso de systems/achievements.js).
 *
 * Los logros se agrupan por categoría y se pueden filtrar. El secreto
 * se dibuja al final de Campaña: mientras está bloqueado no enseña ni su
 * glifo, ni su nombre, ni su color, y no cuenta en el total visible.
 * ------------------------------------------------------------------
 */

'use strict';

/** Categoría elegida en la pantalla de logros ('all' = todas). No se guarda. */
let achievementFilter = 'all';

const STATS_CHECK_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

/** Muestra la pantalla de stats y carga los datos */
function showStatsScreen() {
    showScreen('stats-menu');
    populateStatsScreen();
}

/** Llena la pantalla de estadísticas con los valores actuales */
function populateStatsScreen() {
    const s = gameStats;

    // General
    setText('stat-total-games',     s.totalGamesPlayed);
    setText('stat-total-time',      formatPlayTime(s.totalTimePlayedMs));
    setText('stat-total-scored',    s.totalPointsScored);
    setText('stat-total-conceded',  s.totalPointsConceded);

    // VS CPU: el anillo recibe el porcentaje como variable CSS
    const cpuTotal = s.cpuWins + s.cpuLosses;
    const cpuRate  = cpuTotal > 0 ? Math.round((s.cpuWins / cpuTotal) * 100) : 0;
    setText('stat-cpu-wins',       s.cpuWins);
    setText('stat-cpu-losses',     s.cpuLosses);
    setText('stat-cpu-winrate',    `${cpuRate}%`);
    const ring = document.getElementById('stat-cpu-ring');
    if (ring) ring.style.setProperty('--pct', String(cpuRate));
    setText('stat-cpu-streak',     s.cpuCurrentStreak);
    setText('stat-cpu-best',       s.cpuBestStreak);
    setText('stat-cpu-perfect',    s.cpuPerfectGames);

    // Local
    setText('stat-local-games',    s.localGamesPlayed);
    setText('stat-local-wins',     `${s.localP1Wins} / ${s.localP2Wins}`);

    // Récords
    setText('stat-longest-rally',  s.longestRally);
    setText('stat-max-speed',      s.maxBallSpeed > 0 ? s.maxBallSpeed.toFixed(1) : '—');
}

/** Borra estadísticas (manteniendo logros) con confirmación */
function confirmResetStats() {
    if (confirm('¿Borrar todas las estadísticas? Los logros se mantendrán.')) {
        resetStats();
        populateStatsScreen();
        soundEffects.uiClick();
    }
}

/** Muestra la pantalla de logros y carga los datos */
function showAchievementsScreen() {
    achievementFilter = 'all';
    showScreen('achievements-menu');
    populateAchievementsGrid();
}

/**
 * Filtra la lista de logros por categoría.
 * @param {string} category clave de ACHIEVEMENT_CATEGORIES o 'all'
 */
function filterAchievements(category) {
    achievementFilter = category;
    populateAchievementsGrid();
}

/**
 * Color de la categoría de un logro.
 * @param {Achievement} ach
 */
function achievementColor(ach) {
    return ACHIEVEMENT_CATEGORIES[ach.category].color;
}

/**
 * Grupo en el que se dibuja un logro: el secreto va dentro de Campaña.
 * @param {Achievement} ach
 */
function achievementGroupOf(ach) {
    return ach.category === 'secreto' ? 'campana' : ach.category;
}

/**
 * ¿Cuenta en los totales? Un secreto aún bloqueado no: delataría que existe.
 * @param {Achievement} ach
 */
function achievementIsCounted(ach) {
    return !ach.secret || !!gameStats.achievements[ach.id];
}

/**
 * Medalla hexagonal de un logro, en línea. El color lo da la categoría y
 * la intensidad el estado; el secreto bloqueado lleva el glifo "?" y gris.
 * @param {Achievement} ach
 * @param {'unlocked'|'progress'|'locked'|'secret'} state
 * @returns {string}
 */
function achievementMedalSVG(ach, state) {
    let fill = '#11141C', stroke = 'rgba(255,255,255,.12)', glyph = '#4B5563', icon = ach.icon;
    if (state === 'unlocked') {
        const color = achievementColor(ach);
        fill = `${color}24`; stroke = color; glyph = color;
    } else if (state === 'progress') {
        const color = achievementColor(ach);
        stroke = `${color}66`; glyph = `${color}AA`;
    } else if (state === 'secret') {
        icon = ACHIEVEMENT_SECRET_ICON;
    }
    return `<svg class="ach-medal" viewBox="0 0 48 48" aria-hidden="true">`
        + `<path d="M24 2L43 13V35L24 46L5 35V13Z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>`
        + `<path d="M24 7L38.7 15.5V32.5L24 41L9.3 32.5V15.5Z" fill="none" stroke="${stroke}" stroke-width="1" opacity=".35" stroke-linejoin="round"/>`
        + `<g transform="translate(12 12)" fill="none" stroke="${glyph}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${icon}"/></g>`
        + `</svg>`;
}

/**
 * Pie de una tarjeta: la fecha, la barra de progreso o "Bloqueado".
 * @param {Achievement} ach
 * @param {'unlocked'|'progress'|'locked'|'secret'} state
 */
function achievementFootHTML(ach, state) {
    if (state === 'unlocked') {
        const date = formatAchievementDate(new Date(gameStats.achievements[ach.id]));
        return `<span class="achievement-card__foot achievement-card__foot--date">${STATS_CHECK_ICON}Desbloqueado ${date}</span>`;
    }
    if (state === 'progress') {
        const { current, target } = getAchievementProgress(ach.id);
        const pct = Math.round(current / target * 100);
        return `<span class="achievement-card__foot achievement-card__foot--progress">`
            + `<span class="achievement-card__bar"><i style="width: ${pct}%;"></i></span>`
            + `<span class="achievement-card__count">${current}/${target}</span></span>`;
    }
    return `<span class="achievement-card__foot"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">`
        + `<path d="${ACHIEVEMENT_LOCK_ICON}"/></svg>Bloqueado</span>`;
}

/**
 * @param {Achievement} ach
 * @returns {HTMLElement}
 */
function buildAchievementCard(ach) {
    const state = getAchievementState(ach);
    const hidden = state === 'secret';
    const card = document.createElement('div');
    card.className = `achievement-card achievement-card--${state}`;
    if (!hidden) card.style.setProperty('--ach-color', achievementColor(ach));
    card.innerHTML = `
            ${achievementMedalSVG(ach, state)}
            <div class="achievement-card__text">
                <span class="achievement-card__name">${hidden ? '????' : ach.name}</span>
                <span class="achievement-card__desc">${hidden ? '????' : ach.desc}</span>
                ${achievementFootHTML(ach, state)}
            </div>`;
    return card;
}

/**
 * Genera la pantalla de logros: resumen, filtros, último desbloqueado y
 * las tarjetas agrupadas por categoría.
 */
function populateAchievementsGrid() {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;

    const counted = ACHIEVEMENTS.filter(achievementIsCounted);
    const unlocked = counted.filter(a => gameStats.achievements[a.id]).length;
    const total = counted.length;
    const inProgress = counted.filter(a => getAchievementState(a) === 'progress').length;
    const pct = total > 0 ? Math.round(unlocked / total * 100) : 0;

    setText('achievements-count', `${unlocked} / ${total}`);

    const summary = document.getElementById('achievements-summary');
    if (summary) {
        summary.innerHTML = `
            <div class="pct-ring ach-ring" style="--pct: ${pct};">
                <div class="pct-ring__inner"><span class="px pct-ring__value">${unlocked}</span><span class="pct-ring__label">de ${total}</span></div>
            </div>
            <div class="ach-summary__text">
                <span class="px ach-summary__pct">${pct}%</span>
                <span class="ach-summary__sub">completado · ${inProgress} en progreso</span>
            </div>
            <div class="ach-summary__bar"><i style="width: ${pct}%;"></i></div>
            <span class="ach-summary__line">${pct}% completado · ${inProgress} en progreso</span>`;
    }

    // Último logro desbloqueado (la píldora no aparece si no hay ninguno)
    const lastBox = document.getElementById('achievements-last');
    if (lastBox) {
        const last = getLastUnlockedAchievement();
        lastBox.classList.toggle('hidden', !last);
        lastBox.innerHTML = last
            ? `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${last.icon}"/></svg><span>Último: ${last.name}</span>`
            : '';
    }

    // Grupos por categoría (el secreto nunca forma uno propio)
    const groups = Object.keys(ACHIEVEMENT_CATEGORIES).filter(key => key !== 'secreto').map(key => {
        const items = ACHIEVEMENTS.filter(a => achievementGroupOf(a) === key);
        const visible = items.filter(achievementIsCounted);
        return {
            key,
            info: ACHIEVEMENT_CATEGORIES[key],
            items,
            done: visible.filter(a => gameStats.achievements[a.id]).length,
            total: visible.length
        };
    });

    const cats = document.getElementById('achievements-cats');
    if (cats) {
        const catButton = (key, name, color, count) =>
            `<button class="ach-cat${achievementFilter === key ? ' is-active' : ''}" data-action="filterAchievements" data-arg="${key}">`
            + `<i style="background: ${color};"></i>${name}<small>${count}</small></button>`;
        cats.innerHTML = catButton('all', 'Todos', 'var(--primary)', `${unlocked}/${total}`)
            + groups.map(g => catButton(g.key, g.info.name, g.info.color, `${g.done}/${g.total}`)).join('');
    }

    grid.innerHTML = '';
    groups.filter(g => achievementFilter === 'all' || achievementFilter === g.key).forEach(g => {
        const section = document.createElement('section');
        section.className = 'achievement-group';
        section.innerHTML = `<h3 class="achievement-group__head"><span class="px" style="color: ${g.info.color};">${g.info.name.toUpperCase()}</span><small>${g.done} / ${g.total}</small></h3>`;
        const list = document.createElement('div');
        list.className = 'achievement-group__grid';
        g.items.forEach(ach => list.appendChild(buildAchievementCard(ach)));
        section.appendChild(list);
        grid.appendChild(section);
    });
}

/** @param {Date} date */
function formatAchievementDate(date) {
    if (!date) return '';
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

/** Helper: pone texto en un elemento por ID */
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
