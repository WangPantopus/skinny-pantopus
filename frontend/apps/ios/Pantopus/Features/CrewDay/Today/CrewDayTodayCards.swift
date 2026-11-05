//
//  CrewDayTodayCards.swift
//  Pantopus
//
//  Crew Day on Today (build kit 01-spec.md screen 9, board `Today`): "Your
//  booking" while it is close or needs an answer, and "Coming to your
//  street" for an open day whose area holds my home. Beside the Plans cards,
//  in their shape. Only while `crew_day` is on.
//

import SwiftUI

@Observable
@MainActor
final class CrewDayTodayModel {
    private(set) var response = CrewDayTodayResponse()

    func load() async {
        guard LaunchFeatures.crewDay else {
            response = CrewDayTodayResponse()
            return
        }
        if let today: CrewDayTodayResponse = try? await APIClient.shared.request(CrewDayEndpoints.today()) {
            response = today
        }
    }

    /// "Not for me": the card goes for good.
    func dismiss(_ card: CrewDayCardDTO) async {
        guard let crewDayId = card.crewDayId else { return }
        response = CrewDayTodayResponse(mine: response.mine, nearby: response.nearby.filter { $0.id != card.id })
        _ = try? await APIClient.shared.request(CrewDayEndpoints.dismiss(crewDayId: crewDayId), as: EmptyResponse.self)
    }
}

struct CrewDayTodayCards: View {
    /// The space goes above the cards (Today puts them under its agenda) instead of below.
    var gapAbove = false
    @State private var model = CrewDayTodayModel()

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if LaunchFeatures.crewDay {
                ForEach(model.response.mine) { card in bookingCard(card) }
                ForEach(model.response.nearby) { card in nearbyCard(card) }
            }
        }
        .padding(gapAbove ? .top : .bottom, isEmpty ? 0 : Spacing.s4)
        .task { await model.load() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayToday")
    }

    private var isEmpty: Bool {
        model.response.mine.isEmpty && model.response.nearby.isEmpty
    }

    // MARK: - Your booking

    private func bookingCard(_ card: CrewDayCardDTO) -> some View {
        cardShell(overline: CrewDayTodayCopy.overline(card), title: card.title ?? "Your Crew Day", line: bookingLine(card)) {
            Button("Open") { open(card) }
                .planButton(.primary, size: .small)
                .accessibilityIdentifier("crewDayTodayOpen")
        } onOpen: {
            open(card)
        }
    }

    /// "Tue, Nov 17 · 9 AM–1 PM · Booked".
    private func bookingLine(_ card: CrewDayCardDTO) -> String {
        [
            CrewDayFormat.shortDay(card.serviceDate, timezone: card.timezone),
            CrewDayFormat.window(card.windowStart, card.windowEnd),
            CrewDayTodayCopy.statusWord(card.status)
        ]
        .filter { !$0.isEmpty }
        .joined(separator: " · ")
    }

    // MARK: - Coming to your street

    private func nearbyCard(_ card: CrewDayCardDTO) -> some View {
        cardShell(overline: "Coming to your street", title: card.title ?? "Crew Day", line: nearbyLine(card)) {
            HStack(spacing: 10) {
                Button("Not for me") { Task { await model.dismiss(card) } }
                    .planButton(.tonal, size: .small)
                    .accessibilityIdentifier("crewDayTodayNotForMe")
                Button("See my price") { invite(card) }
                    .planButton(.primary, size: .small)
                    .accessibilityIdentifier("crewDayTodaySeePrice")
            }
        } onOpen: {
            invite(card)
        }
    }

    /// "Tue, Nov 17 · from $140".
    private func nearbyLine(_ card: CrewDayCardDTO) -> String {
        var parts = [CrewDayFormat.shortDay(card.serviceDate, timezone: card.timezone)]
        if let from = card.priceFromCents { parts.append("from \(CrewDayFormat.price(from))") }
        return parts.filter { !$0.isEmpty }.joined(separator: " · ")
    }

    // MARK: - Shared

    private func cardShell(
        overline: String,
        title: String,
        line: String,
        @ViewBuilder buttons: () -> some View,
        onOpen: @escaping () -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Button(action: onOpen) {
                HStack(spacing: Spacing.s3) {
                    CrewDayTile()
                    VStack(alignment: .leading, spacing: 1) {
                        Text.planOverline(overline)
                        Text(title).planFont(.h4).foregroundStyle(Theme.Color.appText).multilineTextAlignment(.leading)
                        Text(line).planFont(.small).monospacedDigit().foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)
            buttons()
        }
        .padding(Spacing.s4)
        .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous)
                .stroke(Theme.Color.home.opacity(0.4), lineWidth: 1)
        )
    }

    private func open(_ card: CrewDayCardDTO) {
        guard let bookingId = card.bookingId else { return }
        DeepLinkRouter.shared.handle(path: "/app/crew-days/bookings/\(bookingId)")
    }

    private func invite(_ card: CrewDayCardDTO) {
        guard let code = card.code else { return }
        DeepLinkRouter.shared.handle(path: "/crew-day/\(code)")
    }
}

/// The home-green icon tile Crew Day cards lead with.
struct CrewDayTile: View {
    var size: CGFloat = 44

    var body: some View {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Theme.Color.homeBg)
            .frame(width: size, height: size)
            .overlay(Icon(.truck, size: size * 0.45, color: Theme.Color.home))
            .accessibilityHidden(true)
    }
}

/// The Today card's words for a booking's state (01-spec.md screen 9).
enum CrewDayTodayCopy {
    static func overline(_ card: CrewDayCardDTO) -> String {
        switch card.status {
        case "on_the_way": "Crew on the way"
        case "done": "Done: check the photos"
        case "new_dates": "Pick a new date"
        case "price_offered": "Your price is ready"
        case "price_pending": "Price check"
        default: isTomorrow(card) ? "Crew Day tomorrow" : "Your Crew Day"
        }
    }

    /// "Booked", "Requested" (never "Booked" before the price is approved).
    static func statusWord(_ status: String?) -> String {
        switch status {
        case "booked": "Booked"
        case "price_pending", "price_offered": "Requested"
        case "on_the_way": "On the way"
        case "done": "Done"
        case "paid": "Paid"
        case "payment_failed": "Payment needed"
        case "new_dates": "New date needed"
        case "cancelled": "Cancelled"
        default: ""
        }
    }

    private static func isTomorrow(_ card: CrewDayCardDTO) -> Bool {
        guard let day = CrewDayFormat.day(card.serviceDate, timezone: card.timezone) else { return false }
        return CrewDayFormat.calendar(card.timezone).isDateInTomorrow(day)
    }
}
