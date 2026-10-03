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

There are no modules, no `import`/`export`, no IIFE wrappers. Every file declares top-level `const`/`let`/`function` that land on the global scope, and files depend on each other purely through **load order of the `<script>` tags at the end of `index.html`**:

```
config → state → theme → audio → stats → achievements → input → progression →
shop → vfx → powerups → campaign → bosses → game → touch → ui → actions → main
```

Consequences to respect when editing:

- A new top-level `const`/`let`/`function` name collides globally. Grep before naming.
- `config.js` must stay dependency-free — it is loaded first and creates the session-wide `settings` object.
- Top-level code may only use symbols from files loaded *before* it. Function bodies can call anything, since they run after every script has loaded — no `typeof` guards are needed.
- Mutable match state shared across files lives in the `state` object (`js/state.js`): `state.mode`, `isPlaying`, `isPaused`, `p1Score`, `p2Score`, `serveCountdownMs`, `balls`, `particles`, shake and `frameCount`. Write `state.isPlaying = false`, never a new top-level `let` that another file reassigns. The paddles `p1`, `p2` and `p2Twin` are stable objects declared next to it.
- No file registers listeners or touches the DOM while loading. Each exposes an `init*()` (`initAudio`, `initInput`, `initCanvas`, `initCarouselControls`, `initTouchControls`, `initActions`, `initUI`) and `js/main.js`, loaded last, calls them in that order. Keep the order: listeners sharing a target and event type (e.g. `keydown` on `window`) run in registration order. `initUI()` builds theme swatches, applies the theme, syncs the settings UI, and calls `showScreen('main-menu')`.

### Screens are divs, wired by `data-action`

Every menu is a `<div class="screen">` in `index.html`; `showScreen(id)` (`js/ui.js`) removes `.active-screen` from all of them and adds it to one. The markup has **no inline handlers**: controls declare `data-action="fn"` (click), `data-input="fn"` or `data-change="fn"`, plus `data-arg` when the call takes an argument. `js/actions.js` holds one registry per event type and three delegated listeners on `document`. Adding a menu action means adding an entry to the registry — named after the function it calls — and converting its argument there (dataset values are always strings: `carouselMove("-1")` would concatenate). Never add `data-category` to the shop tabs: `switchShopTab` reads it and adding it would silently fix a preserved bug.

`showScreen` also side-effects: entering `main-menu` hides `#game-container` and starts menu music; `shop-menu` calls `showShopScreen()`; `campaign-menu` calls `renderCampaignMap()`.

Gameplay is not a screen — `startGame(mode)` clears all `.active-screen` and unhides `#game-container`. Pause/game-over overlays are screens layered on top at higher `z-`.

### Game loop (`js/game.js`, ~1100 lines — the core)

`gameLoop(timestamp)` → `update(dt)` → `render()` via `requestAnimationFrame`. `dt` is normalized to 60 FPS units (`elapsedMs / (1000/60)`, clamped to ≤3), so all speed constants are "pixels per frame at 60 FPS" and every movement must be multiplied by `dt`.

- Fixed logical resolution `GAME_WIDTH × GAME_HEIGHT` = 800×600. `canvas.width/height` are always the logical size; `resizeCanvas()` only sets CSS `width/height` to scale it, preserving 4:3 by measuring visible siblings of `#canvas-wrapper`. Touch input converts client coords back into logical coords (`js/touch.js`).
- `state.balls` is an array (multi-ball power-up spawns up to 3). `resetBall()` replaces the whole array, even mid-`update()`, so never keep a reference to it across calls — always read `state.balls`.
- Slow-motion is a `dt` multiplier composed from `getSlowmoMultiplier()` (power-up) and `getGoalSlowmo()` (goal VFX).
- `update()` returns early while `isDialogueActive` (campaign dialogue) — that is the campaign's "pause".

### Game modes

`state.mode` is a string set by `startGame(mode)`: `'cpu'` | `'local'` | `'hachepe'` | `'campaign'`.

Mode drives branching throughout `update()`, `checkWin()`, `resetBall()`, audio, and rewards:

- `cpu` — AI paddle speed/error margin from `settings.difficulty` (1/2/3).
- `local` — both paddles human; **awards XP but no Chemi Coins** (anti-farming, `awardGameRewards` in `js/progression.js`).
- `hachepe` — standalone boss mode: max ball speed, near-perfect AI, exclusive music, target score hardcoded to 10. Deliberately kept separate from the campaign.
- `campaign` — see below.

### Campaign: `campaign.js` narrates, `bosses.js` fights

The split matters. **`js/campaign.js`** owns story only: `HACHEPES_LORE` (6 bosses), the node map, the dialogue system, and the finale sequences. **`js/bosses.js`** owns every fight mechanic.

`js/bosses.js` is a dispatch table in the same shape `vfx.js` uses for `BG_RENDERERS`/`GOAL_FX`:

```js
BOSS_MECHANICS[level] = { config, init, update, render, renderOverlay, collide, onGoal }
```

`game.js` never names a boss. It calls `bossInit/bossUpdate/bossRender/bossRenderOverlay/bossCollide/bossOnGoal` and reads behaviour from `bossConfig()`: `targetScore` (5→7, rising per boss), `aiSpeed`, `aiError`, `aiBias`, `paddleAxis`, `useHealth`, `hitDamage`. **Add a boss by adding a table entry, never by adding a `currentCampaignLevel === N` branch to `game.js`.**

Two non-obvious rules learned from bugs, both worth preserving:

- **`aiBias` is what makes a boss beatable.** `aiError` is a dead zone, and any dead zone smaller than the paddle's half-height (50px) never produces a miss — with it alone the CPU is literally unbeatable and rallies never end. `aiBias` offsets the boss's *aim*, refreshed on every hit.
- **Obstacles belong on the boss's half, and must add spin.** A block on the player's half traps the ball in a paddle↔block loop; a block on the vertical centre intercepts every flat return. Chemi's rubble sits at x ≥ 0.60 clear of the centre lane, and its bounce perturbs `dy`, which is what stops rallies repeating forever.

Story flow: `renderCampaignMap()` builds the boss-select **carousel** (cards 1–5; the corrupted Creator card appears only once `campaignProgress` reaches 6) → `prepareCampaignMatch(level, opts)` → VS screen → `startCampaignGame()` → `startGame('campaign')` + `queueDialogue()`. Beaten bosses are replayable and pay a reduced reward (`CAMPAIGN_REPLAY_FACTOR`).

The carousel positions cards purely with `transform` from `updateCarousel()`; only the two neighbours either side are rendered. It is driven by arrows, keyboard, dots and swipe — keep all four working when touching it.

**"Next boss" must come from `getNextCampaignBoss()`**, which counts from `currentCampaignLevel`, not from `campaignProgress`. Using progress sent players straight to the Creator the moment they replayed an early boss.

**The twist is load-bearing — don't leak it.** Beating Yisus (level 5) routes through `runFinaleSequence()` instead of the game-over screen: fake victory → warped music → blackout → the Creator's reveal → VS. Beating the Creator runs `runTrueEndingSequence()`. `checkWin()` recognises these via its `narrativeEnding` flag and suppresses the normal end screen. Nothing about the Creator should be visible in menus, the achievements grid, or the node map before the story reveals it.

The Creator's identity on screen is a **canvas-drawn eye** whose pupil tracks the ball (`CREATOR_TONES` shifts it green → amber → bloodshot per phase); the health bar reads as its lower lid. Its three phases stack armored band segments (`segmentIsArmored`, dispatched through `bossSegmentArmored`), a telegraphed ball warp, and an eye beam that freezes rather than kills. Every one of them is announced before it lands; that is the rule that keeps the fight hard instead of unfair.

The Creator is the only boss with `useHealth: true`: it is won by emptying `bossHealth()`, and `state.p2Score` counts the player's *misses*, not the rival's points. Keep those two meanings apart — conflating them is exactly what made the final fight winnable in one hit.

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
- `js/achievements.js` — `ACHIEVEMENTS` array; `unlockAchievement(id)` is idempotent and queues toasts. Entries with `secret: true` render as `????` until unlocked and are excluded from the counter by `getVisibleAchievementsTotal()`, so the total itself doesn't reveal that a hidden one exists. `unlockAchievement` silently does nothing visible for an id absent from the catalogue — check the id exists when wiring a new unlock.

## Repo notes

- `.backup-mobile-20260825-221758/` is a **committed** snapshot of an older `index.html`/`style.css`/`game.js`. It is dead code — don't edit it, and don't let searches there mislead you.
- `css/style.css` is one large file split by banner comments (`/* ====== */`); Tailwind utility classes carry most of the layout, `style.css` carries the retro/CRT identity and CSS custom properties (`--primary`, `--primary-rgb`) that `js/theme.js` rewrites per theme. Canvas drawing reads the same theme color via `currentThemeHex()`.
- Any keyframe animating `transform` on a centred element must re-apply its `translateX(-50%)`, or the element jumps out of the viewport. That is why `#dialogue-box` has its own `dialogue-shake` instead of reusing the generic `shake-error`.
- The mouse writes into the same `p1.touchY`/`p1.touchX` channel as touch, and must pick the axis from `bossIsRotatedArena()` — otherwise the mouse does nothing in the Creator fight. It reuses `touchToCanvasX/Y` from `js/touch.js`.
- `startGame()` restores paddle `width`, `height` **and** `x`. The Creator's rotated arena reshapes `p1` into a horizontal paddle, and restoring only `height` leaves a square block mid-field in the next match.
- `.mcp.json` configures the Playwright MCP server used to drive the game in a real browser (`--browser msedge`, since Chrome isn't installed on this machine). It wraps `npx` in `cmd /c` because npx is a `.cmd` on Windows and fails when spawned without a shell — change that to plain `npx` if the repo is ever opened on Linux or macOS.
- Playwright's output (`.playwright-mcp/`) and stray root-level `*.png` screenshots are gitignored. Keep test captures out of the repo.

## Verifying changes

There are no tests, so verification means driving the real game. Serve it (`python -m http.server 8000`) and use Playwright MCP; the game's globals are all reachable from `browser_evaluate`, which makes it practical to script a whole match:

```js
currentCampaignLevel = 4; startGame('campaign'); stopDialogue();
for (let i = 0; i < 3000; i++) { state.serveCountdownMs = 0; update(1); }
```

Two habits worth keeping, because both caught real bugs that reading the code did not:

- **Simulate several player skill levels**, not one. Drive `p1` toward the ball with a lerp factor (1.0 = perfect, ~0.3 = human, ~0.1 = weak) and assert the match actually *ends*. A perfect bot rallying forever against a perfect CPU is how the unbeatable-boss and stuck-ball bugs stayed hidden.
- **Look at the screenshots.** The giant square paddle, the dialogue box sliding off screen and the armor stripes bleeding over the eye were all invisible in the numbers.
