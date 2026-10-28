# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Browser Pong "Edición Arcade" — a 100% static frontend app. Vanilla JS (classic scripts sharing the global scope), HTML5 Canvas, TailwindCSS via CDN. **No build step, no npm, no bundler, no linter.** Editor type checking is `jsconfig.json` + JSDoc; changes are verified in a real browser through Playwright MCP (see «Verifying changes»).

**Hard requirement: the game must work by opening `index.html` directly (`file://`) as well as on GitHub Pages.** That is why the code uses classic `<script>` tags and not ES modules (browsers refuse modules from `file://`). Don't introduce `import`/`export`, `type="module"`, `fetch()` of local files or anything else that needs a server.

Code, comments, UI strings and commit history are in **Spanish**. Keep new code and UI text in Spanish to match.

## Running

Open `index.html` in a browser — that's all the game needs. For development, serve the folder with `python tools/serve.py` (port 8000): it sends `Cache-Control: no-store`, otherwise the browser heuristically caches stale JS and you end up checking old code.

Deployed as a GitHub Pages static site — the repo root is the web root.

### Cache-busting is manual: one version N

`index.html` loads every file of `js/` with its own `<script src="js/…?v=N">` and the stylesheet as `css/style.css?v=N`, all with the same N. **After editing any JS or CSS, bump N everywhere**, or GitHub Pages (which caches ~10 min) serves stale files. **Adding, moving or deleting a file of `js/` means updating the script list.** Check it by hand: one tag per file of `js/`, all with the same `?v=N`, none `type="module"`, and `main.js` last.

## Architecture

### Layers

```
js/main.js      entry point: calls every init*() in order
js/core/        base layer — constants, storage, settings, state
js/data/        static catalogues — themes, lore, achievements, shop, levels, missions, power-ups, mechanics (MECH), music, news (Novedades)
js/systems/     audio (SFX), music (player), theme, input (keyboard), pointer (mouse + touch), stats, achievements, progression, missions
js/game/        canvas, draw, effects, balls, ai, mechanics, physics, match, hud, hints, loop, render, powerups, practice
js/vfx/         random (vfxRandom, vfxHash, vfxT, and sfxRandom for audio), shop cosmetics — trails, backgrounds, paddles, goal-fx — plus super (super-hit styles) and mechanics (MECH_FX) (+ index.js facade)
js/bosses/      index.js (table + dispatchers), shared.js, one file per boss
js/campaign/    progress (boss in play, VS, advance), menu (carousel + intro), dialogue, finale
js/ui/          screens, howto («Cómo jugar»), news (Novedades), actions (data-action registry), settings-panel, stats-panel, shop-ui, progress-display, progress-ui (rank emblem)
```

All files are classic scripts: their top-level `const`/`let`/`function` share one global scope, so **every top-level name must be unique across the project and must not collide with a `window` property** (grep before naming). Each file starts with `'use strict'`. Files call each other freely inside function bodies (those run after every script has loaded), but **top-level code may only use what `index.html` loaded before it**. The script list follows the layer order above; within it, the only cross-file top-level dependencies are:
- `core/state` uses `core/constants`; `core/settings` uses `core/storage`; `systems/audio` and `systems/music` read `settings` when they load;
- `bosses/creator` uses `CREATOR_BAND_H` from `bosses/shared`, and `bosses/index` builds `BOSS_MECHANICS` from the six boss files — so `shared` → bosses → `index`.

Breaking the order throws a `ReferenceError` at load and every test fails.

### Shared state

- Mutable match state read by several files lives in the `state` object (`js/core/state.js`, typed `GameState`): `mode`, `isPlaying`, `isPaused`, `p1Score`, `p2Score`, `frameCount`, `serveCountdownMs`, shake, `hitStopMs`, `fever`/`feverHeat`, `balls`, `particles`. **Anything another file must write goes in `state`** (e.g. the campaign sets `state.isPlaying = false`). The paddles `p1`, `p2` and `p2Twin` are stable objects declared next to it; besides their box they carry the mechanics fields (`vy`/`vx` and `prevY`/`prevX`, `charge`, `smashHeld`, `smashTouchHeld`, `releaseMs`, `energy`, `superArmed`), reset by `resetPaddleMechanics()` in `startGame()`. Paddles have no `dy`/`dx` any more. Balls carry `spin`, `power` (`null`/`'smash'`/`'super'`), `owner` and `squash` (visual).
- Other top-level `let`s (`currentCampaignLevel`, `isDialogueActive`, `activePowerup`, `bossState`…) are reassigned only by the file that declares them; other files only read them. Keep it that way, or add a setter.
- `state.balls` is replaced wholesale by `resetBall()`, even mid-`update()`: **never keep a reference to the array across calls**; read `state.balls`.

### Boot and events

- No file registers listeners or touches the DOM while loading (reading `localStorage` and looking up the canvas are the only load-time work; music `Audio` elements are created the first time a track plays). `js/main.js` calls `initAudio`, `initInput`, `initCanvas`, `initPointer`, `initCarouselControls`, `initActions`, `refreshMissions`, `initUI`, `initNews` in that order (`initNews` opens Novedades on top of the main menu when `settings.seenNewsVersion !== NEWS_VERSION` or `settings.progressWasReset`). **Keep `initAudio` before `initInput`**: both listen to `keydown` on `window`, and same-target listeners run in registration order.
- The markup has **no inline handlers**. Controls declare `data-action="fn"` (click), `data-input="fn"` or `data-change="fn"`, plus `data-arg` when the call takes an argument. `js/ui/actions.js` has one registry per event type, named after the functions they call, and three delegated listeners on `document`. Adding a control = adding a registry entry that **converts its argument** (dataset values are strings: `carouselMove("-1")` would concatenate). Unknown actions throw.
- Every menu is a `<section class="screen">`; `showScreen(id)` (`js/ui/screens.js`) shows one. «Cómo jugar» (`#howto-menu`, `js/ui/howto.js`) opens from the main menu, the pause or Novedades and its back button returns there; opened from the pause it toggles the classes itself (like `togglePause`), so the match stays paused with its music ducked, and ESC closes it back to the pause. Its key labels come from `settings.bindings` each time it opens. Entering `main-menu` hides `#game-container`; `shop-menu`, `campaign-menu` and `progress-menu` re-render; every screen sets its music through `screenMusic(id)` (see `systems/music.js` below). Novedades (`#news-screen`, `js/ui/news.js`) is not a screen of its own either: `openNews()` keeps `main-menu` active (and `inert`) underneath — full screen below 900 px, a 760 px dialog above. It opens by itself on the first load of a version (or after a progress reset) and from `#news-btn` (with a dot while unseen); closing it (¡A JUGAR!, ✕ or ESC) stores `seenNewsVersion` and clears `settings.progressWasReset`. Its reset notice shows only while `settings.progressWasReset` is set (by the phase 4 reset, see Persistence). Gameplay is not a screen — `startGame(mode)` hides all and shows `#game-container`; pause and game-over are screens layered on top.

### Game loop (`js/game/`)

`loop.js` runs `update(dt)` (`physics.js`) then `render()` (`render.js`) per `requestAnimationFrame`. `dt` is normalized to 60 FPS units (`elapsedMs / MS_PER_FRAME`, clamped to ≤3), so speeds are "pixels per frame at 60 FPS" and every movement is multiplied by `dt`; `dt * MS_PER_FRAME` converts to milliseconds. `render()` layers are listed in its header (fever right after the background, super aura before each ball, spin right after it, smash charge after the paddles, `MECH_FX.render` after the particles).

`update()` is a fixed sequence of named steps: dialogue pause → hit-stop (only counts `state.hitStopMs` down and returns; `render()` keeps drawing the frozen frame) → slow-motion → boss update → remember paddle positions → player 1 → player 2 or CPU (`ai.js`) → clamp (a paddle that hits the edge loses its speed) → measure pointer/CPU paddle speeds → smash charge of the human paddles → serve countdown → balls (move, spin, squash, walls, boss obstacles, paddles, the practice wall, goals) → power-ups → fever heat → VFX → particles → shake. **The order is behaviour**: physics, the screen shake and the bosses share `Math.random`, so reordering changes every later random number. **Visual effects use `vfxRandom()` (`vfx/random.js`), never `Math.random`**, so a cosmetic never changes a match; **audio uses `sfxRandom()`, neither of the other two**, so a sound never changes the match or what the cosmetics draw. `prefersReducedMotion()` (`game/effects.js`) only draws less (no shake offset, half the particles, lighter goal effects): **it must never change how many times `Math.random` is called** — the shake still draws its two numbers. Two early exits are explicit return values: during the serve countdown only the VFX, the particles and the shake advance (in that order, as at the end of the frame), so the goal shake ends on time instead of lasting the whole countdown; and a match-ending goal with several balls stops the frame, while with one ball the rest of the frame still runs (`onBallOut` in `physics.js` documents the asymmetry).

- Fixed logical resolution `GAME_WIDTH × GAME_HEIGHT` = 800×600. `canvas.width/height` are always the logical size; `resizeCanvas()` only sets CSS size: it picks the HUD layout (`#game-container[data-layout]`: `top` on desktop/tablet, `sides` in short landscape, `stack` in portrait) and fits 4:3 into the real size of the `#canvas-wrapper` grid cell.
- Slow-motion is a `dt` multiplier. The power-up's (`getSlowmoMultiplier()`) slows the match; the epic goal's (`getGoalSlowmo()`, a cosmetic) only slows what is drawn: `fxDt` feeds `updateVFX` and `updateParticles`, never the paddles, the serve countdown or the shake (which draws from `Math.random`). `realDt` is the `dt` before both: the match clock and the slow-motion power-up itself (10 real seconds) count with it.
- `update()` returns at once while `isDialogueActive` — that is the campaign's "pause".
- `checkWin()` (`match.js`) is explicit orchestration, not events: sound (the track fades out and the jingle plays, `playMatchEndSound`) → dialogue → campaign victory → stats → achievement → rewards → displays → paddle restore → music (narrated endings only) → narrative sequence. That order is behaviour too.

### Game modes

`state.mode` (`GameMode`) is set by `startGame(mode)`: `'cpu'` | `'local'` | `'hachepe'` | `'campaign'` | `'practice'`.

- `cpu` — AI paddle speed/dead zone from `settings.difficulty` (1/2/3), plus the mechanics plan below.
- `local` — both paddles human; **awards XP but no Chemi Coins** (anti-farming, `awardGameRewards` in `systems/progression.js`).
- `hachepe` — standalone boss mode: fast near-perfect AI, exclusive music, target score 10. Deliberately separate from the campaign.
- `campaign` — see below.
- `practice` (`game/practice.js`, entered with `startPractice(from)` from «Cómo jugar» or mode select) — the player against a wall (`PRACTICE_WALL`) covering the right edge: no CPU (`moveCpu` is skipped and `hitPaddles` ignores `p2`), no power-ups, no rewards, stats or achievements (`statsCountMatch()` keeps the play clock and the totals still; `checkWin()` returns `false` at once). The wall bounce (`bouncePracticeWall`) adds `±1.5` to `dy` with `Math.random` — the only new random call, and only in this mode — and drops a smash/super to the normal top speed. A miss (`practiceMiss`) counts in `state.p2Score`, resets the rally and serves again. Every mechanic works, fever music included. The HUD shows the best rally (`matchBestRally`) in the player's card and the misses in the «PARED» card; «SALIR» in the pause returns to `practiceReturnScreen`.

### Hit mechanics (`data/mechanics.js`, `game/mechanics.js`)

Every number lives in `MECH`; never repeat one as a literal. `game/mechanics.js` keeps `physics.js` a list of steps:

- **Kinematics.** Keyboard paddles have inertia (`movePaddleKeys`: accelerate with `accelK`, brake with `decelK`; charging a smash slows them by `smashSlowK`). Finger and mouse still jump to the pointer (`followPointer`, capped while charging) and their speed is *measured*, like the CPU's and the twin's (`measurePaddleSpeeds`). `vNorm(p)` is the speed over `paddleSpeed`, −1…1; the rotated arena uses `x`/`vx`.
- **Hit model.** `hitPaddles()` only detects the collision; `resolveHit(b, paddle, maxBallSpeed, rotated)` classifies the hit by priority — super (smash window open, `charge ≥ superMinCharge`, energy full or `superArmed`; or `smashTouch === 'auto'` with full energy and a finger on screen), smash, perfect (`|c| ≤ centerZone`), edge (`|c| ≥ edgeZone`), block (paddle still), normal — and sets angle, speed (edge and block never go below the serve speed; a rival smash/super is capped at the normal top first), spin, owner/power, energy, the smash reset, feel (sound, sparks, shake, hit-stop, haptics, squash), the VFX, `bossRefreshAim`, `setLastHitter`, the stats and the fever. `applySpin()` curves the ball in flight; walls multiply spin by `spinWallK`.
- **Smash.** `updateSmash(p, held, dt)` after moving each human paddle: holding charges over `smashChargeMs`; releasing opens a `smashWindowMs` window; a hit while still holding is normal and loses the charge. `held` is `isActionPressed('p1Smash'|'p2Smash') || p.smashTouchHeld`. `releaseSmashCharges()` cuts the hum on pause, quit and match end.
- **Energy.** 0–100 per paddle (the twin's goes to `p2`): +6 per hit, +15 perfect, +10 smash, ×`feverK` in a fever, +10 to both every 10 rally hits; a super empties it. Filling it plays `superReady` and, for player 1, shows `#super-hint`. Energy survives goals; `resetBall()` only closes charge and window.
- **Fever.** At `feverRally` hits `startFever()`: top speed ×`feverMaxSpeedK`, energy ×2, `fiebre_rally` music in VS CPU and local only (the previous track resumes in `endFever()`, called on any goal). `state.feverHeat` is visual.
- **CPU.** Only in VS CPU and Hachepe (`cpuPlay` in `ai.js`): when a ball starts coming it rolls a plan (always four `Math.random` calls: spin, smash, use super, aim offset) from `MECH.cpu`, predicts the arrival point simulating bounces and (weighted) spin, aims the paddle centre at it, moves away from the player in the last frames for spin, and holds/releases the smash with `updateSmash`. **Campaign bosses don't use the mechanics** (they come with the campaign rework): they keep their AI and `resolveHit` makes every boss hit a plain normal one, without spin or block — a waiting boss would otherwise block every ball, slow it down and never miss. The player keeps every mechanic against them.
- **Touch.** `settings.smashTouch` and `settings.haptics` are set in Configuración › Partida (the haptics row only shows where `navigator.vibrate` exists). `#smash-btn-p1`/`-p2` exist only with `isTouchDevice()` and `settings.smashTouch === 'button'` (`data-smash` on `#game-container`, set by `setupHud()` before the field is measured; `"2"` in local). `'finger'`: a second finger in the player's half holds the smash (`activeTouches` stores it as `'p1Smash'`). `'auto'`: no smash, full energy makes the next finger hit a super. `isFingerOn(side)` (not `touchY`, which the mouse also writes) decides haptics and auto.

### Campaign: `campaign/` narrates, `bosses/` fights

`data/lore.js` holds the six Hachepes' story and dialogues; `campaign/` the flow; `bosses/` every fight mechanic. Each boss file declares a `BossMechanics` object (`{ config, init, update, render, renderOverlay, collide, onGoal, hidesBall, freezesPlayer, invertsControls, segmentIsArmored }`, all optional but `config`). `game/` never names a boss: it calls the dispatchers in `bosses/index.js` and reads `bossConfig()` (`targetScore`, `aiSpeed`, `aiError`, `aiBias`, `paddleAxis`, `useHealth`, `hitDamage`). **Add a boss by adding a file and a table entry, never a `currentCampaignLevel === N` branch in `game/`.**

Two non-obvious rules learned from bugs:

- **`aiBias` is what makes a boss beatable.** `aiError` is a dead zone, and any dead zone smaller than the paddle's half-height (50px) never produces a miss. `aiBias` offsets the boss's *aim*, refreshed on every hit.
- **Obstacles belong on the boss's half, and must add spin.** A block on the player's half traps the ball in a paddle↔block loop; a block on the vertical centre intercepts every flat return. Chemi's rubble sits at x ≥ 0.60 and its bounce perturbs `dy`.

Flow: `renderCampaignMap()` builds the boss **carousel** (cards 1–5; the corrupted Creator card appears only once `campaignProgress` reaches 6) → `prepareCampaignMatch(level, opts)` → VS screen → `startCampaignGame()` → `startGame('campaign')` + `queueDialogue()`. Beaten bosses are replayable at a reduced reward (`CAMPAIGN_REPLAY_FACTOR`). The carousel renders two neighbours per side: `updateCarousel()` only sets `is-active` and `data-pos` (-2…2), and CSS turns each position into size, offset and opacity per breakpoint (cards are centred with negative margins, not `transform`, because the Creator's flicker animates `transform`). It is driven by arrows, keyboard, the node path and swipe — keep all four working. The nodes are the `.carousel-dot` buttons and must stay the only children of `#carousel-dots` (connectors are `::before`). The mode-select campaign card counts only the five Hachepes (`X / 5`).

**"Next boss" must come from `getNextCampaignBoss()`**, which counts from `currentCampaignLevel`, not from `campaignProgress`. Using progress sent players straight to the Creator after replaying an early boss.

**The twist is load-bearing — don't leak it.** Beating Yisus (`CAMPAIGN_LAST_BOSS`) routes through `runFinaleSequence()` instead of the game-over screen: fake victory → warped music → CRT blackout → the Creator's reveal → VS. Beating the Creator runs `runTrueEndingSequence()`. `checkWin()` recognises both via `narrativeEnding`. Nothing about the Creator may be visible in menus, the achievements grid or the carousel before the story reveals it.

The Creator's on-screen identity is a **canvas-drawn eye** whose pupil tracks the ball (`CREATOR_TONES`: green → amber → bloodshot per phase); its health bar reads as the lower lid. Its three phases stack armored band segments (`segmentIsArmored` via `bossSegmentArmored`), a telegraphed ball warp and an eye beam that freezes rather than kills. Every attack is announced before it lands — that is what keeps the fight hard instead of unfair. It is the only boss with `useHealth: true`: won by emptying `bossHealth()`, while `state.p2Score` counts the player's *misses*. Keep those meanings apart.

The typewriter interval is shared by dialogues, the intro and the finale reveal; `campaign/dialogue.js` owns it (`startTypewriter` / `clearTypewriter`).

### Persistence — three independent localStorage keys

| Key | Owner | Holds |
|---|---|---|
| `pongGame.settings.v1` | `js/core/settings.js` | theme, difficulty, volumes, winning score, ball speed, CRT/shake/mouse/powerups toggles, `smashTouch`, `haptics`, `showHints` and `seenHints` (first-time hints already shown), `seenNewsVersion` and `progressWasReset` (both kept by «Restablecer todo»), key bindings (including `p1Smash` Space and `p2Smash` Enter) |
| `pongGame.stats.v2` | `js/systems/stats.js` | games/wins/streaks/records, mechanics totals (perfect, spin, smash/super goals, fevers), `dailyMissionsDone` **and the unlocked-achievements map** |
| `pongGame.progression.v2` | `js/systems/progression.js` | XP, level, `prestige`, `coins` (Chemi Coins), `owned` (`'trails:neon'` keys: ids repeat across categories), `equipped` (one id per `SHOP_CATALOG` key), `rewardedLevel`, `campaignProgress`, `campaignIntroSeen`, `missions`, `missionsCompleted`, `weeklyCompleted` |

`core/storage.js` only wraps get/parse/set in try/catch. **Each key keeps its own merge rules** (`{ ...DEFAULTS, ...saved }` plus key-specific handling, including preserved bugs); don't generalise them. Settings: a new default binding whose key a saved binding already uses stays `null`; `seenHints` is copied, never shared with `DEFAULT_SETTINGS`, and «Restablecer todo» empties it. Progression also merges `equipped` with its defaults and re-adds the free items to `owned`. Preserve the spread pattern when adding fields, and bump a version only for a genuinely incompatible change. **Phase 4 reset:** progression and stats moved to `.v2` and start from zero; when a v2 key is missing and its v1 exists, `discardOldSave()` (`core/settings.js`) removes the v1 and sets `settings.progressWasReset`. Settings stay `.v1`. Achievements live under stats (`resetStats()` keeps them).

### Cosmetics: shop → progression → vfx

`SHOP_CATALOG` (`data/shop.js`) has 4 categories `trails`/`backgrounds`/`paddles`/`goalEffects`; `SHOP_CATEGORIES` lists the tabs. Buying calls `purchaseItem(cat, id, cost)`, equipping `selectCosmetic(cat, id)` (`cat` is the `SHOP_CATALOG` key), which writes `playerProgression.equipped[cat]`. The `vfx/` renderers read `equippedId(cat)` **every frame** through their id → renderer tables. Adding a cosmetic = a renderer in the right `vfx/` table + a catalogue entry with the same `id` + an SVG icon in `assets/shop/` (`<prefix><id>.svg`; if it uses `var(--primary)`, also inline it in `SHOP_ICONS`, because an `<img>` doesn't inherit CSS variables). Rarity is derived from the price (`shopRarity()`), not stored. Backgrounds are the only stateful ones (`init/update/render`); `setActiveBg()` calls `init()`, which draws from `vfxRandom()`.

### Other subsystems

- `systems/input.js` — `keysDown` Set (anti-ghosting for 2 players); remappable bindings via `isActionPressed(action)`.
- `systems/pointer.js` — touch and mouse write the same `touchY`/`touchX` channel, which overrides the keyboard when non-null. Local mode splits the screen (left half p1, right half p2). The mouse must pick the axis from `bossIsRotatedArena()` — otherwise it does nothing in the Creator fight.
- `systems/audio.js` — sound effects and the mixing graph. The `AudioContext` is created lazily (the first sound or interaction) together with the graph: effect voices → `sfxBus` (gain = effects volume) and Web Audio music → `musicBus` (gain = music volume, −8 dB while paused), both into `masterComp` (compressor, −14 dB) → destination. Two primitives scheduled on the audio clock (`ctx.currentTime + when`, never `setTimeout`): `sfxVoice()` (oscillator → exponential envelope → optional lowpass → stereo panner when available) and `sfxNoise()` (one shared 1 s noise buffer through a bandpass). `soundEffects` builds every effect from them; hits take `{ x, speedRatio }` for pan and pitch. Their variation (detune, noise samples) comes from **`sfxRandom()`**, never `Math.random` (physics) or `vfxRandom` (cosmetics). With effects off or at volume 0 no voice is created. The file also keeps the old music entry points (`playMenuMusic`, `playGameplayMusic(mode)`, `stopGameplayMusic`, `stopAllMusic`, `pauseAllMusic`, `setMusicVolume`, `setMusicEnabled`) as wrappers of the player. Music and SFX have toggles both in Settings and in the pause menu; both call `toggleMusic`/`toggleSfx`, and `syncAudioToggles()` (`ui/settings-panel.js`) keeps the four checkboxes equal.
- `systems/music.js` — the music player over `MUSIC_TRACKS` (`data/music.js`: file, `loop`, `loopStart`, `loopEnd` — `null` = end of file — copied from `design/actualizacion-v2/musica/bucles.json`; the intro plays once, then `[loopStart, loopEnd]` repeats). `musicPlay(id)` crossfades and does nothing if that track already plays; each track keeps its position, so returning to it resumes. `musicStop()` fades and forgets it; `musicPause()`/`musicResume()` back the music toggle (with music off, `musicPlay` only records the track, and the toggle resumes it); `musicPlayOneShot()` plays the jingles; `musicSetRate()` serves the fake ending; `musicSetDuck()` is the pause. **Two engines, chosen per track:** A, Web Audio (only on `http:`/`https:` with `fetch` and `decodeAudioData`): sample-exact `loopStart`/`loopEnd` on an `AudioBufferSourceNode`, falling back to B if loading fails; B, one `<audio>` per track (on `file://` and as fallback): a 25 ms watcher jumps from `loopEnd` to `loopStart`, fades step every 50 ms. Which track plays where:

  | Where | Track |
  |---|---|
  | Main menu, mode select, campaign, controls, «Cómo jugar», Novedades, settings, exit | `musica_menu` |
  | Shop, achievements, stats, progress | `musica_tienda` |
  | VS CPU and local matches | `partida_synthwave` |
  | Hachepe mode and campaign bosses | `hachepe_rap` |
  | The Creator | silence |
  | Pause | same track, −8 dB |
  | Game over | the track fades out; `jingle_victoria`/`jingle_derrota` (local: victory). With music off, the synthesized `win()`/`lose()`. Narrated endings get no jingle |

  `showScreen(id)` calls `musicPlay(screenMusic(id))`; `screenMusic` (`ui/screens.js`) returns `null` for screens that keep the current music (pause, game over, VS, finale). The fake ending's `warpMusic()` bends the current track with `musicSetRate()`, but today there is none: `checkWin()` stops it first.
- `game/powerups.js` — one power-up on the field and one active effect at a time; `revertPowerup()` restores `originalValues`. The shield has `SHIELD_HP` (5) blocks instead of a time (30 s only as a safety cap): each block plays `shieldCrack`, the last one reverts it, `drawShieldWallV2` shows the wear (holes are clipped from the wall, never `destination-out`, which would erase the field) and the pill reads "3/5". Waits between power-ups come from `nextPowerupCooldown()` (6–12 s). The field shows an orb with the type's `icon` glyph and `color` (`data/powerups.js` has no emoji); the same glyph and colour feed the pill. The orb, the pick-up burst and the effect overlays (shield wall, big-ball aura, slow-motion vignette, speed lines) are drawn at the end of that file and draw from `vfxRandom()`. The active effect is shown by the DOM pill `#powerup-pill` (`updatePowerupPill()`, called from `render()`), not on the canvas; the score, its pips, the time and the rally are the DOM HUD too (`game/hud.js`), so the canvas draws no score: only the net, or the hearts in the rotated arena. Effects resize paddles, so `startGame`/`quitGame`/`checkWin` restore paddle sizes defensively. `startGame()` restores `width`, `height` **and** `x` (the rotated arena reshapes `p1`).
- `systems/stats.js` also keeps two per-match counters for the HUD and the game-over screen: `matchElapsedMs` (ticked in `update()` only while the ball is in play — not during dialogue, pause or the serve countdown — in real time, ignoring slow-motion) and `matchBestRally`. Both reset in `statsOnGameStart()` and live outside `state`: they never affect play. The same file counts the per-match mechanics (`matchPerfect`, `matchSpin`, `matchSmashGoals`, `matchSuperGoals`, `matchFeverCount`, `matchFeverPoints`). `#game-over-screen` gets `data-result="win|loss"` (local is always `win`) and `data-winner`, which drive its colours, and `body.has-result` (`syncResultClass()` in `game/match.js`) moves the achievement toast to a corner while the pause or game-over screen is up, so it never covers the title.
- `game/hints.js` — first-time hints: `showHint(key)` (`spin`, `perfect`, `fever`, `pu_<id>` with the power-up's `hint` text) shows `#hint-toast` above the field for 3 s, queued, once ever per key (`settings.seenHints`), unless `settings.showHints` is off. The full-energy `#super-hint` uses the same gate under the key `energy`, but shows the first 3 times (`ENERGY_HINT_TIMES`). Hints only touch the DOM and the settings: no `Math.random`, so they never change a match.
- `data/levels.js` + `systems/progression.js` — 50 levels in 10 ranks of 5 (`RANKS`, `levelInfo(n)` → «Aprendiz III», `xpForLevel`, `levelForXP`; level 50 = 34 300 XP). The level is derived from `totalXP`; `checkLevelUp()` pays **every** level between `rewardedLevel + 1` and the new one (`levelReward(n)`: `20 + 5n` coins, a chest of `60 + 6n` on multiples of 5, a new rank on 6, 11… 46, the exclusive `paddles:gold` on 50 via `grantExclusive`) and one prestige star + 250 coins per 2 000 XP above level 50 (`getXPProgress()` then measures the next star). `rankEmblemSVG()` (`ui/progress-ui.js`) draws the rank emblem used by the menu badge (`#menu-level-num`), the game-over screen and the level-up / «¡NUEVO RANGO!» notice. The same file renders «Progreso» (`#progress-menu`, `renderProgressScreen()`): rank card, the 10 ranks, the reward path (levels −2…+3), the missions with a 1 s countdown that stops when the screen is left, and the prestige card (desktop only). In the main menu `#main-progression` holds two buttons: the level block opens Progreso, the coins open the shop.
- Match rewards: `awardGameRewards()` (tables `XP_REWARDS`/`COIN_REWARDS` in `data/levels.js`) builds `sessionBreakdown`, one `{ label, xp }` row per concept (result, points with fever points doubled, perfect hits capped at 10 XP, best rally, smash/super goals, perfect game), from the per-match counters of `systems/stats.js`. The game-over screen (`renderGameOverRewards()`, `ui/progress-display.js`) shows it as is in `#game-over-xp-list`, plus a «Misión: …» row per mission completed in the match, the total and the coins, the level card (emblem, a two-segment bar — XP before the match in the theme colour, XP gained in yellow — and the next level's reward) and one card per completed mission; on desktop all of it sits in `.go-col--side`. Practice never gets there.
- `systems/missions.js` — 3 daily missions and 1 weekly (`data/missions.js`), stored in `playerProgression.missions` (`{ day, daily: [{ id, progress, done }], week, weekly }`). They are picked from the local date (`'AAAA-MM-DD'`) and the ISO week (`'AAAA-Www'`) through FNV-1a + mulberry32 — **never `Math.random`**, `vfxRandom` or `sfxRandom` — and renewed by `refreshMissions()` on load and in `startGame()`. `missionEvent(type, amount, info)` is called next to the stats (`systems/stats.js` hooks, plus the power-up pick-up in `game/powerups.js`); practice never counts and win events only come from VS CPU, Hachepe and campaign. Completing one pays at once, plays `missionComplete`, queues a toast in the achievement toast queue («Misión completada») and is listed in `sessionMissions` for the game-over screen. The same local date always gives the same picks (so they depend on the machine's time zone).
- `systems/achievements.js` — `unlockAchievement(id)` is idempotent and queues toasts; it does nothing visible for an id missing from `data/achievements.js`. `secret: true` entries show as `????` and are excluded from `getVisibleAchievementsTotal()`. Each catalogue entry has a `category` (its colour in `ACHIEVEMENT_CATEGORIES`) and an `icon` (the `d` of a 24×24 stroke glyph); `achievementMedalSVG()` (`ui/stats-panel.js`) draws the hexagonal medal for the list and the toast. Cumulative achievements read their threshold from `ACHIEVEMENT_GOALS`, which both the unlock checks (`achievementGoalMet`) and the progress bars (`getAchievementProgress`) use — change a target there, never as a literal. Level and prestige achievements are checked in `checkLevelUp()` (`checkLevelAchievements`), mission ones when a mission completes (`checkMissionAchievements`), and both again at the end of a match. `exclusive_first`, `buy_legendary`, `rockola_dj` and `portal_goal` are in the catalogue for phases 5–7 but nothing unlocks them yet. The secret is drawn at the end of the Campaña group and, while locked, shows the "?" glyph in grey: never its eye, name or colour.

## Repo notes

- `css/style.css` is one file split by banner comments; Tailwind utilities carry most of the layout, `style.css` the retro/CRT identity and the custom properties (`--primary`, `--primary-rgb`) that `systems/theme.js` rewrites per theme. Canvas drawing reads the same colour via `currentThemeHex()`.
- The UI redesign ("gabinete arcade de neón") is being implemented in phases from `design/rediseno-ui/README.md` (untracked, owned by the user). Its design tokens (`--bg`, `--surface`, `--text`, `--muted`, `--gold`, `--danger`, `--p2`, `--on-primary`…) live in `:root`; derive theme colours with `rgba(var(--primary-rgb), a)`, not hard-coded hex. Reusable pieces sit under the "Sistema visual" banner: `.btn`/`.btn-p`/`.btn--danger`, `.icon-btn`, `.panel` + `.brk` (HUD corners), `.tile`, `.chip`, `.xp-track` (segmented by a mask, no JS), `.floor` (synthwave grid, placed inside a `.screen`), `.px`/`.lbl`/`.ico`. The older class names `.key-btn` and `.option-pill` are kept and already share that look. Toggles are `.tgl` styled on the `<input type="checkbox">` itself (`appearance: none`), and the percentage rings are `.pct-ring` with the value in `--pct` — not `.ring`, which is a Tailwind utility.
- The in-game HUD lives in the DOM, outside the field: `#game-container` is a CSS grid whose direct children are `#hud-mode`, `#hud-p1`/`#hud-p2` (cards with name, score, one pip per point and the 10-segment energy bar `#hud-energy-*`; full, the card gets `.is-super`), `#hud-stats` (time and rally; `#hud-rally-chip.is-fever` during a fever), `#mobile-pause-btn`, `#smash-btn-p1`/`-p2` (touch only), `#canvas-wrapper` (with `#super-hint` inside), `#powerup-pill` and `#orientation-hint`. `setupHud()` (`game/hud.js`) fills it in `startGame()`; `updateHud()`, called from `render()`, only writes when the score, rally, second, fever or lit energy segments change. The top cards have a fixed height, so the energy bar does not move the canvas. `resizeCanvas()` measures the field cell with `data-measuring` set (the field track takes all the free space), then sets the canvas and wrapper size and `--field-w`/`--field-h`, which size the tracks so the HUD hugs the field. The container must not get `position: fixed` or a `z-index`: that would create a stacking context and hide the campaign `#dialogue-box` (z-index 50) under the game-over screen, where the boss's farewell line is meant to show.
- Any keyframe animating `transform` on a centred element must re-apply its `translateX(-50%)`, or the element jumps out of the viewport — that is why `#dialogue-box` has its own `dialogue-shake`.
- `.mcp.json` configures the Playwright MCP server (`--browser msedge`, since Chrome isn't installed on this machine). It wraps `npx` in `cmd /c` because npx is a `.cmd` on Windows — change that to plain `npx` on Linux or macOS.
- Responsive rules: safe areas are `max(<old padding>, env(safe-area-inset-*))`, which resolves to the same pixels without a notch; 44px touch targets live in the `@media (pointer: coarse)` block at the end of `style.css`.
- Playwright output (`.playwright-mcp/`) and stray root-level `*.png` are gitignored. Keep captures out of the repo.
- `docs/bugs-conocidos.md` records the bugs found during the 2026 refactor and how each was later fixed. A refactor must not change behaviour; a bug fix is a behaviour change: do it in its own commit and say why in it. If a bug must be kept for now, mark it in code with `BUG conocido (conservado)` and list it in that file.

## Verifying changes

There is no regression suite any more (it was removed in commit L.1). Claude Code checks every change itself in a real browser through **Playwright MCP** (`.mcp.json`, Edge); the full procedure is `design/actualizacion-v2/verificacion-playwright.md`. Playwright is a development tool only: no `package.json`, `node_modules/` or Playwright config in the repo. Run the server in the background with `python tools/serve.py` (port 8000), e.g. `Start-Process python -ArgumentList 'tools/serve.py' -WindowStyle Hidden`.

### Level 1 · every commit (1–2 minutes)

1. **Types:** `npx -y -p typescript@5 tsc -p jsconfig.json` must report **zero** errors (JSDoc `@typedef`s for `Ball`, `Paddle`, `GameState`, `BossMechanics`, `PowerupType`, `ShopItem`… live next to the code they describe).
2. **Load:** open `http://127.0.0.1:8000/` with Playwright: no console errors, no 404 in the network requests.
3. **If the commit adds, moves or deletes a file of `js/`:** check the script list in `index.html` by hand (see «Cache-busting»).
4. **Version:** bump `?v=N` everywhere if any JS or CSS changed.

No screenshots and no simulated matches at this level.

### Level 2 · once, at the end of a phase (10–20 minutes)

In a clean Playwright context (`localStorage.clear()` and reload first):

1. **Both protocols:** `http://127.0.0.1:8000/` and `file:///…/index.html`, no console errors in either. On `file://` music goes through the `<audio>` engine: check it plays, or that `musicCurrent()` returns the expected track.
2. **Screens the phase touched,** captured at **390×844, 844×390, 768×1024 and 1280×800** (`browser_resize`). Look at every capture: cut text, buttons that overflow, overlaps, contrast. At every size, `document.documentElement.scrollWidth <= innerWidth` (no horizontal scroll).
3. **Simulated matches** with `browser_evaluate`, calling `update()` in a loop, with three bots: **perfect** (hits with the edge so rallies end), **medium** (±30 px error) and **bad** (misses one in three). In all three the match ends, `checkWin` is reached, there is no `NaN` in balls or paddles, and no ball goes more than 600 frames without crossing the centre.
4. **Determinism** (what the old `match` golden protected): seed `Math.random`, play the same match twice changing **only** cosmetics, and the trajectory must be identical. Call `render()` so the effects run:

   ```js
   function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
   function runTrace(equip) {
       Object.assign(playerProgression.equipped, equip);
       const real = Math.random; Math.random = seeded(1234);
       startGame('cpu'); stopLoop();
       let trace = '';
       for (let i = 0; i < 6000 && state.isPlaying; i++) {
           state.serveCountdownMs = 0;
           const t = state.balls[0];   // p1 follows the ball without Math.random, so there are rallies
           if (t) p1.touchY = Math.max(0, Math.min(GAME_HEIGHT - p1.height, t.y - p1.height / 2 + 22));
           update(1); render();
           const b = state.balls[0]; if (b) trace += b.x.toFixed(3) + ',' + b.y.toFixed(3) + ';';
       }
       Math.random = real;
       if (state.isPlaying) quitGame();
       return trace.length + ':' + [...trace].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
   }
   const a = runTrace({ trails: 'default', paddles: 'classic', backgrounds: 'none', goalEffects: 'classic' });
   const b = runTrace({ trails: 'rainbow', paddles: 'pixel', backgrounds: 'aurora', goalEffects: 'confetti' });
   [a, b, a === b];
   ```

   If `a !== b`, a visual or sound effect is using `Math.random`: find it before going on. Add the categories a phase introduces to both sets. Stop at the end of the match: `update()` does not check `state.isPlaying` (the loop does), so calling it after the final goal keeps scoring and runs the whole `checkWin()` again on every goal, which takes minutes.
5. **The phase's own checks** («Verificación con Playwright» / «Comprobación a mano» in its guide).
6. **Report** to the owner: what was checked, which captures were looked at, what failed and how it was fixed, and what is left for the manual check (above all sound and feel on a real phone).

While anything fails the phase isn't done: fix it in its own commit and repeat only the step that failed.

Everything is global, so Playwright MCP's `browser_evaluate` can drive the real game directly:

```js
prepareCampaignMatch(4); startGame('campaign'); stopDialogue();   // the VS timer restarts it ~3 s later
for (let i = 0; i < 3000; i++) { state.serveCountdownMs = 0; update(1); }
```

Two habits worth keeping, because both caught real bugs that reading the code did not:

- **Simulate several player skill levels**, not one. A perfect bot rallying forever against a perfect CPU is how the unbeatable-boss and stuck-ball bugs stayed hidden; the test bots use edge hits for that reason.
- **Look at the screenshots.** The giant square paddle, the dialogue box sliding off screen and the armor stripes bleeding over the eye were all invisible in the numbers.
