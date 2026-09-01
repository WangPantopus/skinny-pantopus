//
//  TransactionalDetailShell.swift
//  Pantopus
//
//  Bespoke shell for the T2.6 Transactional Detail archetype. Three
//  entry points (gig / listing / invoice) share this canvas — the
//  per-entity view-model projects its payload into
//  `ContentDetailContent` and the shell renders the slots.
//
//  Distinct from the read-only `ContentDetailShell` under
//  `Features/Shared/ContentDetail/` — that shell is a generic slot-based
//  scaffold for non-transactional detail surfaces (public profile,
//  pulse post, home dashboard).
//

// swiftlint:disable file_length function_body_length multiple_closures_with_trailing_closure type_body_length

import SwiftUI

/// One row in the top-bar overflow menu. Used by owner-mode listing
/// detail to surface "Edit listing" without crowding the dock.
public struct ContentDetailOverflowItem: Sendable {
    public let label: String
    public let icon: PantopusIcon?
    public let identifier: String
    public let action: @MainActor @Sendable () -> Void
    public let role: ButtonRole?

    public init(
        label: String,
        icon: PantopusIcon? = nil,
        identifier: String,
        role: ButtonRole? = nil,
        action: @escaping @MainActor @Sendable () -> Void
    ) {
        self.label = label
        self.icon = icon
        self.identifier = identifier
        self.role = role
        self.action = action
    }
}

/// Sticky-dock transactional-detail shell.
public struct TransactionalDetailShell: View {
    private let state: ContentDetailState
    private let onBack: @MainActor () -> Void
    private let onPrimaryAction: @MainActor () -> Void
    private let onSecondaryAction: (@MainActor () -> Void)?
    private let onRetry: @MainActor () -> Void
    private let onMessageCounterparty: (@MainActor () -> Void)?
    private let overflowItems: [ContentDetailOverflowItem]
    /// Optional trailing top-bar control rendered before the overflow
    /// menu (e.g. the gig-detail bookmark toggle).
    private let topBarAccessory: AnyView?
    private let scrollFooter: AnyView?

    public init(
        state: ContentDetailState,
        overflowItems: [ContentDetailOverflowItem] = [],
        topBarAccessory: AnyView? = nil,
        onBack: @escaping @MainActor () -> Void,
        onPrimaryAction: @escaping @MainActor () -> Void = {},
        onSecondaryAction: (@MainActor () -> Void)? = nil,
        onRetry: @escaping @MainActor () -> Void = {},
        onMessageCounterparty: (@MainActor () -> Void)? = nil,
        @ViewBuilder scrollFooter: () -> some View = { EmptyView() }
    ) {
        self.state = state
        self.onBack = onBack
        self.onPrimaryAction = onPrimaryAction
        self.onSecondaryAction = onSecondaryAction
        self.onRetry = onRetry
        self.onMessageCounterparty = onMessageCounterparty
        self.overflowItems = overflowItems
        self.topBarAccessory = topBarAccessory
        self.scrollFooter = AnyView(scrollFooter())
    }

    public var body: some View {
        ZStack(alignment: .bottom) {
            switch state {
            case .loading: loadingFrame
            case let .loaded(content):
                loadedFrame(content)
            case let .error(message): errorFrame(message: message)
            }
        }
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("contentDetailShell")
    }

    // MARK: - Frames

    private var loadingFrame: some View {
        VStack(spacing: Spacing.s0) {
            topNav(trailing: trailingOverflow(transparent: false), transparent: false)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    Shimmer(height: 200, cornerRadius: Radii.lg)
                    Shimmer(width: 240, height: 20, cornerRadius: Radii.sm)
                    Shimmer(width: 160, height: 14, cornerRadius: Radii.xs)
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        ForEach(0..<4, id: \.self) { _ in
                            Shimmer(height: 14, cornerRadius: Radii.xs)
                        }
                    }
                    .padding(.top, Spacing.s2)
                }
                .padding(Spacing.s4)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading detail")
        .accessibilityIdentifier("contentDetailLoading")
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            topNav(trailing: trailingOverflow(transparent: false), transparent: false)
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load detail")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button(action: onRetry) {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 22)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("contentDetailRetry")
            Spacer()
        }
        .padding(Spacing.s5)
        .accessibilityIdentifier("contentDetailError")
    }

    private func loadedFrame(_ content: ContentDetailContent) -> some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(spacing: Spacing.s0) {
                    if let cover = content.cover {
                        coverView(cover)
                    }
                    if content.cover == nil {
                        topNav(trailing: trailingOverflow(transparent: false), transparent: false)
                    }
                    contentBody(content)
                    scrollFooter
                    Spacer(minLength: 110)
                }
            }
            .scrollIndicators(.hidden)
            if let cover = content.cover {
                topNav(trailing: glassTrailing(cover.glassActions), transparent: true)
                    .frame(maxHeight: .infinity, alignment: .top)
            }
            stickyDock(content.dock)
        }
    }

    /// Build the trailing-nav chrome: optional accessory (bookmark, …)
    /// followed by the overflow control. Returns `nil` when neither is
    /// wired, which short-circuits to the bare back-only top bar.
    @MainActor
    private func trailingOverflow(transparent: Bool) -> AnyView? {
        let overflow: AnyView? = overflowItems.isEmpty
            ? nil
            : AnyView(OverflowMenuButton(items: overflowItems, transparent: transparent))
        switch (topBarAccessory, overflow) {
        case (nil, nil):
            return nil
        case let (accessory?, nil):
            return accessory
        case let (nil, overflow?):
            return overflow
        case let (accessory?, overflow?):
            return AnyView(
                HStack(spacing: 4) {
                    accessory
                    overflow
                }
            )
        }
    }

    /// Trailing chrome for the cover-overlay (transparent) top bar:
    /// decorative glass action chips (share / bookmark) followed by any
    /// overflow menu. Falls back to the overflow-only control when no
    /// glass actions are wired.
    @MainActor
    private func glassTrailing(_ icons: [PantopusIcon]) -> AnyView? {
        guard !icons.isEmpty else { return trailingOverflow(transparent: true) }
        return AnyView(
            HStack(spacing: 4) {
                if let topBarAccessory {
                    topBarAccessory
                }
                ForEach(Array(icons.enumerated()), id: \.offset) { _, icon in
                    Icon(icon, size: 18, strokeWidth: 2, color: Theme.Color.appText)
                        .frame(width: 36, height: 36)
                        .background(Color.white.opacity(0.85))
                        .clipShape(Circle())
                }
                if !overflowItems.isEmpty {
                    OverflowMenuButton(items: overflowItems, transparent: true)
                }
            }
            .accessibilityIdentifier("contentDetailGlassActions")
        )
    }

    private func contentBody(_ content: ContentDetailContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            heroBlock(content)
            if !content.statStrip.isEmpty {
                statStrip(content.statStrip)
                    .padding(.horizontal, Spacing.s5)
                    .padding(.top, 18)
            }
            if let counterparty = content.counterparty {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    if content.kind == .gig {
                        Text("Posted By")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                            .accessibilityIdentifier("contentDetailPostedByHeader")
                    }
                    counterpartyCard(counterparty)
                }
                .padding(.horizontal, Spacing.s5)
                .padding(.top, 18)
            }
            ForEach(content.modules) { module in
                moduleView(module)
                    .padding(.top, 22)
            }
            if !content.trustCapsules.isEmpty {
                trustCapsuleWrap(content.trustCapsules)
                    .padding(.horizontal, Spacing.s5)
                    .padding(.top, Spacing.s5)
            }
        }
    }

    // MARK: - Top nav

    private func topNav(trailing: AnyView?, transparent: Bool) -> some View {
        HStack {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 20, strokeWidth: 2.2, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
                    .background(transparent ? Color.white.opacity(0.85) : Color.clear)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("contentDetailBackButton")
            Spacer()
            if let trailing { trailing }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(transparent ? Color.clear : Theme.Color.appSurface)
    }

    // MARK: - Cover

    private func coverView(_ cover: ContentDetailCover) -> some View {
        ZStack(alignment: .bottom) {
            ZStack {
                LinearGradient(
                    colors: [cover.gradient.start, cover.gradient.end],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .frame(height: 300)
                if let url = cover.imageUrl {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case let .success(image):
                            image.resizable().aspectRatio(contentMode: .fill)
                        default:
                            Icon(cover.placeholderIcon, size: 56, strokeWidth: 1.6, color: .white.opacity(0.85))
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: 300)
                    .clipped()
                } else {
                    Icon(cover.placeholderIcon, size: 56, strokeWidth: 1.6, color: .white.opacity(0.85))
                        .frame(maxWidth: .infinity, maxHeight: 300)
                }
            }
            .grayscale(cover.sold ? 0.85 : 0)
            .brightness(cover.sold ? -0.06 : 0)
            if cover.sold {
                soldStamp
            }
            if cover.pageCount > 1 {
                HStack(spacing: 5) {
                    ForEach(0..<cover.pageCount, id: \.self) { i in
                        Capsule()
                            .fill(i == cover.activePage ? .white : .white.opacity(0.6))
                            .frame(width: i == cover.activePage ? 18 : 5, height: 5)
                    }
                }
                .padding(.bottom, 14)
            }
        }
        .frame(height: 280)
        .clipped()
        .accessibilityIdentifier("contentDetailCover")
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(cover.sold ? "Sold" : "Photo")
    }

    /// Tilted "SOLD" stamp overlaid on the desaturated hero (listing sold).
    private var soldStamp: some View {
        Text("SOLD")
            .font(.system(size: 28, weight: .black))
            .kerning(4)
            .foregroundStyle(Theme.Color.error.opacity(0.92))
            .padding(.horizontal, 28)
            .padding(.vertical, 10)
            .background(Color.white.opacity(0.85))
            .overlay(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .stroke(Theme.Color.error.opacity(0.85), lineWidth: 3)
            )
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            .rotationEffect(.degrees(-12))
            .accessibilityIdentifier("contentDetailSoldStamp")
    }

    // MARK: - Hero

    @ViewBuilder
    private func heroBlock(_ content: ContentDetailContent) -> some View {
        if content.kind == .listing {
            listingHero(content)
        } else {
            standardHero(content)
        }
    }

    /// Gig + invoice ordering: status pill → mono ref → title → subtitle →
    /// price.
    private func standardHero(_ content: ContentDetailContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            if let pill = content.statusPill {
                statusPillView(pill)
                    .padding(.top, Spacing.s1)
                    .padding(.leading, Spacing.s5)
            }
            if let monoId = content.hero.monoId {
                Text(monoId)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.leading, Spacing.s5)
                    .padding(.top, 10)
            }
            heroTitle(content.hero.title)
                .padding(.top, content.hero.monoId == nil ? 4 : 6)
            if content.hero.categoryChip != nil || content.hero.meta != nil {
                heroSubtitle(content.hero)
                    .padding(.horizontal, Spacing.s5)
                    .padding(.top, 10)
            }
            if content.hero.priceLine != nil {
                priceBlock(content.hero, kind: content.kind)
                    .padding(.horizontal, Spacing.s5)
                    .padding(.top, 18)
            }
        }
    }

    /// Listing ordering: optional sold pill (+ age meta) → price (struck +
    /// sale tag) → title → inline condition/pickup/distance pills.
    private func listingHero(_ content: ContentDetailContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            if let pill = content.statusPill {
                HStack(spacing: 10) {
                    statusPillView(pill)
                    if let meta = content.hero.meta {
                        Text(meta)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .padding(.top, Spacing.s1)
                .padding(.leading, Spacing.s5)
            }
            if content.hero.priceLine != nil {
                priceBlock(content.hero, kind: content.kind)
                    .padding(.horizontal, Spacing.s5)
                    .padding(.top, content.statusPill == nil ? 18 : 12)
            }
            heroTitle(content.hero.title)
                .padding(.top, 10)
            if !content.hero.inlinePills.isEmpty {
                FlowLayoutCompat(spacing: 6) {
                    ForEach(content.hero.inlinePills) { statusPillView($0) }
                }
                .padding(.horizontal, Spacing.s5)
                .padding(.top, 10)
            }
        }
    }

    private func heroTitle(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 22, weight: .bold))
            .foregroundStyle(Theme.Color.appText)
            .lineLimit(3)
            .padding(.horizontal, Spacing.s5)
            .accessibilityAddTraits(.isHeader)
    }

    private func priceBlock(_ hero: ContentDetailHero, kind: ContentDetailKind) -> some View {
        let priceColor: Color = {
            if hero.priceStrikethrough { return Theme.Color.appTextSecondary }
            if hero.priceTone == .success { return Theme.Color.success }
            return kind == .listing ? Theme.Color.primary600 : Theme.Color.appText
        }()
        return HStack(alignment: hero.priceCheckDisc ? .center : .lastTextBaseline, spacing: Spacing.s2) {
            Text(hero.priceLine ?? "")
                .font(.system(size: 32, weight: .heavy).monospacedDigit())
                .strikethrough(hero.priceStrikethrough, color: Theme.Color.appTextSecondary)
                .foregroundStyle(priceColor)
            if let saleTag = hero.saleTag {
                Text(saleTag)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.success)
            }
            if hero.priceCheckDisc {
                ZStack {
                    Circle().fill(Theme.Color.success).frame(width: 28, height: 28)
                    Icon(.check, size: 15, strokeWidth: 3, color: .white)
                }
                .accessibilityHidden(true)
            }
            if hero.saleTag == nil, let caption = hero.priceCaption {
                Text(caption)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            if let trailing = hero.priceTrailingLabel {
                Spacer(minLength: Spacing.s2)
                Text(trailing)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    private func heroSubtitle(_ hero: ContentDetailHero) -> some View {
        HStack(spacing: Spacing.s2) {
            if let chip = hero.categoryChip {
                Text(chip.label.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(chip.category.color)
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, 2)
                    .background(chip.category.color.opacity(0.12))
                    .clipShape(Capsule())
            }
            if let meta = hero.meta {
                Text(meta)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    private func statusPillView(_ pill: ContentDetailPill) -> some View {
        HStack(spacing: 5) {
            if let icon = pill.icon {
                Icon(icon, size: 11, strokeWidth: 2.4, color: pillForeground(pill.tone))
            }
            Text(pill.label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(pillForeground(pill.tone))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, Spacing.s1)
        .background(pillBackground(pill.tone))
        .clipShape(Capsule())
    }

    private func pillForeground(_ tone: ContentDetailPill.Tone) -> Color {
        switch tone {
        case .info: Theme.Color.primary700
        case .success: Theme.Color.success
        case .warning: Theme.Color.warning
        case .business: Theme.Color.business
        case .neutral: Theme.Color.appTextSecondary
        case .error: Theme.Color.error
        }
    }

    private func pillBackground(_ tone: ContentDetailPill.Tone) -> Color {
        switch tone {
        case .info: Theme.Color.primary50
        case .success: Theme.Color.successBg
        case .warning: Theme.Color.warningBg
        case .business: Theme.Color.businessBg
        case .neutral: Theme.Color.appSurfaceSunken
        case .error: Theme.Color.errorBg
        }
    }

    // MARK: - Stat strip

    private func statStrip(_ stats: [ContentDetailStat]) -> some View {
        HStack(spacing: Spacing.s0) {
            ForEach(Array(stats.enumerated()), id: \.element.id) { index, stat in
                VStack(spacing: 2) {
                    Text(stat.top)
                        .font(.system(size: 13.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(stat.bottom)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity)
                if index < stats.count - 1 {
                    Divider()
                        .frame(width: 1, height: 28)
                        .background(Color.black.opacity(0.10))
                }
            }
        }
        .padding(10)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("contentDetailStatStrip")
    }

    // MARK: - Counterparty

    private func counterpartyCard(_ party: ContentDetailCounterparty) -> some View {
        HStack(spacing: Spacing.s3) {
            AvatarView(initials: party.initials, verified: party.verified, size: 44, imageUrl: party.avatarUrl)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(party.displayName)
                        .font(.system(size: 13.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    if let kind = party.identityKind {
                        identityChip(kind)
                    }
                }
                HStack(spacing: Spacing.s1) {
                    if let rating = party.rating {
                        Icon(.star, size: 10, color: Theme.Color.warning)
                        Text(String(format: "%.1f", rating))
                            .font(.system(size: 11.5, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    if let trailing = party.trailing {
                        Text(party.rating == nil ? trailing : " · \(trailing)")
                            .font(.system(size: 11.5, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
            }
            Spacer(minLength: Spacing.s0)
            if party.showsMessageButton, let onMessage = onMessageCounterparty {
                Button(action: onMessage) {
                    Icon(.messageCircle, size: 16, strokeWidth: 2.2, color: Theme.Color.primary600)
                        .frame(width: 36, height: 36)
                        .background(Theme.Color.primary50)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Message")
                .accessibilityIdentifier("contentDetailCounterpartyMessage")
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityIdentifier("contentDetailCounterparty")
    }

    private func identityChip(_ kind: String) -> some View {
        let label = kind == "business" ? "Business" : "Personal"
        let bg: Color = kind == "business" ? Theme.Color.businessBg : Theme.Color.primary50
        let fg: Color = kind == "business" ? Theme.Color.business : Theme.Color.primary700
        return HStack(spacing: 3) {
            Icon(kind == "business" ? .shieldCheck : .user, size: 8, strokeWidth: 2.6, color: fg)
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(fg)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 1)
        .background(bg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
    }

    // MARK: - Modules

    @ViewBuilder
    // swiftlint:disable:next cyclomatic_complexity
    private func moduleView(_ module: ContentDetailModule) -> some View {
        switch module {
        case let .description(m):
            sectionCard(title: m.title, icon: m.icon) {
                Text(m.body)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        case let .detailRow(m):
            sectionCard(title: m.title, icon: m.sectionIcon) {
                HStack(spacing: Spacing.s2) {
                    Icon(m.rowIcon, size: 14, color: Theme.Color.primary600)
                    Text(m.label)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer()
                    if let trailing = m.trailing {
                        Text(trailing)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, 10)
                .background(Theme.Color.appSurfaceSunken)
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        case let .captionedText(m):
            sectionCard(title: m.title, icon: m.icon) {
                Text(m.label)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        case let .twoStop(m):
            sectionCard(title: m.title, icon: m.icon) {
                twoStopCard(m.stops)
            }
        case let .capsuleRow(m):
            FlowLayoutCompat(spacing: 6) {
                ForEach(m.capsules) { statusPillView($0) }
            }
            .padding(.horizontal, Spacing.s5)
        case let .detailsGrid(m):
            sectionCard(title: m.title, icon: m.icon) {
                detailsGrid(m.rows)
            }
        case let .callout(m):
            calloutCard(m)
                .padding(.horizontal, Spacing.s5)
        case let .photoStrip(m):
            sectionCard(title: m.title, icon: m.icon, sub: m.countLabel) {
                HStack(spacing: Spacing.s2) {
                    ForEach(m.tiles) { tile in
                        photoTile(tile)
                    }
                }
            }
        case let .similarItems(m):
            sectionCard(title: m.title, icon: nil, sub: m.sub) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(m.items) { item in
                            VStack(alignment: .leading, spacing: 6) {
                                LinearGradient(
                                    colors: [item.gradient.start, item.gradient.end],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                                .frame(width: 120, height: 120)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                Text(item.title)
                                    .font(.system(size: 11.5, weight: .semibold))
                                    .foregroundStyle(Theme.Color.appText)
                                    .lineLimit(1)
                                Text(item.price)
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(Theme.Color.primary600)
                            }
                            .frame(width: 120)
                        }
                    }
                }
            }
        case let .bids(m):
            sectionCard(title: m.title, icon: nil, sub: m.sub) {
                bidsTable(m.bids)
            }
        case let .locationMap(m):
            ContentDetailLocationMapView(map: m)
        case .fromTo, .lineItems, .summary:
            invoiceModuleView(module)
        }
    }

    /// Invoice-only modules, split out to keep `moduleView`'s cyclomatic
    /// complexity under the SwiftLint threshold.
    @ViewBuilder
    private func invoiceModuleView(_ module: ContentDetailModule) -> some View {
        switch module {
        case let .fromTo(m):
            HStack(spacing: Spacing.s2) {
                partyCard(m.from)
                partyCard(m.to)
            }
            .padding(.horizontal, Spacing.s5)
        case let .lineItems(m):
            sectionCard(title: m.title, icon: m.icon) {
                lineItemsTable(m)
            }
        case let .summary(m):
            summaryCard(m)
                .padding(.horizontal, Spacing.s5)
        default:
            EmptyView()
        }
    }

    /// One photo-strip square. Renders the real attachment when the tile
    /// carries a URL, falling back to the deterministic gradient + glyph
    /// while it loads or when there is no image.
    private func photoTile(_ tile: ContentDetailPhotoTile) -> some View {
        LinearGradient(
            colors: [tile.gradient.start, tile.gradient.end],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .aspectRatio(1, contentMode: .fit)
        .overlay {
            if let url = tile.imageURL {
                AsyncImage(url: url) { phase in
                    if case let .success(image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        Icon(tile.icon, size: 24, strokeWidth: 1.8, color: .white.opacity(0.9))
                    }
                }
            } else {
                Icon(tile.icon, size: 24, strokeWidth: 1.8, color: .white.opacity(0.9))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func sectionCard(
        title: String,
        icon: PantopusIcon?,
        sub: String? = nil,
        @ViewBuilder content: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: 6) {
                if let icon { Icon(icon, size: 13, color: Theme.Color.appTextSecondary) }
                Text(title.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .kerning(1.2)
                if let sub {
                    Text("· \(sub)")
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            content()
        }
        .padding(.horizontal, Spacing.s5)
    }

    private func bidsTable(_ rows: [ContentDetailBidRow]) -> some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, bid in
                bidRow(bid)
                if index < rows.count - 1 {
                    Divider().background(Theme.Color.appBorder.opacity(0.5))
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private func bidRow(_ bid: ContentDetailBidRow) -> some View {
        let amountColor: Color = bid.won ? Theme.Color.success : (bid.dimmed ? Theme.Color.appTextSecondary : Theme.Color.primary600)
        return HStack(spacing: 10) {
            AvatarView(initials: bid.initials, verified: bid.verified, size: 36)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    Text(bid.displayName)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    if bid.won {
                        bidTagPill("Winner", foreground: Theme.Color.success, background: Theme.Color.successBg)
                    } else if let tag = bid.tag {
                        bidTagPill(tag, foreground: Theme.Color.primary700, background: Theme.Color.primary50)
                    }
                }
                HStack(spacing: Spacing.s1) {
                    Icon(.star, size: 9, color: Theme.Color.warning)
                    Text(bid.ratingLine)
                        .font(.system(size: 10.5, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer()
            Text(bid.amount)
                .font(.system(size: 14, weight: .bold))
                .strikethrough(bid.dimmed)
                .foregroundStyle(amountColor)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        .background(bid.won ? Theme.Color.successBg : Color.clear)
        .opacity(bid.dimmed ? 0.55 : 1)
    }

    private func bidTagPill(_ text: String, foreground: Color, background: Color) -> some View {
        Text(text.uppercased())
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(foreground)
            .padding(.horizontal, 5)
            .padding(.vertical, 1)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
    }

    // MARK: - Two-stop / details grid / callout

    private func twoStopCard(_ stops: [ContentDetailTwoStop.Stop]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(stops.enumerated()), id: \.element.id) { index, stop in
                HStack(spacing: Spacing.s2) {
                    Text(stop.letter)
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(stop.tone == .primary ? Theme.Color.primary700 : Theme.Color.success)
                        .frame(width: 14, height: 14)
                        .background(stop.tone == .primary ? Theme.Color.primary100 : Theme.Color.successBg)
                        .clipShape(Circle())
                    Text(stop.address)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: Spacing.s2)
                    if let distance = stop.distance {
                        Text(distance)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                if index < stops.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorder)
                        .frame(width: 1, height: 10)
                        .padding(.leading, 6)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func detailsGrid(_ rows: [ContentDetailDetailsGrid.Row]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ForEach(rows) { row in
                HStack(alignment: .top, spacing: Spacing.s4) {
                    Text(row.key)
                        .font(.system(size: 12.5, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(width: 96, alignment: .leading)
                    Text(row.value)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func calloutCard(_ callout: ContentDetailCallout) -> some View {
        Group {
            switch callout.style {
            case .banner: calloutBanner(callout)
            case .empty: calloutEmpty(callout)
            }
        }
        .accessibilityIdentifier("contentDetailCallout_\(callout.identifier)")
    }

    private func calloutBanner(_ callout: ContentDetailCallout) -> some View {
        HStack(spacing: 10) {
            calloutIconDisc(callout.iconTone, icon: callout.icon)
            VStack(alignment: .leading, spacing: 1) {
                Text(callout.title)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(callout.tone == .success ? Theme.Color.success : Theme.Color.appText)
                if let subtitle = callout.subtitle {
                    Text(subtitle)
                        .font(.system(size: 11, weight: .medium, design: callout.subtitleMono ? .monospaced : .default))
                        .foregroundStyle(callout.tone == .success ? Theme.Color.success : Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s2)
            if let action = callout.trailingActionLabel {
                Text(action)
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .padding(.horizontal, Spacing.s3)
                    .frame(height: 30)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .background(calloutBackground(callout.tone))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(callout.tone == .success ? Theme.Color.success.opacity(0.4) : Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private func calloutEmpty(_ callout: ContentDetailCallout) -> some View {
        VStack(spacing: Spacing.s1) {
            calloutIconDisc(callout.iconTone, icon: callout.icon, size: 42)
                .padding(.bottom, Spacing.s1)
            Text(callout.title)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            if let subtitle = callout.subtitle {
                Text(subtitle)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 240)
            }
            if let footer = callout.footerPill {
                HStack(spacing: 5) {
                    Icon(.eye, size: 11, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                    Text(footer)
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, Spacing.s1)
                .background(Theme.Color.appSurface)
                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
                .clipShape(Capsule())
                .padding(.top, Spacing.s2)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 18)
        .padding(.vertical, 20)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, style: StrokeStyle(lineWidth: 1.5, dash: [5]))
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private func calloutBackground(_ tone: ContentDetailCallout.Tone) -> Color {
        switch tone {
        case .success: Theme.Color.successBg
        case .neutral, .dashed: Theme.Color.appSurfaceMuted
        }
    }

    @ViewBuilder
    private func calloutIconDisc(_ tone: ContentDetailCallout.IconTone, icon: PantopusIcon, size: CGFloat = 30) -> some View {
        switch tone {
        case .success:
            ZStack {
                Circle().fill(Theme.Color.success)
                Icon(icon, size: size * 0.5, strokeWidth: 2.6, color: .white)
            }
            .frame(width: size, height: size)
        case .successOutline:
            ZStack {
                Circle().fill(Theme.Color.appSurface)
                    .overlay(Circle().stroke(Theme.Color.success, lineWidth: 1.5))
                Icon(icon, size: size * 0.47, strokeWidth: 2.4, color: Theme.Color.success)
            }
            .frame(width: size, height: size)
        case .primary:
            ZStack {
                Circle().fill(Theme.Color.primary50)
                Icon(icon, size: size * 0.47, strokeWidth: 2, color: Theme.Color.primary600)
            }
            .frame(width: size, height: size)
        }
    }

    private func partyCard(_ party: ContentDetailParty) -> some View {
        let accentColor: Color = switch party.accent {
        case .business: Theme.Color.business
        case .personal: Theme.Color.primary600
        case .neutral: Theme.Color.appTextSecondary
        }
        return VStack(alignment: .leading, spacing: 6) {
            Text(party.label.uppercased())
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Theme.Color.appTextMuted)
                .kerning(1.2)
            Text(party.name)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            HStack(spacing: 3) {
                Circle().fill(accentColor).frame(width: 6, height: 6)
                Text(party.sub)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(accentColor)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private func lineItemsTable(_ module: ContentDetailLineItems) -> some View {
        VStack(spacing: Spacing.s0) {
            HStack {
                Text("Item")
                Text("Qty")
                    .frame(width: 36, alignment: .center)
                Text("Unit")
                    .frame(width: 60, alignment: .trailing)
                Text("Total")
                    .frame(width: 60, alignment: .trailing)
            }
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(Theme.Color.appTextMuted)
            .kerning(0.8)
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurfaceMuted)
            ForEach(Array(module.rows.enumerated()), id: \.element.id) { _, row in
                HStack(spacing: Spacing.s0) {
                    Text(row.item)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.Color.appText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(row.qty)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(width: 36, alignment: .center)
                    Text(row.unit)
                        .font(.system(size: 12).monospacedDigit())
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(width: 60, alignment: .trailing)
                    Text(row.total)
                        .font(.system(size: 12, weight: .semibold).monospacedDigit())
                        .foregroundStyle(Theme.Color.appText)
                        .frame(width: 60, alignment: .trailing)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, 10)
                Divider().background(Theme.Color.appBorder.opacity(0.5))
            }
            if !module.fees.isEmpty || module.totalValue != nil {
                lineItemsFooter(module)
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    /// Fees / tax block + grand-total row, rendered in the muted footer of
    /// the line-items card per the A09.4 design.
    private func lineItemsFooter(_ module: ContentDetailLineItems) -> some View {
        VStack(spacing: Spacing.s0) {
            ForEach(module.fees) { fee in
                HStack {
                    Text(fee.label)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextStrong)
                    Spacer()
                    Text(fee.value)
                        .font(.system(size: 12, weight: .medium).monospacedDigit())
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
                .padding(.vertical, 4)
            }
            if let totalValue = module.totalValue {
                Rectangle().fill(Theme.Color.appBorder).frame(height: 1).padding(.vertical, Spacing.s1)
                HStack(alignment: .lastTextBaseline) {
                    Text(module.totalLabel ?? "Total")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer()
                    Text(totalValue)
                        .font(.system(size: 16, weight: .heavy).monospacedDigit())
                        .foregroundStyle(module.totalTone == .success ? Theme.Color.success : Theme.Color.primary600)
                }
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceMuted)
    }

    private func summaryCard(_ summary: ContentDetailSummary) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ForEach(summary.rows) { row in
                HStack {
                    Text(row.label)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextStrong)
                    Spacer()
                    Text(row.value)
                        .font(.system(size: 13, weight: .medium).monospacedDigit())
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
            }
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1).padding(.vertical, 2)
            HStack(alignment: .lastTextBaseline) {
                Text(summary.totalLabel)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                Text(summary.totalValue)
                    .font(.system(size: 16, weight: .bold).monospacedDigit())
                    .foregroundStyle(summary.totalTone == .success ? Theme.Color.success : Theme.Color.primary600)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    // MARK: - Trust capsules

    private func trustCapsuleWrap(_ capsules: [ContentDetailTrustCapsule]) -> some View {
        FlowLayoutCompat(spacing: 6) {
            ForEach(capsules) { capsule in
                statusPillView(capsule)
            }
        }
    }

    // MARK: - Sticky dock

    private func stickyDock(_ dock: ContentDetailDock) -> some View {
        HStack(spacing: 10) {
            if let secondary = dock.secondary {
                Button(action: { onSecondaryAction?() }) {
                    HStack(spacing: 6) {
                        if let icon = secondary.icon {
                            Icon(icon, size: 15, strokeWidth: 2.2, color: Theme.Color.appText)
                        }
                        Text(secondary.label)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                    }
                    .padding(.horizontal, 18)
                    .frame(height: 48)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("contentDetailDockSecondary")
            }
            Button(action: { if dock.primary.enabled { onPrimaryAction() } }) {
                HStack(spacing: 6) {
                    if let icon = dock.primary.icon {
                        Icon(
                            icon,
                            size: 16,
                            strokeWidth: 2.2,
                            color: dock.primary.enabled ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary
                        )
                    }
                    Text(dock.primary.label)
                        .font(.system(size: 14.5, weight: .bold))
                        .foregroundStyle(dock.primary.enabled ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(dock.primary.enabled ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(dock.primary.enabled ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .shadow(
                    color: dock.primary.enabled ? Theme.Color.primary600.opacity(0.30) : Color.clear,
                    radius: 8,
                    x: 0,
                    y: 6
                )
            }
            .buttonStyle(.plain)
            .disabled(!dock.primary.enabled)
            .accessibilityIdentifier("contentDetailDockPrimary")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s6)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("contentDetailDock")
    }
}

// MARK: - Avatar + Flow layout

private struct AvatarView: View {
    let initials: String
    let verified: Bool
    let size: CGFloat
    var imageUrl: URL?

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Group {
                if let imageUrl {
                    AsyncImage(url: imageUrl) { phase in
                        switch phase {
                        case let .success(image):
                            image.resizable().scaledToFill()
                        default:
                            initialsCircle
                        }
                    }
                } else {
                    initialsCircle
                }
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
            if verified {
                ZStack {
                    Circle()
                        .fill(Theme.Color.primary600)
                        .frame(width: size * 0.36, height: size * 0.36)
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                    Icon(.check, size: size * 0.18, strokeWidth: 3, color: .white)
                }
                .offset(x: 2, y: 2)
            }
        }
    }

    private var initialsCircle: some View {
        Circle()
            .fill(Theme.Color.primary500)
            .overlay(
                Text(initials)
                    .font(.system(size: size * 0.36, weight: .bold))
                    .foregroundStyle(.white)
            )
    }
}

/// Minimal flow-layout shim using `Layout` (iOS 16+) so the shell can
/// wrap an unknown number of trust capsules without adding a third-party
/// package.
private struct FlowLayoutCompat: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var lineHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > maxWidth {
                x = 0
                y += lineHeight + spacing
                lineHeight = 0
            }
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: maxWidth, height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var lineHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX {
                x = bounds.minX
                y += lineHeight + spacing
                lineHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}

// MARK: - Overflow menu

/// Trailing top-bar overflow ("...") menu. Renders nothing when the
/// items list is empty so the bare back-only top bar still hits the
/// same layout. The transparent variant matches the cover-overlay
/// chrome — same white-fill chip used for the back button.
private struct OverflowMenuButton: View {
    let items: [ContentDetailOverflowItem]
    let transparent: Bool

    var body: some View {
        Menu {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                Button(role: item.role) {
                    item.action()
                } label: {
                    Text(item.label)
                }
                .accessibilityIdentifier(item.identifier)
            }
        } label: {
            Icon(.moreVertical, size: 20, strokeWidth: 2.2, color: Theme.Color.appText)
                .frame(width: 36, height: 36)
                .background(transparent ? Color.white.opacity(0.85) : Color.clear)
                .clipShape(Circle())
        }
        .accessibilityLabel("More actions")
        .accessibilityIdentifier("contentDetailOverflowMenu")
    }
}
