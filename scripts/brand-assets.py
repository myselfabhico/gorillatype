"""Generate every brand asset from the mascot PNG.

No image tooling is installed here, so this decodes and re-encodes the PNGs by
hand (zlib + the five scanline filters) and does its own resampling. It writes:

  public/gorilla-logo.png     the mascot on its own, transparent (the app's logo)
  public/favicon.svg          an accent tile wrapping that logo, for browsers that take SVG
  public/favicon-*.png        the head only, on an accent tile: at 16-32px the
                              whole mascot is a smudge, the face is not
  public/favicon.ico          the same at 16/32/48, for anything that asks for /favicon.ico
  public/apple-touch-icon.png the whole mascot on an accent tile (opaque: iOS ignores alpha)
  public/icon-192.png         manifest icon, whole mascot
  public/icon-512.png         manifest icon, whole mascot
  public/icon-maskable-512.png  full-bleed square for Android's mask (no rounded corners)
  public/og-image.png         1200x630 share card: mascot on the app's dark canvas
"""

import base64
import math
import struct
import sys
import zlib

# Pass the source mascot as argv[1]; the default is where the artwork lives on
# the author's machine.
SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Administrator\Downloads\Intense Gorilla Typing Mascot.png"
ACCENT = (0x80, 0xC0, 0x50)
CANVAS = (0x22, 0x22, 0x22)


# ------------------------------------------------------------------ png codec
def read_png(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos, idat = 8, bytearray()
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        kind = data[pos + 4 : pos + 8]
        body = data[pos + 8 : pos + 8 + length]
        if kind == b"IHDR":
            w, h, depth, color, _c, _f, interlace = struct.unpack(">IIBBBBB", body)
            assert (depth, color, interlace) == (8, 6, 0), f"unexpected format {depth}/{color}/{interlace}"
        elif kind == b"IDAT":
            idat += body
        pos += 12 + length
    raw = zlib.decompress(bytes(idat))
    stride = w * 4
    out = bytearray(w * h * 4)
    prev = bytearray(stride)
    for y in range(h):
        f = raw[y * (stride + 1)]
        line = bytearray(raw[y * (stride + 1) + 1 : (y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - 4] if i >= 4 else 0
            b = prev[i]
            c = prev[i - 4] if i >= 4 else 0
            if f == 1:
                line[i] = (line[i] + a) & 0xFF
            elif f == 2:
                line[i] = (line[i] + b) & 0xFF
            elif f == 3:
                line[i] = (line[i] + (a + b) // 2) & 0xFF
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 0xFF
        out[y * stride : (y + 1) * stride] = line
        prev = line
    return w, h, out


def encode_png(w, h, px):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += px[y * w * 4 : (y + 1) * w * 4]

    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def write_png(path, w, h, px):
    open(path, "wb").write(encode_png(w, h, px))


def write_ico(path, pngs):
    """An ICO whose entries are whole PNGs — understood by every browser that still asks for /favicon.ico."""
    out = struct.pack("<HHH", 0, 1, len(pngs))
    offset = 6 + 16 * len(pngs)
    for size, png in pngs:
        out += struct.pack("<BBBBHHII", size if size < 256 else 0, size if size < 256 else 0, 0, 0, 1, 32, len(png), offset)
        offset += len(png)
    for _size, png in pngs:
        out += png
    open(path, "wb").write(out)


# ------------------------------------------------------------------ resampling
def resample(px, sw, sh, x0, y0, cw, ch, out_n):
    """Box filter the source rect [x0,y0)+(cw,ch) down to out_n x out_n, premultiplied."""
    out = bytearray(out_n * out_n * 4)
    step_x, step_y = cw / out_n, ch / out_n
    for oy in range(out_n):
        sy0, sy1 = int(math.floor(y0 + oy * step_y)), max(int(math.floor(y0 + (oy + 1) * step_y)), int(math.floor(y0 + oy * step_y)) + 1)
        for ox in range(out_n):
            sx0 = int(math.floor(x0 + ox * step_x))
            sx1 = max(int(math.floor(x0 + (ox + 1) * step_x)), sx0 + 1)
            r = g = b = a = n = 0.0
            for sy in range(sy0, sy1):
                if not 0 <= sy < sh:
                    continue
                row = sy * sw
                for sx in range(sx0, sx1):
                    if not 0 <= sx < sw:
                        continue
                    p = (row + sx) * 4
                    al = px[p + 3] / 255
                    r += px[p] * al
                    g += px[p + 1] * al
                    b += px[p + 2] * al
                    a += px[p + 3]
                    n += 1
            q = (oy * out_n + ox) * 4
            if n and a:
                alpha = a / n
                out[q] = min(255, round(r / n / (alpha / 255)))
                out[q + 1] = min(255, round(g / n / (alpha / 255)))
                out[q + 2] = min(255, round(b / n / (alpha / 255)))
                out[q + 3] = round(alpha)
    return out


def over(dst, src):
    """`src` composited over `dst`, both straight-alpha RGBA bytearrays of the same length."""
    out = bytearray(len(dst))
    for i in range(0, len(dst), 4):
        sa = src[i + 3] / 255
        da = dst[i + 3] / 255
        oa = sa + da * (1 - sa)
        for k in range(3):
            v = src[i + k] * sa + dst[i + k] * da * (1 - sa)
            out[i + k] = min(255, round(v / oa)) if oa else 0
        out[i + 3] = round(oa * 255)
    return out


def art_dim(art):
    """Side length of a square RGBA bytearray."""
    return int(round(math.sqrt(len(art) / 4)))


def rounded_tile(art, size, radius_frac=0.24, inset=0.13, bg=ACCENT):
    """`art` (a square RGBA image of any size) inset on a rounded square of the accent colour."""
    tile = bytearray(size * size * 4)
    radius = size * radius_frac
    half = size / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot(max(abs(x + 0.5 - half) - (half - radius), 0), max(abs(y + 0.5 - half) - (half - radius), 0)) - radius
            coverage = min(1.0, max(0.0, 0.5 - d))
            p = (y * size + x) * 4
            tile[p : p + 4] = bytes((*bg, round(coverage * 255)))
    inner = round(size * (1 - 2 * inset))
    src = art_dim(art)
    art_small = resample(art, src, src, 0, 0, src, src, inner)
    offset = (size - inner) // 2
    layer = bytearray(size * size * 4)
    for y in range(inner):
        for x in range(inner):
            src = (y * inner + x) * 4
            dst = ((y + offset) * size + x + offset) * 4
            layer[dst : dst + 4] = art_small[src : src + 4]
    return over(tile, layer)


def glow_card(size_w, size_h, art, art_h, bg=CANVAS, glow=ACCENT):
    card = bytearray(size_w * size_h * 4)
    for y in range(size_h):
        for x in range(size_w):
            dx = (x - size_w / 2) / (size_w / 2)
            dy = (y - size_h * 0.52) / (size_h / 2)
            strength = max(0.0, 1.0 - math.hypot(dx, dy * 1.35)) ** 2
            p = (y * size_w + x) * 4
            card[p] = min(255, round(bg[0] + (glow[0] - bg[0]) * strength * 0.22))
            card[p + 1] = min(255, round(bg[1] + (glow[1] - bg[1]) * strength * 0.22))
            card[p + 2] = min(255, round(bg[2] + (glow[2] - bg[2]) * strength * 0.22))
            card[p + 3] = 255
    small = round(art_h * 0.86)
    src = art_dim(art)
    inner = resample(art, src, src, 0, 0, src, src, small)
    ox, oy = (size_w - small) // 2, (size_h - small) // 2
    layer = bytearray(size_w * size_h * 4)
    for y in range(small):
        for x in range(small):
            src = (y * small + x) * 4
            dst = ((y + oy) * size_w + x + ox) * 4
            layer[dst : dst + 4] = inner[src : src + 4]
    return over(card, layer)


# ------------------------------------------------------------------ assets
w, h, px = read_png(SRC)
xs = [x for y in range(h) for x in range(w) if px[(y * w + x) * 4 + 3] > 8]
ys = [y for y in range(h) for x in range(w) if px[(y * w + x) * 4 + 3] > 8]
bx0, bx1, by0, by1 = min(xs), max(xs), min(ys), max(ys)
bw, bh = bx1 - bx0 + 1, by1 - by0 + 1
side = max(bw, bh) + 8
mx0, my0 = bx0 - (side - bw) // 2 - 4, by0 - (side - bh) // 2 - 4
print(f"mascot {bw}x{bh} at {bx0},{by0}; square {side}")

# Head-only square for the small icons: ears included, centred on the head.
probe = px[((by0 + round(bh * 0.18)) * w) * 4 : ((by0 + round(bh * 0.18)) * w + w) * 4]
head_x = [x for x in range(w) if probe[x * 4 + 3] > 8]
head_cx = (min(head_x) + max(head_x)) / 2
head_side = round(max((max(head_x) - min(head_x)) * 1.12, bh * 0.46))
hx0, hy0 = round(head_cx - head_side / 2), by0 - 2
print(f"head span {min(head_x)}..{max(head_x)} -> square {head_side} at {hx0},{hy0}")

logo = resample(px, w, h, mx0, my0, side, side, 512)
head = resample(px, w, h, hx0, hy0, head_side, head_side, 512)

write_png("public/gorilla-logo.png", 192, 192, resample(logo, 512, 512, 0, 0, 512, 512, 192))
print("public/gorilla-logo.png 192x192")

for size in (16, 32, 48, 96):
    write_png(f"public/favicon-{size}x{size}.png", size, size, rounded_tile(head, size, inset=0.09))
    print(f"public/favicon-{size}x{size}.png")

write_ico(
    "public/favicon.ico",
    [(s, encode_png(s, s, rounded_tile(head, s, inset=0.09))) for s in (16, 32, 48)],
)
print("public/favicon.ico 16/32/48")

for name, size in (("public/apple-touch-icon.png", 180), ("public/icon-192.png", 192), ("public/icon-512.png", 512)):
    write_png(name, size, size, rounded_tile(logo, size, inset=0.12))
    print(name)

# Android masks the launcher icon to a circle/squircle, so this one is full-bleed:
# a bare accent square with the mascot inside the 80% safe zone.
write_png("public/icon-maskable-512.png", 512, 512, rounded_tile(logo, 512, radius_frac=0.02, inset=0.2))
print("public/icon-maskable-512.png")

write_png("public/og-image.png", 1200, 630, glow_card(1200, 630, logo, 470))
print("public/og-image.png 1200x630")

# An SVG favicon for browsers that prefer vectors: it is a 96px PNG (the head on its
# accent tile) wrapped in an SVG, so it scales cleanly up to 96px and then holds.
head96 = encode_png(96, 96, rounded_tile(head, 96, inset=0.09))
b64 = base64.b64encode(head96).decode()
open("public/favicon.svg", "w", encoding="utf-8").write(
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"\n'
    '     viewBox="0 0 96 96" width="96" height="96">\n'
    '  <!-- The mascot head on the accent tile; both href spellings so older\n'
    '       renderers that only know xlink still show it. -->\n'
    f'  <image width="96" height="96" href="data:image/png;base64,{b64}"\n'
    f'         xlink:href="data:image/png;base64,{b64}"/>\n'
    "</svg>\n"
)
print("public/favicon.svg")
