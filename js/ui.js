/**
 * ui.js
 * ------------------------------------------------------------------
 * Navegación entre pantallas/menús y conexión de los controles de la
 * pantalla de Configuración y Controles con el estado en `settings`.
 * ------------------------------------------------------------------
 */

import { DEFAULT_BINDINGS, DEFAULT_SETTINGS, saveSettings, settings } from './core/settings.js';
import { state } from './core/state.js';
import { ACHIEVEMENTS } from './data/achievements.js';
import { getUnlockedCount, getVisibleAchievementsTotal } from './systems/achievements.js';
import {
    getAudioContext,
    playGameplayMusic,
    playMenuMusic,
    playTone,
    setMasterVolume,
    setMusicEnabled,
    setMusicVolume,
    setSfxEnabled,
    soundEffects,
    stopAllMusic
} from './systems/audio.js';
import { refreshBindingButtons, startListeningFor } from './systems/input.js';
import { clearMouseControl } from './systems/pointer.js';
import {
    getCurrentLevel,
    getXPProgress,
    sessionCoinsGained,
    sessionLeveledUp,
    sessionNewTitle,
    sessionXPGained
} from './systems/progression.js';
import { formatPlayTime, gameStats, resetStats } from './systems/stats.js';
import { applyTheme, buildThemeSwatches } from './systems/theme.js';
import { renderCampaignMap } from './campaign.js';
import { showShopScreen, updateCoinDisplay } from './shop.js';

export function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active-screen'));
    const requested = document.getElementById(screenId);
    if (requested) requested.classList.add('active-screen');

    if (screenId === 'main-menu') {
        document.getElementById('game-container').classList.add('hidden');
        document.getElementById('game-container').classList.remove('flex');

        // Música del menú principal
        playMenuMusic();
    } else if (screenId === 'shop-menu') {
        showShopScreen();
    } else if (screenId === 'campaign-menu') {
        renderCampaignMap();
    }
    soundEffects.uiClick();
}

export function closeGame() {
    showScreen('exit-menu');
}

export function forceClose() {
    stopAllMusic();
    document.body.innerHTML = `<div class="flex w-full h-full items-center justify-center text-center text-lg md:text-2xl px-8" style="color: var(--primary)">EL JUEGO SE HA CERRADO.<br>PUEDES CERRAR ESTA PESTAÑA.</div>`;
}

// --- Configuración: dificultad, volumen y demás opciones ---
export function updateDifficulty(val) {
    settings.difficulty = parseInt(val, 10);
    saveSettings();
}

export function updateVolume(val) {
    setMasterVolume(parseInt(val, 10));
    document.getElementById('vol-display').textContent = `${val}%`;
    getAudioContext();
    if (val > 0) playTone(400, 'square', 0.05);
}

export function updateMusicVolume(val) {
    setMusicVolume(parseInt(val, 10));
    document.getElementById('music-vol-display').textContent = `${val}%`;
}

export function toggleMusic(enabled) {
    setMusicEnabled(enabled);
    if (enabled) {
        // Reanudar la música que corresponda según el estado actual
        if (state.isPlaying) {
            playGameplayMusic();
        } else {
            playMenuMusic();
        }
    }
}

export function updateWinningScore(val) {
    settings.winningScore = parseInt(val, 10);
    saveSettings();
    document.querySelectorAll('[data-winning-score]').forEach(btn => {
        btn.classList.toggle('option-pill--active', parseInt(btn.dataset.winningScore, 10) === settings.winningScore);
    });
}

export function updateBallSpeed(val) {
    settings.ballSpeed = parseInt(val, 10);
    saveSettings();
    document.querySelectorAll('[data-ball-speed]').forEach(btn => {
        btn.classList.toggle('option-pill--active', parseInt(btn.dataset.ballSpeed, 10) === settings.ballSpeed);
    });
}

export function toggleSfx(enabled) {
    setSfxEnabled(enabled);
    if (enabled) playTone(500, 'triangle', 0.05);
}

export function toggleCrtEffect(enabled) {
    settings.crtEffect = enabled;
    saveSettings();
    document.body.classList.toggle('crt-effect', enabled);
}

export function toggleScreenShake(enabled) {
    settings.screenShake = enabled;
    saveSettings();
}

export function toggleMouseControl(enabled) {
    settings.mouseControl = enabled;
    saveSettings();
    if (!enabled) {
        clearMouseControl();
    }
}

export function resetAllSettings() {
    Object.assign(settings, DEFAULT_SETTINGS, { bindings: { ...DEFAULT_BINDINGS } });
    saveSettings();
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
    if (document.getElementById('powerups-toggle')) {
        document.getElementById('powerups-toggle').checked = settings.powerupsEnabled;
    }
    document.body.classList.toggle('crt-effect', settings.crtEffect);

    updateWinningScore(settings.winningScore);
    updateBallSpeed(settings.ballSpeed);
    refreshBindingButtons();
}

export function togglePowerups(enabled) {
    settings.powerupsEnabled = enabled;
    saveSettings();
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
    const total    = getVisibleAchievementsTotal();
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

/** Muestra la pantalla de stats y carga los datos */
export function showStatsScreen() {
    showScreen('stats-menu');
    populateStatsScreen();
}

/** Muestra la pantalla de logros y carga los datos */
export function showAchievementsScreen() {
    showScreen('achievements-menu');
    populateAchievementsGrid();
    
    const unlocked = getUnlockedCount();
    const total = getVisibleAchievementsTotal();
    setText('achievements-count', `${unlocked} / ${total} desbloqueados`);
}

/** Borra estadísticas (manteniendo logros) con confirmación */
export function confirmResetStats() {
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

/**
 * Actualiza la UI de progresión (barra XP, nivel, y el panel de fin de partida)
 */
export function updateProgressionDisplay() {
    // 1. Menú principal
    const titleEl = document.getElementById('menu-level-title');
    const barEl = document.getElementById('menu-xp-bar');
    
    if (titleEl) {
        const lvl = getCurrentLevel();
        titleEl.textContent = `Nv. ${lvl.level} — ${lvl.title}`;
    }
    
    if (barEl) {
        const prog = getXPProgress();
        barEl.style.width = `${prog.percentage}%`;
    }

    // 2. Pantalla de fin de partida
    const gameOverProgression = document.getElementById('game-over-progression');
    if (gameOverProgression) {
        if (sessionXPGained > 0 || sessionCoinsGained > 0) {
            gameOverProgression.classList.remove('hidden');
            
            document.getElementById('game-over-xp').textContent = `+${sessionXPGained} XP`;
            document.getElementById('game-over-coins').innerHTML = `+${sessionCoinsGained} <img src="assets/chemi_coin.png" class="w-4 h-4 inline object-contain" style="vertical-align: text-top;">`;
            
            const alertEl = document.getElementById('level-up-alert');
            if (sessionLeveledUp) {
                alertEl.classList.remove('hidden');
                document.getElementById('level-up-text').textContent = sessionNewTitle;
            } else {
                alertEl.classList.add('hidden');
            }
        } else {
            gameOverProgression.classList.add('hidden');
        }
    }
}

/** Construye la interfaz inicial y muestra el menú principal. */
export function initUI() {
    buildThemeSwatches(document.getElementById('theme-swatches'));
    applyTheme(settings.theme);
    populateSettingsUI();
    
    updateProgressionDisplay();
    updateCoinDisplay();
    
    showScreen('main-menu');

    document.querySelectorAll('[data-binding-action]').forEach(btn => {
        btn.addEventListener('click', () => startListeningFor(btn.dataset.bindingAction));
    });
}

