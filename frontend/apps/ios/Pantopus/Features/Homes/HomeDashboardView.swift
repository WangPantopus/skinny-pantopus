//
//  HomeDashboardView.swift
//  Pantopus
//
//  Concrete content-detail screen for a Home. Hero header + grid-tabs
//  body + FAB CTA.
//

// swiftlint:disable function_body_length type_body_length

import SwiftUI

/// Home Dashboard screen wired to `GET /api/homes/:id` (with public-profile fallback).
struct HomeDashboardView: View {
    @Environment(AuthManager.self) private var auth
    @State private var viewModel: HomeDashboardViewModel
    @State private var showsInviteOwner = false

    private static let actionLabels: [String: String] = [
        "add_task": "Add Task",
        "track_bill": "Track Bill",
        "track_package": "Track Package",
        "add_pet": "Add Pet",
        "create_poll": "Create Poll",
        "send_mail": "Send Mail",
        "log_package": "Log a package",
        "view_packages": "Packages",
        "add_member": "Add member",
        "add_mail": "Add mail",
        "verify": "Verify home",
        "view_bills": "Bills",
        "view_polls": "Polls",
        "view_maintenance": "Maintenance",
        "pets": "Pets",
        "calendar": "Calendar",
        "view_docs": "Documents",
        "view_emergency": "Emergency info",
        "view_tasks": "Tasks",
        "access_codes": "Access codes",
        "view_claims": "Claims"
    ]
    private let homeId: String
    private let onBack: (() -> Void)?
    private let onClaimOwnership: (() -> Void)?
    private let onOpenClaimsList: (() -> Void)?
    /// Route to the Bills list for this home (T5.2.2).
    private let onOpenBills: (() -> Void)?
    /// Route to the Polls list for this home (T6.3e).
    private let onOpenPolls: (() -> Void)?
    /// Host-supplied navigation for actions whose dedicated screen
    /// isn't built yet (Log package, Add mail, etc). Receives the
    /// human-readable action label.
    private let onOpenPlaceholder: ((String) -> Void)?
    /// Push onto the host stack when the user taps the Pets quick-action
    /// tile. Receives this home's id so the destination can pre-fetch.
    private let onOpenPets: ((String) -> Void)?
    /// Push onto the host stack when the user taps the Calendar
    /// quick-action tile (T6.4c / P18).
    private let onOpenCalendar: ((String) -> Void)?
    /// Push onto the host stack when the user taps the Documents
    /// quick-action tile (T6.4b / P17).
    private let onOpenDocs: ((String) -> Void)?
    /// Push onto the host stack when the user taps the Emergency info
    /// quick-action tile (T6.4b / P17).
    private let onOpenEmergency: ((String) -> Void)?
    /// Push onto the host stack when the user taps the Packages
    /// quick-action tile. Receives this home's id (T6.3d / P14).
    private let onOpenPackages: ((String) -> Void)?
    /// Push onto the host stack when the user taps the Access codes
    /// onboarding step. Receives this home's id and optional display name.
    private let onOpenAccessCodes: ((String, String?) -> Void)?
    /// Push onto the host stack when the user taps the Tasks (T6.3c)
    /// quick-action tile. Receives this home's id so the destination
    /// can pre-fetch.
    private let onOpenTasks: ((String) -> Void)?
    /// T6.3b / P10 - Push onto the host stack when the user taps the
    /// Maintenance quick-action tile. Receives this home's id.
    private let onOpenMaintenance: ((String) -> Void)?
    /// Push onto the host stack when the user taps the Members
    /// quick-action tile or "Add member" CTA (T6.3a / P9). Receives
    /// this home's id so the destination can pre-fetch the roster.
    private let onOpenMembers: ((String) -> Void)?
    /// A.4 / A13.5 - Push onto the host stack when the user taps the
    /// "Property details" affordance in the Overview section. Receives
    /// this home's id so the destination can resolve the property.
    private let onOpenPropertyDetails: ((String) -> Void)?
    /// A14.1 (P5.1) — Push onto the host stack when the user taps the
    /// top-bar settings affordance. Routes to the per-home Settings
    /// index. Typed `@MainActor @Sendable` because the closure is
    /// captured inside the `ContentDetailTopBarAction`'s Sendable
    /// handler.
    private let onOpenSettings: (@MainActor @Sendable (String) -> Void)?
    /// H1 — "Hire help" on a seasonal-checklist item. Receives the
    /// `GigsCategory` raw value derived from the item's `gig_category`
    /// so the host can open the gig composer pre-filtered (RN routes to
    /// `/gig-v2/new?initialText=…`).
    private let onHireHelp: ((String) -> Void)?
    /// FAB → "Add Task". Opens the household-task create form for this
    /// home. Mirrors RN `homes/[id]/index.tsx:155`
    /// (`/homes/:id/tasks?create=true`).
    private let onAddTask: ((String) -> Void)?
    /// FAB → "Track Bill" (RN `homes/[id]/index.tsx:156`).
    private let onTrackBill: ((String) -> Void)?
    /// FAB → "Track Package" (RN `homes/[id]/index.tsx:157`).
    private let onTrackPackage: ((String) -> Void)?
    /// FAB → "Send Mail" — opens the mail composer
    /// (RN `homes/[id]/index.tsx:160`).
    private let onSendMail: ((String) -> Void)?

    init(
        homeId: String,
        onBack: (() -> Void)? = nil,
        onClaimOwnership: (() -> Void)? = nil,
        onOpenClaimsList: (() -> Void)? = nil,
        onOpenBills: (() -> Void)? = nil,
        onOpenPolls: (() -> Void)? = nil,
        onOpenPlaceholder: ((String) -> Void)? = nil,
        onOpenPets: ((String) -> Void)? = nil,
        onOpenCalendar: ((String) -> Void)? = nil,
        onOpenDocs: ((String) -> Void)? = nil,
        onOpenEmergency: ((String) -> Void)? = nil,
        onOpenPackages: ((String) -> Void)? = nil,
        onOpenAccessCodes: ((String, String?) -> Void)? = nil,
        onOpenTasks: ((String) -> Void)? = nil,
        onOpenMaintenance: ((String) -> Void)? = nil,
        onOpenMembers: ((String) -> Void)? = nil,
        onOpenPropertyDetails: ((String) -> Void)? = nil,
        onOpenSettings: (@MainActor @Sendable (String) -> Void)? = nil,
        onHireHelp: ((String) -> Void)? = nil,
        onAddTask: ((String) -> Void)? = nil,
        onTrackBill: ((String) -> Void)? = nil,
        onTrackPackage: ((String) -> Void)? = nil,
        onSendMail: ((String) -> Void)? = nil
    ) {
        _viewModel = State(initialValue: HomeDashboardViewModel(homeId: homeId))
        self.homeId = homeId
        self.onBack = onBack
        self.onClaimOwnership = onClaimOwnership
        self.onOpenClaimsList = onOpenClaimsList
        self.onOpenBills = onOpenBills
        self.onOpenPolls = onOpenPolls
        self.onOpenPlaceholder = onOpenPlaceholder
        self.onOpenPets = onOpenPets
        self.onOpenCalendar = onOpenCalendar
        self.onOpenDocs = onOpenDocs
        self.onOpenEmergency = onOpenEmergency
        self.onOpenPackages = onOpenPackages
        self.onOpenAccessCodes = onOpenAccessCodes
        self.onOpenTasks = onOpenTasks
        self.onOpenMaintenance = onOpenMaintenance
        self.onOpenMembers = onOpenMembers
        self.onOpenPropertyDetails = onOpenPropertyDetails
        self.onOpenSettings = onOpenSettings
        self.onHireHelp = onHireHelp
        self.onAddTask = onAddTask
        self.onTrackBill = onTrackBill
        self.onTrackPackage = onTrackPackage
        self.onSendMail = onSendMail
    }

    /// Current signed-in user's email; used by the Invite Owner form
    /// to reject self-invites. Returns empty when in preview mode.
    private var currentUserEmail: String {
        if case let .signedIn(user) = auth.state { return user.email }
        return ""
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                HomeDashboardLoadingView(onBack: onBack)
            case let .loaded(content):
                dashboardBody(for: content, brandNew: nil)
            case let .empty(brandNew):
                dashboardBody(for: brandNew.content, brandNew: brandNew)
            case let .needsAttention(content):
                dashboardBody(for: content, brandNew: nil)
            case let .error(message):
                HomeDashboardErrorView(message: message, onBack: onBack) { Task { await viewModel.refresh() } }
            }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("homeDashboard")
        .onAppear { Analytics.track(.screenHomeDashboardViewed) }
        .task { await viewModel.load() }
    }

    private func dashboardBody(
        for content: HomeDashboardContent,
        brandNew: HomeDashboardBrandNewContent?
    ) -> some View {
        ContentDetailShell(
            title: "Home",
            onBack: onBack,
            topBarAction: onOpenSettings.map { handler in
                let id = homeId
                return ContentDetailTopBarAction(
                    icon: .slidersHorizontal,
                    accessibilityLabel: "Home settings"
                ) {
                    Task { @MainActor in handler(id) }
                }
            },
            header: {
                HomeHeroHeader(
                    address: content.address,
                    verified: content.verified,
                    stats: content.stats
                )
            },
            body: {
                VStack(spacing: Spacing.s4) {
                    if let security = content.securityBanner {
                        HomeSecurityStatusBanner(content: security) {
                            handleSecurityBannerCTA(security.action)
                        }
                        .padding(.horizontal, Spacing.s4)
                    }
                    if let attention = content.attentionSummary {
                        NeedsAttentionBanner(summary: attention) { handleQuickAction($0) }
                            .padding(.horizontal, Spacing.s4)
                    }
                    if !content.isVerifiedOwner {
                        ClaimOwnershipBanner(
                            onClaim: { onClaimOwnership?() },
                            onViewClaims: { onOpenClaimsList?() }
                        )
                        .padding(.horizontal, Spacing.s4)
                    }
                    GridTabsBody(
                        quickActions: content.quickActions,
                        tabs: content.tabs,
                        selectedTab: Binding(
                            get: { viewModel.selectedTab },
                            set: { viewModel.selectedTab = $0 }
                        ),
                        onQuickAction: { handleQuickAction($0) },
                        overview: {
                            if let brandNew {
                                BrandNewHomeSection(brandNew: brandNew) { handleQuickAction($0) }
                            } else {
                                VStack(alignment: .leading, spacing: Spacing.s4) {
                                    homeIntelligenceStack
                                    HomeOverviewSection(
                                        content: content,
                                        onOpenEmergency: { onOpenEmergency?(homeId) },
                                        onOpenPropertyDetails: { onOpenPropertyDetails?(homeId) }
                                    )
                                }
                            }
                        }
                    )
                }
            },
            cta: {
                // Six one-tap creates, matching RN's `homeFabActions`
                // (`src/app/homes/[id]/index.tsx:154-161`). Every entry
                // routes to a real create surface — no placeholders.
                FABCreateCTA(
                    actions: [
                        FABSheetAction(id: "add_task", title: "Add Task", icon: .listChecks),
                        FABSheetAction(id: "track_bill", title: "Track Bill", icon: .creditCard),
                        FABSheetAction(id: "track_package", title: "Track Package", icon: .package),
                        FABSheetAction(id: "add_pet", title: "Add Pet", icon: .pawPrint),
                        FABSheetAction(id: "create_poll", title: "Create Poll", icon: .barChart3),
                        FABSheetAction(id: "send_mail", title: "Send Mail", icon: .mail)
                    ]
                ) { handleFabAction($0) }
            }
        )
        .sheet(isPresented: $showsInviteOwner) {
            InviteOwnerFormView(
                homeId: homeId,
                currentUserEmail: currentUserEmail
            ) { showsInviteOwner = false }
        }
    }

    /// H1 — health-score ring + seasonal checklist + property value +
    /// bill trends. Each card owns its loading / loaded / empty / error
    /// surface so one failing read can't blank the Overview.
    @ViewBuilder
    private var homeIntelligenceStack: some View {
        HealthScoreRingCard(
            state: viewModel.healthScore,
            onAction: { handleQuickAction($0) },
            onRetry: { Task { await viewModel.refreshHealthScore() } }
        )
        SeasonalChecklistCard(
            state: viewModel.checklist,
            pendingItemIds: viewModel.pendingChecklistItemIds,
            onComplete: { itemId in Task { await viewModel.completeChecklistItem(itemId) } },
            onSkip: { itemId in Task { await viewModel.skipChecklistItem(itemId) } },
            onHireHelp: { item in
                onHireHelp?(GigsCategory.from(backendKey: item.gigCategory).rawValue)
            },
            onGenerate: { Task { await viewModel.generateChecklist() } },
            onRetry: { Task { await viewModel.generateChecklist() } }
        )
        PropertyValueCard(
            state: viewModel.propertyValue
        ) { Task { await viewModel.retryPropertyValue() } }
        BillTrendsCard(
            state: viewModel.billTrends
        ) { Task { await viewModel.retryBillTrends() } }
    }

    /// Security-banner CTA routing. Mirrors RN's
    /// `HomeStatusBanner.tsx:53` (claim window → invite co-owner) and
    /// `:60` / `:66` (review / dispute → the home's security surface).
    private func handleSecurityBannerCTA(_ action: HomeSecurityBannerContent.Action) {
        switch action {
        case .inviteCoOwner:
            showsInviteOwner = true
        case .openSecuritySettings:
            if let onOpenSettings {
                let id = homeId
                Task { @MainActor in onOpenSettings(id) }
            }
        case .noAction:
            break
        }
    }

    private func handleFabAction(_ action: String) {
        switch action {
        case "add_task":
            route(onAddTask, fallback: onOpenTasks, action: action)
        case "track_bill":
            if let onTrackBill { onTrackBill(homeId) } else if let onOpenBills { onOpenBills() } else {
                onOpenPlaceholder?(actionLabel(action))
            }
        case "track_package":
            route(onTrackPackage, fallback: onOpenPackages, action: action)
        case "add_pet":
            route(onOpenPets, fallback: nil, action: action)
        case "create_poll":
            if let onOpenPolls { onOpenPolls() } else { onOpenPlaceholder?(actionLabel(action)) }
        case "send_mail":
            route(onSendMail, fallback: nil, action: action)
        case "add_member":
            openMembersOrInvite()
        default:
            onOpenPlaceholder?(actionLabel(action))
        }
    }

    /// Prefer the dedicated create route, fall back to the feature's
    /// list route, and only then to the host's placeholder screen.
    private func route(
        _ primary: ((String) -> Void)?,
        fallback: ((String) -> Void)?,
        action: String
    ) {
        if let primary {
            primary(homeId)
        } else if let fallback {
            fallback(homeId)
        } else {
            onOpenPlaceholder?(actionLabel(action))
        }
    }

    private func handleQuickAction(_ action: String) {
        if let handler = quickActionHandlers[action] {
            handler()
        } else {
            onOpenPlaceholder?(actionLabel(action))
        }
    }

    private var quickActionHandlers: [String: () -> Void] {
        [
            "verify": { onClaimOwnership?() },
            "add_member": { openMembersOrInvite() },
            "view_bills": { onOpenBills?() },
            "view_polls": { onOpenPolls?() },
            "view_maintenance": { onOpenMaintenance?(homeId) },
            "pets": { onOpenPets?(homeId) },
            "calendar": { onOpenCalendar?(homeId) },
            "view_docs": { onOpenDocs?(homeId) },
            "view_emergency": { onOpenEmergency?(homeId) },
            "view_packages": { onOpenPackages?(homeId) },
            "access_codes": { onOpenAccessCodes?(homeId, currentAddress) },
            "view_tasks": { onOpenTasks?(homeId) },
            "view_claims": { onOpenClaimsList?() }
        ]
    }

    private func openMembersOrInvite() {
        // Prefer the dedicated Members screen when its host wired the
        // callback. Falls back to the legacy InviteOwnerForm sheet.
        if let onOpenMembers {
            onOpenMembers(homeId)
        } else {
            showsInviteOwner = true
        }
    }

    private func actionLabel(_ id: String) -> String {
        Self.actionLabels[id] ?? id.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private var currentAddress: String? {
        switch viewModel.state {
        case let .loaded(content), let .needsAttention(content):
            content.address
        case let .empty(brandNew):
            brandNew.content.address
        case .loading, .error:
            nil
        }
    }
}

#Preview {
    HomeDashboardView(homeId: "preview")
        .environment(AuthManager.previewSignedIn)
}
