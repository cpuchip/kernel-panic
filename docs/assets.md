# Asset provenance

All audio is generated on a local, license-clean pipeline (Dave's asset-harness:
ComfyUI). Deterministic seeds — rerunning a seed reproduces the asset. Art (sprites,
kitchen tileset) is the next increment; Phase 0/1 render shapes.

## Audio — SFX

Generated with **Stable Audio 3 Medium Base** — Stability AI Community License (free
commercial < $1M org revenue; we own the outputs; the stack bundles the T5Gemma text
encoder under the Gemma Terms — recorded here per the harness discipline). Post-processing:
loudnorm to −16 LUFS + silence-trim via the harness `optimize_audio.py`. Regenerate/re-roll
any clip with `scripts/gen-sfx.py` (needs the GPU-1 audio ComfyUI instance on :8189).

| File | Seed | Event |
|------|------|-------|
| `sfx/pop.ogg` | 3101 | a kernel pops |
| `sfx/bosspop.ogg` | 3102 | a cob bursts |
| `sfx/fire.ogg` | 3103 | fire tosser shoots |
| `sfx/laser.ogg` | 3104 | laser fires |
| `sfx/microwave.ogg` | 3105 | microwave pulse |
| `sfx/leak.ogg` | 3106 | a kernel reaches the bowl (life lost) |
| `sfx/roundclear.ogg` | 3107 | round cleared / campaign cleared |
| `sfx/bossin.ogg` | 3108 | a boss round begins |
| `sfx/place.ogg` | 3109 | tower placed / upgraded |
| `sfx/sell.ogg` | 3110 | tower sold |
| `sfx/start.ogg` | 3111 | round started |

Sound is user-controllable: the ⚙ settings popover toggles **sound effects** (and
**auto-start next round**), persisted per browser (`kp-sfx`, `kp-autostart`).
