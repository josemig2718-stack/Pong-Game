/**
 * ui/stats-panel.js
 * ------------------------------------------------------------------
 * Pantallas de estadísticas y de logros. Los logros secretos aún
 * bloqueados se muestran como "????" y no cuentan en el total visible.
 * ------------------------------------------------------------------
 */

'use strict';

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

    // VS CPU
    setText('stat-cpu-wins',       `${s.cpuWins} / ${s.cpuLosses}`);
    const cpuTotal = s.cpuWins + s.cpuLosses;
    const cpuRate  = cpuTotal > 0 ? Math.round((s.cpuWins / cpuTotal) * 100) : 0;
    setText('stat-cpu-winrate',    `${cpuRate}%`);
    setText('stat-cpu-streak',     s.cpuCurrentStreak > 0 ? `${s.cpuCurrentStreak} 🔥` : '0');
    setText('stat-cpu-best',       s.cpuBestStreak > 0 ? `${s.cpuBestStreak} 🏆` : '0');
    setText('stat-cpu-perfect',    s.cpuPerfectGames > 0 ? `${s.cpuPerfectGames} ⭐` : '0');

    // Local
    setText('stat-local-games',    s.localGamesPlayed);
    setText('stat-local-wins',     `${s.localP1Wins} / ${s.localP2Wins}`);

    // Récords
    setText('stat-longest-rally',  `${s.longestRally} golpes`);
    setText('stat-max-speed',      s.maxBallSpeed > 0 ? s.maxBallSpeed.toFixed(1) : '—');

    // Logros count
    const unlocked = getUnlockedCount();
    const total    = getVisibleAchievementsTotal();
    setText('achievements-count',  `${unlocked} / ${total} desbloqueados`);
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
    showScreen('achievements-menu');
    populateAchievementsGrid();

    const unlocked = getUnlockedCount();
    const total = getVisibleAchievementsTotal();
    setText('achievements-count', `${unlocked} / ${total} desbloqueados`);
}

/** Genera las tarjetas de logros en el grid */
function populateAchievementsGrid() {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;
    grid.innerHTML = '';

    ACHIEVEMENTS.forEach(ach => {
        const isUnlocked = !!gameStats.achievements[ach.id];
        const unlockDate = isUnlocked ? new Date(gameStats.achievements[ach.id]) : null;

        // Los logros secretos no revelan ni su nombre ni cómo se consiguen
        const hidden = !isUnlocked && ach.secret;

        const card = document.createElement('div');
        card.className = `achievement-card ${isUnlocked ? 'achievement-card--unlocked' : 'achievement-card--locked'}`
            + (hidden ? ' achievement-card--secret' : '');

        card.innerHTML = `
            <span class="achievement-card__emoji">${isUnlocked ? ach.emoji : (hidden ? '❓' : '🔒')}</span>
            <span class="achievement-card__name">${hidden ? '????' : ach.name}</span>
            <span class="achievement-card__desc">${hidden ? '????' : ach.desc}</span>
            <span class="achievement-card__date">${isUnlocked ? formatAchievementDate(unlockDate) : '—'}</span>
        `;

        grid.appendChild(card);
    });
}

function formatAchievementDate(date) {
    if (!date) return '';
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `✅ ${d}/${m}/${y}`;
}

/** Helper: pone texto en un elemento por ID */
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
