/**
 * campaign/finale.js
 * ------------------------------------------------------------------
 * Los desenlaces de la campaña.
 *
 * Vencer a Yisus no lleva a la pantalla de fin: tras su diálogo `lose`
 * empiezan el falso final y la introducción del Creador (películas de
 * data/cutscenes/final.js) y luego su VS. Vencer al Creador dispara el
 * final verdadero. checkWin() los reconoce con su `narrativeEnding` y se
 * salta la pantalla normal.
 *
 * El giro sostiene la historia: nada del Creador debe filtrarse antes.
 * ------------------------------------------------------------------
 */

'use strict';

/**
 * Falso final tras vencer a Yisus (al cerrarse su diálogo `lose`):
 *   campaignProgress = 6 (se guarda ya: si se cierra el juego aquí, el
 *   sótano queda abierto) → FALSO_FINAL → CREADOR_INTRO → VS del Creador.
 * Las dos películas no se pueden saltar la primera vez (noSkipFirstTime);
 * al repetir a Yisus ya vencido sí, y saltar el falso final lleva directo
 * a la introducción. La ruptura de los créditos frena y apaga su música.
 */
function runFinaleSequence() {
    stopDialogue();
    state.isPlaying = false;
    document.getElementById('canvas-wrapper').classList.remove('is-timestop');

    playerProgression.campaignProgress = Math.max(playerProgression.campaignProgress, CAMPAIGN_CREATOR);
    saveProgression();

    playCutscene(FALSO_FINAL, {
        onEnd: () => playCutscene(CREADOR_INTRO, {
            onEnd: () => prepareCampaignMatch(CAMPAIGN_CREATOR, { slam: true })
        })
    });
}

/** Restaura la velocidad normal (al salir de la secuencia). */
function resetMusicRate() {
    musicSetRate(1);
}

/**
 * Final verdadero, tras vencer al Creador (el fundido a blanco de su K.O.
 * enlaza con FINAL_VERDADERO, que empieza en blanco). No se salta la primera
 * vez; al repetir al Creador sí, y saltarlo también da lo suyo.
 */
function runTrueEndingSequence() {
    stopDialogue();
    state.isPlaying = false;
    resetMusicRate();
    playCutscene(FINAL_VERDADERO, { onEnd: finishTrueEnding });
}

/**
 * Al acabar la película: el logro secreto y, con él, la paleta de Pedro
 * (syncExclusives; ambos solo la primera vez) y vuelta a la torre liberada.
 */
function finishTrueEnding() {
    unlockAchievement('nadie_sabe_tu_nombre');
    showScreen('campaign-menu');
}
