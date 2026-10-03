/**
 * game.js
 * ------------------------------------------------------------------
 * Física con delta-time, bucle principal y renderizado en <canvas>.
 * Soporta multi-bola, power-ups, VFX y sistema de progresión.
 * El estado de la partida y las paletas viven en state.js.
 * ------------------------------------------------------------------
 */

'use strict';

const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

let animationFrameId;
let lastTimestamp = 0;

// Duración de la cuenta regresiva antes de que la bola se mueva (ms)
const SERVE_INITIAL = 3000;    // 3 segundos al iniciar partida
const SERVE_AFTER_GOAL = 3000; // 3 segundos tras cada punto

// Puntos que guarda la estela de cada bola
const MAX_TRAIL = 25;

const net = { x: GAME_WIDTH / 2 - 2, width: 4, height: 16 };

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
    if (!settings.mouseControl || !state.isPlaying || state.isPaused || !mouseActive) return;

    // La arena rotada (El Creador) mueve la paleta en X: si solo se
    // escribiera touchY, el mouse no controlaría nada en ese combate.
    if (bossIsRotatedArena()) {
        const canvasX = touchToCanvasX(e.clientX);
        p1.touchX = Math.max(0, Math.min(GAME_WIDTH - p1.width, canvasX - p1.width / 2));
        p1.touchY = null;
    } else {
        const canvasY = touchToCanvasY(e.clientY);
        p1.touchY = Math.max(0, Math.min(GAME_HEIGHT - p1.height, canvasY - p1.height / 2));
        p1.touchX = null;
    }
});

// Al desactivar el mouse control, soltar la paleta en ambos ejes: dejar
// touchX puesto la mantendría pegada e ignoraría el teclado.
function clearMouseControl() {
    if (mouseActive) {
        p1.touchY = null;
        p1.touchX = null;
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

    state.mode = mode;
    state.p1Score = 0;
    state.p2Score = 0;
    state.particles = [];

    // Restaurar geometría original de las paletas. Hay que reponer también
    // width y x: la arena rotada del Creador convierte a p1 en una paleta
    // horizontal centrada, y si no se deshace queda un cuadrado en mitad
    // del campo en la siguiente partida.
    p1.width = paddleWidth;
    p1.height = paddleHeight;
    p1.x = 24;
    p2.width = paddleWidth;
    p2.height = paddleHeight;
    p2.x = GAME_WIDTH - 24 - paddleWidth;

    p1.y = GAME_HEIGHT / 2 - p1.height / 2;
    p2.y = GAME_HEIGHT / 2 - p2.height / 2;
    p1.dy = 0;
    p2.dy = 0;
    p1.touchY = null;
    p2.touchY = null;
    p1.touchX = null;   // si no se limpia, la paleta horizontal queda pegada al repetir
    p2.touchX = null;
    resetTouchHints();

    state.isPlaying = true;
    state.isPaused = false;

    // Limpiar cualquier diálogo de campaña que quedara de la partida anterior
    stopDialogue();
    resetMidDialogue();

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));

    const container = document.getElementById('game-container');
    container.classList.remove('hidden');
    container.classList.add('flex');

    let badgeText = 'VS CPU';
    if (mode === 'hachepe') badgeText = 'HACHEPE';
    if (mode === 'local') badgeText = 'LOCAL · 2 JUGADORES';
    if (mode === 'campaign') badgeText = 'CAMPAÑA: ' + HACHEPES_LORE[currentCampaignLevel].name;
    document.getElementById('mode-badge').textContent = badgeText;
    document.body.dataset.gameMode = mode;

    const hachepeChars = document.getElementById('hachepe-characters');
    if (hachepeChars) {
        if (mode === 'hachepe') hachepeChars.classList.remove('hidden');
        else hachepeChars.classList.add('hidden');
    }

    // Resetear mecánicas de jefes: siempre se apaga todo, y el jefe en
    // curso (si lo hay) arma lo suyo en bossInit().
    p2Twin.active = false;
    p2Twin.retreatMs = 0;
    bossInit();

    resizeCanvas();
    resetBall(true);

    // Inicializar power-ups
    initPowerups();

    // Inicializar VFX
    initVFX();

    // Estadísticas
    statsOnGameStart();

    // Progresión: resetear trackers de sesión
    resetSessionTrackers();

    // Música
    stopMenuMusic();
    playGameplayMusic(mode);

    cancelAnimationFrame(animationFrameId);
    lastTimestamp = 0;
    animationFrameId = requestAnimationFrame(gameLoop);
}

function restartCurrentGame() {
    startGame(state.mode);
}

function quitGame() {
    state.isPlaying = false;
    cancelAnimationFrame(animationFrameId);

    // Cortar diálogos de campaña en curso
    stopDialogue();
    resetMusicRate();

    // Restaurar paletas (incluida la posición si la arena estaba rotada)
    p1.height = paddleHeight;
    p1.width = paddleWidth;
    p1.x = 24;
    p2.height = paddleHeight;
    p2.width = paddleWidth;

    // Música
    stopGameplayMusic();
    playMenuMusic();

    const hachepeChars = document.getElementById('hachepe-characters');
    if (hachepeChars) hachepeChars.classList.add('hidden');

    showScreen('main-menu');
}

function togglePause() {
    if (!state.isPlaying) return;
    state.isPaused = !state.isPaused;
    if (state.isPaused) {
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

    let dx = dir * speed;
    
    if (bossIsRotatedArena()) {
        // Arena rotada (El Creador): la bola cae y la paleta pasa a horizontal abajo
        dy = speed;
        dx = (Math.random() * 2 - 1) * speed * 0.5;
        p1.width = 100;
        p1.height = 15;
        p1.x = GAME_WIDTH / 2 - p1.width / 2;
        p1.y = GAME_HEIGHT - 30;
    }

    const newBall = createBall(GAME_WIDTH / 2, GAME_HEIGHT / 2, speed, dx, dy);
    state.balls = [newBall];

    // Congela la bola en el centro durante la cuenta regresiva
    state.serveCountdownMs = initialServe ? SERVE_INITIAL : SERVE_AFTER_GOAL;
    
    // Mantener power-ups persistentes (ej. bola gigante)
    enforcePowerups();
}

/** Función para generar bolas extra (Multi-Bola power-up) */
function spawnExtraBalls() {
    if (state.balls.length === 0) return;
    const source = state.balls[0];
    const count = Math.random() > 0.5 ? 2 : 1; // duplicar o triplicar

    soundEffects.multiBallSplit();

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
        state.balls.push(extra);
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
        state.particles.push({
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
    state.shakeIntensity = intensity;
    state.shakeTimeMs = durationMs;
}

// --- Actualización con delta-time ---
function update(dt) {
    if (isDialogueActive) {
        return; // Pausa completa del juego mientras hay un diálogo
    }
    // Aplicar slowmo de power-ups y VFX de gol
    let slowmo = 1.0;
    slowmo = Math.min(slowmo, getSlowmoMultiplier());
    slowmo = Math.min(slowmo, getGoalSlowmo());
    dt *= slowmo;

    const speedPreset = BALL_SPEED_PRESETS[settings.ballSpeed] || BALL_SPEED_PRESETS[2];
    const maxBallSpeed = speedPreset.max;

    let playerDt = dt;

    // --- Mecánicas del jefe de campaña (bosses.js) ---
    bossUpdate(dt);

    // Yisus congela la paleta del jugador durante su parada de tiempo
    if (bossFreezesPlayer()) playerDt = 0;

    const bcfg = bossConfig();
    const rotatedArena = !!bcfg && bcfg.paddleAxis === 'x';

    // El Creador invierte los controles en su fase 2
    const invert = (bossInvertsControls()) ? -1 : 1;

    // --- Movimiento Jugador 1 ---
    if (rotatedArena) {
        // Arena rotada: la paleta se mueve en X. Se respetan las teclas
        // reasignadas (p1Up = izquierda, p1Down = derecha).
        if (p1.touchX !== undefined && p1.touchX !== null) {
            if (playerDt > 0) p1.x = p1.touchX;
        } else {
            if (isActionPressed('p1Up')) p1.dx = -paddleSpeed * invert;
            else if (isActionPressed('p1Down')) p1.dx = paddleSpeed * invert;
            else p1.dx = 0;
            p1.x += p1.dx * playerDt;
        }
    } else {
        if (p1.touchY !== null) {
            // En time stop el touch también se ignora o se mueve pero no tiene efecto físico
            if (playerDt > 0) p1.y = p1.touchY;
        } else {
            if (isActionPressed('p1Up')) p1.dy = -paddleSpeed;
            else if (isActionPressed('p1Down')) p1.dy = paddleSpeed;
            else p1.dy = 0;
            p1.y += p1.dy * playerDt;
        }
    }

    // --- Movimiento Jugador 2 / CPU ---
    if (state.mode === 'local') {
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
        if (bcfg) {
            // Cada jefe de campaña tiene su propia habilidad: esa es la curva
            // de dificultad que el lore promete (⭐⭐ a ⭐⭐⭐⭐⭐).
            aiSpeed = paddleSpeed * bcfg.aiSpeed;
            errorMargin = bcfg.aiError;
        } else if (state.mode === 'hachepe') {
            aiSpeed = paddleSpeed * 1.15; // Velocidad alta pero superable
            errorMargin = 10; // Un ligero margen de error
        } else {
            if (settings.difficulty === 1) { aiSpeed = paddleSpeed * 0.45; errorMargin = 30; }
            else if (settings.difficulty === 2) { aiSpeed = paddleSpeed * 0.65; errorMargin = 15; }
            else { aiSpeed = paddleSpeed * 0.95; errorMargin = 0; }
        }

        // La CPU persigue la bola más cercana que vaya hacia ella
        let targetBall = state.balls[0];
        let closestDist = Infinity;
        for (const b of state.balls) {
            if (b.dx > 0) { // va hacia la CPU
                const dist = Math.abs(b.x - p2.x);
                if (dist < closestDist) { closestDist = dist; targetBall = b; }
            }
        }
        if (!targetBall) targetBall = state.balls[0];

        const p2Center = p2.y + p2.height / 2;
        // Los jefes apuntan con un desvío que se renueva en cada golpe: sin él
        // la CPU es literalmente imbatible y el combate no termina nunca.
        const aim = bcfg ? bossAim() : 0;
        if (targetBall && targetBall.dx > 0) {
            const objetivo = targetBall.y + aim;
            if (p2Center < objetivo - errorMargin) p2.y += aiSpeed * dt;
            else if (p2Center > objetivo + errorMargin) p2.y -= aiSpeed * dt;
        } else {
            if (p2Center < GAME_HEIGHT / 2 - 5) p2.y += aiSpeed * 0.5 * dt;
            else if (p2Center > GAME_HEIGHT / 2 + 5) p2.y -= aiSpeed * 0.5 * dt;
        }

        // Lógica para el clon (Mario y Valen)
        if (p2Twin.active && p2Twin.retreatMs > 0) {
            // Retirado tras encajar gol: sale del campo por abajo. Esa es la
            // ventana del jugador para volver a anotar.
            p2Twin.y += paddleSpeed * 1.5 * dt;
        } else if (p2Twin.active) {
            const twinCenter = p2Twin.y + p2Twin.height / 2;
            
            // Valen (p2) cubrirá de la mitad de la cancha hacia arriba
            // Mario (p2Twin) cubrirá de la mitad de la cancha hacia abajo
            let twinSpeed = paddleSpeed * 1.25; // Mario es un poco más rápido pero solo cubre abajo
            
            if (targetBall && targetBall.dx > 0) {
                // Si la bola está en la mitad superior, Mario baja al centro para esperar
                if (targetBall.y < GAME_HEIGHT / 2) {
                    if (twinCenter < GAME_HEIGHT * 0.75 - 10) p2Twin.y += twinSpeed * dt;
                    else if (twinCenter > GAME_HEIGHT * 0.75 + 10) p2Twin.y -= twinSpeed * dt;
                } else {
                    // Si está en la mitad inferior, Mario ataca
                    if (twinCenter < targetBall.y - 10) p2Twin.y += twinSpeed * dt;
                    else if (twinCenter > targetBall.y + 10) p2Twin.y -= twinSpeed * dt;
                }
            } else {
                // Volver a posición default inferior
                if (twinCenter < GAME_HEIGHT * 0.75 - 10) p2Twin.y += twinSpeed * 0.5 * dt;
                else if (twinCenter > GAME_HEIGHT * 0.75 + 10) p2Twin.y -= twinSpeed * 0.5 * dt;
            }
            
            // Y Valen (p2) modifica su comportamiento para priorizar arriba
            if (targetBall && targetBall.dx > 0 && targetBall.y >= GAME_HEIGHT / 2) {
                // Si la bola va muy abajo, Valen se queda en el centro alto
                if (p2Center < GAME_HEIGHT * 0.25 - 10) p2.y += aiSpeed * dt;
                else if (p2Center > GAME_HEIGHT * 0.25 + 10) p2.y -= aiSpeed * dt;
            }
        }
    }

    // Límites de las paletas
    if (rotatedArena) {
        p1.x = Math.max(0, Math.min(GAME_WIDTH - p1.width, p1.x));
    } else {
        p1.y = Math.max(0, Math.min(GAME_HEIGHT - p1.height, p1.y));
    }
    p2.y = Math.max(0, Math.min(GAME_HEIGHT - p2.height, p2.y));
    if (p2Twin.active && p2Twin.retreatMs <= 0) {
        p2Twin.y = Math.max(0, Math.min(GAME_HEIGHT - p2Twin.height, p2Twin.y));
    }

    // --- Cuenta regresiva de saque ---
    if (state.serveCountdownMs > 0) {
        const prevSec = Math.ceil(state.serveCountdownMs / 1000);
        state.serveCountdownMs -= dt * (1000 / 60);
        if (state.serveCountdownMs < 0) state.serveCountdownMs = 0;
        const curSec = Math.ceil(state.serveCountdownMs / 1000);

        if (curSec !== prevSec && curSec > 0) {
            soundEffects.countdown();
        }
        if (state.serveCountdownMs <= 0) {
            soundEffects.go();
        }

        // Actualizar VFX y power-ups durante countdown (fondos animados)
        updateVFX(dt);

        return; // No mover la bola durante la cuenta regresiva
    }

    // --- Actualizar todas las bolas ---
    const ballsToRemove = [];

    for (let bi = 0; bi < state.balls.length; bi++) {
        const b = state.balls[bi];

        // Estela
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > MAX_TRAIL) b.trail.shift();

        // Mover bola
        b.x += b.dx * dt;
        b.y += b.dy * dt;

        const isLevel6 = rotatedArena;

        if (isLevel6) {
            // Rebote en paredes laterales
            if (b.x - b.radius < 0 || b.x + b.radius > GAME_WIDTH) {
                b.dx = -b.dx;
                b.x = Math.max(b.radius, Math.min(GAME_WIDTH - b.radius, b.x));
                soundEffects.wallHit();
                spawnParticles(b.x, b.y, currentThemeHex(), 6);
            }
            // Impacto contra el Creador (franja superior): le quita vida.
            // Ojo: NO toca state.p1Score — el marcador y el daño son cosas distintas.
            const bandaH = CREATOR_BAND_H;
            if (b.y - b.radius < bandaH) {
                b.dy = -b.dy;
                b.y = bandaH + b.radius;

                // Los tramos blindados rebotan sin recibir daño: hay que
                // apuntar al hueco en vez de repetir siempre el mismo golpe.
                const blindado = bossSegmentArmored(b.x);
                if (blindado) {
                    soundEffects.wallHit();
                    triggerShake(4, 120);
                    spawnParticles(b.x, b.y, '#9ca3af', 12);
                } else {
                    bossDamage((bcfg && bcfg.hitDamage) || 10);
                    soundEffects.score();
                    triggerShake(8, 200);
                    spawnParticles(b.x, b.y, '#ef4444', 20);
                }
                if (b.speed < maxBallSpeed) b.speed += 0.2;
            }
        } else {
            // Rebote en paredes superior/inferior normales
            if (b.y - b.radius < 0 || b.y + b.radius > GAME_HEIGHT) {
                b.dy = -b.dy;
                b.y = Math.max(b.radius, Math.min(GAME_HEIGHT - b.radius, b.y));
                soundEffects.wallHit();
                spawnParticles(b.x, b.y, currentThemeHex(), 6);
            }
        }

        // Obstáculos propios del jefe (escombros de Chemi, escudo de Dani)
        bossCollide(b);

        // Colisión con paletas
        let targetPaddle = (b.x + b.radius < GAME_WIDTH / 2) ? p1 : p2;
        if (isLevel6) targetPaddle = p1; // En la arena rotada solo existe p1 (abajo)

        // Comprobar colisión
        let hit = false;
        if (collision(b, targetPaddle)) {
            hit = true;
        } else if (!isLevel6 && p2Twin.active && p2Twin.retreatMs <= 0 && b.x + b.radius > GAME_WIDTH / 2 && collision(b, p2Twin)) {
            targetPaddle = p2Twin;
            hit = true;
        }

        if (hit) {
            if (isLevel6) {
                // Cálculo de rebote estilo Breakout (basado en X)
                let collidePoint = (b.x - (targetPaddle.x + targetPaddle.width / 2)) / (targetPaddle.width / 2);
                const angleRad = (Math.PI / 3) * collidePoint; // Max 60 grados
                
                b.dx = b.speed * Math.sin(angleRad);
                b.dy = -b.speed * Math.cos(angleRad); // Siempre hacia arriba
                if (b.speed < maxBallSpeed) b.speed += 0.5;
                
                b.y = targetPaddle.y - b.radius;
            } else {
                // Pong normal (basado en Y)
                let collidePoint = (b.y - (targetPaddle.y + targetPaddle.height / 2)) / (targetPaddle.height / 2);
                const angleRad = (Math.PI / 4) * collidePoint;
                const direction = (b.x + b.radius < GAME_WIDTH / 2) ? 1 : -1;
    
                b.dx = direction * b.speed * Math.cos(angleRad);
                b.dy = b.speed * Math.sin(angleRad);
                if (b.speed < maxBallSpeed) b.speed += 0.5;
    
                b.x = direction === 1 ? targetPaddle.x + targetPaddle.width + b.radius : targetPaddle.x - b.radius;
            }

            soundEffects.paddleHit();
            spawnParticles(b.x, b.y, '#ffffff', 16);
            triggerShake(4, 100);

            // Nuevo intercambio: el jefe recalcula su puntería
            bossRefreshAim();

            // Registrar último golpeador para power-ups
            setLastHitter(targetPaddle === p1 ? 'p1' : 'p2');

            // Estadísticas: contar golpe para rally
            statsOnPaddleHit();
        }

        // Puntuación (bola sale del campo)
        if (isLevel6) {
            if (b.y - b.radius > GAME_HEIGHT) {
                // El jugador falla: cuenta como fallo, no como punto del rival
                state.p2Score++;
                soundEffects.score();
                triggerShake(10, 260);
                triggerGoalVFX(b.x, GAME_HEIGHT);
                if (state.balls.length > 1) {
                    ballsToRemove.push(bi);
                    if (checkWin()) return;
                } else {
                    if (!checkWin()) resetBall(false);
                }
            }
            // La victoria se decide en checkWin() leyendo la barra de vida
            if (bossHealth() <= 0) {
                if (checkWin()) return;
            }
        } else if (b.x - b.radius < 0) {
            // CPU/P2 anota
            state.p2Score++;
            statsOnScore(false);
            bossOnGoal(false);
            checkMidDialogue();
            soundEffects.score();
            triggerShake(10, 260);
            // VFX de gol
            triggerGoalVFX(0, b.y);

            if (state.balls.length > 1) {
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
            state.p1Score++;
            statsOnScore(true);
            bossOnGoal(true);
            soundEffects.score();
            triggerShake(10, 260);
            triggerGoalVFX(GAME_WIDTH, b.y);

            if (state.balls.length > 1) {
                ballsToRemove.push(bi);
                if (checkWin()) return;
            } else {
                if (!checkWin()) resetBall(false);
            }
        }
    }

    // Eliminar bolas que salieron (de atrás hacia adelante para no alterar índices)
    for (let i = ballsToRemove.length - 1; i >= 0; i--) {
        state.balls.splice(ballsToRemove[i], 1);
    }

    // Si no quedan bolas (todas salieron en multi-bola), resetear
    if (state.balls.length === 0 && state.isPlaying) {
        resetBall(false);
    }


    // Actualizar power-ups
    updatePowerups(dt);

    // Actualizar VFX (fondos, efectos de gol)
    updateVFX(dt);

    // Partículas: física simple + desvanecimiento (con dt)
    state.particles.forEach(p => {
        p.x += p.dx * dt;
        p.y += p.dy * dt;
        p.life -= 0.04 * dt;
    });
    state.particles = state.particles.filter(p => p.life > 0);

    // Vibración de pantalla (basada en tiempo, no frames)
    if (state.shakeTimeMs > 0) {
        state.shakeTimeMs -= dt * (1000 / 60);
        if (state.shakeTimeMs < 0) state.shakeTimeMs = 0;
    }
}

function checkWin() {
    const bcfg = bossConfig();

    // Cada jefe de campaña tiene su propio marcador; el resto usa el de siempre.
    let target = settings.winningScore;
    if (bcfg) target = bcfg.targetScore;
    else if (state.mode === 'hachepe') target = 10;

    // Los jefes con barra de vida se ganan vaciándola, no por marcador: aquí
    // state.p2Score cuenta los fallos del jugador, no los puntos del rival.
    let p1Won, finished;
    if (bcfg && bcfg.useHealth) {
        const hp = bossHealth();
        p1Won = hp <= 0;
        finished = p1Won || state.p2Score >= target;
    } else {
        p1Won = state.p1Score >= target;
        finished = p1Won || state.p2Score >= target;
    }

    if (finished) {
        state.isPlaying = false;

        const gameOverScreen = document.getElementById('game-over-screen');
        const winnerText = document.getElementById('winner-text');
        const scoreText = document.getElementById('final-score');

        const btnNextCampaign = document.getElementById('btn-next-campaign');
        if (btnNextCampaign) btnNextCampaign.classList.add('hidden'); // Ocultar por defecto

        // ¿Este desenlace lo narra la campaña en vez de la pantalla de fin?
        // Vencer a Yisus dispara el falso final; vencer al Creador, el final real.
        let narrativeEnding = null;
        if (state.mode === 'campaign' && p1Won) {
            if (currentCampaignLevel === 5) narrativeEnding = 'finale';
            else if (currentCampaignLevel === 6) narrativeEnding = 'trueEnding';
        }

        if (state.mode === 'campaign') {
            winnerText.textContent = p1Won ? '¡DERROTASTE AL HACHEPE!' : 'HAS CAÍDO...';
            if (!narrativeEnding) p1Won ? soundEffects.win() : soundEffects.lose();

            // Diálogo de despedida del jefe (win/lose desde su punto de vista)
            playBossOutcomeDialogue(p1Won);

            if (p1Won) {
                handleCampaignVictory();
                // El botón solo aparece si de verdad hay un Hachepe siguiente
                // desbloqueado; si no, quedan "jugar de nuevo" y "menú".
                const siguiente = getNextCampaignBoss();
                if (btnNextCampaign && !narrativeEnding && siguiente) {
                    btnNextCampaign.classList.remove('hidden');
                }
            }
        } else if (state.mode === 'cpu' || state.mode === 'hachepe') {
            winnerText.textContent = p1Won ? '¡GANASTE!' : 'CPU GANA :(';
            p1Won ? soundEffects.win() : soundEffects.lose();
        } else {
            winnerText.textContent = p1Won ? 'JUGADOR 1 GANA' : 'JUGADOR 2 GANA';
            soundEffects.win();
        }

        scoreText.textContent = `${state.p1Score} - ${state.p2Score}`;
        // En los desenlaces narrados, la pantalla de fin se salta por completo
        if (!narrativeEnding) gameOverScreen.classList.add('active-screen');

        // Estadísticas y logros
        statsOnGameEnd(state.mode, p1Won, state.p1Score, state.p2Score);

        if (state.mode === 'hachepe' && p1Won) {
            unlockAchievement('beat_hachepe');
        }

        // Progresión: otorgar XP y Chemi Coins
        awardGameRewards(state.mode, p1Won, state.p1Score, state.p2Score);

        // Actualizar displays de progresión
        updateCoinDisplay();
        updateProgressionDisplay();

        // Restaurar paletas por si un power-up las alteró o la arena estaba rotada
        p1.width = paddleWidth;
        p1.height = paddleHeight;
        p1.x = 24;
        p2.height = paddleHeight;

        // Música
        stopGameplayMusic();

        // Encadenar la secuencia narrativa que corresponda
        if (narrativeEnding === 'finale') {
            runFinaleSequence();
        } else if (narrativeEnding === 'trueEnding') {
            runTrueEndingSequence();
        }
        return true;
    }
    return false;
}

// --- Renderizado ---
function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

function drawText(text, x, y, color, size) {
    ctx.fillStyle = color;
    ctx.font = `${size}px "Press Start 2P", cursive`;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
}

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

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawTrajectoryPreview(themeColor) {
    if (state.balls.length === 0) return;
    const b = state.balls[0];
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

    const isLevel6 = bossIsRotatedArena();

    if (!isLevel6) {
        drawNet(themeColor);
        // Marcador
        drawText(state.p1Score, GAME_WIDTH / 4, 80, themeColor, 60);
        drawText(state.p2Score, 3 * GAME_WIDTH / 4, 80, themeColor, 60);
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
    if (!isLevel6) renderPaddleVFX(ctx, p2.x, p2.y, p2.width, p2.height, '#ffffff');
    if (!isLevel6 && p2Twin.active) renderPaddleVFX(ctx, p2Twin.x, p2Twin.y, p2Twin.width, p2Twin.height, '#ef4444');


    // Power-ups
    renderPowerup(ctx);
    renderShield(ctx);
    renderActiveEffectHUD(ctx, GAME_WIDTH);

    drawParticles();


    // Capa superior del jefe: viñetas, tintes, avisos y glitch
    bossRenderOverlay(ctx);

    // Efectos de gol VFX (flash, confeti, shockwave)
    renderGoalVFX(ctx);

    // Cuenta regresiva de saque + previsualización de trayectoria
    if (state.serveCountdownMs > 0) {
        const secs = Math.ceil(state.serveCountdownMs / 1000);
        drawTrajectoryPreview(themeColor);
        ctx.globalAlpha = 0.9;
        drawText(String(secs), GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, themeColor, 48);
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
    if (!state.isPlaying || state.isPaused) return;

    if (lastTimestamp === 0) lastTimestamp = timestamp;
    const elapsedMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    let dt = elapsedMs / (1000 / 60);
    if (dt > 3) dt = 3;
    if (dt <= 0) dt = 1;

    update(dt);
    render();

    // Guardar tiempo jugado de vez en cuando (1 de cada 1000 fotogramas: ~17 s de media)
    if (Math.random() < 0.001) statsFlushTime();

    animationFrameId = requestAnimationFrame(gameLoop);
}
