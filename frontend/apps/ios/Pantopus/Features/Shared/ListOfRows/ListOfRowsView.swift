//
//  ListOfRowsView.swift
//  Pantopus
//
//  Renderer for the List-of-Rows archetype. Concrete screens point it at
//  an `ObservableObject`-style data source and do nothing else.
//
//  T5.0 — extended additively. Original render path (icon-leading +
//  chevron/chip-trailing, no body/chips/footer/highlight) is unchanged
//  pixel-for-pixel. New row affordances are opt-in via new optional
//  fields on `RowModel` and new cases on `RowLeading` / `RowTrailing`.
//

import SwiftUI

// swiftlint:disable file_length

// MARK: - Shell

/// List-of-rows shell.
///
/// T6.4c — extended additively with a `customHeader` view-builder slot.
/// The shell renders the slot between the chrome (search / chip / tab
/// strip) and the state body. The slot is generic over a `Header: View`
/// so concrete screens can hand the shell arbitrary feature-local chrome
/// without leaking that view's type into the shell. The Home calendar's
/// `MonthStripHeader` is the only consumer today; every existing call
/// site keeps compiling because the convenience init below defaults
/// `Header` to `EmptyView`.
public struct ListOfRowsView<DataSource: ListOfRowsDataSource, Header: View>: View {
    @Bindable private var dataSource: DataSource
    private let customHeader: Header

    /// Full init — provide a custom header view that renders between the
    /// chrome strip (search / chip / tab) and the state body.
    public init(
        dataSource: DataSource,
        @ViewBuilder customHeader: () -> Header
    ) {
        self.dataSource = dataSource
        self.customHeader = customHeader()
    }

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            VStack(spacing: Spacing.s0) {
                if let searchBar = dataSource.searchBar {
                    SearchBarRow(config: searchBar)
                    Divider().background(Theme.Color.appBorderSubtle)
                }
                if let chipStrip = dataSource.chipStrip {
                    ChipStripRow(config: chipStrip)
                    Divider().background(Theme.Color.appBorderSubtle)
                } else if !dataSource.tabs.isEmpty {
                    TabStrip(
                        tabs: dataSource.tabs,
                        selected: $dataSource.selectedTab
                    )
                    .background(Theme.Color.appSurface)
                    Divider().background(Theme.Color.appBorderSubtle)
                }
                customHeader
                stateBody
            }
            if let fab = dataSource.fab {
                FABButton(action: fab)
                    .padding(Spacing.s4)
            }
        }
        .accessibilityIdentifier("listOfRowsContainer")
        .navigationTitle(dataSource.topBarSubtitle == nil ? dataSource.title : "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let subtitle = dataSource.topBarSubtitle {
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 2) {
                        Text(dataSource.title)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                            .accessibilityAddTraits(.isHeader)
                        Text(subtitle)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("listOfRowsTopBarTitle")
                }
            }
            if let action = dataSource.topBarAction {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: action.handler) {
                        if let label = action.label {
                            Text(label)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(
                                    action.isEnabled
                                        ? Theme.Color.primary600
                                        : Theme.Color.appTextMuted
                                )
                        } else {
                            Icon(
                                action.icon,
                                size: 22,
                                color: action.isEnabled
                                    ? Theme.Color.appText
                                    : Theme.Color.appTextMuted
                            )
                            .overlay(alignment: .topTrailing) {
                                if let count = action.badgeCount, count > 0 {
                                    TopBarActionBadge(count: count)
                                        .offset(x: 7, y: -7)
                                }
                            }
                        }
                    }
                    .disabled(!action.isEnabled)
                    .accessibilityLabel(action.accessibilityLabel)
                    .accessibilityIdentifier("listOfRowsTopBarAction")
                }
            }
        }
        .task { await dataSource.load() }
    }

    @ViewBuilder private var stateBody: some View {
        switch dataSource.state {
        case .loading:
            LoadingRows()
        case let .loaded(sections, hasMore):
            LoadedList(
                sections: sections,
                hasMore: hasMore,
                banner: dataSource.banner,
                listingContext: dataSource.listingContext,
                monoFooter: dataSource.monoFooter,
                onEndReached: { Task { await dataSource.loadMoreIfNeeded() } },
                onRefresh: { await dataSource.refresh() }
            )
        case let .empty(content):
            EmptyState(
                icon: content.icon,
                headline: content.headline,
                subcopy: content.subcopy,
                cta: content.ctaTitle.flatMap { title in
                    guard let handler = content.onCTA else { return nil }
                    return EmptyState.CTA(title: title) { await MainActor.run { handler() } }
                },
                tint: content.tint ?? Theme.Color.personalBg,
                accent: content.accent ?? Theme.Color.primary600
            )
        case let .error(message):
            ListOfRowsErrorBanner(message: message) { Task { await dataSource.load() } }
        }
    }
}

/// Convenience init for the common case where no custom header is
/// needed. Preserves the pre-T6.4c call-site shape — every existing
/// `ListOfRowsView(dataSource: …)` site compiles unchanged because
/// Swift infers `Header == EmptyView` from this overload.
public extension ListOfRowsView where Header == EmptyView {
    init(dataSource: DataSource) {
        self.init(dataSource: dataSource) {
            EmptyView()
        }
    }
}

// MARK: - Top-bar action badge

/// Small count badge rendered over a top-bar icon action (e.g. the
/// active-filter count on the Discover surfaces' `sliders-horizontal`
/// button). Hidden by the call site when the count is `nil` / `0`.
private struct TopBarActionBadge: View {
    let count: Int

    var body: some View {
        Text("\(count)")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .padding(.horizontal, Spacing.s1)
            .frame(minWidth: 16, minHeight: 16)
            .background(Theme.Color.primary600)
            .clipShape(Capsule())
            .accessibilityHidden(true)
            .accessibilityIdentifier("listOfRowsTopBarActionBadge")
    }
}

// MARK: - Tab strip

private struct TabStrip: View {
    let tabs: [ListOfRowsTab]
    @Binding var selected: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s4) {
                ForEach(tabs) { tab in
                    Button { selected = tab.id } label: {
                        VStack(spacing: Spacing.s1) {
                            HStack(spacing: Spacing.s1) {
                                Text(tab.label)
                                    .pantopusTextStyle(.small)
                                    .foregroundStyle(
                                        selected == tab.id
                                            ? Theme.Color.primary600
                                            : Theme.Color.appTextSecondary
                                    )
                                if let count = tab.count {
                                    Text("\(count)")
                                        .pantopusTextStyle(.caption)
                                        .foregroundStyle(
                                            selected == tab.id
                                                ? Theme.Color.primary600
                                                : Theme.Color.appTextMuted
                                        )
                                }
                            }
                            Rectangle()
                                .fill(selected == tab.id ? Theme.Color.primary600 : .clear)
                                .frame(height: 2)
                        }
                        .frame(minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(tab.label)
                    .accessibilityIdentifier("tab.\(tab.id)")
                    .accessibilityAddTraits(selected == tab.id ? [.isButton, .isSelected] : .isButton)
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
    }
}

// MARK: - Search bar

private struct SearchBarRow: View {
    let config: SearchBarConfig
    @State private var localText: String = ""

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(PantopusIcon.search, size: 16, color: Theme.Color.appTextSecondary)
            TextField(config.placeholder, text: Binding(
                get: { localText.isEmpty ? config.text : localText },
                set: { value in
                    localText = value
                    config.onChange(value)
                }
            ))
            .font(Theme.Font.role(PantopusTextStyle.small))
            .tracking(PantopusTextStyle.small.tracking)
            .foregroundStyle(Theme.Color.appText)
            .submitLabel(SubmitLabel.search)
            .onSubmit { config.onSubmit?() }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("listOfRowsSearchBar")
    }
}

// MARK: - Chip strip

private struct ChipStripRow: View {
    let config: ChipStripConfig

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(config.chips) { chip in
                    Button { config.onSelect(chip.id) } label: {
                        HStack(spacing: Spacing.s1) {
                            if let icon = chip.icon {
                                Icon(icon, size: 12, color: foreground(for: chip.id))
                            }
                            Text(chip.label)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(foreground(for: chip.id))
                        }
                        .padding(.horizontal, Spacing.s3)
                        .frame(height: 30)
                        .background(background(for: chip.id))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                                .stroke(borderColor(for: chip.id), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("chip.\(chip.id)")
                    .accessibilityAddTraits(
                        config.selectedId == chip.id ? [.isButton, .isSelected] : .isButton
                    )
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurface)
    }

    private func isOn(_ id: String) -> Bool {
        config.selectedId == id
    }

    private func background(for id: String) -> Color {
        isOn(id) ? Theme.Color.primary600 : Theme.Color.appSurface
    }

    private func foreground(for id: String) -> Color {
        isOn(id) ? Theme.Color.appTextInverse : Theme.Color.appTextStrong
    }

    private func borderColor(for id: String) -> Color {
        isOn(id) ? Theme.Color.primary600 : Theme.Color.appBorder
    }
}

// MARK: - States

private struct LoadingRows: View {
    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                ForEach(0..<6, id: \.self) { _ in
                    HStack(spacing: Spacing.s3) {
                        Shimmer(width: 40, height: 40, cornerRadius: Radii.pill)
                        VStack(alignment: .leading, spacing: Spacing.s1) {
                            Shimmer(width: 180, height: 14)
                            Shimmer(width: 120, height: 12)
                        }
                        Spacer()
                    }
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                }
            }
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
    }
}

private struct LoadedList: View {
    let sections: [RowSection]
    let hasMore: Bool
    let banner: BannerConfig?
    let listingContext: ListingContextConfig?
    let monoFooter: String?
    let onEndReached: () -> Void
    let onRefresh: () async -> Void

    var body: some View {
        List {
            if let listingContext {
                Section {
                    ListingContextHeader(config: listingContext)
                        .listRowInsets(EdgeInsets(top: Spacing.s3, leading: Spacing.s4, bottom: 0, trailing: Spacing.s4))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                }
            }
            if let banner {
                Section {
                    BannerCard(config: banner)
                        .listRowInsets(EdgeInsets(top: Spacing.s3, leading: Spacing.s4, bottom: 0, trailing: Spacing.s4))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                }
            }
            ForEach(sections) { section in
                Section {
                    sectionBody(section)
                } header: {
                    sectionHeader(section)
                }
            }
            if hasMore {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                    .onAppear(perform: onEndReached)
            }
            if let monoFooter {
                // Same mono-footer treatment as `GroupedListView` /
                // `PaymentsView` so A14 settings screens read identically.
                Text(monoFooter)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, 18)
                    .padding(.bottom, Spacing.s1)
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                    .accessibilityIdentifier("listOfRowsMonoFooter")
            }
        }
        .listStyle(.plain)
        .refreshable { await onRefresh() }
        .scrollContentBackground(.hidden)
        .background(Theme.Color.appBg)
    }

    @ViewBuilder private func sectionBody(_ section: RowSection) -> some View {
        switch section.style {
        case .flat:
            ForEach(section.rows) { row in
                RowView(row: row)
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                    .rowDestructiveSwipe(row.destructiveAction)
            }
            if let footer = section.footer {
                sectionFooter(section.id, text: footer)
                    .listRowInsets(EdgeInsets(top: Spacing.s2, leading: Spacing.s4, bottom: 0, trailing: Spacing.s4))
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
            }
        case .card:
            VStack(alignment: .leading, spacing: Spacing.s2) {
                VStack(spacing: Spacing.s0) {
                    ForEach(Array(section.rows.enumerated()), id: \.element.id) { index, row in
                        RowView(row: row, cardContext: .grouped(isLast: index == section.rows.count - 1))
                        if index < section.rows.count - 1 {
                            Divider().background(Theme.Color.appBorder)
                        }
                    }
                }
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                if let footer = section.footer {
                    sectionFooter(section.id, text: footer)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s2)
            .listRowInsets(EdgeInsets())
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
        }
    }

    private func sectionFooter(_ sectionId: String, text: String) -> some View {
        Text(text)
            .font(.system(size: 11.5))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityIdentifier("listOfRowsSectionFooter_\(sectionId)")
    }

    @ViewBuilder private func sectionHeader(_ section: RowSection) -> some View {
        if let header = section.header {
            HStack(spacing: Spacing.s2) {
                SectionHeader(header)
                    .textCase(nil)
                if let count = section.count {
                    Text("(\(count))")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                Spacer()
                if let onSeeAll = section.onSeeAll {
                    Button(action: onSeeAll) {
                        HStack(spacing: Spacing.s1) {
                            Text("See all")
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.primary600)
                            Icon(.chevronRight, size: 12, color: Theme.Color.primary600)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("See all \(header)")
                }
            }
        }
    }
}

private struct BannerCard: View {
    let config: BannerConfig

    var body: some View {
        let content = HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .fill(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                            .stroke(tokens.border, lineWidth: 1)
                    )
                Icon(config.icon, size: 16, color: tokens.foreground)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(config.title)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                if let subtitle = config.subtitle {
                    Text(subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer()
            if let cta = config.cta {
                BannerCTAButton(cta: cta)
            }
        }
        .padding(Spacing.s3)
        .background(tokens.background)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(tokens.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))

        // When a CTA is present, the focused action is the pill — don't
        // wrap the whole card in a Button (would steal the CTA's tap).
        if config.cta == nil, let onTap = config.onTap {
            Button(action: onTap) { content }
                .buttonStyle(.plain)
        } else {
            content
        }
    }

    private var tokens: BannerTokens {
        BannerTokens(tint: config.tint)
    }
}

/// Resolved token pair (background / border / foreground) for a banner
/// tint. Centralised so the BannerCard and any future banner consumers
/// don't fork the lookup.
private struct BannerTokens {
    let background: Color
    let border: Color
    let foreground: Color

    init(tint: BannerCTATint) {
        switch tint {
        case .primary:
            background = Theme.Color.primary50
            border = Theme.Color.primary100
            foreground = Theme.Color.primary600
        case .home:
            background = Theme.Color.homeBg
            border = Theme.Color.homeBg
            foreground = Theme.Color.home
        case .business:
            background = Theme.Color.businessBg
            border = Theme.Color.businessBg
            foreground = Theme.Color.business
        case .warning:
            background = Theme.Color.warningBg
            border = Theme.Color.warningBg
            foreground = Theme.Color.warning
        }
    }
}

private struct BannerCTAButton: View {
    let cta: BannerCTA

    var body: some View {
        Button(action: cta.handler) {
            HStack(spacing: Spacing.s1) {
                if let icon = cta.icon {
                    Icon(icon, size: 14, color: Theme.Color.appTextInverse)
                }
                Text(cta.label)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 7)
            .background(tintColor)
            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(cta.accessibilityLabel)
    }

    private var tintColor: Color {
        switch cta.tint {
        case .primary: Theme.Color.primary600
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        case .warning: Theme.Color.warning
        }
    }
}

private struct ListingContextHeader: View {
    let config: ListingContextConfig

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            card
            if config.offerCount != nil || config.sortLabel != nil {
                sortStrip
                    .padding(.top, Spacing.s3)
            }
        }
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .center, spacing: Spacing.s3) {
                thumbnail
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                        Text(config.title)
                            .pantopusTextStyle(.body)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                        Spacer(minLength: Spacing.s1)
                        Text(config.askPrice)
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        if let onEditPrice = config.onEditPrice {
                            Button {
                                onEditPrice()
                            } label: {
                                Icon(
                                    .pencil,
                                    size: 14,
                                    strokeWidth: 2.0,
                                    color: Theme.Color.primary600
                                )
                                .frame(width: 28, height: 28)
                                .background(Theme.Color.primary50)
                                .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Edit price")
                            .accessibilityIdentifier("listingContextEditPrice")
                        }
                    }
                    if !config.meta.isEmpty {
                        metaRow
                    }
                    StatusChip(
                        config.statusChip.label,
                        variant: config.statusChip.variant,
                        icon: config.statusChip.icon
                    )
                    .padding(.top, 2)
                }
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("listingContextHeader")
    }

    private var thumbnail: some View {
        ZStack {
            switch config.thumbnail {
            case let .icon(icon, gradient):
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [gradient.start, gradient.end],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                Icon(icon, size: 28, color: Theme.Color.appTextInverse)
            case let .url(url, fallback, gradient):
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [gradient.start, gradient.end],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                AsyncImage(url: url) { phase in
                    switch phase {
                    case let .success(image):
                        image.resizable().aspectRatio(contentMode: .fill)
                    default:
                        Icon(fallback, size: 28, color: Theme.Color.appTextInverse)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
        }
        .frame(width: 64, height: 64)
    }

    private var metaRow: some View {
        HStack(spacing: Spacing.s2) {
            ForEach(Array(config.meta.enumerated()), id: \.offset) { index, item in
                if index > 0 {
                    Text("·")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                HStack(spacing: 3) {
                    if let icon = item.icon {
                        Icon(icon, size: 11, color: Theme.Color.appTextSecondary)
                    }
                    Text(item.text)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
    }

    private var sortStrip: some View {
        HStack(alignment: .center) {
            if let count = config.offerCount {
                Text("\(count) \(count == 1 ? "offer" : "offers")")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .accessibilityIdentifier("listingContextOfferCount")
            }
            Spacer()
            if let sortLabel = config.sortLabel {
                if !config.sortOptions.isEmpty {
                    sortMenu(label: sortLabel)
                } else if let onSort = config.onSort {
                    Button(action: onSort) {
                        sortLabelView(sortLabel)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("listingContextSort")
                } else {
                    sortLabelView(sortLabel)
                }
            }
        }
    }

    private func sortMenu(label: String) -> some View {
        Menu {
            ForEach(config.sortOptions) { option in
                Button {
                    option.select()
                } label: {
                    if option.isSelected {
                        Label(option.label, systemImage: "checkmark")
                    } else {
                        Text(option.label)
                    }
                }
                .accessibilityIdentifier("listingContextSortOption-\(option.id)")
            }
        } label: {
            sortLabelView(label)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("listingContextSort")
    }

    private func sortLabelView(_ label: String) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(.arrowsRepeat, size: 12, color: Theme.Color.appTextSecondary)
            Text(label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Icon(.chevronDown, size: 12, color: Theme.Color.appTextSecondary)
        }
    }
}

private struct ListOfRowsErrorBanner: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load the list")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            PrimaryButton(title: "Try again") { await MainActor.run { retry() } }
                .frame(maxWidth: 240)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
    }
}

// MARK: - Row

/// Whether a row is rendered inside a grouped section card (Discover hub
/// style) or as a free-standing card.
enum RowCardContext {
    case standalone
    case grouped(isLast: Bool)

    var paintsOwnBackground: Bool {
        switch self {
        case .standalone: true
        case .grouped: false
        }
    }
}

/// Public free-standing renderer for a single `RowModel`, so surfaces
/// that compose their own list container — notably the `SearchListShell`
/// row builders — reuse the exact list-row visual (leading tile, content
/// column, trailing slot, highlight chrome) without re-implementing it.
/// Renders the standalone-card variant; group the rows yourself when you
/// need the Discover-hub card-stack look.
public struct ListRowCard: View {
    private let row: RowModel

    public init(row: RowModel) {
        self.row = row
    }

    public var body: some View {
        RowView(row: row)
    }
}

/// Single row card. `internal` (not `private`) so reuse surfaces like the
/// Document Search results list can render an identical row outside the
/// `ListOfRowsView` `List` body. Mirrors Android's `internal fun RowView`.
struct RowView: View {
    let row: RowModel
    var cardContext: RowCardContext = .standalone

    var body: some View {
        let card = cardBody
            .padding(cardContext.paintsOwnBackground ? Spacing.s3 : Spacing.s3)
            .background(rowBackground)
            .overlay(rowOverlay)
            .clipShape(RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous))
            .contentShape(Rectangle())
            .opacity(row.highlight == .archived || row.highlight == .muted ? 0.78 : 1.0)

        if row.footer == nil {
            // Whole-row tap is the canonical interaction when no inline
            // footer competes for taps.
            Button(action: row.onTap) { card }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityLabel(a11yLabel)
                .accessibilityAddTraits(.isButton)
                .rowDestructiveMenu(row.destructiveAction)
        } else {
            // With a footer, tap-the-card still routes to row.onTap, but
            // the inner buttons capture their own taps.
            card
                .onTapGesture(perform: row.onTap)
                .accessibilityElement(children: .contain)
                .accessibilityLabel(a11yLabel)
                .rowDestructiveMenu(row.destructiveAction)
        }
    }

    // MARK: Card geometry

    private var cardCornerRadius: CGFloat {
        switch cardContext {
        case .standalone: Radii.lg
        case .grouped: 0
        }
    }

    @ViewBuilder private var rowBackground: some View {
        switch (cardContext, row.highlight) {
        case (.grouped, _):
            Color.clear
        case (.standalone, .unread):
            Theme.Color.primary25
        case (.standalone, _):
            Theme.Color.appSurface
        }
    }

    @ViewBuilder private var rowOverlay: some View {
        switch (cardContext, row.highlight) {
        case (.grouped, _):
            EmptyView()
        case (.standalone, .unread):
            RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous)
                .stroke(Theme.Color.personalBg, lineWidth: 1)
        case (.standalone, .leading):
            RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous)
                .stroke(Theme.Color.warning, lineWidth: 1)
        case (.standalone, _):
            RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
    }

    private var cardBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if row.highlight == .leading {
                LeadingBadge()
            }
            HStack(alignment: .top, spacing: Spacing.s3) {
                LeadingView(leading: row.leading)
                contentColumn
                Spacer(minLength: Spacing.s2)
                TrailingView(trailing: row.trailing, onSecondary: row.onSecondary, rowTitle: row.title)
            }
            .frame(minHeight: row.title.isEmpty && row.body != nil ? 0 : 60)
            if let note = row.note {
                NoteBlock(text: note)
            }
            if let engagement = row.engagement {
                EngagementStrip(engagement: engagement)
            }
            if let footer = row.footer {
                FooterStack(footer: footer)
            }
        }
    }

    private var contentColumn: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let headerChips = row.headerChips, !headerChips.isEmpty {
                ChipRowView(
                    bidderStack: nil,
                    chips: headerChips,
                    timeMeta: row.timeMeta,
                    metaTail: nil,
                    splitWith: nil
                )
                .padding(.bottom, 2)
            }
            if let overline = row.archetypeOverline, !overline.isEmpty {
                archetypeOverlineView(overline)
            }
            if !row.title.isEmpty {
                titleLine
            }
            if let subtitle = row.subtitle {
                metaLine(text: subtitle, icon: row.subtitleIcon)
            }
            if let body = row.body {
                bodyLine(text: body, icon: row.bodyIcon, emphasis: row.bodyEmphasis)
            }
            if (row.chips?.isEmpty == false) || row.bidderStack != nil || row.splitWith != nil {
                ChipRowView(
                    bidderStack: row.bidderStack,
                    chips: row.chips ?? [],
                    timeMeta: row.headerChips == nil ? row.timeMeta : nil,
                    metaTail: row.metaTail,
                    splitWith: row.splitWith
                )
                .padding(.top, Spacing.s1)
            }
        }
    }

    private func metaLine(
        text: String,
        icon: PantopusIcon?,
        topPadding: CGFloat = 0
    ) -> some View {
        HStack(alignment: .center, spacing: Spacing.s1) {
            if let icon {
                Icon(icon, size: 11, color: Theme.Color.appTextSecondary)
            }
            Text(text)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(2)
        }
        .padding(.top, topPadding)
    }

    @ViewBuilder
    private func bodyLine(
        text: String,
        icon: PantopusIcon?,
        emphasis: RowBodyEmphasis
    ) -> some View {
        switch emphasis {
        case .secondary:
            metaLine(text: text, icon: icon, topPadding: 2)
        case .primary:
            HStack(alignment: .top, spacing: Spacing.s1) {
                if let icon {
                    Icon(icon, size: 13, color: Theme.Color.appText)
                        .padding(.top, 2)
                }
                Text(text)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.top, 2)
        }
    }

    /// T6.0b — small uppercase magic-violet overline rendered above the
    /// title. Truncates with ellipsis at 24 characters so a long
    /// archetype string can't push the title off-screen.
    @ViewBuilder
    private func archetypeOverlineView(_ overline: String) -> some View {
        let truncated = overline.count > 24
            ? String(overline.prefix(24)) + "…"
            : overline
        Text(truncated.uppercased())
            .font(.system(size: 10, weight: .semibold))
            .tracking(0.6)
            .foregroundStyle(Theme.Color.magic)
            .lineLimit(1)
            .padding(.bottom, 2)
            .accessibilityIdentifier("rowArchetypeOverline")
    }

    private var titleLine: some View {
        HStack(alignment: .center, spacing: Spacing.s1) {
            Text(row.title)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
                .fontWeight(row.highlight == .unread ? .bold : .semibold)
                .lineLimit(2)
            if let chip = row.inlineChip {
                ChipPill(chip: chip)
            }
            if row.highlight == .unread {
                Spacer(minLength: Spacing.s0)
                Circle()
                    .fill(Theme.Color.primary600)
                    .frame(width: 8, height: 8)
            }
        }
    }

    private var a11yLabel: String {
        var parts = [row.title]
        if let subtitle = row.subtitle { parts.append(subtitle) }
        if let body = row.body { parts.append(body) }
        if case let .statusChip(text, _) = row.trailing { parts.append(text) }
        if case let .pillButton(label, _, _) = row.trailing { parts.append(label) }
        if let chips = row.chips {
            parts.append(contentsOf: chips.map(\.text))
        }
        if let time = row.timeMeta { parts.append(time) }
        if row.highlight == .unread { parts.append("unread") }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Destructive row affordances

/// Long-press context menu + trailing swipe action for a row that
/// carries a `RowDestructiveAction`. Rows without one are returned
/// untouched, so no existing screen changes gesture behaviour.
private extension View {
    @ViewBuilder
    func rowDestructiveMenu(_ action: RowDestructiveAction?) -> some View {
        if let action {
            contextMenu {
                Button(role: .destructive, action: action.handler) {
                    Label(action.label, systemImage: "trash")
                }
                .accessibilityIdentifier(action.identifier ?? "rowDestructiveAction")
            }
        } else {
            self
        }
    }

    @ViewBuilder
    func rowDestructiveSwipe(_ action: RowDestructiveAction?) -> some View {
        if let action {
            swipeActions(edge: .trailing, allowsFullSwipe: false) {
                Button(role: .destructive, action: action.handler) {
                    Label(action.label, systemImage: "trash")
                }
                .accessibilityIdentifier(action.identifier ?? "rowDestructiveAction")
            }
        } else {
            self
        }
    }
}

// MARK: - Leading view

private struct LeadingView: View {
    let leading: RowLeading

    var body: some View {
        switch leading {
        case let .icon(icon, tint):
            Icon(icon, size: 20, color: tint)
                .frame(width: 40, height: 40)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        case let .avatar(name, imageURL, identity, ringProgress):
            AvatarWithIdentityRing(
                name: name,
                imageURL: imageURL,
                identity: identity,
                ringProgress: ringProgress
            )
        case .none:
            EmptyView()
        case let .typeIcon(icon, background, foreground):
            Icon(icon, size: 19, color: foreground)
                .frame(width: 40, height: 40)
                .background(background)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        case let .categoryGradientIcon(icon, gradient):
            Icon(icon, size: 20, color: Theme.Color.appTextInverse)
                .frame(width: 40, height: 40)
                .background(
                    LinearGradient(
                        colors: [gradient.start, gradient.end],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        case let .avatarWithBadge(name, imageURL, background, size, verified):
            avatarWithBadge(
                name: name,
                imageURL: imageURL,
                background: background,
                size: size,
                verified: verified
            )
        case let .thumbnail(image, size):
            thumbnail(image: image, size: size)
        case let .bidderStack(bidders, overflow):
            BidderStack(bidders: bidders, overflow: overflow)
        case let .magicArchetypeTile(icon, gradient):
            magicArchetypeTile(icon: icon, gradient: gradient)
        }
    }

    /// 44pt rounded gradient tile + sparkles disc clipped over the top-
    /// right corner. Matches the `ArchetypeTile` block in
    /// `mytasks-frames.jsx`.
    private func magicArchetypeTile(icon: PantopusIcon, gradient: GradientPair) -> some View {
        Icon(icon, size: 22, strokeWidth: 1.7, color: Theme.Color.appTextInverse)
            .frame(width: 44, height: 44)
            .background(
                LinearGradient(
                    colors: [gradient.start, gradient.end],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
            .overlay(alignment: .topTrailing) {
                Icon(.sparkles, size: 10, strokeWidth: 2.4, color: Theme.Color.magic)
                    .frame(width: 18, height: 18)
                    .background(Theme.Color.appSurface)
                    .clipShape(Circle())
                    .overlay(
                        Circle().strokeBorder(Theme.Color.magicBorder, lineWidth: 1.5)
                    )
                    .offset(x: 3, y: -3)
                    .pantopusShadow(.sm)
            }
    }

    private func avatarWithBadge(
        name: String,
        imageURL: URL?,
        background: AvatarBackground,
        size: AvatarBadgeSize,
        verified: Bool
    ) -> some View {
        let initials = name.split(separator: " ").prefix(2).map { $0.prefix(1) }.joined().uppercased()
        return ZStack(alignment: .bottomTrailing) {
            ZStack {
                switch background {
                case let .solid(color):
                    Circle().fill(color)
                case let .gradient(pair):
                    Circle().fill(
                        LinearGradient(
                            colors: [pair.start, pair.end],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                }
                if let url = imageURL {
                    AsyncImage(url: url) { image in
                        image.resizable().aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Text(initials)
                            .font(.system(size: size.size * 0.32, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .clipShape(Circle())
                } else {
                    Text(initials)
                        .font(.system(size: size.size * 0.32, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
            }
            .frame(width: size.size, height: size.size)
            if verified {
                VerifiedBadge(size: 16)
                    .offset(x: 2, y: 2)
            }
        }
    }

    private func thumbnail(image: ThumbnailImage, size: ThumbnailSize) -> some View {
        ZStack {
            switch image {
            case let .icon(icon, gradient):
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [gradient.start, gradient.end],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                Icon(icon, size: size.size * 0.42, color: Theme.Color.appTextInverse)
            case let .url(url, fallback, gradient):
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [gradient.start, gradient.end],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                AsyncImage(url: url) { phase in
                    switch phase {
                    case let .success(image):
                        image.resizable().aspectRatio(contentMode: .fill)
                    default:
                        Icon(fallback, size: size.size * 0.42, color: Theme.Color.appTextInverse)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
        }
        .frame(width: size.size, height: size.size)
    }
}

// MARK: - Trailing view

private struct TrailingView: View {
    let trailing: RowTrailing
    let onSecondary: (@Sendable () -> Void)?
    let rowTitle: String

    var body: some View {
        switch trailing {
        case let .statusChip(text, variant):
            StatusChip(text, variant: variant)
        case .chevron:
            Icon(.chevronRight, size: 18, color: Theme.Color.appTextSecondary)
        case .kebab:
            if let handler = onSecondary {
                Button(action: handler) {
                    Icon(.moreHorizontal, size: 20, color: Theme.Color.appTextSecondary)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("More actions for \(rowTitle)")
            }
        case .none:
            EmptyView()
        case let .amountWithChip(amount, chipText, chipVariant, chipIcon):
            VStack(alignment: .trailing, spacing: Spacing.s1) {
                Text(amount)
                    .pantopusTextStyle(.body)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appText)
                StatusChip(chipText, variant: chipVariant, icon: chipIcon)
            }
        case let .circularAction(icon, accessibilityLabel, background, foreground, handler):
            Button(action: handler) {
                ZStack {
                    Circle().fill(background)
                    Icon(icon, size: 17, color: foreground)
                }
                .frame(width: 38, height: 38)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(accessibilityLabel)
        case let .verticalActions(primary, secondary):
            VStack(spacing: Spacing.s1) {
                CompactButton(
                    title: primary.label,
                    variant: primary.variant,
                    size: .inlineAction,
                    action: primary.handler
                )
                CompactButton(
                    title: secondary.label,
                    variant: secondary.variant,
                    size: .inlineAction,
                    action: secondary.handler
                )
            }
            .frame(width: 90)
        case let .priceStack(amount, sublabel):
            VStack(alignment: .trailing, spacing: 2) {
                Text(amount)
                    .pantopusTextStyle(.body)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appText)
                if let sublabel {
                    Text(sublabel)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
        case let .iconActions(primary, secondary):
            HStack(spacing: Spacing.s1) {
                IconActionButton(action: primary)
                IconActionButton(action: secondary)
            }
        case let .pillButton(label, tone, handler):
            PillTrailingButton(label: label, tone: tone, rowTitle: rowTitle, handler: handler)
        }
    }
}

/// A14.4 — single inline labelled pill matching the design's `PillButton`
/// primitive: 6×14 padding · capsule radius · 1px border · 13pt semibold
/// label. Used by Blocked users' `Unblock` action in `.neutral` tone.
private struct PillTrailingButton: View {
    let label: String
    let tone: RowPillTone
    let rowTitle: String
    let handler: @Sendable () -> Void

    var body: some View {
        Button(action: handler) {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(foreground)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(background)
                .overlay(Capsule().stroke(border, lineWidth: 1))
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label) \(rowTitle)")
    }

    private var background: Color {
        switch tone {
        case .neutral, .danger: Theme.Color.appSurface
        case .primary: Theme.Color.primary600
        }
    }

    private var border: Color {
        switch tone {
        case .neutral: Theme.Color.appBorderStrong
        case .primary: Theme.Color.primary600
        case .danger: Theme.Color.errorBg
        }
    }

    private var foreground: Color {
        switch tone {
        case .neutral: Theme.Color.appTextStrong
        case .primary: Theme.Color.appTextInverse
        case .danger: Theme.Color.error
        }
    }
}

private struct IconActionButton: View {
    let action: RowIconAction

    var body: some View {
        Button(action: action.handler) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .fill(action.background)
                Icon(action.icon, size: 15, color: action.foreground)
            }
            .frame(width: 32, height: 32)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(action.accessibilityLabel)
    }
}

// MARK: - Chip row

private struct ChipRowView: View {
    let bidderStack: BidderStackData?
    let chips: [RowChip]
    let timeMeta: String?
    let metaTail: String?
    /// T6.0a — right-edge split-payer stack (Bills). When set, renders
    /// "Split N ways" + 18pt overlapping avatars where `timeMeta` would
    /// otherwise sit. The two don't coexist on Bills rows in practice;
    /// when both are set, splitWith wins.
    let splitWith: SplitStackData?

    var body: some View {
        HStack(spacing: Spacing.s1) {
            if let bidderStack, !bidderStack.bidders.isEmpty || bidderStack.overflow > 0 {
                BidderStack(bidders: bidderStack.bidders, overflow: bidderStack.overflow)
                    .padding(.trailing, 2)
            }
            ForEach(Array(chips.enumerated()), id: \.offset) { _, chip in
                ChipPill(chip: chip)
            }
            if let metaTail {
                Text(metaTail)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s0)
            if let splitWith {
                SplitStackTail(data: splitWith)
            } else if let timeMeta {
                Text(timeMeta)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
    }
}

/// Right-edge "Split N ways" caption + 18pt overlapping avatars,
/// rendered on Bills rows when the bill is split between household
/// members. Tone palette shared with `BidderStack` so a future feature
/// can mix the two without re-keying the colors.
private struct SplitStackTail: View {
    let data: SplitStackData

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Text(captionText)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
                .lineLimit(1)
            avatars
        }
    }

    private var captionText: String {
        if data.totalWays > 1 {
            return "Split \(data.totalWays) ways"
        }
        return "Split"
    }

    private var avatars: some View {
        let visible = Array(data.members.prefix(3))
        return HStack(spacing: -4) {
            ForEach(Array(visible.enumerated()), id: \.element.id) { _, member in
                SplitAvatar(member: member)
            }
            if data.overflow > 0 {
                SplitOverflow(count: data.overflow)
            }
        }
    }
}

private struct SplitAvatar: View {
    let member: SplitMember

    var body: some View {
        Text(member.initials)
            .font(.system(size: 7, weight: .bold))
            .foregroundStyle(foreground)
            .frame(width: 18, height: 18)
            .background(Circle().fill(background))
            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 1.5))
    }

    private var background: Color {
        switch member.tone {
        case .sky: Theme.Color.personalBg
        case .teal: Theme.Color.successBg
        case .amber: Theme.Color.warningBg
        case .rose: Theme.Color.errorBg
        case .violet: Theme.Color.businessBg
        case .slate: Theme.Color.appSurfaceSunken
        }
    }

    private var foreground: Color {
        switch member.tone {
        case .sky: Theme.Color.personal
        case .teal: Theme.Color.success
        case .amber: Theme.Color.warning
        case .rose: Theme.Color.error
        case .violet: Theme.Color.business
        case .slate: Theme.Color.appTextSecondary
        }
    }
}

private struct SplitOverflow: View {
    let count: Int

    var body: some View {
        Text("+\(count)")
            .font(.system(size: 7, weight: .bold))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(width: 18, height: 18)
            .background(Circle().fill(Theme.Color.appSurfaceSunken))
            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 1.5))
    }
}

private struct ChipPill: View {
    let chip: RowChip

    var body: some View {
        HStack(spacing: Spacing.s1) {
            if let icon = chip.icon {
                Icon(icon, size: 11, color: foreground)
            }
            Text(chip.text)
                .pantopusTextStyle(.caption)
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }

    private var background: Color {
        switch chip.tint {
        case let .status(variant): backgroundFor(variant)
        case let .custom(background, _): background
        }
    }

    private var foreground: Color {
        switch chip.tint {
        case let .status(variant): foregroundFor(variant)
        case let .custom(_, foreground): foreground
        }
    }

    private func backgroundFor(_ variant: StatusChipVariant) -> Color {
        switch variant {
        case .success: Theme.Color.successBg
        case .warning: Theme.Color.warningBg
        case .error: Theme.Color.errorBg
        case .info: Theme.Color.infoBg
        case .personal: Theme.Color.personalBg
        case .home: Theme.Color.homeBg
        case .business: Theme.Color.businessBg
        case .neutral: Theme.Color.appSurfaceSunken
        }
    }

    private func foregroundFor(_ variant: StatusChipVariant) -> Color {
        switch variant {
        case .success: Theme.Color.success
        case .warning: Theme.Color.warning
        case .error: Theme.Color.error
        case .info: Theme.Color.info
        case .personal: Theme.Color.personal
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        case .neutral: Theme.Color.appTextSecondary
        }
    }
}

// MARK: - Note + footer + leading badge

private struct NoteBlock: View {
    let text: String

    var body: some View {
        Text("\u{201C}\(text)\u{201D}")
            .pantopusTextStyle(.caption)
            .italic()
            .foregroundStyle(Theme.Color.appTextStrong)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurfaceSunken)
            .overlay(
                Rectangle()
                    .fill(Theme.Color.appBorder)
                    .frame(width: 2),
                alignment: .leading
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            .padding(.leading, 52)
    }
}

private struct FooterStack: View {
    let footer: RowFooter

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Divider().background(Theme.Color.appBorder)
                .padding(.bottom, Spacing.s2)
            HStack(spacing: Spacing.s1) {
                ForEach(Array(footer.actions.enumerated()), id: \.offset) { _, action in
                    CompactButton(
                        title: action.title,
                        icon: action.icon,
                        variant: action.variant,
                        size: .footer,
                        action: action.handler
                    )
                    .layoutPriority(Double(action.flex))
                    .accessibilityIdentifier(action.identifier ?? "rowFooterAction_\(action.title)")
                }
            }
        }
    }
}

/// Hairline-separated engagement footer — display-only icon+label items
/// on the left, optional CTA text-button on the right. Used by My posts
/// (`[8 replies] [142 views] ↳ Edit`).
private struct EngagementStrip: View {
    let engagement: RowEngagement

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Divider().background(Theme.Color.appBorder)
                .padding(.top, Spacing.s2)
                .padding(.bottom, Spacing.s2)
            HStack(spacing: Spacing.s4) {
                ForEach(engagement.items) { item in
                    HStack(spacing: Spacing.s1) {
                        Icon(item.icon, size: 13, color: Theme.Color.appTextSecondary)
                        Text(item.label)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: Spacing.s1)
                if let cta = engagement.cta {
                    Button(action: cta.handler) {
                        HStack(spacing: Spacing.s1) {
                            if let icon = cta.icon {
                                Icon(icon, size: 12, color: Theme.Color.primary600)
                            }
                            Text(cta.label)
                                .pantopusTextStyle(.caption)
                                .fontWeight(.semibold)
                                .foregroundStyle(Theme.Color.primary600)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(cta.accessibilityLabel)
                    .accessibilityIdentifier("rowEngagementCTA")
                }
            }
        }
    }
}

private struct LeadingBadge: View {
    var body: some View {
        HStack(spacing: 3) {
            Icon(.alertCircle, size: 9, color: Theme.Color.appTextInverse)
            Text("LEADING")
                .pantopusTextStyle(.caption)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 2)
        .background(Theme.Color.warning)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - FAB

private struct FABButton: View {
    let action: FABAction

    var body: some View {
        Button(action: action.handler) {
            content
        }
        .buttonStyle(.plain)
        .accessibilityLabel(action.accessibilityLabel)
        .accessibilityAddTraits(.isButton)
    }

    @ViewBuilder private var content: some View {
        switch action.variant {
        case .canonicalCreate:
            Icon(action.icon, size: 24, color: Theme.Color.appTextInverse)
                .frame(width: 56, height: 56)
                .background(tintBackground)
                .clipShape(Circle())
                .pantopusShadow(.primary)
        case .secondaryCreate:
            Icon(action.icon, size: 22, color: Theme.Color.appTextInverse)
                .frame(width: 52, height: 52)
                .background(tintBackground)
                .clipShape(Circle())
                .pantopusShadow(.primary)
        case let .extendedNav(label):
            HStack(spacing: Spacing.s2) {
                Icon(action.icon, size: 18, color: Theme.Color.appTextInverse)
                Text(label)
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, Spacing.s5)
            .frame(height: 48)
            .background(tintBackground)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
            .pantopusShadow(.primary)
        case .magicCreate:
            // 60pt gradient FAB with sparkles disc clipped over the
            // top-right corner. Per the design's `PostFab` in
            // `mytasks-frames.jsx`.
            Icon(action.icon, size: 22, color: Theme.Color.appTextInverse)
                .frame(width: 60, height: 60)
                .background(magicGradient)
                .clipShape(Circle())
                .overlay(alignment: .topTrailing) { sparklesDisc }
                .pantopusShadow(.primary)
        }
    }

    /// 18pt white disc with an 11pt magic-violet sparkles glyph,
    /// inset 8pt from the top-right corner of the 60pt gradient FAB.
    private var sparklesDisc: some View {
        Icon(.sparkles, size: 11, strokeWidth: 2.6, color: Theme.Color.magic)
            .frame(width: 18, height: 18)
            .background(Theme.Color.appSurface)
            .clipShape(Circle())
            .padding(.top, Spacing.s2)
            .padding(.trailing, Spacing.s2)
    }

    /// 135° linear gradient from primary600 → primary700 used by the
    /// 60pt Magic Task FAB.
    private var magicGradient: LinearGradient {
        LinearGradient(
            colors: [Theme.Color.primary600, Theme.Color.primary700],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    /// Resolve the FAB's tint to a fill color. Default `.sky` keeps the
    /// pre-T6 sky-blue render; `.home` and `.business` swap to the
    /// matching identity tokens.
    private var tintBackground: Color {
        switch action.tint {
        case .sky: Theme.Color.primary600
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        }
    }
}
