/**
 * campaign/dialogue.js
 * ------------------------------------------------------------------
 * Diálogos de los jefes: cola de líneas con máquina de escribir sobre la
 * partida. Las líneas son strings (habla el jefe) u objetos { t, s },
 * donde `s` ('a' o 'b') elige quién habla en el dúo.
 *
 * Un diálogo activo congela la partida (update() sale antes de mover
 * nada). Tocar el cuadro completa la línea; tocarlo otra vez la pasa.
 * ------------------------------------------------------------------
 */

'use strict';

let dialogueQueue = [];

/** Mientras es true, update() no avanza: es la "pausa" de la campaña. */
let isDialogueActive = false;

let dialogueCallback = null;

/**
 * Intervalo de la máquina de escribir en curso. Lo comparten los diálogos,
 * la intro y la revelación del final: solo puede haber uno a la vez.
 */
let typewriterTimer = null;

let dialogueAdvanceTimer = null;

/** Corta la máquina de escribir en curso, sea cual sea. */
function clearTypewriter() {
    clearInterval(typewriterTimer);
}

/** Arranca una máquina de escribir; sustituye a la anterior como "la actual". */
function startTypewriter(tick, ms) {
    typewriterTimer = setInterval(tick, ms);
}

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

/** Muestra la siguiente línea de la cola, o cierra el diálogo si está vacía. */
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
    const avatar = /** @type {HTMLImageElement} */ (document.getElementById('dialogue-avatar'));
    const avatar2 = /** @type {HTMLImageElement} */ (document.getElementById('dialogue-avatar2'));

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
    clearInterval(typewriterTimer);
    clearTimeout(dialogueAdvanceTimer);

    const finishTyping = () => {
        clearInterval(typewriterTimer);
        textEl.textContent = text;
        dialogueAdvanceTimer = setTimeout(showNextDialogue, 1800);
    };

    typewriterTimer = setInterval(() => {
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
    clearInterval(typewriterTimer);
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
let midDialogueShown = false;

/** Diálogo "voy ganando": salta una sola vez por partida, al ir perdiendo de 2. */
function checkMidDialogue() {
    if (state.mode !== 'campaign' || midDialogueShown) return;
    if (state.p2Score - state.p1Score < 2) return;
    const boss = HACHEPES_LORE[currentCampaignLevel];
    if (!boss || !boss.dialogues.mid) return;
    midDialogueShown = true;
    queueDialogue(boss.dialogues.mid);
}

/** Permite que el diálogo de mitad de combate vuelva a salir (nueva partida). */
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
