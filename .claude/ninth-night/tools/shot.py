"""Capture the vfx lab headlessly and crop it so the detail survives.

Whatever reads the PNG back downscales it to about 280 pixels wide. A
1120x580 canvas seen at 280 is a quarter scale, and at quarter scale a
rhyme pip is two pixels of mud and a frost crust is nothing at all. So a
crop wider than 280 is a crop you cannot actually see. Every preset here
is 280 wide or narrower and is written at 1:1 for that reason.

  python .claude/ninth-night/tools/shot.py <name> "<query string>" [crop]

crop is a preset name, or "x,y,w,h", or "full" for the whole frame as a
composition check. Presets are anchored on the canvas, which sits at 0,0
in this page with a caption strip under it.
"""
import os
import subprocess
import sys

from PIL import Image

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SHOTS = os.path.join(ROOT, ".claude", "shots")
PORT = os.environ.get("NNPORT", "8677")
LAB = "http://localhost:%s/.claude/ninth-night/tools/vfx-lab.html" % PORT

CROPS = {
    "full": None,
    "ring": (440, 180, 280, 170),        # the foe ring around the player, dead centre
    "centre": (440, 200, 280, 160),      # where the player stands and the slam lands
    "west": (330, 200, 280, 160),        # the two foes on the left of the ring
    "east": (600, 190, 280, 170),        # the two foes on the right of the ring
    "pips": (440, 190, 280, 110),        # head height: stacks, hp bars, status
    "slam": (420, 210, 280, 150),        # the screen word
    "hud": (0, 470, 280, 110),           # breath, echo, the hand
    "rhymes": (280, 470, 280, 110),      # the rhyme pips on the bar
}


def main():
    name = sys.argv[1]
    qs = sys.argv[2] if len(sys.argv) > 2 else ""
    crop = sys.argv[3] if len(sys.argv) > 3 else "full"
    os.makedirs(SHOTS, exist_ok=True)
    raw = os.path.join(SHOTS, name + ".png")
    url = LAB + "?dev=ninth" + ("&" + qs if qs else "")
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
        "--hide-scrollbars", "--window-size=1120,600",
        "--virtual-time-budget=9000", "--screenshot=" + raw, url,
    ], check=True, capture_output=True)
    im = Image.open(raw)
    if crop != "full":
        if "," in crop:
            x, y, w, h = [int(v) for v in crop.split(",")]
        else:
            x, y, w, h = CROPS[crop]
        im = im.crop((x, y, x + w, y + h))
        raw = os.path.join(SHOTS, name + "-" + crop.replace(",", "_") + ".png")
        im.save(raw)
    print(raw, im.size)


main()
