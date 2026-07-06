# Kernel Panic — enemy roster (design by Michael's son, 2026-07-06)

Transcribed from the hand-drawn design sheet. This is the target enemy roster + pop-chain
for the tower/balance rework. Legend: **D** = damage dealt (lives lost when it reaches the
bowl), **Butter** = bounty on pop, **Pops into** = what spawns when it's popped (arrow
number = how many).

## The pop-chain (main line)

Each mob, when popped, becomes several of the next weaker mob — biggest on the right:

```
Corn ton ──4──▶ Corn Bunch ──4──▶ Corn cob ──4──▶ Hard kernel ──1──▶ Corn kernel ──1──▶ Poppable corn kernel ──▶ (gone)
```

## Main-chain mobs

| Mob | Rarity | Speed | HP | Butter | D | Pops into | Notes |
|-----|--------|------:|---:|-------:|--:|-----------|-------|
| Poppable corn kernel | common | 100 | 1 | 1 | 1 | — (popped) | the base mob |
| Corn kernel | common | 125 | 2 | 2 | 2 | 1× Poppable corn kernel | |
| Hard kernel | common | 150 | 3 | 3 | 3 | 1× Corn kernel | fastest small mob |
| Corn cob | common | 75 | 20 | 10 | 20 | 4× Hard kernel | first "fat" mob |
| Corn Bunch | very rare ★ | 50 | 50 | 20 | 50 | 4× Corn cob | |
| Corn ton | rarest ★★ | 25 | 100 | 50 | 100 | 4× Corn Bunch | "16 corn models" — the big boss |

## Bonus / special mobs (off the main chain)

| Mob | Rarity | Speed | HP | Butter | D | Pops into | Notes |
|-----|--------|------:|---:|-------:|--:|-----------|-------|
| Shiney kernel | rare ◆ | 100 | 5 | 10 | 5 | 1× Corn kernel | **resistant to laser** (the shiny coat bounces the beam) |
| Buttery corn kernel | rarest ★★ | 500 | 8 | **1,000** | 0 | — | butter piñata, harmless but very fast |
| Buttery pop corn | rarest ★★ | 750 | 12 | **2,500** | 0 | — | fastest mob; huge reward |
| Buttery corn cob | rarest ★★ | 500 | 50 | **10,000** | 0 | — | jackpot; must catch before it escapes |

## Rarity legend

`○` common · `◆` rare · `★` very rare · `★★` rarest

## Design reads worth noting

- **Speed inverts with size on the small end:** Hard kernel (150) is faster than Corn kernel
  (125) faster than Poppable (100) — so each pop makes the children *slower*, the opposite of
  the fat mobs. The big three are slow (Corn cob 75 → Bunch 50 → ton 25).
- **The Buttery trio deal 0 damage** — they can't kill you, they're pure butter jackpots that
  rush past fast; the tension is catching them for the reward before they reach the bowl.
- **Shiney Kernel resists laser** — a tower-interaction property (like a lead bloon): the
  shiny coat bounces the beam, so you need fire or microwave for it. Worth giving another mob
  a different resistance later so no single tower is a catch-all.

## Ambiguities to confirm with the artist

1. **Shiney kernel → what, exactly?** The drawn arrow curves up into the chain; I used your
   spoken example (shiny → 1 Corn kernel). Is it Corn kernel, or Hard kernel?
2. **Buttery mobs — do they pop into anything, or just die for the butter?** They show D:0 and
   no pop arrow, so I read them as "pop → nothing, just pay out." Confirm?
3. **Buttery corn cob speed** — 500 or 600? (hard to read)

## Status: BUILT (2026-07-06)

The full 10-mob roster is live in `shared/sim/content.ts` — pop-chains, `resistLaser` on
Corn Bunch, and the leak-0 buttery trio. Towers gained a **second upgrade tier** each
(base → tier 1 → tier 2) with damage scaled to the new HP curve. Oracle proves it's
winnable with a maxed defense (reaches round 18 with lives intact) and that a lazy 2-tower
defense loses by round 5.

**One engine dial:** the sheet's speeds (25–750) are relative; the sim multiplies them by
**`SPEED_SCALE = 0.45`** (in `types.ts`) so mobs are catchable on this board. Change that one
number to make the whole game faster/slower without touching the roster.

**Tunable balance knobs** (all data — edit and the oracle re-checks): per-mob stats here →
`content.ts KERNELS`; tower damage/cost/tiers → `content.ts TOWERS`; round spawn counts →
`content.ts ROUNDS`; economy → `START_BUTTER` + round `bonus` values + `SPEED_SCALE`.

**Art note:** the 10 mobs currently share the 4 existing sprites (poppable/kernel/hard =
plain popcorn; cob/bunch/ton/buttery-cob = the cob sprite, sized by radius; shiney/buttery =
buttered/caramel). Distinct art per mob (a 3-cob Corn Bunch, a giant Corn Ton, a sparkly
Shiney, golden Buttery ones) is a follow-up art pass.
