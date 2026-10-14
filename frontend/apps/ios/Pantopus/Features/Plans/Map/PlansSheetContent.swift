//
//  PlansSheetContent.swift
//  Pantopus
//
//  What the Plans sheet holds: the first plans at its lowest stop (F1), the
//  whole list pulled up (F2: Your plans, then each day, then More nearby
//  with Pulse and Connections), a tapped pin's card (F3), "Nothing planned
//  yet" (F4) and "See plans near you" (F5).
//

import SwiftUI

struct PlansSheetContent: View {
    let viewModel: PlansMapViewModel
    let actions: PlansMapActions
    let onStop: (PlansSheetStop) -> Void

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Group {
            switch viewModel.phase {
            case .locating:
                loading
            case .needsLocation:
                PlansLocationCard(viewModel: viewModel)
            case .ready:
                ready
            }
        }
        .padding(.horizontal, Spacing.s4)
    }

    @ViewBuilder private var ready: some View {
        if let id = viewModel.selectedId {
            PlanPinCard(viewModel: viewModel, planId: id, actions: actions)
        } else if !viewModel.listLoaded, let error = viewModel.listError {
            errorState(error)
        } else if !viewModel.listLoaded {
            loading
        } else if viewModel.isEmpty {
            PlansEmptyCard(viewModel: viewModel, actions: actions)
        } else if viewModel.sheetStop == .peek {
            peek
        } else {
            PlansListSheet(viewModel: viewModel, actions: actions, onStop: onStop)
        }
    }

    // MARK: - Peek (F1)

    private var peek: some View {
        let cards = viewModel.visibleCards
        return VStack(alignment: .leading, spacing: 2) {
            // Side by side; stacked when the text is too large for one line.
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline) {
                    peekTitleText
                    Spacer(minLength: Spacing.s2)
                    seeAll(count: cards.count)
                }
                VStack(alignment: .leading, spacing: 0) {
                    peekTitleText
                    seeAll(count: cards.count)
                }
            }
            // The two soonest near you (your own plans among them); one at the
            // largest text sizes, so the row has room for its words.
            let first = Array(cards.prefix(typeSize.isAccessibilitySize ? 1 : 2))
            ForEach(Array(first.enumerated()), id: \.element.id) { index, card in
                PlanRow(model: rowModel(card).withTrailing(.chevron), showsDivider: index > 0) {
                    actions.openPlan(card, card.id, .view)
                }
            }
            if first.isEmpty {
                Text("Nothing within 5 miles \(windowPhrase). Plans farther away show on the map.")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.vertical, Spacing.s3)
            }
        }
        // Whole lines even when the stop is too short for them (the largest
        // text): the sheet cuts off the bottom instead of shrinking the words.
        .fixedSize(horizontal: false, vertical: true)
    }

    private var peekTitleText: some View {
        Text(peekTitle)
            .planFont(.h4)
            .foregroundStyle(Theme.Color.appText)
            .accessibilityAddTraits(.isHeader)
    }

    @ViewBuilder private func seeAll(count: Int) -> some View {
        if count > 2 {
            Button("See all \(count)") { onStop(.full) }
                .planFont(.smallStrong)
                .foregroundStyle(Theme.Color.primaryInk)
                .frame(minHeight: 44)
                .accessibilityIdentifier("plansSeeAll")
        }
    }

    private func rowModel(_ card: PlanCardDTO) -> PlanRowModel {
        if viewModel.yourPlans.contains(where: { $0.id == card.id }) {
            return .mine(card, requestsCount: card.requestsCount)
        }
        return .listed(card)
    }

    private var peekTitle: String {
        switch viewModel.window {
        case .now: "Happening now near you"
        case .today: "Today near you"
        case .week: "This week near you"
        case .weekend: "This weekend near you"
        }
    }

    private var windowPhrase: String {
        switch viewModel.window {
        case .now: "right now"
        case .today: "today"
        case .week: "this week"
        case .weekend: "this weekend"
        }
    }

    // MARK: - Loading and errors

    private var loading: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Shimmer(width: 180, height: 20, cornerRadius: Radii.sm)
            ForEach(0..<2, id: \.self) { _ in
                HStack(spacing: Spacing.s3) {
                    Shimmer(width: 44, height: 44, cornerRadius: Radii.lg)
                    VStack(alignment: .leading, spacing: 6) {
                        Shimmer(width: 200, height: 14, cornerRadius: Radii.xs)
                        Shimmer(width: 140, height: 12, cornerRadius: Radii.xs)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement()
        .accessibilityLabel("Loading plans")
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Text(message)
                .planFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button("Try again") { Task { await viewModel.refresh() } }
                .planButton(.secondary, size: .small)
                .frame(maxWidth: 200)
                .accessibilityIdentifier("plansRetry")
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s3)
    }
}

extension PlanRowModel {
    func withTrailing(_ trailing: PlanRowTrailing) -> PlanRowModel {
        PlanRowModel(id: id, kind: kind, title: title, subtitle: subtitle, trailing: trailing, accessibilityLabel: accessibilityLabel)
    }
}

// MARK: - The list pulled up (F2)

struct PlansListSheet: View {
    let viewModel: PlansMapViewModel
    let actions: PlansMapActions
    let onStop: (PlansSheetStop) -> Void

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    if !viewModel.visibleYourPlans.isEmpty {
                        section("Your plans", cards: viewModel.visibleYourPlans, mine: true)
                    }
                    ForEach(days, id: \.title) { day in
                        section(day.title, cards: day.cards, mine: false)
                    }
                    if days.isEmpty {
                        Text("No other \(viewModel.kindFilter?.title.lowercased() ?? "plans") near you yet.")
                            .planFont(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .padding(.top, Spacing.s4)
                    }
                    moreNearby
                }
                .padding(.bottom, Spacing.s6)
            }
            .refreshable { await viewModel.refresh() }
            .scrollIndicators(.hidden)
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 0) {
                Text("Plans near \(viewModel.areaName ?? "you")")
                    .planFont(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text("\(windowName) · within 5 mi")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button { onStop(.peek) } label: {
                Icon(.map, size: 20, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Theme.Color.appSurfaceSunken))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back to the map")
            .accessibilityIdentifier("plansBackToMap")
        }
        .padding(.bottom, Spacing.s2)
    }

    private var windowName: String {
        switch viewModel.window {
        case .now: "Now"
        case .today: "Today"
        case .week: "This week"
        case .weekend: "This weekend"
        }
    }

    /// The plans near you that aren't yours, by day.
    private var days: [(title: String, cards: [PlanCardDTO])] {
        let mine = Set(viewModel.yourPlans.map(\.id))
        var order: [String] = []
        var grouped: [String: [PlanCardDTO]] = [:]
        for card in viewModel.visibleCards where !mine.contains(card.id) {
            // A playdate's time is hidden until you're in; its day (`starts_on`) still heads it.
            // A week or more out goes under "Later", as on Android.
            let title = card.state == .live ? "Today" : (card.startsAtDate ?? card.startsOnDate).map {
                PlanFormat.listSection($0, calendar: PlanFormat.calendar(for: card.timezone))
            } ?? "This week"
            if grouped[title] == nil { order.append(title) }
            grouped[title, default: []].append(card)
        }
        return order.map { ($0, grouped[$0] ?? []) }
    }

    private func section(_ title: String, cards: [PlanCardDTO], mine: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text.planOverline(title)
                .padding(.top, Spacing.s4)
                .padding(.bottom, 2)
            ForEach(Array(cards.enumerated()), id: \.element.id) { index, card in
                PlanRow(
                    model: mine ? .mine(card, requestsCount: card.requestsCount) : .listed(card),
                    showsDivider: index > 0
                ) {
                    actions.openPlan(card, card.id, .view)
                }
            }
        }
    }

    private var moreNearby: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text.planOverline("More nearby")
                .padding(.top, Spacing.s4)
                .padding(.bottom, 2)
            doorRow(title: "Pulse", subtitle: "Local posts and questions", icon: .rss, divider: false, action: actions.openPulse)
                .accessibilityIdentifier("plansDoor.pulse")
            doorRow(
                title: "Connections",
                subtitle: "Keep up with people you know",
                icon: .users,
                divider: true,
                action: actions.openConnections
            )
            .accessibilityIdentifier("plansDoor.connections")
        }
    }

    private func doorRow(
        title: String,
        subtitle: String,
        icon: PantopusIcon,
        divider: Bool,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 0) {
                if divider { Divider().overlay(Theme.Color.appBorder) }
                HStack(spacing: Spacing.s3) {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .fill(Theme.Color.primarySolid)
                        .frame(width: 44, height: 44)
                        .overlay(Icon(icon, size: 22, color: Theme.Color.appTextInverse))
                    VStack(alignment: .leading, spacing: 0) {
                        Text(title).planFont(.rowTitle).foregroundStyle(Theme.Color.appText)
                        Text(subtitle).planFont(.footnote).foregroundStyle(Theme.Color.appTextSecondary).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
                .padding(.vertical, 11)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}
