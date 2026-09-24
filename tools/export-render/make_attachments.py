"""Build a per-prompt send kit: docs/design/send-kit/<NN-id>/ with the component images to attach
and a MANIFEST.md naming what the founder must export themselves. Usage: python3 make_attachments.py [outDir]
Rewrites only what it generates: component PNGs, MANIFEST.md and README.md. The hand-written RUNBOOK.md and
BOT-BRIEF.md and each folder's existing-screen/ "before" images have no generator, so they are kept, and a
MANIFEST keeps listing its folder's before images."""
import json, os, re, shutil, sys
N = '/Users/yingpengwang/skinny-pantopus/docs/notes'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/Users/yingpengwang/skinny-pantopus/docs/design/send-kit'
ATT = '/Users/yingpengwang/skinny-pantopus/docs/design/exports/attach'
M = json.load(open(os.path.join(N, 'pack-manifest.json')))
CONTRACT = [c['name'] for c in json.load(open(os.path.join(N, 'component-contract.json')))['components']]
SESSIONS = [
    ('1-core-loop', ['x-provenance-sheet', 'x-date-sheet', 'f4-today-pickup-card', 'x-place-file', 'f1-today-tab', 'f5-today-calendar-strip', 'f1-today-air-band']),
    ('2-onboarding-notifications', ['f1-your-places', 'f1-add-place-sheet', 'f1-save-confirmation', 'f1-email-verify-handoff', 'f4-notification-primer', 'f4-briefing-optin-card', 'f4-notification-settings', 'f1-claim-receipt', 'f6-home-basics-rows', 'f6-place-section-details']),
    ('3-household', ['f3-members-roster', 'f3-invite-composer', 'f3-invite-banner', 'f3b-invitation-decision', 'f3b-verify-address-sheet', 'f3b-owner-attestation', 'f3b-locked-action-row', 'f3-household-block', 'f3-member-home-dashboard', 'f3-household-calendar', 'f3-bill-detail-web', 'f3-bills-list', 'f3-household-notifications']),
    ('4-compare-card', ['f8-scale-strips', 'f8-compare-sheet', 'f8-compare-arrival-header', 'f8-compare-reveal', 'f8-og-compare-card', 'f8-native-share-compare', 'f8-seasonal-aha', 'f8-positioning-copy']),
    ('5-widgets', ['f7-today-widget', 'f7-widget-tap-landing', 'f7-widget-gallery', 'f7-widget-howto-sheet']),
    ('6-hygiene-and-pilot', ['f9-privacy-mirror', 'f9-curator-chip', 'f9-earn-removal', 'f9-verification-promise-copy', 'f9-founding-meter-preview', 'f9-nearby-cells-map', 'f9-block-founders-panel', 'f9-invite-rewards-card']),
    ('7-phase-2', ['f10-mail-day-triage', 'f10-snap-capture-tray', 'f10-extraction-confirm', 'f10-mail-piece-photo', 'f10-bill-provenance', 'f10-bill-trend', 'f10-mail-snap-privacy', 'f11-keeper-strip', 'f11-keeper-naming']),
    ('8-journeys', [x['id'] for x in M if x['section'] == 'journeys']),
]
BOARD = {c: b for b, comps in {
    '00a': ['ProvenanceMark','SourceCaption','ScopeChip','FreshnessLine','OfflineNotice','StatusChip','KindGlyph','AddressChip','ChoiceChip'],
    '00b': ['ScaleStrip','AqiBand','FourteenDayStrip','YearBand','SlotMeter','PublicPointMap','FactCount'],
    '00c': ['DateRow','FactRow','FirstWeekRow','BillRow','MemberRow','InviteRow','NotificationRow','TextActionRow','LockedActionRow','GrantLimitList','InlineErrorRow','ThumbnailRail'],
    '00d': ['QuietDayReceipt','WarmingSkeleton','InlineUndo','DestructiveConfirm','LandingBannerSlot','NotificationAsk','PushCopy','ReminderLeadControl'],
}.items() for c in comps}
by_id = {x['id']: x for x in M}
order = {x['id']: i for i, x in enumerate(M)}
HOSTS_UNBUILT = {'x-provenance-sheet', 'x-date-sheet', 'f4-today-pickup-card', 'x-place-file'}
BEFORE = ("## Existing screen ('before'), already prepared\n\nIn `existing-screen/` — rendered from your `all-designs` export. "
          "Attach these as the current screen:\n\n{}\n> These were drawn May–Jul 2026. If the screen has changed since, attach a "
          "current screenshot instead and tell Claude Design to use that as the source of truth.\n\n")
os.makedirs(OUT, exist_ok=True)
made = set()
lines =['# Send kit\n', 'One folder per prompt, in send order. Each holds the component images to attach and a MANIFEST naming what you must export yourself.\n']
for sname, ids in SESSIONS:
    lines.append(f'\n## Session {sname}\n')
    for i in ids:
        x = by_id.get(i)
        if not x: continue
        t = x['text']
        sec = re.search(r'FOUNDATIONS COMPONENTS[^\n]*\n(.*?)(?:\n[A-Z][A-Z &,/\-]{4,}\s*\n|\Z)', t, re.S)
        used = sorted({c for c in CONTRACT if re.search(r'\b' + c + r'\b', sec.group(1) if sec else t)})
        d = os.path.join(OUT, f'{order[i]+1:03d}-{i}'); os.makedirs(d, exist_ok=True); made.add(os.path.basename(d))
        for f in os.listdir(d):
            if re.match(r'00[a-d]-\w+\.png$', f): os.remove(os.path.join(d, f))
        ex = os.path.join(d, 'existing-screen')
        before = sorted(f for f in os.listdir(ex) if not f.startswith('.')) if os.path.isdir(ex) else []
        copied = []
        for c in used:
            b = BOARD.get(c)
            src = os.path.join(ATT, f'{b}-{c}.png') if b else None
            if src and os.path.exists(src):
                shutil.copy(src, os.path.join(d, f'{b}-{c}.png')); copied.append(f'{b}-{c}.png')
        ma = re.search(r'^ATTACH\s*:?\s*(.*?)(?=\n[A-Z][A-Z &,/\-]{4,}\s*:|\n[A-Z][A-Z &,/\-]{4,}\s*\n)', t, re.S | re.M)
        att = (ma.group(1).strip() if ma else (x.get('attach') or '').strip())
        extra = '\n> Attach only what exists. For any in-context artboard whose host is not designed yet, draw it from the description and mark it provisional on Notes; I will send the real host later.\n' if i in HOSTS_UNBUILT else ''
        open(os.path.join(d, 'MANIFEST.md'), 'w').write(
            f"# {x['name']}\n\n**Prompt:** `{i}` · {x['artboards']} artboards · {'/'.join(x['platforms'])} · {x['type']}\n\n"
            f"**Job:** {x['job']}\n\n## Attach from this folder\n\n"
            + (''.join(f'- `{c}`\n' for c in copied) or '- (none; the design system carries every component this screen uses)\n')
            + f"\n## Export yourself and attach\n\n{att or 'none'}\n{extra}\n"
            + (BEFORE.format(''.join(f'- `{f}`\n' for f in before)) if before else '')
            + "## Steps\n\n1. Paste the prompt from the pack page (copy button).\n2. Attach the files above.\n3. Reply `continue` between artboard batches.\n"
            f"4. Export what you accept to `docs/design/exports/{i}/`.\n")
        lines.append(f'- `{order[i]+1:03d}-{i}` — {x["name"]} ({len(copied)} component images)\n')
open(os.path.join(OUT, 'README.md'), 'w').write(''.join(lines))
stale = sorted(f for f in os.listdir(OUT) if re.match(r'\d{3}-', f) and f not in made)
print('folders:', len(made), '| not in this run (kept, check by hand):', stale or 'none')
