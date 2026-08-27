/**
 * game.js
 * ------------------------------------------------------------------
 * Estado del juego, física con delta-time, bucle principal y
 * renderizado en <canvas>.
 * Incluye mejoras visuales: bola redonda con estela, partículas al
 * golpear, vibración de pantalla al anotar, cuenta regresiva de 4s
 * con previsualización de trayectoria, y control con mouse.
 * ------------------------------------------------------------------
 */

const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

let animationFrameId;
let lastTimestamp = 0;

// --- Estado general ---
let isPlaying = false;
let isPaused  = false;
let gameMode  = 'cpu'; // 'cpu' | 'local'
let p1Score   = 0;
let p2Score   = 0;
let frameCount = 0;

// Cuenta regresiva antes de que la bola empiece a moverse (en milisegundos).
// 0 = bola en juego.
let serveCountdownMs  = 0;
const SERVE_INITIAL   = 4000;  // 4 segundos al iniciar partida
const SERVE_AFTER_GOAL = 4000; // 4 segundos tras cada punto

// Para los sonidos de cuenta regresiva: rastrear el último "segundo" que sonó
let lastCountdownSec = 0;

// Vibración de pantalla al anotar
let shakeFrames    = 0;
let shakeIntensity = 0;
let shakeTimeMs    = 0;  // tiempo restante de vibración en ms

// Estela de la bola (para dar sensación de velocidad)
const ballTrail = [];
const MAX_TRAIL = 10;

// Partículas de impacto
let particles = [];

const paddleWidth  = 15;
const paddleHeight = 100;
const paddleSpeed  = 8;   // píxeles por frame a 60 FPS → multiplicado por dt
const ballRadius   = 9;

const net = { x: GAME_WIDTH / 2 - 2, width: 4, height: 16 };

// `touchY` es la posición (coordenadas internas del canvas) que un dedo está
// pidiendo para esa paleta. Mientras no sea null, tiene prioridad sobre el
// teclado (ver update()). La asigna/limpia js/touch.js y el mouse.
const p1 = { x: 24, y: GAME_HEIGHT / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, dy: 0, touchY: null };
const p2 = { x: GAME_WIDTH - 24 - paddleWidth, y: GAME_HEIGHT / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, dy: 0, touchY: null };

const ball = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, radius: ballRadius, speed: 7, dx: 7, dy: 7 };

// --- Control con mouse ---
let mouseActive = false; // true mientras el mouse está sobre el canvas

canvas.addEventListener('mouseenter', () => { mouseActive = true; });
canvas.addEventListener('mouseleave', () => {
    mouseActive = false;
    // No limpiar touchY al salir: la paleta se queda donde estaba
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
// Usa window.innerWidth/innerHeight para evitar que el canvas crezca
// acumulativamente al cambiar el tamaño de la ventana o usar F11.
function resizeCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');
    const container = document.getElementById('game-container');
    const targetRatio = GAME_WIDTH / GAME_HEIGHT;

    // Usar el viewport como referencia, no el contenedor (evita crecimiento acumulativo)
    const maxW = window.innerWidth - 32;
    const maxH = window.innerHeight - 100; // margen para badge y padding
    const viewportRatio = maxW / maxH;

    let drawWidth, drawHeight;
    if (viewportRatio > targetRatio) {
        drawHeight = maxH;
        drawWidth  = drawHeight * targetRatio;
    } else {
        drawWidth  = maxW;
        drawHeight = drawWidth / targetRatio;
    }

    // Dimensiones lógicas internas (siempre fijas)
    canvas.width  = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    // Tamaño de visualización en pantalla
    canvas.style.width  = `${drawWidth}px`;
    canvas.style.height = `${drawHeight}px`;

    // Limitar el wrapper también para evitar desbordamientos
    wrapper.style.maxWidth  = `${drawWidth}px`;
    wrapper.style.maxHeight = `${drawHeight}px`;
}
window.addEventListener('resize', resizeCanvas);

// --- Ciclo de vida de la partida ---
function startGame(mode) {
    getAudioContext();

    gameMode = mode;
    p1Score  = 0;
    p2Score  = 0;
    particles = [];
    ballTrail.length = 0;

    const speedPreset = BALL_SPEED_PRESETS[settings.ballSpeed] || BALL_SPEED_PRESETS[2];
    ball.speed = speedPreset.base;

    p1.y = GAME_HEIGHT / 2 - p1.height / 2;
    p2.y = GAME_HEIGHT / 2 - p2.height / 2;
    p1.dy = 0;
    p2.dy = 0;
    p1.touchY = null;
    p2.touchY = null;
    if (typeof resetTouchHints === 'function') resetTouchHints();

    isPlaying = true;
    isPaused  = false;

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));

    const container = document.getElementById('game-container');
    container.classList.remove('hidden');
    container.classList.add('flex');

    document.getElementById('mode-badge').textContent = mode === 'cpu' ? 'VS CPU' : 'LOCAL · 2 JUGADORES';
    document.body.dataset.gameMode = mode;

    resizeCanvas();
    resetBall(true);

    // Estadísticas
    if (typeof statsOnGameStart === 'function') statsOnGameStart();

    // Música
    stopMenuMusic();
    playGameplayMusic();

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

    // Música
    stopGameplayMusic();
    playMenuMusic();

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
    ball.x = GAME_WIDTH / 2;
    ball.y = GAME_HEIGHT / 2;
    const speedPreset = BALL_SPEED_PRESETS[settings.ballSpeed] || BALL_SPEED_PRESETS[2];
    ball.speed = speedPreset.base;
    ballTrail.length = 0;

    const dir = Math.random() > 0.5 ? 1 : -1;
    ball.dx = dir * ball.speed;
    let dy = (Math.random() * 2 - 1) * ball.speed;
    if (Math.abs(dy) < 2) dy = dy < 0 ? -2 : 2;
    ball.dy = dy;

    // Congela la bola en el centro durante la cuenta regresiva
    serveCountdownMs = initialServe ? SERVE_INITIAL : SERVE_AFTER_GOAL;
    lastCountdownSec = Math.ceil(serveCountdownMs / 1000) + 1; // forzar primer sonido
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
    shakeTimeMs    = durationMs;
}

// --- Actualización con delta-time ---
// dt = 1.0 equivale a un frame perfecto de 60 FPS (16.67ms).
// Todos los movimientos se multiplican por dt para ser frame-rate-independientes.
function update(dt) {
    const speedPreset  = BALL_SPEED_PRESETS[settings.ballSpeed] || BALL_SPEED_PRESETS[2];
    const maxBallSpeed = speedPreset.max;

    // --- Movimiento Jugador 1 ---
    // El control táctil/mouse tiene prioridad sobre el teclado.
    if (p1.touchY !== null) {
        p1.y = p1.touchY;
    } else {
        if (isActionPressed('p1Up'))        p1.dy = -paddleSpeed;
        else if (isActionPressed('p1Down')) p1.dy = paddleSpeed;
        else p1.dy = 0;
        p1.y += p1.dy * dt;
    }

    // --- Movimiento Jugador 2 / CPU ---
    if (gameMode === 'local') {
        if (p2.touchY !== null) {
            p2.y = p2.touchY;
        } else {
            if (isActionPressed('p2Up'))        p2.dy = -paddleSpeed;
            else if (isActionPressed('p2Down')) p2.dy = paddleSpeed;
            else p2.dy = 0;
            p2.y += p2.dy * dt;
        }
    } else {
        let aiSpeed = paddleSpeed, errorMargin = 0;
        if (settings.difficulty === 1)      { aiSpeed = paddleSpeed * 0.45; errorMargin = 30; }
        else if (settings.difficulty === 2) { aiSpeed = paddleSpeed * 0.65; errorMargin = 15; }
        else                                { aiSpeed = paddleSpeed * 0.95; errorMargin = 0; }

        const p2Center = p2.y + p2.height / 2;
        if (ball.dx > 0) {
            if (p2Center < ball.y - errorMargin)      p2.y += aiSpeed * dt;
            else if (p2Center > ball.y + errorMargin)  p2.y -= aiSpeed * dt;
        } else {
            if (p2Center < GAME_HEIGHT / 2 - 5)      p2.y += aiSpeed * 0.5 * dt;
            else if (p2Center > GAME_HEIGHT / 2 + 5) p2.y -= aiSpeed * 0.5 * dt;
        }
    }

    // Límites de las paletas
    p1.y = Math.max(0, Math.min(GAME_HEIGHT - p1.height, p1.y));
    p2.y = Math.max(0, Math.min(GAME_HEIGHT - p2.height, p2.y));

    // --- Cuenta regresiva de saque ---
    if (serveCountdownMs > 0) {
        const prevSec = Math.ceil(serveCountdownMs / 1000);
        serveCountdownMs -= dt * (1000 / 60); // convertir dt a ms
        if (serveCountdownMs < 0) serveCountdownMs = 0;
        const curSec = Math.ceil(serveCountdownMs / 1000);

        // Sonido de cuenta regresiva en cada segundo
        if (curSec !== prevSec && curSec > 0 && curSec <= 4) {
            soundEffects.countdown();
        }
        if (serveCountdownMs <= 0) {
            soundEffects.go();
        }
        return; // No mover la bola durante la cuenta regresiva
    }

    // Estela de la bola
    ballTrail.push({ x: ball.x, y: ball.y });
    if (ballTrail.length > MAX_TRAIL) ballTrail.shift();

    // Mover bola (delta-time)
    ball.x += ball.dx * dt;
    ball.y += ball.dy * dt;

    // Rebote en paredes
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > GAME_HEIGHT) {
        ball.dy = -ball.dy;
        ball.y  = Math.max(ball.radius, Math.min(GAME_HEIGHT - ball.radius, ball.y));
        soundEffects.wallHit();
        spawnParticles(ball.x, ball.y, currentThemeHex(), 6);
    }

    // Colisión con paletas
    const targetPaddle = (ball.x + ball.radius < GAME_WIDTH / 2) ? p1 : p2;
    if (collision(ball, targetPaddle)) {
        let collidePoint = (ball.y - (targetPaddle.y + targetPaddle.height / 2)) / (targetPaddle.height / 2);
        const angleRad  = (Math.PI / 4) * collidePoint;
        const direction = (ball.x + ball.radius < GAME_WIDTH / 2) ? 1 : -1;

        ball.dx = direction * ball.speed * Math.cos(angleRad);
        ball.dy = ball.speed * Math.sin(angleRad);
        if (ball.speed < maxBallSpeed) ball.speed += 0.5;

        // separa la bola del borde de la paleta para que no quede "pegada"
        ball.x = direction === 1 ? targetPaddle.x + targetPaddle.width + ball.radius : targetPaddle.x - ball.radius;

        soundEffects.paddleHit();
        spawnParticles(ball.x, ball.y, '#ffffff', 16);
        triggerShake(4, 100);

        // Estadísticas: contar golpe para rally
        if (typeof statsOnPaddleHit === 'function') statsOnPaddleHit();
    }

    // Puntuación
    if (ball.x - ball.radius < 0) {
        p2Score++;
        if (typeof statsOnScore === 'function') statsOnScore(false);
        soundEffects.score();
        triggerShake(10, 260);
        if (!checkWin()) resetBall(false);
    } else if (ball.x + ball.radius > GAME_WIDTH) {
        p1Score++;
        if (typeof statsOnScore === 'function') statsOnScore(true);
        soundEffects.score();
        triggerShake(10, 260);
        if (!checkWin()) resetBall(false);
    }

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
    const target = settings.winningScore;
    if (p1Score >= target || p2Score >= target) {
        isPlaying = false;

        const gameOverScreen = document.getElementById('game-over-screen');
        const winnerText     = document.getElementById('winner-text');
        const scoreText      = document.getElementById('final-score');

        const p1Won = p1Score >= target;
        if (gameMode === 'cpu') {
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
    ballTrail.forEach((pos, i) => {
        const alpha = (i / ballTrail.length) * 0.35;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ball.radius * (i / ballTrail.length), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(color, alpha);
        ctx.fill();
    });
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

/**
 * Dibuja una previsualización de la trayectoria de la bola durante
 * la cuenta regresiva. Simula rebotes contra paredes superior/inferior
 * y dibuja una línea punteada con el recorrido que tomará la bola.
 */
function drawTrajectoryPreview(themeColor) {
    const previewLength = 280; // longitud total del recorrido a previsualizar
    const segmentLen    = 10;  // longitud de cada segmento del punteado
    const gapLen        = 8;   // espacio entre segmentos

    // Normalizar dirección
    const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    if (speed === 0) return;
    let dirX = ball.dx / speed;
    let dirY = ball.dy / speed;

    let curX = ball.x;
    let curY = ball.y;
    let distLeft = previewLength;

    // Parpadeo sutil
    const pulse = 0.4 + 0.3 * Math.sin(performance.now() / 200);

    ctx.save();
    ctx.strokeStyle = hexToRgba(themeColor, pulse);
    ctx.lineWidth   = 2;
    ctx.setLineDash([segmentLen, gapLen]);
    ctx.beginPath();
    ctx.moveTo(curX, curY);

    while (distLeft > 0) {
        // Calcular distancia hasta la próxima pared (arriba o abajo)
        let distToWall;
        if (dirY < 0) {
            distToWall = (curY - ball.radius) / (-dirY);
        } else if (dirY > 0) {
            distToWall = (GAME_HEIGHT - ball.radius - curY) / dirY;
        } else {
            distToWall = distLeft; // horizontal puro
        }

        if (distToWall <= 0) distToWall = distLeft;

        const step = Math.min(distToWall, distLeft);
        curX += dirX * step;
        curY += dirY * step;
        distLeft -= step;

        ctx.lineTo(curX, curY);

        // Rebotar si tocó la pared y aún queda distancia
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

    // Fondo
    drawRect(-20, -20, GAME_WIDTH + 40, GAME_HEIGHT + 40, '#000');

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

    // Estela + bola
    drawBallTrail(themeColor);
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle   = '#ffffff';
    ctx.shadowColor = themeColor;
    ctx.shadowBlur  = 18;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Paletas con esquinas suaves y resplandor
    ctx.shadowColor = themeColor;
    ctx.shadowBlur  = 10;
    drawRoundedRect(p1.x, p1.y, p1.width, p1.height, 4, '#ffffff');
    drawRoundedRect(p2.x, p2.y, p2.width, p2.height, 4, '#ffffff');
    ctx.shadowBlur = 0;

    drawParticles();

    // Cuenta regresiva de saque + previsualización de trayectoria
    if (serveCountdownMs > 0) {
        const secs = Math.ceil(serveCountdownMs / 1000);

        // Línea de trayectoria
        drawTrajectoryPreview(themeColor);

        // Número de cuenta regresiva
        ctx.globalAlpha = 0.9;
        drawText(secs > 0 ? String(secs) : '¡YA!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, themeColor, 48);
        ctx.globalAlpha = 1;
    }

    // Efecto de líneas de escaneo (scanlines) sutil sobre el canvas
    ctx.fillStyle = hexToRgba(themeColor, 0.03);
    for (let i = 0; i < GAME_HEIGHT; i += 4) {
        ctx.fillRect(0, i, GAME_WIDTH, 1);
    }

    ctx.restore();
}

// --- Game Loop con delta-time ---
// dt normalizado: dt = 1.0 ≈ frame perfecto de 60 FPS (16.67ms)
function gameLoop(timestamp) {
    if (!isPlaying || isPaused) return;

    if (lastTimestamp === 0) lastTimestamp = timestamp;
    const elapsedMs = timestamp - lastTimestamp;
    lastTimestamp    = timestamp;

    // dt normalizado a 60 FPS. Limitar a max 3.0 para evitar saltos
    // enormes si la pestaña se congela momentáneamente.
    let dt = elapsedMs / (1000 / 60);
    if (dt > 3) dt = 3;
    if (dt <= 0) dt = 1; // primer frame o timestamp raro

    update(dt);
    render();

    // Guardar tiempo jugado periódicamente (~cada 30s)
    if (typeof statsFlushTime === 'function' && Math.random() < 0.001) statsFlushTime();

    animationFrameId = requestAnimationFrame(gameLoop);
}
