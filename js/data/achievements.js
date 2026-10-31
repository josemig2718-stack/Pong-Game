/**
 * data/achievements.js
 * ------------------------------------------------------------------
 * Catálogo de logros. Los que llevan `secret: true` se muestran como
 * "????" hasta desbloquearse y no cuentan en el total visible.
 *
 * Al añadir un logro, su `id` es el que se pasa a unlockAchievement().
 * Cada logro tiene una categoría (su color en la medalla) y un glifo:
 * el atributo `d` de un único <path> de trazo en un viewBox de 24×24.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * @typedef {'inicio'|'rachas'|'habilidad'|'veterania'|'especiales'|'mecanicas'|'progreso'|'tienda'|'campana'|'secreto'} AchievementCategory
 */

/**
 * @typedef {object} Achievement
 * @property {string} id
 * @property {AchievementCategory} category
 * @property {string} name
 * @property {string} desc
 * @property {string} icon       glifo: `d` de un <path> en 24×24
 * @property {boolean} [secret]  se muestra como "????" hasta desbloquearse
 * @property {string} [color]    en lugar del de la categoría (el aviso de misión)
 * @property {boolean} [mission] es el aviso de una misión completada, no un logro
 * @property {{cat: string, item: ShopItem}} [shopItem] es el aviso de un objeto exclusivo conseguido
 */

/**
 * Nombre y color de cada categoría, en el orden en que se muestran.
 * El secreto se dibuja dentro de Campaña y su categoría nunca se lista.
 * @type {Record<AchievementCategory, {name: string, color: string}>}
 */
const ACHIEVEMENT_CATEGORIES = {
    inicio:     { name: 'Inicio',             color: '#4ADE80' },
    rachas:     { name: 'Rachas',             color: '#FB923C' },
    habilidad:  { name: 'Habilidad',          color: '#38BDF8' },
    veterania:  { name: 'Veteranía',          color: '#C084FC' },
    especiales: { name: 'Especiales',         color: '#FACC15' },
    mecanicas:  { name: 'Mecánicas',          color: '#2DD4BF' },
    progreso:   { name: 'Progreso',           color: '#818CF8' },
    tienda:     { name: 'Power-ups y tienda', color: '#F472B6' },
    campana:    { name: 'Campaña',            color: '#EF4444' },
    secreto:    { name: 'Secreto',            color: '#34D399' }
};

/** Glifo "?" de un logro secreto aún bloqueado. */
const ACHIEVEMENT_SECRET_ICON = 'M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .8-1 1.5V14M12 17h.01';

/** Candado de las tarjetas bloqueadas. */
const ACHIEVEMENT_LOCK_ICON = 'M7 11h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM9 11V8a3 3 0 0 1 6 0v3';

/** @type {Achievement[]} */
const ACHIEVEMENTS = [
    // Inicio
    { id: 'first_win', category: 'inicio', name: 'Primer Victoria', desc: 'Gana tu primera partida vs CPU',
      icon: 'M5.5 5h1A1.5 1.5 0 0 1 8 6.5v11A1.5 1.5 0 0 1 6.5 19h-1A1.5 1.5 0 0 1 4 17.5v-11A1.5 1.5 0 0 1 5.5 5zM13 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M20.5 6.5l1-1M20.5 17.5l1 1' },
    { id: 'first_local', category: 'inicio', name: 'En Compañía', desc: 'Juega tu primera partida local',
      icon: 'M4.2 6h.6A1.2 1.2 0 0 1 6 7.2v9.6A1.2 1.2 0 0 1 4.8 18h-.6A1.2 1.2 0 0 1 3 16.8V7.2A1.2 1.2 0 0 1 4.2 6zM19.2 6h.6A1.2 1.2 0 0 1 21 7.2v9.6a1.2 1.2 0 0 1-1.2 1.2h-.6a1.2 1.2 0 0 1-1.2-1.2V7.2A1.2 1.2 0 0 1 19.2 6zM10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 4v2M12 18v2' },

    // Rachas
    { id: 'streak_3', category: 'rachas', name: 'En Racha', desc: 'Gana 3 partidas seguidas vs CPU',
      icon: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z' },
    { id: 'streak_5', category: 'rachas', name: 'Imparable', desc: 'Gana 5 partidas seguidas vs CPU',
      icon: 'M12 2l2 5 5-2-2 5 5 2-5 2 2 5-5-2-2 5-2-5-5 2 2-5-5-2 5-2-2-5 5 2z' },
    { id: 'streak_10', category: 'rachas', name: 'Intocable', desc: 'Gana 10 partidas seguidas vs CPU',
      icon: 'M13 2L5 13h6l-1 9 8-12h-6zM3.5 5.5L5 7M20.5 5.5L19 7' },

    // Habilidad
    { id: 'perfect_game', category: 'habilidad', name: 'Juego Perfecto', desc: 'Gana sin que el rival anote un punto',
      icon: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z' },
    { id: 'perfect_3', category: 'habilidad', name: 'Diamante', desc: 'Consigue 3 juegos perfectos',
      icon: 'M6 3h12l4 6-10 12L2 9zM2 9h20M12 21L8 9l2-6M12 21l4-12-2-6' },
    { id: 'beat_impossible', category: 'habilidad', name: 'Imposible No Existe', desc: 'Vence a la CPU en dificultad Imposible',
      icon: 'M8 10h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM3 14h3M3 17h3M18 14h3M18 17h3M7 7l2.5 1.5L12 4l2.5 4.5L17 7' },
    { id: 'rally_15', category: 'habilidad', name: 'Peloteo', desc: 'Consigue un rally de 15 golpes',
      icon: 'M3 18l5-10 5 10 4-8M18.5 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0' },
    { id: 'rally_30', category: 'habilidad', name: 'Tornado', desc: 'Consigue un rally de 30 golpes',
      icon: 'M3 4h18M5 8h14M7 12h10M9 16h6M11 20h2' },

    // Veteranía
    { id: 'games_10', category: 'veterania', name: 'Aficionado', desc: 'Juega 10 partidas',
      icon: 'M7 7h10a5 5 0 0 1 0 10H7a5 5 0 0 1 0-10zM7 10.5v3M5.5 12h3M16 11h.01M18 13h.01' },
    { id: 'games_50', category: 'veterania', name: 'Veterano', desc: 'Juega 50 partidas',
      icon: 'M5 20h14l-1.5-5h-11zM12 15V9M9.5 6.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0' },
    { id: 'games_100', category: 'veterania', name: 'Adicto al Pong', desc: 'Juega 100 partidas',
      icon: 'M7 5l2 2h6l2-2M5 9h14v6H5zM7 15l-2 4M17 15l2 4M9 11h.01M15 11h.01M9.5 15v2M14.5 15v2' },
    { id: 'points_100', category: 'veterania', name: 'Centenar', desc: 'Anota 100 puntos en total',
      icon: 'M4 9l2-1.5V17M10 7.5h2.5a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1zM17 7.5h2.5a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H17a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1zM3 20.5h18' },
    { id: 'points_500', category: 'veterania', name: 'Francotirador', desc: 'Anota 500 puntos en total',
      icon: 'M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 2v4M12 18v4M2 12h4M18 12h4' },
    { id: 'time_1h', category: 'veterania', name: 'Pongmaníaco', desc: 'Juega 1 hora en total',
      icon: 'M4 13a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 9v4l3 2M9 2h6M12 2v3M19 5l1.5 1.5' },

    // Especiales
    { id: 'win_all_diff', category: 'especiales', name: 'Todoterreno', desc: 'Gana al menos una vez en cada dificultad',
      icon: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4v4h-4z' },
    { id: 'comeback', category: 'especiales', name: 'Remontada', desc: 'Gana tras ir perdiendo por 3+ puntos',
      icon: 'M3 8l5 8 5-4 7-7M15 5h5v5' },
    { id: 'speed_demon', category: 'especiales', name: 'Demonio Veloz', desc: 'Alcanza la velocidad máxima de la bola',
      icon: 'M12 2c4 3 5 7 4 12H8C7 9 8 5 12 2zM10.2 9a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0M8 14l-3 3v3l3-2M16 14l3 3v3l-3-2M10 18l2 4 2-4' },
    { id: 'explorer', category: 'especiales', name: 'Explorador', desc: 'Prueba todos los temas de color',
      icon: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 2 0 3 0a4 4 0 0 0 4-4 9 9 0 0 0-9-9zM7.5 11h.01M10 7h.01M15 7h.01M17.5 11h.01' },
    { id: 'beat_hachepe', category: 'especiales', name: 'El Hachepe Definitivo', desc: 'Vence a la CPU en el Modo Hachepe',
      icon: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5zM8 15h8' },

    // Mecánicas
    { id: 'spin_first', category: 'mecanicas', name: 'Con Efecto', desc: 'Da efecto a la bola por primera vez',
      icon: 'M4 18c4-10 12-12 16-12M16 3l4 3-4 3' },
    { id: 'perfect_10', category: 'mecanicas', name: 'Precisión', desc: 'Haz 10 golpes perfectos en una partida',
      icon: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 12h.01' },
    { id: 'perfect_100', category: 'mecanicas', name: 'Cirujano', desc: 'Haz 100 golpes perfectos en total',
      icon: 'M12 2v6M12 16v6M2 12h6M16 12h6M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0' },
    { id: 'smash_first', category: 'mecanicas', name: '¡Smash!', desc: 'Marca tu primer gol de smash',
      icon: 'M14 2L7 13h5l-1 9 7-11h-5zM2 8h3M2 12h2M2 16h3' },
    { id: 'smash_goals_10', category: 'mecanicas', name: 'Cañonero', desc: 'Marca 10 goles de smash',
      icon: 'M3 16l11-7 3 4-11 7zM14 9l3-2M5 21a2 2 0 1 0 0-4a2 2 0 1 0 0 4' },
    { id: 'smash_double', category: 'mecanicas', name: 'Doble Impacto', desc: 'Marca 2 goles de smash en una misma partida',
      icon: 'M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z' },
    { id: 'smash_uses_25', category: 'mecanicas', name: 'Artillero', desc: 'Usa el smash 25 veces',
      icon: 'M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8 0 4 3 7 7 7z' },
    { id: 'fever_first', category: 'mecanicas', name: 'En Llamas', desc: 'Entra en fiebre del rally',
      icon: 'M8 22c-3-2-4-5-3-8 1 1 2 1 3 0-1-4 1-8 5-10 0 3 2 5 4 7 2 2 3 5 2 8-1 2-3 3-5 3' },
    { id: 'rally_50', category: 'mecanicas', name: 'Interminable', desc: 'Consigue un rally de 50 golpes',
      icon: 'M7 9a3 3 0 1 0 0 6c2 0 3-1.5 5-3s3-3 5-3a3 3 0 1 1 0 6c-2 0-3-1.5-5-3S9 9 7 9z' },

    // Progreso
    { id: 'reach_level_5', category: 'progreso', name: 'Rango Experto', desc: 'Alcanza el nivel 21 (rango Experto)',
      icon: 'M6 10l6-4 6 4M6 15l6-4 6 4M6 20l6-4 6 4' },
    { id: 'level_25', category: 'progreso', name: 'A Medio Camino', desc: 'Alcanza el nivel 25',
      icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM12 3v18' },
    { id: 'reach_level_10', category: 'progreso', name: 'Leyenda Definitiva', desc: 'Alcanza el nivel 50',
      icon: 'M12 5l1.6 3.2 3.4.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4L7 8.7l3.4-.5zM5 8c-2 4-1 9 4 12M19 8c2 4 1 9-4 12' },
    { id: 'prestige_1', category: 'progreso', name: 'Prestigio', desc: 'Consigue tu primera estrella de prestigio',
      icon: 'M12 6l1.8 3.7 4 .6-2.9 2.8.7 4L12 15.2 8.4 17.1l.7-4-2.9-2.8 4-.6zM3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0' },
    { id: 'missions_10', category: 'progreso', name: 'Cumplidor', desc: 'Completa 10 misiones',
      icon: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2' },
    { id: 'missions_50', category: 'progreso', name: 'Incansable', desc: 'Completa 50 misiones',
      icon: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4M9 15l2 2 4-4' },
    { id: 'weekly_first', category: 'progreso', name: 'Semana Redonda', desc: 'Completa una misión semanal',
      icon: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M8 12l3 3 5-6' },

    // Power-ups y tienda
    { id: 'powerup_collector', category: 'tienda', name: 'Coleccionista', desc: 'Recoge 50 power-ups en total',
      icon: 'M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3zM6 7h4M14 7h4' },
    { id: 'no_powerups_win', category: 'tienda', name: 'Sin Ayuda', desc: 'Gana una partida sin recoger power-ups',
      icon: 'M13 3L7 12h5l-1 8 6-9h-5zM4 4l16 16' },
    { id: 'fashionista', category: 'tienda', name: 'Fashionista', desc: 'Compra todos los items de la tienda',
      icon: 'M10 5a2 2 0 1 1 3 1.7c-.6.4-1 .9-1 1.6V9l-8.6 5.4A1.5 1.5 0 0 0 4.2 17h15.6a1.5 1.5 0 0 0 .8-2.6L12 9' },
    { id: 'grow_partner', category: 'tienda', name: 'Grow Partner', desc: 'Compra tu primer objeto en la tienda',
      icon: 'M3 4h2l2.5 11h10l2-8H6.5M7.5 19a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M15.5 19a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0' },
    // Para las fases 5, 6 y 7: se desbloquean cuando exista lo que miden
    { id: 'exclusive_first', category: 'tienda', name: 'Exclusivo', desc: 'Consigue un objeto exclusivo',
      icon: 'M6 3h12l4 6-10 12L2 9zM2 9h20M9 3l3 6 3-6M12 9v12' },
    { id: 'buy_legendary', category: 'tienda', name: 'Leyenda de Tienda', desc: 'Compra un objeto legendario',
      icon: 'M3 18h18M4 16l-1-9 5 4 4-7 4 7 5-4-1 9z' },
    { id: 'rockola_dj', category: 'tienda', name: 'DJ', desc: 'Cambia la música en la Rockola',
      icon: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0' },
    { id: 'portal_goal', category: 'tienda', name: 'Atajo', desc: 'Marca un gol justo después de cruzar un portal',
      icon: 'M2.5 12a3.5 6 0 1 0 7 0a3.5 6 0 1 0-7 0M14.5 12a3.5 6 0 1 0 7 0a3.5 6 0 1 0-7 0M6 12h12' },

    // Campaña
    { id: 'campaign_first', category: 'campana', name: 'La Primera Grieta', desc: 'Vence a tu primer Hachepe',
      icon: 'M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2' },
    { id: 'campaign_clear', category: 'campana', name: 'La Venganza', desc: 'Derrota a los cinco Hachepes',
      icon: 'M3 21V11h4v10M7 21V7h5v14M12 21v-8h4v8M16 21V9h5v12M3 21h18M9.5 7V3l3 1.2-3 1.2' },
    { id: 'boss_flawless', category: 'campana', name: 'Sin un rasguño', desc: 'Vence a un jefe sin perder ninguna vida',
      icon: 'M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6zM9 12l2 2 4-4' },
    { id: 'boss_ko_smash', category: 'campana', name: 'Remate perfecto', desc: 'Remata a un jefe con un smash',
      icon: 'M13 2L4 14h7l-1 8 9-12h-7z' },

    // Secreto: se muestra como "????" hasta que se desbloquea
    { id: 'the_creator', category: 'secreto', name: 'The Creator', desc: 'Vence al Creador', secret: true,
      icon: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0' }
];
