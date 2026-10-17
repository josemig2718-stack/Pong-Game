/**
 * game/physics.js
 * ------------------------------------------------------------------
 * Un paso de simulación: update(dt).
 *
 * dt está normalizado a 60 FPS (1 = un fotograma a 60 FPS), así que
 * todas las velocidades son "píxeles por fotograma a 60 FPS" y todo
 * movimiento se multiplica por dt.
 *
 * El orden de las operaciones es parte del comportamiento: decide el
 * orden de las llamadas a Math.random (que comparten física y dibujo) y
 * qué ve cada sistema en cada fotograma. No lo cambies al tocar esto.
 * ------------------------------------------------------------------
 */

'use strict';

// Puntos que guarda la estela de cada bola
const MAX_TRAIL = 25;

// Cuánto se ve "¡YA!" al terminar la cuenta regresiva (ms)
const GO_TEXT_MS = 600;

/**
 * Avanza la partida un paso.
 * @param {number} dt tiempo transcurrido en fotogramas de 60 FPS
 */
function update(dt) {
    // Un diálogo de campaña congela la partida por completo
    if (isDialogueActive) return;

    // El reloj de la partida cuenta tiempo real, sin la cámara lenta
    const realDt = dt;

    // Cámara lenta: manda la más lenta entre la del power-up y la del gol épico
    let slowmo = 1.0;
    slowmo = Math.min(slowmo, getSlowmoMultiplier());
    slowmo = Math.min(slowmo, getGoalSlowmo());
    dt *= slowmo;

    const maxBallSpeed = currentSpeedPreset().max;

    // Mecánicas del jefe de campaña
    bossUpdate(dt);

    // Yisus (parada de tiempo) y el rayo del Creador congelan al jugador
    const playerDt = bossFreezesPlayer() ? 0 : dt;

    const bcfg = bossConfig();
    const rotatedArena = !!bcfg && bcfg.paddleAxis === 'x';

    // El Creador invierte los controles en su fase 2
    const invert = (bossInvertsControls()) ? -1 : 1;

    movePlayer1(playerDt, rotatedArena, invert);
    if (state.mode === 'local') movePlayer2(dt);
    else moveCpu(dt, bcfg);
    clampPaddles(rotatedArena);

    if (state.serveCountdownMs > 0) {
        tickServeCountdown(dt);
        // Los fondos animados, las partículas y la vibración siguen; la
        // bola y los power-ups esperan al saque.
        updateVFX(dt);
        updateParticles(dt);
        updateShake(dt);
        return;
    }

    // Antes de las bolas: el fotograma del gol que cierra la partida cuenta
    statsTickMatchClock(realDt * MS_PER_FRAME);

    // Si un gol termina la partida en multi-bola, el resto del paso no se
    // ejecuta (con una sola bola sí: ver onBallOut).
    if (updateBalls(dt, bcfg, rotatedArena, maxBallSpeed)) return;

    updatePowerups(dt);
    updateVFX(dt);
    updateParticles(dt);
    updateShake(dt);
    if (state.goTextMs > 0) state.goTextMs = Math.max(0, state.goTextMs - dt * MS_PER_FRAME);
}

// ------------------------------------------------------------------
//  Paletas
// ------------------------------------------------------------------

/** Jugador 1: el dedo/ratón manda sobre el teclado. */
function movePlayer1(playerDt, rotatedArena, invert) {
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
            // Congelado, el dedo sigue moviéndose pero la paleta no le hace caso
            if (playerDt > 0) p1.y = p1.touchY;
        } else {
            if (isActionPressed('p1Up')) p1.dy = -paddleSpeed;
            else if (isActionPressed('p1Down')) p1.dy = paddleSpeed;
            else p1.dy = 0;
            p1.y += p1.dy * playerDt;
        }
    }
}

/** Jugador 2 humano (modo local). */
function movePlayer2(dt) {
    if (p2.touchY !== null) {
        p2.y = p2.touchY;
    } else {
        if (isActionPressed('p2Up')) p2.dy = -paddleSpeed;
        else if (isActionPressed('p2Down')) p2.dy = paddleSpeed;
        else p2.dy = 0;
        p2.y += p2.dy * dt;
    }
}

/** Mantiene las paletas dentro del campo (la gemela, salvo cuando se retira). */
function clampPaddles(rotatedArena) {
    if (rotatedArena) {
        p1.x = Math.max(0, Math.min(GAME_WIDTH - p1.width, p1.x));
    } else {
        p1.y = Math.max(0, Math.min(GAME_HEIGHT - p1.height, p1.y));
    }
    p2.y = Math.max(0, Math.min(GAME_HEIGHT - p2.height, p2.y));
    if (p2Twin.active && p2Twin.retreatMs <= 0) {
        p2Twin.y = Math.max(0, Math.min(GAME_HEIGHT - p2Twin.height, p2Twin.y));
    }
}

/** Cuenta regresiva del saque, con un pitido por segundo y otro al salir. */
function tickServeCountdown(dt) {
    const prevSec = Math.ceil(state.serveCountdownMs / 1000);
    state.serveCountdownMs -= dt * MS_PER_FRAME;
    if (state.serveCountdownMs < 0) state.serveCountdownMs = 0;
    const curSec = Math.ceil(state.serveCountdownMs / 1000);

    if (curSec !== prevSec && curSec > 0) {
        soundEffects.countdown();
    }
    if (state.serveCountdownMs <= 0) {
        soundEffects.go();
        state.goTextMs = GO_TEXT_MS;
    }
}

// ------------------------------------------------------------------
//  Bolas
// ------------------------------------------------------------------

/**
 * Mueve todas las bolas y resuelve rebotes, golpes y goles.
 * @returns {boolean} true si la partida terminó y el paso debe cortarse
 */
function updateBalls(dt, bcfg, rotatedArena, maxBallSpeed) {
    const ballsToRemove = [];

    // Se lee state.balls en cada vuelta: un gol con una sola bola llama a
    // resetBall(), que sustituye el array.
    for (let bi = 0; bi < state.balls.length; bi++) {
        const b = state.balls[bi];

        // Estela
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > MAX_TRAIL) b.trail.shift();

        // Mover bola
        b.x += b.dx * dt;
        b.y += b.dy * dt;

        bounceOffWalls(b, bcfg, rotatedArena, maxBallSpeed);

        // Obstáculos propios del jefe (escombros de Chemi, escudo de Dani)
        bossCollide(b);

        hitPaddles(b, rotatedArena, maxBallSpeed);

        if (checkGoal(b, bi, rotatedArena, ballsToRemove)) return true;
    }

    // Eliminar bolas que salieron (de atrás hacia adelante para no alterar índices)
    for (let i = ballsToRemove.length - 1; i >= 0; i--) {
        state.balls.splice(ballsToRemove[i], 1);
    }

    // Si no quedan bolas (todas salieron en multi-bola), resetear
    if (state.balls.length === 0 && state.isPlaying) {
        resetBall(false);
    }
    return false;
}

function bounceOffWalls(b, bcfg, rotatedArena, maxBallSpeed) {
    if (rotatedArena) {
        // Rebote en paredes laterales
        if (b.x - b.radius < 0 || b.x + b.radius > GAME_WIDTH) {
            b.dx = -b.dx;
            b.x = Math.max(b.radius, Math.min(GAME_WIDTH - b.radius, b.x));
            soundEffects.wallHit({ x: b.x });
            spawnParticles(b.x, b.y, currentThemeHex(), 6);
        }
        // Impacto contra el Creador (franja superior): le quita vida.
        // Ojo: NO toca state.p1Score — el marcador y el daño son cosas distintas.
        if (b.y - b.radius < CREATOR_BAND_H) {
            b.dy = -b.dy;
            b.y = CREATOR_BAND_H + b.radius;

            // Los tramos blindados rebotan sin recibir daño: hay que
            // apuntar al hueco en vez de repetir siempre el mismo golpe.
            const blindado = bossSegmentArmored(b.x);
            if (blindado) {
                soundEffects.wallHit({ x: b.x });
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
            soundEffects.wallHit({ x: b.x });
            spawnParticles(b.x, b.y, currentThemeHex(), 6);
        }
    }
}

/** Colisión AABB simplificada entre una bola y un rectángulo. */
function collision(b, p) {
    const top = b.y - b.radius, bottom = b.y + b.radius, left = b.x - b.radius, right = b.x + b.radius;
    return p.x < right && p.y < bottom && p.x + p.width > left && p.y + p.height > top;
}

/** Golpe de paleta: el ángulo de salida depende de dónde toca la bola. */
function hitPaddles(b, rotatedArena, maxBallSpeed) {
    /** @type {Paddle} */
    let targetPaddle = (b.x + b.radius < GAME_WIDTH / 2) ? p1 : p2;
    if (rotatedArena) targetPaddle = p1; // En la arena rotada solo existe p1 (abajo)

    let hit = false;
    if (collision(b, targetPaddle)) {
        hit = true;
    } else if (!rotatedArena && p2Twin.active && p2Twin.retreatMs <= 0 && b.x + b.radius > GAME_WIDTH / 2 && collision(b, p2Twin)) {
        targetPaddle = p2Twin;
        hit = true;
    }
    if (!hit) return;

    if (rotatedArena) {
        // Cálculo de rebote estilo Breakout (basado en X)
        const collidePoint = (b.x - (targetPaddle.x + targetPaddle.width / 2)) / (targetPaddle.width / 2);
        const angleRad = (Math.PI / 3) * collidePoint; // Max 60 grados

        b.dx = b.speed * Math.sin(angleRad);
        b.dy = -b.speed * Math.cos(angleRad); // Siempre hacia arriba
        if (b.speed < maxBallSpeed) b.speed += 0.5;
        if (b.speed >= maxBallSpeed) statsOnMaxSpeed();

        b.y = targetPaddle.y - b.radius;
    } else {
        // Pong normal (basado en Y)
        const collidePoint = (b.y - (targetPaddle.y + targetPaddle.height / 2)) / (targetPaddle.height / 2);
        const angleRad = (Math.PI / 4) * collidePoint;
        const direction = (b.x + b.radius < GAME_WIDTH / 2) ? 1 : -1;

        b.dx = direction * b.speed * Math.cos(angleRad);
        b.dy = b.speed * Math.sin(angleRad);
        if (b.speed < maxBallSpeed) b.speed += 0.5;
        if (b.speed >= maxBallSpeed) statsOnMaxSpeed();   // "Demonio Veloz": no toca la partida

        b.x = direction === 1 ? targetPaddle.x + targetPaddle.width + b.radius : targetPaddle.x - b.radius;
    }

    soundEffects.paddleHit({ x: b.x, speedRatio: Math.min(1, b.speed / maxBallSpeed) });
    spawnParticles(b.x, b.y, '#ffffff', 16);
    triggerShake(4, 100);

    // Nuevo intercambio: el jefe recalcula su puntería
    bossRefreshAim();

    // Registrar último golpeador para power-ups
    setLastHitter(targetPaddle === p1 ? 'p1' : 'p2');

    // Estadísticas: contar golpe para rally
    statsOnPaddleHit();
}

/**
 * Goles (la bola sale del campo) y, en la arena rotada, la victoria por
 * vaciar la vida del Creador.
 * @returns {boolean} true si la partida terminó y el paso debe cortarse
 */
function checkGoal(b, bi, rotatedArena, ballsToRemove) {
    if (rotatedArena) {
        if (b.y - b.radius > GAME_HEIGHT) {
            // El jugador falla: cuenta como fallo, no como punto del rival
            state.p2Score++;
            soundEffects.score();
            triggerShake(10, 260);
            triggerGoalVFX(b.x, GAME_HEIGHT);
            if (onBallOut(bi, ballsToRemove)) return true;
        }
        // La victoria se decide en checkWin() leyendo la barra de vida
        return bossHealth() <= 0 && checkWin();
    }

    if (b.x - b.radius < 0) {
        // CPU/P2 anota
        state.p2Score++;
        statsOnScore(false, b);
        bossOnGoal(false);
        checkMidDialogue();
        soundEffects.score();
        triggerShake(10, 260);
        triggerGoalVFX(0, b.y);
        return onBallOut(bi, ballsToRemove);
    }

    if (b.x + b.radius > GAME_WIDTH) {
        // P1 anota
        state.p1Score++;
        statsOnScore(true, b);
        bossOnGoal(true);
        soundEffects.score();
        triggerShake(10, 260);
        triggerGoalVFX(GAME_WIDTH, b.y);
        return onBallOut(bi, ballsToRemove);
    }
    return false;
}

/**
 * Una bola acaba de salir del campo.
 *
 * Con varias bolas, esa bola se retira (sin nuevo saque) y, si el gol
 * termina la partida, se corta el paso. Con una sola, si la partida
 * sigue hay nuevo saque; si termina, el resto del paso se ejecuta igual
 * (power-ups, VFX, partículas). La asimetría es del código original.
 * @returns {boolean} true si hay que cortar el paso
 */
function onBallOut(bi, ballsToRemove) {
    if (state.balls.length > 1) {
        ballsToRemove.push(bi);
        return checkWin();
    }
    if (!checkWin()) resetBall(false);
    return false;
}
