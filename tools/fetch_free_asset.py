#!/usr/bin/env python3
"""Download copyright-free assets (images, music/sounds, fonts) into a project's assets/ folder.

Policy (see CLAUDE.md): every image and sound must be CC0 or Public Domain (no rights at all,
no attribution needed). They are searched on the internet and downloaded locally - a
HyperFrames composition never loads anything from the network at render time.

  images / audio : Openverse API (api.openverse.org), filtered to license=cc0,pdm ONLY.
                   Each result's license is checked again before download.
  fonts          : Google Fonts, downloaded as local font files (SIL OFL - free for any use,
                   no attribution required in the output). A fonts.css is written next to them.

Every download is recorded in <assets>/CREDITS.json (source page, license, creator).

Usage:
  python3 tools/fetch_free_asset.py search image "wedding flowers" [--n 10] [--orientation tall|wide|square]
  python3 tools/fetch_free_asset.py search audio "calm piano" [--n 10] [--min-sec 30]
  python3 tools/fetch_free_asset.py get image <openverse-id> <project-dir> [--name bg.jpg]
  python3 tools/fetch_free_asset.py get audio <openverse-id> <project-dir> [--name music.mp3]
  python3 tools/fetch_free_asset.py font "Rubik:wght@400;700" <project-dir> [--font "Suez One"]...
"""
import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import date

API = "https://api.openverse.org/v1"
ALLOWED = {"cc0", "pdm"}  # CC0 + Public Domain Mark. Nothing else, ever.
UA = "free-asset-fetcher/1.0"
# A desktop-browser UA makes Google Fonts css2 serve plain font-file URLs (woff) we can save as-is.
FONT_UA = "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36"


def http_get(url, ua=UA):
    req = urllib.request.Request(url, headers={"User-Agent": ua})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def api(path, **params):
    q = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    return json.loads(http_get(f"{API}/{path}?{q}"))


def search(kind, query, n, orientation=None, min_sec=None):
    endpoint = "images" if kind == "image" else "audio"
    params = {"q": query, "license": ",".join(sorted(ALLOWED)), "page_size": min(max(n * 2, 10), 50)}
    if kind == "image" and orientation:
        params["aspect_ratio"] = orientation
    data = api(f"{endpoint}/", **params)
    shown = 0
    for r in data.get("results", []):
        if r.get("license") not in ALLOWED:
            continue
        dur = (r.get("duration") or 0) / 1000
        if kind == "audio" and min_sec and dur < min_sec:
            continue
        if kind == "image":
            info = f"{r.get('width')}x{r.get('height')}"
        else:
            info = f"{dur:.0f}s {r.get('filetype') or ''}"
        print(f"{r['id']}\t{r['license']}\t{info}\t{r.get('title') or ''}\t{r.get('foreign_landing_url')}")
        shown += 1
        if shown >= n:
            break
    if not shown:
        print("No CC0/Public-Domain results - try other words (English works best).", file=sys.stderr)


def assets_dir(project):
    d = os.path.join(project, "assets")
    os.makedirs(d, exist_ok=True)
    return d


def record(adir, entry):
    path = os.path.join(adir, "CREDITS.json")
    items = []
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            items = json.load(f)
    items = [i for i in items if i.get("file") != entry["file"]] + [entry]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def safe_name(s):
    return re.sub(r"[^A-Za-z0-9._-]+", "-", s).strip("-") or "asset"


def get(kind, oid, project, name=None):
    endpoint = "images" if kind == "image" else "audio"
    r = api(f"{endpoint}/{oid}/")
    lic = r.get("license")
    if lic not in ALLOWED:
        sys.exit(f"REFUSED: license is '{lic}', only CC0 / Public Domain are allowed.")
    url = r["url"]
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1] or (".jpg" if kind == "image" else ".mp3")
    name = name or safe_name((r.get("title") or oid)[:40]) + ext.lower()
    adir = assets_dir(project)
    out = os.path.join(adir, name)
    with open(out, "wb") as f:
        f.write(http_get(url))
    record(adir, {
        "file": name, "kind": kind, "license": lic, "title": r.get("title"),
        "creator": r.get("creator"), "source": r.get("foreign_landing_url"),
        "download_url": url, "provider": r.get("provider"), "openverse_id": oid,
        "downloaded": date.today().isoformat(),
    })
    print(out)


def font(families, project):
    q = "&".join("family=" + urllib.parse.quote(f.replace(" ", "+"), safe="+:;@,") for f in families)
    css = http_get(f"https://fonts.googleapis.com/css2?{q}&display=swap", ua=FONT_UA).decode()
    adir = assets_dir(project)
    fdir = os.path.join(adir, "fonts")
    os.makedirs(fdir, exist_ok=True)
    blocks = re.findall(r"@font-face\s*{[^}]*}", css)
    if not blocks:
        sys.exit("Google Fonts returned no fonts - check the family name/weights.")
    out_css, seen = [], {}
    for b in blocks:
        fam = re.search(r"font-family:\s*'([^']+)'", b).group(1)
        wt = re.search(r"font-weight:\s*(\d+)", b)
        st = re.search(r"font-style:\s*(\w+)", b)
        url = re.search(r"url\(([^)]+)\)", b).group(1)
        ext = os.path.splitext(urllib.parse.urlparse(url).path)[1] or ".ttf"
        base = f"{safe_name(fam)}-{wt.group(1) if wt else '400'}{'-italic' if st and st.group(1) == 'italic' else ''}"
        # Same file can serve several unicode-range subsets; keep one file per URL.
        if url not in seen:
            n = sum(1 for v in seen.values() if v.startswith(base))
            fname = f"{base}{'-' + str(n) if n else ''}{ext}"
            with open(os.path.join(fdir, fname), "wb") as f:
                f.write(http_get(url, ua=FONT_UA))
            seen[url] = fname
            record(adir, {
                "file": f"fonts/{fname}", "kind": "font", "license": "OFL-1.1",
                "title": fam, "source": f"https://fonts.google.com/specimen/{fam.replace(' ', '+')}",
                "download_url": url, "downloaded": date.today().isoformat(),
            })
        out_css.append(b.replace(url, f"fonts/{seen[url]}"))
    css_path = os.path.join(adir, "fonts.css")
    with open(css_path, "w", encoding="utf-8") as f:
        f.write("\n".join(out_css) + "\n")
    print(css_path)
    for v in seen.values():
        print(os.path.join(fdir, v))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("kind", choices=["image", "audio"])
    s.add_argument("query")
    s.add_argument("--n", type=int, default=10)
    s.add_argument("--orientation", choices=["tall", "wide", "square"])
    s.add_argument("--min-sec", type=float)
    g = sub.add_parser("get")
    g.add_argument("kind", choices=["image", "audio"])
    g.add_argument("id")
    g.add_argument("project")
    g.add_argument("--name")
    f = sub.add_parser("font")
    f.add_argument("family", help='e.g. "Rubik:wght@400;700"')
    f.add_argument("project")
    f.add_argument("--font", action="append", default=[], help="additional family")
    a = p.parse_args()
    if a.cmd == "search":
        search(a.kind, a.query, a.n, a.orientation, a.min_sec)
    elif a.cmd == "get":
        get(a.kind, a.id, a.project, a.name)
    else:
        font([a.family] + a.font, a.project)


if __name__ == "__main__":
    main()
