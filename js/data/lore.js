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
 * objetos { t, s, sfx, bust } donde `s` elige quién habla: 'a' o 'b' en
 * los jefes con `speakers` (el dúo; Fano y Chayipiti), 'player' el
 * Desconocido, 'hint' la pista del Creador (sin nombre); `sfx`, un sonido
 * de soundEffects al mostrar la línea, y `bust`, otro busto solo para esa
 * línea. Un string suelto lo dice el hablante 'a' (o el jefe, si no tiene
 * `speakers`). Las pullas (`taunts`) aceptan lo mismo.
 *
 * `speakers` (opcional): { a, b } con { name, bust, color, voice, paddle }.
 * El cuadro de diálogo pone su nombre, su busto y el borde de su color;
 * voice 'radio' le da aspecto de altavoz; paddle 'twin' saca sus pullas
 * junto a la pala gemela (si no, junto a p2).
 * Los jefes por fases añaden phase2/phase3 (al cambiar de fase) y taunts
 * (pullas por evento, bosses/phases.js).
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
        // { s: 'player' } habla el Desconocido; { sfx } suena al mostrar la línea.
        // creatorHint: la única pista del Creador, tras la primera victoria.
        dialogues: {
            start: [
                'Buenas. Bienvenido a la Torre Hachepe. ¿Tiene cita?',
                { t: 'Vengo a subir.', s: 'player' },
                'Ajá. Todos vienen a subir, mano. Nadie sube.',
                'Aquí abajo mando yo. Si me ganas, pasas. Si no, la puerta está detrás de ti.'
            ],
            phase2: ['Bueno, bueno. Pasaste el torniquete. Ahora, el control de seguridad.'],
            phase3: ['¿Te crees muy vivo, sapegato?', { t: '¡CÓDIGO NEGRO! ¡Cierren todo!', sfx: 'alarm' }],
            win: ['Pase usted… a la calle.', 'Sin cita no se sube. Vuelva otro día.'],
            lose: ['Mano… ¿me ganaste?', 'Yisus me va a matar.', 'Dale, sube. Pero arriba no son tan amables como yo.'],
            creatorHint: 'Qué raro… sentí que ya te conocía.',
            taunts: {
                playerMiss: ['Siguiente, por favor.', '¿Sin cita? Fuera.', 'Eso va al registro.'],
                bossMiss: ['Eso no estaba en el formulario.', 'Mano, qué ladilla.'],
                rally15: ['Chamo, ¿tú no te cansas?'],
                playerSmash: ['¡Epa! ¡Aquí no se grita!'],
                detector: ['¡Bip! Eso es contrabando.'],
                turnstile: ['¡Ey! Sin pase no se pasa.'],
                lastLife: ['Último aviso, pana.']
            }
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
                'Chemi te dejó entrar gratis. Aquí arriba todo tiene precio.',
                { t: 'Búscate una vida, enfermo.', s: 'player' },
                'Me encanta un cliente así.'
            ],
            phase2: ['Bueno, rompiste mis cuentas. Pero la deuda sigue creciendo… con intereses.'],
            phase3: ['¿Quieres lo que es de la ciudad? Está todo ahí dentro.', 'Pero la combinación… solo la sé yo.'],
            win: ['Cuenta saldada. Cerrada. Archivada.', 'Vuelve cuando tengas fondos.'],
            lose: ['No, no, no… ¡esto no cuadra!', 'Yisus me va a descontar esto del sueldo.', 'Sube, sube. Pero Mario y Valen no cobran. Ellos se divierten.'],
            taunts: {
                playerMiss: ['Anotado en tu cuenta.', '¡Facturamos!', 'Eso te va a costar.'],
                bossMiss: ['Pérdidas mínimas.', 'Eso lo deduzco de impuestos.'],
                rally15: ['Esto ya parece inversión a largo plazo.'],
                playerSmash: ['¡Cuidado con mis papeles!'],
                interest20: ['+20 %. Y subiendo.'],
                coin: ['¡Ey, esa moneda era mía!'],
                vaultOpen: ['¿Quién te dio la clave?'],
                lastLife: ['Último pago, pana.']
            }
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
        // Mario defiende arriba (p2) y Valen abajo (la gemela): sus pullas
        // salen junto a su pala.
        speakers: {
            a: { name: 'MARIO', bust: 'mario', color: '#E63946' },
            b: { name: 'VALEN', bust: 'valen', color: '#C98A4B', paddle: 'twin' }
        },
        dialogues: {
            start: [
                { t: '¿Tú eres el que le ganó a Chemi y a Dani?', s: 'a' },
                { t: 'Bro, a esos dos les gana cualquiera.', s: 'b' },
                { t: 'Aquí se juega dos contra uno. Reglas de la casa.', s: 'a' },
                { t: 'No recuerdo haberte preguntado.', s: 'player' }
            ],
            phase2: [
                { t: 'Bah, eso fue el tutorial. ¡Valen, enciende el pinball!', s: 'a' },
                { t: 'Ya voy, ya voy… DINDINDIN.', s: 'b' }
            ],
            phase3: [
                { t: '¡Se acabó el juego limpio! ¡MODO DIABLO!', s: 'a' },
                { t: 'Yo mejor me siento un ratico, bro…', s: 'b' }
            ],
            win: [
                { t: 'GG EZ. Vuelve cuando subas de nivel.', s: 'a' },
                { t: 'GG, bro. DINDINDIN.', s: 'b' }
            ],
            lose: [
                { t: '¡¿Qué?! ¡Esto está bugueado!', s: 'a' },
                { t: 'Nos ganó limpio, Mario. Acéptalo.', s: 'b' },
                { t: '…Fano te va a apagar las luces. Ya verás.', s: 'a' }
            ],
            taunts: {
                playerMiss: [{ t: '¡GG!', s: 'a' }, { t: 'Muy lento, novato.', s: 'a' }, { t: 'Tranqui, a todos les pasa.', s: 'b' }, { t: 'DINDINDINDIN.', s: 'b' }],
                bossMiss: [{ t: '¡Lag! ¡Fue lag!', s: 'a' }, { t: 'Uy, esa era mía, bro.', s: 'b' }, { t: 'DINDINDIN… uy.', s: 'b' }],
                rally15: [{ t: 'Bro, esto está bueno. DINDINDIN.', s: 'b' }],
                playerSmash: [{ t: '¡Eso no vale!', s: 'a' }],
                jackpot: [{ t: '¡TILT! ¡Valen, mueve la pala!', s: 'a' }],
                afk: [{ t: 'Espérate, bro, que está bueno el directo.', s: 'b' }, { t: '¡VALEN, SUELTA EL TELÉFONO!', s: 'a' }],
                lastLife: [{ t: 'Última vida. GAME OVER pronto.', s: 'a' }]
            }
        }
    },
    4: {
        floor: '3', room: 'Sala de control', bust: 'fano',
        name: 'Hachepe Fano',
        title: 'El fan del coco',
        image: 'assets/campaign/bustos/fano.webp',
        danger: '⭐⭐⭐⭐',
        desc: 'Desde aquí controla las luces, la radio y a Chayipiti. Él decidió que la ciudad viviera a oscuras.',
        // Chayipiti no tiene pala: sus pullas salen junto a la de Fano, con
        // su cara dentro, y su voz suena por altavoz.
        speakers: {
            a: { name: 'FANO', bust: 'fano', color: '#8B5CF6' },
            b: { name: 'CHAYIPITI', bust: 'chayipiti', color: '#A855F7', voice: 'radio' }
        },
        dialogues: {
            start: [
                { t: 'Noooo bro, ¿llegaste hasta aquí?', s: 'a' },
                { t: 'Las máquinas también se equivocan.', s: 'player' },
                { t: 'Chayipiti, apaga las luces.', s: 'a' }
            ],
            phase2: [
                { t: 'Bro, ¿cómo ves en la oscuridad?', s: 'a' },
                { t: 'Activando modo predicción. Ya sé a dónde vas a tirar.', s: 'b' }
            ],
            phase3: [
                { t: 'Advertencia: probabilidad de victoria de Fano, 12 %.', s: 'b' },
                { t: '¡Pues haz algo! ¡Clónalo todo!', s: 'a' }
            ],
            win: [
                { t: 'Noooo bro, ni te vi.', s: 'a' },
                { t: 'Victoria registrada. Como predije.', s: 'b' }
            ],
            lose: [
                { t: 'Noooo bro… ¿perdí?', s: 'a' },
                { t: 'Recalculando… recalculando…', s: 'b', bust: 'chayipiti_error' },
                { t: 'Yisus está arriba. Él no necesita luces para ganarte.', s: 'a' }
            ],
            taunts: {
                playerMiss: [{ t: 'Noooo bro, ¡qué fácil!', s: 'a' }, { t: 'Predicción confirmada.', s: 'b' }],
                bossMiss: [{ t: 'Error 404.', s: 'b' }, { t: '¡Chayipiti, haz tu trabajo!', s: 'a' }],
                rally15: [{ t: 'Este rally no estaba en mis datos.', s: 'b' }],
                playerSmash: [{ t: '¡Bro, cuidado con los monitores!', s: 'a' }],
                dark: [{ t: '¿Dónde está la bola, bro?', s: 'a' }],
                predictFail: [{ t: 'Predicción fallida. Recalibrando.', s: 'b' }],
                lastLife: [{ t: 'Probabilidad de que pierdas: 99 %.', s: 'b' }]
            }
        }
    },
    5: {
        floor: '4', room: 'El trono', bust: 'yisus',
        name: 'Hachepe Yisus',
        title: 'El Aura',
        image: 'assets/campaign/bustos/yisus.webp',
        danger: '⭐⭐⭐⭐⭐',
        desc: 'Ganó la ciudad en una sola partida y gobierna desde el último piso. Nadie le ha anotado un punto.',
        // Mariangel y Pedro hablan con él (y miran desde su marcador)
        speakers: {
            a: { name: 'YISUS', bust: 'yisus', color: '#FACC15' },
            b: { name: 'MARIANGEL', bust: 'mariangel', color: '#F472B6' },
            c: { name: 'PEDRO', bust: 'pedro', color: '#60A5FA' }
        },
        dialogues: {
            start: [
                { t: 'Una partida. Como con el alcalde. ¿Te acuerdas de cómo terminó?', s: 'a' },
                { t: 'Esta vez termina distinto.', s: 'player' }
            ],
            phase2: [
                { t: '¿Me anotaste? ¿A mí?', s: 'a' },
                { t: 'Ji… ji…', s: 'b' },
                { t: 'Muy bien. Entonces el tiempo… también es mío.', s: 'a' }
            ],
            phase3: [
                { t: '¡Pedro! ¡El ataúd!', s: 'a' },
                { t: '…No.', s: 'c' },
                { t: '¿Qué dijiste?', s: 'a' },
                { t: 'Que no. Ya no.', s: 'c' },
                { t: 'Lo haré yo mismo.', s: 'a' }
            ],
            phase4: [
                { t: '¡NADIE ME HA ANOTADO JAMÁS! ¡AURA MÁXIMA!', s: 'a' },
                { t: 'Ji, Ji… ¿Yisus?', s: 'b' }
            ],
            win: [
                { t: 'Nadie destrona al Aura.', s: 'a' },
                { t: 'Ji, Ji, Ji, Ji.', s: 'b' }
            ],
            // Se muestra al vencerlo; al cerrarse empieza el falso final
            lose: [
                { t: '¿Un punto…? ¿A mí…?', s: 'a' },
                { t: '…Ji.', s: 'b' },
                { t: 'Gracias, desconocido. Gracias.', s: 'c' }
            ],
            taunts: {
                playerMiss: [{ t: 'Así de fácil.', s: 'a' }, { t: 'Eso fue aura pura.', s: 'a' }, { t: 'Ji, Ji, Ji, Ji.', s: 'b' }],
                bossMiss: [{ t: '…Suerte.', s: 'a' }, { t: 'Mariangel, tú no viste eso.', s: 'a' }, { t: 'Ji…?', s: 'b' }],
                rally15: [{ t: '¿Todavía de pie?', s: 'a' }],
                playerSmash: [{ t: '¿Eso es todo tu poder?', s: 'a' }],
                auraBreak: [{ t: '¡Mi aura!', s: 'a' }],
                timeStop: [{ t: 'Tu tiempo me pertenece.', s: 'a' }],
                coffin: [{ t: 'Ahí tienes compañía.', s: 'a' }],
                lastLife: [{ t: 'Arrodíllate.', s: 'a' }]
            }
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
