/**
 * ui.js
 * ------------------------------------------------------------------
 * Navegación entre pantallas/menús y conexión de los controles de la
 * pantalla de Configuración y Controles con el estado en `settings`.
 * ------------------------------------------------------------------
 */

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active-screen'));
    const requested = document.getElementById(screenId);
    if (requested) requested.classList.add('active-screen');

    if (screenId === 'main-menu') {
        document.getElementById('game-container').classList.add('hidden');
        document.getElementById('game-container').classList.remove('flex');

        // Música del menú principal
        playMenuMusic();
    }
    soundEffects.uiClick();
}

function closeGame() {
    showScreen('exit-menu');
}

function forceClose() {
    stopAllMusic();
    document.body.innerHTML = `<div class="flex w-full h-full items-center justify-center text-center text-lg md:text-2xl px-8" style="color: var(--primary)">EL JUEGO SE HA CERRADO.<br>PUEDES CERRAR ESTA PESTAÑA.</div>`;
}

// --- Configuración: dificultad, volumen y demás opciones ---
function updateDifficulty(val) {
    settings.difficulty = parseInt(val, 10);
    saveSettings(settings);
}

function updateVolume(val) {
    setMasterVolume(parseInt(val, 10));
    document.getElementById('vol-display').textContent = `${val}%`;
    getAudioContext();
    if (val > 0) playTone(400, 'square', 0.05);
}

function updateMusicVolume(val) {
    setMusicVolume(parseInt(val, 10));
    document.getElementById('music-vol-display').textContent = `${val}%`;
}

function toggleMusic(enabled) {
    setMusicEnabled(enabled);
    if (enabled) {
        // Reanudar la música que corresponda según el estado actual
        if (isPlaying) {
            playGameplayMusic();
        } else {
            playMenuMusic();
        }
    }
}

function updateWinningScore(val) {
    settings.winningScore = parseInt(val, 10);
    saveSettings(settings);
    document.querySelectorAll('[data-winning-score]').forEach(btn => {
        btn.classList.toggle('option-pill--active', parseInt(btn.dataset.winningScore, 10) === settings.winningScore);
    });
}

function updateBallSpeed(val) {
    settings.ballSpeed = parseInt(val, 10);
    saveSettings(settings);
    document.querySelectorAll('[data-ball-speed]').forEach(btn => {
        btn.classList.toggle('option-pill--active', parseInt(btn.dataset.ballSpeed, 10) === settings.ballSpeed);
    });
}

function toggleSfx(enabled) {
    setSfxEnabled(enabled);
    if (enabled) playTone(500, 'triangle', 0.05);
}

function toggleCrtEffect(enabled) {
    settings.crtEffect = enabled;
    saveSettings(settings);
    document.body.classList.toggle('crt-effect', enabled);
}

function toggleScreenShake(enabled) {
    settings.screenShake = enabled;
    saveSettings(settings);
}

function toggleMouseControl(enabled) {
    settings.mouseControl = enabled;
    saveSettings(settings);
    if (!enabled && typeof clearMouseControl === 'function') {
        clearMouseControl();
    }
}

function resetAllSettings() {
    Object.assign(settings, DEFAULT_SETTINGS, { bindings: { ...DEFAULT_BINDINGS } });
    saveSettings(settings);
    populateSettingsUI();
    applyTheme(settings.theme);
    stopAllMusic();
    playMenuMusic();
}

/** Sincroniza todos los controles del menú de configuración con `settings` al iniciar */
function populateSettingsUI() {
    document.getElementById('difficulty-slider').value      = settings.difficulty;
    document.getElementById('volume-slider').value          = settings.volume;
    document.getElementById('vol-display').textContent      = `${settings.volume}%`;
    document.getElementById('sfx-toggle').checked           = settings.sfxEnabled;
    document.getElementById('crt-toggle').checked           = settings.crtEffect;
    document.getElementById('shake-toggle').checked         = settings.screenShake;
    document.getElementById('music-toggle').checked         = settings.musicEnabled;
    document.getElementById('music-volume-slider').value    = settings.musicVolume;
    document.getElementById('music-vol-display').textContent = `${settings.musicVolume}%`;
    document.getElementById('mouse-toggle').checked         = settings.mouseControl;
    document.body.classList.toggle('crt-effect', settings.crtEffect);

    updateWinningScore(settings.winningScore);
    updateBallSpeed(settings.ballSpeed);
    refreshBindingButtons();
}

// =====================================================================
//  ESTADÍSTICAS Y LOGROS — UI
// =====================================================================

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
    const total    = ACHIEVEMENTS.length;
    setText('achievements-count',  `${unlocked} / ${total} desbloqueados`);
}

/** Genera las tarjetas de logros en el grid */
function populateAchievementsGrid() {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;
    grid.innerHTML = '';

    ACHIEVEMENTS.forEach(ach => {
        const isUnlocked = !!gameStats.achievements[ach.id];
        const unlockDate = isUnlocked ? new Date(gameStats.achievements[ach.id]) : null;

        const card = document.createElement('div');
        card.className = `achievement-card ${isUnlocked ? 'achievement-card--unlocked' : 'achievement-card--locked'}`;

        card.innerHTML = `
            <span class="achievement-card__emoji">${isUnlocked ? ach.emoji : '🔒'}</span>
            <span class="achievement-card__name">${ach.name}</span>
            <span class="achievement-card__desc">${ach.desc}</span>
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

/** Alterna entre las pestañas de estadísticas y logros */
function switchStatsTab(tab) {
    const statsTab   = document.getElementById('stats-tab-content');
    const achTab     = document.getElementById('achievements-tab-content');
    const statsBtn   = document.getElementById('stats-tab-btn');
    const achBtn     = document.getElementById('achievements-tab-btn');

    if (tab === 'stats') {
        statsTab.classList.remove('hidden');
        achTab.classList.add('hidden');
        statsBtn.classList.add('stats-tab-btn--active');
        achBtn.classList.remove('stats-tab-btn--active');
        populateStatsScreen();
    } else {
        statsTab.classList.add('hidden');
        achTab.classList.remove('hidden');
        achBtn.classList.add('stats-tab-btn--active');
        statsBtn.classList.remove('stats-tab-btn--active');
        populateAchievementsGrid();
    }
}

/** Muestra la pantalla de stats y carga los datos */
function showStatsScreen() {
    showScreen('stats-menu');
    switchStatsTab('stats');
}

/** Borra estadísticas (manteniendo logros) con confirmación */
function confirmResetStats() {
    if (confirm('¿Borrar todas las estadísticas? Los logros se mantendrán.')) {
        resetStats();
        populateStatsScreen();
        soundEffects.uiClick();
    }
}

/** Helper: pone texto en un elemento por ID */
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

document.addEventListener('DOMContentLoaded', () => {
    buildThemeSwatches(document.getElementById('theme-swatches'));
    applyTheme(settings.theme);
    populateSettingsUI();
    showScreen('main-menu');

    document.querySelectorAll('[data-binding-action]').forEach(btn => {
        btn.addEventListener('click', () => startListeningFor(btn.dataset.bindingAction));
    });
});

