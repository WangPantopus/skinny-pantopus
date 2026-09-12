import CoreLocation
import Foundation

/// One shared Core Location request can serve multiple independently cancellable
/// callers. A request's acquisition deadline starts after permission is answered.
@MainActor
public final class DeviceLocationProvider: NSObject, LocationProviding, CLLocationManagerDelegate, @unchecked Sendable {
    public static let shared = DeviceLocationProvider(manager: CLLocationManager())

    private let manager: CLLocationManager
    private var cached: CLLocation?
    private var accessRefused = false
    private var authorizations: [UUID: CheckedContinuation<Bool, Never>] = [:]
    private var locations: [UUID: CheckedContinuation<UserCoordinate?, Never>] = [:]
    private var deadlines: [UUID: Task<Void, Never>] = [:]

    init(manager: CLLocationManager) {
        self.manager = manager
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    public func cachedCoordinate() -> UserCoordinate? {
        guard isAuthorized, !accessRefused else { cached = nil
            return nil
        }
        if let location = manager.location { remember(location) }
        guard let cached, isUsable(cached) else { cached = nil
            return nil
        }
        return UserCoordinate(cached)
    }

    public func requestCurrent(timeoutSeconds: TimeInterval = 4) async -> UserCoordinate? {
        guard timeoutSeconds.isFinite, timeoutSeconds > 0, !Task.isCancelled else { return nil }
        guard await ensureAuthorization(), !Task.isCancelled else { return nil }
        let fresh = await requestFreshCoordinate(timeoutSeconds: min(timeoutSeconds, 60))
        guard isAuthorized else { cached = nil
            return nil
        }
        guard !Task.isCancelled else { return nil }
        return fresh ?? cachedCoordinate()
    }

    private var isAuthorized: Bool {
        manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse
    }

    private func ensureAuthorization() async -> Bool {
        guard manager.authorizationStatus == .notDetermined else {
            if !isAuthorized { cached = nil }
            return isAuthorized
        }
        let id = UUID()
        return await withTaskCancellationHandler {
            await withCheckedContinuation { continuation in
                guard !Task.isCancelled else { continuation.resume(returning: false)
                    return
                }
                authorizations[id] = continuation
                if authorizations.count == 1 { manager.requestWhenInUseAuthorization() }
            }
        } onCancel: {
            Task { @MainActor [weak self] in self?.completeAuthorization(id, allowed: false) }
        }
    }

    private func requestFreshCoordinate(timeoutSeconds: TimeInterval) async -> UserCoordinate? {
        let id = UUID()
        return await withTaskCancellationHandler {
            await withCheckedContinuation { continuation in
                guard isAuthorized, !Task.isCancelled else { continuation.resume(returning: nil)
                    return
                }
                locations[id] = continuation
                deadlines[id] = Task { [weak self] in
                    do { try await Task.sleep(for: .seconds(timeoutSeconds)) } catch { return }
                    self?.completeLocation(id, coordinate: nil)
                }
                if locations.count == 1 { manager.requestLocation() }
            }
        } onCancel: {
            Task { @MainActor [weak self] in self?.completeLocation(id, coordinate: nil) }
        }
    }

    private func completeAuthorization(_ id: UUID, allowed: Bool) {
        authorizations.removeValue(forKey: id)?.resume(returning: allowed)
    }

    private func completeLocation(_ id: UUID, coordinate: UserCoordinate?) {
        guard let continuation = locations.removeValue(forKey: id) else { return }
        deadlines.removeValue(forKey: id)?.cancel()
        if locations.isEmpty { manager.stopUpdatingLocation() }
        continuation.resume(returning: isAuthorized ? coordinate : nil)
    }

    public nonisolated func locationManagerDidChangeAuthorization(_: CLLocationManager) {
        Task { @MainActor in
            // CLLocationManager also reports its initial, unanswered status.
            guard manager.authorizationStatus != .notDetermined else { return }
            let allowed = isAuthorized
            for id in Array(authorizations.keys) {
                completeAuthorization(id, allowed: allowed)
            }
            if !allowed {
                cached = nil
                for id in Array(locations.keys) {
                    completeLocation(id, coordinate: nil)
                }
            }
        }
    }

    public nonisolated func locationManager(_: CLLocationManager, didUpdateLocations values: [CLLocation]) {
        Task { @MainActor in
            guard !locations.isEmpty else { return }
            if isAuthorized, let location = values.last(where: isUsable) {
                accessRefused = false
                remember(location)
            }
            let coordinate = isAuthorized ? cachedCoordinate() : nil
            for id in Array(locations.keys) {
                completeLocation(id, coordinate: coordinate)
            }
        }
    }

    public nonisolated func locationManager(_: CLLocationManager, didFailWithError error: any Error) {
        Task { @MainActor in
            if (error as? CLError)?.code == .denied {
                accessRefused = true
                cached = nil
            }
            for id in Array(locations.keys) {
                completeLocation(id, coordinate: nil)
            }
        }
    }

    private func isUsable(_ location: CLLocation) -> Bool {
        CLLocationCoordinate2DIsValid(location.coordinate)
            && location.horizontalAccuracy.isFinite && location.horizontalAccuracy >= 0
            && (-120...5).contains(location.timestamp.timeIntervalSinceNow)
    }

    private func remember(_ location: CLLocation) {
        guard isAuthorized, isUsable(location) else { return }
        if let cached, cached.timestamp > location.timestamp { return }
        cached = location
    }
}

private extension UserCoordinate {
    init(_ location: CLLocation) {
        self.init(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            accuracyMeters: location.horizontalAccuracy
        )
    }
}
