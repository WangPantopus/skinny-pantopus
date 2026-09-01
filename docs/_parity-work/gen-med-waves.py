#!/usr/bin/env python3
"""Generate the medium/low parity wave scripts from the split cluster files.

Workflow scripts cannot read the filesystem, so the finding text has to be
embedded. This writes one wf-med-<wave>.js per wave with the findings inlined,
split into packages of roughly equal size.
"""
import json
import pathlib
import textwrap

ROOT = pathlib.Path("/Users/yingpengwang/pantopus/native/pantopus")
MED = ROOT / "docs/_parity-work/med"
OUT = ROOT / "docs/_parity-work"

# wave -> [(cluster, n_packages, [design refs])]
WAVES = {
    "homes": [
        ("homes-a", 2, '"A08 — per-screen batch 1/*.html" (Members, Home calendar, Emergency info, '
                       'Household tasks), "A-12 Wizard (multi-step form)/A12.2 Add Home.html" + '
                       '"A12.4 Claim Ownership Evidence.html", "A10 — Detail_ Content/A10.1 Home.html"'),
        ("homes-b", 2, '"A08 — per-screen batch 1/Polls.html" + "Household tasks.html", '
                       '"A14 — Settings list/A14.1 Home settings.html", '
                       '"A-12 Wizard (multi-step form)/A12.7 Postcard Verification.html"'),
    ],
    "mailbox-gigs": [
        ("mailbox", 2, '"A17 mobile Mailbox root archetype/*.html" — especially A17.2 Booklet, '
                       'A17.3 Certified mail, A17.8 Package, A17.9 Party mail, A17.11 Stamps, '
                       'A17.13 Translation; "A13 — Form (single screen)/My Mail Day.html"'),
        ("gigs", 3, '"A09 — Detail_ Transactional/A09.1 Task V2.html" + "A09.2 Gig V1.html", '
                    '"Pantopus-design/Gigs.html", "A08 — per-screen batch 1/Offers.html" + "My bids.html"'),
    ],
    "social-creator": [
        ("tabs-social", 2, '"A03 — Tab_ Pulse feed/*.html", "Pantopus-design/Hub.html", '
                           '"A08 — per-screen batch 1/Notifications.html"'),
        ("creator-biz", 2, '"A22 — Creator Audience hub/A22.1 Audience.html", '
                           '"A10 — Detail_ Content/A10.7 Business (owner view).html", '
                           '"A-12 Wizard (multi-step form)/A12.10 Create Business.html"'),
    ],
    "auth-money": [
        ("auth-settings", 3, '"A13 — Form (single screen)/Edit Profile.html" + "Professional Profile.html", '
                             '"A10 — Detail_ Content/A10.5 User.html", "A19 — Legal  static/*.html", '
                             '"A21 — Public Beacon profile/A21.2 Local Profile.html"'),
        ("money", 3, '"A10 — Detail_ Content/A10.10 Wallet.html", '
                     '"A14 — Settings list/A14.6 Payments.html"'),
    ],
}

SCHEMAS = r"""
const RESULT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['package', 'status', 'ios', 'android', 'endpointsVerified', 'deferred'],
  properties: {
    package: { type: 'string' },
    status: { type: 'string', enum: ['complete', 'partial', 'blocked'] },
    ios: { type: 'object', additionalProperties: false, required: ['filesCreated', 'filesEdited', 'summary'],
      properties: { filesCreated: { type: 'array', items: { type: 'string' } }, filesEdited: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } } },
    android: { type: 'object', additionalProperties: false, required: ['filesCreated', 'filesEdited', 'summary'],
      properties: { filesCreated: { type: 'array', items: { type: 'string' } }, filesEdited: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } } },
    endpointsVerified: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['method', 'path', 'backendRef'],
      properties: { method: { type: 'string' }, path: { type: 'string' }, backendRef: { type: 'string' } } } },
    deferred: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['what', 'why', 'evidence'],
      properties: { what: { type: 'string' }, why: { type: 'string' }, evidence: { type: 'string' } } } },
  },
}

const AUDIT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['platform', 'issues'],
  properties: {
    platform: { type: 'string' },
    issues: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['file', 'severity', 'problem', 'fixApplied'],
      properties: { file: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, problem: { type: 'string' }, fixApplied: { type: 'string' } } } },
  },
}
"""


def chunk(items, n):
    """Split items into n roughly equal chunks."""
    k, m = divmod(len(items), n)
    return [items[i * k + min(i, m):(i + 1) * k + min(i + 1, m)] for i in range(n)]


def build(wave, clusters):
    packages = []
    for cluster, nparts, designs in clusters:
        lines = (MED / f"{cluster}.txt").read_text().strip().split("\n")
        for idx, part in enumerate(chunk(lines, nparts), start=1):
            pid = f"{cluster}-{idx}"
            packages.append({
                "id": pid,
                "cluster": cluster,
                "designs": designs,
                "findings": "\n".join(part),
                "count": len(part),
            })

    total = sum(p["count"] for p in packages)
    js = [
        "export const meta = {",
        f"  name: 'parity-med-{wave}',",
        f"  description: 'Medium/low RN-to-native parity findings — {wave} ({total} findings)',",
        "  phases: [",
        "    { title: 'Implement', detail: 'packages, each doing both platforms' },",
        "    { title: 'Audit', detail: 'per-platform review of the wave diff' },",
        "  ],",
        "}",
        "",
        "const BRIEF = '/Users/yingpengwang/pantopus/native/pantopus/docs/_parity-work/BRIEF.md'",
        "const ADDENDUM = '/Users/yingpengwang/pantopus/native/pantopus/docs/_parity-work/BRIEF-MEDIUM.md'",
        SCHEMAS,
        f"const PACKAGES = {json.dumps(packages, indent=2, ensure_ascii=False)}",
        "",
        "phase('Implement')",
        "const results = await parallel(PACKAGES.map((p) => () =>",
        "  agent([",
        "    `Read ${BRIEF} then ${ADDENDUM}. Follow both exactly.`, '',",
        "    `# Work package ${p.id} — ${p.count} medium/low findings in the \\`${p.cluster}\\` cluster`, '',",
        "    'Implement every finding below on BOTH iOS and Android. They are quoted verbatim from',",
        "    'the \"Medium (73) and low (13)\" section of docs/rn-functional-parity.md — which means they',",
        "    'are TRUNCATED and carry no file:line. Reconstruct each one from the RN source before you',",
        "    'build anything, per section 1 of the addendum.', '',",
        "    p.findings, '',",
        "    `Design references for this cluster: ${p.designs}`, '',",
        "    'Work through every finding. Return the JSON result object.',",
        "  ].join('\\n'), { label: p.id, phase: 'Implement', schema: RESULT_SCHEMA })))",
        "",
        "const done = results.filter(Boolean)",
        "log(`${done.length}/${PACKAGES.length} packages returned`)",
        "",
        "phase('Audit')",
        "const AUDIT_COMMON = [",
        "  `Read ${BRIEF} and ${ADDENDUM}.`, '',",
        "  'Sibling agents just landed the medium/low findings for this wave, in parallel, in the same',",
        "  'tree. Hunt for: (a) two agents clobbering a shared file, (b) a claimed wiring that does not',",
        "  'exist, (c) fixtures left where live data was required, (d) a route or DI registration never',",
        "  'added, (e) CI-breaking convention violations, and especially (f) SCOPE CREEP — a screen',",
        "  'changed beyond its finding, or an existing surface deleted that no finding asked to remove.',",
        "  'That last one has bitten this project before.', '',",
        "  'Their reports:', JSON.stringify(done, null, 2).slice(0, 18000), '',",
        "  'Use `git diff --stat` / `git status` from /Users/yingpengwang/pantopus/native/pantopus, then',",
        "  'read the real files. Trust the diff, not the reports.', '',",
        "  'Do NOT run a build — a compile gate runs after you. Fix what you find with small anchored',",
        "  'Edits, then report.',",
        "].join('\\n')",
        "",
        "const audits = await parallel([",
        "  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **iOS only**. Verify new route cases exist in the route enum AND `destination(for:)`, new .swift files fall inside project.yml source globs, no `Features/**` hex literals or `Image(systemName:)`, new ViewModels are `@Observable @MainActor` with all four render states, and no test assertion was left stale by a behaviour change.'].join('\\n'),",
        "    { label: 'audit:ios', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),",
        "  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **Android only**. Verify every new Retrofit interface has a `@Provides @Singleton` in di/NetworkModule.kt, every new route constant has a matching `composable(...)` in RootTabScreen.kt and a real navigation call site, nav args come through SavedStateHandle with a declared key, no `ui/screens/**` `Color(0xFF…)` or `Icons.Filled.*`, and no test assertion was left stale by a behaviour change.'].join('\\n'),",
        "    { label: 'audit:android', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),",
        "])",
        "",
        "return { packages: done, audits: audits.filter(Boolean) }",
    ]
    path = OUT / f"wf-med-{wave}.js"
    path.write_text("\n".join(js))
    return path, len(packages), sum(p["count"] for p in packages)


for wave, clusters in WAVES.items():
    p, npkg, nfind = build(wave, clusters)
    print(f"{p.name}: {npkg} packages, {nfind} findings")
