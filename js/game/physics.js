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

    // Hit-stop: tras un golpe fuerte la imagen se queda quieta unos
    // fotogramas (render() sigue dibujando). Cuenta en tiempo real.
    if (state.hitStopMs > 0) {
        state.hitStopMs = Math.max(0, state.hitStopMs - dt * MS_PER_FRAME);
        return;
    }

    // El reloj de la partida cuenta tiempo real, sin la cámara lenta
    const realDt = dt;

    // Cámara lenta del power-up: frena la partida, que es su efecto
    dt *= getSlowmoMultiplier();
    // La del gol épico es un cosmético: solo frena lo que se ve (efectos y
    // partículas). Si frenara la partida, la CPU y la cuenta del saque
    // irían a otro ritmo y la vibración pediría otros Math.random.
    const fxDt = dt * getGoalSlowmo();

    // La fiebre del rally sube el tope de velocidad
    const maxBallSpeed = currentSpeedPreset().max * (state.fever ? MECH.feverMaxSpeedK : 1);

    // Mecánicas del jefe de campaña
    bossUpdate(dt);

    // Yisus (parada de tiempo) y el rayo del Creador congelan al jugador
    const playerDt = bossFreezesPlayer() ? 0 : dt;

    const bcfg = bossConfig();
    const rotatedArena = !!bcfg && bcfg.paddleAxis === 'x';

    // El Creador invierte los controles en su fase 2
    const invert = (bossInvertsControls()) ? -1 : 1;

    rememberPaddlePositions();
    movePlayer1(playerDt, rotatedArena, invert);
    if (state.mode === 'local') movePlayer2(dt);
    else if (state.mode !== 'practice') moveCpu(dt, bcfg);   // en práctica hay una pared
    clampPaddles(rotatedArena);
    measurePaddleSpeeds(playerDt, dt, rotatedArena);
    updateSmash(p1, isActionPressed('p1Smash') || p1.smashTouchHeld, playerDt);
    if (state.mode === 'local') updateSmash(p2, isActionPressed('p2Smash') || p2.smashTouchHeld, dt);

    if (state.serveCountdownMs > 0) {
        tickServeCountdown(dt);
        // Los fondos animados, las partículas y la vibración siguen; la
        // bola y los power-ups esperan al saque.
        tickFeverHeat(dt);
        updateVFX(fxDt);
        updateParticles(fxDt);
        updateShake(dt);
        return;
    }

    // Antes de las bolas: el fotograma del gol que cierra la partida cuenta
    statsTickMatchClock(realDt * MS_PER_FRAME);

    // Si un gol termina la partida en multi-bola, el resto del paso no se
    // ejecuta (con una sola bola sí: ver onBallOut).
    if (updateBalls(dt, bcfg, rotatedArena, maxBallSpeed)) return;

    updatePowerups(dt, realDt);
    tickFeverHeat(dt);
    updateVFX(fxDt);
    updateParticles(fxDt);
    updateShake(dt);
    if (state.goTextMs > 0) state.goTextMs = Math.max(0, state.goTextMs - dt * MS_PER_FRAME);
}

// ------------------------------------------------------------------
//  Paletas
// ------------------------------------------------------------------

/** Dirección que piden las teclas de un jugador: -1 arriba, 1 abajo, 0 ninguna. */
function keyDirection(upAction, downAction) {
    if (isActionPressed(upAction)) return -1;
    if (isActionPressed(downAction)) return 1;
    return 0;
}

/**
 * Jugador 1: el dedo/ratón manda sobre el teclado. Con el teclado la
 * paleta tiene inercia (movePaddleKeys); congelada, se para en seco.
 */
function movePlayer1(playerDt, rotatedArena, invert) {
    if (rotatedArena) {
        // Arena rotada: la paleta se mueve en X. Se respetan las teclas
        // reasignadas (p1Up = izquierda, p1Down = derecha).
        if (p1.touchX !== undefined && p1.touchX !== null) {
            if (playerDt > 0) followPointer(p1, p1.touchX, playerDt, 'x');
        } else if (playerDt > 0) {
            movePaddleKeys(p1, keyDirection('p1Up', 'p1Down') * invert, playerDt, 'x');
        } else {
            p1.vx = 0;
        }
    } else {
        if (p1.touchY !== null) {
            // Congelado, el dedo sigue moviéndose pero la paleta no le hace caso
            if (playerDt > 0) followPointer(p1, p1.touchY, playerDt, 'y');
        } else if (playerDt > 0) {
            movePaddleKeys(p1, keyDirection('p1Up', 'p1Down'), playerDt, 'y');
        } else {
            p1.vy = 0;
        }
    }
}

/** Jugador 2 humano (modo local). */
function movePlayer2(dt) {
    if (p2.touchY !== null) followPointer(p2, p2.touchY, dt, 'y');
    else movePaddleKeys(p2, keyDirection('p2Up', 'p2Down'), dt, 'y');
}

/**
 * Mantiene las paletas dentro del campo (la gemela, salvo cuando se
 * retira). Una paleta que choca con el borde se queda sin velocidad: si
 * no, el teclado la daría por movida y sus golpes llevarían efecto.
 */
function clampPaddles(rotatedArena) {
    if (rotatedArena) {
        const x = Math.max(0, Math.min(GAME_WIDTH - p1.width, p1.x));
        if (x !== p1.x) { p1.x = x; p1.vx = 0; }
    } else {
        const y = Math.max(0, Math.min(GAME_HEIGHT - p1.height, p1.y));
        if (y !== p1.y) { p1.y = y; p1.vy = 0; }
    }
    const y2 = Math.max(0, Math.min(GAME_HEIGHT - p2.height, p2.y));
    if (y2 !== p2.y) { p2.y = y2; p2.vy = 0; }
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
        applySpin(b, dt, rotatedArena);
        decaySquash(b, dt);

        bounceOffWalls(b, bcfg, rotatedArena, maxBallSpeed);

        // Obstáculos propios del jefe (escombros de Chemi, escudo de Dani)
        bossCollide(b);

        hitPaddles(b, rotatedArena, maxBallSpeed);
        if (state.mode === 'practice') bouncePracticeWall(b, maxBallSpeed);

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
            b.spin *= MECH.spinWallK;   // el efecto se invierte a medias
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
            b.spin *= MECH.spinWallK;   // el efecto se invierte a medias
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

/**
 * Golpe de paleta: aquí solo se detecta con qué paleta choca la bola; el
 * rebote lo calcula resolveHit (game/mechanics.js).
 */
function hitPaddles(b, rotatedArena, maxBallSpeed) {
    /** @type {Paddle} */
    let targetPaddle = (b.x + b.radius < GAME_WIDTH / 2) ? p1 : p2;
    if (rotatedArena) targetPaddle = p1; // En la arena rotada solo existe p1 (abajo)
    if (targetPaddle === p2 && state.mode === 'practice') return;   // en práctica no hay rival

    let hit = false;
    if (collision(b, targetPaddle)) {
        hit = true;
    } else if (!rotatedArena && p2Twin.active && p2Twin.retreatMs <= 0 && b.x + b.radius > GAME_WIDTH / 2 && collision(b, p2Twin)) {
        targetPaddle = p2Twin;
        hit = true;
    }
    if (!hit) return;

    resolveHit(b, targetPaddle, maxBallSpeed, rotatedArena);
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
            endFever();
            soundEffects.score();
            triggerShake(10, 260);
            triggerGoalVFX(b.x, GAME_HEIGHT, goalPower(b));
            if (onBallOut(bi, ballsToRemove)) return true;
        }
        // La victoria se decide en checkWin() leyendo la barra de vida
        return bossHealth() <= 0 && checkWin();
    }

    if (b.x - b.radius < 0 && state.mode === 'practice') return practiceMiss(b, bi, ballsToRemove);

    if (b.x - b.radius < 0) {
        // CPU/P2 anota
        if (b.power === 'super') SUPER_FX[superStyleId(b.owner)].burst(0, b.y, sideColor('p2'));
        state.p2Score++;
        statsOnScore(false, b);
        endFever();
        bossOnGoal(false);
        checkMidDialogue();
        soundEffects.score();
        triggerShake(10, 260);
        triggerGoalVFX(0, b.y, goalPower(b));
        return onBallOut(bi, ballsToRemove);
    }

    if (b.x + b.radius > GAME_WIDTH) {
        // P1 anota
        if (b.power === 'super') SUPER_FX[superStyleId(b.owner)].burst(GAME_WIDTH, b.y, sideColor('p1'));
        state.p1Score++;
        statsOnScore(true, b);
        endFever();
        bossOnGoal(true);
        soundEffects.score();
        triggerShake(10, 260);
        triggerGoalVFX(GAME_WIDTH, b.y, goalPower(b));
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
