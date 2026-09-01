//
//  BusinessProfileView.swift
//  Pantopus
//
//  A10.6 — public Business Profile, reshaped (B3.1) from the old tabbed
//  layout to a single-scroll sectioned design: a `BizBannerHeader` cover
//  + overlapping logo, a stat strip, category chips, then About / Hours /
//  Service area / Services / Recent work / Reviews sections, over a sticky
//  Contact + Book (or Call) dock. Floating circular controls overlay the
//  banner. The newly-claimed + closed secondary frame swaps unfilled
//  sections for `EmptyBlock`s and limits the dock.
//
//  Design reference: `docs/designs/A10/business-frames.jsx`
//  (FrameBizPopulated + FrameBizNew) and `docs/new-design-parity-batch2.md`
//  § A10.6. Identity pillar is business violet throughout.
//
// swiftlint:disable file_length

import SwiftUI

/// Top-level entry point for the Business Profile screen.
@MainActor
public struct BusinessProfileView: View {
    @State private var viewModel: BusinessProfileViewModel
    @State private var savedStore = SavedPlacesStore()
    private let onBack: @MainActor () -> Void
    /// Host pushes the chat conversation after Contact resolves a room.
    private let onOpenMessages: @MainActor (InboxConversationDestination) -> Void
    private let onShare: @MainActor () -> Void
    private let onOpenReport: @MainActor () -> Void
    private let onOpenWebsite: @MainActor (URL) -> Void
    /// "Book" dock action — stubbed by the host (real booking ships later).
    private let onBook: @MainActor () -> Void
    /// A13.10 Edit Business Page, surfaced via overflow when viewer is owner.
    private let onEdit: @MainActor () -> Void

    public init(
        businessId: String,
        pageSlug: String? = nil,
        onBack: @escaping @MainActor () -> Void,
        onOpenMessages: @escaping @MainActor (InboxConversationDestination) -> Void = { _ in },
        onShare: @escaping @MainActor () -> Void = {},
        onOpenReport: @escaping @MainActor () -> Void = {},
        onOpenWebsite: @escaping @MainActor (URL) -> Void = { _ in },
        onBook: @escaping @MainActor () -> Void = {},
        onEdit: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(
            initialValue: BusinessProfileViewModel(businessId: businessId, pageSlug: pageSlug)
        )
        self.onBack = onBack
        self.onOpenMessages = onOpenMessages
        self.onShare = onShare
        self.onOpenReport = onOpenReport
        self.onOpenWebsite = onOpenWebsite
        self.onBook = onBook
        self.onEdit = onEdit
    }

    public var body: some View {
        @Bindable var savedBindable = savedStore
        return ZStack(alignment: .bottom) {
            content
            if let toast = viewModel.toastMessage {
                ToastView(message: ToastMessage(text: toast, kind: .neutral))
                    .padding(.bottom, Spacing.s16)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .task(id: toast) {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        viewModel.toastMessage = nil
                    }
            }
            savedAffordanceOverlay
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .confirmationDialog(
            "More",
            isPresented: Binding(
                get: { viewModel.showOverflow },
                set: { viewModel.showOverflow = $0 }
            ),
            titleVisibility: .hidden
        ) {
            if viewerOwnsLoadedBusiness {
                Button("Edit business page") { onEdit() }
            }
            if let pending = loadedSavedPlace {
                Button(savedPlaceIsSaved(pending) ? "Remove saved place" : "Save business") {
                    savedStore.toggle(pending)
                }
            }
            Button("Share business") { onShare() }
            Button("Report", role: .destructive) { onOpenReport() }
            Button("Cancel", role: .cancel) {}
        }
        .accessibilityIdentifier("businessProfile")
        .task { await viewModel.load() }
        .task { await savedStore.loadIfNeeded() }
        .sheet(item: $savedBindable.pendingSave) { pending in
            SavePlaceSheet(
                pending: pending,
                onSave: { label, choice in
                    Task { await savedStore.commitSave(label: label, choice: choice) }
                },
                onClose: { savedStore.pendingSave = nil }
            )
        }
    }

    private var viewerOwnsLoadedBusiness: Bool {
        if case let .loaded(payload) = viewModel.state {
            return payload.viewerIsOwner
        }
        return false
    }

    private var loadedSavedPlace: PendingSavePlace? {
        if case let .loaded(payload) = viewModel.state {
            return payload.savedPlace
        }
        return nil
    }

    private func savedPlaceIsSaved(_ pending: PendingSavePlace) -> Bool {
        savedStore.isSaved(
            geocodePlaceId: pending.geocodePlaceId,
            latitude: pending.latitude,
            longitude: pending.longitude
        )
    }

    private var savedAffordanceOverlay: some View {
        VStack(spacing: Spacing.s2) {
            if let undo = savedStore.undo {
                HStack(spacing: Spacing.s3) {
                    Icon(.checkCircle, size: 18, color: Theme.Color.appTextInverse)
                    Text("Removed \u{201C}\(undo.dto.label)\u{201D}")
                        .font(.system(size: 13.5, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .lineLimit(1)
                    Spacer(minLength: Spacing.s2)
                    Button { Task { await savedStore.undoRemove() } } label: {
                        Text("Undo")
                            .font(.system(size: 13.5, weight: .bold))
                            .foregroundStyle(Theme.Color.primary300)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s3)
                .background(Capsule().fill(Theme.Color.appText.opacity(0.95)))
                .padding(.horizontal, Spacing.s4)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: undo) {
                    try? await Task.sleep(nanoseconds: 4_000_000_000)
                    savedStore.dismissUndo()
                }
                .accessibilityIdentifier("savedPlaces.undoSnackbar")
            }
            if let toast = savedStore.toast {
                ToastView(message: toast)
                    .task(id: toast) {
                        try? await Task.sleep(nanoseconds: 2_500_000_000)
                        savedStore.toast = nil
                    }
            }
        }
        .padding(.bottom, Spacing.s16)
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            LoadingLayout(onBack: onBack)
        case let .loaded(payload):
            BusinessProfileLoadedView(
                content: payload,
                isSaved: payload.savedPlace.map(savedPlaceIsSaved) ?? false,
                namedPage: viewModel.namedPage,
                onBack: onBack,
                onShare: onShare,
                onMore: presentOverflow,
                onToggleSavedPlace: {
                    if let pending = payload.savedPlace {
                        savedStore.toggle(pending)
                    }
                },
                onContact: { Task { await openContact() } },
                onBook: onBook,
                onCall: callBusiness
            )
        case .notFound:
            NotFoundLayout(onBack: onBack) { Task { await viewModel.refresh() } }
        case let .error(message):
            ErrorLayout(message: message, onBack: onBack) { Task { await viewModel.refresh() } }
        }
    }

    private func presentOverflow() {
        viewModel.showOverflow = true
    }

    /// Contact dock → `POST …/inbox/start` → host chat push.
    private func openContact() async {
        guard let destination = await viewModel.resolveChatDestination() else { return }
        onOpenMessages(destination)
    }

    private func callBusiness() {
        guard case let .loaded(content) = viewModel.state,
              let phone = content.phoneNumber, !phone.isEmpty else { return }
        let digits = phone.filter { $0.isNumber || $0 == "+" }
        if let url = URL(string: "tel:\(digits)") {
            onOpenWebsite(url)
        }
    }
}

// MARK: - Loaded layout

/// The loaded frame, factored out so previews / snapshots can render it
/// directly off `BusinessProfileContent`. Mirrors Android's
/// `BusinessProfileLoadedFrame`.
@MainActor
struct BusinessProfileLoadedView: View {
    let content: BusinessProfileContent
    let isSaved: Bool
    /// C4 — the named custom page from `pantopus://b/:username/:slug`.
    /// Defaults to `.none` so every existing call site is untouched.
    var namedPage: BusinessProfileNamedPageState = .none
    let onBack: @MainActor () -> Void
    let onShare: @MainActor () -> Void
    let onMore: @MainActor () -> Void
    let onToggleSavedPlace: @MainActor () -> Void
    let onContact: @MainActor () -> Void
    let onBook: @MainActor () -> Void
    let onCall: @MainActor () -> Void

    var body: some View {
        ZStack(alignment: .top) {
            ScrollView {
                VStack(spacing: Spacing.s0) {
                    BizBannerHeader(
                        identity: .business,
                        name: content.header.displayName,
                        handle: content.header.handle.map { "@\($0)" } ?? "",
                        locality: content.header.locality ?? "",
                        logoIcon: content.header.logoIcon,
                        verified: content.header.isVerified,
                        status: bannerStatus
                    )
                    StatStrip(stats: content.stats)
                    BusinessProfileNamedPageSection(state: namedPage)
                        .padding(.horizontal, Spacing.s4)
                    BusinessProfileSections(content: content)
                        .padding(.horizontal, Spacing.s4)
                        .padding(.top, 14)
                        .padding(.bottom, 132)
                }
            }
            .ignoresSafeArea(edges: .top)

            FloatingControls(
                onBack: onBack,
                onShare: onShare,
                onMore: onMore,
                showsSave: content.savedPlace != nil,
                isSaved: isSaved,
                onToggleSavedPlace: onToggleSavedPlace
            )
        }
        .background(Theme.Color.appBg)
        .overlay(alignment: .bottom) {
            ActionBar(
                dock: content.dock,
                onContact: onContact,
                onBook: onBook,
                onCall: onCall
            )
        }
        .accessibilityIdentifier("businessProfile.loaded")
    }

    private var bannerStatus: BizStatusBadge? {
        guard let status = content.status else { return nil }
        return status.isOpen ? .open(status.chipLabel) : .closed(status.chipLabel)
    }
}

// MARK: - Sections

@MainActor
private struct BusinessProfileSections: View {
    let content: BusinessProfileContent

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            if content.isNewlyClaimed {
                JustOpenedNote()
                    .padding(.bottom, Spacing.s1)
            }

            BizCategoryRow(categories: content.categories)
                .padding(.top, content.isNewlyClaimed ? Spacing.s2 : Spacing.s0)

            aboutSection
            hoursSection
            serviceAreaSection
            servicesSection
            recentWorkSection
            reviewsSection
            footer
        }
    }

    // About

    @ViewBuilder private var aboutSection: some View {
        BizSectionHeader(title: "About")
        if let about = content.about, !about.isEmpty {
            Text(about)
                .font(.system(size: 13.5))
                .tracking(-0.05)
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineSpacing(4)
                .frame(maxWidth: .infinity, alignment: .leading)
            if !content.aboutChips.isEmpty {
                FlowChips(chips: content.aboutChips)
                    .padding(.top, 10)
            }
        } else {
            EmptyBlock(
                icon: .fileText,
                title: "No description yet",
                message: "This business hasn't written an About blurb. It'll appear here once they do."
            )
        }
    }

    // Hours

    @ViewBuilder private var hoursSection: some View {
        BizSectionHeader(title: "Hours")
        if let status = content.status, !content.hours.isEmpty {
            HoursTable(status: status, rows: content.hours)
        } else {
            EmptyBlock(
                icon: .clock,
                title: "Hours not set",
                message: "Opening hours haven't been published yet."
            )
        }
    }

    // Service area

    @ViewBuilder private var serviceAreaSection: some View {
        BizSectionHeader(title: "Service area")
        if let area = content.serviceArea {
            ServiceAreaCard(area: area)
        } else {
            EmptyBlock(
                icon: .mapPin,
                title: "Service area not set",
                message: "This business hasn't shared where they work yet."
            )
        }
    }

    // Services

    @ViewBuilder private var servicesSection: some View {
        BizSectionHeader(title: "Services", seeAll: content.services.isEmpty ? nil : "See all")
        if content.services.isEmpty {
            EmptyBlock(
                icon: .tag,
                title: "No services yet",
                message: "Services and prices show up here once they're listed."
            )
        } else {
            ServicesList(services: content.services)
        }
    }

    // Recent work

    @ViewBuilder private var recentWorkSection: some View {
        BizSectionHeader(title: "Recent work", seeAll: content.gallery.isEmpty ? nil : "See all")
        if content.gallery.isEmpty {
            EmptyBlock(
                icon: .image,
                title: "No photos yet",
                message: "Work photos will appear here after the first few jobs."
            )
        } else {
            GalleryStrip(tiles: content.gallery.map(galleryTile))
        }
    }

    // Reviews

    @ViewBuilder private var reviewsSection: some View {
        let total = content.reviewSummary?.count ?? 0
        BizSectionHeader(title: "Reviews", seeAll: total > 0 ? "See all \(total)" : nil)
        if let summary = content.reviewSummary, total > 0 {
            RatingDistribution(
                average: summary.average,
                count: summary.count,
                distribution: summary.distribution
            )
            ForEach(content.reviews) { review in
                BizReviewCard(card: review)
                    .padding(.top, Spacing.s2)
            }
        } else {
            EmptyBlock(
                icon: .messageSquarePlus,
                title: "No reviews yet",
                message: "Be the first to hire \(content.header.displayName). Your review helps "
                    + "the next neighbor decide.",
                cta: EmptyBlock.CTA(label: "Hire to review", icon: .pencil) {}
            )
        }
    }

    // Footer

    private var footer: some View {
        HStack(spacing: 18) {
            footerItem(icon: .flag, label: "Report")
            footerItem(icon: .share, label: "Share")
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s4)
    }

    private func footerItem(icon: PantopusIcon, label: String) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(icon, size: 11, color: Theme.Color.appTextMuted)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label)
    }

    private func galleryTile(_ item: BusinessGalleryItem) -> GalleryTile {
        GalleryTile(
            id: item.id,
            imageURL: item.imageURL,
            label: item.label,
            tint: galleryTint(item.tint),
            icon: item.moreCount == nil ? .image : nil,
            moreCount: item.moreCount
        )
    }

    private func galleryTint(_ tint: BusinessGalleryTint) -> Color {
        switch tint {
        case .primary: Theme.Color.business
        case .success: Theme.Color.success
        case .slate: Theme.Color.slate
        case .deep: Theme.Color.businessDark
        }
    }
}

// MARK: - Section header

@MainActor
private struct BizSectionHeader: View {
    let title: String
    var seeAll: String?

    var body: some View {
        HStack {
            Text(title.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            if let seeAll {
                Text(seeAll)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.business)
            }
        }
        .padding(.top, 18)
        .padding(.bottom, 8)
    }
}

// MARK: - About chips (wrapping)

@MainActor
private struct FlowChips: View {
    let chips: [BusinessAboutChip]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(chips) { chip in
                    HStack(spacing: Spacing.s1) {
                        Icon(chip.icon, size: 11, strokeWidth: 2.2, color: Theme.Color.business)
                        Text(chip.label)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.Color.business)
                    }
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(Theme.Color.businessBg)
                    .clipShape(Capsule())
                }
            }
        }
    }
}

// MARK: - Just-opened trust note

@MainActor
private struct JustOpenedNote: View {
    var body: some View {
        HStack(alignment: .top, spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.business)
                    .frame(width: 32, height: 32)
                Icon(.badgeCheck, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Just opened on Pantopus")
                    .font(.system(size: 12.5, weight: .bold))
                    .tracking(-0.1)
                    .foregroundStyle(Theme.Color.businessDark)
                Text("Address and business identity are verified. Reviews and photos build up "
                    + "after the first few jobs — early neighbors set the tone.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.businessBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.business.opacity(0.25), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Service area card

@MainActor
private struct ServiceAreaCard: View {
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
                        .padding(.top, 4)
                    }
                }
                Spacer(minLength: Spacing.s0)
                directionsButton
            }
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

    private var directionsButton: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.navigation, size: 13, color: Theme.Color.business)
            Text("Directions")
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.business)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 7)
        .background(Theme.Color.businessBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityLabel("Directions")
    }
}

// MARK: - Review card

@MainActor
private struct BizReviewCard: View {
    let card: BusinessReviewCard

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: Spacing.s2) {
                ZStack(alignment: .bottomTrailing) {
                    AvatarWithIdentityRing(
                        name: card.reviewerName,
                        imageURL: card.reviewerAvatarURL,
                        identity: .personal,
                        ringProgress: 1,
                        size: 32
                    )
                    if card.verified {
                        VerifiedBadge(size: 13).offset(x: 2, y: 2)
                    }
                }
                .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 1) {
                    Text(card.reviewerName)
                        .font(.system(size: 12.5, weight: .semibold))
                        .tracking(-0.1)
                        .foregroundStyle(Theme.Color.appText)
                    Text(card.timestamp)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                HStack(spacing: 1) {
                    ForEach(0..<5) { index in
                        StarShape()
                            .fill(index < card.rating ? Theme.Color.star : Theme.Color.appBorder)
                            .frame(width: 12, height: 12)
                    }
                }
            }
            if !card.body.isEmpty {
                Text(card.body)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(card.reviewerName), \(card.rating) star review, \(card.timestamp)")
    }
}

// MARK: - Floating controls

@MainActor
private struct FloatingControls: View {
    let onBack: @MainActor () -> Void
    let onShare: @MainActor () -> Void
    let onMore: @MainActor () -> Void
    let showsSave: Bool
    let isSaved: Bool
    let onToggleSavedPlace: @MainActor () -> Void

    var body: some View {
        HStack {
            control(.chevronLeft, label: "Back", action: onBack)
            Spacer()
            HStack(spacing: Spacing.s2) {
                if showsSave {
                    SaveBookmarkButton(isSaved: isSaved, size: 34, onToggle: onToggleSavedPlace)
                }
                control(.share, label: "Share", action: onShare)
                control(.moreHorizontal, label: "More actions", action: onMore)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s2)
    }

    private func control(_ icon: PantopusIcon, label: String, action: @escaping @MainActor () -> Void) -> some View {
        Button { action() } label: {
            Icon(icon, size: 19, color: Theme.Color.appTextInverse)
                .frame(width: 34, height: 34)
                .background(Theme.Color.appText.opacity(0.32))
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

// MARK: - Loading / Not-found / Error layouts

@MainActor
private struct LoadingLayout: View {
    let onBack: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ContentDetailTopBar(title: nil, onBack: onBack, action: nil)
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
                    Shimmer(height: 100, cornerRadius: Radii.lg).padding(.horizontal, Spacing.s4)
                    Shimmer(height: 120, cornerRadius: Radii.lg).padding(.horizontal, Spacing.s4)
                }
                .padding(.bottom, Spacing.s4)
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("businessProfile.loading")
    }
}

@MainActor
private struct NotFoundLayout: View {
    let onBack: @MainActor () -> Void
    let onRetry: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ContentDetailTopBar(title: nil, onBack: onBack, action: nil)
            EmptyState(
                icon: .building2,
                headline: "Business not found",
                subcopy: "This business may have moved or unpublished their profile.",
                cta: EmptyState.CTA(title: "Try again") {
                    await MainActor.run { onRetry() }
                }
            )
            .frame(maxHeight: .infinity)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("businessProfile.notFound")
    }
}

@MainActor
private struct ErrorLayout: View {
    let message: String
    let onBack: @MainActor () -> Void
    let onRetry: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ContentDetailTopBar(title: nil, onBack: onBack, action: nil)
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load this business",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") {
                    await MainActor.run { onRetry() }
                }
            )
            .frame(maxHeight: .infinity)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("businessProfile.error")
    }
}

#Preview("Populated") {
    BusinessProfileLoadedView(
        content: BusinessProfileSampleData.populated,
        isSaved: false,
        onBack: {},
        onShare: {},
        onMore: {},
        onToggleSavedPlace: {},
        onContact: {},
        onBook: {},
        onCall: {}
    )
}

#Preview("Newly claimed + closed") {
    BusinessProfileLoadedView(
        content: BusinessProfileSampleData.newlyClaimed,
        isSaved: false,
        onBack: {},
        onShare: {},
        onMore: {},
        onToggleSavedPlace: {},
        onContact: {},
        onBook: {},
        onCall: {}
    )
}
