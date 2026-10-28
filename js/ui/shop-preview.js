/**
 * ui/shop-preview.js
 * ------------------------------------------------------------------
 * Vista previa animada de la tienda: un lienzo pequeño (400×300) donde
 * el artículo elegido se ve en movimiento, aunque no se tenga. En
 * escritorio ancho vive en el panel lateral (#shop-preview-stage); en
 * móvil y tableta se monta dentro del recuadro de la tarjeta tocada.
 *
 * Usa los mismos renderizadores que la partida (vfx/), con una escena
 * mínima por categoría: la bola que cruza o rebota (estelas, bolas,
 * súper), una paleta que golpea (paletas), las dos a doble escala, o el
 * campo entero (fondos y goles, en coordenadas lógicas a media escala). El bucle solo corre con
 * la tienda a la vista y avanza el reloj de los efectos (vfxTick). Al
 * pararse deja limpio lo compartido con la partida: los efectos de gol,
 * los estallidos del súper y el fondo equipado.
 * ------------------------------------------------------------------
 */

'use strict';

/** El lienzo de la vista previa y su contexto (se crean la primera vez). */
let shopPreviewCanvas = null;
let shopPreviewCtx = null;
/** requestAnimationFrame en curso (0 = parado) y la marca del fotograma anterior. */
let shopPreviewRaf = 0;
let shopPreviewLast = 0;

/**
 * Escena en curso: categoría e id del artículo, tiempo en fotogramas,
 * la bola y su estela, y el estado de la paleta.
 * @type {{cat: string, id: string, t: number, ball: Ball, trail: Array<{x: number, y: number}>, hit: number, nextFx: number, fxCount: number} | null}
 */
let shopPreviewScene = null;

const SHOP_PREVIEW_W = 400;
const SHOP_PREVIEW_H = 300;
/** Escena ampliada (estelas, paletas, súper): 200×150 a doble escala, con la bola de la partida. */
const SHOP_ZOOM_W = 200;
const SHOP_ZOOM_H = 150;
/** Fotogramas entre dos goles (efectos de gol) o dos estallidos (súper): unos 2,5 s y 2 s. */
const SHOP_PREVIEW_GOAL_EVERY = 150;
const SHOP_PREVIEW_BURST_EVERY = 120;

/** ¿Se ve el panel lateral de la vista previa (escritorio ancho)? */
function shopPreviewPanelVisible() {
    const el = document.getElementById('shop-preview');
    return !!el && getComputedStyle(el).display !== 'none';
}

/** ¿Está corriendo la animación? */
function shopPreviewRunning() {
    return shopPreviewRaf !== 0;
}

/**
 * Pone la vista previa en el artículo `id` de la categoría `cat`: en el
 * panel si se ve; si no, en su tarjeta, solo si el jugador la tocó
 * (`chosen`). Si no hay dónde, la para.
 */
function syncShopPreview(cat, id, chosen) {
    const panel = shopPreviewPanelVisible();
    const host = panel ? document.getElementById('shop-preview-stage')
        : chosen ? document.querySelector(`#shop-grid .shop-card[data-id="${id}"] .shop-card__tile`) : null;
    if (!host) { stopShopPreview(); return; }

    if (!shopPreviewCanvas) {
        shopPreviewCanvas = document.createElement('canvas');
        shopPreviewCanvas.width = SHOP_PREVIEW_W;
        shopPreviewCanvas.height = SHOP_PREVIEW_H;
        shopPreviewCanvas.className = 'shop-preview-canvas';
        shopPreviewCanvas.setAttribute('aria-hidden', 'true');
        shopPreviewCtx = shopPreviewCanvas.getContext('2d');
    }
    if (shopPreviewCanvas.parentElement !== host) {
        if (shopPreviewCanvas.parentElement) shopPreviewCanvas.parentElement.classList.remove('is-live');
        host.appendChild(shopPreviewCanvas);
    }
    host.classList.add('is-live');

    if (!shopPreviewScene || shopPreviewScene.cat !== cat || shopPreviewScene.id !== id) startShopScene(cat, id);
    if (!shopPreviewRaf) {
        shopPreviewLast = 0;
        shopPreviewRaf = requestAnimationFrame(shopPreviewFrame);
    }
}

/** Para la animación, quita el lienzo y deja limpio lo que comparte con la partida. */
function stopShopPreview() {
    if (shopPreviewRaf) cancelAnimationFrame(shopPreviewRaf);
    shopPreviewRaf = 0;
    if (shopPreviewCanvas && shopPreviewCanvas.parentElement) {
        shopPreviewCanvas.parentElement.classList.remove('is-live');
        shopPreviewCanvas.remove();
    }
    endShopScene();
}

/** Limpia lo que la escena actual dejó en el estado compartido de vfx/. */
function endShopScene() {
    if (!shopPreviewScene) return;
    const cat = shopPreviewScene.cat;
    if (cat === 'goalEffects') resetGoalVFX();
    if (cat === 'super') clearSuperBursts();
    if (cat === 'backgrounds') setActiveBg(equippedId('backgrounds'));
    shopPreviewScene = null;
}

/** Empieza la escena de un artículo. */
function startShopScene(cat, id) {
    endShopScene();
    const big = cat === 'balls';
    shopPreviewScene = {
        cat, id, t: 0, hit: 0, nextFx: 20, fxCount: 0, trail: [],
        ball: /** @type {Ball} */ ({
            x: big ? 120 : 60, y: big ? 90 : 45, dx: big ? 2.4 : 3, dy: big ? 1.7 : 1.9,
            radius: big ? 26 : cat === 'paddles' ? 6 : ballRadius,
            spin: big ? 0.6 : 0, power: cat === 'super' ? 'super' : null, owner: 'p1', squash: 0, trail: []
        })
    };
    const b = shopPreviewScene.ball;
    if (cat === 'backgrounds') {
        BG_RENDERERS[id].init();
        Object.assign(b, { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, dx: 5, dy: 3, radius: ballRadius });
    } else if (cat === 'goalEffects') {
        resetGoalVFX();
    } else if (cat === 'paddles') {
        Object.assign(b, { x: 120, y: 75, dx: -2.6, dy: 1.3 });
    } else if (cat === 'super') {
        clearSuperBursts();
        Object.assign(b, { x: -20, y: SHOP_ZOOM_H / 2, dx: 2.6, dy: 0 });
    }
}

/** Un fotograma de la vista previa. */
function shopPreviewFrame(ts) {
    const shop = document.getElementById('shop-menu');
    if (!shopPreviewScene || !shop.classList.contains('active-screen') || !shopPreviewCanvas.isConnected) {
        shopPreviewRaf = 0;
        stopShopPreview();
        return;
    }
    const dt = shopPreviewLast ? Math.max(0.1, Math.min(3, (ts - shopPreviewLast) / MS_PER_FRAME)) : 1;
    shopPreviewLast = ts;
    vfxTick(dt);
    stepShopScene(shopPreviewScene, dt);
    drawShopScene(shopPreviewScene, shopPreviewCtx);
    shopPreviewRaf = requestAnimationFrame(shopPreviewFrame);
}

/** Rebota la bola dentro de un rectángulo de w×h; devuelve true si tocó una pared. */
function shopBounce(b, w, h) {
    let bounced = false;
    if (b.x < b.radius || b.x > w - b.radius) { b.dx = -b.dx; b.x = Math.max(b.radius, Math.min(w - b.radius, b.x)); bounced = true; }
    if (b.y < b.radius || b.y > h - b.radius) { b.dy = -b.dy; b.y = Math.max(b.radius, Math.min(h - b.radius, b.y)); bounced = true; }
    return bounced;
}

/** Avanza la escena dt fotogramas. */
function stepShopScene(S, dt) {
    const b = S.ball;
    S.t += dt;
    b.squash = Math.max(0, b.squash - 0.08 * dt);
    S.hit = Math.max(0, S.hit - 0.06 * dt);

    if (S.cat === 'super') {
        b.x += b.dx * dt;
        b.y = SHOP_ZOOM_H / 2 + Math.sin(S.t * 0.05) * 20;
        if (b.x > SHOP_ZOOM_W + 30) b.x = -30;
        if (S.t >= S.nextFx) {
            S.nextFx = S.t + SHOP_PREVIEW_BURST_EVERY;
            SUPER_FX[S.id].burst(b.x, b.y, currentThemeHex());
        }
        updateSuperBursts(dt);
    } else if (S.cat === 'paddles') {
        // La bola va y viene contra la paleta (escena de 200×150 a doble escala)
        const py = 25 + Math.sin(S.t * 0.04) * 20;
        b.x += b.dx * dt; b.y += b.dy * dt;
        if (b.y < b.radius || b.y > SHOP_ZOOM_H - b.radius) b.dy = -b.dy;
        if (b.x > SHOP_ZOOM_W - b.radius) b.dx = -Math.abs(b.dx);
        if (b.dx < 0 && b.x - b.radius < 55 && b.y > py - 4 && b.y < py + 104) { b.dx = Math.abs(b.dx); S.hit = 1; }
        if (b.x < -20) Object.assign(b, { x: 120, y: 75 });
    } else if (S.cat === 'backgrounds') {
        b.x += b.dx * dt; b.y += b.dy * dt;
        shopBounce(b, GAME_WIDTH, GAME_HEIGHT);
        BG_RENDERERS[S.id].update(dt, b);
    } else if (S.cat === 'goalEffects') {
        if (S.t >= S.nextFx) {
            S.nextFx = S.t + SHOP_PREVIEW_GOAL_EVERY;
            const left = S.fxCount % 2 === 1;
            GOAL_FX[S.id].trigger(left ? 0 : GAME_WIDTH, 220 + (S.fxCount % 3) * 80, currentThemeHex(), S.fxCount % 3);
            S.fxCount++;
        }
        updateGoalVFX(dt);
    } else {
        // Estelas (escena ampliada) y bolas (lienzo entero): rebota
        b.x += b.dx * dt; b.y += b.dy * dt;
        const big = S.cat === 'balls';
        if (shopBounce(b, big ? SHOP_PREVIEW_W : SHOP_ZOOM_W, big ? SHOP_PREVIEW_H : SHOP_ZOOM_H)) b.squash = 1;
        S.trail.push({ x: b.x, y: b.y });
        if (S.trail.length > 25) S.trail.shift();
    }
}

/** Dibuja la escena. */
function drawShopScene(S, c) {
    const color = currentThemeHex();
    const b = S.ball;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000';
    c.fillRect(0, 0, SHOP_PREVIEW_W, SHOP_PREVIEW_H);

    if (S.cat === 'backgrounds' || S.cat === 'goalEffects') {
        // El campo entero a media escala
        c.setTransform(SHOP_PREVIEW_W / GAME_WIDTH, 0, 0, SHOP_PREVIEW_H / GAME_HEIGHT, 0, 0);
        if (S.cat === 'backgrounds') BG_RENDERERS[S.id].render(c, color);
        c.fillStyle = hexToRgba(color, 0.45);
        for (let y = 0; y < GAME_HEIGHT; y += 30) c.fillRect(GAME_WIDTH / 2 - 2, y, 4, 14);
        PADDLE_RENDERERS.classic(c, 24, 250, paddleWidth, paddleHeight, color);
        PADDLE_RENDERERS.classic(c, GAME_WIDTH - 24 - paddleWidth, 250, paddleWidth, paddleHeight, '#CBD5E1');
        if (S.cat === 'backgrounds') BALL_RENDERERS.classic(c, b, color);
        else GOAL_FX[S.id].render(c);
    } else if (S.cat === 'paddles') {
        c.setTransform(SHOP_PREVIEW_W / SHOP_ZOOM_W, 0, 0, SHOP_PREVIEW_H / SHOP_ZOOM_H, 0, 0);
        const py = 25 + Math.sin(S.t * 0.04) * 20;
        const charge = Math.max(0, Math.sin(S.t * 0.02));
        PADDLE_RENDERERS[S.id](c, 40, py, paddleWidth, paddleHeight, color, { charge, hit: S.hit });
        BALL_RENDERERS.classic(c, b, color);
    } else if (S.cat === 'super') {
        c.setTransform(SHOP_PREVIEW_W / SHOP_ZOOM_W, 0, 0, SHOP_PREVIEW_H / SHOP_ZOOM_H, 0, 0);
        SUPER_FX[S.id].aura(c, b, color);
        BALL_RENDERERS.classic(c, b, color);
        renderSuperBursts(c);
    } else if (S.cat === 'trails') {
        c.setTransform(SHOP_PREVIEW_W / SHOP_ZOOM_W, 0, 0, SHOP_PREVIEW_H / SHOP_ZOOM_H, 0, 0);
        TRAIL_RENDERERS[S.id](c, S.trail, b.radius, color, { spin: 0, power: 0 });
        BALL_RENDERERS.classic(c, b, color);
    } else if (S.cat === 'balls') {
        renderBallVFX(c, b, color, S.id);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
}
