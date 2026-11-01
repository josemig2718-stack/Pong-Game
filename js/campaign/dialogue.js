/**
 * campaign/dialogue.js
 * ------------------------------------------------------------------
 * Diálogos de los jefes: cola de líneas con máquina de escribir sobre la
 * partida. Las líneas son strings (habla el jefe, o su hablante 'a') u
 * objetos { t, s, sfx, bust }: `s` elige quién habla ('a' o 'b' en los
 * jefes con `speakers`, 'player' el Desconocido, 'hint' la pista del
 * Creador, sin nombre), `sfx` suena al mostrarla y `bust` cambia el busto
 * solo en esa línea. Con `speakers`, el cuadro toma el nombre, el busto y
 * el color del hablante; voice 'radio' le da aspecto de altavoz.
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
 * Intervalo de la máquina de escribir en curso. Lo comparten los diálogos
 * y la revelación del final: solo puede haber uno a la vez.
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
    if (typeof raw !== 'string' && raw.sfx && soundEffects[raw.sfx]) soundEffects[raw.sfx]();
    bossOnLine(raw);

    const nameEl = document.getElementById('dialogue-name');
    const textEl = document.getElementById('dialogue-text');
    const avatar = /** @type {HTMLImageElement} */ (document.getElementById('dialogue-avatar'));
    const avatar2 = /** @type {HTMLImageElement} */ (document.getElementById('dialogue-avatar2'));
    const playerAvatar = /** @type {HTMLCanvasElement} */ (document.getElementById('dialogue-avatar-player'));
    const isPlayer = speaker === 'player';
    box.classList.toggle('is-player', isPlayer);
    playerAvatar.classList.toggle('hidden', !isPlayer);
    avatar.classList.remove('avatar-hint-flash');
    const who = isPlayer || speaker === 'hint' ? null : dialogueSpeaker(boss, raw);
    box.classList.toggle('has-speaker', !!(who && who.color));
    box.classList.toggle('is-radio', !!(who && who.voice === 'radio'));
    if (who && who.color) {
        box.style.setProperty('--c', who.color);
        box.style.setProperty('--c-a', hexToRgba(who.color, 0.55));
    }

    if (isPlayer) {
        // Habla el Desconocido: su busto con la máscara del tema
        nameEl.textContent = '¿¿??';
        avatar.classList.add('hidden');
        avatar2.classList.add('hidden');
        drawDialoguePlayer(playerAvatar);
    } else if (speaker === 'hint') {
        // La pista del Creador: sin nombre, y el busto parpadea un fotograma
        nameEl.textContent = '';
        avatar.src = boss.image;
        avatar.classList.remove('hidden', 'avatar-dimmed');
        avatar2.classList.add('hidden');
        void avatar.offsetWidth;
        avatar.classList.add('avatar-hint-flash');
    } else {
        // El jefe, o el hablante de la línea (speakers): su nombre y su busto
        nameEl.textContent = who.name;
        avatar.src = who.src;
        avatar.classList.remove('avatar-dimmed', 'hidden');
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
        if (charIndex % 3 === 0 && soundEffects.dialogueBlip) soundEffects.dialogueBlip({ radio: !!(who && who.voice === 'radio') });
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

/**
 * Quién dice una línea de un jefe (diálogos y pullas). Con `speakers`
 * (data/lore.js), el hablante `s` de la línea, o el 'a' si es un string
 * suelto; sin ellos, el jefe. La línea puede traer su propio `bust`.
 * @param {any} boss la entrada de HACHEPES_LORE
 * @param {string|{ t: string, s?: string, bust?: string }} raw
 * @returns {{ name: string, src: string, color: string|null, voice: string|null, paddle: string|null }}
 */
function dialogueSpeaker(boss, raw) {
    const s = typeof raw === 'string' ? null : raw.s;
    const sp = boss.speakers ? boss.speakers[s || 'a'] || null : null;
    const bust = (typeof raw !== 'string' && raw.bust) || (sp && sp.bust) || null;
    return {
        name: sp ? sp.name : boss.name,
        src: bust && CAMPAIGN_ART.bustos[bust] ? CAMPAIGN_ART.bustos[bust].src : boss.image,
        color: sp ? sp.color || null : null,
        voice: sp ? sp.voice || null : null,
        paddle: sp ? sp.paddle || null : null
    };
}

/**
 * El busto del Desconocido en el cuadro de diálogo: la imagen y su
 * máscara teñida del tema, en un canvas (con file:// no se puede pasar a
 * un <img> ni usar mask-image).
 * @param {HTMLCanvasElement} cv
 */
function drawDialoguePlayer(cv) {
    const info = CAMPAIGN_ART.bustos.desconocido;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!drawTintedArt(ctx, info, currentThemeHex(), 0, 0, cv.width, cv.height)) {
        Promise.all([artLoad(info.src), artLoad(info.theme)]).then(() => {
            ctx.clearRect(0, 0, cv.width, cv.height);
            drawTintedArt(ctx, info, currentThemeHex(), 0, 0, cv.width, cv.height);
        });
    }
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
    // En los jefes por fases, las pullas sustituyen a este diálogo
    if (bossHasPhases()) return;
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

/**
 * Diálogo final del jefe, mostrado sobre la pantalla de fin de combate.
 * Al vencer a Yisus se muestra su `lose` sobre el campo y, al cerrarse,
 * `onDone` (el falso final).
 * @param {boolean} p1Won
 * @param {() => void} [onDone]
 */
function playBossOutcomeDialogue(p1Won, onDone) {
    const boss = HACHEPES_LORE[currentCampaignLevel];
    if (!boss) return;
    // Al vencer al Creador manda la secuencia narrativa, no esto
    if (p1Won && currentCampaignLevel === CAMPAIGN_CREATOR) return;
    if (p1Won && currentCampaignLevel === CAMPAIGN_LAST_BOSS) {
        setTimeout(() => queueDialogue(boss.dialogues.lose, onDone), 400);
        return;
    }
    let lines = p1Won ? boss.dialogues.lose : boss.dialogues.win;
    // La pista del Creador: solo la primera vez que se vence a este jefe
    // (el récord aún no se ha guardado: checkWin lo hace después)
    if (p1Won && boss.dialogues.creatorHint && !campaignBestOf(currentCampaignLevel).won) {
        lines = [...lines, { t: boss.dialogues.creatorHint, s: 'hint' }];
    }
    setTimeout(() => queueDialogue(lines), 400);
}
