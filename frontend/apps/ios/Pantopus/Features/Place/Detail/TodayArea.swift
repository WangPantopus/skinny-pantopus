//
//  TodayArea.swift
//  Pantopus
//
//  The city around someone who has no address on Pantopus yet (TABCARD
//  section 4, drawing TodayNoAddress). "Use my location" on Today reads one
//  fix, rounds it to two decimal places (about a kilometre) and keeps it on
//  this phone for the signed-in account only, with the city's name and when
//  it was read. Today and Place's address-first screen show that city's sky,
//  sun and air from `POST /api/saved-places/area/today` (a saved address's
//  Today that stores nothing). The exact fix never leaves this file, and
//  another account never sees this one's area or its answer.
//

import Foundation
import Observation

/// An account's area: the rounded point, what the server calls it, and when
/// the phone read the fix.
struct TodayArea: Codable, Equatable {
    let latitude: Double
    let longitude: Double
    /// "Vancouver, WA"; nil until Today's first answer names it.
    var label: String?
    var city: String?
    var readAt: Date

    /// Two decimal places, about a kilometre: nothing finer is sent or kept.
    static func rounded(_ value: Double) -> Double {
        (value * 100).rounded() / 100
    }

    func samePoint(as other: TodayArea) -> Bool {
        latitude == other.latitude && longitude == other.longitude
    }

    /// Tells one point's screens from another's.
    var identity: String {
        "area:\(latitude),\(longitude)"
    }
}

@Observable
@MainActor
final class TodayAreaStore {
    static let shared = TodayAreaStore()

    /// Bumped on every write, so views reading an area follow it.
    private(set) var revision = 0

    /// The last answer for an account's point, shared by Today and Place.
    private struct Answer {
        let snapshot: ScreenSnapshot<PlaceIntelligence>
        let expiresAt: Date
    }

    @ObservationIgnored private var answers: [String: Answer] = [:]
    @ObservationIgnored private var inFlight: [String: Task<ScreenSnapshot<PlaceIntelligence>, any Error>] = [:]
    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    /// The signed-in account's area; nil before "Use my location".
    var area: TodayArea? {
        Self.account.flatMap(area(for:))
    }

    func area(for account: String) -> TodayArea? {
        _ = revision
        guard let data = defaults.data(forKey: Self.key(account)) else { return nil }
        return try? JSONDecoder().decode(TodayArea.self, from: data)
    }

    // MARK: - Reading the fix

    /// The account whose "Use my location" is reading a fix, and the one whose
    /// last try got none. Kept here rather than in the card, which Today
    /// redraws when the system's question closes.
    private var locatingAccount: String?
    private var refusedAccount: String?

    var isLocating: Bool {
        locatingAccount != nil && locatingAccount == Self.account
    }

    /// Location was refused or is off (or no fix came) on the last try.
    var wasRefused: Bool {
        refusedAccount != nil && refusedAccount == Self.account
    }

    /// "Use my location": the system asks first if it never has. With a fix,
    /// its rounded point is kept for this account (the name comes with
    /// Today's answer). False when location is refused or off, or no fix came.
    func locate() async -> Bool {
        guard let account = Self.account, locatingAccount == nil else { return false }
        locatingAccount = account
        defer { locatingAccount = nil }
        guard let fix = await DeviceLocationProvider.shared.requestCurrent(timeoutSeconds: 8), Self.account == account else {
            if Self.account == account { refusedAccount = account }
            return false
        }
        refusedAccount = nil
        keep(latitude: fix.latitude, longitude: fix.longitude, account: account)
        return true
    }

    /// Today showing an area over an hour old while location stays allowed:
    /// one quiet fix, never a question. The area that should show now when
    /// its rounded point moved; nil when it didn't (or no fix came).
    func refreshIfOld(now: Date = Date()) async -> TodayArea? {
        guard let account = Self.account, let kept = area(for: account),
              now.timeIntervalSince(kept.readAt) > Self.maxAge,
              DeviceLocationProvider.shared.isAuthorized,
              let fix = await DeviceLocationProvider.shared.requestCurrent(timeoutSeconds: 4),
              Self.account == account else { return nil }
        return keep(latitude: fix.latitude, longitude: fix.longitude, account: account) ? area(for: account) : nil
    }

    /// Keeps the rounded point; true when it moved.
    @discardableResult
    private func keep(latitude: Double, longitude: Double, account: String) -> Bool {
        let point = TodayArea(latitude: TodayArea.rounded(latitude), longitude: TodayArea.rounded(longitude), readAt: Date())
        if var kept = area(for: account), kept.samePoint(as: point) {
            kept.readAt = point.readAt
            write(kept, account: account)
            return false
        }
        write(point, account: account)
        return true
    }

    private func write(_ area: TodayArea, account: String) {
        guard let data = try? JSONEncoder().encode(area) else { return }
        defaults.set(data, forKey: Self.key(account))
        revision += 1
    }

    // MARK: - Today for the area

    /// The kept answer for this account's point while it is fresh (Today's
    /// ten minutes, and never past midnight where the area is).
    func keptToday(for area: TodayArea, now: Date = Date()) -> ScreenSnapshot<PlaceIntelligence>? {
        guard let account = Self.account, let kept = answers[Self.answerKey(account, area)], now < kept.expiresAt else { return nil }
        return kept.snapshot.checkingAlerts(now: now)
    }

    /// Today for the area: the kept answer while fresh, else one request
    /// (shared by Today and Place). `force` for pull to refresh and Try again.
    /// A reply that lands for another account is dropped.
    func today(for area: TodayArea, force: Bool = false) async throws -> ScreenSnapshot<PlaceIntelligence> {
        guard let account = Self.account else { throw CancellationError() }
        if !force, let kept = keptToday(for: area) { return kept }
        let key = Self.answerKey(account, area)
        if let running = inFlight[key] { return try await running.value }
        let task = Task { @MainActor in
            try await self.fetch(area, account: account)
        }
        inFlight[key] = task
        defer { inFlight[key] = nil }
        return try await task.value
    }

    private func fetch(_ area: TodayArea, account: String) async throws -> ScreenSnapshot<PlaceIntelligence> {
        let body = AreaTodayBody(latitude: area.latitude, longitude: area.longitude)
        let response: AreaTodayResponse = try await APIClient.shared.request(SavedPlacesEndpoints.areaToday(body))
        guard Self.account == account else { throw CancellationError() }
        let now = Date()
        let snapshot = ScreenSnapshot(value: response.today, fetchedAt: now, isFresh: true, refreshFailed: false, kind: .today)
        let zone = response.today.timeZone.flatMap(TimeZone.init(identifier:)) ?? .current
        let expiresAt = min(now.addingTimeInterval(ScreenDataKind.today.freshFor), PlaceStoreReads.nextMidnight(after: now, in: zone))
        answers = answers.filter { $0.key.hasPrefix("\(account)|") }
        answers[Self.answerKey(account, area)] = Answer(snapshot: snapshot, expiresAt: expiresAt)
        // The name comes with the answer, for the point still kept.
        if var kept = self.area(for: account), kept.samePoint(as: area),
           kept.label != response.area.label || kept.city != response.area.city {
            kept.label = response.area.label
            kept.city = response.area.city
            write(kept, account: account)
        }
        return snapshot.checkingAlerts(now: now)
    }

    // MARK: - Keys

    private static var account: String? {
        if case let .signedIn(user) = AuthManager.shared.state { return user.id }
        return nil
    }

    private static func key(_ account: String) -> String {
        "pantopus.todayArea.\(account)"
    }

    private static func answerKey(_ account: String, _ area: TodayArea) -> String {
        "\(account)|\(area.identity)"
    }

    /// How old an area may get before Today reads the fix again: an hour. A
    /// Debug build can shorten it with `PANTOPUS_DEBUG_AREA_MAX_AGE=<seconds>`
    /// (the environment, `SIMCTL_CHILD_PANTOPUS_DEBUG_AREA_MAX_AGE` from
    /// `simctl launch`, or a launch argument); a Release build has no such knob.
    static var maxAge: TimeInterval {
        #if DEBUG
        if let debugMaxAge { return debugMaxAge }
        #endif
        return 3600
    }

    #if DEBUG
    private static let debugMaxAge: TimeInterval? = {
        let process = ProcessInfo.processInfo
        let flag = "-PANTOPUS_DEBUG_AREA_MAX_AGE"
        var raw = process.environment["PANTOPUS_DEBUG_AREA_MAX_AGE"]
        if let index = process.arguments.firstIndex(of: flag), index + 1 < process.arguments.count {
            raw = process.arguments[index + 1]
        }
        return raw.flatMap(TimeInterval.init).flatMap { $0 >= 0 ? $0 : nil }
    }()
    #endif
}
