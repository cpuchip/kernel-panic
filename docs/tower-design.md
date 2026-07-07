# Kernel Panic — tower update (design by Michael's son, 2026-07-06)

Transcribed from the hand-drawn "Tower Update" sheet. Each attacking tower has **three
upgrade paths** (Damage / Fire-rate / Range), two tiers each, and **you may invest in at
most 2 of the 3 paths per tower** (the Bloons crosspath rule — from the note at the bottom).

**Legend:** **SPS** = shots per second · **DPH** = damage per hit · **Bpr** = butter per
round · **Pierce** = how many mobs one shot hits (∞ = everything in the line/ring).
Range values (1.25, 1.50) read as **multipliers on the base range** (×1.25, ×1.50).

---

## Laser — cost 500 · DPH 5 · Pierce ∞ · SPS 0.5

| Path | Tier 1 | Tier 2 |
|------|--------|--------|
| Damage | Focus Lens — DPH 10, cost 500 | Death Ray — DPH 15, cost 1000 |
| Fire-rate | Faster Fire — SPS 1.0, cost 500 | Fastest Fire — SPS 2.0, cost 1000 |
| Range | Mega Range — ×1.25, cost 500 | Super Range — ×1.50, cost 1000 |

## Fire Tosser — cost 200 · DPH 1 · Pierce 1 · SPS 1

| Path | Tier 1 | Tier 2 |
|------|--------|--------|
| Damage | Hot Shot — DPH 3, cost 250 | Blazing Shot — DPH 5, cost 750 |
| Fire-rate | Quick Load — SPS 2, cost 250 | Triple Shot — SPS 3, cost 750 |
| Range | High-Power Launcher — ×1.25, cost 300 | Mega Launcher — ×1.50, cost 800 |

## Microwave — cost 750 · DPH 3 · Pierce ∞ · SPS 0.5

| Path | Tier 1 | Tier 2 |
|------|--------|--------|
| Damage | High-Power Wave — DPH 5, cost 750 | Mega Wave — DPH 10, cost 1000 |
| Fire-rate | Faster Wave — SPS 1.0, cost 1000 | Super-Fast Wave — SPS 1.50, cost 1500 |
| Range | Long Wave — ×1.25, cost 750 | Super Long Wave — ×1.50, cost 1000 |

## Butter Churner — cost 1500 · Bpr 250 (economy, no attack)

One deep path (it only does one thing — make butter):

| Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|--------|--------|--------|--------|
| More Butter — Bpr 300, cost 1000 | Even More Butter — Bpr 500, cost 1250 | More More More! — Bpr 750, cost 1500 | All The BUTTER! — Bpr 1000, cost 3000 |

---

## Answers from Michael's son (2026-07-06) — all confirmed, now BUILT

1. **The "2 paths" rule** — yes, Bloons crosspath: 3 paths, buy tiers in **at most 2**. Full
   Damage + full Fire-rate is allowed, but then Range is locked. ✅ Enforced (`maxPaths: 2`).
2. **Do 2 paths combine?** Yes — Death Ray (DPH 15) + Fastest Fire (SPS 2.0) = 15 damage twice
   a second. ✅
3. **Tiers replace, not add** — Death Ray is DPH **15 total**. ✅ *But note his design intent:*
   numeric stats (damage / range / sps / bpr) **replace** on upgrade; future **powers** (e.g.
   camo-detection sight — not built yet) will **stack**. The path model is built so powers can
   be added as a stacking layer later without touching the replace-semantics of the numbers.
4. **Range = multiplier** on base range. A second tier is the **total** (×1.50 is the whole
   thing, not ×1.25 then ×1.50). ✅ (`effRange` takes the highest `rangeMul`.)
5. **Butter Churner** — one straight 4-tier path; the "2 paths" rule doesn't apply. ✅
   (`maxPaths: 1`, one path.)
6. **"Launcher" (Fire Tosser range path)** — just range for now; a shot-changing power can come
   later. ✅
7. **New base numbers** — yes, adopt his scale; the whole game moved to it (start butter 500,
   bigger costs + bounties). ✅ (`SPEED_SCALE = 0.45` maps his relative speeds onto the board.)
8. **Base SPS** — confirmed. SPS 0.5 = one shot / 2s (slow hard-hitting Laser). ✅ (`cooldown =
   1 / sps`.)

## Round-20+ difficulty scaling (also his design, same sheet)

From **round 20 on**, difficulty compounds **+2% per round**:
- **All kernels get faster** — round 20 = ×1.02, round 21 = ×1.0404, round 22 = ×1.0612 … the
  multiplier is `1.02^(round − 19)`.
- **The cob family only** (Corn Cob / Corn Bunch / Corn Ton) **also gains HP**, same formula.
- Does **NOT** apply HP scaling to basic kernels or the buttery mobs (speed scaling is
  universal; HP scaling is cob-family-only). ✅ (`roundSpeedMul` / `roundHpMul` in `sim.ts`.)

## Status

**Built and shipped.** Each tower stores a tier **per path** (`pathLevels: number[]`); the
`upgrade` command carries a `path` index and rejects opening a 3rd path once 2 are active;
SPS→cooldown and range multipliers are wired; the tower panel shows three upgrade tracks with
pips and per-path buy buttons (the locked 3rd path dims). All numbers stay data in
`shared/sim/content.ts` — easy for the artist to tune. Oracle: `smoke.ts` proves the crosspath
gate, the stat/range math, and every scaling case (51 assertions green).
