/**
 * vfx/index.js
 * ------------------------------------------------------------------
 * Efectos visuales cosméticos: lo que compra el jugador en la tienda.
 *
 *   trails.js       estelas de la bola
 *   backgrounds.js  fondos animados (los únicos con estado propio)
 *   paddles.js      estilos de paleta
 *   goal-fx.js      efectos de gol
 *
 * Cada archivo tiene una tabla id → renderizador. Añadir un cosmético es
 * añadir su renderizador a la tabla, su entrada en data/shop.js con el
 * mismo `id` y su imagen en assets/shop/. Los renderizadores leen lo
 * equipado (playerProgression.selected*) en cada fotograma.
 *
 * Este archivo solo agrupa lo que game/ llama cada partida y cada
 * fotograma.
 * ------------------------------------------------------------------
 */

import { initBackground, updateBackground } from './backgrounds.js';
import { updateGoalVFX } from './goal-fx.js';

/** Prepara los efectos al empezar una partida. */
export function initVFX() {
    initBackground();
}

/** Avanza los efectos con estado: el fondo y el efecto de gol. */
export function updateVFX(dt) {
    updateBackground(dt);
    updateGoalVFX(dt);
}
