//
//  NetworkMonitor.swift
//  Pantopus
//
//  Wraps NWPathMonitor as an `@Observable` so SwiftUI views can react
//  to connectivity changes without dropping into Combine. The shared
//  monitor lives on `AppEnvironment.networkMonitor` (P15).
//

import Foundation
import Network
import Observation

/// Process-wide network reachability monitor. Boots `NWPathMonitor` on
/// init and publishes a single `isOnline` flag derived from the path
/// status. SwiftUI views observe via the standard Observation tracking.
@Observable
@MainActor
public final class NetworkMonitor {
    /// Shared instance used everywhere except tests.
    public static let shared = NetworkMonitor()

    /// True when the OS reports a usable network path. Defaults to
    /// `true` so first-launch UI doesn't flicker through an offline
    /// state before the monitor reports.
    public private(set) var isOnline: Bool = true
    /// Low Data Mode (a constrained path): nothing is loaded ahead of need.
    public private(set) var isLowData: Bool = false

    private let monitor: NWPathMonitor
    private let queue = DispatchQueue(label: "app.pantopus.NetworkMonitor")

    public init() {
        monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            let constrained = path.isConstrained
            Task { @MainActor [weak self] in
                self?.isOnline = online
                self?.isLowData = constrained
            }
        }
        monitor.start(queue: queue)
    }

    deinit { monitor.cancel() }
}
