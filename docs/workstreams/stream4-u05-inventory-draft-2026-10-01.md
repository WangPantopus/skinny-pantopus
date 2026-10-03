# Stream 4 U05 inventory — DRAFT, agent-gathered, NOT yet verified (2026-10-01)

> **Child routing 2026-10-02T22:00:10Z:** this historical inventory stays DRAFT/UNVERIFIED. [04-stream4-split-2026-10-02.md](04-stream4-split-2026-10-02.md) assigns sections1.x/2.x to4-1 and3.x to4-2, with JustMoved mail-step and mail-linked asset exceptions.4-1 is the sole combined-draft custodian, taking exact4-2 contributions sequentially; use current parent dispositions rather than treating historical leads as missing features. No accepted scope/old draft payload changed.

> **Bounded4-2 contribution, 2026-10-03T01:35:52Z:** current [parent MailDay dispositions](04-place-records-money-mail.md#u05-source-reconciliation--2026-10-01t204558z) now record actual sealed BEFORE Accept/Finish failure feedback on both apps and working existing iOS row Undo200/reset/reaccept. iOS18a567fc (97listed/99total) and Android9862de82 (69listed/71total) preserve real manual200/full SQL/cold/exact353 cleanup and fullreturn01:29:31Z;4-1 verified immutable custody/recorded comparisons, not a second runtime sweep. Existing-handler repair and native afters remain pending4-2/Root. iOSFinish transient timing, Android14AX/0PNG/unknownwindowflags and continuous/spoken/provider/physical limits remain. This supersedes only those historical MailDay source leads; original draft payload/other unverified classifications and acceptance counts stay unchanged.

**Status:** gathered by a read-only research agent on 2026-10-01 (prompt: the kit's
`runtime/stream4-u05-inventory-agent-prompt.md`). It read worktree c3e7 at `dd0602d5c`, which is master `7b41c8b04` plus one
backend commit. **Nothing here is verified.** The next Stream 4 session must check each NOOP, SAMPLE, premature-success and
leak item on master (code, then device or API where it matters) before recording a disposition in the 04 file's U05 row, or
fixing it. Some items are already handled:

| Item | Handled by |
|---|---|
| Mail Day scan, history and nudges | #1406 |
| Mail-task dock and header stubs | `claude/stream4-mail-task-stubs` |
| Earn, "Scan an item", Stamps gift and more | the flag-gap PR |
| Theme apply on native | #1401 |
| iOS Mail Day sample fallback | #1375 |

Candidate items that need a decision first:

1. **Maintenance.** The report says the iOS maintenance log is reachable from the profile cover's Maintenance tile, which
   contradicts the 2026-10-01 "A parked" finding. Re-check. If it is reachable, revive
   `claude/stream4-ios-maintenance-reminder-flag` (`7f492bb31`) and look at Android's calendar POST too. The report also says
   maintenance photos, receipts and notes are never sent.
2. **iOS cut-feature leaks.**
   - Mail Day settings show toggles for Earn and the cut kinds.
   - Recent activity isn't filtered for cut targets.
   - The document link picker fetches bills and pets.
3. **Mail-task "Convert to neighbor gig"** isn't gated by open gigs (cut #4).
4. **Mail detail shows sample or wrong feedback on real data.**
   - A fabricated TL;DR timeline event.
   - "Tap to undo" acknowledges again.
   - "Offer saved" files the mail.
5. **Web.** These fail without saying so:
   - tasks "New from mail" (it sends an empty mailId);
   - Memory's "Save to Vault" (and its "Shared!" message appears regardless);
   - theme apply;
   - vault "Create folder";
   - records "Add asset".
6. **Android rate-watch Remove** ignores the server result.
7. **All clients:** civic shows "No upcoming election" when the section failed to load.

---

# Stream 4 release-build inventory: Place, home records, money and mail (all launch features OFF)

Nothing was modified; this was read-only throughout. I read the c3e7 worktree as you asked; this session's own working directory is a different worktree (4a5d06).

## 0. How to read this

**Path roots.** Every path below starts with one of these absolute roots:
- `IOS` = `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream-4-workstream-c3e7/frontend/apps/ios/Pantopus`
- `AND` = `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream-4-workstream-c3e7/frontend/apps/android/app/src/main/java/app/pantopus/android`
- `WEB` = `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream-4-workstream-c3e7/frontend/apps/web/src`
  - `WAPP` = `WEB/app/(app)/app`
- `BE` = `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream-4-workstream-c3e7/backend`

**Shorthand used in the tables:**
- `HTR` = `IOS/Features/Root/HubTabRoot.swift`
- `RTS` = `AND/ui/screens/root/RootTabScreen.kt`
- Inside a table, a bare `:NN` means the first file named in the "Files" line above it.

**Handler classes:**
- API: calls a backend endpoint (path given)
- NAV: navigates (destination given)
- LOCAL: client-only state
- NOOP: does nothing
- SAMPLE: fixture or fabricated data
- HIDDEN: hidden by a launch flag
- DEV-ONLY: development builds only
- RO: display only, no control

**Release gating baseline:**
- **Web cut routes.** Signed-in users on a cut `/app` path are redirected to `/app/place` (`WEB/middleware.ts:154-156`). Cut routes relevant here:
  - `/app/homes/:id/(bills|calendar|packages|pets|polls)`
  - `/app/mailbox/(package|unboxing|gig|certified|community|party|translation)`
- **iOS** shows `NotYetAvailableView` for routes not available at launch (`HTR:3645-3692`; the same logic is in `IOS/Features/Root/YouTabRoot.swift:2982-3025`).
  - Gated: ceremonial, party, community, translation (#8); household-extras routes (#7); packageGig (#4).
  - **Not gated:** earn, stamps, unboxing, mailTask, mailTaskList, homeRecords, mailboxVault, vacationHold, mailDay, mailboxMap.
  - Among mailbox deep links, only translation is gated (`IOS/Core/Routing/DeepLinkRouter.swift:921-953`).
- **Android:** EARN, STAMPS, UNBOXING, MAIL_TASK and VAULT are not gated. Deep-link gating covers only MailTranslation among mail links (`AND/core/routing/DeepLinkRouter.kt:448-468`).

**Git baseline:**
- c3e7 is `claude/stream4-mailday-off-no-push` at dd0602d5c. That is master 7b41c8b04 plus one backend-only commit.
- origin/master (ed3ed7ad6) is 15 commits ahead. Its frontend changes touch only Stream 3 files (residency letter, home-settings rename), so nothing below changes.
- The unmerged branch `claude/stream4-mail-flag-gaps` (828f61761) would hide Earn, unboxing / "Scan an item", and the Stamps gift and more icons. It is not on master, so those items are listed here as visible.

**Cross-cutting finding: native mail detail variants are unreachable with real data.**
- `GET /api/mailbox/:id` returns `mail.object = objectData.metadata`, which is the MailObject storage row (bucket, object_key, mime_type, sha256 and similar) (`BE/routes/mailbox.js:1692-1694`).
- The native variant decoders need keys that row never has:

| Variant | Required keys | Decoder |
|---|---|---|
| Booklet | `pages` | `IOS/Core/Networking/Models/Mailbox/V2/BookletDetailDTO.swift:30-35` |
| Coupon | `headline` | `CouponDetailDTO.swift:54-61` |
| Records | `title`, `issuer`, `elf_open`, `elf_filed`, `vault_trail` | `RecordsDetailDTO.swift:345-355` |
| Package | `carrier`, `service`, `tracking_number` | `IOS/Features/Mailbox/MailDetail/PackageBodyContent+Decode.swift:19-29`; `AND/ui/screens/mailbox/mail_detail/variants/PackageDetailDecoder.kt:24-37` |

- Projection happens in `MailDetailProjection.swift:195-212` (iOS) and `MailDetailViewModel.kt:960-1100` (Android). Every item therefore renders the generic layout.

---

## 1. PLACE

### 1.1 Entry points and landing

| Client | Entry | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Place tab | API+NAV | `GET /api/homes/my-homes` → primary-owner home, else the first home → `.placeDashboard` | HTR:3483-3512 |
| iOS | Deep links | NAV | `pantopus://place`, `place?id=`, `place/<id>[/<slug>]`, `?section=`. Slugs: today, your-home, risk, block, money, civic, identity | `IOS/Core/Routing/DeepLinkRouter.swift:800-827`; HTR:1106-1126, 3471-3476 |
| iOS | Today root tab | NAV | AddressTodayTabView | `IOS/Features/Root/RootTabView.swift:320-385` |
| iOS | Verify status screen | unreachable | `.placeVerifyStatus` is never pushed | HTR:3420-3432 |
| Android | Place tab | API+NAV | Hub, then auto-land on PLACE_DASHBOARD | RTS:2536-2656, 2867-2889 |
| Android | Today tab | NAV | TodayTabScreen | RTS:2658-2660 |
| Android | Deep links | NAV | place forms | `AND/core/routing/DeepLinkRouter.kt:906-929` |
| Android | Verify status screen | unreachable | PLACE_VERIFY_STATUS is never navigated to | RTS:2917-2935 |
| Web | `/`, `/app`, login | NAV | signed-in users → `/app/place` | `WEB/middleware.ts:135-137, 141`; `.../frontend/apps/web/next.config.js:67` |
| Web | Place tab | NAV | `/app/place` (`?verified=1`, `?preview`, `?savedPlace` variants) | `WAPP/place/page.tsx` |
| Web | Section pages | NAV | `/app/place/[section]` | `WAPP/place/[section]/page.tsx` |
| Web | Place nav rail | NAV | lg screens only: sections, scout, pulse | `WEB/components/place/PlaceNavRail.tsx:35-43` |
| Web | Today tab | NAV | `/app/today` shows the hub briefing; web has no address-day Today screen | — |

### 1.2 Place dashboard

**iOS.** Files: `IOS/Features/Place/PlaceDashboardView.swift`, `PlaceDashboardViewModel.swift`, `PlaceSwitcherView.swift`, `PlaceSectionView.swift`, `Components/JustMovedCard.swift`. Host: HTR:3376-3402.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Load | API | `GET /api/homes/:id/intelligence`, `GET /api/homes/:id`. A 403 shows the denied state; a failed refresh shows a toast | PlaceDashboardViewModel.swift:106-129 |
| Pull to refresh | API | refresh | :76 |
| Back / Menu (non-loaded states) | NAV | dismiss / drawer | :60-62, :64 |
| Header avatar / menu | NAV | switcher sheet / drawer | :206-214, :216-223 |
| Switcher row / "Add a place" | API+NAV | `GET /api/homes/my-homes`; row → `.placeDashboard(id)`; add → `.addHome` | :78-95 |
| "Home tools" row | NAV | `.homeDashboard` | :122-132 |
| Verify banner (T3) / locked group | NAV | verify sheet → Stream 3 verify flows | :134-138, :303-317, :96-107 |
| Hero tap / nudge | NAV | `.placePulse` (`GET /api/ai/pulse?homeId=`) | :151-162; HTR:3414-3417 |
| Section tap / locked CTA / retry | NAV / NAV / API | `.placeDetail`; band D and "claim" both open the verify sheet | :229-246; PlaceSectionView.swift:32-50 |
| Privacy mirror | NAV | `.privacyMirror` (`GET /api/identity-center/view-as?surface=home&home_id=`) | :249-268 |
| Messages entry (T4) | NAV | neighbor compose / inbox | :271-287 |
| Identity entry | NAV | `.placeDetail(.identity)` | :291-301 |
| JustMovedCard row | NAV | pickup → Today; mail → `.mailDay(.populated)`; money / civic / block → section detail | JustMovedCard.swift:279-300 |
| JustMovedCard tick / "Not new here" / "Hide" | LOCAL | UserDefaults `just_moved.done.<homeId>` | :259-277, :197-200, :167 |
| JustMovedCard mail-step copy | suspicious | "Send back the previous resident's mail / One tap returns it". The row opens My Mail Day; no client has a return action | JustMovedCard.swift:90-96 |

**Android.** Files: `AND/ui/screens/place/PlaceDashboardScreen.kt`, `place/components/JustMovedCard.kt`. Host: RTS:2867-2889.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Pull to refresh / error retry | API | intelligence | :102-107, :112-117 |
| Header avatar / menu / switcher | NAV | add place → ADD_HOME | :413-469, :153-166 |
| Verify banner / locked group | NAV | verifyResidency / postcardVerification / verifyLandlord | :202-208, :279-286, :141-151; RTS:1977-1986 |
| Home tools / privacy mirror / identity | NAV | homeDashboard / privacy / identity detail | :210-218, :220, :292-317, :273-278 |
| Hero | NAV | Pulse; there is no separate nudge handler, the whole card is clickable | :238-252 |
| Messages (T4) / section groups | NAV | — | :254-263, :264-272, :320-342 |
| JustMovedCard | LOCAL / NAV | SharedPreferences | JustMovedCard.kt:122, :189, :276, :325 |

**Web.** Files: `WEB/components/place/PlaceDashboard.tsx`, `PlaceDashboardView.tsx`, `VerifyPromptSheet.tsx`, `JustMovedCard.tsx`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Load | API | `GET /api/homes/primary`, `/api/homes/my-homes`, `/api/homes/:id/intelligence`, hub setup | PlaceDashboard.tsx |
| SetupBanner / "Saved address previews" / add place / claim | NAV | `/app/place?savedPlace=all`, `/app/homes/new`, `/app/homes` | PlaceDashboard.tsx:172-192 |
| Switcher (2+ homes) | NAV | `router.replace(?home=)` | PlaceDashboardView.tsx:95-103 |
| Verify banner / locked group | NAV | `/app/homes/:h/verify-residency|verify-postcard|verify-landlord?return=place` | :105-109, :169-171; VerifyPromptSheet.tsx:63-77, :118 |
| JustMovedCard | LOCAL / NAV | localStorage. Mail step → `/app/mailbox/settings/mail-day`; block step → `/app/nearby` | JustMovedCard.tsx:50-58, :152, :160, :113, :175 |
| Privacy / hero / sections / identity / scout | NAV | `/app/homes/:id/privacy`, `/app/place/pulse`, `/app/place/<slug>`, `/app/place/identity` | :115-122, :123-130, :133-167, :172, :182-198 |
| (absent) | — | No "Home tools" row and no neighbor-message entry (those pages exist but nothing links to them) | — |

### 1.3 Section detail container

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Back / "Try again" | NAV / API | — | `IOS/Features/Place/Detail/PlaceDetailView.swift:51-57, :81` |
| iOS | Load | API | Returns early once loaded; there is no pull-to-refresh | PlaceDetailViewModel.swift:53-56 |
| iOS | Verify CTA | NAV | Absent when the host passes no onStartVerify (as the Today tab does) | PlaceDetailViewModel.swift:47-51 |
| Android | Back / retry / verify sheet | NAV / API | — | `AND/ui/screens/place/detail/PlaceDetailScreen.kt:45-112` |
| Web | Retry | LOCAL | `window.location.reload()` | `WEB/components/place/detail/*` |

### 1.4 Today section (weather, air, alerts, sun) and address calendar / pickup-day editor

**iOS.** Files: `IOS/Features/Place/Detail/PlaceTodayDetailContent.swift`, `AddressTodayTabView.swift`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Weather / good day / air / alerts / sun | RO | — | :25-94 |
| Good-day tile | LOCAL | expand | :313-315 |
| "Pickup schedule" / "Cancel" / pickers | LOCAL | — | :478-490, :530-558 |
| "Save schedule" | API | `PUT /api/homes/:id/calendar/pickup-day` with expectedVersion; handles 409 | :565, :669-679 |
| "Clear household schedule" | API | `DELETE /api/homes/:id/calendar/pickup-day` | :572; `IOS/Core/Networking/Endpoints/HomesEndpoints.swift:721-734` |
| Post-save `onChanged → vm.load()` | NOOP | load() returns early; the card shows the server response itself | :56; PlaceDetailViewModel.swift:53-55 |
| Today tab "Claim your address" | NAV | switches to the Place tab | AddressTodayTabView.swift:86 |
| Today tab retry / pull to refresh | API | — | :110, :161 |

**Android.** Files: `AND/ui/screens/place/detail/PlaceTodayDetailContent.kt`, `PickupScheduleEditor.kt`, `PlaceDetailViewModel.kt`, `place/today/TodayTabScreen.kt`, `TodayTabViewModel.kt`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Sections | RO | — | :58-117 |
| Calendar toggle / prompt | LOCAL | shown only when the section is READY or STALE | :461-469, :474-497 |
| Save / Clear | API | `PUT` / `DELETE .../calendar/pickup-day`; refresh on success; handles 409 | PickupScheduleEditor.kt:84-91, :93; PlaceDetailViewModel.kt:80-122; TodayTabViewModel.kt:86-117 |
| Today tab pull / retry / "Claim your address" | API / API / NAV | claim → ADD_HOME | TodayTabScreen.kt:69-73, :80, :110-131 |

**Web.** Files: `WEB/components/place/detail/TodayDetail.tsx`, `AddressCalendarCard.tsx`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Briefing opt-in | API | `GET` / `PUT /api/hub/preferences` | TodayDetail.tsx:426-529 |
| "Allergen & pollen", "Power outages" | NOOP | Coming-soon rows, display only (ComingSoonRow, `WEB/components/archetypes/place/detail.tsx:109`) | TodayDetail.tsx:605-609 |
| Calendar controls | LOCAL | — | AddressCalendarCard.tsx:171-224 |
| Save / Clear | API | `PUT` / `DELETE .../calendar/pickup-day`; toast after success | :132-143 |

### 1.5 Your home (property section)

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Facts / value / assessment / systems | RO | — | `IOS/Features/Place/Detail/PlaceHomeDetailContent.swift` |
| iOS | Equity calculator | LOCAL | Not saved. The "Interest rate (%)" input is never used in the calculation | :223-305 (:231-235, :261) |
| Android | Equity calculator | LOCAL | The rate input is never used | `AND/ui/screens/place/detail/PlaceHomeDetailContent.kt:236-294` |
| Web | Property details link | NAV | `/app/homes/:id/property-details` | `WEB/components/place/detail/YourHomeDetail.tsx:146` |
| Web | Equity calculator | LOCAL | localStorage `place:equity:<homeId>` | :163 |
| Web | "It was replaced" | API | `PUT /api/homes/:id/systems/:key` | :297, :325 |
| Web | Locked "Claim home" | NAV | `/app/homes/:id/dashboard` | :398 |

### 1.6 Risk section, emergency checklist and fridge card

**iOS.** Files: `IOS/Features/Place/Detail/PlaceRiskDetailContent.swift`, `PlaceFridgeCardSection.swift`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Hazard cards | RO | — | PlaceRiskDetailContent.swift |
| Emergency checklist | LOCAL | `@State`, not saved | :253-314 |
| Fridge card visibility | — | T4 only; otherwise a locked card opens verify | :61-73 |
| Fridge load | API | `GET /api/homes/:id/fridge-cards`, seeded from `GET /api/homes/:id/emergencies` | PlaceFridgeCardSection.swift:50-62 |
| Add / remove contact | LOCAL | draft only | :250, :280-290 |
| Issue | API | `POST /api/homes/:id/fridge-cards`; copies the link and shows a toast after success | :223-232 → :97-133 |
| Copy link | LOCAL | pasteboard | :342-357 → :135-138 |
| Revoke | API | `POST /api/homes/:id/fridge-cards/:cardId/revoke`; no confirmation dialog | :342-357 → :140-160 |

**Android.** Files: `AND/ui/screens/place/detail/PlaceRiskBlockDetailContent.kt`, `PlaceFridgeCardContent.kt`, `PlaceDetailViewModel.kt`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Checklist | LOCAL | `remember`, not saved | :353, :388 |
| Fridge visibility | — | T4 gate | :98-112 |
| Issue | API | toast and clipboard after success | PlaceFridgeCardContent.kt:133-143; VM:343-403 |
| Add / remove contact | LOCAL | — | :177, :228 |
| Copy link | LOCAL | clipboard, no toast | :279 (:70-75) |
| Revoke | API | shows errors only | :286 |

**Web.** Files: `WEB/components/place/detail/RiskDetail.tsx`, `FridgeCardLeaf.tsx`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Emergency plan | LOCAL | localStorage | RiskDetail.tsx:299 |
| Fridge card open / locked | NAV | locked → `/app/homes/:id/verify-postcard` | :503, :521 |
| List / issue / revoke | API | `/api/homes/:id/fridge-cards[...]` | FridgeCardLeaf.tsx |
| Copy link / open card_url | LOCAL / NAV | — | FridgeCardLeaf.tsx |

**Web public fridge-card page.** Files: `WEB/app/fridge-card/[code]/page.tsx` → `WEB/components/place/fridge-card/FridgeCardView.tsx`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Load | API | `GET /api/public/fridge-cards/:code` | — |
| Print | LOCAL | `window.print()` | FridgeCardView.tsx:117-123 |
| "What is Pantopus?" | NAV | `/start` | :161 |

### 1.7 Block section

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Density CTA | NAV | verify sheet | `IOS/Features/Place/Detail/PlaceBlockDetailContent.swift:32-37` |
| iOS | Founders load / retry | API | `GET /api/homes/:id/block-founders` | PlaceBlockFoundersSection.swift:157 |
| iOS | Send invite | API | `POST /api/homes/:id/block-founders/invites` | PlaceBlockInviteForm.swift:123-133 → PlaceBlockFoundersSection.swift:89-118 |
| iOS | "Recent permits" | RO | static "Not available" | PlaceBlockDetailContent.swift:72-89 |
| Android | Density CTA | NAV | verify | `AND/ui/screens/place/detail/PlaceRiskBlockDetailContent.kt:438` |
| Android | Founders load / invite | API | same endpoints; "Postcard on its way" toast after success | PlaceDetailViewModel.kt:611-619, :627-659 |
| Android | Permits | RO | placeholder | PlaceRiskBlockDetailContent.kt:476-490 |
| Web | Send invite | API | `POST /api/homes/:id/block-founders/invites` | `WEB/components/place/detail/BlockDetail.tsx:92-139` |
| Web | Locked | NAV | verify-postcard | :289 |
| Web | Permits | RO | static | :306-312 |

### 1.8 Money section (bill benchmark, rent, rate watch)

**iOS.** Files: `IOS/Features/Place/Detail/PlaceMoneyDetailContent.swift`, `PlaceRateWatchSection.swift`, `PlaceRealRentSection.swift`, `PlaceRealRentContribution.swift`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Bill benchmark / incentives / rent band / exemption / property tax | RO | — | :29-37 |
| Real rent | API | `GET` / `PUT` / `DELETE /api/homes/:id/rent-report`. Add/Save, Update, Remove, Cancel (LOCAL), retry | :74-84; Contribution.swift:69-80, :82-89, :138-147, :148-157, :181-185; Section.swift:467-475 |
| Rate watch (T4, otherwise locked) | API | `GET` / `PUT` / `DELETE /api/homes/:id/record-watch`. Start :155-161, Remove :212-217 (a failure shows an error and reloads), retry :117 | :96-108 |
| "Deed & lien alerts" | NOOP | Coming soon | :110-114 |

**Android.** Files: `AND/ui/screens/place/detail/PlaceMoneyCivicDetailContent.kt`, `PlaceDetailViewModel.kt`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Bill benchmark | RO | — | :75-78, :426 |
| Rate watch | API | load :428-437, set :443-463, **remove ignores the server result** :465-470 | :120-134 |
| Real rent | API | set :538-564, remove :573-588 | — |
| "Deed & lien alerts" | NOOP | Coming soon | :136 |

**Web.** File: `WEB/components/place/detail/MoneyDetail.tsx`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Bill benchmark | RO | — | :62 |
| Rent band "Show where I fall" | LOCAL | localStorage `place:rent` | :152-218 |
| Real rent save / delete | API | toast after success, server error text kept | :293-402 |
| Rate watch | API | record-watch | :763-919 |
| Coming soon: "Rate watch" (no home), "Deed & lien alerts", "Property tax check" | NOOP | — | :997, :1000, :1003 |

### 1.9 Civic section

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Rep phone / email / website | NAV | external links; the phone link uses a bell icon | `IOS/Features/Place/Detail/PlaceCivicDetailContent.swift:113-135` |
| iOS | Election | suspicious | Any non-ready state, including an error, shows "No upcoming election" | :37-45, :199-211 |
| Android | Rep contact intents | NAV | — | `AND/ui/screens/place/detail/PlaceMoneyCivicDetailContent.kt:655-700` |
| Android | Election | suspicious | same fallback | :585-600 |
| Web | Rep contact links | NAV | — | `WEB/components/place/detail/CivicDetail.tsx:120-122` |
| Web | Election | suspicious | "No election" shown when there is no data | :218, :340-348 |

### 1.10 Identity section (Stream 4 parts only; residency is Stream 3)

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Unlisted | API | `GET /api/homes/:id/unlisted`, `PUT .../unlisted/removals/:broker` | `IOS/Features/Place/Detail/PlaceIdentityDetailContent.swift` |
| iOS | Mailbox check | API | `GET /api/homes/:id/mailbox-check` | same file |
| iOS | "Portable ID" | NOOP | Coming soon | :284-289 |
| Android | Mailbox check / unlisted | API | — | PlaceDetailViewModel.kt:410-418, :673-724 |
| Android | "Portable ID" | NOOP | Coming soon | `AND/ui/screens/place/detail/PlaceIdentityDetailContent.kt:109-110` |
| Web | Mailbox check | API | No Portable ID row on web | `WEB/components/place/detail/IdentityDetail.tsx` |

---

## 2. HOME RECORDS

### 2.1 Home dashboard (health score, seasonal checklist, property value, bill trends, activity)

**iOS.** Files: `IOS/Features/Homes/HomeDashboardView.swift`, `HomeDashboardViewModel.swift`, `HomeDashboardProjection.swift`, `HomeDashboardComponents.swift`, `HomeIntelligenceComponents.swift`. Host: HTR:1515-1598. Entry: Place "Home tools".

| Action | Class | Detail | file:line |
|---|---|---|---|
| Load | API | `GET /api/homes/:id`, `/dashboard`, `/health-score?force`, `/seasonal-checklist`, `/property-value`, `/bill-trends?format=2&currency=` | ViewModel |
| FAB | NAV | Only "Add Task" survives release (filtered by canPerform) | HomeDashboardView.swift:228-237; VM:251-274 |
| Settings / security banner | NAV | Stream 3 | :269-277, :287-292 |
| Health quick wins / top action | NAV | maintenance → issues; bills → nil | HomeIntelligenceComponents.swift:108-136, :170-185, :201-212 |
| Checklist generate / retry | API | seasonal-checklist | :281-289, :305-319 |
| Checklist "From last season" | LOCAL | expand | :348-370 |
| Checklist complete / skip | API | `PATCH /api/homes/:id/seasonal-checklist/:itemId` | :388-394, :413-420; VM:603-636 |
| Checklist "Hire" | HIDDEN: openGigs | — | :424-438 |
| Property value retry | API | — | :522-530 |
| Bill trends currency / retry | API | Card is not flag-gated | HomeDashboardView.swift:374-380; HomeIntelligenceComponents.swift:647-654, :685-701 |
| "Upcoming" | RO | — | HomeDashboardComponents.swift:289 |
| "Recent activity" | RO | Needs security.manage; rows are not tappable; **not filtered for cut (#7) targets** | :307; HomeDashboardProjection.swift:228-253 |
| Emergency / Issues / Property details rows | NAV | — | HomeDashboardComponents.swift:325-327, :329-343, :345-357 |
| Quick tiles | NAV | Tasks, Documents, Members. No Maintenance or Emergency tile | HomeDashboardProjection.swift:62-121 |
| BrandNew / NeedsAttention cards | SAMPLE | Only for literal `sample-home-*` ids, so unreachable | VM:362-365; HomeDashboardSampleData.swift:232-243 |

**Android.** Files: `AND/ui/screens/homes/HomeDashboardScreen.kt`, `HomeDashboardProjection.kt`, `HomeIntelligenceComponents.kt`. Host: RTS:2965-3061.

| Action | Class | Detail | file:line |
|---|---|---|---|
| FAB / tabs / quick actions | NAV | launch filter in VM:316-326 | :196-217, :221-233, :235-296 |
| Health ring | NAV | — | :322-327 |
| Checklist complete / skip / generate | API | — | :329-344 |
| Checklist "Hire" | HIDDEN: openGigs | The host passes no onHireHelp, so it would fall back to a placeholder | HomeIntelligenceComponents.kt:633-634; :335-340 |
| Bill trends | API | not flag-gated | :346-352 |
| Recent activity | RO | filtered for cut targets | :880; HomeDashboardProjection.kt:265 |
| Sample state | SAMPLE | sample ids only | HomeDashboardViewModel.kt:433-436 |

**Web.** File: `WAPP/homes/[id]/dashboard/page.tsx`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Tabs | LOCAL / NAV | `?tab=` | :499-507 |
| FAB | NAV / panel | Add Task, Report Issue, Invite Member (Stream 3) | :598-609 |
| Health ring action | NAV | `?tab=`; the bills route is suppressed | :862-878 |
| Checklist complete / skip / generate | API | — | :879-889 |
| Checklist "Hire" | HIDDEN: openGigs | — | `WEB/components/home/SeasonalChecklist.tsx:126-131` |
| Bill trends currency / benchmark opt-in | API | `PATCH /api/homes/:id/settings`. "Add a bill" is HIDDEN by householdExtras; a code comment says the card stays on purpose | :895-900 (:897) |
| Home activity / Load more | API | `GET /api/homes/:id/timeline` | :902-905 |
| Cards: issues / documents / emergency | NAV | — | :791-801, :802-809, :819-826 |

### 2.2 Property details

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Load | API | `GET /api/homes/:id/property-details` | `IOS/Features/Homes/PropertyDetails/PropertyDetailsViewModel.swift:61-63` |
| iOS | Correction bar | NAV | correction screen (the mismatch banner is never raised) | PropertyDetailsView.swift:384-389 |
| iOS | Correction "Send" | NOOP | disabled, `onCommit: {}`, `isSubmissionAvailable = false` | `IOS/Features/Homes/PropertyCorrection/PropertyCorrectionView.swift:30-39`; PropertyCorrectionViewModel.swift:18 |
| Android | Correction "Send" | NOOP | disabled, `onCommit = {}` | `AND/ui/screens/homes/property_correction/PropertyCorrectionScreen.kt:73-80`; host RTS:6091-6103 |
| Web | Page | RO + retry | No correction flow. Entered from the sidebar (`WEB/components/AppShell.tsx:745-800`) and YourHomeDetail.tsx:146 | `WAPP/homes/[id]/property-details/page.tsx` |

### 2.3 Issues (report, edit, status, dismiss)

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Load | API | `GET /api/homes/:id/issues`, `GET /api/homes/:id/me` | `IOS/Features/Homes/Issues/HomeIssuesListViewModel.swift:162-177` |
| iOS | Report (FAB) | API | `POST /api/homes/:id/issues` | :84-94, :183-213 |
| iOS | Row tap | NOOP | `onTap: {}` | :320 |
| iOS | Schedule / Mark complete / Dismiss | API | `PUT .../issues/:id` (dismiss sets canceled, behind a confirm alert) | :327-376, :216-252; HomeIssuesListView.swift:43-60 |
| iOS | Edit | — | not available | — |
| Android | FAB / footer | API | same endpoints | `AND/ui/screens/homes/issues/HomeIssuesListViewModel.kt:164-175, :339-383` |
| Android | Row tap | NOOP | No onTap, so the default `{}` applies while the row still looks clickable | :320-336; `shared/list_of_rows/RowModel.kt:456`; ListOfRowsScreen.kt:1165 |
| Web | Create / edit (title, description, severity, cost, status) | API | `POST` / `PUT /api/homes/:id/issues`; errors shown inline | `WEB/components/home/IssueSlidePanel.tsx:90-135`; dashboard page.tsx:355-368 |
| Web | Orphan `/app/homes/[id]/maintenance` | unreachable | Issues page; nothing links to it | `WAPP/homes/[id]/maintenance/page.tsx` |

### 2.4 Maintenance history (log, edit, delete)

**iOS.** Files: `IOS/Features/Homes/Maintenance/*`. Host: HTR:1599-1655. Entry: profile cover Maintenance tile (`YouTabRoot.swift:781-786, 897-901`; `IOS/Features/Me/MeViewModel.swift:446-481`).

| Action | Class | Detail | file:line |
|---|---|---|---|
| Load | API | `GET /api/homes/:id/maintenance` | MaintenanceListViewModel.swift |
| "Home issues" / FAB / empty CTA / row | NAV | — | :105-111, :128-135, :239, :269 |
| Detail Edit / Delete | NAV / API | delete: confirm, then `DELETE /api/homes/:id/maintenance/:taskId` | MaintenanceDetailView.swift:508-543, :162-175 |
| Submit | API | `POST` / `PUT /api/homes/:id/maintenance` | LogMaintenanceFormViewModel.swift:315-384 |
| Photos / receipt / notes / category / performer contact | NOOP | Kept only in memory, never sent | :413-424; MaintenanceDraftStore.swift:1-20 |
| Reminder | API (cut #7 leak) | `POST /api/homes/:id/events` to the household calendar; errors swallowed | :391-411 |

**Android:** host RTS:4229-4295. Same extras and calendar POST in `AND/ui/screens/homes/maintenance/LogMaintenanceFormViewModel.kt:280-380`.

**Web:** there is no maintenance-log client at all (the API package has no `/maintenance` endpoints). The dashboard "Maintenance" card (`WEB/components/home/cards/MaintenanceCard.tsx`) is really about issues:
- "+ Log Maintenance" opens the Issue panel: :154-159
- "Suggested" tab is a static client-side list: :17-36, :181-204
- Providers come from a vendors GET: :114-119

### 2.5 Emergency info

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Load | API | `GET /api/homes/:id/emergencies` | `IOS/Features/Homes/Emergency/EmergencyInfoViewModel.swift` |
| iOS | Share | LOCAL | Share sheet; does nothing (silently) when the list is empty | EmergencyInfoView.swift:34-40 |
| iOS | Print / dial / 911 | LOCAL / NAV | `tel:` links | :41-47, :48-52, :75-95 |
| iOS | Chips / FAB / empty CTA / rows | LOCAL / NAV | — | VM:155-180, :190-197, :308-317, :372-406 |
| iOS | Add / edit / delete | API | `POST` / `PUT` / `DELETE /api/homes/:id/emergencies[/:id]`; occupants from `GET /api/homes/:id/occupants` | Add form; Detail views |
| iOS | Pinned section | — | exists, but there is no way to pin | — |
| Android | Share / Print | LOCAL | share text / PDF; share returns null when empty | `AND/ui/screens/homes/emergency/EmergencyInfoScreen.kt:76-85`; VM:181 |
| Android | Dial / row / add / edit | NAV | — | :91-100; RTS:3929-3979 |
| Web | Card link | NAV | `/app/homes/:id/emergency` | `WEB/components/home/cards/EmergencyCard.tsx:91` |
| Web | Create | API | Disabled when the category is "shutoff" | `WAPP/homes/[id]/emergency/page.tsx:92-100, :167` |
| Web | Delete / tel links | API / NAV | — | :105-117, :145, :209 |

### 2.6 Documents (list, detail, replace, delete)

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Search / chips | LOCAL | client-side filter | `IOS/Features/Homes/Documents/DocumentsViewModel.swift:73-100` |
| iOS | FAB / empty CTA | NAV | upload form | :110-117, :197-205 |
| iOS | Row kebab / export | NOOP | Only `.view` is wired; `onExport` is never called | :291-296 |
| iOS | Open / Share | API + LOCAL | `GET /api/homes/:id/documents/:docId/content`, then share sheet | DocumentDetailView.swift:319-320 |
| iOS | Replace / Delete | API | `POST .../documents/:id/replace` (multipart) / `DELETE` | :321, :188-233, :362-371, :244-270 |
| iOS | Upload | API | `POST /api/homes/:id/documents/upload` | UploadDocumentFormViewModel.swift:396-471 |
| iOS | Link picker | API (cut #7 leak) | Fetches bills and pets with no flag check | :336-391 |
| Android | Export | NOOP | `onExport` is stored but never called (the host would open a placeholder) | `AND/ui/screens/homes/documents/DocumentsViewModel.kt:122-135`; RTS:4037 |
| Android | Open / Share / Replace / Delete | API | same endpoints; confirm dialogs | DocumentDetailScreen.kt:829-860, :208-235; DocumentDetailViewModel.kt:176, :215 |
| Android | Link picker | — | bills and pets are gated | UploadDocumentFormViewModel.kt:308-312 |
| Web | DocsCard "Create share link" | API | `POST /api/homes/:id/scoped-grants` → `/shared/:token` (Stream 3 overlap) | `WEB/components/home/cards/DocsCard.tsx:94-107` |
| Web | No upload / replace / detail anywhere | — | Orphan `/app/homes/[id]/docs` page has download (:121) and delete (:55-62) | `WAPP/homes/[id]/docs/page.tsx` |

---

## 3. MAIL

### 3.1 Mailbox root (segments, drawers, tabs, routing banner, menu)

**iOS.** Files: `IOS/Features/Mailbox/MailboxRoot/MailboxRootView.swift`, `MailboxRootViewModel.swift`, `MailboxRootContent.swift`. Host: HTR:771-796; Mail tab segments in `RootTabView.swift:390-446`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Load / refresh | API | `GET /api/mailbox/v2/drawers`, `/v2/pending`, `/v2/drawer/:d?tab=&limit=25&offset=` | VM:414-439 |
| Search | NAV | client-side filter over the first 100 of `GET /api/mailbox?archived=false&limit=100` | VM:124-128; `Search/MailboxSearchViewModel.swift:65-104` |
| Compose FAB | HIDDEN: mailExtras | — | VM:140-150 |
| Toolbar gift icon | NAV | Stamps | View:37-45 |
| Menu: Find a mailbox / Mail tasks / Home records / Stamps / Vacation hold | NAV | — | :51, :63, :85, :91, :97 |
| Menu: "Scan an item" | NAV (cut #7 leak) | Unboxing with no mailId → "Nothing to unbox yet" | :57; `Unboxing/UnboxingView.swift:155-162` |
| Menu: Mail party / Community mail | HIDDEN: mailExtras | — | :66-78 |
| Mail day CTA | NAV | `.mailDay(.populated)` | Content:60-89 |
| Routing banner | NAV | routing queue | Content:35-58 |
| Drawer chips Me / Home / Biz / **Earn** | LOCAL + API | Earn is visible (cut #8 leak) | VM:17-72; Content:91-115 |
| Tabs Incoming / Counter / Vault | LOCAL + API | — | VM:75-91 |
| Earn empty CTA "Open Earn dashboard" | NAV (cut #8 leak) | `.earn` | VM:642-648 |

**Android.** Files: `AND/ui/screens/mailbox/mailbox_root/MailboxRootScreen.kt`, `MailboxRootContent.kt`. Hosts: RTS:2671-2691, 6222-6242.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Search / gift → Stamps | NAV | — | :92-97, :135-142 |
| FAB | HIDDEN: mailExtras | — | :109-114 |
| Menu | NAV | "Scan an item" → UNBOXING (leak); Party and Community HIDDEN | :186-257 (:198-205, :215-232) |
| Messages row | NAV | — | :260-285 |
| Mail Day CTA / routing banner | NAV | — | Content:66, :91, :117-126 |
| Drawers include Earn / Earn CTA | NAV (leak) | EARN route is not gated | MailboxRootViewModel.kt:137, :466; RTS:6391-6403 |

**Web.** Files: `WAPP/mailbox/layout.tsx`, `page.tsx`, `_components/useMailboxData.ts`, `[drawer]/layout.tsx`, `WEB/components/mailbox/MailboxNav.tsx`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Mail tab | NAV | `/app/mailbox?scope=personal` (V1 list) | — |
| Left nav | — | Hidden below the md breakpoint | layout.tsx:126-128 |
| Nav items | NAV | Messages `/app/chat`; server drawers (incl. **Earn**); Counter, Vault, Recently deleted; Map, Tasks, Records; **Earn Wallet** (→ `/app/settings/payments`); Mail Day; Stamps & Themes; Memory; Travel Mode | MailboxNav.tsx:37-57, :117-129 |
| Community nav item | HIDDEN: mailExtras | — | :45 |
| Mail Day summary banner | API + LOCAL | `GET /api/mailbox/v2/p3/mailday/summary`; dismiss stored per day in localStorage | layout.tsx:87-111, :186-221 |
| Travel banner | NAV | `/app/mailbox/travel` | :113-181 |
| V1: search / scope chips / tabs / type chips | LOCAL | — | page.tsx:45, :79-147 |
| V1: Compose | HIDDEN: mailExtras | — | :47-52 |
| V1: "Seed Inbox" | DEV-ONLY | `POST /api/mailbox/seed/test-data` | :53-61; useMailboxData.ts:27 |
| V1: "Ad Earnings" badge | RO (cut #8 leak) | — | :62-67 |
| V1: open / star / archive | API | `GET /api/mailbox/:id`, `PATCH .../view`, `PATCH .../star`, `PATCH .../archive` | useMailboxData.ts:177-233 |
| V1: delete | API | confirm, `DELETE /api/mailbox/:id`, undo toast → restore | :235-256 |
| Drawer list | API | `GET /api/mailbox/v2/drawer/:d?tab=incoming`; filter and search are LOCAL | [drawer]/layout.tsx:207-243 |
| Bundle "File all" | NOOP | `onFileAll={() => {/* ... Phase 2 */}}` | [drawer]/layout.tsx:415; BundleCard.tsx:80-84 |
| Earn OfferCard | LOCAL (leak) | Fake 1.5 s "opening" state, then opens the item | :422-444 |
| Routing banner | absent | — | — |

### 3.2 Mail detail (generic layout; booklet, coupon and records variants)

**iOS.** Files: `IOS/Features/Mailbox/MailDetail/MailDetailView.swift`, `Variants/GenericMailDetailLayout.swift`, `MailDetailViewModel.swift`, `MailCategoryActions.swift`. Host: HTR:2130-2171.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Open | API | `GET /api/mailbox/:id`, `PATCH /api/mailbox/:id/view` | VM:129-158 |
| Variant dispatch | — | Certified / community / memory / party fall back to generic (mailExtras off); gig to generic (openGigs off); booklet / coupon / package / records fall back to generic (decoders fail on real data) | View:174-204 |
| Save to vault / overflow "Move" | API | `GET /api/mailbox/v2/p2/vault/folders?drawer=personal`, picker, `POST /api/mailbox/v2/p2/vault/file`. With no folders: "Add a folder in your Vault first." (native has no way to create a folder) | Generic:114-129, :151-153; VM:667-707 |
| Overflow "Translate" | HIDDEN | The host passes no onTranslate | Generic:133-139 |
| Overflow / tile "Create task" | NAV | `.mailTaskList(mailId:)` | Generic:140-146; HTR:2155-2160 |
| Archive | API | `PATCH /api/mailbox/:id/archive`, then closes | VM:562-575 |
| Category tiles | API | `POST /api/mailbox/v2/item/:id/action`: file, shred (with confirm), create_task → NAV | Generic:554; VM:532-556; Actions:145-153 |
| Promo "Save Offer" | API (suspicious) | Sends `file`, then toasts "Offer saved" | MailCategoryActions.swift:82, :117, :151 |
| Acknowledge / "Tap to undo" | API (suspicious) | Optimistic `PATCH /api/mailbox/:id/ack`. "Tap to undo" acknowledges again; there is no undo | Generic:574-606 (:585); VM:178-203 |
| Attachment chips | NOOP | No onTap passed; default `{}` | Generic:166-176; `IOS/Features/Shared/MailItemDetail/MailItemDetailState.swift:204`; MailItemDetailShell.swift:461 |
| Timeline | SAMPLE | Fabricated "Pantopus drafted plain-language TL;DR" event, while aiSummary is always nil | Generic:87-111; MailDetailProjection.swift:71 |
| Sender card | NAV | public profile | Generic:366-370 |
| Removed banner "Restore" | API | `POST /api/mailbox/:id/restore` | View:81-85, :151-164; VM:578-591 |
| Booklet "Download" (unreachable) | API (premature) | `POST /api/mailbox/v2/p2/booklet/:id/download`, then "Download started" with no actual download | VM:717-729 |
| Coupon "Redeem" (unreachable) | LOCAL (premature) | "Redeemed" toast; no backend call | VM:251-264 |
| Records "file to vault" (unreachable) | API | — | VM:415-465 |

**Android.** Files: `AND/ui/screens/mailbox/mail_detail/MailDetailScreen.kt`, `MailDetailViewModel.kt`, `variants/GenericMailDetailLayout.kt`. Host: RTS:4485-4525.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Dispatch | — | gated with takeIf; variants unreachable (as on iOS) | Screen:331-473 |
| Overflow | API / NAV | Create task → MAIL_TASK_LIST; no Translate | Generic:120-132; RTS:4509-4513 |
| Vault picker / restore | API | — | Screen:194-196, :138-139, :524-540 |
| "Save Offer" | API (suspicious) | sends `file`, "Offer saved" | `.../mail_detail/MailCategoryActions.kt:74, :101` |
| Acknowledge / "Tap to undo" | API (suspicious) | acknowledges again | Generic:784; VM:349-372 |
| Attachments | NOOP | default `{}` | Generic:215; `shared/mail_item_detail/MailItemDetailState.kt:138`; MailItemDetailShell.kt:583 |
| Timeline | SAMPLE | fabricated TL;DR event | Generic:205 |
| Booklet download / coupon redeem (unreachable) | premature | — | VM:645-661, :707-716 |

**Web.** Files: `WAPP/mailbox/[drawer]/[item_id]/page.tsx`, `WEB/lib/mailbox-api.ts`, `WEB/components/mailbox/MailItemDetail.tsx`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Open | API | `GET /api/mailbox/v2/item/:id` | mailbox-api.ts:153-209 |
| File to Vault | API | folders GET, `POST .../vault/file`. "Create one in Vault" → `/app/mailbox/vault`. Success message only after success | :314-375, :350-355, :490-496 |
| Restore | API | `POST /api/mailbox/:id/restore` | :154-160, :381-402 |
| Party / certified | HIDDEN: mailExtras | — | :406-432 |
| PackageUnboxing | HIDDEN: householdExtras | — | :455-485 |
| Booklet viewer (when `mail_object_type === 'booklet'`) | — | Save to vault opens the picker | :436-447 |
| Booklet "Download" | NOOP | `onDownload={() => {}}` | :442 |
| Action handler no-op cases | NOOP (unreachable) | `inside.actions: []` means no action buttons render | :205-217; mailbox-api.ts:190 |
| Attachments | NAV | `href={a.url}` | MailItemDetail.tsx |
| Coupon | unreachable | orphan `/app/mailbox/coupon` page says "not available" | `WAPP/mailbox/coupon/page.tsx` |
| Records variant | — | none on web | — |

### 3.3 Vault and folders

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Entry | effectively unreachable | Only from Unboxing "View in Home drawer", which needs a mailId | `IOS/Features/Mailbox/Unboxing/UnboxingView.swift:489-502`; HTR:3260, 2287-2311 |
| iOS | Tabs / FAB / empty CTA | LOCAL / NAV | FAB → mailbox | `IOS/Features/Mailbox/Vault/VaultListViewModel.swift:43-67, :97-106` |
| iOS | Search / fetch | API | `GET .../p2/vault/search`, folders, folder items | :117-128, :234-308 |
| iOS | Create folder | — | no UI | — |
| Android | Entry | effectively unreachable | from unboxing only | RTS:4707-4730, 6364 |
| Web | Search / folders | API | — | `WAPP/mailbox/vault/page.tsx:145-152, :219` |
| Web | Create folder | API (silent failure) | `POST /api/mailbox/v2/p2/vault/folder`; no error UI | :94-107 |
| Web | Folder: item open | API | `GET /api/mailbox/v2/item/:id` (this also marks it opened) | `vault/[folder_id]/page.tsx:61-66`; `WEB/lib/mailbox-queries.ts:178-186` |
| Web | Folder: rules | LOCAL | read-only expand | :113-140 |
| Web | Folder: handleAction | NOOP (unreachable) | "Placeholder" | :78-80 |

### 3.4 Routing queue and disambiguate

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Queue / submit | API | `GET /api/mailbox/v2/pending`, `POST /api/mailbox/v2/resolve` | `IOS/Features/Mailbox/RoutingQueue/MailRoutingQueueViewModel.swift:197-221` |
| iOS | Disambiguate form | DEV-ONLY | DEBUG entry only | `YouTabRoot.swift:513-626` |
| Android | Queue / submit | API | — | `AND/ui/screens/mailbox/routing_queue/MailRoutingQueueViewModel.kt:189`; RTS:2684, 4704-4706 |
| Android | Disambiguate | DEV-ONLY | — | RTS:4698-4703; `you/YouScreen.kt:267` |
| Web | Routing banner | absent | — | — |
| Web | Disambiguate page | unreachable | orphan | `WAPP/mailbox/disambiguate/page.tsx` |

### 3.5 My Mail Day (triage and settings)

**iOS.** Files: `IOS/Features/Mailbox/MailDay/MailDayView.swift`, `MailDayViewModel.swift`, `MailDaySettingsContent.swift`. Hosts: HTR:3189-3192 and YouTabRoot.swift:1148-1151, both with no handlers.
- Entries: mailbox CTA, JustMovedCard mail step, deep link `mailbox/mailday` (DeepLinkRouter.swift:839).

| Action | Class | Detail | file:line |
|---|---|---|---|
| Load | API → SAMPLE | `GET /api/mailbox/v2/mailday/today`. **Any error falls back to the `MailDaySampleData.populated` fixture** | VM:88-112 |
| "Scan more mail" | NOOP | `requestScan` → `onScanRequested` (default `{}`) | View:145-147; VM:51-54, :242-244 |
| "Scan today's stack" | NOOP | — | View:248-253 |
| "See full history" | NOOP | default `{}` | View:37, :257 |
| Setup nudges | NOOP | default `{ _ in }` | View:38, :261 |
| Accept suggestion | API (optimistic) | `POST .../mailday/items/:id/route`; silent rollback on failure | VM:285-321 |
| Keep / Junk / Undo / Undo all | API | `.../route`, `/junk`, `/undo` | VM:324-359; View:192-197, :211-228 |
| Route / Other dialog | LOCAL → API | — | View:159-185 |
| Finish day | API | `POST /api/mailbox/v2/mailday/finish`; failure is silent | VM:364-382 |
| Settings entry | NAV | — | View:122-133, :139-144 |
| Settings toggles / sound | API (optimistic) | `GET` / `PATCH /api/mailbox/v2/p3/mailday/settings`; rollback toast | VM:128-193; View:356-417 |
| Settings toggles for Earn offers, Neighborhood notices, Packages out for delivery, Certified mail | leak | not gated | MailDaySettingsContent.swift:78-84 |
| Delivery time | RO | not editable | View:329-354 |

**Android.** Files: `AND/ui/screens/mailbox/mail_day/MailDayScreen.kt`, `MailDayViewModel.kt`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Load | API | Errors show an error state (no sample fallback) | VM:58-67 |
| Scan more / Scan today's stack / See full history / nudges | NOOP | Host passes `{ /* Out of scope ... */ }` | RTS:6280-6282; Screen:283, :334, :339, :343 |
| Accept suggestion | API | silent rollback | VM:104-136 |
| Finish day | API | failure is silent | VM:188-197 |
| Settings | absent | Repository methods exist but are unused | `AND/data/mailbox/MailboxKeepsakeRepository.kt:56-59` |

**Web.** No triage UI. Settings page file: `WAPP/mailbox/settings/mail-day/page.tsx`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Summary arrivals / needs-attention links | NAV | — | :233-275 |
| "Earn opportunity" count | RO (leak) | — | :281-285 |
| Memory link / Open Mailbox | NAV | — | :293-307, :311-316 |
| Dismiss | LOCAL | Component state only; shows "Check back tomorrow!" but resets on reload | :194-201, :317-323 |
| Toggles | LOCAL → Save | Community / packages / certified are gated; the Earn count toggle is not (:395) | :343-429 |
| Notifications | LOCAL | browser permission prompt | :466 |
| Save | API | `PATCH /api/mailbox/v2/p3/mailday/settings`; toast after success, error toast on failure | :156-165, :479 |

### 3.6 Stamps gallery and Themes

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Load | API | `GET /api/mailbox/v2/p3/stamps`, `/themes` | `IOS/Features/Mailbox/Stamps/StampsViewModel.swift:88-92` |
| iOS | Stamps / Themes toggle | LOCAL | Postage wallet and buy are HIDDEN by mailExtras | StampsView.swift:136-147, :54-79 |
| iOS | Apply theme | API (optimistic, rollback) | `POST /api/mailbox/v2/p3/themes/apply` | VM:243-262 |
| iOS | Header "Gift a stamp" / "More actions" | NOOP | `Button(action: {})` | StampsView.swift:195-196, :209 |
| Android | Toggle / apply / gate | LOCAL / API / HIDDEN | — | `AND/ui/screens/mailbox/stamps/StampsScreen.kt:127, :134, :137` |
| Android | Gift / More | NOOP | `.clickable {}` | :287-288, :314 |
| Web | Tabs / filter / stamp modal | LOCAL | — | `WAPP/mailbox/settings/themes/page.tsx:288-336, :346` |
| Web | Apply theme | API (silent failure) | `POST .../themes/apply`; no onError and no global handler | :257-268; `WEB/lib/mailbox-queries.ts:823-834` |
| Web | Orphan `/app/mailbox/stamps` | unreachable | On a load error it shows "No stamps earned yet" | `WAPP/mailbox/stamps/page.tsx:34, :63-75` |

### 3.7 Mail tasks list and task detail

**iOS.** Files: `IOS/Features/Mailbox/MailTask/MailTaskListView.swift`, `MailTaskListViewModel.swift`, `MailTaskView.swift`, `MailTaskViewModel.swift`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| List load / refresh | API | `GET /api/mailbox/v2/p3/tasks` | ListVM:91-104; ListView:191 |
| Completed section / row | LOCAL / NAV | — | ListView:195, :300 |
| Checkbox | API (optimistic) | `PATCH /api/mailbox/v2/p3/tasks/:id` | ListVM:241-267 |
| Create (from mail) | API | `POST .../tasks/from-mail`, home from `GET /api/homes/my-homes` | ListView:316-410; ListVM:166-227 |
| "Convert to neighbor gig" | API (cut #4 leak) | `POST .../tasks/:id/to-gig`; not gated | ListView:269-289; ListVM:294-318 |
| "Post as Neighbor Task Instead" | HIDDEN | `PackageGigAvailability.isAvailable = false` | `PackageGig/PackageGigViewModel.swift:27-29` |
| Detail load | API | Picks the task from `GET /p3/tasks` | VM:70-84 |
| Mark done / Reopen | API (premature) | "Marked done" / "Task reopened" toast before the PATCH | VM:110-125 (:114, :123) |
| Dock "Snooze" | NOOP | toast "Snooze options" | View:235; VM:167-169 |
| Dock "Delegate" | NOOP | The "Delegate · Home drawer" button only closes the dialog | View:237, :49 |
| Dock "Calendar" | NOOP (false success) | "Added to calendar" | View:239; VM:194-196 |
| View confirmation / source card | NAV | mail detail | VM:177-180, :199-201 |
| Archive | API + NAV | marks done, then goes back | VM:208-211 |
| Share / More | NOOP | `Button(action: {})` | View:85-86, :98 |
| Snooze options / subtasks / "Add a step" / delegate hint | SAMPLE only | The live projection sets none of them | View:122-176; VM:215-228, :146-164, :189-191 |

**Android.** Files: `AND/ui/screens/mailbox/mail_task/*`. Hosts: RTS:6290-6335.

| Action | Class | Detail | file:line |
|---|---|---|---|
| Mark done / Reopen | API (premature) | — | MailTaskViewModel.kt:151-166 (:155, :164) |
| Snooze dock / Calendar / Add a step | NOOP | — | :209-211, :240-242, :235-237 |
| Delegate confirm | NOOP | only dismisses | MailTaskScreen.kt:438-444 |
| Share / More | NOOP | display-only icons | :179-201 |
| "Convert to neighbor gig" | API (leak) | — | MailTaskListScreen.kt:463 |
| "Post as Neighbor Task" | HIDDEN | — | :596-617 |

**Web.** File: `WAPP/mailbox/tasks/page.tsx`.

| Action | Class | Detail | file:line |
|---|---|---|---|
| List / complete / update | API | `GET` / `PATCH /api/mailbox/v2/p3/tasks[/:id]` | — |
| Gig escalate | HIDDEN: openGigs | — | — |
| "New from mail" | API (always fails, silently) | Panel opens with no mailId and posts `mailId: ''`. The backend requires a UUID (`BE/routes/mailboxV2Phase3.js:71-73`) | :452-458, :554-558, :68-80 |

### 3.8 Vacation hold and Travel Mode

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Load | API | `GET /api/mailbox/v2/p3/vacation/status` | `IOS/Features/Mailbox/Vacation/VacationHoldViewModel.swift:114-137` |
| iOS | Date pickers / edit | LOCAL | — | VacationHoldView.swift:85-100; VM:195-202 |
| iOS | Save | API | `POST .../vacation/start` with a fixed holdAction / packageAction; home from my-homes | VM:277-318 |
| iOS | Cancel | API | confirm, then `POST .../vacation/cancel` | View:101-113; VM:320-338 |
| iOS | Scope / forwarding / emergency cards | — | Never rendered; only dates are shown | View:186-195 vs :226-293 |
| Android | Same flow, dates only | API | — | `AND/ui/screens/mailbox/vacation/VacationHoldViewModel.kt:125-357`; VacationHoldScreen.kt:331-380 |
| Web | Travel create | API | `POST .../vacation/start` (fixed holdAction); error shown | `WAPP/mailbox/travel/page.tsx:187-208, :293` |
| Web | Travel cancel | API | confirm; error shown | :95-102 |
| Web | Orphan `/app/mailbox/vacation` | unreachable | duplicate page | — |

### 3.9 Find a mailbox (map)

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Load | API + SAMPLE | `GET /api/mailbox/v2/p3/map/pins` returns home map pins, not mailbox locations. Positions are synthetic, `isOpen` is always true, and delivery / community pins are not filtered out | `IOS/Features/Mailbox/MailboxMap/MailboxMapViewModel.swift:8-21, :82-108, :155-181` |
| iOS | "Directions to nearest mailbox spot" / Directions | NAV (suspicious) | Uses the first pin; the address passed is the pin body | MailboxMapView.swift:85-90, :328-341, :711-718 |
| iOS | Chips / select / back / retry | LOCAL / API | — | :240-242, :132, :517, :470 |
| Android | Load | API | Filters out community / delivery pins | `AND/ui/screens/mailbox/mailbox_map/MailboxMapViewModel.kt:99-129, :184-189`; RTS:6268-6270 |
| Web | Load | API | Leaflet home pins `?homeId`; filters community / delivery; no error state | `WAPP/mailbox/map/page.tsx:45-46, :90` |
| Web | "View full notice" | NAV | — | :321-327 |
| Web | Add to Calendar | HIDDEN | — | :329-345 |

### 3.10 Home records (mail-linked assets)

| Client | Action | Class | Detail | file:line |
|---|---|---|---|---|
| iOS | Assets / asset mail / auto-detect / suggestions / link / unlink | API | `GET .../p3/records/assets?homeId`, `/records/asset/:id/mail`, `POST .../records/auto-detect`, `POST .../records/link`, `DELETE .../records/unlink/:linkId` | `IOS/Features/Mailbox/Records/HomeRecordsViewModel.swift:209-447` |
| Android | Same | API | — | RTS:6260-6267 |
| Web | Add asset | API (silent failure) | `POST /api/homes/:homeId/assets`; no error UI | `WAPP/mailbox/records/page.tsx:187-199` |
| Web | AI suggestion | NOOP | the value is never set | :302-306 |
| Web | Asset detail: link mail / add photo | API | `POST .../records/asset/:id/photos` | `records/[asset_id]/page.tsx` |
| Web | Asset detail: gig | HIDDEN | — | same file |

### 3.11 Web-only pages: Memory, Counter, Recently deleted

| Page | Action | Class | Detail | file:line |
|---|---|---|---|---|
| Memory | Load | API | `GET /api/mailbox/v2/p3/memory/on-this-day`, `/memory/year/:y` (5 years) | `WAPP/mailbox/memory/page.tsx` |
| Memory | "Share card" | LOCAL (premature) | `navigator.share` or clipboard with generic text; shows "Shared!" even if both fail. It never calls the `POST /memory/year/:y/share` endpoint | :34-56, :67-73, :204 |
| Memory | "Save to Vault" | API (always fails) | Synthetic ids `year-in-mail-<y>` / `mail-history`; the backend requires UUIDs (`BE/routes/mailboxV2Phase2.js:71-74`); the button silently resets | :75-88 |
| Memory | Dismiss memory | API (optimistic) | `POST /api/mailbox/v2/p3/memory/dismiss` | :243-250 |
| Memory | View memory | NAV | `window.location.href` | :252-254 |
| Counter | List / item | API / NAV | `GET .../v2/drawer/:d?tab=counter` across drawers | `WAPP/mailbox/counter/page.tsx` |
| Recently deleted | List / Restore | API | `GET /api/mailbox/deleted`, `POST /api/mailbox/:id/restore`; toast reflects the result | `WAPP/mailbox/deleted/page.tsx:106` |

Native has no recently-deleted screen. The closest equivalent is the "Removed" banner with Restore in mail detail (section 3.2).

---

## All NOOP / SAMPLE / premature-success items

### NOOP: does nothing, or only shows a toast

**iOS**

**My Mail Day** (`MailDayView.swift`; handlers default to no-ops, `MailDayViewModel.swift:51-54, :242-244`; hosts at `HTR:3189-3192` and `YouTabRoot.swift:1148-1151` pass none):
- "Scan more mail": `MailDayView.swift:145-147`
- "Scan today's stack": `:248-253`
- "See full history": `:257` (default at `:37`)
- Setup nudges: `:261` (default at `:38`)

**Mail task** (`MailTaskView.swift`, `MailTaskViewModel.swift`):
- Dock "Snooze": View `:235`, VM `:167-169`
- "Delegate · Home drawer": View `:49`
- Dock "Calendar": VM `:194-196`
- Share / More: View `:85-86`, `:98`
- "Add a step": VM `:189-191`

**Elsewhere:**
- Stamps gift / more: `StampsView.swift:195-196, :209`
- Home issue row tap: `HomeIssuesListViewModel.swift:320`
- Property correction "Send": `PropertyCorrectionView.swift:30-39`; `PropertyCorrectionViewModel.swift:18`
- Mail attachment chips: `GenericMailDetailLayout.swift:166-176`; `MailItemDetailState.swift:204`
- Documents export / kebab: `DocumentsViewModel.swift:291-296`
- Emergency Share when the list is empty: `EmergencyInfoView.swift:34-40`
- Maintenance extras are never sent: `LogMaintenanceFormViewModel.swift:413-424`; `MaintenanceDraftStore.swift:1-20`
- "Scan an item" opens an empty Unboxing screen: `MailboxRootView.swift:57`; `UnboxingView.swift:155-162`
- Coming-soon rows:
  - Deed & lien alerts: `PlaceMoneyDetailContent.swift:110-114`
  - Portable ID: `PlaceIdentityDetailContent.swift:284-289`
- Recent permits: `PlaceBlockDetailContent.swift:72-89`
- Equity calculator "Interest rate" field unused: `PlaceHomeDetailContent.swift:231-235, :261`
- Post-save `vm.load()`: `PlaceTodayDetailContent.swift:56`; `PlaceDetailViewModel.swift:53-55`
- JustMovedCard "One tap returns it" copy: `JustMovedCard.swift:90-96`

**Android**
- My Mail Day scan / history / nudges: `RTS:6280-6282`; `MailDayScreen.kt:283, :334, :339, :343`
- Mail task:
  - Snooze: `MailTaskViewModel.kt:209-211`
  - Calendar: `:240-242`
  - Add a step: `:235-237`
  - Delegate confirm: `MailTaskScreen.kt:438-444`
  - Share / More: `:179-201`
- Stamps gift / more: `StampsScreen.kt:287-288, :314`
- Issue row tap: `HomeIssuesListViewModel.kt:320-336`; `RowModel.kt:456`; `ListOfRowsScreen.kt:1165`
- Property correction "Send": `PropertyCorrectionScreen.kt:73-80`
- Mail attachments: `GenericMailDetailLayout.kt:215`; `MailItemDetailState.kt:138`
- Documents export: `DocumentsViewModel.kt:122-135`
- Maintenance extras: `LogMaintenanceFormViewModel.kt:280-380`
- "Scan an item": `MailboxRootScreen.kt:198-205`
- Coming-soon rows: `PlaceMoneyCivicDetailContent.kt:136`; `PlaceIdentityDetailContent.kt:109-110`
- Permits: `PlaceRiskBlockDetailContent.kt:476-490`
- Equity rate field: `PlaceHomeDetailContent.kt:236-294`

**Web**
- Bundle "File all": `WAPP/mailbox/[drawer]/layout.tsx:415`; `BundleCard.tsx:80-84`
- Booklet "Download": `WAPP/mailbox/[drawer]/[item_id]/page.tsx:442`
- Action handlers (unreachable): `[item_id]/page.tsx:205-217`; `vault/[folder_id]/page.tsx:78-80`
- Coming-soon rows:
  - `TodayDetail.tsx:605-609`
  - `MoneyDetail.tsx:997, :1000, :1003`
- Permits: `BlockDetail.tsx:306-312`
- Records AI suggestion: `records/page.tsx:302-306`
- Mail-day settings Dismiss is not saved: `settings/mail-day/page.tsx:194-201, :317-323`
- "+ Log Maintenance" creates an issue: `MaintenanceCard.tsx:154-159`

### SAMPLE: fixture or fabricated data
- iOS My Mail Day falls back to a fixture on any fetch error: `MailDayViewModel.swift:88-112`; `MailDaySampleData.swift`
- Fabricated TL;DR timeline event in mail detail:
  - iOS: `GenericMailDetailLayout.swift:87-111`; `MailDetailProjection.swift:71`
  - Android: `GenericMailDetailLayout.kt:205`
- Map pins: synthetic positions, always "open", pin body used as the directions address:
  - iOS: `MailboxMapViewModel.swift:8-21, :155-181`; `MailboxMapView.swift:711-718`
  - Android: `MailboxMapViewModel.kt:99-129`
- Home dashboard sample states (unreachable with real ids):
  - iOS: `HomeDashboardViewModel.swift:362-365`
  - Android: `HomeDashboardViewModel.kt:433-436`
- iOS sample-id ownership branch (Stream 3): `HTR:1526-1533`
- "Simulate verified / failed" buttons (unreachable): iOS `PlaceVerifyFlow.swift:268-272`; Android `PlaceVerifyFlow.kt:305, :312`
- Mail-task sample-only affordances: `MailTaskView.swift:122-176`
- Web Maintenance "Suggested" list: `MaintenanceCard.tsx:17-36`

### Success shown before, or regardless of, the server result
- Mail task "Marked done" / "Task reopened" toasts appear before the PATCH:
  - iOS: `MailTaskViewModel.swift:114, :123`
  - Android: `MailTaskViewModel.kt:155, :164`
- Mail task "Snoozed · …" appears before the call and always means one day, whatever option is picked (sample path only):
  - iOS: `:149-151`
  - Android: `:188-189`
- "Added to calendar" with no calendar call: iOS `:194-196`; Android `:240-242`
- Coupon "Redeemed" with no backend call: iOS `MailDetailViewModel.swift:251-264`; Android `:707-716`
- Booklet "Download started" with no download: iOS `:717-729`; Android `:645-661`
- Acknowledge is optimistic, and "Tap to undo" acknowledges again: iOS `:178-203`; Android `:349-372`
- "Offer saved" actually files the mail: iOS `MailCategoryActions.swift:82, :117`; Android `MailCategoryActions.kt:74`
- My Mail Day accept suggestion fails silently:
  - iOS: `MailDayViewModel.swift:285-321`
  - Android: `MailDayViewModel.kt:104-136`
- My Mail Day "Finish day" fails silently:
  - iOS: `MailDayViewModel.swift:364-382`
  - Android: `MailDayViewModel.kt:188-197`
- Optimistic updates with rollback:
  - iOS task checkbox: `MailTaskListViewModel.swift:241-267`
  - Theme apply: `StampsViewModel.swift:243-262`
  - Mail Day settings: `MailDayViewModel.swift:128-193`
- Android rate-watch Remove ignores the server result (`PlaceDetailViewModel.kt:465-470`):
  ```kotlin
  repo.removeRecordWatch(homeId)
  _rateWatch.value = RateWatchUiState.None
  ```
- Web Memory:
  - "Shared!" regardless of outcome: `memory/page.tsx:67-73, :204`
  - "Save to Vault" always fails: `:75-88`
  - Dismiss is optimistic: `:243-250`
- Web silent failures:
  - Tasks "New from mail": `tasks/page.tsx:68-80`
  - Theme apply: `settings/themes/page.tsx:257-268`
  - Create folder: `vault/page.tsx:94-107`
  - Add asset: `records/page.tsx:187-199`
- Web Earn OfferCard fake "opening": `[drawer]/layout.tsx:422-444`
- Web orphan stamps page shows "No stamps earned yet" on error: `stamps/page.tsx:63-75`
- Civic shows "No upcoming election" when the section errored:
  - iOS: `PlaceCivicDetailContent.swift:37-45`
  - Android: `PlaceMoneyCivicDetailContent.kt:585-600`
  - Web: `CivicDetail.tsx:340-348`

### Cut features still visible on master, and unreachable screens

**Cut features still visible on master (launch-cut leaks):**
- **Earn (#8)**, all three clients:
  - iOS: `MailboxRootViewModel.swift:17-72, :642-648`; `DeepLinkRouter.swift:841`
  - Android: `MailboxRootViewModel.kt:137, :466`; `RTS:6391-6403`; `DeepLinkRouter.kt:942`
  - Web: `MailboxNav.tsx:52, :117-129`; `mailbox/page.tsx:62-67`; `settings/mail-day/page.tsx:281-285, :395`
- **Unboxing (#7):**
  - iOS: `MailboxRootView.swift:57`; `DeepLinkRouter.swift:842`
  - Android: `RTS:6347-6366`
- **Open gigs (#4)**, "Convert to neighbor gig": iOS `MailTaskListView.swift:269-289`; Android `MailTaskListScreen.kt:463`
- **Household calendar (#7)**, maintenance reminder POST: iOS `LogMaintenanceFormViewModel.swift:391-411`; Android `:280-380`
- **Bills and pets (#7)**, iOS document link picker: `UploadDocumentFormViewModel.swift:336-391`
- **Recent activity (#7)**, iOS list not filtered for cut targets: `HomeDashboardProjection.swift:228-253`
- **iOS Mail Day settings toggles** for cut features: `MailDaySettingsContent.swift:78-84`
- **Bill trends card** is visible on all three clients (web says this is deliberate at `page.tsx:897`)

**Unreachable:**
- Native booklet, coupon, package and records layouts (see section 0)
- Place verify-status screen on both native apps
- Native Vault list: only reachable through an Unboxing with a mailId
- Disambiguate form: DEBUG builds only
- Web orphan pages:
  - `/app/mailbox/(stamps|vacation|disambiguate|booklet|coupon)`
  - `/app/homes/[id]/(maintenance|docs)`
  - neighbor-message pages
- Web mailbox left nav is hidden below the md breakpoint (`layout.tsx:126-128`)
