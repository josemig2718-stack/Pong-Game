/**
 * data/cutscenes/final.js
 * ------------------------------------------------------------------
 * El final de la campaña como datos: la llegada al trono de Yisus, el
 * falso final, la introducción del Creador, el final verdadero y los
 * créditos. Mismo formato que PROLOGO (ver CutsceneStep en
 * cutscene/player.js) más los pasos y efectos nuevos de
 * design/campana/final/guia-implementacion.md (F.2).
 *
 * Fuente: el plan «Pong Game · Campaña — Plan: Yisus, el Creador y el
 * final». Manifiesto común: PROLOGO_ASSETS.
 *
 * En los textos del Creador, {partidas}, {monedas}, {nivel} y
 * {dispositivo} se sustituyen al mostrarse (ver F.2).
 * ------------------------------------------------------------------
 */

'use strict';

const C_FINAL = {
    mariangel: '#F472B6', pedro: '#60A5FA', creador: '#E0F2FE', nino: '#93C5FD', madre: '#F9A8D4'
};

// ================================================================ piso 4
LLEGADAS[5] = {
    id: 'llegada_yisus',
    assets: 'PROLOGO_ASSETS',
    // yisus_trono sigue sonando aunque se salte (F.3)
    keepMusic: true,
    scenes: [
        {
            id: 'la_cima', steps: [
                { do: 'music', track: 'yisus_trono', fade: 0.5 },
                { do: 'bg', id: 'trono' },
                { do: 'camera', x: 560, y: 300, zoom: 1.15 },
                { do: 'actor', id: 'yisus', sprite: 'yisus_silueta', x: 470, y: 470 },
                { do: 'actor', id: 'ataud', sprite: 'ataud', x: 606, y: 456 },
                { do: 'actor', id: 'mariangel', sprite: 'mariangel', x: 760, y: 470, flip: true },
                // Pedro, de rodillas, sacando brillo al ataúd
                { do: 'actor', id: 'pedro', sprite: 'pedro_rodillas', x: 652, y: 470, flip: true },
                // el ascensor sube más despacio que nunca
                { do: 'fx', type: 'elevator_open', floor: '4', count: ['3', '4'], dur: 2.2 },
                { do: 'sfx', name: 'elevatorDing', delay: 1.9 },
                { do: 'wait', dur: 2.6 },
                { do: 'actor', id: 'd', frames: ['desconocido_andar_a', 'desconocido_andar_b'], fps: 3, x: -40, y: 516 },
                { do: 'move', id: 'd', x: 180, dur: 2.4 },
                { do: 'say', who: 'mariangel', name: 'MARIANGEL', color: C_FINAL.mariangel, portrait: 'busto_mariangel', text: 'Ji, Ji, Ji, Ji.' },
                { do: 'actor', id: 'd', sprite: 'desconocido' },
                // aplaude despacio, sin girarse (las manos por encima de los hombros, a contraluz)
                { do: 'actor', id: 'yisus', frames: ['yisus_aplaude_a', 'yisus_aplaude_b'], fps: 1.43 },
                { do: 'sfx', name: 'slowClap' },
                { do: 'wait', dur: 2.8 },
                { do: 'actor', id: 'yisus', sprite: 'yisus_silueta' },
                { do: 'say', who: 'yisus', name: 'YISUS', color: C_HP.yisus, text: 'Bravo. Bravo.' },
                { do: 'say', who: 'yisus', name: 'YISUS', color: C_HP.yisus, text: '¿Sabes cuántos han tratado de subir en ese ascensor? Cientos.' },
                // se gira
                { do: 'pose', id: 'yisus', sprite: 'yisus' },
                { do: 'fx', type: 'flash', color: C_HP.yisus, dur: 0.2 },
                { do: 'camera', x: 470, y: 320, zoom: 1.35, dur: 1, ease: 'out' },
                { do: 'say', who: 'yisus', name: 'YISUS', color: C_HP.yisus, portrait: 'busto_yisus', text: '¿Y sabes cuántos pasaron de Chemi? Ninguno. Nunca. Nadie.' },
                { do: 'say', who: 'yisus', name: 'YISUS', color: C_HP.yisus, portrait: 'busto_yisus', text: 'Hasta hoy.' },
                { do: 'say', who: 'mariangel', name: 'MARIANGEL', color: C_FINAL.mariangel, portrait: 'busto_mariangel', text: 'Ji, Ji, Ji, Ji.' },
                { do: 'camera', x: 420, y: 300, zoom: 1.1, dur: 1.2, ease: 'inOut' },
                { do: 'say', who: 'yisus', name: 'YISUS', color: C_HP.yisus, portrait: 'busto_yisus',
                  text: 'Felicidades, desconocido. Eres el único que ha llegado hasta mí. De verdad, me alegra. Me aburría.' }
            ]
        },
        {
            id: 'pedro', steps: [
                // plano corto: Pedro ve la paleta
                { do: 'camera', x: 420, y: 360, zoom: 1.7, dur: 1.2, ease: 'inOut' },
                { do: 'actor', id: 'd', sprite: 'desconocido_espalda_paleta', x: 300, y: 516 },
                { do: 'actor', id: 'pedro', sprite: 'pedro_rodillas', x: 470, y: 470, flip: true },
                { do: 'wait', dur: 1.2 },
                { do: 'say', who: 'pedro', name: 'PEDRO', color: C_FINAL.pedro, portrait: 'busto_pedro', text: 'Esa paleta… es la mía.' },
                { do: 'fx', type: 'shake', amp: 4, dur: 0.3 },
                { do: 'say', who: 'yisus', name: 'YISUS', color: C_HP.yisus, portrait: 'busto_yisus', text: '¡Silencio, Pedro! ¿Quién te dio permiso para hablar?' },
                { do: 'say', who: 'pedro', name: 'PEDRO', color: C_FINAL.pedro, portrait: 'busto_pedro', text: 'Mi hijo… ¿está bien?' },
                { do: 'say', who: 'd', name: '¿¿??', color: 'theme', portrait: 'desconocido', text: 'Está bien. Y te está esperando.' },
                { do: 'camera', x: 520, y: 300, zoom: 1.1, dur: 1, ease: 'inOut' },
                { do: 'say', who: 'yisus', name: 'YISUS', color: C_HP.yisus, portrait: 'busto_yisus', text: 'Qué tierno. Pedro, mi copa.' },
                { do: 'actor', id: 'pedro', sprite: 'pedro', x: 652, y: 470, flip: true },
                { do: 'move', id: 'pedro', x: 540, dur: 1.2 },
                { do: 'wait', dur: 1.2 },
                // Yisus coge la copa y bebe
                { do: 'pose', id: 'pedro', sprite: 'pedro_vacia' },
                { do: 'pose', id: 'yisus', sprite: 'yisus_copa' },
                { do: 'sfx', name: 'glassClink' },
                { do: 'wait', dur: 1.4 },
                { do: 'move', id: 'pedro', x: 652, dur: 1 },
                { do: 'pose', id: 'yisus', sprite: 'yisus' },
                { do: 'wait', dur: 0.6 },
                // se levanta: el aura llena la sala
                { do: 'pose', id: 'yisus', sprite: 'yisus_ataque' },
                { do: 'fx', type: 'veil', color: '#FACC15', alpha: 0.18, dur: 1.2 },
                { do: 'fx', type: 'shake', amp: 5, dur: 0.8 },
                { do: 'say', who: 'mariangel', name: 'MARIANGEL', color: C_FINAL.mariangel, portrait: 'busto_mariangel', text: 'Ji, Ji, Ji, Ji.' },
                { do: 'say', who: 'yisus', name: 'YISUS', color: C_HP.yisus, portrait: 'busto_yisus',
                  text: 'Vamos a jugar, desconocido. Si ganas, la ciudad es tuya. Si pierdes… Pedro va a necesitar un ayudante.' },
                { do: 'wait', dur: 0.6 }
            ]
        }
    ]
};

// =========================================================== falso final
/** @type {Cutscene} */
const FALSO_FINAL = {
    id: 'falso_final',
    assets: 'PROLOGO_ASSETS',
    // La guía (F.5): como la introducción, la primera vez no se salta
    noSkipFirstTime: true,
    scenes: [
        {
            id: 'la_torre_se_apaga', steps: [
                { do: 'music', track: 'falso_final', loop: false, fade: 0.5 },
                { do: 'bg', id: 'torre_sindicato', fade: 0.8 },
                { do: 'camera', x: 480, y: 250, zoom: 1.25 },
                { do: 'camera', x: 480, y: 270, zoom: 1.0, dur: 9, ease: 'inOut' },
                // el logo suelto va justo encima del que está pintado en el fondo
                { do: 'actor', id: 'logo', sprite: 'logo_hp', x: 480, y: 88 },
                { do: 'wait', dur: 2.2 },
                // parpadea…
                { do: 'fx', type: 'flicker', id: 'logo', dur: 1.2 },
                { do: 'sfx', name: 'powerDown' },
                { do: 'wait', dur: 1.2 },
                // …se apaga la torre y el logo se suelta y cae girando
                { do: 'bg', id: 'torre_apagada' },
                { do: 'fx', type: 'glitch', dur: 0.2 },
                { do: 'move', id: 'logo', x: 520, y: 470, rot: 200, dur: 1.3, ease: 'in' },
                { do: 'wait', dur: 1.3 },
                { do: 'sfx', name: 'logoCrash' },
                { do: 'fx', type: 'shake', amp: 6, dur: 0.4 },
                { do: 'fade', id: 'logo', alpha: 0, dur: 0.6 },
                { do: 'wait', dur: 0.8 },
                // la torre recupera las letras BARKS
                { do: 'bg', id: 'torre_libre', fade: 1.6 },
                { do: 'remove', id: 'logo' },
                { do: 'wait', dur: 3 }
            ]
        },
        {
            id: 'amanece', steps: [
                { do: 'clear' },
                { do: 'bg', id: 'skyline_sindicato', fade: 0.6 },
                { do: 'camera', x: 480, y: 270, zoom: 1 },
                // el dorado retrocede hacia la torre: el barrido del prólogo, al revés
                { do: 'fx', type: 'wipe', to: 'skyline_amanecer', cx: 640, cy: 230, dur: 6 },
                { do: 'wait', dur: 2.5 },
                { do: 'narrate', text: 'Después de meses, Barks City volvió a ver el sol.', auto: 4.5 },
                { do: 'wait', dur: 2 }
            ]
        },
        {
            id: 'la_plaza', steps: [
                { do: 'clear' },
                { do: 'bg', id: 'plaza_sindicato', fade: 0.4 },
                { do: 'camera', x: 520, y: 300, zoom: 1.1 },
                { do: 'actor', id: 'puesto', sprite: 'puesto_cerrado', x: 380, y: 512 },
                { do: 'wait', dur: 1 },
                // suben las persianas (de abajo arriba, local a local) y se encienden los letreros
                { do: 'fx', type: 'wipe', mode: 'shutters', to: 'plaza_libre', dur: 2.2 },
                { do: 'sfx', name: 'shutter' },
                { do: 'sfx', name: 'shutter', delay: 0.5 },
                { do: 'sfx', name: 'shutter', delay: 1.0 },
                { do: 'wait', dur: 2.2 },
                { do: 'fx', type: 'flash', color: '#FFF3C4', dur: 0.12 },
                { do: 'sfx', name: 'lightsOn' },
                { do: 'wait', dur: 0.6 },
                { do: 'actor', id: 'madre', sprite: 'madre', x: 470, y: 512 },
                { do: 'actor', id: 'hijo', frames: ['hijo_a', 'hijo_b'], fps: 6, x: 520, y: 512 },
                { do: 'actor', id: 'pedro', sprite: 'pedro_libre', x: 1020, y: 512, flip: true },
                { do: 'move', id: 'pedro', x: 700, dur: 3 },
                { do: 'wait', dur: 1.5 },
                { do: 'say', who: 'hijo', name: 'NIÑO', color: C_FINAL.nino, portrait: 'busto_nino', text: '¡Papá!' },
                { do: 'move', id: 'hijo', x: 670, dur: 0.9, ease: 'out' },
                { do: 'move', id: 'madre', x: 640, dur: 1.4 },
                { do: 'wait', dur: 1 },
                // se abrazan y la madre se une
                { do: 'remove', id: 'hijo' },
                { do: 'remove', id: 'madre' },
                { do: 'actor', id: 'pedro', sprite: 'abrazo', x: 690, y: 512 },
                { do: 'fx', type: 'hearts', x: 690, y: 380, dur: 2.5 },
                // el vendedor llega y abre su puesto
                { do: 'actor', id: 'vendedor', frames: ['vecino1_a', 'vecino1_b'], fps: 3, x: -60, y: 512 },
                { do: 'move', id: 'vendedor', x: 290, dur: 3.4 },
                { do: 'wait', dur: 3.4 },
                { do: 'actor', id: 'vendedor', sprite: 'vecino1_a' },
                { do: 'sfx', name: 'shutter' },
                { do: 'pose', id: 'puesto', sprite: 'puesto_abierto' },
                { do: 'wait', dur: 2.4 }
            ]
        },
        {
            id: 'bajo_el_arbol', steps: [
                { do: 'clear' },
                { do: 'bg', id: 'plaza_libre' },
                { do: 'camera', x: 300, y: 350, zoom: 1.5 },
                { do: 'actor', id: 'd', sprite: 'desconocido', x: 250, y: 516 },
                { do: 'actor', id: 'hijo', frames: ['hijo_a', 'hijo_b'], fps: 4, x: 520, y: 512, flip: true },
                { do: 'move', id: 'hijo', x: 340, dur: 2.4 },
                { do: 'wait', dur: 2.4 },
                { do: 'actor', id: 'hijo', sprite: 'hijo', flip: true },
                { do: 'say', who: 'hijo', name: 'NIÑO', color: C_FINAL.nino, portrait: 'busto_nino', text: 'Mi papá dice que su paleta nunca había jugado tan bien.' },
                { do: 'actor', id: 'paleta', sprite: 'paleta_nino', x: 270, y: 440, s: 1.2 },
                { do: 'say', who: 'd', name: '¿¿??', color: 'theme', portrait: 'desconocido', text: 'Quédatela. Ya cumplió.' },
                { do: 'move', id: 'paleta', x: 330, y: 452, dur: 0.8, ease: 'inOut' },
                { do: 'sfx', name: 'paddleTake', delay: 0.8 },
                { do: 'wait', dur: 1.4 },
                { do: 'remove', id: 'paleta' },
                { do: 'wait', dur: 1.5 }
            ]
        },
        {
            id: 'creditos_falsos', steps: [
                { do: 'clear' },
                { do: 'bg', id: 'negro', fade: 1.2 },
                // créditos que parecen los de verdad… hasta el tercer nombre
                // breakAt: el número de nombre (contando solo las entradas con name) donde se rompe
                { do: 'fx', type: 'credits', mode: 'falso', breakAt: 3, corrupt: 'HACHEPE CHEMI', lines: [
                    { big: 'PONG GAME' },
                    { small: 'Una historia de Barks City' },
                    { title: 'REPARTO' },
                    { name: 'EL DESCONOCIDO', role: '¿¿??', bust: 'desconocido', theme: true },
                    { name: 'PEDRO', role: 'El padre', bust: 'pedro' },
                    { name: 'HACHEPE CHEMI', role: 'The Black', bust: 'chemi' },
                    { name: 'HACHEPE DANI', role: 'Grow Partner', bust: 'dani' }
                ] },
                { do: 'wait', dur: 16 },
                { do: 'fx', type: 'glitch', dur: 0.6 },
                { do: 'fx', type: 'crt_off', dur: 0.8 },
                { do: 'wait', dur: 2 }
            ]
        }
    ]
};

// ================================================ introducción del Creador
/** @type {Cutscene} */
const CREADOR_INTRO = {
    id: 'creador_intro',
    assets: 'PROLOGO_ASSETS',
    noSkipFirstTime: true,
    scenes: [
        {
            id: 'el_cursor', steps: [
                { do: 'bg', id: 'negro' },
                { do: 'fx', type: 'console', lines: ['¿De verdad creíste que eso era el final?'], cps: 14, hold: 1.5 }
            ]
        },
        {
            id: 'el_reinicio', steps: [
                { do: 'fx', type: 'console', clear: true, cps: 60, hold: 1, lines: [
                    'barks_city.exe ........ OK',
                    'cargando hachepes ..... 5/5 DERROTADOS',
                    'protagonista .......... NO AUTORIZADO',
                    'iniciando protocolo: CREADOR'
                ] },
                { do: 'sfx', name: 'glitch' },
                { do: 'fx', type: 'glitch', dur: 0.5 }
            ]
        },
        {
            id: 'el_menu_roto', steps: [
                { do: 'fx', type: 'fake_menu', dur: 10 },
                { do: 'wait', dur: 3 },
                { do: 'say', who: 'creador', name: '', style: 'creator', text: 'Hola.' },
                { do: 'say', who: 'creador', name: '', style: 'creator', text: 'No, él no. Tú.' },
                { do: 'say', who: 'creador', name: '', style: 'creator', text: 'El que tiene {dispositivo}.' },
                { do: 'say', who: 'creador', name: '', style: 'creator',
                  text: 'Llevas {partidas} partidas, {monedas} Chemi Coins y nivel {nivel}. Te he visto jugar cada una.' },
                { do: 'say', who: 'creador', name: '', style: 'creator', text: '¿Nunca te preguntaste por qué las monedas se llaman Chemi Coins?' }
            ]
        },
        {
            id: 'chemi', steps: [
                { do: 'fx', type: 'fake_menu', off: true },
                { do: 'bg', id: 'negro' },
                { do: 'fx', type: 'bust_glitch', bust: 'chemi', rays: true, dur: 26 },
                { do: 'wait', dur: 1.2 },
                { do: 'say', who: 'chemi', name: 'CHEMI', color: C_HP.chemi, portrait: 'busto_chemi', glitch: true, text: 'No me reconoces, ¿verdad?' },
                { do: 'say', who: 'chemi', name: 'CHEMI', color: C_HP.chemi, portrait: 'busto_chemi', glitch: true, text: 'Fui el primero al que venciste. El de la recepción. El que nadie pasaba.' },
                { do: 'say', who: 'chemi', name: 'CHEMI', color: C_HP.chemi, portrait: 'busto_chemi', glitch: true, text: 'Nadie pasaba porque yo no quería. A ti… te dejé pasar.' },
                { do: 'say', who: 'chemi', name: 'CHEMI', color: C_HP.chemi, portrait: 'busto_chemi', glitch: true,
                  text: 'Yo escribí esta ciudad. A los Hachepes. A Yisus. La paleta de Pedro. Y a ti.' }
            ]
        },
        {
            id: 'yo_soy_el_creador', steps: [
                { do: 'fx', type: 'bust_glitch', off: true },
                { do: 'sfx', name: 'heartbeat' },
                { do: 'fx', type: 'console', clear: true, center: true, cps: 6, hold: 1.2, lines: ['Después de todo…'] },
                { do: 'fx', type: 'reveal', text: 'YO SOY EL CREADOR', image: 'assets/campaign/final/creador_original.png', imageMs: 500 },
                { do: 'sfx', name: 'creatorReveal' },
                { do: 'wait', dur: 0.7 },
                { do: 'bg', id: 'negro' },
                { do: 'actor', id: 'creador', sprite: 'creador', x: 480, y: 500, s: 1.3 },
                { do: 'fx', type: 'lightning', dur: 0.4 },
                { do: 'fx', type: 'crack', dur: 2 },
                { do: 'wait', dur: 2.6 }
            ]
        },
        {
            id: 'la_ventana', steps: [
                { do: 'fx', type: 'error_window', title: 'pong_game', body: 'pong_game ha dejado de responder.',
                  buttons: [{ label: 'Esperar', reply: 'Buena elección.' }, { label: 'Cerrar', reply: 'No puedes cerrar esto.', shake: true }] },
                { do: 'wait', dur: 0.4 }
            ]
        }
    ]
};

// ======================================================= final verdadero
/** @type {Cutscene} */
const FINAL_VERDADERO = {
    id: 'final_verdadero',
    assets: 'PROLOGO_ASSETS',
    // La guía (F.7): solo se salta al repetir al Creador ya vencido (los
    // créditos, siempre, manteniendo pulsado)
    noSkipFirstTime: true,
    scenes: [
        {
            id: 'ultimas_palabras', steps: [
                { do: 'bg', id: 'blanco' },
                { do: 'fx', type: 'console', dark: true, center: true, cps: 12, hold: 1.4, lines: [
                    'Interesante.', 'La creación venció al creador.', 'Quizá esta ciudad ya no me necesita.', 'Cuídala por mí.'
                ] },
                { do: 'music', track: 'final_verdadero', loop: false, fade: 2 }
            ]
        },
        {
            id: 'nuevo_reparto', steps: [
                // La recepción · Chemi
                { do: 'bg', id: 'recepcion', fade: 1.5 },
                { do: 'camera', x: 640, y: 330, zoom: 1.3 },
                { do: 'actor', id: 'chemi', sprite: 'chemi_sonrie', x: 640, y: 472 },
                { do: 'actor', id: 'mostrador', sprite: 'mostrador', x: 640, y: 502 },
                { do: 'wait', dur: 1.6 },
                { do: 'say', who: 'chemi', name: 'CHEMI', color: C_HP.chemi, portrait: 'busto_chemi', text: '¿Tiene cita? …Es broma. Pase, pase.', auto: 3.5 },
                // El Café Guau · Dani
                { do: 'clear' },
                { do: 'bg', id: 'cafe_guau', fade: 0.4 },
                { do: 'camera', x: 600, y: 330, zoom: 1.35 },
                { do: 'actor', id: 'barista', sprite: 'barista', x: 650, y: 418, s: 1.1 },
                { do: 'actor', id: 'mostrador', sprite: 'mostrador_cafe', x: 760, y: 440 },
                { do: 'actor', id: 'dani', sprite: 'dani_paga', x: 470, y: 470 },
                { do: 'wait', dur: 0.6 },
                { do: 'sfx', name: 'cashCounter' },
                { do: 'say', who: 'dani', name: 'DANI', color: C_HP.dani, portrait: 'busto_dani', text: 'Un café, por favor. Y aquí tiene. Pago yo.', auto: 3.5 },
                // El Arcade · Mario y Valen
                { do: 'clear' },
                { do: 'bg', id: 'sala_juegos', fade: 0.4 },
                { do: 'camera', x: 470, y: 320, zoom: 1.2 },
                { do: 'actor', id: 'mario', sprite: 'mario_ataque', x: 360, y: 512 },
                { do: 'actor', id: 'valen', sprite: 'valen', x: 560, y: 512, flip: true },
                { do: 'actor', id: 'nino1', sprite: 'nino_vecino_a', x: 440, y: 512 },
                { do: 'actor', id: 'nino2', sprite: 'hijo', x: 640, y: 512, flip: true },
                { do: 'say', who: 'valen', name: 'VALEN', color: C_HP.valen, portrait: 'busto_valen', text: 'DINDINDIN.', auto: 2 },
                { do: 'say', who: 'mario', name: 'MARIO', color: C_HP.mario, portrait: 'busto_mario', text: '¡Revancha!', auto: 2 },
                // Barks Radio · Fano y Chayipiti
                { do: 'clear' },
                { do: 'bg', id: 'radio_sindicato', fade: 0.4 },
                { do: 'camera', x: 480, y: 290, zoom: 1.15 },
                { do: 'actor', id: 'chayipiti', sprite: 'chayipiti_pantalla', x: 800, y: 440 },
                { do: 'actor', id: 'fano', sprite: 'fano', x: 600, y: 470 },
                { do: 'fx', type: 'wipe', to: 'radio_libre', cx: 40, cy: 300, dur: 2.5 },
                { do: 'sfx', name: 'lightsOn' },
                { do: 'wait', dur: 1.5 },
                { do: 'say', who: 'fano', name: 'FANO', color: C_HP.fano, portrait: 'busto_fano', text: 'Noooo bro, qué bonito se ve.', auto: 3 },
                { do: 'say', who: 'chayipiti', name: 'CHAYIPITI', color: C_CHAYIPITI, portrait: 'busto_chayipiti', radio: true, text: 'Predicción: un buen día.', auto: 3 },
                // El estudio · Yisus
                { do: 'clear' },
                { do: 'bg', id: 'estudio', fade: 0.4 },
                { do: 'camera', x: 480, y: 320, zoom: 1.1 },
                { do: 'actor', id: 'yisus', sprite: 'yisus_cascos', x: 180, y: 470 },
                { do: 'actor', id: 'mariangel', sprite: 'mariangel', x: 780, y: 470, flip: true },
                { do: 'actor', id: 'sofa', sprite: 'sofa', x: 780, y: 500 },
                { do: 'sfx', name: 'yisusSings' },
                { do: 'wait', dur: 1.8 },
                { do: 'say', who: 'mariangel', name: 'MARIANGEL', color: C_FINAL.mariangel, portrait: 'busto_mariangel', text: 'Ji, Ji, Ji, Ji.', auto: 2.5 }
            ]
        },
        {
            id: 'nadie_sabe_tu_nombre', steps: [
                { do: 'clear' },
                { do: 'bg', id: 'plaza_atardecer', fade: 1 },
                { do: 'camera', x: 360, y: 330, zoom: 1.35 },
                { do: 'actor', id: 'd', sprite: 'desconocido', x: 250, y: 516 },
                { do: 'actor', id: 'hijo', sprite: 'hijo', x: 330, y: 512, flip: true },
                { do: 'actor', id: 'pedro', sprite: 'pedro_libre', x: 400, y: 512, flip: true },
                { do: 'actor', id: 'madre', sprite: 'madre', x: 450, y: 512, flip: true },
                { do: 'wait', dur: 1.5 },
                { do: 'say', who: 'hijo', name: 'NIÑO', color: C_FINAL.nino, portrait: 'busto_nino', text: 'Oye… nunca nos dijiste cómo te llamas.' },
                { do: 'narrate', text: 'Nadie sabe tu nombre…', auto: 3 },
                { do: 'fx', type: 'name_box', placeholder: 'Escribe tu nombre', breakAfter: 2 },
                { do: 'fx', type: 'glitch', dur: 0.8 },
                { do: 'sfx', name: 'creatorReveal' },
                { do: 'fx', type: 'big_text', text: 'Nadie sabe tu nombre…', sub: 'tú tampoco lo necesitas.', dur: 4.5 },
                { do: 'wait', dur: 4.5 },
                // se da la vuelta y se va hacia el atardecer
                { do: 'actor', id: 'd', frames: ['desconocido_espalda', 'desconocido_espalda'], fps: 2 },
                { do: 'fx', type: 'scarf_gust', actor: 'd', dur: 3 },
                { do: 'move', id: 'd', x: 1100, dur: 7 },
                { do: 'camera', x: 480, y: 300, zoom: 1, dur: 6, ease: 'inOut' },
                { do: 'wait', dur: 5 },
                { do: 'fx', type: 'veil', color: '#000000', alpha: 1, dur: 2 },
                { do: 'wait', dur: 2 }
            ]
        },
        {
            id: 'creditos', steps: [
                { do: 'clear' },
                { do: 'bg', id: 'negro' },
                { do: 'fx', type: 'credits', mode: 'verdadero', lines: 'CREDITOS' }
            ]
        },
        {
            id: 'despues', steps: [
                { do: 'bg', id: 'negro' },
                { do: 'wait', dur: 1.5 },
                { do: 'sfx', name: 'elevatorDing' },
                { do: 'wait', dur: 1.2 },
                { do: 'say', who: 'chemi', name: 'CHEMI', color: C_HP.chemi, text: '…¿Tiene cita?', auto: 2.5 },
                { do: 'wait', dur: 0.8 }
            ]
        }
    ]
};

/** Los créditos verdaderos. `bust` = clave de CAMPAIGN_ART.bustos. */
const CREDITOS = [
    { big: 'PONG GAME', small: 'Edición Arcade' },
    { gap: true },
    { title: 'REPARTO' },
    { name: 'El Desconocido', role: '¿¿??', bust: 'desconocido', theme: true },
    { name: 'Hachepe Chemi', role: 'The Black', bust: 'chemi' },
    { name: 'Hachepe Dani', role: 'Grow Partner', bust: 'dani' },
    { name: 'Hachepe Mario', role: 'El Diablo Rojo', bust: 'mario' },
    { name: 'Hachepe Valen', role: 'El Relajado', bust: 'valen' },
    { name: 'Hachepe Fano', role: 'El fan del coco', bust: 'fano' },
    { name: 'Chayipiti', role: 'Asistente de Fano', bust: 'chayipiti' },
    { name: 'Hachepe Yisus', role: 'El Aura', bust: 'yisus' },
    { name: 'Mariangel', role: 'Ji, Ji, Ji, Ji', bust: 'mariangel' },
    { name: 'Pedro', role: 'El padre', bust: 'pedro' },
    { name: 'El niño', role: 'El que dio la paleta', bust: 'nino' },
    { name: 'La madre', role: 'Barks City', bust: 'madre' },
    { name: 'El alcalde', role: 'Nadie le anotó un punto', bust: 'alcalde' },
    { name: 'El Creador', role: '???', bust: 'chemi', wink: true },
    { gap: true },
    { title: 'CREADO POR' },
    { name: 'alguien aburrido en casa' },
    { gap: true },
    { big: 'Gracias por jugar.' }
];
