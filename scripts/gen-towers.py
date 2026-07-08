"""Kernel Panic tower sprites — the three new towers from the son's Tower Update
(Freeze Ray, Butter Turret, Popcorn Machine). Same local harness + carnival house
style as the mobs (gen-sprites.py) and the four existing towers (P1b), so the whole
board reads as one family. One tower STYLE anchor + a crude appliance primitive per
tower (make_kp_primitives.py). Run against the GPU image instance (:8188), then
prep_kp_sprites.py crops/resizes into public/assets/sprites/. Re-roll by bumping seed."""

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

# Tower house style — the appliance cousin of the mob anchor (gen-sprites.py):
# a friendly toy machine, not a mob (no face). Kept close so towers + kernels
# read as one carnival set.
STYLE = (
    "playful carnival-cartoon game sprite, a chunky rounded kitchen gadget machine, "
    "bold clean black outlines, bright saturated colours, soft cel shading with a "
    "single glossy highlight, friendly toy-like appliance, slight three-quarter "
    "top-down view, centered, isolated on a plain solid white background, polished "
    "mobile-game art"
)

# (tower id, control primitive, subject, seed). Seeds continue the tower series
# (fire 4005 / microwave 4006 / laser 4007 / churn 4008 → new towers 4009-4011).
TOWERS = [
    ("freeze", "kp_freeze.png",
     "a friendly frost cannon painted icy pale-blue, a rounded pressure tank with a "
     "wide funnel nozzle blasting a puff of white snow and frost crystals, a little "
     "snowflake decal, cold and frosty", 4009),
    ("butter", "kp_butter.png",
     "a chunky golden butter turret, a fat buttery-yellow tub with a short wide spout "
     "nozzle dripping glossy melted butter and a little pump handle on top, warm and "
     "rich", 4010),
    ("popcorn", "kp_popmachine.png",
     "a classic red-and-white striped popcorn cart machine with a clear glass kettle "
     "dome brimming with fluffy popcorn spilling over the top, a cheerful carnival "
     "snack machine on little legs", 4011),
]

STRENGTH = 0.85

if __name__ == "__main__":
    only = set(sys.argv[1:])  # optional: regenerate just named towers
    client_id = uuid.uuid4().hex
    OUT.mkdir(parents=True, exist_ok=True)
    for name, control, subject, seed in TOWERS:
        if only and name not in only:
            continue
        ctrl = INPUTS / control
        prompt = compose(subject, STYLE)
        print(f"[{name}] upload {ctrl.name} ...")
        control_name = upload_image(SERVER, ctrl)
        graph = build_graph(control_name, prompt, seed, STRENGTH, prefix=f"kp_{name}")
        pid = queue(SERVER, graph, client_id)
        print(f"[{name}] seed {seed} pid {pid}; waiting ...")
        hist = wait(SERVER, pid)
        saved = download(SERVER, hist, OUT)
        for p in saved:
            if "_rgba_" in p.name:
                print(f"[{name}] -> {p.name}")
