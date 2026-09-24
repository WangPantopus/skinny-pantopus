export const meta = {
  name: 'pantopus-design-prompt-pack',
  description: 'Write one self-contained Claude Design prompt per screen in the first-person-loop inventory',
  phases: [{ title: 'Write prompts', detail: 'One agent per batch of screens' }],
}

const INV = 'docs/notes/FINAL-screen-inventory.md'
const PRE = 'docs/notes/prompt-pack-preamble.md'
const TOK = 'docs/notes/design-tokens.md'

const BATCHES = [
  ['f9-privacy-mirror','f9-curator-chip','f9-earn-removal','f9-verification-promise-copy','f9-founding-meter-preview'],
  ['x-provenance-sheet','x-date-sheet'],
  ['x-place-file'],
  ['f1-your-places','f1-add-place-sheet','f1-save-confirmation','f1-email-verify-handoff'],
  ['f1-today-tab','f5-today-calendar-strip','f4-today-pickup-card','f1-today-air-band'],
  ['f4-notification-primer','f4-briefing-optin-card','f4-notification-settings','f1-claim-receipt'],
  ['f6-home-basics-rows','f6-place-section-details','f3-members-roster','f3-invite-composer'],
  ['f3-invite-banner','f3b-invitation-decision','f3b-verify-address-sheet','f3b-owner-attestation','f3b-locked-action-row'],
  ['f3-household-block','f3-member-home-dashboard','f3-household-calendar','f3-bill-detail-web','f3-bills-list','f3-household-notifications'],
  ['f8-scale-strips','f8-compare-sheet','f8-compare-arrival-header','f8-compare-reveal'],
  ['f8-og-compare-card','f8-native-share-compare','f8-seasonal-aha','f8-positioning-copy'],
  ['f7-today-widget','f7-widget-tap-landing','f7-widget-gallery','f7-widget-howto-sheet'],
  ['f9-nearby-cells-map','f9-block-founders-panel','f9-invite-rewards-card'],
  ['f10-mail-day-triage','f10-snap-capture-tray','f10-extraction-confirm','f10-mail-piece-photo'],
  ['f10-bill-provenance','f10-bill-trend','f10-mail-snap-privacy','f11-keeper-strip','f11-keeper-naming'],
]

const SCHEMA = {
  type: 'object',
  properties: {
    prompts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          platforms: { type: 'array', items: { type: 'string' } },
          isNew: { type: 'boolean', description: 'true = design a new screen; false = extend an existing already-designed screen' },
          frameCount: { type: 'number', description: 'how many frames/states this prompt asks for' },
          promptText: { type: 'string', description: 'The complete, copy-pasteable prompt for Claude Design. Self-contained below the shared preamble.' },
        },
        required: ['id', 'name', 'platforms', 'isNew', 'frameCount', 'promptText'],
      },
    },
  },
  required: ['prompts'],
}

phase('Write prompts')

const out = await parallel(BATCHES.map((ids, i) => () => agent(
`You are writing prompts for **Claude Design** (a visual design tool). Claude Design has NO access to the Pantopus repo, so each prompt must be SELF-CONTAINED.

Read these three files at /Users/yingpengwang/skinny-pantopus:
1. ${INV} - the screen inventory. Find the entries with these ids and read them completely: ${ids.join(', ')}
2. ${PRE} - the shared preamble blocks (A house style, B honesty rules, C platforms, D per-screen template) and the ordering principle
3. ${TOK} - the real Pantopus design tokens

Write ONE prompt per screen id listed above (${ids.length} prompts total).

Each promptText must:
- NOT repeat blocks A/B/C verbatim (they are pasted once at the top of the pack). Instead open with a single line: "Use the Pantopus house style, honesty rules and platform specs from the top of this pack." Then get straight to the screen.
- State clearly whether this is a NEW screen or an EXTENSION of an existing already-designed Pantopus screen. For an extension, name the existing screen and say "this already exists and is already designed in the Pantopus design system - open it, keep everything, and change only what is listed below."
- Name the platform(s) and the viewport for each.
- Say where it sits in the four-tab IA (Place / Today / Nearby / Mail) and exactly how the user reaches it (nav, CTA, push, widget tap, deep link).
- Give THE ONE JOB in a single sentence.
- Supply REAL CONTENT at realistic density, using the exact copy strings from the inventory entry where it gives them. Invent plausible concrete specifics where needed (real-sounding addresses in Camas/Vancouver WA, real dates in Sep-Dec 2026, real utility names like Clark PUD, dollar amounts) - never lorem, never placeholder brackets. Include the DENSEST realistic case, not the happy minimum.
- Carry the VISUALIZATION DECISION from the inventory entry, spelled out so a designer can draw it: the layout, the chart form, the encoding, what each axis/lane/segment means, and what it degrades to when data is missing. This is the part that must not read as generic.
- List every STATE as its own frame, taken from the inventory entry's states list.
- End with a short DO NOT section naming the specific failure mode for that screen (e.g. "do not draw a percentage or a progress bar - nothing here should read as 'you are 60% complete'").
- Where the entry's uxNote explains WHY the design is shaped this way, fold that reasoning into the prompt so Claude Design does not optimise it away.

Write in second person, imperative, dense, no preamble sentences. A good prompt here is 200-450 words. Return the structured result.`,
  { label: `prompts:${i + 1}`, phase: 'Write prompts', schema: SCHEMA }
)))

const prompts = out.filter(Boolean).flatMap(r => r.prompts)
log(`Wrote ${prompts.length} Claude Design prompts`)
return { prompts }
