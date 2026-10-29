/**
 * data/music.js
 * ------------------------------------------------------------------
 * Catálogo de las pistas de música y sus puntos de bucle (copiados de
 * design/actualizacion-v2/musica/bucles.json). El archivo empieza en 0:
 * la intro suena una vez y luego se repite [loopStart, loopEnd]. El
 * fundido del empalme ya va dentro del MP3.
 *
 * `loopEnd: null` significa que el bucle llega hasta el final del
 * archivo. `rockola` es el nombre de las pistas que se pueden elegir
 * para las partidas en la Rockola de la tienda (su artículo está en
 * SHOP_CATALOG.music). `bpm` y `duration` (segundos del archivo, solo
 * donde loopEnd es null) son para su tarjeta.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * @typedef {{ file: string, loopStart: number, loopEnd: number|null, loop: boolean,
 *             rockola?: string, bpm?: number, duration?: number }} MusicTrack
 */

/** @type {Record<string, MusicTrack>} */
const MUSIC_TRACKS = {
    musica_menu:       { file: 'assets/audio/musica_menu.mp3',       loop: true, loopStart: 36.885, loopEnd: 91.7466 },
    musica_tienda:     { file: 'assets/audio/musica_tienda.mp3',     loop: true, loopStart: 34.482, loopEnd: 94.482 },
    partida_synthwave: { file: 'assets/audio/partida_synthwave.mp3', loop: true, loopStart: 28.653, loopEnd: 137.0393, rockola: 'Synthwave', bpm: 124 },
    partida_chiptune:  { file: 'assets/audio/partida_chiptune.mp3',  loop: true, loopStart: 16.823, loopEnd: 117.5602, rockola: 'Chiptune', bpm: 162 },
    partida_funk:      { file: 'assets/audio/partida_funk.mp3',      loop: true, loopStart: 24.009, loopEnd: 116.773,  rockola: 'Funk', bpm: 124 },
    musica_gameplay:   { file: 'assets/audio/musica_gameplay.mp3',   loop: true, loopStart: 0,      loopEnd: null,     rockola: 'Clásica', duration: 117.29 },
    hachepe_rap:       { file: 'assets/audio/hachepe_rap.mp3',       loop: true, loopStart: 0,      loopEnd: null,     rockola: 'Rap Hachepe', duration: 245.42 },
    fiebre_rally:      { file: 'assets/audio/fiebre_rally.mp3',      loop: true, loopStart: 0,      loopEnd: 64.0 },
    jingle_victoria:   { file: 'assets/audio/jingle_victoria.mp3',   loop: false, loopStart: 0, loopEnd: null },
    jingle_derrota:    { file: 'assets/audio/jingle_derrota.mp3',    loop: false, loopStart: 0, loopEnd: null }
};

/**
 * Música dinámica (systems/music.js, musicDuck): cuánto baja o sube la
 * música y durante cuánto en cada reacción.
 */
const MUSIC_DYNAMIC = {
    goalDb: 6,             // gol: −6 dB durante 0,6 s
    goalHoldMs: 600,
    superDb: 4,            // súper golpe: −4 dB durante 0,3 s
    superHoldMs: 300,
    matchPointDb: 3,       // punto de partido: −3 dB mientras la bola esté en juego
    heartbeatMs: 900,      // un latido cada 0,9 s en el punto de partido
    feverBoostDb: 2,       // la pista de la fiebre sube 2 dB…
    feverBoostRally: 40    // …al llegar a 40 golpes
};
