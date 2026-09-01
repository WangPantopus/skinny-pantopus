//
//  BusinessOwnerView.swift
//  Pantopus
//
//  A10.7 — the single-business owner dashboard, the owner-facing twin of
//  A10.6. Two in-screen frames toggled instantly:
//    · OWNER / EDIT — owner chrome (top bar, live bar, header with edit
//      fabs), insight tiles, a profile-strength card, edit-affordance
//      sections that open Edit Business Page (A13.10), a per-review reply
//      composer, and a "Preview · Edit page" dock.
//    · PREVIEW AS NEIGHBOR — the EXACT A10.6 public render (B3.1's
//      `BusinessProfileLoadedView`) wrapped in a dark `PreviewBar`; no owner
//      affordances leak through.
//
//  Owner ↔ preview is an in-screen, instant toggle (no navigation). Business
//  violet identity throughout; loading uses shimmer skeletons.
//
//  Design reference: `docs/designs/A10/business-owner-frames.jsx`
//  (FrameOwnerEdit + FramePreviewPublic) and
//  `docs/new-design-parity-batch2.md` § A10.7.
//
// swiftlint:disable file_length

import SwiftUI

/// Top-level entry point for the Business owner dashboard.
@MainActor
public struct BusinessOwnerView: View {
    @State private var viewModel: BusinessOwnerViewModel
    @State private var mode: OwnerViewMode = .owner
    /// C2 — "Post as this business" composer sheet (role-gated).
    @State private var showsComposer = false

    private let businessId: String
    private let onBack: @MainActor () -> Void
    /// Opens Edit Business Page (A13.10) — the "Edit page" primary + every
    /// owner edit affordance.
    private let onEditPage: @MainActor () -> Void
    /// Owner-only deep dives (insights / settings) — stubbed by the host.
    private let onOpenInsights: @MainActor () -> Void
    private let onOpenSettings: @MainActor () -> Void
    /// B2C — opens the Team & roles management screen.
    private let onOpenTeam: @MainActor () -> Void
    /// C4 — opens the custom Pages CMS (block builder + revision history).
    private let onOpenPages: @MainActor () -> Void
    /// C3 — owner money + legal surfaces: Stripe Connect payouts, invoicing,
    /// and the private legal record + verification.
    private let onOpenPayments: @MainActor () -> Void
    private let onOpenInvoices: @MainActor () -> Void
    private let onOpenLegal: @MainActor () -> Void
    /// Business-inbox row taps — opens a chat room (`roomId`, counterpart
    /// name, counterpart handle) or a matched neighborhood post.
    private let onOpenChatRoom: @MainActor (String, String, String) -> Void
    private let onOpenPost: @MainActor (String) -> Void

    public init(
        businessId: String,
        onBack: @escaping @MainActor () -> Void,
        onEditPage: @escaping @MainActor () -> Void = {},
        onOpenInsights: @escaping @MainActor () -> Void = {},
        onOpenSettings: @escaping @MainActor () -> Void = {},
        onOpenTeam: @escaping @MainActor () -> Void = {},
        onOpenPages: @escaping @MainActor () -> Void = {},
        onOpenPayments: @escaping @MainActor () -> Void = {},
        onOpenInvoices: @escaping @MainActor () -> Void = {},
        onOpenLegal: @escaping @MainActor () -> Void = {},
        onOpenChatRoom: @escaping @MainActor (String, String, String) -> Void = { _, _, _ in },
        onOpenPost: @escaping @MainActor (String) -> Void = { _ in },
        content: BusinessOwnerContent? = nil
    ) {
        _viewModel = State(initialValue: BusinessOwnerViewModel(businessId: businessId, content: content))
        self.businessId = businessId
        self.onBack = onBack
        self.onEditPage = onEditPage
        self.onOpenInsights = onOpenInsights
        self.onOpenSettings = onOpenSettings
        self.onOpenTeam = onOpenTeam
        self.onOpenPages = onOpenPages
        self.onOpenPayments = onOpenPayments
        self.onOpenInvoices = onOpenInvoices
        self.onOpenLegal = onOpenLegal
        self.onOpenChatRoom = onOpenChatRoom
        self.onOpenPost = onOpenPost
    }

    public var body: some View {
        content
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .overlay(alignment: .bottom) { toastOverlay }
            .accessibilityIdentifier("businessOwner")
            .task { await viewModel.load() }
            .sheet(isPresented: $showsComposer) {
                // C2 — reuse the shared Pulse composer, pointed at
                // `POST /api/businesses/:businessId/posts`.
                PulseComposeView(
                    intent: .announce,
                    identity: .business,
                    businessAuthorId: businessId,
                    managesDismiss: true
                ) { _ in Task { await viewModel.refresh() } }
            }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            OwnerLoadingLayout(onBack: onBack)
        case let .loaded(payload):
            ZStack {
                switch mode {
                case .owner:
                    OwnerEditFrame(
                        content: payload,
                        onBack: onBack,
                        onEditPage: onEditPage,
                        onOpenInsights: onOpenInsights,
                        onOpenSettings: onOpenSettings,
                        onOpenTeam: onOpenTeam,
                        onOpenPages: onOpenPages,
                        onOpenPayments: onOpenPayments,
                        onOpenInvoices: onOpenInvoices,
                        onOpenLegal: onOpenLegal,
                        onPreview: { mode = .preview },
                        onManageCatalog: { mode = .catalog },
                        onOpenInbox: { mode = .inbox },
                        onComposePost: { showsComposer = true },
                        onSubmitReply: { reviewId, text in
                            viewModel.submitReply(reviewId: reviewId, text: text)
                        },
                        onClaimFounding: { Task { await viewModel.claimFoundingOffer() } },
                        onDismissFounding: { viewModel.dismissFoundingBanner() }
                    )
                    .transition(.opacity)
                case .preview:
                    OwnerPreviewFrame(content: payload.publicProfile) {
                        mode = .owner
                    }
                    .transition(.opacity)
                case .catalog:
                    BusinessCatalogView(businessId: payload.businessId) {
                        mode = .owner
                        Task { await viewModel.refresh() }
                    }
                    .transition(.opacity)
                case .inbox:
                    BusinessInboxView(
                        businessId: payload.businessId,
                        onBack: { mode = .owner },
                        onOpenRoom: onOpenChatRoom,
                        onOpenPost: onOpenPost
                    )
                    .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.18), value: mode)
        case .notFound:
            OwnerMessageLayout(
                icon: .building2,
                headline: "Business not found",
                subcopy: "This business may have moved or unpublished its page.",
                onBack: onBack
            ) { Task { await viewModel.refresh() } }
        case let .error(message):
            OwnerMessageLayout(
                icon: .alertCircle,
                headline: "Couldn't load your business",
                subcopy: message,
                onBack: onBack
            ) { Task { await viewModel.refresh() } }
        }
    }

    /// Founding-claim confirmation / error copy. RN raises an `Alert`;
    /// native uses the same transient toast idiom as the rest of the app.
    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            Text(toast)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.Color.appTextInverse)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s3)
                .background(Theme.Color.appText)
                .clipShape(Capsule())
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, 140)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    viewModel.toast = nil
                }
                .accessibilityIdentifier("businessOwner.toast")
        }
    }
}

/// Which frame the owner dashboard is showing.
enum OwnerViewMode: Hashable {
    case owner
    case preview
    /// C2 — the catalog manager (services / products CRUD + reorder).
    case catalog
    /// The business-side inbox — rooms addressed to the business identity
    /// plus neighborhood posts matched to it.
    case inbox
}

// MARK: - Owner / edit frame

@MainActor
struct OwnerEditFrame: View {
    let content: BusinessOwnerContent
    let onBack: @MainActor () -> Void
    let onEditPage: @MainActor () -> Void
    let onOpenInsights: @MainActor () -> Void
    let onOpenSettings: @MainActor () -> Void
    let onOpenTeam: @MainActor () -> Void
    /// C4 — opens the custom Pages CMS.
    let onOpenPages: @MainActor () -> Void
    /// C3 — money + legal owner surfaces.
    var onOpenPayments: @MainActor () -> Void = {}
    var onOpenInvoices: @MainActor () -> Void = {}
    var onOpenLegal: @MainActor () -> Void = {}
    let onPreview: @MainActor () -> Void
    /// C2 — opens the catalog manager frame ("Manage" / "Add a service").
    var onManageCatalog: @MainActor () -> Void = {}
    /// Opens the business inbox frame (Messages + Mentions).
    var onOpenInbox: @MainActor () -> Void = {}
    /// C2 — opens the "Post as this business" composer. Only reachable
    /// when `content.canPostAsBusiness`.
    var onComposePost: @MainActor () -> Void = {}
    let onSubmitReply: @MainActor (String, String) -> Void
    /// Founding-business offer banner actions.
    var onClaimFounding: @MainActor () -> Void = {}
    var onDismissFounding: @MainActor () -> Void = {}

    private var profile: BusinessProfileContent {
        content.publicProfile
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            OwnerTopBar(
                onBack: onBack,
                onOpenInsights: onOpenInsights,
                onOpenSettings: onOpenSettings
            )
            OwnerLiveBar(
                isLive: content.isLive,
                editedMeta: content.editedMeta,
                onPreview: onPreview
            )
            ScrollView {
                VStack(spacing: Spacing.s0) {
                    OwnerHeaderBanner(
                        name: profile.header.displayName,
                        handle: profile.header.handle.map { "@\($0)" } ?? "",
                        locality: profile.header.locality ?? "",
                        logoIcon: profile.header.logoIcon,
                        status: bannerStatus,
                        onEdit: onEditPage
                    )
                    scrollBody(in: profile)
                        .padding(.horizontal, Spacing.s4)
                        .padding(.bottom, 130)
                }
            }
        }
        .background(Theme.Color.appBg)
        .overlay(alignment: .bottomTrailing) {
            // C2 — "Post as this business". RN floats the same FAB above
            // its dock, gated on `access.role_base`.
            if content.canPostAsBusiness {
                OwnerComposeFab(action: onComposePost)
                    .padding(.trailing, Spacing.s4)
                    .padding(.bottom, 88)
            }
        }
        .overlay(alignment: .bottom) {
            OwnerDock(onPreview: onPreview, onEditPage: onEditPage)
        }
        .accessibilityIdentifier("businessOwner.edit")
    }

    private var bannerStatus: BizStatusBadge? {
        guard let status = profile.status else { return nil }
        return status.isOpen ? .open(status.chipLabel) : .closed(status.chipLabel)
    }

    private func scrollBody(in profile: BusinessProfileContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            if let offer = content.foundingOffer {
                FoundingOfferBanner(
                    offer: offer,
                    onClaim: onClaimFounding,
                    onDismiss: onDismissFounding
                )
                .padding(.top, 14)
            }
            InsightTiles(insights: content.insights, onOpenInsights: onOpenInsights)
                .padding(.top, 14)
            ProfileStrengthCard(strength: content.profileStrength) { _ in onEditPage() }
                .padding(.top, Spacing.s3)

            OwnerSectionHeader(title: "Categories", actionLabel: "Edit", actionIcon: .pencil, onAction: onEditPage)
            BizCategoryRow(categories: profile.categories)

            OwnerSectionHeader(title: "About", actionLabel: "Edit", actionIcon: .pencil, onAction: onEditPage)
            aboutSection

            OwnerSectionHeader(title: "Hours", actionLabel: "Edit", actionIcon: .pencil, onAction: onEditPage)
            hoursSection

            OwnerSectionHeader(title: "Service area", actionLabel: "Edit", actionIcon: .pencil, onAction: onEditPage)
            serviceAreaSection

            OwnerSectionHeader(
                title: "Services",
                actionLabel: "Manage",
                actionIcon: .slidersHorizontal,
                onAction: onManageCatalog
            )
            ManageServicesList(services: profile.services, onManage: onManageCatalog)

            OwnerSectionHeader(title: "Photos")
            ManageGalleryRail(gallery: profile.gallery, onAdd: onEditPage, onEditTile: onEditPage)

            OwnerSectionHeader(title: "Team", actionLabel: "Manage", actionIcon: .users, onAction: onOpenTeam)
            TeamSummaryRow(onOpen: onOpenTeam)

            OwnerSectionHeader(title: "Pages", actionLabel: "Manage", actionIcon: .fileText, onAction: onOpenPages)
            PagesSummaryRow(onOpen: onOpenPages)

            OwnerSectionHeader(title: "Inbox", actionLabel: "Open", actionIcon: .inbox, onAction: onOpenInbox)
            OwnerNavRow(
                icon: .inbox,
                title: "Messages & mentions",
                subtitle: "Conversations with this business and posts that mention it",
                identifier: "businessOwner.inboxRow",
                onOpen: onOpenInbox
            )

            OwnerSectionHeader(title: "Money & legal")
            VStack(spacing: Spacing.s2) {
                OwnerNavRow(
                    icon: .creditCard,
                    title: "Payments",
                    subtitle: "Connect Stripe so this business can get paid",
                    identifier: "businessOwner.paymentsRow",
                    onOpen: onOpenPayments
                )
                OwnerNavRow(
                    icon: .receiptText,
                    title: "Invoices",
                    subtitle: "Bill a customer and track what's been paid",
                    identifier: "businessOwner.invoicesRow",
                    onOpen: onOpenInvoices
                )
                OwnerNavRow(
                    icon: .shieldCheck,
                    title: "Legal & verification",
                    subtitle: "Legal name, tax ID and verification documents",
                    identifier: "businessOwner.legalRow",
                    onOpen: onOpenLegal
                )
            }

            OwnerSectionHeader(
                title: "Reviews",
                actionLabel: content.reviewsToReplyLabel,
                actionIcon: .messageSquare
            )
            reviewsSection
        }
    }

    @ViewBuilder private var aboutSection: some View {
        if let about = profile.about, !about.isEmpty {
            Text(about)
                .font(.system(size: 13.5))
                .tracking(-0.05)
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineSpacing(4)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            EmptyBlock(
                icon: .fileText,
                title: "Add a description",
                message: "Tell neighbors what makes your business worth hiring.",
                cta: EmptyBlock.CTA(label: "Add", icon: .plus, action: onEditPage)
            )
        }
    }

    @ViewBuilder private var hoursSection: some View {
        if let status = profile.status, !profile.hours.isEmpty {
            HoursTable(status: status, rows: profile.hours)
        } else {
            EmptyBlock(
                icon: .clock,
                title: "Set your hours",
                message: "Add opening hours so neighbors know when you're available.",
                cta: EmptyBlock.CTA(label: "Add", icon: .plus, action: onEditPage)
            )
        }
    }

    @ViewBuilder private var serviceAreaSection: some View {
        if let area = profile.serviceArea {
            OwnerServiceAreaCard(area: area)
        } else {
            EmptyBlock(
                icon: .mapPin,
                title: "Add a service area",
                message: "Show neighbors where you work.",
                cta: EmptyBlock.CTA(label: "Add", icon: .plus, action: onEditPage)
            )
        }
    }

    @ViewBuilder private var reviewsSection: some View {
        let reviewCount = profile.reviewSummary?.count ?? 0
        if let summary = profile.reviewSummary, reviewCount > 0 {
            RatingDistribution(
                average: summary.average,
                count: summary.count,
                distribution: summary.distribution
            )
        }
        ForEach(content.reviews) { review in
            ReviewReplyComposer(review: review, businessName: shortBusinessName) { text in
                onSubmitReply(review.id, text)
            }
            .padding(.top, Spacing.s2)
        }
    }

    /// "Marlow & Co. Cleaning" → "Marlow & Co." for the reply byline.
    private var shortBusinessName: String {
        let name = profile.header.displayName
        if let range = name.range(of: " Cleaning") {
            return String(name[..<range.lowerBound])
        }
        return name
    }
}

// MARK: - Preview-as-neighbor frame

/// The exact A10.6 public render (B3.1) under a dark preview bar. Reusing
/// `BusinessProfileLoadedView` guarantees the owner sees precisely the public
/// page — no owner chrome leaks in. The floating back control and the bar's
/// Exit both return to the owner frame.
@MainActor
struct OwnerPreviewFrame: View {
    let content: BusinessProfileContent
    let onExit: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            PreviewBar(onExit: onExit)
            BusinessProfileLoadedView(
                content: content,
                isSaved: false,
                onBack: onExit,
                onShare: {},
                onMore: {},
                onToggleSavedPlace: {},
                onContact: {},
                onBook: {},
                onCall: {}
            )
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("businessOwner.preview")
    }
}

// MARK: - Section header (with edit affordance)

@MainActor
struct OwnerSectionHeader: View {
    let title: String
    var actionLabel: String?
    var actionIcon: PantopusIcon?
    var onAction: (@MainActor () -> Void)?

    var body: some View {
        HStack {
            Text(title.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            if let actionLabel {
                if let onAction {
                    Button { onAction() } label: { actionContent(actionLabel) }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("businessOwner.section.\(title).action")
                } else {
                    actionContent(actionLabel)
                }
            }
        }
        .padding(.top, 18)
        .padding(.bottom, Spacing.s2)
    }

    private func actionContent(_ label: String) -> some View {
        HStack(spacing: Spacing.s1) {
            if let actionIcon {
                Icon(actionIcon, size: 12, strokeWidth: 2.2, color: Theme.Color.business)
            }
            Text(label)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.business)
        }
    }
}

// MARK: - Manage services

@MainActor
struct ManageServicesList: View {
    let services: [BusinessServiceRow]
    let onManage: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(services.enumerated()), id: \.element.id) { index, service in
                Button { onManage() } label: { row(service) }
                    .buttonStyle(.plain)
                if index < services.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                        .padding(.leading, 14)
                }
            }
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            addButton
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("businessOwner.manageServices")
    }

    private func row(_ service: BusinessServiceRow) -> some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.businessBg)
                    .frame(width: 34, height: 34)
                Icon(service.icon, size: 16, strokeWidth: 2, color: Theme.Color.business)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(service.name)
                    .font(.system(size: 13, weight: .semibold))
                    .tracking(-0.1)
                    .foregroundStyle(Theme.Color.appText)
                Text(subtitle(service))
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s2)
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(service.name), \(subtitle(service))")
    }

    private func subtitle(_ service: BusinessServiceRow) -> String {
        [service.detail, service.priceLabel].compactMap { $0 }.joined(separator: " · ")
    }

    private var addButton: some View {
        Button { onManage() } label: {
            HStack(spacing: Spacing.s1) {
                Icon(.plus, size: 14, strokeWidth: 2.5, color: Theme.Color.business)
                Text("Add a service")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.business)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("businessOwner.addService")
    }
}

// MARK: - Manage gallery

@MainActor
struct ManageGalleryRail: View {
    let gallery: [BusinessGalleryItem]
    let onAdd: @MainActor () -> Void
    let onEditTile: @MainActor () -> Void

    private static let addWidth: CGFloat = 92
    private static let tileWidth: CGFloat = 116
    private static let tileHeight: CGFloat = 92

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                addTile
                ForEach(gallery) { item in
                    tile(item)
                }
            }
        }
        .accessibilityIdentifier("businessOwner.manageGallery")
    }

    private var addTile: some View {
        Button { onAdd() } label: {
            VStack(spacing: Spacing.s1) {
                Icon(.plus, size: 20, strokeWidth: 2.2, color: Theme.Color.business)
                Text("Add")
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.business)
            }
            .frame(width: Self.addWidth, height: Self.tileHeight)
            .background(Theme.Color.businessBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(Theme.Color.business, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add photo")
        .accessibilityIdentifier("businessOwner.addPhoto")
    }

    private func tile(_ item: BusinessGalleryItem) -> some View {
        ZStack {
            tint(item.tint)
            if let moreCount = item.moreCount {
                Color.black.opacity(0.55)
                Text("+\(moreCount)")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            } else {
                Icon(.image, size: 24, strokeWidth: 1.6, color: Theme.Color.appTextInverse)
                    .opacity(0.92)
                if let label = item.label {
                    labelScrim(label)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                }
                editFab
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    .padding(6)
            }
        }
        .frame(width: Self.tileWidth, height: Self.tileHeight)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(item.moreCount.map { "See \($0) more photos" } ?? (item.label ?? "Photo"))
    }

    private var editFab: some View {
        Button { onEditTile() } label: {
            Icon(.pencil, size: 11, color: Theme.Color.appTextInverse)
                .frame(width: 22, height: 22)
                .background(Theme.Color.appText.opacity(0.55), in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Edit photo")
    }

    private func labelScrim(_ label: String) -> some View {
        Text(label)
            .font(.system(size: 10.5, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 6)
            .background(
                LinearGradient(
                    colors: [Color.black.opacity(0), Color.black.opacity(0.45)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
    }

    private func tint(_ tint: BusinessGalleryTint) -> Color {
        switch tint {
        case .primary: Theme.Color.business
        case .success: Theme.Color.success
        case .slate: Theme.Color.slate
        case .deep: Theme.Color.businessDark
        }
    }
}

// MARK: - Service area card (owner)

@MainActor
struct OwnerServiceAreaCard: View {
    let area: BusinessServiceArea

    var body: some View {
        VStack(spacing: Spacing.s0) {
            MapPreview(
                identity: .business,
                serviceAreaRadius: area.hasCoordinates ? 56 : nil,
                pinGlyph: .building2
            )
            HStack(alignment: .top, spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(area.title)
                        .font(.system(size: 12.5, weight: .semibold))
                        .tracking(-0.1)
                        .foregroundStyle(Theme.Color.appText)
                    if let detail = area.detail, !detail.isEmpty {
                        Text(detail)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    if let serviceArea = area.serviceArea, !serviceArea.isEmpty {
                        HStack(spacing: Spacing.s1) {
                            Icon(.navigation, size: 11, color: Theme.Color.success)
                            Text(serviceArea)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Theme.Color.success)
                        }
                        .padding(.top, Spacing.s1)
                    }
                }
                Spacer(minLength: Spacing.s0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}

// MARK: - Team summary row

/// C4 — entry-point card that opens the custom Pages CMS (page list, block
/// builder, revision history). Mirrors RN's business-dashboard "Pages" tab.
@MainActor
struct PagesSummaryRow: View {
    let onOpen: @MainActor () -> Void

    var body: some View {
        Button { onOpen() } label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.businessBg)
                        .frame(width: 34, height: 34)
                    Icon(.fileText, size: 16, strokeWidth: 2, color: Theme.Color.business)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text("Custom pages")
                        .font(.system(size: 13, weight: .semibold))
                        .tracking(-0.1)
                        .foregroundStyle(Theme.Color.appText)
                    Text("Build menus, about pages and more with content blocks")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("businessOwner.pagesRow")
    }
}

/// B2C — entry-point card on the owner dashboard that opens the Team &
/// roles management screen.
@MainActor
struct TeamSummaryRow: View {
    let onOpen: @MainActor () -> Void

    var body: some View {
        Button { onOpen() } label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.businessBg)
                        .frame(width: 34, height: 34)
                    Icon(.users, size: 16, strokeWidth: 2, color: Theme.Color.business)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text("Team & roles")
                        .font(.system(size: 13, weight: .semibold))
                        .tracking(-0.1)
                        .foregroundStyle(Theme.Color.appText)
                    Text("Invite teammates and manage what each role can do")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("businessOwner.teamRow")
    }
}

// MARK: - Owner dock (Preview · Edit page)

@MainActor
struct OwnerDock: View {
    let onPreview: @MainActor () -> Void
    let onEditPage: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Button { onPreview() } label: {
                dockLabel(icon: .eye, title: "Preview", tint: Theme.Color.appText)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("businessOwner.previewAction")

            Button { onEditPage() } label: {
                dockLabel(icon: .edit2, title: "Edit page", tint: Theme.Color.appTextInverse, bold: true)
                    .background(Theme.Color.business)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("businessOwner.editPage")
        }
        .padding(.horizontal, 14)
        .padding(.top, 10)
        .padding(.bottom, Spacing.s2)
        .background(
            Theme.Color.appSurface
                .opacity(0.97)
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                }
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private func dockLabel(icon: PantopusIcon, title: String, tint: Color, bold: Bool = false) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(icon, size: 16, color: tint)
            Text(title)
                .font(.system(size: 14, weight: bold ? .bold : .semibold))
                .tracking(-0.1)
                .foregroundStyle(tint)
        }
        .frame(maxWidth: .infinity, minHeight: 44)
    }
}

// MARK: - Loading / message layouts

@MainActor
private struct OwnerLoadingLayout: View {
    let onBack: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            OwnerTopBar(onBack: onBack, onOpenInsights: {}, onOpenSettings: {})
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    LinearGradient(
                        colors: [Theme.Color.businessDark, Theme.Color.business],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .frame(height: 116)
                    .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Shimmer(width: 68, height: 68, cornerRadius: 18)
                        Shimmer(width: 200, height: 22, cornerRadius: Radii.sm)
                        Shimmer(width: 130, height: 14, cornerRadius: Radii.sm)
                    }
                    .padding(.horizontal, Spacing.s4)
                    .offset(y: -34)
                    Shimmer(height: 64, cornerRadius: Radii.lg).padding(.horizontal, Spacing.s4)
                    Shimmer(height: 104, cornerRadius: Radii.lg).padding(.horizontal, Spacing.s4)
                    Shimmer(height: 120, cornerRadius: Radii.lg).padding(.horizontal, Spacing.s4)
                }
                .padding(.bottom, Spacing.s4)
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("businessOwner.loading")
    }
}

@MainActor
private struct OwnerMessageLayout: View {
    let icon: PantopusIcon
    let headline: String
    let subcopy: String
    let onBack: @MainActor () -> Void
    let onRetry: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            OwnerTopBar(onBack: onBack, onOpenInsights: {}, onOpenSettings: {})
            EmptyState(
                icon: icon,
                headline: headline,
                subcopy: subcopy,
                cta: EmptyState.CTA(title: "Try again") {
                    await MainActor.run { onRetry() }
                }
            )
            .frame(maxHeight: .infinity)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("businessOwner.message")
    }
}

#Preview("Owner / edit") {
    OwnerEditFrame(
        content: BusinessOwnerSampleData.marlow,
        onBack: {},
        onEditPage: {},
        onOpenInsights: {},
        onOpenSettings: {},
        onOpenTeam: {},
        onOpenPages: {},
        onPreview: {},
        onSubmitReply: { _, _ in }
    )
}

#Preview("Preview as neighbor") {
    OwnerPreviewFrame(content: BusinessProfileSampleData.populated) {}
}
