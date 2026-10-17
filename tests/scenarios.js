/**
 * tests/scenarios.js
 * ------------------------------------------------------------------
 * Escenarios de regresión. Cada uno parte de un almacenamiento inicial
 * (storage) y una semilla, y describe lo que hace un jugador:
 *
 *   { type: 'click', text }          clic en el control con ese texto visible (o aria-label)
 *   { type: 'clickSel', sel }        clic en un elemento por selector
 *   { type: 'input'|'change', id, value|checked }  mover un control de ajustes
 *   { type: 'key', code }            pulsar y soltar una tecla
 *   { type: 'steps', n }             dejar pasar n fotogramas
 *   { type: 'play', bot, bot2?, until, max }
 *                                    jugar con bots hasta una condición
 *                                    (gameover, finale, stopped, goal,
 *                                    screen:<id>, event:<evento>; varias
 *                                    separadas por |)
 *
 * Opciones del bot: react (cada cuántos fotogramas decide), noise (error
 * de puntería en px), deadzone, edge (golpear con el borde), mouse/touch
 * para jugar con el ratón o con el dedo en vez del teclado, smash
 * (mantener la tecla de smash al venir la bola, en una fracción
 * smashChance de las devoluciones) y brake (frenar contando la inercia de
 * la paleta; por defecto, sí).
 *
 * `expect` lista eventos que el escenario debe atravesar. Si un cambio
 * hace que ya no pase por ellos, el test lo señala aunque el estado
 * coincida: protege la cobertura de la propia batería. `expectNot`
 * lista eventos por los que no debe pasar (un bug que no debe volver).
 *
 * Todos los escenarios arrancan con las Novedades de esta versión ya
 * vistas (seenNewsVersion), para que no tapen el menú, salvo los que
 * llevan `news: true`.
 * ------------------------------------------------------------------
 */

/** @param {object} values */
const settings = (values) => ({ 'pongGame.settings.v1': JSON.stringify(values) });

/** @param {object} values */
const progression = (values) => ({ 'pongGame.progression.v1': JSON.stringify(values) });

/** Progreso de campaña con la intro ya vista. */
const campaign = (level, extra = {}) => progression({ campaignIntroSeen: true, campaignProgress: level, ...extra });

/** Teclado, golpeando con el borde de la paleta para sacar ángulo. */
const STRONG = { react: 1, noise: 6, deadzone: 4, edge: 38 };

/**
 * Teclado con roces de esquina (bola a 60°): con las mecánicas de la
 * fase 2, dos jugadores que devuelven al centro pelotean casi sin fin.
 */
const EDGY = { react: 1, noise: 6, deadzone: 4, edge: 46 };

/**
 * Ratón (la paleta sigue al cursor sin límite de velocidad) y golpes con
 * borde, sin llegar a la zona de esquina (a 40 px saldrían roces lentos).
 */
const ACE = { mouse: true, react: 1, noise: 4, edge: 30 };
const MOUSE = settings({ mouseControl: true });

/** Teclado con el centro de la paleta (golpes perfectos) y smash en la mitad de las devoluciones. */
const MECHANIC = { react: 1, noise: 5, deadzone: 3, smash: true, smashChance: 0.5 };

/** Entra al jefe que el carrusel muestra centrado (el pendiente). */
const enterCurrentBoss = [
    { type: 'click', text: 'JUGAR' },
    { type: 'click', text: 'CAMPAÑA' },
    { type: 'clickSel', sel: '.boss-card.is-active' }
];

/**
 * @param {number} level
 * @param {number} seed
 * @param {object} [bot] opciones del bot (ver Bot en runner.js)
 */
const bossScenario = (level, seed, bot = ACE) => ({
    name: `jefe-${level}`,
    seed,
    storage: { ...campaign(level), ...(bot.mouse ? MOUSE : {}) },
    actions: [
        ...enterCurrentBoss,
        { type: 'play', bot, until: 'gameover|finale', max: 40000 },
        { type: 'steps', n: 60 }
    ],
    expect: ['start:campaign', 'dialogue', `boss:${level}`, 'end:campaign']
});

const RAW_SCENARIOS = [
    // --------------------------------------------------------------
    //  Modos de juego
    // --------------------------------------------------------------
    {
        name: 'cpu-facil',
        seed: 101,
        storage: settings({ difficulty: 1 }),
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'VS CPU' },
            { type: 'play', bot: { react: 2, noise: 20 }, until: 'gameover', max: 15000 },
            { type: 'click', text: 'MENÚ PRINCIPAL' },
            { type: 'steps', n: 30 }
        ],
        expect: ['start:cpu', 'screen:game-over-screen']
    },
    {
        name: 'cpu-normal-revancha',
        seed: 102,
        storage: settings({ difficulty: 2 }),
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'VS CPU' },
            { type: 'play', bot: EDGY, until: 'gameover', max: 20000 },
            { type: 'click', text: 'JUGAR DE NUEVO' },
            { type: 'play', bot: EDGY, until: 'gameover', max: 20000 }
        ],
        expect: ['start:cpu', 'screen:game-over-screen']
    },
    {
        name: 'cpu-imposible-rapida',
        seed: 103,
        storage: settings({ difficulty: 3, ballSpeed: 3, winningScore: 3 }),
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'VS CPU' },
            { type: 'play', bot: { react: 3, noise: 40 }, until: 'gameover', max: 20000 }
        ],
        expect: ['start:cpu', 'screen:game-over-screen']
    },
    {
        name: 'local-dos-bots',
        seed: 104,
        storage: settings({ winningScore: 3 }),
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'LOCAL (2 JUGADORES)' },
            { type: 'play', bot: { react: 1, noise: 6, edge: 38 }, bot2: { react: 4, noise: 45 }, until: 'gameover', max: 20000 }
        ],
        expect: ['start:local', 'screen:game-over-screen']
    },
    {
        name: 'local-tactil',
        seed: 105,
        storage: settings({ winningScore: 3 }),
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'LOCAL (2 JUGADORES)' },
            { type: 'play', bot: { touch: true, react: 1, noise: 4, edge: 40 }, bot2: { touch: true, react: 14, noise: 70 }, until: 'gameover', max: 15000 }
        ],
        expect: ['start:local', 'screen:game-over-screen']
    },
    {
        name: 'hachepe',
        seed: 106,
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'MODO HACHEPE' },
            // Un jugador flojo: así la CPU llega a los 10 puntos de este modo
            { type: 'play', bot: { react: 20, noise: 120 }, until: 'gameover', max: 30000 }
        ],
        expect: ['start:hachepe', 'screen:game-over-screen']
    },
    {
        name: 'raton',
        seed: 107,
        storage: settings({ mouseControl: true, winningScore: 3 }),
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'VS CPU' },
            { type: 'play', bot: { mouse: true, react: 1, noise: 10 }, until: 'gameover', max: 15000 }
        ],
        expect: ['start:cpu', 'screen:game-over-screen']
    },
    {
        name: 'pausa',
        seed: 108,
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'VS CPU' },
            { type: 'steps', n: 400 },
            { type: 'key', code: 'Escape' },
            { type: 'steps', n: 120 },
            { type: 'click', text: 'CONTINUAR' },
            { type: 'steps', n: 200 },
            { type: 'clickSel', sel: '#mobile-pause-btn' },
            { type: 'click', text: 'RENDIRSE' },
            { type: 'steps', n: 30 }
        ],
        expect: ['start:cpu', 'paused', 'screen:pause-menu']
    },

    // --------------------------------------------------------------
    //  Power-ups: partidas largas que entre todas cubren los 7 tipos
    // --------------------------------------------------------------
    {
        name: 'powerups-a',
        seed: 201,
        storage: settings({ winningScore: 11 }),
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'VS CPU' },
            { type: 'play', bot: { react: 1, noise: 18, edge: 46 }, until: 'gameover', max: 40000 }
        ],
        expect: ['start:cpu', 'end:cpu', 'collect:big_ball', 'collect:slowmo', 'collect:turbo']
    },
    {
        name: 'powerups-b',
        seed: 203,
        storage: settings({ winningScore: 7, ballSpeed: 1 }),
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'VS CPU' },
            { type: 'play', bot: EDGY, until: 'gameover', max: 30000 }
        ],
        expect: ['start:cpu', 'end:cpu', 'collect:multi_ball', 'collect:paddle_mini', 'collect:paddle_xl', 'collect:shield']
    },

    // --------------------------------------------------------------
    //  Mecánicas de golpe (fase 2)
    // --------------------------------------------------------------
    {
        // Un bot que golpea con el centro y mantiene ESPACIO al venir la
        // bola: golpes perfectos, smash, súper y una fiebre del rally
        name: 'mecanicas',
        seed: 501,
        storage: settings({ difficulty: 2, winningScore: 5 }),
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'VS CPU' },
            { type: 'play', bot: MECHANIC, until: 'gameover', max: 30000 },
            { type: 'steps', n: 30 }
        ],
        expect: ['start:cpu', 'mech:perfect', 'mech:smash', 'mech:super', 'mech:spin', 'mech:fever', 'screen:game-over-screen']
    },
    {
        // Sembrado para que salga un escudo pronto: aguanta 5 bloqueos y se rompe
        name: 'escudo',
        seed: 504,
        storage: settings({ winningScore: 11 }),
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'VS CPU' },
            { type: 'play', bot: STRONG, until: 'event:shield:spent|gameover', max: 30000 },
            { type: 'steps', n: 60 }
        ],
        expect: ['start:cpu', 'effect:shield', 'shield:spent']
    },

    {
        // Modo práctica: contra la pared hasta la fiebre, un fallo y salir
        // desde la pausa (vuelve a la selección de modo); después, otra vez
        // desde «Cómo jugar», que es adonde vuelve entonces
        name: 'practica',
        seed: 601,
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'Práctica' },
            { type: 'play', bot: MECHANIC, until: 'event:mech:fever', max: 20000 },
            { type: 'steps', n: 120 },
            { type: 'play', bot: { react: 20, noise: 120 }, until: 'goal', max: 6000 },
            { type: 'steps', n: 240 },
            { type: 'key', code: 'Escape' },
            { type: 'click', text: 'SALIR' },
            { type: 'click', text: 'VOLVER' },
            { type: 'click', text: 'CÓMO JUGAR' },
            { type: 'click', text: 'PRACTICAR' },
            { type: 'play', bot: STRONG, max: 600 },
            { type: 'key', code: 'Escape' },
            { type: 'click', text: 'SALIR' },
            { type: 'steps', n: 30 }
        ],
        expect: ['start:practice', 'mech:perfect', 'mech:smash', 'mech:fever', 'paused', 'end:practice']
    },

    // --------------------------------------------------------------
    //  Campaña
    // --------------------------------------------------------------
    bossScenario(1, 301),
    bossScenario(2, 302),
    bossScenario(3, 303),
    bossScenario(4, 304),
    bossScenario(5, 305),
    bossScenario(6, 306, STRONG),   // la arena rotada, con teclado
    {
        name: 'creador-raton',
        seed: 307,
        storage: { ...campaign(6), ...settings({ mouseControl: true }) },
        actions: [
            ...enterCurrentBoss,
            { type: 'play', bot: { mouse: true, react: 1, noise: 0 }, until: 'gameover|finale', max: 20000 }
        ],
        expect: ['start:campaign', 'boss:6']
    },
    {
        name: 'final-completo',
        seed: 305,
        storage: { ...campaign(5), ...MOUSE },
        actions: [
            ...enterCurrentBoss,
            // Yisus: al vencerle empieza el falso final, no la pantalla de fin
            { type: 'play', bot: ACE, until: 'finale', max: 45000 },
            { type: 'steps', n: 1700 },                 // la secuencia completa hasta el VS
            { type: 'play', bot: ACE, until: 'finale', max: 45000 },   // El Creador
            { type: 'steps', n: 480 },                  // el final verdadero muestra FIN a los 7 s
            { type: 'click', text: 'FIN' },
            { type: 'steps', n: 30 }
        ],
        expect: ['boss:5', 'boss:6', 'screen:finale-screen', 'screen:vs-screen', 'creator:phase3', 'boss:defeated']
    },
    {
        name: 'repetir-y-siguiente',
        seed: 309,
        storage: { ...campaign(6), ...MOUSE },
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'CAMPAÑA' },
            // El carrusel arranca en el Creador; se vuelve hasta Dani
            { type: 'key', code: 'ArrowLeft' },
            { type: 'key', code: 'ArrowLeft' },
            { type: 'key', code: 'ArrowLeft' },
            { type: 'key', code: 'ArrowLeft' },
            { type: 'key', code: 'Enter' },
            { type: 'play', bot: ACE, until: 'gameover', max: 40000 },
            { type: 'click', text: 'SIGUIENTE HACHEPE' },
            { type: 'steps', n: 400 }
        ],
        expect: ['boss:2', 'start:campaign', 'screen:vs-screen']
    },
    {
        name: 'intro-y-carrusel',
        seed: 310,
        storage: progression({ campaignIntroSeen: false, campaignProgress: 3 }),
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'CAMPAÑA' },
            { type: 'steps', n: 100 },
            { type: 'clickSel', sel: '#campaign-intro-overlay' },
            { type: 'click', text: 'ACEPTAR MI DESTINO' },
            { type: 'key', code: 'ArrowRight' },
            { type: 'key', code: 'ArrowLeft' },
            { type: 'clickSel', sel: '#carousel-prev' },
            { type: 'clickSel', sel: '#carousel-next' },
            { type: 'clickSel', sel: '.carousel-dot:nth-child(4)' },
            { type: 'clickSel', sel: '.carousel-dot:nth-child(2)' },
            { type: 'click', text: 'VER HISTORIA' },
            { type: 'steps', n: 900 },
            { type: 'click', text: 'ACEPTAR MI DESTINO' },
            { type: 'key', code: 'Enter' },
            { type: 'steps', n: 500 },
            { type: 'key', code: 'Escape' },
            { type: 'click', text: 'RENDIRSE' },
            { type: 'steps', n: 30 }
        ],
        expect: ['start:campaign', 'dialogue', 'screen:vs-screen']
    },

    // --------------------------------------------------------------
    //  Interfaz
    // --------------------------------------------------------------
    {
        name: 'interfaz',
        seed: 401,
        storage: progression({ chemiCoins: 500, campaignIntroSeen: true }),
        actions: [
            // Tienda: comprar y equipar en varias pestañas
            { type: 'click', text: 'TIENDA' },
            { type: 'click', text: 'FONDOS' },
            { type: 'clickSel', sel: '#shop-grid .shop-card:nth-child(2) .shop-card__btn' },
            { type: 'clickSel', sel: '#shop-grid .shop-card:nth-child(2) .shop-card__btn' },
            { type: 'click', text: 'PALETAS' },
            { type: 'clickSel', sel: '#shop-grid .shop-card:nth-child(3) .shop-card__btn' },
            { type: 'click', text: 'ESTELAS' },
            { type: 'clickSel', sel: '#shop-grid .shop-card:nth-child(5) .shop-card__btn' },
            { type: 'click', text: 'GOLES' },
            { type: 'clickSel', sel: '#shop-grid .shop-card:nth-child(4) .shop-card__btn' },
            { type: 'click', text: 'VOLVER' },
            // Ajustes
            { type: 'click', text: 'CONFIGURACIÓN' },
            { type: 'input', id: 'volume-slider', value: 30 },
            { type: 'input', id: 'music-volume-slider', value: 70 },
            { type: 'change', id: 'difficulty-slider', value: 3 },
            { type: 'change', id: 'music-toggle', checked: false },
            { type: 'change', id: 'music-toggle', checked: true },
            { type: 'change', id: 'sfx-toggle', checked: false },
            { type: 'change', id: 'crt-toggle', checked: false },
            { type: 'change', id: 'shake-toggle', checked: false },
            { type: 'change', id: 'mouse-toggle', checked: true },
            { type: 'change', id: 'mouse-toggle', checked: false },
            { type: 'change', id: 'powerups-toggle', checked: false },
            { type: 'click', text: '7' },
            { type: 'click', text: 'RÁPIDA' },
            { type: 'click', text: 'Morado' },
            { type: 'click', text: 'RESTABLECER TODO' },
            { type: 'click', text: 'Azul' },
            { type: 'click', text: '3' },
            { type: 'click', text: 'VOLVER' },
            // Controles: reasignar teclas
            { type: 'click', text: 'CONTROLES' },
            { type: 'click', text: 'W' },
            { type: 'key', code: 'KeyI' },
            { type: 'click', text: 'S' },
            { type: 'key', code: 'KeyK' },
            { type: 'click', text: 'RESTAURAR TECLAS POR DEFECTO' },
            { type: 'click', text: 'ESC' },
            { type: 'key', code: 'KeyP' },
            { type: 'click', text: 'VOLVER' },
            // Estadísticas y logros
            { type: 'click', text: 'ESTADÍSTICAS' },
            { type: 'click', text: 'BORRAR ESTADÍSTICAS' },
            { type: 'click', text: 'VOLVER' },
            { type: 'click', text: 'LOGROS' },
            { type: 'click', text: 'VOLVER' },
            { type: 'clickSel', sel: '#main-progression' },
            { type: 'click', text: 'VOLVER' },
            // Una partida con los cosméticos y ajustes nuevos
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'VS CPU' },
            { type: 'play', bot: { react: 1, noise: 10 }, until: 'gameover', max: 25000 },
            { type: 'click', text: 'MENÚ PRINCIPAL' },
            { type: 'click', text: 'LOGROS' },
            { type: 'steps', n: 300 }
        ],
        expect: ['start:cpu', 'screen:game-over-screen']
    },
    {
        name: 'salir',
        seed: 402,
        actions: [
            { type: 'click', text: 'SALIR' },
            { type: 'click', text: 'NO, SEGUIR JUGANDO' },
            { type: 'click', text: 'SALIR' },
            { type: 'click', text: 'SÍ, SALIR' },
            { type: 'steps', n: 10 }
        ]
    },
    {
        // Salir de la partida durante la cámara lenta del Flash Épico: la
        // siguiente partida debe empezar sin ella ni restos del efecto
        name: 'salir-tras-gol',
        seed: 403,
        storage: progression({ selectedGoalFx: 'epic_flash', purchasedItems: ['default', 'none', 'classic', 'epic_flash'] }),
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'VS CPU' },
            { type: 'play', bot: { react: 2, noise: 20 }, until: 'goal', max: 15000 },
            { type: 'steps', n: 5 },
            { type: 'key', code: 'Escape' },
            { type: 'steps', n: 1 },
            { type: 'click', text: 'RENDIRSE' },
            { type: 'steps', n: 1 },
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'VS CPU' },
            { type: 'steps', n: 120 }
        ],
        expect: ['start:cpu', 'goal:slowmo', 'paused'],
        expectNot: ['slowmo-al-empezar']
    },
    {
        // Primera carga de la versión: las Novedades se abren solas encima
        // del menú; CÓMO JUGAR y VOLVER regresan a ellas, ¡A JUGAR! las
        // cierra y el botón del documento las reabre (sin el punto).
        // Después, los ajustes de la sección Partida de la fase 3
        name: 'novedades',
        seed: 404,
        news: true,
        actions: [
            { type: 'steps', n: 30 },
            { type: 'clickSel', sel: '#news-screen [data-action="newsToHowto"]' },
            { type: 'steps', n: 10 },
            { type: 'click', text: 'VOLVER' },
            { type: 'click', text: '¡A JUGAR!' },
            { type: 'clickSel', sel: '#news-btn' },
            { type: 'click', text: 'Cerrar' },
            { type: 'clickSel', sel: '#news-btn' },
            { type: 'key', code: 'Escape' },
            { type: 'steps', n: 30 },
            { type: 'click', text: 'CONFIGURACIÓN' },
            { type: 'click', text: 'Segundo dedo' },
            { type: 'click', text: 'Automático (solo súper)' },
            { type: 'click', text: 'Botón' },
            { type: 'change', id: 'haptics-toggle', checked: false },
            { type: 'change', id: 'haptics-toggle', checked: true },
            { type: 'change', id: 'hints-toggle', checked: false },
            { type: 'click', text: 'VOLVER' },
            { type: 'steps', n: 10 }
        ],
        expect: ['screen:news-screen', 'screen:howto-menu']
    }
];

/** Novedades ya vistas, mezclado en la clave de ajustes de cada escenario. */
const NEWS_SEEN = { seenNewsVersion: '2.0' };

/** @param {Record<string, string>} [storage] */
function withNewsSeen(storage = {}) {
    const saved = storage['pongGame.settings.v1'] ? JSON.parse(storage['pongGame.settings.v1']) : {};
    return { ...storage, ...settings({ ...saved, ...NEWS_SEEN }) };
}

export const SCENARIOS = RAW_SCENARIOS.map((s) => (s.news ? s : { ...s, storage: withNewsSeen(s.storage) }));
