# Kernel Panic — roadmap & record

The record of the drive. Newest state at the top.

## Now

- **2026-07-05 — Phase 0 SHIPPED + LIVE** at kernelpanic.cpuchip.net. Playable
  single-player slice: deterministic sim + 23-assertion oracle, one snake map, fire/
  microwave/laser towers + butter churn, plain/buttered/caramel kernels + the COB boss,
  15 rounds, butter economy, 100 lives, place/upgrade/sell/target UI, 1-3× speed + pause,
  win/lose. Browser-verified (towers pop marching kernels, economy + rounds advance).
  Next: Phase 1 (juice — pop FX/SFX + art via the asset harness — and more content).

## Phases

- **Phase 0 — SP vertical slice** ✅ **DONE 2026-07-05**: deterministic sim + oracle,
  one map / 3 towers (fire·microwave·laser) + butter churn / 3 kernels + COB / 15 rounds /
  butter / 100 lives / build·round·win·lose / place·upgrade·sell·target UI. The fun is real.
- **Phase 1a — playtest punch list + pop-juice** ✅ **DONE 2026-07-05** (Michael + son
  playing): **endless freeplay** past round 15 (deterministic `getRound` escalation, best-
  round score, no more "won" terminal) · **auto-start setting** + **early-start bonus**
  (decays over the build window, shown on the button as `+N🧈`) · **cobs face their
  heading** · **near-square 640×640 map** (4-run serpentine — fills phones) · **responsive
  layout** (HUD wraps, nothing clips, full-width Start on mobile, floating tower panel) ·
  **11 pop SFX** generated on the asset-harness + ⚙ settings mute. Oracle 32 assertions.
- **Phase 1b — sprite art + sound-hardening + balance** ✅ **DONE 2026-07-05** (Michael +
  son, 2nd feedback): **carnival-cartoon sprite set** (8 sprites on the asset-harness —
  popcorn kernels, the angry-cob boss, toaster/microwave/ray-gun/churn towers; shape
  fallback; cob rotates to heading) · **audio HARDENED** (they heard nothing on their
  phone; desktop pipeline verified healthy so it's a hardening not a confirmed fix — retry
  unlock every gesture until 'running', self-heal suspended ctx, louder gains) · **balance**
  (Butter Churn 400→525 / income 80→36 — his call it was too cheap + flooded; start butter
  320→270, early rounds +~40% count and ~12% faster; a lazy 2-tower defense now loses at
  round 10). Oracle 33.
- **Phase 1c — new enemy roster + tower tiers** ✅ **DONE 2026-07-06** (design by Michael's
  son, `docs/enemy-design.md`): the **10-mob roster** — main pop-chain (Corn Ton →4 Bunch
  →4 Cob →4 Hard →1 Kernel →1 Poppable) + bonus mobs (Shiney →1 Kernel; the leak-0 Buttery
  trio worth 1k/2.5k/10k butter). **Shiney Kernel resists laser.** Each tower gained a **2nd
  upgrade tier** with damage scaled to the ~1000-HP Corn Ton chain. `SPEED_SCALE=0.45` maps
  the sheet's relative speeds onto the board; economy retuned (start 500, bonuses up) so
  it's winnable. Oracle 37. NEXT: distinct art per new mob; more play-tuning.
- **Phase 1d — crosspath upgrade trees + endless difficulty scaling** ✅ **DONE 2026-07-06**
  (design by Michael's son, `docs/tower-design.md`): the full **Bloons crosspath** system —
  each attacking tower has **3 paths** (Damage / Fire-rate / Range), 2 tiers each, and you may
  invest in **at most 2** (`maxPaths`). Tiers **replace** the stat (future *powers* like camo
  sight will stack — model built for it); range tiers multiply base range; Butter Churn keeps
  its one deep 4-tier path. Tower panel now shows three upgrade tracks with pips; the locked
  3rd path dims. **Round-20+ scaling:** all kernels' speed compounds +2%/round (`1.02^(r−19)`),
  and the **cob family only** (Cob/Bunch/Ton) also gains HP the same way — basic and buttery
  mobs get no HP scaling. Oracle 37→51 (crosspath gate, stat/range math, every scaling case);
  browser-verified (place → open 2 paths → 3rd locks). NEXT: distinct art per new mob;
  play-tuning; churn 2nd-path ideas (Butter Bank / Butter Boost aura).
- **Phase 1e — 4 new maps + map-select, 20-wave chart, Butter Churn crosspath** ✅ **DONE
  2026-07-06** (two more of his sheets, `docs/wave-and-map-design.md`): **four new maps** —
  Twisty (switchback staircase), Corn Meadow (meander + loop), **Loop-de-doop** (a genuine
  self-crossing loop-de-loop), Triangle Chaos (sharp sawtooth) — plus the Classic serpentine,
  behind a **map picker** with SVG path previews. Map is part of the deterministic config
  (`SimState.mapId`), so MP/replay is unaffected. **Wave chart rewritten to his exact 20 waves**
  (then Free Play). **Butter Churn is now a 3-path crosspath** (pick 2): flat income + **Butter
  Bank** (interest on held butter, capped 50%) + **Butter Boost** (aura tips nearby towers extra
  butter/pop; ring shows when selected). Oracle 51→78 (every map valid/walkable/buildable, bank
  interest, boost aura, 20-wave winnable to r22). Browser-verified: picker + loop-de-doop renders
  and kernels traverse the crossing live. NEXT: distinct art per mob; play-tuning; per-map
  economy balance.
- **Phase 1 — juice + content**: pop FX/SFX (asset-harness), upgrade trees, more
  kernels (camo+detect, kettle), more maps/rounds, endless. ui-craft polish.
- **Phase 2 — co-op MP**: server-authoritative command relay, shared kitchen, tables.
- **Phase 3 — competitive last-lane-standing**: per-player boards, shared seed, sends.
- **Phase 4 — leaderboards + daily seed + challenges**: replay-verified scores.

## Decisions log

- 2026-07-05: **Kernel Panic** (over Poppers / Maize Runner / Butter Battalion).
- 2026-07-05: own repo `cpuchip/kernel-panic` + `kernelpanic.cpuchip.net` (not a chips game).
- 2026-07-05: SP campaign slice is the v1 north star (over co-op-first / endless-first).
- 2026-07-05: MP will be **server-authoritative** (one sim), not client lockstep.
- 2026-07-05: currency **butter**; passive-income tower **Butter Churn** (was "corn field"
  — you fight corn, you don't farm it; Michael's catch).

## Balance notes (for playtest)

- Start: 100 lives, 320 butter. Towers 100/250/320/400; one upgrade each. Round-clear
  bonus 30→300; pop bounties 3-60. **Confirmed soft in play (2026-07-05):** 3 fire tossers
  held to round 9 losing only one cob's worth of lives. Early rounds (1-7) are trivially
  easy — raise early kernel counts/speed or cut starting butter so the first cob actually
  threatens. Endless escalation exists but ramps gently. Next-increment tuning job.
