"""Gera as variantes do logo, o ícone e o splash a partir do logo horizontal do legado.

Uso (na pasta apps/mobile): python scripts/brand.py   (requer Pillow)
"""
import os
from pathlib import Path

from PIL import Image

MOBILE = Path(__file__).resolve().parent.parent
SRC = MOBILE.parent.parent.parent / "old-agrogest/public/agrogest-header-logo.png"
APP = MOBILE / "assets"
OUT = f"{APP}/branding"
GREEN = (12, 80, 47)  # #0C502F, verde da marca
os.makedirs(OUT, exist_ok=True)

src = Image.open(SRC).convert("RGBA")
W, H = src.size
sp = src.load()

def is_neutral(r, g, b):
    mx, mn = max(r, g, b), min(r, g, b)
    return mx == 0 or (mx - mn) / mx < 0.25

def build(part, neutral_to=None):
    out = Image.new("RGBA", src.size)
    po = out.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = sp[x, y]
            if a == 0:
                continue
            in_word = x >= 286 and y <= 200
            if part == "mark" and in_word or part == "word" and not in_word:
                continue
            po[x, y] = (*neutral_to, a) if neutral_to and is_neutral(r, g, b) else (r, g, b, a)
    return out

def trim(img, pad=0):
    l, t, r, b = img.getbbox()
    return img.crop((l - pad, t - pad, r + pad, b + pad))

variants = {
    "logo-dark": build("all"),
    "logo-light": build("all", GREEN),
    "mark-dark": build("mark"),
    "mark-light": build("mark", GREEN),
    "wordmark-dark": build("word"),
    "wordmark-light": build("word", GREEN),
}
for name, img in variants.items():
    t = trim(img, 2)
    t.save(f"{OUT}/{name}.png")
    print(name, t.size)

# Ícone: vaca branca + laranja sobre o verde da marca.
mark_dark = trim(variants["mark-dark"])
def fit(img, width):
    ratio = width / img.width
    return img.resize((width, round(img.height * ratio)), Image.LANCZOS)

def centered(canvas_size, img, bg=(0, 0, 0, 0)):
    canvas = Image.new("RGBA", (canvas_size, canvas_size), bg)
    canvas.alpha_composite(img, ((canvas_size - img.width) // 2, (canvas_size - img.height) // 2))
    return canvas

icon = centered(1024, fit(mark_dark, 660), (*GREEN, 255))
icon.convert("RGB").save(f"{APP}/images/icon.png")
centered(1024, fit(mark_dark, 520)).save(f"{APP}/images/android-icon-foreground.png")
Image.new("RGBA", (1024, 1024), (*GREEN, 255)).save(f"{APP}/images/android-icon-background.png")
mono = fit(mark_dark, 520)
white = Image.new("RGBA", mono.size, (255, 255, 255, 0))
white.putalpha(mono.getchannel("A"))
mono = white
centered(1024, mono).save(f"{APP}/images/android-icon-monochrome.png")
icon.resize((48, 48), Image.LANCZOS).save(f"{APP}/images/favicon.png")
# Splash nativo: só a vaca (o splash animado do app completa a marca).
trim(variants["mark-light"], 2).save(f"{APP}/images/splash-icon.png")
trim(variants["mark-dark"], 2).save(f"{APP}/images/splash-icon-dark.png")
