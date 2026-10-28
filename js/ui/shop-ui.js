/**
 * ui/shop-ui.js
 * ------------------------------------------------------------------
 * Pantalla de la tienda: la oferta del día, las pestañas por categoría
 * (con cuántos objetos tienes de cada una), la línea de la pestaña con
 * el orden, las tarjetas de cada artículo con su icono y su rareza, el
 * contador de la colección y, en escritorio, la ficha del artículo
 * elegido. La vista previa animada está en ui/shop-preview.js; el
 * catálogo y los iconos, en data/shop.js; las compras se registran en
 * systems/progression.js.
 *
 * Cada tarjeta es un <article> con dos botones reales: el recuadro del
 * icono (vista previa) y el de la acción (comprar, USAR, EQUIPADO o el
 * candado de un exclusivo). Todos llevan data-action (ui/actions.js) con
 * data-arg "categoría:id".
 * ------------------------------------------------------------------
 */

'use strict';

/** Pestaña abierta; se conserva entre visitas a la tienda. */
let currentShopTab = 'trails';

/** Artículo elegido para la vista previa; null = el equipado de la pestaña. */
let shopPreviewId = null;

/** Orden de la rejilla: 'rarity', 'price' o 'unowned' (sin comprar primero). */
let shopSortMode = 'rarity';

/** Contador para que los id de los iconos en línea no se repitan. */
let shopIconUid = 0;

/** Intervalo de la cuenta atrás de la oferta (se para al salir de la tienda). */
let shopOfferTimer = null;

/** Nombre en singular de lo que vende cada pestaña (vista previa). */
const SHOP_ITEM_KIND = { trails: 'Estela', backgrounds: 'Fondo', paddles: 'Paleta', goalEffects: 'Efecto de gol',
                         balls: 'Bola', super: 'Súper golpe', music: 'Canción' };

/** Orden de las rarezas al ordenar por rareza. */
const SHOP_RARITY_ORDER = { ini: 0, rar: 1, epi: 2, leg: 3, exc: 4 };

/** Rebaja de la oferta del día. */
const SHOP_OFFER_DISCOUNT = 0.3;

const SHOP_COIN_IMG = '<img src="assets/chemi_coin.png" alt="" class="shop-coin">';
const SHOP_CHECK_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
const SHOP_LOCK_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

/**
 * Muestra la pantalla de la tienda
 */
function showShopScreen() {
    shopPreviewId = null;
    renderShopOffer();
    populateShopTab(currentShopTab);
    tickShopOffer();
    if (!shopOfferTimer) shopOfferTimer = setInterval(tickShopOffer, 1000);
}

/**
 * Cambia la pestaña de la tienda
 */
function switchShopTab(categoryKey) {
    currentShopTab = categoryKey;
    shopPreviewId = null;

    const tabButtons = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.shop-tab-btn'));
    tabButtons.forEach(btn => {
        const on = btn.dataset.arg === categoryKey;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
    });

    populateShopTab(currentShopTab);
}

/** Cambia el orden de la rejilla (el selector «Ordenar»). */
function setShopSort(mode) {
    shopSortMode = mode;
    populateShopTab(currentShopTab);
}

/** ¿El jugador tiene este artículo? Los gratuitos son de todos; los exclusivos, de quien los consiguió. */
function shopOwns(categoryKey, item) {
    return shopIsFree(item) || hasItem(categoryKey, item.id);
}

/** Id del artículo equipado en una pestaña. */
function shopEquippedId(categoryKey) {
    return equippedId(categoryKey);
}

/** Busca un artículo por categoría e id. */
function shopFindItem(categoryKey, itemId) {
    return (SHOP_CATALOG[categoryKey] || []).find(i => i.id === itemId);
}

/**
 * Icono de un artículo: en línea si toma el color del tema (SHOP_ICONS),
 * si no, el SVG de assets/shop/.
 */
function shopIconHTML(categoryKey, item) {
    const name = SHOP_ICON_PREFIX[categoryKey] + item.id;
    const inline = SHOP_ICONS[name];
    if (inline) return inline.replace(/\{uid\}/g, `${name}-${++shopIconUid}`);
    return `<img src="assets/shop/${name}.svg" alt="">`;
}

// --- Oferta del día ---

/** Precio rebajado de la oferta: −30 %, redondeado a múltiplos de 5. */
function shopOfferPrice(price) {
    return Math.round(price * (1 - SHOP_OFFER_DISCOUNT) / 5) * 5;
}

/**
 * La oferta de un día: el primer objeto de pago que el jugador no tiene
 * en una mezcla del catálogo hecha con la fecha local como semilla (el
 * mismo hash que las misiones). Comprar otro objeto no la cambia; null si
 * ya lo tiene todo o si hoy ya compró la oferta.
 * @param {Date} [date]
 * @returns {{cat: string, item: ShopItem, price: number, day: string} | null}
 */
function shopDailyOffer(date = new Date()) {
    const day = missionDayKey(date);
    if (playerProgression.dailyOfferBought === day) return null;
    /** @type {{cat: string, item: ShopItem}[]} */
    const pool = [];
    for (const cat in SHOP_CATALOG) {
        for (const item of SHOP_CATALOG[cat]) {
            if (item.price > 0 && !item.exclusive) pool.push({ cat, item });
        }
    }
    const rng = missionRng(missionHash(`oferta:${day}`));
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const pick = pool.find(o => !hasItem(o.cat, o.item.id));
    return pick ? { ...pick, price: shopOfferPrice(pick.item.price), day } : null;
}

/** Precio que se paga hoy por un artículo: el de la oferta si es el del día. */
function shopPriceFor(categoryKey, item) {
    const offer = shopDailyOffer();
    return offer && offer.cat === categoryKey && offer.item.id === item.id ? offer.price : item.price;
}

/** Pinta la tarjeta de la oferta del día (o la oculta si no hay). */
function renderShopOffer() {
    const box = document.getElementById('shop-offer');
    if (!box) return;
    const offer = shopDailyOffer();
    box.hidden = !offer;
    if (!offer) return;
    const icon = document.getElementById('shop-offer-icon');
    icon.className = `shop-offer__tile shop-card__tile shop-card__tile--${shopRarity(offer.item).key}`;
    icon.innerHTML = shopIconHTML(offer.cat, offer.item);
    setMenuText('shop-offer-name', offer.item.name);
    setMenuText('shop-offer-old', String(offer.item.price));
    setMenuText('shop-offer-price', String(offer.price));
    box.dataset.day = offer.day;
}

/**
 * Cuenta atrás de la oferta hasta la medianoche local («Cambia en
 * hh:mm»). Al cambiar el día vuelve a pintar la tienda; al salir de ella,
 * se para.
 */
function tickShopOffer() {
    if (!document.getElementById('shop-menu').classList.contains('active-screen')) {
        clearInterval(shopOfferTimer);
        shopOfferTimer = null;
        return;
    }
    const now = new Date();
    const box = document.getElementById('shop-offer');
    if (box && !box.hidden && box.dataset.day !== missionDayKey(now)) {
        renderShopOffer();
        populateShopTab(currentShopTab);
    }
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(0, Math.ceil((midnight.getTime() - now.getTime()) / 60000));
    setMenuText('shop-offer-timer', `Cambia en ${missionPad(Math.floor(mins / 60))}:${missionPad(mins % 60)}`);
}

/** «VER»: salta a la pestaña de la oferta y resalta su tarjeta. */
function showShopOffer() {
    const offer = shopDailyOffer();
    if (!offer) return;
    switchShopTab(offer.cat);
    const card = /** @type {HTMLElement} */ (document.querySelector(`#shop-grid .shop-card[data-id="${offer.item.id}"]`));
    if (!card) return;
    card.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    card.classList.remove('shop-card--flash');
    void card.offsetWidth;   // reinicia la animación si ya estaba
    card.classList.add('shop-card--flash');
    previewShopItem(offer.cat, offer.item.id);
}

// --- Rejilla ---

/**
 * Botón de acción de un artículo, en cuatro estados: EQUIPADO
 * (deshabilitado), USAR, el candado de un exclusivo (deshabilitado, con
 * su condición) o comprar con su precio (apagado si no llegan las
 * monedas, pero pulsable: entonces tiembla el monedero).
 * @param {string} className
 */
function shopActionButton(categoryKey, item, className) {
    const owned = shopOwns(categoryKey, item);
    const equipped = owned && shopEquippedId(categoryKey) === item.id;
    const btn = document.createElement('button');
    btn.className = className;
    btn.dataset.arg = `${categoryKey}:${item.id}`;

    if (equipped) {
        btn.classList.add(`${className}--equipped`);
        btn.textContent = 'EQUIPADO';
        btn.disabled = true;
    } else if (owned) {
        btn.classList.add(`${className}--use`);
        btn.textContent = 'USAR';
        btn.dataset.action = 'equipShopItem';
        btn.setAttribute('aria-label', `Usar ${item.name}`);
    } else if (item.exclusive) {
        btn.classList.add(`${className}--lock`);
        btn.innerHTML = `${SHOP_LOCK_ICON}<span>${shopLockLabel(item)}</span>`;
        btn.disabled = true;
    } else {
        const price = shopPriceFor(categoryKey, item);
        btn.classList.add(`${className}--buy`);
        if (playerProgression.coins < price) btn.classList.add(`${className}--poor`);
        btn.innerHTML = `${SHOP_COIN_IMG}${price}`;
        btn.dataset.action = 'buyShopItem';
        btn.setAttribute('aria-label', `Comprar ${item.name} por ${price} monedas`);
    }
    return btn;
}

/** Los artículos de una pestaña en el orden elegido (a igualdad, el del catálogo). */
function shopSortedItems(categoryKey) {
    const items = SHOP_CATALOG[categoryKey].slice();
    const rank = (item) => SHOP_RARITY_ORDER[shopRarity(item).key];
    const price = (item) => item.exclusive ? Infinity : item.price;
    const byRarity = (a, b) => rank(a) - rank(b) || price(a) - price(b);
    if (shopSortMode === 'price') return items.sort((a, b) => price(a) - price(b) || rank(a) - rank(b));
    if (shopSortMode === 'unowned') {
        const owned = (item) => shopOwns(categoryKey, item) ? 1 : 0;
        return items.sort((a, b) => owned(a) - owned(b) || byRarity(a, b));
    }
    return items.sort(byRarity);
}

/**
 * Muestra los artículos de una categoría específica
 */
function populateShopTab(categoryKey) {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;

    grid.innerHTML = '';
    if (!SHOP_CATALOG[categoryKey]) return;
    const equippedId = shopEquippedId(categoryKey);
    const offer = shopDailyOffer();

    shopSortedItems(categoryKey).forEach(item => {
        const isOwned = shopOwns(categoryKey, item);
        const isEquipped = isOwned && equippedId === item.id;
        const rarity = shopRarity(item);
        const isOffer = !!offer && offer.cat === categoryKey && offer.item.id === item.id;

        const card = document.createElement('article');
        card.className = 'shop-card';
        if (isEquipped) card.classList.add('shop-card--equipped');
        else if (isOwned) card.classList.add('shop-card--owned');
        if (isOffer) card.classList.add('shop-card--offer');
        card.dataset.id = item.id;

        card.innerHTML = `
            <button class="shop-card__tile shop-card__tile--${rarity.key}" data-action="previewShopItem" data-arg="${categoryKey}:${item.id}" aria-label="Vista previa: ${item.name}">${shopIconHTML(categoryKey, item)}</button>
            ${isEquipped ? `<span class="shop-card__tag">${SHOP_CHECK_ICON}EN USO</span>` : isOffer ? '<span class="shop-card__tag shop-card__tag--offer">−30 %</span>' : ''}
            <div class="shop-card__head">
                <span class="shop-card__name">${item.name}</span>
                <span class="shop-card__rarity shop-card__rarity--${rarity.key}">${rarity.label.toUpperCase()}</span>
            </div>
            <p class="shop-card__desc">${item.desc}</p>`;
        card.appendChild(shopActionButton(categoryKey, item, 'shop-card__btn'));
        grid.appendChild(card);
    });

    updateShopMeta(categoryKey);
    renderShopPreview();
}

/**
 * Contadores: cuántos objetos tienes de cada pestaña, la línea de la
 * pestaña («Estelas · 3 de 11») y la colección completa. La colección
 * cuenta todos los artículos; el logro Fashionista pide comprar todos los
 * de pago (los exclusivos no se venden).
 */
function updateShopMeta(categoryKey) {
    let owned = 0, total = 0;
    SHOP_CATEGORIES.forEach(cat => {
        const items = SHOP_CATALOG[cat.key];
        const mine = items.filter(item => shopOwns(cat.key, item)).length;
        owned += mine;
        total += items.length;
        const counter = document.querySelector(`.shop-tab-btn[data-arg="${cat.key}"] [data-tab-count]`);
        if (counter) counter.textContent = `${mine}/${items.length}`;
        if (cat.key === categoryKey) {
            setMenuText('shop-section-title', `${cat.label} · ${mine} de ${items.length}`);
        }
    });

    const complete = isAllItemsPurchased();
    const collectionHTML = `
            <span class="lbl shop-collection__label">Colección</span>
            <span class="px shop-collection__count">${owned} / ${total}</span>
            <span class="shop-collection__bar"><span style="width: ${Math.round(owned / total * 100)}%;"></span></span>
            <span class="shop-collection__text">${complete ? '¡Colección completa!' : 'Cómpralo todo para el logro Fashionista.'}</span>`;

    const navBox = document.getElementById('shop-collection');
    if (navBox) navBox.innerHTML = collectionHTML;

    // En móvil y tablet la colección es una casilla más, al final de la cuadrícula
    const grid = document.getElementById('shop-grid');
    if (grid) {
        const old = grid.querySelector('.shop-collection--inline');
        if (old) old.remove();
        const inline = document.createElement('div');
        inline.className = 'shop-collection shop-collection--inline';
        inline.innerHTML = collectionHTML;
        grid.appendChild(inline);
    }
}

/**
 * Ficha del artículo elegido (escritorio ancho): rareza, nombre,
 * descripción y el botón; el lienzo animado lo monta ui/shop-preview.js.
 */
function renderShopPreview() {
    const box = document.getElementById('shop-preview-body');
    const actions = document.getElementById('shop-preview-actions');
    if (!box || !actions) return;

    const items = SHOP_CATALOG[currentShopTab];
    if (!items.length) return;
    const id = shopPreviewId || shopEquippedId(currentShopTab);
    const item = items.find(i => i.id === id) || items[0];
    const rarity = shopRarity(item);

    document.querySelectorAll('#shop-grid .shop-card').forEach(card => {
        card.classList.toggle('shop-card--selected', /** @type {HTMLElement} */ (card).dataset.id === item.id);
    });
    document.getElementById('shop-preview').dataset.rarity = rarity.key;

    box.innerHTML = `
        <div class="shop-preview__info">
            <span class="shop-card__rarity shop-card__rarity--${rarity.key}">${rarity.label.toUpperCase()} · ${SHOP_ITEM_KIND[currentShopTab].toUpperCase()}</span>
            <span class="px shop-preview__name">${item.name}</span>
            <p class="shop-preview__desc">${item.desc}</p>
        </div>`;

    actions.innerHTML = '';
    const forSale = !shopOwns(currentShopTab, item) && !item.exclusive;
    const price = shopPriceFor(currentShopTab, item);
    if (forSale && playerProgression.coins >= price) {
        const rest = document.createElement('div');
        rest.className = 'shop-preview__rest';
        rest.innerHTML = `<span>Te quedarán</span><span>${playerProgression.coins - price} monedas</span>`;
        actions.appendChild(rest);
    }
    const btn = shopActionButton(currentShopTab, item, 'shop-preview__btn');
    if (forSale) btn.innerHTML = `${SHOP_COIN_IMG}COMPRAR · ${price}`;
    actions.appendChild(btn);

    syncShopPreview(currentShopTab, item.id, shopPreviewId !== null);
}

/**
 * Toca el recuadro de una tarjeta: el artículo pasa a la vista previa y
 * se ve en movimiento (en el panel en escritorio ancho; en el propio
 * recuadro en móvil y tableta), aunque no se tenga. Volver a tocarlo en
 * móvil apaga la animación.
 */
function previewShopItem(categoryKey, itemId) {
    if (categoryKey !== currentShopTab) switchShopTab(categoryKey);
    if (!shopPreviewPanelVisible() && shopPreviewId === itemId && shopPreviewRunning()) {
        stopShopPreview();
        return;
    }
    shopPreviewId = itemId;
    renderShopPreview();
}

// --- Compra y equipo ---

/** El monedero tiembla y suena el «no» (sin monedas suficientes). */
function shopDenied() {
    soundEffects.denied();
    const coinDisplay = document.getElementById('shop-coin-display');
    if (!coinDisplay) return;
    coinDisplay.classList.remove('coin-error');
    void coinDisplay.offsetWidth;   // reinicia la animación si se pulsa seguido
    coinDisplay.classList.add('coin-error');
    setTimeout(() => coinDisplay.classList.remove('coin-error'), 500);
}

/**
 * Compra un objeto de la tienda (al precio de la oferta si es el del día)
 * y lo equipa.
 */
function buyShopItem(categoryKey, itemId) {
    const item = shopFindItem(categoryKey, itemId);
    if (!item || item.exclusive || shopOwns(categoryKey, item)) return;

    const offer = shopDailyOffer();
    const isOffer = !!offer && offer.cat === categoryKey && offer.item.id === item.id;
    const price = isOffer ? offer.price : item.price;

    if (!purchaseItem(categoryKey, item.id, price)) {
        shopDenied();
        return;
    }
    if (isOffer) {
        playerProgression.dailyOfferBought = offer.day;
        saveProgression();
    }
    soundEffects.shopBuy();
    selectCosmetic(categoryKey, item.id);

    if (shopRarity(item).key === 'leg') unlockAchievement('buy_legendary');
    if (isAllItemsPurchased()) unlockAchievement('fashionista');

    shopPreviewId = item.id;
    renderShopOffer();
    populateShopTab(currentShopTab);
    updateCoinDisplay();
}

/**
 * Equipa un objeto
 */
function equipShopItem(categoryKey, itemId) {
    const item = shopFindItem(categoryKey, itemId);
    if (!item || !shopOwns(categoryKey, item)) return;

    selectCosmetic(categoryKey, itemId);
    shopPreviewId = itemId;
    populateShopTab(currentShopTab);
}
