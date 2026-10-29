/**
 * data/news.js
 * ------------------------------------------------------------------
 * Contenido de la pantalla de Novedades (ui/news.js). Se abre sola al
 * cargar mientras settings.seenNewsVersion no sea NEWS_VERSION.
 *
 * Cada novedad: color (del icono y su recuadro), icono (el interior de
 * un SVG de trazo de 24×24), título y texto.
 * ------------------------------------------------------------------
 */

'use strict';

const NEWS_VERSION = '2.0';
const NEWS_ITEMS = [
    { color: '#FDE047', icon: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', title: 'Mecánicas nuevas', text: 'Efecto, golpe perfecto, bloqueo y smash.' },
    { color: '#F97316', icon: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8 0 4 3 7 7 7z"/>', title: 'Fiebre del rally', text: 'Desde 25 golpes seguidos, cada punto vale el doble de XP.' },
    { color: '#2DD4BF', icon: '<path d="M2.5 12a3.5 6 0 1 0 7 0a3.5 6 0 1 0-7 0M14.5 12a3.5 6 0 1 0 7 0a3.5 6 0 1 0-7 0M6 12h12"/>', title: '4 power-ups nuevos', text: 'Congelar, Rayo, Muro y Portales. Y duran más.' },
    { color: '#C084FC', icon: '<rect x="9" y="3" width="6" height="18" rx="2"/>', title: '34 cosméticos', text: 'Estelas, paletas, fondos, goles y dos categorías nuevas: Bolas y estilos de Smash.' },
    { color: '#60A5FA', icon: '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z"/>', title: '50 niveles y misiones', text: '10 rangos, recompensas en cada nivel, misiones diarias y semanales.' },
    { color: '#F472B6', icon: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', title: 'Música y sonido', text: 'Pistas nuevas, Rockola en la tienda y efectos de sonido rehechos.' }
];
const NEWS_RESET_NOTE = 'Empiezas de cero. Con el sistema de progreso nuevo se reinician el nivel, las monedas, las compras y los logros. Tu configuración se mantiene.';
