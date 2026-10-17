/**
 * data/mechanics.js
 * ------------------------------------------------------------------
 * Números de las mecánicas de golpe: inercia de la paleta, zonas de la
 * paleta, efecto, smash, súper golpe, energía, sensación (hit-stop,
 * vibración de pantalla y del móvil), fiebre del rally y lo que hace la
 * CPU con todo ello. Todo se ajusta aquí; el código no repite ninguno
 * de estos valores como literal.
 *
 * Velocidades en px por fotograma a 60 FPS; tiempos en ms.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Plan de la CPU por dificultad (VS CPU) y en el Modo Hachepe.
 * @typedef {object} CpuPlanTuning
 * @property {number} spin      probabilidad de dar efecto al devolver
 * @property {number} smash     probabilidad de intentar un smash
 * @property {number} useSuper  probabilidad de usar el súper si está listo
 * @property {number|null} aim  desvío máximo (px) al apuntar al centro de la paleta; null = no apunta
 * @property {number} read      peso del efecto de la bola en su predicción (0 = lo ignora)
 */

const MECH = {
    // Paleta con inercia (teclado): fracción por fotograma hacia la velocidad objetivo
    accelK: 0.33,          // ~6 fotogramas hasta el 90 % de la velocidad máxima
    decelK: 0.45,          // ~4 fotogramas para frenar
    pointerMaxVy: 14,      // px/fotograma: tope de la velocidad medida con dedo o ratón
    // Zonas de la paleta (collidePoint de -1 a 1)
    centerZone: 0.16,      // |c| <= 0.16 → golpe perfecto (±8 px en la paleta de 100)
    edgeZone: 0.80,        // |c| >= 0.80 → roce de esquina
    baseAngle: Math.PI / 4,
    edgeAngle: Math.PI / 3,     // hasta 60° en el roce
    // Arena rotada del Creador: conserva sus 60° de siempre (hay que apuntar
    // a los huecos del blindaje) y el roce llega a 70°
    rotatedBaseAngle: Math.PI / 3,
    rotatedEdgeAngle: Math.PI * 7 / 18,
    edgeSpeedK: 0.85,           // el roce sale más lento
    // Bloqueo: paleta quieta
    blockVy: 0.6,               // |vy| por debajo de esto = quieta
    blockSpeedK: 0.78,
    // Efecto
    spinMinV: 0.35,             // velocidad normalizada mínima para dar efecto
    spinK: 0.9,
    spinAccel: 0.12,            // px/fotograma² que añade a dy con efecto 1
    spinDecay: 0.985,           // por fotograma
    spinWallK: -0.5,            // al rebotar en la pared, el efecto se invierte a medias
    spinMaxSlope: 0.95,         // |dy| nunca pasa de este factor de la velocidad
    spinSoundMin: 0.3,          // a partir de aquí suena (y cuenta) como golpe con efecto
    // Golpe perfecto
    perfectBonus: 1.0,          // velocidad extra (además del +0.5 de siempre)
    // Smash
    smashChargeMs: 700, smashSlowK: 0.6, smashWindowMs: 180, smashMinCharge: 0.5,
    smashSpeedK: 0.4, smashAngleK: 0.35, smashCapK: 1.15,
    // Súper golpe
    superMinCharge: 0.3, superSpeedK: 1.55, superCapK: 1.3, superAngleK: 0.25,
    // Energía (0–100)
    energy: { max: 100, hit: 6, perfect: 15, smash: 10, rally10: 10, feverK: 2 },
    // Sensación
    hitStopMs: { perfect: 33, smash: 50, super: 83 },
    shake: { perfect: [5, 110], smash: [7, 150], super: [10, 240] },
    vibrate: { perfect: 15, smash: 25, super: 40 },
    // Fiebre del rally
    feverRally: 25, feverMaxSpeedK: 1.1, feverFadeMs: 500,
    // Aviso de súper listo (HUD)
    superHintMs: 2500,
    // CPU (VS CPU y Hachepe; los jefes de campaña no planifican)
    cpu: {
        /** @type {Record<number, CpuPlanTuning>} */
        byDifficulty: {
            1: { spin: 0.10, smash: 0,    useSuper: 0.3, aim: null, read: 0 },
            2: { spin: 0.35, smash: 0.15, useSuper: 0.7, aim: 25,   read: 0.5 },
            3: { spin: 0.60, smash: 0.35, useSuper: 1,   aim: 8,    read: 1 }
        },
        /** @type {CpuPlanTuning} */
        hachepe: { spin: 0.60, smash: 0.50, useSuper: 1, aim: 10, read: 1 },
        spinFrames: 6,          // fotogramas antes del contacto en los que mueve la paleta para dar efecto
        spinMaxContact: 0.7,    // al barrer, la bola no debe caer más allá de esta fracción de media paleta
        smashRange: 220,        // px: empieza a cargar cuando la bola está más cerca que esto...
        smashLeadMs: 650,       // ...o cuando falta esto para el contacto: con bolas rápidas, 220 px no dan tiempo a cargar
        smashReleaseMs: 120     // suelta cuando falta esto para el contacto
    }
};
