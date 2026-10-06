/**
 * ui/progress-display.js
 * ------------------------------------------------------------------
 * Marcadores de progreso: nivel y barra de XP del menú principal,
 * monedas (menú, modo y tienda), los datos de las tarjetas de modo y
 * el resumen de recompensas al terminar una partida.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Actualiza la UI de progresión (barra XP, nivel, y el panel de fin de partida)
 */
function updateProgressionDisplay() {
    // 1. Menú principal: insignia de nivel, título y XP hacia el siguiente
    const lvl = getCurrentLevel();
    const prog = getXPProgress();
    const isMaxLevel = lvl.level >= LEVELS.length;
    setMenuText('menu-level-num', String(lvl.level));
    setMenuText('menu-level-title', lvl.title);
    setMenuText('menu-xp-text', isMaxLevel ? 'Nivel máximo' : `${prog.current} / ${prog.required} XP`);

    const barEl = document.getElementById('menu-xp-bar');
    if (barEl) barEl.style.width = `${prog.percentage}%`;

    // 2. Pantalla de fin de partida
    const gameOverProgression = document.getElementById('game-over-progression');
    if (gameOverProgression) {
        if (sessionXPGained > 0 || sessionCoinsGained > 0) {
            gameOverProgression.classList.remove('hidden');

            setMenuText('game-over-xp', `+${sessionXPGained}`);
            setMenuText('game-over-coins', `+${sessionCoinsGained}`);

            // Nivel tras la partida, con los mismos datos que el menú
            setMenuText('game-over-level', `Nivel ${lvl.level} · ${lvl.title}`);
            setMenuText('game-over-xp-text', isMaxLevel ? 'Nivel máximo' : `${prog.current} / ${prog.required}`);
            const goBar = document.getElementById('game-over-xp-bar');
            if (goBar) goBar.style.width = `${prog.percentage}%`;

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

/** @param {string} id @param {string} text */
function setMenuText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

/**
 * Subtítulos de las tiles del menú principal: cosméticos comprados y
 * logros desbloqueados (sin delatar los secretos, como en Logros).
 */
function updateMenuTiles() {
    setMenuText('menu-shop-sub', `${getTotalPurchasedItems()} de ${getTotalShopItems()} comprados`);
    setMenuText('menu-achievements-sub', `${getUnlockedCount()} de ${getVisibleAchievementsTotal()}`);
}

/** Nombres de settings.difficulty, como en Configuración. */
const DIFFICULTY_NAMES = { 1: 'Fácil', 2: 'Normal', 3: 'Imposible' };

/**
 * Datos de las tarjetas de Selección de modo. La campaña cuenta solo
 * los cinco Hachepes ("X / 5"): el Creador no existe hasta que la
 * historia lo revela.
 */
function updateModeCards() {
    const vencidos = Math.min(playerProgression.campaignProgress - 1, CAMPAIGN_LAST_BOSS);
    const cuenta = `${vencidos} / ${CAMPAIGN_LAST_BOSS}`;
    setMenuText('mode-campaign-count', cuenta);
    setMenuText('mode-campaign-count-m', cuenta);
    const bar = document.getElementById('mode-campaign-bar');
    if (bar) bar.style.width = `${Math.round(vencidos / CAMPAIGN_LAST_BOSS * 100)}%`;
    setMenuText('mode-campaign-cta', playerProgression.campaignProgress > 1 ? 'CONTINUAR' : 'EMPEZAR');

    const dificultad = DIFFICULTY_NAMES[settings.difficulty] || DIFFICULTY_NAMES[2];
    setMenuText('mode-cpu-difficulty', dificultad);
    setMenuText('mode-cpu-sub', dificultad);
    setMenuText('mode-cpu-target', String(settings.winningScore));
    setMenuText('mode-hachepe-record', gameStats.achievements.beat_hachepe
        ? 'Récord: ya lo has vencido'
        : 'Récord: aún sin victorias');
}

/**
 * Actualiza la UI de monedas en todas partes
 */
function updateCoinDisplay() {
    // En la tienda el monedero ya lleva la moneda: solo cambia el número
    setMenuText('shop-coin-display', String(playerProgression.chemiCoins));
    ['menu-coins', 'mode-coins'].forEach(id => {
        const display = document.getElementById(id);
        if (display) {
            display.innerHTML = `<img src="assets/chemi_coin.png" alt="" class="w-4 h-4 inline object-contain mr-1" style="vertical-align: text-top;"> ${playerProgression.chemiCoins}`;
        }
    });
}
