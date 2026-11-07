"""Outlines "lumo" from Outfit (weight 600, SIL OFL 1.1) into wordmark.json for build_kit.py.

Run: python outfit_wordmark.py   (needs fontTools; the font is in fonts/)
"""
import json
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

FONT = Path(__file__).parent / "fonts" / "Outfit-wght.ttf"
TEXT = "lumo"
WEIGHT = 600

font = instantiateVariableFont(TTFont(FONT), {"wght": WEIGHT})
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
hmtx = font["hmtx"]
os2 = font["OS/2"]
ascender = os2.sTypoAscender

# Lay glyphs out by advance width; SVG y runs down, so flip around the ascender line.
pen = SVGPathPen(glyphs)
x = 0
bounds = []
for char in TEXT:
    name = cmap[ord(char)]
    advance, lsb = hmtx[name]
    glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, x, ascender)))
    bounds.append((x, advance))
    x += advance

# Tight horizontal extent: from the first glyph's ink to the last glyph's ink, not its side bearings.
first_lsb = hmtx[cmap[ord(TEXT[0])]][1]
last = cmap[ord(TEXT[-1])]
last_ink_right = bounds[-1][0] + font["glyf"][last].xMax
data = {
    "d": pen.getCommands(),
    "left": first_lsb,
    "right": last_ink_right,
    "top": ascender - max(font["glyf"][cmap[ord(c)]].yMax for c in TEXT),
    "baseline": ascender,
    "xHeight": os2.sxHeight,
    "unitsPerEm": font["head"].unitsPerEm,
    "font": f"Outfit {WEIGHT} (SIL OFL 1.1)",
}
out = Path(__file__).parent / "wordmark.json"
out.write_text(json.dumps(data), encoding="utf8")
print("wrote", out.name, {k: v for k, v in data.items() if k != "d"})
