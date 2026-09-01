//
//  WhosFreeView.swift
//  Pantopus
//
//  Stream I11 — F7 Who's Free · Household Availability. A heat grid (members ×
//  time-of-day) composed from each member's personal availability. Free / busy /
//  unknown cells; tap a free block for "Find a time here" or a quick add.
//

import SwiftUI

// swiftlint:disable:next type_body_length
struct WhosFreeView: View {
    @State private var viewModel: WhosFreeViewModel
    @State private var selectedMemberId: String?
    @State private var selection: WhosFreeSelection?

    init(viewModel: WhosFreeViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    private var isOffline: Bool {
        !NetworkMonitor.shared.isOnline
    }

    private struct WhosFreeSelection: Identifiable, Hashable {
        let member: FindATimeMember
        let bucketIndex: Int
        var id: String {
            "\(member.id)-\(bucketIndex)"
        }
    }

    var body: some View {
        content
            .background(Theme.Color.appBg)
            .navigationTitle("Who's free")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    // Design mutes the Add action while composing (loading) and
                    // while showing offline-cached data (FrameComposing / FrameOffline).
                    let addMuted = isOffline || viewModel.phase == .loading
                    Button("Add") { viewModel.startFindATime() }
                        .foregroundStyle(addMuted ? Theme.Color.appTextMuted : Theme.Color.homeDark)
                        .disabled(addMuted)
                }
            }
            .task { await viewModel.load() }
            .accessibilityIdentifier("scheduling.whosFree")
            .alert("Added to calendar", isPresented: actionMessagePresented) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.actionMessage ?? "")
            }
            .alert("Something went wrong", isPresented: actionErrorPresented) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.actionError ?? "")
            }
    }

    private var content: some View {
        VStack(spacing: 0) {
            head
            switch viewModel.phase {
            case .loading:
                loadingBody
            case let .error(message):
                ErrorState(headline: "Couldn't load availability", message: message) {
                    await viewModel.refresh()
                }
            case .ready:
                loadedBody
            }
        }
    }

    // MARK: Head

    private var head: some View {
        VStack(spacing: Spacing.s2) {
            FindATimeSegmented(
                options: ["Day", "Week"],
                selectedIndex: viewModel.viewMode == .day ? 0 : 1,
                height: 28
            ) { index in
                viewModel.setViewMode(index == 0 ? .day : .week)
            }
            HStack(spacing: Spacing.s1) {
                Icon(.layers, size: 11, color: Theme.Color.home)
                Text("Composed from each member's personal availability.")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    // MARK: Loaded

    private var loadedBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                if isOffline {
                    offlineBanner
                }
                filterChips
                if viewModel.hasNoFreeTime {
                    emptyBanner
                }
                FindATimeCard {
                    grid
                    legend
                }
                .opacity(isOffline ? 0.6 : 1)
                if viewModel.hasNoFreeTime {
                    FindATimeSecondaryButton(title: "Try next week", icon: .chevronRight) {
                        viewModel.setViewMode(.week)
                    }
                } else if let unknownName = viewModel.firstUnknownMemberName {
                    optedOutBanner(name: unknownName)
                } else {
                    HStack(spacing: Spacing.s1) {
                        Icon(.handPointer, size: 12, color: Theme.Color.appTextMuted)
                        Text("Tap a free block to plan something")
                            .font(.system(size: 10.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(Spacing.s3)
        }
        .popover(item: $selection) { selected in
            popoverCard(selected)
                .presentationCompactAdaptation(.popover)
        }
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                chip(title: "All", isOn: selectedMemberId == nil) { selectedMemberId = nil }
                ForEach(viewModel.rows) { row in
                    chip(title: row.member.displayName, isOn: selectedMemberId == row.member.id) {
                        selectedMemberId = row.member.id
                    }
                }
            }
        }
    }

    private func chip(title: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 11, weight: isOn ? .bold : .semibold))
                .foregroundStyle(isOn ? Theme.Color.homeDark : Theme.Color.appTextStrong)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, 5)
                .background(isOn ? Theme.Color.homeBg : Theme.Color.appSurface)
                .clipShape(Capsule())
                .overlay {
                    Capsule().strokeBorder(isOn ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
    }

    private var displayedRows: [WhosFreeViewModel.GridRow] {
        guard let id = selectedMemberId else { return viewModel.rows }
        return viewModel.rows.filter { $0.member.id == id }
    }

    // MARK: Grid

    private var grid: some View {
        Grid(alignment: .center, horizontalSpacing: 3, verticalSpacing: 3) {
            GridRow {
                Color.clear.frame(width: 58, height: 14)
                ForEach(Array(viewModel.columnLabels.enumerated()), id: \.offset) { _, label in
                    Text(label)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .frame(maxWidth: .infinity)
                }
            }
            ForEach(displayedRows) { row in
                GridRow {
                    HStack(spacing: Spacing.s1) {
                        MemberAvatarBadge(member: row.member, size: 18, showsBorder: false)
                        Text(row.member.displayName)
                            .font(.system(size: 10.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                    }
                    .frame(width: 58, alignment: .leading)
                    ForEach(Array(row.cells.enumerated()), id: \.offset) { index, state in
                        cell(state, member: row.member, bucketIndex: index)
                    }
                }
            }
        }
    }

    private func cell(_ state: WhosFreeViewModel.CellState, member: FindATimeMember, bucketIndex: Int) -> some View {
        RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
            .fill(cellColor(state))
            .frame(height: 26)
            .frame(maxWidth: .infinity)
            .overlay {
                // Off-hours + unknown cells carry the design's 45° hatch texture.
                if state == .offHours || state == .unknown {
                    DiagonalHatch(line: Theme.Color.appBorder)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                }
            }
            .overlay(alignment: .topLeading) {
                if state == .free {
                    Circle().fill(Theme.Color.home).frame(width: 5, height: 5).padding(3)
                }
            }
            .overlay {
                if state == .unknown {
                    Text("?")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                if state == .free {
                    selection = WhosFreeSelection(member: member, bucketIndex: bucketIndex)
                }
            }
            .accessibilityElement()
            .accessibilityLabel(Text(cellAccessibility(state, member: member, bucketIndex: bucketIndex)))
    }

    private func cellColor(_ state: WhosFreeViewModel.CellState) -> Color {
        switch state {
        case .free: Theme.Color.homeBg
        case .busy: Theme.Color.appSurfaceSunken
        case .tentative: Theme.Color.warmAmberBg
        case .offHours: Theme.Color.appSurfaceMuted
        case .unknown: Theme.Color.appSurfaceMuted
        }
    }

    private func cellAccessibility(_ state: WhosFreeViewModel.CellState, member: FindATimeMember, bucketIndex: Int) -> String {
        let stateLabel: String = switch state {
        case .free: "free"
        case .busy: "busy"
        case .tentative: "tentative"
        case .offHours: "off-hours"
        case .unknown: "availability unknown"
        }
        return "\(member.displayName), \(viewModel.columnLabels[bucketIndex]), \(stateLabel)"
    }

    // MARK: Legend

    private var legend: some View {
        // Design loaded legend is Free / Busy / Tentative / Off-hours; the
        // opted-out frame swaps Off-hours → Unknown when a member hasn't shared.
        HStack(spacing: Spacing.s4) {
            legendItem(state: .free, label: "Free")
            legendItem(state: .busy, label: "Busy")
            legendItem(state: .tentative, label: "Tentative")
            if viewModel.hasUnknownMember {
                legendItem(state: .unknown, label: "Unknown")
            } else {
                legendItem(state: .offHours, label: "Off-hours")
            }
            Spacer(minLength: 0)
        }
        .padding(.top, Spacing.s2)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    private func legendItem(state: WhosFreeViewModel.CellState, label: String) -> some View {
        HStack(spacing: Spacing.s1) {
            RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                .fill(cellColor(state))
                .frame(width: 13, height: 13)
                .overlay {
                    if state == .offHours || state == .unknown {
                        DiagonalHatch(line: Theme.Color.appBorder)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
                    }
                }
                .overlay(alignment: .topLeading) {
                    if state == .free {
                        Circle().fill(Theme.Color.home).frame(width: 4, height: 4).padding(2)
                    }
                }
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    // MARK: Empty banner

    private var emptyBanner: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.calendarX, size: 15, color: Theme.Color.info)
            VStack(alignment: .leading, spacing: 2) {
                Text("No overlapping free time this \(viewModel.viewMode == .day ? "day" : "week")")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.info)
                Text("Everyone's booked up. Try next week to find a shared opening.")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.infoBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.infoLight, lineWidth: 1)
        }
    }

    // MARK: Amber banners (opted-out · offline-cached)

    /// Frame 4 — an opted-out member's row is all-unknown; the design pairs it
    /// with an amber `eye-off` explainer.
    private func optedOutBanner(name: String) -> some View {
        amberBanner(
            icon: .eyeOff,
            title: "\(name) hasn't shared free/busy",
            body: "You can't see \(name)'s availability or include \(name) in Find a time until they share it."
        )
    }

    /// Frame 5 — showing last-synced data while offline.
    private var offlineBanner: some View {
        amberBanner(
            icon: .wifiOff,
            title: "Showing last synced",
            body: "Reconnect to refresh availability."
        )
    }

    private func amberBanner(icon: PantopusIcon, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(icon, size: 15, color: Theme.Color.warning)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.warning)
                Text(body)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.warningLight, lineWidth: 1)
        }
    }

    // MARK: Popover

    private func popoverCard(_ selected: WhosFreeSelection) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(viewModel.rangeLabel(member: selected.member, bucketIndex: selected.bucketIndex))
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Button {
                selection = nil
                viewModel.findATimeHere(member: selected.member)
            } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.users, size: 13, color: Theme.Color.homeDark)
                    Text("Find a time here")
                    Spacer()
                }
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.homeDark)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.homeBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            Button {
                let captured = selected
                selection = nil
                Task { await viewModel.addEvent(member: captured.member, bucketIndex: captured.bucketIndex) }
            } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.calendarPlus, size: 13, color: Theme.Color.appTextStrong)
                    Text("Add event")
                    Spacer()
                }
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.appTextStrong)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                }
            }
            .buttonStyle(.plain)
        }
        .padding(Spacing.s3)
        .frame(width: 134) // Design whos-free-frames.jsx:42 specifies width:134
    }

    // MARK: Loading

    private var loadingBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text("Building this week's availability")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity)
                    .padding(.top, Spacing.s2)
                FindATimeCard {
                    ForEach(0..<4, id: \.self) { _ in
                        HStack(spacing: Spacing.s2) {
                            Shimmer(width: 18, height: 18, cornerRadius: Radii.pill)
                            Shimmer(width: 30, height: 9, cornerRadius: Radii.xs)
                            ForEach(0..<6, id: \.self) { _ in
                                Shimmer(height: 26, cornerRadius: Radii.sm)
                            }
                        }
                    }
                }
            }
            .padding(Spacing.s3)
        }
    }

    private var actionMessagePresented: Binding<Bool> {
        Binding(
            get: { viewModel.actionMessage != nil },
            set: { if !$0 { viewModel.actionMessage = nil } }
        )
    }

    private var actionErrorPresented: Binding<Bool> {
        Binding(
            get: { viewModel.actionError != nil },
            set: { if !$0 { viewModel.actionError = nil } }
        )
    }
}

/// The 45° hatch texture the design draws on off-hours / unknown cells via a
/// `repeating-linear-gradient(45deg, …)`. Thin parallel strokes over the cell's
/// base fill; the caller clips it to the cell's rounded rect.
private struct DiagonalHatch: View {
    var line: Color
    var spacing: CGFloat = 4
    var lineWidth: CGFloat = 1

    var body: some View {
        GeometryReader { proxy in
            let extent = proxy.size.width + proxy.size.height
            Path { path in
                var offset = -proxy.size.height
                while offset < extent {
                    path.move(to: CGPoint(x: offset, y: 0))
                    path.addLine(to: CGPoint(x: offset + proxy.size.height, y: proxy.size.height))
                    offset += spacing
                }
            }
            .stroke(line, lineWidth: lineWidth)
        }
        .accessibilityHidden(true)
    }
}
