//
//  CrewDaysMineViewModel.swift
//  Pantopus
//
//  10. Your Crew Days (build kit 01-spec.md, board `MyCrewDays`):
//  `GET /api/crew-days/mine` → coming up, asked for, done.
//

import Foundation

@Observable
@MainActor
final class CrewDaysMineViewModel {
    private(set) var state: CrewDayLoad<CrewDayMineResponse> = .loading

    func load() async {
        do {
            let mine: CrewDayMineResponse = try await APIClient.shared.request(CrewDayEndpoints.mine())
            state = .loaded(mine)
        } catch {
            if state.value == nil { state = .failed(CrewDayErrors.sentence(for: error)) }
        }
    }
}

/// Your Crew Days' words: a booking's or a request's chip, and each row's line.
enum CrewDaysMineCopy {
    /// "Requested" isn't "Booked"; "Paused" isn't "Refunded" (01-spec.md rule 10).
    static func chip(_ card: CrewDayCardDTO) -> (text: String, tone: CrewDayChip.Tone) {
        if card.problemStatus == "open" { return ("Paused", .waiting) }
        return chips[card.status ?? ""] ?? ("Booked", .good)
    }

    private static let chips: [String: (text: String, tone: CrewDayChip.Tone)] = [
        "price_pending": ("Requested", .neutral),
        "price_offered": ("Price ready", .waiting),
        "new_dates": ("Pick a date", .waiting),
        "on_the_way": ("On the way", .info),
        "done": ("Done", .good),
        "payment_failed": ("Payment due", .bad),
        "paid": ("Paid", .good),
        "refunded": ("Refunded", .neutral),
        "cancelled": ("Cancelled", .neutral),
        "declined": ("Not taken", .neutral)
    ]

    static func requestChip(_ request: CrewDayCardDTO) -> (text: String, tone: CrewDayChip.Tone) {
        switch request.status {
        case "offer_ready": ("Offer ready", .good)
        case "no_crew": ("No crew yet", .neutral)
        default: ("Finding an option", .neutral)
        }
    }

    /// "Sat, Nov 21 · Example Gutter Co.".
    static func upcomingLine(_ card: CrewDayCardDTO) -> String {
        [CrewDayFormat.shortDay(card.serviceDate, timezone: card.timezone), card.crewName ?? ""]
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    /// "Tue, Nov 17 · Paid $180 · 3 photos".
    static func pastLine(_ card: CrewDayCardDTO) -> String {
        let day = CrewDayFormat.shortDay(card.serviceDate, timezone: card.timezone)
        let money: String = switch card.status {
        case "paid": card.priceCents.map { "Paid \(CrewDayFormat.price($0 - (card.charge?.refundedCents ?? 0)))" } ?? "Paid"
        case "refunded": "Refunded"
        case "declined": "Not taken · nothing charged"
        default: "Cancelled · nothing charged"
        }
        let photos = card.photoCount.flatMap { $0 > 0 ? ($0 == 1 ? "1 photo" : "\($0) photos") : nil }
        return [day, money, photos].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }

    /// "Asked Nov 3 · March or April".
    static func requestLine(_ request: CrewDayCardDTO) -> String {
        let asked = CrewDayFormat.instant(request.createdAt).map { "Asked \(monthDay($0))" }
        return [asked, months(request.months ?? [])].compactMap { $0 }.joined(separator: " · ")
    }

    /// ["2026-03", "2026-04"] → "March or April"; ["any"] → "Any time".
    static func months(_ months: [String]) -> String {
        guard !months.isEmpty, !months.contains("any") else { return "Any time" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let names = months.compactMap { value -> String? in
            let parts = value.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 2, (1...12).contains(parts[1]) else { return nil }
            return formatter.standaloneMonthSymbols[parts[1] - 1]
        }
        guard let last = names.last else { return "Any time" }
        return names.count == 1 ? last : "\(names.dropLast().joined(separator: ", ")) or \(last)"
    }

    private static func monthDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = CrewDayFormat.calendar(nil).timeZone
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}
