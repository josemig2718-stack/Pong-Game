/**
 * ui/shop-ui.js
 * ------------------------------------------------------------------
 * Pantalla de la tienda: pestañas por categoría (con cuántos objetos
 * tienes de cada una), tarjetas de cada artículo con su icono y su
 * rareza, el contador de la colección y, en escritorio, la vista previa
 * del artículo elegido. El catálogo y los iconos están en data/shop.js
 * y las compras se registran en systems/progression.js.
 * ------------------------------------------------------------------
 */

'use strict';

/** Pestaña abierta; se conserva entre visitas a la tienda. */
let currentShopTab = 'trails';

/** Artículo de la vista previa (escritorio); null = el equipado de la pestaña. */
let shopPreviewId = null;

/** Contador para que los id de los iconos en línea no se repitan. */
let shopIconUid = 0;

/** Nombre en singular de lo que vende cada pestaña (vista previa). */
const SHOP_ITEM_KIND = { trails: 'Estela', backgrounds: 'Fondo', paddles: 'Paleta', goalEffects: 'Efecto de gol' };

const SHOP_COIN_IMG = '<img src="assets/chemi_coin.png" alt="" class="shop-coin">';
const SHOP_CHECK_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

/**
 * Muestra la pantalla de la tienda
 */
function showShopScreen() {
    populateShopTab(currentShopTab);
}

/**
 * Cambia la pestaña de la tienda
 */
function switchShopTab(categoryKey) {
    currentShopTab = categoryKey;
    shopPreviewId = null;

    // Actualizar botones UI
    const tabButtons = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.shop-tab-btn'));
    tabButtons.forEach(btn => {
        if (btn.dataset.arg === categoryKey) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    populateShopTab(currentShopTab);
}

/** ¿El jugador tiene este artículo? Los gratuitos son de todos. */
function shopOwns(categoryKey, item) {
    return item.price === 0 || hasItem(categoryKey, item.id);
}

/** Id del artículo equipado en una pestaña. */
function shopEquippedId(categoryKey) {
    return equippedId(categoryKey);
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

/**
 * Botón de acción de un artículo: EQUIPADO (deshabilitado), USAR o
 * comprar con su precio.
 * @param {string} className
 */
function shopActionButton(categoryKey, item, className) {
    const owned = shopOwns(categoryKey, item);
    const equipped = owned && shopEquippedId(categoryKey) === item.id;
    const btn = document.createElement('button');
    btn.className = className;

    if (equipped) {
        btn.classList.add(`${className}--equipped`);
        btn.textContent = 'EQUIPADO';
        btn.disabled = true;
    } else if (owned) {
        btn.classList.add(`${className}--use`);
        btn.textContent = 'USAR';
        btn.addEventListener('click', () => equipShopItem(categoryKey, item.id));
    } else {
        btn.classList.add(`${className}--buy`);
        btn.innerHTML = `${SHOP_COIN_IMG}${item.price}`;
        btn.addEventListener('click', () => buyShopItem(categoryKey, item.id));
    }
    return btn;
}

/**
 * Muestra los artículos de una categoría específica
 */
function populateShopTab(categoryKey) {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const items = SHOP_CATALOG[categoryKey];
    if (!items) return;
    const equippedId = shopEquippedId(categoryKey);

    items.forEach(item => {
        const isOwned = shopOwns(categoryKey, item);
        const isEquipped = isOwned && equippedId === item.id;
        const rarity = shopRarity(item.price);

        const card = document.createElement('div');
        card.className = 'shop-card';
        if (isEquipped) card.classList.add('shop-card--equipped');
        else if (isOwned) card.classList.add('shop-card--owned');
        card.dataset.id = item.id;

        card.innerHTML = `
            <div class="shop-card__tile shop-card__tile--${rarity.key}">${shopIconHTML(categoryKey, item)}</div>
            ${isEquipped ? `<span class="shop-card__tag">${SHOP_CHECK_ICON}EN USO</span>` : ''}
            <div class="shop-card__head">
                <span class="shop-card__name">${item.name}</span>
                <span class="shop-card__rarity shop-card__rarity--${rarity.key}">${rarity.label.toUpperCase()}</span>
            </div>
            <p class="shop-card__desc">${item.desc}</p>`;
        card.appendChild(shopActionButton(categoryKey, item, 'shop-card__btn'));

        // Tocar la tarjeta (fuera del botón) la lleva a la vista previa
        card.addEventListener('click', (e) => {
            if (/** @type {HTMLElement} */ (e.target).closest('button')) return;
            shopPreviewId = item.id;
            renderShopPreview();
        });

        grid.appendChild(card);
    });

    updateShopMeta(categoryKey);
    renderShopPreview();
}

/**
 * Contadores: cuántos objetos tienes de cada pestaña, el título de la
 * sección (móvil) y la colección completa. La colección cuenta los 18
 * artículos; el logro Fashionista pide comprar todos los de pago.
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

/** Vista previa (escritorio): el artículo elegido, o el equipado. */
function renderShopPreview() {
    const box = document.getElementById('shop-preview-body');
    const actions = document.getElementById('shop-preview-actions');
    if (!box || !actions) return;

    const items = SHOP_CATALOG[currentShopTab];
    const id = shopPreviewId || shopEquippedId(currentShopTab);
    const item = items.find(i => i.id === id) || items[0];
    const rarity = shopRarity(item.price);

    document.querySelectorAll('#shop-grid .shop-card').forEach(card => {
        card.classList.toggle('shop-card--selected', /** @type {HTMLElement} */ (card).dataset.id === item.id);
    });
    document.getElementById('shop-preview').dataset.rarity = rarity.key;

    box.innerHTML = `
        <div class="shop-preview__tile shop-card__tile--${rarity.key}">${shopIconHTML(currentShopTab, item)}</div>
        <div class="shop-preview__info">
            <span class="shop-card__rarity shop-card__rarity--${rarity.key}">${rarity.label.toUpperCase()} · ${SHOP_ITEM_KIND[currentShopTab].toUpperCase()}</span>
            <span class="px shop-preview__name">${item.name}</span>
            <p class="shop-preview__desc">${item.desc}</p>
        </div>`;

    actions.innerHTML = '';
    if (!shopOwns(currentShopTab, item) && playerProgression.coins >= item.price) {
        const rest = document.createElement('div');
        rest.className = 'shop-preview__rest';
        rest.innerHTML = `<span>Te quedarán</span><span>${playerProgression.coins - item.price} monedas</span>`;
        actions.appendChild(rest);
    }
    const btn = shopActionButton(currentShopTab, item, 'shop-preview__btn');
    if (!shopOwns(currentShopTab, item)) btn.innerHTML = `${SHOP_COIN_IMG}COMPRAR · ${item.price}`;
    actions.appendChild(btn);
}

/**
 * Compra un objeto de la tienda
 */
function buyShopItem(categoryKey, itemId) {
    const items = SHOP_CATALOG[categoryKey];
    const item = items.find(i => i.id === itemId);

    if (!item) return;

    if (purchaseItem(categoryKey, item.id, item.price)) {
        soundEffects.shopBuy();

        selectCosmetic(categoryKey, item.id);

        populateShopTab(currentShopTab);
        updateCoinDisplay();

        if (isAllItemsPurchased()) {
            unlockAchievement('fashionista');
        }
    } else {
        const coinDisplay = document.getElementById('shop-coin-display');
        if (coinDisplay) {
            coinDisplay.style.color = 'red';
            coinDisplay.classList.add('coin-error');
            setTimeout(() => {
                coinDisplay.style.color = '';
                coinDisplay.classList.remove('coin-error');
            }, 500);
        }
    }
}

/**
 * Equipa un objeto
 */
function equipShopItem(categoryKey, itemId) {
    if (!SHOP_CATALOG[categoryKey]) return;

    selectCosmetic(categoryKey, itemId);
    populateShopTab(currentShopTab);
}
