# Slingshot Safari — Field Expedition

A browser game for adults with a naturalist theme. You subdue wildlife with a precision slingshot, tag it, and document it against the encyclopedia, then release it. Play solo to level up, or race a rival online in VS mode.

It is a static site with no backend and no build step. Open `index.html` through any static web server.

```
python3 -m http.server 8080      # then open http://localhost:8080
```

## Controls

The game is a first-person 3D forest (Three.js, WebGL). Click the view to lock the mouse cursor (Pointer Lock).

| Input | Action |
|---|---|
| **W / S** | Walk forward / back (arrow keys also work) |
| **A / D** | Strafe left / right |
| Mouse | Turn and look. Click the view to lock the cursor; **Esc** releases it (and pauses a solo expedition). |
| **Space** hold / release | Draw the first-person slingshot (bands stretch, power builds over ~1 s) / fire a stone |
| Left mouse hold / release | Alternative draw and fire |
| Right mouse hold | Steady aim and zoom (field of view 72° → 40°, tighter spread, slower walk) |
| **C** / hold **Shift** | Crouch and sneak (toggle / hold). Crouching cuts the distance at which animals notice you by more than half. |
| **R** | Reload. The sling holds one stone and is empty after each shot. Loading takes about 0.6 s, less with upgrades. |
| **E** | Tag a stunned animal you are standing next to (opens its record card), or gather a stone pile |
| P / Esc | Pause a solo expedition, or close a record card |

Touch screens (phones and tablets) get a left thumb-stick to walk, drag anywhere else to look, a hold-to-draw **Draw** button, an **Aim** (zoom) toggle and **R**, **E** and **Crouch** buttons. *Settings → Auto-reload* and *Mouse sensitivity* are available.

The belt pouch starts each solo expedition with 24 stones and refills to 20 at the start of every VS round. Stone piles lie around the forest, often by rocks, and show on the minimap. Every stone you fire lands where it falls and can be picked up again.

## How a hunt works

- **The forest**: each region is a 320 m wide hilly forest with dense trees, bushes, grass, rocks, fog, a sky dome, and water in the mangrove. Meadow has broadleaf trees, the rainforest tall emergents, the mangrove stilt-rooted trees over water, and the highlands pines. Trees block you and your stones.
- **Wildlife AI**: all 34 species are procedural low-poly models built from primitives (birds, raptors, owls, fowl, quadrupeds, macropods, lizards). Ground animals wander, graze and bolt. Small birds perch in tree crowns and fly between trees, and mynas, parakeets, pigeons, bee-eaters and mallards move in flocks. Raptors soar in thermals and the eagle dives. Each animal has a detection radius that is larger for rarer species, smaller when you crouch or stand still, and smaller at night. A stone clattering nearby spooks animals too. Hit animals flee.
- **Ballistics**: stones fly with real gravity (9.8 m/s²) at 14–46 m/s depending on draw power and upgrades. Weather adds crosswind and rain drag. Hits are tested against spheres fitted to each model's body and head, and head shots deal 1.6× damage. The dotted arc previews the flight.
- **Subdue and tag**: when its stamina reaches zero an animal is stunned. Birds drop to the ground, stars circle its head, and it shows on the minimap and compass. Walk up and press **E** within about 3 m to tag it before it recovers (about 45 s). That opens the field record card.
- **HUD**: a compass strip (with markers for subdued animals and your rival), a rotating minimap (stone piles, subdued animals, rival), a crosshair that fills with draw power and turns amber over an animal, the objective, sling Loaded/Empty state and pouch count, context prompts and a crouch indicator.

## Features

- **First-person 3D**: a roamable, seeded forest per region, with a first-person slingshot viewmodel, procedural animal models with simple AI, Night lighting with a head torch and fireflies, and synthesised ambient sound. Animals are stunned and tagged, never harmed.
- **Field records**: each catch gets a record card with common and scientific name, class, family, sex, the *individual's* weight, the species' adult weight range, IUCN status, habitat and an encyclopedia introduction. The live summary and photo come from the Wikipedia REST API (`/api/rest_v1/page/summary/<Title>`), with a "Source: Wikipedia" link. There is offline fallback text in `js/wiki-fallback.js` and procedural illustrations.
- **34 species** in 4 regions, many from Southeast Asia: Oriental magpie-robin, Javan myna, plantain squirrel, long-tailed macaque, Sunda pangolin, Malayan tapir, smooth-coated otter, hornbills, collared kingfisher, Asian water monitor and more. Weight ranges come from each species' Wikipedia article. An individual's weight is drawn within the range, using the sex-specific range where the species is dimorphic.
- **Field Journal**: every species you have documented, with record counts, sex ratio, and the heaviest and lightest individual. Filter by class, region or threatened status.
- **Solo progression**: XP and field credits for each record. Levels unlock regions (Rainforest at level 3, Mangrove at 5, Highlands at 8) and raise the odds of rare species. The **Outfitter** sells draw weight, multi-shot, sighting and reload upgrades. Progress is saved in `localStorage`.
- **VS Online**: a peer-to-peer match over WebRTC using PeerJS. See below.
- **Plugins**: a modular hook API with 7 built-in plugins you can switch on and off.

## VS mode

1. Player A opens **VS Online → Host a room → Open room** and gets a 5-character code plus a challenge link (`…/#join=CODE`).
2. Player B opens the link, or goes to **Join a room** and types the code.
3. The host picks the match length (best of 3, 5 or 7) and presses **Start match**.

Both players walk the **same seeded forest**. Terrain, trees and stone piles are identical, and so is every animal's species, sex, weight, spawn point and spawn time. Your rival appears as a ranger avatar with a name tag, and its position is synced 10 times a second. When either player stuns an animal it is stunned on both screens. When one player tags it, it disappears for the other, and the host refuses a second claim. Animals are spooked by your rival too (unless the rival is crouching). Rounds last 2½ minutes.

The host is authoritative. It issues each round's objective, for example *"Catch a male Oriental Magpie-Robin"*, *"Catch 2 mammals heavier than 5 kg"* or *"Catch a threatened species"*. It also judges every catch and keeps the score. Both players share one match seed, so species, sex, weight, spawn timing and weather are identical on both screens. Completing the objective first wins the round and +3 points. Documenting the wrong animal costs 1 point. Both players use the same standard loadout. Gameplay plugins (Weather, Night) follow the host's settings.

Signalling uses the free public PeerJS cloud broker (`0.peerjs.com`). Game data travels directly between browsers over WebRTC. The PeerJS library ships in `js/vendor/`, with a CDN fallback. On very restrictive networks (some corporate or school networks, symmetric NAT without TURN) a connection can fail. If it does, try another network or a phone hotspot.

## Plugin API

Plugins are plain objects passed to `registerPlugin()`. Every hook receives `(payload, api)`. Reducers (`modify*`) receive `(value, payload, api)` and return the new value.

```js
registerPlugin({
  id: 'bounty',                 // unique id (required)
  name: 'Bounty Board',
  icon: '$',
  description: 'Extra credits for kingfishers.',
  defaultEnabled: true,
  gameplay: false,              // true = synced from host in VS (affects fairness)

  onInit(_, api) {},            // once, at startup
  onEnable(_, api) {}, onDisable(_, api) {},
  onCatch({ rec, xp, isNew, entry, game }, api) {
    if (rec.sp.family === 'Alcedinidae') { api.profile.coins += 10; api.save(); api.ui.toast('Bounty +10', 'gold'); }
  },
  panel(api) { return '<p>Shown in the Plugins menu.</p>'; },
});
```

**Lifecycle and game hooks:** `onInit`, `onEnable`, `onDisable`, `onExpeditionStart`, `onExpeditionEnd({summary})`, `onRoundStart({round,target})`, `onRoundEnd({won,winner})`, `onMatchEnd({result})`, `onSpawn({animal})`, `onAimStart`, `onShot({power})`, `onHit({animal,streak})`, `onMiss`, `onSubdue({animal})`, `onCatch`, `onReload`, `onDryFire`, `onGather({n})`, `onWrong`, `onBadge`, `onUi`, `onUpdate({dt,game})`, `onRenderBack({ctx,game})`, `onRenderFront({ctx,game})` (a transparent 2D overlay canvas above the WebGL view, in CSS pixels `game.W × game.H`; use `game.project(vector3)` to map a world point to the screen), `onStep({crouch})`. In the 3D engine `game.is3d === true`, and `game.scene`, `game.camera`, `game.world` (terrain height `world.h(x,z)`), `game.animals` and `game.player` are available to plugins.

**Reducers:** `modifySpawnWeight(weight, {sp})`, `modifyXp(xp, {rec, game})`, `modifyStone(stone, {game})`.

**`api` object:** `api.game` (engine: `wind`, `rain`, `night`, `animals`, `mode`, `session`, `pouch`…), `api.profile`, `api.save()`, `api.data(id)` (persistent per-plugin storage), `api.ui.toast(text, kind)`, `api.ui.menuNote(id, html)`, `api.hud.set(id, text|null)`, `api.emit(hook, payload)`.

To add a plugin, create `js/plugins/my-plugin.js` and include it in `index.html` after `js/plugins-builtin.js` and before `js/app.js`.

**Built-in plugins:** Field Weather (wind and rain, synced), Night Survey (nocturnal species ×3, +15 % XP, synced), Daily Field Assignment (one species per Singapore calendar day, +100 XP), Achievements (13 badges), Sound Design (synthesised with Web Audio, no audio files), Local Leaderboard, Marksman Streak.

## Files

```
index.html            screens, HUD, overlays
css/style.css         UI styling
js/species.js         species catalogue (taxonomy, weights, IUCN, habitat, art params)
js/wiki-fallback.js   offline Wikipedia extracts (CC BY-SA 4.0)
js/core.js            RNG, profile/levels/upgrades, Wikipedia client
js/art.js             procedural 2D portraits for cards, journal and summary
js/plugins.js         plugin registry + hook dispatch
js/plugins-builtin.js built-in plugins
js/world3d.js         3D forest: terrain, sky, fog, instanced trees/bushes/grass/rocks, lights, stone piles
js/models3d.js        procedural low-poly animal models, animation, ranger avatar
js/game3d.js          first-person engine: movement, pointer-lock look, slingshot, ballistics, AI, HUD data
js/vs.js              PeerJS networking, round targets, host judging
js/app.js             menus, record cards, journal, outfitter, VS UI
js/vendor/peerjs.min.js  PeerJS 1.5.4 (MIT)
js/vendor/three.min.js   Three.js r149 (MIT), bundled locally
```

## Credits

The encyclopedia text and photos come from Wikipedia and Wikimedia Commons under their respective licences, fetched live and attributed on each card. All artwork is drawn procedurally in code, with no third-party image or audio assets. PeerJS and Three.js are MIT-licensed.
