// --- System Audio Synth ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let masterVolume = 0.5;

function playTone(freq, type = 'square', duration = 0.1) {
    if (masterVolume === 0) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

const soundEffects = {
    paddleHit: () => playTone(600, 'square', 0.1),
    wallHit: () => playTone(300, 'square', 0.1),
    score: () => {
        playTone(400, 'sawtooth', 0.15);
        setTimeout(() => playTone(600, 'sawtooth', 0.4), 100);
    }
};

// --- Menu Logic ---
function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active-screen');
    });
    // Show requested screen
    const requested = document.getElementById(screenId);
    if (requested) requested.classList.add('active-screen');

    // Handle specific logic
    if (screenId === 'main-menu') {
        document.getElementById('game-container').classList.add('hidden');
        document.getElementById('game-container').classList.remove('flex');
    }
}

function closeGame() {
    showScreen('exit-menu');
}

function forceClose() {
    // In a web environment we can't truly close the tab without user interaction
    // So we clear the screen to simulate closing
    document.body.innerHTML = "<div class='flex w-full h-full items-center justify-center text-2xl text-green-500'>El juego se ha cerrado. Puedes cerrar esta pestaña.</div>";
}

function updateVolume(val) {
    masterVolume = val / 100;
    document.getElementById('vol-display').innerText = `${val}%`;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (val > 0) playTone(400, 'square', 0.05); // test beep
}

let cpuDifficultyLevel = 2; // 1: Easy, 2: Normal, 3: Hard
function updateDifficulty(val) {
    cpuDifficultyLevel = parseInt(val);
}

// --- Game Setup & State ---
const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const WINNING_SCORE = 5;
let animationFrameId;

// Dynamic sizing
const gameWidth = 800;
const gameHeight = 600;

// State
let isPlaying = false;
let isPaused = false;
let gameMode = 'cpu'; // 'cpu' or 'local'
let p1Score = 0;
let p2Score = 0;
let frameCount = 0; // For dashed line animation

const paddleWidth = 15;
const paddleHeight = 100;
const paddleSpeed = 8;

const ballSize = 12;
let ballSpeedBase = 7;
let maxBallSpeed = 15;

const net = {
    x: gameWidth / 2 - 2,
    y: 0,
    width: 4,
    height: 15,
    color: '#22c55e'
};

const p1 = {
    x: 20,
    y: gameHeight / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    dy: 0,
    score: 0
};

const p2 = {
    x: gameWidth - 20 - paddleWidth,
    y: gameHeight / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    dy: 0,
    score: 0
};

const ball = {
    x: gameWidth / 2,
    y: gameHeight / 2,
    radius: ballSize,
    speed: ballSpeedBase,
    dx: ballSpeedBase,
    dy: ballSpeedBase,
    color: '#fff'
};

const keys = {
    w: false,
    s: false,
    ArrowUp: false,
    ArrowDown: false
};

window.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W') keys.w = true;
    if (e.key === 's' || e.key === 'S') keys.s = true;
    if (e.key === 'ArrowUp') keys.ArrowUp = true;
    if (e.key === 'ArrowDown') keys.ArrowDown = true;

    if (e.key === 'Escape' && isPlaying) {
        togglePause();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'W') keys.w = false;
    if (e.key === 's' || e.key === 'S') keys.s = false;
    if (e.key === 'ArrowUp') keys.ArrowUp = false;
    if (e.key === 'ArrowDown') keys.ArrowDown = false;
});

// Resize handling to keep aspect ratio
function resizeCanvas() {
    // Standard aspect ratio 4:3
    const container = document.getElementById('game-container');
    const targetRatio = gameWidth / gameHeight;

    // Get available size taking padding into account
    const availableWidth = container.clientWidth - 32;
    const availableHeight = container.clientHeight - 32;
    const containerRatio = availableWidth / availableHeight;

    let drawWidth, drawHeight;

    if (containerRatio > targetRatio) {
        // Window is wider than needed, restrict by height
        drawHeight = availableHeight;
        drawWidth = drawHeight * targetRatio;
    } else {
        // Window is taller than needed, restrict by width
        drawWidth = availableWidth;
        drawHeight = drawWidth / targetRatio;
    }

    // Set internal resolution (fixed for logic)
    canvas.width = gameWidth;
    canvas.height = gameHeight;

    // Set display size via CSS
    canvas.style.width = `${drawWidth}px`;
    canvas.style.height = `${drawHeight}px`;
}

window.addEventListener('resize', resizeCanvas);

function startGame(mode) {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    gameMode = mode;
    p1Score = 0;
    p2Score = 0;
    resetBall();

    // Reset paddle positions
    p1.y = gameHeight / 2 - p1.height / 2;
    p2.y = gameHeight / 2 - p2.height / 2;
    p1.dy = 0;
    p2.dy = 0;

    isPlaying = true;
    isPaused = false;

    // Hide all menus
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));

    // Show canvas
    const container = document.getElementById('game-container');
    container.classList.remove('hidden');
    container.classList.add('flex');

    resizeCanvas();

    // Start Loop
    cancelAnimationFrame(animationFrameId);
    gameLoop();
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
    } else {
        document.getElementById('pause-menu').classList.remove('active-screen');
        gameLoop(); // Resume
    }
}

function resetBall() {
    ball.x = gameWidth / 2;
    ball.y = gameHeight / 2;
    ball.speed = ballSpeedBase;

    // Random direction
    ball.dx = (Math.random() > 0.5 ? 1 : -1) * ball.speed;

    // Prevent straight horizontal shoots
    let dy = (Math.random() * 2 - 1) * ball.speed;
    if (Math.abs(dy) < 2) dy = dy < 0 ? -2 : 2;
    ball.dy = dy;
}

// Collision detection AABB
function collision(b, p) {
    b.top = b.y - b.radius;
    b.bottom = b.y + b.radius;
    b.left = b.x - b.radius;
    b.right = b.x + b.radius;

    p.top = p.y;
    p.bottom = p.y + p.height;
    p.left = p.x;
    p.right = p.x + p.width;

    return p.left < b.right && p.top < b.bottom && p.right > b.left && p.bottom > b.top;
}

function update() {
    if (isPaused) return;

    // Player 1 Movement (W/S)
    if (keys.w) p1.dy = -paddleSpeed;
    else if (keys.s) p1.dy = paddleSpeed;
    else p1.dy = 0;

    p1.y += p1.dy;

    // Player 2 Movement
    if (gameMode === 'local') {
        // Local P2 (Arrows)
        if (keys.ArrowUp) p2.dy = -paddleSpeed;
        else if (keys.ArrowDown) p2.dy = paddleSpeed;
        else p2.dy = 0;

        p2.y += p2.dy;
    } else {
        // CPU AI
        // Adjust difficulty based on settings
        let aiSpeed = paddleSpeed;
        let errorMargin = 0;

        if (cpuDifficultyLevel === 1) { aiSpeed = paddleSpeed * 0.45; errorMargin = 30; }
        else if (cpuDifficultyLevel === 2) { aiSpeed = paddleSpeed * 0.65; errorMargin = 15; }
        else if (cpuDifficultyLevel === 3) { aiSpeed = paddleSpeed * 0.95; errorMargin = 0; }

        // Simple AI logic: try to align paddle center with ball y
        const p2Center = p2.y + p2.height / 2;

        // Only move if ball is coming towards CPU
        if (ball.dx > 0) {
            if (p2Center < ball.y - errorMargin) {
                p2.y += aiSpeed;
            } else if (p2Center > ball.y + errorMargin) {
                p2.y -= aiSpeed;
            }
        } else {
            // Return to center slowly
            if (p2Center < gameHeight / 2 - 5) p2.y += aiSpeed * 0.5;
            else if (p2Center > gameHeight / 2 + 5) p2.y -= aiSpeed * 0.5;
        }
    }

    // Paddle Boundaries
    if (p1.y < 0) p1.y = 0;
    if (p1.y + p1.height > gameHeight) p1.y = gameHeight - p1.height;
    if (p2.y < 0) p2.y = 0;
    if (p2.y + p2.height > gameHeight) p2.y = gameHeight - p2.height;

    // Move Ball
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall Collisions (Top / Bottom)
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > gameHeight) {
        ball.dy = -ball.dy;
        soundEffects.wallHit();
    }

    // Determine which paddle ball is hitting
    let player = (ball.x + ball.radius < gameWidth / 2) ? p1 : p2;

    // Paddle Collision
    if (collision(ball, player)) {
        // Calculate hit point relative to center of paddle (-1 to 1)
        let collidePoint = (ball.y - (player.y + player.height / 2));
        collidePoint = collidePoint / (player.height / 2);

        // Max angle reflection
        let angleRad = (Math.PI / 4) * collidePoint;

        // Direction of ball based on which paddle
        let direction = (ball.x + ball.radius < gameWidth / 2) ? 1 : -1;

        ball.dx = direction * ball.speed * Math.cos(angleRad);
        ball.dy = ball.speed * Math.sin(angleRad);

        // Increase speed every hit
        if (ball.speed < maxBallSpeed) ball.speed += 0.5;

        soundEffects.paddleHit();
    }

    // Score logic
    if (ball.x - ball.radius < 0) {
        p2Score++;
        soundEffects.score();
        checkWin();
        if (isPlaying) resetBall();
    } else if (ball.x + ball.radius > gameWidth) {
        p1Score++;
        soundEffects.score();
        checkWin();
        if (isPlaying) resetBall();
    }
}

function checkWin() {
    if (p1Score >= WINNING_SCORE || p2Score >= WINNING_SCORE) {
        isPlaying = false;

        const gameOverScreen = document.getElementById('game-over-screen');
        const winnerText = document.getElementById('winner-text');
        const scoreText = document.getElementById('final-score');

        if (gameMode === 'cpu') {
            if (p1Score >= WINNING_SCORE) winnerText.innerText = "¡GANASTE!";
            else winnerText.innerText = "CPU GANA :(";
        } else {
            if (p1Score >= WINNING_SCORE) winnerText.innerText = "JUGADOR 1 GANA";
            else winnerText.innerText = "JUGADOR 2 GANA";
        }

        scoreText.innerText = `${p1Score} - ${p2Score}`;
        gameOverScreen.classList.add('active-screen');
    }
}

function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

function drawArc(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2, false);
    ctx.closePath();
    ctx.fill();
}

function drawText(text, x, y, color, size = "60px") {
    ctx.fillStyle = color;
    ctx.font = `${size} "Press Start 2P", cursive`;
    ctx.fillText(text, x, y);
}

function drawNet() {
    frameCount++;
    // Scrolling dotted net effect
    for (let i = 0; i <= gameHeight; i += 30) {
        drawRect(net.x, net.y + i + (frameCount % 30), net.width, net.height, net.color);
    }
}

function render() {
    // Clear Canvas
    drawRect(0, 0, gameWidth, gameHeight, '#000');

    // Draw Center Line
    drawNet();

    // Draw Scores
    drawText(p1Score, gameWidth / 4, 80, '#22c55e');
    drawText(p2Score, 3 * gameWidth / 4, 80, '#22c55e');

    // Draw Paddles
    drawRect(p1.x, p1.y, p1.width, p1.height, '#fff');
    drawRect(p2.x, p2.y, p2.width, p2.height, '#fff');

    // Draw Ball (square logic for retro feel)
    drawRect(ball.x - ball.radius, ball.y - ball.radius, ball.radius * 2, ball.radius * 2, ball.color);
    // If you want round ball, use drawArc(ball.x, ball.y, ball.radius, ball.color);

    // Scanline effect over canvas
    ctx.fillStyle = 'rgba(0, 255, 0, 0.03)';
    for (let i = 0; i < gameHeight; i += 4) {
        ctx.fillRect(0, i, gameWidth, 1);
    }
}

function gameLoop() {
    if (isPlaying && !isPaused) {
        update();
        render();
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}
