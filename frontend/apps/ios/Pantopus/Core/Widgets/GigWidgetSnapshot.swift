//
//  GigWidgetSnapshot.swift
//  Pantopus
//
//  Phase 6c — shared contract between the app and the "Tasks near me"
//  WidgetKit widget. Widgets can't make authed API calls, so the app
//  writes a compact JSON snapshot of the latest gigs-feed fetch into the
//  shared App Group `UserDefaults`; the widget timeline reads it back.
//  Compiled into BOTH targets (see `project.yml` — the extension cannot
//  import the app module), so keep this file Foundation-only.
//

import Foundation

/// One nearby open task in the widget snapshot. Price / distance ride as
/// the app's already-formatted display strings ("$60", "0.2mi") so the
/// widget never re-implements feed formatting.
public struct GigWidgetTask: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let title: String
    public let price: String
    public let distance: String?
    /// Raw feed category key ("handyman", "cleaning", …) — mapped to the
    /// extension-local accent palette on the widget side.
    public let categoryKey: String

    public init(id: String, title: String, price: String, distance: String?, categoryKey: String) {
        self.id = id
        self.title = title
        self.price = price
        self.distance = distance
        self.categoryKey = categoryKey
    }
}

/// The snapshot the app writes after every successful gigs-feed fetch.
public struct GigWidgetSnapshot: Codable, Sendable, Equatable {
    /// When the feed fetch landed — drives the 6-hour staleness gate.
    public let generatedAt: Date
    /// Total open tasks nearby ("N tasks nearby" header). May exceed
    /// `tasks.count` — the list is capped at `maxTasks`.
    public let totalNearby: Int
    public let tasks: [GigWidgetTask]

    public init(generatedAt: Date, totalNearby: Int, tasks: [GigWidgetTask]) {
        self.generatedAt = generatedAt
        self.totalNearby = totalNearby
        self.tasks = Array(tasks.prefix(GigWidgetSnapshotContract.maxTasks))
    }
}

/// Storage constants + (de)coding helpers shared by writer and reader.
public enum GigWidgetSnapshotContract {
    /// App Group shared by the app and the widget extension — declared in
    /// both targets' entitlements (`project.yml`).
    public static let appGroupId = "group.app.pantopus.ios"
    /// `UserDefaults` key holding the JSON-encoded snapshot.
    public static let snapshotKey = "gigsNearbySnapshotV1"
    /// `WidgetKind` of the Tasks-near-me timeline widget.
    public static let widgetKind = "TasksNearMeWidget"
    /// Snapshots older than this render the "Open Pantopus" placeholder.
    public static let stalenessSeconds: TimeInterval = 6 * 60 * 60
    /// Cap on persisted rows (the widget renders at most 3).
    public static let maxTasks = 10

    public static func encode(_ snapshot: GigWidgetSnapshot) -> Data? {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return try? encoder.encode(snapshot)
    }

    public static func decode(_ data: Data) -> GigWidgetSnapshot? {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(GigWidgetSnapshot.self, from: data)
    }

    /// Load the latest snapshot from the shared App Group suite.
    public static func load(defaults: UserDefaults? = UserDefaults(suiteName: appGroupId)) -> GigWidgetSnapshot? {
        guard let data = defaults?.data(forKey: snapshotKey) else { return nil }
        return decode(data)
    }

    /// False once the snapshot has aged past the staleness window.
    public static func isFresh(_ snapshot: GigWidgetSnapshot, now: Date = Date()) -> Bool {
        now.timeIntervalSince(snapshot.generatedAt) < stalenessSeconds
    }
}
