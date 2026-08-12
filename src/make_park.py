#!/usr/bin/env python3
"""Generate src/park.svg — the flat 2D park skyline behind the hero.

    python3 src/make_park.py

Replaces the low-resolution aerial photo that used to sit there. Everything is drawn
in the logo's idiom: thick dark outlines, flat fills, the brand palette. The repetitive
geometry (wheel spokes, cabins, carousel stripes, swing chains) is generated rather
than hand-typed so the shapes stay exact and are easy to re-tune.

Canvas is 1600x460 and anchors to the bottom edge of the hero.
"""
import math
import pathlib

# Wide and shallow on purpose: at full hero width this renders ~250px tall, so the
# rides read as a skyline behind the headline instead of competing with it.
W, H = 2400, 560
GROUND = 322          # where the rides stand
ASPHALT = 360         # far edge of the track the kart drives down

INK = "#3a2a52"          # softer than the kart outline — this sits behind everything
SW = 7                   # outline width

TEAL = "#12aebb"
TEAL_D = "#0b8a94"
MAG = "#c53fb4"
MAG_D = "#9c2d90"
PINK = "#ff4f9d"
AMBER = "#f8a824"
AMBER_D = "#e08a0c"
CREAM = "#fff6fb"
PURPLE = "#6d2e91"
GREEN = "#57c48d"
GREEN_D = "#3da675"

out = []
add = out.append


def g(body, **attrs):
    a = " ".join(f'{k.replace("_", "-")}="{v}"' for k, v in attrs.items())
    return f"<g {a}>{body}</g>"


# ─────────────────────────────────────────────── ferris wheel
def ferris(cx, cy, r):
    p = []
    # A-frame legs first so they sit behind the wheel
    p.append(f'<path d="M{cx-6} {cy} L{cx-88} {GROUND} h30 L{cx} {cy+8} '
             f'L{cx+58} {GROUND} h30 L{cx+6} {cy} z" fill="{TEAL_D}"/>')
    p.append(f'<rect x="{cx-104}" y="{GROUND-14}" width="208" height="26" rx="13" fill="{PURPLE}"/>')
    # spokes
    n = 16
    for i in range(n):
        a = 2 * math.pi * i / n
        p.append(f'<line x1="{cx:.0f}" y1="{cy:.0f}" '
                 f'x2="{cx + r*math.cos(a):.1f}" y2="{cy + r*math.sin(a):.1f}" '
                 f'stroke="{CREAM}" stroke-width="5"/>')
    # rims
    p.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{TEAL}" stroke-width="11"/>')
    p.append(f'<circle cx="{cx}" cy="{cy}" r="{r-22}" fill="none" stroke="{TEAL}" stroke-width="7"/>')
    # cabins
    cols = [PINK, AMBER, MAG, CREAM]
    m = 12
    for i in range(m):
        a = 2 * math.pi * i / m - math.pi / 2
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        c = cols[i % len(cols)]
        p.append(f'<rect x="{x-15:.1f}" y="{y-7:.1f}" width="30" height="26" rx="11" fill="{c}"/>')
    p.append(f'<circle cx="{cx}" cy="{cy}" r="20" fill="{AMBER}"/>')
    return "".join(p)


# ─────────────────────────────────────────────── carousel
def carousel(cx, base, rw=112):
    p = []
    top = base - 190
    # canopy stripes, drawn as triangles from the apex
    seg = 10
    for i in range(seg):
        x0 = cx - rw + 2 * rw * i / seg
        x1 = cx - rw + 2 * rw * (i + 1) / seg
        c = MAG if i % 2 == 0 else CREAM
        p.append(f'<path d="M{cx} {top} L{x0:.1f} {top+68:.1f} L{x1:.1f} {top+68:.1f} z" fill="{c}"/>')
    p.append(f'<path d="M{cx} {top} L{cx-rw} {top+68} q{rw} 26 {2*rw} 0 z" '
             f'fill="none" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>')
    # scalloped hem
    p.append(f'<path d="M{cx-rw} {top+68} q{rw} 26 {2*rw} 0 l0 16 q-{rw} 26 -{2*rw} 0 z" fill="{AMBER}"/>')
    # poles + horses
    for i in (-1, 0, 1):
        x = cx + i * 62
        p.append(f'<rect x="{x-5}" y="{top+86}" width="10" height="{base-top-96}" rx="5" fill="{AMBER_D}"/>')
        p.append(f'<circle cx="{x}" cy="{top+128}" r="17" fill="{TEAL}" stroke="{INK}" stroke-width="6"/>')
    # platform
    p.append(f'<rect x="{cx-rw-8}" y="{base-22}" width="{2*rw+16}" height="26" rx="13" fill="{PURPLE}"/>')
    # mast + flag
    p.append(f'<rect x="{cx-4}" y="{top-46}" width="8" height="50" fill="{INK}"/>')
    p.append(f'<path d="M{cx+4} {top-44} l40 13 -40 13 z" fill="{PINK}" stroke="{INK}" stroke-width="5"/>')
    return "".join(p)


# ─────────────────────────────────────────────── space-tower ride
def rocket_tower(cx, base):
    p = []
    top = base - 206
    p.append(f'<rect x="{cx-11}" y="{top}" width="22" height="{base-top}" rx="9" fill="{TEAL_D}"/>')
    # lattice
    for y in range(top + 24, base - 20, 34):
        p.append(f'<path d="M{cx-11} {y} l22 22 M{cx+11} {y} l-22 22" '
                 f'stroke="{CREAM}" stroke-width="4" fill="none" opacity=".7"/>')
    # gondolas on arms
    for s in (-1, 1):
        x = cx + s * 74
        p.append(f'<path d="M{cx} {top+64} L{x} {top+82}" stroke="{TEAL_D}" stroke-width="16" '
                 f'stroke-linecap="round"/>')
        p.append(f'<path d="M{cx} {top+64} L{x} {top+82}" stroke="{INK}" stroke-width="{SW}" '
                 f'fill="none" stroke-linecap="round"/>')
        p.append(f'<path d="M{x} {top+68} c22 0 30 22 30 42 0 18 -14 30 -30 30 '
                 f's-30 -12 -30 -30 c0 -20 8 -42 30 -42 z" fill="{PINK}"/>')
        p.append(f'<circle cx="{x}" cy="{top+108}" r="10" fill="{CREAM}"/>')
    # rocket nose
    p.append(f'<path d="M{cx} {top-58} c22 22 30 46 30 66 h-60 c0 -20 8 -44 30 -66 z" fill="{AMBER}"/>')
    p.append(f'<path d="M{cx-30} {top+8} l-19 24 19 0 z M{cx+30} {top+8} l19 24 -19 0 z" fill="{MAG}"/>')
    p.append(f'<circle cx="{cx}" cy="{top-18}" r="11" fill="{TEAL}"/>')
    p.append(f'<rect x="{cx-58}" y="{GROUND-16}" width="116" height="28" rx="14" fill="{PURPLE}"/>')
    return "".join(p)


# ─────────────────────────────────────────────── chair swing
def swing(cx, base):
    p = []
    top = base - 232
    p.append(f'<rect x="{cx-10}" y="{top+34}" width="20" height="{base-top-44}" rx="8" fill="{MAG_D}"/>')
    p.append(f'<path d="M{cx} {top-16} l86 50 h-172 z" fill="{TEAL}"/>')
    p.append(f'<path d="M{cx-86} {top+34} h172 l0 14 h-172 z" fill="{AMBER}"/>')
    for i in range(5):
        x = cx - 72 + i * 36
        drop = 54 + (10 if i % 2 else 0)
        p.append(f'<line x1="{cx}" y1="{top+40}" x2="{x}" y2="{top+40+drop}" stroke="{INK}" stroke-width="4"/>')
        p.append(f'<rect x="{x-11}" y="{top+40+drop}" width="22" height="16" rx="7" '
                 f'fill="{PINK}" stroke="{INK}" stroke-width="5"/>')
    p.append(f'<rect x="{cx-48}" y="{GROUND-14}" width="96" height="26" rx="13" fill="{PURPLE}"/>')
    return "".join(p)


# ─────────────────────────────────────────────── trees
def tree(cx, base, s=1.0):
    h, k = 74 * s, s
    y = base - h
    canopy = (f"M{cx-56*k:.1f} {y:.1f} "
              f"q{-9*k:.1f} {-34*k:.1f} {24*k:.1f} {-44*k:.1f} "
              f"q{6*k:.1f} {-38*k:.1f} {32*k:.1f} {-38*k:.1f} "
              f"q{34*k:.1f} 0 {33*k:.1f} {40*k:.1f} "
              f"q{31*k:.1f} {12*k:.1f} {23*k:.1f} {42*k:.1f} z")
    return (f'<rect x="{cx-7*k:.1f}" y="{y-6*k:.1f}" width="{14*k:.1f}" height="{h+8:.1f}" '
            f'rx="{6*k:.1f}" fill="#8a5a3c"/>'
            f'<path d="{canopy}" fill="{GREEN}"/>'
            f'<path d="M{cx-56*k:.1f} {y:.1f} q{56*k:.1f} {16*k:.1f} {112*k:.1f} {-2*k:.1f}" '
            f'fill="none" stroke="{GREEN_D}" stroke-width="{7*k:.1f}" opacity=".55"/>')


# ═══════════════════════════════════════════════ compose
add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
    f'preserveAspectRatio="xMidYMax meet" class="hero-park" aria-hidden="true">')
add('<defs>'
    f'<linearGradient id="pGround" x1="0" y1="0" x2="0" y2="1">'
    f'<stop offset="0" stop-color="#7fd6a4"/><stop offset="1" stop-color="#4fb884"/>'
    f'</linearGradient>'
    f'<linearGradient id="pRoad" x1="0" y1="0" x2="0" y2="1">'
    f'<stop offset="0" stop-color="#867f9b"/><stop offset="1" stop-color="#4b4759"/>'
    f'</linearGradient>'
    '</defs>')

# far trees — the left third stays sparse, that is where the headline sits
add(g("".join(tree(x, GROUND + 6, sc) for x, sc in
      [(80, .62), (300, .55), (560, .6), (820, .52), (1050, .58), (1180, .46),
       (1560, .6), (1900, .5), (2170, .55), (2380, .62)]),
      opacity=".8"))

add(g(ferris(1330, 150, 112) + carousel(1700, GROUND, 88) +
      rocket_tower(2010, GROUND) + swing(2290, GROUND),
      stroke=INK, stroke_width=SW, stroke_linejoin="round", stroke_linecap="round"))

# near trees, in front of the ride bases
add(g("".join(tree(x, GROUND + 20, sc) for x, sc in [(420, .8), (900, .72), (1520, .68), (2120, .7)]),
      stroke=INK, stroke_width=SW, stroke_linejoin="round"))

# grass
add(f'<path d="M0 {GROUND+12} q600 -22 1200 -4 t1200 -6 V{H} H0 z" fill="url(#pGround)"/>')

# ── the track the kart is driving down, in front of everything ───────────────
ROAD = f"M-40 {H} L{W+40} {H} L{W*0.74:.0f} {ASPHALT} L{W*0.26:.0f} {ASPHALT} z"
add(f'<path d="{ROAD}" fill="url(#pRoad)"/>')
add(f'<path d="{ROAD}" fill="none" stroke="{INK}" stroke-width="6" opacity=".45"/>')
for x0, x1 in ((-40, W*0.26), (W + 40, W*0.74)):
    add(f'<path d="M{x0:.0f} {H} L{x1:.0f} {ASPHALT}" stroke="{CREAM}" stroke-width="9" opacity=".6"/>')
# dashed centre line, dashes growing as they come toward the viewer
mid, y = W / 2, ASPHALT + 6
while y < H:
    t = (y - ASPHALT) / (H - ASPHALT)
    hw = 3 + 10 * t
    add(f'<path d="M{mid-hw:.1f} {y:.1f} L{mid+hw:.1f} {y:.1f}" stroke="{CREAM}" '
        f'stroke-width="{4+8*t:.1f}" opacity=".75" stroke-linecap="round"/>')
    y += 15 + 30 * t
add('</svg>')

path = pathlib.Path(__file__).with_name("park.svg")
path.write_text("\n".join(out), encoding="utf-8")
print(f"wrote {path} ({path.stat().st_size/1024:.1f} KB)")
