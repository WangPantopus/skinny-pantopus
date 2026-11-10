//
//  MomentsTabDot.swift
//  Pantopus
//
//  The dot on the Moments tab (the founder's 2026-11-10 addition): someone
//  near you has added a Moment since you last had the tab open. It's a
//  count of people from `GET /api/moments/unseen` for about two miles around
//  where the map would open: the phone's location when that's already
//  allowed (never asked for here), else the home, else no dot. Opening the
//  tab clears it at once. The same read tells the server this app has
//  Moments, which is what lets it send "added a Moment" pushes here. A
//  server without the route, a failed read, the flag off or signed out: no dot.
//

import Foundation
import Observation

@Observable
@MainActor
final class MomentsTabDot {
    static let shared = MomentsTabDot()

    /// Someone near you has a Moment that's new since the tab was last open.
    private(set) var hasNew = false

    /// Reads closer together than this are skipped unless something happened (a push, the viewer closed).
    static let rereadAfter: TimeInterval = 300

    @ObservationIgnored private var account: String?
    @ObservationIgnored private var tabOpen = false
    @ObservationIgnored private var lastRead: Date?
    @ObservationIgnored private var reading: Task<Void, Never>?
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let location: any LocationProviding

    init(defaults: UserDefaults = .standard, location: any LocationProviding = DeviceLocationProvider.shared) {
        self.defaults = defaults
        self.location = location
    }

    /// Reads the count for `account` while Moments are on for it; anything else clears the dot.
    /// `force` reads even when the last read was moments ago.
    func refresh(account newAccount: String?, isOn: Bool, force: Bool = false) async {
        guard let newAccount, isOn else {
            reset()
            return
        }
        if newAccount != account {
            reset()
            account = newAccount
        }
        if !force, let lastRead, Date().timeIntervalSince(lastRead) < Self.rereadAfter { return }
        if let reading {
            await reading.value
            return
        }
        let task = Task { await read(account: newAccount) }
        reading = task
        await task.value
        reading = nil
    }

    /// Reads again now for the account last read for (a "moment_new" push came, the viewer closed).
    func reread() async {
        guard let account else { return }
        await refresh(account: account, isOn: true, force: true)
    }

    /// The Moments tab came on screen: the dot goes at once, and what's there now is no longer new.
    func tabOpened(account opened: String?) {
        if account == nil { account = opened }
        tabOpen = true
        hasNew = false
        markSeen()
    }

    /// The tab left the screen: new counts from here.
    func tabLeft() {
        guard tabOpen else { return }
        tabOpen = false
        markSeen()
    }

    /// Signed out, or Moments went off.
    func reset() {
        reading?.cancel()
        reading = nil
        account = nil
        lastRead = nil
        if hasNew { hasNew = false }
    }

    private func read(account read: String) async {
        let since = defaults.object(forKey: Self.key(read)) as? Date
        let count: Int?
        if let box = await box() {
            let endpoint = MomentsEndpoints.unseen(south: box.south, west: box.west, north: box.north, east: box.east, since: since)
            count = await (try? MomentsAPI.send(endpoint, as: MomentsUnseenResponse.self))?.count
        } else {
            // Nowhere to count around (no location, no home): no dot. The app still says it has Moments.
            _ = try? await MomentsAPI.send(MomentsEndpoints.mine, as: MomentsMineResponse.self)
            count = nil
        }
        // An account switch or a sign-out while it was read: not this account's answer.
        guard account == read, !Task.isCancelled else { return }
        lastRead = Date()
        hasNew = !tabOpen && (count ?? 0) > 0
    }

    /// About two miles around where the map would open, as the map's own first read.
    private func box() async -> MomentsViewport? {
        var center: UserCoordinate?
        if location.canLocateWithoutAsking {
            center = location.cachedCoordinate()
            if center == nil { center = await location.requestCurrent(timeoutSeconds: passiveLocationTimeoutSeconds) }
        }
        if center == nil { center = await MomentsMapViewModel.homeCoordinate(store: ScreenStore.store(for: .shared)) }
        return center.map { MomentsViewport(around: $0) }
    }

    private func markSeen() {
        guard let account else { return }
        defaults.set(Date(), forKey: Self.key(account))
    }

    private static func key(_ account: String) -> String {
        "pantopus.moments.tabSeen.\(account)"
    }
}
