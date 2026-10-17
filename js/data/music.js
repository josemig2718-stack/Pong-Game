/**
 * data/music.js
 * ------------------------------------------------------------------
 * Catálogo de las pistas de música y sus puntos de bucle (copiados de
 * design/actualizacion-v2/musica/bucles.json). El archivo empieza en 0:
 * la intro suena una vez y luego se repite [loopStart, loopEnd]. El
 * fundido del empalme ya va dentro del MP3.
 *
 * `loopEnd: null` significa que el bucle llega hasta el final del
 * archivo. `rockola` es el nombre con el que se podrá elegir la pista
 * para las partidas (fase 6).
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * @typedef {{ file: string, loopStart: number, loopEnd: number|null, loop: boolean,
 *             rockola?: string }} MusicTrack
 */

/** @type {Record<string, MusicTrack>} */
const MUSIC_TRACKS = {
    musica_menu:       { file: 'assets/audio/musica_menu.mp3',       loop: true, loopStart: 36.885, loopEnd: 91.7466 },
    musica_tienda:     { file: 'assets/audio/musica_tienda.mp3',     loop: true, loopStart: 34.482, loopEnd: 94.482 },
    partida_synthwave: { file: 'assets/audio/partida_synthwave.mp3', loop: true, loopStart: 28.653, loopEnd: 137.0393, rockola: 'Synthwave' },
    partida_chiptune:  { file: 'assets/audio/partida_chiptune.mp3',  loop: true, loopStart: 16.823, loopEnd: 117.5602, rockola: 'Chiptune' },
    partida_funk:      { file: 'assets/audio/partida_funk.mp3',      loop: true, loopStart: 24.009, loopEnd: 116.773,  rockola: 'Funk' },
    musica_gameplay:   { file: 'assets/audio/musica_gameplay.mp3',   loop: true, loopStart: 0,      loopEnd: null,     rockola: 'Clásica' },
    hachepe_rap:       { file: 'assets/audio/hachepe_rap.mp3',       loop: true, loopStart: 0,      loopEnd: null,     rockola: 'Rap Hachepe' },
    fiebre_rally:      { file: 'assets/audio/fiebre_rally.mp3',      loop: true, loopStart: 0,      loopEnd: 64.0 },
    jingle_victoria:   { file: 'assets/audio/jingle_victoria.mp3',   loop: false, loopStart: 0, loopEnd: null },
    jingle_derrota:    { file: 'assets/audio/jingle_derrota.mp3',    loop: false, loopStart: 0, loopEnd: null }
};
