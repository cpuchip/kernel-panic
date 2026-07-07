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

## Questions for the artist (before we build it)

1. **The "2 paths" rule** — confirm it works like Bloons: each attacking tower has 3 paths
   (Damage / Fire-rate / Range) and you can buy tiers in **at most 2 of the 3**. So you could
   go full Damage + full Fire-rate, but then *not* touch Range. Right?
2. **Do 2 paths combine?** e.g. a Laser with Death Ray (DPH 15) **and** Fastest Fire (SPS 2.0)
   = 15 damage twice a second. Yes?
3. **Tiers replace, not add** — Death Ray is DPH **15 total** (not 10 + 15). Right?
4. **Range = multiplier?** ×1.25 then ×1.50 on the base range (not absolute). Right? (And does
   a second tier stack, ×1.25 then ×1.50, or is ×1.50 the total?)
5. **Butter Churner** — one straight 4-tier path (250 → 300 → 500 → 750 → 1000)? And since it
   has only one path, the "2 paths" rule doesn't apply to it, correct?
6. **"Launcher" (Fire Tosser range path)** — is that *just* more range, or does "Mega Launcher"
   also change the shot (lob it / small splash)? The name made me wonder.
7. **New base numbers** — your tower costs/damage are bigger than the current game (Laser 500
   vs 320, DPH 5 vs 2, etc.) and match your enemy chart's big bounties. Adopting this chart
   means moving the **whole game to your number scale** (bigger costs, bigger butter). Good?
8. **Base SPS** — the engine uses "cooldown" internally; SPS 0.5 = one shot every 2 seconds.
   Just confirming that's the intent (Laser is a slow, hard-hitting sniper; Fire Tosser at
   SPS 1 is one shot/second).

## How it'd slot into the game

The current towers have a single line of 2 upgrades. This is a bigger, better system — the
proper crosspath tree. Implementing it means: each tower stores a level **per path** (Damage
0–2 / Rate 0–2 / Range 0–2) with the "at most 2 paths" rule enforced; SPS→cooldown and range
multipliers wired in; the tower panel shows three little upgrade tracks. All the numbers stay
data (easy to tune). It's a chunk of work but it's the heart of a good tower-defense game.
