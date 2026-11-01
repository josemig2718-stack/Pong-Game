/**
 * vfx/paddles.js
 * ------------------------------------------------------------------
 * Estilos de paleta. Cada paleta del catálogo (data/shop.js, categoría
 * paddles) tiene aquí su renderizador en PADDLE_RENDERERS. Solo cambian
 * el dibujo: la caja de colisión es siempre (x, y, w, h).
 *
 * El color lo decide game/render.js: el del tema para el jugador 1,
 * '#CBD5E1' para la CPU, Hachepe o el jefe, '#38BDF8' para el jugador 2
 * en local y '#ef4444' para el gemelo.
 * ------------------------------------------------------------------
 */

'use strict';

/** Abre un trazado con un rectángulo redondeado (con alternativa si el navegador no tiene roundRect). */
function roundRectHelper(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        return;
    }
    // Fallback si roundRect no existe
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

/** roundRectHelper con el radio limitado a la mitad del lado menor (y nunca negativo). */
function paddleRoundRect(ctx, x, y, w, h, r) {
    roundRectHelper(ctx, x, y, w, h, Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)));
}

/** Clásica: barra sólida redondeada, brillo suave y un reflejo vertical. */
function drawPaddleClassic(ctx, x, y, w, h, color) {
    const r = Math.min(6, w / 2);
    ctx.save();
    ctx.shadowColor = hexToRgba(color, 0.55);
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    paddleRoundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    paddleRoundRect(ctx, x + w * 0.18, y + 6, Math.max(2, w * 0.2), h - 12, 1.5);
    ctx.fill();
    ctx.restore();
}

/** [fila, alfa] de las luces y [filas desde abajo, alfa] de las sombras de la paleta pixel. */
const PIXEL_PADDLE_LIGHTS = [[2, 0.55], [4, 0.32], [6, 0.16]];
const PIXEL_PADDLE_SHADOWS = [[3, 0.35], [5, 0.18]];

/** Pixel: bloques de 5 px, esquinas recortadas, luces arriba a la izquierda y sombras abajo a la derecha. */
function drawPaddlePixel(ctx, x, y, w, h, color) {
    const cols = Math.max(1, Math.round(w / 5));
    const rows = Math.max(2, Math.round(h / 5));
    const bw = w / cols, bh = h / rows;
    ctx.save();
    ctx.fillStyle = color;
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const corner = (i === 0 || i === cols - 1) && (j === 0 || j === rows - 1);
            if (!corner) ctx.fillRect(Math.floor(x + i * bw), Math.floor(y + j * bh), Math.ceil(bw), Math.ceil(bh));
        }
    }
    // Luces de 8 bits (columna izquierda, arriba) y sombras (columna derecha, abajo)
    for (const [j, a] of PIXEL_PADDLE_LIGHTS) {
        if (j >= rows - 1) continue;
        ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
        ctx.fillRect(Math.floor(x), Math.floor(y + j * bh), Math.ceil(bw), Math.ceil(bh));
    }
    for (const [back, a] of PIXEL_PADDLE_SHADOWS) {
        const j = rows - back;
        if (j <= 0) continue;
        ctx.fillStyle = `rgba(0, 0, 0, ${a})`;
        ctx.fillRect(Math.floor(x + (cols - 1) * bw), Math.floor(y + j * bh), Math.ceil(bw), Math.ceil(bh));
    }
    // Rejilla de píxel muy sutil
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    for (let i = 1; i < cols; i++) ctx.fillRect(Math.floor(x + i * bw), y + bh, 1, h - 2 * bh);
    for (let j = 1; j < rows; j++) {
        const edge = j === 1 || j === rows - 1;
        ctx.fillRect(x + (edge ? bw : 0), Math.floor(y + j * bh), w - (edge ? 2 * bw : 0), 1);
    }
    ctx.restore();
}

/** Gradiente: del blanco (arriba) al color del jugador, con brillo. */
function drawPaddleGradient(ctx, x, y, w, h, color) {
    const r = Math.min(6, w / 2);
    ctx.save();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, color);
    g.addColorStop(1, hexToRgba(color, 0.6));
    ctx.shadowColor = hexToRgba(color, 0.5);
    ctx.shadowBlur = 14;
    ctx.fillStyle = g;
    paddleRoundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();
}

/** Neón: contorno de 3 px, núcleo blanco y halo doble que pulsa. */
function drawPaddleNeon(ctx, x, y, w, h, color) {
    const r = Math.min(7, w / 2);
    const pulse = 0.5 + 0.5 * Math.sin(vfxNow() / 260);
    ctx.save();
    ctx.fillStyle = hexToRgba(color, 0.06 + 0.05 * pulse);
    paddleRoundRect(ctx, x - 8, y - 8, w + 16, h + 16, r + 8);
    ctx.fill();
    ctx.fillStyle = hexToRgba(color, 0.14 + 0.08 * pulse);
    paddleRoundRect(ctx, x - 4, y - 4, w + 8, h + 8, r + 4);
    ctx.fill();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 + 10 * pulse;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    paddleRoundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    const cw = Math.max(3, w * 0.34);
    paddleRoundRect(ctx, x + (w - cw) / 2, y + 8, cw, h - 16, cw / 2);
    ctx.fill();
    ctx.restore();
}

/** Delgada Pro: barra fina con brillo y la caja de golpe real insinuada (fantasma y discontinua). */
function drawPaddleSlim(ctx, x, y, w, h, color) {
    const r = Math.min(6, w / 2);
    ctx.save();
    ctx.fillStyle = hexToRgba(color, 0.07);
    paddleRoundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(color, 0.22);
    paddleRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
    ctx.setLineDash([]);
    const sw = Math.max(4, w * 0.3);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    paddleRoundRect(ctx, x + (w - sw) / 2, y, sw, h, sw / 2);
    ctx.fill();
    ctx.restore();
}

/** Cristal: translúcida, con facetas, bordes brillantes y un destello que la recorre. */
function drawPaddleCrystal(ctx, x, y, w, h, color, fx) {
    const t = vfxT();
    ctx.save();
    paddleRoundRect(ctx, x, y, w, h, 3);
    ctx.shadowColor = hexToRgba(color, 0.6); ctx.shadowBlur = 16;
    ctx.fillStyle = hexToRgba(color, 0.22);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    // Facetas
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 1;
    for (let yy = y - w; yy < y + h; yy += 22) {
        ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy + w); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + w, yy + 11); ctx.lineTo(x, yy + 11 + w); ctx.stroke();
    }
    ctx.fillStyle = hexToRgba(color, 0.25);
    for (let yy = y; yy < y + h; yy += 22) ctx.fillRect(x, yy, w / 2, 11);
    // Destello que la recorre
    const sy = y + ((t * 70) % (h + 80)) - 40;
    const g = ctx.createLinearGradient(0, sy - 26, 0, sy + 26);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, sy - 26, w, 52);
    ctx.restore();
    ctx.save();
    paddleRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 3);
    ctx.strokeStyle = hexToRgba('#ffffff', 0.8); ctx.lineWidth = 1.2;
    ctx.stroke();
    if (fx && fx.hit) { ctx.globalAlpha = fx.hit; ctx.fillStyle = '#ffffff'; ctx.fill(); }
    ctx.restore();
}

/** Holograma: líneas de escaneo, borde que parpadea y alguna rebanada desplazada. */
function drawPaddleHologram(ctx, x, y, w, h, color) {
    const t = vfxT();
    const flick = 0.75 + 0.25 * Math.sin(t * 31) * Math.sin(t * 7.3);
    const tick = Math.floor(t * 9);
    ctx.save();
    ctx.globalAlpha = flick;
    ctx.shadowColor = color; ctx.shadowBlur = 18;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    paddleRoundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = hexToRgba(color, 0.18);
    ctx.fill();
    // Líneas de escaneo que bajan
    const off = (t * 40) % 4;
    ctx.fillStyle = hexToRgba(color, 0.8);
    for (let yy = y + off; yy < y + h; yy += 4) ctx.fillRect(x + 2, yy, w - 4, 1.4);
    // Rebanada desplazada de vez en cuando
    if (vfxHash(tick) < 0.35) {
        const sy = y + vfxHash(tick * 7) * (h - 10);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = hexToRgba('#ffffff', 0.7);
        ctx.fillRect(x + (vfxHash(tick * 3) - 0.5) * 8, sy, w, 3);
    }
    // Base proyectora
    ctx.globalAlpha = 0.5 * flick;
    const g = ctx.createLinearGradient(0, y + h, 0, y + h + 14);
    g.addColorStop(0, hexToRgba(color, 0.6)); g.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - 3, y + h, w + 6, 14);
    ctx.restore();
}

/** Lava: costra oscura con grietas de magma que laten y fluyen. */
function drawPaddleLava(ctx, x, y, w, h, color) {
    const t = vfxT();
    ctx.save();
    ctx.shadowColor = 'rgba(249, 115, 22, 0.7)'; ctx.shadowBlur = 16;
    paddleRoundRect(ctx, x, y, w, h, 4);
    const base = ctx.createLinearGradient(x, 0, x + w, 0);
    base.addColorStop(0, '#3B0D04'); base.addColorStop(0.5, '#1C0703'); base.addColorStop(1, '#2A0A03');
    ctx.fillStyle = base;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    // Magma que fluye por debajo
    const flow = (t * 25) % 40;
    for (let yy = y - 40 + flow; yy < y + h; yy += 40) {
        const g = ctx.createLinearGradient(0, yy, 0, yy + 40);
        g.addColorStop(0, 'rgba(249, 115, 22, 0)'); g.addColorStop(0.5, 'rgba(249, 115, 22, 0.35)'); g.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = g; ctx.fillRect(x, yy, w, 40);
    }
    // Grietas (patrón fijo en coordenadas de la paleta)
    const pulse = 0.65 + 0.35 * Math.sin(t * 4);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let j = 0; j < Math.ceil(h / 16); j++) {
        const yy = y + j * 16 + 4;
        const a = vfxHash(j * 17), b = vfxHash(j * 29 + 3);
        ctx.beginPath();
        ctx.moveTo(x + w * a * 0.4, yy);
        ctx.lineTo(x + w * (0.4 + b * 0.3), yy + 6);
        ctx.lineTo(x + w * (0.7 + a * 0.3), yy + 4 + b * 8);
        ctx.strokeStyle = `rgba(253, 224, 71, ${0.9 * pulse})`; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.strokeStyle = `rgba(249, 115, 22, ${0.55 * pulse})`; ctx.lineWidth = 3.5; ctx.stroke();
    }
    ctx.restore();
    // Borde del color del jugador, fino, para seguir distinguiendo a cada lado
    ctx.save();
    ctx.strokeStyle = hexToRgba(color, 0.55); ctx.lineWidth = 1;
    paddleRoundRect(ctx, x - 1.5, y - 1.5, w + 3, h + 3, 5);
    ctx.stroke();
    ctx.restore();
}

/** Circuito: placa oscura con pistas del color del jugador y pulsos que viajan; se ilumina al golpear. */
function drawPaddleCircuit(ctx, x, y, w, h, color, fx) {
    const t = vfxT();
    const hit = (fx && fx.hit) || 0;
    ctx.save();
    ctx.shadowColor = hexToRgba(color, 0.5); ctx.shadowBlur = 10 + hit * 18;
    paddleRoundRect(ctx, x, y, w, h, 3);
    ctx.fillStyle = '#0A1220';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hexToRgba(color, 0.9); ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.clip();
    // Pistas
    const cx = x + w / 2;
    ctx.strokeStyle = hexToRgba(color, 0.55 + hit * 0.45); ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, y + 4); ctx.lineTo(cx, y + h - 4);
    for (let j = 0; j < Math.floor(h / 18); j++) {
        const yy = y + 9 + j * 18, side = j % 2 ? -1 : 1;
        ctx.moveTo(cx, yy); ctx.lineTo(cx + side * (w / 2 - 3), yy + 5); ctx.lineTo(cx + side * (w / 2 - 3), yy + 11);
    }
    ctx.stroke();
    // Nodos
    ctx.fillStyle = color;
    for (let j = 0; j < Math.floor(h / 18); j++) {
        const yy = y + 9 + j * 18, side = j % 2 ? -1 : 1;
        ctx.fillRect(cx + side * (w / 2 - 3) - 1.5, yy + 10, 3, 3);
    }
    // Pulso que viaja por la pista central
    const py = y + ((t * 120) % (h + 20)) - 10;
    const g = ctx.createLinearGradient(0, py - 12, 0, py + 12);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 1.5, py - 12, 3, 24);
    if (hit) { ctx.globalAlpha = hit * 0.5; ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
    ctx.restore();
}

/** Sable de energía: núcleo blanco y halo que vibra; más intenso al cargar el smash. */
function drawPaddleSaber(ctx, x, y, w, h, color, fx) {
    const t = vfxT();
    const charge = (fx && fx.charge) || 0;
    const jit = Math.sin(t * 60) * (0.6 + charge * 1.4);
    const cx = x + w / 2 + jit * 0.4;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    // Halos
    for (const [lw, a] of [[w * 2.6 + charge * 10, 0.12], [w * 1.6 + charge * 6, 0.25], [w * 1.0, 0.55]]) {
        ctx.strokeStyle = hexToRgba(color, a + charge * 0.1);
        ctx.lineWidth = lw + jit;
        ctx.beginPath(); ctx.moveTo(cx, y + 4); ctx.lineTo(cx, y + h - 4); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // Núcleo
    ctx.shadowColor = color; ctx.shadowBlur = 12 + charge * 14;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, w * 0.42);
    ctx.beginPath(); ctx.moveTo(cx, y + 4); ctx.lineTo(cx, y + h - 4); ctx.stroke();
    ctx.restore();
}

/** Dorada: oro con bandas metálicas, bisel y destellos. Exclusiva del nivel máximo. */
function drawPaddleGold(ctx, x, y, w, h, color) {
    const t = vfxT();
    ctx.save();
    ctx.shadowColor = 'rgba(250, 204, 21, 0.55)'; ctx.shadowBlur = 16;
    paddleRoundRect(ctx, x, y, w, h, 4);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#92400E'); g.addColorStop(0.22, '#FDE68A'); g.addColorStop(0.45, '#F59E0B');
    g.addColorStop(0.7, '#FCD34D'); g.addColorStop(1, '#B45309');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    // Grabado: rombos sutiles
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.35)'; ctx.lineWidth = 1;
    for (let yy = y + 8; yy < y + h - 4; yy += 14) {
        ctx.beginPath(); ctx.moveTo(x + w / 2, yy - 5); ctx.lineTo(x + w - 3, yy); ctx.lineTo(x + w / 2, yy + 5); ctx.lineTo(x + 3, yy); ctx.closePath(); ctx.stroke();
    }
    // Brillo diagonal que pasa
    const sy = y + ((t * 90) % (h + 120)) - 60;
    const sh = ctx.createLinearGradient(x, sy - 20, x + w, sy + 20);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.8)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(x, sy - 30, w, 60);
    ctx.restore();
    // Destellos
    ctx.save();
    ctx.fillStyle = '#FFFBEB';
    for (let i = 0; i < 2; i++) {
        const ph = (t * 0.9 + i * 0.5) % 1;
        const a = Math.sin(ph * Math.PI);
        ctx.globalAlpha = a;
        vfxSparkle(ctx, x + (i ? w - 2 : 2), y + h * (0.2 + 0.6 * vfxHash(Math.floor(t * 0.9 + i * 0.5) * 7 + i)), 4 + 3 * a);
        ctx.fill();
    }
    ctx.restore();
}

/** La paleta de Pedro: madera en los extremos (20 %) y goma azul en medio. */
function drawPaddlePedro(ctx, x, y, w, h) {
    const cap = h * 0.2;
    ctx.save();
    ctx.shadowColor = 'rgba(59, 130, 246, 0.35)'; ctx.shadowBlur = 8;
    paddleRoundRect(ctx, x, y, w, h, 4);
    ctx.fillStyle = '#C68A52';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    // Vetas de la madera
    ctx.strokeStyle = 'rgba(92, 51, 23, 0.4)'; ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
        const vx = x + (w * i) / 3;
        ctx.beginPath(); ctx.moveTo(vx, y); ctx.lineTo(vx, y + h); ctx.stroke();
    }
    // La goma, con sus puntitos de agarre
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(x, y + cap, w, h - cap * 2);
    ctx.fillStyle = 'rgba(191, 219, 254, 0.45)';
    for (let yy = y + cap + 5; yy < y + h - cap - 2; yy += 7) {
        ctx.fillRect(x + w / 2 - 1, yy, 2, 2);
    }
    // Las juntas y un brillo a lo largo
    ctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
    ctx.fillRect(x, y + cap - 1, w, 2);
    ctx.fillRect(x, y + h - cap - 1, w, 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(x + 1.5, y, 2, h);
    ctx.restore();
}

/** Renderizador de cada paleta, por `id` del catálogo de la tienda. */
const PADDLE_RENDERERS = {
    classic:      drawPaddleClassic,
    pixel:        drawPaddlePixel,
    gradient:     drawPaddleGradient,
    neon_paddle:  drawPaddleNeon,
    slim:         drawPaddleSlim,
    crystal:      drawPaddleCrystal,
    hologram:     drawPaddleHologram,
    lava:         drawPaddleLava,
    circuit:      drawPaddleCircuit,
    saber:        drawPaddleSaber,
    gold:         drawPaddleGold,
    pedro:        drawPaddlePedro
};

/**
 * Dibuja una paleta con el estilo equipado (o el clásico si el id guardado
 * no existe). Los estilos están pensados en vertical: una paleta horizontal
 * (la del jugador en la arena rotada del Creador) se dibuja girada 90° sobre
 * su centro, con la misma caja.
 *
 * `fx` lleva el estado de las mecánicas para los estilos que reaccionan:
 * `charge` (smash cargando, 0–1) y `hit` (destello al golpear, 1 → 0).
 * Los que no lo usan lo ignoran.
 * @param {{charge: number, hit: number}} [fx]
 */
function renderPaddleVFX(ctx, x, y, w, h, color, fx) {
    const paddleId = equippedId('paddles') || 'classic';
    const draw = PADDLE_RENDERERS[paddleId] || PADDLE_RENDERERS['classic'];

    if (w <= h) {
        draw(ctx, x, y, w, h, color, fx);
        return;
    }
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(Math.PI / 2);
    draw(ctx, -h / 2, -w / 2, h, w, color, fx);
    ctx.restore();
}
