//
//  HolidayCardDoors.swift
//  Pantopus
//
//  The ways into a Christmas card outside Mail (TABCARD, founder 2026-11-13):
//  the Mail tab's red envelope, Today's countdown, "Send a card" on a
//  person's page and in a chat's details, and the side menu's row. Each
//  shows exactly while Mail's own "Send a Christmas card" row does: the
//  `holiday_cards` and `mailbox` keys on and `GET /api/mailbox/cards`
//  answering `open`. Every door opens the one send flow, in the Mail tab.
//  The last answer is remembered per account, so the bar has the right icon
//  on the first frame after a relaunch; a failed check keeps it.
//

import Foundation
import Observation

/// Whether Christmas cards are open for the signed-in account, and who a card
/// can go to.
@Observable
@MainActor
final class HolidayCardDoors {
    static let shared = HolidayCardDoors()

    /// Cards are open: Mail's "Send a Christmas card" row shows.
    private(set) var isOpen = false

    /// Checks closer together than this reuse the last answer.
    static let recheckAfter: TimeInterval = 60

    @ObservationIgnored private var account: String?
    @ObservationIgnored private var lastChecked: Date?
    @ObservationIgnored private var inFlight: Task<Void, Never>?
    /// Who a card can go to, by account id, as the send flow's "Who it's for" finds them.
    @ObservationIgnored private var recipients: [String: (canSend: Bool, at: Date)] = [:]
    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    /// The doors' launch keys: Mail's row needs both.
    static var keysOn: Bool {
        LaunchFeatures.holidayCards && LaunchFeatures.mailbox
    }

    /// Reads `GET /api/mailbox/cards` again for `account` (the signed-in user
    /// id); nil closes every door. `force` skips the minute's reuse.
    func refresh(account newAccount: String?, force: Bool = false) async {
        guard Self.keysOn, let newAccount else {
            account = nil
            lastChecked = nil
            recipients = [:]
            if isOpen { isOpen = false }
            return
        }
        if newAccount != account {
            account = newAccount
            lastChecked = nil
            recipients = [:]
            let remembered = defaults.bool(forKey: Self.key(newAccount))
            if isOpen != remembered { isOpen = remembered }
        }
        if !force, let lastChecked, Date().timeIntervalSince(lastChecked) < Self.recheckAfter { return }
        if let inFlight {
            await inFlight.value
            return
        }
        let task = Task { await check(account: newAccount) }
        inFlight = task
        await task.value
        inFlight = nil
    }

    /// Mail read the same answer for its row: the doors follow it.
    func note(_ cards: HolidayCardsResponse, account noted: String?) {
        guard Self.keysOn, let noted, noted == account else { return }
        lastChecked = Date()
        apply(cards.open, account: noted)
    }

    /// Whether a card can go to this person: the send flow's own check
    /// (`GET /api/mailbox/cards/arrivals`: a person, not yourself, no block
    /// either way, and someone "Who it's for" finds by name). False while
    /// cards are closed or the answer can't be read.
    func canSend(to userId: String) async -> Bool {
        guard isOpen, let asking = account, !userId.isEmpty else { return false }
        if let known = recipients[userId], Date().timeIntervalSince(known.at) < Self.recheckAfter { return known.canSend }
        do {
            let _: HolidayCardArrivalsFor = try await APIClient.shared.request(HolidayCardEndpoints.arrivals(toUserId: userId))
            guard account == asking else { return false }
            recipients[userId] = (true, Date())
            return true
        } catch {
            guard account == asking else { return false }
            // A refusal (403 / 404) is an answer; anything else is asked again next time.
            switch error as? APIError {
            case .forbidden, .notFound, .clientError: recipients[userId] = (false, Date())
            default: break
            }
            return false
        }
    }

    private func check(account checked: String) async {
        let answer: HolidayCardsResponse? = try? await APIClient.shared.request(HolidayCardEndpoints.cards())
        // An account switch while the check ran: its answer isn't this account's.
        guard account == checked, let answer else { return }
        lastChecked = Date()
        apply(answer.open, account: checked)
    }

    private func apply(_ open: Bool, account: String) {
        if isOpen != open { isOpen = open }
        if !open { recipients = [:] }
        defaults.set(open, forKey: Self.key(account))
    }

    private static func key(_ account: String) -> String {
        "pantopus.holidayCards.open.\(account)"
    }
}

// MARK: - The season's dates

/// The Mail tab wears the red envelope from November 1 through December 25,
/// on the device's clock (founder 2026-11-13: "make that right now").
func isChristmasMailSeason(_ now: Date, calendar: Calendar = .current) -> Bool {
    let day = calendar.dateComponents([.month, .day], from: now)
    return day.month == 11 || (day.month == 12 && (day.day ?? 32) <= 25)
}

/// Whole calendar days from today to December 25 of this year, on the
/// device's local date: 1 on Christmas Eve, 0 on the day, negative after.
func daysToChristmas(_ now: Date, calendar: Calendar = .current) -> Int {
    let today = calendar.startOfDay(for: now)
    let year = calendar.component(.year, from: now)
    guard let christmas = calendar.date(from: DateComponents(year: year, month: 12, day: 25)) else { return -1 }
    return calendar.dateComponents([.day], from: today, to: calendar.startOfDay(for: christmas)).day ?? -1
}

/// The date the season's doors are drawn for: the device's clock. A Debug
/// build can be moved to another day with `PANTOPUS_DEBUG_TODAY=YYYY-MM-DD`
/// (a launch argument `-PANTOPUS_DEBUG_TODAY 2026-12-26`, or the environment,
/// `SIMCTL_CHILD_PANTOPUS_DEBUG_TODAY` from `simctl launch`); the clock keeps
/// running from there. A Release build has no such override.
enum ChristmasClock {
    static var now: Date {
        #if DEBUG
        if let debugShift { return Date().addingTimeInterval(debugShift) }
        #endif
        return Date()
    }

    #if DEBUG
    /// How far the override moves today, read once at launch.
    private static let debugShift: TimeInterval? = {
        let process = ProcessInfo.processInfo
        let flag = "-PANTOPUS_DEBUG_TODAY"
        var raw = process.environment["PANTOPUS_DEBUG_TODAY"]
        if let index = process.arguments.firstIndex(of: flag), index + 1 < process.arguments.count {
            raw = process.arguments[index + 1]
        }
        guard let raw else { return nil }
        let parts = raw.split(separator: "-").compactMap { Int($0) }
        let calendar = Calendar.current
        guard parts.count == 3,
              let day = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) else { return nil }
        return day.timeIntervalSince(calendar.startOfDay(for: Date()))
    }()
    #endif
}
