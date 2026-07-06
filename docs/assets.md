# Asset provenance

All art + audio is generated on a local, license-clean pipeline (Dave's asset-harness:
ComfyUI). Deterministic seeds — rerunning a seed reproduces the asset.

## Art — sprites (Z-Image Turbo + ControlNet + BiRefNet, Apache-2.0/MIT chain)

Playful carnival-cartoon direction (Michael's call). One style anchor reused across the
set; crude control primitives (`make_kp_primitives.py`, `make_kp_popcorn.py`) lock the
layout, the prompt does the art. Cropped/resized into `public/assets/sprites/` by
`prep_kp_sprites.py`. The renderer falls back to shapes if a sprite is missing.

| File | Seed | What |
|------|------|------|
| `sprites/plain.png` | 4021 | plain popcorn kernel (re-rolled — v1 seed 4001 read as fruit) |
| `sprites/buttered.png` | 4022 | buttered popcorn kernel |
| `sprites/caramel.png` | 4023 | caramel-cluster kernel |
| `sprites/cob.png` | 4004 | the COB boss (angry corn-on-the-cob; faces right, render rotates to heading) |
| `sprites/fire.png` | 4005 | Fire Tosser (flaming red toaster) |
| `sprites/microwave.png` | 4006 | Microwave |
| `sprites/laser.png` | 4007 | Laser (ray-gun appliance) |
| `sprites/churn.png` | 4008 | Butter Churn |

Re-roll any sprite: `make_kp_primitives.py`/`make_kp_popcorn.py` for the control image,
then `run_zimage_controlnet.py` (GPU-0 image ComfyUI on :8188), then `prep_kp_sprites.py`.

## Audio — SFX

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
