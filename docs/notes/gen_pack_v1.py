import json, html, collections
OUT='/private/tmp/claude-501/-Users-yingpengwang-skinny-pantopus/52b514da-4f75-4fbb-ab66-72632a65dbcb/scratchpad/design-prompt-pack.html'
prompts=json.load(open('/Users/yingpengwang/skinny-pantopus/docs/notes/design-prompts.json'))
b=json.load(open('/Users/yingpengwang/skinny-pantopus/docs/notes/wf-raw-results.json'))
f=[v for v in b.values() if isinstance(v,dict) and 'headline' in v][0]
inv={s['id']:s for s in f['inventory']}
bo=f['buildOrder']
e=html.escape
PLAT={'web':'W','ios':'iOS','android':'And'}
PHASE=[('loop','Before the pilot'),('pilot','At the pilot'),('phase2','After the first read')]
PHT=dict(PHASE)

byid={p['id']:p for p in prompts}
ordered=[byid[i] for i in bo if i in byid]

PREAMBLE = """PANTOPUS HOUSE STYLE — paste this once at the top of your Claude Design session, then send any screen prompt below.

DESIGN SYSTEM. Before designing, open these two projects and use them as the source of truth for every token, component and layout convention:
  https://claude.ai/design/p/019e16cb-d2a9-77b0-b9e0-370dbe3856ba?via=share
  https://claude.ai/design/p/c65a37ac-191a-4cdc-9f30-602926979fd6?via=share
All existing Pantopus screens are already designed there. Match them. Do not invent a new visual language, card style, type scale or icon set.

DESIGN DIRECTION: clean, trustworthy, warm.

TOKENS (shared source of truth, mirrored on iOS and Android — use these names, never raw hex):
  Primary sky-blue ramp 50-900 · primary.DEFAULT #0284c7 · primary.500 #0ea5e9 · primary.700 #0369a1
  Surfaces: base #FFFFFF · raised #F9FAFB · sunken #F3F4F6 · app #F6F7F9 · muted #F8FAFC
  Text: primary #111827 · strong #374151 · secondary #6B7280 · muted #9CA3AF · inverse #FFFFFF
  Borders: default #E5E7EB · strong #D1D5DB · focus #0284c7 · subtle #F3F4F6
  Semantic: success #059669 / bg #F0FDF4 · warning #D97706 / bg #FFFBEB · error #DC2626 / bg #FEF2F2 · info #0284c7 / bg #F0F9FF
  Identity pillars: personal #0284C7 · home #16A34A · business #7C3AED · professional #D97706
  Dark mode: surface base #0F172A · raised #1E293B · app #020617 · text primary #E5E7EB · secondary #94A3B8 · border default #1F2937 · focus #38BDF8
  Type scale: h1 30/36/700 · h2 24/32/600 · h3 20/28/600 · body 16/24/400 · bodySmall 14/20/400 · label 13/18 · caption 12/16/400 · overline 11/16/600 uppercase +0.5 tracking

HOUSE RULE: every colour is a semantic token. The codebase forbids a hex literal anywhere in Features/**. If a colour you want is not in the list above, you are designing something the system cannot express — pick the nearest token instead.

DRAW BOTH LIGHT AND DARK.

HONESTY RULES (product rules, not style preferences — they must be visible in the pixels):
  1. Unverified data must look unverified. Anything from a city default rather than confirmed by the household carries a visible "unconfirmed" treatment, consistently, on every surface it appears on — calendar row, push, widget, share card. Design that treatment once and reuse it.
  2. "Only you" vs "your household." A saved place is private; a claimed home is shared with co-residents. Every surface showing address data says which it is.
  3. Never imply a claim about a neighbour's home. Comparison surfaces are about places and sources, never "your neighbour's house."
  4. Silence is a designed state. "Nothing needs your attention today" is a state, not an error or an empty shell — and it shows only when every check actually succeeded.
  5. Sources are shown, not hidden. Where a fact comes from a public dataset, the source is on the surface: "FEMA flood zone", "AirNow, today", "County radon zone (EPA)".

PLATFORMS AND VIEWPORTS:
  Web: 1440x900 desktop and 390x844 mobile web. Four-tab bottom bar on mobile, left sidebar on desktop.
  iOS: 393x852 (iPhone 15/16 Pro). Native nav patterns, sheets with detents.
  Android: 412x915. Material 3 patterns, bottom sheets.
  NAVIGATION IS FIXED AT FOUR TABS: Place - Today - Nearby - Mail. Do not add a tab, rename one, or propose a fifth. Every screen must be reachable from those four plus deep links."""

cards=''
seen=None
nav=[]
for i,p in enumerate(ordered,1):
    s=inv.get(p['id'],{})
    ph=s.get('phase','loop')
    if ph!=seen:
        if seen is not None: cards+='</section>'
        n=sum(1 for q in ordered if inv.get(q['id'],{}).get('phase')==ph)
        nav.append((ph,PHT.get(ph,ph),n))
        cards+=f'<section class="ph" id="ph-{ph}"><div class="phh"><h2 class="pht">{PHT.get(ph,ph)}</h2><span class="phn">{n} prompts</span></div>'
        seen=ph
    kind='New' if p.get('isNew') else 'Extend'
    kcls='new' if p.get('isNew') else 'ext'
    pl=''.join(f'<span class="p">{PLAT.get(x,x)}</span>' for x in p.get('platforms',[]))
    fc=p.get('frameCount',0)
    disp=s.get('disposition','')
    cards+=f'''<article class="card" id="{e(p['id'])}">
  <div class="ch">
    <span class="num">{i:02d}</span>
    <div class="cht">
      <h3>{e(p['name'])}</h3>
      <code class="cid">{e(p['id'])}</code>
    </div>
    <div class="cm"><span class="k k-{kcls}">{kind}</span>{pl}<span class="fc">{fc} frames</span>
      <button class="copy" data-t="{e(p['id'])}">Copy</button></div>
  </div>
  <pre class="pt" id="t-{e(p['id'])}">{e(p['promptText'])}</pre>
</article>'''
cards+='</section>'

navhtml=''.join(f'<a href="#ph-{k}">{t} <span>{n}</span></a>' for k,t,n in nav)
total_frames=sum(p.get('frameCount',0) for p in prompts)
new_n=sum(1 for p in prompts if p.get('isNew'))

HTML=f'''<title>Pantopus Design Prompt Pack</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>
:root{{
  --ink:#111827; --ink2:#374151; --ink3:#6B7280; --ink4:#9CA3AF;
  --bg:#F6F7F9; --card:#FFFFFF; --raised:#F9FAFB; --sunken:#F3F4F6;
  --line:#E5E7EB; --line2:#D1D5DB;
  --pri:#0284c7; --pri-bg:#F0F9FF; --pri-ink:#0369a1;
  --ok:#059669; --ok-bg:#F0FDF4; --warn:#D97706; --warn-bg:#FFFBEB;
  --err:#DC2626; --err-bg:#FEF2F2; --vio:#7C3AED;
  --sans:'IBM Plex Sans',ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{
  --ink:#E5E7EB; --ink2:#F1F5F9; --ink3:#94A3B8; --ink4:#64748B;
  --bg:#020617; --card:#0F172A; --raised:#1E293B; --sunken:#111827;
  --line:#1F2937; --line2:#374151;
  --pri:#38BDF8; --pri-bg:#0c2537; --pri-ink:#7dd3fc;
  --ok:#34D399; --ok-bg:#062b22; --warn:#FBBF24; --warn-bg:#2e2008;
  --err:#F87171; --err-bg:#2c1010; --vio:#C4B5FD;
}}}}
:root[data-theme="dark"]{{
  --ink:#E5E7EB; --ink2:#F1F5F9; --ink3:#94A3B8; --ink4:#64748B;
  --bg:#020617; --card:#0F172A; --raised:#1E293B; --sunken:#111827;
  --line:#1F2937; --line2:#374151;
  --pri:#38BDF8; --pri-bg:#0c2537; --pri-ink:#7dd3fc;
  --ok:#34D399; --ok-bg:#062b22; --warn:#FBBF24; --warn-bg:#2e2008;
  --err:#F87171; --err-bg:#2c1010; --vio:#C4B5FD;
}}
*{{box-sizing:border-box}}
body{{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.55;
  -webkit-font-smoothing:antialiased;margin:0;padding:0 20px 96px}}
.wrap{{max-width:980px;margin:0 auto}}
h1,h2,h3{{text-wrap:balance;margin:0}}
code{{font-family:var(--mono)}}

header{{padding:52px 0 26px;border-bottom:2px solid var(--ink);margin-bottom:0}}
.eyebrow{{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--pri);margin-bottom:14px}}
h1{{font-size:38px;line-height:1.1;font-weight:700;letter-spacing:-.022em;max-width:18ch}}
.lede{{font-size:17px;line-height:1.52;color:var(--ink2);max-width:62ch;margin-top:15px}}
.lede b{{font-weight:600;color:var(--ink)}}
.stats{{display:flex;gap:26px;flex-wrap:wrap;margin-top:22px}}
.st{{display:flex;flex-direction:column}}
.st .v{{font-family:var(--mono);font-size:26px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums}}
.st .l{{font-size:11.5px;color:var(--ink3);margin-top:4px}}

nav{{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid var(--line);
  padding:11px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px}}
nav a{{font-family:var(--mono);font-size:11.5px;font-weight:500;color:var(--ink3);text-decoration:none;
  padding:5px 10px;border:1px solid var(--line);border-radius:4px;background:var(--card);white-space:nowrap}}
nav a:hover{{color:var(--pri);border-color:var(--pri)}}
nav a span{{color:var(--ink4);margin-left:5px;font-variant-numeric:tabular-nums}}
nav a:focus-visible,button:focus-visible{{outline:2px solid var(--pri);outline-offset:2px}}

.how{{background:var(--card);border:1px solid var(--line);border-radius:7px;padding:20px 22px;margin:26px 0 8px}}
.how h2{{font-size:16px;font-weight:600;margin-bottom:8px}}
.how ol{{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:7px}}
.how li{{font-size:14.5px;color:var(--ink2);line-height:1.5}}
.how b{{color:var(--ink);font-weight:600}}
.warn{{margin-top:14px;padding:11px 14px;background:var(--warn-bg);border-left:3px solid var(--warn);
  border-radius:0 4px 4px 0;font-size:13.5px;color:var(--ink2);line-height:1.5}}

.pre-wrap{{margin:22px 0 10px}}
.pre-h{{display:flex;align-items:center;gap:12px;margin-bottom:9px;flex-wrap:wrap}}
.pre-h h2{{font-size:13px;font-family:var(--mono);font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3)}}
.pre-h .sub{{font-size:13px;color:var(--ink3);flex:1 1 auto}}

pre{{font-family:var(--mono);font-size:12px;line-height:1.62;background:var(--sunken);color:var(--ink2);
  border:1px solid var(--line);border-radius:6px;padding:16px 18px;margin:0;white-space:pre-wrap;
  word-break:break-word;max-height:400px;overflow:auto}}
pre.pre-a{{max-height:340px}}

button.copy{{font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
  padding:5px 11px;border-radius:4px;border:1px solid var(--pri);background:var(--pri-bg);color:var(--pri-ink);
  cursor:pointer;white-space:nowrap}}
button.copy:hover{{background:var(--pri);color:#fff}}
button.copy.done{{border-color:var(--ok);background:var(--ok-bg);color:var(--ok)}}
button.copy.fail{{border-color:var(--err);background:var(--err-bg);color:var(--err)}}

.ph{{margin-top:38px}}
.phh{{display:flex;align-items:baseline;gap:12px;padding-bottom:9px;border-bottom:1px solid var(--line2);margin-bottom:14px}}
.pht{{font-size:21px;font-weight:700;letter-spacing:-.01em}}
.phn{{font-family:var(--mono);font-size:12px;color:var(--ink3);font-variant-numeric:tabular-nums}}

.card{{background:var(--card);border:1px solid var(--line);border-radius:7px;padding:15px 17px 16px;margin-bottom:12px;scroll-margin-top:60px}}
.ch{{display:flex;align-items:flex-start;gap:13px;flex-wrap:wrap;margin-bottom:11px}}
.num{{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--ink4);font-variant-numeric:tabular-nums;padding-top:3px}}
.cht{{flex:1 1 300px;min-width:0}}
.cht h3{{font-size:17px;font-weight:600;letter-spacing:-.01em;line-height:1.3}}
.cid{{font-size:11px;color:var(--ink4);display:block;margin-top:2px}}
.cm{{display:flex;gap:6px;align-items:center;flex-wrap:wrap}}
.k{{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:3px 7px;border-radius:3px}}
.k-new{{background:var(--err-bg);color:var(--err)}}
.k-ext{{background:var(--ok-bg);color:var(--ok)}}
.p{{font-family:var(--mono);font-size:10px;font-weight:500;padding:3px 6px;border:1px solid var(--line2);border-radius:3px;color:var(--ink3)}}
.fc{{font-family:var(--mono);font-size:10.5px;color:var(--ink4);font-variant-numeric:tabular-nums}}

footer{{margin-top:56px;padding-top:20px;border-top:1px solid var(--line);font-size:12.5px;color:var(--ink4);line-height:1.7}}
footer a{{color:var(--pri)}}
@media(max-width:700px){{h1{{font-size:28px}} .lede{{font-size:15.5px}} .cm{{width:100%}} pre{{font-size:11px}}}}
@media(prefers-reduced-motion:reduce){{*{{transition:none!important;animation:none!important}}}}
</style>
<div class="wrap">
<header>
  <div class="eyebrow">Claude Design prompt pack &middot; first-person loop &middot; 16 September 2026</div>
  <h1>59 prompts, one per surface</h1>
  <p class="lede">Every surface in the <b>screen inventory</b>, written as a self-contained Claude&nbsp;Design prompt. Claude Design has no access to the repo, so each prompt carries its own real content at realistic density, its own visualization decision, and its own list of states to draw &mdash; <b>594 frames</b> in total.</p>
  <p class="lede">They are in build order. <b>{59-new_n} of the 59 are extensions</b> of screens already designed in your system, and those prompts say so explicitly &mdash; open the existing screen, keep everything, change only what is listed. Only {new_n} ask for a screen that does not exist yet.</p>
  <div class="stats">
    <div class="st"><span class="v">59</span><span class="l">prompts</span></div>
    <div class="st"><span class="v">{total_frames}</span><span class="l">frames to draw</span></div>
    <div class="st"><span class="v">{new_n}</span><span class="l">new screens</span></div>
    <div class="st"><span class="v">{59-new_n}</span><span class="l">extensions</span></div>
    <div class="st"><span class="v">~41k</span><span class="l">words of brief</span></div>
  </div>
</header>

<nav>{navhtml}<a href="#preamble">House style</a></nav>

<div class="how">
  <h2>How to use this</h2>
  <ol>
    <li>Open a Claude Design session and paste the <b>house style block</b> below <b>once</b>. It carries your design-system links, your real tokens, the honesty rules and the platform specs.</li>
    <li>Then send any single screen prompt. Each one opens with &ldquo;Use the Pantopus house style&hellip;&rdquo; and assumes the block is already in the session.</li>
    <li>Work in build order. The three cross-cutting surfaces &mdash; the provenance sheet, the Date sheet and the place file &mdash; come first because six later prompts are thin wrappers around them.</li>
    <li>Start a fresh session per phase so the context stays clean, re-pasting the house style block each time.</li>
  </ol>
  <div class="warn"><b>One thing I could not verify:</b> both design-system links return 403 to me, so I could not read what is in them. The tokens in the house style block are pulled from your repo instead &mdash; <code>frontend/packages/theme/src/</code>, mirrored in iOS <code>Core/Design/</code> and Android <code>ui/theme/</code>. If the design system has drifted from the code, the code is what these prompts describe.</div>
</div>

<div class="pre-wrap" id="preamble">
  <div class="pre-h"><h2>House style block</h2><span class="sub">Paste once per session, before any screen prompt.</span>
    <button class="copy" data-t="preamble">Copy</button></div>
  <pre class="pre-a" id="t-preamble">{e(PREAMBLE)}</pre>
</div>

{cards}

<footer>
Companion to the <a href="https://claude.ai/code/artifact/dc172d08-dfdd-4016-9364-3b855b411a62">Pantopus Screen Inventory</a>.<br>
Prompts generated from that inventory against <code>docs/first-person-loop-design-2026-09-16.md</code> and the Pantopus codebase, 16 September 2026. Raw prompt data: <code>docs/notes/design-prompts.json</code>.
</footer>
</div>
<script>
document.addEventListener('click', function(ev){{
  var btn = ev.target.closest('button.copy');
  if(!btn) return;
  var pre = document.getElementById('t-' + btn.dataset.t);
  if(!pre) return;
  var text = pre.textContent;
  var done = function(ok){{
    btn.textContent = ok ? 'Copied' : 'Select it';
    btn.classList.add(ok ? 'done' : 'fail');
    if(!ok){{
      try{{
        var r = document.createRange(); r.selectNodeContents(pre);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      }}catch(e){{}}
    }}
    setTimeout(function(){{ btn.textContent='Copy'; btn.classList.remove('done','fail'); }}, 1800);
  }};
  try{{
    if(navigator.clipboard && navigator.clipboard.writeText){{
      navigator.clipboard.writeText(text).then(function(){{done(true);}}, function(){{done(false);}});
    }} else {{ done(false); }}
  }}catch(e){{ done(false); }}
}});
</script>'''
open(OUT,'w').write(HTML)
print('wrote',OUT,len(HTML),'bytes')
