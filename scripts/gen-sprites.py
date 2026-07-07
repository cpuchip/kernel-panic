"""Kernel Panic mob sprites — distinct art for all 10 enemies, generated on the
local asset-harness (Z-Image Turbo + Fun ControlNet + BiRefNet matte, Apache/MIT
chain). One carnival-cartoon STYLE anchor keeps the set coherent; a crude control
primitive locks each silhouette and the per-mob subject drives material/colour/
expression. Run with the ComfyUI venv python against the GPU-0 image instance
(:8188), then prep-kp-sprites.py crops/resizes into public/assets/sprites/.
Re-roll a mob by bumping its seed."""

import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HARNESS = ROOT / "external_context/asset-harness/2d/prototypes"
sys.path.insert(0, str(HARNESS))

from run_zimage_controlnet import (  # noqa: E402
    build_graph, compose, download, queue, upload_image, wait,
)

SERVER = "http://127.0.0.1:8188"
INPUTS = HARNESS / "inputs"
OUT = HARNESS / "outputs"

# Carnival-cartoon house style (Michael's direction), reused across the whole set
# so 10 mobs read as one family. No LoRAs — the anchor + ControlNet do the work.
STYLE = (
    "playful carnival-cartoon game sprite, bold clean black outlines, bright "
    "saturated colours, soft cel shading with a single glossy highlight, chunky "
    "rounded friendly shapes, cute expressive face, top-down slightly-forward view, "
    "centered, isolated on a plain solid white background, polished mobile-game art"
)

# (sprite name, control primitive, subject, seed). Same primitive can serve several
# mobs — the subject varies material/colour/size/mood so they still read distinct.
MOBS = [
    ("poppable", "kp_popcorn.png",
     "a small plain white popped popcorn puff, simple and innocent, tiny and cute", 4101),
    ("kernel", "kp_popcorn.png",
     "a golden-yellow popped popcorn piece, a little bigger and bolder", 4102),
    ("hard", "kp_hard.png",
     "a hard unpopped corn kernel, a smooth glossy amber tooth-shaped seed with a "
     "tough shell and a small determined frown", 4103),
    ("cob", "kp_cob.png",
     "an angry corn-on-the-cob boss lying sideways, plump yellow kernels in rows, "
     "green husk leaves as a tail, mean scowling eyes", 4104),
    ("bunch", "kp_bunch.png",
     "a bundle of three fat corn cobs tied together in a bulky cluster, tough and "
     "heavy, grumpy", 4105),
    ("ton", "kp_cob.png",
     "a giant armored corn-on-the-cob mega-boss lying sideways, thick riveted steel "
     "bands around the cob, furious glowing eyes, menacing", 4106),
    ("shiney", "kp_hard.png",
     "a shiny chrome metallic corn kernel, mirror-polished silver tooth shape with "
     "bright sparkles and a reflective sheen", 4107),
    ("bkernel", "kp_popcorn.png",
     "a glistening buttery popcorn piece dripping with glossy golden melted butter, "
     "rich and shiny, happy", 4108),
    ("bpopcorn", "kp_popcorn.png",
     "a big fluffy popcorn piece soaked and glazed in glossy golden butter, extra "
     "buttery and gleaming", 4109),
    ("bcob", "kp_cob.png",
     "a corn-on-the-cob lying sideways glazed all over in dripping golden butter, "
     "glossy rich and delicious", 4110),
]

STRENGTH = 0.85

if __name__ == "__main__":
    only = set(sys.argv[1:])  # optional: regenerate just named mobs
    client_id = uuid.uuid4().hex
    OUT.mkdir(parents=True, exist_ok=True)
    for name, control, subject, seed in MOBS:
        if only and name not in only:
            continue
        ctrl = INPUTS / control
        prompt = compose(subject, STYLE)
        print(f"[{name}] upload {ctrl.name} ...")
        control_name = upload_image(SERVER, ctrl)
        graph = build_graph(control_name, prompt, seed, STRENGTH, prefix=f"kp_mob/{name}")
        pid = queue(SERVER, graph, client_id)
        print(f"[{name}] seed {seed} pid {pid}; waiting ...")
        hist = wait(SERVER, pid)
        saved = download(SERVER, hist, OUT)
        # rename the rgba to a stable kp_<name>_rgba so prep can find it
        for p in saved:
            if "_rgba_" in p.name:
                dest = OUT / f"kp_mob_{name}_rgba.png"
                dest.write_bytes(p.read_bytes())
                print(f"[{name}] -> {dest.name}")
