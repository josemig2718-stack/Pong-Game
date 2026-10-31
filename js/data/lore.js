/**
 * data/lore.js
 * ------------------------------------------------------------------
 * La historia de la campaña: los seis Hachepes (nombre, retrato,
 * peligro y diálogos). Las mecánicas de cada combate están en bosses/;
 * el prólogo, en data/cutscenes/.
 * ------------------------------------------------------------------
 */

'use strict';

/** Niveles con significado propio en la campaña. */
const CAMPAIGN_LAST_BOSS = 5;   // últimos Hachepes "normales"
const CAMPAIGN_CREATOR = 6;     // nivel secreto

/**
 * Los seis Hachepes. Los diálogos aceptan strings (habla el jefe) u
 * objetos { t, s } donde `s` elige el avatar ('a' o 'b') — lo usa el dúo.
 *
 * `floor` y `room` son su piso en la Torre Hachepe (campaign/menu.js) y
 * `bust` (y `bust2`) su busto en CAMPAIGN_ART.bustos. `title` es su
 * alias, el de su tarjeta en el prólogo; `image` (e `image2`), el busto
 * que se ve en la pantalla VS, el diálogo, el HUD y el fin de combate.
 * El Creador usa el de Chemi: es él (el giro).
 */
const HACHEPES_LORE = {
    1: {
        floor: 'PB', room: 'Recepción', bust: 'chemi',
        name: 'Hachepe Chemi',
        title: 'The Black',
        image: 'assets/campaign/bustos/chemi.webp',
        danger: '⭐⭐',
        desc: 'Lleva la recepción de la Torre Hachepe. Nadie sube sin pasar por su registro, y nadie pasa su registro.',
        dialogues: {
            start: [
                'Vaya. Un superviviente.',
                'Este montón de escombros era tu casa, ¿verdad?',
                'Yo mismo la tiré. Y no recuerdo tu cara.'
            ],
            mid: ['¿Ves? Nadie se levanta dos veces.'],
            win: ['Vuelve al polvo, don nadie.'],
            lose: ['¿Cómo...? ¡Solo eras basura!']
        }
    },
    2: {
        floor: '1', room: 'Contaduría', bust: 'dani',
        name: 'Hachepe Dani',
        title: 'Grow Partner',
        image: 'assets/campaign/bustos/dani.webp',
        danger: '⭐⭐⭐',
        desc: 'El contador del Sindicato. Cada cuota de Barks City termina en su oficina, y cada partida contra él tiene precio.',
        dialogues: {
            start: [
                'Yo dibujé estas calles. Yo dibujé estos muros.',
                'Cada esquina donde se esconde tu gente la puse yo.',
                'Tus movimientos son tan predecibles como un plano.'
            ],
            mid: ['¡Mis cálculos no fallan!'],
            win: ['Estructura defectuosa. Demolida.'],
            lose: ['¡Imposible! ¡Estaba todo calculado!']
        }
    },
    3: {
        floor: '2', room: 'Sala de juegos', bust: 'mario', bust2: 'valen',
        name: 'Mario y Valentín',
        title: 'El Diablo Rojo y El Relajado',
        image: 'assets/campaign/bustos/mario.webp',
        image2: 'assets/campaign/bustos/valen.webp',
        danger: '⭐⭐⭐⭐',
        desc: 'El arcade que le quitaron a la ciudad es ahora su sala. Uno juega como un diablo y el otro ni se despeina. Nunca juegan solos.',
        dialogues: {
            start: [
                { t: 'Mira, Valen. Otro que quiere su ciudad de vuelta.', s: 'a' },
                { t: 'Siempre vienen solos, Mario. Nosotros nunca.', s: 'b' },
                { t: 'Esa es toda la diferencia.', s: 'a' }
            ],
            mid: [
                { t: '¡Por arriba!', s: 'b' },
                { t: '¡Y por abajo!', s: 'a' }
            ],
            win: [
                { t: 'Otro nombre para la lista.', s: 'a' },
                { t: 'Ni siquiera tenía nombre.', s: 'b' }
            ],
            lose: [
                { t: 'Valen... nos ha ganado.', s: 'a' },
                { t: 'A los dos, Mario. A los dos.', s: 'b' }
            ]
        }
    },
    4: {
        floor: '3', room: 'Sala de control', bust: 'fano',
        name: 'Hachepe Fano',
        title: 'El fan del coco',
        image: 'assets/campaign/bustos/fano.webp',
        danger: '⭐⭐⭐⭐',
        desc: 'Desde aquí controla las luces, la radio y a Chayipiti. Él decidió que la ciudad viviera a oscuras.',
        dialogues: {
            start: [
                'Yo apagué las farolas. Yo apagué las casas.',
                'Tu gente aprendió a vivir a oscuras por mi culpa.',
                '¿De verdad crees que puedes ver algo aquí?'
            ],
            mid: ['Lo que persigues no está ahí.'],
            win: ['Te perdiste, como todos.'],
            lose: ['No... ¡me has visto!']
        }
    },
    5: {
        floor: '4', room: 'El trono', bust: 'yisus',
        name: 'Hachepe Yisus',
        title: 'El Aura',
        image: 'assets/campaign/bustos/yisus.webp',
        danger: '⭐⭐⭐⭐⭐',
        desc: 'Ganó la ciudad en una sola partida y gobierna desde el último piso. Nadie le ha anotado un punto.',
        dialogues: {
            start: [
                'Así que has llegado hasta mi trono.',
                'Los otros cuatro eran mis manos. Yo di la orden.',
                'Yo ordené quemar tu ciudad. Yo. ¿Y ahora qué?'
            ],
            mid: ['¡Tu tiempo me pertenece!'],
            win: ['Nadie destrona a un rey.'],
            lose: ['Un rey... derrotado por nadie...']
        }
    },
    6: {
        floor: 'S', room: 'Sótano', bust: 'chemi',
        name: 'El Creador',
        title: '¿?¿?¿?',
        image: 'assets/campaign/bustos/chemi.webp',
        danger: 'ERROR',
        desc: '???',
        dialogues: {
            start: [
                'No me reconoces, ¿verdad?',
                'Fui el primero al que venciste.',
                'Tenía que ver de cerca a mi creación.'
            ],
            mid: ['¡MI CÓDIGO ES LEY!'],
            win: ['FIN DE LA SIMULACIÓN.'],
            lose: ['Esto... no estaba escrito...']
        }
    }
};
