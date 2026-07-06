# Kernel Panic — design spec

The plan. What the game is, how it plays, how it's built, and in what order. A living
document; Phase-0 decisions are firm, later phases are sketches to refine as we go.

Ratified in council 2026-07-05 (Michael's calls): name **Kernel Panic** · its own repo +
subdomain (like orbit/deadweight) · **single-player campaign slice first**.

---

## 1. What it is

A tower-defense parody in the Bloons TD lineage, popcorn-themed. Unpopped kernels walk a
fixed path; the player places heat towers that pop them for **butter** (currency); kernels
that reach the end cost **lives** (start 100); scripted **rounds** escalate to **cob**
bosses; survive to win, or chase endless high scores.

**It is a parody, not a clone.** Mechanics aren't copyrightable; names, art, and specific
content are ours. No Bloons assets, no "MOAB," no Ninja Kiwi anything. Same discipline that
turned Skyjo into Heatsink.

**Brand thread (real, not forced):** heat-pops-kernels shares DNA with Heatsink's heat
theme, and "Kernel Panic" (OS kernel / CPU / popcorn / defense-about-to-break) ties to
*games by cpuchip*. Keep the tone playful — carnival kitchen, not grimdark.

---

## 2. The theme map (parody dictionary)

| Bloons concept | Kernel Panic | Notes |
|----------------|--------------|-------|
| Balloon | **Kernel** (unpopped popcorn) | walks the path; heat pops it |
| Bloon layers (red→blue→…) | Kernel varieties | see below |
| MOAB-class boss | **Cob** (corn on the cob) | big HP, spews kernels on burst |
| Money | **Butter** | earn by popping, spend on towers |
| Lives | **Lives** (start 100) | kernel reaches the bowl → −1 (cobs cost more) |
| Monkeys / towers | **Heat towers** | fire / microwave / laser / … |
| Banana Farm | **Corn field** | passive butter generation |
| Hero | **The Chef** (or a popper-mascot) | one per game, levels up (later phase) |
| Round / wave | **Round** | scripted spawn sequence |

### Kernel varieties (the "bloon layers")

Designed so towers have counters and the player must diversify:

- **Plain** — baseline, slow, low HP.
- **Buttered** — faster; slides.
- **Husked** — **camo**: invisible to most towers until a detector reveals it.
- **Kettle** — **heat-only**: immune to physical/impact, must be melted (the lead-bloon
  parody; makes pure-projectile builds fail).
- **Caramel cluster** — high HP, on pop splits into several plain kernels (ceramic parody).
- **Kettle-cob** and up = the boss tier (below).

### Cob bosses (MOAB-class escalation)

- **COB** — first boss. Big HP, moderate speed; on destruction bursts into a fan of
  buttered kernels.
- **Buttered COB** — tankier, faster children.
- **Kettle King** — heat-gated boss; punishes physical-only defenses at scale.
- (endless) **The Whole Batch** — the BAD-tier finale, a screen-filling cob.

Boss backronyms are for flavor text, kept light (e.g. COB = "Cornucopia Of Butter").

### Towers (heat is the through-line)

Start with 3 for the slice; the rest are Phase-1 content. Each has a small **upgrade tree**
(2 paths, invest down them — the Bloons crosspath idea, simplified).

| Tower | Role | Feel |
|-------|------|------|
| **Fire tosser** | basic single-target | throws flame darts; cheap, reliable *(slice)* |
| **Microwave** | AoE pulse | periodic ring of heat; crowd control *(slice)* |
| **Laser** | piercing line | hits everything in a beam; great on straightaways *(slice)* |
| Kettle cannon | mortar | lobs hot oil to a targeted spot (hits camo? no — needs detect) |
| Hot-air popper | knockback / AoE | blows kernels back down the path |
| Butter sprayer | slow/debuff | makes kernels sticky and slow (glue/ice parody) |
| Stovetop | burn zone | lays a lingering heat tile on the path |
| Salt shaker | detector + debuff | reveals husked (camo) kernels; light damage |
| **Corn field** | economy | generates butter each round; no attack |
| The Chef (hero) | scaling unit | one per game, XP, ults (later) |

**Targeting policies** (per tower, player-selectable): First, Last, Strongest, Closest.
Classic TD; cheap to implement; adds real decisions.

---

## 3. Core loop

1. **Build phase** — place/upgrade/sell towers with butter. No timer in the campaign
   (optional timer for competitive modes).
2. **Round** — press go; the scripted wave spawns and marches. Towers auto-fire per their
   targeting policy. Pops pay butter; leaks cost lives.
3. **Between rounds** — spend butter, adjust, re-target. Corn fields pay out.
4. **Escalation** — every few rounds a heavier mix; boss rounds at milestones.
5. **End** — survive the last scripted round to **win**; hit 0 lives to **lose**. Endless
   mode continues with scaling for high scores.

---

## 4. Architecture — the deterministic sim

The single most important design decision, and the reason MP + leaderboards are cheap.

### The sim is a pure function

```
state(t) = f(seed, commandLog up to t)
```

- **Fixed timestep** (e.g. 30 ticks/s). Every tick advances kernels, runs tower targeting,
  moves/collides projectiles, resolves pops, updates butter/lives.
- **Kernels follow polyline paths**: a path is a list of points; a kernel is a distance `d`
  along it; `position = pathPointAt(d)`. No pathfinding, fully deterministic, trivially
  serializable. Multiple named paths per map enable multi-lane and competitive boards.
- **Seeded RNG** injected (mulberry32, as in chips) — any randomness (spawn jitter, crit)
  is reproducible.
- **Commands** are the only inputs: `place(towerType, tile)`, `upgrade(towerId, path)`,
  `sell(towerId)`, `setTarget(towerId, policy)`, `startRound()`, and (competitive) `send(kernelType, toPlayer)`.
  Each carries the tick it applies on.

### Oracle first (the discipline that makes autonomous iteration safe)

`shared/sim/smoke.ts` before features:

- A fixed map + fixed tower layout + fixed wave → **exact** lives-lost and butter-earned,
  every run (determinism).
- **Inverse hypothesis:** a deliberately-too-weak defense **must** leak lives; a test that
  can't fail proves nothing.
- **Replay identity:** running the recorded command log reproduces the final state
  bit-for-bit — this is *also* the leaderboard verifier and the MP correctness check.
- Entity-conservation sanity (no kernels lost/duplicated except via pop/leak).

### Multiplayer — server-authoritative, command-relayed

The server runs the **only** sim (no cross-browser float-determinism problem). Clients
render authoritative snapshots and send commands.

- **Co-op:** one shared board; all players' commands apply to it; shared lives + butter
  (or per-player butter, shared lives — a tuning call). Reuses the chips/deadweight ws
  table harness (public tables + private codes + rejoin).
- **Last-lane-standing:** the server runs one small sim per player from a **shared wave
  seed**; popping kernels charges a **send** that adds corn to a rival's lane; last lane
  alive wins. (This is the Tetris-battle mechanic; the deadweight "last corp standing"
  pattern in a new genre.)
- **Bandwidth:** hundreds of entities at ~15–20 Hz → broadcast compact deltas
  (id + quantized position) and interpolate on the client. Measure early; the sim being
  server-side means we can also send *events* (spawn/pop/leak) + let the client
  extrapolate kernel motion along the known path (it knows the polylines).

### High scores & daily seed (fall out of determinism)

A score submission is `{seed, commandLog, claimedResult}`. The server (or a canonical
headless sim) replays it; accept only if it reproduces. Daily challenge = a fixed seed for
the day; everyone's board is identical; leaderboard is honest by construction.

---

## 5. Content is data, not code

Towers, upgrades, kernels, cobs, waves, and maps are JSON/TS-data driven so content scales
without engine changes:

- `content/towers/*` — stats, upgrade trees, projectile behavior refs.
- `content/kernels/*` — HP, speed, immunities, children-on-pop.
- `content/maps/*` — path polylines, buildable tiles, art ref.
- `content/rounds/*` — per-round spawn scripts (or a generator for endless).

The engine reads data; adding a tower or map is authoring, not programming. A later phase
may add a tiny in-repo editor.

---

## 6. Juice (this genre is a juice showcase)

The pop is the payoff. Reuse the chips juice patterns + local asset harness:

- **Pop** — kernel bursts into fluffy popcorn, particle + sound; screen-space satisfying.
- Tower fire flashes, beam glow, microwave ring, boss-burst shake.
- Butter count-up, round-clear chime, life-loss thud, boss-incoming alert.
- Sound generated on the local asset-harness (Stable Audio 3 one-shots + ACE-Step bed),
  license-clean; **a settings toggle to mute** — standing rule from chips.
- `prefers-reduced-motion` respected.

Art via the asset-harness `asset-gen` skill: kernels, cobs, towers, path/kitchen tileset,
UI. Style bible TBD at the art moment (carnival-kitchen, warm, readable).

---

## 7. Roadmap (see ROADMAP.md for the running record)

- **Phase 0 — SP vertical slice.** One map, 3 towers (fire/microwave/laser) each with a
  minimal upgrade, ~3 kernel types + one COB boss, ~15 rounds, butter economy, 100 lives,
  build/round/win/lose loop, place+upgrade+target UI. **Oracle first.** Answers "is it fun?"
- **Phase 1 — juice + content.** Pop FX/SFX, more towers + real upgrade trees, more kernels,
  camo+detection, more maps/rounds, endless mode. UI via ui-craft.
- **Phase 2 — co-op MP.** Server-authoritative command relay; shared kitchen; tables.
- **Phase 3 — competitive last-lane-standing.** Per-player boards, shared seed, sends.
- **Phase 4 — leaderboards + daily seed + challenges.** Replay-verified scores.

---

## 8. Risks & disciplines (named up front)

- **Scope.** BTD6 is enormous; chasing it = never shipping. Tight slice, grow by data.
  This is the #1 risk.
- **MP determinism.** Solved by server-authoritative sim (one sim, not N browsers). Don't
  drift into client-side lockstep without a fixed-point sim.
- **Parody/IP.** Our names/art/code only. No Bloons/Ninja Kiwi assets or trademarked terms.
- **Perf at scale.** Hundreds of entities: spatial grid for tower range queries; compact
  wire encoding; measure before optimizing. The deterministic tick is the budget.
- **Balance.** Emerges from playtest; the deterministic sim makes A/B and regression tests
  possible (a saved command log is a repeatable scenario).
