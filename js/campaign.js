/**
 * campaign.js
 * ------------------------------------------------------------------
 * Modo Campaña: "La Venganza contra los Hachepes".
 *
 * Lore, mapa de niveles, sistema de diálogos y la secuencia del falso
 * final. Las mecánicas de cada combate viven en bosses.js.
 * ------------------------------------------------------------------
 */

const CAMPAIGN_LAST_BOSS = 5;   // últimos Hachepes "normales"
const CAMPAIGN_CREATOR = 6;     // nivel secreto

/**
 * Los seis Hachepes. Los diálogos aceptan strings (habla el jefe) u
 * objetos { t, s } donde `s` elige el avatar ('a' o 'b') — lo usa el dúo.
 */
const HACHEPES_LORE = {
    1: {
        id: 'chemi',
        name: 'Hachepe Chemi',
        title: 'El Guardián de la Frontera',
        image: 'assets/images/hachepe_chemi.png',
        danger: '⭐⭐',
        desc: 'Vigila los escombros de tu antiguo barrio.',
        dialogues: {
            start: [
                'Vaya. Un superviviente.',
                'Este montón de escombros era tu casa, ¿verdad?',
                'Yo mismo la tiré. Y no recuerdo tu cara.'
            ],
            mid: ['¿Ves? Nadie se levanta dos veces.'],
            win: ['Vuelve al polvo, don nadie.'],
            lose: ['¿Cómo...? ¡Solo eras basura!']
        }
    },
    2: {
        id: 'dani',
        name: 'Hachepe Dani',
        title: 'El Arquitecto del Caos',
        image: 'assets/images/hachepe_dani.png',
        danger: '⭐⭐⭐',
        desc: 'Diseñó las murallas que encierran tu ciudad.',
        dialogues: {
            start: [
                'Yo dibujé estas calles. Yo dibujé estos muros.',
                'Cada esquina donde se esconde tu gente la puse yo.',
                'Tus movimientos son tan predecibles como un plano.'
            ],
            mid: ['¡Mis cálculos no fallan!'],
            win: ['Estructura defectuosa. Demolida.'],
            lose: ['¡Imposible! ¡Estaba todo calculado!']
        }
    },
    3: {
        id: 'mario_valen',
        name: 'Mario y Valentín',
        title: 'El Dúo Letal',
        image: 'assets/images/hachepe_mario.png',
        image2: 'assets/images/hachepe_valen.png',
        danger: '⭐⭐⭐⭐',
        desc: 'Los que se llevaron a tu familia. Nunca vienen solos.',
        dialogues: {
            start: [
                { t: 'Mira, Valen. Otro que quiere su ciudad de vuelta.', s: 'a' },
                { t: 'Siempre vienen solos, Mario. Nosotros nunca.', s: 'b' },
                { t: 'Esa es toda la diferencia.', s: 'a' }
            ],
            mid: [
                { t: '¡Por arriba!', s: 'b' },
                { t: '¡Y por abajo!', s: 'a' }
            ],
            win: [
                { t: 'Otro nombre para la lista.', s: 'a' },
                { t: 'Ni siquiera tenía nombre.', s: 'b' }
            ],
            lose: [
                { t: 'Valen... nos ha ganado.', s: 'a' },
                { t: 'A los dos, Mario. A los dos.', s: 'b' }
            ]
        }
    },
    4: {
        id: 'fano',
        name: 'Hachepe Fano',
        title: 'El Guardián de las Sombras',
        image: 'assets/images/hachepe_fano.png',
        danger: '⭐⭐⭐⭐',
        desc: 'Apagó las luces de la ciudad y nunca las devolvió.',
        dialogues: {
            start: [
                'Yo apagué las farolas. Yo apagué las casas.',
                'Tu gente aprendió a vivir a oscuras por mi culpa.',
                '¿De verdad crees que puedes ver algo aquí?'
            ],
            mid: ['Lo que persigues no está ahí.'],
            win: ['Te perdiste, como todos.'],
            lose: ['No... ¡me has visto!']
        }
    },
    5: {
        id: 'yisus',
        name: 'Hachepe Yisus',
        title: 'El Falso Rey',
        image: 'assets/images/hachepe_yisus.png',
        danger: '⭐⭐⭐⭐⭐',
        desc: 'Se coronó sobre las ruinas. El último tirano.',
        dialogues: {
            start: [
                'Así que has llegado hasta mi trono.',
                'Los otros cuatro eran mis manos. Yo di la orden.',
                'Yo ordené quemar tu ciudad. Yo. ¿Y ahora qué?'
            ],
            mid: ['¡Tu tiempo me pertenece!'],
            win: ['Nadie destrona a un rey.'],
            lose: ['Un rey... derrotado por nadie...']
        }
    },
    6: {
        id: 'creator',
        name: 'El Creador',
        title: '¿?¿?¿?',
        image: 'assets/images/hachepe_chemi.png',
        danger: 'ERROR',
        desc: '???',
        dialogues: {
            start: [
                'No me reconoces, ¿verdad?',
                'Fui el primero al que venciste.',
                'Tenía que ver de cerca a mi creación.'
            ],
            mid: ['¡MI CÓDIGO ES LEY!'],
            win: ['FIN DE LA SIMULACIÓN.'],
            lose: ['Esto... no estaba escrito...']
        }
    }
};

/** Texto de la intro narrativa. */
const CAMPAIGN_INTRO_TEXT =
    'Los Hachepes llegaron sin avisar. Un sindicato de tiranos que quemó tu ciudad, ' +
    'derribó tu casa y esclavizó a todos los que conocías.\n\n' +
    'Montaron sobre las ruinas un torneo enfermo donde perder significa desaparecer.\n\n' +
    'No tienes nombre. No tienes nada. Por eso nadie te vio venir.';

let currentCampaignLevel = 1;
let dialogueQueue = [];
let isDialogueActive = false;
let dialogueCallback = null;
let currentDialogueTimer = null;
let dialogueAdvanceTimer = null;
let isReplayingBoss = false;   // true si el jefe actual ya estaba vencido

// ==================================================================
//  MAPA DE CAMPAÑA
// ==================================================================

function renderCampaignMap() {
    const mapContainer = document.getElementById('campaign-nodes');
    if (!mapContainer) return;

    mapContainer.innerHTML = '';

    if (!playerProgression.campaignIntroSeen) {
        showCampaignIntro();
    }

    for (let i = 1; i <= CAMPAIGN_LAST_BOSS; i++) {
        const boss = HACHEPES_LORE[i];
        const isUnlocked = i <= playerProgression.campaignProgress;
        const isCurrent = i === playerProgression.campaignProgress;
        const isBeaten = i < playerProgression.campaignProgress;

        const node = document.createElement('div');
        node.className = `campaign-node ${isUnlocked ? 'unlocked' : 'locked'} ${isCurrent ? 'current' : ''}`;

        const label = isUnlocked ? boss.name : '???';
        const icon = !isUnlocked ? '🔒' : (isBeaten ? '✅' : '⚔️');

        node.innerHTML = `
            <div class="node-icon">${icon}</div>
            <div class="node-label">${label}${isBeaten ? '<span class="node-replay">repetir</span>' : ''}</div>
            ${isUnlocked ? `<img class="node-avatar" src="${boss.image}" alt="" onerror="this.style.display='none'">` : ''}
        `;

        if (isUnlocked) {
            node.onclick = () => {
                soundEffects.uiClick();
                prepareCampaignMatch(i);
            };
        }

        mapContainer.appendChild(node);

        if (i < CAMPAIGN_LAST_BOSS) {
            const line = document.createElement('div');
            line.className = `campaign-line ${i < playerProgression.campaignProgress ? 'completed' : ''}`;
            mapContainer.appendChild(line);
        }
    }

    // El nodo del Creador solo existe una vez que la historia lo ha revelado.
    if (playerProgression.campaignProgress >= CAMPAIGN_CREATOR) {
        const line = document.createElement('div');
        line.className = 'campaign-line corrupted';
        mapContainer.appendChild(line);

        const node = document.createElement('div');
        node.className = 'campaign-node unlocked corrupted';
        node.innerHTML = `
            <div class="node-icon">👁️</div>
            <div class="node-label">El Creador</div>
        `;
        node.onclick = () => {
            soundEffects.uiClick();
            prepareCampaignMatch(CAMPAIGN_CREATOR);
        };
        mapContainer.appendChild(node);
    }
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

function closeCampaignIntro() {
    const overlay = document.getElementById('campaign-intro-overlay');
    if (overlay) overlay.classList.add('hidden');
    playerProgression.campaignIntroSeen = true;
    saveProgression();
    soundEffects.uiClick();
}

function replayCampaignIntro() {
    soundEffects.uiClick();
    showCampaignIntro();
}

// ==================================================================
//  PANTALLA VS Y ARRANQUE DEL COMBATE
// ==================================================================

function prepareCampaignMatch(level) {
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
    if (isCreator && soundEffects.glitch) soundEffects.glitch();

    setTimeout(() => {
        startCampaignGame();
    }, isCreator ? 2600 : 3200);
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
function stopDialogue() {
    clearInterval(currentDialogueTimer);
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
let midDialogueShown = false;
function checkMidDialogue() {
    if (gameMode !== 'campaign' || midDialogueShown) return;
    if (p2Score - p1Score < 2) return;
    const boss = HACHEPES_LORE[currentCampaignLevel];
    if (!boss || !boss.dialogues.mid) return;
    midDialogueShown = true;
    queueDialogue(boss.dialogues.mid);
}

function resetMidDialogue() {
    midDialogueShown = false;
}

/** Diálogo final del jefe, mostrado sobre la pantalla de fin de combate. */
function playBossOutcomeDialogue(p1Won) {
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

function handleCampaignVictory() {
    if (typeof unlockAchievement === 'function') {
        unlockAchievement('campaign_first');
        if (currentCampaignLevel === CAMPAIGN_LAST_BOSS) unlockAchievement('campaign_clear');
        if (currentCampaignLevel === CAMPAIGN_CREATOR) unlockAchievement('the_creator');
    }

    // Solo avanza si era el jefe pendiente (repetir uno vencido no cuenta)
    if (currentCampaignLevel === playerProgression.campaignProgress && currentCampaignLevel < CAMPAIGN_CREATOR) {
        playerProgression.campaignProgress++;
        saveProgression();
    }
}

function nextCampaignLevel() {
    soundEffects.uiClick();
    document.getElementById('game-over-screen').classList.remove('active-screen');
    stopDialogue();
    const next = Math.min(playerProgression.campaignProgress, CAMPAIGN_CREATOR);
    if (next <= CAMPAIGN_CREATOR) {
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

/**
 * Falso final tras vencer a Yisus:
 * victoria falsa → la grieta → apagón → revelación → VS El Creador.
 */
function runFinaleSequence() {
    stopDialogue();
    isPlaying = false;

    // Marcar que la historia ya reveló al Creador
    playerProgression.campaignProgress = CAMPAIGN_CREATOR;
    saveProgression();

    // --- 1. Victoria falsa ---
    showScreen('finale-screen');
    showFinaleText('<h2>HAS RECUPERADO<br>TU CIUDAD</h2><p>Los Hachepes han caído. Eres el héroe de hoy.</p>', 'finale-victory');
    if (typeof triggerGoalConfetti === 'function') triggerGoalConfetti(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    soundEffects.win();
    playVictoryJingle();

    // --- 2. La grieta: la música se deforma y llega la voz ---
    setTimeout(() => {
        warpMusic();
        showFinaleText(
            '<p class="finale-voice">"Buen trabajo, amigo. Los derrotaste a todos, eres un héroe y salvaste tu ciudad.' +
            ' Eres el protagonista del día de hoy... o eso parece."</p>',
            'finale-crack'
        );
    }, 3400);

    // --- 3. Apagón total ---
    setTimeout(() => {
        stopAllMusic();
        hideFinaleText();
        setFadeOverlay(1, 1400);
    }, 9000);

    // --- 4. La revelación, en silencio ---
    setTimeout(() => {
        showFinaleText('', 'finale-reveal');
        typeRevealText(
            'Pero todo esto no es real. Solo es un videojuego.\n' +
            'Te veo a través de la pantalla. Sé que estás ahí. Sé cómo eres.\n' +
            'Después de todo...\n\nYo... soy El Creador.'
        );
    }, 11200);

    // --- 5. VS El Creador ---
    setTimeout(() => {
        hideFinaleText();
        setFadeOverlay(0, 600);
        prepareCampaignMatch(CAMPAIGN_CREATOR);
    }, 22000);
}

/** Escribe el texto de la revelación con ruido de glitch. */
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
        // Los últimos caracteres se ven como ruido antes de asentarse
        const settled = text.slice(0, i);
        const noise = text.slice(i, i + 3).replace(/[^\n]/g, () => GLITCH[Math.floor(Math.random() * GLITCH.length)]);
        el.textContent = settled + noise;
        if (i % 4 === 0 && soundEffects.glitch) soundEffects.glitch();
        i++;
    }, 55);
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
function resetMusicRate() {
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

function runTrueEndingSequence() {
    stopDialogue();
    isPlaying = false;
    stopAllMusic();
    resetMusicRate();

    showScreen('finale-screen');
    setFadeOverlay(1, 300);

    setTimeout(() => {
        setFadeOverlay(0, 2500);
        showFinaleText(
            '<h2>LA CIUDAD RESPIRA</h2>' +
            '<p>Las luces vuelven una a una. Alguien, en algún balcón, aplaude.</p>' +
            '<p>Nadie sabrá nunca tu nombre.</p>' +
            '<p class="finale-small">Tú tampoco lo necesitas.</p>',
            'finale-true'
        );
        playVictoryJingle();
    }, 1200);

    setTimeout(() => {
        const btn = document.getElementById('finale-exit-btn');
        if (btn) btn.classList.remove('hidden');
    }, 7000);
}

function closeFinale() {
    soundEffects.uiClick();
    hideFinaleText();
    setFadeOverlay(0, 400);
    const btn = document.getElementById('finale-exit-btn');
    if (btn) btn.classList.add('hidden');
    resetMusicRate();
    showScreen('campaign-menu');
}
