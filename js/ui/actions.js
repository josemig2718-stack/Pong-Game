/**
 * ui/actions.js
 * ------------------------------------------------------------------
 * Delegación de eventos de la interfaz. El HTML no lleva manejadores
 * en línea: cada control declara qué hace con atributos data-*.
 *
 *   data-action="nombre"  → al hacer clic
 *   data-input="nombre"   → en cada evento input (sliders en vivo)
 *   data-change="nombre"  → en el evento change (sliders, interruptores)
 *
 * El nombre es el de la función que acaba llamando, para que buscar
 * una función en el proyecto encuentre también los botones que la usan.
 * Si la acción necesita un argumento va en data-arg, y cada entrada lo
 * convierte a su tipo: los valores de dataset llegan siempre como texto.
 * ------------------------------------------------------------------
 */

'use strict';

/** @type {Record<string, (el: HTMLElement) => void>} */
const CLICK_ACTIONS = {
    // Navegación
    showScreen:             (el) => showScreen(el.dataset.arg),
    showStatsScreen:        () => showStatsScreen(),
    showAchievementsScreen: () => showAchievementsScreen(),
    closeGame:              () => closeGame(),
    openHowto:              (el) => openHowto(/** @type {HowtoOrigin} */ (el.dataset.arg)),
    closeHowto:             () => closeHowto(),
    openNews:               () => openNews(),
    closeNews:              () => closeNews(),
    newsToHowto:            () => newsToHowto(),
    forceClose:             () => forceClose(),

    // Partida
    startGame:              (el) => startGame(/** @type {GameMode} */ (el.dataset.arg)),
    togglePause:            () => togglePause(),
    quitGame:               () => quitGame(),
    restartCurrentGame:     () => restartCurrentGame(),
    startPractice:          (el) => startPractice(el.dataset.arg),

    // Campaña
    towerSelect:            (el) => towerSelect(Number(el.dataset.arg)),
    towerEnter:             () => towerEnter(),
    toggleFloorSheet:       () => toggleFloorSheet(),
    playCampaignPrologue:   () => playCampaignPrologue(),
    towerScene:             () => towerScene(),
    nextCampaignLevel:      () => nextCampaignLevel(),
    closeFinale:            () => closeFinale(),

    // Escenas (el prólogo)
    cutsceneAdvance:        () => cutsceneAdvance(),
    cutsceneSkip:           () => cutsceneSkip(),

    // Configuración, controles y estadísticas
    updateWinningScore:     (el) => updateWinningScore(Number(el.dataset.winningScore)),
    updateBallSpeed:        (el) => updateBallSpeed(Number(el.dataset.ballSpeed)),
    updateSmashTouch:       (el) => updateSmashTouch(el.dataset.smashTouch),
    resetAllSettings:       () => resetAllSettings(),
    resetBindings:          () => resetBindings(),
    confirmResetStats:      () => confirmResetStats(),
    filterAchievements:     (el) => filterAchievements(el.dataset.arg),

    // Tienda (data-arg de los artículos: "categoría:id")
    switchShopTab:          (el) => switchShopTab(el.dataset.arg),
    buyShopItem:            (el) => buyShopItem(...shopArg(el)),
    equipShopItem:          (el) => equipShopItem(...shopArg(el)),
    previewShopItem:        (el) => previewShopItem(...shopArg(el)),
    stopShopListen:         () => stopShopListen(),
    showShopOffer:          () => showShopOffer()
};

/**
 * Categoría e id de un artículo de la tienda a partir de su data-arg.
 * @param {HTMLElement} el
 * @returns {[string, string]}
 */
function shopArg(el) {
    const [cat, id] = el.dataset.arg.split(':');
    return [cat, id];
}

/** @type {Record<string, (el: HTMLInputElement) => void>} */
const INPUT_ACTIONS = {
    updateVolume:      (el) => updateVolume(el.value),
    updateMusicVolume: (el) => updateMusicVolume(el.value)
};

/** @type {Record<string, (el: HTMLInputElement) => void>} */
const CHANGE_ACTIONS = {
    updateDifficulty:   (el) => updateDifficulty(el.value),
    toggleMusic:        (el) => toggleMusic(el.checked),
    toggleSfx:          (el) => toggleSfx(el.checked),
    toggleCrtEffect:    (el) => toggleCrtEffect(el.checked),
    toggleScreenShake:  (el) => toggleScreenShake(el.checked),
    toggleMouseControl: (el) => toggleMouseControl(el.checked),
    togglePowerups:     (el) => togglePowerups(el.checked),
    toggleHints:        (el) => toggleHints(el.checked),
    toggleHaptics:      (el) => toggleHaptics(el.checked),
    toggleDynamicMusic: (el) => toggleDynamicMusic(el.checked),
    updateTextSpeed:    (el) => updateTextSpeed(el.value),
    setShopSort:        (el) => setShopSort(el.value)
};

/**
 * Crea un listener que busca el control con el atributo indicado y
 * ejecuta su acción del registro.
 * @param {Record<string, (el: any) => void>} registry
 * @param {string} attr nombre del atributo data-* (sin el prefijo)
 */
function delegate(registry, attr) {
    const selector = `[data-${attr}]`;
    return (e) => {
        const el = e.target.closest(selector);
        if (!el) return;
        const name = el.dataset[attr];
        const action = registry[name];
        if (!action) throw new Error(`Acción desconocida: data-${attr}="${name}"`);
        action(el);
    };
}

/** Registra los tres listeners delegados en el documento. */
function initActions() {
    document.addEventListener('click', delegate(CLICK_ACTIONS, 'action'));
    document.addEventListener('input', delegate(INPUT_ACTIONS, 'input'));
    document.addEventListener('change', delegate(CHANGE_ACTIONS, 'change'));
}
