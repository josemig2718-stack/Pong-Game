/**
 * campaign/menu.js
 * ------------------------------------------------------------------
 * El menú de campaña: el carrusel de jefes y la intro narrativa.
 *
 * El carrusel coloca las cartas solo con `transform`: updateCarousel
 * les pone data-pos (de -2 a 2) y el CSS traduce cada posición. Solo
 * dibuja dos vecinas a cada lado. Se maneja con flechas, teclado, el
 * camino de nodos y deslizamiento: al tocarlo, mantén las cuatro vías.
 * La carta del Creador solo aparece cuando el progreso llega a 6: nada
 * del Creador debe verse antes de que la historia lo revele.
 * ------------------------------------------------------------------
 */

'use strict';

let carouselIndex = 0;      // carta centrada

let carouselCards = [];     // niveles disponibles, en orden

/** Niveles que se muestran: los 5 Hachepes, más el Creador si ya se reveló. */
function getCarouselLevels() {
    const niveles = [1, 2, 3, 4, 5];
    if (playerProgression.campaignProgress >= CAMPAIGN_CREATOR) niveles.push(CAMPAIGN_CREATOR);
    return niveles;
}

const DANGER_STAR_PATH = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z';
const CARD_ICON_CHECK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
const CARD_ICON_LOCK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const CARD_ICON_SWORD = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/></svg>';

/**
 * Peligro de un jefe como cinco estrellas SVG (las ⭐ de su lore). El
 * Creador no tiene estrellas: su peligro es un ERROR. Lo usan las
 * cartas del carrusel y la pantalla VS.
 * @param {string} danger
 * @returns {string} HTML
 */
function dangerStarsHTML(danger) {
    if (!danger.includes('⭐')) return `<span class="danger-error">${danger}</span>`;
    const filled = danger.split('⭐').length - 1;
    let html = `<span class="danger-stars" role="img" aria-label="${filled} de 5">`;
    for (let i = 0; i < 5; i++) {
        const empty = i < filled ? '' : ' danger-star--empty';
        html += `<svg class="danger-star${empty}" viewBox="0 0 24 24" aria-hidden="true"><path d="${DANGER_STAR_PATH}"/></svg>`;
    }
    return html + '</span>';
}

/**
 * Qué hay que hacer para desbloquear un nivel: "Vence al Dúo Letal"
 * (el título del jefe anterior, con el artículo contraído).
 * @param {number} nivel
 */
function campaignUnlockHint(nivel) {
    const title = HACHEPES_LORE[nivel - 1].title;
    return 'Vence ' + (title.startsWith('El ') ? 'al ' + title.slice(3) : 'a ' + title);
}

/** Construye el carrusel de jefes (al entrar en el menú de campaña). */
function renderCampaignMap() {
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
            + (vencido ? ' defeated' : '')
            + (esCreador ? ' corrupted' : '');
        card.dataset.index = String(i);

        card.innerHTML = `
            <div class="boss-card__stage">
                <img class="boss-card__sprite" src="${boss.image}" alt="">
                ${boss.image2 ? `<img class="boss-card__sprite" src="${boss.image2}" alt="">` : ''}
                <span class="boss-card__level">NIVEL ${esCreador ? '??' : nivel}</span>
                ${bossCardFlag(actual, vencido)}
            </div>
            <div class="boss-card__body">
                ${desbloqueado ? bossCardBody(boss, vencido) : lockedCardBody(nivel)}
                <div class="boss-card__side">
                    ${bossCardChip(actual, vencido)}
                    <span class="px boss-card__side-name">${desbloqueado ? boss.name : 'NIVEL ' + nivel}</span>
                    <span class="boss-card__side-sub">${vencido ? 'Repetir · recompensa reducida'
                        : (desbloqueado ? 'Te espera' : campaignUnlockHint(nivel))}</span>
                </div>
            </div>`;

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

/** Insignia de estado sobre el retrato de la carta centrada. */
function bossCardFlag(actual, vencido) {
    if (actual) {
        return '<span class="boss-card__flag"><span class="boss-card__flag-long">SIGUIENTE RIVAL</span><span class="boss-card__flag-short">SIGUIENTE</span></span>';
    }
    return vencido
        ? `<span class="boss-card__flag boss-card__flag--done">${CARD_ICON_CHECK}DERROTADO</span>`
        : `<span class="boss-card__flag boss-card__flag--locked">${CARD_ICON_LOCK}BLOQUEADO</span>`;
}

/** Chip de estado de las cartas laterales. */
function bossCardChip(actual, vencido) {
    if (actual) return '<span class="boss-card__chip boss-card__chip--next">SIGUIENTE</span>';
    return vencido
        ? `<span class="boss-card__chip boss-card__chip--done">${CARD_ICON_CHECK}DERROTADO</span>`
        : `<span class="boss-card__chip">${CARD_ICON_LOCK}BLOQUEADO</span>`;
}

/** Ficha completa de un jefe desbloqueado (se ve en la carta centrada). */
function bossCardBody(boss, vencido) {
    return `
                <div class="boss-card__main">
                    <div class="boss-card__heading">
                        <div class="boss-card__names">
                            <h3 class="px boss-card__name">${boss.name}</h3>
                            <p class="boss-card__title">${boss.title}</p>
                        </div>
                        <div class="boss-card__danger"><span class="lbl">Peligro</span>${dangerStarsHTML(boss.danger)}</div>
                    </div>
                    <p class="boss-card__desc">${boss.desc}</p>
                    <span class="boss-card__cta">${vencido ? 'REPETIR' : 'ENFRENTAR'}${CARD_ICON_SWORD}</span>
                </div>`;
}

/** Un jefe bloqueado solo deja ver su silueta: ni nombre ni historia. */
function lockedCardBody(nivel) {
    return `
                <div class="boss-card__main">
                    <div class="boss-card__heading">
                        <div class="boss-card__names">
                            <h3 class="px boss-card__name">???</h3>
                            <p class="boss-card__title">Sin identificar</p>
                        </div>
                    </div>
                    <p class="boss-card__desc">${campaignUnlockHint(nivel)} para descubrir quién te espera aquí.</p>
                    <span class="boss-card__cta boss-card__cta--locked">BLOQUEADO${CARD_ICON_LOCK}</span>
                </div>`;
}

/**
 * El camino de nodos bajo el carrusel: uno por carta, con su estado
 * (vencido, pendiente o bloqueado). Las líneas entre nodos son
 * pseudo-elementos, así que los nodos son los únicos hijos.
 */
function buildCarouselDots() {
    const dots = document.getElementById('carousel-dots');
    if (!dots) return;
    dots.innerHTML = '';
    carouselCards.forEach((nivel, i) => {
        const estado = nivel < playerProgression.campaignProgress ? 'done'
            : (nivel === playerProgression.campaignProgress ? 'current' : 'locked');
        const d = document.createElement('button');
        d.type = 'button';
        d.className = `carousel-dot carousel-dot--${estado}` + (nivel === CAMPAIGN_CREATOR ? ' carousel-dot--creator' : '');
        d.textContent = nivel === CAMPAIGN_CREATOR ? '??' : String(nivel);
        d.setAttribute('aria-label', `Rival ${i + 1}`);
        d.addEventListener('click', () => { carouselIndex = i; updateCarousel(); soundEffects.uiClick(); });
        dots.appendChild(d);
    });
}

/** Coloca cada carta según su distancia a la centrada (el CSS lee data-pos). */
function updateCarousel() {
    const track = document.getElementById('campaign-nodes');
    if (!track) return;
    const cards = /** @type {HTMLElement[]} */ ([...track.children]);

    cards.forEach((card, i) => {
        const d = i - carouselIndex;
        const abs = Math.abs(d);
        card.classList.toggle('is-active', d === 0);
        // Más allá de dos posiciones no se dibuja: evita una fila infinita
        card.style.display = abs > 2 ? 'none' : '';
        card.dataset.pos = String(Math.max(-2, Math.min(2, d)));
        card.style.zIndex = String(10 - abs);
        card.style.pointerEvents = abs > 1 ? 'none' : 'auto';
    });

    const dots = document.getElementById('carousel-dots');
    if (dots) {
        [...dots.children].forEach((d, i) => d.classList.toggle('active', i === carouselIndex));
    }

    const prev = /** @type {HTMLButtonElement} */ (document.getElementById('carousel-prev'));
    const next = /** @type {HTMLButtonElement} */ (document.getElementById('carousel-next'));
    if (prev) prev.disabled = carouselIndex === 0;
    if (next) next.disabled = carouselIndex >= carouselCards.length - 1;
}

/** Mueve el carrusel `paso` cartas (flechas en pantalla y teclado). */
function carouselMove(paso) {
    const nuevo = carouselIndex + paso;
    if (nuevo < 0 || nuevo >= carouselCards.length) return;
    carouselIndex = nuevo;
    updateCarousel();
    soundEffects.uiClick();
}

/** Teclado y deslizamiento: el carrusel se maneja sin ratón. */
function initCarouselControls() {
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
    view.addEventListener('touchstart', (/** @type {TouchEvent} */ e) => { startX = e.touches[0].clientX; }, { passive: true });
    view.addEventListener('touchend', (/** @type {TouchEvent} */ e) => {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) carouselMove(dx < 0 ? 1 : -1);
        startX = null;
    }, { passive: true });
}

/** Intro narrativa con máquina de escribir; un toque la completa de golpe. */
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
    clearTypewriter();
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

/** Botón "ACEPTAR MI DESTINO": cierra la intro y la marca como vista. */
function closeCampaignIntro() {
    const overlay = document.getElementById('campaign-intro-overlay');
    if (overlay) overlay.classList.add('hidden');
    playerProgression.campaignIntroSeen = true;
    saveProgression();
    soundEffects.uiClick();
}

/** Botón "Ver Historia": vuelve a mostrar la intro. */
function replayCampaignIntro() {
    soundEffects.uiClick();
    showCampaignIntro();
}
