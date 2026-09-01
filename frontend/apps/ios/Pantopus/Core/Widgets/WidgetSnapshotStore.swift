//
//  WidgetSnapshotStore.swift
//  Pantopus
//
//  Phase 6c — app-side writer for the "Tasks near me" widget snapshot.
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
}
