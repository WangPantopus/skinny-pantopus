//
//  WidgetSnapshotStore.swift
//  Pantopus
//
//  Phase 6c — app-side writer for the "Tasks near me" widget snapshot,
//  and since October 2026 the "Today at your address" one.
//  `GigsFeedViewModel` calls `write(_:)` after every successful feed
//  fetch; the store persists the JSON into the shared App Group suite
//  and pokes WidgetKit to rebuild the timeline. Protocol-injected so
//  view-model tests can record writes without touching WidgetKit.
//

import Foundation
import WidgetKit

/// Injection seam for the widget snapshot writer.
@MainActor
public protocol WidgetSnapshotStoring: AnyObject {
    func write(_ snapshot: GigWidgetSnapshot)
}

/// Real App-Group-backed store. No-ops under XCTest / SwiftUI previews
/// (same suppression pattern as `GigLiveActivityController`) so default
/// constructed view models stay deterministic in tests.
@MainActor
public final class WidgetSnapshotStore: WidgetSnapshotStoring {
    public static let shared = WidgetSnapshotStore()

    private let isSuppressed: Bool

    init(environment: [String: String] = ProcessInfo.processInfo.environment) {
        isSuppressed = environment["XCTestConfigurationFilePath"] != nil
            || environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1"
    }

    public func write(_ snapshot: GigWidgetSnapshot) {
        guard !isSuppressed,
              let defaults = UserDefaults(suiteName: GigWidgetSnapshotContract.appGroupId),
              let data = GigWidgetSnapshotContract.encode(snapshot)
        else { return }
        defaults.set(data, forKey: GigWidgetSnapshotContract.snapshotKey)
        WidgetCenter.shared.reloadTimelines(ofKind: GigWidgetSnapshotContract.widgetKind)
    }

    /// The "Today at your address" widget's snapshot, written after the Today tab loads.
    public func writeToday(_ snapshot: TodayWidgetSnapshot) {
        guard !isSuppressed,
              let defaults = UserDefaults(suiteName: GigWidgetSnapshotContract.appGroupId),
              let data = TodayWidgetSnapshotContract.encode(snapshot)
        else { return }
        defaults.set(data, forKey: TodayWidgetSnapshotContract.snapshotKey)
        WidgetCenter.shared.reloadTimelines(ofKind: TodayWidgetSnapshotContract.widgetKind)
    }

    /// Sign-out: the home-screen widgets must not keep showing the last
    /// account's place, dates and nearby tasks. Without a snapshot they ask
    /// to open the app.
    public func clear() {
        guard !isSuppressed,
              let defaults = UserDefaults(suiteName: GigWidgetSnapshotContract.appGroupId)
        else { return }
        defaults.removeObject(forKey: GigWidgetSnapshotContract.snapshotKey)
        defaults.removeObject(forKey: TodayWidgetSnapshotContract.snapshotKey)
        WidgetCenter.shared.reloadTimelines(ofKind: GigWidgetSnapshotContract.widgetKind)
        WidgetCenter.shared.reloadTimelines(ofKind: TodayWidgetSnapshotContract.widgetKind)
    }
}
