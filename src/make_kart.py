#!/usr/bin/env python3
"""Generate the hero kart as three depth layers.

    python3 src/make_kart.py

Angular rather than rounded, dark carbon body with the brand colours used as racing
accents, fat slicks on five-spoke rims, splitter and endplated rear wing. The outline
idiom still matches the logo, but the forms are wedges, not bubbles.

Emits kart-back.svg / kart-mid.svg / kart-front.svg, which the page stacks on the same
viewBox at different translateZ. At rest each layer is scale-compensated so the kart
looks exactly as drawn; once it starts driving toward the viewer the layers separate at
different rates and the thing reads as a solid object rather than a sticker.

Gradient ids carry a per-layer suffix — all three SVGs live in one document, and
duplicate ids would silently collapse to whichever came first.

#kartSpeed lives on the back layer; the stylesheet animates those streaks.
"""
import math
import pathlib

W, H = 800, 470
CX = 400                       # everything mirrors about this axis

INK = "#14161f"
BODY_HI = "#3d4661"
BODY_LO = "#161a27"
CARBON = "#242b3d"
CARBON_HI = "#333c54"
TEAL = "#17c4d2"
MAG = "#d244c0"
AMBER = "#ffb020"
RED = "#ff2d46"
RIM = "#ccd5ea"
RIM_D = "#79849c"
VISOR = "#0a0d16"

LAYERS = {"back": [], "mid": [], "front": []}
LAYER = "back"          # whichever layer add() is currently filling


def add(markup):
    LAYERS[LAYER].append(markup)


def layer(name):
    global LAYER
    LAYER = name


def mirror(d):
    """Mirror an absolute-coordinate path about CX by negating the x of every pair."""
    return f'<g transform="translate({2*CX} 0) scale(-1 1)">{d}</g>'


# ─────────────────────────────────────────────── wheels
def wheel(cx, cy, rx, ry, hub, accent):
    """Fat slick on a five-spoke rim. Drawn round, then squashed to the ellipse."""
    k = ry / rx
    p = [f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#gTyre)"/>']
    # sidewall lettering groove
    p.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-9}" ry="{ry-9}" fill="none" '
             f'stroke="#2a3040" stroke-width="4"/>')
    spokes = []
    for i in range(5):
        a = math.radians(-90 + i * 72)
        for s in (-1, 1):
            a2 = a + s * math.radians(11)
            spokes.append(f'{hub*0.34*math.cos(a2):.1f} {hub*0.34*math.sin(a2):.1f}')
        spokes.append(f'{hub*math.cos(a):.1f} {hub*math.sin(a):.1f}')
    path = []
    for i in range(5):
        a = math.radians(-90 + i * 72)
        x0, y0 = hub * 0.26 * math.cos(a - .34), hub * 0.26 * math.sin(a - .34)
        x1, y1 = hub * 0.98 * math.cos(a - .13), hub * 0.98 * math.sin(a - .13)
        x2, y2 = hub * 0.98 * math.cos(a + .13), hub * 0.98 * math.sin(a + .13)
        x3, y3 = hub * 0.26 * math.cos(a + .34), hub * 0.26 * math.sin(a + .34)
        path.append(f'M{x0:.1f} {y0:.1f} L{x1:.1f} {y1:.1f} L{x2:.1f} {y2:.1f} L{x3:.1f} {y3:.1f} z')
    p.append(f'<g transform="translate({cx} {cy}) scale(1 {k:.3f})">'
             f'<circle r="{hub+7}" fill="{RIM_D}"/>'
             f'<circle r="{hub+2}" fill="{accent}"/>'
             f'<path d="{" ".join(path)}" fill="{RIM}" stroke="{INK}" stroke-width="4" '
             f'stroke-linejoin="round"/>'
             f'<circle r="{hub*0.24:.1f}" fill="{RIM_D}" stroke="{INK}" stroke-width="4"/>'
             f'</g>')
    return "".join(p)


# ═══════════════════════════════════════════════ compose
DEFS = f'''<defs>
<linearGradient id="gBody" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="{BODY_HI}"/><stop offset="1" stop-color="{BODY_LO}"/>
</linearGradient>
<linearGradient id="gPod" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="{CARBON_HI}"/><stop offset="1" stop-color="{BODY_LO}"/>
</linearGradient>
<linearGradient id="gNose" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="{CARBON}"/><stop offset="1" stop-color="#0f121c"/>
</linearGradient>
<radialGradient id="gTyre" cx=".36" cy=".26" r=".92">
  <stop offset="0" stop-color="#454c61"/><stop offset="1" stop-color="#101219"/>
</radialGradient>
<linearGradient id="gVisor" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#2b3552"/><stop offset="1" stop-color="{VISOR}"/>
</linearGradient>
<radialGradient id="gShadow" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#150c22" stop-opacity=".5"/>
  <stop offset="1" stop-color="#150c22" stop-opacity="0"/>
</radialGradient>
<linearGradient id="gHeat" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="{AMBER}"/><stop offset="1" stop-color="{RED}"/>
</linearGradient>
</defs>'''

S = f'stroke="{INK}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"'

# ── back layer: everything the driver sits in front of ───────────────────────
layer("back")
add(f'<ellipse cx="{CX}" cy="424" rx="322" ry="40" fill="url(#gShadow)"/>')
add(f'<g {S}>')

# ── rear wing ────────────────────────────────────────────────────────────────
add(f'<path d="M240 144 L560 144 L552 180 L248 180 z" fill="{MAG}"/>')
add(f'<path d="M240 144 L560 144 L558 156 L242 156 z" fill="#e46ad4" stroke="none"/>')
for s in (-1, 1):
    x = CX + s * 156
    add(f'<path d="M{x-16} 120 L{x+14} 126 L{x+10} 206 L{x-20} 200 z" fill="{CARBON}"/>')
    add(f'<path d="M{x-12} 164 L{x+10} 168 L{x+9} 180 L{x-13} 176 z" fill="{TEAL}" stroke="none"/>')
add(f'<rect x="352" y="176" width="18" height="62" fill="{CARBON}"/>')
add(f'<rect x="430" y="176" width="18" height="62" fill="{CARBON}"/>')

# ── rear wheels ──────────────────────────────────────────────────────────────
add(wheel(120, 286, 54, 62, 26, AMBER))
add(wheel(680, 286, 54, 62, 26, AMBER))

add('</g>')

# ── mid layer: driver, pods, chassis ─────────────────────────────────────────
layer("mid")
add(f'<g {S}>')

# ── driver ───────────────────────────────────────────────────────────────────
add(f'<path d="M400 196 L474 214 L492 256 L308 256 L326 214 z" fill="{RED}"/>')
add(f'<path d="M336 230 L464 230 L470 248 L330 248 z" fill="#c01326" stroke="none"/>')
add(f'<path d="M400 100 L450 118 L460 166 L442 194 L358 194 L340 166 L350 118 z" fill="#eef2ff"/>')
add(f'<path d="M400 100 L450 118 L455 142 L345 142 L350 118 z" fill="{TEAL}"/>')
add(f'<path d="M354 150 L446 150 L440 180 L360 180 z" fill="url(#gVisor)"/>')
add(f'<path d="M366 158 L432 158 L428 166 L370 166 z" fill="#5f7bb8" stroke="none" opacity=".8"/>')

# ── side pods ────────────────────────────────────────────────────────────────
pod = ('<path d="M232 262 L326 244 L334 348 L246 340 L220 302 z" fill="url(#gPod)"/>'
       '<path d="M244 292 L318 282 L320 302 L248 310 z" fill="' + TEAL + '" stroke="none"/>')
add(pod)
add(mirror(pod))

# ── exhausts ─────────────────────────────────────────────────────────────────
for s in (-1, 1):
    x = CX + s * 128
    add(f'<path d="M{x-14} 232 L{x+14} 236 L{x+10} 262 L{x-10} 258 z" fill="#0c0e16"/>')
    add(f'<path d="M{x-8} 238 L{x+8} 241 L{x+5} 255 L{x-5} 253 z" fill="url(#gHeat)" stroke="none"/>')

# ── chassis ──────────────────────────────────────────────────────────────────
add(f'<path d="M334 236 L466 236 L494 274 L510 352 L290 352 L306 274 z" fill="url(#gBody)"/>')
add(f'<path d="M340 252 L460 252 L466 268 L334 268 z" fill="{CARBON_HI}" stroke="none"/>')
add(f'<path d="M312 300 L488 300 L492 318 L308 318 z" fill="{TEAL}" stroke="none" opacity=".9"/>')
# steering wheel — flat-bottomed, gloves either side
add(f'<path d="M344 268 L456 268 L462 292 L436 292 L430 282 L370 282 L364 292 L338 292 z" '
    f'fill="#0d1018" stroke-width="6"/>')
for s_ in (-1, 1):
    a, b = (318, 352) if s_ < 0 else (482, 448)
    add(f'<path d="M{a} 264 L{b} 268 L{b-2*s_} 296 L{a-2*s_} 292 z" fill="#1b2130" stroke-width="6"/>')
    add(f'<path d="M{a+3*s_} 274 L{b-1*s_} 277 L{b-1*s_} 284 L{a+3*s_} 281 z" '
        f'fill="{TEAL}" stroke="none"/>')

add('</g>')

# ── front layer: the bodywork closest to the viewer ──────────────────────────
layer("front")
add(f'<g {S}>')

# ── nose ─────────────────────────────────────────────────────────────────────
add(f'<path d="M316 302 L484 302 L512 382 L288 382 z" fill="url(#gNose)"/>')
# angry intakes: inner edge drops toward the centreline
add(f'<path d="M330 320 L390 330 L384 352 L326 342 z" fill="#05070d"/>')
add(f'<path d="M470 320 L410 330 L416 352 L474 342 z" fill="#05070d"/>')
add(f'<path d="M336 326 L384 334 L381 342 L333 335 z" fill="{AMBER}" stroke="none"/>')
add(f'<path d="M464 326 L416 334 L419 342 L467 335 z" fill="{AMBER}" stroke="none"/>')
add(f'<path d="M368 356 L432 356 L436 378 L364 378 z" fill="#eef2ff"/>')
add(f'<text x="{CX}" y="376" font-family="system-ui, -apple-system, sans-serif" font-size="20" '
    f'font-weight="900" text-anchor="middle" fill="{INK}" stroke="none" '
    f'letter-spacing="1">01</text>')

# ── front wheels ─────────────────────────────────────────────────────────────
add(wheel(180, 340, 72, 82, 34, TEAL))
add(wheel(620, 340, 72, 82, 34, TEAL))

# ── splitter ─────────────────────────────────────────────────────────────────
add(f'<path d="M262 384 L538 384 L552 412 L248 412 z" fill="{CARBON}"/>')
add(f'<path d="M262 384 L538 384 L536 394 L264 394 z" fill="{MAG}" stroke="none"/>')
for s in (-1, 1):
    x = CX + s * 268
    add(f'<path d="M{x-22} 380 L{x+22} 386 L{x+18} 404 L{x-26} 398 z" fill="{RED}"/>')
add('</g>')

# ── speed streaks, behind the car ────────────────────────────────────────────
layer("back")
add('<g id="kartSpeed" stroke="#ffffff" stroke-width="11" stroke-linecap="round" opacity=".8">')
for x, y, w, sgn in [(46, 206, 78, 1), (14, 262, 52, 1), (34, 326, 62, 1),
                     (754, 206, 78, -1), (786, 262, 52, -1), (766, 326, 62, -1)]:
    add(f'<path d="M{x} {y} h{w*sgn}"/>')
add('</g>')

# ═══════════════════════════════════════════════ emit
for name, body in LAYERS.items():
    markup = "\n".join(body)
    defs = DEFS
    for gid in ("gBody", "gPod", "gNose", "gTyre", "gVisor", "gShadow", "gHeat"):
        defs = defs.replace(f'id="{gid}"', f'id="{gid}-{name}"')
        markup = markup.replace(f"url(#{gid})", f"url(#{gid}-{name})")
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
           f'class="kart-layer kart-{name}" aria-hidden="true">\n{defs}\n{markup}\n</svg>')
    path = pathlib.Path(__file__).with_name(f"kart-{name}.svg")
    path.write_text(svg, encoding="utf-8")
    print(f"wrote {path.name} ({path.stat().st_size/1024:.1f} KB)")
