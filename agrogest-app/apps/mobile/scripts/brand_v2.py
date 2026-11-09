"""Exporta a marca V2 do original aprovado. Uso: python scripts/brand_v2.py.

Requer Pillow. Remove o fundo branco recuperando a cobertura antialias a
partir das duas cores originais; não redesenha o boi nem a tipografia.
As gerações ImageGen anteriores ficam preservadas em imagegen-drafts/.
"""
import json
from pathlib import Path
from shutil import copy2

from PIL import Image, ImageDraw, ImageFont

MOBILE = Path(__file__).resolve().parent.parent
BRAND = MOBILE / "assets/branding/v2"
IMAGES = MOBILE / "assets/images/v2"
GREEN = (12, 80, 47)
ORANGE = (255, 111, 30)
WHITE = (255, 255, 255)


def extract(source):
    """Inverte a composição cor * alpha + branco * (1 - alpha)."""
    out = Image.new("RGBA", source.size)
    pixels = []
    for rgb in source.convert("RGB").getdata():
        candidates = []
        for color in (GREEN, ORANGE):
            direction = tuple(255 - c for c in color)
            alpha = sum((255 - p) * d for p, d in zip(rgb, direction)) / sum(d * d for d in direction)
            alpha = max(0, min(1, alpha))
            error = sum((p - (255 - alpha * d)) ** 2 for p, d in zip(rgb, direction))
            candidates.append((error, color, alpha))
        _, color, alpha = min(candidates, key=lambda item: item[0])
        # Descarta somente resíduos quase brancos do raster original.
        pixels.append((*color, round(alpha * 255) if alpha >= 0.015 else 0))
    out.putdata(pixels)
    return out


def trim(image):
    box = image.getchannel("A").getbbox()
    if box is None:
        raise ValueError("Marca vazia")
    return image.crop(box)


def dark(image):
    out = image.copy()
    out.putdata([(*WHITE, a) if (r, g, b) == GREEN else (r, g, b, a) for r, g, b, a in image.getdata()])
    return out


def fit(image, width=None, height=None):
    ratio = width / image.width if width is not None else height / image.height
    return image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)


def center(size, image, background=(0, 0, 0, 0)):
    canvas = Image.new("RGBA", (size, size), background)
    canvas.alpha_composite(image, ((size - image.width) // 2, (size - image.height) // 2))
    return canvas


def save(image, path):
    # Arquiva a geração bruta uma única vez antes da primeira finalização.
    if path.exists() and not (BRAND / "dimensions.json").exists():
        draft = path.parent / "imagegen-drafts" / path.name
        draft.parent.mkdir(parents=True, exist_ok=True)
        if not draft.exists():
            copy2(path, draft)
    image.save(path, optimize=True)


def main():
    BRAND.mkdir(parents=True, exist_ok=True)
    IMAGES.mkdir(parents=True, exist_ok=True)
    source = Image.open(BRAND / "reference-logo.png")
    if source.size != (299, 274):
        raise ValueError("Os recortes são específicos para o original aprovado de 299x274")
    clean = extract(source)
    mark = trim(clean.crop((0, 0, 299, 220)))
    word = trim(clean.crop((0, 220, 299, 274)))
    dimensions = {}
    variants = {}
    for theme in ("light", "dark"):
        m, w = (mark, word) if theme == "light" else (dark(mark), dark(word))
        m = fit(m, height=540)
        w = fit(w, height=184)
        logo = Image.new("RGBA", (m.width + 40 + w.width, m.height))
        logo.alpha_composite(m)
        logo.alpha_composite(w, (m.width + 40, (m.height - w.height) // 2))
        for name, asset in (("logo", logo), ("mark", m), ("wordmark", w)):
            save(asset, BRAND / f"{name}-{theme}-v2.png")
            dimensions[name] = {"width": asset.width, "height": asset.height, "ratio": asset.width / asset.height}
            variants[f"{name}-{theme}"] = asset
        save(m, IMAGES / ("splash-icon-v2.png" if theme == "light" else "splash-icon-dark-v2.png"))

    # O símbolo inteiro fica na área segura central de 52% do ícone adaptativo.
    dark_mark = dark(mark)
    icon_mark = fit(dark_mark, height=660)
    icon = center(1024, icon_mark, (*GREEN, 255)).convert("RGB")
    save(icon, IMAGES / "icon-v2.png")
    save(icon.resize((48, 48), Image.Resampling.LANCZOS), IMAGES / "favicon-v2.png")
    adaptive = fit(dark_mark, width=520)
    if adaptive.height > 520:
        adaptive = fit(dark_mark, height=520)
    save(center(1024, adaptive), IMAGES / "android-icon-foreground-v2.png")
    save(Image.new("RGB", (1024, 1024), GREEN), IMAGES / "android-icon-background-v2.png")
    mono = Image.new("RGBA", adaptive.size, WHITE)
    mono.putalpha(adaptive.getchannel("A"))
    save(center(1024, mono), IMAGES / "android-icon-monochrome-v2.png")
    (BRAND / "dimensions.json").write_text(json.dumps(dimensions, indent=2) + "\n", encoding="utf-8")

    # Prancha de inspeção: seis variantes de marca e sete assets de plataforma.
    sheet = Image.new("RGB", (1200, 1680), "#EAEDEB")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 20)
    except OSError:
        font = ImageFont.load_default()
    assets = [(name, asset) for name, asset in variants.items()]
    assets += [(path.stem, Image.open(path).convert("RGBA")) for path in sorted(IMAGES.glob("*-v2.png"))]
    for index, (name, asset) in enumerate(assets):
        x, y = (index % 2) * 600, (index // 2) * 240
        bg = "#000000" if "dark" in name or "monochrome" in name or "foreground" in name else "#FFFFFF"
        draw.rectangle((x + 12, y + 12, x + 588, y + 228), fill=bg)
        preview = asset.copy()
        preview.thumbnail((530, 154), Image.Resampling.LANCZOS)
        sheet.paste(preview, (x + (600 - preview.width) // 2, y + 46 + (154 - preview.height) // 2), preview)
        draw.text((x + 24, y + 20), name, font=font, fill="white" if bg == "#000000" else GREEN)
    sheet.save(BRAND / "preview-v2.jpg", quality=95)
    print(json.dumps(dimensions, indent=2))
    print("13 assets V2 exportados; preview-v2.jpg atualizado.")


if __name__ == "__main__":
    main()
