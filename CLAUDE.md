# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Browser Pong "Edición Arcade" — a 100% static frontend app. Vanilla JS (classic scripts sharing the global scope), HTML5 Canvas, TailwindCSS via CDN. **No build step, no npm, no bundler, no linter.** Regression tests are a web page in `tests/`; editor type checking is `jsconfig.json` + JSDoc.

**Hard requirement: the game must work by opening `index.html` directly (`file://`) as well as on GitHub Pages.** That is why the code uses classic `<script>` tags and not ES modules (browsers refuse modules from `file://`). Don't introduce `import`/`export`, `type="module"`, `fetch()` of local files or anything else that needs a server.

Code, comments, UI strings and commit history are in **Spanish**. Keep new code and UI text in Spanish to match.

## Running

Open `index.html` in a browser — that's all the game needs. For development and tests, serve the folder with `python tests/serve.py` (port 8000): it sends `Cache-Control: no-store` (otherwise the browser heuristically caches stale JS and tests end up measuring old code) and exposes the list of `js/` files that the test page checks against `index.html`.

Deployed as a GitHub Pages static site — the repo root is the web root.

### Cache-busting is manual: one version N

`index.html` loads every file of `js/` with its own `<script src="js/…?v=N">` and the stylesheet as `css/style.css?v=N`, all with the same N. **After editing any JS or CSS, bump N everywhere**, or GitHub Pages (which caches ~10 min) serves stale files. **Adding, moving or deleting a file of `js/` means updating the script list.** The `scripts-del-juego` check in `tests/` fails if a file is missing or extra, versions differ, a tag is a module, or `main.js` isn't last.

## Architecture

### Layers

```
js/main.js      entry point: calls every init*() in order
js/core/        base layer — constants, storage, settings, state
js/data/        static catalogues — themes, lore, achievements, shop, levels, power-ups
js/systems/     audio, theme, input (keyboard), pointer (mouse + touch), stats, achievements, progression
js/game/        canvas, draw, effects, balls, ai, physics, match, loop, render, powerups
js/vfx/         shop cosmetics — trails, backgrounds, paddles, goal-fx (+ index.js facade)
js/bosses/      index.js (table + dispatchers), shared.js, one file per boss
js/campaign/    progress (boss in play, VS, advance), menu (carousel + intro), dialogue, finale
js/ui/          screens, actions (data-action registry), settings-panel, stats-panel, shop-ui, progress-display
```

All files are classic scripts: their top-level `const`/`let`/`function` share one global scope, so **every top-level name must be unique across the project and must not collide with a `window` property** (grep before naming). Each file starts with `'use strict'`. Files call each other freely inside function bodies (those run after every script has loaded), but **top-level code may only use what `index.html` loaded before it**. The script list follows the layer order above; within it, the only cross-file top-level dependencies are:
- `core/state` uses `core/constants`; `core/settings` uses `core/storage`; `systems/audio` reads `settings` when it loads;
- `bosses/creator` uses `CREATOR_BAND_H` from `bosses/shared`, and `bosses/index` builds `BOSS_MECHANICS` from the six boss files — so `shared` → bosses → `index`.

Breaking the order throws a `ReferenceError` at load and every test fails.

### Shared state

- Mutable match state read by several files lives in the `state` object (`js/core/state.js`, typed `GameState`): `mode`, `isPlaying`, `isPaused`, `p1Score`, `p2Score`, `frameCount`, `serveCountdownMs`, shake, `balls`, `particles`. **Anything another file must write goes in `state`** (e.g. the campaign sets `state.isPlaying = false`). The paddles `p1`, `p2` and `p2Twin` are stable objects declared next to it.
- Other top-level `let`s (`currentCampaignLevel`, `isDialogueActive`, `activePowerup`, `bossState`…) are reassigned only by the file that declares them; other files only read them. Keep it that way, or add a setter.
- `state.balls` is replaced wholesale by `resetBall()`, even mid-`update()`: **never keep a reference to the array across calls**; read `state.balls`.
- `tests/adapters/globals.js` reads some internals by name (`bossState`, `carouselIndex`, `goalSlowmoTimer`, …). Renaming one means updating the adapter.

### Boot and events

- No file registers listeners or touches the DOM while loading (reading `localStorage`, creating the three `Audio` objects and looking up the canvas are the only load-time work). `js/main.js` calls `initAudio`, `initInput`, `initCanvas`, `initPointer`, `initCarouselControls`, `initActions`, `initUI` in that order. **Keep `initAudio` before `initInput`**: both listen to `keydown` on `window`, and same-target listeners run in registration order.
- The markup has **no inline handlers**. Controls declare `data-action="fn"` (click), `data-input="fn"` or `data-change="fn"`, plus `data-arg` when the call takes an argument. `js/ui/actions.js` has one registry per event type, named after the functions they call, and three delegated listeners on `document`. Adding a control = adding a registry entry that **converts its argument** (dataset values are strings: `carouselMove("-1")` would concatenate). Unknown actions throw.
- Every menu is a `<section class="screen">`; `showScreen(id)` (`js/ui/screens.js`) shows one. Entering `main-menu` hides `#game-container` and starts menu music; `shop-menu` and `campaign-menu` re-render. Gameplay is not a screen — `startGame(mode)` hides all and shows `#game-container`; pause and game-over are screens layered on top.

### Game loop (`js/game/`)

`loop.js` runs `update(dt)` (`physics.js`) then `render()` (`render.js`) per `requestAnimationFrame`. `dt` is normalized to 60 FPS units (`elapsedMs / MS_PER_FRAME`, clamped to ≤3), so speeds are "pixels per frame at 60 FPS" and every movement is multiplied by `dt`; `dt * MS_PER_FRAME` converts to milliseconds.

`update()` is a fixed sequence of named steps: dialogue pause → slow-motion → boss update → player 1 → player 2 or CPU (`ai.js`) → clamp → serve countdown → balls (walls, boss obstacles, paddles, goals) → power-ups → VFX → particles → shake. **The order is behaviour**: physics and several renderers share `Math.random`, so reordering changes every later random number. Two early exits are explicit return values: during the serve countdown only the VFX advance; and a match-ending goal with several balls stops the frame, while with one ball the rest of the frame still runs (`onBallOut` in `physics.js` documents the asymmetry).

- Fixed logical resolution `GAME_WIDTH × GAME_HEIGHT` = 800×600. `canvas.width/height` are always the logical size; `resizeCanvas()` only sets CSS size, preserving 4:3 by measuring the visible siblings of `#canvas-wrapper`.
- Slow-motion is a `dt` multiplier: the min of `getSlowmoMultiplier()` (power-up) and `getGoalSlowmo()` (goal VFX).
- `update()` returns at once while `isDialogueActive` — that is the campaign's "pause".
- `checkWin()` (`match.js`) is explicit orchestration, not events: sound → dialogue → campaign victory → stats → achievement → rewards → displays → paddle restore → music → narrative sequence. That order is behaviour too.

### Game modes

`state.mode` (`GameMode`) is set by `startGame(mode)`: `'cpu'` | `'local'` | `'hachepe'` | `'campaign'`.

- `cpu` — AI paddle speed/dead zone from `settings.difficulty` (1/2/3).
- `local` — both paddles human; **awards XP but no Chemi Coins** (anti-farming, `awardGameRewards` in `systems/progression.js`).
- `hachepe` — standalone boss mode: fast near-perfect AI, exclusive music, target score 10. Deliberately separate from the campaign.
- `campaign` — see below.

### Campaign: `campaign/` narrates, `bosses/` fights

`data/lore.js` holds the six Hachepes' story and dialogues; `campaign/` the flow; `bosses/` every fight mechanic. Each boss file declares a `BossMechanics` object (`{ config, init, update, render, renderOverlay, collide, onGoal, hidesBall, freezesPlayer, invertsControls, segmentIsArmored }`, all optional but `config`). `game/` never names a boss: it calls the dispatchers in `bosses/index.js` and reads `bossConfig()` (`targetScore`, `aiSpeed`, `aiError`, `aiBias`, `paddleAxis`, `useHealth`, `hitDamage`). **Add a boss by adding a file and a table entry, never a `currentCampaignLevel === N` branch in `game/`.**

Two non-obvious rules learned from bugs:

- **`aiBias` is what makes a boss beatable.** `aiError` is a dead zone, and any dead zone smaller than the paddle's half-height (50px) never produces a miss. `aiBias` offsets the boss's *aim*, refreshed on every hit.
- **Obstacles belong on the boss's half, and must add spin.** A block on the player's half traps the ball in a paddle↔block loop; a block on the vertical centre intercepts every flat return. Chemi's rubble sits at x ≥ 0.60 and its bounce perturbs `dy`.

Flow: `renderCampaignMap()` builds the boss **carousel** (cards 1–5; the corrupted Creator card appears only once `campaignProgress` reaches 6) → `prepareCampaignMatch(level, opts)` → VS screen → `startCampaignGame()` → `startGame('campaign')` + `queueDialogue()`. Beaten bosses are replayable at a reduced reward (`CAMPAIGN_REPLAY_FACTOR`). The carousel positions cards purely with `transform` and renders two neighbours per side; it is driven by arrows, keyboard, dots and swipe — keep all four working.

**"Next boss" must come from `getNextCampaignBoss()`**, which counts from `currentCampaignLevel`, not from `campaignProgress`. Using progress sent players straight to the Creator after replaying an early boss.

**The twist is load-bearing — don't leak it.** Beating Yisus (`CAMPAIGN_LAST_BOSS`) routes through `runFinaleSequence()` instead of the game-over screen: fake victory → warped music → CRT blackout → the Creator's reveal → VS. Beating the Creator runs `runTrueEndingSequence()`. `checkWin()` recognises both via `narrativeEnding`. Nothing about the Creator may be visible in menus, the achievements grid or the carousel before the story reveals it.

The Creator's on-screen identity is a **canvas-drawn eye** whose pupil tracks the ball (`CREATOR_TONES`: green → amber → bloodshot per phase); its health bar reads as the lower lid. Its three phases stack armored band segments (`segmentIsArmored` via `bossSegmentArmored`), a telegraphed ball warp and an eye beam that freezes rather than kills. Every attack is announced before it lands — that is what keeps the fight hard instead of unfair. It is the only boss with `useHealth: true`: won by emptying `bossHealth()`, while `state.p2Score` counts the player's *misses*. Keep those meanings apart.

The typewriter interval is shared by dialogues, the intro and the finale reveal; `campaign/dialogue.js` owns it (`startTypewriter` / `clearTypewriter`).

### Persistence — three independent localStorage keys

| Key | Owner | Holds |
|---|---|---|
| `pongGame.settings.v1` | `js/core/settings.js` | theme, difficulty, volumes, winning score, ball speed, CRT/shake/mouse/powerups toggles, key bindings |
| `pongGame.stats.v1` | `js/systems/stats.js` | games/wins/streaks/records **and the unlocked-achievements map** |
| `pongGame.progression.v1` | `js/systems/progression.js` | XP, level, Chemi Coins, `purchasedItems`, selected cosmetics, `campaignProgress`, `campaignIntroSeen` |

`core/storage.js` only wraps get/parse/set in try/catch. **Each key keeps its own merge rules** (`{ ...DEFAULTS, ...saved }` plus key-specific handling, including preserved bugs); don't generalise them. Preserve the spread pattern when adding fields, and bump `.v1` only for a genuinely incompatible change. Achievements live under stats (`resetStats()` keeps them).

### Cosmetics: shop → progression → vfx

`SHOP_CATALOG` (`data/shop.js`) has 4 categories `trails`/`backgrounds`/`paddles`/`goalEffects`; `SHOP_CATEGORIES` maps them to `trail`/`bg`/`paddle`/`goalFx`. Buying calls `purchaseItem`, equipping `selectCosmetic`, which writes `playerProgression.selected*`. The `vfx/` renderers read `playerProgression.selected*` **every frame** through their id → renderer tables. Adding a cosmetic = a renderer in the right `vfx/` table + a catalogue entry with the same `id` + a preview PNG in `assets/shop/`. Backgrounds are the only stateful ones (`init/update/render`); `setActiveBg()` calls `init()`, which consumes `Math.random`.

### Other subsystems

- `systems/input.js` — `keysDown` Set (anti-ghosting for 2 players); remappable bindings via `isActionPressed(action)`.
- `systems/pointer.js` — touch and mouse write the same `touchY`/`touchX` channel, which overrides the keyboard when non-null. Local mode splits the screen (left half p1, right half p2). The mouse must pick the axis from `bossIsRotatedArena()` — otherwise it does nothing in the Creator fight.
- `systems/audio.js` — SFX synthesized with Web Audio (`playTone` / `soundEffects`), music via three `<audio>` elements, unlocked by the first interaction.
- `game/powerups.js` — one power-up on the field and one active effect at a time; `revertPowerup()` restores `originalValues`. Effects resize paddles, so `startGame`/`quitGame`/`checkWin` restore paddle sizes defensively. `startGame()` restores `width`, `height` **and** `x` (the rotated arena reshapes `p1`).
- `systems/achievements.js` — `unlockAchievement(id)` is idempotent and queues toasts; it does nothing visible for an id missing from `data/achievements.js`. `secret: true` entries show as `????` and are excluded from `getVisibleAchievementsTotal()`.

## Known bugs are preserved

`docs/bugs-conocidos.md` lists bugs found during the 2026 refactor that were **kept on purpose** (the refactor promised no behaviour change). Each is marked in code with `BUG conocido (conservado)`. Fixing one is a behaviour change: do it in its own commit, and expect to re-record the affected goldens. Don't fix one silently — e.g. never add `data-category` to the shop tabs.

## Repo notes

- `css/style.css` is one file split by banner comments; Tailwind utilities carry most of the layout, `style.css` the retro/CRT identity and the custom properties (`--primary`, `--primary-rgb`) that `systems/theme.js` rewrites per theme. Canvas drawing reads the same colour via `currentThemeHex()`.
- Any keyframe animating `transform` on a centred element must re-apply its `translateX(-50%)`, or the element jumps out of the viewport — that is why `#dialogue-box` has its own `dialogue-shake`.
- `#hachepe-characters.hidden` is needed: without it the id's `display:flex` beats Tailwind's `.hidden`.
- `.mcp.json` configures the Playwright MCP server (`--browser msedge`, since Chrome isn't installed on this machine). It wraps `npx` in `cmd /c` because npx is a `.cmd` on Windows — change that to plain `npx` on Linux or macOS.
- Playwright output (`.playwright-mcp/`) and stray root-level `*.png` are gitignored. Keep captures out of the repo.

## Verifying changes

1. **Types:** `npx -y -p typescript@5 tsc -p jsconfig.json` must report **zero** errors (JSDoc `@typedef`s for `Ball`, `Paddle`, `GameState`, `BossMechanics`, `PowerupType`, `ShopItem`… live next to the code they describe).
2. **Regression suite:** `python tests/serve.py`, open `http://127.0.0.1:8000/tests/`, press *Ejecutar todos* (or call `window.__tests.runAll()` and poll `window.__done`). It checks the script list, the computed styles of every screen at four viewport sizes, and replays deterministic matches frame by frame against `tests/golden/`. A refactor must stay green **without re-recording**; re-recording a golden means accepting a behaviour change and belongs in a commit that says why. `tests/README.md` explains the harness. Never edit files while a run is in progress: each scenario reloads the game.
3. **Open `index.html` directly** (`file://`) after any change to loading, and check the console.

Everything is global, so Playwright MCP's `browser_evaluate` can drive the real game directly:

```js
prepareCampaignMatch(4); startGame('campaign'); stopDialogue();   // the VS timer restarts it ~3 s later
for (let i = 0; i < 3000; i++) { state.serveCountdownMs = 0; update(1); }
```

Two habits worth keeping, because both caught real bugs that reading the code did not:

- **Simulate several player skill levels**, not one. A perfect bot rallying forever against a perfect CPU is how the unbeatable-boss and stuck-ball bugs stayed hidden; the test bots use edge hits for that reason.
- **Look at the screenshots.** The giant square paddle, the dialogue box sliding off screen and the armor stripes bleeding over the eye were all invisible in the numbers.
