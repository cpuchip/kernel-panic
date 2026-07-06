# Kernel Panic

A popcorn **tower defense** parody — single-player and multiplayer. Kernels march
the path; you pop them with heat before they overrun the kitchen. The bosses are
**cobs**. Live (soon) at **kernelpanic.cpuchip.net**.

By [cpuchip](https://cpuchip.net). Sibling of [First Orbit](https://orbit.cpuchip.net),
[Deadweight](https://deadweight.cpuchip.net), and the [chips](https://chips.cpuchip.net)
suite. A loving parody of the tower-defense genre — original names, original art, our
own code.

## The pitch

Unpopped popcorn kernels walk a path toward your bowl. You place **heat towers** —
fire, microwave, laser, and more — to pop them before they escape. Each kernel that
gets through costs a life; lose 100 and the kitchen falls. Popped kernels pay out
**butter**, which buys and upgrades towers. Survive scripted rounds, then the
**cobs** (corn on the cob — big, armored, kernel-spewing bosses) arrive.

Modes: solo campaign · co-op survival (defend one kitchen together) · last-lane-standing
(each player their own board, send extra corn at your rivals) · endless + daily-seed
leaderboards.

## Status

**Planning → Phase 0.** Design spec: [docs/design.md](docs/design.md). Roadmap:
[ROADMAP.md](ROADMAP.md).

## Architecture (planned)

The house harness, tuned for a many-entity real-time sim:

- **`shared/`** — the deterministic simulation. A fixed-timestep tick over kernels,
  towers, and projectiles; kernels follow polyline paths (position = f(distance), no
  pathfinding). Injected seeded RNG. This is the crown jewel — the whole game is a
  pure function of *(seed + the command log)*.
- **`server/`** — Node `ws`, **server-authoritative**: it runs the only sim, validates
  and orders player commands (place/upgrade/sell/send), broadcasts compact state.
  Sidesteps cross-browser float determinism entirely.
- **`src/`** — Svelte 5 + canvas client: renders the board, sends commands, interpolates
  between authoritative snapshots.
- Deploy: one container, Dokploy on push, `/version` build stamp = deploy oracle.

**Why this shape:** a score is its command log — replay it against the sim to verify.
Cheat-proof leaderboards, free replays, and a daily-seed challenge fall out for free.

## Development

*(scaffolding next — this repo is brand new)*
