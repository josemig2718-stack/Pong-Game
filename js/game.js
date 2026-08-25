/**
 * game.js
 * ------------------------------------------------------------------
 * Estado del juego, física, bucle principal y renderizado en <canvas>.
 * Incluye mejoras visuales: bola redonda con estela, partículas al
 * golpear, vibración de pantalla al anotar y cuenta regresiva de saque.
 * ------------------------------------------------------------------
 */

const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

let animationFrameId;
let lastTimestamp = 0;

// --- Estado general ---
let isPlaying = false;
let isPaused = false;
let gameMode = 'cpu'; // 'cpu' | 'local'
let p1Score = 0;
let p2Score = 0;
let frameCount = 0;

// Cuenta regresiva antes de que la bola empiece a moverse (mejora la
// sensación de "saque" y da tiempo al jugador a ubicarse)
let serveCountdown = 0; // en frames; 0 = bola en juego

// Vibración de pantalla al anotar
let shakeFrames = 0;
let shakeIntensity = 0;

// Estela de la bola (para dar sensación de velocidad)
const ballTrail = [];
const MAX_TRAIL = 10;

// Partículas de impacto
let particles = [];

const paddleWidth = 15;
const paddleHeight = 100;
const paddleSpeed = 8;
const ballRadius = 9;

const net = { x: GAME_WIDTH / 2 - 2, width: 4, height: 16 };

const p1 = { x: 24, y: GAME_HEIGHT / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, dy: 0 };
const p2 = { x: GAME_WIDTH - 24 - paddleWidth, y: GAME_HEIGHT / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, dy: 0 };

const ball = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, radius: ballRadius, speed: 7, dx: 7, dy: 7 };

// --- Ajuste de tamaño manteniendo proporción 4:3 ---
function resizeCanvas() {
    const container = document.getElementById('game-container');
    const targetRatio = GAME_WIDTH / GAME_HEIGHT;

    const availableWidth = container.clientWidth - 32;
    const availableHeight = container.clientHeight - 32;
    const containerRatio = availableWidth / availableHeight;

    let drawWidth, drawHeight;
    if (containerRatio > targetRatio) {
        drawHeight = availableHeight;
        drawWidth = drawHeight * targetRatio;
    } else {
        drawWidth = availableWidth;
        drawHeight = drawWidth / targetRatio;
    }

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    canvas.style.width = `${drawWidth}px`;
    canvas.style.height = `${drawHeight}px`;
}
window.addEventListener('resize', resizeCanvas);

// --- Ciclo de vida de la partida ---
function startGame(mode) {
    getAudioContext();

    gameMode = mode;
    p1Score = 0;
    p2Score = 0;
    particles = [];
    ballTrail.length = 0;

    const speedPreset = BALL_SPEED_PRESETS[settings.ballSpeed] || BALL_SPEED_PRESETS[2];
    ball.speed = speedPreset.base;

    p1.y = GAME_HEIGHT / 2 - p1.height / 2;
    p2.y = GAME_HEIGHT / 2 - p2.height / 2;
    p1.dy = 0;
    p2.dy = 0;

    isPlaying = true;
    isPaused = false;

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));

    const container = document.getElementById('game-container');
    container.classList.remove('hidden');
    container.classList.add('flex');

    document.getElementById('mode-badge').textContent = mode === 'cpu' ? 'VS CPU' : 'LOCAL · 2 JUGADORES';

    resizeCanvas();
    resetBall(true);

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

    // Congela la bola en el centro durante una breve cuenta regresiva
    serveCountdown = initialServe ? 90 : 60;
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

function triggerShake(intensity = 8, frames = 12) {
    if (!settings.screenShake) return;
    shakeIntensity = intensity;
    shakeFrames = frames;
}

function update() {
    const speedPreset = BALL_SPEED_PRESETS[settings.ballSpeed] || BALL_SPEED_PRESETS[2];
    const maxBallSpeed = speedPreset.max;

    // --- Movimiento Jugador 1 ---
    if (isActionPressed('p1Up')) p1.dy = -paddleSpeed;
    else if (isActionPressed('p1Down')) p1.dy = paddleSpeed;
    else p1.dy = 0;
    p1.y += p1.dy;

    // --- Movimiento Jugador 2 / CPU ---
    if (gameMode === 'local') {
        if (isActionPressed('p2Up')) p2.dy = -paddleSpeed;
        else if (isActionPressed('p2Down')) p2.dy = paddleSpeed;
        else p2.dy = 0;
        p2.y += p2.dy;
    } else {
        let aiSpeed = paddleSpeed, errorMargin = 0;
        if (settings.difficulty === 1) { aiSpeed = paddleSpeed * 0.45; errorMargin = 30; }
        else if (settings.difficulty === 2) { aiSpeed = paddleSpeed * 0.65; errorMargin = 15; }
        else { aiSpeed = paddleSpeed * 0.95; errorMargin = 0; }

        const p2Center = p2.y + p2.height / 2;
        if (ball.dx > 0) {
            if (p2Center < ball.y - errorMargin) p2.y += aiSpeed;
            else if (p2Center > ball.y + errorMargin) p2.y -= aiSpeed;
        } else {
            if (p2Center < GAME_HEIGHT / 2 - 5) p2.y += aiSpeed * 0.5;
            else if (p2Center > GAME_HEIGHT / 2 + 5) p2.y -= aiSpeed * 0.5;
        }
    }

    // Límites de las paletas
    p1.y = Math.max(0, Math.min(GAME_HEIGHT - p1.height, p1.y));
    p2.y = Math.max(0, Math.min(GAME_HEIGHT - p2.height, p2.y));

    // --- Cuenta regresiva de saque: la bola espera en el centro ---
    if (serveCountdown > 0) {
        serveCountdown--;
        if (serveCountdown > 0 && serveCountdown % 30 === 0) soundEffects.countdown();
        if (serveCountdown === 0) soundEffects.go();
        return;
    }

    // Estela de la bola
    ballTrail.push({ x: ball.x, y: ball.y });
    if (ballTrail.length > MAX_TRAIL) ballTrail.shift();

    // Mover bola
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Rebote en paredes
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > GAME_HEIGHT) {
        ball.dy = -ball.dy;
        ball.y = Math.max(ball.radius, Math.min(GAME_HEIGHT - ball.radius, ball.y));
        soundEffects.wallHit();
        spawnParticles(ball.x, ball.y, currentThemeHex(), 6);
    }

    // Colisión con paletas
    const targetPaddle = (ball.x + ball.radius < GAME_WIDTH / 2) ? p1 : p2;
    if (collision(ball, targetPaddle)) {
        let collidePoint = (ball.y - (targetPaddle.y + targetPaddle.height / 2)) / (targetPaddle.height / 2);
        const angleRad = (Math.PI / 4) * collidePoint;
        const direction = (ball.x + ball.radius < GAME_WIDTH / 2) ? 1 : -1;

        ball.dx = direction * ball.speed * Math.cos(angleRad);
        ball.dy = ball.speed * Math.sin(angleRad);
        if (ball.speed < maxBallSpeed) ball.speed += 0.5;

        // separa la bola del borde de la paleta para que no quede "pegada"
        ball.x = direction === 1 ? targetPaddle.x + targetPaddle.width + ball.radius : targetPaddle.x - ball.radius;

        soundEffects.paddleHit();
        spawnParticles(ball.x, ball.y, '#ffffff', 16);
        triggerShake(4, 6);
    }

    // Puntuación
    if (ball.x - ball.radius < 0) {
        p2Score++;
        soundEffects.score();
        triggerShake(10, 16);
        if (!checkWin()) resetBall(false);
    } else if (ball.x + ball.radius > GAME_WIDTH) {
        p1Score++;
        soundEffects.score();
        triggerShake(10, 16);
        if (!checkWin()) resetBall(false);
    }

    // Partículas: física simple + desvanecimiento
    particles.forEach(p => {
        p.x += p.dx; p.y += p.dy; p.life -= 0.04;
    });
    particles = particles.filter(p => p.life > 0);

    if (shakeFrames > 0) shakeFrames--;
}

function checkWin() {
    const target = settings.winningScore;
    if (p1Score >= target || p2Score >= target) {
        isPlaying = false;

        const gameOverScreen = document.getElementById('game-over-screen');
        const winnerText = document.getElementById('winner-text');
        const scoreText = document.getElementById('final-score');

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

function render() {
    const themeColor = currentThemeHex();

    ctx.save();
    if (shakeFrames > 0) {
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
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Paletas con esquinas suaves y resplandor
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 10;
    drawRoundedRect(p1.x, p1.y, p1.width, p1.height, 4, '#ffffff');
    drawRoundedRect(p2.x, p2.y, p2.width, p2.height, 4, '#ffffff');
    ctx.shadowBlur = 0;

    drawParticles();

    // Cuenta regresiva de saque
    if (serveCountdown > 0) {
        const secs = Math.ceil(serveCountdown / 30);
        ctx.globalAlpha = 0.9;
        drawText(secs > 0 ? String(secs) : '¡YA!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, themeColor, 42);
        ctx.globalAlpha = 1;
    }

    // Efecto de líneas de escaneo (scanlines) sutil sobre el canvas
    ctx.fillStyle = hexToRgba(themeColor, 0.03);
    for (let i = 0; i < GAME_HEIGHT; i += 4) {
        ctx.fillRect(0, i, GAME_WIDTH, 1);
    }

    ctx.restore();
}

function gameLoop(timestamp) {
    if (isPlaying && !isPaused) {
        update();
        render();
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}
