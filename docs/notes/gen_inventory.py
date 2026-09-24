import json, html, collections
OUT='/private/tmp/claude-501/-Users-yingpengwang-skinny-pantopus/52b514da-4f75-4fbb-ab66-72632a65dbcb/scratchpad/screen-inventory.html'
b=json.load(open('/Users/yingpengwang/skinny-pantopus/docs/notes/wf-raw-results.json'))
f=[v for v in b.values() if isinstance(v,dict) and 'headline' in v][0]
inv=f['inventory']
e=html.escape

DISP={
 'NEW_SCREEN':('New screen','ns'),
 'NEW_SHEET_OR_MODAL':('New sheet','nsh'),
 'NEW_CARD_IN_EXISTING':('New card','nc'),
 'NEW_WIDGET':('New widget','nw'),
 'EXTEND_EXISTING':('Extend','ex'),
 'COPY_ONLY':('Copy only','co'),
}
PLAT={'web':'W','ios':'iOS','android':'And'}
PHASE=[('loop','Before the pilot','The loop: F9 hygiene, F1 bridge, F2, F4, F5, F3, F8, F6, F7'),
       ('pilot','At the pilot','Block and founding surfaces that give the fourth tab a job'),
       ('phase2','After the first read','F10 mail snap, F11 keeper, F12 data')]

dispc=collections.Counter(s['disposition'] for s in inv)
orig=collections.Counter(s.get('origin') for s in inv)
phasec=collections.Counter(s.get('phase') for s in inv)

def chips(pl):
    return ''.join(f'<span class="p p-{x}">{PLAT.get(x,x)}</span>' for x in pl)

rows_by_phase={k:[] for k,_,_ in PHASE}
order={'NEW_SCREEN':0,'NEW_SHEET_OR_MODAL':1,'NEW_WIDGET':2,'NEW_CARD_IN_EXISTING':3,'EXTEND_EXISTING':4,'COPY_ONLY':5}
for s in sorted(inv,key=lambda s:(order.get(s['disposition'],9), s['id'])):
    ph=s.get('phase','loop')
    if ph not in rows_by_phase: ph='loop'
    lbl,cls=DISP.get(s['disposition'],(s['disposition'],'ex'))
    ob = s.get('origin','')
    obadge = ''
    if ob=='added-by-critique': obadge='<span class="ob ob-add">missing from the doc</span>'
    elif ob=='merged': obadge='<span class="ob ob-mrg">merged</span>'
    def fld(label,val):
        return f'<div class="fl"><span class="fk">{label}</span><span class="fv">{e(val)}</span></div>' if val else ''
    states=' · '.join(s.get('states',[]))
    entry='; '.join(s.get('entryPoints',[]) or [])
    body=(fld('Contents', s.get('contents',''))
        + fld('Visualization', s.get('visualization',''))
        + fld('States', states)
        + fld('Reached by', entry)
        + fld('Host', s.get('hostSurface',''))
        + (f'<div class="fl note"><span class="fk">Why</span><span class="fv">{e(s["uxNote"])}</span></div>' if s.get('uxNote') else ''))
    eff=s.get('effortDays')
    effs=f'<span class="eff">{eff:g}d<span class="effx">/platform</span></span>' if eff else ''
    rows_by_phase[ph].append(f'''
<article class="row r-{cls}">
  <div class="rh">
    <code class="rid">{e(s['id'])}</code>
    <h3 class="rn">{e(s['name'])}</h3>
    <div class="rmeta"><span class="d d-{cls}">{lbl}</span>{chips(s.get('platforms',[]))}{obadge}{effs}</div>
  </div>
  <p class="job">{e(s.get('purpose',''))}</p>
  <div class="flds">{body}</div>
</article>''')

def ul(items, cls=''):
    return f'<ul class="{cls}">' + ''.join(f'<li>{e(x)}</li>' for x in items) + '</ul>'

# build order grouped
bo=f.get('buildOrder',[])
byid={s['id']:s for s in inv}
bo_html=''
seen_phase=None
for i,sid in enumerate(bo,1):
    s=byid.get(sid)
    ph=s.get('phase','loop') if s else 'loop'
    if ph!=seen_phase:
        if seen_phase is not None: bo_html+='</ol>'
        title=dict((k,v) for k,v,_ in PHASE).get(ph,ph)
        bo_html+=f'<h4 class="bph">{title}</h4><ol class="bo" start="{i}">'
        seen_phase=ph
    nm=e(s['name']) if s else e(sid)
    pl=chips(s.get('platforms',[])) if s else ''
    bo_html+=f'<li><code>{e(sid)}</code><span class="bon">{nm}</span>{pl}</li>'
bo_html+='</ol>'

seg_total=sum(dispc.values())
def seg(k):
    n=dispc.get(k,0); lbl,cls=DISP[k]
    return f'<div class="seg s-{cls}" style="flex:{n}"><span class="segn">{n}</span><span class="segl">{lbl}</span></div>'
segs=''.join(seg(k) for k in ['NEW_SCREEN','NEW_SHEET_OR_MODAL','NEW_WIDGET','NEW_CARD_IN_EXISTING','EXTEND_EXISTING','COPY_ONLY'])

TILES=[('59','surfaces total','all'),('5','genuinely new screens','ns'),('10','new sheets','nsh'),
       ('14','new cards','nc'),('2','widget entries','nw'),('26','extensions','ex'),('2','copy only','co')]
tiles=''.join(f'<div class="tile t-{c}"><span class="tn">{n}</span><span class="tl">{l}</span></div>' for n,l,c in TILES)

CORR=[
 ("&ldquo;Today&rdquo; exists twice on every platform",
  "<code>GET /api/hub/today</code> carries <code>location.source</code> and needs no home. <code>GET /api/homes/:id/intelligence</code> requires a claimed primary home. F1 changes the first; F5 and F11 target the second, and the doc never distinguishes them. On iOS the first is reachable <em>only</em> through a briefing push. Collapsing to one Today per platform is the largest structural decision in the inventory."),
 ("Android already has a saved-places client",
  "<code>SavedPlacesApi.kt</code>, <code>SavedPlacesRepository.kt</code>, <code>SavedPlacesScreen.kt</code>; <code>HomeTabHostViewModel.kt</code> already POSTs a saved place during post-signin arrival. The doc says it does not exist and spends its largest single native line &mdash; 3 days &mdash; building it."),
 ("F2&rsquo;s checklist is invisible to exactly the users F2 targets",
  "On web <code>PlaceDashboard</code> returns at <code>:133-139</code>, before the <code>SetupBanner</code> mount at <code>:157-159</code>. The only other mount is <code>/app/hub</code>, which is not one of the four tabs. iOS renders steps only when <code>hub.homes.isEmpty</code>; Android builds step titles mechanically from the backend key, so the designed copy is impossible to render."),
 ("No funnel-event emitter exists on iOS or Android",
  "Neither native tree contains a single call site. iOS parses <code>?src=widget</code> and discards <code>src</code>. Android&rsquo;s <code>DeepLinkRouter</code> enumerates eight <code>/homes/:id</code> children and sends everything else to the dashboard. The pilot&rsquo;s activation, return-by-trigger and spread metrics cannot be measured on natives as designed."),
 ("The web Members &ldquo;Invite&rdquo; button does nothing and says it worked",
  "Both buttons route to <code>/members/add-guest</code>, whose handler makes no API call &mdash; the comment reads &ldquo;This would call the invite/guest-pass API&rdquo; &mdash; and toasts success unconditionally. The doc calls this a &ldquo;Members page fix.&rdquo; It is the household&rsquo;s front door silently discarding invitations."),
]
corr=''.join(f'<div class="corr"><h3>{t}</h3><p>{d}</p></div>' for t,d in CORR)

HTML=f'''<title>Pantopus Screen Inventory</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>
:root{{
  --ink:#111827; --ink2:#374151; --ink3:#6B7280; --ink4:#9CA3AF;
  --bg:#F6F7F9; --card:#FFFFFF; --raised:#F9FAFB; --sunken:#F3F4F6;
  --line:#E5E7EB; --line2:#D1D5DB;
  --pri:#0284c7; --pri-bg:#F0F9FF;
  --ok:#059669; --ok-bg:#F0FDF4; --warn:#D97706; --warn-bg:#FFFBEB;
  --err:#DC2626; --err-bg:#FEF2F2; --vio:#7C3AED; --vio-bg:#F3E8FF;
  --grn:#16A34A; --grn-bg:#DCFCE7;
  --sans:'IBM Plex Sans',ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{
  --ink:#E5E7EB; --ink2:#F1F5F9; --ink3:#94A3B8; --ink4:#64748B;
  --bg:#020617; --card:#0F172A; --raised:#1E293B; --sunken:#111827;
  --line:#1F2937; --line2:#374151;
  --pri:#38BDF8; --pri-bg:#0c2537;
  --ok:#34D399; --ok-bg:#062b22; --warn:#FBBF24; --warn-bg:#2e2008;
  --err:#F87171; --err-bg:#2c1010; --vio:#C4B5FD; --vio-bg:#241b3d;
  --grn:#4ADE80; --grn-bg:#07240f;
}}}}
:root[data-theme="dark"]{{
  --ink:#E5E7EB; --ink2:#F1F5F9; --ink3:#94A3B8; --ink4:#64748B;
  --bg:#020617; --card:#0F172A; --raised:#1E293B; --sunken:#111827;
  --line:#1F2937; --line2:#374151;
  --pri:#38BDF8; --pri-bg:#0c2537;
  --ok:#34D399; --ok-bg:#062b22; --warn:#FBBF24; --warn-bg:#2e2008;
  --err:#F87171; --err-bg:#2c1010; --vio:#C4B5FD; --vio-bg:#241b3d;
  --grn:#4ADE80; --grn-bg:#07240f;
}}
*{{box-sizing:border-box}}
body{{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.55;
  -webkit-font-smoothing:antialiased;margin:0;padding:0 20px 96px}}
.wrap{{max-width:1060px;margin:0 auto}}
code{{font-family:var(--mono);font-size:.86em;background:var(--sunken);padding:1px 5px;border-radius:3px;color:var(--ink2)}}
h1,h2,h3,h4{{text-wrap:balance;margin:0}}

header{{padding:56px 0 28px;border-bottom:2px solid var(--ink);margin-bottom:28px}}
.eyebrow{{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--pri);margin-bottom:14px}}
h1{{font-size:40px;line-height:1.1;font-weight:700;letter-spacing:-.022em;max-width:20ch}}
.lede{{font-size:18px;line-height:1.5;color:var(--ink2);max-width:62ch;margin-top:16px}}
.lede b{{font-weight:600;color:var(--ink)}}
.src{{font-family:var(--mono);font-size:11.5px;color:var(--ink4);margin-top:20px;line-height:1.7}}

.tiles{{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:1px;background:var(--line);
  border:1px solid var(--line);margin:0 0 8px;border-radius:6px;overflow:hidden}}
.tile{{background:var(--card);padding:16px 14px 14px;display:flex;flex-direction:column;gap:3px}}
.tn{{font-family:var(--mono);font-size:30px;font-weight:600;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}}
.tl{{font-size:11.5px;color:var(--ink3);line-height:1.35}}
.t-all .tn{{color:var(--ink)}} .t-ns .tn{{color:var(--err)}} .t-nsh .tn{{color:var(--warn)}}
.t-nc .tn{{color:var(--pri)}} .t-nw .tn{{color:var(--vio)}} .t-ex .tn{{color:var(--ok)}} .t-co .tn{{color:var(--ink4)}}

h2{{font-size:13px;font-family:var(--mono);font-weight:600;letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink3);margin:52px 0 16px;padding-bottom:9px;border-bottom:1px solid var(--line)}}
.intro{{font-size:16px;color:var(--ink2);max-width:66ch;margin:0 0 22px}}

.bar{{display:flex;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:5px;overflow:hidden;margin-bottom:8px}}
.seg{{background:var(--card);padding:12px 10px;min-width:0;display:flex;flex-direction:column;gap:2px;border-top:3px solid var(--l)}}
.segn{{font-family:var(--mono);font-size:19px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1}}
.segl{{font-size:10.5px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.s-ns{{--l:var(--err)}} .s-nsh{{--l:var(--warn)}} .s-nw{{--l:var(--vio)}}
.s-nc{{--l:var(--pri)}} .s-ex{{--l:var(--ok)}} .s-co{{--l:var(--ink4)}}
.barcap{{font-size:12.5px;color:var(--ink3);margin:0 0 6px}}

.plat{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px}}
.pcol{{border:1px solid var(--line);border-radius:6px;background:var(--card);padding:14px 16px}}
.pcol .pn{{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink3)}}
.pcol .pv{{font-family:var(--mono);font-size:24px;font-weight:600;font-variant-numeric:tabular-nums;margin-top:4px}}
.pcol .pd{{font-size:12px;color:var(--ink3);margin-top:3px}}

.corr{{border-left:3px solid var(--err);background:var(--err-bg);padding:14px 18px;margin-bottom:12px;border-radius:0 5px 5px 0}}
.corr h3{{font-size:15.5px;font-weight:600;margin-bottom:5px}}
.corr p{{margin:0;font-size:14px;color:var(--ink2);line-height:1.5}}
.corr code{{background:rgba(0,0,0,.05)}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]) .corr code{{background:rgba(255,255,255,.07)}}}}
:root[data-theme="dark"] .corr code{{background:rgba(255,255,255,.07)}}

.phase{{margin-top:12px}}
.phh{{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;padding:18px 0 10px;border-bottom:1px solid var(--line2);margin-bottom:2px}}
.phh h3{{font-size:21px;font-weight:700;letter-spacing:-.01em}}
.phh .phc{{font-family:var(--mono);font-size:12px;color:var(--ink3);font-variant-numeric:tabular-nums}}
.phh .phd{{font-size:13px;color:var(--ink3);flex:1 1 100%;margin-top:2px}}

.row{{border-left:3px solid var(--l);background:var(--card);border-bottom:1px solid var(--line);
  border-right:1px solid var(--line);border-top:1px solid var(--line);margin-bottom:8px;border-radius:0 6px 6px 0;padding:14px 18px 15px}}
.r-ns{{--l:var(--err)}} .r-nsh{{--l:var(--warn)}} .r-nw{{--l:var(--vio)}}
.r-nc{{--l:var(--pri)}} .r-ex{{--l:var(--ok)}} .r-co{{--l:var(--ink4)}}
.rh{{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}}
.rid{{font-family:var(--mono);font-size:11.5px;color:var(--ink4);background:none;padding:0}}
.rn{{font-size:17px;font-weight:600;letter-spacing:-.01em;flex:1 1 auto;min-width:220px}}
.rmeta{{display:flex;gap:5px;align-items:center;flex-wrap:wrap}}
.d{{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
  padding:3px 7px;border-radius:3px;white-space:nowrap}}
.d-ns{{background:var(--err-bg);color:var(--err)}} .d-nsh{{background:var(--warn-bg);color:var(--warn)}}
.d-nw{{background:var(--vio-bg);color:var(--vio)}} .d-nc{{background:var(--pri-bg);color:var(--pri)}}
.d-ex{{background:var(--ok-bg);color:var(--ok)}} .d-co{{background:var(--sunken);color:var(--ink3)}}
.p{{font-family:var(--mono);font-size:10px;font-weight:500;padding:3px 6px;border:1px solid var(--line2);
  border-radius:3px;color:var(--ink3);white-space:nowrap}}
.ob{{font-family:var(--mono);font-size:10px;font-weight:600;padding:3px 7px;border-radius:3px;white-space:nowrap}}
.ob-add{{background:var(--vio-bg);color:var(--vio)}}
.ob-mrg{{background:var(--sunken);color:var(--ink3)}}
.eff{{font-family:var(--mono);font-size:11px;color:var(--ink4);font-variant-numeric:tabular-nums;white-space:nowrap}}
.effx{{opacity:.65}}
.job{{font-size:15px;color:var(--ink2);margin:9px 0 0;max-width:78ch;line-height:1.5}}
.flds{{margin-top:11px;display:flex;flex-direction:column;gap:6px}}
.fl{{display:grid;grid-template-columns:92px 1fr;gap:12px;align-items:baseline}}
.fk{{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink4);padding-top:2px}}
.fv{{font-size:13.5px;color:var(--ink3);line-height:1.5}}
.fl.note .fv{{color:var(--ink2)}}
.fl.note{{border-top:1px dashed var(--line);padding-top:7px;margin-top:2px}}

ul.plain{{margin:0;padding-left:0;list-style:none;display:flex;flex-direction:column;gap:10px}}
ul.plain li{{font-size:14.5px;color:var(--ink2);line-height:1.55;padding-left:18px;position:relative;max-width:82ch}}
ul.plain li::before{{content:'';position:absolute;left:0;top:.62em;width:7px;height:7px;border-radius:50%;background:var(--c,var(--ink4))}}
ul.merge li::before{{background:var(--ok)}}
ul.add li::before{{background:var(--vio)}}
ul.oq li::before{{background:var(--warn)}}

.bph{{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink3);margin:22px 0 8px}}
ol.bo{{margin:0;padding-left:30px;display:flex;flex-direction:column;gap:3px}}
ol.bo li{{font-size:13.5px;color:var(--ink3);padding:3px 0}}
ol.bo li::marker{{font-family:var(--mono);font-size:11px;color:var(--ink4)}}
ol.bo code{{font-size:11px;background:none;padding:0;color:var(--ink4)}}
.bon{{color:var(--ink);margin:0 8px 0 10px;font-weight:500}}

footer{{margin-top:64px;padding-top:22px;border-top:1px solid var(--line);font-size:12.5px;color:var(--ink4);line-height:1.7}}
@media(max-width:720px){{
  h1{{font-size:30px}} .lede{{font-size:16px}} .plat{{grid-template-columns:1fr}}
  .fl{{grid-template-columns:1fr;gap:1px}} .rn{{min-width:0}}
  .segl{{display:none}}
}}
</style>
<div class="wrap">
<header>
  <div class="eyebrow">Design review &middot; first-person loop F1&ndash;F12 &middot; 16 September 2026</div>
  <h1>What the loop actually costs in screens</h1>
  <p class="lede">The design doc names very few things as screens. Read end to end and walked flow by flow, it needs <b>59 surfaces</b> &mdash; but only <b>5 of them are genuinely new screens</b>. The rest is 10 sheets, 14 cards, 2 widget entries and 26 extensions of screens that already ship. Across web, iOS and Android that is <b>159 per-platform builds</b>.</p>
  <p class="lede">The count came out low because the features were designed separately and overlap heavily. Four half-lists of the same facts collapse into one place file; seven date sheets collapse into one; three Todays collapse into one per platform. Fifteen merges, and fifteen surfaces the doc missed that a real user gets stuck without.</p>
  <div class="src">Method: 5 agents mapped 169 existing surfaces and 84 gaps against real files &middot; 10 agents derived 90 candidate surfaces &middot; 3 UX critics (information architecture, data visualization, adversarial flow-walk) returned 48 findings and 16 missing screens &middot; 1 synthesis pass. Verified on branch <code>work-design-and-next-steps</code>.</div>
</header>

<h2>The answer</h2>
<div class="tiles">{tiles}</div>
<p class="barcap">Every surface by disposition &mdash; the story is the right-hand side: <b>{dispc.get('EXTEND_EXISTING',0)+dispc.get('COPY_ONLY',0)} of 59 are changes to screens that already exist.</b></p>
<div class="bar">{segs}</div>

<div class="plat">
  <div class="pcol"><div class="pn">Web</div><div class="pv">53</div><div class="pd">surfaces &middot; ~48 days for the loop phase</div></div>
  <div class="pcol"><div class="pn">iOS</div><div class="pv">53</div><div class="pd">surfaces &middot; ~49 days for the loop phase</div></div>
  <div class="pcol"><div class="pn">Android</div><div class="pv">53</div><div class="pd">surfaces &middot; ~49 days for the loop phase</div></div>
</div>
<p class="barcap" style="margin-top:14px">Those are the inventory&rsquo;s own per-surface estimates summed, against the doc&rsquo;s &sect;6 table of web&nbsp;10.5d / iOS&nbsp;16d / Android&nbsp;16.5d. Estimate against estimate, not measurement &mdash; but the gap is almost entirely the surfaces the doc assumed were free: the management list, the T1 hosts, the deep-link landings, the permission states and the discovery surfaces.</p>

<h2>Five things the doc gets wrong about the code</h2>
<p class="intro">Each verified by reading the file, not inferred. The first one reshapes the inventory; the last one is shipping today.</p>
{corr}

<h2>Every surface</h2>
<p class="intro">Ordered within each phase by how much is genuinely new. The stripe and chip encode disposition; <span class="ob ob-add">missing from the doc</span> marks a surface the flow-walk found the design needs but never names; <span class="ob ob-mrg">merged</span> marks one that absorbed two or more proposals.</p>
'''

for key,title,desc in PHASE:
    n=len(rows_by_phase[key])
    HTML+=f'''<section class="phase">
<div class="phh"><h3>{title}</h3><span class="phc">{n} surfaces</span><span class="phd">{desc}</span></div>
{''.join(rows_by_phase[key])}
</section>'''

HTML+=f'''
<h2>What got merged &mdash; {len(f['merges'])} collapses</h2>
<p class="intro">The features were designed one at a time, so the same user job appears in three or four of them. Each line below is one job that should be built once.</p>
{ul(f['merges'],'plain merge')}

<h2>What the doc missed &mdash; {len(f['additions'])} additions</h2>
<p class="intro">Found by walking ten real flows end to end, including the failure paths. These are not polish; without most of them a user reaches a dead end or the pilot cannot measure itself.</p>
{ul(f['additions'],'plain add')}

<h2>Decisions only you can make &mdash; {len(f['openQuestions'])} open questions</h2>
{ul(f['openQuestions'],'plain oq')}

<h2>Build order</h2>
<p class="intro">Top to bottom. The three cross-cutting surfaces &mdash; provenance sheet, Date sheet, place file &mdash; come before the features that consume them, because six later surfaces are thin wrappers around those three.</p>
{bo_html}

<footer>
Generated from a 19-agent review of <code>docs/first-person-loop-design-2026-09-16.md</code> against the Pantopus codebase on branch <code>work-design-and-next-steps</code>, 16 September 2026.<br>
Working notes, the full gap list and the per-agent returns are in <code>docs/notes/</code>.
</footer>
</div>'''
open(OUT,'w').write(HTML)
print('wrote',OUT,len(HTML),'bytes')
