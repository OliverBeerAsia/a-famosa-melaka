# A Famosa: Streets of Golden Melaka

**Melaka, 1580.** The richest port east of Goa, held by a Portuguese garrison that never has enough men, in a city where five communities trade, pray, and keep careful books about one another. A merchant's trading seal has gone missing — and depending on how you get it back, you'll learn exactly how this town really works.

A pixel-art adventure RPG in the spirit of Ultima VII: one small city, rendered dense and alive, where everyone has a name, a daily routine, and an opinion about the customs shed.

![The market on Rua Direita at mid-morning](docs/media/shot-rua-day.png)

## A city that goes about its day

Every named character keeps real hours. Aminah sets up her market stall before dawn; Padre Tomás takes the church door at his appointed times; the tally clerks work the quay until the light goes. Stand around at seven in the evening and you'll see people *walk home* — and hear a shutter run in its track, or a cloth curtain fall, depending on which quarter you're in. At night the streets empty, the lanterns come up out of phase with one another, and the watch begins his rounds.

![The same street at a quarter to ten](docs/media/shot-rua-night.png)

Chickens scatter in the kampung. Dust kicks up under foot traffic. The strait turns bronze at dusk and actually moves. Pier boards creak — not every step, about one in four, which turns out to be the difference between a sound effect and a rhythm section.

![The waterfront at dusk](docs/media/shot-waterfront-dusk.png)

## One seal, four ways to get it

Fernão Gomes has lost the seal his whole trade depends on, and Chen Wei is holding it against a 500-cruzado debt. You can talk your way through the dispute, take a side, raise the money honestly — there's paid work at the warehouse, a pepper lot going cheap, and a counting-house clerk who has noticed a discrepancy — or go to the quay after the shutter bar drops, douse a lantern or two, and mind the watchman's rounds. Getting caught costs a fine, the loot, and your standing. It doesn't end the game. The second time, it ends *that option*.

![Talking with Mak Enang in the kampung](docs/media/shot-dialogue.png)

The people you'll deal with were written as people, not quest dispensers: the healer who charges Portuguese doctors double for the remedies they call superstition, the priest whose kindness and whose theology arrive in the same breath, the guild representative who will explain — precisely — why a contract beats mercy. The year matters too. Church names, monsoon winds, currency, and the sieges everyone still remembers are period-checked, and the parts of colonial life that games usually leave out aren't left out.

![The kampung in the evening](docs/media/shot-kampung.png)

## Play it

```bash
npm install
npm run dev        # then open http://localhost:3000
```

Arrow keys or WASD to walk, **Space** to talk, take, and examine (most things examine), **I** inventory, **J** journal, **Esc** pause. A full day-night cycle runs about an hour of real time; rest to skip ahead.

## How it's made

Everything in the game — plates, sprites, portraits, UI chrome, music, ambience, sound effects — comes out of deterministic tools that live in this repo. No hand-drawn assets, no external image services. Each location is a layout file that a compositor renders into the painted plate, its walk mask, its foreground occluders, and its engine data in a single pass, so the art and the collision can never disagree. Rebuild any of it:

```bash
npm run forge:relight        # re-derive all time-of-day plate variants
npm run generate:portraits   # all 15 portraits from seeded feature libraries
npm run generate:audio       # 7 scores + ambient beds + SFX, offline-synthesized
npm run validate:all         # the gates: palette canon, byte determinism,
                             # walkability, prop scale, style rules
```

The visual rules are strict and machine-enforced: one 50-colour palette with hue-shifted ramps, one northwest sun, a 3-pixel grid shared by world, portraits, UI, and typography, zero anti-aliasing anywhere — measured against a benchmark checklist derived from the games this one is chasing (Ultima VII/VIII, Commandos, Baldur's Gate). CI fails on a single off-palette pixel.

**Stack:** Phaser 3 + React + TypeScript · Vite · vitest (400+ tests) · Electron packaging

### Repo tour

```text
assets/            generated art + audio (Git LFS)
src/data/          the world as data: locations, NPCs, schedules, quests,
                   residents, openables, the night watch
src/phaser/        engine: a thin GameScene over tested systems
                   (time, lighting, NPCs, camera, detection, atmosphere...)
src/components/    React UI on the parchment-and-brass chrome kit
tools/forge/       the art pipeline: palette canon, plate compositor,
                   kits, relighting, portraits, validators
tools/generate-audio/  offline music + ambience + SFX synthesis
docs/design/       living-world spec, 1580 historical audit, game-feel spec
```

## Where it's going

Next cycle's board: mouse input with click-to-move, enterable interiors, the customs-spine quests rebuilt to the main quest's standard, fireflies over the kampung river, and whatever the playtest notes demand. Design documents with every parameter cited live in [`docs/design/`](docs/design/); release history in [CHANGELOG.md](CHANGELOG.md) and [PROJECT_STATUS.md](PROJECT_STATUS.md).

## Credits & historical note

Design, art direction, code, music, and historical review by a team of Claude agents orchestrated in Claude Code, with live playtesting and art direction by Oliver. The 1580 grounding draws on Tomé Pires' *Suma Oriental*, Manuel Godinho de Erédia, and the scholarship of Luís Filipe Thomaz and Sanjay Subrahmanyam. Built with respect for the five communities of old Melaka; corrections from people who know this history are welcome.

*MIT licensed. Melaka's real history is longer, harder, and better than any game — go read about it.*
