/**
 * game/render.js
 * ------------------------------------------------------------------
 * Dibuja un fotograma de la partida, por capas:
 * fondo → red/marcador (con sus marcas y el rally) → jefe → estelas y
 * bolas → paletas → power-ups → partículas → capa superior del jefe →
 * efecto de gol → cuenta regresiva → scanlines. El efecto activo no se
 * dibuja aquí: es la píldora #powerup-pill del DOM (updatePowerupPill).
 *
 * Varios renderizadores consumen Math.random (vibración, estelas de
 * fuego/hielo, glitch del Creador), que comparte generador con la
 * física: no cambies el orden de las capas.
 * ------------------------------------------------------------------
 */

'use strict';

const net = { x: GAME_WIDTH / 2 - 2, width: 4, height: 16 };

/** La red central. Avanza el contador de fotogramas, que la anima. */
function drawNet(color) {
    state.frameCount++;
    for (let i = 0; i <= GAME_HEIGHT; i += 30) {
        drawRect(net.x, i + (state.frameCount % 30), net.width, net.height, color);
    }
}

function drawBallTrail() {
    for (const b of state.balls) renderBallTrail(ctx, b.trail, b.radius);
}

function drawParticles() {
    state.particles.forEach(p => {
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
}

/**
 * Una marca por punto necesario para ganar, bajo el marcador de un lado:
 * llenas las conseguidas.
 * @param {number} score
 * @param {number} cx centro del marcador
 * @param {string} color
 */
function drawScorePips(score, cx, color) {
    const target = matchTargetScore();
    const gap = 4;
    const w = Math.min(14, (GAME_WIDTH / 4 - gap * (target - 1)) / target);
    let x = cx - (target * w + (target - 1) * gap) / 2;
    ctx.save();
    for (let i = 0; i < target; i++) {
        drawRect(x, 98, w, 6, i < score ? color : 'rgba(255, 255, 255, 0.1)');
        x += w + gap;
    }
    ctx.restore();
}

const RALLY_ICON = new Path2D('M13 2L4 14h7l-1 8 9-12h-7z');

/**
 * "Rally N" arriba en el centro, desde el segundo golpe seguido. Guarda y
 * repone el estado del contexto: lo que se dibuja después (jefes, VFX)
 * sigue viendo la fuente y los trazos que dejaba el marcador.
 */
function drawRallyCounter() {
    if (currentRally < 2) return;
    const text = `RALLY ${currentRally}`;
    ctx.save();
    ctx.font = '12px "Press Start 2P", cursive';
    const textW = ctx.measureText(text).width;
    const w = textW + 44;
    const x = GAME_WIDTH / 2 - w / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x, 12, w, 28);
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, 12.5, w - 1, 27);

    ctx.save();
    ctx.translate(x + 10, 16);
    ctx.scale(0.83, 0.83);
    ctx.strokeStyle = '#FB923C';
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.stroke(RALLY_ICON);
    ctx.restore();

    drawText(text, x + 34 + textW / 2, 32, '#FB923C', 12);
    ctx.restore();
}

/** Línea discontinua con la trayectoria de la primera bola (durante el saque). */
function drawTrajectoryPreview(themeColor) {
    if (state.balls.length === 0) return;
    const b = state.balls[0];
    const previewLength = 280;
    const segmentLen = 10;
    const gapLen = 8;

    const speed = Math.sqrt(b.dx * b.dx + b.dy * b.dy);
    if (speed === 0) return;
    const dirX = b.dx / speed;
    let dirY = b.dy / speed;

    let curX = b.x;
    let curY = b.y;
    let distLeft = previewLength;

    const pulse = 0.4 + 0.3 * Math.sin(performance.now() / 200);

    ctx.save();
    ctx.strokeStyle = hexToRgba(themeColor, pulse);
    ctx.lineWidth = 2;
    ctx.setLineDash([segmentLen, gapLen]);
    ctx.beginPath();
    ctx.moveTo(curX, curY);

    while (distLeft > 0) {
        let distToWall;
        if (dirY < 0) {
            distToWall = (curY - b.radius) / (-dirY);
        } else if (dirY > 0) {
            distToWall = (GAME_HEIGHT - b.radius - curY) / dirY;
        } else {
            distToWall = distLeft;
        }

        if (distToWall <= 0) distToWall = distLeft;

        const step = Math.min(distToWall, distLeft);
        curX += dirX * step;
        curY += dirY * step;
        distLeft -= step;

        ctx.lineTo(curX, curY);

        if (distLeft > 0 && distToWall <= step + 0.01) {
            dirY = -dirY;
        }
    }

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

/** Dibuja el fotograma completo. */
function render() {
    const themeColor = currentThemeHex();

    ctx.save();
    if (state.shakeTimeMs > 0) {
        const dx = (Math.random() - 0.5) * state.shakeIntensity;
        const dy = (Math.random() - 0.5) * state.shakeIntensity;
        ctx.translate(dx, dy);
    }

    // Fondo negro base
    drawRect(-20, -20, GAME_WIDTH + 40, GAME_HEIGHT + 40, '#000');

    // Fondo animado VFX (estrellas, lluvia, aurora)
    renderBackground(ctx);

    // Resplandor sutil detrás del centro
    const gradient = ctx.createRadialGradient(GAME_WIDTH / 2, GAME_HEIGHT / 2, 10, GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT / 1.3);
    gradient.addColorStop(0, hexToRgba(themeColor, 0.08));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const rotatedArena = bossIsRotatedArena();

    if (!rotatedArena) {
        drawNet(themeColor);
        // Marcador, sus marcas de puntos y el rally en curso
        drawText(state.p1Score, GAME_WIDTH / 4, 80, themeColor, 60);
        drawText(state.p2Score, 3 * GAME_WIDTH / 4, 80, themeColor, 60);
        drawScorePips(state.p1Score, GAME_WIDTH / 4, themeColor);
        drawScorePips(state.p2Score, 3 * GAME_WIDTH / 4, '#CBD5E1');
        drawRallyCounter();
    } else {
        // Arena rotada: abajo se muestran los fallos restantes del jugador
        const bcfg = bossConfig();
        const vidas = Math.max(0, (bcfg ? bcfg.targetScore : 5) - state.p2Score);
        drawText('♥ '.repeat(vidas).trim() || '—', GAME_WIDTH / 2, GAME_HEIGHT - 55, '#ef4444', 22);
    }

    // Capa propia del jefe: escombros, escudo, franja del Creador...
    bossRender(ctx);

    // Estelas + bolas
    const hideBall = bossHidesBall();
    if (!hideBall) drawBallTrail();
    for (const b of state.balls) {
        if (hideBall) continue; // Fano oculta la bola real

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = themeColor;
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Paletas
    renderPaddleVFX(ctx, p1.x, p1.y, p1.width, p1.height, '#ffffff');
    if (!rotatedArena) renderPaddleVFX(ctx, p2.x, p2.y, p2.width, p2.height, '#ffffff');
    if (!rotatedArena && p2Twin.active) renderPaddleVFX(ctx, p2Twin.x, p2Twin.y, p2Twin.width, p2Twin.height, '#ef4444');

    // Power-ups
    renderPowerup(ctx);
    renderShield(ctx);
    updatePowerupPill();   // el efecto activo se muestra en el DOM, no en el canvas

    drawParticles();

    // Capa superior del jefe: viñetas, tintes, avisos y glitch
    bossRenderOverlay(ctx);

    // Efectos de gol VFX (flash, confeti, shockwave)
    renderGoalVFX(ctx);

    // Cuenta regresiva de saque + previsualización de trayectoria, y "¡YA!"
    // al sacar (se desvanece en sus últimos 300 ms)
    if (state.serveCountdownMs > 0) {
        const secs = Math.ceil(state.serveCountdownMs / 1000);
        drawTrajectoryPreview(themeColor);
        ctx.globalAlpha = 0.9;
        drawText(String(secs), GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, themeColor, 48);
        ctx.globalAlpha = 1;
    } else if (state.goTextMs > 0) {
        ctx.globalAlpha = 0.9 * Math.min(1, state.goTextMs / 300);
        drawText('¡YA!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, themeColor, 48);
        ctx.globalAlpha = 1;
    }

    // Scanlines
    ctx.fillStyle = hexToRgba(themeColor, 0.03);
    for (let i = 0; i < GAME_HEIGHT; i += 4) {
        ctx.fillRect(0, i, GAME_WIDTH, 1);
    }

    ctx.restore();
}
