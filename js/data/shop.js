/**
 * data/shop.js
 * ------------------------------------------------------------------
 * Catálogo de la tienda. Cada `id` debe tener su renderizador en la
 * tabla de vfx/ correspondiente y su icono en assets/shop/
 * (<prefijo><id>.svg). Los iconos que usan el color del tema van además
 * en línea en SHOP_ICONS: dentro de un <img> no heredan --primary.
 * Lo comprado y lo equipado se guardan por clave de categoría
 * (playerProgression.owned / equipped).
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Artículo de la tienda (un cosmético).
 * @typedef {object} ShopItem
 * @property {string} id       clave en la tabla de vfx/ y nombre del icono
 * @property {string} name
 * @property {string} desc
 * @property {number} price    en Chemi Coins; 0 = gratuito (siempre en propiedad); fija la rareza
 */

/** @type {Record<string, ShopItem[]>} */
const SHOP_CATALOG = {
    trails: [
        { id: 'default',  name: 'Clásica',   desc: 'Círculos blancos que se encogen',               price: 0 },
        { id: 'neon',     name: 'Neón',       desc: 'Línea brillante con resplandor intenso',         price: 30 },
        { id: 'fire',     name: 'Fuego',      desc: 'Llama que parpadea, con brasas',                 price: 60 },
        { id: 'ice',      name: 'Hielo',      desc: 'Destellos celestes cristalinos',                 price: 60 },
        { id: 'rainbow',  name: 'Arcoíris',   desc: 'Seis bandas paralelas a la trayectoria',         price: 100 }
    ],
    backgrounds: [
        { id: 'none',    name: 'Clásico',       desc: 'Fondo negro puro',                            price: 0 },
        { id: 'stars',   name: 'Estrellas',      desc: 'Tres capas en paralaje y destellos',          price: 40 },
        { id: 'rain',    name: 'Lluvia Digital', desc: 'Caracteres cayendo estilo Matrix',            price: 80 },
        { id: 'aurora',  name: 'Aurora Boreal',  desc: 'Cielo nocturno con cortinas de luz',          price: 120 }
    ],
    paddles: [
        { id: 'classic',      name: 'Clásica',      desc: 'Rectángulo redondeado sólido',             price: 0 },
        { id: 'pixel',        name: 'Pixel',         desc: 'Bloques de 5 px con luces y sombras de 8 bits', price: 25 },
        { id: 'gradient',     name: 'Gradiente',     desc: 'Del blanco al color del jugador',          price: 50 },
        { id: 'neon_paddle',  name: 'Neón',          desc: 'Paleta con resplandor pulsante',           price: 70 },
        { id: 'slim',         name: 'Delgada Pro',   desc: 'Visualmente delgada, mismo golpe',         price: 45 }
    ],
    goalEffects: [
        { id: 'classic',     name: 'Clásico',        desc: 'Anillo del tema y cuadrados disparados',   price: 0 },
        { id: 'epic_flash',  name: 'Flash Épico',    desc: 'Destello blanco + cámara lenta',           price: 50 },
        { id: 'confetti',    name: 'Confeti',         desc: 'Explosión de partículas multicolor',      price: 65 },
        { id: 'shockwave',   name: 'Onda Expansiva',  desc: 'Tres anillos con retraso y un destello',   price: 80 }
    ]
};

/** Pestañas de la tienda: `key` en SHOP_CATALOG y su nombre. */
const SHOP_CATEGORIES = [
    { key: 'trails',      label: 'Estelas' },
    { key: 'backgrounds', label: 'Fondos' },
    { key: 'paddles',     label: 'Paletas' },
    { key: 'goalEffects', label: 'Efectos Gol' }
];

/**
 * Prefijo del nombre de icono de cada pestaña: assets/shop/<prefijo><id>.svg
 * @type {Record<string, string>}
 */
const SHOP_ICON_PREFIX = { trails: 'trail_', backgrounds: 'bg_', paddles: 'paddle_', goalEffects: 'goal_' };

/**
 * Iconos que toman el color del tema (var(--primary)), en línea. Son los
 * mismos SVG de assets/shop/ sin metadatos; {uid} se sustituye en cada
 * uso para que los id de los degradados no se repitan en la página.
 * @type {Record<string, string>}
 */
const SHOP_ICONS = {
    bg_none: '<svg viewBox="0 0 96 96"><rect x="8" y="16" width="80" height="64" rx="6" fill="#000"/><path d="M48 20V76" stroke="#fff" stroke-opacity=".25" stroke-width="1.5" stroke-dasharray="4 4"/><rect x="14" y="36" width="3.5" height="16" rx="1.5" style="fill: var(--primary, #22C55E)"/><rect x="78.5" y="46" width="3.5" height="16" rx="1.5" style="fill: var(--primary, #22C55E)"/><rect x="56" y="40" width="4" height="4" fill="#fff"/><rect x="8" y="16" width="80" height="64" rx="6" fill="none" stroke="#fff" stroke-opacity=".2"/></svg>',
    bg_stars: '<svg viewBox="0 0 96 96"><rect x="8" y="16" width="80" height="64" rx="6" fill="#060A1E"/><g fill="#fff"><circle cx="20" cy="24" r=".9" opacity=".8"/><circle cx="34" cy="28" r=".6" opacity=".5"/><circle cx="60" cy="22" r="1.1"/><circle cx="73" cy="33" r=".7" opacity=".6"/><circle cx="25" cy="50" r=".7" opacity=".5"/><circle cx="66" cy="60" r="1" opacity=".9"/><circle cx="40" cy="68" r=".6" opacity=".5"/><circle cx="80" cy="71" r=".8" opacity=".7"/><circle cx="16" cy="66" r=".8" opacity=".6"/><circle cx="55" cy="73" r=".5" opacity=".4"/><circle cx="83" cy="25" r=".6" opacity=".5"/><circle cx="43" cy="39" r=".5" opacity=".5"/></g><path d="M32 32Q32 38 38 38Q32 38 32 44Q32 38 26 38Q32 38 32 32Z" fill="#fff"/><path d="M70 46Q70 50 74 50Q70 50 70 54Q70 50 66 50Q70 50 70 46Z" fill="#FDE68A"/><path d="M48 20V76" stroke="#fff" stroke-opacity=".22" stroke-width="1.5" stroke-dasharray="4 4"/><rect x="14" y="36" width="3.5" height="16" rx="1.5" style="fill: var(--primary, #22C55E)"/><rect x="78.5" y="46" width="3.5" height="16" rx="1.5" style="fill: var(--primary, #22C55E)"/><rect x="8" y="16" width="80" height="64" rx="6" fill="none" stroke="#fff" stroke-opacity=".2"/></svg>',
    goal_classic: '<svg viewBox="0 0 96 96"><circle cx="48" cy="48" r="15" fill="none" style="stroke: var(--primary, #22C55E)" stroke-width="2" opacity=".5"/><circle cx="48" cy="48" r="8" fill="#fff"/><g style="fill: var(--primary, #22C55E)"><rect x="45.5" y="15.5" width="5" height="5"/><rect x="75" y="45" width="6" height="6"/><rect x="45.5" y="75.5" width="5" height="5"/><rect x="15" y="45" width="6" height="6"/></g><g fill="#fff"><rect x="68" y="24" width="4" height="4"/><rect x="68" y="68" width="4" height="4"/><rect x="24" y="68" width="4" height="4"/><rect x="24" y="24" width="4" height="4"/><rect x="58.5" y="12.5" width="3" height="3" opacity=".6"/><rect x="80.5" y="60.5" width="3" height="3" opacity=".6"/><rect x="32.5" y="82.5" width="3" height="3" opacity=".6"/><rect x="10.5" y="32.5" width="3" height="3" opacity=".6"/></g></svg>',
    goal_shockwave: '<svg viewBox="0 0 96 96"><defs><radialGradient id="{uid}-g-sw"><stop offset=".2" style="stop-color: var(--primary, #22C55E)" stop-opacity=".35"/><stop offset="1" style="stop-color: var(--primary, #22C55E)" stop-opacity="0"/></radialGradient></defs><circle cx="48" cy="48" r="42" fill="url(#{uid}-g-sw)"/><circle cx="48" cy="48" r="40" fill="none" style="stroke: var(--primary, #22C55E)" stroke-width="1.5" opacity=".25"/><circle cx="48" cy="48" r="30" fill="none" style="stroke: var(--primary, #22C55E)" stroke-width="2.5" opacity=".55"/><circle cx="48" cy="48" r="20" fill="none" stroke="#fff" stroke-width="3" opacity=".9"/><circle cx="48" cy="48" r="8" fill="#fff"/></svg>',
    paddle_classic: '<svg viewBox="0 0 96 96"><rect x="41" y="14" width="14" height="68" rx="5" style="fill: var(--primary, #22C55E)"/><rect x="43.5" y="19" width="3" height="58" rx="1.5" fill="#fff" opacity=".28"/><circle cx="73" cy="36" r="5" fill="#fff"/></svg>',
    paddle_gradient: '<svg viewBox="0 0 96 96"><defs><linearGradient id="{uid}-g-pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" style="stop-color: var(--primary, #22C55E)"/><stop offset="1" style="stop-color: var(--primary, #22C55E)" stop-opacity=".55"/></linearGradient></defs><rect x="41" y="14" width="14" height="68" rx="5" fill="url(#{uid}-g-pg)"/><circle cx="73" cy="36" r="5" fill="#fff"/></svg>',
    paddle_neon_paddle: '<svg viewBox="0 0 96 96"><rect x="34" y="7" width="28" height="82" rx="13" style="fill: var(--primary, #22C55E)" opacity=".08"/><rect x="38" y="11" width="20" height="74" rx="9" style="fill: var(--primary, #22C55E)" opacity=".18"/><rect x="41" y="14" width="14" height="68" rx="6" fill="none" style="stroke: var(--primary, #22C55E)" stroke-width="3"/><rect x="45.5" y="20" width="5" height="56" rx="2.5" fill="#fff"/><circle cx="74" cy="36" r="9" style="fill: var(--primary, #22C55E)" opacity=".2"/><circle cx="74" cy="36" r="4.5" fill="#fff"/></svg>',
    paddle_pixel: '<svg viewBox="0 0 96 96"><path d="M44 14h8v4h4v60h-4v4h-8v-4h-4V18h4z" style="fill: var(--primary, #22C55E)"/><rect x="44" y="22" width="4" height="4" fill="#fff" opacity=".55"/><rect x="44" y="30" width="4" height="4" fill="#fff" opacity=".3"/><rect x="44" y="38" width="4" height="4" fill="#fff" opacity=".15"/><rect x="48" y="70" width="4" height="4" fill="#000" opacity=".35"/><rect x="48" y="62" width="4" height="4" fill="#000" opacity=".2"/><rect x="68" y="32" width="8" height="8" fill="#fff"/><rect x="62" y="40" width="4" height="4" fill="#fff" opacity=".35"/></svg>',
    paddle_slim: '<svg viewBox="0 0 96 96"><rect x="41" y="14" width="14" height="68" rx="5" fill="none" stroke="#fff" stroke-opacity=".35" stroke-dasharray="3 3"/><rect x="46" y="14" width="4" height="68" rx="2" style="fill: var(--primary, #22C55E)"/><path d="M32 44l4 4-4 4M64 44l-4 4 4 4" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="76" cy="28" r="4.5" fill="#fff"/></svg>'
};

/**
 * Rareza según el precio (no se guarda en el catálogo): se ve en el
 * borde del icono y en la etiqueta de cada artículo.
 * @param {number} price
 * @returns {{key: 'ini'|'rar'|'epi'|'leg', label: string}}
 */
function shopRarity(price) {
    if (price === 0) return { key: 'ini', label: 'Inicial' };
    if (price <= 50) return { key: 'rar', label: 'Raro' };
    if (price < 100) return { key: 'epi', label: 'Épico' };
    return { key: 'leg', label: 'Legendario' };
}
