/**
 * tests/lib/importmap.js
 * ------------------------------------------------------------------
 * Comprueba que el mapa de imports de index.html está completo y es
 * coherente. Los import del juego no llevan versión; la versión (?v=N)
 * la añade el mapa. Si un módulo no estuviera en el mapa, el navegador
 * lo cargaría sin versión y GitHub Pages podría servir una copia vieja
 * mezclada con módulos nuevos, un fallo que no se ve en local.
 *
 * Reglas:
 *   - un único mapa y un único <script type="module"> (main.js), cuyo
 *     src es exactamente el valor de main.js en el mapa;
 *   - cada entrada apunta a su propia ruta con ?v=N, y N es el mismo en
 *     todas las entradas y en el enlace a style.css;
 *   - todo import alcanzable desde main.js es relativo, no lleva ?v,
 *     está en el mapa y el archivo existe;
 *   - no sobra ninguna entrada.
 * ------------------------------------------------------------------
 */

/** import estáticos (incluidos los de varias líneas) y export … from. */
const STATIC_IMPORT = /^(?:import|export)\s[^;]*?\bfrom\s+['"]([^'"]+)['"]|^import\s+['"]([^'"]+)['"]/gm;
const DYNAMIC_IMPORT = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * @param {string} root URL de la carpeta que contiene index.html
 * @returns {Promise<{errors: string[], version: string|null, modules: number}>}
 */
export async function checkImportMap(root) {
    /** @type {string[]} */
    const errors = [];
    const html = await (await fetch(root + 'index.html', { cache: 'no-store' })).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const maps = doc.querySelectorAll('script[type="importmap"]');
    if (maps.length !== 1) {
        return { errors: [`Se esperaba 1 mapa de imports y hay ${maps.length}`], version: null, modules: 0 };
    }
    /** @type {Record<string, string>} */
    const imports = JSON.parse(maps[0].textContent || '{}').imports || {};

    /** URL sin versión → URL con versión */
    const map = new Map();
    const versions = new Set();
    for (const [key, value] of Object.entries(imports)) {
        const k = new URL(key, root);
        const v = new URL(value, root);
        const m = /^\?v=(\d+)$/.exec(v.search);
        if (!m) errors.push(`"${key}" no lleva ?v=N: ${value}`);
        else versions.add(m[1]);
        if (k.search) errors.push(`La clave "${key}" no debe llevar versión`);
        if (k.pathname !== v.pathname) errors.push(`"${key}" apunta a otro archivo: ${value}`);
        map.set(k.href, v.href);
    }

    const css = doc.querySelector('link[rel="stylesheet"][href*="style.css"]');
    const cssVersion = css && /\?v=(\d+)$/.exec(css.getAttribute('href') || '');
    if (!cssVersion) errors.push('style.css no lleva ?v=N');
    else versions.add(cssVersion[1]);
    if (versions.size > 1) errors.push(`Versiones distintas: ${[...versions].join(', ')} (debe haber un solo N)`);

    const entries = doc.querySelectorAll('script[type="module"]');
    if (entries.length !== 1) errors.push(`Se esperaba 1 <script type="module"> y hay ${entries.length}`);
    const src = entries[0] ? new URL(entries[0].getAttribute('src') || '', root).href : '';
    const entryKey = [...map].find(([, v]) => v === src)?.[0];
    if (!entryKey) errors.push(`El src del módulo de entrada (${src}) no coincide con ningún valor del mapa`);

    // Recorre el grafo de imports desde la entrada
    const seen = new Set();
    const queue = entryKey ? [entryKey] : [];
    while (queue.length) {
        const key = /** @type {string} */ (queue.shift());
        if (seen.has(key)) continue;
        seen.add(key);
        const res = await fetch(map.get(key), { cache: 'no-store' });
        if (!res.ok) {
            errors.push(`No existe ${map.get(key)} (${res.status})`);
            continue;
        }
        const code = await res.text();
        const file = key.slice(root.length);
        for (const m of code.matchAll(DYNAMIC_IMPORT)) {
            errors.push(`${file}: import() dinámico de "${m[1]}" (el mapa no lo verifica)`);
        }
        for (const m of code.matchAll(STATIC_IMPORT)) {
            const spec = m[1] || m[2];
            if (spec.includes('?')) errors.push(`${file}: "${spec}" lleva query; la versión la pone el mapa`);
            if (!/^\.\.?\//.test(spec)) {
                errors.push(`${file}: "${spec}" no es una ruta relativa`);
                continue;
            }
            const target = new URL(spec, key).href.replace(/\?.*$/, '');
            if (!map.has(target)) errors.push(`${file}: "${spec}" no está en el mapa de imports`);
            else queue.push(target);
        }
    }
    for (const key of map.keys()) {
        if (!seen.has(key)) errors.push(`Entrada sobrante en el mapa: ${key.slice(root.length)}`);
    }
    return { errors, version: versions.size === 1 ? [...versions][0] : null, modules: seen.size };
}
