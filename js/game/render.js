/**
 * game/render.js
 * ------------------------------------------------------------------
 * Dibuja un fotograma de la partida, por capas:
 * fondo → bordes en llamas de la fiebre (MECH_FX.fever) → red (o los corazones de la arena rotada) → jefe → portales → estelas, aura
 * de la bola gigante, líneas de velocidad, aura del smash, bolas (la equipada) y su
 * efecto (MECH_FX.spin) → paletas (o la pared de práctica), su carga de smash (MECH_FX.charge)
 * y lo que los power-ups ponen sobre ellas (renderPowerupPaddles) →
 * power-ups y sus estallidos → partículas → anillos, textos y estallidos
 * de las mecánicas (MECH_FX.render) → viñeta de cámara lenta → capa
 * superior del jefe → efecto de gol → cuenta atrás o "¡YA!" → scanlines.
 * El marcador, el tiempo, el rally y el efecto activo no se dibujan aquí:
 * son el HUD del DOM (updateHud y updatePowerupPills).
 *
 * La vibración y el glitch del Creador consumen Math.random, que comparte
 * generador con la física: no cambies el orden de las capas. Los
 * cosméticos (vfx/) usan su propio generador, vfxRandom. Con "menos
 * movimiento" (prefersReducedMotion) se dibuja menos, pero se consume el
 * mismo azar.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * La red central: segmentos de 14 px con el brillo del tema. Avanza el
 * contador de fotogramas, que la desplaza.
 */
function drawNet(color) {
    state.frameCount++;
    ctx.save();
    ctx.fillStyle = hexToRgba(color, 0.55);
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    for (let y = -30; y <= GAME_HEIGHT; y += 30) {
        ctx.fillRect(GAME_WIDTH / 2 - 2, y + (state.frameCount % 30), 4, 14);
    }
    ctx.restore();
}

/**
 * Fallos que le quedan al jugador en la arena rotada, como corazones
 * pixelados centrados sobre su paleta. Sin ninguno, un corazón vacío.
 */
function drawLives(vidas) {
    const px = 4, w = 7 * px, gap = 12;
    const n = Math.max(vidas, 1);
    let x = Math.round(GAME_WIDTH / 2 - (n * w + (n - 1) * gap) / 2);
    const y = GAME_HEIGHT - 76;
    for (let i = 0; i < n; i++, x += w + gap) {
        if (vidas === 0) {
            drawPixelHeart(x, y, px, 'rgba(239, 68, 68, 0.5)', PIXEL_HEART_EMPTY);
            continue;
        }
        drawPixelHeart(x + 3, y + 3, px, '#450A0A');
        drawPixelHeart(x, y, px, '#ef4444');
    }
}

/**
 * Cuenta atrás del saque: el número dentro de un anillo que se vacía cada
 * segundo, con un pequeño golpe al cambiar de número.
 * @param {number} msLeft state.serveCountdownMs
 * @param {number} total  duración total de la cuenta atrás (ms)
 */
function drawCountdown(msLeft, total, color) {
    const secs = Math.ceil(msLeft / 1000);
    const frac = (msLeft % 1000) / 1000 || 1;   // fracción del segundo actual
    const cx = GAME_WIDTH / 2, cy = 260;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = hexToRgba(color, 0.2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(cx, cy, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
    ctx.shadowBlur = 0;
    const s = 1 + 0.25 * Math.max(0, frac - 0.8) / 0.2;
    ctx.translate(cx, cy + 2);
    ctx.scale(s, s);
    ctx.font = '36px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(String(secs), 2, 2);
    ctx.restore();
}

/** "¡YA!": entra grande y se encoge mientras se desvanece (msLeft: GO_TEXT_MS → 0). */
function drawGoText(msLeft, color) {
    const k = msLeft / GO_TEXT_MS;
    ctx.save();
    ctx.globalAlpha = Math.min(1, msLeft / 300);
    ctx.translate(GAME_WIDTH / 2, 262);
    const s = 0.9 + 0.5 * k;
    ctx.scale(s, s);
    ctx.font = '40px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText('¡YA!', 4, 4);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillText('¡YA!', 0, 0);
    ctx.restore();
}

function drawBallTrail() {
    for (const b of state.balls) {
        // El jefe puede darle otra estela (el color de quien la golpeó) u
        // oscurecerla (la oscuridad de Fano)
        const fx = { spin: b.spin, power: b.power ? 1 : 0, ...(bossTrailStyle(b) || {}) };
        const dim = bossBallAlpha(b);
        if (dim) drawDimmed(dim.trail, (c) => renderBallTrail(c, b.trail, b.radius, fx));
        else renderBallTrail(ctx, b.trail, b.radius, fx);
    }
}

/** Capa auxiliar para dibujar una bola o su estela con menos opacidad. */
/** @type {HTMLCanvasElement|null} */
let ballDimLayer = null;

/**
 * Dibuja algo en una capa aparte y la pega con `alpha`: los dibujos de
 * las bolas y las estelas ponen su propio globalAlpha, así que no basta
 * con multiplicarlo.
 * @param {number} alpha
 * @param {(c: CanvasRenderingContext2D) => void} draw
 */
function drawDimmed(alpha, draw) {
    if (alpha <= 0) return;
    if (!ballDimLayer) {
        ballDimLayer = document.createElement('canvas');
        ballDimLayer.width = GAME_WIDTH;
        ballDimLayer.height = GAME_HEIGHT;
    }
    const lc = ballDimLayer.getContext('2d');
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    lc.save();
    draw(lc);
    lc.restore();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(ballDimLayer, 0, 0);
    ctx.restore();
}

/**
 * Una bola con sus capas: aura de la bola gigante, líneas de velocidad,
 * aura del smash, la bola y su efecto.
 * @param {CanvasRenderingContext2D} c
 * @param {Ball} b
 * @param {boolean} bigBall
 * @param {number} speedMax
 * @param {string} themeColor
 */
function drawBallLayers(c, b, bigBall, speedMax, themeColor) {
    if (bigBall) drawBigBallAura(c, b);
    drawSpeedLines(c, b, Math.hypot(b.dx, b.dy) / speedMax);
    if (b.power === 'super') SUPER_FX[superStyleId(b.owner)].aura(c, b, themeColor);
    renderBallVFX(c, b, themeColor);
    MECH_FX.spin(c, b, themeColor);
}

/**
 * Color de la paleta de cada lado: el jugador, el del tema; el rival, gris
 * (CPU, Hachepe o jefe) o azul (jugador 2 en local).
 * @param {'p1'|'p2'} side
 */
function sideColor(side) {
    if (side === 'p1') return currentThemeHex();
    return state.mode === 'local' ? '#38BDF8' : '#CBD5E1';
}

/** Partículas de impacto; con "menos movimiento", solo una de cada dos. */
function drawParticles() {
    const step = prefersReducedMotion() ? 2 : 1;
    for (let i = 0; i < state.particles.length; i += step) {
        const p = state.particles[i];
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
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
        // Los dos números se piden siempre, aunque con "menos movimiento"
        // la imagen no se mueva: la física comparte el generador
        const dx = (Math.random() - 0.5) * state.shakeIntensity;
        const dy = (Math.random() - 0.5) * state.shakeIntensity;
        if (!prefersReducedMotion()) ctx.translate(dx, dy);
    }

    // Fondo negro base
    drawRect(-20, -20, GAME_WIDTH + 40, GAME_HEIGHT + 40, '#000');

    // Fondo animado VFX (estrellas, lluvia, aurora)
    renderBackground(ctx);

    // Suelo propio del jefe (la arena de Chemi), debajo del resplandor y la red
    bossRenderArena(ctx);

    // Resplandor sutil detrás del centro
    const gradient = ctx.createRadialGradient(GAME_WIDTH / 2, GAME_HEIGHT / 2, 10, GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT / 1.3);
    gradient.addColorStop(0, hexToRgba(themeColor, 0.08));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Fiebre del rally: los bordes arden (solo visual); en la fiebre larga, más
    MECH_FX.fever(ctx, themeColor, state.feverHeat, state.fever && currentRally >= MUSIC_DYNAMIC.feverBoostRally);

    const rotatedArena = bossIsRotatedArena();

    if (!rotatedArena) {
        drawNet(themeColor);   // el marcador va en el HUD del DOM (game/hud.js)
    } else {
        // Arena rotada: abajo se muestran los fallos restantes del jugador
        const bcfg = bossConfig();
        const vidas = Math.max(0, (bcfg ? bcfg.targetScore : 5) - state.p2Score);
        drawLives(vidas);
    }

    // Capa propia del jefe: escombros, escudo, franja del Creador...
    bossRender(ctx);

    // Portales, debajo de las bolas
    renderPortals(ctx);

    // Estelas + bolas
    const hideBall = bossHidesBall();
    if (!hideBall) drawBallTrail();
    const speedMax = currentSpeedPreset().max;
    const bigBall = powerupActive('big_ball');
    for (const b of state.balls) {
        if (hideBall) continue; // el K.O. de un jefe oculta la bola
        const dim = bossBallAlpha(b);
        if (dim) drawDimmed(dim.ball, (c) => drawBallLayers(c, b, bigBall, speedMax, themeColor));
        else drawBallLayers(ctx, b, bigBall, speedMax, themeColor);
    }

    // Paletas (sideColor) y su carga de smash; el gemelo, rojo. En
    // práctica, en lugar del rival, la pared.
    const practice = state.mode === 'practice';
    renderPaddleVFX(ctx, p1.x, p1.y, p1.width, p1.height, themeColor, { charge: p1.charge, hit: mechPaddleHit.p1 });
    if (practice) drawPracticeWall(ctx, themeColor);
    else if (!rotatedArena && !bossHidesPaddle(p2)) renderPaddleVFX(ctx, p2.x, p2.y, p2.width, p2.height, bossPaddleColor(p2) || sideColor('p2'), { charge: p2.charge, hit: mechPaddleHit.p2 });
    if (!rotatedArena && p2Twin.active) renderPaddleVFX(ctx, p2Twin.x, p2Twin.y, p2Twin.width, p2Twin.height, bossPaddleColor(p2Twin) || '#ef4444');
    MECH_FX.charge(ctx, p1, themeColor, p1.charge);
    if (!rotatedArena && !practice) MECH_FX.charge(ctx, p2, sideColor('p2'), p2.charge);
    renderPowerupPaddles(ctx);   // hielo de Congelar y carga del Rayo

    // Power-ups
    renderPowerup(ctx);
    renderShield(ctx);           // escudos y Muros
    renderPowerupBursts(ctx);
    updatePowerupPills();  // los efectos activos se muestran en el DOM, no en el canvas
    updateHud();           // marcador, tiempo y rally del HUD (DOM)

    drawParticles();
    MECH_FX.render(ctx);   // anillos, ¡PERFECTO! y estallidos del smash
    if (powerupActive('slowmo')) drawSlowmoOverlay(ctx);

    // Capa superior del jefe: viñetas, tintes, avisos y glitch
    bossRenderOverlay(ctx);

    // Efectos de gol VFX (flash, confeti, shockwave)
    renderGoalVFX(ctx);

    // Cuenta atrás del saque + previsualización de trayectoria, y "¡YA!"
    // al sacar (se desvanece en sus últimos 300 ms)
    if (state.serveCountdownMs > 0) {
        drawTrajectoryPreview(themeColor);
        drawCountdown(state.serveCountdownMs, SERVE_INITIAL, themeColor);
    } else if (state.goTextMs > 0) {
        drawGoText(state.goTextMs, themeColor);
    }

    // Scanlines
    ctx.fillStyle = hexToRgba(themeColor, 0.03);
    for (let i = 0; i < GAME_HEIGHT; i += 4) {
        ctx.fillRect(0, i, GAME_WIDTH, 1);
    }

    ctx.restore();
}
