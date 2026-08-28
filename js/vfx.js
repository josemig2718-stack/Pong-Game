// Variables de estado actuales para los efectos visuales
let currentTrailId = 'default';
let currentBgId = 'none';
let currentPaddleId = 'classic';
let currentGoalFxId = 'classic';

// Variables de estado para los fondos
let bgStars = [];
let bgRainColumns = [];
let bgAuroraWaves = [];

// Variables de estado para los efectos de gol (anotación)
let goalFlashAlpha = 0;
let goalSlowmoTimer = 0;
let confettiParticles = [];
let shockwave = null; // { x, y, radius, maxRadius, alpha }

// ==========================================
// 1. RENDERIZADORES DE ESTELAS (TRAILS)
// ==========================================

function drawTrailDefault(ctx, trail, radius, color) {
    if (trail.length < 2) return;
    
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw a fading line
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
    }
    
    // Create gradient along the trail isn't trivial in canvas 2D without complex math,
    // so we can draw segments or just a single line with a global alpha. 
    // To make it look like a fading tail, we draw overlapping lines of decreasing width.
    for (let i = 1; i < trail.length; i++) {
        const p1 = trail[i-1];
        const p2 = trail[i];
        const pct = i / trail.length; // 0 (oldest) to 1 (newest)
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5 * pct;
        ctx.lineWidth = Math.max(1, radius * 2 * pct);
        ctx.stroke();
    }
    ctx.restore();
}

function drawTrailNeon(ctx, trail, radius, color) {
    if (trail.length < 2) return;

    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = radius * 0.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Línea gruesa de neón (color principal)
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
    }
    ctx.stroke();

    // Línea blanca delgada en el centro para el brillo
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = radius * 0.3;
    ctx.stroke();
    
    ctx.restore();
}

function drawTrailFire(ctx, trail, radius, color) {
    ctx.save();
    for (let i = 0; i < trail.length; i++) {
        const point = trail[i];
        const pct = i / trail.length; // 0 to 1
        const alpha = 0.8 * pct;
        
        ctx.globalAlpha = alpha;
        
        // 2-3 partículas por punto de la estela
        const particleCount = 2 + Math.floor(Math.random() * 2);
        for (let p = 0; p < particleCount; p++) {
            // Desplazamiento aleatorio y "subida" (deriva hacia arriba en y)
            const offsetX = (Math.random() - 0.5) * radius * 1.5;
            const offsetY = (Math.random() - 0.5) * radius * 1.5 - ((trail.length - i) * 1.5); // deriva hacia arriba
            
            // Gradiente simple aproximado por color
            let fireColor = '#ff0000'; // Rojo por defecto
            const randColor = Math.random();
            if (randColor < 0.3) fireColor = '#ff6600'; // Naranja
            else if (randColor > 0.8) fireColor = '#330000'; // Rojo oscuro
            
            ctx.fillStyle = fireColor;
            ctx.beginPath();
            ctx.arc(point.x + offsetX, point.y + offsetY, radius * 0.5 * pct, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

function drawTrailIce(ctx, trail, radius, color) {
    ctx.save();
    for (let i = 0; i < trail.length; i++) {
        const point = trail[i];
        const pct = i / trail.length;
        const alpha = 0.8 * pct;
        
        ctx.globalAlpha = alpha;
        
        const particleCount = 2 + Math.floor(Math.random() * 2);
        for (let p = 0; p < particleCount; p++) {
            // Deriva lateral (hacia los lados)
            const offsetX = (Math.random() - 0.5) * radius * 3;
            const offsetY = (Math.random() - 0.5) * radius;
            
            let iceColor = '#00ffff'; 
            if (Math.random() > 0.5) iceColor = '#ffffff'; 
            
            ctx.fillStyle = iceColor;
            
            // Dibujar cuadrados pequeños rotados
            ctx.save();
            ctx.translate(point.x + offsetX, point.y + offsetY);
            ctx.rotate(Math.PI / 4); // 45 grados
            const size = radius * 0.6 * pct;
            ctx.fillRect(-size/2, -size/2, size, size);
            ctx.restore();
        }
    }
    ctx.restore();
}

function drawTrailRainbow(ctx, trail, radius, color) {
    if (trail.length < 2) return;
    
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    for (let i = 1; i < trail.length; i++) {
        const p1 = trail[i-1];
        const p2 = trail[i];
        const pct = i / trail.length;
        
        const hue = (i * 15 + (typeof frameCount !== 'undefined' ? frameCount : Date.now()/20) * 3) % 360;
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
        ctx.globalAlpha = 0.8 * pct;
        ctx.lineWidth = Math.max(1, radius * 2 * pct);
        ctx.stroke();
    }
    ctx.restore();
}

const TRAIL_RENDERERS = {
    default: drawTrailDefault,
    neon:    drawTrailNeon,
    fire:    drawTrailFire,
    ice:     drawTrailIce,
    rainbow: drawTrailRainbow
};

// ==========================================
// 2. RENDERIZADORES DE FONDOS (BACKGROUNDS)
// ==========================================

// --- Estrellas ---
function initStars() {
    bgStars = [];
    for (let i = 0; i < 80; i++) {
        bgStars.push({
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * GAME_HEIGHT,
            phase: Math.random() * Math.PI * 2,
            freq: 0.5 + Math.random() * 1.5,
            baseAlpha: 0.2 + Math.random() * 0.4
        });
    }
}
function updateStars(dt) { /* Animación basada en tiempo, no necesita update */ }
function renderStars(ctx) {
    const timeSec = Date.now() / 1000;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < bgStars.length; i++) {
        const star = bgStars[i];
        const alpha = star.baseAlpha + 0.2 * Math.sin(timeSec * star.freq + star.phase);
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillRect(star.x, star.y, 1.5, 1.5);
    }
    ctx.restore();
}

// --- Lluvia (Matrix) ---
function initRain() {
    bgRainColumns = [];
    const numColumns = 15;
    const colSpacing = GAME_WIDTH / numColumns;
    for (let i = 0; i < numColumns; i++) {
        bgRainColumns.push({
            x: (i * colSpacing) + Math.random() * 20,
            chars: [],
            speed: 2 + Math.random() * 3,
            nextCharTimer: 0
        });
    }
}
function updateRain(dt) {
    for (let i = 0; i < bgRainColumns.length; i++) {
        const col = bgRainColumns[i];
        
        // Mover caracteres existentes
        for (let j = 0; j < col.chars.length; j++) {
            col.chars[j].y += col.speed * dt;
        }
        
        // Eliminar caracteres fuera de la pantalla
        col.chars = col.chars.filter(c => c.y < GAME_HEIGHT + 20);
        
        // Añadir nuevos caracteres periódicamente
        col.nextCharTimer -= dt;
        if (col.nextCharTimer <= 0) {
            // El Y del nuevo caracter siempre es el más alto (menor valor), o desde arriba si no hay
            let topY = col.chars.length > 0 ? col.chars[col.chars.length - 1].y - 12 : -10;
            if (topY > 0 && col.chars.length === 0) topY = -10; // Resetear si la columna está vacía
            
            const randomHex = Math.floor(Math.random() * 16).toString(16).toUpperCase();
            col.chars.push({ char: randomHex, y: topY });
            col.nextCharTimer = 3 + Math.random() * 4; // Ajustar la densidad vertical
        }
        
        // Si el último caracter de la cola pasa el fondo, reiniciamos arriba para un flujo continuo
        if (col.chars.length === 0 || col.chars[0].y > GAME_HEIGHT * 1.5) {
            col.chars = [];
            col.nextCharTimer = 0;
        }
    }
}
function renderRain(ctx) {
    ctx.save();
    const themeColor = typeof currentThemeHex === 'function' ? currentThemeHex() : '#22c55e';
    ctx.fillStyle = themeColor;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    
    for (let i = 0; i < bgRainColumns.length; i++) {
        const col = bgRainColumns[i];
        for (let j = 0; j < col.chars.length; j++) {
            const charObj = col.chars[j];
            // Alpha desvanece de arriba hacia abajo de la columna en sí
            // j = 0 es el caracter más bajo (más viejo)
            const pct = j / Math.max(1, col.chars.length - 1);
            ctx.globalAlpha = 0.05 + (0.45 * pct);
            ctx.fillText(charObj.char, col.x, charObj.y);
        }
    }
    ctx.restore();
}

// --- Aurora ---
function initAurora() {
    bgAuroraWaves = [];
    const themeColor = typeof currentThemeHex === 'function' ? currentThemeHex() : '#22c55e';
    for (let i = 0; i < 4; i++) {
        bgAuroraWaves.push({
            phase: Math.random() * Math.PI * 2,
            freq: 0.001 + Math.random() * 0.002,
            amplitude: 50 + Math.random() * 100,
            yBase: 100 + Math.random() * 400,
            color: themeColor
        });
    }
}
function updateAurora(dt) {
    for (let i = 0; i < bgAuroraWaves.length; i++) {
        bgAuroraWaves[i].phase += bgAuroraWaves[i].freq * dt * 10; // 10 es factor de velocidad suave
    }
}
function renderAurora(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.04;
    // Las auroras se dibujan con iteraciones a lo ancho
    for (let i = 0; i < bgAuroraWaves.length; i++) {
        const wave = bgAuroraWaves[i];
        ctx.fillStyle = wave.color;
        
        ctx.beginPath();
        for (let x = 0; x <= GAME_WIDTH; x += 20) {
            const y = wave.yBase + Math.sin(x * 0.005 + wave.phase) * wave.amplitude;
            // Dibujar rectángulo suave simulando parte de la onda
            ctx.fillRect(x, y, 20, 150);
        }
    }
    ctx.restore();
}

const BG_RENDERERS = {
    none:   { init: ()=>{}, update: ()=>{}, render: ()=>{} },
    stars:  { init: initStars,  update: updateStars,  render: renderStars },
    rain:   { init: initRain,   update: updateRain,   render: renderRain },
    aurora: { init: initAurora, update: updateAurora, render: renderAurora }
};

// ==========================================
// 3. RENDERIZADORES DE PALETAS (PADDLES)
// ==========================================

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

function drawPaddleClassic(ctx, x, y, w, h, color) {
    ctx.save();
    ctx.fillStyle = color;
    roundRectHelper(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.restore();
}

function drawPaddlePixel(ctx, x, y, w, h, color) {
    ctx.save();
    ctx.fillStyle = color;
    // Draw in 5x5 blocks
    const blockSize = 5;
    for(let i = 0; i < w; i += blockSize) {
        for(let j = 0; j < h; j += blockSize) {
            // Remove some corner blocks to look like an 8-bit oval
            if ((i < blockSize || i >= w - blockSize) && (j < blockSize || j >= h - blockSize)) continue;
            // Checkerboard pattern inside
            if ((i/blockSize + j/blockSize) % 2 === 0) {
                ctx.fillStyle = color;
            } else {
                ctx.fillStyle = '#ffffff';
            }
            ctx.fillRect(x + i, y + j, blockSize, blockSize);
        }
    }
    ctx.restore();
}

function drawPaddleGradient(ctx, x, y, w, h, color) {
    ctx.save();
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#ff0000');
    grad.addColorStop(0.33, '#00ff00');
    grad.addColorStop(0.66, '#0000ff');
    grad.addColorStop(1, '#ffff00');
    ctx.fillStyle = grad;
    roundRectHelper(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.restore();
}

function drawPaddleNeon(ctx, x, y, w, h, color) {
    ctx.save();
    // Resplandor intenso
    const glow = 15 + 10 * Math.sin(Date.now() / 200);
    ctx.shadowBlur = glow;
    ctx.shadowColor = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    
    // Contorno
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, 6) : roundRectHelper(ctx, x, y, w, h, 6);
    ctx.stroke();

    // Relleno transparente
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.fill();

    ctx.restore();
}

function drawPaddleSlim(ctx, x, y, w, h, color) {
    ctx.save();
    ctx.fillStyle = color;
    const slimW = w * 0.65;
    const offsetX = (w - slimW) / 2;
    roundRectHelper(ctx, x + offsetX, y, slimW, h, 6);
    ctx.fill();
    ctx.restore();
}

const PADDLE_RENDERERS = {
    classic:      drawPaddleClassic,
    pixel:        drawPaddlePixel,
    gradient:     drawPaddleGradient,
    neon_paddle:  drawPaddleNeon,
    slim:         drawPaddleSlim
};

// ==========================================
// 4. EFECTOS DE GOL (GOAL EFFECTS)
// ==========================================

function triggerGoalClassic(goalX, goalY) {
    // No hace nada extra
}
function updateGoalClassic(dt) {}
function renderGoalClassic(ctx) {}

function triggerGoalFlash(goalX, goalY) {
    goalFlashAlpha = 0.3;
    goalSlowmoTimer = 300;
}
function updateGoalFlash(dt) {
    // Moved to global updateGoalVFX to avoid leaks
}
function renderGoalFlash(ctx) {
    if (goalFlashAlpha > 0) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = goalFlashAlpha;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.restore();
    }
}

function triggerGoalConfetti(goalX, goalY) {
    confettiParticles = [];
    const colors = ['#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff','#ffffff'];
    for (let i = 0; i < 50; i++) {
        confettiParticles.push({
            x: goalX,
            y: goalY,
            dx: (Math.random() - 0.5) * 6, // de -3 a 3
            dy: -1 - Math.random() * 5,    // de -6 a -1
            gravity: 0.15,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 1.0,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.4
        });
    }
}
function updateGoalConfetti(dt) {
    for (let i = confettiParticles.length - 1; i >= 0; i--) {
        const p = confettiParticles[i];
        p.x += p.dx * dt;
        p.y += p.dy * dt;
        p.dy += p.gravity * dt;
        p.rotation += p.rotSpeed * dt;
        p.life -= 0.01 * dt; // Decremento de vida
        if (p.life <= 0) {
            confettiParticles.splice(i, 1);
        }
    }
}
function renderGoalConfetti(ctx) {
    for (let i = 0; i < confettiParticles.length; i++) {
        const p = confettiParticles[i];
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-1.5, -3, 3, 6);
        ctx.restore();
    }
}

function triggerGoalShockwave(goalX, goalY) {
    shockwave = {
        x: goalX,
        y: GAME_HEIGHT / 2, // Se especifica que empiece a la mitad de la altura
        radius: 10,
        maxRadius: 500,
        alpha: 0.6
    };
}
function updateGoalShockwave(dt) {
    if (shockwave) {
        shockwave.radius += 8 * dt;
        // El alpha decrece de manera proporcional al radio
        shockwave.alpha = 0.6 * (1 - (shockwave.radius / shockwave.maxRadius));
        if (shockwave.alpha <= 0 || shockwave.radius >= shockwave.maxRadius) {
            shockwave = null;
        }
    }
}
function renderGoalShockwave(ctx) {
    if (shockwave && shockwave.alpha > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(shockwave.x, shockwave.y, shockwave.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.globalAlpha = shockwave.alpha;
        ctx.stroke();
        ctx.restore();
    }
}

const GOAL_FX = {
    classic:     { trigger: triggerGoalClassic,    update: updateGoalClassic,    render: renderGoalClassic },
    epic_flash:  { trigger: triggerGoalFlash,      update: updateGoalFlash,      render: renderGoalFlash },
    confetti:    { trigger: triggerGoalConfetti,   update: updateGoalConfetti,   render: renderGoalConfetti },
    shockwave:   { trigger: triggerGoalShockwave,  update: updateGoalShockwave,  render: renderGoalShockwave }
};

// ==========================================
// 5. FUNCIONES API PÚBLICAS
// ==========================================

function initVFX() {
    const bgId = (typeof playerProgression !== 'undefined' && playerProgression.selectedBg) ? playerProgression.selectedBg : 'none';
    currentBgId = bgId;
    if (BG_RENDERERS[bgId]) {
        BG_RENDERERS[bgId].init();
    }
}

function updateVFX(dt) {
    // Actualizar fondo si el renderizador activo lo requiere
    if (BG_RENDERERS[currentBgId]) {
        BG_RENDERERS[currentBgId].update(dt);
    }
    // Actualizar efectos de gol
    updateGoalVFX(dt);
}

function renderBackground(ctx) {
    if (BG_RENDERERS[currentBgId]) {
        BG_RENDERERS[currentBgId].render(ctx);
    }
}

function renderBallTrail(ctx, trail, radius) {
    let color = '#ffffff';
    if (typeof currentThemeHex === 'function') {
        color = currentThemeHex();
    }
    
    let trailId = 'default';
    if (typeof playerProgression !== 'undefined' && playerProgression.selectedTrail) {
        trailId = playerProgression.selectedTrail;
    }
    
    if (TRAIL_RENDERERS[trailId]) {
        TRAIL_RENDERERS[trailId](ctx, trail, radius, color);
    } else {
        TRAIL_RENDERERS['default'](ctx, trail, radius, color);
    }
}

function renderPaddleVFX(ctx, x, y, w, h, color) {
    let paddleId = 'classic';
    if (typeof playerProgression !== 'undefined' && playerProgression.selectedPaddle) {
        paddleId = playerProgression.selectedPaddle;
    }
    
    if (PADDLE_RENDERERS[paddleId]) {
        PADDLE_RENDERERS[paddleId](ctx, x, y, w, h, color);
    } else {
        PADDLE_RENDERERS['classic'](ctx, x, y, w, h, color);
    }
}

function triggerGoalVFX(goalX, goalY) {
    let fxId = 'classic';
    if (typeof playerProgression !== 'undefined' && playerProgression.selectedGoalFx) {
        fxId = playerProgression.selectedGoalFx;
    }
    
    if (GOAL_FX[fxId]) {
        GOAL_FX[fxId].trigger(goalX, goalY);
    }
}

function updateGoalVFX(dt) {
    let fxId = 'classic';
    if (typeof playerProgression !== 'undefined' && playerProgression.selectedGoalFx) {
        fxId = playerProgression.selectedGoalFx;
    }
    
    if (GOAL_FX[fxId]) {
        GOAL_FX[fxId].update(dt);
    }
    
    // Always update global timers to avoid leaks if effect is switched mid-animation
    if (goalSlowmoTimer > 0) {
        goalSlowmoTimer -= dt * (1000 / 60);
        if (goalSlowmoTimer < 0) goalSlowmoTimer = 0;
    }
    if (goalFlashAlpha > 0) {
        goalFlashAlpha -= 0.02 * dt;
        if (goalFlashAlpha < 0) goalFlashAlpha = 0;
    }
}

function renderGoalVFX(ctx) {
    let fxId = 'classic';
    if (typeof playerProgression !== 'undefined' && playerProgression.selectedGoalFx) {
        fxId = playerProgression.selectedGoalFx;
    }
    
    if (GOAL_FX[fxId]) {
        GOAL_FX[fxId].render(ctx);
    }
}

function getGoalSlowmo() {
    return goalSlowmoTimer > 0 ? 0.3 : 1.0;
}

function setActiveTrail(id) {
    if (TRAIL_RENDERERS[id]) {
        currentTrailId = id;
    }
}

function setActiveBg(id) {
    if (BG_RENDERERS[id]) {
        currentBgId = id;
        BG_RENDERERS[id].init();
    }
}

function setActivePaddle(id) {
    if (PADDLE_RENDERERS[id]) {
        currentPaddleId = id;
    }
}

function setActiveGoalFx(id) {
    if (GOAL_FX[id]) {
        currentGoalFxId = id;
    }
}
