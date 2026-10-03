// ==========================================
// shop.js
// Tienda de Cosméticos y Generación de UI
// ==========================================

import { SHOP_CATALOG, SHOP_CATEGORIES } from './data/shop.js';
import { unlockAchievement } from './systems/achievements.js';
import { soundEffects } from './systems/audio.js';
import {
    hasItem,
    playerProgression,
    purchaseItem,
    saveProgression,
    selectCosmetic
} from './systems/progression.js';

let currentShopTab = 'trails';

/**
 * Muestra la pantalla de la tienda
 */
export function showShopScreen() {
    populateShopTab(currentShopTab);
}

/**
 * Cambia la pestaña de la tienda
 */
export function switchShopTab(categoryKey) {
    currentShopTab = categoryKey;
    
    // Actualizar botones UI
    const tabButtons = document.querySelectorAll('.shop-tab-btn');
    tabButtons.forEach(btn => {
        if (btn.dataset.category === categoryKey) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    populateShopTab(currentShopTab);
}

/**
 * Muestra los artículos de una categoría específica
 */
function populateShopTab(categoryKey) {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    const items = SHOP_CATALOG[categoryKey];
    
    const categoryInfo = SHOP_CATEGORIES.find(c => c.key === categoryKey);
    if (!categoryInfo) return;
    const cosmKey = categoryInfo.cosmKey;

    let equippedId = '';
    switch (cosmKey) {
        case 'trail':  equippedId = playerProgression.selectedTrail; break;
        case 'bg':     equippedId = playerProgression.selectedBg; break;
        case 'paddle': equippedId = playerProgression.selectedPaddle; break;
        case 'goalFx': equippedId = playerProgression.selectedGoalFx; break;
    }

    items.forEach(item => {
        const isOwned = hasItem(item.id) || item.price === 0;
        const isEquipped = isOwned && equippedId === item.id;
        
        if (item.price === 0 && !hasItem(item.id)) {
            playerProgression.purchasedItems.push(item.id);
            saveProgression();
        }

        const card = document.createElement('div');
        card.className = 'shop-card';
        if (isEquipped) card.classList.add('shop-card--equipped');
        else if (isOwned) card.classList.add('shop-card--owned');

        const previewDiv = document.createElement('div');
        previewDiv.className = 'shop-card__preview relative flex justify-center items-center overflow-hidden';
        
        let prefix = '';
        if (categoryKey === 'trails') prefix = 'trail_';
        else if (categoryKey === 'backgrounds') prefix = 'bg_';
        else if (categoryKey === 'paddles') prefix = 'paddle_';
        else if (categoryKey === 'goalEffects') prefix = 'goal_';
        
        const imgName = prefix + item.id + '.png';
        const imgSrc = 'assets/shop/' + imgName;
        
        // Cargar imagen de icono o mostrar el emoji si falla
        previewDiv.innerHTML = `
            <img src="${imgSrc}" class="w-full h-full object-contain z-10" alt="${item.name}">
            <span class="hidden absolute inset-0 flex items-center justify-center text-3xl z-0">${item.preview}</span>
        `;
        const img = previewDiv.querySelector('img');
        img.addEventListener('error', () => {
            img.style.display = 'none';
            /** @type {HTMLElement} */ (img.nextElementSibling).style.display = 'block';
        });

        const nameDiv = document.createElement('div');
        nameDiv.className = 'shop-card__name';
        nameDiv.textContent = item.name;

        const descDiv = document.createElement('div');
        descDiv.className = 'shop-card__desc';
        descDiv.textContent = item.desc;

        const btn = document.createElement('button');
        btn.className = 'shop-card__btn';
        
        if (isEquipped) {
            btn.classList.add('shop-card__btn--equipped');
            btn.textContent = 'EQUIPADO';
            btn.disabled = true;
        } else if (isOwned) {
            btn.classList.add('shop-card__btn--use');
            btn.textContent = 'USAR';
            btn.addEventListener('click', () => equipShopItem(categoryKey, item.id));
        } else {
            btn.classList.add('shop-card__btn--buy');
            btn.innerHTML = `<img src="assets/chemi_coin.png" class="w-3 h-3 inline object-contain mr-1" style="vertical-align: text-top;"> ${item.price}`;
            btn.addEventListener('click', () => buyShopItem(categoryKey, item.id));
        }

        card.appendChild(previewDiv);
        card.appendChild(nameDiv);
        card.appendChild(descDiv);
        card.appendChild(btn);
        
        grid.appendChild(card);
    });
}

/**
 * Compra un objeto de la tienda
 */
function buyShopItem(categoryKey, itemId) {
    const items = SHOP_CATALOG[categoryKey];
    const item = items.find(i => i.id === itemId);
    
    if (!item) return;

    if (purchaseItem(item.id, item.price)) {
        soundEffects.shopBuy();
        
        const categoryInfo = SHOP_CATEGORIES.find(c => c.key === categoryKey);
        selectCosmetic(categoryInfo.cosmKey, item.id);
        
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
    const categoryInfo = SHOP_CATEGORIES.find(c => c.key === categoryKey);
    if (!categoryInfo) return;
    
    selectCosmetic(categoryInfo.cosmKey, itemId);
    populateShopTab(currentShopTab);
}

/**
 * Actualiza la UI de monedas en todas partes
 */
export function updateCoinDisplay() {
    const displays = ['shop-coin-display', 'menu-coins'];
    displays.forEach(id => {
        const display = document.getElementById(id);
        if (display) {
            const size = id === 'shop-coin-display' ? 'w-6 h-6' : 'w-4 h-4';
            display.innerHTML = `<img src="assets/chemi_coin.png" class="${size} inline object-contain mr-1" style="vertical-align: text-top;"> ${playerProgression.chemiCoins}`;
        }
    });
}

/**
 * Obtiene el número total de artículos en la tienda
 */
function getTotalShopItems() {
    let count = 0;
    for (const key in SHOP_CATALOG) {
        SHOP_CATALOG[key].forEach(item => {
            if (item.price > 0) count++;
        });
    }
    return count;
}

/**
 * Obtiene el número de artículos comprados
 */
function getTotalPurchasedItems() {
    let count = 0;
    playerProgression.purchasedItems.forEach(id => {
        for (const key in SHOP_CATALOG) {
            const item = SHOP_CATALOG[key].find(i => i.id === id);
            if (item && item.price > 0) {
                count++;
                break;
            }
        }
    });
    return count;
}

/**
 * Determina si todos los objetos han sido comprados
 */
function isAllItemsPurchased() {
    const total = getTotalShopItems();
    const purchased = getTotalPurchasedItems();
    return total > 0 && purchased >= total;
}
