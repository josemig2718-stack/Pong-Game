/**
 * campaign/menu.js
 * ------------------------------------------------------------------
 * El menú de campaña: el carrusel de jefes y la intro narrativa.
 *
 * El carrusel coloca las cartas solo con `transform` (updateCarousel) y
 * solo dibuja dos vecinas a cada lado. Se maneja con flechas, teclado,
 * puntos y deslizamiento: al tocarlo, mantén las cuatro vías. La carta
 * del Creador solo aparece cuando el progreso llega a 6: nada del
 * Creador debe verse antes de que la historia lo revele.
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
            + (esCreador ? ' corrupted' : '');
        card.dataset.index = String(i);

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
    const cards = /** @type {HTMLElement[]} */ ([...track.children]);

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
