/**
 * data/shop.js
 * ------------------------------------------------------------------
 * Catálogo de la tienda. Cada `id` debe tener su renderizador en la
 * tabla de vfx/ correspondiente y su imagen en assets/shop/
 * (<prefijo><id>.png). SHOP_CATEGORIES enlaza cada pestaña con el
 * campo de playerProgression donde se guarda lo equipado.
 * ------------------------------------------------------------------
 */

export const SHOP_CATALOG = {
    trails: [
        { id: 'default',  name: 'Clásica',   desc: 'Círculos que se desvanecen',                    price: 0,   preview: '○○○' },
        { id: 'neon',     name: 'Neón',       desc: 'Línea brillante con resplandor intenso',         price: 30,  preview: '═══' },
        { id: 'fire',     name: 'Fuego',      desc: 'Partículas de llamas ardientes',                 price: 60,  preview: '🔥' },
        { id: 'ice',      name: 'Hielo',      desc: 'Destellos celestes cristalinos',                 price: 60,  preview: '❄️' },
        { id: 'rainbow',  name: 'Arcoíris',   desc: 'Espectro de colores rotativo',                   price: 100, preview: '🌈' }
    ],
    backgrounds: [
        { id: 'none',    name: 'Clásico',       desc: 'Fondo negro puro',                            price: 0,   preview: '⬛' },
        { id: 'stars',   name: 'Estrellas',      desc: 'Campo estelar con parpadeo suave',            price: 40,  preview: '✨' },
        { id: 'rain',    name: 'Lluvia Digital', desc: 'Caracteres cayendo estilo Matrix',            price: 80,  preview: '💻' },
        { id: 'aurora',  name: 'Aurora Boreal',  desc: 'Ondas translúcidas de color',                 price: 120, preview: '🌌' }
    ],
    paddles: [
        { id: 'classic',      name: 'Clásica',      desc: 'Rectángulo redondeado sólido',             price: 0,   preview: '▐' },
        { id: 'pixel',        name: 'Pixel',         desc: 'Bordes rectos, estilo 8-bit puro',         price: 25,  preview: '█' },
        { id: 'gradient',     name: 'Gradiente',     desc: 'Degradado del tema al blanco',             price: 50,  preview: '▓' },
        { id: 'neon_paddle',  name: 'Neón',          desc: 'Paleta con resplandor pulsante',           price: 70,  preview: '║' },
        { id: 'slim',         name: 'Delgada Pro',   desc: 'Visualmente delgada, mismo golpe',         price: 45,  preview: '│' }
    ],
    goalEffects: [
        { id: 'classic',     name: 'Clásico',        desc: 'Partículas y vibración',                  price: 0,   preview: '💥' },
        { id: 'epic_flash',  name: 'Flash Épico',    desc: 'Destello blanco + cámara lenta',           price: 50,  preview: '⚡' },
        { id: 'confetti',    name: 'Confeti',         desc: 'Explosión de partículas multicolor',      price: 65,  preview: '🎉' },
        { id: 'shockwave',   name: 'Onda Expansiva',  desc: 'Anillo circular que se expande',           price: 80,  preview: '🔘' }
    ]
};

export const SHOP_CATEGORIES = [
    { key: 'trails',      label: 'Estelas',       cosmKey: 'trail' },
    { key: 'backgrounds', label: 'Fondos',         cosmKey: 'bg' },
    { key: 'paddles',     label: 'Paletas',        cosmKey: 'paddle' },
    { key: 'goalEffects', label: 'Efectos Gol',    cosmKey: 'goalFx' }
];
