//
//  CrewDayTodayCards.swift
//  Pantopus
//
//  Crew Day on Today (build kit 01-spec.md screen 9, board `Today`): "Your
//  booking" while it is close or needs an answer, with the buttons its state
//  needs (Gate is ready, Everything looks good, Pick a date, Message the
//  crew), and "Coming to your street" for an open day whose area holds my
//  home. Beside the Plans cards, in their shape. Only while `crew_day` is on.
//

import SwiftUI

@Observable
@MainActor
final class CrewDayTodayModel {
    private(set) var response = CrewDayTodayResponse()
    /// The booking a button is working on.
    private(set) var working: String?
    var error: String?

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

    /// "Gate is ready" or "Everything looks good", then the cards read again.
    func act(_ card: CrewDayCardDTO, _ endpoint: (String) -> Endpoint) async {
        guard let bookingId = card.bookingId, working == nil else { return }
        working = bookingId
        error = nil
        defer { working = nil }
        do {
            _ = try await APIClient.shared.request(endpoint(bookingId), as: CrewDayBookingWriteResponse.self)
            NotificationCenter.default.post(name: .crewDayChanged, object: nil)
        } catch {
            self.error = CrewDayErrors.sentence(for: error)
        }
        await load()
    }

    /// "Message the crew": the direct conversation with the crew's business.
    func messageCrew(_ card: CrewDayCardDTO) async {
        guard let crewUserId = card.crewUserId else { return }
        do {
            let room: CreateDirectChatResponse = try await APIClient.shared.request(
                ChatEndpoints.createDirectChat(otherUserId: crewUserId)
            )
            DeepLinkRouter.shared.handle(path: "/chat/\(room.roomId)")
        } catch {
            self.error = "Couldn't open the conversation with the crew. Try again."
        }
    }
}

struct CrewDayTodayCards: View {
    /// The space goes above the cards (Today puts them under its agenda) instead of below.
    var gapAbove = false
    @State private var model = CrewDayTodayModel()
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if LaunchFeatures.crewDay {
                ForEach(model.response.mine) { card in bookingCard(card) }
                ForEach(model.response.nearby) { card in nearbyCard(card) }
                if let error = model.error, !isEmpty {
                    CrewDayErrorText(text: error, identifier: "crewDayTodayError")
                }
            }
        }
        .padding(gapAbove ? .top : .bottom, isEmpty ? 0 : Spacing.s4)
        .task { await model.load() }
        .onReceive(NotificationCenter.default.publisher(for: .crewDayChanged)) { _ in
            Task { await model.load() }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayToday")
    }

    private var isEmpty: Bool {
        model.response.mine.isEmpty && model.response.nearby.isEmpty
    }

    // MARK: - Your booking

    private func bookingCard(_ card: CrewDayCardDTO) -> some View {
        cardShell(
            overline: CrewDayTodayCopy.overline(card),
            title: card.title ?? "Your Crew Day",
            line: CrewDayTodayCopy.line(card)
        ) {
            bookingButtons(card)
        } onOpen: {
            open(card)
        }
        .accessibilityIdentifier("crewDayTodayBooking")
    }

    @ViewBuilder
    private func bookingButtons(_ card: CrewDayCardDTO) -> some View {
        let busy = model.working == card.bookingId
        switch CrewDayTodayCopy.state(card) {
        case "on_the_way":
            CrewDayButtonRow(spacing: 10) {
                if card.crewUserId != nil {
                    Button("Message the crew") { Task { await model.messageCrew(card) } }
                        .crewDayButton(.tonal, size: .small)
                        .accessibilityIdentifier("crewDayTodayMessage")
                }
                if card.gateReadyAt == nil {
                    Button { Task { await model.act(card, CrewDayEndpoints.gateReady) } } label: {
                        PlanButtonLabel(title: "Gate is ready", isLoading: busy)
                    }
                    .crewDayButton(.primary, size: .small)
                    .disabled(busy)
                    .accessibilityIdentifier("crewDayTodayGateReady")
                } else {
                    openButton(card, kind: .secondary)
                }
            }
        case "done":
            Button { Task { await model.act(card, CrewDayEndpoints.confirm) } } label: {
                PlanButtonLabel(title: "Everything looks good", isLoading: busy)
            }
            .crewDayButton(.primary, size: .small)
            .disabled(busy)
            .accessibilityIdentifier("crewDayTodayLooksGood")
        case "price_ready":
            primaryOpen(card, title: "See your price", identifier: "crewDayTodaySeeYourPrice")
        case "new_dates":
            primaryOpen(card, title: "Pick a date", identifier: "crewDayTodayPickDate")
        case "payment_failed":
            primaryOpen(card, title: "Pay now", identifier: "crewDayTodayPayNow")
        default:
            openButton(card, kind: .primary)
        }
    }

    private func primaryOpen(_ card: CrewDayCardDTO, title: String, identifier: String) -> some View {
        Button(title) { open(card) }
            .crewDayButton(.primary, size: .small)
            .accessibilityIdentifier(identifier)
    }

    private func openButton(_ card: CrewDayCardDTO, kind: PlanButtonStyle.Kind) -> some View {
        Button("Open") { open(card) }
            .crewDayButton(kind, size: .small)
            .accessibilityIdentifier("crewDayTodayOpen")
    }

    // MARK: - Coming to your street

    private func nearbyCard(_ card: CrewDayCardDTO) -> some View {
        cardShell(overline: "Coming to your street", title: card.title ?? "Crew Day", line: nearbyLine(card)) {
            CrewDayButtonRow(spacing: 10) {
                Button("Not for me") { Task { await model.dismiss(card) } }
                    .crewDayButton(.tonal, size: .small)
                    .accessibilityIdentifier("crewDayTodayNotForMe")
                Button("See my price") { invite(card) }
                    .crewDayButton(.primary, size: .small)
                    .accessibilityIdentifier("crewDayTodaySeePrice")
            }
        } onOpen: {
            invite(card)
        }
        .accessibilityIdentifier("crewDayTodayNearby")
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
                // At the accessibility text sizes the tile stays by the overline instead of floating mid-card.
                HStack(alignment: typeSize.isAccessibilitySize ? .top : .center, spacing: Spacing.s3) {
                    CrewDayTile()
                    VStack(alignment: .leading, spacing: 1) {
                        Text.planOverline(overline)
                        Text(title).planFont(.h4).foregroundStyle(Theme.Color.appText).multilineTextAlignment(.leading)
                        Text(line)
                            .planFont(.small)
                            .monospacedDigit()
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .multilineTextAlignment(.leading)
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
        .accessibilityElement(children: .contain)
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

/// The Today card's words for a booking's state (01-spec.md screen 9, board `Today`).
enum CrewDayTodayCopy {
    /// The server's `today_state`; the status when an older server leaves it out.
    static func state(_ card: CrewDayCardDTO) -> String {
        if card.problemStatus == "open" { return "paused" }
        if let state = card.todayState { return state }
        switch card.status {
        case "price_offered": return "price_ready"
        case "booked": return isTomorrow(card) ? "tomorrow" : "booked"
        default: return card.status ?? ""
        }
    }

    static func overline(_ card: CrewDayCardDTO) -> String {
        switch state(card) {
        case "on_the_way": "Crew on the way"
        case "done": "Done: check the photos"
        case "new_dates": "Pick a new date"
        case "price_ready": "Your price is ready"
        case "payment_failed": "Your card didn't go through"
        case "today": "Crew Day today"
        case "tomorrow": "Crew Day tomorrow"
        case "price_pending": "Price check"
        case "paused": "Pantopus support has this"
        case "paid": "Paid"
        default: "Your Crew Day"
        }
    }

    /// The one line under the title, by state (board `Today`).
    static func line(_ card: CrewDayCardDTO) -> String {
        let tz = card.timezone
        let day = CrewDayFormat.shortDay(card.serviceDate, timezone: tz)
        let window = CrewDayFormat.window(card.windowStart, card.windowEnd)
        let price = card.priceCents.map(CrewDayFormat.price)
        switch state(card) {
        case "on_the_way":
            let eta = CrewDayFormat.window(
                from: CrewDayFormat.instant(card.eta?.start),
                to: CrewDayFormat.instant(card.eta?.end),
                timezone: tz
            )
            if card.gateReadyAt != nil { return "We told the crew the gate is ready." }
            return eta.isEmpty ? "Today · \(window)" : "Today · expected \(eta)"
        case "done":
            let due = CrewDayFormat.instant(card.charge?.dueAt)
            guard let price, let due else { return "\(day) · Done" }
            return "Charges \(price) \(relativeDay(due, timezone: tz)) at \(CrewDayFormat.time(due, timezone: tz))"
        case "price_ready":
            return [day, price, "approve to book"].compactMap { $0 }.joined(separator: " · ")
        case "new_dates":
            return "Rain moved it · pick a new date"
        case "payment_failed":
            return [price.map { "Pay \($0)" }, card.crewName.map { "to \($0)" }].compactMap { $0 }.joined(separator: " ")
        case "paused":
            return "Your charge is paused while we sort it out."
        case "today":
            return ["Today", window, "Booked"].filter { !$0.isEmpty }.joined(separator: " · ")
        default:
            return [day, window, statusWord(card.status)].filter { !$0.isEmpty }.joined(separator: " · ")
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
        case "payment_failed": "Payment due"
        case "new_dates": "Pick a date"
        case "cancelled": "Cancelled"
        default: ""
        }
    }

    /// "today" or "tomorrow" (or "Wed, Nov 18") for an instant, in the Crew Day's zone.
    static func relativeDay(_ instant: Date, timezone: String?) -> String {
        let calendar = CrewDayFormat.calendar(timezone)
        if calendar.isDateInToday(instant) { return "today" }
        if calendar.isDateInTomorrow(instant) { return "tomorrow" }
        return CrewDayFormat.shortDay(instant: instant, timezone: timezone)
    }

    private static func isTomorrow(_ card: CrewDayCardDTO) -> Bool {
        guard let day = CrewDayFormat.day(card.serviceDate, timezone: card.timezone) else { return false }
        return CrewDayFormat.calendar(card.timezone).isDateInTomorrow(day)
    }
}
