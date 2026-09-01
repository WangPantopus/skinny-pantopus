//
//  DeviceLocationProvider.swift
//  Pantopus
//
//  Production location provider backed by Core Location. Requests
//  when-in-use authorization on first use and surfaces the device's
//  best-known coordinate to map surfaces.
//

import CoreLocation
import Foundation

@MainActor
public final class DeviceLocationProvider: NSObject, LocationProviding, CLLocationManagerDelegate, @unchecked Sendable {
    public static let shared = DeviceLocationProvider()

    private let manager = CLLocationManager()
    private var cached: UserCoordinate?
    private var pendingLocation: CheckedContinuation<UserCoordinate?, Never>?
    private var pendingAuthorization: CheckedContinuation<Void, Never>?

    override private init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        syncFromLastKnown()
    }

    public func cachedCoordinate() -> UserCoordinate? {
        syncFromLastKnown()
        return cached
    }

    public func requestCurrent(timeoutSeconds: TimeInterval = 4) async -> UserCoordinate? {
        syncFromLastKnown()
        await ensureAuthorization()

        guard isAuthorized else {
            return cached
        }

        if let fresh = await withTimeout(seconds: timeoutSeconds, operation: { await self.requestFreshCoordinate() }) {
            cached = fresh
            return fresh
        }

        syncFromLastKnown()
        return cached
    }

    // MARK: - Authorization

    private var isAuthorized: Bool {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            true
        default:
            false
        }
    }

    private func ensureAuthorization() async {
        switch manager.authorizationStatus {
        case .notDetermined:
            await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                pendingAuthorization = continuation
                manager.requestWhenInUseAuthorization()
            }
        default:
            break
        }
    }

    // MARK: - CLLocationManagerDelegate

    public nonisolated func locationManagerDidChangeAuthorization(_: CLLocationManager) {
        Task { @MainActor in
            syncFromLastKnown()
            pendingAuthorization?.resume()
            pendingAuthorization = nil
        }
    }

    public nonisolated func locationManager(_: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            guard let location = locations.last else { return }
            let coordinate = UserCoordinate(location)
            cached = coordinate
            pendingLocation?.resume(returning: coordinate)
            pendingLocation = nil
        }
    }

    public nonisolated func locationManager(_: CLLocationManager, didFailWithError _: Error) {
        Task { @MainActor in
            pendingLocation?.resume(returning: cached)
            pendingLocation = nil
        }
    }

    // MARK: - Helpers

    private func syncFromLastKnown() {
        guard isAuthorized, let location = manager.location else { return }
        cached = UserCoordinate(location)
    }

    private func requestFreshCoordinate() async -> UserCoordinate? {
        await withCheckedContinuation { continuation in
            pendingLocation = continuation
            manager.requestLocation()
        }
    }

    private func withTimeout(
        seconds: TimeInterval,
        operation: @escaping @Sendable () async -> UserCoordinate?
    ) async -> UserCoordinate? {
        await withTaskGroup(of: UserCoordinate?.self) { group in
            group.addTask { await operation() }
            group.addTask {
                try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                return nil
            }
            if let first = await group.next() {
                group.cancelAll()
                return first
            }
            return nil
        }
    }
}

private extension UserCoordinate {
    init(_ location: CLLocation) {
        self.init(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            accuracyMeters: max(location.horizontalAccuracy, 0)
        )
    }
}
