"""Generate the design→build mapping appendix for docs/first-person-loop-build-plan-2026-09-24.md.
Every path below was resolved against origin/master 630bc49b5 on 24 Sep 2026."""
import json, os, re
R = '/Users/yingpengwang/skinny-pantopus'
W, I, A = 'frontend/apps/web/src/', 'frontend/apps/ios/Pantopus/', 'frontend/apps/android/app/src/main/java/app/pantopus/android/'
H = {  # host screen -> {platform: [files]}
 'TODAY': {'web': [W+'app/(app)/app/hub/today/page.tsx', W+'components/place/detail/TodayDetail.tsx', W+'components/hub/HubTodayCard.tsx'],
           'ios': [I+'Features/Place/Detail/AddressTodayTabView.swift', I+'Features/Place/Detail/PlaceTodayDetailContent.swift', I+'Features/Hub/Today/TodayDetailView.swift'],
           'android': [A+'ui/screens/place/today/TodayTabScreen.kt', A+'ui/screens/place/today/TodayTabViewModel.kt', A+'ui/screens/place/detail/PlaceTodayDetailContent.kt']},
 'CALENDAR_CARD': {'web': [W+'components/place/detail/AddressCalendarCard.tsx'], 'ios': [I+'Features/Place/Detail/PlaceTodayDetailContent.swift'], 'android': [A+'ui/screens/place/detail/PlaceTodayDetailContent.kt']},
 'PLACE_ROOT': {'web': [W+'app/(app)/app/place/page.tsx', W+'components/place/PlaceDashboard.tsx', W+'components/place/PlaceDashboardView.tsx'],
                'ios': [I+'Features/Place/PlaceDashboardView.swift', I+'Features/Place/PlaceDashboardViewModel.swift'],
                'android': [A+'ui/screens/place/PlaceDashboardScreen.kt', A+'ui/screens/place/PlaceDashboardViewModel.kt']},
 'CHECKLIST': {'web': [W+'components/hub/SetupBanner.tsx', W+'components/place/JustMovedCard.tsx'], 'ios': [I+'Features/Place/PlaceDashboardView.swift'], 'android': [A+'ui/screens/place/PlaceDashboardScreen.kt']},
 'SAVED_PLACES': {'web': [W+'components/place/SavedPlaceContext.tsx'], 'ios': [I+'Features/Place/Launch/PendingPlaceView.swift', I+'Core/Networking/Endpoints/SavedPlacesEndpoints.swift'],
                  'android': [A+'ui/screens/saved_places/SavedPlacesScreen.kt', A+'ui/screens/saved_places/SavedPlacesContent.kt', A+'ui/screens/saved_places/SavedPlacesActionSheet.kt']},
 'START': {'web': [W+'app/start/page.tsx', W+'components/place/StartFunnel.tsx', W+'components/archetypes/place/AhaCard.tsx'],
           'ios': [I+'Features/Place/Launch/PlaceLaunchView.swift', I+'Features/Place/Launch/PlacePreviewBody.swift'], 'android': [A+'ui/screens/place/launch/PlaceLaunchScreen.kt']},
 'OG': {'web': [W+'app/api/og/place/route.tsx']},
 'PLACE_DETAIL': {'web': [W+'components/place/detail/PlaceSectionDetail.tsx', W+'components/place/detail/RiskDetail.tsx'], 'ios': [I+'Features/Place/Detail/PlaceRiskDetailContent.swift'], 'android': [A+'ui/screens/place/detail/PlaceRiskBlockDetailContent.kt']},
 'HOME_DASH': {'web': [W+'app/(app)/app/homes/[id]/dashboard/page.tsx'], 'ios': [I+'Features/Homes/HomeDashboardView.swift'], 'android': [A+'ui/screens/homes/HomeDashboardScreen.kt']},
 'MEMBERS': {'web': [W+'app/(app)/app/homes/[id]/members/page.tsx'], 'ios': [I+'Features/Homes/Members/MembersListView.swift', I+'Features/Homes/Members/MembersListViewModel.swift'], 'android': [A+'ui/screens/homes/members/MembersListScreen.kt', A+'ui/screens/homes/members/MembersListViewModel.kt']},
 'INVITE': {'web': [W+'components/home/InviteMemberModal.tsx'], 'ios': [I+'Features/Homes/Members/InviteMemberWizardView.swift'], 'android': [A+'ui/screens/homes/members/InviteMemberWizardSheet.kt', A+'ui/screens/homes/members/HomeInvitationSenderContent.kt']},
 'DECISION': {'web': [W+'components/homes/invitations/AuthenticatedInvitationPage.tsx', W+'app/invite/[token]/page.tsx'], 'ios': [I+'Features/TokenAccept/HomeInvitationDecisionView.swift'], 'android': [A+'ui/screens/token_accept/HomeInvitationDecisionScreen.kt']},
 'MY_HOMES': {'web': [W+'app/(app)/app/homes/page.tsx'], 'ios': [I+'Features/Homes/MyHomesListView.swift'], 'android': [A+'ui/screens/homes/MyHomesListScreen.kt']},
 'VERIFY': {'web': [W+'components/place/VerifyPromptSheet.tsx', W+'components/place/verify-residency/VerifyResidency.tsx'], 'ios': [I+'Features/Homes/VerifyLandlord/Postcard/PostcardVerificationView.swift'], 'android': [A+'ui/screens/homes/verify_landlord/postcard/PostcardVerificationScreen.kt']},
 'BILLS': {'web': [W+'app/(app)/app/homes/[id]/bills/page.tsx'], 'ios': [I+'Features/Homes/Bills/BillsListView.swift'], 'android': [A+'ui/screens/homes/bills/BillsListScreen.kt']},
 'BILL_DETAIL': {'web': ['(new route — no bill-shaped destination on web)'], 'ios': [I+'Features/Homes/Bills/BillDetailView.swift'], 'android': [A+'ui/screens/homes/bills/BillDetailScreen.kt']},
 'BILL_TREND': {'web': [W+'components/home/BillTrendChart.tsx'], 'ios': [I+'Features/Homes/Bills/BillDetailView.swift'], 'android': [A+'ui/screens/homes/bills/BillDetailScreen.kt']},
 'CALENDAR': {'web': [W+'app/(app)/app/homes/[id]/calendar/page.tsx', W+'components/home/HouseholdCalendar.tsx'], 'ios': [I+'Features/Homes/Calendar/HomeCalendarView.swift'], 'android': [A+'ui/screens/homes/calendar/HomeCalendarScreen.kt']},
 'NOTIF_LIST': {'web': [W+'app/(app)/app/notifications/page.tsx'], 'ios': [I+'Features/Notifications/NotificationsView.swift'], 'android': [A+'ui/screens/notifications/NotificationsScreen.kt']},
 'NOTIF_SETTINGS': {'web': [W+'app/(app)/app/settings/notifications/page.tsx'], 'ios': [I+'Features/Settings/Notifications/NotificationSettingsView.swift'], 'android': [A+'ui/screens/settings/NotificationSettingsViewModel.kt']},
 'HOME_SETTINGS': {'web': [W+'app/(app)/app/homes/[id]/settings/page.tsx', W+'components/home/settings/HomeSettingsTab.tsx'], 'ios': [I+'Features/Homes/Settings/HomeSettingsView.swift'], 'android': [A+'ui/screens/homes/settings/HomeSettingsScreen.kt']},
 'PRIVACY': {'web': [W+'app/(app)/app/homes/[id]/privacy/page.tsx'], 'ios': [I+'Features/Place/PlacePrivacyMirrorView.swift'], 'android': [A+'ui/screens/place/privacy/PlacePrivacyMirrorScreen.kt']},
 'POST_CARD': {'web': [W+'components/feed/PostCard.tsx'], 'ios': [I+'Features/Feed/Pulse/PulsePostCard.swift'], 'android': [A+'ui/screens/feed/pulse/PulsePostCard.kt']},
 'EARN': {'web': [W+'components/mailbox/MailboxNav.tsx'], 'ios': [I+'Features/Mailbox/Earn/EarnView.swift', I+'Features/Root/HubTabRoot.swift', I+'Features/Root/YouTabRoot.swift'], 'android': [A+'ui/screens/mailbox/earn/EarnScreen.kt', A+'ui/screens/root/RootTabScreen.kt']},
 'WIDGETS': {'ios': ['frontend/apps/ios/PantopusWidgets/PantopusWidgetsBundle.swift', I+'Core/Widgets/WidgetSnapshotStore.swift', '(new) PantopusWidgets/TodayWidget.swift + Core/Widgets/TodayWidgetSnapshot.swift'],
             'android': [A+'data/widget/WidgetSnapshotStore.kt', '(new) widget/TodayWidgetProvider.kt + res/layout + res/xml']},
 'DEEPLINK': {'ios': [I+'Core/Routing/DeepLinkRouter.swift'], 'android': [A+'core/routing/DeepLinkRouter.kt']},
 'MAILDAY': {'web': [W+'app/(app)/app/mailbox/page.tsx', '(new Mail Day page — web has settings only)'], 'ios': [I+'Features/Mailbox/MailDay/MailDayView.swift', I+'Features/Mailbox/MailDay/Components/MailboxEmptyHero.swift'],
             'android': [A+'ui/screens/mailbox/mail_day/MailDayScreen.kt', A+'ui/screens/mailbox/mail_day/components/MailboxEmptyHero.kt']},
 'MAIL_ITEM': {'web': [W+'app/(app)/app/mailbox/[drawer]/[item_id]/page.tsx'], 'ios': [I+'Features/Mailbox/ItemDetail/MailboxItemDetailView.swift'], 'android': [A+'ui/screens/mailbox/item_detail/MailboxItemDetailScreen.kt']},
 'NEARBY': {'web': [W+'app/(app)/app/nearby/page.tsx', W+'app/(app)/app/nearby/NearbyCellsMap.tsx'], 'ios': [I+'Features/Neighborhood/NearbyCellsMapCard.swift'], 'android': [A+'ui/screens/nearby/NearbyCells.kt']},
 'FOUNDERS': {'web': ['(none on web today — new)'], 'ios': [I+'Features/Place/Detail/PlaceBlockFoundersSection.swift'], 'android': [A+'ui/screens/place/detail/PlaceBlockFoundersContent.kt']},
 'REWARDS': {'web': ['(none on web today — new)'], 'ios': [I+'Features/Me/ProfileInsightCards.swift'], 'android': [A+'ui/screens/you/me/ProfileInsightCards.kt']},
 'VERIFY_EMAIL': {'web': [W+'app/(auth)/verify-email-sent/page.tsx'], 'ios': [I+'Features/Auth/Screens/VerifyEmailView.swift', I+'Features/Status/VerifyEmailLandingView.swift'], 'android': [A+'ui/screens/auth/verify_email/VerifyEmailScreen.kt', A+'ui/screens/status/verify_email/VerifyEmailLandingScreen.kt']},
 'CLAIM': {'web': [W+'app/(app)/app/homes/new/page.tsx', W+'components/place/VerifiedSuccess.tsx'], 'ios': [I+'Features/Homes/ClaimOwnership/ClaimOwnershipWizardView.swift'], 'android': [A+'ui/screens/homes/claim_ownership/ClaimOwnershipWizardScreen.kt']},
}
# surface -> (slice, [hosts], note)
S = {
 'f9-privacy-mirror': ('F9', ['PRIVACY'], 'Re-scope from home-gated to user-scoped'),
 'f9-curator-chip': ('F9', ['POST_CARD'], 'Declare `origin` on web Post, iOS FeedPostDTO, Android FeedPostDto'),
 'f9-earn-removal': ('F9', ['EARN', 'DEEPLINK'], 'Gate is data-driven in backend/routes/hub.js (`inbox_offers`)'),
 'f9-verification-promise-copy': ('F9', ['VERIFY', 'DECISION'], 'Copy only'),
 'f9-founding-meter-preview': ('F9', ['START'], 'WallBar lives in StartFunnel.tsx; backend/routes/public.js:557 must fail closed'),
 'x-provenance-sheet': ('X', ['TODAY', 'PLACE_DETAIL'], 'New sheet; opened from every source caption'),
 'x-date-sheet': ('F5', ['CALENDAR_CARD', 'PLACE_ROOT'], 'New sheet; one component for all ten kinds'),
 'x-place-file': ('F2', ['PLACE_ROOT', 'CHECKLIST', 'SAVED_PLACES'], 'New screen: the Place tab\'s first screen (founder, 22 Sep); absorbs SetupBanner + JustMovedCard'),
 'f1-your-places': ('F1', ['SAVED_PLACES'], 'Opens from the place file\'s Address row'),
 'f1-add-place-sheet': ('F1', ['SAVED_PLACES'], 'New signed-in sheet; offline disabled (founder)'),
 'f1-save-confirmation': ('F1', ['SAVED_PLACES', 'START'], ''),
 'f1-email-verify-handoff': ('F1', ['VERIFY_EMAIL'], 'Pending place must persist server-side at register time'),
 'f1-today-tab': ('F1', ['TODAY'], 'One Today per platform; merges the hub and intelligence payloads'),
 'f5-today-calendar-strip': ('F5', ['CALENDAR_CARD', 'TODAY'], ''),
 'f4-today-pickup-card': ('F4', ['TODAY'], 'Push landing for the night-before pickup'),
 'f1-today-air-band': ('F1', ['TODAY'], 'Alert push landing'),
 'f4-notification-primer': ('F4', ['TODAY'], 'Primer after a pickup day is first saved from the Date sheet (founder, 23 Sep)'),
 'f4-briefing-optin-card': ('F4', ['TODAY'], 'Moves the opt-in onto Today (it is Settings-only on iOS today)'),
 'f4-notification-settings': ('F4', ['NOTIF_SETTINGS'], 'One switch per kind; Nearby switches are their own Android channel / iOS category (founder)'),
 'f1-claim-receipt': ('F1', ['CLAIM'], 'Needs the T1→T3 carry-over (no migration step exists)'),
 'f6-home-basics-rows': ('F6', ['HOME_SETTINGS'], 'Adds move-in date (never collected today)'),
 'f6-place-section-details': ('F6', ['PLACE_DETAIL'], 'Place-sections route must accept a saved place (founder, 23 Sep)'),
 'f3-members-roster': ('F3', ['MEMBERS'], 'Replaces the dead add-guest Invite'),
 'f3-invite-composer': ('F3', ['INVITE'], 'iOS gains username + link channels'),
 'f3-invite-banner': ('F3', ['MY_HOMES', 'TODAY'], 'Renders GET /api/homes/invitations (zero callers today)'),
 'f3b-invitation-decision': ('F3b', ['DECISION'], ''),
 'f3b-verify-address-sheet': ('F3b', ['VERIFY'], ''),
 'f3b-owner-attestation': ('F3b', ['MEMBERS'], 'New sheet'),
 'f3b-locked-action-row': ('F3b', ['HOME_DASH', 'BILLS', 'CALENDAR'], 'Applied wherever an attested action is locked'),
 'f3-household-block': ('F3', ['HOME_DASH', 'PLACE_ROOT'], ''),
 'f3-member-home-dashboard': ('F3', ['HOME_DASH'], ''),
 'f3-household-calendar': ('F3', ['CALENDAR', 'HOME_DASH'], 'Web calendar page exists but has no link to it'),
 'f3-bill-detail-web': ('F3', ['BILL_DETAIL'], 'New web route'),
 'f3-bills-list': ('F3', ['BILLS'], 'Fix delete status cancelled→canceled'),
 'f3-household-notifications': ('F3', ['NOTIF_LIST', 'DEEPLINK'], 'Android router sends new links to the dashboard today'),
 'f8-scale-strips': ('F8', ['START', 'PLACE_DETAIL', 'OG'], ''),
 'f8-compare-sheet': ('F8', ['START'], 'New sheet'),
 'f8-compare-arrival-header': ('F8', ['START'], ''),
 'f8-compare-reveal': ('F8', ['START'], 'New funnel step'),
 'f8-og-compare-card': ('F8', ['OG'], ''),
 'f8-native-share-compare': ('F8', ['START'], 'iOS has no share control on the preview today'),
 'f8-seasonal-aha': ('F8', ['START'], ''),
 'f8-positioning-copy': ('F8', ['START'], 'One constant per platform; homepage hero keeps its serif'),
 'f7-today-widget': ('F7', ['WIDGETS'], 'New widget'),
 'f7-widget-tap-landing': ('F7', ['TODAY', 'DEEPLINK'], 'Parse `src=widget` (iOS drops it today)'),
 'f7-widget-gallery': ('F7', ['WIDGETS'], 'New'),
 'f7-widget-howto-sheet': ('F7', ['TODAY'], 'New sheet'),
 'f9-nearby-cells-map': ('P', ['NEARBY'], ''),
 'f9-block-founders-panel': ('P', ['FOUNDERS', 'NEARBY'], ''),
 'f9-invite-rewards-card': ('P', ['REWARDS', 'NEARBY'], 'New card'),
 'f10-mail-day-triage': ('F10', ['MAILDAY'], 'New screen on web; wires the no-op "Scan today\'s stack" CTA on natives'),
 'f10-snap-capture-tray': ('F10', ['MAILDAY'], 'New sheet; iOS SystemCameraPicker, Android CameraX'),
 'f10-extraction-confirm': ('F10', ['MAILDAY'], 'New screen'),
 'f10-mail-piece-photo': ('F10', ['MAIL_ITEM'], ''),
 'f10-bill-provenance': ('F10', ['BILL_DETAIL'], ''),
 'f10-bill-trend': ('F10', ['BILL_TREND'], 'Web already ships BillTrendChart.tsx: extend it'),
 'f10-mail-snap-privacy': ('F10', ['HOME_SETTINGS'], ''),
 'f11-keeper-strip': ('F11', ['TODAY'], ''),
 'f11-keeper-naming': ('F11', ['TODAY'], 'New sheet'),
}
M = {x['id']: x for x in json.load(open(f'{R}/docs/notes/pack-manifest.json'))}
INV = {json.load(open(f'{R}/docs/notes/inventory-entries/{f}'))['id']: json.load(open(f'{R}/docs/notes/inventory-entries/{f}')) for f in os.listdir(f'{R}/docs/notes/inventory-entries')}
LABEL = {'NEW_SCREEN': '**New screen**', 'NEW_SHEET_OR_MODAL': '**New sheet**', 'NEW_WIDGET': '**New widget**',
         'NEW_CARD_IN_EXISTING': 'New part in a current screen', 'EXTEND_EXISTING': 'Redesign of a current screen',
         'COPY_ONLY': 'Copy change on a current screen'}
ver = {}
for l in open(f'{R}/docs/design/exports/VERIFICATION.md'):
    m = re.match(r'^\|\s*\d{3}\s*\|\s*([a-z0-9-]+)\s*\|(?:.*?\|){2}(.*?)\|(.*?)\|\s*$', l)
    if m: ver[m.group(1)] = m.group(3).strip()
tree = set(l.strip() for l in open(os.environ['TREE']))
def fmt(p):
    if p.startswith('('): return p
    ok = p in tree
    short = p.replace(W, 'web/').replace(I, 'ios/').replace(A, 'android/').replace('frontend/apps/ios/', 'ios/')
    return f'`{short}`' + ('' if ok else ' ⚠ not found')
ORDER = ['F9', 'X', 'F1', 'F2', 'F4', 'F5', 'F3', 'F3b', 'F8', 'F6', 'F7', 'P', 'F10', 'F11']
rows = []
for sid in sorted(S, key=lambda k: (ORDER.index(S[k][0]), k)):
    sl, hosts, note = S[sid]
    x = M[sid]
    st = 'verified' + (' · fix pass open' if 'fix pass' in ver.get(sid, '').lower() else '') if sid in ver else 'exported, not yet verified'
    per = {}
    for h in hosts:
        for plat, fs in H[h].items():
            for f in fs:
                per.setdefault(plat, [])
                if f not in per[plat]: per[plat].append(f)
    cell = lambda plat: '<br>'.join(fmt(f) for f in per.get(plat, [])) or '—'
    kind = LABEL[INV[sid]['disposition']]
    rows.append(f"| {sl} | `{sid}`<br>[export](design/exports/{sid}/) | {kind} | {st} | {cell('web')} | {cell('ios')} | {cell('android')} | {note} |")
missing = sum(r.count('⚠') for r in rows)
print('\n'.join(rows))
print(f'\n<!-- unresolved paths: {missing} -->')
