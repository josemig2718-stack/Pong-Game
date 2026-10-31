/**
 * cutscene/player.js
 * ------------------------------------------------------------------
 * Reproductor de escenas: interpreta una Cutscene (data/cutscenes/)
 * paso a paso sobre su propio canvas, con el diálogo, la narración y
 * las tarjetas en el DOM.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Una imagen del manifiesto, en unidades de escena (960×540). Los
 * actores llevan su punto de apoyo (ax, ay: los pies); `theme` es la
 * máscara que se tiñe con el color del tema, o null.
 * @typedef {{ src: string, w: number, h: number, ax?: number, ay?: number,
 *             desc?: string, theme: string|null }} CutsceneImage
 */

/**
 * Manifiesto de recursos de una escena (generado: prologo-assets.js).
 * @typedef {{ unit: string, pxPerUnit: number,
 *             backgrounds: Record<string, CutsceneImage>,
 *             actors: Record<string, CutsceneImage> }} CutsceneAssets
 */

/**
 * Un paso de una escena. `do` dice qué hace y el resto de campos
 * depende de él (tabla en design/campana/prologo/guia-implementacion.md).
 * @typedef {{
 *   do: string,
 *   id?: string, type?: string, name?: string, who?: string, actor?: string,
 *   sprite?: string, frames?: string[], fps?: number, portrait?: string,
 *   x?: number, y?: number, s?: number, flip?: boolean, alpha?: number, bob?: number,
 *   zoom?: number, dur?: number, ease?: string, delay?: number, fade?: number,
 *   text?: string, sub?: string, color?: string, radio?: boolean, auto?: number,
 *   alias?: string, line?: string, sfx?: string, after?: string,
 *   track?: string, loop?: boolean, from?: string[]|number, stop?: boolean,
 *   keep?: string[], on?: boolean, density?: number, amp?: number, dir?: number,
 *   lightning?: boolean, to?: string|number[], volleys?: number, gap?: number,
 *   x0?: number, x1?: number, left?: string, right?: string, count?: number,
 *   cx?: number, cy?: number, factor?: number,
 *   pairs?: { x: number, y: number, color: string }[]
 * }} CutsceneStep
 */

/** @typedef {{ id: string, steps: CutsceneStep[] }} CutsceneScene */

/**
 * Una película: sus escenas y el nombre de la constante global con su
 * manifiesto (así los datos no dependen del orden de carga).
 * @typedef {{ id: string, assets: string, endCard?: string, scenes: CutsceneScene[] }} Cutscene
 */
