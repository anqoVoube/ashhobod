#!/usr/bin/env python3
"""Inline every asset and emit both flavours of the page.

    python3 build.py

Reads  src/index.template.html
Writes index.html       body-content only, for the Claude artifact host, which supplies
                        its own <!doctype>/<head> wrapper at publish time
Writes dist/index.html  a complete standalone document (doctype, <head>, viewport,
                        social-card tags, noindex) -- this is the one to upload to a
                        normal static host

Neither output makes a single external request.

Tokens understood in the template:
    {{ASSET:name.jpg}}   -> data: URI for assets/name.jpg
    {{SVG:park.svg}}     -> the contents of src/park.svg, inlined as markup
    {{JS:kart3d.js}}     -> the contents of src/kart3d.js, inlined as script body
"""
import base64
import mimetypes
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).parent
TEMPLATE = ROOT / "src" / "index.template.html"
OUTPUT = ROOT / "index.html"
DIST = ROOT / "dist"

# Public origin the site will be served from, e.g. "https://ashxobod.uz".
# Only affects the og: tags that Telegram and other chat apps read to build a link
# preview card. Leave it empty until the domain is known -- a wrong absolute URL is
# worse than none, because the preview silently fetches the wrong host.
SITE_URL = ""

TITLE = "Ashxobod Sayilgohi"
DESCRIPTION = (
    "Ashxobod Sayilgohi — Toshkentdagi oilaviy istirohat bog'i. 34 ta attraksion, "
    "650 metrlik karting trassasi. Parkka kirish bepul."
)

# noindex is deliberate: this is a pitch prototype for a real business, and it must not
# turn up in search results where the park's actual customers could mistake it for the
# official site. Drop the robots line only if the park adopts it as their real site.
HEAD = """<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<title>{title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="{desc}">
<meta name="theme-color" content="#e2f4ff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0b0e20" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
{og_url}<meta property="og:image" content="{img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="uz_UZ">
<meta property="og:locale:alternate" content="ru_RU">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.png">
</head>
<body>
"""
FOOT = "\n</body>\n</html>\n"


def data_uri(name: str) -> str:
    path = ROOT / "assets" / name
    if not path.exists():
        sys.exit(f"missing asset: {path}")
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def inline_svg(name: str) -> str:
    path = ROOT / "src" / name
    if not path.exists():
        sys.exit(f"missing svg: {path}")
    svg = path.read_text(encoding="utf-8")
    # strip the XML prolog and the fixed width/height so CSS can size it
    svg = re.sub(r"<\?xml.*?\?>", "", svg, flags=re.S)
    svg = re.sub(r'\s(width|height)="\d+"', "", svg, count=2)
    return svg.strip()


def inline_js(name: str) -> str:
    path = ROOT / "src" / name
    if not path.exists():
        sys.exit(f"missing js: {path}")
    return path.read_text(encoding="utf-8").strip()


def main() -> None:
    html = TEMPLATE.read_text(encoding="utf-8")
    html = re.sub(r"\{\{ASSET:([^}]+)\}\}", lambda m: data_uri(m.group(1)), html)
    html = re.sub(r"\{\{SVG:([^}]+)\}\}", lambda m: inline_svg(m.group(1)), html)
    html = re.sub(r"\{\{JS:([^}]+)\}\}", lambda m: inline_js(m.group(1)), html)

    leftover = re.findall(r"\{\{[^}]+\}\}", html)
    if leftover:
        sys.exit(f"unresolved tokens: {sorted(set(leftover))}")

    OUTPUT.write_text(html, encoding="utf-8")
    print(f"built {OUTPUT}  ({OUTPUT.stat().st_size / 1024:.0f} KB)  [artifact flavour]")

    DIST.mkdir(exist_ok=True)
    # the title belongs in <head> here, so strip the artifact-flavour one from the body
    body = re.sub(r"^\s*<title>.*?</title>\s*", "", html, count=1, flags=re.S)
    origin = SITE_URL.rstrip("/")
    standalone = HEAD.format(
        title=TITLE,
        desc=DESCRIPTION,
        og_url=f'<meta property="og:url" content="{origin}/">\n' if origin else "",
        img=f"{origin}/preview.jpg" if origin else "preview.jpg",
    ) + body + FOOT
    (DIST / "index.html").write_text(standalone, encoding="utf-8")
    (DIST / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")
    # Cloudflare Pages reads this file; harmless on other hosts
    (DIST / "_headers").write_text(
        "/*\n"
        "  X-Frame-Options: SAMEORIGIN\n"
        "  X-Content-Type-Options: nosniff\n"
        "  Referrer-Policy: strict-origin-when-cross-origin\n"
        "  X-Robots-Tag: noindex, nofollow\n"
        "\n"
        "/index.html\n"
        "  Cache-Control: public, max-age=0, must-revalidate\n",
        encoding="utf-8")
    for name in ("favicon.png", "preview.jpg"):
        src = ROOT / "assets" / name
        if src.exists():
            (DIST / name).write_bytes(src.read_bytes())
    print(f"built {DIST / 'index.html'}  ({(DIST / 'index.html').stat().st_size / 1024:.0f} KB)  [standalone]")
    if not SITE_URL:
        print("  note: SITE_URL is empty -- set it in build.py once the domain is live,\n"
              "        otherwise Telegram link previews have no image to fetch.")


if __name__ == "__main__":
    main()
