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
  bonus 30→300; pop bounties 3-60. The oracle's 10-tower plan wins 15/15 with 0 leaks —
  difficulty may be soft; tune round counts / kernel HP / tower cost from real play.
