#!/usr/bin/env python3
"""Fail if any text in a HyperFrames video overflows its box (card, bubble, pill) or the frame.

`hyperframes inspect` already measures this, but reports text overflow only as "info", so a
date sticking out of its card slips through. This gate treats ANY text overflow as an error.

Usage (from the repo root):
  python3 tools/check_text_fit.py <video-project-dir> [<more-dirs>...]

Exit code 0 = all text fits. 1 = something overflows (each case is printed with the fix hint).
Run it before every render; re-render only after it passes.
"""
import json
import pathlib
import re
import subprocess
import sys

HF = ["npx", "--yes", "hyperframes@0.9.102"]
TOLERANCE_PX = 2


# Overflow codes that mean "text sticks out of its box / the frame". Occlusion (a flash over the
# text) and entrance zooms are intentional, so the check samples each scene once it has settled.
TEXT_CODES = ("text_box_overflow", "text_frame_overflow", "text_canvas_overflow", "text_overflow")


def settled_times(project):
    """Mid and late point of every scene clip (data-start/data-duration) - after entrances."""
    html = (pathlib.Path(project) / "index.html").read_text(encoding="utf-8")
    times = set()
    for tag in re.findall(r"<div[^>]*data-start=[^>]*>", html):
        st = re.search(r'data-start="([\d.]+)"', tag)
        du = re.search(r'data-duration="([\d.]+)"', tag)
        if st and du:
            s, d = float(st.group(1)), float(du.group(1))
            for f in (0.65, 0.8, 0.95):
                times.add(round(s + d * f, 2))
    return sorted(times)


def check(project):
    times = settled_times(project)
    cmd = HF + ["inspect", "--json", "--tolerance", str(TOLERANCE_PX), "--max-issues", "500",
                "--no-collapse-static"]
    if times:
        cmd += ["--at", ",".join(str(t) for t in times)]
    cmd.append(project)
    out = subprocess.run(cmd, capture_output=True, text=True)
    start = out.stdout.find("{")
    if start < 0:
        print(f"[{project}] inspect failed:\n{out.stdout}\n{out.stderr}")
        return False
    report = json.loads(out.stdout[start:])
    bad = {}
    for issue in report.get("issues", []):
        if issue["code"] in TEXT_CODES or (issue["code"].endswith("overflow") and issue.get("text")):
            key = (issue["code"], issue.get("selector"))
            bad.setdefault(key, issue)
    if not bad:
        print(f"[{project}] OK - all text fits at t={times}")
        return True
    print(f"[{project}] FAIL - {len(bad)} text overflow(s):")
    for (code, sel), i in bad.items():
        print(f"  t={i.get('time')}s {code} {sel} \"{i.get('text', '')}\" "
              f"inside {i.get('containerSelector', 'frame')} overflow={i.get('overflow')}")
        if i.get("fixHint"):
            print(f"      fix: {i['fixHint']}")
    return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    results = [check(p) for p in sys.argv[1:]]
    sys.exit(0 if all(results) else 1)
