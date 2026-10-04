/**
 * systems/theme.js
 * ------------------------------------------------------------------
 * Aplica el tema de color elegido a la interfaz (variables CSS) y lo
 * expone al canvas a través de currentThemeHex().
 * ------------------------------------------------------------------
 */

import { saveSettings, settings } from '../core/settings.js';
import { THEMES } from '../data/themes.js';
import { statsTrackTheme } from './stats.js';

/**
 * Aplica un tema de color (variables CSS --primary), lo guarda y lo
 * cuenta para el logro "Explorador".
 * @param {string} themeKey clave de THEMES
 */
export function applyTheme(themeKey) {
    const theme = THEMES[themeKey] || THEMES.green;
    const root = document.documentElement;

    root.style.setProperty('--primary', theme.hex);
    root.style.setProperty('--primary-rgb', theme.rgb);

    // Marca visualmente el swatch seleccionado en el menú de configuración
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.theme-swatch')).forEach(btn => {
        btn.classList.toggle('theme-swatch--active', btn.dataset.theme === themeKey);
    });

    settings.theme = themeKey;
    saveSettings();

    // Estadísticas: rastrear tema usado (logro Explorador)
    statsTrackTheme(themeKey);
}

/**
 * @returns {string} color principal del tema activo, para dibujar en el canvas
 */
export function currentThemeHex() {
    return (THEMES[settings.theme] || THEMES.green).hex;
}

/**
 * Crea un botón por tema en la pantalla de configuración.
 * @param {HTMLElement} container
 */
export function buildThemeSwatches(container) {
    container.innerHTML = '';
    Object.entries(THEMES).forEach(([key, theme]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'theme-swatch';
        btn.dataset.theme = key;
        btn.title = theme.label;
        btn.style.setProperty('--swatch-color', theme.hex);
        btn.innerHTML = `<span class="theme-swatch__dot"></span><span class="theme-swatch__label">${theme.label}</span>`;
        btn.addEventListener('click', () => applyTheme(key));
        container.appendChild(btn);
    });
}
