"""Generate the v3 Claude Design prompt pack page from pack-manifest.json. Output: docs/notes/design-prompt-pack.html,
which is published to the pack's artifact URL (HANDOFF §3: read the artifact first, then publish this file to that url)."""
import json, html, os, re
N = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(N, 'design-prompt-pack.html')
e = html.escape
M = json.load(open(os.path.join(N, 'pack-manifest.json')))
HS = open(os.path.join(N, 'house-style-v2.txt')).read().strip()
brief = open(os.path.join(N, 'ux-research-brief.md')).read()
R = json.load(open(os.path.join(N, 'research-raw.json')))
srcs = sorted({u for r in R for p in r['principles'] for u in p['sources']})
principles = []
for line in brief.splitlines():
    m = re.match(r'\|\s*(P\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$', line)
    if m: principles.append(m.groups())
def md_inline(s):
    s = e(s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'`(.+?)`', r'<code>\1</code>', s)
    return s
PLAT = {'web': 'Web', 'ios': 'iOS', 'android': 'Android'}
TOTAL_ART = sum(x['artboards'] for x in M)
TOTAL_WORDS = sum(len(x['text'].split()) for x in M)
count = {s: sum(1 for x in M if x['section'] == s) for s in ['foundations', 'screens', 'journeys']}

def row(x, n):
    pl = ''.join(f'<span class="pl">{PLAT.get(p, p)}</span>' for p in x['platforms'])
    tcls = {'New': 'k-new', 'Extend': 'k-ext', 'Setup': 'k-set', 'Component': 'k-cmp', 'Storyboard': 'k-sto'}.get(x['type'], 'k-ext')
    words = len(x['text'].split())
    att = f'<div class="att"><span class="lab">Attach</span>{e(x["attach"])}</div>' if x.get('attach') and x['attach'].lower().strip(' .') not in ('none',) else ''
    return f'''<article class="pr" id="{e(x['id'])}" data-section="{x['section']}" data-type="{e(x['type'])}" data-plat="{' '.join(x['platforms'])}" data-group="{e(x['group'])}">
  <div class="prh">
    <label class="sent" title="Mark as sent"><input type="checkbox" data-id="{e(x['id'])}" aria-label="Mark {e(x['name'])} as sent"><span></span></label>
    <span class="num">{n:03d}</span>
    <div class="tt"><h3>{e(x['name'])}</h3><code class="pid">{e(x['id'])}</code></div>
    <div class="meta"><span class="k {tcls}">{e(x['type'])}</span>{pl}<span class="ct">{x['artboards']} artboards</span><span class="ct">{words:,} words</span></div>
    <div class="acts"><button class="btn copy" data-t="{e(x['id'])}">Copy prompt</button><button class="btn ghost tog" aria-expanded="false" aria-controls="b-{e(x['id'])}">Show</button></div>
  </div>
  <p class="job">{e(x['job'])}</p>{att}
  <pre class="body" id="b-{e(x['id'])}" hidden>{e(x['text'])}</pre>
</article>'''

def section(key, title, intro):
    items = [x for x in M if x['section'] == key]
    out, g, n0 = '', None, sum(1 for x in M if ['foundations', 'screens', 'journeys'].index(x['section']) < ['foundations', 'screens', 'journeys'].index(key))
    for i, x in enumerate(items, 1):
        if x['group'] != g:
            if g is not None: out += '</div>'
            g = x['group']; k = sum(1 for y in items if y['group'] == g)
            out += f'<div class="grp"><h3 class="gh">{e(g)} <span>{k}</span></h3>'
        out += row(x, n0 + i)
    out += '</div>'
    return f'<section class="sec" id="sec-{key}"><div class="sech"><h2>{title}</h2><span class="secn">{len(items)} prompts · {sum(x["artboards"] for x in items):,} artboards</span></div><p class="intro">{intro}</p>{out}</section>'

GUIDE = [
 ("Publish the Pantopus design system in Claude Design",
  "Claude Design reads design systems as published, org-level objects. It does not document opening another project from a share link, so don't rely on the two share links for that. A “Pantopus” design system was already extracted from this repo on 16 Sep: <a href=\"https://claude.ai/artifact/MCub8DTnkdhoFnMbtF8QF5\">Pantopus design system</a> (107 colours in 3 themes, 33 text styles, spacing, radius and shadow tokens, and 50 real web components). You can rebuild it with <code>node tools/design-system/build.mjs</code>. Use it as the source, and make sure the design system Claude Design uses carries real material, not just specs:<ul>"
  "<li>the token files: <code>frontend/packages/theme/src/</code> (colors, typography, spacing, radii, shadows, css-variables), iOS <code>Core/Design/</code>, Android <code>ui/theme/</code> and web <code>globals.css</code> plus <code>tailwind.config.js</code></li>"
  "<li>your two existing Pantopus Claude Design projects (export them and upload, or publish them if they already are the system)</li>"
  "<li>screenshots of today's core screens (Place, Today, Nearby and Mail on web, iOS and Android)</li></ul>"
  "Then switch <b>Published</b> on. Every project you create from the homescreen after that uses it automatically."),
 ("Design the Foundations first: four projects, one per board",
  "Create a project for each board (00a, 00b, 00c, 00d). In each one, paste the <b>house style</b>, send the board's <b>setup</b> prompt, and wait for “ready”. Then send one <b>component</b> prompt per turn, typing “continue” between artboard batches. When you accept a component, add it to the design system under its exact name. These 36 components are how 59 separately designed screens come out identical."),
 ("Then the screens, one project per screen, in build order",
  "Create each project from the homescreen. Paste the house style, then the screen prompt. Attach the screenshots listed under <b>Attach</b>: for an <b>Extend</b> prompt, the existing screen is the source of truth. Claude Design draws at most 6 artboards per turn; reply “continue” to get the next batch. Batch 1 holds the must-have frames. The later batches cover the remaining states, platforms, large text, greyscale and dark mode."),
 ("Export after every batch you accept",
  "Claude Design has no version history yet, so export HTML or PDF into <code>docs/design/exports/&lt;prompt-id&gt;/</code> each time. The journey storyboards attach these exports."),
 ("Last, the journey storyboards",
  "Each storyboard lays out finished screens as one connected journey, so you can see where the handoffs break: what is carried across, what the person sees at each moment of truth, and where each failure branch goes. Fix what they reveal in the screen projects."),
 ("Review every artboard against the same checklist",
  "Text contrast is at least 4.5:1 and graphics at least 3:1. Targets are 44pt / 48dp. Provenance marks mean official / on record, not confirmed / you added this, and nothing else. The only scope strings are “Saved place · Only you” and “Your household”. Silence shows its receipt. No percentages, streaks or confetti. It reads correctly in greyscale and at the largest text size. Give element-level feedback with inline comments; ask for 2–3 options only where the form is genuinely open."),
]
guide = ''.join(f'<li><h3>{t}</h3><div>{d}</div></li>' for t, d in GUIDE)

CHANGED = [
 ("One shared world.", "v1 invented 40 different addresses across 37 prompts, three different “today” dates and three HOA amounts, so separately designed screens could never agree. Every prompt now uses the same fixtures: Maya and Sam at 2418 NE Larkspur Loop, Jordan's saved place at 1107 NE Birchfield Ct, and Dana as the friend who sends a compare card, all on Mon 19 Oct 2026."),
 ("Foundations before screens.", "40 components were named in many prompts but specified in only one. They now get four specimen boards, split into a setup and one prompt per component, because instruction-following accuracy drops as instruction density rises."),
 ("Research-backed.", f"13 research topics with web search produced {sum(len(r['principles']) for r in R)} principles from {len(srcs)} sources. They are distilled into 22 rules (below) and applied surface by surface. 164 v1 decisions that the evidence contradicted were changed."),
 ("Accessibility built in.", "Contrast is computed from your own tokens: <code>text.muted</code> fails at 2.54:1, and white on <code>primary.DEFAULT</code> fails at 4.10:1, so buttons and links move to <code>primary.700</code> (5.93:1). Every screen gets a largest-text frame and a greyscale frame. Targets are 44pt / 48dp, with no gesture-only actions and no timed undo."),
 ("Honest onboarding.", "The address preview comes before any account wall. A held address is never retyped. Email verification never blocks the save, and a pasteable code sits next to the link. There are no tours. At most three first-week asks sit inline, with no completion fractions. Notification permission is asked only right after an action that makes the purpose obvious."),
 ("Facts corrected.", "Clark County's second-half property tax is due Mon 2 Nov: 31 Oct is a Saturday, so the due date moves (RCW 1.12.070). Flood, wildfire and radon each use their authority's own scale and words, never a combined grade and never “100-year”. Voter registration deadlines are shown per method, with no claim about anyone's registration status."),
 ("Nothing lost, then reviewed twice.", "Content was restored from the 90 pre-merge proposals and the 48 review findings. Every screen, Foundations and journey prompt was rewritten, checked by two independent reviewers (one for lost substance, one for UX quality), fixed, re-checked and fixed again. Two honest limits: the last round of fixes was not re-checked, and there was no pack-wide pass to reconcile wording between prompts. If two prompts disagree, follow the house style first, then the Foundations boards."),
 ("Journeys, not just screens.", "14 storyboards connect the screens: stranger to activated, the weekly pickup loop, a lease date through to its reminder, inviting a co-resident, the compare card, claiming a home, widget discovery, mail snap, the keeper, alerts, reporting a wrong fact, a dead invitation, a mover's voter deadline, and moving from web to the app."),
 ("Prompt structure Claude Design can follow.", "Every screen prompt has ATTACH, FIRST FIVE SECONDS, INSTEAD OF (what to draw, not only what to avoid), DONE WHEN, an exact ARTBOARDS manifest and a BATCH PLAN of at most 6 per turn. Warmth is written as concrete specs (system sans, radii, spacing, elevation), because vague mood words pull the model toward its default cream-and-serif look."),
]
changed = ''.join(f'<li><b>{t}</b> {d}</li>' for t, d in CHANGED)

DECISIONS = [
 "The compare card shows each hazard on its authority's own scale. The design doc's F8 letter grades (flood “A”, and so on) are replaced, following the research: never combine layers into a grade. Confirm this change to F8's token payload.",
 "The first-week window is 7 days, matching the activation definition, not the 14 days F2 and the place file used.",
 "Keeper naming opens only from a tap, never auto-presented on the “second Today open” that F11 describes.",
 "Should members be able to record “I paid this” on bills? That changes the finance.view permission model, so the prompts only name who can mark a bill paid.",
 "How long are mail-snap photos kept by default, and what hysteresis margin applies to air alerts? No sourced number exists, so the prompts leave both open.",
 "Should “Block Founder” and “Founding Neighbor” be renamed? The prompts recommend a quick confusion test first.",
 "Keeper art: 6 species × 4 moods plus widget variants is a real illustration budget. Commission it, cut to 3 species, or ship only the fact count.",
 "Android dark mode. The extracted design system notes that Android ships light-only in practice, yet the prompts ask for Android dark twins. Keep them (to prepare dark support) or skip them and save about a sixth of the Android artboards.",
 "Fix the contrast at the source too. The design-system extraction measured the same failures these prompts design around: white on primary-600 is 4.10:1 (buttons, TextButton, TabStrip), the primary-500 focus ring is 2.77:1, and the dark warning toast is 1.73:1. The prompts use primary.700, but the shipped components still need the change.",
 "Holiday pickup moves in the storyboards (Thanksgiving: Thu 26 Nov → Fri 27 Nov for Camas) are illustrative. Check them against the city's published calendar before the pilot.",
]
decisions = ''.join(f'<li>{d}</li>' for d in DECISIONS)
ptable = ''.join(f'<tr><td class="pn">{e(p[0])}</td><td>{md_inline(p[1])}</td><td class="ev">{md_inline(p[2])}</td></tr>' for p in principles)

CSS = open(os.path.join(N, 'gen_pack_v3.css')).read()
JS = open(os.path.join(N, 'gen_pack_v3.js')).read()
page = f'''<title>Pantopus Design Prompt Pack</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>{CSS}</style>
<div class="wrap">
<header>
  <div class="eyebrow">Claude Design prompt pack · v3 · researched, rewritten, reviewed twice</div>
  <h1>Every Pantopus prompt, in the order to send it</h1>
  <p class="lede">{len(M)} prompts: <b>{count['foundations']} Foundations</b> (the shared components, designed first), <b>{count['screens']} screens</b> in build order, and <b>{count['journeys']} journey storyboards</b> that connect them. Each prompt is self-contained: real content at realistic density, the specific visualization, every state as a named artboard, and what to attach.</p>
  <div class="stats">
    <div class="st"><span class="v">{len(M)}</span><span class="l">prompts</span></div>
    <div class="st"><span class="v">{TOTAL_ART:,}</span><span class="l">artboards</span></div>
    <div class="st"><span class="v">{len(principles)}</span><span class="l">research rules</span></div>
    <div class="st"><span class="v">{len(srcs)}</span><span class="l">sources</span></div>
    <div class="st prog"><span class="v"><span id="sentN">0</span>/{len(M)}</span><span class="l">marked sent (saved in this browser)</span></div>
  </div>
</header>
<nav class="bar" aria-label="Sections and filters">
  <div class="tabs"><a href="#sec-guide">Setup</a><a href="#sec-house">House style</a><a href="#sec-foundations">Foundations</a><a href="#sec-screens">Screens</a><a href="#sec-journeys">Journeys</a><a href="#sec-research">Research</a></div>
  <div class="filters">
    <input id="q" type="search" placeholder="Search prompts…" aria-label="Search prompts">
    <select id="fp" aria-label="Platform"><option value="">All platforms</option><option value="web">Web</option><option value="ios">iOS</option><option value="android">Android</option></select>
    <select id="ft" aria-label="Type"><option value="">All types</option><option>Setup</option><option>Component</option><option>New</option><option>Extend</option><option>Storyboard</option></select>
    <label class="chk"><input type="checkbox" id="hs"> Hide sent</label>
    <span id="shown" class="shown" aria-live="polite"></span>
  </div>
</nav>

<section class="sec" id="sec-guide"><div class="sech"><h2>How to run this in Claude Design</h2></div>
<ol class="guide">{guide}</ol></section>

<section class="sec" id="sec-house"><div class="sech"><h2>House style</h2><span class="secn">{len(HS.split()):,} words · paste first in every project</span></div>
<p class="intro">This block is the contract every project starts from: the product, the user, the platforms, the four tabs, concrete visual specs, tokens and how to use them, the shared fixtures, the six invariants, accessibility, microcopy, push rules, motion, the artboard convention, and what to avoid.</p>
<div class="hs"><div class="hsh"><button class="btn copy" data-t="house">Copy house style</button><button class="btn ghost tog" aria-expanded="false" aria-controls="b-house">Show</button></div>
<pre class="body" id="b-house" hidden>{e(HS)}</pre></div></section>

{section('foundations', 'Foundations', 'Design these first. Each board is one project: send its setup prompt, then one component prompt per turn. Accept each component into the design system under its exact name.')}
{section('screens', 'Screens', 'One project per screen, in build order. <b>Extend</b> prompts change a screen that already exists in your design system, and the attached screenshot is the source of truth. <b>New</b> prompts design a screen that does not exist yet.')}
{section('journeys', 'Journey storyboards', 'Send these last. Attach the exported artboards each one lists, then fix in the screen projects whatever breaks between screens. <b>These prompts are long (6,000–13,000 words)</b>, because each one cites the exact exports, deltas and failure branches of a whole journey. Paste the full prompt once, then follow its BATCH PLAN turn by turn, typing “continue”. If Claude Design drops detail, resend only the section for the current turn.') if count['journeys'] else ''}

<section class="sec" id="sec-research"><div class="sech"><h2>What changed, and why</h2></div>
<ul class="changed">{changed}</ul>
<h3 class="sub">Decisions only you can make</h3>
<ul class="dec">{decisions}</ul>
<h3 class="sub">The {len(principles)} research rules behind every prompt</h3>
<div class="tw"><table class="pt"><thead><tr><th>#</th><th>Rule</th><th>Evidence</th></tr></thead><tbody>{ptable}</tbody></table></div>
<details class="srcs"><summary>All {len(srcs)} sources</summary><ol>{''.join(f'<li><a href="{e(u)}" rel="noopener" target="_blank">{e(u)}</a></li>' for u in srcs)}</ol></details>
</section>

<footer>Companion to the <a href="https://claude.ai/artifact/UBJqjLk21M3XCygvShZE41">Pantopus Screen Inventory</a>. Built 16–17 September 2026 from <code>docs/first-person-loop-design-2026-09-16.md</code>, the Pantopus codebase and 13 UX research topics. Working files: <code>docs/notes/</code>.</footer>
</div>
<script>{JS}</script>'''
open(OUT, 'w').write(page)
print('wrote', OUT, f'{len(page):,} bytes', len(M), 'prompts', TOTAL_ART, 'artboards', TOTAL_WORDS, 'words', len(principles), 'principles', len(srcs), 'sources')
