//
//  CrewDayRouteView.swift
//  Pantopus
//
//  16. The route (build kit 01-spec.md, boards `Route`, `RouteDark`,
//  `RouteLarge`): "6 homes · 9 AM–1 PM", "2 of 6 done", the homes in order
//  (number, address and first name in the job window, the job, the access
//  note's first line, the status), the crew's own order, and under the next
//  home On my way and Running late. A row opens 17, one home.
//

import SwiftUI

struct CrewDayRouteView: View {
    @State var viewModel: CrewDayRouteViewModel
    let onBack: () -> Void
    let onOpenHome: (CrewDayHomeDTO) -> Void
    @State private var sheet: CrewDayRouteSheet?
    @State private var toast: String?

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar.crewDay(title: title, onLeading: onBack)
            content
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        .onReceive(NotificationCenter.default.publisher(for: .crewDayChanged)) { _ in
            Task { await viewModel.load() }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .sheet(item: $sheet) { which in
            switch which {
            case let .onMyWay(home):
                CrewDayOnMyWaySheet(viewModel: viewModel, home: home)
            case .late:
                CrewDayRunningLateSheet(viewModel: viewModel)
            }
        }
        .overlay(alignment: .bottom) {
            if let toast {
                ToastView(message: ToastMessage(text: toast))
                    .padding(.bottom, Spacing.s6)
                    .dismissToast(after: toast, minimum: 2.5) { self.toast = nil }
            }
        }
        .onChange(of: viewModel.notice) { _, notice in
            guard let notice else { return }
            toast = notice
            viewModel.notice = nil
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayRoute")
    }

    /// "Route · Tue, Nov 17".
    private var title: String {
        guard let route = viewModel.route else { return "Route" }
        return "Route · \(CrewDayFormat.shortDay(route.date, timezone: route.timezone))"
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            CrewDayLoadingView()
        case let .failed(message):
            CrewDayErrorView(headline: "Couldn't load the route", message: message) { await viewModel.load() }
        case let .loaded(route):
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    if route.dates.count > 1 { dates(route) }
                    header(route)
                    if let error = viewModel.actionError { CrewDayErrorText(text: error, identifier: "crewDayRouteError") }
                    if route.homes.isEmpty {
                        Text("No homes on this date.")
                            .planFont(.body)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    } else {
                        homes(route)
                    }
                }
                .padding(Spacing.s4)
            }
            .refreshable { await viewModel.load() }
            // Arranging: the order is saved from a footer that stays in view however long the route is.
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if viewModel.arranging != nil {
                    CrewDayFooter {
                        CrewDayButtonRow(spacing: Spacing.s2) {
                            Button("Cancel") { viewModel.arranging = nil }
                                .crewDayButton(.tonal)
                                .accessibilityIdentifier("crewDayRouteCancelOrder")
                            Button { Task { await viewModel.saveOrder() } } label: {
                                PlanButtonLabel(title: "Save order", isLoading: viewModel.working)
                            }
                            .crewDayButton(.primary)
                            .accessibilityIdentifier("crewDayRouteSaveOrder")
                        }
                    }
                }
            }
        }
    }

    // MARK: - Header

    private func dates(_ route: CrewDayRouteDTO) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(route.dates, id: \.self) { date in
                    let selected = date == route.date
                    Button { Task { await viewModel.show(date: date) } } label: {
                        Text(CrewDayFormat.shortDay(date, timezone: route.timezone))
                            .planFont(selected ? .bodyStrong : .body)
                            .foregroundStyle(selected ? Theme.Color.primary700 : Theme.Color.appText)
                            .padding(.horizontal, 14)
                            .frame(minHeight: 40)
                            .background(Capsule().fill(selected ? Theme.Color.primary50 : Theme.Color.appSurface))
                            .overlay(Capsule().stroke(selected ? Theme.Color.primary700 : Theme.Color.appBorderStrong, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
                    .accessibilityIdentifier("crewDayRouteDate_\(date)")
                }
            }
        }
    }

    private func header(_ route: CrewDayRouteDTO) -> some View {
        CrewDayCard {
            Text("\(CrewDayFormat.homes(route.total)) · \(CrewDayFormat.window(route.windowStart, route.windowEnd))")
                .planFont(.h4)
                .foregroundStyle(Theme.Color.appText)
            Text("\(route.done) of \(route.total) done")
                .planFont(.bodyStrong)
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appTextStrong)
                .accessibilityIdentifier("crewDayRouteDone")
            ProgressView(value: Double(route.done), total: Double(max(route.total, 1)))
                .tint(Theme.Color.successSolid)
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("crewDayRouteHeader")
    }

    // MARK: - Homes

    private func homes(_ route: CrewDayRouteDTO) -> some View {
        let arranging = viewModel.arranging
        let list = arranging ?? route.homes
        return VStack(alignment: .leading, spacing: Spacing.s3) {
            CrewDayHeaderRow {
                Text.planOverline("Homes in route order")
            } trailing: {
                if arranging == nil {
                    Button("Change order") { viewModel.startArranging() }
                        .crewDayButton(.text, size: .extraSmall)
                        .accessibilityIdentifier("crewDayRouteReorder")
                }
            }
            ForEach(Array(list.enumerated()), id: \.element.id) { index, home in
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    CrewDayRouteRow(
                        number: index + 1,
                        home: home,
                        timezone: route.timezone,
                        isNext: arranging == nil && viewModel.nextHome?.id == home.id
                    ) { onOpenHome(home) }
                    if arranging != nil { arrangeButtons(home, index: index, count: list.count) }
                    if arranging == nil, viewModel.nextHome?.id == home.id { nextButtons(home) }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayRouteHomes")
    }

    private func arrangeButtons(_ home: CrewDayHomeDTO, index: Int, count: Int) -> some View {
        CrewDayButtonRow(spacing: Spacing.s2) {
            Button { viewModel.move(home, by: -1) } label: {
                PlanButtonLabel(title: "Move up", icon: .chevronUp, kind: .tonal)
            }
            .crewDayButton(.tonal, size: .small)
            .disabled(index == 0)
            .accessibilityLabel("Move \(CrewDayRouteCopy.place(home)) up")
            .accessibilityIdentifier("crewDayRouteUp_\(home.id)")
            Button { viewModel.move(home, by: 1) } label: {
                PlanButtonLabel(title: "Move down", icon: .chevronDown, kind: .tonal)
            }
            .crewDayButton(.tonal, size: .small)
            .disabled(index == count - 1)
            .accessibilityLabel("Move \(CrewDayRouteCopy.place(home)) down")
            .accessibilityIdentifier("crewDayRouteDown_\(home.id)")
        }
    }

    private func nextButtons(_ home: CrewDayHomeDTO) -> some View {
        CrewDayButtonRow(spacing: 10) {
            Button("On my way") { sheet = .onMyWay(home) }
                .crewDayButton(.primary, size: .small)
                .accessibilityIdentifier("crewDayRouteOnMyWay")
            Button("Running late") { sheet = .late }
                .crewDayButton(.secondary, size: .small)
                .accessibilityIdentifier("crewDayRouteLate")
        }
    }
}

/// The route's sheets.
enum CrewDayRouteSheet: Identifiable {
    case onMyWay(CrewDayHomeDTO)
    case late

    var id: String {
        switch self {
        case let .onMyWay(home): "way-\(home.id)"
        case .late: "late"
        }
    }
}

/// One home on the route: its number, who and where (in the job window), the job, the note, the status.
struct CrewDayRouteRow: View {
    let number: Int
    let home: CrewDayHomeDTO
    let timezone: String?
    let isNext: Bool
    let onOpen: () -> Void
    @ScaledMetric(relativeTo: .body) private var badgeSize: CGFloat = 32
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Button(action: onOpen) {
            Group {
                if typeSize.isAccessibilitySize {
                    // The words keep the full width: the number and the chevron go on a line above them.
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        HStack {
                            numberBadge
                            Spacer()
                            chevron
                        }
                        words
                    }
                } else {
                    HStack(alignment: .top, spacing: Spacing.s3) {
                        numberBadge
                        words.frame(maxWidth: .infinity, alignment: .leading)
                        chevron.padding(.top, Spacing.s2)
                    }
                }
            }
            .padding(Spacing.s3)
            .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.appSurface))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous)
                    .stroke(
                        isNext || CrewDayRouteCopy.tone(home) == .onTheWay ? Theme.Color.primarySolid : Theme.Color.appBorder,
                        lineWidth: 1
                    )
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel("Stop \(number). " + accessibilityText)
        .accessibilityIdentifier("crewDayRouteHome_\(home.id)")
    }

    private var numberBadge: some View {
        Text("\(number)")
            .planFont(.bodyStrong)
            .foregroundStyle(badgeInk)
            .frame(width: badgeSize, height: badgeSize)
            .background(Circle().fill(badge))
            .accessibilityHidden(true)
    }

    private var chevron: some View {
        Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary)
    }

    private var words: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(CrewDayRouteCopy.title(home))
                .planFont(.bodyStrong)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            if !home.details.isEmpty {
                Text(home.details.prefix(1).uppercased() + home.details.dropFirst())
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let note = CrewDayRouteCopy.noteLine(home) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Icon(.lock, size: 12, color: Theme.Color.appTextSecondary)
                    Text(note)
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            CrewDayChip(text: CrewDayRouteCopy.status(home, timezone: timezone), tone: chipTone)
                .accessibilityIdentifier("crewDayRouteStatus_\(home.id)")
            if let gate = home.gateReadyAt, CrewDayRouteCopy.tone(home) != .done {
                CrewDayChip(
                    text: "Gate is ready · \(CrewDayFormat.time(CrewDayFormat.instant(gate), timezone: timezone))",
                    tone: .good
                )
                .accessibilityIdentifier("crewDayRouteGate_\(home.id)")
            }
        }
    }

    /// What VoiceOver reads for the row: everything it shows, the access note and the gate included.
    private var accessibilityText: String {
        var parts = [CrewDayRouteCopy.title(home), home.details]
        if let note = CrewDayRouteCopy.noteLine(home) { parts.append("Note: \(note)") }
        parts.append(CrewDayRouteCopy.status(home, timezone: timezone))
        if let gate = home.gateReadyAt, CrewDayRouteCopy.tone(home) != .done {
            parts.append("Gate is ready, \(CrewDayFormat.time(CrewDayFormat.instant(gate), timezone: timezone))")
        }
        // A part that ends its own sentence ("Back gate is unlatched.") doesn't get a second stop.
        let trimmed = parts.map { $0.hasSuffix(".") ? String($0.dropLast()) : $0 }
        return trimmed.filter { !$0.isEmpty }.joined(separator: ". ")
    }

    private var badge: Color {
        switch CrewDayRouteCopy.tone(home) {
        case .done: Theme.Color.successSolid
        case .onTheWay: Theme.Color.primarySolid
        case .cantGetIn: Theme.Color.warningLight
        case .waiting, .ended: Theme.Color.appSurfaceSunken
        }
    }

    private var badgeInk: Color {
        switch CrewDayRouteCopy.tone(home) {
        case .done, .onTheWay: Theme.Color.appTextInverse
        case .cantGetIn: Theme.Color.warningDeep
        case .waiting, .ended: Theme.Color.appTextStrong
        }
    }

    private var chipTone: CrewDayChip.Tone {
        switch CrewDayRouteCopy.tone(home) {
        case .done: .good
        case .onTheWay: .info
        case .cantGetIn: .waiting
        case .waiting, .ended: .neutral
        }
    }
}
