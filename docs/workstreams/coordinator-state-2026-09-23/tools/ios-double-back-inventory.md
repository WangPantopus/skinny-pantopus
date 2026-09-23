# iOS double back buttons: inventory for the shared-UX agent (from Stream 3, 2026-09-23)

Source: a read-only code inventory on master `1d791906c` (iOS app), plus a Stream 3 repro on the iOS 26.5 simulator.

## Repro (Stream 3, iOS 26.5 simulator, master + native batch)

- `pantopus://settings/payments` → Payments shows two backs:
  - the system floating glass back (top-left circle);
  - the screen's own `SettingsTopBar` chevron under it.
- The same pair appears on Help (Hub menu → Help & Support) and on the Business owner view (My businesses → a business).
- It isn't a double push. Main suspected one, but `HubTabRoot` consumes the link with a single `path.append(.paymentsSettings)`, and `SettingsView` swaps its sub-screens in place (it is not a NavigationStack).
- Cause: `HubTabRoot` and `YouTabRoot` push destinations without hiding the system nav bar (`HubTabRoot.swift:634-636`, `YouTabRoot.swift:462-464`), while those screens draw their own header.
- `settings/payments` is the only `settings/*` deep link on iOS; anything else is `.unknown`.
- Android: no double back. Help and Settings show a single back.
- Existing fix pattern, used by about 99 screens: `.toolbar(.hidden, for: .navigationBar)` on the destination.

## Scope

- Only the `HubTabRoot` and `YouTabRoot` stacks are affected.
- `InboxTabRoot:97`, `MarketplaceTabRoot:55`, `PulseTabRoot:47` and `TasksTabRoot:78` already hide the bar on every pushed screen. `NeighborhoodTabRoot` and the Today stack have no `navigationDestination`.
- Hub `.pulsePost` already hides it (`HubTabRoot.swift:2010`).

Paths below are under `frontend/apps/ios/Pantopus/Features/`. `H:n` is the `case` line in `HubTabRoot.swift` and `Y:n` the line in `YouTabRoot.swift`, on master `1d791906c`.

## Shared shells that draw their own back

| Shell | File | Notes |
|---|---|---|
| ContentDetailShell (CDS) | `Shared/ContentDetail/ContentDetailShell.swift:122-124` | when `onBack` is set |
| GroupedListView (GLV) | `Shared/GroupedList/GroupedListView.swift:50-52` | when `onBack` is set |
| FormShell (FS) | `Shared/Form/FormShell.swift:222-223` | chevron if `leading: .back`, else X |
| WizardShell (WS) | `Shared/Wizard/WizardShell.swift:185-186` | X on the first step, chevron after |
| MailItemDetailShell (MIDS) | `Shared/MailItemDetail/MailItemDetailShell.swift:220-223` | |
| TransactionalDetailShell (TDS) | `ContentDetail/TransactionalDetailShell.swift:262-263` | |
| SettingsTopBar (STB) | `Settings/SettingsTopBar.swift:27-28` | |

## Affected: custom chevron back with the system bar still visible

In every row, hiding the bar leaves exactly one back unless a note says otherwise.

| Route | View → back |
|---|---|
| `.maintenanceDetail` H:1370 Y:2331 | MaintenanceDetailView → CDS |
| `.billDetail` H:1398 Y:1860 | BillDetailView → CDS |
| `.pollDetail` H:1435 Y:2088 | PollDetailView → CDS |
| `.calendarEventDetail` H:1542 Y:1933, plus `.scheduling(.homeEventDetail)` | EventDetailView → CDS |
| `.emergencyItem` H:1579 Y:1970 | EmergencyInfoDetailView → CDS |
| `.documentDetail` H:1630 Y:2016 | DocumentDetailView → CDS |
| `.packageDetail` H:1661 Y:2054 | PackageDetailView → CDS |
| `.homePhotos` H:1755, `.trustedNeighbors` H:1760 | → CDS |
| `.propertyDetails` H:2713 | PropertyDetailsView → CDS |
| `.helpCenter` H:2646 Y:1100 | HelpCenterView → CDS |
| `.publicProfile` H:1895 Y:2388 | PublicProfileView (own header) |
| `.pulsePost` Y:1386 (You only) | PulsePostDetailView |
| `.legalContent` Y:1111 | LegalContentView |
| `.homeSettings` H:1712, `.homeSecurity` H:1720, `.homeOwnershipSecurity` H:1724, `.homeNotifications` H:1762 | → GLV |
| `.privacySettings` H:2994 Y:1102 | PrivacyView → GLV |
| `.legal` Y:1106 | LegalIndexView → GLV |
| `.menu` H:2622, `.paymentsSettings` H:2648, `.settings` Y:1085, `.paymentsSettings` Y:1091 | SettingsView. Index → GLV; Payments → STB (see B3) |
| `.mailItemDetail` H:1850 Y:1042 | MailDetailView → MIDS |
| `.gigDetail` H:2180 Y:1266, `.listingDetail` H:2238 Y:1286, `.invoiceDetail` H:2299 | → TDS |
| `.businessProfile` H:1917, `.businessProfilePage` H:1933 Y:2410 | BusinessProfileView |
| `.editBusinessPage` H:1969 Y:2433 | EditBusinessPageView |
| `.pulseFeed` H:2036 | FeedView |
| `.gigsFeed` H:2145 Y:1432 | GigsFeedView |
| `.marketplace` H:2230 Y:1276 | MarketplaceView |
| `.beaconInsights` H:2122, `.audienceProfile` Y:1660 | AudienceProfileView |
| `.supportTrainDetail` H:2381 Y:1553 | SupportTrainDetailView. **You: see B1** |
| `.manageTrain` H:2462 Y:1618 | ManageTrainView |
| `.discoverHub` H:2476 | DiscoverHubView |
| `.chatConversation` H:2613 Y:1839 | ChatConversationView |
| `.todayDetail` H:2700 | TodayDetailView |
| `.explore` H:2759 Y:1739 | ExploreMapView |
| `.ceremonialMailOpen` H:2827 Y:2664 | CeremonialMailOpenView |
| `.mailboxMap` H:2842 Y:1017 | MailboxMapView |
| `.vacationHold` H:2844 Y:1036 | VacationHoldView. **See B1** |
| `.wallet` H:2854, `.walletActivityList` H:2864 | WalletView / WalletActivityListView (B4) |
| `.stamps` H:2873 Y:2474 | StampsView |
| `.mailTask` H:2875 Y:2476, `.mailTaskList` H:2887 Y:2488 | MailTaskView / MailTaskListView |
| `.mailTranslation` H:2909 Y:2510, `.packageGig` H:2926 Y:2527 | |
| `.earn` H:2940 Y:2541 | EarnView |
| `.businessOwner` H:2953 Y:2554 | BusinessOwnerView → `Components/OwnerHeader.swift:32`; preview, catalog and inbox modes each have a back |
| `.viewAs` H:2988 Y:2595 | ViewAsView |
| `.membershipDetail` Y:1206, `.identityCenter` Y:1632, `.creatorAudienceMembers` Y:1700 | |
| `.broadcastDetail` Y:1783, `.creatorInbox` Y:1798, `.creatorInboxConversation` Y:1824, `.fanInbox` Y:1829 | |
| `.cancelClaim` H:1749 Y:2607, `.propertyCorrection` H:1764 | → FS chevron |
| `.quickPostGig` H:2200, `.editGig` H:2600 Y:1509 | PostGigV1View → FS chevron |
| `.transferOwnership` H:2734 Y:2370, `.mailRoutingQueue` H:2833 Y:2670 | → FS chevron |
| `.mailDay` H:2850 Y:1019 | MailDayView → FS chevron |
| `.professionalProfile` Y:1234 | ProfessionalProfileView → FS chevron. **B5: no back in loading/error** |

## Affected: custom X close or a wizard alongside the system back

In every row, hiding the bar leaves one control unless a note says otherwise.

- **FS X:** `.logMaintenance` H:1356 Y:2320 and `.editMaintenance` H:1381 Y:2342; `.startPoll` H:1440 Y:2093; `.editAccessCode` H:1484 Y:2137.
- **Calendar event form:** `.addCalendarEvent` H:1514 Y:1907 and `.scheduling(.homeEventEditor)` (AddEventFormView; the loading/error states have their own X).
- **FS X:** `.addEmergencyInfo` H:1573 Y:1964; `.uploadDocument` H:1624 Y:2010.
- **FS X:** `.addHouseholdTask` H:1692 Y:2285 and `.editHouseholdTask` H:1701 Y:2294. **B6: edit mode has no close in loading/error.**
- **Persona:** `.editPersona` H:2107 Y:1236 (FS X); `.composeBroadcast` H:2114 Y:1243.
- **Pulse compose:** `.composePost` H:2133 Y:1366 and `.editPost` H:2139 Y:1376 (PulseComposeFlowView).
- **FS X:** `.editSignup` H:2458 Y:1614.
- **FS X:** `.editProfile` H:2667. **B6: no close in loading/error.**
- **FS X:** `.addGuest` H:2721.
- **Wizards (WS):**
  - `.addBill` H:1409 Y:1869;
  - `.claimOwnership` / `.verifyResidency` H:1766/1796 Y:1152/1182;
  - `.verifyLandlord` H:1818 Y:2613;
  - `.createBusiness` H:1979, and `.businessWaitlist` / `.createBusiness` Y:2195;
  - `.composeGig` H:2190, `.composeTask` Y:1502;
  - `.composeListing` / `.editListing` H:2290/2294 Y:1342/1347;
  - `.startSupportTrain` H:2364 Y:1566;
  - `.ceremonialMail` H:2822 Y:2659;
  - `.privacyHandshake` Y:2464.
  - Note: the system back currently skips each wizard's discard confirmation.
- **Scheduling forms (FS X):** `.scheduling(.bookingLimits / .blockOffTime / .resourceEditor / .scheduleVisit)`.
- **Scheduling:** `.scheduling(.messagePreview)` (AutomationsKit X).

## Check before hiding the bar

- **B1: miswired custom backs.** Today these screens rely on the system back.
  - The calls are `VacationHoldViewModel { pop() }` (H:2846, Y:1038) and You's `SupportTrainDetailView(viewModel:) { pop() }` (`YouTabRoot.swift:1554-1556`).
  - Both pass an unlabeled trailing closure to an init with several defaulted closures (`VacationHoldViewModel.swift:69-76`; `SupportTrainDetailView.swift:30-41`).
  - Under Swift 5.10 backward matching, `pop()` likely lands on the last closure (`onPickToDate` / `onMessageHost`), and `onBack` stays `{}`.
  - Label `onBack:` before hiding the bar, or the user is stuck.
- **B3: SettingsView** is one pushed screen that swaps its sub-screens.
  - The system back closes all of Settings. Each sub-screen's own back steps within Settings: index (GLV), notifications, privacy, identity center, audience profile, legal, blocked users (STB), password, devices (STB), verification, help, about, data export, payments (STB).
  - The Beacons feed sub-screen hides the bar itself.
  - The `.placeholder` sub-screen (`SettingsView.swift:123-124`) has no back.
  - `.paymentsSettings` opens directly on Payments, so its own back goes to the Settings index, not to the caller (e.g. Earn → Cash out).
- **B4: Face ID lock screen.** `SensitiveScreenGuard`'s lock screen (Payments, Devices, Wallet; `Core/Security/SensitiveScreenGuard.swift:88-119`) has no back, but closes on cancel.
- **B5: ProfessionalProfileView.** The loading skeleton's chevron is decorative (`:478`), and the error state (`:45-53`) has no back.
- **B6: no close in loading/error.** EditProfileView (loading `:74-110`, error `:36-43`); AddHouseholdTaskFormView edit mode (skeleton and error).
- **Hub `.homeDashboard` (H:1260) is not a double back.** Hub passes no `onBack`, so the view keeps the system bar (`Homes/HomeDashboardView.swift:215`). Hiding it would remove the only back unless Hub passes `onBack` the way You does (`YouTabRoot.swift:2214`).
- **`.logPackage` (H:1666, Y:2059)** has system back plus a leading Cancel in the same bar. The fix there is `.navigationBarBackButtonHidden(true)`, not hiding the bar.
- **`.scheduling(.dateOverrides)`** is a sheet-style header (grabber + Done) shown alongside the system back.
- **Inverse problem in the other stacks.** Those stacks hide the bar everywhere, so screens that rely on the system back have no back there (e.g. ListingOffersView, MyTasksView, SupportTrainsView, NotYetAvailableView).
