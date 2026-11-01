/**
 * data/themes.js
 * ------------------------------------------------------------------
 * Catálogo de temas de color. Lo aplica systems/theme.js.
 * ------------------------------------------------------------------
 */

'use strict';

// --- Catálogo de temas de color -----------------------------------
// Cada tema define el color "primario" (paletas, HUD, marcador). Se
// aplica como variables CSS (--primary / --primary-rgb) y también se usa
// directamente al dibujar en el <canvas>, a través de currentThemeHex().
const THEMES = {
    green:  { label: 'Verde',    hex: '#22c55e', rgb: '34, 197, 94' },
    purple: { label: 'Morado',   hex: '#a855f7', rgb: '168, 85, 247' },
    blue:   { label: 'Azul',     hex: '#3b82f6', rgb: '59, 130, 246' },
    red:    { label: 'Rojo',     hex: '#ef4444', rgb: '239, 68, 68' },
    orange: { label: 'Naranja',  hex: '#f97316', rgb: '249, 115, 22' },
    cyan:   { label: 'Cian',     hex: '#06b6d4', rgb: '6, 182, 212' },
    yellow: { label: 'Amarillo', hex: '#eab308', rgb: '234, 179, 8' },
    pink:   { label: 'Rosa',     hex: '#ec4899', rgb: '236, 72, 153' }
};
