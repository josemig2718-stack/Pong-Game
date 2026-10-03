/**
 * tests/lib/dom.js
 * ------------------------------------------------------------------
 * Serialización normalizada del DOM visible del juego.
 *
 * Captura lo que el jugador percibe (qué pantalla está activa, sus
 * textos, valores, clases e imágenes) e ignora a propósito los detalles
 * que el refactor puede cambiar sin alterar nada visible:
 *   - la etiqueta exacta de los contenedores (div/section/main... → "block");
 *   - los manejadores en línea (on*) y los atributos de acciones (data-*);
 *   - type, role y aria-*, que no afectan a lo que se ve en pantalla;
 *   - el orden de las declaraciones dentro de un style="".
 * ------------------------------------------------------------------
 */

const BLOCK_TAGS = new Set(['DIV', 'SECTION', 'MAIN', 'NAV', 'HEADER', 'FOOTER', 'ARTICLE', 'ASIDE']);

/**
 * Clases de Tailwind que no existen y no aplican ningún estilo. Se
 * eliminan en el refactor (fase 13); el test de estilos computados
 * demuestra que quitarlas no cambia el aspecto.
 */
const IGNORED_CLASSES = new Set(['border-primary', 'text-primary']);

/** Su style lo calcula resizeCanvas según el tamaño de la ventana. */
const LAYOUT_STYLED_IDS = new Set(['pongCanvas', 'canvas-wrapper']);

/** Overlays fijos que se comparan aunque no sean una pantalla. */
const OVERLAY_IDS = ['achievement-toast', 'fade-overlay', 'crt-collapse'];

/**
 * @param {Element} el
 * @returns {string}
 */
export function classesOf(el) {
    return [...el.classList].filter((c) => !IGNORED_CLASSES.has(c)).sort().join(' ');
}

/**
 * @param {string} style
 * @returns {string}
 */
function normalizeStyle(style) {
    return style.split(';').map((d) => d.replace(/\s+/g, ' ').trim()).filter(Boolean).sort().join('; ');
}

/**
 * @param {Element} el
 * @returns {object}
 */
function serialize(el) {
    const tag = el.tagName.toUpperCase();
    /** @type {Record<string, unknown>} */
    const node = { t: BLOCK_TAGS.has(tag) ? 'block' : el.tagName.toLowerCase() };
    if (el.id) node.id = el.id;
    const cls = classesOf(el);
    if (cls) node.c = cls;

    let text = '';
    for (const n of el.childNodes) if (n.nodeType === 3) text += n.nodeValue;
    text = text.replace(/\s+/g, ' ').trim();
    if (text) node.x = text;

    const anyEl = /** @type {any} */ (el);
    if (anyEl.disabled) node.disabled = true;
    if (tag === 'INPUT') node.v = anyEl.type === 'checkbox' ? anyEl.checked : anyEl.value;
    if (tag === 'IMG') node.src = el.getAttribute('src');

    const style = el.getAttribute('style');
    if (style && !LAYOUT_STYLED_IDS.has(el.id)) {
        const s = normalizeStyle(style);
        if (s) node.s = s;
    }

    const kids = [...el.children].filter((k) => k.tagName !== 'SCRIPT').map(serialize);
    if (kids.length) node.k = kids;
    return node;
}

/**
 * Instantánea del DOM visible.
 * @param {Document} doc
 */
export function snapshotDom(doc) {
    const screens = [...doc.querySelectorAll('.screen.active-screen')];
    /** @type {Record<string, object>} */
    const trees = {};
    for (const s of screens) trees[s.id] = serialize(s);

    const container = doc.getElementById('game-container');
    if (container && !container.classList.contains('hidden')) trees['game-container'] = serialize(container);
    for (const id of OVERLAY_IDS) {
        const el = doc.getElementById(id);
        if (el) trees[id] = serialize(el);
    }
    // forceClose() sustituye todo el body: se compara tal cual.
    if (!screens.length && !container) trees.body = serialize(doc.body);

    return {
        screens: screens.map((s) => s.id),
        body: classesOf(doc.body),
        gameMode: doc.body.dataset.gameMode ?? null,
        primary: doc.documentElement.style.getPropertyValue('--primary'),
        trees
    };
}
