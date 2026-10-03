/**
 * tests/app.js
 * ------------------------------------------------------------------
 * Interfaz de la página de tests: ejecuta los escenarios, los compara
 * con sus referencias y permite grabar referencias nuevas.
 *
 * Grabar exige ejecutar cada escenario dos veces y obtener exactamente
 * lo mismo: una referencia que no se reproduce a sí misma no sirve.
 * ------------------------------------------------------------------
 */
import { SCENARIOS } from './scenarios.js';
import { runScenario, compare } from './runner.js';
import { canonical } from './lib/canonical.js';
import { checkImportMap } from './lib/importmap.js';

const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
const tbody = /** @type {HTMLElement} */ (document.getElementById('results'));
const summary = /** @type {HTMLElement} */ (document.getElementById('summary'));
const buttons = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll('header button')]);

/** Resultados de la última ejecución (también los lee Playwright). */
const lastResults = {};
/** @type {any} */ (window).__lastResults = lastResults;

/** @param {string} name */
async function loadGolden(name) {
    const res = await fetch(`./golden/${name}.json`, { cache: 'no-store' });
    return res.ok ? res.json() : null;
}

/**
 * @param {any} scn
 * @param {string} cls
 * @param {string} status
 * @param {string} [detail]
 */
function showRow(scn, cls, status, detail = '') {
    let row = document.getElementById('row-' + scn.name);
    if (!row) {
        row = document.createElement('tr');
        row.id = 'row-' + scn.name;
        tbody.appendChild(row);
    }
    row.innerHTML = '';
    const cells = [scn.name, status, ''];
    cells.forEach((text, i) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (i === 1) td.className = cls;
        if (i === 2 && detail) {
            const pre = document.createElement('pre');
            pre.textContent = detail;
            td.appendChild(pre);
        }
        row.appendChild(td);
    });
}

/** Lo que debe repetirse idéntico entre dos ejecuciones. */
const fingerprint = (r) => canonical({
    frames: r.frames, light: r.light, checkpoints: r.checkpoints,
    events: r.events, final: r.final, errors: r.errors
});

/**
 * Comprobación estática del mapa de imports de index.html (ver lib/importmap.js).
 * @returns {Promise<boolean>}
 */
async function runImportMapCheck() {
    const row = { name: 'mapa-de-imports' };
    showRow(row, 'warn', 'ejecutando…');
    try {
        const { errors, version, modules } = await checkImportMap(new URL('../', location.href).href);
        const ok = errors.length === 0;
        showRow(row, ok ? 'ok' : 'bad', ok ? `OK (${modules} módulos, v=${version})` : 'FALLA', errors.join('\n'));
        return ok;
    } catch (err) {
        showRow(row, 'bad', 'ERROR', String(err && err.stack || err));
        return false;
    }
}

/**
 * @param {(scn:any) => Promise<boolean>} fn
 * @param {boolean} [withChecks] ejecutar antes las comprobaciones estáticas
 */
async function runEach(fn, withChecks = false) {
    buttons.forEach((b) => { b.disabled = true; });
    let passed = 0;
    let total = 0;
    const only = new URLSearchParams(location.search).get('only');
    const list = only ? SCENARIOS.filter((s) => only.split(',').includes(s.name)) : SCENARIOS;
    if (withChecks) {
        total++;
        if (await runImportMapCheck()) passed++;
    }
    total += list.length;
    for (const scn of list) {
        showRow(scn, 'warn', 'ejecutando…');
        try {
            if (await fn(scn)) passed++;
        } catch (err) {
            showRow(scn, 'bad', 'ERROR', String(err && err.stack || err));
        }
    }
    summary.textContent = `${passed} / ${total} correctos`;
    summary.className = passed === total ? 'ok' : 'bad';
    buttons.forEach((b) => { b.disabled = false; });
    /** @type {any} */ (window).__done = { passed, total };
}

async function runAll() {
    await runEach(async (scn) => {
        const [golden, got] = await Promise.all([loadGolden(scn.name), runScenario(stage, scn)]);
        lastResults[scn.name] = got;
        const { errors, warnings } = compare(golden, got, scn);
        const ok = errors.length === 0 && !!golden;
        showRow(scn, ok ? 'ok' : 'bad', ok ? `OK (${got.frames} fotogramas)` : 'FALLA',
            [...errors, ...warnings.map((w) => 'aviso: ' + w)].join('\n'));
        return ok;
    }, true);
}

async function record() {
    await runEach(async (scn) => {
        const a = await runScenario(stage, scn);
        const b = await runScenario(stage, scn);
        if (fingerprint(a) !== fingerprint(b)) {
            // Se compara la segunda contra la primera como si fuera la referencia,
            // para decir exactamente dónde se separan.
            const { errors } = compare(a, b, scn);
            showRow(scn, 'bad', 'NO DETERMINISTA',
                'Dos ejecuciones dieron resultados distintos: no se graba.\n' + errors.join('\n'));
            return false;
        }
        const { errors } = compare(null, a, scn);
        if (errors.length) {
            showRow(scn, 'bad', 'NO SE GRABA', errors.join('\n'));
            return false;
        }
        lastResults[scn.name] = a;
        download(`${scn.name}.json`, JSON.stringify(a));
        showRow(scn, 'ok', `grabado (${a.frames} fotogramas)`, a.events.join(', '));
        return true;
    });
}

/**
 * @param {string} filename
 * @param {string} text
 */
function download(filename, text) {
    if (new URLSearchParams(location.search).has('nodownload')) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

document.getElementById('run-all')?.addEventListener('click', runAll);
document.getElementById('record')?.addEventListener('click', record);

/** API para ejecutar desde la consola o desde Playwright. */
/** @type {any} */ (window).__tests = { runAll, record, SCENARIOS };
