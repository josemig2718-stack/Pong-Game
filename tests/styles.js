/**
 * tests/styles.js
 * ------------------------------------------------------------------
 * Test de estilos computados: protege los cambios de HTML y CSS que no
 * deben cambiar nada visible (etiquetas semánticas, atributos de
 * accesibilidad, reglas o clases sin efecto).
 *
 * Para cada estado de la interfaz (cada pantalla, el juego, la pausa,
 * el diálogo, el aviso de logro…) y cada tamaño de ventana, guarda un
 * hash de TODAS las propiedades de getComputedStyle de cada elemento
 * (y de sus ::before/::after con contenido). La clave de cada elemento
 * es su posición en el árbol, no su etiqueta: cambiar un <div> por un
 * <section> no la altera, pero sí lo haría cualquier estilo distinto.
 *
 * Las transiciones se desactivan y las animaciones duran 0 s, para que
 * el resultado no dependa del instante de la captura; esas propiedades
 * se excluyen de la comparación.
 *
 * Las referencias (golden/styles.json) se graban en el navegador de
 * referencia y solo valen en él, como los hashes del canvas.
 * ------------------------------------------------------------------
 */
import { loadGame } from './runner.js';
import { canonical, fnv } from './lib/canonical.js';

/** @type {Array<[number, number]>} */
export const STYLE_VIEWPORTS = [[1280, 800], [800, 600], [390, 844], [844, 390]];

/** Propiedades que el propio test fija y que por tanto no se comparan. */
const SKIPPED = /^(transition|animation-duration|animation-delay)/;

const FREEZE_CSS = `*, *::before, *::after {
    transition: none !important;
    animation-duration: 0s !important;
    animation-delay: 0s !important;
}`;

/** Progreso con algo comprado, logros y la campaña a medias: más elementos visibles. */
const STORAGE = {
    'pongGame.progression.v1': JSON.stringify({
        totalXP: 300, level: 3, chemiCoins: 85,
        selectedTrail: 'neon', selectedBg: 'none', selectedPaddle: 'classic', selectedGoalFx: 'classic',
        purchasedItems: ['default', 'none', 'classic', 'neon'],
        campaignProgress: 3, campaignIntroSeen: true
    }),
    'pongGame.stats.v1': JSON.stringify({
        totalGamesPlayed: 12, cpuWins: 7, cpuLosses: 5, longestRally: 18, maxBallSpeed: 12.5,
        achievements: { first_win: '2026-01-10T12:00:00.000Z', games_10: '2026-01-12T12:00:00.000Z' }
    })
};

const MODULES = {
    screens: './js/ui/screens.js',
    stats: './js/ui/stats-panel.js',
    match: './js/game/match.js',
    progress: './js/campaign/progress.js',
    menu: './js/campaign/menu.js',
    finale: './js/campaign/finale.js',
    dialogue: './js/campaign/dialogue.js',
    achievements: './js/systems/achievements.js',
    state: './js/core/state.js'
};

/**
 * Estados a capturar. `run(m)` recibe los módulos del juego ya importados
 * y se ejecuta como código del juego (generador aleatorio del juego).
 * @type {Array<{name: string, storage?: object, run: (m: any) => void}>}
 */
export const STYLE_STATES = [
    { name: 'menu-principal', run: () => {} },
    { name: 'modo', run: (m) => m.screens.showScreen('mode-select-menu') },
    { name: 'campana', run: (m) => m.screens.showScreen('campaign-menu') },
    { name: 'campana-intro', run: (m) => { m.screens.showScreen('campaign-menu'); m.menu.replayCampaignIntro(); } },
    { name: 'vs', run: (m) => m.progress.prepareCampaignMatch(3) },
    { name: 'controles', run: (m) => m.screens.showScreen('controls-menu') },
    { name: 'estadisticas', run: (m) => m.stats.showStatsScreen() },
    { name: 'logros', run: (m) => m.stats.showAchievementsScreen() },
    { name: 'configuracion', run: (m) => m.screens.showScreen('settings-menu') },
    { name: 'tienda', run: (m) => m.screens.showScreen('shop-menu') },
    { name: 'salir', run: (m) => m.screens.showScreen('exit-menu') },
    { name: 'partida', run: (m) => m.match.startGame('cpu') },
    { name: 'pausa', run: (m) => { m.match.startGame('cpu'); m.match.togglePause(); } },
    {
        name: 'fin-de-partida',
        run: (m) => { m.match.startGame('cpu'); m.state.state.p1Score = 5; m.match.checkWin(); }
    },
    {
        name: 'dialogo',
        run: (m) => {
            m.progress.prepareCampaignMatch(2);
            m.match.startGame('campaign');
            m.dialogue.queueDialogue([{ t: 'Línea de prueba', s: 'a' }]);
        }
    },
    { name: 'aviso-logro', run: (m) => m.achievements.unlockAchievement('streak_3') },
    { name: 'final-falso', run: (m) => { m.finale.runFinaleSequence(); m.dialogue.stopDialogue(); } }
];

/**
 * @param {Element} el
 * @param {Element} root
 */
function pathOf(el, root) {
    const parts = [];
    for (let n = el; n && n !== root; n = n.parentElement) {
        const parent = n.parentElement;
        parts.push(parent ? [...parent.children].indexOf(n) : 0);
    }
    return parts.reverse().join('.');
}

/**
 * @param {CSSStyleDeclaration} cs
 */
function hashStyle(cs) {
    const out = [];
    for (let i = 0; i < cs.length; i++) {
        const prop = cs[i];
        if (SKIPPED.test(prop)) continue;
        out.push(prop, cs.getPropertyValue(prop));
    }
    return fnv(canonical(out));
}

/**
 * Hash de estilos de cada elemento del documento.
 * @param {any} win
 * @param {Document} doc
 */
function snapshot(win, doc) {
    /** @type {Record<string, string>} */
    const out = {};
    const root = doc.documentElement;
    for (const el of [root, ...root.querySelectorAll('*')]) {
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.closest('head')) continue;
        const key = pathOf(el, root) || 'html';
        out[key] = hashStyle(win.getComputedStyle(el));
        for (const pseudo of ['::before', '::after']) {
            const ps = win.getComputedStyle(el, pseudo);
            if (ps.content && ps.content !== 'none' && ps.content !== 'normal') out[key + pseudo] = hashStyle(ps);
        }
    }
    return out;
}

const realWait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Importa los módulos del juego DENTRO del iframe, con un <script
 * type="module"> propio: así se resuelven con el mapa de imports del
 * juego y son las mismas instancias que usa la partida.
 * @param {any} win
 * @param {Document} doc
 * @returns {Promise<Record<string, any>>}
 */
async function importGameModules(win, doc) {
    const names = Object.keys(MODULES);
    const script = doc.createElement('script');
    script.type = 'module';
    script.textContent = names.map((n, i) => `import * as m${i} from ${JSON.stringify(MODULES[n])};`).join('\n')
        + `\nwindow.__styleModules = { ${names.map((n, i) => `${n}: m${i}`).join(', ')} };`;
    doc.body.appendChild(script);
    for (let i = 0; i < 200 && !win.__styleModules; i++) await realWait(10);
    if (!win.__styleModules) throw new Error('No se pudieron importar los módulos del juego');
    return win.__styleModules;
}

/**
 * Captura un estado en un tamaño de ventana.
 * @param {HTMLElement} host
 * @param {{name: string, run: (m: any) => void}} st
 * @param {[number, number]} vp
 */
async function captureOne(host, st, vp) {
    const game = await loadGame(host, { seed: 7, storage: STORAGE, width: vp[0], height: vp[1] });
    try {
        const { win, doc } = game;
        const freeze = doc.createElement('style');
        freeze.textContent = FREEZE_CSS;
        doc.head.appendChild(freeze);

        const m = await importGameModules(win, doc);
        win.__harness.inGame(() => st.run(m));

        // Tailwind (CDN) genera las clases nuevas al observar el DOM: se le
        // da tiempo y se exige que dos capturas seguidas coincidan.
        await realWait(120);
        const a = snapshot(win, doc);
        await realWait(120);
        const b = snapshot(win, doc);
        if (canonical(a) !== canonical(b)) throw new Error(`estilos inestables en ${st.name} @ ${vp.join('x')}`);
        return { styles: a, errors: [...win.__harness.errors] };
    } finally {
        game.iframe.remove();
    }
}

/**
 * Captura todos los estados en todos los tamaños.
 * @param {HTMLElement} host
 * @param {(msg: string) => void} [progress]
 */
export async function captureStyles(host, progress = () => {}) {
    /** @type {Record<string, Record<string, Record<string, string>>>} */
    const result = {};
    const errors = [];
    for (const vp of STYLE_VIEWPORTS) {
        const vpKey = vp.join('x');
        result[vpKey] = {};
        for (const st of STYLE_STATES) {
            progress(`${st.name} @ ${vpKey}`);
            const { styles, errors: errs } = await captureOne(host, st, vp);
            result[vpKey][st.name] = styles;
            errs.forEach((e) => errors.push(`${st.name} @ ${vpKey}: ${e}`));
        }
    }
    return { format: 1, ua: navigator.userAgent, dpr: window.devicePixelRatio, styles: result, errors };
}

/**
 * @param {any} golden
 * @param {any} got
 * @returns {{errors: string[], warnings: string[]}}
 */
export function compareStyles(golden, got) {
    const errors = [];
    const warnings = [];
    if (!golden) return { errors: ['No hay referencia (golden/styles.json)'], warnings };
    if (golden.ua !== got.ua || golden.dpr !== got.dpr) {
        warnings.push('Navegador distinto del de la referencia: los estilos no son comparables');
        return { errors, warnings };
    }
    got.errors.forEach((e) => errors.push('Error del juego: ' + e));
    for (const vp of Object.keys(golden.styles)) {
        for (const st of Object.keys(golden.styles[vp])) {
            const g = golden.styles[vp][st];
            const c = (got.styles[vp] || {})[st] || {};
            const diffs = [];
            for (const key of new Set([...Object.keys(g), ...Object.keys(c)])) {
                if (g[key] !== c[key]) diffs.push(key + (g[key] ? (c[key] ? '' : ' (desaparece)') : ' (nuevo)'));
            }
            if (diffs.length) errors.push(`${st} @ ${vp}: ${diffs.length} elementos con estilo distinto: ${diffs.slice(0, 8).join(', ')}`);
        }
    }
    return { errors, warnings };
}

/**
 * Estilos de un elemento en un estado, para depurar una diferencia.
 * @param {HTMLElement} host
 * @param {string} stateName
 * @param {string} vpKey  p. ej. "390x844"
 * @param {string} key    clave del elemento (índices separados por puntos)
 */
export async function inspectStyle(host, stateName, vpKey, key) {
    const st = STYLE_STATES.find((s) => s.name === stateName);
    const vp = /** @type {[number, number]} */ (vpKey.split('x').map(Number));
    const game = await loadGame(host, { seed: 7, storage: STORAGE, width: vp[0], height: vp[1] });
    try {
        const { win, doc } = game;
        const freeze = doc.createElement('style');
        freeze.textContent = FREEZE_CSS;
        doc.head.appendChild(freeze);
        const m = await importGameModules(win, doc);
        win.__harness.inGame(() => st.run(m));
        await realWait(120);
        /** @type {Element} */
        let el = doc.documentElement;
        for (const i of key.replace(/::.*$/, '').split('.').filter(Boolean)) el = el.children[Number(i)];
        const cs = win.getComputedStyle(el, key.includes('::') ? key.slice(key.indexOf('::')) : null);
        const out = { tag: el.tagName, id: el.id, class: el.className };
        for (let i = 0; i < cs.length; i++) if (!SKIPPED.test(cs[i])) out[cs[i]] = cs.getPropertyValue(cs[i]);
        return out;
    } finally {
        game.iframe.remove();
    }
}
