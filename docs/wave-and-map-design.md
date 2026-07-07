# Kernel Panic — waves & maps (design by Michael's son, 2026-07-06)

Two hand-drawn sheets, transcribed. The counts and map shapes are HIS; spawn timing,
clear bonuses, and the exact polyline points are tuned/interpreted and stay as data.

## Wave chart (waves 1-20, then Free Play)

His abbreviations map straight onto the roster (`docs/enemy-design.md`):
PCk = Poppable Corn Kernel · CK = Corn Kernel · HK = Hard Kernel · CC = Corn Cob ·
cb = Corn Bunch · ct = Corn Ton · SK = Shiney Kernel · BCk = Buttery Corn Kernel ·
BPc = Buttery Popcorn · Bcc = Buttery Corn Cob.

| Wave | Composition | Wave | Composition |
|------|-------------|------|-------------|
| 1 | PCk 10 | 11 | BCk 1, PCk 25, CK 20, HK 15 |
| 2 | PCk 20 | 12 | SK 10, HK 15, CK 20 |
| 3 | PCk 25, CK 5 | 13 | HK 25, CK 40, PCk 60 |
| 4 | PCk 30, CK 10 | 14 | PCk 100 |
| 5 | BCk 1, HK 3, PCk 15 | 15 | CC 1 |
| 6 | PCk 20, CK 15, HK 10 | 16 | CC 1, HK 20, CK 25 |
| 7 | HK 20 | 17 | CC 2 |
| 8 | PCk 50 | 18 | CK 100 |
| 9 | SK 5 | 19 | CC 3 |
| 10 | CK 50 | 20 | cb 1, BPc 1 |

**After wave 20 → Free Play** (the endless generator keeps escalating deterministically
from the seed; round-20+ difficulty scaling also kicks in — speed +2%/round for all mobs,
HP +2%/round for the cob family only).

Every mob pops into a chain of children, so a single Corn Cob is really 4 Hard = a dozen+
small kernels — the counts are smaller than they play. `ROUNDS` in `shared/sim/content.ts`.

## New maps (4)

His sheet drew four kitchens. Each is a polyline the kernels walk (position = f(distance),
no pathfinding); the map is part of the deterministic config, so MP + replay scores are
unaffected by which one you play. The classic serpentine is kept as a fifth. Points live in
`shared/sim/maps.ts`; the map picker shows an SVG preview of each.

- **Twisty** — a tight switchback staircase, entering left and winding down-right. Lots of
  corners to catch mobs.
- **Corn Meadow** — enters top-center, meanders through the field with a small rectangular
  loop, wanders out the left.
- **Loop-de-doop** — a genuine loop-de-loop: the path spears down and coils one full
  descending turn so the ring overlaps and the line crosses itself, then drops out the
  bottom. (Computed from sin/cos so the coil is smooth.)
- **Triangle Chaos** — sharp acute switchbacks crisscrossing the board in a sawtooth,
  entering top and tearing out the bottom-left. The hardest to defend — bring range.

The point arrays capture the CHARACTER of each drawing and are easy to re-shape.
