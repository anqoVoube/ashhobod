# Ashxobod Sayilgohi — site prototype

Pitch prototype for the park's website + Telegram Mini App, built to a brief from 12 Aug 2026.

Open `index.html` in any browser. No server, no build step, no internet needed.

---

## What's in it

**Landing page** (`#/`)
- Hero: pastel sky, drifting clouds, the aerial park photo, and a cartoon kart driving at the
  viewer down a perspective track — the "картинг едет на нас, а позади парк" from the chat
- Ticker strip, bracelet tariffs, attractions grid with filters, photo gallery, cashback, Instagram, contacts
- **Karting zone** flips to dark carbon + neon, echoing the `egokarting.ru` reference

**Booking page** (`#/booking`)
- Modeled on `booking.egokarting.ru`: 14-day date strip → Karting / Braslet tabs → product cards
  with duration, time slot and participant stepper → live cart with running total → confirmation
- Fully click-through. Nothing is sent anywhere; checkout shows a fake booking code.

**Telegram Mini App** (`#/miniapp`)
- Two phone mockups: the booking flow (interactive — tap chips, prices recalculate) and the
  issued QR ticket, plus the 4-step explanation of how it plugs into the park's channel

**Also:** UZ ⇄ RU switcher on every string, light + dark theme (auto, with a manual toggle),
responsive down to 360px, keyboard accessible, `prefers-reduced-motion` respected.

---

## Files

```
index.html               ← the deliverable. Self-contained, ~580 KB, open it directly
build.py                 ← regenerates index.html from src/ + assets/
src/index.template.html  ← EDIT THIS, not index.html
src/kart.svg             ← the hero kart illustration
assets/                  ← logo + 4 park photos, resized and recompressed
```

To change anything: edit `src/index.template.html`, then

```sh
python3 build.py
```

`build.py` inlines every image as a `data:` URI and the kart as inline SVG, so the output has zero
external requests. Each image is referenced through a CSS custom property (`--img-logo`,
`--img-day`, …) and therefore embedded exactly once, even where it appears several times.

---

## Where the numbers came from

Taken **verbatim** from the screenshots in the chat:

| | |
|---|---|
| Karting — KLASSIK (12+) | 90 000 / 5 min · 125 000 / 10 min |
| Karting — SPORT (18+) | 95 000 / 5 min · 135 000 / 10 min |
| Karting — TWIN, two-seat (18+) | 105 000 / 5 min · 155 000 / 10 min |
| Bracelet — day | 50 000, 11:00–17:00 |
| Bracelet — full day | 70 000, 11:00–22:00 |
| Bracelet — + karting 5 min | 150 000, 11:00–22:00 |
| Cashback | 350k→+50k · 550k→+250k · 750k→+350k · 1M→+500k |
| Karting facts | 75 km/h · 65 km/h for ages 12–18 · 650 m track · two-seater available |
| Park entry | free |

The 34 attraction **names** are transcribed from the park's own price board
(`photos/photo_116@…jpg`).

### Needs confirming with the park

1. **Per-attraction prices.** The price badges on that board are too low-resolution to read
   reliably. The values in the grid are plausible placeholders in the right bracket — get the real
   list before this goes in front of anyone.
2. **Which kart is which speed.** The chat gives "75 km/h, and 65 km/h for 12–18". The prototype
   maps 65 → KLASSIK (12+) and 75 → SPORT (18+). Sensible, but it is an inference.
3. **Address and phone** — placeholders, marked with an orange "aniqlanadi / уточнить" pill so
   nobody mistakes them for real.
4. **Opening hours** — 11:00–22:00 is taken from the bracelet tariff poster and applied to the
   park generally.

---

## Design notes

Palette is lifted straight from the logo — teal `#12aebb`, magenta `#c53fb4`, purple `#6d2e91`,
amber `#f8a824`, with a hot pink `#ff4f9d` reserved for calls to action. The karting block is the
one place that breaks the pastel world, going to carbon `#0b0d14` with red/amber neon, which is both
the `egokarting.ru` reference and the actual GOKART sub-brand from the park's price poster.

**Typography is a deliberate system stack**, not a webfont. The page has to render Uzbek Latin
(`o'`, `g'`) and Russian Cyrillic side by side, and a display face missing Cyrillic would silently
fall back mid-page in the Russian version. If the park wants a custom face later, pick one with a
Cyrillic cut and embed it as a `@font-face` data URI in `src/index.template.html` — do not link a
font CDN, it would break the self-contained file.

## Known gaps

- **The Instagram reel is a link, not an embed.** Instagram's embed script cannot run inside a
  self-contained file. The card opens `instagram.com/p/DbsvnbCiUS0/` in a new tab. Wire up the real
  embed once the site is on a normal host.
- **Photography is the weak point.** Four photos from the chat, colour-graded to sit with the
  cartoon styling. The chat asked for more cartoon-like imagery "а то дешево будет выглядеть" —
  the kart is drawn to that brief, but the park photos are still photos. Commissioning a handful of
  illustrated ride icons would lift the attractions grid the most, since it currently uses emoji.
- **No backend.** The cart lives in memory and is lost on reload.
