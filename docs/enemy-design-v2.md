# Kernel Panic — Enemy Roster v2 + BTD6 Round System (RATIFIED)

**Status: RATIFIED 2026-07-07 — cleared to build.** Michael's son handed over a big new
"corn mod" chart that ~doubles the roster and asks us to **copy the BTD6 round system up to
round 100**. This document transcribes his chart, maps it onto the Bloons lineage it's
modeled on, and — as of 2026-07-07 — records Michael + son's decisions on every open
question. The **Ratified Decisions** section (was Open Questions) is now the build spec.

> **Filed for the NEXT update (Michael's notes):**
> - **Freezing + bombs** — new tower types + the matching enemy resistances. The freeze/bomb
>   *resistances* below are **latent** (recorded, but do nothing until those towers exist).
>   Only **laser resistance** is live today.
> - **A Butter Churn upgrade that grants LIVES** — since a leaked mob is instant-death (per
>   Bloons), the churn will get a path/tier that gives back lives. Not this update.

Legend from his sheet: **D = damage dealt** = lives lost if that mob leaks into the bowl ·
**amount spawned = when popped** (the arrow numbers) · rarity **○ common · ◇ rare · ★ very
rare · ★★ rarest** · **rtL** = resists laser · **rYF** = resists freeze · **rtB** = resists
bomb.

---

## 1. The roster (21 mobs)

Speeds are his relative "×" units (same scale as today — `SPEED_SCALE` maps them onto the
board). ✅ = read cleanly off the chart · ⚠️ = I'm unsure, see Open Questions.

### Basic pop-chain (common)
| Mob | Speed | HP | Butter | D (leak) | Pops into | Notes |
|-----|------:|---:|-------:|---------:|-----------|-------|
| Poppable Corn Kernel | 100 | 1 | 1 | 1 | — (gone) | exists today |
| Corn Kernel | 125 | 1 | 1 | 2 | 1 Poppable | HP 1 ratified (Bloons layers; was 2) |
| Hard Kernel | 150 | 1 | 1 | 3 | 1 Corn Kernel | exists today |

### Rush kernels (fast, glass-cannon — cheap to pop, hurt a lot if they leak)
| Mob | Speed | HP | Butter | D (leak) | Pops into |
|-----|------:|---:|-------:|---------:|-----------|
| Kettle Corn | 200 | 1 | 1 | **4** | — |
| Candy Corn | 250 | 1 | 1 | **5** | — |

### Immunity kernels (the BTD "colour bloon" port)
| Mob | Speed | HP | Butter | D | Pops into | Resists |
|-----|------:|---:|-------:|--:|-----------|---------|
| Black Kernel | 150 | 1 | 1 | 6 | — | **Bomb** |
| White Kernel | 150 | 1 | 1 | 6 | — | **Freeze** |
| Black-and-White Kernel *(Zebra)* | 175 | 1 | 1 | 7 | 1 Black **+** 1 White ✅ | **Bomb + Freeze** |
| Purple Kernel | 200 | 1 | 1 | 7 | — | **Laser + Freeze** |
| Melted Kernel | 100 | 5 | 1 | 7 | — ⚠️ | **Laser** |
| Rainbow Kernel | 200 | 1 | 1 | 8 | 2 Zebra? ⚠️ | none? ⚠️ |
| Super Hard Kernel *(Ceramic)* | 200 | 10 | 1 | 9 | 2 Rainbow? ⚠️ | none? ⚠️ |
| Shiney Kernel *(exists today)* | 100 | 5 | 10 | 5 | 1 Corn Kernel | **Laser** |

### Cob bosses (the MOAB-class)
| Mob | Speed | HP | Butter | D (leak) | Pops into | BTD analogue |
|-----|------:|-----:|-------:|---------:|-----------|--------------|
| Corn Cob | 75 | 200 | 0 | 616 | 4 Super Hard? ⚠️ | MOAB |
| Corn Bunch | 50 | 1400 | 0 | 3064 | 4 Corn Cob ✅ | BFB |
| Corn Ton | 25 | 4000 | 0 | 16656 | 4 Corn Bunch ✅ | ZOMG |
| Quick Cob | 200 | 400 | 0 | 816 | 4 Super Hard? ⚠️ | DDT (fast) |
| **Big Corn of Doom** | 25 | 20000 | 0 | 55760 | 2 Corn Ton **+** 3 Quick Cob? ⚠️ | BAD |

*(His note by Corn Ton — "16 corn nodles" — reads as a description: a Ton is 16 cobs deep
(4 Bunch × 4 Cob), not a separate spawn. Flagged below.)*

### Buttery reward trio (exists today — leak 0, huge butter payout)
| Mob | Speed | HP | Butter | D |
|-----|------:|---:|-------:|--:|
| Buttery Corn Kernel | 500 | 8 | 1,000 | 0 |
| Buttery Popcorn | 750 | 12 | 2,500 | 0 |
| Buttery Corn Cob | 500 | 50 | 10,000 | 0 |

---

## 2. The pop tree (biggest → smallest)

This is the spine of BTD, and his "4/2/1" arrows trace most of it. **Bold** edges are
labelled on his chart; *italic* edges are what I've inferred from BTD6 and need confirming:

```
Big Corn of Doom ─▶ 2 Corn Ton  +  3 Quick Cob        (arrows show "2" and "3")
Corn Ton         ─▶ 4 Corn Bunch                       (labelled 4)
Corn Bunch       ─▶ 4 Corn Cob                         (labelled 4)
Corn Cob         ─▶ 4 Super Hard                       (labelled 4; target inferred)
Quick Cob        ─▶ 4 Super Hard  (camo/fast)          (inferred)
Super Hard       ─▶ 2 Rainbow                          (inferred, BTD ceramic→2 rainbow)
Rainbow          ─▶ 2 Zebra                            (inferred, BTD rainbow→2 zebra)
Zebra            ─▶ 1 Black + 1 White                  (labelled 1 & 2)
Black / White    ─▶ (nothing — they're the bottom of the colour chain)
Hard Kernel      ─▶ 1 Corn Kernel ─▶ 1 Poppable ─▶ gone
Kettle / Candy / Purple / Melted ─▶ nothing (standalone rush/immunity)
```

The **D (leak) numbers are RBE** — each tier's D is roughly its children summed, exactly
like Bloons' Red-Bloon-Equivalent. That's faithful and cool, but it collides with our life
total (see Q4).

---

## 3. Resistance / immunity matrix

What each mob shrugs off. **Only the Laser column matters today**; Freeze and Bomb light up
when those towers ship next update.

| Mob | Laser (live) | Freeze (next) | Bomb (next) |
|-----|:---:|:---:|:---:|
| Shiney Kernel | ✅ | | |
| Melted Kernel | ✅ | | |
| Black Kernel | | | ✅ |
| White Kernel | | ✅ | |
| Zebra (Black-and-White) | | ✅ | ✅ |
| Purple Kernel | ✅ | ✅ | |
| Rainbow / Super Hard | | | |

Rainbow and Super Hard have **no immunities** (ratified) — just fast / high-HP, like Bloons.

---

## 4. The BTD6 round system (rounds 1–100)

He wrote **"can you copy the btd6 round system."** BTD6 is 1–100 then freeplay, with a very
specific escalation: reds/blues early, the first ceramics ~R28, first MOAB **R40**, BFB
**R60**, ZOMG **R80–85**, DDTs ~R90+, and a **BAD at R100**. Immunity bloons phase in at set
rounds (blacks/whites ~R12, zebras ~R17, rainbows ~R27, etc.).

**My recommendation — build a 100-round table in the BTD6 *spirit*, not a byte-copy.**
Ninja Kiwi's exact per-round bloon table is their proprietary data; copying the numbers
verbatim is both legally muddier for a public parody and a giant manual transcription. But
the *structure* — escalating rounds, immunity types entering at thresholds, MOAB-class
bosses at 40/60/80/100 — is a genre convention we can absolutely honour with our own corn
mobs. It'll also be **tunable data** (`ROUNDS[]`), same as today, and the oracle will hold
"winnable to R100."

Milestone map I'd propose (⚠️ all for ratification):

| Round band | What appears | Boss |
|-----------|--------------|------|
| 1–10 | Poppable → Corn Kernel → Hard | — |
| 11–20 | + Kettle/Candy rush, first Black/White | — |
| 21–30 | + Zebra, Purple, Melted, Rainbow | — |
| 31–39 | + Super Hard (ceramic-tier) | — |
| **40** | first **Corn Cob** (MOAB) | Corn Cob |
| 41–59 | Corn Cobs + immunity mixes | — |
| **60** | first **Corn Bunch** (BFB) | Corn Bunch |
| 61–79 | Bunches + Quick Cobs (camo/fast) | — |
| **80** | first **Corn Ton** (ZOMG) | Corn Ton |
| 81–99 | Tons + Quick Cob swarms | — |
| **100** | **Big Corn of Doom** (BAD) | Big Corn of Doom |
| 101+ | Free Play (endless, the existing generator, scaled) | escalating |

I'd draft the full 100-round table **after** you ratify (a) the roster + stats, (b) the pop
tree, and (c) copy-in-spirit vs. exact-numbers — no point authoring 100 rounds against
numbers that might change.

---

## 5. Ratified Decisions (2026-07-07, Michael + son)

1. **Corn Kernel HP = 1.** Follow Bloons — every basic kernel is one layer, one hit. (Was 2.)
2. **Pop tree = the standard Bloons lineage** (§2). All the inferred edges are confirmed:
   Corn Cob → 4 Super Hard, Super Hard → 2 Rainbow, Rainbow → 2 Zebra, Zebra → 1 Black + 1
   White, Quick Cob → 4 Super Hard, **Big Corn of Doom → 2 Corn Ton + 3 Quick Cob**.
3. **"16 corn nodles"** = descriptive (a Corn Ton is 16 cobs deep: 4 Bunch × 4 Cob). Not a
   separate spawn.
4. **★ Leak = instant game over, Bloons-style.** A mob that reaches the bowl costs its full D
   in lives; with 100 lives, letting a big cob through ends the run. *(Filed for next update: a
   Butter Churn upgrade that grants lives back — see the header note.)* So `leak = D` per mob.
5. **Rarity = a label, all set to 1.** No spawn-weighting from rarity; what appears each round
   is driven by the round system (like Bloons), not random rolls.
6. **Rainbow & Super Hard have no immunities** — just fast / high-HP (like Bloons rainbow +
   ceramic).
7. **Quick Cob = fast-only for now.** A fast, low-HP cob. Camo (BTD's DDT trait) comes later
   as a tower *detection* power — the stacking-upgrade hook from the tower sheet.
8. **Round system = the BTD6 *structure*, our own numbers, and it FLOWS.** Boss rounds fixed
   (Corn Cob R40, Corn Bunch R60, Corn Ton R80, Big Corn of Doom R100); the rounds in between
   are **procedurally generated** so nobody hand-authors 100 rounds — a generator ramps mob
   types and counts in smoothly as the round climbs (see §4). Not a byte-copy of NK's table.
9. **Butter economy for 100 rounds** — mine to tune during balancing once the roster's in;
   the Butter Bank/Boost churn paths likely become essential. (Not a blocker.)

**Cleared to build.** This supersedes the 20-wave chart. Build order: roster + immunities
(laser live, freeze/bomb latent) → the procedural 100-round generator (boss rounds pinned) →
distinct art per new mob (Quick Cob + Big Corn of Doom take **his drawings as the reference**,
per his request) → oracle "winnable to R100" → balance the butter curve.
