"""Kernel Panic SFX set — generated on the local asset-harness (Stable Audio 3,
license-clean). Game-specific prompt set lives here; plumbing stays in the
harness (import-the-module pattern). Run with the ComfyUI venv python against the
GPU-1 audio instance (:8189); post with the harness optimize_audio.py (--lufs -16)
and copy the .ogg into public/assets/sfx/. Re-roll a clip by bumping its seed."""

import sys
from pathlib import Path

HARNESS_SFX = Path(__file__).resolve().parents[3] / "external_context/asset-harness/audio/prototypes/sfx"
sys.path.insert(0, str(HARNESS_SFX))

from generate_sfx import generate  # noqa: E402

SERVER = "http://127.0.0.1:8189"
OUT = Path(__file__).parent / "sfx_out"

SFX = [
    {"name": "pop", "seconds": 1.0, "seed": 3101, "loop": False, "lufs": -16,
     "neg": "music, melody, voice, hiss",
     "prompt": "A single crisp popcorn pop, a short sharp buttery burst with a soft airy "
               "puff tail, dry, very close perspective, ends instantly."},
    {"name": "bosspop", "seconds": 1.6, "seed": 3102, "loop": False, "lufs": -16,
     "neg": "music, voice, hiss",
     "prompt": "A big satisfying popcorn burst, a deep thick pop with a spray of smaller "
               "crackles and a puff of steam, punchy and full, dry, close perspective."},
    {"name": "fire", "seconds": 1.0, "seed": 3103, "loop": False, "lufs": -16,
     "neg": "music, voice, white noise",
     "prompt": "A short soft whoosh of a small flame dart being thrown, a quick warm "
               "airy flick, dry, close, very brief."},
    {"name": "laser", "seconds": 1.0, "seed": 3104, "loop": False, "lufs": -16,
     "neg": "music, voice, hiss",
     "prompt": "A short clean sci-fi laser zap, a bright quick electric beam pulse with a "
               "tiny sizzle, dry, close perspective."},
    {"name": "microwave", "seconds": 1.2, "seed": 3105, "loop": False, "lufs": -16,
     "neg": "music, voice, harsh hiss",
     "prompt": "A short warm microwave hum-pulse, a soft electrical ring of heat swelling "
               "and fading quickly, rounded, dry, close."},
    {"name": "leak", "seconds": 1.0, "seed": 3106, "loop": False, "lufs": -16,
     "neg": "music, melody, voice",
     "prompt": "A soft disappointing thud, a low muffled plop of something dropping into a "
               "bowl, dull and quick, dry, close perspective."},
    {"name": "roundclear", "seconds": 1.6, "seed": 3107, "loop": False, "lufs": -16,
     "neg": "voice, noise, hiss",
     "prompt": "A warm pleasant two-note chime, gentle synthetic bells rising, rounded and "
               "satisfying, clean and dry, short decay."},
    {"name": "bossin", "seconds": 1.8, "seed": 3108, "loop": False, "lufs": -16,
     "neg": "voice, hiss",
     "prompt": "A low ominous warning tone, a deep short brassy swell with a subtle rumble, "
               "tense, dry, close, foreboding."},
    {"name": "place", "seconds": 1.0, "seed": 3109, "loop": False, "lufs": -16,
     "neg": "music, voice, hiss",
     "prompt": "A soft solid click-thunk of setting a small appliance down on a counter, "
               "dry, close, very brief."},
    {"name": "sell", "seconds": 1.0, "seed": 3110, "loop": False, "lufs": -16,
     "neg": "music, voice, hiss",
     "prompt": "A short bright coin-jingle cash register blip, a quick pleasant ka-ching "
               "chirp, dry, close perspective."},
    {"name": "start", "seconds": 1.0, "seed": 3111, "loop": False, "lufs": -16,
     "neg": "voice, hiss",
     "prompt": "A short upbeat go-signal, a quick rising two-tone synth blip that says "
               "'begin', clean, dry, close."},
]

if __name__ == "__main__":
    for item in SFX:
        p = generate(SERVER, item, OUT)
        print(f"generated {item['name']} (seed {item['seed']}) -> {p}")
