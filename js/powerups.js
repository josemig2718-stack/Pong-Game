// Tipos de power-ups disponibles en el juego
const POWERUP_TYPES = [
    { id: 'paddle_xl',    emoji: '⬆️', name: 'Paleta XL',     color: '#22c55e', duration: 8000,  weight: 20 },
    { id: 'paddle_mini',  emoji: '⬇️', name: 'Paleta Mini',   color: '#a855f7', duration: 8000,  weight: 20 },
    { id: 'big_ball',     emoji: '🔴', name: 'Bola Gigante',  color: '#ef4444', duration: 6000,  weight: 15 },
    { id: 'turbo',        emoji: '⚡', name: 'Turbo',         color: '#eab308', duration: 0,     weight: 15 },
    { id: 'shield',       emoji: '🛡️', name: 'Escudo',        color: '#3b82f6', duration: 5000,  weight: 10 },
    { id: 'slowmo',       emoji: '🌀', name: 'Cámara Lenta',  color: '#f97316', duration: 4000,  weight: 10 },
    { id: 'multi_ball',   emoji: '✨', name: 'Multi-Bola',    color: '#ffffff', duration: 0,     weight: 10 }
];

// Variables de estado del sistema de power-ups
let activePowerup = null;       // { type, x, y, spawnTime, maxLifetime }
let activeEffect = null;        // { type, target, remainingMs, originalValues: {} }
let powerupCooldownMs = 0;      // Tiempo hasta el próximo intento de aparición
let shieldWall = null;          // { x, y, width, height, owner }
let lastHitter = 'p1';          // Último jugador en golpear la pelota ('p1' o 'p2')
let totalPowerupsCollected = 0; // Contador de sesión para estadísticas
let powerupsThisGame = 0;       // Contador por partida (para logros)
let slowmoActive = false;       // Indica si la cámara lenta está activa

/**
 * Inicializa o reinicia el sistema de power-ups al empezar una partida
 */
function initPowerups() {
    activePowerup = null;
    activeEffect = null;
    shieldWall = null;
    slowmoActive = false;
    lastHitter = 'p1';
    powerupsThisGame = 0;
    // Tiempo inicial aleatorio entre 8 y 15 segundos
    powerupCooldownMs = 8000 + Math.random() * 7000;
}

/**
 * Actualiza la lógica de los power-ups (aparición, expiración, colisiones)
 * @param {number} dt Delta time normalizado a 60 FPS
 */
function updatePowerups(dt) {
    if (typeof settings !== 'undefined' && !settings.powerupsEnabled) return;
    if (typeof isPaused !== 'undefined' && isPaused) return;
    if (typeof isPlaying !== 'undefined' && !isPlaying) return;

    const dtMs = dt * (1000 / 60);
    const timeNow = Date.now();

    // 1. Manejo del cooldown y aparición
    if (!activePowerup && !activeEffect) {
        powerupCooldownMs -= dtMs;
        if (powerupCooldownMs <= 0 && (typeof serveCountdownMs === 'undefined' || serveCountdownMs <= 0)) {
            spawnPowerup();
        }
    }

    // 2. Lógica del power-up en el campo
    if (activePowerup) {
        // Verificar si ha expirado
        if (timeNow - activePowerup.spawnTime > activePowerup.maxLifetime) {
            activePowerup = null;
            // Nuevo cooldown tras desaparecer
            powerupCooldownMs = 8000 + Math.random() * 7000;
        } else if (typeof balls !== 'undefined') {
            // Comprobar colisiones con todas las pelotas
            for (let i = 0; i < balls.length; i++) {
                const b = balls[i];
                if (powerupCollision(b.x, b.y, b.radius, activePowerup.x, activePowerup.y, 22)) {
                    collectPowerup(i);
                    break; // Solo puede ser recogido por una pelota a la vez
                }
            }
        }
    }

    // 3. Lógica de los efectos activos
    if (activeEffect) {
        activeEffect.remainingMs -= dtMs;
        if (activeEffect.remainingMs <= 0) {
            revertPowerup();
        }
    }

    // 4. Lógica del escudo
    if (shieldWall && typeof balls !== 'undefined') {
        for (let i = 0; i < balls.length; i++) {
            const b = balls[i];
            // Detección de colisión AABB simple
            if (b.x + b.radius > shieldWall.x && 
                b.x - b.radius < shieldWall.x + shieldWall.width &&
                b.y + b.radius > shieldWall.y && 
                b.y - b.radius < shieldWall.y + shieldWall.height) {
                
                // Rebotar y reposicionar para evitar que se quede pegado
                b.dx *= -1;
                if (shieldWall.owner === 'p1') {
                    b.x = shieldWall.x + shieldWall.width + b.radius;
                } else {
                    b.x = shieldWall.x - b.radius;
                }
                
                // Efecto de sonido si existe
                if (typeof soundEffects !== 'undefined' && soundEffects.paddleHit) {
                    soundEffects.paddleHit();
                }
            }
        }
    }
}

/**
 * Hace aparecer un nuevo power-up en el campo de forma aleatoria
 */
function spawnPowerup() {
    // Selección ponderada
    let totalWeight = POWERUP_TYPES.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedType = POWERUP_TYPES[0];

    for (const p of POWERUP_TYPES) {
        if (random < p.weight) {
            selectedType = p;
            break;
        }
        random -= p.weight;
    }

    // Posición aleatoria en la zona central
    activePowerup = {
        type: selectedType,
        x: 200 + Math.random() * 400, // Entre 200 y 600
        y: 100 + Math.random() * 400, // Entre 100 y 500
        spawnTime: Date.now(),
        maxLifetime: 12000 // 12 segundos antes de desaparecer
    };

    if (typeof soundEffects !== 'undefined' && soundEffects.powerupSpawn) {
        soundEffects.powerupSpawn();
    }
}

/**
 * Recoge el power-up activo y aplica su efecto
 * @param {number} collectorBallIndex Índice de la pelota en el arreglo
 */
function collectPowerup(collectorBallIndex) {
    if (!activePowerup) return;

    const type = activePowerup.type;
    const beneficiary = lastHitter; // 'p1' o 'p2'

    // Partículas y sonido
    if (typeof spawnParticles !== 'undefined') {
        spawnParticles(activePowerup.x, activePowerup.y, type.color, 20);
    }
    if (typeof soundEffects !== 'undefined' && soundEffects.powerupCollect) {
        soundEffects.powerupCollect();
    }

    // Actualizar contadores
    totalPowerupsCollected++;
    powerupsThisGame++;

    // Aplicar efecto
    applyPowerup(type, beneficiary);

    // Limpiar entidad de power-up y establecer nuevo cooldown
    activePowerup = null;
    powerupCooldownMs = 8000 + Math.random() * 7000;
}

/**
 * Aplica los efectos del power-up a los jugadores o la pelota
 * @param {Object} type Tipo de power-up (de POWERUP_TYPES)
 * @param {string} beneficiary 'p1' o 'p2'
 */
function applyPowerup(type, beneficiary) {
    const rival = beneficiary === 'p1' ? 'p2' : 'p1';
    
    // Preparar el estado del efecto si tiene duración
    if (type.duration > 0) {
        activeEffect = {
            type: type,
            target: beneficiary,
            remainingMs: type.duration,
            originalValues: {}
        };
    }

    switch (type.id) {
        case 'paddle_xl':
            const targetPaddle = beneficiary === 'p1' ? p1 : p2;
            activeEffect.originalValues.height = targetPaddle.height;
            targetPaddle.height = (typeof paddleHeight !== 'undefined' ? paddleHeight : 100) * 1.6;
            break;

        case 'paddle_mini':
            const rivalPaddle = rival === 'p1' ? p1 : p2;
            activeEffect.target = rival; // El objetivo visual es el rival
            activeEffect.originalValues.height = rivalPaddle.height;
            rivalPaddle.height = (typeof paddleHeight !== 'undefined' ? paddleHeight : 100) * 0.6;
            break;

        case 'big_ball':
            activeEffect.target = rival; // Cuenta como efecto negativo visualmente
            activeEffect.originalValues.radius = balls[0].radius; // Asume que todas tienen el mismo radio base
            if (typeof balls !== 'undefined') {
                balls.forEach(b => b.radius = 27); // 9 * 3 = 27
            }
            break;

        case 'turbo':
            if (typeof balls !== 'undefined') {
                balls.forEach(b => {
                    b.dx *= 1.4;
                    b.dy *= 1.4;
                });
            }
            break;

        case 'shield':
            if (beneficiary === 'p1') {
                shieldWall = { x: 50, y: 0, width: 8, height: GAME_HEIGHT, owner: 'p1' };
            } else {
                shieldWall = { x: GAME_WIDTH - 58, y: 0, width: 8, height: GAME_HEIGHT, owner: 'p2' };
            }
            break;

        case 'slowmo':
            slowmoActive = true;
            break;

        case 'multi_ball':
            if (typeof spawnExtraBalls !== 'undefined') {
                spawnExtraBalls();
            }
            break;
    }
}

/**
 * Revierte los efectos activos y restaura valores originales
 */
function revertPowerup() {
    if (!activeEffect) return;
    
    const type = activeEffect.type;
    
    switch (type.id) {
        case 'paddle_xl':
        case 'paddle_mini':
            const targetPaddle = activeEffect.target === 'p1' ? p1 : p2;
            targetPaddle.height = activeEffect.originalValues.height;
            break;
            
        case 'big_ball':
            if (typeof balls !== 'undefined') {
                balls.forEach(b => b.radius = activeEffect.originalValues.radius);
            }
            break;
            
        case 'shield':
            shieldWall = null;
            break;
            
        case 'slowmo':
            slowmoActive = false;
            break;
    }

    if (typeof soundEffects !== 'undefined' && soundEffects.powerupExpire) {
        soundEffects.powerupExpire();
    }

    activeEffect = null;
}

/**
 * Fuerza los efectos activos sobre las bolas (útil después de un resetBall)
 */
function enforcePowerups() {
    if (!activeEffect) return;
    if (activeEffect.type.id === 'big_ball' && typeof balls !== 'undefined') {
        balls.forEach(b => b.radius = 27);
    }
}

/**
 * Establece el último jugador en golpear la pelota
 * @param {string} player 'p1' o 'p2'
 */
function setLastHitter(player) {
    lastHitter = player;
}

/**
 * Retorna el multiplicador de tiempo para la cámara lenta
 * @returns {number} 0.5 si está activo, 1.0 si no
 */
function getSlowmoMultiplier() {
    return slowmoActive ? 0.5 : 1.0;
}

/**
 * Ayudante para comprobar colisiones circulares
 */
function powerupCollision(bx, by, bradius, px, py, pradius) {
    const dx = bx - px;
    const dy = by - py;
    return Math.sqrt(dx * dx + dy * dy) < bradius + pradius;
}

/**
 * Renderiza el power-up en el campo de juego
 * @param {CanvasRenderingContext2D} ctx Contexto 2D del canvas
 * @param {string} themeColor Color principal del tema (opcional)
 */
function renderPowerup(ctx, themeColor) {
    if (!activePowerup) return;

    const lifetimeMs = Date.now() - activePowerup.spawnTime;
    const remainingTime = activePowerup.maxLifetime - lifetimeMs;

    // Parpadeo cuando queda poco tiempo (< 2000ms)
    if (remainingTime < 2000 && Math.floor(Date.now() / 200) % 2 === 0) {
        return;
    }

    const x = activePowerup.x;
    const y = activePowerup.y;
    const radius = 22;
    const type = activePowerup.type;

    ctx.save();
    
    // Efecto de pulso en la escala
    const scale = 1.0 + 0.1 * Math.sin(Date.now() / 300);
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Configurar resplandor
    ctx.shadowBlur = 15;
    ctx.shadowColor = type.color;

    // Dibujar hexágono
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - (Math.PI / 6);
        const hx = radius * Math.cos(angle);
        const hy = radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
    }
    ctx.closePath();

    // Relleno al 20% de opacidad
    ctx.fillStyle = type.color + '33'; // 33 en hex es ~20%
    ctx.fill();

    // Borde al 80% de opacidad
    ctx.lineWidth = 2;
    ctx.strokeStyle = type.color + 'CC'; // CC en hex es ~80%
    ctx.stroke();

    // Dibujar emoji
    ctx.shadowBlur = 0; // Quitar resplandor para el texto
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type.emoji, 0, 0);

    ctx.restore();
}

/**
 * Renderiza el indicador de efecto activo en la interfaz
 * @param {CanvasRenderingContext2D} ctx Contexto 2D
 * @param {number} canvasWidth Ancho del canvas
 */
function renderActiveEffectHUD(ctx, canvasWidth) {
    if (!activeEffect || activeEffect.type.duration === 0) return;

    const progress = activeEffect.remainingMs / activeEffect.type.duration;
    const width = 80;
    const height = 20;
    const padding = 20;
    
    // Determinar posición (izquierda p1, derecha p2)
    let x, y = padding;
    if (activeEffect.target === 'p1') {
        x = padding;
    } else {
        x = canvasWidth - width - padding;
    }

    ctx.save();
    
    // Fondo de la barra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, width, height);

    // Relleno de la barra (progreso)
    ctx.fillStyle = activeEffect.type.color;
    ctx.fillRect(x, y, width * progress, height);

    // Borde
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    // Emoji
    ctx.font = '16px Arial';
    ctx.textAlign = activeEffect.target === 'p1' ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    
    const emojiX = activeEffect.target === 'p1' ? x + width + 5 : x - 5;
    ctx.fillText(activeEffect.type.emoji, emojiX, y + height / 2);

    ctx.restore();
}

/**
 * Renderiza el escudo si está activo
 * @param {CanvasRenderingContext2D} ctx Contexto 2D
 * @param {string} themeColor Color principal del tema
 */
function renderShield(ctx, themeColor) {
    if (!shieldWall) return;

    ctx.save();
    
    // Resplandor
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#3b82f6'; // Color del escudo
    
    // Relleno con transparencia y posible animación de pulso sutil
    const opacity = 0.3 + 0.05 * Math.sin(Date.now() / 150);
    ctx.fillStyle = `rgba(59, 130, 246, ${opacity})`;
    
    ctx.fillRect(shieldWall.x, shieldWall.y, shieldWall.width, shieldWall.height);
    
    ctx.restore();
}
