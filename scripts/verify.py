"""Decode the generated assets and print ASCII previews + stats."""
import struct
import sys
import zlib


def read_png(path):
    data = open(path, "rb").read()
    pos, idat = 8, bytearray()
    w = h = None
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        if kind == b"IHDR":
            w, h, depth, color, _c, _f, interlace = struct.unpack(">IIBBBBB", body)
            fmt = (depth, color, interlace)
        elif kind == b"IDAT":
            idat += body
        pos += 12 + length
    raw = zlib.decompress(bytes(idat))
    stride = w * 4
    out = bytearray(w * h * 4)
    prev = bytearray(stride)
    for y in range(h):
        f = raw[y * (stride + 1)]
        line = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
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
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, out, fmt


def render(path, cols=32):
    w, h, px, fmt = read_png(path)
    rows = max(1, round(cols * h / w / 2))
    ramp = " .:-=+*#%@"
    print(f"\n=== {path}  {w}x{h} {fmt}")
    alphas = {}
    for ry in range(rows):
        line = ""
        for rx in range(cols):
            x = int((rx + 0.5) * w / cols)
            y = int((ry + 0.5) * h / rows)
            p = (y * w + x) * 4
            r, g, b, a = px[p], px[p + 1], px[p + 2], px[p + 3]
            alphas[a] = alphas.get(a, 0) + 1
            if a < 16:
                line += " "
            else:
                lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
                line += ramp[min(9, int((1 - lum) * 10))]
        print("|" + line + "|")
    top = sorted(alphas.items(), key=lambda kv: -kv[1])[:4]
    print("  top alphas:", top)


for p in sys.argv[1:]:
    render(p)
