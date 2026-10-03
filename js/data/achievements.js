/**
 * data/achievements.js
 * ------------------------------------------------------------------
 * Catálogo de logros. Los que llevan `secret: true` se muestran como
 * "????" hasta desbloquearse y no cuentan en el total visible.
 *
 * Al añadir un logro, su `id` es el que se pasa a unlockAchievement().
 * ------------------------------------------------------------------
 */

export const ACHIEVEMENTS = [
    // 🏁 Inicio
    { id: 'first_win',      emoji: '🏓', name: 'Primer Victoria',  desc: 'Gana tu primera partida vs CPU' },
    { id: 'first_local',    emoji: '🤝', name: 'En Compañía',      desc: 'Juega tu primera partida local' },

    // 🔥 Rachas
    { id: 'streak_3',       emoji: '🔥', name: 'En Racha',         desc: 'Gana 3 partidas seguidas vs CPU' },
    { id: 'streak_5',       emoji: '💥', name: 'Imparable',        desc: 'Gana 5 partidas seguidas vs CPU' },
    { id: 'streak_10',      emoji: '⚡', name: 'Leyenda',          desc: 'Gana 10 partidas seguidas vs CPU' },

    // ⭐ Habilidad
    { id: 'perfect_game',   emoji: '⭐', name: 'Juego Perfecto',   desc: 'Gana sin que el rival anote un punto' },
    { id: 'perfect_3',      emoji: '💎', name: 'Diamante',         desc: 'Consigue 3 juegos perfectos' },
    { id: 'beat_impossible', emoji: '🧠', name: 'Gran Maestro',    desc: 'Vence a la CPU en dificultad Imposible' },
    { id: 'rally_15',       emoji: '🏸', name: 'Peloteo',          desc: 'Consigue un rally de 15 golpes' },
    { id: 'rally_30',       emoji: '🌪️', name: 'Tornado',         desc: 'Consigue un rally de 30 golpes' },

    // 📊 Veteranía
    { id: 'games_10',       emoji: '🎮', name: 'Aficionado',       desc: 'Juega 10 partidas' },
    { id: 'games_50',       emoji: '🕹️', name: 'Veterano',        desc: 'Juega 50 partidas' },
    { id: 'games_100',      emoji: '👾', name: 'Adicto al Pong',   desc: 'Juega 100 partidas' },
    { id: 'points_100',     emoji: '💯', name: 'Centenar',         desc: 'Anota 100 puntos en total' },
    { id: 'points_500',     emoji: '🎯', name: 'Francotirador',    desc: 'Anota 500 puntos en total' },
    { id: 'time_1h',        emoji: '⏰', name: 'Pongmaníaco',      desc: 'Juega 1 hora en total' },

    // 🎲 Especiales
    { id: 'win_all_diff',   emoji: '🏆', name: 'Todoterreno',      desc: 'Gana al menos una vez en cada dificultad' },
    { id: 'comeback',       emoji: '🔄', name: 'Remontada',        desc: 'Gana tras ir perdiendo por 3+ puntos' },
    { id: 'speed_demon',    emoji: '🚀', name: 'Demonio Veloz',    desc: 'Alcanza la velocidad máxima de la bola' },
    { id: 'explorer',       emoji: '🎨', name: 'Explorador',       desc: 'Prueba todos los temas de color' },
    { id: 'beat_hachepe',   emoji: '👑', name: 'El Hachepe Definitivo', desc: 'Vence a la CPU en el Modo Hachepe' },

    // 🎁 Expansión (Power-ups & Tienda)
    { id: 'powerup_collector', emoji: '🧲', name: 'Coleccionista',     desc: 'Recoge 50 power-ups en total' },
    { id: 'no_powerups_win',   emoji: '🚫', name: 'Sin Ayuda',         desc: 'Gana una partida sin recoger power-ups' },
    { id: 'reach_level_5',     emoji: '🎖️', name: 'Rango Experto',     desc: 'Alcanza el nivel 5' },
    { id: 'reach_level_10',    emoji: '👑', name: 'Leyenda Definitiva',desc: 'Alcanza el nivel 10' },
    { id: 'fashionista',       emoji: '💎', name: 'Fashionista',       desc: 'Compra todos los items de la tienda' },
    { id: 'grow_partner',      emoji: '🛒', name: 'Grow Partner',      desc: 'Compra tu primer objeto en la tienda' },

    // 🗡️ Campaña
    { id: 'campaign_first',    emoji: '🗡️', name: 'La Primera Grieta', desc: 'Vence a tu primer Hachepe' },
    { id: 'campaign_clear',    emoji: '🏙️', name: 'La Venganza',       desc: 'Derrota a los cinco Hachepes' },

    // 👁️ Secreto: se muestra como "????" hasta que se desbloquea
    { id: 'the_creator',       emoji: '👁️', name: 'The Creator',       desc: 'Vence al Creador', secret: true }
];
