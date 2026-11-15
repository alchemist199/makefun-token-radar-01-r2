#!/usr/bin/env python3
"""Local gate check for token-radar-01 round 2, written from RULES.txt's 7 rows.
Usage: python3 verify.py <out-dir> <snapshot.json>
Exit 0 when all rows pass, 1 otherwise.
"""
import json
import os
import re
import struct
import sys

OUT, SNAP = sys.argv[1], sys.argv[2]
fails = []


def check(name, ok, detail=""):
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")
    if not ok:
        fails.append(name)


def jpeg_dims(path):
    with open(path, "rb") as f:
        data = f.read()
    if data[:2] != b"\xff\xd8":
        return None
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return (w, h)
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        size = struct.unpack(">H", data[i + 2:i + 4])[0]
        i += 2 + size
    return None


def png_dims(path):
    with open(path, "rb") as f:
        data = f.read(33)
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    w, h = struct.unpack(">II", data[16:24])
    return (w, h)


snap = json.load(open(SNAP))
snap_slugs = {p["slug"] for p in snap["protocols"]}
watchlist = snap["watchlist"]

# 1. dashboard_files
d = os.path.join(OUT, "dashboard")
files = []
for root, _, names in os.walk(d):
    for n in names:
        files.append(os.path.join(root, n))
total = sum(os.path.getsize(f) for f in files)
names_ok = all(re.match(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$", os.path.basename(f)) for f in files)
has_html = os.path.isfile(os.path.join(d, "index.html"))
has_css = any(f.endswith(".css") for f in files)
has_js = any(f.endswith(".js") for f in files)
net_ok = True
for f in files:
    t = open(f, "rb").read().decode("utf-8", "ignore")
    if "http://" in t or "https://" in t:
        net_ok = False
check("dashboard_files", has_html and has_css and has_js and len(files) <= 400 and total <= 4_194_304 and names_ok and net_ok,
      f"{len(files)} files, {total} bytes, html={has_html} css={has_css} js={has_js} names_ok={names_ok} no_http={net_ok}")

# 2. board_file
board_path = os.path.join(OUT, "board.json")
board = json.load(open(board_path))
rows = board["rows"] if isinstance(board, dict) else board
board_ok = 100 <= len(rows) <= 4000 and os.path.getsize(board_path) <= 8_388_608
bad = [r for r in rows if r["slug"] not in snap_slugs or not r["name"] or not isinstance(r["rank"], int)
       or not isinstance(r["implied_value_usd"], int) or r["implied_value_usd"] <= 0
       or r["implied_value_usd"] > 100_000_000_000_000 or not isinstance(r["farm_steps"], list)]
check("board_file", board_ok and not bad, f"{len(rows)} rows, {len(bad)} bad rows")

# 3. sorted_by_value
ranks = sorted(r["rank"] for r in rows)
by_rank = sorted(rows, key=lambda r: r["rank"])
non_inc = all(by_rank[i]["implied_value_usd"] >= by_rank[i + 1]["implied_value_usd"] for i in range(len(by_rank) - 1))
not_all_same = len({r["implied_value_usd"] for r in rows}) > 1
check("sorted_by_value", ranks == list(range(1, len(rows) + 1)) and non_inc and not_all_same,
      f"ranks 1..{len(rows)} exact, non-increasing={non_inc}, distinct values={len({r['implied_value_usd'] for r in rows})}")

# 4. coverage
have = {r["slug"] for r in rows}
missing = [s for s in watchlist if s not in have]
check("coverage", not missing, f"{len(watchlist) - len(missing)}/{len(watchlist)} watchlist covered, missing={missing[:3]}")

# 5. farm_steps
bad_steps = [(r["slug"], len(s)) for r in rows for s in r["farm_steps"] if not (20 <= len(s.strip()) <= 600)]
bad_count = [r["slug"] for r in rows if not (3 <= len(r["farm_steps"]) <= 12)]
check("farm_steps", not bad_steps and not bad_count,
      f"{sum(len(r['farm_steps']) for r in rows)} steps total, bad lengths={len(bad_steps)}, bad counts={len(bad_count)}")

# 6. screenshots
sdir = os.path.join(OUT, "screenshots")
shots = sorted(n for n in os.listdir(sdir) if not n.startswith("."))
shot_ok = 3 <= len(shots) <= 4
details = []
for n in shots:
    p = os.path.join(sdir, n)
    dims = jpeg_dims(p) or png_dims(p)
    sz = os.path.getsize(p)
    ok = dims is not None and sz <= 524_288 and max(dims) <= 1440 and min(dims) >= 800
    details.append(f"{n} {dims} {sz}B {'ok' if ok else 'BAD'}")
    shot_ok = shot_ok and ok
check("screenshots", shot_ok, "; ".join(details))

# 7. dossier (matches is checked by the node step; here: size caps + text cap)
dossier_path = os.path.join(OUT, "dossier.json")
dossier = json.load(open(dossier_path))
text_bytes = len(dossier["text"].encode("utf-8"))
dossier_bytes = os.path.getsize(dossier_path)
check("dossier_sizes", text_bytes <= 65_536 and dossier_bytes <= 1_572_864,
      f"text={text_bytes} bytes (cap 65536), dossier.json={dossier_bytes} bytes (cap 1572864)")

print("ALL PASS" if not fails else f"FAILURES: {fails}")
sys.exit(0 if not fails else 1)
