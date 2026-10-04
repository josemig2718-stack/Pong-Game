/**
 * tests/lib/scripts.js
 * ------------------------------------------------------------------
 * Comprueba la lista de <script> del juego en index.html.
 *
 * El juego son scripts clásicos (para que funcione abriendo index.html
 * directamente, sin servidor). Un archivo de js/ que falte en la lista
 * no se carga nunca; uno con otra versión (?v=N) puede quedarse viejo en
 * la caché de GitHub Pages mientras los demás son nuevos.
 *
 * Reglas:
 *   - cada archivo de js/ aparece exactamente una vez y no sobra ninguno
 *     (la lista de archivos existentes la da el servidor de tests);
 *   - ninguno es un módulo (type="module" no funciona desde file://);
 *   - todos llevan el mismo ?v=N, y style.css también;
 *   - main.js va el último: es el que arranca el juego.
 * El orden entre capas lo vigilan los escenarios: un script cargado
 * antes de lo que necesita rompe la carga y fallan todos.
 * ------------------------------------------------------------------
 */

/**
 * @param {string} root URL de la carpeta que contiene index.html
 * @returns {Promise<{errors: string[], version: string|null, scripts: number}>}
 */
export async function checkScripts(root) {
    /** @type {string[]} */
    const errors = [];
    const html = await (await fetch(root + 'index.html', { cache: 'no-store' })).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const versions = new Set();
    /** @type {string[]} */
    const listed = [];
    for (const el of doc.querySelectorAll('script[src]')) {
        const src = el.getAttribute('src') || '';
        if (!/^js\//.test(src)) continue;   // Tailwind (CDN)
        if (el.getAttribute('type') === 'module') errors.push(`${src} es un módulo: no carga desde file://`);
        const m = /^(js\/[\w/.-]+\.js)\?v=(\d+)$/.exec(src);
        if (!m) { errors.push(`${src} no tiene la forma js/….js?v=N`); continue; }
        listed.push(m[1]);
        versions.add(m[2]);
    }
    const css = doc.querySelector('link[rel="stylesheet"][href*="style.css"]');
    const cssVersion = css && /\?v=(\d+)$/.exec(css.getAttribute('href') || '');
    if (!cssVersion) errors.push('style.css no lleva ?v=N');
    else versions.add(cssVersion[1]);
    if (versions.size > 1) errors.push(`Versiones distintas: ${[...versions].join(', ')} (debe haber un solo N)`);

    if (listed[listed.length - 1] !== 'js/main.js') errors.push('js/main.js debe ser el último script');
    const seen = new Set();
    for (const f of listed) {
        if (seen.has(f)) errors.push(`${f} está dos veces`);
        seen.add(f);
    }

    const res = await fetch(root + 'tests/js-files', { cache: 'no-store' });
    if (!res.ok) {
        errors.push('El servidor no da la lista de archivos de js/ (usa python tests/serve.py)');
    } else {
        /** @type {string[]} */
        const existing = await res.json();
        for (const f of existing) if (!seen.has(f)) errors.push(`${f} existe pero index.html no lo carga`);
        for (const f of seen) if (!existing.includes(f)) errors.push(`index.html carga ${f}, que no existe`);
    }
    return { errors, version: versions.size === 1 ? [...versions][0] : null, scripts: listed.length };
}
