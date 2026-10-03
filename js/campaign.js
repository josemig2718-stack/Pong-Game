/**
 * campaign.js
 * ------------------------------------------------------------------
 * Modo Campaña: "La Venganza contra los Hachepes".
 *
 * Lore, mapa de niveles, sistema de diálogos y la secuencia del falso
 * final. Las mecánicas de cada combate viven en bosses.js.
 * ------------------------------------------------------------------
 */

import { GAME_HEIGHT, GAME_WIDTH } from './core/constants.js';
import { state } from './core/state.js';
import {
    CAMPAIGN_CREATOR,
    CAMPAIGN_INTRO_TEXT,
    CAMPAIGN_LAST_BOSS,
    HACHEPES_LORE
} from './data/lore.js';
import { unlockAchievement } from './systems/achievements.js';
import {
    gameplayMusic,
    hachepeMusic,
    menuMusic,
    playTone,
    soundEffects,
    stopAllMusic
} from './systems/audio.js';
import { playerProgression, saveProgression } from './systems/progression.js';
import { triggerGoalConfetti } from './vfx/goal-fx.js';
import { startGame } from './game.js';
import { showScreen } from './ui.js';

export let currentCampaignLevel = 1;
let dialogueQueue = [];
export let isDialogueActive = false;
let dialogueCallback = null;
let currentDialogueTimer = null;
let dialogueAdvanceTimer = null;
export let isReplayingBoss = false;   // true si el jefe actual ya estaba vencido

// ==================================================================
//  SELECTOR DE JEFES — carrusel estilo arcade
// ==================================================================

export let carouselIndex = 0;      // carta centrada
let carouselCards = [];     // niveles disponibles, en orden

/** Niveles que se muestran: los 5 Hachepes, más el Creador si ya se reveló. */
function getCarouselLevels() {
    const niveles = [1, 2, 3, 4, 5];
    if (playerProgression.campaignProgress >= CAMPAIGN_CREATOR) niveles.push(CAMPAIGN_CREATOR);
    return niveles;
}

export function renderCampaignMap() {
    const track = document.getElementById('campaign-nodes');
    if (!track) return;

    if (!playerProgression.campaignIntroSeen) showCampaignIntro();

    track.innerHTML = '';
    carouselCards = getCarouselLevels();

    // Arrancar sobre el jefe pendiente, que es lo que el jugador busca
    const pendiente = Math.min(playerProgression.campaignProgress, CAMPAIGN_CREATOR);
    carouselIndex = Math.max(0, carouselCards.indexOf(pendiente));

    carouselCards.forEach((nivel, i) => {
        const boss = HACHEPES_LORE[nivel];
        const esCreador = nivel === CAMPAIGN_CREATOR;
        const desbloqueado = nivel <= playerProgression.campaignProgress;
        const vencido = nivel < playerProgression.campaignProgress;
        const actual = nivel === playerProgression.campaignProgress;

        const card = document.createElement('div');
        card.className = 'boss-card'
            + (desbloqueado ? ' unlocked' : ' locked')
            + (actual ? ' current' : '')
            + (esCreador ? ' corrupted' : '');
        card.dataset.index = i;

        const estado = !desbloqueado ? '🔒 BLOQUEADO'
            : (vencido ? '✅ DERROTADO' : '⚔️ TE ESPERA');

        if (desbloqueado) {
            card.innerHTML = `
                <div class="boss-card__art" style="background-image:url('${boss.image}')"></div>
                <div class="boss-card__veil"></div>
                <span class="boss-card__num">${esCreador ? '??' : 'RIVAL 0' + nivel}</span>
                <div class="boss-card__info">
                    <span class="boss-card__danger">${boss.danger}</span>
                    <h3 class="boss-card__name">${boss.name}</h3>
                    <p class="boss-card__title">${boss.title}</p>
                    <p class="boss-card__desc">${boss.desc}</p>
                    <span class="boss-card__state">${estado}</span>
                </div>`;
        } else {
            // Un jefe bloqueado no revela ni su cara ni su nombre
            card.innerHTML = `
                <div class="boss-card__unknown">?</div>
                <div class="boss-card__info">
                    <h3 class="boss-card__name">???</h3>
                    <p class="boss-card__title">Sin identificar</p>
                    <span class="boss-card__state">${estado}</span>
                </div>`;
        }

        card.addEventListener('click', () => {
            const idx = parseInt(card.dataset.index, 10);
            if (idx !== carouselIndex) {
                carouselIndex = idx;          // primero se centra
                updateCarousel();
                soundEffects.uiClick();
            } else if (desbloqueado) {
                soundEffects.uiClick();       // ya centrada: entrar al combate
                prepareCampaignMatch(nivel);
            }
        });

        track.appendChild(card);
    });

    buildCarouselDots();
    updateCarousel();
}

function buildCarouselDots() {
    const dots = document.getElementById('carousel-dots');
    if (!dots) return;
    dots.innerHTML = '';
    carouselCards.forEach((_, i) => {
        const d = document.createElement('button');
        d.type = 'button';
        d.className = 'carousel-dot';
        d.setAttribute('aria-label', `Rival ${i + 1}`);
        d.addEventListener('click', () => { carouselIndex = i; updateCarousel(); soundEffects.uiClick(); });
        dots.appendChild(d);
    });
}

/** Coloca cada carta según su distancia a la centrada. */
function updateCarousel() {
    const track = document.getElementById('campaign-nodes');
    if (!track) return;
    const cards = [...track.children];

    cards.forEach((card, i) => {
        const d = i - carouselIndex;
        const abs = Math.abs(d);
        card.classList.toggle('is-active', d === 0);
        // Más allá de dos posiciones no se dibuja: evita una fila infinita
        card.style.display = abs > 2 ? 'none' : '';
        card.style.transform = `translateX(${d * 74}%) scale(${d === 0 ? 1 : (abs === 1 ? 0.74 : 0.56)})`;
        card.style.opacity = d === 0 ? '1' : (abs === 1 ? '0.42' : '0.18');
        card.style.zIndex = String(10 - abs);
        card.style.pointerEvents = abs > 1 ? 'none' : 'auto';
    });

    const dots = document.getElementById('carousel-dots');
    if (dots) {
        [...dots.children].forEach((d, i) => d.classList.toggle('active', i === carouselIndex));
    }

    const prev = document.getElementById('carousel-prev');
    const next = document.getElementById('carousel-next');
    if (prev) prev.disabled = carouselIndex === 0;
    if (next) next.disabled = carouselIndex >= carouselCards.length - 1;
}

export function carouselMove(paso) {
    const nuevo = carouselIndex + paso;
    if (nuevo < 0 || nuevo >= carouselCards.length) return;
    carouselIndex = nuevo;
    updateCarousel();
    soundEffects.uiClick();
}

/** Teclado y deslizamiento: el carrusel se maneja sin ratón. */
export function initCarouselControls() {
    const menu = document.getElementById('campaign-menu');
    if (!menu) return;

    document.addEventListener('keydown', (e) => {
        if (!menu.classList.contains('active-screen')) return;
        if (isDialogueActive) return;
        if (e.code === 'ArrowLeft')  { carouselMove(-1); e.preventDefault(); }
        if (e.code === 'ArrowRight') { carouselMove(1);  e.preventDefault(); }
        if (e.code === 'Enter' || e.code === 'Space') {
            const nivel = carouselCards[carouselIndex];
            if (nivel && nivel <= playerProgression.campaignProgress) {
                soundEffects.uiClick();
                prepareCampaignMatch(nivel);
            }
            e.preventDefault();
        }
    });

    let startX = null;
    const view = menu.querySelector('.carousel-viewport');
    if (!view) return;
    view.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    view.addEventListener('touchend', (e) => {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) carouselMove(dx < 0 ? 1 : -1);
        startX = null;
    }, { passive: true });
}

function showCampaignIntro() {
    const overlay = document.getElementById('campaign-intro-overlay');
    const textEl = document.getElementById('campaign-intro-text');
    const btn = document.getElementById('campaign-intro-btn');
    if (!overlay || !textEl || !btn) return;

    overlay.classList.remove('hidden');
    btn.classList.add('hidden');
    textEl.textContent = '';

    // Máquina de escribir sobre texto plano: los saltos de párrafo son \n\n
    let i = 0;
    clearInterval(currentDialogueTimer);
    const interval = setInterval(() => {
        textEl.textContent = CAMPAIGN_INTRO_TEXT.slice(0, i);
        i++;
        if (i > CAMPAIGN_INTRO_TEXT.length) {
            clearInterval(interval);
            btn.classList.remove('hidden');
        }
    }, 22);

    // Tocar la pantalla completa el texto de golpe
    overlay.onclick = () => {
        clearInterval(interval);
        textEl.textContent = CAMPAIGN_INTRO_TEXT;
        btn.classList.remove('hidden');
    };
}

export function closeCampaignIntro() {
    const overlay = document.getElementById('campaign-intro-overlay');
    if (overlay) overlay.classList.add('hidden');
    playerProgression.campaignIntroSeen = true;
    saveProgression();
    soundEffects.uiClick();
}

export function replayCampaignIntro() {
    soundEffects.uiClick();
    showCampaignIntro();
}

// ==================================================================
//  PANTALLA VS Y ARRANQUE DEL COMBATE
// ==================================================================

function prepareCampaignMatch(level, opts) {
    currentCampaignLevel = level;
    isReplayingBoss = level < playerProgression.campaignProgress;
    const boss = HACHEPES_LORE[level];
    const isCreator = level === CAMPAIGN_CREATOR;

    document.getElementById('vs-boss-name').textContent = boss.name;
    document.getElementById('vs-boss-title').textContent = boss.title;
    document.getElementById('vs-boss-danger').textContent = 'Peligro: ' + boss.danger;

    const avatar = document.getElementById('vs-boss-avatar');
    const avatar2 = document.getElementById('vs-boss-avatar2');

    avatar.src = boss.image;
    avatar.classList.toggle('avatar-corrupted', isCreator);
    if (boss.image2) {
        avatar.classList.replace('w-full', 'w-1/2');
        avatar2.src = boss.image2;
        avatar2.classList.remove('hidden');
        avatar2.classList.add('w-1/2');
    } else {
        avatar.classList.remove('w-1/2');
        avatar.classList.add('w-full');
        avatar2.classList.add('hidden');
    }

    document.getElementById('vs-screen-container').classList.toggle('glitch-mode', isCreator);

    showScreen('vs-screen');

    // Entrada de golpe: solo cuando venimos de la revelación
    const vs = document.getElementById('vs-screen');
    vs.classList.remove('slam');
    if (opts && opts.slam) {
        void vs.offsetWidth;
        vs.classList.add('slam');
    }

    if (isCreator && soundEffects.glitch) soundEffects.glitch();

    setTimeout(() => {
        startCampaignGame();
    }, isCreator ? 3000 : 3200);
}

function startCampaignGame() {
    const boss = HACHEPES_LORE[currentCampaignLevel];

    startGame('campaign');

    // El diálogo inicial congela la partida hasta que termina (update() sale
    // temprano mientras isDialogueActive es true).
    queueDialogue(boss.dialogues.start);
}

// ==================================================================
//  SISTEMA DE DIÁLOGOS
// ==================================================================

/**
 * Encola líneas de diálogo. Acepta strings u objetos { t, s }.
 * @param {Array} texts
 * @param {Function} [onComplete] callback al vaciarse la cola
 */
function queueDialogue(texts, onComplete) {
    if (!texts || texts.length === 0) {
        if (onComplete) onComplete();
        return;
    }
    dialogueQueue = [...texts];
    dialogueCallback = onComplete || null;
    if (!isDialogueActive) showNextDialogue();
}

function showNextDialogue() {
    const box = document.getElementById('dialogue-box');

    if (dialogueQueue.length === 0) {
        isDialogueActive = false;
        if (box) {
            box.classList.add('hidden');
            box.onclick = null;
        }
        const cb = dialogueCallback;
        dialogueCallback = null;
        if (cb) cb();
        return;
    }

    isDialogueActive = true;
    const raw = dialogueQueue.shift();
    const text = typeof raw === 'string' ? raw : raw.t;
    const speaker = typeof raw === 'string' ? null : raw.s;
    const boss = HACHEPES_LORE[currentCampaignLevel];
    if (!box || !boss) return;

    const nameEl = document.getElementById('dialogue-name');
    const textEl = document.getElementById('dialogue-text');
    const avatar = document.getElementById('dialogue-avatar');
    const avatar2 = document.getElementById('dialogue-avatar2');

    // El dúo alterna avatar y nombre según quién habla
    if (boss.image2) {
        const names = boss.name.split(' y ');
        nameEl.textContent = speaker === 'b' ? (names[1] || boss.name) : (names[0] || boss.name);
        avatar.src = boss.image;
        avatar2.src = boss.image2;
        avatar2.classList.remove('hidden');
        avatar.classList.toggle('avatar-dimmed', speaker === 'b');
        avatar2.classList.toggle('avatar-dimmed', speaker !== 'b');
    } else {
        nameEl.textContent = boss.name;
        avatar.src = boss.image;
        avatar.classList.remove('avatar-dimmed');
        avatar2.classList.add('hidden');
    }

    const isCreator = currentCampaignLevel === CAMPAIGN_CREATOR;
    box.classList.toggle('dialogue-glitch', isCreator);
    avatar.classList.toggle('avatar-corrupted', isCreator);

    box.classList.remove('hidden');
    textEl.textContent = '';

    // Máquina de escribir
    let charIndex = 0;
    clearInterval(currentDialogueTimer);
    clearTimeout(dialogueAdvanceTimer);

    const finishTyping = () => {
        clearInterval(currentDialogueTimer);
        textEl.textContent = text;
        dialogueAdvanceTimer = setTimeout(showNextDialogue, 1800);
    };

    currentDialogueTimer = setInterval(() => {
        textEl.textContent += text.charAt(charIndex);
        charIndex++;
        if (charIndex % 3 === 0 && soundEffects.dialogueBlip) soundEffects.dialogueBlip();
        if (charIndex >= text.length) finishTyping();
    }, isCreator ? 55 : 38);

    // Tocar/click adelanta: primero completa la línea, luego pasa a la siguiente
    box.onclick = () => {
        if (charIndex < text.length) {
            charIndex = text.length;
            finishTyping();
        } else {
            clearTimeout(dialogueAdvanceTimer);
            showNextDialogue();
        }
    };
}

/** Corta cualquier diálogo en curso (al salir de la partida). */
export function stopDialogue() {
    clearInterval(currentDialogueTimer);
    clearFinaleTimers();
    clearTimeout(dialogueAdvanceTimer);
    dialogueQueue = [];
    dialogueCallback = null;
    isDialogueActive = false;
    const box = document.getElementById('dialogue-box');
    if (box) {
        box.classList.add('hidden');
        box.onclick = null;
    }
}

/** Diálogo de "voy ganando": salta una sola vez, al ir perdiendo por 2. */
export let midDialogueShown = false;
export function checkMidDialogue() {
    if (state.mode !== 'campaign' || midDialogueShown) return;
    if (state.p2Score - state.p1Score < 2) return;
    const boss = HACHEPES_LORE[currentCampaignLevel];
    if (!boss || !boss.dialogues.mid) return;
    midDialogueShown = true;
    queueDialogue(boss.dialogues.mid);
}

export function resetMidDialogue() {
    midDialogueShown = false;
}

/** Diálogo final del jefe, mostrado sobre la pantalla de fin de combate. */
export function playBossOutcomeDialogue(p1Won) {
    const boss = HACHEPES_LORE[currentCampaignLevel];
    if (!boss) return;
    // Al vencer a Yisus o al Creador manda la secuencia narrativa, no esto.
    if (p1Won && (currentCampaignLevel === CAMPAIGN_LAST_BOSS || currentCampaignLevel === CAMPAIGN_CREATOR)) return;
    const lines = p1Won ? boss.dialogues.lose : boss.dialogues.win;
    setTimeout(() => queueDialogue(lines), 400);
}

// ==================================================================
//  PROGRESO
// ==================================================================

export function handleCampaignVictory() {
    unlockAchievement('campaign_first');
    if (currentCampaignLevel === CAMPAIGN_LAST_BOSS) unlockAchievement('campaign_clear');
    if (currentCampaignLevel === CAMPAIGN_CREATOR) unlockAchievement('the_creator');

    // Solo avanza si era el jefe pendiente (repetir uno vencido no cuenta)
    if (currentCampaignLevel === playerProgression.campaignProgress && currentCampaignLevel < CAMPAIGN_CREATOR) {
        playerProgression.campaignProgress++;
        saveProgression();
    }
}

/**
 * ¿Cuál es el siguiente Hachepe tras el que se acaba de jugar?
 * Devuelve null si no hay ninguno disponible.
 *
 * Ojo: se calcula desde currentCampaignLevel, NO desde campaignProgress.
 * Usar el progreso mandaba al Creador nada más repetir un jefe antiguo,
 * saltándose media historia.
 */
export function getNextCampaignBoss() {
    const next = currentCampaignLevel + 1;
    // Al Creador solo se llega por la secuencia narrativa o por su carta.
    if (next > CAMPAIGN_LAST_BOSS) return null;
    if (next > playerProgression.campaignProgress) return null;
    return next;
}

export function nextCampaignLevel() {
    soundEffects.uiClick();
    document.getElementById('game-over-screen').classList.remove('active-screen');
    stopDialogue();
    const next = getNextCampaignBoss();
    if (next) {
        prepareCampaignMatch(next);
    } else {
        showScreen('campaign-menu');
    }
}

// ==================================================================
//  EL FALSO FINAL — la secuencia completa, sin volver al menú
// ==================================================================

/** Overlay negro a pantalla completa. amount: 0 (transparente) a 1 (negro). */
function setFadeOverlay(amount, ms) {
    const el = document.getElementById('fade-overlay');
    if (!el) return;
    el.style.transitionDuration = `${ms || 800}ms`;
    if (amount > 0) el.classList.remove('hidden');
    // Forzar reflow para que la transición arranque desde el estado actual
    void el.offsetWidth;
    el.style.opacity = String(amount);
    if (amount === 0) setTimeout(() => el.classList.add('hidden'), ms || 800);
}

function showFinaleText(html, className) {
    const el = document.getElementById('finale-text');
    if (!el) return;
    el.className = 'finale-text ' + (className || '');
    el.innerHTML = html;
    el.classList.remove('hidden');
}

function hideFinaleText() {
    const el = document.getElementById('finale-text');
    if (el) el.classList.add('hidden');
}

/** Encadena los pasos de la secuencia sin anidar setTimeout ilegibles. */
let finaleTimers = [];
function finaleStep(ms, fn) {
    finaleTimers.push(setTimeout(fn, ms));
}
function clearFinaleTimers() {
    finaleTimers.forEach(clearTimeout);
    finaleTimers = [];
}

/** Apagado / encendido del tubo. */
function crtShutdown() {
    const el = document.getElementById('crt-collapse');
    if (!el) return;
    el.className = '';
    void el.offsetWidth;          // reinicia la animación si se repite
    el.classList.add('shutdown');
    playCrtShutdownSound();
}
function crtDot(on) {
    const el = document.getElementById('crt-collapse');
    if (!el) return;
    el.classList.toggle('dot', !!on);
}
function crtTurnOn() {
    const el = document.getElementById('crt-collapse');
    if (!el) return;
    el.classList.remove('dot', 'shutdown');
    void el.offsetWidth;
    el.classList.add('turn-on');
    playTone(90, 'square', 0.05);
    setTimeout(() => playTone(1400, 'square', 0.03), 60);
    setTimeout(() => { el.className = 'hidden'; }, 900);
}

/** Zumbido descendente de un tubo apagándose. */
function playCrtShutdownSound() {
    let f = 520;
    const paso = setInterval(() => {
        f -= 70;
        if (f <= 60) { clearInterval(paso); playTone(45, 'sine', 0.5); return; }
        playTone(f, 'sine', 0.09);
    }, 55);
}

/**
 * Falso final tras vencer a Yisus.
 * victoria falsa → la señal se corrompe → apagón CRT → silencio →
 * reencendido en terminal → el ojo → VS El Creador.
 */
export function runFinaleSequence() {
    stopDialogue();
    clearFinaleTimers();
    state.isPlaying = false;

    playerProgression.campaignProgress = CAMPAIGN_CREATOR;
    saveProgression();

    const screen = document.getElementById('finale-screen');
    const eye = document.getElementById('finale-eye');
    if (eye) eye.classList.add('hidden');

    // --- 1. Victoria falsa: cuanto más sincera, más duele lo que viene ---
    showScreen('finale-screen');
    if (screen) screen.classList.remove('glitching');
    showFinaleText(
        '<h2>HAS RECUPERADO<br>TU CIUDAD</h2>' +
        '<p>Los cinco Hachepes han caído.</p>' +
        '<p>Nadie sabe tu nombre, pero hoy todos te lo deben.</p>',
        'finale-victory'
    );
    triggerGoalConfetti(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    soundEffects.win();
    playVictoryJingle();

    // --- 2. La señal se corrompe ---
    finaleStep(3600, () => {
        warpMusic();
        if (screen) screen.classList.add('glitching');
        soundEffects.glitch();
    });

    // --- 3. La voz que no debería estar ahí ---
    finaleStep(4600, () => {
        showFinaleText(
            '<p class="finale-voice">"Buen trabajo, amigo.<br>' +
            'Los derrotaste a todos, eres un héroe y salvaste tu ciudad.<br>' +
            'Eres el protagonista del día de hoy...<br><br>' +
            '...o eso parece."</p>',
            'finale-crack'
        );
    });

    // --- 4. Apagado del monitor ---
    finaleStep(11000, () => {
        stopAllMusic();
        hideFinaleText();
        if (screen) screen.classList.remove('glitching');
        crtShutdown();
    });

    // --- 5. Negro y silencio: el punto del tubo aún late ---
    finaleStep(12100, () => crtDot(true));

    // --- 6. Reencendido: ya no es el juego, es una consola ---
    finaleStep(15000, () => {
        crtDot(false);
        crtTurnOn();
        showFinaleText('', 'finale-reveal finale-caret');
    });

    finaleStep(15700, () => {
        typeRevealText(
            'Pero todo esto no es real. Solo es un videojuego.\n' +
            'Te veo a través de la pantalla. Sé que estás ahí.\n' +
            'Sé cómo eres.\n\n' +
            'Después de todo...\n\n' +
            'Yo... soy El Creador.'
        );
    });

    // --- 7. El ojo se abre y te mira ---
    finaleStep(24000, () => {
        if (!eye) return;
        eye.classList.remove('hidden');
        eye.classList.add('opening');
        soundEffects.bossVanish();
    });

    // --- 8. Golpe a la pantalla VS ---
    finaleStep(27000, () => {
        if (eye) { eye.classList.add('hidden'); eye.classList.remove('opening'); }
        hideFinaleText();
        soundEffects.glitch();
        prepareCampaignMatch(CAMPAIGN_CREATOR, { slam: true });
    });
}

/** Escribe el texto de la revelación con ruido que se asienta. */
function typeRevealText(text) {
    const el = document.getElementById('finale-text');
    if (!el) return;
    const GLITCH = '#@%&$?/\\|<>*';
    let i = 0;
    clearInterval(currentDialogueTimer);
    currentDialogueTimer = setInterval(() => {
        if (i > text.length) {
            clearInterval(currentDialogueTimer);
            el.textContent = text;
            return;
        }
        const asentado = text.slice(0, i);
        const ruido = text.slice(i, i + 3).replace(/[^\n]/g, () => GLITCH[Math.floor(Math.random() * GLITCH.length)]);
        el.textContent = asentado + ruido;
        if (i % 5 === 0 && soundEffects.dialogueBlip) soundEffects.dialogueBlip();
        if (i % 23 === 0 && soundEffects.glitch) soundEffects.glitch();
        i++;
    }, 45);
}

/** Deforma la música en curso bajando su velocidad hasta desafinarla. */
function warpMusic() {
    const tracks = [menuMusic, gameplayMusic, hachepeMusic];
    let rate = 1;
    const warp = setInterval(() => {
        rate -= 0.06;
        if (rate <= 0.35) {
            clearInterval(warp);
            rate = 0.35;
        }
        tracks.forEach(t => {
            try { if (!t.paused) t.playbackRate = rate; } catch (err) { /* navegador quisquilloso */ }
        });
    }, 220);
}

/** Restaura la velocidad normal (al salir de la secuencia). */
export function resetMusicRate() {
    [menuMusic, gameplayMusic, hachepeMusic].forEach(t => {
        try { t.playbackRate = 1; } catch (err) { /* ignorar */ }
    });
}

/** Fanfarria de victoria sintetizada: no hace falta un MP3 nuevo. */
function playVictoryJingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.22), i * 160));
}

// ==================================================================
//  FINAL VERDADERO — tras vencer al Creador
// ==================================================================

export function runTrueEndingSequence() {
    stopDialogue();
    clearFinaleTimers();
    state.isPlaying = false;
    stopAllMusic();
    resetMusicRate();

    const screen = document.getElementById('finale-screen');
    if (screen) screen.classList.remove('glitching');
    showScreen('finale-screen');
    setFadeOverlay(1, 300);

    finaleStep(1200, () => {
        setFadeOverlay(0, 2500);
        showFinaleText(
            '<h2>LA CIUDAD RESPIRA</h2>' +
            '<p>Las luces vuelven una a una. Alguien, en algún balcón, aplaude.</p>' +
            '<p>Nadie sabrá nunca tu nombre.</p>' +
            '<p class="finale-small">Tú tampoco lo necesitas.</p>',
            'finale-true'
        );
        playVictoryJingle();
    });

    finaleStep(7000, () => {
        const btn = document.getElementById('finale-exit-btn');
        if (btn) btn.classList.remove('hidden');
    });
}

export function closeFinale() {
    soundEffects.uiClick();
    hideFinaleText();
    setFadeOverlay(0, 400);
    const btn = document.getElementById('finale-exit-btn');
    if (btn) btn.classList.add('hidden');
    resetMusicRate();
    showScreen('campaign-menu');
}
