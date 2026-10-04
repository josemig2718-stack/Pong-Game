/**
 * data/lore.js
 * ------------------------------------------------------------------
 * La historia de la campaña: los seis Hachepes (nombre, retrato,
 * peligro y diálogos) y el texto de la intro. Las mecánicas de cada
 * combate están en bosses/.
 * ------------------------------------------------------------------
 */

/** Niveles con significado propio en la campaña. */
export const CAMPAIGN_LAST_BOSS = 5;   // últimos Hachepes "normales"
export const CAMPAIGN_CREATOR = 6;     // nivel secreto

/**
 * Los seis Hachepes. Los diálogos aceptan strings (habla el jefe) u
 * objetos { t, s } donde `s` elige el avatar ('a' o 'b') — lo usa el dúo.
 */
export const HACHEPES_LORE = {
    1: {
        name: 'Hachepe Chemi',
        title: 'El Guardián de la Frontera',
        image: 'assets/images/hachepe_chemi.png',
        danger: '⭐⭐',
        desc: 'Vigila los escombros de tu antiguo barrio.',
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
        name: 'Hachepe Dani',
        title: 'El Arquitecto del Caos',
        image: 'assets/images/hachepe_dani.png',
        danger: '⭐⭐⭐',
        desc: 'Diseñó las murallas que encierran tu ciudad.',
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
        name: 'Mario y Valentín',
        title: 'El Dúo Letal',
        image: 'assets/images/hachepe_mario.png',
        image2: 'assets/images/hachepe_valen.png',
        danger: '⭐⭐⭐⭐',
        desc: 'Los que se llevaron a tu familia. Nunca vienen solos.',
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
        name: 'Hachepe Fano',
        title: 'El Guardián de las Sombras',
        image: 'assets/images/hachepe_fano.png',
        danger: '⭐⭐⭐⭐',
        desc: 'Apagó las luces de la ciudad y nunca las devolvió.',
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
        name: 'Hachepe Yisus',
        title: 'El Falso Rey',
        image: 'assets/images/hachepe_yisus.png',
        danger: '⭐⭐⭐⭐⭐',
        desc: 'Se coronó sobre las ruinas. El último tirano.',
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
        name: 'El Creador',
        title: '¿?¿?¿?',
        image: 'assets/images/hachepe_chemi.png',
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

/** Texto de la intro narrativa. */
export const CAMPAIGN_INTRO_TEXT =
    'Los Hachepes llegaron sin avisar. Un sindicato de tiranos que quemó tu ciudad, ' +
    'derribó tu casa y esclavizó a todos los que conocías.\n\n' +
    'Montaron sobre las ruinas un torneo enfermo donde perder significa desaparecer.\n\n' +
    'No tienes nombre. No tienes nada. Por eso nadie te vio venir.';
