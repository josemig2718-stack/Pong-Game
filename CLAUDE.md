# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Browser Pong "Edición Arcade" — a 100% static frontend app. Vanilla JS, HTML5 Canvas, TailwindCSS via CDN. **No build step, no npm, no bundler, no tests, no linter.**

Code, comments, UI strings, and commit history are in **Spanish**. Keep new code and UI text in Spanish to match.

## Running

Open `index.html` directly in a browser, or serve the folder statically (`python -m http.server 8000`). A local server is preferable because the MP3s and localStorage behave more predictably over `http://` than `file://`.

Deployed as a GitHub Pages static site — the repo root is the web root.

### Cache-busting is manual

`index.html` loads each script/stylesheet with a query version:

```html
<link rel="stylesheet" href="css/style.css?v=11">
<script src="js/config.js?v=13"></script>
```

**After editing JS or CSS, bump the `?v=` number** on the affected tags (in practice all the JS tags share one number). Users otherwise get stale cached files on GitHub Pages.

## Architecture

### Global namespace, ordered script loading

There are no modules, no `import`/`export`, no IIFE wrappers. Every file declares top-level `const`/`let`/`function` that land on the global scope, and files depend on each other purely through **load order in `index.html` (lines 474–487)**:

```
config → theme → audio → stats → achievements → input →
progression → shop → vfx → powerups → campaign → game → touch → ui
```

Consequences to respect when editing:

- A new top-level `const`/`let`/`function` name collides globally. Grep before naming.
- `config.js` must stay dependency-free — it is loaded first and creates the session-wide `settings` object.
- Cross-file calls into *later*-loaded files are guarded with `typeof fn === 'function'` (e.g. `game.js` calling `statsOnGameStart`, `initPowerups`, `awardGameRewards`). Follow that pattern rather than assuming a symbol exists.
- `ui.js` is last and owns `DOMContentLoaded`: it builds theme swatches, applies the theme, syncs the settings UI, and calls `showScreen('main-menu')`.

### Screens are divs, wired by inline `onclick`

Every menu is a `<div class="screen">` in `index.html`; `showScreen(id)` (`js/ui.js:9`) removes `.active-screen` from all of them and adds it to one. Navigation and most actions are **inline `onclick` attributes in the HTML** (~43 of them) calling global functions — there is no event-delegation layer. Adding a menu action means adding a global function and referencing it from the markup.

`showScreen` also side-effects: entering `main-menu` hides `#game-container` and starts menu music; `shop-menu` calls `showShopScreen()`; `campaign-menu` calls `renderCampaignMap()`.

Gameplay is not a screen — `startGame(mode)` clears all `.active-screen` and unhides `#game-container`. Pause/game-over overlays are screens layered on top at higher `z-`.

### Game loop (`js/game.js`, ~1100 lines — the core)

`gameLoop(timestamp)` → `update(dt)` → `render()` via `requestAnimationFrame`. `dt` is normalized to 60 FPS units (`elapsedMs / (1000/60)`, clamped to ≤3), so all speed constants are "pixels per frame at 60 FPS" and every movement must be multiplied by `dt`.

- Fixed logical resolution `GAME_WIDTH × GAME_HEIGHT` = 800×600. `canvas.width/height` are always the logical size; `resizeCanvas()` only sets CSS `width/height` to scale it, preserving 4:3 by measuring visible siblings of `#canvas-wrapper`. Touch input converts client coords back into logical coords (`js/touch.js`).
- `balls` is an array (multi-ball power-up spawns up to 3); `ball` is a legacy alias for `balls[0]` refreshed in `resetBall`/`startGame`.
- Slow-motion is a `dt` multiplier composed from `getSlowmoMultiplier()` (power-up) and `getGoalSlowmo()` (goal VFX).
- `update()` returns early while `isDialogueActive` (campaign dialogue) — that is the campaign's "pause".

### Game modes

`gameMode` is a string set by `startGame(mode)`: `'cpu'` | `'local'` | `'hachepe'` | `'campaign'`.

Mode drives branching throughout `update()`, `checkWin()`, `resetBall()`, audio, and rewards:

- `cpu` — AI paddle speed/error margin from `settings.difficulty` (1/2/3).
- `local` — both paddles human; **awards XP but no Chemi Coins** (anti-farming, `awardGameRewards` in `js/progression.js:255`).
- `hachepe` — boss mode: max ball speed, near-perfect AI, exclusive music, target score hardcoded to 10 (all other modes use `settings.winningScore`).
- `campaign` — see below.

### Campaign (`js/campaign.js`)

`HACHEPES_LORE` holds 6 bosses (levels 1–5 plus a secret level 6, "El Creador"). Flow: `renderCampaignMap()` (only draws nodes 1–5) → `prepareCampaignMatch(level)` fills the VS screen and after 3.5s calls `startCampaignGame()` → `startGame('campaign')` + queued typewriter dialogue → on win `handleCampaignVictory()` bumps `playerProgression.campaignProgress`.

Per-boss mechanics live as `currentCampaignLevel === N` branches inside `game.js` (`update`, `resetBall`, `startGame`), not in `campaign.js`: L2 Dani's periodic shield, L3 twin paddle `p2_twin`, L4 Fano's ball invisibility/illusions, L5 Yisus' telekinesis, L6 the Creator (rotated arena — P1's paddle becomes horizontal and moves on X, plus `creatorHealth`).

Note `index.html` still has a `TEST CREADOR (DEBUG)` button in the mode-select menu calling `prepareCampaignMatch(6)` directly.

### Persistence — three independent localStorage keys

| Key | Owner | Holds |
|---|---|---|
| `pongGame.settings.v1` | `js/config.js` | theme, difficulty, volumes, winning score, ball speed, CRT/shake/mouse/powerups toggles, key bindings |
| `pongGame.stats.v1` | `js/stats.js` | games/wins/streaks/records **and the unlocked-achievements map** |
| `pongGame.progression.v1` | `js/progression.js` | XP, level, Chemi Coins, `purchasedItems`, selected cosmetics, `campaignProgress`, `campaignIntroSeen` |

All three load with `{ ...DEFAULTS, ...saved }` spread so adding a new field doesn't break existing saves — **preserve that pattern** when adding fields, and bump the `.v1` suffix only for a genuinely incompatible change. Achievements live under stats, not progression (`resetStats()` deliberately keeps them).

### Cosmetics: shop → progression → vfx

`SHOP_CATALOG` (`js/shop.js`) defines items in 4 categories keyed `trails`/`backgrounds`/`paddles`/`goalEffects`; `SHOP_CATEGORIES` maps those to the progression field names `trail`/`bg`/`paddle`/`goalFx`. Buying calls `purchaseItem`, equipping calls `selectCosmetic`, which writes `playerProgression.selected*`.

`js/vfx.js` render functions (`renderBallTrail`, `renderPaddleVFX`, `triggerGoalVFX`) read `playerProgression.selected*` **directly each frame** and dispatch through the `TRAIL_RENDERERS` / `PADDLE_RENDERERS` / `GOAL_FX` lookup tables. Adding a cosmetic = add a renderer to the right table + a catalog entry with a matching `id` + a preview PNG in `assets/shop/`. (The `currentTrailId` / `setActiveTrail`-style module vars in `vfx.js` are vestigial for everything except backgrounds, where `currentBgId` gates the stateful `init/update/render` background renderers.)

### Other subsystems

- `js/input.js` — `keysDown` Set (anti-ghosting for 2-player), remappable bindings resolved via `isActionPressed(action)` against `settings.bindings`.
- `js/touch.js` — split-screen touch: left half drives `p1.touchY`, right half `p2.touchY`; when `touchY` is non-null it overrides keyboard for that paddle.
- `js/audio.js` — SFX synthesized with Web Audio API (`playTone` / `soundEffects`), music via three `<audio>` elements; browsers require `onFirstInteraction` before audio starts.
- `js/powerups.js` — one `activePowerup` on field, one `activeEffect` at a time; `revertPowerup()` restores `originalValues`. Because effects mutate `p1`/`p2` dimensions, `startGame`/`quitGame`/`checkWin` all defensively restore `paddleWidth`/`paddleHeight`.
- `js/achievements.js` — `ACHIEVEMENTS` array; `unlockAchievement(id)` is idempotent and queues toasts.

## Repo notes

- `.backup-mobile-20260825-221758/` is a **committed** snapshot of an older `index.html`/`style.css`/`game.js`. It is dead code — don't edit it, and don't let searches there mislead you.
- `css/style.css` is one large file split by banner comments (`/* ====== */`); Tailwind utility classes carry most of the layout, `style.css` carries the retro/CRT identity and CSS custom properties (`--primary`, `--primary-rgb`) that `js/theme.js` rewrites per theme. Canvas drawing reads the same theme color via `currentThemeHex()`.
