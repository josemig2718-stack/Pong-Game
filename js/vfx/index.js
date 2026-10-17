/**
 * vfx/index.js
 * ------------------------------------------------------------------
 * Efectos visuales cosméticos: lo que compra el jugador en la tienda.
 *
 *   random.js       vfxRandom: el azar de los efectos (nunca Math.random)
 *   trails.js       estelas de la bola
 *   backgrounds.js  fondos animados (los únicos con estado propio)
 *   paddles.js      estilos de paleta
 *   goal-fx.js      efectos de gol
 *   super.js        aura y estallido del súper golpe
 *   mechanics.js    lo que se ve de las mecánicas de golpe (perfecto,
 *                   smash, efecto, carga, fiebre)
 *
 * Cada archivo tiene una tabla id → renderizador. Añadir un cosmético es
 * añadir su renderizador a la tabla, su entrada en data/shop.js con el
 * mismo `id` y su icono SVG en assets/shop/. Los renderizadores leen lo
 * equipado (playerProgression.selected*) en cada fotograma.
 *
 * Este archivo solo agrupa lo que game/ llama cada partida y cada
 * fotograma.
 * ------------------------------------------------------------------
 */

'use strict';

/** Prepara los efectos al empezar una partida. */
function initVFX() {
    initBackground();
    resetGoalVFX();
    clearMechFX();
}

/** Vacía los efectos de la partida al abandonarla: los de gol, los de las mecánicas y los estallidos de los power-ups. */
function resetVFX() {
    resetGoalVFX();
    clearPowerupBursts();
    clearMechFX();
}

/** Avanza los efectos con estado: el fondo, el efecto de gol, los estallidos de los power-ups y los de las mecánicas. */
function updateVFX(dt) {
    updateBackground(dt);
    updateGoalVFX(dt);
    updatePowerupBursts(dt);
    MECH_FX.update(dt);
}
