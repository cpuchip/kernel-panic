# Kernel Panic — Enemy Roster v2 + BTD6 Round System (FOR RATIFICATION)

**Status: DRAFT — not built yet.** Michael's son handed over a big new "corn mod" chart
(2026-07-07) that ~triples the roster and asks us to **copy the BTD6 round system up to
round 100**. This document transcribes his chart into tables, maps it onto the Bloons
lineage it's clearly modeled on, and flags every place I'm guessing so you two can ratify
before I build anything. Michael flagged this one as "long, you may need help from us" —
the **Open Questions** at the bottom are where I need that help.

> **Next update (his note):** we'll add **freezing** and **bombs** (tower types + the
> matching enemy resistances). So the freeze/bomb *resistances* below are **latent** — I'd
> record them now but they do nothing until those towers exist. Only **laser resistance** is
> live today.

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
| Corn Kernel | 125 | 1 ⚠️ | 1 | 2 | 1 Poppable | today it's HP 2 — chart looks like HP 1 |
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
| Rainbow / Super Hard | ⚠️ ? | ⚠️ ? | ⚠️ ? |

In BTD, rainbow and ceramic aren't immune to anything — just fast/tanky. I've assumed the
same (no immunities) unless you tell me otherwise.

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

## 5. Open Questions (need you + your son)

1. **Corn Kernel HP** — chart looks like **HP 1**; today it's HP 2. Which is right?
2. **Pop tree, the inferred edges** — confirm: Corn Cob → 4 Super Hard? Super Hard → 2
   Rainbow? Rainbow → 2 Zebra? Quick Cob → 4 Super Hard? And **Big Corn of Doom → 2 Corn Ton
   + 3 Quick Cob**? (I read "2" and "3" arrows on it.)
3. **"16 corn nodles"** on Corn Ton — descriptive (it's 16 cobs deep), or does a Ton pop into
   16 of something directly?
4. **★ The big one — what does D (leak) actually cost?** His D is cumulative RBE (a Corn Cob
   = 616). With 100 lives, one unpopped cob leaking = instant loss. Options: **(a)** raise
   lives way up, BTD-style (hundreds/thousands); **(b)** a leaked mob only costs a small
   *body* value and its children still spill out and have to be dealt with; **(c)** D is just
   the informational RBE and real leak cost is smaller. Which model do you want?
5. **Rarity (○/◇/★/★★)** — does rarity drive how often a mob shows up (spawn weighting in
   freeplay), or is it just a label for now?
6. **Rainbow & Super Hard immunities** — any? (BTD: none — just fast/tanky.)
7. **Quick Cob = camo?** In BTD the DDT is camo (only some towers see it). We don't have
   camo/detection yet — treat Quick Cob as just a fast low-HP cob for now, add camo with a
   detection upgrade later? (This is the "powers stack" hook from the tower sheet.)
8. **Round system** — copy the BTD6 **structure** with our own numbers (my rec), or do you
   want me to reproduce BTD6's exact per-round counts?
9. **Butter economy at 100 rounds** — the current economy is tuned for 20 waves. A 100-round
   game needs a re-tuned butter curve (and probably the Butter Bank/Boost churn paths become
   essential). I'll handle that in balancing once the roster's locked — just flagging it.

Once ratified, this becomes `enemy-design-v2.md` (canonical) and supersedes the 20-wave
chart; I'll build the roster + the 100-round table + new art per new mob, oracle-gated.
