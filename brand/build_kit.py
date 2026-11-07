"""Builds the Lumo logo kit SVGs into ./kit. Run: python build_kit.py

The firefly (top view) is built from circles, ellipses and arc bands only, so every piece is a filled shape:
no strokes, text, filters or masks.
"""
import math
from pathlib import Path

OUT = Path(__file__).parent / "kit"
OUT.mkdir(exist_ok=True)

NAVY = "#12304a"
GLOW = "#5cc8ff"
HALO = "#d6f1ff"
WING = "#9fb8cc"
# Reversed (dark background): the body turns light, the halo becomes a deep blue so the glow still pops.
DARK_BG = "#0d1b26"
DARK_BODY = "#cfe6f5"
DARK_WING = "#4d6b82"
DARK_HALO = "#16405e"


def antenna(cx, cy, r, a0, a1, w):
    """A filled arc band with round ends: the antenna as a shape, not a stroke. Angles in degrees, SVG coords."""
    ro, ri = r + w / 2, r - w / 2
    p = lambda rad, a: (cx + rad * math.cos(math.radians(a)), cy + rad * math.sin(math.radians(a)))
    large = 1 if abs(a1 - a0) > 180 else 0
    sweep = 1 if a1 > a0 else 0
    (ox0, oy0), (ox1, oy1) = p(ro, a0), p(ro, a1)
    (ix0, iy0), (ix1, iy1) = p(ri, a0), p(ri, a1)
    c = w / 2
    return (f"M{ox0:.2f},{oy0:.2f}A{ro:.2f},{ro:.2f} 0 {large} {sweep} {ox1:.2f},{oy1:.2f}"
            f"A{c:.2f},{c:.2f} 0 0 {sweep} {ix1:.2f},{iy1:.2f}"
            f"A{ri:.2f},{ri:.2f} 0 {large} {1 - sweep} {ix0:.2f},{iy0:.2f}"
            f"A{c:.2f},{c:.2f} 0 0 {sweep} {ox0:.2f},{oy0:.2f}Z")


def firefly(body, glow, halo, wing, small=False):
    """The final top-view firefly. `small` thickens antennae and drops the halo detail for 16-32 px."""
    aw = 12 if small else 8
    antennae = (antenna(84, 66, 34, -10, -64, aw) + antenna(172, 66, 34, 190, 244, aw))
    parts = []
    if halo:
        parts.append(f'<circle cx="128" cy="166" r="{66 if small else 70}" fill="{halo}"/>')
    parts += [
        f'<ellipse cx="128" cy="168" rx="{38 if small else 34}" ry="{50 if small else 48}" fill="{glow}"/>',
        f'<ellipse cx="99" cy="114" rx="{19 if small else 16}" ry="46" transform="rotate(38 99 114)" fill="{wing}"/>',
        f'<ellipse cx="157" cy="114" rx="{19 if small else 16}" ry="46" transform="rotate(-38 157 114)" fill="{wing}"/>',
        f'<ellipse cx="128" cy="112" rx="25" ry="23" fill="{body}"/>',
        f'<circle cx="128" cy="80" r="{19 if small else 17}" fill="{body}"/>',
        f'<path fill="{body}" d="{antennae}"/>',
    ]
    return "".join(parts)


def mono_firefly(color):
    """One colour: overlapping parts in one evenodd path, so where wings cross the glow they cut out
    and the firefly keeps its internal structure without a second colour."""
    def ellipse(cx, cy, rx, ry, rot=0):
        # Two arcs between the ends of the rotated x axis: 2 anchors instead of a polygon.
        r = math.radians(rot)
        dx, dy = rx * math.cos(r), rx * math.sin(r)
        return (f"M{cx - dx:.2f},{cy - dy:.2f}A{rx},{ry} {rot} 1 0 {cx + dx:.2f},{cy + dy:.2f}"
                f"A{rx},{ry} {rot} 1 0 {cx - dx:.2f},{cy - dy:.2f}Z")

    # The halo becomes a ring; with evenodd, the wings crossing it cut out, which keeps both readable.
    ring = ellipse(128, 166, 70, 70) + ellipse(128, 166, 61, 61)
    wings = ellipse(99, 114, 16, 46, 38) + ellipse(157, 114, 16, 46, -38)
    body = ellipse(128, 168, 34, 48) + ellipse(128, 112, 25, 23) + ellipse(128, 80, 17, 17)
    antennae = antenna(84, 66, 34, -10, -64, 8) + antenna(172, 66, 34, 190, 244, 8)
    return (f'<path fill="{color}" fill-rule="evenodd" d="{ring}{wings}"/>'
            f'<path fill="{color}" d="{body}{antennae}"/>')


# Wordmark "lumo": Outfit 600 (SIL OFL 1.1) outlined into wordmark.json by outfit_wordmark.py, so the logo
# files never need the font installed. Coordinates are font units (1000/em), cropped to the ink.
import json

WM = json.loads((Path(__file__).parent / "wordmark.json").read_text(encoding="utf8"))
WM_W = WM["right"] - WM["left"]
WM_H = WM["baseline"] - WM["top"]


def wordmark(ink):
    return f'<path fill="{ink}" transform="translate({-WM["left"]} {-WM["top"]})" d="{WM["d"]}"/>'


def placed(ink, x, y, scale):
    return f'<g transform="translate({x:.1f} {y:.1f}) scale({scale:.5f})">{wordmark(ink)}</g>'


def svg(w, h, body, title, bg=None):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><title>{title}</title>{rect}{body}</svg>\n'


def write(name, content):
    (OUT / name).write_text(content, encoding="utf8")


write("lumo-symbol.svg", svg(256, 256, firefly(NAVY, GLOW, HALO, WING), "Lumo"))
write("lumo-symbol-small.svg", svg(256, 256, firefly(NAVY, GLOW, HALO, WING, small=True), "Lumo"))
write("lumo-symbol-dark.svg", svg(256, 256, firefly(DARK_BODY, GLOW, DARK_HALO, DARK_WING), "Lumo", DARK_BG))
write("lumo-symbol-dark-transparent.svg", svg(256, 256, firefly(DARK_BODY, GLOW, DARK_HALO, DARK_WING), "Lumo"))

write("lumo-wordmark.svg", svg(WM_W, WM_H, wordmark(NAVY), "lumo"))
write("lumo-wordmark-dark.svg", svg(WM_W, WM_H, wordmark(DARK_BODY), "lumo", DARK_BG))

# Horizontal lockup: the wordmark's ascender-to-baseline height is 150 next to the 256 symbol, with its
# baseline level with the bottom of the glowing abdomen so the word sits on the light.
H_SCALE = 150 / WM_H
H_X, H_Y = 262, 216 - 150
H_W = round(H_X + WM_W * H_SCALE + 20)
write("lumo-horizontal.svg", svg(H_W, 256, firefly(NAVY, GLOW, HALO, WING) + placed(NAVY, H_X, H_Y, H_SCALE), "Lumo"))
write("lumo-horizontal-dark.svg", svg(H_W, 256, firefly(DARK_BODY, GLOW, DARK_HALO, DARK_WING) + placed(DARK_BODY, H_X, H_Y, H_SCALE), "Lumo", DARK_BG))

# Stacked lockup: symbol centred above the wordmark, word slightly narrower than the symbol's halo.
S_SCALE = 210 / WM_W
S_W = 288
S_H = round(256 + 6 + WM_H * S_SCALE + 16)
stacked = (f'<g transform="translate({(S_W - 256) / 2:.1f} 0)">{firefly(NAVY, GLOW, HALO, WING)}</g>'
           + placed(NAVY, (S_W - WM_W * S_SCALE) / 2, 262, S_SCALE))
write("lumo-stacked.svg", svg(S_W, S_H, stacked, "Lumo"))

# One-colour symbols and lockups from the ring drawing (an automatic colour flatten would turn the halo into a disc).
for label, color in (("black", "#000000"), ("white", "#ffffff"), ("navy", NAVY)):
    write(f"lumo-symbol-{label}.svg", svg(256, 256, mono_firefly(color), "Lumo"))
    write(f"lumo-horizontal-{label}.svg", svg(H_W, 256, mono_firefly(color) + placed(color, H_X, H_Y, H_SCALE), "Lumo"))

# App icon: the full-colour firefly on a pale-blue rounded tile. The maskable version keeps the bug inside
# the central 80% safe zone that Android crops to.
TILE, TILE_HALO = "#e6f6ff", "#c4e9ff"
icon = (f'<rect width="256" height="256" rx="56" fill="{TILE}"/>'
        f'<g transform="translate(128 132) scale(0.86) translate(-128 -140)">{firefly(NAVY, GLOW, TILE_HALO, WING)}</g>')
write("lumo-app-icon.svg", svg(256, 256, icon, "Lumo"))
maskable = (f'<rect width="256" height="256" fill="{TILE}"/>'
            f'<g transform="translate(128 132) scale(0.66) translate(-128 -140)">{firefly(NAVY, GLOW, TILE_HALO, WING)}</g>')
write("lumo-app-icon-maskable.svg", svg(256, 256, maskable, "Lumo"))
print("kit written:", sorted(p.name for p in OUT.glob("*.svg")))
