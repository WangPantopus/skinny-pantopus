# Pantopus Calendarly — Design Prompt Suite

**Goal.** Produce a complete set of iPhone-framed HTML mocks for the **Calendarly** feature — personal + family/home + business scheduling and booking, payments included — anchored to the existing Pantopus Design System and the screens you already have. Greatest UI/UX: simple but beautiful, easy to use, rich features that cover all use cases.

**Vehicle.** These prompts are for a Claude conversation running against the **Pantopus Design System** skill. Upload these three, pin them for the session:

- `Pantopus Design System.zip` — brand, tokens (`colors_and_type.css`), `ui_kits/`, `preview/`.
- `Pantopus-design.zip` — the 25 archetype master screens (Hub, Me, List of Rows, Form, Content Detail, Transactional Detail, Wizard, Settings, Chat, Map+List, Public Beacon, etc.).
- `all-designs 2.zip` — the 118 per-screen reference mocks (A03–A22), including the scheduling-adjacent screens this feature reuses.

Output is static HTML/CSS in the same iOS-framed style as the design system's mobile kit, using its CSS variables — never hardcoded hex.

**Why this feature reuses so much.** Calendarly is mostly composition: a household calendar (`Home calendar.html`), a slot/reservation engine (`Support trains.html` + `Start a Support Train` + `Manage Train`), invoices (`A09.4 Invoice.html`), payments/payouts (`A14.6 Payments`, `Wallet`, `Earn`), settings (`A14`), and confirmation/waiting states (`A18`) all already exist. Most prompts below say "match this reference screen and change X," not "invent a new pattern."

---

## How to use this suite

1. Start a fresh Claude conversation. Upload the three zips above. Pin them.
2. Paste the **Design system anchor** (below) as the first message. Wait.
3. Work **one archetype/group at a time** (don't mix groups in one session — it causes drift). Within a group, paste the per-screen prompts in order.
4. **Review the first mock in each group against its named reference screen** before continuing. If it drifts in tokens, spacing, or voice, correct and regenerate.
5. Every mock ships its **default + empty + loading-skeleton + error/conflict** frames (per the global rules), plus any variants the prompt names.

**Suggested order (leverage first):** A (hub + wizard) → B (event types + availability) → C/D (the invitee booking flow) → E (host lifecycle) → F (family/home) → G (business + payments) → H (reminders + insights). The first six groups are the minimum lovable v1; G and H layer on after.

---

## Design system anchor

> Paste this exact text as the first message of every design conversation.

```
You are designing mobile screens for the Pantopus Calendarly feature (scheduling & booking) using the Pantopus Design System I've uploaded (Pantopus Design System.zip), plus the existing screen library (Pantopus-design.zip and all-designs 2.zip). Before producing any mock, read:

1. Pantopus Design System/README.md — brand voice, visual foundations, iconography
2. Pantopus Design System/colors_and_type.css — all CSS variables (reference these, never hardcode hex)
3. Pantopus Design System/ui_kits/mobile/index.html — the exemplar iOS-framed screens
4. Pantopus Design System/preview/ — atom references (buttons, cards, chips, inputs, avatars, icons)
5. The specific reference screen named in each prompt (from Pantopus-design.zip / all-designs 2.zip) — match its structure 1:1

Every mock must match the exemplar kit:
- Frame: 300x620 iPhone-style dark frame (rounded 42px), inner 32px radius, #f6f7f9 app bg, status bar (9:41 + dynamic island + signal/battery), home indicator
- Tab bar (76px) only on tab roots (Home / Pulse / Tasks / Market / Messages); otherwise a top bar (left chevron back, centered title, right action)
- Typography: system font stack per colors_and_type.css; sentence case headings/buttons
- Color: CSS variables only. Primary = --color-primary-600 (#0284C7). Identity pillars: Personal --color-identity-personal (sky), Home --color-identity-home (green), Business --color-identity-business (violet) — accent the current context's pillar, never reassign hues
- Lucide icons via https://unpkg.com/lucide@latest (stroke 2, 16–24px). No emoji in product UI
- Cards: white bg, 1px --app-border, 16px radius, subtle shadow. No left-border color accents
- Never "Loading…" — shimmer skeletons

Voice: plainspoken, second person ("you"), verbs-first CTAs, sentence case. No exclamation points, no "seamless/unlock/revolutionary", no em-dash AI cadence.

Output: a self-contained single HTML file with inline <style>, linked to ../../colors_and_type.css, lucide script included, phone frame(s) on an #eef2f7 canvas. Multiple frames per file (default + states + variants).

Wait for my next message. Do not produce any mock yet.
```

---

## Global rules

These apply to every screen. A specific prompt overrides only where it explicitly says so.

**Spatial.** 4px base. Padding 12/16 inside cards; 16 horizontal on content; 10–12 between rows; 20–24 between sections.

**State frames.** Every screen renders **default (populated), empty, and loading skeleton**; add **error/conflict** wherever a booking can fail (slot taken, double-book, payment failed, policy-blocked). Empty states get one primary CTA.

**Identity-pillar scoping.** The same hub/inbox/editor serves Personal/Home/Business — the **pill re-scopes the screen**, it does not open a different app. Accent color = the current pillar. Show a context glyph on cross-owner rows.

**Scheduling-specific rules (the heart of "easy to use"):**
- **Slot grid = real labelled buttons.** Reuse the Support Trains weekday + time-range grid. Each slot button carries day, date, time, timezone, and availability in its accessible label. Must survive the largest dynamic-type size and VoiceOver/TalkBack — never a dense fixed grid.
- **Timezone is always visible** as an auto-detected chip the booker can tap to change — never a forced step.
- **Composed-availability explainer.** Wherever Home/Business compose members, show a one-line "times come from each member's personal availability" note — this is how "family references personal" is made legible.
- **One durable link is the hero.** `/book/[username]` with one-tap copy / QR / share. One-off links are a power-user sheet, not the default.
- **Confirm collapses into context.** Short invitee flows (name + email, no payment) end on the details screen with a pinned Confirm footer; the dedicated review/checkout step appears only when money or package credits are involved.
- **Booking Detail is the only place to act on a booking.** Approve / reschedule / cancel / no-show all open as sheets from it — never parallel navigation.

**Reuse mandate (match, don't reinvent).** Time pickers → Support Trains slot grid. Home context → extend `Home calendar.html`. Invoices → `A09.4 Invoice.html`. Payments/payouts → `A14.6 Payments` + `Wallet`/`Earn`. Settings → `A14` list pattern. Confirmation/waiting → `A18`. Public booking page → `A21` public profile + Support train public layout. Poll/vote → `Polls.html`.

**Anti-patterns.** No purple-indigo SaaS gradients; no left-border color accents; no dark-mode-first; no illustrations; no "Loading…"; no emoji in UI; no exclamation points; no Title-Case headings.

---

## Reference-screen map

Each Calendarly screen group maps to an archetype and the specific existing mock(s) to match:

| Group | Archetype(s) | Match these existing screens |
|---|---|---|
| A · Set up & home base | Hub, Wizard, Settings | `Hub.html`, `A10.1 Home`, `Me.html`, `Wizard.html`, `A12.11 Start a Support Train`, `A14.3 Settings`, `A14.5 Notifications` |
| B · Event types & availability | List of Rows, Form | `List of Rows.html`, `A08 Support trains`, `Form.html`, `A13 Edit Business Page`, `A14.8 Vacation hold`, `A12.11` (weekday/time grid) |
| C · Public link & invitee (pick) | Form, Public profile, Wizard step | `A13 Edit Business Page`, `A21.1/A21.2` public profiles, `A10.6 Business profile`, `A08 Support trains` + `A10.9 Support train`, `A13 Share Home`, `A12.11` |
| D · Invitee (confirm & states) | Form, Transactional, Status/Waiting | `Form.html`, `A09.4 Invoice`, `A18` status screens, `Token Accept.html`, `Status Waiting.html` |
| E · Manage bookings (host) | List of Rows, Content/Transactional Detail | `List of Rows`, `A08 Offers`/`My bids`/`My tasks`, `Content Detail`, `A09.2 Gig`, `A13 Manage Train`, `A08 Notifications` |
| F · Family / home | (extend) Home calendar, List of Rows, Detail | `A08 Home calendar` (extend), `A08 Support trains` + `A10.9`, `A08 Polls`, `A08 Members`, `A13 Add Guest`/`Invite to Home`, `A08 Access codes` |
| G · Business + payments | Transactional, Settings, List of Rows | `A09.4 Invoice`, `A14.6 Payments`, `A10.10 Wallet`/`A10.11 Earn`, `A08 Packages`, `A08 Members`, `A10.7 Business (owner)`, `A10.8 Membership` |
| H · Reminders, insights, states | Settings, List of Rows, data cards | `A14.5 Notifications`, `A08 Notifications`, `List of Rows`, `Form.html`, `A14` settings, `Wallet`/`Earn` stat cards |

---

## Per-screen prompts

The blocks below are paste-ready. Each names its archetype, the exact reference screen(s) to match, where it lives in the codebase, its identity pillar, and the frames/states to render. `[MVP]` = minimum lovable v1; `[v2]` = layer on after.

## A · Set up & home base

### Scheduling Hub  `[MVP]` · full screen
- **Archetype:** ListOfRows / dashboard hub — extends Me.html (IdentitySwitcherPillRow + section_groups[]) and Hub.html (stacked-section canvas, empty sections collapse)
- **Match these references:** Me.html (pillar switcher + grouped rows + stats card), Hub.html (section sequence, setup banner, skeleton), A14.3 Settings.html (chevron rows with current-value sub), Home calendar.html (today/upcoming agenda rows)
- **Lives in:** You/Me → identity pill → Scheduling; also Home tab Calendar overflow → Booking links. iOS Features/Root/YouTabRoot; web `/app/profile/schedule`; deep link `pantopus://scheduling`. No new bottom tab.
- **Context / pillar:** Owner-polymorphic — the pill re-scopes the same screen (Personal sky `--color-identity-personal` / Home green `--color-identity-home` / Business violet `--color-identity-business`)
- **Frames to produce:** default (Personal, active) + empty/first-run + loading skeleton + paused (master toggle off) + Home variant (composed-availability) + permission-gated (member read-only)

```
Design the Scheduling Hub: one owner-polymorphic front door tying Personal, Home, and Business scheduling together. Mirror Me.html's structure exactly — identity switcher pill row up top re-scopes the entire screen — but the body is a scheduling dashboard, not a profile. Use the 44px status bar (9:41 + battery/signal SVGs) and 56px top bar from calendar-frames.jsx (no back chevron at a tab root; title "Scheduling", trailing overflow dots). Top-to-bottom: (1) IdentitySwitcherPillRow — three segmented pills, the active one filled in its pillar color (--color-identity-personal / -home / -business), accent below keys off it. (2) Booking-link card — white, 1px --app-border, 16px radius, --shadow-sm: a live preview thumbnail rail (140px), the monospace handle `pantopus.com/book/maria-k`, and two ghost buttons "Copy link" + "Share" (lucide copy / share-2, stroke 2). (3) Master "Pause all bookings" row — iOS toggle (32×18, knob slides, fill = active pillar color) with sub "New bookings are open". (4) Today + Upcoming strip — agenda rows reused from Home calendar.html: type-tile + title + time + attendee, "See all bookings" link → Bookings Inbox. (5) Quick rows group, A14.3 chevron rows with current-state sub: Event Types ("3 active"), Availability ("Mon–Fri, 9–5"), Connected Calendars ("Google · iCloud"), Bookings ("2 need approval"), Settings. (6) Primary CTA "Share booking link", --color-primary, 12px radius, --shadow-primary. States: empty collapses sections (Hub.html pattern) to a single amber setup banner "Set up your booking link" → wizard; loading uses shimmer skeleton rects (never "Loading…"); paused shows an amber banner replacing the toggle card with a Resume pill; Home variant adds a composed-availability explainer line "Times come from each member's personal availability" and a member-avatar stack; permission-gated hides all edit affordances and chevrons for members without calendar.edit, showing read-only rows. Voice: "Anyone with the link can book you.", "Pause all bookings", "2 bookings need your approval". Real buttons with full labels; works at largest dynamic type.
```

### Set Up Your Booking Link (First-Run Wizard)  `[MVP]` · full screen
- **Archetype:** WizardShell + Blocks (Headline, FormFields, ReviewSummary, SuccessHero) + StepRail
- **Match these references:** A12.11 Start a Support Train.html (StepRail with numbered discs + connectors, 2-col tile picker, iOS visibility toggles, warm primary CTA), Wizard.html (multi-step form archetype), A18 status screens (success hero)
- **Lives in:** Reached from Scheduling Hub empty-state CTA + Me Personal pillar "Set up booking" card. iOS `src/app/scheduling/setup.tsx`; web `/app/profile/schedule/setup`.
- **Context / pillar:** Personal sky `--color-identity-personal` (atomic source of truth)
- **Frames to produce:** Step 1 claim handle (default) + handle-taken conflict (inline error) + loading (availability check skeleton) + Step 3 hours + timezone (auto-detected chip) + Step 4 success hero + resume (partial completion)

```
Design the four-step first-run wizard that takes a host from zero to a shareable booking link in the fewest taps. Copy A12.11 Start a Support Train.html's wizard pattern 1:1 — same StepRail (numbered 22px discs, check on done, 2px connectors, "You're on step X of 4" overline) but recolored to Personal sky (--color-identity-personal, swap the warm tones for primary-600/primary-50). Status bar + 56px top bar with back chevron and centered "Set up booking". Step 1 — claim handle: a Headline ("Claim your booking link"), an input field (8px radius, monospace) prefilled `pantopus.com/book/maria-k`, with a live availability check showing a green success-light check chip ("Available") or, in the conflict frame, an inline --color-error message "That link is taken" + three suggestion chips. Step 2 — one starter event type: a 2-col tile picker (A12.11 ReasonPicker shape, 1.5px active border in primary, icon disc) preselecting "30-min meeting", with video/in-person segmented toggle below. Step 3 — default weekly hours: reuse the Support Trains weekday + time-range grid (Mon–Fri rows, each a real button showing "9:00 AM – 5:00 PM"), plus an auto-detected timezone chip "America/New_York · auto" the booker can tap to change; in the timezone-mismatch frame show a confirm banner. Step 4 — SuccessHero (A18): centered success disc (lucide check-circle-2), the live link in a copy card, primary "Share link" + ghost "Add another event type". Each step has skip affordance ("Use defaults") so steps 2–3 are one tap. Loading frame = shimmer skeleton on the availability row. Resume frame = the StepRail re-entered at step 3 with steps 1–2 checked and a "Pick up where you left off" sub. Voice: "Claim your booking link", "People will book you at this link", "You're all set". Every control a real labeled button; AA contrast; largest dynamic type safe.
```

### Scheduling Settings Root  `[MVP]` · section
- **Archetype:** GroupedList — settings list with chip-status subtext (extends A14.3 Settings.html / settings-archetype.jsx)
- **Match these references:** A14.3 Settings.html (grouped chevron rows, overlines, current-value sub, destructive card + mono footer), A14.5 Notifications.html (master toggle + chevron rows)
- **Lives in:** Booking settings within each identity pill; also Event-type editor → "Automations". iOS `src/app/scheduling/settings.tsx`; web `/app/profile/schedule/settings`.
- **Context / pillar:** Context-aware — overline labels and accent key off the active pill (Personal sky / Home green / Business violet)
- **Frames to produce:** loaded (default) + fresh (all defaults, no workflows) + saving + saved (toast/check) + Business variant (adds team + auto-confirm rows)

```
Design the Scheduling Settings Root: a grouped settings list gathering every scheduling preference and automation entry point for the current pillar. Match A14.3 Settings.html exactly — 52px top bar (back chevron + centered "Booking settings", no trailing affordance), white cards (1px --app-border, 12px radius), 11px uppercase fg3 overlines 18px above each group, chevron rows whose sub line carries the current value preview. Groups, top to bottom. AUTOMATION: "Default reminders" (sub "1 day · 1 hr", chevron → Quick-Setup), "Workflows & follow-ups" (chip "3 active", chevron → Workflows List), "Message templates" (sub "5 templates"), "Booking notifications" (sub "Push · Email" → notification prefs category). SCHEDULING DEFAULTS: "Default timezone" (sub "America/New_York · auto", with a timezone-lock affordance), "Default availability" (sub "Mon–Fri, 9–5", → schedule selector), "Cancellation policy" (sub "24-hour notice"). PAYMENTS: "Payments & payouts" (chip "Connected" success / "Connect" CTA when fresh, → A14.6 Payments). DANGER ZONE: a red-tinted card pinned last — "Reset booking link" and "Disable scheduling", red labels, no chevron, followed by mono footer with the booking URL + owner id. Status chips reuse the A14 vocabulary: success-light "3 active", warning "Set up". The "fresh" frame swaps all chips to "Off"/"Set up" amber and shows empty subs ("No workflows yet"). The "saving" frame puts a small inline shimmer on the row being written; "saved" shows a brief success check chip. Business variant inserts a TEAM group ("Team & seats", "Auto-confirm vs approve" with a segmented control). Voice: "Reminders go out automatically.", "Reset booking link", "Disable scheduling". Each row a full-label button; AA contrast at largest type.
```

### Scheduling Notifications Preferences  `[MVP]` · section
- **Archetype:** GroupedList with channelTriad — adds a "Scheduling & bookings" category to the existing NotificationSettings matrix (extends A14.5 Notifications.html)
- **Match these references:** A14.5 Notifications.html (three P/E/S channel chips per row, tinted column-header band, master pause banner, mono legend), settings-archetype.jsx (card chrome + row vocab)
- **Lives in:** Existing Notification Settings as a new "Scheduling & bookings" category; also Scheduling Settings Root "Notifications" row. iOS `src/app/settings/notification-preferences.tsx`.
- **Context / pillar:** Inherits the global Notifications screen; scheduling rows accent in the active pillar color
- **Frames to produce:** loaded (real mix) + paused (inherits master-pause amber banner) + SMS-locked rows + permission-gated (push off)

```
Do NOT build a standalone screen — design the new "Scheduling & bookings" category card to slot into the existing A14.5 Notifications.html matrix, matching it 1:1. Reuse the card chrome (white, 1px --app-border, 12px radius), the tinted channel-header band at the card top with three monospace letters P · E · S, and the channelTriad trailing slot: three 22×22 rounded-square chips per row (on = --color-primary fill + white letter; off = white fill + 1px gray border + gray letter; disabled = gray fill). Two sub-grouped cards under one overline. "NOTIFY ME": rows New booking, Cancellation, Reschedule, Reminder sent, No-show, Daily agenda — each a label (+ optional sub) on the lead and a P/E/S triad trailing. "NOTIFY ATTENDEES": rows Booking confirmation (locked on — show the confirmation channel non-togglable), Reminder, Reschedule notice, Cancellation notice. Show the SMS (S) column present but locked with a "Coming soon" treatment (disabled palette + a tiny lock glyph in the legend). Per-card footer helper in fg3: "Attendees always get a confirmation — you choose the rest." Add a host-facing reminder lead-time chip row beneath "Notify me": selectable chips "1 day", "1 hr", "15 min", "+ Add", active chip filled in pillar color. Mono legend at the bottom: "P · Push   E · Email   S · SMS (soon)". Paused frame: the global master-pause amber banner sits above with a countdown + Resume pill, and the scheduling category card drops to 55% opacity with chips in the disabled palette (A14.5 paused pattern). Permission-gated frame: if push is off at the OS level, show a thin inline "Turn on push in Settings" notice and gray the P column. Voice: "We'll tell you the moment someone books.", "Attendees always get a confirmation." Every chip a real labeled toggle button; AA contrast; works at largest dynamic type.
```

### Scheduling Summary Card  `[MVP]` · section
- **Archetype:** ContentDetail section — MeStatsRow / StatCellRow + web MetricTile grid (extends Me.html stats[] card)
- **Match these references:** Me.html (4-cell stats row card with 1px dividers, identity-keyed labels), Hub.html (section that collapses when empty), A10.1 Home.html (stat-row pattern)
- **Lives in:** Embedded section at the top of Scheduling Hub (Me Personal pillar scheduling section / Business pillar booking section). Powered by `getBusinessInsights('30d')`.
- **Context / pillar:** Context-aware owner — Personal sky / Business violet; labels rebind per owner
- **Frames to produce:** default (populated, this month) + empty (encouraging copy + share-link CTA) + loading skeleton + error + single-event-type (breakdown hidden)

```
Design the Scheduling Summary Card: an at-a-glance "X bookings this month" pulse embedded in the Scheduling Hub, not its own screen. Match the Me.html stats card — one white card (1px --app-border, 16px radius, --shadow-sm) holding a row of metric cells separated by 1px hairline dividers. Header line: an overline "THIS MONTH" on the left and a small period chip group on the right ("This week" / "This month", active filled in pillar color, default = month). Below it a 3–4 cell StatCellRow: "18 bookings" (big number 22/700, label fg3), "+24% vs last" (delta in --color-success with a tiny arrow-up, or --color-error arrow-down), "5 upcoming", "1 no-show". Beneath the cells a tiny inline sparkline of bookings over time — a flat SVG polyline in the pillar color over a faint baseline, no axis chrome. Footer: a right-aligned "See insights" text link (chevron-right) → full dashboard. The whole card keys its accent and number colors off the active owner's pillar color (Personal sky, Business violet). States: empty replaces metrics with encouraging copy ("No bookings yet — share your link to get your first one") and a primary "Share booking link" button; loading shows shimmer rects sized to the cells (never "Loading…"); error shows a quiet inline "Couldn't load your numbers" with a "Retry" ghost button; single-event-type hides any per-type breakdown and keeps just the four headline cells. Voice: "18 bookings this month", "+24% vs last month", "Share your link to get your first one". Cells are static text (not buttons); the period chips and "See insights" are real labeled controls; AA contrast; numbers legible at largest dynamic type.
```

### Scheduling Onboarding for Home & Business  `[v2]` · Wizard
- **Archetype:** WizardShell + StepRail + Blocks — extends the Personal setup-booking-link wizard for two new contexts; reuses AddHome / CreateBusiness wizard pattern
- **Match these references:** A12.11 Start a Support Train.html (StepRail, 2-col tile picker, member-invite branch, iOS toggles), A12.2 Add Home.html + Create Business wizard (context claim + member/team steps), A18 status screens (success hero)
- **Lives in:** Home pillar Scheduling Hub empty state (family scheduling first-run) + Business pillar Scheduling Hub empty state (business booking first-run). iOS `src/app/scheduling/setup-home.tsx` + `setup-business.tsx`.
- **Context / pillar:** Home green `--color-identity-home` (family wizard) and Business violet `--color-identity-business` (business wizard)
- **Frames to produce:** HOME — Step "Pick members" + Step "Collective vs round-robin" (mode picker) + success; BUSINESS — Step "Claim slug" + Step "Add first service" + Step "Seat the team" + Step "Auto-confirm vs approve"

```
Design two first-run wizards parallel to the Personal setup-booking-link wizard but for the materially harder Home and Business zero-to-value paths. Reuse A12.11's StepRail (numbered discs + connectors + "step X of N" overline) and 2-col tile pickers, plus the member-invite branch shape — recolor each wizard to its pillar (Home → --color-identity-home green; Business → --color-identity-business violet). Status bar + 56px top bar with back chevron. HOME WIZARD (3 steps): (1) "Choose who's scheduled" — a member multi-select list reused from the Support Trains invite step: verified-household rows with avatar + name + an iOS toggle (32×18, fill = home green) per member, plus an "Invite someone" row. (2) "How should times combine?" — a 2-col mode picker (A12.11 tile shape, 1.5px active border): "Collective — everyone must be free" (intersect required members) vs "Round-robin — whoever's available" (union + rule), each tile with an explainer line and a small diagram glyph. Under it, the locked composed-availability explainer card: "Times come from each member's personal availability — you're not setting hours twice." plus a shared-timezone confirm chip. (3) SuccessHero with the family booking link. BUSINESS WIZARD (4 steps): (1) "Claim your business link" — handle input prefilled `pantopus.com/book/acme-co` with live availability check + conflict suggestions. (2) "Add your first service" — a 2-col service tile picker (Consultation / Quote visit / etc.) with duration + price fields below. (3) "Seat your team" — team-member rows with role chips and seat counters, "Invite teammate" row, composed-availability explainer ("Booking times come from each seated teammate's personal availability"). (4) "Auto-confirm or approve?" — a segmented mode picker ("Auto-confirm bookings" vs "I approve each one") with explainer, then SuccessHero. Both: skip/"use defaults" on optional steps. Voice: "Family scheduling uses everyone's own hours.", "Whoever's free gets the booking.", "You approve each booking before it's confirmed." Every member toggle, mode tile, and field a real labeled control; composed-availability explainer always visible where members compose; AA contrast at largest dynamic type.
```

---

## B · Event types & availability

### Event Type / Service List  `[MVP]` · full screen
- **Archetype:** ListOfRows (+ existing catalog/items reorder endpoint)
- **Match these references:** List of Rows.html (row structure, overflow, drag handle); A08 Support trains.html (catalog-of-bookables framing, header + add affordance); empty state mirrors the A18 status-screen calm-empty pattern
- **Lives in:** Personal → Scheduling → Event Types; Business → Catalog (bookable projection). Web `/app/profile/schedule`
- **Context / pillar:** Personal sky `--color-identity-personal` for the personal variant; Business violet `--color-identity-business` for the services variant (accent only — toggles, active states, color dots stay neutral product blue for links/CTAs)
- **Frames to produce:** default (populated, personal) + business-services variant + empty (with template chips) + loading skeleton + all-hidden + reordering (drag in progress) + permission-gated (member, no create)

```
Use the Pantopus Design System skill — include colors_and_type.css, copy component recipes from preview/ (rows, chips, toggles, overflow menus, FAB) and layouts from ui_kits/mobile/, and use ios-frame.jsx for the device frame. Honor the non-negotiables: primary sky #0284C7 (--color-primary-600); pillar accent = Personal sky --color-identity-personal for the personal variant and Business violet --color-identity-business for the services variant, used ONLY on the identity pill and section overline; white cards, 1px --app-border, 16px radius, --shadow-sm, NO left-border accents; flat --app-bg shell; Lucide stroke-2 16–24px, no emoji; voice plainspoken, second person, verbs-first sentence-case; shimmer skeletons, never "Loading…".

Mirror List of Rows.html for the row primitive and A08 Support trains.html for the screen chrome. Build a 300×620 iPhone frame on an #eef2f7 canvas. Top bar: chevron back, centered title "Event types", right "+" action. Under it an identity pill (Personal · sky) and a segmented filter "Active / Hidden". Body is a scrollable list of bookable rows on white cards: each row = a 6px color dot, name ("Intro call"), a caption line of duration + location ("30 min · Video"), business rows add a price ("$120") and a small assignee-count badge ("3 hosts"), a right-aligned on/off toggle, a drag-handle (grip-vertical) on the left in reorder mode, and an overflow (•••) opening copy link / duplicate / share / hide / delete. A FAB is not needed since "+" lives in the top bar.

Render these frames left to right: (1) populated personal — 4 rows, two active two with subdued toggle; (2) business services variant — violet pill, prices + assignee badges; (3) empty — one calm line "You don't have any event types yet", a primary "Create your first event type", and three template chips "15 min" "30 min" "60 min"; (4) loading — three shimmer skeleton rows; (5) all-hidden — Active tab empty with "Everything's hidden. Switch to Hidden to bring one back."; (6) reordering — drag handles visible, one row lifted with --shadow-lg; (7) permission-gated — rows read-only, toggles disabled, a quiet banner "Only owners can edit this catalog." Copy examples: "Intro call · 30 min · Video", "Copy booking link", "Create your first event type".
```

### Event Type / Service Editor  `[MVP]` · full screen
- **Archetype:** Form (one form for create + edit; reuses AddEventForm duration vocabulary)
- **Match these references:** Form.html (field groups, section dividers, collapsible Advanced); A13 Edit Business Page.html (long settings-form with sections, color picker, save bar); A14.8 Vacation hold.html (date/toggle row idiom for visibility/approval)
- **Lives in:** Personal/Business → Scheduling → Event type → Edit. Web `/app/profile/schedule/event/:id`
- **Context / pillar:** Personal sky / Business violet (the editor reads `owner_type`; accent only on header pill and the section overlines)
- **Frames to produce:** create (defaults) + edit (populated) + Advanced expanded + collective-mode revealed (required-staff count) + Stripe-not-connected inline CTA + saving + error (duration/price invalid)

```
Use the Pantopus Design System skill — include colors_and_type.css, copy recipes from preview/ (text inputs, steppers, segmented selectors, color swatch picker, toggles, collapsible sections, sticky save bar) and ui_kits/mobile/, and use ios-frame.jsx. Honor the non-negotiables: sky #0284C7 primary (--color-primary-600); Personal sky / Business violet pillar accent ONLY on the header pill and overline labels; white cards, 1px --app-border, 16px radius, --shadow-sm, NO left-border accents; Lucide stroke-2, no emoji; plainspoken second-person verbs-first sentence case; shimmer skeletons.

Mirror Form.html for field grouping and A13 Edit Business Page.html for the long sectioned settings form with a sticky bottom save bar. 300×620 iPhone frame on #eef2f7. Top bar: chevron back, title "Event type", right "Save". Sections as white cards with overline labels: BASICS — name input ("Intro call"), description, a row of 8 color swatches (the chosen one ringed in its swatch color, NOT pillar). DURATION — single/multiple toggle; a duration stepper "30 min" with chips to add "15 / 45 / 60". LOCATION — segmented selector: In person / Phone / Video / Custom, revealing the matching field (address / number / link). AVAILABILITY — a row "Schedule · Working hours" that links out (chevron) to the Availability editor. Business adds ASSIGNMENT — segmented Anyone / Specific members / Collective; choosing Collective reveals a "Requires 2 of 3 hosts" stepper and a member-avatar row; "Specific members" opens a sheet. Then a collapsible ADVANCED card (chevron, collapsed by default) holding buffer-before/after steppers, minimum notice, booking horizon, per-day cap. Toggle rows (A14.8 idiom): "Require approval", "Unlisted (link only)", "Active". A PRICING & PAYMENT card: a "Charge for this" toggle revealing price + currency, deposit-vs-full segmented control; when Stripe is unconnected show an inline info card "Connect payments to charge for bookings" + a "Connect Stripe" button (sky). Links-out rows at the bottom: "Intake questions", "Booking limits", "Reminders".

Frames: (1) create with defaults; (2) edit populated, Advanced collapsed; (3) Advanced expanded; (4) business collective-mode revealed; (5) Stripe-not-connected inline CTA; (6) saving — save bar shows shimmer, fields disabled; (7) error — duration field outlined --color-error with helper "Enter a length between 5 and 480 minutes". Copy: "Charge for this booking", "Require approval before it's confirmed", "Connect payments to charge for bookings".
```

### Intake Questions Editor  `[v2]` · sheet
- **Archetype:** Form (nested) / ListOfRows inside a sheet
- **Match these references:** List of Rows.html (reorderable question rows + per-row delete); Form.html (the add/edit-question field group)
- **Lives in:** Event Type/Service Editor → "Intake questions" row; Booking Page Management → Intake questions
- **Context / pillar:** inherits the parent event type's pillar (Personal sky / Business violet); shared by both
- **Frames to produce:** defaults only (name/email locked) + with custom questions + editing a question (inline field group expanded) + reordering

```
Use the Pantopus Design System skill — include colors_and_type.css, copy recipes from preview/ (sheet container with grabber, rows, drag handles, segmented type selector, toggle, text input) and ui_kits/mobile/, and use ios-frame.jsx. Honor the non-negotiables: sky #0284C7 primary; pillar accent inherited from the parent event type, used only on the sheet title overline; white cards, 1px --app-border, 16px radius, --shadow-sm, NO left-border accents; Lucide stroke-2, no emoji; plainspoken second-person sentence case; shimmer skeletons.

Render this as a bottom sheet OVER a dimmed event-type editor inside a 300×620 iPhone frame on #eef2f7. Sheet: rounded-top 24px, grabber handle, title "Intake questions", a "Done" text button top-right. Mirror List of Rows.html for the reorderable list. First two rows are the locked defaults — "Name" and "Email" — shown with a small lock icon and a muted "Always asked" caption, no toggle, no drag handle. Below them, the custom questions list: each row shows the question label, a type caption ("Short text", "Dropdown"), a "Required" pill when on, a drag handle, and a delete (trash) icon. A full-width "Add a question" button (sky, plus icon) sits under the list. Editing a question expands an inline field group (Form.html idiom): a "Question" text input, a segmented type selector (Short text / Paragraph / Dropdown / Multi-select / Checkbox / Phone), a "Required" toggle, and for select types a small editable options list.

Frames: (1) defaults only — just the two locked rows + "Add a question"; (2) with custom questions — three custom rows ("What should we cover?", "Phone number", "How did you hear about us?"); (3) editing a question — the field group expanded for "What should we cover?" set to Paragraph, Required on; (4) reordering — drag handles active, one row lifted with --shadow-lg. Copy: "Name and email are always asked.", "What should we cover?", "Make this required".
```

### Availability Schedule List  `[MVP]` · full screen
- **Archetype:** ListOfRows
- **Match these references:** List of Rows.html (named-schedule rows, default badge, set-as-default action); A08 Support trains.html (header + add chrome); empty/seed state borrows the A18 calm-empty idiom
- **Lives in:** Personal → Scheduling → Availability. Web `/app/profile/schedule/availability`. Also reached from the event-type schedule picker
- **Context / pillar:** Personal sky `--color-identity-personal` (availability is the atomic personal source of truth)
- **Frames to produce:** single (note that it auto-opens the editor) + multiple + empty (seed default) + loading skeleton

```
Use the Pantopus Design System skill — include colors_and_type.css, copy recipes from preview/ (rows, badge pills, overflow menu, FAB/top-bar add) and ui_kits/mobile/, and use ios-frame.jsx. Honor the non-negotiables: sky #0284C7 primary; Personal sky --color-identity-personal accent on the identity pill and overline only; white cards, 1px --app-border, 16px radius, --shadow-sm, NO left-border accents; Lucide stroke-2, no emoji; plainspoken second-person verbs-first sentence case; shimmer skeletons.

Mirror List of Rows.html for the rows and A08 Support trains.html for the screen chrome. 300×620 iPhone frame on #eef2f7. Top bar: chevron back, title "Availability", right "+". Identity pill (Personal · sky). A short helper line under the header: "Times here are the source your home and business pages build from." Each schedule row (white card) shows: a calendar-clock Lucide icon, the schedule name ("Working hours"), a summary caption ("Mon–Fri, 9:00 AM – 5:00 PM"), the timezone ("PT"), a "Default" pill (filled sky) on the default one, and an overflow (•••) with "Set as default / Rename / Duplicate / Delete".

Frames: (1) single schedule — render a one-row list but caption it for the spec "with one schedule this list is skipped and the editor opens directly"; show just "Working hours · Default"; (2) multiple — "Working hours (Default)", "Evenings", "Weekends" with distinct summaries and timezones; (3) empty — calm copy "You don't have a schedule yet" + a primary "Add working hours" that seeds a 9–5 Mon–Fri default; (4) loading — two shimmer skeleton rows. Copy: "Mon–Fri, 9:00 AM – 5:00 PM", "Set as default", "Add working hours".
```

### Availability Schedule Editor (weekly hours)  `[MVP]` · full screen
- **Archetype:** Form (reuses the Support Trains weekday + time-range grid primitive)
- **Match these references:** A12.11 Start a Support Train.html (weekday rows + time-range pickers — the core weekly-hours primitive); Support trains.html (slot rows); Form.html (timezone selector, link-out rows, save bar); A14.8 Vacation hold.html (date-block link idiom)
- **Lives in:** Personal → Scheduling → Availability → schedule (or single-schedule auto-open). Also a Home-scheduler composition-gap deep link
- **Context / pillar:** Personal sky `--color-identity-personal`
- **Frames to produce:** default (9–5 Mon–Fri) + multi-block day + all-day-off warning + empty/unset (with composition-gap explainer) + saving

```
Use the Pantopus Design System skill — include colors_and_type.css, copy recipes from preview/ (toggles, time-range pickers, steppers, segmented controls, link-out rows, save bar) and ui_kits/mobile/, and use ios-frame.jsx. Honor the non-negotiables: sky #0284C7 primary; Personal sky --color-identity-personal accent on the pill and overline only; white cards, 1px --app-border, 16px radius, --shadow-sm, NO left-border accents; Lucide stroke-2, no emoji; plainspoken second-person sentence case; shimmer skeletons.

This is the atomic editor for the whole "home & business compose personal availability" model, so it must read as the source of truth. REUSE the A12.11 Start a Support Train.html weekday + time-range grid exactly: one row per weekday (Mon–Sun) with a left on/off toggle and, when on, one or more time-range pickers ("9:00 AM – 5:00 PM"), each a REAL labeled button (full label: day, start, end) — not a dense fixed grid, must work at the largest dynamic-type size and with VoiceOver. Each enabled day has a small "+ Add a block" affordance to add a second/third range. A per-row "Copy to…" action opens a day-picker to clone hours. Above the grid: a name field ("Working hours") and a TIMEZONE card — an auto-detected timezone chip the user can tap to change ("Pacific Time · auto") plus a "Lock to my timezone" toggle. Below the grid: link-out rows (chevron, Form.html idiom) "Date overrides & holidays" and "Booking limits & notice rules". Sticky save bar.

Frames: (1) default — Mon–Fri on at 9–5, Sat/Sun off; (2) multi-block day — Wednesday with two ranges "9:00–12:00" and "1:00–5:00"; (3) all-day-off warning — every day off, an inline warning card (--color-warning-bg, alert-triangle) "No hours set. People can't book you until you add at least one." with a "Use 9–5, Mon–Fri" quick-default button; (4) empty/unset — a calm "Set your hours" hero, the "Use 9–5, Mon–Fri" quick default, AND a composition-gap explainer card "Your family and business pages build on these hours, so set them first." (entry point from a Home scheduler gap); (5) saving — save bar shimmer, grid disabled. Copy: "Pacific Time · auto", "Copy to other days", "Use 9–5, Mon–Fri".
```

### Date Overrides & Holidays  `[v2]` · sheet
- **Archetype:** ListOfRows + date picker (in a sheet)
- **Match these references:** List of Rows.html (override rows + delete); A14.8 Vacation hold.html (the date-block / date-range pattern — block a day or a range); Form.html (the per-date custom-hours field group)
- **Lives in:** Availability Schedule Editor → "Date overrides & holidays" row
- **Context / pillar:** Personal sky `--color-identity-personal`
- **Frames to produce:** none (empty) + with overrides + editing an override (custom hours) + holiday-set import

```
Use the Pantopus Design System skill — include colors_and_type.css, copy recipes from preview/ (sheet with grabber, calendar/date picker, rows, segmented control, time-range pickers, delete) and ui_kits/mobile/, and use ios-frame.jsx. Honor the non-negotiables: sky #0284C7 primary; Personal sky accent on the sheet overline only; white cards, 1px --app-border, 16px radius, --shadow-sm, NO left-border accents; Lucide stroke-2, no emoji; plainspoken second-person sentence case; shimmer skeletons.

Render as a bottom sheet over a dimmed Availability editor inside a 300×620 iPhone frame on #eef2f7. Sheet: rounded-top 24px, grabber, title "Date overrides", "Done" top-right. Mirror A14.8 Vacation hold.html for the date-block / date-range mechanic and List of Rows.html for the existing-overrides list. Layout top to bottom: a compact month calendar to pick a date or drag a range; under it a segmented choice for the selected date(s) — "Unavailable" or "Custom hours" (custom reveals a time-range picker like the weekly grid). A "Block a date range" link opens start/end for vacations. Then an OVERRIDES list of white-card rows: each shows the date ("Thu, Jul 4"), what it does ("Unavailable" or "10:00 AM – 2:00 PM"), and a delete (trash). A "Holiday sets" card lets the user toggle a set on ("US public holidays") to block them in bulk.

Frames: (1) none — calendar + "No date overrides yet. Pick a date to add one."; (2) with overrides — three rows: "Thu, Jul 4 · Unavailable", "Fri, Aug 1 · 10:00 AM – 2:00 PM", "Dec 24–26 · Unavailable"; (3) editing an override — "Custom hours" selected for a date with the time-range picker expanded; (4) holiday-set import — the "US public holidays" toggle on with a caption "Adds 11 days off this year". Copy: "Block this date", "Add custom hours for this day", "US public holidays".
```

### Booking Limits & Notice Rules  `[v2]` · sheet
- **Archetype:** Form (sheet)
- **Match these references:** Form.html (stepper + segmented field groups in a sheet); A13 Edit Business Page.html (numeric settings rows with units); A14.8 Vacation hold.html (toggle/row idiom for the cap rows)
- **Lives in:** Availability Schedule Editor → "Booking limits" row; also Event Type/Service Editor → Limits (per-type override)
- **Context / pillar:** Personal sky `--color-identity-personal` (or the event type's pillar when opened as a per-type override)
- **Frames to produce:** defaults + custom + conflict error (window < min-notice)

```
Use the Pantopus Design System skill — include colors_and_type.css, copy recipes from preview/ (sheet with grabber, steppers with unit suffixes, segmented controls, inline error) and ui_kits/mobile/, and use ios-frame.jsx. Honor the non-negotiables: sky #0284C7 primary; pillar accent on the sheet overline only; white cards, 1px --app-border, 16px radius, --shadow-sm, NO left-border accents; Lucide stroke-2, no emoji; plainspoken second-person sentence case; shimmer skeletons.

Render as a bottom sheet over a dimmed editor inside a 300×620 iPhone frame on #eef2f7. Sheet: rounded-top 24px, grabber, title "Booking limits", "Done" top-right. A short helper: "Sensible defaults are set, so you usually don't need to touch these." Mirror Form.html for the field groups. Rows as white cards, each a label + a numeric stepper with a unit suffix or a segmented control: "Minimum notice" stepper ("4 hours" — can't book inside this window); "Book up to" stepper ("60 days" out); "Max per day" stepper ("8"); "Max per week" stepper ("20"); "Per-person limit" stepper ("2 bookings"); "Start times" segmented control (":00 only" / ":00 & :30" / "every 15 min"). Each row has a one-line caption explaining the effect.

Frames: (1) defaults — the values above, all calm/neutral; (2) custom — tighter values ("12 hours notice", "14 days out", "Max per day 3"); (3) conflict error — the "Book up to" set to "0 days" with the field outlined --color-error and an inline message "Your booking window is shorter than your minimum notice, so no times will show." plus a disabled Done. Copy: "Can't be booked inside this window.", "Your booking window is shorter than your minimum notice.", ":00 & :30".
```

### Connected Calendars  `[v2]` · sheet
- **Archetype:** Sheet with provider rows + OAuth handoff (also embeddable as a section in the Availability editor)
- **Match these references:** List of Rows.html (provider/account rows with status + per-row toggles); A14.8 Vacation hold.html (status-row + re-auth banner idiom); A13 Edit Business Page.html (connect-button rows); coming-soon placeholder borrows the A18 status-screen calm idiom
- **Lives in:** Scheduling Hub → Connected Calendars; Availability editor → "Connect calendar" row; onboarding optional step; Settings
- **Context / pillar:** Personal sky `--color-identity-personal`
- **Frames to produce:** placeholder (coming soon) + none connected + connecting (OAuth) + connected/synced + sync-error / re-auth needed + permission-denied

```
Use the Pantopus Design System skill — include colors_and_type.css, copy recipes from preview/ (sheet with grabber, provider rows, status pills, toggles, buttons, banner cards) and ui_kits/mobile/, and use ios-frame.jsx. Honor the non-negotiables: sky #0284C7 primary; Personal sky accent on the overline only; white cards, 1px --app-border, 16px radius, --shadow-sm, NO left-border accents; Lucide stroke-2, no emoji; plainspoken second-person sentence case; shimmer skeletons; status carried by semantic chips + icons, NEVER left-border or flood-fill.

Render as a bottom sheet over a dimmed Scheduling hub inside a 300×620 iPhone frame on #eef2f7. Sheet: rounded-top 24px, grabber, title "Connected calendars", "Done" top-right. Provider connect rows (white cards): Google Calendar, Apple Calendar, Outlook — each a provider mark, name, and a "Connect" button (sky). A connected account expands to two toggle rows: "Check for conflicts" and "Add bookings to this calendar", plus a status caption ("Synced 2 min ago") and a "Disconnect" text link. The most important state is RE-AUTH NEEDED — surface it loudly but calmly with a --color-warning-bg banner card (alert-triangle) "Reconnect Google to keep checking for conflicts" + a "Reconnect" button; explain the risk in plain words: "Until you reconnect, we can't see new events and might double-book you."

Frames: (1) placeholder/coming soon — a calm A18-style card "Calendar sync is coming soon. We'll let you know when you can connect." with the three provider logos greyed; (2) none connected — three "Connect" rows, no accounts; (3) connecting — a Google row mid-OAuth with a shimmer status and a muted "Opening Google…" (use shimmer, not the word Loading); (4) connected/synced — Google connected, both toggles on, "Synced 2 min ago", Outlook still offering Connect; (5) sync-error / re-auth — the warning banner described above on the Google row; (6) permission-denied — Apple row with a muted note "Calendar access was declined. Allow it in Settings to connect." and an "Open Settings" link. Copy: "Check for conflicts", "Reconnect Google to keep checking for conflicts", "Until you reconnect, we can't see new events and might double-book you."
```

### Block off time / Personal busy override  `[MVP]` · sheet
- **Archetype:** Form (sheet) — reuses the AddEventForm date/time fields but writes a personal busy hold, not a bookable event
- **Match these references:** A14.8 Vacation hold.html (the date-block primitive — closest existing pattern, this is its single-day inverse-of-a-booking sibling); A12.11 Start a Support Train.html (time-range picker for the block window); Form.html (the recurrence + note field group)
- **Lives in:** Availability editor → "Block off time"; Home calendar overflow → "Block time off"; Scheduling hub FAB. Web `/app/profile/schedule/availability` (busy-hold action)
- **Context / pillar:** Personal sky `--color-identity-personal` (it writes onto the personal source of truth)
- **Frames to produce:** default (single one-off block) + recurring + all-day + conflict warning (overlaps an existing booking) + saving

```
Use the Pantopus Design System skill — include colors_and_type.css, copy recipes from preview/ (sheet with grabber, date picker, time-range picker, all-day toggle, segmented recurrence, note input, save bar) and ui_kits/mobile/, and use ios-frame.jsx. Honor the non-negotiables: sky #0284C7 primary; Personal sky accent on the overline only; white cards, 1px --app-border, 16px radius, --shadow-sm, NO left-border accents; Lucide stroke-2, no emoji; plainspoken second-person verbs-first sentence case; shimmer skeletons; conflicts carried by a semantic warning chip + icon, never a flood-fill or left-border.

This is the host's quick "+ Busy time" action — the inverse of a booking. It drops an ad-hoc busy block onto personal availability so the engine stops offering that slot. It does NOT create a bookable event and is NOT a whole-day date override. Mirror A14.8 Vacation hold.html for the date-block frame and reuse the A12.11 Start a Support Train time-range picker for the window. Render as a bottom sheet over a dimmed Availability editor or Home calendar inside a 300×620 iPhone frame on #eef2f7. Sheet: rounded-top 24px, grabber, title "Block off time", "Save" top-right. Field group: a "Reason" text input (optional, placeholder "Dentist", note it shows only to you); a date row; an "All day" toggle; when off, a start/end time-range picker (REAL labeled buttons with full date+time labels, VoiceOver-ready, work at largest dynamic-type); a "Repeats" segmented/select row (Does not repeat / Daily / Weekly / Custom). A footnote: "This time won't be offered for booking. It's private to you."

Frames: (1) default — one-off "Dentist", Thu Jun 18, 2:00–3:00 PM, no repeat; (2) recurring — "Out Friday afternoons", Weekly, Fri 1:00–5:00 PM, with an end-condition caption; (3) all-day — "All day" toggle on, time pickers hidden, a date row only; (4) conflict warning — the chosen window overlaps a confirmed booking: a --color-warning-bg chip-led card (alert-triangle) "This overlaps a confirmed 2:30 PM booking. Blocking won't cancel it." and a "View booking" link, Save still enabled; (5) saving — save bar shimmer, fields disabled. Copy: "Dentist", "This time won't be offered for booking.", "This overlaps a confirmed 2:30 PM booking. Blocking won't cancel it."
```

---

## C · Public link & invitee — discover and pick a time

### Booking Link / Public Page Management  `[MVP]` · section
- **Archetype:** Form / section reusing the EditBusinessPage block-editor + public-slug + token-invite patterns
- **Match these references:** A13 Edit Business Page.html; A13 Share Home.html (share/QR block); A14 settings-list pattern (toggle rows)
- **Lives in:** Scheduling Hub -> booking-link card; Business PageEditor (Booking block); web /app/profile/schedule/link
- **Context / pillar:** Owner-polymorphic — Personal sky `--color-identity-personal`, Business violet `--color-identity-business`; accent follows the active pillar pill at top
- **Frames to produce:** default (live, populated) + draft + paused + saving (inline spinner on Save, never "Loading…") + saved (toast) + slug-taken/conflict (error) + no-services-warning

```
Use the Pantopus Design System skill — include colors_and_type.css, copy component recipes from preview/ and ui_kits/mobile/, use ios-frame.jsx (300x620, 42px outer / 32px inner radius, 9:41 status bar + dynamic island, home indicator), canvas #eef2f7. Honor non-negotiables: primary sky var(--color-primary-600); pillar accent follows the active identity pill (Personal var(--color-identity-personal), Business var(--color-identity-business)) for active states/icons, CTAs stay sky; system font; Lucide stroke-2 16-24px, no emoji; white cards, 1px var(--app-border), 16px radius, var(--shadow-sm), NO left-border accents; flat var(--app-bg) shell; voice plainspoken second-person verbs-first sentence case, no exclamations; shimmer skeletons never "Loading…".

Build the Booking Link management SECTION as a top-bar screen (left chevron back, centered title "Booking link", right "Save" text button in primary). Mirror A13 Edit Business Page's grouped block-editor and A14 settings rows. Top to bottom: (1) an identity pill row (Personal/Business) showing whose link this is. (2) A live/paused toggle card — overline "Status", a switch, and a status chip (var(--color-success-bg)/"Live" or var(--app-surface-sunken)/"Paused"). (3) Slug card: "pantopus.com/book/" prefix in var(--fg3) + editable input, with an inline availability check (green check + "Available" or var(--color-error) "That handle is taken" in the conflict frame). (4) Header fields card: avatar (reuse profile avatar), display name, tagline inputs. (5) Service visibility card: rows of event types each with a Lucide icon + name + duration + a toggle; show a var(--color-warning-bg) inline note in the no-services frame ("Turn on at least one service so people can book"). (6) Copy "Intro & confirmation" textareas. (7) "Intake questions" nav row (chevron). (8) Visibility segmented control: Listed / Link-only. (9) "Connect payments" row (Lucide credit-card, "Connect Stripe to take paid bookings", chevron). (10) Footer buttons: "Copy link", "Share", "View QR". Bottom-fixed primary "Save changes"; render the saving frame with a small inline spinner inside it and a "Saved" toast in another frame. Copy: "Anyone with this link can book you." / "Page is paused. People see a short note and cannot book." / "That handle is taken. Try another." Render all 7 frames side by side.
```

### Public Booking Page Preview  `[MVP]` · modal
- **Archetype:** OwnerPreviewFrame — in-screen "Preview as invitee" mode flip (mirrors BusinessOwnerView owner<->preview)
- **Match these references:** A10.6 Business profile.html; A21.1 Persona Profile.html / A21.2 Local Profile.html; A10.9 Support train.html (public slot list); Place - Preview.html (PreviewBar pattern)
- **Lives in:** Booking Link/Page Management "Preview"; Scheduling Hub "Preview"
- **Context / pillar:** Owner viewing their own page — accent follows owner pillar; render is read-only invitee view
- **Frames to produce:** rendered (default) + loading skeleton + page-off notice (paused) + all-types-hidden (empty)

```
Use the Pantopus Design System skill — include colors_and_type.css, recipes from preview/ and ui_kits/mobile/, ios-frame.jsx (300x620), canvas #eef2f7. Honor non-negotiables (sky var(--color-primary-600) primary; pillar accent var(--color-identity-personal)/var(--color-identity-business); system font; Lucide stroke-2, no emoji; white cards 1px var(--app-border) 16px radius var(--shadow-sm), NO left-border; voice plainspoken verbs-first sentence case, no exclamations; shimmer skeletons).

Build the owner-facing PREVIEW MODAL: a read-only render of the live /book/[slug] page wrapped in a dark "preview chrome", with zero owner affordances leaking through. Top: a dark var(--app-text) PreviewBar (full-width, above the status-bar-safe area) reading "Previewing your booking page" with a Lucide eye icon left and an "x" exit right; mirror Place - Preview.html's PreviewBar. Below it the public render, mirroring A10.6 Business profile + A21 persona profile header then A10.9 Support train's public slot teaser: host avatar + name + headline, a one-line blurb, a stack of event-type cards (Lucide icon, name, duration like "30 min", location-mode chip "Video call"), and a primary "Pick a time" affordance shown but visibly inert (the whole render is non-interactive). A small pill caption under the bar: "Preview only. Nothing here is bookable." Produce four frames: (1) RENDERED with two event types populated; (2) LOADING — the whole render as shimmer skeleton blocks (avatar circle, two lines, three card rows), PreviewBar still solid; (3) PAGE-OFF — a centered calm notice card (Lucide moon icon, "Your page is paused", caption "Turn it back on in Booking link to take bookings", muted, no error red); (4) ALL-TYPES-HIDDEN — empty card "No services are visible yet" + caption "Turn one on so people see something to book." Copy stays second person. This is an in-place mode flip, not a navigated route — no back chevron, only the exit x.
```

### Share Your Link Sheet  `[MVP]` · sheet
- **Archetype:** SystemShareSheet + new QR view; SystemSheets InviteLinks pattern
- **Match these references:** A13 Share Home.html (share + QR layout); A14.6 Payments.html (row pattern for toggles)
- **Lives in:** Scheduling Hub "Share booking link"; first-run wizard success; event-type detail overflow; public profile "Book" owner-side
- **Context / pillar:** Works for Personal sky / Home green / Business violet — context label + accent set by the link's pillar
- **Frames to produce:** default + link-not-public warning (page still draft) + copied toast + QR fullscreen + regenerate-link confirm (destructive)

```
Use the Pantopus Design System skill — include colors_and_type.css, recipes from preview/ and ui_kits/mobile/, ios-frame.jsx (300x620), canvas #eef2f7. Honor non-negotiables (sky var(--color-primary-600) primary; pillar accent = the link's identity color var(--color-identity-personal/home/business); system font; Lucide stroke-2 16-24px, no emoji; white cards 1px var(--app-border) 16px radius var(--shadow-sm), NO left-border; voice plainspoken verbs-first sentence case, no exclamations; shimmer skeletons).

Build the Share BOTTOM SHEET — a rounded-top sheet (24px top radius) floating over a dimmed app, with a grabber handle. Mirror A13 Share Home's share + QR composition. Top to bottom: (1) a context label overline (e.g. "Personal booking link") with a small pillar-colored dot. (2) A big copyable URL card: "pantopus.com/book/alexkim" in monospace var(--font-mono), with a primary "Copy" button right; a "Copied" toast frame shows a var(--color-success) chip "Link copied". (3) A row of large square share targets (Lucide icons, real labels under each): Share, QR code, Messages, Email. (4) A QR preview thumbnail card with "Show QR" — its own frame expands to a FULLSCREEN QR (centered high-contrast QR placeholder on white, the URL beneath, "Done" top bar). (5) Two settings toggle rows (A14.6 row pattern): "Show on my profile" and "Add to email signature". (6) A quiet text button at the bottom "Regenerate link" in var(--color-error) — its confirm frame is a small modal card "Regenerate this link? The old link stops working" with "Cancel" + a var(--color-error) "Regenerate". Plus a WARNING frame: when the page is still a draft, a var(--color-warning-bg) inline banner at top "This page isn't live yet. People can't book until you turn it on." with a "Turn on" link. Copy: "Anyone with this link can book you." / "Old links will stop working." Render frames: default, draft-warning, copied-toast, QR-fullscreen, regenerate-confirm.
```

### One-off / Single-use Link Generator  `[MVP]` · sheet
- **Archetype:** Form (compact) reusing token-invite infra (crypto random + SHA-256 + expiry) + iOS share sheet
- **Match these references:** A12.11 Start a Support Train.html (compact config form); A13 Share Home.html (generated-link + share row)
- **Lives in:** Bookings Inbox FAB; Booking Detail follow-up; Messages compose (attach booking link); pillar booking settings
- **Context / pillar:** Pillar of the host generating it — accent follows pillar
- **Frames to produce:** configuring (default) + generated + copied + error

```
Use the Pantopus Design System skill — include colors_and_type.css, recipes from preview/ and ui_kits/mobile/, ios-frame.jsx (300x620), canvas #eef2f7. Honor non-negotiables (sky var(--color-primary-600) primary; pillar accent var(--color-identity-personal/business); system font; Lucide stroke-2, no emoji; white cards 1px var(--app-border) 16px radius var(--shadow-sm), NO left-border; voice plainspoken verbs-first sentence case, no exclamations; shimmer skeletons never "Loading…").

Build the One-off Link Generator BOTTOM SHEET (24px top radius, grabber). It creates a single-use or time-boxed link for a specific invitee. Mirror A12.11 Start a Support Train's compact config layout and A13 Share Home's generated-link block. Configuring frame top to bottom: (1) sheet title "Create a one-off link" + caption "Send a private link for one person." (2) Event-type picker card — a tappable row showing the chosen type (Lucide icon, "Intro call · 30 min", chevron) or a "Custom duration" alt with duration chips (15/30/45/60 min) reusing the Support Train time-range chip style. (3) "Offer specific times" toggle — when on, a compact 2-3 slot list of proposed times (reuse Support Train slot rows: weekday + date + time range); when off caption "We'll show your full availability." (4) Expiry control: chips "24 hours / 7 days / 30 days / No expiry". (5) "Single use" toggle with caption "Link stops working after one booking." (6) "Ask intake questions" toggle. Bottom primary "Generate link". GENERATED frame: the form collapses to a result card — the new URL in var(--font-mono), a primary "Copy", and a share row (Share, Messages, Email) plus an "expires in 7 days · single use" caption chip. COPIED frame: var(--color-success) "Link copied" toast. ERROR frame: var(--color-error-bg) inline note "Couldn't create the link. Try again" with a verbs-first "Try again" text button. Copy: "Send a private link for one person." / "Link stops working after one booking." Render all four frames.
```

### Booking Landing / Booker Profile  `[MVP]` · full screen
- **Archetype:** ContentDetail + ListOfRows event-type cards (web: clone support-trains/[id] public layout); DeepLinkRouter Destination case book(slug:)
- **Match these references:** A21.1 Persona Profile.html / A21.2 Local Profile.html (host header); A10.6 Business profile.html; A08 Support trains.html + A10.9 Support train.html (public event-type/slot list)
- **Lives in:** public web /book/[slug]; in-app mirror via deeplink pantopus://book/:slug; host public profile "Book time"; QR/email/SMS
- **Context / pillar:** Invitee (auth-optional) — accent follows the host's pillar; team links show member avatars
- **Frames to produce:** loading skeleton + multiple-event-types (default) + single-event-type (auto-skip note) + group-event (seats available + full) + team/group (composed availability) + no-active-types (host paused) + empty (no availability) + link-disabled/host-not-found (error)

```
Use the Pantopus Design System skill — include colors_and_type.css, recipes from preview/ and ui_kits/mobile/, ios-frame.jsx (300x620), canvas #eef2f7. Honor non-negotiables (sky var(--color-primary-600) primary; accent follows host pillar var(--color-identity-personal/home/business); system font; Lucide stroke-2 16-24px, no emoji; white cards 1px var(--app-border) 16px radius var(--shadow-sm), NO left-border; voice plainspoken second-person verbs-first sentence case, no exclamations; shimmer skeletons).

Build the public Booking LANDING (full screen, no app tab bar). Mirror A21 persona/local profile header + A10.9 Support train's public event-type list. Top to bottom: (1) host header — large avatar (verified green check if verified), host name, headline, a one-line blurb; for TEAM links show a small stacked member-avatar cluster + "Meet with the team". (2) An "Open in app" banner (OpenInAppButton, Lucide smartphone, "Get a faster booking experience", dismissible) — smart-routing note. (3) ListOfRows of event-type cards: each = Lucide icon, name, duration ("30 min"), a location-mode chip ("Video call" / "In person" / "Phone"), chevron; tapping starts scheduling. (4) Powered-by-Pantopus footer + a link to the host's public profile. Frames: LOADING (avatar circle + 2 lines + three card-row skeletons, shimmer); MULTI (default, 3 event types); SINGLE (one type, with a caption "Going straight to pick a time" implying auto-skip to the date picker); GROUP-EVENT (a fixed-time card: date + time, a seats chip "4 of 8 spots left" using var(--color-success), primary "Save your spot") and a FULL variant (chip "Fully booked" muted, primary disabled, "Join waitlist" secondary); TEAM/COMPOSED (an explainer pill under the header "Times come from each member's availability" + a small "Round-robin" or "Everyone attends" tag); PAUSED (calm card "This page isn't taking bookings right now", muted, no red); EMPTY (no availability configured, "No times are set up yet"); ERROR (Lucide link-2-off, "This link isn't available", caption "It may have been turned off or moved", no alarm). Copy: "Pick a time that works for you." / "4 of 8 spots left." / "Times come from each member's availability." Render every frame.
```

### Date + Time Slot Picker  `[MVP]` · full screen
- **Archetype:** SlotCalendar (extend states); web two-pane calendar+slots mirroring support-trains calendar page
- **Match these references:** Support trains.html + A12.11 Start a Support Train.html (weekday/time grid -> slot picker) + A10.9 Support train.html (slot rows); Home calendar.html (month strip)
- **Lives in:** from Booking Landing after event-type pick; direct deep-link (single type); reschedule CTA on Manage Your Booking / Booking Detail
- **Context / pillar:** Invitee — accent follows host pillar; selected/today states use pillar color
- **Frames to produce:** loading slots (skeleton) + day-with-slots (default) + day-fully-booked + no-availability-in-month ("next available") + timezone/DST hint + slot-just-taken race (toast) + reschedule mode + reschedule-cutoff-passed (blocked)

```
Use the Pantopus Design System skill — include colors_and_type.css, recipes from preview/ and ui_kits/mobile/, ios-frame.jsx (300x620), canvas #eef2f7. Honor non-negotiables (sky var(--color-primary-600) primary; accent follows host pillar var(--color-identity-personal/home/business) for today/selected; system font; Lucide stroke-2 16-24px, no emoji; white cards 1px var(--app-border) 16px radius var(--shadow-sm), NO left-border; voice plainspoken verbs-first sentence case, no exclamations; shimmer skeletons never "Loading…").

Build the Date + Time Slot Picker (full screen, top bar: chevron back, title "Pick a time", no right action). Calendar + slots STACK in ONE scroll, not a wizard split. Mirror Support Train's weekday/time grid + A10.9 slot rows and Home calendar's month strip. Top to bottom: (1) a summary header card — event type + duration ("Intro call · 30 min", Lucide video icon) and a tappable TIMEZONE chip ("Times shown in PDT", Lucide globe, chevron — opens the Timezone sheet). (2) Month calendar: month label + prev/next chevrons + a "Next available" text jump; a 7-col grid where EVERY day is a real button with a full aria-label (day, date, availability) — available days are solid/tappable, unavailable are muted/disabled, today has a pillar-colored ring, selected is a filled pillar-colored circle. Make cells generous (work at largest dynamic-type), never a dense fixed grid. (3) For the selected day, a slot list grouped "Morning / Afternoon" — each slot a full-width real button (reuse Support Train slot rows) showing the time ("9:30 AM") and, on a chosen slot, a host-local-time hint caption ("12:30 PM for Alex"). Frames: LOADING (calendar shown, slot column as shimmer rows); DAY-WITH-SLOTS (default, ~6 slots); FULLY-BOOKED (selected day, empty slot area: "No times left this day", quiet, + "See next available" link); NO-AVAILABILITY-IN-MONTH (month with all days muted + a centered prompt "Nothing open in June" + primary-link "Jump to next available"); TZ/DST-HINT (a var(--color-info-bg) caption under the tz chip "Clocks change this weekend — times are adjusted"); SLOT-JUST-TAKEN (a var(--color-warning) toast "That time was just taken" + the slot greys out, list refetched); RESCHEDULE mode (a var(--color-info-bg) banner at top "Currently booked for Tue, Jun 17 at 9:30 AM" carrying the existing booking, same picker below); RESCHEDULE-CUTOFF (banner var(--color-warning-bg) "This booking can't be moved anymore", picker disabled, "Message host" secondary). Copy second person. Render every frame.
```

### Timezone Selector  `[MVP]` · sheet
- **Archetype:** ListOfRows in a searchable sheet (popover/dropdown on web)
- **Match these references:** A14 settings-list row pattern (searchable list + checkmark rows)
- **Lives in:** tapping the timezone control on the Date + Time Slot Picker
- **Context / pillar:** Invitee — accent follows host pillar; checkmark uses pillar color
- **Frames to produce:** default (device tz preselected) + search results + no-match + manually-overridden

```
Use the Pantopus Design System skill — include colors_and_type.css, recipes from preview/ and ui_kits/mobile/, ios-frame.jsx (300x620), canvas #eef2f7. Honor non-negotiables (sky var(--color-primary-600) primary; accent var(--color-identity-personal/home/business) for the selected checkmark; system font; Lucide stroke-2, no emoji; white cards 1px var(--app-border) 16px radius var(--shadow-sm), NO left-border; voice plainspoken sentence case, no exclamations; shimmer skeletons).

Build the Timezone SELECTOR as a bottom sheet (24px top radius, grabber, "Time zone" title + "Done" text button right). Never a full screen. Mirror the A14 searchable settings-list. Top to bottom: (1) a search field (Lucide search, placeholder "Search city or time zone"). (2) A pinned "Detected" section — one row for the device tz with a small "Detected" chip and a pillar-colored check if selected: "Pacific Time — Los Angeles", right-aligned "GMT-7 · 2:14 PM". (3) A "Common" section — ~6 rows (Eastern, Central, Mountain, Pacific, London/GMT, Central European), each row = city/zone name, and a right-aligned caption "GMT offset · current local time"; the active one carries a pillar-colored check. Each row is a real full-label button. Frames: DEFAULT (device tz checked at top, common list below); SEARCH-RESULTS (search field has "lon", list filtered to London/GMT rows with the query highlighted); NO-MATCH (empty state card, Lucide search-x, "No time zones match 'xyz'", caption "Try a city name", no error red); MANUALLY-OVERRIDDEN (a non-device tz is checked, and a quiet var(--color-info-bg) caption at top "You changed this from your detected zone" with a "Reset to detected" link). Copy: "Search city or time zone." / "Times update to match." Render all four frames.
```

### Slot / Availability Loading Skeleton + No-Availability State (invitee)  `[MVP]` · state
- **Archetype:** SlotCalendar interim + empty states (extends the Date + Time Slot Picker)
- **Match these references:** A10.9 Support train.html (slot rows -> skeletoned); A18 status screens (no-availability empty/composed); Place - ProfileDashboard.html shimmer recipe (.pl-skel)
- **Lives in:** interim of /book/[slug] date+time picker while the engine composes availability; especially the Home collective-intersect path
- **Context / pillar:** Invitee — accent follows host pillar (Personal/Business); Home find-a-time uses Home green
- **Frames to produce:** loading skeleton + composing (intersecting members) + no-times-in-range (next month) + no-times-anywhere (waitlist / notify) + composed-empty (home intersect explainer)

```
Use the Pantopus Design System skill — include colors_and_type.css, recipes from preview/ and ui_kits/mobile/, ios-frame.jsx (300x620), canvas #eef2f7. Honor non-negotiables (sky var(--color-primary-600) primary; accent follows host pillar — Home green var(--color-identity-home) for the compose path; system font; Lucide stroke-2, no emoji; white cards 1px var(--app-border) 16px radius var(--shadow-sm), NO left-border; voice plainspoken verbs-first sentence case, no exclamations; shimmer skeletons, NEVER "Loading…"). Reuse the Place dashboard shimmer recipe (.pl-skel + keyframes) exactly.

Build the slot LOADING + NO-AVAILABILITY states for the booker date+time picker. This is the highest-traffic surface — empty/loading here must feel calm and intentional, not broken. Keep the picker's summary header + month calendar visible; only the slot region changes. Frames: (1) LOADING-SKELETON — calendar rendered normally, slot column is 5-6 shimmer rows (the same width as real slot rows from A10.9), no spinner, no text. (2) COMPOSING — for Home/Business team links: the same skeleton plus a quiet caption above it "Finding times that work for everyone" with a small member-avatar cluster; below, the composed-availability explainer pill "Times come from each member's availability." (3) NO-TIMES-IN-RANGE — a centered calm empty card (Lucide calendar-search, NOT error red): headline "No open times in June", caption "Availability changes often. Try a later month.", primary "See July", secondary "Get notified when times open". (4) NO-TIMES-ANYWHERE — empty card "No times are open right now", caption "We'll let you know the moment something frees up", primary "Notify me" + a secondary "Join waitlist" (chip "3 people waiting"). (5) COMPOSED-EMPTY (home intersect) — Home-green framed explainer card: "Everyone's calendars don't overlap in this window", caption "These times need every required member free at once. Try widening the range.", a small required-member avatar row each with a green/grey free-dot, primary "Try next month", secondary "Notify me". No alarm styling anywhere; this is a normal, expected outcome. Copy second person, no exclamations. Render all five frames.
```

### Embed / Inline Booking Widget Settings (web)  `[v2]` · settings
- **Archetype:** Settings form reusing EditBusinessPage block-editor + code-snippet block; web-only
- **Match these references:** A13 Edit Business Page.html (block editor + appearance controls); A14 settings-list pattern; A10.6 Business profile.html (where the inline booker lands)
- **Lives in:** web host settings -> "Embed widget"; surfaces the /book/[slug] flow onto external sites or the host's /b/[username] page
- **Context / pillar:** Business violet `--color-identity-business` (driving traffic from own site); Personal sky variant
- **Frames to produce:** inline embed (default) + popup-button variant + floating-button variant + appearance config + copied-snippet (toast) + live preview pane

```
Use the Pantopus Design System skill — include colors_and_type.css, copy recipes from preview/ and ui_kits/web/. This is a WEB host-settings screen (desktop layout, NOT iOS-framed) — render it as a centered settings page on the flat var(--app-bg) shell. Honor non-negotiables: primary sky var(--color-primary-600); pillar accent var(--color-identity-business) (violet) with a Personal sky note; system font; Lucide stroke-2 16-24px, no emoji; white cards 1px var(--app-border) 16px radius var(--shadow-sm), NO left-border accents; voice plainspoken verbs-first sentence case, no exclamations; shimmer skeletons; code in var(--font-mono).

Build the Embed Widget SETTINGS, web. Mirror A13 Edit Business Page's two-column block editor: a LEFT config column and a RIGHT live-preview pane. Header: title "Embed your booking widget" + caption "Drop your booking flow onto your own site." LEFT column: (1) a segmented control of three embed types — Inline / Popup button / Floating button — each switching the preview and the snippet. (2) Appearance card: brand-color swatch (defaults to pillar), light/dark toggle, "Hide page header" checkbox, primary-button label field, layout (month / week) chips. (3) For Popup/Floating: a button-text field + position picker (corner chips). (4) A snippet card: a read-only var(--font-mono) code block with the embed <script> + a "Copy snippet" primary button; a "Copied" toast frame shows var(--color-success) "Snippet copied". (5) A quiet "Where it shows" note: "Use this on any site, or turn it on for your Pantopus business page" with a toggle "Show inline on /b/yourname" (mirrors A10.6). RIGHT pane: a faux external-site browser chrome ("yoursite.com") showing the rendered widget — INLINE shows the embedded /book/[slug] event-type list + a mini calendar; POPUP shows a primary "Book a call" button with a small open-modal hint; FLOATING shows a corner pill button. Frames to render: inline (default), popup-button, floating-button, appearance-config (color/theme open), copied-snippet toast. Copy: "Drop your booking flow onto your own site." / "Copy snippet." / "Show inline on /b/yourname." Web-only.
```

---

## D · Invitee — confirm, manage, and edge states

### Intake / Booking Details Form  `[MVP]` · full screen
- **Archetype:** Form (A13 single-screen form shell — extends the web GuestSignupModal form step into a full intake surface)
- **Match these references:** `Form.html` (44px inputs, 8px radius, section overlines, validation vocabulary, sticky-bottom CTA); guest-signup field pattern
- **Lives in:** Tail of the public web `/book/[slug]` flow, route `/book/[slug]/details` (also reachable in-app post-slot-select)
- **Context / pillar:** Invitee (public, signed-out) — accent borrows the host event-type's pillar color (Personal sky / Home green / Business violet) for focus rings and the slot-hold chip
- **Frames to produce:** default (empty) + prefilled (logged-in, shrinks to custom questions only) + validation errors + existing-account-detected warning + submitting + slot-expired-while-filling

```
Design a full-screen public booking intake form, the step after an invitee picks a time. Mirror Form.html exactly: same top-bar pattern (left chevron back to the slot grid, centered title "Your details", no right action), 44px inputs with 8px radius (--radius-md), 1px --app-border, 16px horizontal padding, section overlines in 11px/600 uppercase 0.08em (--type-over). Top to bottom: (1) a non-editable booking summary header card (white bg, 1px --app-border, 16px radius --radius-xl, subtle --shadow-sm) showing event type + host avatar, date, time, and an auto-detected timezone chip (pill, --color-primary-100 bg, clock icon, tappable "change") with an "Edit" back-link to the picker; a thin slot-hold countdown row beneath ("We're holding this time for 4:32"). (2) Section "Your info": First/last name split fields and email, each a real labeled input with red * on required, helper text in 11px --fg3 italic. (3) Section "A few questions" — schema-driven host custom questions (text/textarea/select/multi-select/phone), each rendered as a full labeled field, never a dense grid. (4) An "Add guests" expandable row (plus icon, --color-primary-600) that reveals additional-email inputs with a remove control and a guest-limit note. Sticky-bottom full-width primary-600 CTA "Review booking", disabled gray until valid. Render frames: empty default; prefilled (name/email collapsed to a read-only "Booking as Maya Chen · maya@…" chip, only questions shown); validation errors (red border + alert-circle + 11px --color-error message under fields); existing-account-detected (info banner --color-info-bg with "You have an account — open in app to use saved details", inline link); submitting (CTA shows shimmer skeleton, not "Loading…"); slot-expired (amber --color-warning-bg banner "This held time just expired", CTA becomes "Pick another time"). Copy, plainspoken second person: "We'll only email you about this booking." "Add up to 5 guests." Use Lucide icons (clock, users, plus, alert-circle), stroke 2, 16-20px. Never emoji. Reference --color-* tokens, never hardcode hex. 300x620 iPhone frame on #eef2f7 canvas.
```

### Review & Confirm / Checkout (invitee)  `[MVP]` · section
- **Archetype:** ContentDetail summary block + primary CTA; paid path = Wizard final step + CheckoutCoordinator (PaymentIntent + Stripe PaymentSheet)
- **Match these references:** `A09.4 Invoice.html` (price breakdown, totals block, hero total, identity-tinted dots); `Form.html` summary-card rhythm; `A14.6 Payments.html` for saved-card row
- **Lives in:** `/book/[slug]/review`, the final step before confirm; absorbs payment and package-credit redemption
- **Context / pillar:** Invitee — host event-type pillar color for the active CTA and price hero accent
- **Frames to produce:** default (free) + full payment + deposit-only + package-credit-applied ($0 due) + logged-in saved-cards + confirming + slot-no-longer-available + card-error/3DS + Stripe-unavailable

```
Design the invitee Review & Confirm section — the single final summary before booking, conditionally absorbing payment. Mirror A09.4 Invoice.html's structure for the money block and detail cards; reuse its identity-tinted dots and totals table. Layout top to bottom: top bar (chevron back, title "Review & confirm", no right action). (1) A who/what/when/where summary card (white, 1px --app-border, 16px radius, --shadow-sm): event type + host (avatar + name with pillar dot), date/time line, timezone chip, location/meeting-mode row (video link / address / phone with map-pin or video Lucide icon), invitee + guests list, and a collapsible "Your answers" disclosure for custom-question responses. (2) For paid event types, a price-breakdown block exactly like the Invoice totals: Price, Deposit due now vs Balance later, Service fee, Tax, and a hero Total in --color-primary-600; below it a one-line refund-policy summary link and an "Apply package credit / promo code" row. (3) Payment region: when logged-in, a saved-card row (brand + last-4, matching A14.6); the actual card entry is the native PaymentSheet, represented as a "Payment method" button that opens it — do NOT draw a custom card form. A secure-payment trust row (lock icon + "Payments secured by Stripe"). Sticky-bottom CTA: free → "Confirm booking"; paid → "Pay $48 & book". Frames: free ready (no money block); full payment; deposit-only (Total shows "Due now $20 · Balance $40 at visit"); package-credit-applied (Total strikes to $0, green "1 session credit applied", CTA becomes "Confirm booking"); logged-in saved cards; confirming (CTA shimmer skeleton, inputs locked); slot-no-longer-available (inline --color-error-bg banner "This time was just taken" + "See other times" — links to Slot Taken sheet); card-error/3DS (amber retry banner, CTA "Try again"); Stripe-unavailable (info banner "Card payments are briefly unavailable, your time is held"). Never mark paid client-side — copy notes "We'll confirm once payment clears." Plainspoken copy: "You pay a $20 deposit now. The rest is due at your visit." Lucide icons stroke 2, never emoji; all colors via --color-* tokens. 300x620 iPhone frame on #eef2f7 canvas.
```

### Booking Confirmed / Thank-You  `[MVP]` · full screen
- **Archetype:** SuccessHeroBlock / ContentDetail success + RsvpCluster add-to-calendar; ConfettiSpray (reduce-motion aware)
- **Match these references:** `A18 Claim Submitted.html` / `Verify Email Sent.html` (success halo, headline+body, timeline, dock); `A09.4 Invoice.html` paid state (receipt capsule) for the paid variant
- **Lives in:** `/book/[slug]/confirmed`; returned-from-Stripe success; email-receipt link
- **Context / pillar:** Invitee — success green halo for the confirmed hero; host pillar color for secondary chips
- **Frames to produce:** confirmed-free + confirmed-paid (receipt) + deposit-paid (balance due) + package-credit-redeemed + pending-host-approval + with-redirect (countdown) + confirmation-email-sending + app-user (routes into native detail)

```
Design the booking-confirmed success screen. Mirror the A18 status-screen anatomy (Claim Submitted / Verify Email Sent): a centered halo with soft pulse rings, headline + body, an info/detail chip, a short timeline, and a bottom dock — but recolor the halo to success green (--color-success) with a check-circle Lucide glyph for confirmed states. ConfettiSpray on mount, suppressed under prefers-reduced-motion. Top to bottom: (1) success halo + "You're booked" headline + body "We sent the details to maya@…" (2) a booking summary card (white, 1px --app-border, 16px radius, --shadow-sm) in the invitee's timezone: event type, host, date/time, timezone chip, join link / location row. (3) Add-to-calendar cluster — reuse the RsvpCluster chip row: three pill chips Google · Apple · Outlook (calendar Lucide icon) plus a "Download .ics" link; these open the Add-to-Calendar sheet. (4) A "Manage booking" note ("Need to change it? Reschedule or cancel anytime") linking to the token manage page. Dock: primary "Add to calendar", ghost "Done". Frames: confirmed-free (no money); confirmed-paid (insert an Invoice-style receipt capsule under the summary — amount paid, mono txn id + timestamp, "Receipt emailed" line, matching A09.4 paid state); deposit-paid (capsule shows "Paid $20 deposit · $40 due at visit"); package-credit-redeemed ("1 session credit used · no charge", no receipt); pending-host-approval (halo flips to info blue hourglass, headline "Request sent", timeline Submitted · Awaiting host · Confirmed, ETA pill "Hosts usually reply within a day"); with-redirect (a countdown pill "Returning to acme.com in 5…" + "Go now"); email-sending (receipt line shows shimmer skeleton, never "Loading…"); app-user (a slim banner "Open in Pantopus to manage" routing into native booking detail). Signed-out variant adds a soft "Create an account to manage your bookings" nudge card. Plainspoken copy, no exclamation points, sentence case. Lucide stroke 2, never emoji; --color-* tokens only. 300x620 iPhone frame on #eef2f7 canvas.
```

### Manage Your Booking  `[MVP]` · full screen
- **Archetype:** ContentDetail; reuses TokenAccept routing/validation
- **Match these references:** `Token Accept.html` (token routing/validation shell, expired/invalid states); `A09.4 Invoice.html` for the booking summary card; `A18 Waiting for Approval.html` for the status badge + dock pattern
- **Lives in:** Token-authed `/book/manage/:token`; deeplink `pantopus://book/manage/:token`; in-app booking list
- **Context / pillar:** Invitee (often signed-out) — host pillar color for accents; neutral chrome
- **Frames to produce:** confirmed (actions available) + past (read-only) + already-cancelled + reschedule/cancel-window-closed + token-expired/invalid + loading (skeleton)

```
Design the token-authenticated "Manage your booking" detail — the single surface a signed-out invitee lands on from a confirmation/reminder email. Reuse TokenAccept's validation/routing shell for the token states, and mirror the A09.4 Invoice summary-card layout for the booking body. Top bar: centered title "Your booking", left chevron only if in-app (token web view has no back). Top to bottom: (1) a status badge pill at top (green "Confirmed" / gray "Past" / red "Cancelled"), matching A18 badge styling. (2) Booking summary card (white, 1px --app-border, 16px radius, --shadow-sm): event type, host (avatar + pillar dot), date/time, timezone chip, location/meeting-mode row, and a read-only guests list. (3) An action region with two clearly-labeled real buttons: "Reschedule" (calendar-clock icon) → opens the shared slot grid, and "Cancel booking" (x-circle, soft destructive --color-error border) → opens the shared Cancel & Refund sheet. (4) Add-to-calendar chip row (Google/Apple/Outlook/.ics) reusing RsvpCluster. (5) A policy notice card in --app-surface-sunken ("You can reschedule up to 24 hours before") with a host-contact fallback link. Frames: confirmed (both actions live); past (actions removed, summary dimmed, only "Add to calendar"); already-cancelled (red badge, summary struck, a "This booking was cancelled on Dec 9" note + "Book again" link); window-closed (Reschedule and/or Cancel rendered disabled gray with an inline reason "Too late to change online — contact your host", routing to the Policy-Blocked state); token-expired/invalid (full TokenAccept-style error: warning halo, "This link has expired", "Request a new link" CTA); loading (shimmer skeleton card, never "Loading…"). Plainspoken second-person copy: "Pick a new time that works for you." "Cancelling frees the slot for someone else." Lucide stroke 2, never emoji; --color-* tokens only. 300x620 iPhone frame on #eef2f7 canvas.
```

### Slot Taken / Conflict State  `[MVP]` · sheet
- **Archetype:** ErrorState + SlotCalendar re-render; bottom sheet over the booking flow
- **Match these references:** Support Trains slot rows (`Support trains.html`, `A12.11 Start a Support Train.html`, `A10.9 Support train.html`) for the suggested-slot rows; `A18` error/empty halo for the headline block
- **Lives in:** Sheet over `/book/[slug]/review` on a 409 conflict at confirm; in-app booking for app invitees
- **Context / pillar:** Invitee — host pillar color on the suggested-slot select buttons
- **Frames to produce:** conflict-with-alternatives (default) + conflict-fully-booked (waitlist offer) + stale-grid auto-refresh (re-fetching skeleton)

```
Design the most important scheduling error: a "slot just taken" recovery bottom sheet that never dead-ends. It slides up over the booking flow (rounded-top sheet, 20px top radius, drag handle, scrim behind). It must preserve all entered details so nothing is retyped. Top to bottom: (1) a compact error block — a small amber --color-warning halo with a calendar-x Lucide glyph, headline "That time was just taken", body "Someone grabbed 2:00 PM first. Here are the closest open times." (2) 3–4 suggested nearest-open-slot rows, REUSING the Support Trains slot-row pattern exactly (each a real full-width button: weekday + date on the left, time range + duration on the right, chevron, 1px --app-border, 12px radius, host pillar color on press/active). These are re-fetched live. (3) A secondary full-width ghost button "Pick another time" that returns to the full slot grid. Sticky note at the bottom: "Your details are saved." Frames: conflict-with-alternatives (default, 3–4 live slot rows); conflict-fully-booked (no rows — empty illustration, headline "This day is fully booked", a "Join the waitlist" primary CTA + "See another day" ghost); stale-grid auto-refresh (rows replaced by 3 shimmer skeleton slot rows with a tiny "Checking live availability" caption, never "Loading…"). Copy is calm and plainspoken, no blame, no exclamation points: "No problem — these are still open." Lucide icons stroke 2 (calendar-x, clock, chevron-right), never emoji. All colors via --color-* tokens; the slot rows match the Support Trains weekday+time-range grid 1:1. 300x620 iPhone frame on #eef2f7 canvas, sheet shown mid-rise over a dimmed booking screen.
```

### Payment Failed / Retry State  `[v2]` · sheet
- **Archetype:** ErrorState + Stripe payment sheet (reuse gig checkout infra)
- **Match these references:** `A18` error halo + dock; `A14.6 Payments.html` saved-card row; the Slot Taken sheet for the slot-hold countdown pattern
- **Lives in:** Sheet over `/book/[slug]/review` on a paid-booking payment failure
- **Context / pillar:** Invitee — neutral error chrome; host pillar color on the retry CTA
- **Frames to produce:** declined-retry (default) + slot-hold-expired + network-timeout (idempotent retry) + succeeded-after-retry

```
Design a payment-failure recovery bottom sheet for paid bookings that holds the slot while the invitee retries — preventing the "paid but lost my slot" nightmare. Rounded-top sheet (20px radius, drag handle, scrim). Top to bottom: (1) error block — small --color-error halo with a credit-card Lucide glyph, headline "Your payment didn't go through", body giving the clear decline reason ("Your card was declined — not enough funds" / "That card has expired"). (2) A prominent slot-hold countdown chip (--color-warning-bg, timer icon, "Holding your 2:00 PM time for 4:48") so the invitee knows the reservation is safe. (3) Primary full-width CTA "Try another card" that re-opens the native Stripe PaymentSheet (do not draw a custom card form); ghost secondary "Use a different time". Reuse the A14.6 saved-card row if the invitee has saved cards. Frames: declined-retry (default, countdown live, reason shown); slot-hold-expired (countdown flips to red "Hold released", body "Your time opened back up", CTA changes to "Pick a time again" routing to the slot grid); network-timeout (info-toned, "We're not sure that went through — we won't double-charge you", CTA "Check again" with idempotent-retry copy); succeeded-after-retry (brief success morph — green check halo, "Payment went through", auto-advances to Booking Confirmed). Copy is reassuring and plainspoken, never blames the user, no exclamation points: "Your time is still held. Try another card." "We never charge twice." Lucide stroke 2 (credit-card, timer, check-circle), never emoji; --color-* tokens only. 300x620 iPhone frame on #eef2f7 canvas, sheet over a dimmed review screen.
```

### Unavailable / Expired / Paused / Secret States  `[MVP]` · full screen / state
- **Archetype:** Reuse `publicShare.ts` status-driven "not shareable" / notFound rendering from `support-trains/[id]/page.tsx` — ONE screen, copy/icon switch on status code
- **Match these references:** Support Train public "not shareable" layout (`A10.9 Support train.html` / `Support trains.html` public state); `A18` empty/error halo
- **Lives in:** Any booking/manage/poll route returning 403/404/410/closed; expired manage tokens; invitee landing when host paused
- **Context / pillar:** Invitee — neutral chrome; pillar color only on the "Get the app" CTA
- **Frames to produce:** not-found (404) + private/secret-link-required (403) + expired (410) + host-paused (with message + until-date) + fully-booked / no-availability + booking-already-cancelled

```
Design ONE catch-all terminal-state screen for broken/paused/private/expired booking, manage, and poll links — a single component that switches only its icon, headline, and body on the HTTP status code. Reuse the Support Train public "not shareable" layout verbatim: a centered illustration/icon halo, a reason headline, a one-line body, and a Back-to-Pantopus + Get-the-app CTA pair. Layout top to bottom: (1) a centered muted icon halo (--app-surface-sunken disc) with a status-specific Lucide glyph; (2) headline (sentence case) + body in --fg3; (3) optional context card; (4) dock: ghost "Back to Pantopus" + primary "Get the app" (host pillar color). Render six frames driven by status, all sharing the exact same chrome: not-found 404 (search-x icon, "We can't find that page", "The link may be mistyped"); private/secret 403 (lock icon, "This is a private link", "Ask the host for the right link" + a "Have a code?" input affordance); expired 410 (clock icon, "This link has expired", "Request a new one" CTA); host-paused (pause-circle icon, "Bookings are paused", plus a host-set message card in --app-surface-sunken with an "until Jan 6" date pill and a "Notify me when it reopens" ghost CTA); fully-booked (calendar-x icon, "No times are open right now", "Check back soon" + "Notify me"); booking-already-cancelled (x-circle, "This booking was cancelled", "Book again" link). Keep copy plainspoken, neutral, no exclamation points, no blame; never "Loading…". Note in the spec that this is a single route with a status switch — do NOT build separate routes per state. Lucide stroke 2 (search-x, lock, clock, pause-circle, calendar-x, x-circle), never emoji; all colors via --color-* tokens. 300x620 iPhone frame on #eef2f7 canvas, six frames in a row.
```

### Add to Calendar Sheet / .ics + Google/Apple/Outlook hand-off  `[MVP]` · sheet
- **Archetype:** Action bottom sheet (picker rows) — RsvpCluster chips promoted to a full sheet; native EventKit write path
- **Match these references:** `A18` dock/sheet button rhythm; RsvpCluster add-to-calendar chips (referenced in Booking Confirmed); Gig Picker Sheets row pattern (`Gig Picker Sheets.html`) for the sheet rows
- **Lives in:** Sheet surfaced from any booking surface — invitee booking-confirmed, host booking-detail, home-event-detail, visit-detail
- **Context / pillar:** Invitee + all pillars (context-neutral chrome; accent inherits the surface that opened it)
- **Frames to produce:** default (web: 3 providers + .ics) + native (Apple/EventKit "Add to iPhone Calendar" primary) + .ics-generating skeleton + added-success morph + multi-calendar picker (which calendar to write to)

```
Design the Add-to-Calendar bottom sheet — the missing surface that actually produces the calendar event promised across confirmation screens (no .ics/VEVENT generation exists in the backend yet, so this sheet IS the contract). Rounded-top sheet, 20px radius, drag handle, scrim behind. Top: a small title "Add to your calendar" + a one-line event recap chip (event name · date · time · timezone). Then a vertical list of real labeled tap rows (reuse the Gig Picker Sheets / list-row pattern: 56px rows, leading icon disc, label + sub, trailing chevron, 1px --app-border dividers): "Apple Calendar" (on native = primary, writes via EventKit), "Google Calendar", "Outlook", and "Download .ics file". Each row has a provider-appropriate Lucide icon (calendar / calendar-plus / download) stroke 2. Below the rows, a small caption "We'll add the event with the join link and a reminder." Sticky-bottom ghost "Done". Frames: web-default (4 rows, no provider is primary, all open external hand-off links); native (top "Add to iPhone Calendar" promoted to a full-width primary-600 button that triggers EventKit, with Google/Outlook/.ics as secondary rows below); .ics-generating (the tapped row shows an inline shimmer skeleton + "Preparing your file", never "Loading…"); added-success (row morphs to a green check + "Added to Apple Calendar", sheet auto-dismisses after a beat); multi-calendar picker (a second-level sheet listing the user's writable calendars — "Personal", "Work", "Family" with color dots — to choose the target before writing). Plainspoken copy, sentence case, no exclamation points. Lucide icons only, never emoji; all colors via --color-* tokens; rows match the existing sheet row pattern 1:1. 300x620 iPhone frame on #eef2f7 canvas, sheet shown over a dimmed Booking Confirmed screen.
```

### Open-in-App / Booking Deep-Link Hand-off  `[MVP]` · interstitial / banner
- **Archetype:** Continue-in-app interstitial + web smart-banner (extends DeepLinkRouter with booking routes)
- **Match these references:** `A18 Verify Email Landing` interstitial pattern for the resolving/continue screen; the app smart-banner strip pattern from public web screens; `Token Accept.html` for link-resolution routing
- **Lives in:** Web `/book/[slug]` and `/manage` (smart-banner); native interstitial on `pantopus://book/...` deeplink or push tap
- **Context / pillar:** Invitee — host pillar color on the "Continue in app" primary; neutral resolving chrome
- **Frames to produce:** web smart-banner strip + native resolving interstitial (skeleton) + resolved continue-in-app (event-type preview) + resolve-failed (fallback to web) + stay-on-web choice

```
Design the open-in-app / deep-link hand-off so an app-having invitee who taps a /book/[slug] or /manage link (or a push) lands cleanly in the native booking flow with their identity, timezone, and saved details — instead of a degraded signed-out web flow. Two surfaces in one file. (A) Web smart-banner: a slim top strip over a dimmed public booking page — app icon, "Open in Pantopus", "Faster, with your saved details", a "Open" primary-600 pill and an "x" to dismiss; below it the web flow continues. (B) Native continue-in-app interstitial (full-screen): centered app/host avatar, a resolving state that maps the link to the right event-type/booking, then a confirm. Layout for the resolved interstitial: host avatar + pillar dot, event-type preview card (name, duration, price if any, "with Dr. Lee"), an identity line "Continuing as Maya Chen · times in PT", then a full-width primary "Continue in app" + ghost "Stay on web". Frames: web smart-banner strip; native resolving (skeleton shimmer card + "Opening your booking", never "Loading…"); resolved continue-in-app (event-type preview + identity line + both CTAs); resolve-failed (warning halo, "We couldn't open this in the app", "Continue on the web" primary, reusing Token Accept's fallback routing); stay-on-web (a quiet confirmation that the user chose web, banner collapses). Copy plainspoken, second person, sentence case, no exclamation points: "Pick up where you left off." "Your timezone and details come with you." Note in the spec that DeepLinkRouter needs new booking routes. Lucide stroke 2 (smartphone, arrow-right, calendar), never emoji; --color-* tokens only. 300x620 iPhone frame on #eef2f7 canvas.
```

### Reschedule/Cancel Confirmation Cutoff & Policy-Blocked State (invitee)  `[MVP]` · state
- **Archetype:** ErrorState / policy-notice inside ContentDetail (lives inside Manage Your Booking; distinct from the host policy-setting sheet)
- **Match these references:** `A18` paused/blocked halo + reviewer-note card pattern (the amber "review paused" card in Waiting for Approval); Manage Your Booking summary card; host-contact fallback row
- **Lives in:** State inside `/book/manage/:token` when host policy forbids the tapped action
- **Context / pillar:** Invitee — neutral chrome, amber policy tone; host pillar color on the "Message host" fallback
- **Frames to produce:** cancel-window-closed (no refund) + reschedule-window-closed + partial-refund-only (cancel allowed but reduced refund) + change-not-allowed-online (contact host) + within-policy (control enabled — the contrast/baseline)

```
Design the invitee-facing policy-blocked state — the moment inside Manage Your Booking where the host's cutoff forbids the reschedule or cancel the invitee just tapped. This is the highest support-ticket-generating gap in scheduling, so the copy must explain the rule and always offer a fallback. It is NOT a dead link (that's Unavailable States) and NOT where the host sets policy. Mirror the A18 "review paused" amber note-card pattern. Layout: keep the Manage Your Booking summary card at top for context, then a policy-block card (amber --color-warning-bg, 1px --color-warning-light, 12px radius, file-warning / clock-alert Lucide icon): a clear headline naming the rule, a plain-language reason, and what's still possible. Below it, a fallback action: full-width "Message host" ghost button (host pillar color) and, where relevant, a "Keep my booking" primary to back out. Frames: cancel-window-closed (headline "It's too late to cancel for a refund", body "Free cancellation ended 24 hours before your visit", fallback "Message host"); reschedule-window-closed (clock-alert, "Reschedule window has closed", "You can still cancel" link if cancel is allowed); partial-refund-only (headline "You'll get a 50% refund", body "Cancelling now within 24 hours refunds half — $24 of $48", primary "Cancel and refund $24" destructive-soft + "Keep my booking" ghost); change-not-allowed-online (headline "This booking can't be changed online", body "Your host handles changes directly", only "Message host" primary); within-policy baseline (a green --color-success-bg note "You can reschedule or cancel free until Dec 17" with both controls enabled — shown for contrast). Copy is honest and plainspoken, never blames, states the exact rule and dollar figures, no exclamation points: "Free changes ended 24 hours before your visit." Lucide stroke 2 (file-warning, clock-alert, message-circle), never emoji; all colors via --color-* tokens. 300x620 iPhone frame on #eef2f7 canvas.
```

### My Bookings (invitee/customer-side list)  `[v2]` · list of rows
- **Archetype:** ListOfRows (segmented Upcoming/Past) — booker's outgoing bookings, distinct from the host bookings-inbox
- **Match these references:** `List of Rows.html` (row archetype, segmented control, empty state); each row links to Manage Your Booking; A09 status-pill styling on rows
- **Lives in:** Signed-in, under You/Me — `/me/bookings` (a booker's outgoing bookings)
- **Context / pillar:** Invitee/booker — each row tinted by the host's pillar dot (you book across all three); neutral list chrome
- **Frames to produce:** populated (upcoming) + past tab + empty + loading skeleton + with-action-needed row (balance due / approval pending)

```
Design "My bookings" — a signed-in app user's list of bookings THEY made across other people's hosts, the booker-side counterpart to the host bookings-inbox (which they do NOT see here). Mirror List of Rows.html exactly: top bar with centered title "My bookings", a segmented control "Upcoming / Past", and a vertical list of tappable booking rows (white cards, 1px --app-border, 16px radius, --shadow-sm, comfortable 72px+ rows). Each row: leading host avatar with a small pillar dot (sky/green/violet for the host's identity), primary line = event type ("30-min consult"), secondary line = host name + relative date ("with Dr. Lee · Thu, Dec 18 · 2:00 PM"), a trailing status pill (green "Confirmed", blue "Pending", gray "Past", amber "Balance due"), chevron. Tapping a row opens Manage Your Booking. Group rows under thin date overlines ("This week", "Next week"). Frames: populated upcoming (4–5 rows, mixed pillars and statuses); past tab (dimmed rows, "Book again" inline link on each); empty (centered calendar Lucide illustration, "You haven't booked anything yet", body "Bookings you make show up here", primary "Find something to book"); loading (4 shimmer skeleton rows, never "Loading…"); action-needed (a row with an amber "Balance due $40" pill and a small inline "Pay" affordance, or a blue "Approve pending" — these float to the top with a thin "Needs attention" overline). Copy plainspoken, second person, sentence case, no exclamation points: "Everything you've booked, in one place." Note this is distinct from my-packages-credits (credits only) and the owner bookings-inbox. Lucide stroke 2 (calendar, chevron-right, alert-circle), never emoji; all colors via --color-* tokens; rows match List of Rows 1:1. 300x620 iPhone frame on #eef2f7 canvas, with a tab bar at 76px (this is a You/Me sub-root).
```

### Recurring / Multi-Session Booking Setup  `[v2]` · flow step
- **Archetype:** Wizard step inserted into the invitee picker flow (between slot-pick and review) — distinct from packages (a credit wallet)
- **Match these references:** Support Trains weekday+time-range grid + slot rows (`Support trains.html`, `A12.11 Start a Support Train.html`, `A10.9 Support train.html`) for the recurrence/occurrence list; `Home calendar.html` month strip for the series preview; Review & Confirm for the summary
- **Lives in:** `/book/[slug]` flow when the event type allows recurrence — inserted before Review
- **Context / pillar:** Invitee — host pillar color for selected occurrences and the active CTA
- **Frames to produce:** default (recurrence chosen) + per-occurrence conflict (one week needs a new time) + partial-series (some occurrences unavailable) + series summary (before confirm) + count/interval picker open

```
Design the recurring / multi-session booking step — one decision that lays down many linked slots (e.g. "every Tuesday for 6 weeks"), distinct from a package credit wallet. It's inserted between slot-pick and Review in the invitee flow. Reuse the Support Trains weekday+time-range grid for the base pattern and the slot-row list for per-occurrence rows; reuse the Home calendar month strip to preview the series. Top bar: chevron back, title "Set up your series". Layout top to bottom: (1) a recurrence picker card (white, 1px --app-border, 16px radius): "Repeats" select (Weekly / Every 2 weeks / Monthly), "On" weekday chips, base time chip, and a count stepper "for 6 sessions" (or "until" date). (2) A series-preview block — a horizontal month strip (Home calendar pattern) with the chosen occurrences dotted in the host pillar color, plus a scrollable list of occurrence rows (Support Trains slot-row pattern): each row = date + time + a status (green check "Open", amber "Needs a new time"). (3) A running summary chip "6 sessions · Tue 2:00 PM · Dec 18 – Jan 22 · $240 total". Sticky-bottom primary "Review 6 bookings". Frames: default (all 6 occurrences open and selected); per-occurrence conflict (one row amber "2:00 PM is taken that week" with an inline "Pick another time" that opens a mini slot row set for just that date); partial-series (2 rows unavailable, a banner "We can book 4 of 6 — the rest are full", CTA "Book the 4 that work" + "Adjust"); series-summary (a confirm-style recap card listing every occurrence with remove-x controls and the per-session + total price, mirroring Review & Confirm); count/interval picker open (the stepper expanded as a small inline control). Copy plainspoken, second person, sentence case, no exclamation points: "Book the whole series in one go." "We'll find the same time each week and flag any that's taken." Stress accessibility: every occurrence is a real labeled button (day, date, time, status). Lucide stroke 2 (repeat, calendar-check, alert-circle), never emoji; all colors via --color-* tokens; grid and rows match Support Trains 1:1. 300x620 iPhone frame on #eef2f7 canvas.
```

---

## E · Manage bookings (host & member lifecycle)

### Bookings Inbox  `[MVP]` · full screen
- **Archetype:** ListOfRows (tabbed) — A08 tabbed-list-with-status-chips, the same shell as Support Trains "My trains" and the My bids / My tasks / Offers feed.
- **Match these references:** `List of Rows.html`, `My bids.html`, `My tasks.html`, `Offers.html`, `Support trains.html` (intro band + status chips), `Notifications.html` (Today/Earlier separators, unread dot).
- **Lives in:** Scheduling hub per pillar and inside the Messages/Inbox tab. Route `pantopus://bookings` · `src/app/bookings/inbox.tsx`. Top bar (not a tab root): back chevron, centered title "Bookings", right search + filter icons.
- **Context / pillar:** Owner-polymorphic — accent follows the active scope pill (Personal sky / Home green / Business violet). "All" scope uses neutral primary-600.
- **Frames to produce:** default (Upcoming populated) + Pending-approval (badge + approve/decline quick actions) + empty (Upcoming) + empty (Past, different copy) + loading (shimmer skeleton) + error + context-scoped (Business:Acme, assigned-member glyphs) + auto-confirm variant (Pending segment hidden) + member-permission-gated (own bookings only).

```
Design the Bookings Inbox — one owner-polymorphic home base where a host or member sees every booking across Personal, Home and Business, organized by lifecycle. Mirror the A08 tabbed-list-with-status-chips archetype exactly as Support trains and My bids do: top bar with back chevron + centered "Bookings" title + search and filter icons on the right; below it a scope pill row (All / Personal / Home:Riverside / Business:Acme Studio) that horizontally scrolls, the active pill filled in that scope's identity color (--color-identity-personal sky / -home green / -business violet); then a segmented control: Upcoming / Pending approval / Past / Cancelled, with a count badge on Pending using --color-warning. Booking rows are white cards (1px --app-border, --radius-xl 16, --shadow-sm, NO left accent): invitee avatar (32px, verification disc) + name, event-type label, date·time, a status chip (confirmed=--color-success-bg, pending=--color-warning-bg, cancelled=--app-surface-sunken), a small owner-context glyph, and on Business an assigned-member chip. Each row has an overflow kebab with state-gated quick actions (Approve, Decline, Reschedule, Cancel). Floating extended FAB bottom-right, primary-600 + --shadow-primary: "Share booking link". Render frames: Upcoming populated; Pending-approval with badge + inline Approve/Decline; empty-Upcoming (calendar-clock icon in a 72px identity-tinted disc, "No bookings yet", "When neighbors book time with you, they show up here.", primary CTA "Share your booking link"); empty-Past ("Nothing in your history yet"); shimmer-skeleton loading (never "Loading…"); error; member-gated (own rows only, no approve actions). Every row and control is a real labeled button reading day, date, time, timezone and status for VoiceOver. Voice: sentence case, verbs-first, no exclamation points. Reference colors_and_type.css tokens only — never hardcode hex.
```

### Booking Detail  `[MVP]` · full screen
- **Archetype:** ContentDetail (ContentDetailShell: back + overflow, header, scroll modules, sticky CTA dock) — reuses EventDetail attendees + ManageTrain destructive-sheet pattern.
- **Match these references:** `Content Detail.html` / `A10.x`, `Transactional Detail.html` / `A09.2 Gig V1.html` (sticky dock + status pill), `A13 Manage Train.html` (destructive close sheet).
- **Lives in:** Reached from a Bookings Inbox row, push notification, Home calendar event tap, or Messages context card. Route `src/app/bookings/[id].tsx`.
- **Context / pillar:** Owner-polymorphic — accent and identity strip follow the booking's owner context (Personal / Home / Business).
- **Frames to produce:** default (confirmed/upcoming) + pending (Approve/Decline dock) + past-needs-followup + cancelled + no-show + conflict-warning banner + reassigning (Business) + viewer-is-member (reduced dock) + loading (shimmer) + error.

```
Design Booking Detail — the single authoritative screen one booking lives on, host- and member-side. Mirror the Transactional Detail / Content Detail shell: top bar with back chevron + overflow kebab, a status pill in the trailing slot (confirmed=--color-success "Confirmed", pending=--color-warning "Pending approval", cancelled=--app-text-muted, no-show=--color-error). Header block: event-type name (22px/700 sentence case), date·time + duration line, and an owner-context strip — a small identity-tinted dot + label ("Home · Riverside" green / "Business · Acme" violet / "Personal" sky). Then stacked SectionCards (white, 1px --app-border, --radius-xl, --shadow-sm, overline + icon headers): Attendee/requester (1:1 single invitee card with verification disc and message shortcut; group shows roster summary + seat-fill bar reusing the Support Trains SlotPreview); Assigned member chip on Business (tap to reassign); Location module (in-person mini-map / video link / phone); Intake answers (collapsed accordion by default); Notes + "Open in Messages" link; and a status/lifecycle timeline (dotted vertical, --color-success checks for completed steps). Sticky bottom CTA dock that clears the tab bar, --shadow-primary on the primary: pending state shows ghost "Decline" + primary "Approve"; confirmed shows ghost "Reschedule" + primary "Message", with Cancel / Mark no-show / Reassign / Add to calendar / Follow-up / View invoice behind the overflow — every action opens a SHEET, not a screen, gated by role + state. On conflict, show an amber inline banner above the dock ("This overlaps another booking"). Frames: confirmed-upcoming; pending; past-needs-followup (Follow-up prompt); cancelled (dimmed, refund line); no-show; conflict-warning; reassigning; member view (Reschedule + Message only); shimmer loading; error. Tokens only, no hardcoded hex.
```

### Approve / Decline Request Sheet  `[MVP]` · sheet
- **Archetype:** Bottom sheet (CloseTrainSheet pattern from ManageTrain) + Gigs cancel-reason chips for progressive disclosure.
- **Match these references:** `A13 Manage Train.html` (closing-confirmation bottom sheet over dimmed view), `A09.2 Gig V1.html` (reason-chip / award affordances).
- **Lives in:** Launches from Booking Detail action dock (pending), Bookings Inbox Pending quick action, or a notification action button. `BookingApproveSheet`.
- **Context / pillar:** Host-side; accent follows the booking's owner context.
- **Frames to produce:** default (requester + slot + intake preview) + decline-expanded (reason chips) + conflict-warning + submitting + error.

```
Design the Approve / Decline Request Sheet — one decision sheet a host uses to confirm or reject a pending booking. Mirror the ManageTrain closing-confirmation bottom sheet: rounded-top sheet (--radius-3xl top corners) rising over a dimmed Booking Detail, a 36px grab handle, then content. Top: a compact requester summary (avatar + verification disc + name), the requested slot as a strong line (day, date, time, timezone), and a collapsed intake-answers preview ("3 answers"). If the slot now overlaps a confirmed booking, show an amber --color-warning-bg banner with a triangle-alert icon and a "View conflict" link before the actions. Optional note-to-requester textarea (ghost input, --app-surface-sunken, placeholder "Add a note (optional)"). Two stacked buttons: primary-600 "Approve" with --shadow-primary, and a ghost-destructive "Decline" in --color-error text. Tapping Decline progressively reveals a row of reason chips reusing the CancelGigReason enum (Time doesn't work / Fully booked / Not a fit / Other), pill-shaped, single-select, selected chip filled --color-error-bg with --color-error text; below them an inline "Propose another time" link that hands off to the Reschedule sheet. Frames: default; decline-expanded (chips + propose link, confirm button now "Decline request"); conflict-warning; submitting (button shows inline spinner, not "Loading…"); error (inline --color-error message, actions re-enabled). Only renders for approval-required event types. Real labeled buttons; chips reachable and announced for VoiceOver. Sentence case, verbs-first, no exclamation points. Reference colors_and_type.css tokens only.
```

### Reschedule / Reassign Sheet  `[MVP]` · sheet
- **Archetype:** Sheet wrapping the shared availability slot picker — the same weekday + time-range grid and slot rows used in the booking flow and Support Trains slot generation.
- **Match these references:** `Support trains.html`, `A12.11 Start a Support Train.html` (dates & slots step), `A10.9 Support train.html` (slot rows), `Home calendar.html` (month strip).
- **Lives in:** Booking Detail dock → Reschedule / Reassign; Approve-Decline "Propose another time"; Bookings Inbox quick action. `BookingRescheduleSheet`.
- **Context / pillar:** Host or member; accent follows owner context. Member view hides the authority toggle.
- **Frames to produce:** loading-availability (shimmer) + slots-available + no-availability + member-picker (Business reassign) + proposed + conflict + saving + error.

```
Design the Reschedule / Reassign Sheet — a host or member moves a booking to a new time and/or member, pulling live composed availability. Tall bottom sheet (--radius-3xl top, grab handle) over a dimmed Booking Detail. Top: the current slot shown struck-through (--app-text-muted, line-through) with a down-arrow to an empty "New time" target. Then the shared availability picker reused from Support Trains: a horizontal day strip (weekday + date chips, today highlighted in the owner-context identity color) and below it real full-width slot-row buttons stacked vertically (each labeled "Tue Oct 22 · 2:00–2:30 PM · PT", 44px min height, white card, selected = identity-tinted border + filled check) — NOT a dense fixed grid, so it works at the largest dynamic-type size. A timezone chip sits above the grid ("Times in Pacific · tap to change"), tappable. Include a composed-availability explainer line under the grid where Home/Business apply: "Times come from each member's personal availability." For Business reassign, add a member-picker row of eligible-seat avatars above the grid. An authority toggle (host-only, hidden member-side): segmented "Propose to invitee (needs accept)" vs "Reschedule now". A reason/message textarea and a "Notify invitee (push + message)" switch, default on. Sticky primary CTA reflects the toggle: "Send proposal" or "Reschedule now", primary-600 + --shadow-primary. Frames: loading-availability (shimmer slot rows, never "Loading…"); slots-available; no-availability (empty state, calendar-x icon, "No open times in this range", "Widen the window or message the invitee"); member-picker active; proposed (confirmation tint); conflict (amber banner); saving (spinner); error. Tokens only, no hardcoded hex.
```

### Cancel & Refund Sheet  `[MVP]` · sheet
- **Archetype:** Bottom sheet reusing Gigs CancelGigReason chips + CloseTrainSheet shell; driven by the paymentStateMachine refund path.
- **Match these references:** `A13 Manage Train.html` (destructive close sheet), `A09.2 Gig V1.html` (cancel-reason chips), `A14.6 Payments.html` (refund/payout rows), `A09.4 Invoice.html` (money rows).
- **Lives in:** Booking Detail dock → Cancel; Bookings Inbox swipe action; Invoice detail → Refund; invitee Manage Booking → Cancel (policy-gated). `BookingCancelSheet`.
- **Context / pillar:** Shared host + member; accent follows owner context.
- **Frames to produce:** default (free-window) + paid-with-refund + partial/policy refund + non-refundable deposit (refund disabled + explainer) + credit-redeemed (restore credit) + submitting + refund-failed (Stripe error) + already-cancelled/refunded.

```
Design the Cancel & Refund Sheet — cancel a confirmed booking, capture a reason, and issue the policy-correct refund or restore a package credit. Destructive bottom sheet (ManageTrain close pattern): --radius-3xl top, grab handle, over a dimmed Booking Detail. Header: "Cancel this booking?" + a one-line summary (event type · invitee · date·time). Reason chips reusing the CancelGigReason enum (Changed plans / Emergency / Found someone else / Other), pill-shaped single-select, selected = --color-error-bg / --color-error text; selecting Other reveals a short textarea. Optional "Note to the other party" ghost input. When the booking was paid via Stripe Connect, show a Refund section as money rows matching A14.6 Payments / A09.4 Invoice style — a segmented preset (Full / Partial / Per policy) with the computed amount in tabular-nums, and a policy explainer line in --app-text-secondary ("You're within the free-cancellation window — full refund"). When a package credit was redeemed, show a "Restore 1 session credit" switch instead. A "Notify invitee" switch, default on. Sticky destructive confirm CTA: full-width, --color-error background, white text, "Cancel booking" (or "Cancel & refund $40"). Frames: default free-window; paid-with-refund (full); partial/policy refund (amount + explainer); non-refundable deposit (refund row disabled at 50% opacity with explainer "This deposit is non-refundable"); credit-redeemed (restore switch); submitting (spinner, not "Loading…"); refund-failed (--color-error-bg banner "Refund couldn't be processed — try again or contact support", retry button); already-cancelled (read-only state, dimmed). Conditional rows appear only when relevant. Reference colors_and_type.css tokens only — never hardcode hex.
```

### Mark No-Show  `[v2]` · modal
- **Archetype:** Confirmation dialog — the same `.confirmationDialog` pattern used for EventDetail delete.
- **Match these references:** `Content Detail.html` (EventDetail attendees), `A13 Manage Train.html` (confirm-sheet copy shape).
- **Lives in:** Booking Detail dock (after start time / Past tab) and Bookings Inbox Past quick action. `MarkNoShowDialog`.
- **Context / pillar:** Host-side; accent follows owner context. Only surfaces after the booking's start time.
- **Frames to produce:** default (1:1 confirmation) + group-select-attendee + submitting + error.

```
Design Mark No-Show — a quick confirmation that an invitee (or host) didn't attend, flipping the booking to a no-show terminal state. Use the compact centered confirmation-dialog pattern (same DNA as the EventDetail delete dialog), not a tall sheet: a small white card (--radius-2xl, --shadow-xl) centered over a dimmed Booking Detail, max ~280px wide. Top: a 40px circular icon disc in --color-error-bg with a user-x glyph in --color-error. Title (h3, sentence case): "Mark as no-show?" Body (--app-text-secondary, 14px): "This closes the booking. You can still message the invitee or send a rebook link afterward." For 1:1, that's it. For a group/multi-party booking, swap the body for a short who-no-showed selector — a stacked list of attendee rows with checkboxes (avatar + name), multi-select. Optional one-line note input below. Two buttons side by side: ghost "Keep open" left, and a solid --color-error "Mark no-show" right. Frames: default 1:1; group-select-attendee (checkbox roster, confirm label "Mark 2 as no-show"); submitting (right button spinner, dialog non-dismissible, never "Loading…"); error (inline --color-error line, buttons re-enabled). Only renders after start time; on confirm it feeds the post-meeting follow-up state. All controls are real labeled buttons announced for VoiceOver. Sentence case, verbs-first, no exclamation points. Reference colors_and_type.css tokens only.
```

### Post-Meeting Follow-up  `[v2]` · sheet
- **Archetype:** Sheet reusing the Support Trains SendUpdateForm (textarea + audience chips + push toggle) from ManageTrain.
- **Match these references:** `A13 Manage Train.html` (send-update composer), `A10.9 Support train.html` (recap footer).
- **Lives in:** Booking Detail (Past state), Bookings Inbox Past prompt banner, push reminder after meeting end. `BookingFollowUpSheet`.
- **Context / pillar:** Host-side; accent follows owner context.
- **Frames to produce:** default + completed-template + no-show-template + sent (toast) + error.

```
Design Post-Meeting Follow-up — after a past booking, send a thank-you/recap, request a rebook, or leave a private outcome note. Bottom sheet (--radius-3xl top, grab handle) reusing the ManageTrain SendUpdateForm wholesale. Header: event type · invitee · the past date in --app-text-secondary. Top: a row of outcome chips (Completed / No-show / Rebook needed), single-select, selected = owner-context identity tint; selecting an outcome swaps the smart-default template in the composer below. Composer: a message-to-invitee textarea (ghost, --app-surface-sunken, --radius-md) pre-filled per outcome — Completed: "Thanks for the time today — good to connect. Want to book again?"; No-show: "Sorry we missed each other today. Here's a link to grab another time." A "Send rebook link" chip-button under the composer that reuses the one-off link generator. Then a private host-only note field, visually separated with a lock icon and a "Only you can see this" caption (--app-text-muted). A "Send via push + message" toggle, default on. Sticky primary CTA "Send follow-up", primary-600 + --shadow-primary; secondary ghost "Save note only" when only the private note is filled. Frames: default (no outcome chosen, neutral composer); completed-template; no-show-template; sent (sheet dismisses to a success toast "Follow-up sent", --color-success check); error (inline --color-error retry). Mostly v2 delight — keep it calm, one screen. Real labeled controls for VoiceOver. Sentence case, verbs-first, no exclamation points. Reference colors_and_type.css tokens only.
```

### Group Event Roster & Seats  `[v2]` · full screen
- **Archetype:** ListOfRows + ManageTrain capacity/stat header — the same capacity + status machinery as Support Trains slot capacity.
- **Match these references:** `Support trains.html` (SlotPreview capacity fill), `A10.9 Support train.html`, `A13 Manage Train.html` (capacity controls), `List of Rows.html` (avatar_kebab rows).
- **Lives in:** Booking Detail (group event) → Manage roster; Bookings Inbox row for a group event. `src/app/bookings/[id]/roster.tsx`. Top bar: back chevron, "Roster", overflow.
- **Context / pillar:** Owner-polymorphic; accent follows owner context. 1:1 bookings never reach this.
- **Frames to produce:** under-capacity + full + waitlist-active + loading (shimmer) + empty (no signups) + error.

```
Design Group Event Roster & Seats — manage the attendee roster for a group/multi-seat booking: capacity vs filled, waitlist, and per-attendee actions. Top bar: back chevron, centered "Roster", overflow kebab. Capacity header reuses the Support Trains SlotPreview / ManageTrain stat header: a card showing "12 of 16 seats filled" with a fill bar (filled portion in the owner-context identity color, track --app-surface-sunken; clamps to grayscale when full so it reads as resolved) plus a 3-cell stat strip (Confirmed / Pending / Waitlisted) on a sunken-bg card. Then a List-of-Rows avatar_kebab list of attendee rows (white card, 44px avatar + verification disc, name, joined-time meta, a status chip — confirmed=--color-success-bg, pending=--color-warning-bg, waitlisted=--app-surface-sunken, no-show=--color-error-bg — and a kebab with per-row actions: Message, Mark no-show, Remove). A "Waitlist" overline section below the seated list with its own rows, each carrying a primary-tinted "Promote to seat" button (disabled when full, with a caption explaining why). Host-only controls: a "Add or invite attendee" row and an "Adjust capacity" stepper. A "Message all attendees" extended FAB, primary-600 + --shadow-primary. Frames: under-capacity (promote enabled, open seats noted); full (bar grayscale, promote disabled, "All seats filled" caption); waitlist-active (3 waiting, promote live); shimmer loading (skeleton rows, never "Loading…"); empty (users icon disc, "No signups yet", "Share the booking link to fill seats", primary CTA); error. Every row and button is real and labeled for VoiceOver. Sentence case, verbs-first, no exclamation points. Reference colors_and_type.css tokens only.
```

### Booking Search & Filter  `[v2]` · sheet
- **Archetype:** FilterSheetShell — the shared filter-sheet shell that GigFilterSheet projects over.
- **Match these references:** `List of Rows.html` (chip + section shell), `Map List Hybrid.html` / Gig filter patterns, `Notifications.html` (tab/segment vocabulary).
- **Lives in:** Bookings Inbox top-bar search + filter icons. `BookingFilterSheet`.
- **Context / pillar:** Owner-polymorphic; active scope pre-selected in the owner-context facet.
- **Frames to produce:** default + active-filters (chips + count) + no-results.

```
Design the Booking Search & Filter sheet — narrow the inbox by date range, status, owner-context, event-type, and invitee/text. Bottom sheet (--radius-3xl top, grab handle) reusing the shared FilterSheetShell. Header row: "Filter bookings" title with a "Clear all" text action on the right (--color-primary, disabled when nothing is set). A search field at the top (ghost --app-surface-sunken, --radius-md, search icon, placeholder "Search invitee or intake text"). Then stacked filter sections, each an overline label + a wrap of single/multi-select pill chips: Status (Upcoming / Pending / Past / Cancelled / No-show); Owner context (All / Personal / Home / Business — the active scope pre-selected, chips tinted with their identity colors when selected); Event type (30-min intro / Consultation / Group class / …); Date range (Today / This week / This month / Custom — Custom reveals two date inputs). Selected chips fill with the relevant tint; unselected are white with 1px --app-border. Above the CTA, an active-filter summary row of removable chips (each with an x) when any are set. Sticky primary CTA shows the live result count: "Show 12 bookings", primary-600 + --shadow-primary; disabled with "No matches" when zero. Frames: default (nothing selected, CTA "Show all"); active-filters (3 chips set, removable summary, count in CTA); no-results (inline empty note "No bookings match these filters", "Clear all" link, CTA disabled). Plain-text search can also live as an inline inbox bar — this sheet is for the facets. Real labeled chips/buttons announced for VoiceOver. Sentence case, no exclamation points. Reference colors_and_type.css tokens only.
```

### Double-Book Warning (Host-side)  `[v2]` · modal
- **Archetype:** Confirm modal (WizardCloseConfirm-style) — centered destructive-confirm dialog.
- **Match these references:** `A13 Manage Train.html` (confirm copy shape), `Content Detail.html` (linked event card), `Home calendar.html` (conflicting-event row style).
- **Lives in:** Fires when a host adds a manual event or approves a request that overlaps, or on a round-robin assignment collision. `DoubleBookWarningDialog`.
- **Context / pillar:** Host-side; accent follows owner context. Home variant names the conflicting member.
- **Frames to produce:** soft-overlap (allow override) + hard-conflict (member unavailable, block).

```
Design the Double-Book Warning — warn a host before confirming a manual or blocked event that overlaps an existing booking or another owner-context commitment. Centered confirm modal (WizardCloseConfirm DNA): white card (--radius-2xl, --shadow-xl) over a dimmed view, ~300px wide. Top: a 40px circular --color-warning-bg disc with a calendar-clock / triangle-alert glyph in --color-warning. Title (h3, sentence case): "This time overlaps". Body (--app-text-secondary): a one-line conflict summary ("You already have 'Plumber visit' from 2:00–3:00 PM on this calendar"). Below it, a compact linked card for the conflicting booking — a row reusing the Home calendar event-row style (type tile + title + time) that is tappable as "View the conflict". For the Home pillar, add a line naming whose personal availability conflicts ("Conflicts with Mara's availability"). Two outcomes drive two frames. Soft-overlap (override allowed): buttons ghost "Cancel" + primary-600 "Book anyway" — a permitted human override. Hard-conflict (member genuinely unavailable): the primary is replaced by a disabled "Can't book — member unavailable" state with a lock glyph, leaving only "Cancel" and a "Pick another member" link; the warning disc shifts to --color-error-bg / --color-error. Frames: soft-overlap; hard-conflict. The scheduling engine prevents most double-books — this is the explicit human-override safety net. All controls real and labeled for VoiceOver. Sentence case, verbs-first, no exclamation points. Reference colors_and_type.css tokens only — never hardcode hex.
```

### Send a Nudge / Manual Follow-up  `[v2]` · sheet
- **Archetype:** Reuses the Support Trains SendUpdateForm wholesale (textarea + char counter + audience chips + push toggle).
- **Match these references:** `A13 Manage Train.html` (send-update composer + audience picker), `A22.2 Compose Broadcast.html` (audience/channel chips).
- **Lives in:** Event/booking detail "Message attendees", Home calendar event detail, Workflows list quick action. `SendNudgeSheet`.
- **Context / pillar:** Owner-polymorphic; accent follows owner context.
- **Frames to produce:** composing + over-limit + sent (toast) + no-recipients (disabled).

```
Design Send a Nudge / Manual Follow-up — a one-off manual message to an event's attendees (reminder, update, thank-you) with no saved workflow. Bottom sheet (--radius-3xl top, grab handle) that reuses the ManageTrain SendUpdateForm almost verbatim. Header: "Message attendees" + the event title + date in --app-text-secondary. Body: a message textarea (ghost --app-surface-sunken, --radius-md, ~5 lines) with a live character counter bottom-right (turns --color-error past the limit). A "Use a template" chip above the field links to the Template Library and drops boilerplate in. Audience chips (single-select): All attendees / Confirmed only / No-shows — selected chip filled in the owner-context identity tint; each shows its recipient count ("All attendees · 12"). A channel toggle row: Push / Email switches (Push default on). Sticky primary CTA "Send", primary-600 + --shadow-primary; the recipient count echoes in the button ("Send to 12"). Frames: composing (template applied, audience "All attendees", push on, CTA enabled); over-limit (counter red, inline "Shorten your message", CTA disabled); sent (sheet dismisses to a success toast "Update sent to 12 attendees", --color-success check); no-recipients (audience "No-shows · 0" selected, empty caption "No one to message in this group", CTA disabled). Nearly free — this is the existing "Send an update" form pointed at a calendar/booking event. Real labeled controls announced for VoiceOver. Sentence case, verbs-first, no exclamation points. Reference colors_and_type.css tokens only.
```

### Manual / On-Behalf Booking (host books an invitee in)  `[v2]` · Flow
- **Archetype:** A12 Wizard (multi-step) wrapping the shared availability slot picker — same 5-step rail + slot grid as Start a Support Train and the booking flow.
- **Match these references:** `A12.11 Start a Support Train.html` (step rail + recipient/invite branch), `Support trains.html` / `A10.9 Support train.html` (slot rows), `A13 Add Guest.html` / `Invite to Home.html` (invitee details form), `A18 Waiting for Approval.html` (created confirmation).
- **Lives in:** Bookings Inbox extended-FAB "New one-off slot" / "Book someone in", or a contact card. Route `src/app/bookings/new.tsx`. Top bar: back chevron + step rail.
- **Context / pillar:** Host or member; accent follows the active scope pill.
- **Frames to produce:** step 1 event-type pick + step 2 slot pick (composed availability) + step 3 invitee details + step 4 review (skip-approval / skip-notify toggles) + invitee-not-on-Pantopus branch + created confirmation + loading-availability + error.

```
Design the Manual / On-Behalf Booking flow — a host or member creates a booking for someone else (phone-in, walk-in, front-desk). Mirror the A12 wizard chrome from Start a Support Train: top bar with back chevron and a slim step rail (1 Event type · 2 Time · 3 Details · 4 Review · ✓ Booked), the current pill tinted in the active scope's identity color. Step 1 — event-type picker: a tile/list of the host's event types (name, duration, location mode icon), single-select. Step 2 — time picker reusing the shared Support Trains availability grid: a horizontal day strip + stacked full-width slot-row buttons ("Tue Oct 22 · 2:00–2:30 PM · PT", 44px min, selected = identity border + check) — never a dense fixed grid; a tappable timezone chip above; and, where Home/Business compose members, the explainer "Times come from each member's personal availability" plus an optional member picker. Step 3 — invitee details: a form (A13 Add Guest style) with a neighbor search at top; when no verified neighbor matches, pivot to an invite-by-phone (recommended) / invite-by-email branch exactly like the Support Train "not on Pantopus" frame. Step 4 — review: summary card (event · slot · invitee) plus two host switches: "Skip approval (confirm now)" and "Skip notifications". Sticky primary CTA per step: "Continue" → final "Create booking", primary-600 + --shadow-primary. Frames: step 1; step 2 (slots-available); step 3 (verified invitee); step 3 invitee-not-on-Pantopus branch; step 4 review with toggles; created confirmation reusing the A18 status screen (success disc, "Booking created", "We've added it and notified Dana", primary "View booking" + ghost "Book another"); loading-availability shimmer (never "Loading…"); error. Real labeled controls at the largest dynamic-type size for VoiceOver. Sentence case, verbs-first, no exclamation points. Reference colors_and_type.css tokens only — never hardcode hex.
```

### Waitlist Join & Waitlist Management  `[v2]` · sheet / state (invitee join + host promote)
- **Archetype:** Bottom sheet (invitee join, CloseTrainSheet shell) + ListOfRows with ManageTrain capacity header (host promote) — reuses the Support Trains slot-capacity machinery.
- **Match these references:** `A21 public-profile` + Support train public layout (invitee-facing join), `Support trains.html` / `A10.9 Support train.html` (capacity + waitlist rows), `A18 Waiting for Approval.html` (joined-confirmation), `List of Rows.html` (host promote list).
- **Lives in:** Invitee side off the public booking page when an event type or slot is full; host side off Booking Detail / Roster when capacity opens. `WaitlistJoinSheet` + `WaitlistManageSection`.
- **Context / pillar:** Invitee (neutral/host-branded) for join; owner-polymorphic for the host view.
- **Frames to produce:** invitee join (default) + invitee joined-confirmation + invitee already-on-waitlist + host waitlist list (capacity open, promote enabled) + host capacity-full (promote disabled) + loading + error.

```
Design Waitlist Join & Waitlist Management — the cross-event capacity-recovery surface: an invitee joins a waitlist when an event type or slot is full, and the host sees and promotes waitlisted people when space opens. Two coordinated surfaces. Invitee join (bottom sheet, CloseTrainSheet shell, host-branded like the A21 / Support train public layout): a "Fully booked" line with the requested window, body "Join the waitlist and we'll text you the moment a spot opens", an optional preferred-time note, an auto-detected timezone chip ("Times in Pacific · tap to change"), a name/contact field for guests, and a primary CTA "Join waitlist", primary-600 + --shadow-primary. On submit, swap to a joined-confirmation reusing the A18 status screen (success disc, "You're on the waitlist", "You're #3 — we'll notify you if a spot frees up", ghost "Leave waitlist"). Host waitlist management (a section inside Booking Detail / Roster, ListOfRows + ManageTrain capacity header): a capacity strip ("12 of 12 seats filled · 3 waiting", identity-tinted fill bar) over a list of waitlisted rows (avatar + name + joined-time + position #), each with a primary-tinted "Promote to seat" button — enabled only when a seat is open, otherwise disabled with a caption "Open a seat to promote". Frames: invitee join default; invitee joined-confirmation; invitee already-on-waitlist (read-only, position + leave action); host list with capacity open (promote live, promoting one shows a confirm toast + push); host capacity-full (promote disabled); shimmer loading (never "Loading…"); error. All controls real and labeled for VoiceOver, working at the largest dynamic-type size. Sentence case, verbs-first, no exclamation points. Reference colors_and_type.css tokens only.
```

---

## F · Family / home scheduling

### Home Calendar / Agenda (existing — extended)  `[MVP]` · full screen
- **Archetype:** `HomeCalendarView` (`ListOfRowsView` + `MonthStripHeader`)
- **Match these references:** `A08 Home calendar.html` (EXTEND — month strip + agenda rows), `A10.9 Support train.html` (slot-row stack pattern), `A08 Members.html` (avatar stack)
- **Lives in:** Home tab -> Hub -> home dashboard -> Calendar (iOS `HomeCalendarView`; Android `ui/screens/homes/calendar`)
- **Context / pillar:** Home green (`--color-identity-home`)
- **Frames to produce:** default (populated) + empty + loading skeleton (shimmer) + error + offline banner + filtered-empty

```
Extend the existing Pantopus Home calendar — do NOT build a new calendar. Mirror A08 Home calendar.html's month strip + day-grouped agenda exactly; add three extensions only. Render in a 300x620 iPhone frame on #eef2f7 canvas, link ../../colors_and_type.css, lucide stroke-2 icons, no emoji. Use Home pillar green (--color-identity-home, -home-bg) for active states/accents.

Top to bottom: status bar (9:41, dynamic island, signal/battery); top bar — title "Calendar" (sentence case) left, right action = a "users" Lucide icon opening "Who's free". MonthStripHeader: weekday initials row + horizontal selectable date pills (selected = home-green filled circle, today = green ring). Filter chip row below strip: pills "All / Mine / Mom / Dad / Ava" (selected pill = home-green-bg fill, home-green text). Agenda body = ListOfRowsView: day section headers ("Today · Mon Jun 16") over event rows. Each row = white card, 1px --app-border, 16px radius, --shadow-sm, NO left accent: time column left, title + location middle, a category chip (use --cat-* token dot + label), and a right-aligned overlapping assignee avatar stack (2-3 28px circles, "+2"). FAB bottom-right 52x52 primary-600 with --shadow-primary opening a 4-item create menu sheet: "Add event / Find a time / Book a resource / Schedule a visit", each a real labeled button row with leading Lucide icon. 76px tab bar (Home active).

Frames: default (populated, 3 day-sections); empty ("Nothing scheduled — add your first event"); loading (shimmer skeleton rows, never "Loading…"); error (retry); offline (amber info banner under top bar, cached rows dimmed); filtered-empty ("No events for Ava this week · Clear filter"). Copy: "Pediatrician — Ava", "Trash out", "Family dinner". Voice: plainspoken, sentence case, no exclamation points.
```

### Home Event Detail (existing — extended for RSVP)  `[MVP]` · full screen
- **Archetype:** `EventDetailView` (`ContentDetailShell`)
- **Match these references:** `A08 Home calendar.html` event-detail (EXTEND — `EventHeader` + `DetailGrid` + `AttendeesSection`), `A08 Polls.html` (response pill pattern)
- **Lives in:** Tap an agenda row / deep-link / RSVP notification (iOS `EventDetailView`)
- **Context / pillar:** Home green (`--color-identity-home`)
- **Frames to produce:** loaded + loading + error + deleting + offline + RSVP-pending + RSVP-recorded

```
Extend the existing EventDetailView — keep EventHeader, DetailGrid, AttendeesSection, NotesSection; add per-person RSVP state and an inline "Your RSVP" control. No separate RSVP screen. 300x620 iPhone frame on #eef2f7, ../../colors_and_type.css, lucide stroke-2, no emoji. Home pillar green for accents/active pills.

Top to bottom: status bar; top bar — chevron back left, centered "Event", right action "Edit". EventHeader: big title (h2), date/time line, category chip (--cat-* dot). DetailGrid: white card, 1px --app-border, 16px radius, --shadow-sm — rows Repeats / Reminder / Location / Type, each label (--fg3 overline-ish) over value. AttendeesSection card: section overline "Attendees", AttendeeRow per person = avatar + name + right RSVP pill — Going (--color-success / -light bg), Maybe (--color-warning / -light), Can't (--color-error / -light), No reply (--app-surface-sunken / --fg3). "Your RSVP" inline control card: overline "Your RSVP" + three real segmented buttons "Going / Maybe / Can't" (selected = home-green fill, white text; others = outline). Notes card. Footer: full-width "Edit" secondary + a "Delete" text button (opens confirm dialog).

Frames: loaded (5 attendees, mixed RSVPs, yours unselected); loading (shimmer skeleton of header+grid); error (retry); deleting (confirm dialog scrim — "Delete this event? This can't be undone · Delete / Keep"); offline (amber banner, RSVP buttons disabled); RSVP-pending (your control highlighted, helper "Tap to let everyone know"); RSVP-recorded (your pill now "Going", subtle confirmation row "You're going · Change"). Copy: "Family dinner", "6:30 PM · Kitchen". Sentence case, no exclamation points, no em dashes.
```

### Home Add / Edit Event (existing — extended)  `[MVP]` · sheet
- **Archetype:** `AddEventFormView` (`FormShell`)
- **Match these references:** `A08 Home calendar.html` add-event form (EXTEND — `CategoryGroup` / `ScheduleGroup` / `RecurrenceGroup` / `AttendeesGroup` / `ReminderGroup`), `A12.11 Start a Support Train.html` (form section rhythm)
- **Lives in:** Calendar FAB -> Add event / Edit from Event Detail / tap empty day slot (iOS `AddEventFormView`)
- **Context / pillar:** Home green (`--color-identity-home`)
- **Frames to produce:** create + edit + invalid + saving + dirty-discard confirm + offline

```
Extend the existing AddEventFormView — keep its grouped FormShell sections; add ONE "Request RSVP from attendees" toggle and upgrade Reminder to multi lead-time. The AttendeesGroup multi-select already IS per-member assignment — keep it. 300x620 iPhone frame on #eef2f7, ../../colors_and_type.css, lucide stroke-2, no emoji. Home pillar green for selected chips/toggles.

Sheet (inner 32px radius top): grabber + top bar — "Cancel" left, centered "New event", "Save" right (primary text, disabled until valid). Sections as white cards, 1px --app-border, 16px radius, --shadow-sm: (1) Title text field. (2) CategoryGroup — wrapping CategoryChip row, selected = home-green-bg + green text + --cat-* dot. (3) ScheduleGroup — All-day toggle, Starts row, Ends row (date+time steppers). (4) RecurrenceGroup — segmented "Does not repeat / Daily / Weekly / Monthly" (RRULE). (5) AttendeesGroup — "Assign to" multi-select AttendeeRows (avatar + name + check), selected count shown. (6) Reminder — multi lead-time chips ("At time / 10 min / 1 hour / 1 day"). (7) "Request RSVP from attendees" toggle row with helper "Members get a Going / Maybe / Can't prompt". (8) Notes textarea.

Frames: create (empty defaults, Save disabled); edit (prefilled "Family dinner", Save enabled, title now "Edit event"); invalid (title empty + end-before-start, --color-error inline messages, fields error-bordered); saving (Save -> inline spinner, sheet dimmed, never "Loading…"); dirty-discard confirm (scrim dialog "Discard changes? · Discard / Keep editing"); offline (amber banner "You're offline — saves when you reconnect"). Sentence case labels, verbs-first buttons, no exclamation points.
```

### Find a Time — Setup  `[MVP]` · sheet
- **Archetype:** `FormShell` (like `AddEventFormView`); date-window + duration reuse `A12.11 Start a Support Train.html` "What & when"
- **Match these references:** `A12.11 Start a Support Train.html` (date-window/duration pattern), `A08 Members.html` (member multi-select), `A08 Home calendar.html` (form rhythm)
- **Lives in:** Calendar FAB -> Find a time / Home calendar scheduling affordance
- **Context / pillar:** Home green (`--color-identity-home`) — composes Personal sky availability
- **Frames to produce:** default + invalid (no members / bad window) + computing availability + no-overlap warning + references-personal explainer inline

```
The CORE engine screen — make "family composes personal availability" visible. Single FormShell sheet; one mode toggle reveals the round-robin rule picker. Composes, never copies, member personal availability. 300x620 iPhone frame on #eef2f7, ../../colors_and_type.css, lucide stroke-2, no emoji. Home pillar green for selected/active.

Sheet: grabber + top bar "Cancel" / "Find a time" / "Next" (primary, disabled until valid). Pinned explainer banner = --color-info-bg fill, info "info" Lucide icon, 12px radius (NOT a left-accent card): "Times come from each member's personal availability. Pantopus finds the overlap — it never changes anyone's calendar." Cards below: (1) Title field + category chip. (2) "Who's needed" — member rows with a Required/Optional segmented control each (avatars from Members.html); required = home-green check. (3) Mode toggle — two big segmented buttons "Collective (everyone free)" / "Round-robin (one covers)"; helper text changes per mode. (4) Round-robin rule picker — disclosed ONLY in round-robin: segmented "Fair rotation / By role". (5) Duration stepper ("30 min / 1 hr / custom"). (6) Date window range (reuse Start-a-Support-Train "What & when" date-range row). 

Frames: default (collective, 3 members); invalid (no required member + end-before-start, --color-error inline); computing availability (Next pressed -> shimmer + "Checking everyone's availability", never "Loading…"); no-overlap warning (--color-warning-bg banner "No time works for all 3 — try making Dad optional or widening the window"); references-personal explainer expanded inline (banner -> tappable "How this works" disclosure). Round-robin variant shows rule picker visible. Copy: "Plan a family call", "Sun-Sat". Sentence case, no exclamation points.
```

### Find a Time — Suggested Slots  `[MVP]` · full screen
- **Archetype:** `ListOfRowsView` + Support Trains `SlotRow`
- **Match these references:** `A10.9 Support train.html` (slot rows + commitment density), `A08 Support trains.html` (slot list), `A08 Members.html` (who's-free avatars)
- **Lives in:** Continue from Find a Time — Setup
- **Context / pillar:** Home green (`--color-identity-home`) — reads composed Personal availability
- **Frames to produce:** loading (composing) + results + no-overlap empty + single best-match + sent-as-proposal success

```
Show computed candidate slots from composed availability; book inline or send as a proposal. Reuse the Support Train SlotRow exactly (A10.9). 300x620 iPhone frame on #eef2f7, ../../colors_and_type.css, lucide stroke-2, no emoji. Home pillar green for the chosen slot + primary actions.

Top bar: chevron back, centered "Suggested times", right "Edit" (back to setup). Subhead line: "3 people · 30 min · this week" + a tappable timezone chip ("PT · America/Los_Angeles", clock Lucide icon) the booker can change — always visible. Explainer micro-line under it: "From everyone's personal availability." Ranked SlotRow list (white cards, 1px --app-border, 16px radius, --shadow-sm, NO left accent): each row = day+date+time (real button, full label), a "best match" badge on rank 1 (home-green-bg), and a per-slot member availability mini-bar — small avatar dots, green = free, sunken/grey = busy ("All 3 free" / "2 of 3"). Round-robin variant: each slot shows an assignee badge ("Dad covers"). Tapping a row expands an inline confirm ("Book Sun 2:00 PM · 30 min · Book it" primary home-green). Sticky footer: secondary "Send proposal to members" (poll path).

Frames: loading/composing (shimmer SlotRows + "Finding times that work for everyone"); results (5 ranked slots, mixed availability); no-overlap empty (calendar-x Lucide icon, "No time works for all 3" + relax-constraints CTA "Make someone optional" / "Widen the window"); single best-match (one big highlighted slot card + "Book it"); sent-as-proposal success (A18-style status — green check, "Proposal sent to 3 people · We'll notify you as they respond"). Sentence case, verbs-first, no exclamation points.
```

### Find a Time — Member Poll Response  `[v2]` · sheet
- **Archetype:** Sheet reusing Support Trains `EditSignupForm` + Poll vote pattern (`PollDetailView`)
- **Match these references:** `A08 Polls.html` (vote toggle rows — BUILD ON THIS module), `A10.9 Support train.html` (slot rows), `A08 Home calendar.html` (conflict surfacing)
- **Lives in:** Proposal push notification / Notifications inbox / Calendar pending-proposal banner
- **Context / pillar:** Home green (`--color-identity-home`) for the responding member
- **Frames to produce:** unanswered + answered + expired/closed + conflicts-detected

```
A member marks which proposed slots work. Strongly build on the EXISTING Polls module (A08 Polls.html) with time-slot options rather than bespoke code. 300x620 iPhone frame on #eef2f7, ../../colors_and_type.css, lucide stroke-2, no emoji. Home pillar green for chosen states.

Sheet: grabber + top bar "Close" / "Respond" / (no right action). Organizer + context header card (Polls.html header): organizer avatar + "Mom is finding a time for Family call · 30 min". Proposed slots as Poll-style toggle rows (white card, 1px --app-border, 16px radius): each = day+date+time label + a 3-way segmented control "Works / If needed / Can't" (Works = home-green fill, If needed = --color-warning, Can't = --color-error). Auto-flag personal conflicts: rows where the member is already busy show a small --color-error-bg "Conflicts with: Dentist" chip and pre-select "Can't" (helper: "From your personal calendar"). Sticky footer: "Submit response" primary home-green (disabled until at least one answered).

Frames: unanswered (3 slots, none chosen, Submit disabled); answered (choices made, Submit enabled, one "Works"); expired/closed (rows read-only + muted, banner "This proposal closed · Mom booked Sun 2:00 PM", footer hidden); conflicts-detected (one slot auto-flagged Can't with conflict chip + explainer). Copy: "Sun Jun 22 · 2:00 PM", "From your personal calendar". Sentence case, no exclamation points, no em dashes.
```

### Who's Free — Household Availability Overview  `[v2]` · full screen
- **Archetype:** New heat-grid visualization inside `ContentDetailShell`; member rows reuse member-avatar components
- **Match these references:** `A08 Members.html` (member rows + avatars), `A10.9 Support train.html` (slot legend + density visual language), `A08 Home calendar.html` (day/week framing)
- **Lives in:** Calendar top-bar "Who's free" / Find a Time setup -> "see overview"
- **Context / pillar:** Home green (`--color-identity-home`) — composed read-only view
- **Frames to produce:** loading (composing) + loaded + empty (no shared availability) + member-opted-out (unknown) + offline-cached

```
The one place a bespoke visualization earns its keep: a glanceable heat grid of who's free when, composed from members' personal availability + home events. Read-only. 300x620 iPhone frame on #eef2f7, ../../colors_and_type.css, lucide stroke-2, no emoji. Home pillar green = free.

Top bar: chevron back, centered "Who's free", right "Add event". Day/Week segmented toggle under the title. Micro explainer line: "Composed from each member's personal availability." Heat grid card (white, 1px --app-border, 16px radius, --shadow-sm): left column = member rows (28px avatar + first name, reuse Members.html), top = time columns (8a-8p, or weekday columns in Week). Cells: free = --color-identity-home-bg, busy = --app-surface-sunken, tentative = --color-warning-light, off-hours = subtle hatch/--app-border-subtle, unknown (opted-out) = diagonal grey with "?" . Legend row beneath with all four swatches labeled. Member filter chips above grid. Tapping a free block opens a small popover -> "Find a time here" / "Add event" (prefilled). Every cell is a labeled, tappable button (e.g. "Dad, Tue 2-3 PM, free") — works at largest dynamic type, not a dense fixed grid.

Frames: loading/composing (shimmer grid + "Building this week's availability"); loaded (4 members, Day view, mixed cells); empty (no shared availability — "No overlapping free time this week · Try next week"); member-opted-out (one row all "?" + helper "Ava hasn't shared free/busy"); offline-cached (amber banner "Showing last synced · 2h ago"). Sentence case, no exclamation points.
```

### My Household Availability Settings  `[MVP]` · sheet
- **Archetype:** `FormShell` with toggle rows + deep-link row
- **Match these references:** `A14.6 Payments.html` + the A14 settings-list pattern (toggle/disclosure rows), `A08 Members.html` (member context header)
- **Lives in:** Find a Time setup -> "your availability" / Home settings -> My availability / Who's Free -> tap own row
- **Context / pillar:** Personal sky (`--color-identity-personal`) source-of-truth deep-link inside Home green context
- **Frames to produce:** default + personal-availability-not-set-up (CTA) + saving + opted-out confirm

```
CRITICAL boundary screen: this governs EXPOSURE only — it never edits the source availability. Match the A14 settings-list pattern (toggle rows + disclosure rows). 300x620 iPhone frame on #eef2f7, ../../colors_and_type.css, lucide stroke-2, no emoji. Home pillar green for this household's accents; the source deep-link row carries a Personal-sky (--color-identity-personal) leading icon to signal it lives in Personal.

Sheet/screen: top bar chevron back, centered "My availability". Context header card: home avatar + "Maple Street · how you appear here". Sections as A14 settings cards (white, 1px --app-border, 16px radius, --shadow-sm, rows separated by hairlines): (1) Source deep-link row — sky "calendar" icon + "Edit my full availability in Personal" + chevron + sublabel "Your source of truth — changes apply everywhere". (2) Toggle "Share my free/busy with this household" (helper "Members see when you're free, never event details"). (3) Toggle "Include me in round-robin rotation". (4) "Household quiet hours" disclosure row -> blackout windows (e.g. "Weeknights after 9 PM"). (5) Toggle "Auto-decline conflicting invites". Footer note in --fg3: "This only controls what this household sees. It doesn't change your personal calendar."

Frames: default (toggles on, source row present); personal-availability-not-set-up (banner --color-info-bg "Set up your availability in Personal first" + primary "Set it up" deep-link, household toggles disabled); saving (inline spinner on changed row, never "Loading…"); opted-out confirm (turning off share -> dialog "Hide your free/busy from Maple Street? They won't be able to include you in Find a time · Hide / Keep sharing"). Sentence case, no exclamation points, no em dashes.
```

### Bookable Home Resources — List  `[v2]` · full screen
- **Archetype:** `ListOfRowsView` (same recipe as Bills/Maintenance/Pets)
- **Match these references:** `A08 Home calendar.html` (ListOfRows agenda recipe), `A10.9 Support train.html` (status pill rows), `A14.6 Payments.html` (row + badge styling)
- **Lives in:** Calendar FAB -> Book a resource / HomeDashboard "Resources" quick-action tile
- **Context / pillar:** Home green (`--color-identity-home`)
- **Frames to produce:** empty (template suggestions) + loaded + loading + error + offline

```
List the household's bookable resources with at-a-glance status. Reuse the exact ListOfRows recipe (same as Bills/Maintenance/Pets). owner_type=home. 300x620 iPhone frame on #eef2f7, ../../colors_and_type.css, lucide stroke-2, no emoji. Home pillar green for accents/FAB.

Top bar: chevron back, centered "Resources", right "Add". List body = ListOfRowsView rows (white card, 1px --app-border, 16px radius, --shadow-sm, NO left accent): each = leading rounded-square icon tile (resource Lucide icon — bed/car/zap/wrench), name (e.g. "Guest room"), a type/category badge (--app-surface-sunken pill), and a right status line — free = --color-success "Free now", booked = --fg3 "Booked until 4 PM" with a small dot. Tapping a row -> resource detail. FAB bottom-right 52x52 primary-600 + --shadow-primary -> Resource editor.

Frames: empty (template suggestions — friendly illustration-free card "Add what your household shares" + tappable template chips/rows "Guest room / Driveway / EV charger / Tools / Other", each pre-fills the editor); loaded (5 resources, mixed free/booked); loading (shimmer skeleton rows); error (retry); offline (amber banner, cached rows dimmed). Copy: "Guest room", "EV charger · Booked until 4 PM", "Driveway · Free now". Sentence case, verbs-first, no exclamation points.
```

### Resource Editor (create/edit)  `[v2]` · sheet
- **Archetype:** `FormShell` (like `AddEventFormView`)
- **Match these references:** `A08 Home calendar.html` add-event form (grouped FormShell), `A12.11 Start a Support Train.html` (rules/window sections), `A13 Add Guest.html` (who-can-access pattern)
- **Lives in:** Resources list -> Add / Resource detail -> Edit / empty-state template tap
- **Context / pillar:** Home green (`--color-identity-home`)
- **Frames to produce:** create + edit + invalid + saving + delete confirm

```
Define a bookable resource with smart defaults from its type (EV charger -> 4h max, no approval). Rules collapsed by default. Mirror AddEventForm's grouped FormShell. 300x620 iPhone frame on #eef2f7, ../../colors_and_type.css, lucide stroke-2, no emoji. Home pillar green for selected chips/toggles.

Sheet: grabber + "Cancel" / "New resource" / "Save" (disabled until valid). Cards (white, 1px --app-border, 16px radius, --shadow-sm): (1) Name field + type picker chips "Room / Vehicle / Tool / Charger / Other" (selected = home-green-bg). (2) Photo add row (optional, dashed add tile). (3) "Who can book" segmented "All members / Specific members / Guests with link"; when Specific -> AttendeeRow multi-select (avatars). (4) "Booking rules" — COLLAPSED disclosure by default; expanded shows max-duration stepper, buffer stepper, and a "Requires approval" toggle. (5) Available hours window (weekday + time-range, reuse Start-a-Support-Train pattern). Footer (edit mode only): "Delete resource" text button.

Frames: create (type "Charger" picked -> rules show smart defaults "4 hr max · No approval" as helper text); edit (prefilled "EV charger", title "Edit resource", Save enabled, Delete shown); invalid (no name + max-duration 0, --color-error inline); saving (inline spinner, never "Loading…"); delete confirm (scrim dialog "Delete EV charger? Existing bookings stay on the calendar · Delete / Keep"). Copy: "EV charger", "4 hr max", "Requires approval". Sentence case, no exclamation points.
```

### Resource Detail / Booking Calendar  `[v2]` · full screen
- **Archetype:** `ContentDetailShell` header + `ListOfRowsView` agenda body (mirrors HomeCalendar + SupportTrainDetail)
- **Match these references:** `A10.9 Support train.html` (header card + slot/agenda body + sticky CTA), `A08 Home calendar.html` (agenda rows), `A14.6 Payments.html` (rules summary chips)
- **Lives in:** Resources list row tap
- **Context / pillar:** Home green (`--color-identity-home`)
- **Frames to produce:** loaded + loading + fully-booked + approval-pending items + error

```
View one resource's schedule + existing bookings and start a booking. Mirror SupportTrainDetail (A10.9): header card + agenda body + sticky CTA. Resource bookings are HomeCalendarEvents — they also appear on the main calendar. 300x620 iPhone frame on #eef2f7, ../../colors_and_type.css, lucide stroke-2, no emoji. Home pillar green.

Top bar: chevron back, centered "EV charger", right "Edit" (admin only). Header card (white, 1px --app-border, 16px radius, --shadow-sm): resource icon tile + name + type badge + a rules-summary chip row ("4 hr max · No approval · All members"). Optional admin badge: "Pending approval (2)" pill in --color-warning-bg linking to an approval sheet (NOT a separate screen). Body = ListOfRowsView agenda of existing bookings, SlotRow-style: day section headers + booking rows (time range, "For: Dad", status dot). Sticky footer: "Book this" primary home-green full-width.

Frames: loaded (header + 4 upcoming bookings, free gaps visible); loading (shimmer header + rows); fully-booked (booked rows + footer note "Fully booked through Fri · Next opening Sat 9 AM", "Book this" still opens picker at next free slot); approval-pending items (warning "Pending approval (2)" badge + an inline approval queue section with Approve/Decline buttons per request — opens as a sheet/badged section, not a new screen); error (retry). Copy: "EV charger", "For: Dad · 2:00-4:00 PM", "Pending approval (2)". Sentence case, verbs-first, no exclamation points.
```

### Book a Resource (flow)  `[v2]` · sheet
- **Archetype:** `FormShell` + `SlotRow` availability; approval reuses Support Trains reservation pattern
- **Match these references:** `A10.9 Support train.html` (slot pick + reservation), `A08 Home calendar.html` (form rhythm), `A18 Waiting for Approval.html` (sent-for-approval status)
- **Lives in:** Resource Detail -> Book this
- **Context / pillar:** Home green (`--color-identity-home`)
- **Frames to produce:** default + conflict (slot taken) + violates-rule + submitting + confirmed success + approval-requested success

```
Pick a time for a resource within its rules, say who it's for, submit (auto-confirm or request approval). Members in-app and guests on web hit the same engine. owner_type=home, resource-scoped. Reuse SlotRow + the Support Train reservation pattern; sent-for-approval reuses A18 Waiting for Approval. 300x620 iPhone frame on #eef2f7, ../../colors_and_type.css, lucide stroke-2, no emoji. Home pillar green.

Sheet: grabber + "Cancel" / "Book EV charger" / "Submit" (disabled until valid). Rules reminder chip row at top (--app-surface-sunken: "4 hr max · No approval"). Cards: (1) Date row + a time-range picker constrained to the resource's rules and available hours (reuse SlotRow grid — invalid/taken slots disabled and visibly greyed). (2) Live conflict line under the picker (green check "This slot is free" or --color-error "Taken — Dad has it 2-4 PM"). (3) "For whom" member/guest field (AttendeeRow picker). (4) Notes field. Sticky "Submit" -> confirmed OR sent-for-approval depending on the rule.

Frames: default (valid 2 hr selection, "This slot is free", Submit enabled); conflict (overlapping pick -> --color-error "Taken — pick another time", Submit disabled); violates-rule (--color-warning "That's longer than the 4 hr max" / "Too soon — needs 1 day notice"); submitting (spinner, never "Loading…"); confirmed success (A18-style green check status "Booked · EV charger, Sat 9-11 AM · Added to the home calendar"); approval-requested success (A18 Waiting-for-Approval clock status "Request sent to an admin · We'll notify you when it's approved"). Sentence case, no exclamation points.
```

### Schedule a Visit (vendor/guest) — Setup  `[v2]` · sheet
- **Archetype:** `FormShell` + `A12.11 Start a Support Train.html` "What & when" slot-pattern + weekday grid
- **Match these references:** `A12.11 Start a Support Train.html` (weekday + time-range slot pattern), `A13 Add Guest.html` / `Invite to Home.html` (external party + link), `A08 Access codes.html` (access note link)
- **Lives in:** Calendar FAB -> Schedule a visit / Package/Maintenance flow -> "schedule vendor"
- **Context / pillar:** Home green (`--color-identity-home`); composes Personal sky availability for who-must-be-home
- **Frames to produce:** default + invalid + no-host-available warning + generating slots + link-created success

```
Create a vendor/guest visit window the household offers outside parties, composing availability for who must be home, with an optional shareable link. Shares the "offer slots from composed availability" engine with Find-a-Time; differs in external audience + link generation. Reuse Start-a-Support-Train "What & when" weekday grid + Add Guest link UI. 300x620 iPhone frame on #eef2f7, ../../colors_and_type.css, lucide stroke-2, no emoji. Home pillar green.

Sheet: grabber + "Cancel" / "Schedule a visit" / "Next". Explainer banner (--color-info-bg, info icon, NOT left-accent): "Slots come from when your chosen hosts are personally free." Cards: (1) Visit type chips "Vendor / Guest / Delivery / Service". (2) "Who must be home" member multi-select (AttendeeRows; composes their personal availability). (3) Offered date window + duration steppers. (4) Preset slot pattern — weekday grid + time-range (reuse A12.11 "What & when": tappable weekday columns, "Mornings only" quick presets). (5) Location/access note field with a "Link access code" row (Access codes link). (6) "Generate a shareable booking link" toggle.

Frames: default (Vendor, 1 host, weekday grid set); invalid (no host + empty window, --color-error inline); no-host-available warning (--color-warning-bg "Nobody you picked is free those days — widen the window or add a host"); generating slots (shimmer + "Building the slots you'll offer", never "Loading…"); link-created success (A18-style green check "Visit window ready · Share the link so they can pick a time" + a copy-link row). Copy: "Plumber visit", "Mornings, Mon-Fri", "Front door code on arrival". Sentence case, no exclamation points.
```

### Visit Detail  `[v2]` · full screen
- **Archetype:** `ContentDetailShell` (like EventDetail/SupportTrainDetail) + token-invite share UI + Support Trains Manage + `SlotRow`
- **Match these references:** `A10.9 Support train.html` (detail + Manage + slot rows), `A13 Add Guest.html` / `Invite to Home.html` (token/link share + copy/QR + revoke), `A08 Access codes.html` (entry note), `A18` status screens (status timeline)
- **Lives in:** Calendar visit row / Schedule-a-visit success / Visit reserved notification
- **Context / pillar:** Home green (`--color-identity-home`); invitee-facing slots reserved/open
- **Frames to produce:** offered (awaiting) + reserved + confirmed + completed + cancelled + no-show + active link + expired link + revoked

```
One screen for a scheduled/pending visit; the share/manage link folds in as a section (merge Visit Detail + Visit Share). Mirror EventDetail/SupportTrainDetail header + a Manage/Share section reusing Add Guest token-invite UI + SlotRow. A confirmed visit writes a HomeCalendarEvent. 300x620 iPhone frame on #eef2f7, ../../colors_and_type.css, lucide stroke-2, no emoji. Home pillar green.

Top bar: chevron back, centered "Visit", right "Edit". Header card: visitor name + type badge ("Plumber · Vendor") + confirmed time (or "Awaiting a time"). Status timeline card (A18 step language): Offered -> Reserved -> Confirmed -> Done, current step in home-green. Host members card (assigned avatars). Access/entry note card with Access codes link ("Front door · code 4827"). Share/Manage section card: shareable link row + Copy + QR button, a "Slots: 3 reserved · 5 open" SlotRow mini-summary, and Revoke / Extend actions + "Preview public page". Footer actions: "Reschedule" / "Cancel" + "Message the visitor".

Frames: offered/awaiting (timeline at step 1, share link active, "Awaiting a time"); reserved (visitor picked a slot, "Confirm" prompt); confirmed (green, time set, calendar-event note "On the home calendar"); completed (muted "Done · Jun 12"); cancelled (--color-error muted state); no-show (--color-warning "Marked no-show"); active link (Manage section link live + open slots); expired link (--fg3 "Link expired" + Extend CTA); revoked (--color-error "Link revoked" + Re-issue CTA). Copy: "Plumber visit", "Front door · code 4827", "3 reserved · 5 open". Sentence case, no exclamation points, no em dashes.
```

### Permission-Gated Scheduler View (member, read-only)  `[MVP]` · section (render-mode)
- **Archetype:** Same `ListOfRowsView`/`ContentDetailShell` shells with permission-filtered rows
- **Match these references:** `A08 Home calendar.html` (the calendar/agenda being gated), `A10.9 Support train.html` (own-commitment "Your slot" actionable pattern), `A18 Waiting for Approval.html` (access-requested-pending)
- **Lives in:** Any Home/Business scheduler opened by a non-admin member (cross-cutting render-mode, NOT a new screen)
- **Context / pillar:** Home green (`--color-identity-home`)
- **Frames to produce:** read-only + own-assignments-actionable + access-requested-pending

```
A render-mode, not a new screen: show how every Home/Business scheduling surface looks for a member lacking calendar.edit. Same ListOfRows/ContentDetail shells, permission-filtered. Build it as the Home Calendar/Agenda in read-only mode so the gating reads clearly. 300x620 iPhone frame on #eef2f7, ../../colors_and_type.css, lucide stroke-2, no emoji. Home pillar green; the user's own assignments use the Support Train "Your slot" sky-outline actionable pattern.

Layout = the Home Calendar/Agenda (month strip + agenda rows) but: FAB and per-row Edit affordances are removed; a slim --color-info-bg hint bar reads "You can view the schedule. Ask an admin to make changes." The user's OWN assignments stay actionable: their event rows show a "Your slot" pill + inline Accept / Decline buttons (these they CAN action). A "My assignments" section pins the member's own actionable items at top. Top-bar right action = "Ask to manage scheduling" (request-access affordance).

Frames: read-only (agenda visible, no FAB, no row Edit, info hint bar, all rows view-only); own-assignments-actionable ("My assignments" section with 2 rows showing Accept/Decline; rest of calendar read-only); access-requested-pending (A18 Waiting-for-Approval style — top action now a muted "Request sent" pill + banner "We asked an admin to give you scheduling access"). Copy: "You can view the schedule. Ask an admin to make changes.", "Your slot · Accept / Decline", "Request sent". Sentence case, verbs-first, no exclamation points.
```

---

## G · Business booking, payments, packages & invoicing

### Round-Robin Assignment Sheet  `[v2]` · sheet
- **Archetype:** Bottom sheet reusing the businessSeats roster rows + role-palette chips (same row vocab as A08 Members / Team tab).
- **Match these references:** A10.7 Business (owner view).html (editable-section roster rows + inline manage affordances), A12.11 Start a Support Train.html (the 6-tile selectable picker pattern for the rule toggle).
- **Lives in:** Service Editor → assignment-mode "Anyone" / "Specific members" → opens as a sheet. Web /app/business/[id]/services/[svc]/assignment.
- **Context / pillar:** Business violet — accents/active states use `--color-identity-business` (#7C3AED) on `--color-identity-business-bg`.
- **Frames to produce:** default (loaded, 4 seats, weights set) + loading seats (shimmer skeleton rows) + none-selected warning + single-member (rotation disabled, informational).

```
Design a Business-pillar bottom sheet (300x620 iPhone frame, #eef2f7 canvas) where an owner picks which team seats can take round-robin bookings and sets fairness. Pillar accent is violet --color-identity-business on --color-identity-business-bg; never recolor to sky. Match the businessSeats roster-row vocabulary from A10.7 (avatar/initials disc, name, role sub-line) and the selectable-tile rule picker from A12.11. Top to bottom: a grabber handle; sheet title "Assign bookings" (h3, sentence case) + one-line subhead "New bookings rotate across the members you pick."; a rule selector of three full-width radio-cards (Balanced / Priority order / Strict round-robin), selected card gets a 1px violet border + violet-bg tint + check; then an overline "Bookable members"; a list of seat rows, each a real labelled button — leading checkbox (violet when on), avatar disc, name (fg1) + "Uses personal availability" caption (fg3), trailing a weight stepper (− value + , `--radius-pill` chips) when rule=Balanced, or a drag handle (grip-vertical, 20px) when rule=Priority order; a live blurb card (--color-identity-business-bg, 12px radius) reading "New bookings rotate across 4 members, weighted by your settings."; sticky footer with a full-width primary-600 Done button. Cards: white bg, 1px --app-border, 16px radius, --shadow-sm; no left-border accents. Lucide icons stroke 2, 16-20px; no emoji. States: loading = 4 shimmer skeleton rows (no "Loading…" text); none-selected = amber --color-warning-bg inline note "Pick at least one member to take bookings." and a disabled Done; single-member = stepper/drag hidden, an info card "Rotation needs two or more members. Bookings go to Dana for now." Every control works at the largest dynamic-type size and reads its full label (name, role, weight) to VoiceOver.
```

### Collective Event Setup  `[v2]` · sheet
- **Archetype:** Sheet off the Service Editor; reuses the member multi-select + intersection engine and the composed-availability explainer.
- **Match these references:** A10.7 Business (owner view).html (roster rows + inline manage), A12.11 Start a Support Train.html (stepper + selectable tiles), A10.8 Membership.html (benefit/SLA inline-note styling for the intersect explainer).
- **Lives in:** Service Editor → assignment-mode "Collective" → sheet. Web /app/business/[id]/services/[svc]/collective.
- **Context / pillar:** Business violet — `--color-identity-business`.
- **Frames to produce:** off (default single-staff, collapsed) + on (collective, members chosen) + no-overlap warning + saving.

```
Design a Business-pillar bottom sheet (300x620 frame, #eef2f7 canvas) for configuring a multi-staff "collective" service where several members must all be free for a slot. Violet pillar accent throughout (--color-identity-business / -bg); never sky. Top to bottom: grabber; title "Collective booking" (h3) + subhead "Every required member must be free at the same time."; a master toggle row "Require multiple staff" (off by default → the rest is collapsed/disabled-looking); when on: a required-staff count stepper (− 2 + ) in a white card; a segmented selector of two tiles (Specific members / Any N of a group) mirroring A12.11's tile picker; a roster multi-select reusing A10.7 seat rows (checkbox + avatar + name + "Uses personal availability" caption); a capacity-per-slot stepper row ("Seats per appointment"); and an intersect explainer card in --color-identity-business-bg styled like A10.8's inline SLA note — body "Times come from where every required member is free. Fewer common openings means fewer slots." Cards white, 1px --app-border, 16px radius, --shadow-sm, no color left-borders. Sticky footer: full-width primary-600 "Save" button. Lucide icons stroke 2, 18-20px; no emoji; reference CSS variables, never hex. States: off = master toggle off, body dimmed with a one-line hint "Turn on if a booking needs more than one person."; on = populated as above; no-overlap = amber --color-warning-bg card "Tara and Sam have no shared openings this week. Widen their hours or drop a member." with Save still enabled; saving = footer button shows an inline spinner glyph and "Saving" (never "Loading…"). All steppers and rows are real buttons with full spoken labels and pass at max dynamic-type.
```

### Team Booking Availability  `[MVP]` · section
- **Archetype:** ListOfRows over the existing businessSeats roster, rendered as a section inside the Team tab.
- **Match these references:** A10.7 Business (owner view).html (editable roster section + inline Manage/Edit affordances), A14.6 Payments.html (grouped chevron-row card + inline-empty / gated patterns).
- **Lives in:** Scheduling Hub (Business) → Availability; also Team tab → member → Booking hours. Web /app/business/[id]/availability.
- **Context / pillar:** Business violet — `--color-identity-business`.
- **Frames to produce:** default (loaded roster, mixed bookable) + loading (shimmer) + member-not-bookable + gaps-warning (coverage hint) + permission-gated (team.manage).

```
Design a Business-pillar section (300x620 frame, #eef2f7 canvas) listing which team members are bookable and the weekly hours that feed round-robin. This is a section inside the Team tab, not a standalone screen — render the top bar (chevron-left back, centered title "Booking availability", no trailing action). Violet pillar accent (--color-identity-business / -bg). Top to bottom: a short explainer card in --color-identity-business-bg — "Bookings use each member's personal availability. Edit a member's hours to change when they can be booked." with an info icon; an overline "Team"; a grouped white card of roster rows (vocab from A10.7 + A14.6): each row = avatar disc, name (fg1) + hours summary caption (fg3, e.g. "Mon–Fri · 9:00–5:00"), a trailing "Uses personal availability" pill (violet-bg) or "Business hours" pill for unbound seats, and a bookable toggle; tapping the row body opens "Edit hours" via a chevron. Below, a coverage hint card with a calendar-x icon: "No one is available Sundays." Cards white, 1px --app-border, 16px radius, --shadow-sm, no left-border accents. Lucide stroke 2, 18-20px; no emoji; CSS vars only. States: loading = shimmer skeleton rows; member-not-bookable = that row dims, toggle off, sub reads "Not taking bookings"; gaps-warning = the coverage hint elevates to amber --color-warning-bg "Thursdays have no coverage — add hours for at least one member."; permission-gated = roster shown read-only (toggles hidden), a quiet footer note "Only admins can change booking hours (team.manage)." Every row and toggle is a real button voicing member, hours, bookable state, and timezone; layout holds at max dynamic-type.
```

### Member Working-Hours Editor  `[v2]` · sheet
- **Archetype:** Sheet reusing the Support Trains weekday-grid + date-range slot UI; read-only deferral when bound to a real user's personal availability.
- **Match these references:** Support trains.html / A10.9 Support train.html / A12.11 Start a Support Train.html (weekday + time-range grid and slot rows — reuse exactly), A14.6 Payments.html (settings rows for overrides/timezone).
- **Lives in:** Team Booking Availability → "Edit hours"; also Member detail. Web /app/business/[id]/availability/[seat].
- **Context / pillar:** Business violet — `--color-identity-business`.
- **Frames to produce:** editing (default, weekday grid) + date-override + blocked-out (time off) + inherits-personal (read-only) + saving + loading (shimmer).

```
Design a Business-pillar bottom sheet (300x620 frame, #eef2f7 canvas) to edit one member's bookable weekly hours plus date overrides, reusing the Support Trains weekday+time-range grid 1:1. Violet pillar accent (--color-identity-business / -bg). Top to bottom: grabber; title "Marisol's booking hours" (h3) + a timezone chip subhead "America/Los_Angeles" the owner can tap; the Support Trains weekly grid — seven real day buttons (Mon–Sun) each as a labelled row with one or more time-range chips ("9:00 AM – 5:00 PM") and an add-range "+" button; a "Copy Monday to weekdays" shortcut link (primary-600 text); an overline "Date overrides"; rows for "Add a date override" and "Block out time" (calendar-plus / ban icons, chevrons), each opening the same range UI scoped to a date; when the seat is bound, a violet-bg banner "These hours come from Marisol's personal availability" with a "View personal" link. Cards white, 1px --app-border, 16px radius, --shadow-sm; range chips are pill --radius-pill, violet-bg when active; no left-border accents. Sticky footer: primary-600 "Save hours". Lucide stroke 2, 18-20px; no emoji; CSS vars only. States: editing = full grid editable; date-override = a dated card pinned above the weekly grid ("Fri Jun 20 · 12:00–3:00 only"); blocked-out = a --color-error-bg dated card "Jul 1–5 · Time off" with no slots; inherits-personal = whole grid read-only/dimmed, ranges shown as static text, footer hidden, only the "View personal" link is actionable; saving = footer shows inline spinner + "Saving" (never "Loading…"); loading = shimmer day rows. Each day, each range, and the timezone chip are real buttons voicing day, date, time range, and timezone; works at max dynamic-type.
```

### Business Scheduling Settings  `[MVP]` · section
- **Archetype:** Settings section in the existing SettingsTab (settings-archetype grouped chevron-row cards).
- **Match these references:** A14.6 Payments.html (grouped chevron-row cards, inline empty, gated em-dash rows, primary action as final row), A14.3 Settings.html / A14.1 Home settings.html (settings-list section + overline grouping).
- **Lives in:** Scheduling Hub (Business) → Settings; also Business Settings tab → "Booking" section. Web /app/business/[id]/settings/booking.
- **Context / pillar:** Business violet — `--color-identity-business`.
- **Frames to produce:** default (saved) + loading (shimmer) + auto-confirm-on (hides Requests segment) + payments-required (Stripe not connected) + permission-gated (admin+).

```
Design a Business-pillar "Booking" settings section (300x620 frame, #eef2f7 canvas) inside the existing Settings tab — match A14.6 Payments grouped chevron-row cards exactly. Top bar: chevron-left back, centered title "Booking", no trailing action. Violet pillar accent (--color-identity-business). Top to bottom, grouped white cards under overlines: CONFIRMATION — a segmented control "Auto-confirm / Approve each request" row, plus an "Approval window" chevron row (sub "24h to respond") shown only when Approve; SCHEDULING — "Minimum notice" (sub "4 hours"), "Booking horizon" (sub "60 days out"), "Buffers" (sub "10 min before · 10 after"), "Time zone" (sub "America/Los_Angeles") — all chevron rows; POLICY — "Cancellation & no-show policy" chevron (sub "Flexible · 24h"); NOTIFICATIONS — toggle rows "Notify the owner" and "Notify the assigned member"; PAYMENTS — a Stripe Connect status row reusing A14.6's vocab (green "Connected" chip + payout bank when ready). Cards white, 1px --app-border, 16px radius, --shadow-sm; row = leading icon disc, label (fg1), sub (fg3), trailing chevron or toggle; no left-border accents. Voice: sentence case, verbs-first, plainspoken; e.g. "Auto-confirm sends the booking straight to your calendar.", "Defaults flow into each service — change them per service anytime." Lucide stroke 2, 18-20px; no emoji; CSS vars only. States: saved = default; loading = shimmer rows; auto-confirm-on = the "Approval window" row is removed and a one-line note replaces it; payments-required = the Payments row shows a primary-600 "Connect" chip and a --color-warning-bg inline note "Connect payments to charge for services."; permission-gated = all controls read-only with footer "Only admins can change booking settings." Every row is a real labelled button/toggle; holds at max dynamic-type with full VoiceOver labels.
```

### Payments Setup / Stripe Connect & Tax  `[MVP]` · section
- **Archetype:** Settings section + the existing persona Connect Express onboarding (account-link handoff); reuses A14.6 Stripe-state row vocab.
- **Match these references:** A14.6 Payments.html (Stripe-state card: Connected chip / Connect chip / em-dash gated rows; balance hero on populated only), A18 Waiting for Approval.html / Verification Submitted.html (returned-from-Stripe + needs-verification status framing).
- **Lives in:** Scheduling settings → Payments; inline CTA from a service Pricing section when not connected. Web /app/business/[id]/settings/payments.
- **Context / pillar:** Business violet — `--color-identity-business`.
- **Frames to produce:** not connected + onboarding incomplete (resume link) + ready (charges+payouts enabled) + restricted/needs-verification + returned-from-Stripe success.

```
Design a Business-pillar Payments setup section (300x620 frame, #eef2f7 canvas) where an owner connects Stripe to accept booking payments and sees payout readiness — reuse A14.6's Stripe-state row vocabulary. Top bar: chevron-left, title "Payments", no trailing. Violet pillar accent (--color-identity-business). Top to bottom: a status hero card stating connection plainly with a Stripe brand badge — readiness chips for charges_enabled / payouts_enabled / details_submitted rendered as three small check/dot pills; an overline "Account"; grouped rows — "Default currency" (sub "USD"), "Statement descriptor" (sub "MARLOW CO" with a tiny on-receipt preview), "Payouts" (deep-links to the Wallet/Express dashboard); an overline "Tax"; rows "Collect tax" toggle + "Tax rate / Stripe Tax" chevron. Primary action sits as the final blue row inside the Account card per A14.6 convention. Cards white, 1px --app-border, 16px radius, --shadow-sm; no left-border accents. Voice: "Connect Stripe to take payments and get paid out.", "Verification keeps your payouts flowing." Lucide stroke 2, 18-20px; no emoji; CSS vars only. States: not connected = readiness pills greyed/em-dashed, currency+tax rows gated with em-dashes, primary-600 "Connect Stripe" row; onboarding incomplete = amber --color-warning-bg "Finish setup on Stripe to start charging." + primary "Resume verification" (account link); ready = green "Connected" chip, all three readiness pills lit green, payouts route shown; restricted/needs-verification = --color-error-bg "Stripe needs more info to keep payouts on." + "Finish verification" link, charges may be on but payouts pill amber; returned-from-Stripe success = a brief success banner (check disc, --color-success-bg) "You're set up to take payments." matching A18 status framing. All rows are real labelled buttons; readiness pills voice their on/off state; max dynamic-type holds.
```

### Payouts & Earnings (Wallet — existing, extended)  `[MVP]` · full screen
- **Archetype:** EXISTING WalletView (A10.10) — add booking-earnings activity rows + a "Booking earnings" source filter only; do NOT invent a new screen.
- **Match these references:** A10.10 Wallet.html (dark balance hero, pending/this-month glass split, grouped-by-day tx rows with category-tinted icons, payout-method tile, tax-docs row, sticky Withdraw, on-hold/re-verify state), A10.11 Earn.html (source-filter framing).
- **Lives in:** Me → Wallet; also Invoice detail → "View payouts" and Payments setup → payouts link. Web /app/wallet.
- **Context / pillar:** Business violet accents on the booking-source filter/category; Wallet chrome otherwise neutral (dark hero stays as-is).
- **Frames to produce:** populated (with booking earnings rows + filter) + on-hold/re-verify + payouts-not-enabled (Withdraw gated) + empty.

```
Extend the EXISTING A10.10 Wallet screen (300x620 frame, #eef2f7 canvas) — do not redesign it; only add booking earnings. Keep the dark-sky balance hero (the app's one dark surface) with available amount big, the glass strip splitting Pending from This month, and decorative concentric arcs. Below: a source-filter chip row (All / Gigs / Booking earnings / Packages) — the "Booking earnings" chip uses violet --color-identity-business when active; then the grouped-by-day transaction list reusing Wallet's row vocab (category-tinted leading icon disc, payer/service label, trailing cleared/pending/fee status chip) — add new booking rows with a calendar-check icon and a violet-tinted disc, e.g. "Haircut · Dana R. · +$48.00 · Pending", "5-session package · Priya N. · +$220.00 · Cleared". Keep the payout-method debit-card tile and the tax-docs (1099) row that lights up in filing season. Sticky bottom bar: full-width primary-600 "Withdraw" with the amount trailing the label. Cards white, 1px --app-border, 16px radius, --shadow-sm; no left-border accents; CSS vars only; Lucide stroke 2, 18-20px; no emoji. Voice: "Booking earnings land here next to your gigs.", "Funds are safe while we re-verify your bank." States: populated = filter set to Booking earnings, mixed cleared/pending rows, Withdraw live; on-hold/re-verify = amber --color-warning-bg banner "Your bank needs re-verifying — earnings are safe.", Withdraw swaps to a locked variant with a one-line footnote (never a dialog); payouts-not-enabled = Withdraw disabled with sub "Finish Stripe setup to withdraw" linking to Payments; empty = dashed empty card "Your booking earnings will show up here." with the hero reading $0.00. All rows and the filter are real labelled buttons voicing source, payer, amount, and status; holds at max dynamic-type.
```

### Packages List (owner)  `[v2]` · full screen
- **Archetype:** ListOfRows (reuse Wallet activity-row styling); inline empty + Stripe-gate per A14.6.
- **Match these references:** A10.10 Wallet.html (grouped row styling), A14.6 Payments.html (inline empty card + Stripe "Connect"/em-dash gate), A10.8 Membership.html (tier/credit "paper card" feel for package rows).
- **Lives in:** Scheduling Hub (Personal/Business) → Packages. Web /app/business/[id]/packages.
- **Context / pillar:** Business violet (or Personal sky when under the Personal pillar) — accents follow the current pillar; this group's frames are Business violet.
- **Frames to produce:** active packages (default) + empty + empty + payouts-not-connected (Stripe gate) + archived filter + loading (shimmer).

```
Design an owner Packages list (300x620 frame, #eef2f7 canvas) where a business sells N-session bundles. Top bar: chevron-left back, centered title "Packages", trailing "+" create action; a FAB is not needed since the create lives in the top bar and an inline CTA. Business violet pillar accent (--color-identity-business / -bg). Top to bottom: a segmented filter "Active / Archived"; a grouped list of package rows (vocab from A10.10 + A10.8 card feel): each row = a leading violet-tinted square icon (layers/package), name (fg1, e.g. "5-session cleaning"), a sub line "5 sessions · $220 · $44 each" (fg3), a trailing status pill ("Active" success-tinted / "Archived" neutral) and "· 12 sold" count; row opens an actions menu (Edit / Duplicate / Archive). Cards white, 1px --app-border, 16px radius, --shadow-sm; no left-border accents; CSS vars only; Lucide stroke 2, 18-20px; no emoji. Voice: "Sell a bundle of sessions at a better rate.", "Buyers keep their price if you change it later." States: active = 3–4 package rows; empty = centered inline empty (48px sunken disc, layers icon) "Sell a package of sessions" + body "Bundle sessions so regulars can prepay and rebook fast." + primary-600 "Create a package"; empty + payouts-not-connected = same empty but the CTA is replaced by a --color-warning-bg gate "Set up payouts to sell packages" → "Connect payments" (per A14.6); archived = greyed rows with "Archived" pills and a "Restore" affordance; loading = shimmer rows. Each row and the filter are real labelled buttons voicing name, sessions, price, status, and sold count; layout holds at max dynamic-type.
```

### Create / Edit Package (owner)  `[v2]` · full screen
- **Archetype:** Form (single screen with inline math, not a wizard); reuses the settings-row + stepper vocabulary.
- **Match these references:** A14.6 Payments.html (grouped form rows, currency field), A12.11 Start a Support Train.html (selectable event-type tiles + steppers), A10.8 Membership.html (price-change "keep terms" framing).
- **Lives in:** Packages list → Create; row → Edit. Web /app/business/[id]/packages/[id]/edit.
- **Context / pillar:** Business violet — `--color-identity-business`.
- **Frames to produce:** create (default) + edit (price change → new Stripe Price warning) + validation error + has-active-buyers (limits destructive edits).

```
Design an owner Create/Edit Package form (300x620 frame, #eef2f7 canvas) — one scrolling Form, not a wizard, with live per-session math. Top bar: chevron-left back, centered title "New package" (or "Edit package"), trailing "Save". Business violet pillar accent (--color-identity-business / -bg). Top to bottom, grouped white cards under overlines: DETAILS — "Name" text field ("5-session cleaning") + "Description" multiline; REDEEMS AGAINST — a multi-select of eligible event-type tiles reusing A12.11's tile picker (each tile = service name + duration, violet border + check when on); SESSIONS — a count stepper (− 5 +) row; PRICE — a currency amount field + currency chip (USD) with a live caption beneath in violet "$44.00 per session" that recomputes; EXPIRY — a segmented control "90 days / 1 year / Never"; an "Active" toggle row. Cards white, 1px --app-border, 16px radius, --shadow-sm; no left-border accents; CSS vars only; Lucide stroke 2, 18-20px; no emoji. Voice: "Set a price and we'll do the per-session math.", "Existing buyers keep the price they paid." Sticky footer: primary-600 "Save package". States: create = blank/defaults; edit = fields filled, and on a changed price a --color-info-bg note "Changing the price creates a new Stripe price. Current buyers keep their terms." (mirrors A10.8); validation error = the Price field border turns --color-error with helper "Enter a price above $0" and the Save disabled; has-active-buyers = the Sessions stepper and event-type tiles lock with an inline note "12 people own credits — you can't change sessions or eligibility while credits are active." Every field, tile, stepper, and toggle is a real labelled control with full spoken labels; the per-session math is announced; holds at max dynamic-type.
```

### Buy Package (invitee/customer)  `[v2]` · sheet
- **Archetype:** Checkout sheet + CheckoutCoordinator (PaymentIntent keyed on packageId) — reuses the exact single-booking checkout machinery.
- **Match these references:** A09.4 Invoice.html (line-items + total + Pay CTA vocabulary), A10.8 Membership.html (tier "paper card" + policy footnote), A18 status screens (SCA/declined framing).
- **Lives in:** Public booking page "Buy a package" CTA; owner profile / business page; upsell on booking success. Web /app/business/[id]/packages/[id]/buy.
- **Context / pillar:** Invitee-facing — neutral/owner-branded; accent follows the owner's pillar (Business violet here). Plainspoken booker copy.
- **Frames to produce:** logged-in (default) + guest + declined/SCA + already-owns-credits upsell.

```
Design an invitee Buy Package checkout sheet (300x620 frame, #eef2f7 canvas) — reuse the single-booking checkout machinery; only the order reference differs. Owner pillar accent is Business violet (--color-identity-business / -bg). Top to bottom: grabber; an owner mini-card (avatar, business name, verified tick) so the buyer knows who they're paying; a package summary card matching A09.4's line-items + total block — "5-session cleaning", a line-items list (5 sessions × $44.00), a "Per session" value line, a bold Total "$220.00" in fg1; an "Eligible for" row listing the services the credits redeem against; an expiry note ("Credits expire 1 year after purchase"); a payment-method row (Apple Pay / card brand badge, A14.6 vocab); a terms/policy footnote in fg3 reusing the cancellation copy verbatim. Cards white, 1px --app-border, 16px radius, --shadow-sm; no left-border accents; CSS vars only; Lucide stroke 2, 18-20px; no emoji. Sticky footer: full-width primary-600 "Pay $220.00" (amount in the label, opens Stripe PaymentSheet). Voice: "Save by buying 5 sessions up front.", "Use your credits any time before they expire." States: logged-in = default; guest = an email field card above payment ("We'll send your receipt and credits here") plus a sign-in link; declined/SCA = --color-error-bg banner "That payment didn't go through. Try another card." with the Pay button re-enabled (A18 framing, no scolding); already-owns-credits upsell = an --color-info-bg card "You already have 2 credits left" with a "Use a credit instead" secondary that deep-links to booking. All rows and the Pay button are real labelled controls voicing package, total, expiry, and eligibility; holds at max dynamic-type.
```

### My Packages / Remaining Credits (customer)  `[v2]` · full screen
- **Archetype:** ListOfRows / ContentDetail (the buyer-side counterpart to the owner Packages list).
- **Match these references:** A10.8 Membership.html (credit/tier "paper card" + benefits + policy footnote), A10.10 Wallet.html (grouped activity rows for redemption history), A09.4 Invoice.html (receipt/total feel).
- **Lives in:** Me → Personal pillar → My bookings/Packages; also Booking success → "View your credits". Web /app/me/packages.
- **Context / pillar:** Personal sky for the buyer's own pillar chrome (--color-identity-personal); each card carries the owner's accent where shown.
- **Frames to produce:** active credits (default) + empty + expired/used (greyed) + expiring-soon banner.

```
Design a customer "My packages" screen (300x620 frame, #eef2f7 canvas) showing bought packages, credits left, and redeem history. Buyer pillar chrome is Personal sky (--color-identity-personal). Top bar: chevron-left back, centered title "My packages", no trailing. Top to bottom: a list of package cards matching A10.8's paper-card feel — each card = owner mini-row (avatar, business name), package name (fg1, "5-session cleaning"), a prominent credits-remaining display "3 of 5 left" with a thin progress meter, an expiry caption ("Expires Mar 12, 2027"), and a primary-600 "Book with a credit" button that deep-links into that owner's booking flow with the credit pre-selected; under each, a collapsible "Redemption history" reusing A10.10 grouped rows (date · service · "1 credit"). A "Buy again" ghost link sits on spent cards. Cards white, 1px --app-border, 16px radius, --shadow-sm; no left-border accents; CSS vars only; Lucide stroke 2, 18-20px; no emoji. Voice: "Tap a credit to book your next session.", "Credits expire — book before the date shown." States: active credits = 1–2 cards with credits left, Book primary live; empty = inline empty (48px sunken disc, ticket icon) "No packages yet" + body "When you buy a package, your credits show up here." + a "Browse services" link; expired/used = card greyed, meter full/empty, "Expired" or "All used" pill, Book replaced by "Buy again"; expiring-soon = an amber --color-warning-bg banner on the card "2 credits expire in 9 days — book soon." All cards, the meter, and buttons are real labelled controls voicing owner, package, credits left, and expiry; holds at max dynamic-type.
```

### Invoices List (owner)  `[v2]` · full screen
- **Archetype:** ListOfRows (reuse Wallet activity styling + A14.6 grouped rows); Stripe-gate per A14.6.
- **Match these references:** A10.10 Wallet.html (grouped-by-day rows + status chips + balance/summary feel), A14.6 Payments.html (filters, Stripe-not-connected gate), A09.4 Invoice.html (status-pill vocabulary).
- **Lives in:** Scheduling Hub (Personal/Business) → Invoices / Payments. Web /app/business/[id]/invoices.
- **Context / pillar:** Business violet — `--color-identity-business`.
- **Frames to produce:** mixed statuses (default) + empty + filtered (overdue) + loading (shimmer) + Stripe-not-connected gate.

```
Design an owner Invoices list (300x620 frame, #eef2f7 canvas) — the financial hub for bookings — reusing A10.10 Wallet row styling and A09.4 status pills. Top bar: chevron-left back, centered title "Invoices", trailing search icon. Business violet pillar accent (--color-identity-business). Top to bottom: a compact totals summary card (two columns) "Outstanding $642 · Collected this month $3,180"; a status filter chip row (All / Paid / Sent / Overdue / Refunded); a grouped-by-date list of invoice rows — each row = leading payer avatar/initials disc, payer name (fg1) + mono invoice # · service caption (fg3), trailing amount (fg1) over a status pill using A09.4's colors (Paid = success green, Sent = sky, Overdue = amber, Void = neutral, Refunded = violet-tinted). Cards white, 1px --app-border, 16px radius, --shadow-sm; no left-border accents; CSS vars only; Lucide stroke 2, 18-20px; no emoji. Voice: "Every booking and package payment, in one place.", "Tap an invoice to send, refund, or download it." States: mixed = rows across several statuses with the summary populated; empty = inline empty (48px sunken disc, receipt icon) "No invoices yet" + body "Invoices appear here once you take a booking or sell a package."; filtered (overdue) = filter set to Overdue, only amber rows, summary recolors to outstanding emphasis; loading = shimmer rows; Stripe-not-connected = a --color-warning-bg gate card "Connect payments to invoice for services" → "Connect" (per A14.6) with the list hidden. Each row, filter, and the search are real labelled buttons voicing payer, invoice number, amount, and status; holds at max dynamic-type.
```

### Invoice Detail (owner)  `[v2]` · full screen
- **Archetype:** ContentDetail (ContentDetailShell) — owner-action variant of the same model the invitee sees read-only.
- **Match these references:** A09.4 Invoice.html (match closely: status pill in top bar, mono invoice # · dates, total hero, payer/payee identity-tinted dots, line-items + tax + service-fee block, payment terms + sender note, Pay/Share/Download dock), A10.10 Wallet.html (payment-timeline row feel).
- **Lives in:** Invoices list → row; also Booking detail → "View invoice". Web /app/business/[id]/invoices/[id].
- **Context / pillar:** Business violet for the owner/payee dot; payer dot tinted by their pillar (sky for a personal payer).
- **Frames to produce:** draft + sent + paid + partially-paid (deposit only) + overdue + void + refunded/partially-refunded.

```
Design an owner Invoice Detail (300x620 frame, #eef2f7 canvas) — match A09.4 Invoice closely, adding owner lifecycle actions. Top bar: chevron-left back, centered title "Invoice", trailing status pill (A09.4 colors). Business violet for the payee dot; payer dot in their pillar (sky for a personal payer). Top to bottom: mono header "INV-00318 · issued Jun 4 · due Jun 18"; the total elevated to a hero number in fg1 ("$642.85"), recoloring to success green with a check disc when paid; payer→payee cards with identity-tinted dots (From Marlow & Co. violet → To Marcus Chen sky) plus the linked booking row ("Haircut · Sat Jun 14, 2:00 PM", chevron); a line-items table (session/package, deposit, balance) + Subtotal / Service fee 3% / Tax 5.7% / Total rows with Total in primary-600; a payment timeline reusing Wallet row feel (Sent → Paid → Refunded with mono timestamps); payment terms + an italic sender note; a Pantopus Pay receipt capsule when paid. Sticky action dock with owner actions: primary "Send" or "Resend", secondary "Mark paid", and an overflow for "Void" / "Refund" (Refund launches the shared Cancel & Refund sheet); when paid the dock pivots to ghost "Share" + primary "Download PDF" (A09.4 behavior). Cards white, 1px --app-border, 16px radius, --shadow-sm; no left-border accents; CSS vars only; Lucide stroke 2, 18-20px; no emoji. Voice: "Send this invoice or mark it paid.", "Refunds open the cancel sheet." States: draft = grey "Draft" pill, dock = "Send"; sent = sky "Sent" pill + "Resend"; paid = green total + receipt capsule + Share/Download dock; partially-paid = "Deposit paid" pill, total split into "Paid $120 · Balance $522.85", dock "Send balance"; overdue = amber "Overdue" pill + a one-line note; void = neutral "Void" pill, actions collapse to Share; refunded = violet "Refunded" pill + a refund line in the timeline. Every row and action is a real labelled button voicing status, amounts, payer, and payee; holds at max dynamic-type.
```

### Cancellation & Refund Policy Sheet  `[v2]` · sheet
- **Archetype:** Selector sheet (preset cards) — like the Support Trains slot-preset config; custom fields reveal inline.
- **Match these references:** A12.11 Start a Support Train.html (selectable tile/card picker + reveal-on-select), A10.8 Membership.html (plain-language policy footnote + no-dark-pattern framing), A14.6 Payments.html (settings rows for the custom fields).
- **Lives in:** Event Type / Service Editor → Pricing section → "Cancellation & refund policy" row → sheet. Web /app/business/[id]/services/[svc]/policy.
- **Context / pillar:** Business violet — `--color-identity-business`.
- **Frames to produce:** default (Flexible) + preset selected (Moderate/Strict) + custom (fields revealed).

```
Design a Business-pillar Cancellation & Refund Policy sheet (300x620 frame, #eef2f7 canvas) where an owner picks a preset that governs invitee refunds — reuse the Support Trains selectable-card picker. Violet pillar accent (--color-identity-business / -bg). Top to bottom: grabber; title "Cancellation & refund policy" (h3) + subhead "Pick how refunds work when someone cancels."; four full-width preset radio-cards (Flexible / Moderate / Strict / Custom), each with a name, a one-line plain summary ("Full refund up to 24h before"), selected card gets a 1px violet border + violet-bg tint + check; when Custom is selected, a reveal of A14.6-style rows — "Free-cancellation cutoff" stepper/chevron (e.g. "24h before"), "Refund after cutoff" percentage row ("50%"), a "Deposit is non-refundable" toggle, and a "No-show handling" chevron ("Charge full price"); a live "What the invitee sees" preview card in --color-identity-business-bg showing the exact plain-language sentence that will appear at checkout (reused verbatim). Cards white, 1px --app-border, 16px radius, --shadow-sm; no left-border accents; CSS vars only; Lucide stroke 2, 18-20px; no emoji. Voice (no dark patterns, mirrors A10.8): "Flexible is the friendliest — most people start here.", "Invitees see this wording before they pay." Sticky footer: primary-600 "Save policy". States: default = Flexible selected, preview reads "Free cancellation up to 24 hours before. After that, no refund."; preset selected = Strict/Moderate selected with its preview text updated; custom = all custom rows revealed and editable with the preview recomputing live. Every preset card, row, toggle, and stepper is a real labelled control voicing the policy name, cutoff, refund percent, and preview text; holds at max dynamic-type.

---

## H · Reminders, automations, insights & cross-cutting states

### Default Reminders Quick-Setup  `[MVP]` · sheet
- **Archetype:** Form (FormFieldGroup toggle list) — extends the AddEventForm ReminderGroup into a multi-select bottom sheet
- **Match these references:** Settings.html FRAME 2 (notification toggle Card + Overline + helper caption) and Form.html (`ToggleRow`, sticky bottom CTA, `Chip` add-button); the channel mini-row reuses A14.5 Notifications.html toggle rhythm
- **Lives in:** Scheduling settings root → "Default reminders" pinned card; also the last step of the Calendarly setup wizard, and a first-event coachmark. Route: `/scheduling/reminders`
- **Context / pillar:** Personal sky `--color-identity-personal` (#0284C7); the same sheet renders with Home green / Business violet accents when opened from those pillars
- **Frames to produce:** default (smart default pre-checked: 1 day + 1 hour) + empty/first-open + saved/success toast + permission-gated (OS push disabled nudge)

```
Design a 300×620 iPhone-framed bottom sheet (dark frame radius 42px, inner 32px, app bg #f6f7f9, status bar 9:41 + dynamic island, home indicator). This is the flagship simple reminder surface: pick lead-times that auto-attach to every event you own. It is a sheet that rises over a dimmed scrim, with a 36px grabber handle, a TopBar-less header row ("Default reminders" h-title 17/700 + close X right), then a one-line muted helper "Times come from each event you own. Per-event overrides stay." Mirror Settings.html FRAME 2: one white Card (1px --app-border, radius 12, --shadow-sm) holding a stacked list of selectable reminder rows: 1 week / 1 day / 1 hour / 30 min / 15 min / At start. Each row is a REAL 48px-min button with a left lucide check-circle (filled --color-primary-600 when on, hollow --app-border-strong when off), the label (15/500 --app-text), and when active an inline channel mini-row beneath: two small segmented chips Push (default, primary-50 bg / primary-700) and Email (white, --app-border). Pre-check 1 day + 1 hour on first open. Below the card, a dashed "+ Add custom time" Chip (Form.html addBtn style) that expands to an inline stepper: number field + unit dropdown (minutes/hours/days). Sticky bottom bar (white, backdrop-blur, 1px top border, 28px bottom pad) with one full-width primary-600 Save button + shadow-primary. Frames: (1) default smart-default checked; (2) empty first-open identical but copy emphasizes "We pre-picked two reminders most people keep"; (3) success — a slim toast above the bar "Reminders saved. They'll apply to new events." with check icon; (4) permission-gated — an amber --color-warning-bg callout row above the card "Push is off in iOS Settings. Email still works." + "Enable in Settings" text button. Sentence case throughout, no exclamation points, lucide stroke 2.
```

### Workflows List  `[v2]` · full screen
- **Archetype:** ListOfRows + GroupedList
- **Match these references:** List of Rows.html (top bar, grouped white cards, hairline dividers, FAB, shared empty state) and A08 Notifications.html `TabStrip` (2px underline scope selector) + `Chip` status pills
- **Lives in:** Scheduling settings root; Event-type editor "Automations" row; Booking link manage. Route: `/scheduling/workflows`
- **Context / pillar:** pillar of the current scope — Personal sky / Home green / Business violet; the segmented Global/This-event-type selector and active toggles take that hue
- **Frames to produce:** populated + empty (default-reminders card + "Add a follow-up" CTA) + loading shimmer + error/retry + permission-gated (Home/Business need admin)

```
Design a 300×620 iPhone-framed full screen for automations. Mirror List of Rows.html chrome: TopBar with chevron-left back, centered title "Workflows", right action = lucide plus text-button. Below it a segmented scope selector built like A08's TabStrip (2px primary-600 underline on active): "Global" / "This event type". Body is a scroll of grouped white Cards (1px --app-border, radius 16, --shadow-sm) with 18px uppercase Overline group labels in --app-text-secondary. First, a pinned "Default reminders" card — a single tappable row with a lucide bell-tile (primary-50 bg, primary-600 icon), label "Default reminders", subtext "1 day + 1 hour before · Push", trailing chevron — that opens the Quick-Setup sheet. Then a "Your workflows" group of rows: each row = lucide trigger icon tile + a plain-English trigger summary ("When a booking is created", "1 hour before it starts"), a second muted line naming the action ("Email attendees", "Notify me"), small action-channel lucide icons, a Status Chip (Active = --color-success-bg/success, Paused = --app-surface-sunken/secondary, Draft = --color-warning-bg/warning), and an iOS 51×31 toggle. Floating FAB bottom-right 52×52 primary-600 + shadow-primary, lucide plus, for "New workflow". Frames: (1) populated with default-reminders card + 3 workflow rows mixing states; (2) empty — default-reminders card present, then a centered prompt "No follow-ups yet" with muted subcopy "Reminders are handled. Add a thank-you or a review request to run automatically." + outline "Add a follow-up" CTA; (3) loading — shimmer skeleton rows (no "Loading…" text), 4 grey pulse bars; (4) error — inline retry card with lucide cloud-off + "Couldn't load workflows" + Try again; (5) permission-gated — a lock callout "Only admins can edit Home workflows" with toggles dimmed to 50%. Sentence case, verbs-first, lucide stroke 2.
```

### Workflow Editor  `[v2]` · full screen
- **Archetype:** Form (FormShell) + reuses SendUpdate message+audience blocks + ChannelChip; merges editor and run-log via a top tab
- **Match these references:** Form.html (TopBar with Save, `Section`/`OverlineLabel`, `Textarea` with charCount, sticky CTA, `Toggle`); A22.2 Compose Broadcast.html for the audience/message block; A08 Notifications.html `TabStrip` for the Build/Activity tabs and `NotificationRow` chip tints for the run-log rows
- **Lives in:** Workflows List "+ New" / row tap; Event-type editor "Add follow-up". Route: `/scheduling/workflows/:id`
- **Context / pillar:** scope's pillar accent; trigger/recipient active states use it
- **Frames to produce:** new (sensible preset) + editing existing + validation error (no recipient / empty message) + SMS coming-soon (disabled) + saving/saved + activity tab (empty / populated / has-failures)

```
Design a 300×620 iPhone-framed full screen to build one automation. Top: Form.html TopBar — left close X, centered "New workflow", right "Save" text-button (primary-600, disabled --app-text-muted until valid). Directly under it a two-tab TabStrip (A08 style, 2px underline): "Build" / "Activity". BUILD tab is one vertical scroll of Sections (OverlineLabel + 12px gap), each in white Cards. TRIGGER section: a lifecycle segmented control (Created / Cancelled / Rescheduled / Started / Ended) plus a time-relative row "1 hour before it starts" with a chevron that opens the Trigger Picker sheet. RECIPIENT section: three selectable chips Me / Attendees / Both (reuse A22.2 audience chips, active = primary-50/primary-700, 1px primary-100). ACTION section: channel picker as ChannelChips Push / Email / In-app / SMS — SMS rendered disabled with a tiny "Coming soon" caption. MESSAGE section: a Textarea (radius 8, 1px --app-border) with placeholder body, an "Insert variable" chip bar above it, a live char counter bottom-right (mono, --app-text-muted), and a "Preview" text-button that opens Message Preview. Bottom: an Enable toggle row in its own card ("Workflow active", 51×31 toggle) then sticky CTA bar with Save. ACTIVITY tab reuses A08 NotificationRow tints: rows of delivered (--color-success-bg/success check), failed (--color-error-bg/error alert + "Resend" text-button), skipped (slate). Frames: (1) new with sensible preset "1 hour before · Email · Attendees"; (2) editing existing populated; (3) validation error — Textarea border 1.5px --color-error with inline "Add a message before saving", recipient hint "Pick who this goes to"; (4) SMS coming-soon highlighted; (5) saved — slim success toast "Workflow saved"; (6) activity populated with one failed row. Plainspoken second-person copy, no exclamation points.
```

### Trigger Picker  `[v2]` · sheet
- **Archetype:** Form section in a sheet (PickerRow list + stepper)
- **Match these references:** Settings.html FRAME 1/3 (Card + Row + Radio selection rows) for the lifecycle list; Form.html stepper/Slider styling and Settings privacy slider for the number control
- **Lives in:** opened from the Workflow Editor TRIGGER row (renders inline on wide/web layouts). Route: presented sheet over `/scheduling/workflows/:id`
- **Context / pillar:** scope's pillar; selected radio + summary use the accent
- **Frames to produce:** lifecycle selected + time-relative selected + invalid (0 / negative stepper)

```
Design a 300×620 iPhone-framed bottom sheet to choose what fires a workflow. Sheet with grabber handle, header row ("When should this run?" h-title 17/700 + close X), then two grouped white Cards mirroring Settings.html selection rows. CARD 1 "Lifecycle" (Overline): radio rows — Created / Cancelled / Rescheduled / Started / Ended — each a 48px-min REAL button with a 22px Radio (1.5px primary-600 when selected) on the right, label 15/500, and a muted one-line description ("the moment someone books", "when an attendee cancels"). CARD 2 "Time-relative" (Overline): a builder row with an inline stepper — a minus/plus pill stepper around a number, a unit segmented control (min / hour / day), and two toggling segmented chips before|after and start|end. Below both cards, a live plain-English summary line in a primary-50 pill with lucide clock: "1 hour before it starts." Sticky bottom Done button (primary-600, full width, shadow-primary). Frames: (1) lifecycle "Created" radio selected, time card collapsed; (2) time-relative active — stepper at 1, unit Hour, "before" + "start", summary reads "1 hour before it starts"; (3) invalid — stepper at 0, the number turns --color-error, summary replaced by "Pick a number greater than zero", Done disabled at 50% opacity. Sentence case, lucide stroke 2, every control a labeled button reachable at the largest dynamic-type size.
```

### Message Template Editor  `[v2]` · sheet
- **Archetype:** reuses SendUpdate message block + char counter; ChipPicker for variables
- **Match these references:** Form.html `Textarea` (charCount), `FieldLabel`, `Chip` add-button, sticky CTA; A22.2 Compose Broadcast.html message body block; Settings.html `Toggle` for "Save as template"
- **Lives in:** Workflow Editor MESSAGE block; Template Library "+ New" / edit. Route: sheet over `/scheduling/workflows/:id`
- **Context / pillar:** scope's pillar accent on the variable chips and focus ring
- **Frames to produce:** editing + over-limit (SMS ~160 warning) + saved-as-template confirmation + empty

```
Design a 300×620 iPhone-framed bottom sheet to write a workflow message. Grabber + header ("Edit message" + close X + right "Done" text-button primary-600). Body scroll: an optional Subject Input (Form.html Input, radius 8, shown only for Email/SMS) labeled with FieldLabel; then the Body block — a tall Textarea (min 120px, 1px --app-border, radius 8) with realistic copy and a live char counter bottom-right in mono --app-text-muted. Directly above the textarea a horizontal "Insert variable" chip bar: a lucide-braces leading chip "Insert variable" (dashed --app-border-strong) plus 3-4 recently used variable chips ({{attendee_name}}, {{event_time}}) in primary-50/primary-700 — tapping opens the Variable Picker. Below: a per-channel length hint line ("SMS messages over 160 characters send as 2") in --app-text-secondary. Then a "Save as template" row in a white card: label + 51×31 Toggle; when on, reveal a name Input beneath. Sticky bottom Done button. Frames: (1) editing — populated body with two variable chips inline, counter "128 / 600"; (2) over-limit — SMS context, counter turns --color-error "172 / 160", an amber --color-warning-bg hint "This will send as 2 messages"; (3) saved-as-template — success toast "Saved to your templates" + the name field filled "Booking thank-you"; (4) empty — placeholder body "Write what attendees should see…", counter "0 / 600", Done disabled. Plainspoken voice, no exclamation points, lucide stroke 2.
```

### Variable Picker  `[v2]` · sheet
- **Archetype:** ListOfRows in a compact sheet / ChipPicker
- **Match these references:** List of Rows.html grouped rows + Settings.html `Overline` group headers; Form.html `Input` for the search field; A08 row tile/chevron rhythm
- **Lives in:** Message Template Editor "Insert variable"; Workflow Editor message block (renders as an inline dropdown bar above the textarea on web). Route: sheet over the editor
- **Context / pillar:** scope's pillar; the token preview chips use the accent
- **Frames to produce:** default grouped list + searching + no results

```
Design a 300×620 iPhone-framed compact bottom sheet to insert a dynamic token. Grabber + header ("Insert variable" + close X). A search Input at top (Form.html style, lucide search leading, placeholder "Search variables"). Body is grouped white Cards with Settings.html Overline headers: EVENT, PEOPLE, LINKS. Each row (48px min, real button, tap inserts + dismisses) shows a human label (15/500 "Attendee name"), a mono token preview chip below in primary-50/primary-700 ("{{attendee_name}}"), and a right-aligned muted sample value ("Maria K."). Group EVENT: Event title, Date, Time, Duration, Location. PEOPLE: Attendee name, Host name, Attendee email. LINKS: Reschedule link, Cancel link, Join link. Frames: (1) default — three grouped cards fully populated; (2) searching — query "name" filters to Attendee name + Host name, others hidden, search field focused with primary-400/40 ring; (3) no results — query "zoom" returns a centered 72×72 --app-surface-sunken circle with lucide search-x, "No variables match" headline, muted "Try a different word, or use the event link variables." Lucide stroke 2, sentence case, fully VoiceOver-labeled rows.
```

### Message Preview  `[v2]` · sheet
- **Archetype:** ContentDetail-style preview surface + StatusChip
- **Match these references:** A18 Status/Waiting status-screen layout + A18 `Chip`; A08 NotificationRow (for the push/in-app mock chrome) and A15 Chat Conversation bubble for the in-app channel; Form.html sticky CTA
- **Lives in:** Workflow Editor "Preview"; Message Template Editor "Preview". Route: sheet over the editor
- **Context / pillar:** scope's pillar; the "Send test" button and active channel tab take the accent
- **Frames to produce:** per-channel preview (Push / Email / In-app / SMS) + send-test sent (toast) + send-test failed

```
Design a 300×620 iPhone-framed bottom sheet that shows the rendered message per channel before saving. Grabber + header ("Preview" + close X). A channel TabStrip (A08 style, 2px primary-600 underline): Push / Email / In-app / SMS. Below it a realistic device mock per channel rendered on a soft --app-surface-sunken stage: PUSH = an iOS lock-screen notification card (app icon tile, bold title, two-line body, "now"); EMAIL = a white email card with From row, subject, body, footer; IN-APP = an A15-style chat bubble from the workflow sender; SMS = a green/grey SMS bubble with the 160-char note. All variables resolved with sample data ("Hi Maria, your Intro call is tomorrow at 3:00 PM"). A primary-600 outline "Send test to me" button sits below the mock. Sticky bottom bar with two buttons: secondary "Edit" + primary "Looks good". Frames: (1) Push tab active, fully rendered; (2) Email tab; (3) send-test sent — slim --color-success-bg toast "Test sent to maria@pantopus.co" with check icon; (4) send-test failed — --color-error-bg toast "Couldn't send test" + "Try again" text-button. Reduce-motion honored. Plainspoken copy, no exclamation points, lucide stroke 2. Note this is the trust-builder so the device mocks must look real, not wireframe.
```

### Message Template Library  `[v2]` · full screen
- **Archetype:** ListOfRows
- **Match these references:** List of Rows.html FRAME 2 (category-grouped variant — Overline headers, file-type icon, chevron rows, search trailing) + shared empty state; A08 `Chip` for channel + usage badges
- **Lives in:** Scheduling settings root; aftermath of "Save as template"; Workflow Editor "Use a template". Route: `/scheduling/templates`
- **Context / pillar:** scope's pillar accent on the FAB and active states
- **Frames to produce:** empty (only starters) + populated + loading shimmer + error

```
Design a 300×620 iPhone-framed full screen to browse and reuse message templates. Mirror List of Rows.html category-grouped variant: TopBar chevron-left back, centered "Templates", right lucide search text-button. Body is two grouped white Cards under Settings.html Overline headers: "Starter templates" (read-only, duplicable) and "My templates". Each row (real button, chevron trailing) = a lucide tile (primary-50 bg, file-text icon), template name (15/500), a muted first-line preview, and a footer row of small Chips: channel chips (Email, Push) plus a usage-count chip ("Used in 3"). Starter rows show a "Duplicate" copy icon instead of edit. Floating FAB 52×52 primary-600 + shadow-primary, lucide plus, "New template". Swipe affordance (a peeking row showing duplicate/delete) on one My-templates row. Frames: (1) empty — only the Starter card populated (Booking confirmation, Reminder, Thank-you, Review request), then a muted prompt under an empty "My templates" header "You haven't saved any yet. Edit a starter or write your own." + outline "New template"; (2) populated — both cards full, mixed channels and usage counts; (3) loading — shimmer skeleton rows, no "Loading…" text; (4) error — inline retry card, lucide cloud-off + "Couldn't load templates" + Try again. Sentence case, verbs-first, lucide stroke 2.
```

### Insights Dashboard  `[v2]` · full screen
- **Archetype:** ContentDetail (single scroll of cards); list cards reuse A22 Audience "top sources" pattern
- **Match these references:** A22.1 Audience.html (headline metric tiles + ranked source list) + A10.10 Wallet.html / A10.11 Earn.html stat cards; A08 `TabStrip`/period chip; List of Rows.html empty state
- **Lives in:** "See insights" from the Scheduling Summary Card; Business pillar Insights tab. Route: `/scheduling/insights`
- **Context / pillar:** Business violet `--color-identity-business` by default (this is the owner analytics home); Personal sky when a Personal owner views their own page
- **Frames to produce:** populated + empty (not enough data) + loading skeleton + error/retry + partial (few bookings → hide noisy charts) + low-traffic (suppress conversion %)

```
Design a 300×620 iPhone-framed full screen — the analytics home for scheduling. Mirror A22.1 Audience and Wallet/Earn stat cards. TopBar chevron-left back, centered "Insights", right a Period chip (lucide calendar, "Last 30 days") that opens the Period & Filter sheet; if the user owns >1 page, an owner/context switcher chip sits under the title. Body is a single scroll of white Cards (1px --app-border, radius 16, --shadow-sm, NO left-border accents): (1) a 2×2 grid of headline metric tiles — Total bookings, Completion %, No-show %, Page conversion — each a stat card with big number (h2 24/600), label overline, and a tiny up/down delta chip (success/error). (2) "Bookings over time" card with a simple bar/line chart drawn in SVG using --color-primary-600 bars on an --app-surface-sunken baseline, x-axis day labels. (3) "Top event types" ranked list (A22 source-row style): rank number, type name, a thin proportion bar, count + a chevron into Per-Event-Type. (4) "Top times & days" as a compact ranked list or light heatmap of weekday × time blocks tinted in primary scale. (5) "Booking page traffic" card: views, unique, a 3-step funnel (Views → Started → Booked) with drop-off %. (6) "Top sources" UTM list (ranked, with campaign sub-rows). Footer row-links into "No-show report" and "Team performance" with chevrons. Frames: (1) populated rich; (2) empty — centered 72×72 violet-bg circle, lucide bar-chart, "Not enough data yet", "Insights appear once you have a few bookings. Share your link to get started." + "Copy booking link" CTA; (3) loading — shimmer skeleton tiles + ghost chart, no "Loading…"; (4) error — retry card; (5) partial — tiles shown but charts replaced by a muted "More data needed for trends" note; (6) low-traffic — conversion tile shows "—" with caption "Too few page views to measure." Sentence case, Title Case only on overline labels, lucide stroke 2.
```

### Per-Event-Type Performance  `[v2]` · full screen
- **Archetype:** ContentDetail
- **Match these references:** A22.1 Audience.html metric tiles + ranked lists; Wallet/Earn stat cards; A09.4 Invoice.html header block for the event-type header (name/duration/price)
- **Lives in:** Insights Dashboard "Top event types" row; Event type detail/manage → "View performance". Route: `/scheduling/insights/event-types/:id`
- **Context / pillar:** inherits the dashboard's pillar (Business violet / Personal sky)
- **Frames to produce:** populated + empty (never booked) + loading + error (single-type accounts skip this screen)

```
Design a 300×620 iPhone-framed full screen drilling into one event type's funnel. TopBar chevron-left back, centered title = the event-type name, right kebab (or "Edit type" text-button). A header card (mirror A09.4 Invoice header rhythm): event-type name (h3 20/600), a muted meta row with lucide clock "30 min" + lucide tag "$50" + a "Compare to average" chip. Then a funnel card: four horizontal funnel steps — Page views → Booked → Completed → No-show — each a labeled bar in the primary scale with count and % (the funnel narrows visually). A 2×2 stat-tile grid: page views, booked, completion %, no-show %, each with a delta chip vs account average. "Bookings over time for this type" SVG bar chart card. "Best days & times" ranked list (A22 style, weekday + time block + count). Footer "Edit event type" outline button. Frames: (1) populated; (2) empty — never booked, centered 72×72 tinted circle with lucide calendar-x, "No bookings yet for this type", muted "Share this event type's link and its performance shows up here." + "Copy link" CTA; (3) loading shimmer; (4) error retry card. Sentence case, no exclamation points, lucide stroke 2, all metrics announced with labels (not color-only) for VoiceOver.
```

### No-Show & Cancellation Report  `[v2]` · full screen
- **Archetype:** ListOfRows + header stat (reuses gig NoShowModal / ReliabilityPanel concepts)
- **Match these references:** A22.1 Audience.html header stat + ranked list; List of Rows.html FRAME 1 (tabbed status-chip rows) + shared empty state; A08 NotificationRow chip tints for outcome pills
- **Lives in:** No-show tile on Insights Dashboard; Reliability nudge notification. Route: `/scheduling/insights/no-shows`
- **Context / pillar:** dashboard pillar (Business violet / Personal sky); outcome chips use semantic colors, not pillar
- **Frames to produce:** populated + empty (zero no-shows, celebratory) + loading + error + policy-not-enabled callout

```
Design a 300×620 iPhone-framed full screen tracking reliability. TopBar chevron-left back, centered "No-shows & cancellations", right Period chip. Header card: a big no-show-rate headline number (h1 30/700) with a small trend delta chip and a one-line sublabel "of 84 bookings in 30 days". A breakdown card with a single stacked horizontal bar split into Honored (--color-success), Late cancel (--color-warning), No-show (--color-error), with a legend row of counts beneath. A "Recent no-shows" grouped card (List of Rows status-chip variant): each row = invitee avatar, name, event type + date muted line, an outcome Chip (No-show = error-bg/error, Late cancel = warning-bg/warning), and a "·" overflow with quick actions (Message, Mark honored). A repeat-offender row carries a small lucide flag in --color-warning. Below the list, a callout card: lucide shield "Reduce no-shows" + "Require a deposit or a cancellation window for this event type." + "Set a policy" primary text-button. Frames: (1) populated; (2) empty/celebratory — zero no-shows, centered 72×72 --color-success-bg circle with lucide party-popper (or check-check), "No no-shows. Nice." + muted "Everyone who booked in the last 30 days showed up."; (3) loading shimmer; (4) error retry; (5) policy-not-enabled — the callout card emphasized at top before any data. Reduce-motion on any celebratory flourish. Sentence case, no exclamation points except none, lucide stroke 2.
```

### Team Performance (Business Round-Robin)  `[v2]` · full screen
- **Archetype:** ListOfRows (member metric rows)
- **Match these references:** List of Rows.html FRAME 3 (avatar-first row list with verification badge + kebab) + A22.1 Audience ranked metric rows; A08 `Chip` + Settings.html `Overline`
- **Lives in:** Insights Dashboard "Team" section (only when business has >1 bookable member); Business pillar settings → team. Route: `/scheduling/insights/team`
- **Context / pillar:** Business violet `--color-identity-business` (business-only screen); the round-robin balance indicator uses the violet accent
- **Frames to produce:** populated + empty (solo business → hidden) + loading + error + single-member (collapse) + permission-gated (owner/admin)

```
Design a 300×620 iPhone-framed full screen comparing team members on a round-robin booking engine (Business violet context). TopBar chevron-left back, centered "Team performance", right a sort chip ("Bookings" with lucide arrow-up-down) that toggles the sort metric. A top summary card: a "Round-robin balance" indicator — a horizontal stacked bar showing each member's share of bookings in violet tints, with a balance label ("Evenly distributed" / "Skewed toward Amina") and a small lucide scale icon. Then an avatar-first member list (List of Rows FRAME 3 style): each row = 44px avatar + green verification badge, member name (15/600), a metric strip beneath showing bookings, completed, no-show %, and avg rating (lucide star), a thin utilization bar (booked hours vs available hours in violet), and a trailing chevron into that member's slice. Sort/filter chips for period live under the top bar. Frames: (1) populated 4 members with varied load; (2) empty/hidden — a centered note "Team insights appear once more than one member takes bookings" (this screen is hidden for solo businesses); (3) loading shimmer rows; (4) error retry; (5) single-member — collapses to one summary card "Only you take bookings right now"; (6) permission-gated — lock callout "Only owners and admins can view team performance", rows dimmed 50%. Sentence case, metrics labeled for VoiceOver (never color-only), lucide stroke 2, never reassign the violet pillar hue.
```

### Insights Period & Filter Sheet  `[v2]` · sheet
- **Archetype:** Form-in-a-sheet (bottom sheet of pickers)
- **Match these references:** Settings.html FRAME 3 (radio rows + mixed controls in cards) + Form.html sticky CTA and `Chip`; Home calendar.html month strip for the custom date-range picker
- **Lives in:** Period chip on the Insights Dashboard and any sub-screen (shared, not duplicated). Route: sheet over any `/scheduling/insights/*`
- **Context / pillar:** inherits the calling screen's pillar; selected presets and the active range take that accent
- **Frames to produce:** default (30 days) + custom-range active + filters-applied badge

```
Design a 300×620 iPhone-framed bottom sheet — the shared date-range and filter control for all insights screens. Grabber + header ("Filter insights" + a "Reset" text-button left, close X right). Body of grouped white Cards (Settings.html selection-row style): CARD 1 "Date range" (Overline) — radio rows Last 7 days / Last 30 days / Last 90 days / Year to date / Custom, each with a 22px Radio (primary-600 selected). When "Custom" is chosen, reveal an inline month strip + start/end date row mirroring Home calendar.html's month strip and agenda rhythm. CARD 2 "Event type" (Overline) — a chevron row opening a multi-select ("All event types" / "2 selected"). CARD 3 "Team member" (Overline, business only) — a chevron row ("Everyone" / "Amina, Sam"). Sticky bottom Apply button (primary-600, shadow-primary), with a subtle count "Apply (2 filters)". Frames: (1) default — "Last 30 days" radio selected, no filters; (2) custom-range active — Custom selected, month strip visible with a highlighted start–end span in primary scale, summary line "Jun 1 – Jun 13"; (3) filters-applied — event type + member rows show selected values and a small primary-600 badge on the Apply button. Sentence case, lucide stroke 2, every picker a labeled button reachable at the largest dynamic-type size.
```

### Accessibility & Large-Text Requirements  `[MVP]` · section (cross-cutting note)
- **Archetype:** applies to SlotCalendar + all booking surfaces (not a route)
- **Match these references:** Support trains.html / A10.9 Support train.html slot grid (the fixed-tile grid this note is fixing); A08 List of Rows for the list-fallback layout; Settings.html for the toggle that exposes the fallback
- **Lives in:** a cross-cutting requirements card kept in the inventory; enforced across every scheduling screen. No route
- **Context / pillar:** pillar-neutral; demonstrates Personal sky as the example context
- **Frames to produce:** large-text reflow (slot grid → stacked list) + VoiceOver list-fallback for grid + reduce-motion

```
Design a 300×620 iPhone-framed reference card (not a product route) that DOCUMENTS the accessibility contract for the scheduling slot grid and booking controls, shown as three annotated phone frames so engineering can see the required behavior. This is the gate that fixes SlotCalendar's fixed 40×40 tiles. Frame A "Default → large-text reflow": show the Support trains.html weekday+time slot grid at default size, then the SAME grid reflowed at XXL Dynamic Type — tiles grow to 44pt minimum targets, the dense grid collapses to a single-column stacked list of full-width slot buttons, day numbers never truncate, each slot button reads its full label "Tue Jun 16, 3:00 PM, available". Frame B "VoiceOver list-fallback": the grid rendered as an A08-style list of rows where each row is a real button announcing "Tue Jun 16, 3:00 PM, available" or "…, taken", with a visible focus ring (primary-400/40, 2px offset) on the focused slot; a timezone chip at top announces "Times shown in Pacific Time, host is in Eastern" — timezone and availability conveyed by text, never color alone; a conflict banner announced via accessibility focus in --color-error-bg with lucide alert-triangle, color never the sole signal. Frame C "Reduce-motion": a booking-confirmed screen where the ConfettiSpray is suppressed under prefers-reduced-motion — show a calm static check-circle in --color-success instead, with a caption "Confetti off when reduce-motion is on." Add small dashed annotation labels pointing at each requirement (44pt target, full label, focus ring, timezone affordance). Sentence case, lucide stroke 2, all interactive examples are real labeled buttons.
```

### Notification / Reminder Permission & Channel Connect Prompt  `[v2]` · prompt / sheet
- **Archetype:** Status/permission prompt sheet (A18 status-screen layout) — the just-in-time precondition surface for channel toggles
- **Match these references:** A18 Status/Waiting (Verify Email Sent / Waiting for Approval) centered icon + headline + CTA; Form.html `Input` for the phone/email verify field + sticky CTA; A14.5 Notifications.html channel grouping it gates
- **Lives in:** surfaced from Default Reminders Quick-Setup and any workflow/preference that selects a channel the user hasn't enabled or verified. Route: sheet over `/scheduling/reminders` and `/scheduling/workflows/:id`
- **Context / pillar:** pillar of the calling context; the connect CTA takes that accent
- **Frames to produce:** push permission prompt + email verify (code entry) + SMS verify (phone + code) + connected/success + denied (Settings deep-link)

```
Design a 300×620 iPhone-framed bottom sheet — the just-in-time prompt that grants push permission or verifies the email/phone a reminder will use, so a reminder is never configured against a dead channel. Mirror A18 status-screen layout: a centered 72×72 tinted circle with a lucide channel icon, a headline, a one-paragraph muted explainer, and a primary CTA, but in a sheet with a close X. PUSH frame: lucide bell-ring in primary-50/primary-600, "Turn on push reminders", "Pantopus needs permission to send reminders to this device. You can change this anytime in Settings." + primary "Allow notifications" + secondary "Use email instead". EMAIL-VERIFY frame: lucide mail in primary tint, "Confirm your email", muted "We sent a 6-digit code to maria@pantopus.co", a 6-box code Input row (Form.html style), "Resend code" text-button, sticky "Verify" CTA. SMS-VERIFY frame: lucide message-square, a phone Input with +1 leading then the same code-box row, caption "Carrier rates may apply." CONNECTED frame: --color-success-bg circle + lucide check-check, "Email confirmed", "Reminders will send to maria@pantopus.co.", "Done" CTA. DENIED frame: --color-warning-bg circle + lucide bell-off, "Push is turned off", "Reminders can't reach this device until you enable notifications in iOS Settings. Email still works." + "Open Settings" + "Keep email only". Frames: render all five. Plainspoken second-person copy, no exclamation points, lucide stroke 2, code boxes are real labeled inputs reachable with assistive tech.
```

### Booking-Link / Page Empty & Zero-State  `[MVP]` · state
- **Archetype:** shared empty state extending List of Rows.html FRAME 4 (the one empty state inherited across every list)
- **Match these references:** List of Rows.html FRAME 4 (72×72 identity-tinted circle, headline, subcopy, primary CTA) + A08 Notifications empty state; A18 for the friendly first-run tone
- **Lives in:** the first-run state for event-type-list, bookings-inbox, packages/availability-schedule-list, workflows-list, and the public booking page itself. Applied across routes, demonstrated as a set
- **Context / pillar:** pillar of the owning context — Personal sky / Home green / Business violet; the tinted empty circle and CTA take that hue
- **Frames to produce:** event-types empty + bookings-inbox empty + availability-not-set empty + public booking page (no event types yet) — one frame each, same shell

```
Design a 300×620 iPhone-framed set of owner first-run empty states for the scheduling surfaces, all inheriting ONE shell from List of Rows.html FRAME 4 so day-one screens never ship a blank rectangle. Each frame: the normal TopBar (chevron-left back + centered title + right plus where a create action exists), then a vertically centered empty block — a 72×72 identity-tinted circle (pillar color bg at the -bg token, pillar-colored lucide icon), an h3 sentence-case headline, one to two short muted sentences, and a single primary-600 CTA + shadow-primary that routes to the relevant create flow or the setup wizard. Frame 1 EVENT TYPES (Personal sky): lucide calendar-plus, "Create your first event type", "Event types are the things people can book — a 30-minute intro, a home visit. Add one to start taking bookings." + "Create event type". Frame 2 BOOKINGS INBOX (Business violet): lucide inbox, "No bookings yet", "When someone books a time, it shows up here. Share your link to get your first one." + "Share booking link". Frame 3 AVAILABILITY NOT SET (Personal sky): lucide clock, "Set your availability", "Your personal availability is the source of truth for every booking. Tell us when you're free." + "Set availability". Frame 4 PUBLIC BOOKING PAGE — empty (invitee-facing, neutral but owner-previewing): a public-profile header (avatar, name, verified badge) then a centered "Nothing to book yet" with muted "This person hasn't published any event types." — no owner CTA, an owner-only "Add an event type" appears only in preview. Plainspoken, verbs-first CTAs, no exclamation points, lucide stroke 2, the tinted circle uses the pillar -bg token and never a left-border accent.
```

---

## QA & coverage checklist

### 1 · Coverage

The eight groups span every required surface:
- **Personal**: A (hub, wizard, settings, notifications), B (event types, availability), C (public link + invitee pick), H (reminders, insights).
- **Home/family**: F (agenda extend, find-a-time, who's-free, household resources, vendor visits, read-only member view).
- **Business/team**: G (round-robin, collective, team availability, member hours, business settings).
- **Invitee**: C + D (form, review, confirmed, manage, slot-taken/conflict, expired/paused/secret, add-to-calendar, deep-link hand-off, cutoff/policy-blocked, my bookings, recurring series).
- **Payments**: G (Stripe Connect & tax, payouts, packages, buy/credits, invoices list + detail, refund policy) + D (payment-failed/retry).

**Gaps to flag (add before sign-off):**
- **Cross-cutting error/offline frame** — a shared "something went wrong / retry / offline" template is implied but not a named screen; add one canonical error mock.
- **Host availability conflict at booking time** is in E (double-book) but invitee-side **stale-slot race** beyond "Slot Taken" (silent re-fetch) should be called out explicitly.
- **GDPR/data + cancellation-confirmation email artifacts** (the actual notification renders) aren't screens — note them as out-of-scope or add to H.
- **Multi-timezone host vs. invitee mismatch banner** — ensure it lives in C's timezone selector, not just D.

### 2 · Consistency reminders (verify on every mock)

- **Archetype match**: each mock visually descends from its named reference screen — same shell, header, row rhythm, spacing scale. No new layout languages.
- **Tokens only**: colors, radii, spacing, type from CSS variables; zero hard-coded hex or px one-offs.
- **Identity-pillar accent**: Personal / Home / Business accent matches the screen's context; never mix pillars on one mock.
- **State frames present**: every list/data screen ships **empty + loading-skeleton + error** variants, not just the happy path.
- **Voice & case**: Pantopus voice, sentence case for all UI strings, labels, and buttons.
- **Icons**: Lucide only — no emoji, no mixed icon sets.

### 3 · Scheduling-specific global rules (add to suite)

1. **Slot grid = real labelled buttons**: time slots are focusable `<button>`s with accessible names ("Tue 14 Jun, 2:30 pm"), 44px min targets, visible focus, disabled state for taken — never bare divs.
2. **Always-visible timezone chip**: every slot picker, public page, and confirmation shows a persistent, tappable timezone chip; default detected, never hidden below the fold.
3. **Composed-availability explainer**: home/business multi-person screens carry a one-line "why these times" note (whose calendars combined) wherever availability is intersected.
4. **Reuse the Support Trains slot grid**: all invitee/public slot pickers derive from `A12.11 Start a Support Train.html` weekday + time-range grid — same cell, gap, and selected state.
5. **Reuse Home calendar for home context**: every family/home scheduling screen extends `A08 Home calendar.html` — do not introduce a parallel calendar component.
6. **Match A09.4 Invoice for invoices**: invoice detail, buy-package receipt, and paid-review screens match `A09.4 Invoice.html` line-item, totals, and status-chip layout exactly.
7. **One-tap durable /book link**: the public booking link is a single canonical, copyable, never-expiring `/book` URL surfaced consistently across share sheet, public-page management, and confirmation — one-off links are visually distinct from it.
