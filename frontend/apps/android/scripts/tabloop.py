#!/usr/bin/env python3
"""Instant Screens tab loop on an Android emulator (docs/product/instant-screens-contract-2026-10-09.md §10).

Place -> Today -> Nearby -> Messages -> back to Place, N rounds; optionally a cold start first and the loop
again in airplane mode. Per tab it prints:
  - requests per visit, read from the local backend's log (lines "<ISO time> [info]: GET /api/... {..okhttp..}")
  - "content ms": tap to the content that stayed on screen, from the debug build's ISPerf lines
    (core/perf/ScreenTiming.kt); "blanks": how often content the visit showed dropped to a skeleton or an error
  - "settled ms": tap to the visit's last HTTP reply on the phone (debug HTTP log lines)
It never prints tokens, ids or response bodies.

Start on a tab root of a signed-in debug build. Conditions used for the Instant Screens numbers: the backend
slowed with L4's dbdelay.cjs (60 ms per database call) and --throttle (umts delay, hsdpa speed).

usage: tabloop.py --backend-log <file> --label before [--serial emulator-5580] [--rounds 5] [--dwell 6]
                  [--cold] [--airplane] [--throttle] [--detail]
"""
import argparse
import os
import re
import statistics
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ADB = os.path.expanduser(os.environ.get("ADB", "~/Library/Android/sdk/platform-tools/adb"))
TABS = ["Place", "Today", "Nearby", "Messages"]
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def adb(serial, *args):
    r = subprocess.run([ADB, "-s", serial, *args], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"adb {' '.join(args[:2])} failed: {r.stderr.strip()[:200]}")
    return r.stdout


def now_ms():
    return int(time.time() * 1000)


def find_tabs(serial):
    """The bottom bar's tabs by their accessibility label ("Messages, 2 unread" counts as Messages)."""
    adb(serial, "shell", "uiautomator", "dump", "/sdcard/tabloop-ui.xml")
    xml = adb(serial, "exec-out", "cat", "/sdcard/tabloop-ui.xml")
    root = ET.fromstring(xml[xml.index("<"):])
    found = {}
    for node in root.iter("node"):
        label = (node.get("content-desc") or "").split(",")[0].strip()
        bounds = [int(v) for v in re.findall(r"\d+", node.get("bounds", ""))]
        if label in ("Place", "Today", "Nearby", "Mail", "Messages") and len(bounds) == 4 and bounds[1] > 1800:
            found["Messages" if label == "Mail" else label] = ((bounds[0] + bounds[2]) // 2, (bounds[1] + bounds[3]) // 2)
    missing = [t for t in TABS if t not in found]
    if missing:
        sys.exit(f"tabs not found on screen: {missing} (is the app signed in, on a tab root?)")
    return found


def backend_requests(log_path, t0, t1):
    """App requests the backend logged in [t0, t1) ms, as 'METHOD /path' with ids masked."""
    out = []
    pat = re.compile(r"^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+Z) \[info\]: (GET|POST|PUT|PATCH|DELETE) (\S+) \{(.*)\}")
    with open(log_path, errors="replace") as fh:
        for line in fh:
            m = pat.match(line)
            if not m or "okhttp" not in m.group(4).lower():
                continue
            ts = int(datetime.strptime(m.group(1), "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=timezone.utc).timestamp() * 1000)
            if t0 <= ts < t1:
                out.append(f"{m.group(2)} {UUID.sub(':id', m.group(3).split('?')[0])}")
    return out


def logcat_events(serial):
    """(epoch ms, tag, message) for the HTTP and ISPerf lines since the loop started."""
    raw = adb(serial, "logcat", "-d", "-v", "epoch", "-s", "HTTP:D", "ISPerf:D")
    events = []
    for line in raw.splitlines():
        m = re.match(r"^\s*(\d+)\.(\d{3})\s+\d+\s+\d+\s+\w\s+(HTTP|ISPerf)\s*:\s*(.*)$", line)
        if m:
            events.append((int(m.group(1)) * 1000 + int(m.group(2)), m.group(3), m.group(4)))
    return events


def run_loop(serial, tabs, rounds, dwell, note):
    visits = []
    for r in range(rounds):
        for tab in ["Today", "Nearby", "Messages", "Place"]:
            t0 = now_ms()
            adb(serial, "shell", "input", "tap", str(tabs[tab][0]), str(tabs[tab][1]))
            time.sleep(dwell)
            visits.append({"tab": tab, "round": r + 1, "t0": t0, "t1": now_ms(), "note": note})
    return visits


def cold_start(serial, package, dwell):
    adb(serial, "shell", "am", "force-stop", package)
    time.sleep(1)
    t0 = now_ms()
    out = adb(serial, "shell", "am", "start", "-W", "-n", f"{package}/app.pantopus.android.MainActivity")
    m = re.search(r"TotalTime: (\d+)", out)
    print(f"cold start: first frame after {m.group(1) if m else '?'} ms (am start -W)")
    time.sleep(dwell + 4)
    return {"tab": "cold start", "round": 0, "t0": t0, "t1": now_ms(), "note": "cold"}


def summarize(log_path, visits, events, detail):
    rows = {}
    for v in visits:
        reqs = backend_requests(log_path, v["t0"], v["t1"])
        http = [e for e in events if e[1] == "HTTP" and v["t0"] <= e[0] < v["t1"]]
        perf = [e for e in events if e[1] == "ISPerf" and v["t0"] <= e[0] < v["t1"] and e[2].split(" ")[0] in ("content", "blank")]
        settled = (max(e[0] for e in http) - v["t0"]) if http else 0
        blanks = sum(1 for e in perf if e[2].startswith("blank"))
        # The content that stayed: the visit's last content line, unless the screen ended blank (skeleton or error).
        last = perf[-1] if perf else None
        content = None
        if last and last[2].startswith("content"):
            m = re.search(r"sinceTap=(\d+)", last[2])
            content = int(m.group(1)) if m else last[0] - v["t0"]
        rows.setdefault((v["note"], v["tab"]), []).append((len(reqs), settled, content, reqs, blanks))
    print(f"{'run':9} {'tab':11} {'visits':>6} {'req/visit':>9} {'first':>5} {'later':>5} {'content ms':>11} {'blanks':>6} "
          f"{'no content':>10} {'settled ms':>11}")
    for (note, tab), vals in rows.items():
        req = [v[0] for v in vals]
        later = req[1:]
        content = [v[2] for v in vals if v[2] is not None]
        print(f"{note:9} {tab:11} {len(vals):>6} {statistics.mean(req):>9.1f} {req[0]:>5} "
              f"{(statistics.mean(later) if later else 0):>5.1f} "
              f"{(statistics.median(content) if content else float('nan')):>11.0f} "
              f"{sum(v[4] for v in vals):>6} {sum(1 for v in vals if v[2] is None):>10} "
              f"{statistics.median([v[1] for v in vals]):>11.0f}")
    if detail:
        for (note, tab), vals in rows.items():
            for i, v in enumerate(vals):
                print(f"  {note} {tab} visit {i + 1}: content {v[2]} ms, {v[4]} blanks, {v[0]} requests: {', '.join(v[3])}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend-log", required=True, help="the local backend's log file (launch-backend.cjs output)")
    ap.add_argument("--label", required=True)
    ap.add_argument("--serial", default="emulator-5580")
    ap.add_argument("--package", default="app.pantopus.android.debug")
    ap.add_argument("--rounds", type=int, default=5)
    ap.add_argument("--dwell", type=float, default=6.0)
    ap.add_argument("--cold", action="store_true")
    ap.add_argument("--airplane", action="store_true")
    ap.add_argument("--throttle", action="store_true", help="adb emu network delay umts + speed hsdpa")
    ap.add_argument("--detail", action="store_true", help="print each visit's request list")
    a = ap.parse_args()
    s = a.serial
    if a.throttle:
        adb(s, "emu", "network", "delay", "umts")
        adb(s, "emu", "network", "speed", "hsdpa")
    adb(s, "logcat", "-c")
    visits = [cold_start(s, a.package, a.dwell)] if a.cold else []
    tabs = find_tabs(s)
    visits += run_loop(s, tabs, a.rounds, a.dwell, "online")
    if a.airplane:
        adb(s, "shell", "cmd", "connectivity", "airplane-mode", "enable")
        time.sleep(2)
        visits += run_loop(s, tabs, max(1, a.rounds // 2), a.dwell, "airplane")
        adb(s, "shell", "cmd", "connectivity", "airplane-mode", "disable")
    if a.throttle:
        adb(s, "emu", "network", "delay", "none")
        adb(s, "emu", "network", "speed", "full")
    time.sleep(1)
    print(f"tab loop '{a.label}' {datetime.now(timezone.utc):%Y-%m-%dT%H:%MZ}: rounds={a.rounds}, dwell={a.dwell}s, "
          f"throttle={'umts/hsdpa' if a.throttle else 'none'}")
    summarize(a.backend_log, visits, logcat_events(s), a.detail)


if __name__ == "__main__":
    main()
