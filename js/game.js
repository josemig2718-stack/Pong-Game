/**
 * game.js
 * ------------------------------------------------------------------
 * Estado del juego, física con delta-time, bucle principal y
 * renderizado en <canvas>.
 * Soporta multi-bola, power-ups, VFX y sistema de progresión.
 * ------------------------------------------------------------------
 */

const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

let animationFrameId;
let lastTimestamp = 0;

// --- Estado general ---
let isPlaying = false;
let isPaused = false;
let gameMode = 'cpu'; // 'cpu' | 'local' | 'hachepe'
let p1Score = 0;
let p2Score = 0;
let frameCount = 0;

// Cuenta regresiva antes de que la bola empiece a moverse (en milisegundos).
// 0 = bola en juego.
let serveCountdownMs = 0;
const SERVE_INITIAL = 3000;  // 4 segundos al iniciar partida
const SERVE_AFTER_GOAL = 3000; // 4 segundos tras cada punto

// Para los sonidos de cuenta regresiva: rastrear el último "segundo" que sonó
let lastCountdownSec = 0;

// Vibración de pantalla al anotar
let shakeFrames = 0;
let shakeIntensity = 0;
let shakeTimeMs = 0;  // tiempo restante de vibración en ms

// --- Multi-bola ---
// Array principal de bolas. ball es alias de balls[0] para compatibilidad.
const MAX_TRAIL = 25;
let balls = [];
let ball = null; // alias de balls[0], se actualiza en resetBall/startGame

// Partículas de impacto
let particles = [];

const paddleWidth = 15;
const paddleHeight = 100;
const paddleSpeed = 8;   // píxeles por frame a 60 FPS → multiplicado por dt
const ballRadius = 9;

const net = { x: GAME_WIDTH / 2 - 2, width: 4, height: 16 };

const p1 = { x: 24, y: GAME_HEIGHT / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, dy: 0, touchY: null };
const p2 = { x: GAME_WIDTH - 24 - paddleWidth, y: GAME_HEIGHT / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, dy: 0, touchY: null };

// Función auxiliar para crear una bola
function createBall(x, y, speed, dx, dy) {
    return {
        x: x, y: y,
        radius: ballRadius,
        speed: speed,
        dx: dx, dy: dy,
        trail: []
    };
}

// --- Control con mouse ---
let mouseActive = false; // true mientras el mouse está sobre el canvas

canvas.addEventListener('mouseenter', () => { mouseActive = true; });
canvas.addEventListener('mouseleave', () => {
    mouseActive = false;
});

canvas.addEventListener('mousemove', (e) => {
    if (!settings.mouseControl || !isPlaying || isPaused || !mouseActive) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = GAME_HEIGHT / rect.height;
    const canvasY = (e.clientY - rect.top) * ratio;
    p1.touchY = Math.max(0, Math.min(GAME_HEIGHT - paddleHeight, canvasY - paddleHeight / 2));
});

// Al desactivar el mouse control, limpiar touchY si venía del mouse
function clearMouseControl() {
    if (mouseActive) {
        p1.touchY = null;
    }
}

// --- Ajuste de tamaño manteniendo proporción 4:3 ---
function resizeCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');
    const container = document.getElementById('game-container');
    const targetRatio = GAME_WIDTH / GAME_HEIGHT;

    // Calcular el espacio disponible dinámicamente restando los hermanos visibles (ej. mode-badge, orientation-hint)
    let siblingHeight = 0;
    let activeSiblings = 0;
    if (container) {
        Array.from(container.children).forEach(child => {
            if (child.id !== 'canvas-wrapper' && window.getComputedStyle(child).display !== 'none') {
                siblingHeight += child.offsetHeight;
                activeSiblings++;
            }
        });
    }

    // El container tiene p-4 (32px padding vertical/horizontal) y gap-3 (12px por hueco)
    const totalGaps = activeSiblings > 0 ? (activeSiblings) * 12 : 0; 
    const verticalPadding = 32; 
    const horizontalPadding = 32;

    // 15px de margen extra de seguridad para evitar cualquier scrollbar accidental
    const maxW = window.innerWidth - horizontalPadding - 15;
    const maxH = window.innerHeight - siblingHeight - totalGaps - verticalPadding - 15;
    
    const viewportRatio = maxW / maxH;

    let drawWidth, drawHeight;
    if (viewportRatio > targetRatio) {
        drawHeight = maxH;
        drawWidth = drawHeight * targetRatio;
    } else {
        drawWidth = maxW;
        drawHeight = drawWidth / targetRatio;
    }

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    canvas.style.width = `${drawWidth}px`;
    canvas.style.height = `${drawHeight}px`;

    wrapper.style.maxWidth = `${drawWidth}px`;
    wrapper.style.maxHeight = `${drawHeight}px`;
}
window.addEventListener('resize', resizeCanvas);

// --- Ciclo de vida de la partida ---
function startGame(mode) {
    getAudioContext();

    gameMode = mode;
    p1Score = 0;
    p2Score = 0;
    particles = [];

    // Restaurar tamaño original de paletas (por si un power-up las alteró)
    p1.height = paddleHeight;
    p2.height = paddleHeight;

    const speedPreset = BALL_SPEED_PRESETS[settings.ballSpeed] || BALL_SPEED_PRESETS[2];

    p1.y = GAME_HEIGHT / 2 - p1.height / 2;
    p2.y = GAME_HEIGHT / 2 - p2.height / 2;
    p1.dy = 0;
    p2.dy = 0;
    p1.touchY = null;
    p2.touchY = null;
    if (typeof resetTouchHints === 'function') resetTouchHints();

    isPlaying = true;
    isPaused = false;

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));

    const container = document.getElementById('game-container');
    container.classList.remove('hidden');
    container.classList.add('flex');

    document.getElementById('mode-badge').textContent = mode === 'cpu' ? 'VS CPU' : mode === 'hachepe' ? 'HACHEPE' : 'LOCAL · 2 JUGADORES';
    document.body.dataset.gameMode = mode;

    const hachepeChars = document.getElementById('hachepe-characters');
    if (hachepeChars) {
        if (mode === 'hachepe') hachepeChars.classList.remove('hidden');
        else hachepeChars.classList.add('hidden');
    }

    resizeCanvas();
    resetBall(true);

    // Inicializar power-ups
    if (typeof initPowerups === 'function') initPowerups();

    // Inicializar VFX
    if (typeof initVFX === 'function') initVFX();

    // Estadísticas
    if (typeof statsOnGameStart === 'function') statsOnGameStart();

    // Progresión: resetear trackers de sesión
    if (typeof resetSessionTrackers === 'function') resetSessionTrackers();

    // Música
    stopMenuMusic();
    playGameplayMusic(mode);

    cancelAnimationFrame(animationFrameId);
    lastTimestamp = 0;
    animationFrameId = requestAnimationFrame(gameLoop);
}

function restartCurrentGame() {
    startGame(gameMode);
}

function quitGame() {
    isPlaying = false;
    cancelAnimationFrame(animationFrameId);

    // Restaurar paletas
    p1.height = paddleHeight;
    p2.height = paddleHeight;

    // Música
    stopGameplayMusic();
    playMenuMusic();

    const hachepeChars = document.getElementById('hachepe-characters');
    if (hachepeChars) hachepeChars.classList.add('hidden');

    showScreen('main-menu');
}

function togglePause() {
    if (!isPlaying) return;
    isPaused = !isPaused;
    if (isPaused) {
        document.getElementById('pause-menu').classList.add('active-screen');
        cancelAnimationFrame(animationFrameId);
    } else {
        document.getElementById('pause-menu').classList.remove('active-screen');
        lastTimestamp = 0;
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

function resetBall(initialServe = false) {
    const speedPreset = BALL_SPEED_PRESETS[settings.ballSpeed] || BALL_SPEED_PRESETS[2];
    const dir = Math.random() > 0.5 ? 1 : -1;
    const speed = speedPreset.base;
    let dy = (Math.random() * 2 - 1) * speed;
    if (Math.abs(dy) < 2) dy = dy < 0 ? -2 : 2;

    const newBall = createBall(GAME_WIDTH / 2, GAME_HEIGHT / 2, speed, dir * speed, dy);
    balls = [newBall];
    ball = balls[0];

    // Congela la bola en el centro durante la cuenta regresiva
    serveCountdownMs = initialServe ? SERVE_INITIAL : SERVE_AFTER_GOAL;
    lastCountdownSec = Math.ceil(serveCountdownMs / 1000) + 1;
    
    // Mantener power-ups persistentes (ej. bola gigante)
    if (typeof enforcePowerups === 'function') enforcePowerups();
}

/** Función para generar bolas extra (Multi-Bola power-up) */
function spawnExtraBalls() {
    if (balls.length === 0) return;
    const source = balls[0];
    const count = Math.random() > 0.5 ? 2 : 1; // duplicar o triplicar

    if (typeof soundEffects !== 'undefined' && soundEffects.multiBallSplit) soundEffects.multiBallSplit();

    for (let i = 0; i < count; i++) {
        const angleOffset = (Math.PI / 6) * (i + 1) * (Math.random() > 0.5 ? 1 : -1);
        const speed = source.speed;
        const origAngle = Math.atan2(source.dy, source.dx);
        const newAngle = origAngle + angleOffset;

        const extra = createBall(
            source.x, source.y, speed,
            speed * Math.cos(newAngle),
            speed * Math.sin(newAngle)
        );
        extra.radius = source.radius; // Respetar bola gigante si está activa
        balls.push(extra);
    }
}

// --- Colisiones (AABB circulo-rectangulo simplificado) ---
function collision(b, p) {
    const top = b.y - b.radius, bottom = b.y + b.radius, left = b.x - b.radius, right = b.x + b.radius;
    return p.x < right && p.y < bottom && p.x + p.width > left && p.y + p.height > top;
}

function spawnParticles(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        particles.push({
            x, y,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            life: 1,
            color
        });
    }
}

function triggerShake(intensity = 8, durationMs = 200) {
    if (!settings.screenShake) return;
    shakeIntensity = intensity;
    shakeTimeMs = durationMs;
}

// --- Actualización con delta-time ---
function update(dt) {
    // Aplicar slowmo de power-ups y VFX de gol
    let slowmo = 1.0;
    if (typeof getSlowmoMultiplier === 'function') slowmo = Math.min(slowmo, getSlowmoMultiplier());
    if (typeof getGoalSlowmo === 'function') slowmo = Math.min(slowmo, getGoalSlowmo());
    dt *= slowmo;

    const speedPreset = BALL_SPEED_PRESETS[settings.ballSpeed] || BALL_SPEED_PRESETS[2];
    const maxBallSpeed = speedPreset.max;

    // --- Movimiento Jugador 1 ---
    if (p1.touchY !== null) {
        p1.y = p1.touchY;
    } else {
        if (isActionPressed('p1Up')) p1.dy = -paddleSpeed;
        else if (isActionPressed('p1Down')) p1.dy = paddleSpeed;
        else p1.dy = 0;
        p1.y += p1.dy * dt;
    }

    // --- Movimiento Jugador 2 / CPU ---
    if (gameMode === 'local') {
        if (p2.touchY !== null) {
            p2.y = p2.touchY;
        } else {
            if (isActionPressed('p2Up')) p2.dy = -paddleSpeed;
            else if (isActionPressed('p2Down')) p2.dy = paddleSpeed;
            else p2.dy = 0;
            p2.y += p2.dy * dt;
        }
    } else {
        let aiSpeed = paddleSpeed, errorMargin = 0;
        if (gameMode === 'hachepe') {
            aiSpeed = paddleSpeed * 1.5;
            errorMargin = 0;
        } else {
            if (settings.difficulty === 1) { aiSpeed = paddleSpeed * 0.45; errorMargin = 30; }
            else if (settings.difficulty === 2) { aiSpeed = paddleSpeed * 0.65; errorMargin = 15; }
            else { aiSpeed = paddleSpeed * 0.95; errorMargin = 0; }
        }

        // La CPU persigue la bola más cercana que vaya hacia ella
        let targetBall = balls[0];
        let closestDist = Infinity;
        for (const b of balls) {
            if (b.dx > 0) { // va hacia la CPU
                const dist = Math.abs(b.x - p2.x);
                if (dist < closestDist) { closestDist = dist; targetBall = b; }
            }
        }
        if (!targetBall) targetBall = balls[0];

        const p2Center = p2.y + p2.height / 2;
        if (targetBall && targetBall.dx > 0) {
            if (p2Center < targetBall.y - errorMargin) p2.y += aiSpeed * dt;
            else if (p2Center > targetBall.y + errorMargin) p2.y -= aiSpeed * dt;
        } else {
            if (p2Center < GAME_HEIGHT / 2 - 5) p2.y += aiSpeed * 0.5 * dt;
            else if (p2Center > GAME_HEIGHT / 2 + 5) p2.y -= aiSpeed * 0.5 * dt;
        }
    }

    // Límites de las paletas
    p1.y = Math.max(0, Math.min(GAME_HEIGHT - p1.height, p1.y));
    p2.y = Math.max(0, Math.min(GAME_HEIGHT - p2.height, p2.y));

    // --- Cuenta regresiva de saque ---
    if (serveCountdownMs > 0) {
        const prevSec = Math.ceil(serveCountdownMs / 1000);
        serveCountdownMs -= dt * (1000 / 60);
        if (serveCountdownMs < 0) serveCountdownMs = 0;
        const curSec = Math.ceil(serveCountdownMs / 1000);

        if (curSec !== prevSec && curSec > 0 && curSec <= 4) {
            soundEffects.countdown();
        }
        if (serveCountdownMs <= 0) {
            soundEffects.go();
        }

        // Actualizar VFX y power-ups durante countdown (fondos animados)
        if (typeof updateVFX === 'function') updateVFX(dt);

        return; // No mover la bola durante la cuenta regresiva
    }

    // --- Actualizar todas las bolas ---
    const ballsToRemove = [];

    for (let bi = 0; bi < balls.length; bi++) {
        const b = balls[bi];

        // Estela
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > MAX_TRAIL) b.trail.shift();

        // Mover bola
        b.x += b.dx * dt;
        b.y += b.dy * dt;

        // Rebote en paredes superior/inferior
        if (b.y - b.radius < 0 || b.y + b.radius > GAME_HEIGHT) {
            b.dy = -b.dy;
            b.y = Math.max(b.radius, Math.min(GAME_HEIGHT - b.radius, b.y));
            soundEffects.wallHit();
            spawnParticles(b.x, b.y, currentThemeHex(), 6);
        }

        // Colisión con paletas
        const targetPaddle = (b.x + b.radius < GAME_WIDTH / 2) ? p1 : p2;
        if (collision(b, targetPaddle)) {
            let collidePoint = (b.y - (targetPaddle.y + targetPaddle.height / 2)) / (targetPaddle.height / 2);
            const angleRad = (Math.PI / 4) * collidePoint;
            const direction = (b.x + b.radius < GAME_WIDTH / 2) ? 1 : -1;

            b.dx = direction * b.speed * Math.cos(angleRad);
            b.dy = b.speed * Math.sin(angleRad);
            if (b.speed < maxBallSpeed) b.speed += 0.5;

            b.x = direction === 1 ? targetPaddle.x + targetPaddle.width + b.radius : targetPaddle.x - b.radius;

            soundEffects.paddleHit();
            spawnParticles(b.x, b.y, '#ffffff', 16);
            triggerShake(4, 100);

            // Registrar último golpeador para power-ups
            if (typeof setLastHitter === 'function') {
                setLastHitter(targetPaddle === p1 ? 'p1' : 'p2');
            }

            // Estadísticas: contar golpe para rally
            if (typeof statsOnPaddleHit === 'function') statsOnPaddleHit();
        }

        // Puntuación (bola sale del campo)
        if (b.x - b.radius < 0) {
            // CPU/P2 anota
            p2Score++;
            if (typeof statsOnScore === 'function') statsOnScore(false);
            soundEffects.score();
            triggerShake(10, 260);
            // VFX de gol
            if (typeof triggerGoalVFX === 'function') triggerGoalVFX(0, b.y);

            if (balls.length > 1) {
                // Multi-bola: eliminar esta bola, no resetear
                ballsToRemove.push(bi);
                // Verificar si ya ganó
                if (checkWin()) return;
            } else {
                // Última bola: comportamiento normal
                if (!checkWin()) resetBall(false);
            }
        } else if (b.x + b.radius > GAME_WIDTH) {
            // P1 anota
            p1Score++;
            if (typeof statsOnScore === 'function') statsOnScore(true);
            soundEffects.score();
            triggerShake(10, 260);
            if (typeof triggerGoalVFX === 'function') triggerGoalVFX(GAME_WIDTH, b.y);

            if (balls.length > 1) {
                ballsToRemove.push(bi);
                if (checkWin()) return;
            } else {
                if (!checkWin()) resetBall(false);
            }
        }
    }

    // Eliminar bolas que salieron (de atrás hacia adelante para no alterar índices)
    for (let i = ballsToRemove.length - 1; i >= 0; i--) {
        balls.splice(ballsToRemove[i], 1);
    }

    // Si no quedan bolas (todas salieron en multi-bola), resetear
    if (balls.length === 0 && isPlaying) {
        resetBall(false);
    }

    // Mantener alias ball actualizado
    ball = balls[0] || ball;

    // Actualizar power-ups
    if (typeof updatePowerups === 'function') updatePowerups(dt);

    // Actualizar VFX (fondos, efectos de gol)
    if (typeof updateVFX === 'function') updateVFX(dt);

    // Partículas: física simple + desvanecimiento (con dt)
    particles.forEach(p => {
        p.x += p.dx * dt;
        p.y += p.dy * dt;
        p.life -= 0.04 * dt;
    });
    particles = particles.filter(p => p.life > 0);

    // Vibración de pantalla (basada en tiempo, no frames)
    if (shakeTimeMs > 0) {
        shakeTimeMs -= dt * (1000 / 60);
        if (shakeTimeMs < 0) shakeTimeMs = 0;
    }
}

function checkWin() {
    const target = gameMode === 'hachepe' ? 10 : settings.winningScore;
    if (p1Score >= target || p2Score >= target) {
        isPlaying = false;

        const gameOverScreen = document.getElementById('game-over-screen');
        const winnerText = document.getElementById('winner-text');
        const scoreText = document.getElementById('final-score');

        const p1Won = p1Score >= target;
        if (gameMode === 'cpu' || gameMode === 'hachepe') {
            winnerText.textContent = p1Won ? '¡GANASTE!' : 'CPU GANA :(';
            p1Won ? soundEffects.win() : soundEffects.lose();
        } else {
            winnerText.textContent = p1Won ? 'JUGADOR 1 GANA' : 'JUGADOR 2 GANA';
            soundEffects.win();
        }

        scoreText.textContent = `${p1Score} - ${p2Score}`;
        gameOverScreen.classList.add('active-screen');

        // Estadísticas y logros
        if (typeof statsOnGameEnd === 'function') {
            statsOnGameEnd(gameMode, p1Won, p1Score, p2Score);
        }

        if (gameMode === 'hachepe' && p1Won && typeof unlockAchievement === 'function') {
            unlockAchievement('beat_hachepe');
        }

        // Progresión: otorgar XP y Chemi Coins
        if (typeof awardGameRewards === 'function') {
            awardGameRewards(gameMode, p1Won, p1Score, p2Score);
        }

        // Actualizar displays de progresión
        if (typeof updateCoinDisplay === 'function') updateCoinDisplay();
        if (typeof updateProgressionDisplay === 'function') updateProgressionDisplay();

        // Restaurar paletas por si un power-up las alteró
        p1.height = paddleHeight;
        p2.height = paddleHeight;

        // Música
        stopGameplayMusic();
        return true;
    }
    return false;
}

// --- Renderizado ---
function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

function drawRoundedRect(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
}

function drawText(text, x, y, color, size = 60, align = 'center') {
    ctx.fillStyle = color;
    ctx.font = `${size}px "Press Start 2P", cursive`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
}

function drawNet(color) {
    frameCount++;
    for (let i = 0; i <= GAME_HEIGHT; i += 30) {
        drawRect(net.x, i + (frameCount % 30), net.width, net.height, color);
    }
}

function drawBallTrail(color) {
    // Si hay VFX de estela disponible, usarlo
    for (const b of balls) {
        if (typeof renderBallTrail === 'function') {
            renderBallTrail(ctx, b.trail, b.radius);
        } else {
            // Fallback: estela clásica
            b.trail.forEach((pos, i) => {
                const alpha = (i / b.trail.length) * 0.35;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, b.radius * (i / b.trail.length), 0, Math.PI * 2);
                ctx.fillStyle = hexToRgba(color, alpha);
                ctx.fill();
            });
        }
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawTrajectoryPreview(themeColor) {
    if (balls.length === 0) return;
    const b = balls[0];
    const previewLength = 280;
    const segmentLen = 10;
    const gapLen = 8;

    const speed = Math.sqrt(b.dx * b.dx + b.dy * b.dy);
    if (speed === 0) return;
    let dirX = b.dx / speed;
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

function render() {
    const themeColor = currentThemeHex();

    ctx.save();
    if (shakeTimeMs > 0) {
        const dx = (Math.random() - 0.5) * shakeIntensity;
        const dy = (Math.random() - 0.5) * shakeIntensity;
        ctx.translate(dx, dy);
    }

    // Fondo negro base
    drawRect(-20, -20, GAME_WIDTH + 40, GAME_HEIGHT + 40, '#000');

    // Fondo animado VFX (estrellas, lluvia, aurora)
    if (typeof renderBackground === 'function') renderBackground(ctx);

    // Resplandor sutil detrás del centro
    const gradient = ctx.createRadialGradient(GAME_WIDTH / 2, GAME_HEIGHT / 2, 10, GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT / 1.3);
    gradient.addColorStop(0, hexToRgba(themeColor, 0.08));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    drawNet(themeColor);

    // Marcador
    drawText(p1Score, GAME_WIDTH / 4, 80, themeColor, 60);
    drawText(p2Score, 3 * GAME_WIDTH / 4, 80, themeColor, 60);

    // Estelas + bolas
    drawBallTrail(themeColor);
    for (const b of balls) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = themeColor;
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Paletas
    if (typeof renderPaddleVFX === 'function') {
        renderPaddleVFX(ctx, p1.x, p1.y, p1.width, p1.height, '#ffffff');
        renderPaddleVFX(ctx, p2.x, p2.y, p2.width, p2.height, '#ffffff');
    } else {
        ctx.shadowColor = themeColor;
        ctx.shadowBlur = 10;
        drawRoundedRect(p1.x, p1.y, p1.width, p1.height, 4, '#ffffff');
        drawRoundedRect(p2.x, p2.y, p2.width, p2.height, 4, '#ffffff');
        ctx.shadowBlur = 0;
    }

    // Power-ups
    if (typeof renderPowerup === 'function') renderPowerup(ctx, themeColor);
    if (typeof renderShield === 'function') renderShield(ctx, themeColor);
    if (typeof renderActiveEffectHUD === 'function') renderActiveEffectHUD(ctx, GAME_WIDTH);

    drawParticles();

    // Efectos de gol VFX (flash, confeti, shockwave)
    if (typeof renderGoalVFX === 'function') renderGoalVFX(ctx);

    // Cuenta regresiva de saque + previsualización de trayectoria
    if (serveCountdownMs > 0) {
        const secs = Math.ceil(serveCountdownMs / 1000);
        drawTrajectoryPreview(themeColor);
        ctx.globalAlpha = 0.9;
        drawText(secs > 0 ? String(secs) : '¡YA!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, themeColor, 48);
        ctx.globalAlpha = 1;
    }

    // Scanlines
    ctx.fillStyle = hexToRgba(themeColor, 0.03);
    for (let i = 0; i < GAME_HEIGHT; i += 4) {
        ctx.fillRect(0, i, GAME_WIDTH, 1);
    }

    ctx.restore();
}

// --- Game Loop con delta-time ---
function gameLoop(timestamp) {
    if (!isPlaying || isPaused) return;

    if (lastTimestamp === 0) lastTimestamp = timestamp;
    const elapsedMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    let dt = elapsedMs / (1000 / 60);
    if (dt > 3) dt = 3;
    if (dt <= 0) dt = 1;

    update(dt);
    render();

    // Guardar tiempo jugado periódicamente (~cada 30s)
    if (typeof statsFlushTime === 'function' && Math.random() < 0.001) statsFlushTime();

    animationFrameId = requestAnimationFrame(gameLoop);
}
