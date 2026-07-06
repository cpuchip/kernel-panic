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
  ★ **balance is soft** — 3 fire tossers held 9 rounds; early rounds need to bite harder.
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
