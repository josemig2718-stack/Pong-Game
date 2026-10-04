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
 *                                    (gameover, finale, stopped, screen:<id>;
 *                                    varias separadas por |)
 *
 * Opciones del bot: react (cada cuántos fotogramas decide), noise (error
 * de puntería en px), deadzone, y mouse/touch para jugar con el ratón o
 * con el dedo en vez del teclado.
 *
 * `expect` lista eventos que el escenario debe atravesar. Si un cambio
 * hace que ya no pase por ellos, el test lo señala aunque el estado
 * coincida: protege la cobertura de la propia batería.
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

/** Ratón (la paleta sigue al cursor sin límite de velocidad) y golpes con borde. */
const ACE = { mouse: true, react: 1, noise: 4, edge: 40 };
const MOUSE = settings({ mouseControl: true });

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
        { type: 'play', bot, until: 'gameover|finale', max: 20000 },
        { type: 'steps', n: 60 }
    ],
    expect: ['start:campaign', 'dialogue', `boss:${level}`]
});

export const SCENARIOS = [
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
            { type: 'play', bot: STRONG, until: 'gameover', max: 15000 },
            { type: 'click', text: 'JUGAR DE NUEVO' },
            { type: 'play', bot: STRONG, until: 'gameover', max: 15000 }
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
            { type: 'play', bot: { react: 3, noise: 40 }, until: 'gameover', max: 15000 }
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
            { type: 'play', bot: { react: 1, noise: 6, edge: 38 }, bot2: { react: 4, noise: 45 }, until: 'gameover', max: 15000 }
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
            { type: 'play', bot: { react: 1, noise: 18 }, until: 'gameover', max: 40000 }
        ],
        expect: ['start:cpu']
    },
    {
        name: 'powerups-b',
        seed: 202,
        storage: settings({ winningScore: 7, ballSpeed: 1 }),
        actions: [
            { type: 'click', text: 'JUGAR' },
            { type: 'click', text: 'VS CPU' },
            { type: 'play', bot: STRONG, until: 'gameover', max: 25000 }
        ],
        expect: ['start:cpu']
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
            { type: 'play', bot: ACE, until: 'finale', max: 30000 },
            { type: 'steps', n: 1700 },                 // la secuencia completa hasta el VS
            { type: 'play', bot: ACE, until: 'finale', max: 30000 },   // El Creador
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
            { type: 'play', bot: ACE, until: 'gameover', max: 20000 },
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
            { type: 'click', text: '📖 Ver Historia' },
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
            { type: 'play', bot: { react: 1, noise: 10 }, until: 'gameover', max: 15000 },
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
    }
];
