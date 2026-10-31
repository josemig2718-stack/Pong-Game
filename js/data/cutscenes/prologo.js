/**
 * data/cutscenes/prologo.js
 * ------------------------------------------------------------------
 * El prólogo de la campaña como datos: 12 escenas que el reproductor
 * (js/cutscene/player.js) interpreta paso a paso.
 *
 * Fuente: el documento «Pong Game · Campaña — Guion del prólogo».
 * Coordenadas en unidades de escena (960×540); los pies de cada actor
 * están en (x, y). Recursos: PROLOGO_ASSETS (prologo-assets.js).
 *
 * Cómo se lee un paso (ver CutsceneStep en cutscene/player.js):
 *  - Los pasos de una escena se ejecutan en orden.
 *  - `say`, `narrate`, `card` y `wait` BLOQUEAN: el siguiente paso no
 *    empieza hasta que terminan (el jugador avanza o se cumple el
 *    tiempo automático).
 *  - Todo lo demás (bg, camera, actor, move, pose, remove, fx, music,
 *    sfx) empieza al instante y corre en paralelo con lo que sigue.
 *  - `who: 'theme'` o `color: 'theme'` = el color del tema del jugador.
 * ------------------------------------------------------------------
 */

'use strict';

const C_HP = {
    chemi: '#E5E7EB', dani: '#D4A72C', mario: '#E63946', valen: '#C98A4B',
    fano: '#8B5CF6', yisus: '#FACC15', locos: '#A3E635', madre: '#F9A8D4', nino: '#93C5FD'
};

/** @type {Cutscene} */
const PROLOGO = {
    id: 'prologo',
    assets: 'PROLOGO_ASSETS',
    endCard: 'CAPÍTULO 1',
    scenes: [

        // ---------------------------------------------------------- 1
        {
            id: 'encendido', steps: [
                { do: 'fx', type: 'crt_on', dur: 1.2 },
                { do: 'sfx', name: 'crtOn' },
                { do: 'wait', dur: 1.3 },
                { do: 'fx', type: 'title', text: 'BARKS CITY', color: 'theme', dur: 4.2 },
                { do: 'sfx', name: 'titleChord' },
                { do: 'wait', dur: 4.4 }
            ]
        },

        // ---------------------------------------------------------- 2
        {
            id: 'ciudad_viva', steps: [
                { do: 'bg', id: 'skyline_libre', fade: 0.8 },
                { do: 'camera', x: 330, y: 290, zoom: 1.35 },
                { do: 'camera', x: 640, y: 270, zoom: 1.2, dur: 13, ease: 'inOut' },
                { do: 'music', track: 'prologo_barks_city', fade: 1.5 },
                { do: 'fx', type: 'traffic', y: 414, dur: 14 },
                { do: 'sfx', name: 'cityAmbience', loop: true },
                { do: 'wait', dur: 4 },
                { do: 'narrate', text: 'Barks City. La ciudad donde todo se decide con una paleta.' },
                { do: 'wait', dur: 3 }
            ]
        },

        // ---------------------------------------------------------- 3
        {
            id: 'dia_cualquiera', steps: [
                { do: 'bg', id: 'calle_libre', fade: 0.6 },
                { do: 'camera', x: 480, y: 270, zoom: 1 },
                { do: 'actor', id: 'v1', frames: ['vecino1_a', 'vecino1_b'], fps: 3, x: -60, y: 512 },
                { do: 'move', id: 'v1', x: 1030, dur: 20 },
                { do: 'actor', id: 'v3', frames: ['vecino3_a', 'vecino3_b'], fps: 3, x: 1020, y: 512, flip: true },
                { do: 'move', id: 'v3', x: -80, dur: 22 },
                { do: 'actor', id: 'perro', sprite: 'perro', x: -120, y: 512, bob: 2 },
                { do: 'move', id: 'perro', x: 970, dur: 20 },
                { do: 'actor', id: 'nino', frames: ['nino_vecino_a', 'nino_vecino_b'], fps: 4, x: 700, y: 512, flip: true },
                { do: 'move', id: 'nino', x: 560, dur: 6 },
                { do: 'wait', dur: 3 },
                // aparece el Desconocido con un chispazo blanco (pista de El Creador)
                { do: 'fx', type: 'spark', x: 330, y: 430, color: '#FFFFFF' },
                { do: 'sfx', name: 'spark' },
                { do: 'actor', id: 'd', sprite: 'desconocido', x: 330, y: 516, alpha: 0 },
                { do: 'fade', id: 'd', alpha: 1, dur: 0.25 },
                { do: 'move', id: 'd', x: 350, dur: 0.4, ease: 'out' },
                { do: 'actor', id: 'peaton', frames: ['vecino2_a', 'vecino2_b'], fps: 3, x: 640, y: 512, flip: true },
                { do: 'move', id: 'peaton', x: 400, dur: 3.4 },
                { do: 'wait', dur: 3.4 },
                { do: 'fx', type: 'shake', amp: 3, dur: 0.2 },
                { do: 'say', who: 'peaton', name: 'PEATÓN', color: '#E8ECF4', text: '¡Eh, mira por dónde vas, menor!' },
                { do: 'move', id: 'peaton', x: -80, dur: 5 },
                { do: 'say', who: 'd', name: '¿¿??', color: 'theme', portrait: 'desconocido', text: '…¿Dónde estoy?' },
                // se pierde por los callejones: no verá la llegada del Sindicato
                { do: 'actor', id: 'd', frames: ['desconocido_andar_a', 'desconocido_andar_b'], fps: 3, flip: true },
                { do: 'move', id: 'd', x: -90, dur: 4 },
                { do: 'wait', dur: 3 }
            ]
        },

        // ---------------------------------------------------------- 4
        {
            id: 'frenazo', steps: [
                { do: 'music', stop: true, fade: 0.05 },
                { do: 'sfx', name: 'cityAmbience', stop: true },   // la ciudad calla con el frenazo
                { do: 'sfx', name: 'tireScreech' },
                { do: 'actor', id: 'v1', frames: ['vecino1_a', 'vecino1_b'], fps: 0, x: 140, y: 512 },
                { do: 'actor', id: 'v4', sprite: 'vecino4_a', x: 230, y: 512 },
                { do: 'actor', id: 'nino', sprite: 'nino_vecino_a', x: 300, y: 512 },
                { do: 'actor', id: 'perro', sprite: 'perro', x: 190, y: 512 },
                { do: 'actor', id: 'van', sprite: 'camioneta', x: 1250, y: 528 },
                { do: 'move', id: 'van', x: 860, dur: 1.1, ease: 'out' },
                { do: 'fx', type: 'dust', x: 980, y: 528, delay: 0.9 },
                { do: 'fx', type: 'beams', actor: 'van', dir: -1, delay: 1.1 },
                { do: 'fx', type: 'shake', amp: 6, dur: 0.4, delay: 1.0 },
                { do: 'wait', dur: 1.8 },
                // la séptima silueta: 0,3 s tras el cristal (El Creador)
                { do: 'fx', type: 'silhouette', sprite: 'creador', x: 905, y: 500, s: 0.32, dur: 0.3, lightning: true },
                { do: 'sfx', name: 'spark' },
                { do: 'wait', dur: 0.8 },
                { do: 'sfx', name: 'siren' },
                { do: 'wait', dur: 2.2 }
            ]
        },

        // ---------------------------------------------------------- 5
        {
            id: 'bajan_los_seis', steps: [
                { do: 'music', track: 'prologo_hachepes', fade: 0.1 },
                // bajan de menor a mayor rango; tarjeta congelada con cada uno
                { do: 'actor', id: 'valen', sprite: 'valen', x: 860, y: 518, alpha: 0 },
                { do: 'fade', id: 'valen', alpha: 1, dur: 0.2 },
                { do: 'move', id: 'valen', x: 420, dur: 0.9, ease: 'out' },
                { do: 'wait', dur: 0.9 },
                { do: 'card', actor: 'valen', name: 'VALEN', alias: 'El Relajado', color: C_HP.valen,
                  line: 'Tranquilo bro, si pagas tu cuota no te haré nada.', sfx: 'cardHit', after: 'puppyBark' },

                { do: 'actor', id: 'mario', sprite: 'mario', x: 860, y: 518, alpha: 0 },
                { do: 'fade', id: 'mario', alpha: 1, dur: 0.2 },
                { do: 'move', id: 'mario', x: 500, dur: 0.9, ease: 'out' },
                { do: 'wait', dur: 0.9 },
                { do: 'card', actor: 'mario', name: 'MARIO', alias: 'El Diablo Rojo', color: C_HP.mario,
                  line: 'Terminemos esto rápido, quiero ir a jugar My Hero.', sfx: 'cardHit' },

                { do: 'actor', id: 'fano', sprite: 'fano', x: 860, y: 518, alpha: 0 },
                { do: 'fade', id: 'fano', alpha: 1, dur: 0.2 },
                { do: 'move', id: 'fano', x: 580, dur: 0.9, ease: 'out' },
                { do: 'wait', dur: 0.9 },
                { do: 'card', actor: 'fano', name: 'FANO', alias: 'El fan del coco', color: C_HP.fano,
                  line: 'Nooooo bro, Chayipiti, mira a esta gente tan debilucha.', sfx: 'cardHit' },

                { do: 'actor', id: 'dani', sprite: 'dani', x: 860, y: 518, alpha: 0 },
                { do: 'fade', id: 'dani', alpha: 1, dur: 0.2 },
                { do: 'move', id: 'dani', x: 660, dur: 0.9, ease: 'out' },
                { do: 'wait', dur: 0.9 },
                { do: 'card', actor: 'dani', name: 'DANI', alias: 'Grow Partner', color: C_HP.dani,
                  line: 'Ay Yisus, con esto sí vamos a facturar 10 mil al mes.', sfx: 'cardHit' },

                { do: 'actor', id: 'chemi', sprite: 'chemi', x: 860, y: 518, alpha: 0 },
                { do: 'fade', id: 'chemi', alpha: 1, dur: 0.2 },
                { do: 'move', id: 'chemi', x: 740, dur: 0.9, ease: 'out' },
                { do: 'wait', dur: 0.9 },
                { do: 'card', actor: 'chemi', name: 'CHEMI', alias: 'The Black', color: C_HP.chemi,
                  line: 'Mano, sapegato, con estos locos se ven más débiles.', sfx: 'cardHit' },

                // el jefe sube al techo de la camioneta
                { do: 'actor', id: 'yisus', sprite: 'yisus', x: 860, y: 430, alpha: 0 },
                { do: 'fx', type: 'flash', color: C_HP.yisus, dur: 0.25 },
                { do: 'fade', id: 'yisus', alpha: 1, dur: 0.3 },
                { do: 'wait', dur: 0.5 },
                { do: 'card', actor: 'yisus', name: 'YISUS', alias: 'El Aura', color: C_HP.yisus,
                  line: 'Ouuuuuuu sheeeetttttttt', sfx: 'cardHitBig' }
            ]
        },

        // ---------------------------------------------------------- 6
        {
            id: 'ataque', steps: [
                { do: 'say', who: 'yisus', name: 'YISUS', color: C_HP.yisus, portrait: 'yisus',
                  text: 'Barks City. Desde hoy se juega con nuestras reglas, se los voy avisando.' },
                { do: 'pose', id: 'valen', sprite: 'valen_ataque' },
                { do: 'pose', id: 'mario', sprite: 'mario_ataque' },
                { do: 'pose', id: 'fano', sprite: 'fano_ataque' },
                { do: 'pose', id: 'dani', sprite: 'dani_ataque' },
                { do: 'pose', id: 'chemi', sprite: 'chemi_ataque' },
                { do: 'pose', id: 'yisus', sprite: 'yisus_ataque' },
                { do: 'say', who: 'mario', name: 'MARIO', color: C_HP.mario, portrait: 'mario',
                  text: 'MUAJAJAJ, es hora de causar el caos.' },
                { do: 'fx', type: 'veil', color: '#FACC15', alpha: 0.07, dur: 0.6 },
                // la gente huye hacia la izquierda
                { do: 'actor', id: 'v1', frames: ['vecino1_a', 'vecino1_b'], fps: 6, flip: true },
                { do: 'move', id: 'v1', x: -100, dur: 2.2 },
                { do: 'actor', id: 'v4', frames: ['vecino4_a', 'vecino4_b'], fps: 6, flip: true },
                { do: 'move', id: 'v4', x: -100, dur: 2.6 },
                { do: 'actor', id: 'nino', frames: ['nino_vecino_a', 'nino_vecino_b'], fps: 7, flip: true },
                { do: 'move', id: 'nino', x: -100, dur: 2.8 },
                { do: 'move', id: 'perro', x: -100, dur: 1.6 },
                // pelotas de energía: salen de la pala de cada uno hacia la izquierda
                { do: 'fx', type: 'balls', from: ['valen', 'mario', 'fano', 'dani', 'chemi', 'yisus'], to: 'left', volleys: 3, gap: 0.45 },
                { do: 'sfx', name: 'energyBalls' },
                { do: 'fx', type: 'shake', amp: 5, dur: 1.6, delay: 0.3 },
                { do: 'fx', type: 'glass', x: 200, y: 360, delay: 0.5 },
                { do: 'fx', type: 'glass', x: 610, y: 380, delay: 1.1 },
                { do: 'sfx', name: 'glass', delay: 0.5 },
                { do: 'sfx', name: 'valenLaugh', delay: 1.2 },
                { do: 'wait', dur: 3.6 }
            ]
        },

        // ---------------------------------------------------------- 7
        {
            id: 'partida_torre', steps: [
                { do: 'clear' },
                { do: 'bg', id: 'torre_libre', fade: 0.4 },
                { do: 'camera', x: 480, y: 300, zoom: 1.1 },
                { do: 'camera', x: 480, y: 290, zoom: 1.0, dur: 9 },
                { do: 'actor', id: 'yisus', sprite: 'yisus_ataque', x: 360, y: 474 },
                { do: 'actor', id: 'alcalde', sprite: 'alcalde', x: 610, y: 474, flip: true },
                { do: 'fx', type: 'rally', x0: 380, x1: 590, y: 438, dur: 6.5 },
                { do: 'fx', type: 'scoreboard', x: 480, y: 70, left: 'HP', right: 'ALCALDE', to: [5, 0], dur: 6.5, color: 'theme' },
                { do: 'narrate', text: 'Retaron al alcalde a una partida. Nadie le anotó un solo punto.', auto: 4 },
                { do: 'wait', dur: 2.6 },
                { do: 'fx', type: 'glitch', dur: 0.4 },
                { do: 'bg', id: 'torre_sindicato', fade: 0.6 },
                { do: 'sfx', name: 'logoOn' },
                { do: 'wait', dur: 1.6 }
            ]
        },

        // ---------------------------------------------------------- 8
        {
            id: 'pasaron_los_meses', steps: [
                { do: 'clear' },
                { do: 'bg', id: 'skyline_libre', fade: 0.4 },
                { do: 'camera', x: 480, y: 270, zoom: 1 },
                { do: 'music', track: 'prologo_barks_triste', fade: 2 },
                { do: 'fx', type: 'calendar', count: 9, dur: 7 },
                // el dorado avanza desde la torre y apaga el color del tema
                { do: 'fx', type: 'wipe', to: 'skyline_sindicato', cx: 640, cy: 230, dur: 6.5 },
                { do: 'narrate', text: 'PASARON LOS MESES.', auto: 3.5 },
                { do: 'wait', dur: 3.2 }
            ]
        },

        // ---------------------------------------------------------- 9
        {
            id: 'ciudad_sometida', steps: [
                { do: 'bg', id: 'calle_sindicato', fade: 0.6 },
                { do: 'fx', type: 'rain', on: true, density: 1 },
                { do: 'sfx', name: 'rain', loop: true },
                { do: 'actor', id: 'g1', frames: ['gris1_a', 'gris1_b'], fps: 2, x: -60, y: 512 },
                { do: 'move', id: 'g1', x: 1020, dur: 26 },
                { do: 'actor', id: 'g2', frames: ['gris2_a', 'gris2_b'], fps: 2, x: 1010, y: 512, flip: true },
                { do: 'move', id: 'g2', x: -60, dur: 28 },
                { do: 'actor', id: 'vendedor', sprite: 'vendedor', x: 452, y: 512, flip: true },
                { do: 'actor', id: 'dani', sprite: 'dani', x: 380, y: 518 },
                { do: 'actor', id: 'fano', sprite: 'fano', x: 790, y: 518 },
                { do: 'wait', dur: 1.5 },
                { do: 'say', who: 'dani', name: 'DANI', color: C_HP.dani, portrait: 'dani', text: 'La cuota de la semana. Nada personal.' },
                { do: 'sfx', name: 'shutter' },
                { do: 'narrate', text: 'Todo se pagaba al Sindicato. Hasta jugar.' },
                { do: 'fx', type: 'lightning', dur: 0.4 },
                { do: 'sfx', name: 'thunder' },
                { do: 'wait', dur: 1.5 }
            ]
        },

        // ---------------------------------------------------------- 10
        {
            id: 'rescate', steps: [
                { do: 'clear', keep: ['rain'] },
                { do: 'bg', id: 'calle_sindicato' },
                { do: 'actor', id: 'madre', frames: ['madre_a', 'madre_b'], fps: 3, x: 280, y: 512 },
                { do: 'actor', id: 'hijo', frames: ['hijo_a', 'hijo_b'], fps: 4, x: 318, y: 512 },
                { do: 'move', id: 'madre', x: 520, dur: 4 },
                { do: 'move', id: 'hijo', x: 558, dur: 4 },
                { do: 'wait', dur: 2.6 },
                { do: 'sfx', name: 'carApproach' },
                { do: 'actor', id: 'coche', sprite: 'coche_locos', x: 1300, y: 532 },
                { do: 'fx', type: 'beams', actor: 'coche', dir: -1 },
                { do: 'move', id: 'coche', x: 760, dur: 1.2 },
                { do: 'wait', dur: 1.0 },
                // cámara lenta: el Desconocido cruza como un rayo y deja su estela
                { do: 'fx', type: 'slowmo', factor: 0.25, dur: 2.2 },
                { do: 'sfx', name: 'slowmo' },
                { do: 'actor', id: 'd', frames: ['desconocido_andar_a', 'desconocido_andar_b'], fps: 8, x: -80, y: 516 },
                { do: 'fx', type: 'streak', actor: 'd', color: 'theme', dur: 1.2 },
                { do: 'move', id: 'd', x: 470, dur: 0.5, ease: 'out' },
                { do: 'move', id: 'madre', x: 640, dur: 0.6, ease: 'out', delay: 0.45 },
                { do: 'move', id: 'hijo', x: 690, dur: 0.6, ease: 'out', delay: 0.45 },
                { do: 'move', id: 'coche', x: -420, dur: 0.9, delay: 0.7 },
                { do: 'wait', dur: 2.4 },
                { do: 'actor', id: 'd', sprite: 'desconocido' },
                { do: 'actor', id: 'madre', sprite: 'madre', flip: true },
                { do: 'actor', id: 'hijo', sprite: 'hijo', flip: true },
                { do: 'say', who: 'coche', name: 'LOS DEL COCHE', color: C_HP.locos, text: '¡Viva los Hachepes!' },
                { do: 'say', who: 'madre', name: 'MADRE', color: C_HP.madre, text: 'Gracias… ¿Quién eres?' },
                { do: 'say', who: 'd', name: '¿¿??', color: 'theme', portrait: 'desconocido', text: 'Eso no es importante, señora. ¿Están bien?' }
            ]
        },

        // ---------------------------------------------------------- 11
        {
            id: 'la_paleta', steps: [
                { do: 'clear', keep: ['rain'] },
                { do: 'bg', id: 'mirada', fade: 0.6 },
                { do: 'fx', type: 'rain', density: 0.6 },
                { do: 'actor', id: 'madre', sprite: 'madre', x: 330, y: 600, s: 2.0 },
                { do: 'actor', id: 'hijo', sprite: 'hijo', x: 410, y: 600, s: 2.0 },
                { do: 'actor', id: 'd', sprite: 'desconocido_espalda', x: 620, y: 610, s: 1.6 },
                { do: 'camera', x: 480, y: 270, zoom: 1.08 },
                { do: 'camera', x: 480, y: 250, zoom: 1.0, dur: 14 },
                { do: 'say', who: 'hijo', name: 'NIÑO', color: C_HP.nino, text: 'Mi papá jugaba. Ahora trabaja ahí arriba, para ellos.' },
                { do: 'actor', id: 'paleta', sprite: 'paleta_nino', x: 440, y: 470, s: 1.6, alpha: 0 },
                { do: 'fade', id: 'paleta', alpha: 1, dur: 0.3 },
                { do: 'say', who: 'hijo', name: 'NIÑO', color: C_HP.nino, text: 'Toma. Él dice que una paleta solo sirve si alguien la usa.' },
                { do: 'move', id: 'paleta', x: 590, y: 440, dur: 0.8, ease: 'inOut' },
                { do: 'wait', dur: 0.8 },
                { do: 'remove', id: 'paleta' },
                { do: 'pose', id: 'd', sprite: 'desconocido_espalda_paleta' },
                { do: 'sfx', name: 'paddleTake' },
                { do: 'wait', dur: 0.8 },
                { do: 'move', id: 'madre', x: -200, dur: 4 },
                { do: 'move', id: 'hijo', x: -140, dur: 4.2 },
                { do: 'wait', dur: 3 }
            ]
        },

        // ---------------------------------------------------------- 12
        {
            id: 'frente_a_la_torre', steps: [
                { do: 'clear', keep: ['rain'] },
                { do: 'bg', id: 'escalinata', fade: 0.8 },
                { do: 'actor', id: 'd', sprite: 'desconocido_espalda_paleta', x: 480, y: 640, s: 1.25 },
                { do: 'move', id: 'd', y: 548, s: 1.1, dur: 4, ease: 'out' },
                { do: 'wait', dur: 3 },
                { do: 'fx', type: 'eyes', pairs: [
                    { x: 380, y: 206, color: C_HP.chemi }, { x: 430, y: 190, color: C_HP.dani },
                    { x: 530, y: 190, color: C_HP.mario }, { x: 580, y: 206, color: C_HP.valen },
                    { x: 455, y: 250, color: C_HP.fano }, { x: 505, y: 250, color: C_HP.yisus }], gap: 0.35 },
                { do: 'sfx', name: 'eyes' },
                { do: 'wait', dur: 2.4 },
                { do: 'sfx', name: 'speaker' },
                { do: 'say', who: 'yisus', name: 'YISUS · ALTAVOZ', color: C_HP.yisus, text: 'Otro valiente. Sube si puedes.', radio: true },
                { do: 'say', who: 'd', name: '¿¿??', color: 'theme', portrait: 'desconocido', text: 'Voy a subir.' },
                { do: 'music', track: 'prologo_determinacion', loop: false, from: 106, fade: 0 },
                { do: 'fx', type: 'lightning', dur: 0.5 },
                { do: 'fx', type: 'scarf_gust', actor: 'd', dur: 2 },
                { do: 'wait', dur: 6 },
                { do: 'fx', type: 'crt_off', dur: 1 },
                { do: 'wait', dur: 1.1 },
                { do: 'fx', type: 'chapter', text: 'CAPÍTULO 1', sub: 'La torre', dur: 3 },
                { do: 'wait', dur: 3 }
            ]
        }
    ]
};
