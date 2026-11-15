#!/usr/bin/env python3
"""capture.py — deterministic stills / frame sequences from the GLYPHBLOOM lab.

Runs the page in headless Chromium (same user-space sysroot as `shot`), drives
window.__render(t) so every frame is a pure function of time, and writes PNGs.

  python tools/capture.py --scene tide --t 3.2 --out output/tide.png --w 1600 --h 1000
  python tools/capture.py --scene tide --frames 180 --duration 6 --fps 30 --out frames/tide
"""
import argparse
import json
import os
import sys
from pathlib import Path

RENDER = Path.home() / ".local/share/render"
os.environ.setdefault(
    "LD_LIBRARY_PATH",
    f"{RENDER}/sysroot/usr/lib/x86_64-linux-gnu:{RENDER}/sysroot/lib/x86_64-linux-gnu",
)
os.environ.setdefault("FONTCONFIG_FILE", f"{RENDER}/fonts.conf")
os.environ.setdefault("FONTCONFIG_PATH", f"{RENDER}/sysroot/etc/fonts")

from playwright.sync_api import sync_playwright  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", default="tide")
    ap.add_argument("--out", required=True, help="png path, or directory when --frames > 1")
    ap.add_argument("--w", type=int, default=1600)
    ap.add_argument("--h", type=int, default=1000)
    ap.add_argument("--scale", type=float, default=2.0)
    ap.add_argument("--t", type=float, default=3.0)
    ap.add_argument("--frames", type=int, default=1)
    ap.add_argument("--duration", type=float, default=6.0)
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--ui", type=int, default=0)
    ap.add_argument("--base", default="http://127.0.0.1:8899/")
    ap.add_argument("--timeout", type=float, default=120.0)
    ap.add_argument("--debug", default="")
    args = ap.parse_args()

    url = f"{args.base}?scene={args.scene}&t={args.t}&ui={args.ui}" + (f"&debug={args.debug}" if args.debug else "")
    logs, errors = [], []

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--disable-lcd-text"])
        page = browser.new_page(
            viewport={"width": args.w, "height": args.h},
            device_scale_factor=args.scale,
        )
        page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url, wait_until="load", timeout=60_000)
        page.wait_for_function("window.__ready === true", timeout=int(args.timeout * 1000))
        page.wait_for_timeout(300)

        info = page.evaluate("window.__info()")
        out = Path(args.out)

        if args.frames <= 1:
            out.parent.mkdir(parents=True, exist_ok=True)
            page.evaluate("(t) => window.__render(t)", args.t)
            page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
            page.screenshot(path=str(out), type="png")
            written = [str(out)]
        else:
            out.mkdir(parents=True, exist_ok=True)
            n = args.frames
            for i in range(n):
                t = args.duration * i / n
                page.evaluate("(t) => window.__render(t)", t)
                page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
                frame = out / f"{i:05d}.png"
                page.screenshot(path=str(frame), type="png")
                if i % 20 == 0:
                    print(f"  frame {i}/{n} t={t:.2f}", flush=True)
            written = [str(out / f"{i:05d}.png") for i in range(n)]

        browser.close()

    print(json.dumps({
        "scene": info.get("scene") if isinstance(info, dict) else None,
        "grid": info.get("grid") if isinstance(info, dict) else None,
        "size": info.get("size") if isinstance(info, dict) else None,
        "frames": len(written),
        "first": written[0],
        "errors": errors,
        "console": [l for l in logs if "error" in l.lower()][:6],
    }, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
