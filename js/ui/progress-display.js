/**
 * ui/progress-display.js
 * ------------------------------------------------------------------
 * Marcadores de progreso: nivel y barra de XP del menú principal,
 * monedas (menú y tienda) y el resumen de recompensas al terminar una
 * partida.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Actualiza la UI de progresión (barra XP, nivel, y el panel de fin de partida)
 */
function updateProgressionDisplay() {
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
            document.getElementById('game-over-coins').innerHTML = `+${sessionCoinsGained} <img src="assets/chemi_coin.png" alt="" class="w-4 h-4 inline object-contain" style="vertical-align: text-top;">`;

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

/**
 * Actualiza la UI de monedas en todas partes
 */
function updateCoinDisplay() {
    const displays = ['shop-coin-display', 'menu-coins'];
    displays.forEach(id => {
        const display = document.getElementById(id);
        if (display) {
            const size = id === 'shop-coin-display' ? 'w-6 h-6' : 'w-4 h-4';
            display.innerHTML = `<img src="assets/chemi_coin.png" alt="" class="${size} inline object-contain mr-1" style="vertical-align: text-top;"> ${playerProgression.chemiCoins}`;
        }
    });
}
