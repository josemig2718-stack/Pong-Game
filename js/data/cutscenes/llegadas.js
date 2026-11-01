/**
 * data/cutscenes/llegadas.js
 * ------------------------------------------------------------------
 * Escenas de llegada a los pisos de la Torre Hachepe: se ven al salir
 * del ascensor, antes de la pantalla VS, la primera vez que se llega a
 * cada piso (y desde VER ESCENA en la ficha). Una escena por piso.
 *
 * Fuente: el plan «Pong Game · Campaña — Plan: Dani, Mario y Valen, y
 * Fano». Mismo formato que PROLOGO (ver CutsceneStep en
 * cutscene/player.js); usan el manifiesto común PROLOGO_ASSETS.
 * ------------------------------------------------------------------
 */

'use strict';

/** Color de Chayipiti (su pantalla). */
const C_CHAYIPITI = '#A855F7';

/** @type {Record<number, Cutscene>} escena de llegada por nivel de campaña */
const LLEGADAS = {

    // ------------------------------------------------------ piso 1 · Dani
    2: {
        id: 'llegada_dani',
        assets: 'PROLOGO_ASSETS',
        scenes: [{
            id: 'facturamos', steps: [
                { do: 'bg', id: 'contaduria' },
                { do: 'camera', x: 540, y: 320, zoom: 1.25 },
                { do: 'actor', id: 'dani', sprite: 'dani_telefono', x: 540, y: 470 },
                { do: 'actor', id: 'escritorio', sprite: 'escritorio', x: 540, y: 500 },
                { do: 'fx', type: 'elevator_open', floor: '1', dur: 0.9 },
                { do: 'sfx', name: 'elevatorDing' },
                { do: 'sfx', name: 'cashCounter', delay: 0.6 },
                { do: 'wait', dur: 1.1 },
                { do: 'say', who: 'dani', name: 'DANI', color: C_HP.dani, portrait: 'busto_dani',
                  text: 'Sí, Yisus. Este mes facturamos el doble. No, no, el triple…' },
                // el Desconocido sale del ascensor
                { do: 'camera', x: 420, y: 300, zoom: 1.05, dur: 1.2, ease: 'inOut' },
                { do: 'actor', id: 'd', frames: ['desconocido_andar_a', 'desconocido_andar_b'], fps: 3, x: 80, y: 516, alpha: 0 },
                { do: 'fade', id: 'd', alpha: 1, dur: 0.3 },
                { do: 'move', id: 'd', x: 220, dur: 2 },
                { do: 'wait', dur: 2 },
                { do: 'actor', id: 'd', sprite: 'desconocido' },
                { do: 'say', who: 'dani', name: 'DANI', color: C_HP.dani, portrait: 'busto_dani', text: 'Espérate, Yisus, tengo visita.' },
                { do: 'sfx', name: 'phoneHangUp' },
                { do: 'actor', id: 'dani', sprite: 'dani' },
                { do: 'say', who: 'dani', name: 'DANI', color: C_HP.dani, portrait: 'busto_dani',
                  text: 'Bienvenido a Contaduría. Pasa, pasa. ¿Efectivo o tarjeta?' },
                { do: 'wait', dur: 0.6 }
            ]
        }]
    },

    // ----------------------------------------------- piso 2 · Mario y Valen
    3: {
        id: 'llegada_duo',
        assets: 'PROLOGO_ASSETS',
        scenes: [{
            id: 'pausa', steps: [
                { do: 'bg', id: 'sala_juegos' },
                { do: 'camera', x: 470, y: 320, zoom: 1.2 },
                { do: 'actor', id: 'mario', sprite: 'mario', x: 330, y: 470 },
                { do: 'actor', id: 'maquina', sprite: 'maquina_espaldas', x: 330, y: 505, s: 0.8 },
                { do: 'actor', id: 'valen', sprite: 'valen', x: 600, y: 512 },
                { do: 'actor', id: 'puff', sprite: 'puff', x: 600, y: 515, s: 1.25 },
                { do: 'fx', type: 'elevator_open', floor: '2', dur: 0.9 },
                { do: 'sfx', name: 'elevatorDing' },
                { do: 'sfx', name: 'arcadeBlips', delay: 0.5 },
                { do: 'wait', dur: 1.1 },
                { do: 'fx', type: 'shake', amp: 2, dur: 0.3 },
                { do: 'say', who: 'mario', name: 'MARIO', color: C_HP.mario, portrait: 'busto_mario', text: '¡No, no, no! ¡NAGUARA, ESE SHIGARAKI!' },
                { do: 'say', who: 'valen', name: 'VALEN', color: C_HP.valen, portrait: 'busto_valen', text: 'DINDINDINDIN… tranqui bro, es solo un juego.' },
                // entra el Desconocido; el perrito lo ve primero
                { do: 'camera', x: 430, y: 300, zoom: 1.05, dur: 1.2, ease: 'inOut' },
                { do: 'actor', id: 'd', frames: ['desconocido_andar_a', 'desconocido_andar_b'], fps: 3, x: 80, y: 516, alpha: 0 },
                { do: 'fade', id: 'd', alpha: 1, dur: 0.3 },
                { do: 'move', id: 'd', x: 200, dur: 1.8 },
                { do: 'sfx', name: 'puppyBark', delay: 1.2 },
                { do: 'wait', dur: 1.8 },
                { do: 'actor', id: 'd', sprite: 'desconocido' },
                { do: 'say', who: 'valen', name: 'VALEN', color: C_HP.valen, portrait: 'busto_valen', text: 'Uy, bro. Tenemos visita.' },
                // Mario deja la máquina y se planta delante
                { do: 'move', id: 'mario', x: 430, y: 512, dur: 0.6, ease: 'out' },
                { do: 'wait', dur: 0.6 },
                { do: 'say', who: 'mario', name: 'MARIO', color: C_HP.mario, portrait: 'busto_mario', text: 'Pausa. Por fin algo que vale la pena.' },
                { do: 'wait', dur: 0.6 }
            ]
        }]
    },

    // ------------------------------------------------- piso 3 · Fano
    4: {
        id: 'llegada_fano',
        assets: 'PROLOGO_ASSETS',
        scenes: [{
            id: 'lo_predije', steps: [
                { do: 'bg', id: 'sala_control_oscura' },
                { do: 'camera', x: 480, y: 300, zoom: 1.1 },
                { do: 'actor', id: 'fano', sprite: 'fano_movil', x: 560, y: 470, alpha: 0 },
                { do: 'actor', id: 'consola', sprite: 'consola', x: 560, y: 505, alpha: 0.25 },
                { do: 'fx', type: 'elevator_open', floor: '3', dur: 0.9 },
                { do: 'sfx', name: 'elevatorDing' },
                { do: 'wait', dur: 1.4 },
                { do: 'say', who: 'fano', name: 'FANO', color: C_HP.fano, text: 'Noooo bro, otro más.' },
                // se encienden las luces
                { do: 'sfx', name: 'lightsOn' },
                { do: 'fx', type: 'flash', color: '#E9D5FF', dur: 0.15 },
                { do: 'bg', id: 'sala_control', fade: 0.2 },
                { do: 'fade', id: 'fano', alpha: 1, dur: 0.2 },
                { do: 'fade', id: 'consola', alpha: 1, dur: 0.2 },
                { do: 'actor', id: 'd', sprite: 'desconocido', x: 200, y: 516 },
                { do: 'wait', dur: 0.8 },
                { do: 'say', who: 'chayipiti', name: 'CHAYIPITI', color: C_CHAYIPITI, portrait: 'busto_chayipiti', radio: true,
                  text: 'Hola. Te estaba esperando. Literalmente: lo predije.' },
                { do: 'say', who: 'fano', name: 'FANO', color: C_HP.fano, portrait: 'busto_fano', text: 'Chayipiti, ¿cuánto tardamos en ganarle?' },
                { do: 'say', who: 'chayipiti', name: 'CHAYIPITI', color: C_CHAYIPITI, portrait: 'busto_chayipiti', radio: true,
                  text: 'Cuarenta segundos. Treinta, si te concentras.' },
                { do: 'wait', dur: 0.6 }
            ]
        }]
    }
};
