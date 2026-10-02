"""Report the palette of a PNG: mean colour, quantised histogram, colour-block preview.

Used to answer "is the mascot white because it is white, or because something
washed it out?" — the ASCII ramp in verify.py only shows luminance, so a white
gorilla and an inverted gorilla look the same there.
"""
import sys

from verify import read_png  # reuse the decoder


def bucket(r, g, b):
    """Coarse named bucket, so the printout reads as colours rather than numbers."""
    mx = max(r, g, b)
    mn = min(r, g, b)
    if mx < 50:
        return "blk"
    if mx - mn < 26:
        if mx > 200:
            return "wht"
        if mx > 120:
            return "gry"
        return "drk"
    if g >= r and g >= b:
        return "grn"
    if r >= g and r >= b:
        return "red" if (g + b) < r else "yel"
    return "blu"


def report(path, cols=44):
    w, h, px, fmt = read_png(path)
    counts, tot, opaque = {}, [0, 0, 0], 0
    for i in range(0, len(px), 4):
        a = px[i + 3]
        if a < 24:
            continue
        r, g, b = px[i], px[i + 1], px[i + 2]
        opaque += 1
        for k, v in enumerate((r, g, b)):
            tot[k] += v
        counts[bucket(r, g, b)] = counts.get(bucket(r, g, b), 0) + 1

    print(f"\n=== {path}  {w}x{h} {fmt}")
    print(f"  opaque px: {opaque}  mean rgb: {tuple(round(v / max(opaque, 1)) for v in tot)}")
    print("  buckets: " + ", ".join(f"{k}={v * 100 // max(opaque, 1)}%" for k, v in sorted(counts.items(), key=lambda kv: -kv[1])))

    rows = max(1, round(cols * h / w / 2.4))
    print("  preview (dominant colour bucket per cell, space = transparent):")
    for ry in range(rows):
        line = ""
        for rx in range(cols):
            x = int((rx + 0.5) * w / cols)
            y = int((ry + 0.5) * h / rows)
            p = (y * w + x) * 4
            a = px[p + 3]
            if a < 24:
                line += " "
                continue
            # average the cell's 3x3 neighbourhood for stability
            rr = gg = bb = 0
            n = 0
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    xx, yy = min(w - 1, max(0, x + dx)), min(h - 1, max(0, y + dy))
                    q = (yy * w + xx) * 4
                    if px[q + 3] < 24:
                        continue
                    rr += px[q]
                    gg += px[q + 1]
                    bb += px[q + 2]
                    n += 1
            if not n:
                line += " "
                continue
            b = bucket(rr // n, gg // n, bb // n)
            line += {"blk": "#", "drk": "+", "gry": "o", "wht": ".", "grn": "G", "red": "R", "yel": "Y", "blu": "B"}[b]
        print("  |" + line + "|")


for p in sys.argv[1:]:
    report(p)
