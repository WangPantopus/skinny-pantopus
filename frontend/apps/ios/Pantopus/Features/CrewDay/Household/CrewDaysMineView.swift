//
//  CrewDaysMineView.swift
//  Pantopus
//
//  10. Your Crew Days (build kit 01-spec.md, board `MyCrewDays`), from the
//  side menu: "Coming up" (bookings with a status chip), "Asked for" (street
//  requests: Finding an option · Offer ready · No crew yet), "Done" (date,
//  price paid, photos; Book again when the same crew opened a new day here),
//  then "Want a crew on your street?" and Ask for a Crew Day.
//

import SwiftUI

struct CrewDaysMineView: View {
    @State var viewModel: CrewDaysMineViewModel
    let onBack: () -> Void
    let onOpenBooking: (String) -> Void
    let onOpenInvitation: (String) -> Void
    let onAsk: () -> Void
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar.crewDay(title: "Your Crew Days", onLeading: onBack)
            content
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        .onReceive(NotificationCenter.default.publisher(for: .crewDayChanged)) { _ in
            Task { await viewModel.load() }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDaysMine")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            CrewDayLoadingView()
        case let .failed(message):
            CrewDayErrorView(headline: "Couldn't load your Crew Days", message: message) { await viewModel.load() }
        case let .loaded(mine):
            if mine.upcoming.isEmpty, mine.requests.isEmpty, mine.past.isEmpty {
                empty
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.s5) {
                        if !mine.upcoming.isEmpty { section("Coming up", mine.upcoming) { upcomingRow($0) } }
                        if !mine.requests.isEmpty { section("Asked for", mine.requests) { requestRow($0) } }
                        if !mine.past.isEmpty { section("Done", mine.past) { pastRow($0) } }
                        askCard
                    }
                    .padding(Spacing.s4)
                }
                .refreshable { await viewModel.load() }
            }
        }
    }

    // MARK: - Rows

    private func section(
        _ title: String,
        _ cards: [CrewDayCardDTO],
        @ViewBuilder row: @escaping (CrewDayCardDTO) -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            CrewDaySectionTitle(text: title)
            VStack(spacing: 0) {
                ForEach(Array(cards.enumerated()), id: \.element.id) { index, card in
                    if index > 0 { Divider().overlay(Theme.Color.appBorder) }
                    row(card)
                }
            }
            .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.appSurface))
            .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        }
    }

    private func upcomingRow(_ card: CrewDayCardDTO) -> some View {
        let chip = CrewDaysMineCopy.chip(card)
        return rowButton(identifier: "crewDaysMineBooking_\(card.bookingId ?? card.id)") {
            if let bookingId = card.bookingId { onOpenBooking(bookingId) }
        } label: {
            rowContent(title: card.title ?? "Crew Day", line: CrewDaysMineCopy.upcomingLine(card), chip: chip, chevron: true)
        }
    }

    private func requestRow(_ request: CrewDayCardDTO) -> some View {
        let chip = CrewDaysMineCopy.requestChip(request)
        let note = request.status == "no_crew" ? request.answerNote : nil
        return Group {
            if let code = request.offerCode {
                rowButton(identifier: "crewDaysMineRequest_\(request.id)") { onOpenInvitation(code) } label: {
                    rowContent(title: request.title ?? "Crew Day", line: CrewDaysMineCopy.requestLine(request), chip: chip, chevron: true)
                }
            } else {
                rowContent(title: request.title ?? "Crew Day", line: CrewDaysMineCopy.requestLine(request), chip: chip, note: note)
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("crewDaysMineRequest_\(request.id)")
            }
        }
    }

    private func pastRow(_ card: CrewDayCardDTO) -> some View {
        CrewDayButtonRow(spacing: Spacing.s2) {
            rowButton(identifier: "crewDaysMinePast_\(card.bookingId ?? card.id)") {
                if let bookingId = card.bookingId { onOpenBooking(bookingId) }
            } label: {
                rowContent(title: card.title ?? "Crew Day", line: CrewDaysMineCopy.pastLine(card), chip: nil, chevron: false)
            }
            if let code = card.bookAgainCode {
                Button("Book again") { onOpenInvitation(code) }
                    .crewDayButton(.tonal, size: .extraSmall)
                    .padding(.trailing, Spacing.s4)
                    .accessibilityIdentifier("crewDaysMineBookAgain_\(card.bookingId ?? card.id)")
            }
        }
    }

    private func rowButton(identifier: String, action: @escaping () -> Void, @ViewBuilder label: () -> some View) -> some View {
        Button(action: action) { label().contentShape(Rectangle()) }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)
            .accessibilityIdentifier(identifier)
    }

    private func rowContent(
        title: String,
        line: String,
        chip: (text: String, tone: CrewDayChip.Tone)?,
        note: String? = nil,
        chevron: Bool = false
    ) -> some View {
        HStack(alignment: typeSize.isAccessibilitySize ? .top : .center, spacing: Spacing.s3) {
            CrewDayTile(size: 40)
            VStack(alignment: .leading, spacing: 2) {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: Spacing.s2) {
                        rowTitle(title)
                        chip.map { CrewDayChip(text: $0.text, tone: $0.tone) }
                    }
                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        rowTitle(title)
                        chip.map { CrewDayChip(text: $0.text, tone: $0.tone) }
                    }
                }
                Text(line)
                    .planFont(.small)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if let note, !note.isEmpty {
                    Text("Pantopus: \(note)")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if chevron { Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary) }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(minHeight: 64)
    }

    private func rowTitle(_ title: String) -> some View {
        Text(title)
            .planFont(.bodyStrong)
            .foregroundStyle(Theme.Color.appText)
            .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Ask, empty

    private var askCard: some View {
        CrewDayCard {
            VStack(alignment: .leading, spacing: 2) {
                CrewDaySectionTitle(text: "Want a crew on your street?")
                Text("Tell us the service. We look for a local crew.")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Button("Ask for a Crew Day", action: onAsk)
                .crewDayButton(.secondary)
                .accessibilityIdentifier("crewDaysMineAsk")
        }
    }

    private var empty: some View {
        EmptyState(
            icon: .truck,
            headline: "No Crew Days yet",
            subcopy: "When a local crew comes to your street, you'll book it here.",
            cta: EmptyState.CTA(title: "Ask for a Crew Day") { @MainActor in onAsk() },
            tint: Theme.Color.homeBg,
            accent: Theme.Color.home
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("crewDaysMineEmpty")
    }
}
