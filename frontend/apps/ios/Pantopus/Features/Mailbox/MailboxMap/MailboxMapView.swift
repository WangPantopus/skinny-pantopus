//
//  MailboxMapView.swift
//  Pantopus
//
//  A11.4 Mailbox map — full-bleed stylized map + collapsible bottom
//  sheet, with a pin-detail mode that collapses the map to a 230pt
//  context strip (selected pin pulsing, dashed route from you-are-here)
//  and swaps the sheet for a detail panel (services grid + week-hour
//  strip + sticky Directions).
//
//  Bespoke rather than `MapListHybridShell`: the archetype shell renders
//  circular MapKit pins and can't collapse its map, while this variant
//  needs square envelope pins, a 230pt selected-mode strip, and a
//  deterministic (non-MapKit) canvas for snapshot baselines. It reuses
//  the archetype's `MapListHybridDetent` + resolver and mirrors
//  `NearbyMapView`'s chrome.
//

// swiftlint:disable file_length type_body_length

import SwiftUI

/// Mailbox map entry point.
public struct MailboxMapView: View {
    @State private var viewModel: MailboxMapViewModel
    @State private var dragTranslation: CGFloat = 0
    @Environment(\.openURL) private var openURL
    private let onBack: (@MainActor () -> Void)?

    /// Selected-mode map strip height (A11.4 spec — "230px context strip").
    private static let selectedMapHeight: CGFloat = 230

    init(
        viewModel: MailboxMapViewModel = MailboxMapViewModel(),
        onBack: (@MainActor () -> Void)? = nil
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                mapLayer(geo: geo)
                floatingPill
                    .padding(.top, geo.safeAreaInsets.top + 4)
                    .padding(.horizontal, 14)
                categoryChips
                    .padding(.top, geo.safeAreaInsets.top + 50)
                bottomLayer(geo: geo)
            }
            .ignoresSafeArea(edges: .bottom)
        }
        .task { await viewModel.load() }
        .accessibilityIdentifier("mailboxMap")
    }

    // MARK: - Derived

    private func sheetHeight(containerHeight: CGFloat) -> CGFloat {
        Swift.max(120, viewModel.detent.height(in: containerHeight) + dragTranslation)
    }

    /// Chip to render active. In the detail panel the selected spot's
    /// kind lights up (per the design's `activeKey="post"` frame); in the
    /// list it reflects the user's filter.
    private var highlightedKind: MailboxSpotKind? {
        if case let .selected(spot, _) = viewModel.state { return spot.kind }
        return viewModel.activeKind
    }

    private var headerTitle: String {
        switch viewModel.state {
        case .loading:
            "Finding spots nearby"
        case let .populated(spots):
            "\(spots.count) \(spots.count == 1 ? "spot" : "spots") nearby"
        case .error:
            "Mailbox spots"
        case .selected:
            ""
        }
    }

    private var headerDirectionsSpot: MailboxSpot? {
        if case let .populated(spots) = viewModel.state {
            return spots.first
        }
        return nil
    }

    // MARK: - Map layer

    @ViewBuilder
    private func mapLayer(geo: GeometryProxy) -> some View {
        let width = geo.size.width
        switch viewModel.state {
        case let .selected(spot, spots):
            mapCanvas(width: width, height: Self.selectedMapHeight) {
                selectedMapContent(spot: spot, context: spots, width: width, height: Self.selectedMapHeight)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        case let .populated(spots):
            mapCanvas(width: width, height: geo.size.height) {
                populatedMapContent(spots: spots, width: width, height: geo.size.height)
            }
        case .loading, .error:
            mapCanvas(width: width, height: geo.size.height) {
                youAreHere(width: width, height: geo.size.height)
            }
        }
    }

    private func mapCanvas(
        width: CGFloat,
        height: CGFloat,
        @ViewBuilder content: () -> some View
    ) -> some View {
        ZStack {
            Theme.Color.appSurfaceSunken
            MailboxMapDecor()
            content()
        }
        .frame(width: width, height: height)
        .clipped()
        .accessibilityIdentifier("mailboxMapCanvas")
    }

    private func populatedMapContent(spots: [MailboxSpot], width: CGFloat, height: CGFloat) -> some View {
        ZStack {
            ForEach(spots) { spot in
                Button { select(spot.id) } label: {
                    MailboxMapPin(kind: spot.kind, pulsing: spot.id == spots.first?.id)
                }
                .buttonStyle(.plain)
                .position(x: spot.mapX * width, y: spot.mapY * height)
                .accessibilityIdentifier("mailboxMapPin_\(spot.id)")
                .accessibilityLabel("\(spot.name), \(spot.kind.label)")
            }
            youAreHere(width: width, height: height)
        }
        .frame(width: width, height: height)
    }

    @ViewBuilder
    private func selectedMapContent(
        spot: MailboxSpot,
        context: [MailboxSpot],
        width: CGFloat,
        height: CGFloat
    ) -> some View {
        let anchor = CGPoint(x: width * 0.52, y: height * 0.78)
        let pinPoint = CGPoint(x: width * 0.30, y: height * 0.42)
        ZStack {
            ForEach(contextPins(excluding: spot.id, in: context)) { other in
                MailboxMapPin(kind: other.kind, dimmed: true)
                    .position(
                        x: other.mapX * width,
                        y: Swift.min(Swift.max(other.mapY, 0.16), 0.62) * height
                    )
                    .accessibilityHidden(true)
            }
            RouteLine(from: anchor, to: pinPoint)
            MailboxMapPin(kind: spot.kind, pulsing: true)
                .position(x: pinPoint.x, y: pinPoint.y)
                .accessibilityIdentifier("mailboxMapPin_\(spot.id)")
                .accessibilityLabel("\(spot.name), selected")
            YouAreHereDot()
                .position(x: anchor.x, y: anchor.y)
                .accessibilityHidden(true)
        }
        .frame(width: width, height: height)
    }

    private func youAreHere(width: CGFloat, height: CGFloat) -> some View {
        YouAreHereDot()
            .position(
                x: MailboxMapSampleData.userAnchor.x * width,
                y: MailboxMapSampleData.userAnchor.y * height
            )
            .accessibilityHidden(true)
    }

    private func contextPins(excluding id: String, in spots: [MailboxSpot]) -> [MailboxSpot] {
        Array(spots.filter { $0.id != id }.prefix(3))
    }

    // MARK: - Floating pill

    private var floatingPill: some View {
        HStack(spacing: Spacing.s0) {
            Button { onBack?() } label: {
                Icon(.chevronLeft, size: 18, strokeWidth: 2.2, color: Theme.Color.appText)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("mailboxMapBack")
            .opacity(onBack == nil ? 0 : 1)
            .disabled(onBack == nil)
            Spacer(minLength: Spacing.s1)
            HStack(spacing: 2) {
                Text("Mailbox map")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Icon(.chevronDown, size: 14, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            Spacer(minLength: Spacing.s1)
            Color.clear.frame(width: 32, height: 32)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, Spacing.s2)
        .background(.ultraThinMaterial)
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.10), radius: 8, x: 0, y: 4)
        .accessibilityIdentifier("mailboxMapPill")
    }

    // MARK: - Category chips

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                chip(kind: nil, label: "All")
                ForEach(MailboxSpotKind.allCases) { kind in
                    chip(kind: kind, label: kind.label)
                }
            }
            .padding(.horizontal, 14)
        }
        .accessibilityIdentifier("mailboxMapChips")
    }

    private func chip(kind: MailboxSpotKind?, label: String) -> some View {
        let active = highlightedKind == kind
        let accent = kind?.color ?? Theme.Color.primary600
        return Button {
            withAnimation(.interpolatingSpring(stiffness: 320, damping: 30)) {
                viewModel.selectKind(kind)
                dragTranslation = 0
            }
        } label: {
            HStack(spacing: 5) {
                if let kind {
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(active ? Theme.Color.appTextInverse : kind.color)
                        .frame(width: 7, height: 7)
                }
                Text(label)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 28)
            .background(active ? accent : Color.white.opacity(0.96))
            .overlay(Capsule().stroke(active ? Color.clear : Theme.Color.appBorder, lineWidth: 1))
            .clipShape(Capsule())
            .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("mailboxMapChip_\(kind?.rawValue ?? "all")")
    }

    // MARK: - Bottom layer (sheet vs detail panel)

    @ViewBuilder
    private func bottomLayer(geo: GeometryProxy) -> some View {
        switch viewModel.state {
        case let .selected(spot, _):
            detailPanel(spot: spot, geo: geo)
        case let .populated(spots):
            bottomSheet(geo: geo) { populatedSheetBody(spots) }
        case .loading:
            bottomSheet(geo: geo) { loadingSheetBody }
        case let .error(message):
            bottomSheet(geo: geo) { errorSheetBody(message) }
        }
    }

    private func bottomSheet(geo: GeometryProxy, @ViewBuilder body: () -> some View) -> some View {
        VStack(spacing: Spacing.s0) {
            Spacer(minLength: Spacing.s0)
            VStack(spacing: Spacing.s0) {
                MapListHybridSheetGrabber()
                sheetHeader
                body()
                    .frame(maxHeight: .infinity, alignment: .top)
            }
            .frame(maxWidth: .infinity)
            .frame(height: sheetHeight(containerHeight: geo.size.height))
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .shadow(color: .black.opacity(0.12), radius: 10, x: 0, y: -10)
            .gesture(sheetDrag(containerHeight: geo.size.height))
        }
        .accessibilityIdentifier("mailboxMapSheet")
    }

    private func sheetDrag(containerHeight: CGFloat) -> some Gesture {
        DragGesture()
            .onChanged { gesture in
                dragTranslation = -gesture.translation.height
            }
            .onEnded { gesture in
                let velocity = gesture.predictedEndTranslation.height
                let displaced = viewModel.detent.height(in: containerHeight) + dragTranslation
                let target = MapListHybridDetentResolver.resolve(
                    from: viewModel.detent,
                    velocity: velocity,
                    displacedFraction: displaced / containerHeight
                )
                withAnimation(.interpolatingSpring(stiffness: 320, damping: 30)) {
                    viewModel.setDetent(target)
                    dragTranslation = 0
                }
            }
    }

    private var sheetHeader: some View {
        HStack {
            Text(headerTitle)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            if let spot = headerDirectionsSpot {
                Button { openDirections(to: spot) } label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.navigation, size: 14, strokeWidth: 2.2, color: Theme.Color.primary700)
                        Text("Directions")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Theme.Color.primary700)
                    }
                    .frame(minHeight: 32)
                    .padding(.horizontal, Spacing.s2)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("mailboxMapHeaderDirections")
                .accessibilityLabel("Directions to nearest mailbox spot")
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, Spacing.s1)
        .padding(.bottom, Spacing.s3)
        .accessibilityIdentifier("mailboxMapSheetHeader")
    }

    // MARK: - Populated sheet body

    @ViewBuilder
    private func populatedSheetBody(_ spots: [MailboxSpot]) -> some View {
        if spots.isEmpty {
            emptyRailNote
        } else {
            switch viewModel.detent {
            case .collapsed: collapsedPrompt
            case .standard: standardRail(spots)
            case .expanded: expandedList(spots)
            }
        }
    }

    private func standardRail(_ spots: [MailboxSpot]) -> some View {
        VStack(spacing: Spacing.s0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(Array(spots.enumerated()), id: \.element.id) { index, spot in
                        MailboxSpotCard(
                            spot: spot,
                            active: index == 0,
                            onTap: { select(spot.id) },
                            onDirections: { openDirections(to: spot) }
                        )
                    }
                }
                .padding(.horizontal, Spacing.s4)
            }
            .accessibilityIdentifier("mailboxMapRail")
            MailboxPaginationDots(total: min(spots.count, 4), index: 0)
                .padding(.vertical, Spacing.s3)
        }
    }

    private func expandedList(_ spots: [MailboxSpot]) -> some View {
        ScrollView {
            LazyVStack(spacing: Spacing.s0) {
                ForEach(spots) { spot in
                    MailboxSpotRow(
                        spot: spot,
                        onTap: { select(spot.id) },
                        onDirections: { openDirections(to: spot) }
                    )
                }
                Spacer(minLength: 80)
            }
        }
        .accessibilityIdentifier("mailboxMapList")
    }

    private var collapsedPrompt: some View {
        Button {
            withAnimation(.interpolatingSpring(stiffness: 320, damping: 30)) {
                viewModel.setDetent(.standard)
            }
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.chevronUp, size: 13, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
                Text("Drag up to see the list")
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 36)
            .background(Theme.Color.appSurfaceSunken)
            .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s3)
        .accessibilityIdentifier("mailboxMapCollapsedPrompt")
    }

    private var emptyRailNote: some View {
        VStack(spacing: Spacing.s2) {
            Text("No spots match this filter")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            Button { viewModel.selectKind(nil) } label: {
                Text("Show all spots")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.primary700)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("mailboxMapShowAll")
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s2)
        .accessibilityIdentifier("mailboxMapEmptyNote")
    }

    private var loadingSheetBody: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(0..<3, id: \.self) { _ in
                    MailboxSpotCard(
                        spot: MailboxMapSampleData.spots[0],
                        active: false,
                        onTap: {},
                        onDirections: {}
                    )
                    .redacted(reason: .placeholder)
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
        .accessibilityIdentifier("mailboxMapLoading")
        .accessibilityLabel("Loading mailbox spots")
    }

    private func errorSheetBody(_ message: String) -> some View {
        VStack(spacing: 10) {
            Icon(.alertCircle, size: 28, color: Theme.Color.error)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button { Task { await viewModel.refresh() } } label: {
                Text("Try again")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s4)
                    .frame(height: 38)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("mailboxMapRetry")
        }
        .padding()
        .frame(maxWidth: .infinity)
    }

    // MARK: - Detail panel (selected)

    private func detailPanel(spot: MailboxSpot, geo: GeometryProxy) -> some View {
        VStack(spacing: Spacing.s0) {
            Spacer(minLength: Spacing.s0)
            VStack(spacing: Spacing.s0) {
                detailTopBar
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.s0) {
                        detailIdentity(spot)
                        detailStatusChips(spot).padding(.top, Spacing.s3)
                        detailServices(spot)
                        detailHours(spot)
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, Spacing.s3)
                    .padding(.bottom, 14)
                }
                detailActionBar(spot)
            }
            .frame(maxWidth: .infinity)
            .frame(height: geo.size.height - Self.selectedMapHeight + 22)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .shadow(color: .black.opacity(0.12), radius: 10, x: 0, y: -10)
        }
        .accessibilityIdentifier("mailboxMapDetail")
    }

    private var detailTopBar: some View {
        HStack {
            Button { backToList() } label: {
                HStack(spacing: Spacing.s1) {
                    Icon(.chevronLeft, size: 14, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
                    Text("Back to list")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("mailboxMapBackToList")
            Spacer()
        }
        .padding(.horizontal, 18)
        .padding(.top, Spacing.s2)
    }

    private func detailIdentity(_ spot: MailboxSpot) -> some View {
        HStack(spacing: 10) {
            MailboxKindTile(kind: spot.kind, size: 44, radius: 10, iconSize: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text(spot.name)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(spot.address)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
        }
    }

    private func detailStatusChips(_ spot: MailboxSpot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                openChip(spot)
                Spacer(minLength: Spacing.s0)
            }
            HStack(spacing: 6) {
                metaChip(icon: .mapPin, text: spot.walkLabel)
                if let last = spot.lastPickupLabel {
                    metaChip(icon: .clock, text: last)
                }
                Spacer(minLength: Spacing.s0)
            }
        }
    }

    private func openChip(_ spot: MailboxSpot) -> some View {
        HStack(spacing: Spacing.s1) {
            Circle()
                .fill(spot.isOpen ? Theme.Color.success : Theme.Color.error)
                .frame(width: 6, height: 6)
            Text(spot.statusLabel)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(spot.isOpen ? Theme.Color.success : Theme.Color.error)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 2)
        .background(spot.isOpen ? Theme.Color.successBg : Theme.Color.errorBg)
        .clipShape(Capsule())
    }

    private func metaChip(icon: PantopusIcon, text: String) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(icon, size: 11, strokeWidth: 2.2, color: Theme.Color.appTextStrong)
            Text(text)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 2)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
    }

    private func detailServices(_ spot: MailboxSpot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionLabel("Services")
            LazyVGrid(
                columns: [GridItem(.flexible(), spacing: Spacing.s2), GridItem(.flexible(), spacing: Spacing.s2)],
                spacing: 8
            ) {
                ForEach(spot.services) { service in
                    HStack(spacing: Spacing.s2) {
                        Icon(service.icon, size: 13, strokeWidth: 2.2, color: Theme.Color.primary700)
                            .frame(width: 24, height: 24)
                            .background(Theme.Color.primary50)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                        Text(service.label)
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextStrong)
                            .lineLimit(1)
                        Spacer(minLength: Spacing.s0)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 9)
                    .background(Theme.Color.appSurfaceMuted)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
        }
        .padding(.top, 14)
        .accessibilityIdentifier("mailboxMapServices")
    }

    private func detailHours(_ spot: MailboxSpot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionLabel("Hours this week")
            HStack(spacing: 5) {
                ForEach(spot.weekHours) { day in
                    let isToday = day.weekday == viewModel.todayWeekday
                    VStack(spacing: 1) {
                        Text(day.label)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(isToday ? Theme.Color.primary700 : Theme.Color.appTextSecondary)
                        Text(day.hours)
                            .font(.system(size: 10.5, weight: .semibold))
                            .foregroundStyle(isToday ? Theme.Color.primary700 : Theme.Color.appTextStrong)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 7)
                    .background(isToday ? Theme.Color.primary50 : Theme.Color.appSurfaceMuted)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(isToday ? Theme.Color.primary200 : Theme.Color.appBorderSubtle, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(weekdayName(day.weekday)): \(day.hours)\(isToday ? ", today" : "")")
                }
            }
        }
        .padding(.top, 14)
        .accessibilityIdentifier("mailboxMapHours")
    }

    private func detailActionBar(_ spot: MailboxSpot) -> some View {
        HStack(spacing: Spacing.s2) {
            Button { openDirections(to: spot) } label: {
                HStack(spacing: 7) {
                    Icon(.navigation, size: 16, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    Text("Directions")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .shadow(color: Theme.Color.primary600.opacity(0.32), radius: 8, x: 0, y: 6)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("mailboxMapDetailDirections")
            .accessibilityLabel("Directions to \(spot.name)")
        }
        .padding(.horizontal, 14)
        .padding(.top, 10)
        .padding(.bottom, Spacing.s4)
        .background(Theme.Color.appSurface)
        .overlay(
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1),
            alignment: .top
        )
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 10.5, weight: .bold))
            .tracking(0.6)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.appTextMuted)
    }

    // MARK: - Actions

    private func select(_ id: String) {
        withAnimation(.interpolatingSpring(stiffness: 320, damping: 30)) {
            viewModel.select(id)
            dragTranslation = 0
        }
    }

    private func backToList() {
        withAnimation(.interpolatingSpring(stiffness: 320, damping: 30)) {
            viewModel.backToList()
            dragTranslation = 0
        }
    }

    /// Open Apple Maps with the spot's address as the directions
    /// destination. The screen's primary action — works without backend
    /// or live-map plumbing.
    private func openDirections(to spot: MailboxSpot) {
        let query = spot.address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        guard let url = URL(string: "https://maps.apple.com/?daddr=\(query)") else { return }
        openURL(url)
    }

    private func weekdayName(_ weekday: Int) -> String {
        let names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        let index = weekday - 1
        return (index >= 0 && index < names.count) ? names[index] : ""
    }
}

// MARK: - Pin

/// Square envelope pin — rounded square (Radii.sm) tinted by the spot
/// kind, glyph centered, tail caret, and a dual-halo pulse for the
/// active selection (suppressed under reduce-motion).
private struct MailboxMapPin: View {
    let kind: MailboxSpotKind
    var pulsing: Bool = false
    var dimmed: Bool = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false

    var body: some View {
        ZStack {
            if pulsing && !reduceMotion {
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .fill(kind.color.opacity(0.22))
                    .frame(width: 54, height: 54)
                    .scaleEffect(pulse ? 1.5 : 0.7)
                    .opacity(pulse ? 0 : 1)
                    .animation(.easeOut(duration: 1.6).repeatForever(autoreverses: false), value: pulse)
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(kind.color.opacity(0.30))
                    .frame(width: 40, height: 40)
                    .scaleEffect(pulse ? 1.4 : 0.7)
                    .opacity(pulse ? 0 : 1)
                    .animation(.easeOut(duration: 1.6).delay(0.4).repeatForever(autoreverses: false), value: pulse)
            }
            RoundedRectangle(cornerRadius: 1, style: .continuous)
                .fill(kind.color)
                .frame(width: 7, height: 7)
                .rotationEffect(.degrees(45))
                .offset(y: 14)
            ZStack {
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .fill(kind.color)
                    .frame(width: 26, height: 26)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                            .stroke(Color.white, lineWidth: 2)
                    )
                    .shadow(color: .black.opacity(0.30), radius: 3, x: 0, y: 2)
                Icon(kind.glyph, size: 13, strokeWidth: 2.4, color: .white)
            }
        }
        .frame(width: 54, height: 54)
        .opacity(dimmed ? 0.42 : 1)
        .onAppear { pulse = pulsing && !reduceMotion }
        .onChange(of: pulsing) { _, newValue in pulse = newValue && !reduceMotion }
    }
}

/// Dashed primary route from "you are here" to the selected pin.
private struct RouteLine: View {
    let from: CGPoint
    let to: CGPoint

    var body: some View {
        Path { path in
            path.move(to: from)
            let control = CGPoint(x: (from.x + to.x) / 2 - 24, y: (from.y + to.y) / 2 - 12)
            path.addQuadCurve(to: to, control: control)
        }
        .stroke(
            Theme.Color.primary600,
            style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [2, 6])
        )
        .opacity(0.85)
        .accessibilityHidden(true)
    }
}

private struct YouAreHereDot: View {
    var body: some View {
        Circle()
            .fill(Theme.Color.primary600)
            .frame(width: 14, height: 14)
            .overlay(Circle().stroke(Color.white, lineWidth: 3))
            .background(
                Circle()
                    .fill(Theme.Color.primary600.opacity(0.18))
                    .frame(width: 28, height: 28)
            )
    }
}

// MARK: - Stylized map decor

/// Token-only illustrative map backdrop — pale park / water blobs and
/// white street lines over the sunken surface. Purely decorative.
private struct MailboxMapDecor: View {
    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            let height = geo.size.height
            ZStack {
                Ellipse()
                    .fill(Theme.Color.homeBg)
                    .frame(width: 150, height: 110)
                    .position(x: width * 0.10, y: height * 0.20)
                Ellipse()
                    .fill(Theme.Color.homeBg)
                    .frame(width: 96, height: 70)
                    .position(x: width * 0.84, y: height * 0.46)
                Ellipse()
                    .fill(Theme.Color.primary50)
                    .frame(width: 190, height: 140)
                    .position(x: width * 0.96, y: height * 0.06)
                streets(width: width, height: height)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func streets(width: CGFloat, height: CGFloat) -> some View {
        ZStack {
            streetPath(width: width, height: height, y: 0.18, amplitude: -0.03, lineWidth: 6)
            streetPath(width: width, height: height, y: 0.40, amplitude: 0.03, lineWidth: 4)
            streetPath(width: width, height: height, y: 0.62, amplitude: -0.02, lineWidth: 6)
            verticalStreet(width: width, height: height, x: 0.26, lineWidth: 4)
            verticalStreet(width: width, height: height, x: 0.58, lineWidth: 6)
            verticalStreet(width: width, height: height, x: 0.82, lineWidth: 4)
        }
    }

    private func streetPath(width: CGFloat, height: CGFloat, y: CGFloat, amplitude: CGFloat, lineWidth: CGFloat) -> some View {
        Path { path in
            path.move(to: CGPoint(x: 0, y: height * y))
            path.addQuadCurve(
                to: CGPoint(x: width, y: height * (y + 0.02)),
                control: CGPoint(x: width * 0.5, y: height * (y + amplitude))
            )
        }
        .stroke(Color.white, lineWidth: lineWidth)
    }

    private func verticalStreet(width: CGFloat, height: CGFloat, x: CGFloat, lineWidth: CGFloat) -> some View {
        Path { path in
            path.move(to: CGPoint(x: width * x, y: 0))
            path.addQuadCurve(
                to: CGPoint(x: width * (x + 0.02), y: height),
                control: CGPoint(x: width * (x - 0.03), y: height * 0.5)
            )
        }
        .stroke(Color.white, lineWidth: lineWidth)
    }
}

// MARK: - Kind tile

private struct MailboxKindTile: View {
    let kind: MailboxSpotKind
    var size: CGFloat = 44
    var radius: CGFloat = 8
    var iconSize: CGFloat = 20

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(kind.color)
            Icon(kind.glyph, size: iconSize, strokeWidth: 2, color: .white)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Status badge

private func mailboxStatusBadge(isOpen: Bool) -> some View {
    Text(isOpen ? "OPEN" : "CLOSED")
        .font(.system(size: 9, weight: .bold))
        .tracking(0.4)
        .foregroundStyle(isOpen ? Theme.Color.success : Theme.Color.error)
        .padding(.horizontal, 5)
        .padding(.vertical, 1)
        .background(isOpen ? Theme.Color.successBg : Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
}

private struct MailboxServiceChipRow: View {
    let services: [MailboxServiceType]
    let maxCount: Int

    var body: some View {
        HStack(spacing: Spacing.s1) {
            ForEach(Array(services.prefix(maxCount)), id: \.self) { service in
                Text(service.chipLabel)
                    .font(.system(size: 9.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(1)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 1)
                    .background(Theme.Color.appSurfaceMuted)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                            .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
            }
        }
    }
}

// MARK: - Rail card

private struct MailboxSpotCard: View {
    let spot: MailboxSpot
    let active: Bool
    let onTap: () -> Void
    let onDirections: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                MailboxKindTile(kind: spot.kind, size: 44, radius: 8)
                VStack(alignment: .leading, spacing: 3) {
                    Text(spot.name)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    HStack(spacing: 5) {
                        mailboxStatusBadge(isOpen: spot.isOpen)
                        Text(spot.hoursLabel)
                            .font(.system(size: 10.5, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                    MailboxServiceChipRow(services: spot.services, maxCount: 2)
                    HStack(spacing: 3) {
                        Icon(.mapPin, size: 11, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
                        Text(spot.walkLabel)
                            .font(.system(size: 10.5, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: Spacing.s0)
                Button(action: onDirections) {
                    Icon(.navigation, size: 16, strokeWidth: 2.2, color: active ? Theme.Color.appTextInverse : Theme.Color.primary700)
                        .frame(width: 36, height: 36)
                        .background(active ? Theme.Color.primary600 : Theme.Color.primary50)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(active ? Color.clear : Theme.Color.primary200, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Directions to \(spot.name)")
                .accessibilityIdentifier("mailboxMapCardDirections_\(spot.id)")
            }
            .padding(11)
            .frame(width: 248, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(active ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: active ? 2 : 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .shadow(
                color: active ? Theme.Color.primary600.opacity(0.18) : .black.opacity(0.04),
                radius: active ? 6 : 2,
                x: 0,
                y: 2
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("mailboxMapCard_\(spot.id)")
    }
}

// MARK: - Expanded-list row

private struct MailboxSpotRow: View {
    let spot: MailboxSpot
    let onTap: () -> Void
    let onDirections: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                MailboxKindTile(kind: spot.kind, size: 44, radius: 10)
                VStack(alignment: .leading, spacing: 3) {
                    Text(spot.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    HStack(spacing: 5) {
                        mailboxStatusBadge(isOpen: spot.isOpen)
                        Text(spot.hoursLabel)
                            .font(.system(size: 10.5, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    MailboxServiceChipRow(services: spot.services, maxCount: 3)
                    HStack(spacing: 3) {
                        Icon(.mapPin, size: 11, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
                        Text(spot.walkLabel)
                            .font(.system(size: 10.5, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: Spacing.s0)
                Button(action: onDirections) {
                    Icon(.navigation, size: 16, strokeWidth: 2.2, color: Theme.Color.primary700)
                        .frame(width: 36, height: 36)
                        .background(Theme.Color.primary50)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(Theme.Color.primary200, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Directions to \(spot.name)")
                .accessibilityIdentifier("mailboxMapRowDirections_\(spot.id)")
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                Rectangle().fill(Theme.Color.appBorder.opacity(0.5)).frame(height: 1),
                alignment: .bottom
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("mailboxMapRow_\(spot.id)")
    }
}

// MARK: - Pagination dots

private struct MailboxPaginationDots: View {
    let total: Int
    let index: Int

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<max(total, 1), id: \.self) { i in
                Capsule()
                    .fill(i == index ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
                    .frame(width: i == index ? 16 : 5, height: 5)
            }
        }
        .accessibilityHidden(true)
    }
}

#if DEBUG
#Preview("Populated") {
    MailboxMapView(
        viewModel: MailboxMapViewModel(
            spots: MailboxMapSampleData.spots,
            todayWeekday: 4
        )
    ) {}
}

#Preview("Selected") {
    MailboxMapView(
        viewModel: MailboxMapViewModel(
            spots: MailboxMapSampleData.spots,
            seededState: .selected(
                spot: MailboxMapSampleData.spots[0],
                spots: MailboxMapSampleData.spots
            ),
            todayWeekday: 4
        )
    ) {}
}

#Preview("Error") {
    MailboxMapView(
        viewModel: MailboxMapViewModel(
            spots: MailboxMapSampleData.spots,
            seededState: .error(message: "Couldn't load mailbox spots."),
            todayWeekday: 4
        )
    ) {}
}
#endif
