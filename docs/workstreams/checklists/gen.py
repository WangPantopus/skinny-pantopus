#!/usr/bin/env python3
"""Render the U02-U04 exit checklists of Streams 1 and 2 (split from the former Stream 1 on
2026-09-30) as hub-doc markdown, the frozen reconciliation, and the review page.

usage: gen.py check                 -> print totals; exit 1 if Stream 1 + Stream 2 != pre-split
       gen.py md <1|2> <ts> <url>   -> the stream's canonical checklist section
       gen.py recon <ts> <url>      -> the reconciliation table for former-stream1-gigs-payments.md
       gen.py html <ts>             -> the review page (both streams)
"""
import html, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import data

CLIENTS = ["iOS", "Android", "Web"]
KIND = {
    "done": ("✓", "Done"),
    "confirm": ("?", "Confirm from existing evidence"),
    "todo": ("○", "To do"),
    "block": ("⊘", "Boundary"),
    "decide": ("◆", "Your call"),
    "na": ("–", "Not offered"),
}
ORDER = ["done", "confirm", "todo", "decide", "block", "na"]
MD_MARK = {"done": "✅", "confirm": "❓", "todo": "⬜", "block": "⛔", "decide": "🔷", "na": "–"}
LISTS = ("U03", "U04", "U02")

# ---------- selection ----------
def u03(stream=None):
    return [(g, rows) for g, rows in data.U03 if stream is None or data.STREAM_U03[g] == stream]

def u04(stream=None):
    return [r for r in data.U04 if stream is None or data.STREAM_U04[r[0]] == stream]

def u02(stream=None):
    return [(g, rows) for g, rows in data.U02 if stream is None or data.STREAM_U02[g] == stream]

def cells(name, stream=None):
    if name == "U03":
        for _, rows in u03(stream):
            for _, _, cl in rows:
                for k in CLIENTS:
                    yield cl[k]
    elif name == "U04":
        for _, _, cl in u04(stream):
            for k in CLIENTS:
                yield cl[k]
    else:
        for _, rows in u02(stream):
            for _, cl in rows:
                for k in CLIENTS:
                    yield cl[k]

def count(name, stream=None):
    n = {k: 0 for k in ORDER}
    for chips in cells(name, stream):
        for kind, _, _ in chips:
            n[kind] += 1
    return n

def outside(stream=None):
    return [(t, d) for t, d in data.OUTSIDE if stream is None or data.OUTSIDE_STREAM[t] in (0, stream)]

def decisions(stream=None):
    return [(d, s) for d, s in zip(data.DECISIONS, data.DECISIONS_STREAM) if stream is None or s in (0, stream)]

def reconcile():
    """The frozen split proof. Per list and status: (pre-split, stream 1, stream 2) from
    SPLIT_SNAPSHOT; raises if any sum differs or a section has no stream."""
    unmapped = ([g for g, _ in data.U03 if g not in data.STREAM_U03] + [r[0] for r in data.U04 if r[0] not in data.STREAM_U04]
                + [g for g, _ in data.U02 if g not in data.STREAM_U02])
    if unmapped:
        raise SystemExit("sections without a stream: " + ", ".join(unmapped))
    out, bad = {}, []
    for name in LISTS:
        a, b, pre = data.SPLIT_SNAPSHOT[name][1], data.SPLIT_SNAPSHOT[name][2], data.PRE_SPLIT[name]
        out[name] = {k: (pre[k], a[k], b[k]) for k in ORDER}
        bad += [f"{name} {k}: {pre[k]} != {a[k]} + {b[k]}" for k in ORDER if a[k] + b[k] != pre[k]]
    if bad:
        raise SystemExit("split does not add up:\n  " + "\n  ".join(bad))
    return out

def progress():
    """Live counts per stream compared with the split snapshot (informational)."""
    lines = []
    for s in (1, 2):
        for name in LISTS:
            now, then = count(name, s), data.SPLIT_SNAPSHOT[name][s]
            moved = {k: f"{then[k]}→{now[k]}" for k in ORDER if now[k] != then[k]}
            lines.append(f"Stream {s} {name}: " + (", ".join(f"{k} {v}" for k, v in moved.items()) if moved else "unchanged since the split"))
    return lines

# ---------- markdown ----------
def md_chips(chips):
    return "<br>".join(f"{MD_MARK[kind]} {text}" + (f" ({ref})" if ref else "") for kind, text, ref in chips)

def tag(s):
    return "both streams" if s == 0 else f"Stream {s}"

def markdown(stream, ts, url):
    reconcile()
    L = [f"## Stream {stream} exit checklists (U02–U04) — split from the former Stream 1 on 2026-09-30, updated {ts}", ""]
    L.append(f"**{data.STREAM_NAMES[stream]}.** Review page: {url}. This section is Stream {stream}'s canonical copy; progress is tracked here only.")
    L.append("These rows came from the former Stream 1's approved checklists (2026-09-29). With the other stream's section they add up exactly to the pre-split totals; the reconciliation is frozen in `former-stream1-gigs-payments.md`.")
    L.append("Legend: ✅ done (sealed evidence) · ❓ confirm from existing evidence before any rerun · ⬜ to do · 🔷 user decision · ⛔ named boundary · – not offered on that client.")
    L.append("A row closes when every client cell is ✅, –, ⛔ with its named boundary, or 🔷 decided. Anything found broken gets the smallest fix with real-app before/after evidence and exact cleanup; visual changes go to the user first.")
    L.append("")
    L.append("**U03 edge cases** — " + "; ".join(f"{c} {n.lower()}" for c, n, _ in data.U03_CASES) + ".")
    L.append("")
    L.append("| Workflow | iOS | Android | Web |")
    L.append("|---|---|---|---|")
    for group, rows in u03(stream):
        L.append(f"| **{group}** | | | |")
        for name, note, cl in rows:
            L.append(f"| {name}" + (f" ({note})" if note else "") + " | " + " | ".join(md_chips(cl[k]) for k in CLIENTS) + " |")
    L.append("")
    L.append("**U04 lifetimes** — " + "; ".join(f"{c} {n.lower()}" for c, n, _ in data.U04_CASES) + ".")
    L.append("")
    L.append("| Area | iOS | Android | Web |")
    L.append("|---|---|---|---|")
    for name, note, cl in u04(stream):
        L.append(f"| {name}" + (f" ({note})" if note else "") + " | " + " | ".join(md_chips(cl[k]) for k in CLIENTS) + " |")
    L.append("")
    L.append("**U02 accessibility** — " + "; ".join(f"{c} {n.lower()}" for c, n, _ in data.U02_CASES) + ".")
    L.append("")
    L.append("| Screen | iOS | Android | Web |")
    L.append("|---|---|---|---|")
    for group, rows in u02(stream):
        L.append(f"| **{group}** | | | |")
        for name, cl in rows:
            L.append(f"| {name} | " + " | ".join(md_chips(cl[k]) for k in CLIENTS) + " |")
    L.append("")
    L.append("**Outside this plan:** " + " ".join(f"{t}: {d}" for t, d in outside(stream)))
    L.append("")
    L.append("**Decisions:** " + " ".join(f"({i}) {d}" + (" [both streams]" if s == 0 else "") for i, (d, s) in enumerate(decisions(stream), 1)))
    L.append("")
    for name in LISTS:
        n = count(name, stream)
        L.append(f"- {name} items: " + ", ".join(f"{KIND[k][1].lower()} {n[k]}" for k in ORDER))
    L.append("")
    return "\n".join(L)

def recon_md(ts, url):
    r = reconcile()
    L = [f"### Split reconciliation — 2026-09-30 (checked {ts})", ""]
    L.append("Every checklist item of the former Stream 1 now belongs to exactly one stream. Each cell reads *before the split = Stream 1 + Stream 2*; `gen.py check` fails if any cell doesn't add up.")
    L.append(f"Stream 1's canonical copy is in [`01-trains-coordination.md`](01-trains-coordination.md), Stream 2's in [`02-posts-hub-payments.md`](02-posts-hub-payments.md); review page {url}.")
    L.append("")
    L.append("| List | " + " | ".join(KIND[k][1] for k in ORDER) + " | Total |")
    L.append("|---|" + "---|" * (len(ORDER) + 1))
    for name in LISTS:
        row = r[name]
        tot = tuple(sum(row[k][i] for k in ORDER) for i in range(3))
        L.append(f"| {name} | " + " | ".join(f"{row[k][0]} = {row[k][1]} + {row[k][2]}" for k in ORDER) + f" | {tot[0]} = {tot[1]} + {tot[2]} |")
    grand = tuple(sum(r[n][k][i] for n in LISTS for k in ORDER) for i in range(3))
    L.append(f"| **All** | " + " | ".join(f"{sum(r[n][k][0] for n in LISTS)} = {sum(r[n][k][1] for n in LISTS)} + {sum(r[n][k][2] for n in LISTS)}" for k in ORDER) + f" | **{grand[0]} = {grand[1]} + {grand[2]}** |")
    L.append("")
    L.append("Which rows went where:")
    L.append("- **Stream 1 (Support Trains and coordination):** U03 " + ", ".join(g for g, _ in u03(1)) + "; U04 " + ", ".join(r[0] for r in u04(1)) + "; U02 " + ", ".join(g for g, _ in u02(1)) + ".")
    L.append("- **Stream 2 (Posts, Hub and payments):** U03 " + ", ".join(g for g, _ in u03(2)) + "; U04 " + ", ".join(r[0] for r in u04(2)) + "; U02 " + ", ".join(g for g, _ in u02(2)) + ".")
    L.append("- Notes and decisions: " + "; ".join(f"{t} → {tag(data.OUTSIDE_STREAM[t])}" for t, _ in data.OUTSIDE) + ". Decisions: " + "; ".join(f"({i}) → {tag(s)}" for i, s in enumerate(data.DECISIONS_STREAM, 1)) + ".")
    L.append("")
    return "\n".join(L)

# ---------- html ----------
E = html.escape

def chip(kind, text, ref):
    sym, word = KIND[kind]
    r = f'<span class="ref">{E(ref)}</span>' if ref else ""
    return (f'<span class="chip {kind}"><span class="sym" aria-hidden="true">{sym}</span>'
            f'<span class="sr">{E(word)}: </span>{E(text)}{r}</span>')

def cell(chips):
    return '<td><div class="chips">' + "".join(chip(*c) for c in chips) + "</div></td>"

def bar(n):
    total = sum(n[k] for k in ORDER) or 1
    segs = "".join(f'<span class="seg {k}" style="flex:{n[k]}" title="{KIND[k][1]} {n[k]}"></span>' for k in ORDER if n[k])
    legend = "".join(f'<li><span class="dot {k}" aria-hidden="true"></span>{KIND[k][1]} <b>{n[k]}</b></li>' for k in ORDER if n[k])
    return f'<div class="bar" role="img" aria-label="{total} items">{segs}</div><ul class="counts">{legend}</ul>'

def cases_dl(cases):
    return '<dl class="cases">' + "".join(f'<div><dt><code>{E(c)}</code> {E(n)}</dt><dd>{E(d)}</dd></div>' for c, n, d in cases) + "</dl>"

HEAD = '<thead><tr><th scope="col">{}</th><th scope="col">iOS</th><th scope="col">Android</th><th scope="col">Web</th></tr></thead>'

def table(label, head, rows):
    return (f'<div class="table" tabindex="0" aria-label="{E(label)}"><table>{HEAD.format(head)}<tbody>\n'
            + "\n".join(rows) + "\n</tbody></table></div>")

def stream_part(stream):
    r3, r4, r2 = [], [], []
    for group, rows in u03(stream):
        r3.append(f'<tr class="group"><th colspan="4" scope="colgroup">{E(group)}</th></tr>')
        for name, note, cl in rows:
            sub = f'<span class="note">{E(note)}</span>' if note else ""
            r3.append(f'<tr><th scope="row">{E(name)}{sub}</th>' + "".join(cell(cl[k]) for k in CLIENTS) + "</tr>")
    for name, note, cl in u04(stream):
        sub = f'<span class="note">{E(note)}</span>' if note else ""
        r4.append(f'<tr><th scope="row">{E(name)}{sub}</th>' + "".join(cell(cl[k]) for k in CLIENTS) + "</tr>")
    for group, rows in u02(stream):
        r2.append(f'<tr class="group"><th colspan="4" scope="colgroup">{E(group)}</th></tr>')
        for name, cl in rows:
            r2.append(f'<tr><th scope="row">{E(name)}</th>' + "".join(cell(cl[k]) for k in CLIENTS) + "</tr>")
    title = data.STREAM_NAMES[stream].split(": ", 1)[1]
    return f"""
  <section class="part" aria-labelledby="s{stream}">
    <div class="part-head"><span class="eyebrow">Stream {stream}</span><h2 id="s{stream}">{E(title)}</h2></div>
    <h3 class="list">U03 · Edge cases</h3>
    {table(f"Stream {stream} U03", "Workflow", r3)}
    <h3 class="list">U04 · Lifetimes</h3>
    {table(f"Stream {stream} U04", "Area", r4)}
    <h3 class="list">U02 · Accessibility</h3>
    {table(f"Stream {stream} U02", "Screen", r2)}
  </section>"""

def page(ts):
    r = reconcile()
    stat = []
    for s in (1, 2):
        title = data.STREAM_NAMES[s].split(": ", 1)[1]
        open_ = sum(count(n, s)["todo"] + count(n, s)["confirm"] for n in LISTS)
        stat.append(f'<div class="stat"><h3>Stream {s} <span>{E(title)}</span></h3>'
                    + "".join(f'<h4>{n}</h4>{bar(count(n, s))}' for n in LISTS)
                    + f'<p class="open">{open_} to do</p></div>')
    recon_rows = []
    for n in LISTS:
        row = r[n]
        tot = tuple(sum(row[k][i] for k in ORDER) for i in range(3))
        recon_rows.append(f'<tr><th scope="row">{n}</th>' + "".join(f"<td>{row[k][0]} = {row[k][1]} + {row[k][2]}</td>" for k in ORDER) + f"<td><b>{tot[0]} = {tot[1]} + {tot[2]}</b></td></tr>")
    grand = tuple(sum(r[n][k][i] for n in LISTS for k in ORDER) for i in range(3))
    recon_rows.append('<tr class="all"><th scope="row">All</th>' + "".join(f"<td>{sum(r[n][k][0] for n in LISTS)} = {sum(r[n][k][1] for n in LISTS)} + {sum(r[n][k][2] for n in LISTS)}</td>" for k in ORDER) + f"<td><b>{grand[0]} = {grand[1]} + {grand[2]}</b></td></tr>")
    recon = ('<div class="table" tabindex="0" aria-label="Split reconciliation"><table class="recon"><thead><tr><th scope="col">List</th>'
             + "".join(f'<th scope="col">{KIND[k][1]}</th>' for k in ORDER) + '<th scope="col">Total</th></tr></thead><tbody>'
             + "".join(recon_rows) + "</tbody></table></div>")
    decs = "".join(f'<li><span class="who">{E(tag(s))}</span> {E(d)}</li>' for d, s in decisions())
    outs = "".join(f'<li><span class="who">{E(tag(data.OUTSIDE_STREAM[t]))}</span> <b>{E(t)}.</b> {E(d)}</li>' for t, d in outside())
    return TEMPLATE.format(ts=E(ts), stats="".join(stat), recon=recon, decisions=decs, outside=outs,
                           cases3=cases_dl(data.U03_CASES), cases4=cases_dl(data.U04_CASES), cases2=cases_dl(data.U02_CASES),
                           part1=stream_part(1), part2=stream_part(2), grand=grand[0], g1=grand[1], g2=grand[2])

TEMPLATE = """<title>Streams 1–2 Exit Checklists</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@87,600;87,700&family=IBM+Plex+Mono:wght@500&family=Public+Sans:wght@400;500;600&display=swap">
<style>
/* Layout: one reading column; the split and its reconciliation first, then each stream's three tables. */
:root {{
  --bg: #f3f6f7; --surface: #ffffff; --ink: #16202a; --muted: #566573; --line: #d7dfe4; --accent: #0b6fae;
  --done: #1d7549; --done-bg: #e2f2e8; --todo: #0b6fae; --todo-bg: #e5f0f8; --confirm: #845600; --confirm-bg: #fbefd6;
  --block: #4b5763; --block-bg: #e9edf0; --decide: #6340b0; --decide-bg: #eee7fa; --na: #6f7c88;
  --f-display: "Archivo", "Helvetica Neue", Arial, sans-serif;
  --f-body: "Public Sans", "Helvetica Neue", Arial, sans-serif;
  --f-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg: #0e1419; --surface: #151d24; --ink: #e3eaef; --muted: #98a6b2; --line: #27333d; --accent: #5cb5ee;
  --done: #72d39f; --done-bg: #16301f; --todo: #80c6f2; --todo-bg: #12283a; --confirm: #efc46c; --confirm-bg: #372b12;
  --block: #aab6c0; --block-bg: #222c34; --decide: #bb9ff3; --decide-bg: #2a2140; --na: #8794a0; color-scheme: dark; }} }}
:root[data-theme="dark"] {{
  --bg: #0e1419; --surface: #151d24; --ink: #e3eaef; --muted: #98a6b2; --line: #27333d; --accent: #5cb5ee;
  --done: #72d39f; --done-bg: #16301f; --todo: #80c6f2; --todo-bg: #12283a; --confirm: #efc46c; --confirm-bg: #372b12;
  --block: #aab6c0; --block-bg: #222c34; --decide: #bb9ff3; --decide-bg: #2a2140; --na: #8794a0; color-scheme: dark; }}
body {{ background: var(--bg); color: var(--ink); font: 400 15px/1.55 var(--f-body); }}
.wrap {{ max-width: 1120px; margin: 0 auto; padding-inline: 20px; padding-block: 36px 64px; display: grid; gap: 40px; }}
header {{ display: grid; gap: 10px; max-width: 72ch; }}
.eyebrow {{ font: 600 12px/1 var(--f-body); letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }}
h1 {{ font: 700 clamp(28px, 4vw, 40px)/1.1 var(--f-display); font-stretch: 87%; margin: 0; text-wrap: balance; }}
h2 {{ font: 700 22px/1.2 var(--f-display); font-stretch: 87%; margin: 0; text-wrap: balance; }}
h3 {{ font: 600 15px/1.3 var(--f-body); margin: 0; }}
h4 {{ font: 600 12px/1 var(--f-body); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin: 6px 0 0; }}
p {{ margin: 0; }}
.lede {{ color: var(--muted); font-size: 16px; }}
section {{ display: grid; gap: 16px; }}
.summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }}
.stat {{ background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px; display: grid; gap: 8px; min-width: 0; }}
.stat h3 {{ display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 8px; }}
.stat h3 span {{ color: var(--muted); font-weight: 500; }}
.stat .open {{ font-weight: 600; color: var(--todo); }}
.bar {{ display: flex; height: 8px; border-radius: 4px; overflow: hidden; gap: 2px; background: var(--line); }}
.seg.done {{ background: var(--done); }} .seg.confirm {{ background: var(--confirm); }} .seg.todo {{ background: var(--todo); }}
.seg.block {{ background: var(--block); }} .seg.decide {{ background: var(--decide); }} .seg.na {{ background: var(--na); opacity: .5; }}
.counts {{ list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; color: var(--muted); }}
.counts b {{ color: var(--ink); font-variant-numeric: tabular-nums; }}
.dot {{ display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; }}
.dot.done {{ background: var(--done); }} .dot.confirm {{ background: var(--confirm); }} .dot.todo {{ background: var(--todo); }}
.dot.block {{ background: var(--block); }} .dot.decide {{ background: var(--decide); }} .dot.na {{ background: var(--na); }}
.recon td, .recon th {{ font-variant-numeric: tabular-nums; white-space: nowrap; }}
.recon tr.all th, .recon tr.all td {{ font-weight: 600; background: var(--bg); }}
.ok {{ color: var(--done); font-weight: 600; }}
.ask {{ background: var(--decide-bg); border: 1px solid color-mix(in srgb, var(--decide) 35%, transparent); border-radius: 10px; padding: 18px 20px; display: grid; gap: 10px; }}
.ask h2 {{ font-size: 18px; color: var(--ink); }}
.ask ol, .cols ul {{ margin: 0; padding-left: 20px; display: grid; gap: 6px; max-width: 84ch; }}
.who {{ display: inline-block; font: 600 11px/1.4 var(--f-body); letter-spacing: .05em; text-transform: uppercase; color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; margin-right: 4px; }}
.rules {{ display: grid; gap: 8px; max-width: 78ch; color: var(--ink); }}
.rules ul {{ margin: 0; padding-left: 20px; display: grid; gap: 4px; }}
.legend {{ display: flex; flex-wrap: wrap; gap: 8px; }}
.cases {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 6px 20px; margin: 0; }}
.cases div {{ min-width: 0; }}
.cases dt {{ font-weight: 600; font-size: 14px; }}
.cases dd {{ margin: 0; color: var(--muted); font-size: 13.5px; }}
code {{ font: 500 12.5px/1 var(--f-mono); color: var(--accent); }}
.part {{ border-top: 3px solid var(--accent); padding-top: 20px; }}
.part-head {{ display: grid; gap: 6px; }}
h3.list {{ margin-top: 8px; }}
.table {{ overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }}
table {{ border-collapse: collapse; width: 100%; min-width: 760px; }}
table.recon {{ min-width: 640px; }}
th, td {{ text-align: left; vertical-align: top; padding: 10px 12px; border-top: 1px solid var(--line); }}
thead th {{ border-top: 0; font: 600 12px/1.2 var(--f-body); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); background: var(--bg); }}
tbody th {{ font-weight: 600; width: 26%; }}
.recon tbody th {{ width: auto; }}
tr.group th {{ background: var(--bg); font: 700 13px/1.2 var(--f-display); font-stretch: 87%; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); padding-block: 8px; }}
.note {{ display: block; font-weight: 400; font-size: 13px; color: var(--muted); }}
.chips {{ display: flex; flex-wrap: wrap; gap: 6px; }}
.chip {{ display: inline-flex; align-items: baseline; gap: 6px; padding: 3px 8px; border-radius: 6px; font-size: 13px; line-height: 1.35; border: 1px solid transparent; max-width: 100%; }}
.chip .sym {{ font-weight: 700; }}
.chip .ref {{ font: 500 11.5px/1 var(--f-mono); opacity: .8; }}
.chip.done {{ background: var(--done-bg); color: var(--done); }}
.chip.todo {{ background: var(--todo-bg); color: var(--todo); border-color: color-mix(in srgb, var(--todo) 40%, transparent); }}
.chip.confirm {{ background: var(--confirm-bg); color: var(--confirm); }}
.chip.block {{ background: var(--block-bg); color: var(--block); }}
.chip.decide {{ background: var(--decide-bg); color: var(--decide); }}
.chip.na {{ color: var(--na); border-color: var(--line); }}
.sr {{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }}
.cols {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }}
.cols > div {{ display: grid; gap: 10px; min-width: 0; }}
footer {{ color: var(--muted); font-size: 13px; border-top: 1px solid var(--line); padding-top: 16px; }}
@media (max-width: 480px) {{ .wrap {{ padding-inline: 16px; padding-block: 24px 48px; gap: 32px; }} }}
</style>
<div class="wrap">
  <header>
    <span class="eyebrow">Pantopus · Streams 1 and 2 · split on 2026-09-30</span>
    <h1>Streams 1–2 exit checklists</h1>
    <p class="lede">The former Stream 1's approved checklists, split in two. Stream 1 takes Support Trains and coordination; Stream 2 takes Posts, Pulse, Start, Hub and the money screens. Every item sits in exactly one stream, and the two add up to the totals before the split.</p>
  </header>

  <section aria-labelledby="split">
    <h2 id="split">The split adds up</h2>
    <p>Each cell reads <i>before the split = Stream 1 + Stream 2</i>. All <b>{grand}</b> items are accounted for: <b>{g1}</b> in Stream 1 and <b>{g2}</b> in Stream 2. <span class="ok">✓ Checked by the generator.</span></p>
    {recon}
  </section>

  <section aria-labelledby="sum">
    <h2 id="sum">Where each stream stands</h2>
    <div class="summary">{stats}</div>
  </section>

  <section class="ask" aria-labelledby="ask">
    <h2 id="ask">Decisions</h2>
    <ol>{decisions}</ol>
  </section>

  <section aria-labelledby="done">
    <h2 id="done">What "done" means</h2>
    <div class="rules">
      <ul>
        <li>A row closes when every client cell is done, not offered on that client, a named boundary, or your decision.</li>
        <li>"Confirm" items are checked against the sealed evidence first. If that evidence covers them, they're done with no rerun; if not, they become to-do.</li>
        <li>Anything found broken gets the smallest fix, before-and-after evidence in the real apps, and exact cleanup. A fix that changes how a screen looks comes to you first.</li>
      </ul>
      <div class="legend" aria-label="Legend">
        <span class="chip done"><span class="sym" aria-hidden="true">✓</span>Done, with sealed evidence</span>
        <span class="chip confirm"><span class="sym" aria-hidden="true">?</span>Confirm from existing evidence</span>
        <span class="chip todo"><span class="sym" aria-hidden="true">○</span>To do</span>
        <span class="chip decide"><span class="sym" aria-hidden="true">◆</span>Your call</span>
        <span class="chip block"><span class="sym" aria-hidden="true">⊘</span>Boundary</span>
        <span class="chip na"><span class="sym" aria-hidden="true">–</span>Not offered on that client</span>
      </div>
      <h3>U03 edge cases</h3>{cases3}
      <h3>U04 lifetimes</h3>{cases4}
      <h3>U02 accessibility</h3>{cases2}
    </div>
  </section>
{part1}
{part2}
  <section class="cols" aria-label="Outside the checklists">
    <div>
      <h2>Outside this plan</h2>
      <ul>{outside}</ul>
    </div>
  </section>

  <footer>Updated {ts}. Each stream's status file holds its canonical copy and tracks progress: <code>01-trains-coordination.md</code> and <code>02-posts-hub-payments.md</code>; the frozen reconciliation is in <code>former-stream1-gigs-payments.md</code>. No hosted, provider or physical-device claim; money journeys aren't rerun.</footer>
</div>
"""

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    if mode == "check":
        r = reconcile()
        for n in LISTS:
            print(n, {k: f"{v[0]}={v[1]}+{v[2]}" for k, v in r[n].items()})
        print("OK: at the split, Stream 1 + Stream 2 equal the pre-split totals")
        print("\n".join(progress()))
    elif mode == "md":
        print(markdown(int(sys.argv[2]), sys.argv[3], sys.argv[4]))
    elif mode == "recon":
        print(recon_md(sys.argv[2], sys.argv[3]))
    elif mode == "html":
        print(page(sys.argv[2]))
    else:
        raise SystemExit(__doc__)
