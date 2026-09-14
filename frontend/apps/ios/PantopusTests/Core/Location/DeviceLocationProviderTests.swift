import CoreLocation
import XCTest
@testable import Pantopus

@MainActor
final class DeviceLocationProviderTests: XCTestCase {
    func testMissingLocationCallbackHasABoundedDeadline() async {
        let manager = ControlledLocationManager()
        let provider = DeviceLocationProvider(manager: manager)
        let finished = expectation(description: "Acquisition returns without a delegate callback")
        let request = Task {
            let coordinate = await provider.requestCurrent(timeoutSeconds: 0.02)
            XCTAssertNil(coordinate)
            finished.fulfill()
        }
        await fulfillment(of: [finished], timeout: 1)
        request.cancel()
        XCTAssertEqual(manager.requestCount, 1)
        XCTAssertEqual(manager.stopCount, 1)
    }

    func testCancellingOneCallerPreservesAnotherLocationWaiter() async throws {
        let manager = ControlledLocationManager()
        let provider = DeviceLocationProvider(manager: manager)
        let first = Task { await provider.requestCurrent(timeoutSeconds: 1) }
        let second = Task { await provider.requestCurrent(timeoutSeconds: 1) }
        try await Task.sleep(for: .milliseconds(10))
        first.cancel()
        let cancelled = await first.value
        XCTAssertNil(cancelled)
        XCTAssertEqual(manager.stopCount, 0)
        provider.locationManager(manager, didUpdateLocations: [Self.freshLocation()])
        let coordinate = await second.value
        XCTAssertEqual(coordinate?.latitude, 45.6)
        XCTAssertEqual(manager.requestCount, 1)
        XCTAssertEqual(manager.stopCount, 1)
    }

    func testUnansweredAuthorizationIsCancellableAndInitialCallbackDoesNotResolveIt() async throws {
        let manager = ControlledLocationManager()
        manager.status = .notDetermined
        let provider = DeviceLocationProvider(manager: manager)
        let request = Task { await provider.requestCurrent(timeoutSeconds: 1) }
        try await Task.sleep(for: .milliseconds(10))
        provider.locationManagerDidChangeAuthorization(manager)
        try await Task.sleep(for: .milliseconds(10))
        XCTAssertEqual(manager.requestCount, 0)
        XCTAssertEqual(manager.authorizationRequestCount, 1)
        request.cancel()
        let coordinate = await request.value
        XCTAssertNil(coordinate)
        manager.status = .authorizedWhenInUse
        provider.locationManagerDidChangeAuthorization(manager)
        let retry = Task { await provider.requestCurrent(timeoutSeconds: 1) }
        try await Task.sleep(for: .milliseconds(10))
        provider.locationManager(manager, didUpdateLocations: [Self.freshLocation()])
        let recovered = await retry.value
        XCTAssertEqual(recovered?.longitude, -122.4)
    }

    func testDeniedPermissionDropsTheLastCoordinate() async {
        let manager = ControlledLocationManager()
        manager.lastLocation = Self.freshLocation()
        let provider = DeviceLocationProvider(manager: manager)
        XCTAssertNotNil(provider.cachedCoordinate())
        manager.status = .denied
        XCTAssertNil(provider.cachedCoordinate())
        let result = await provider.requestCurrent(timeoutSeconds: 1)
        XCTAssertNil(result)
        XCTAssertEqual(manager.requestCount, 0)
    }

    func testOSDenialCannotFallBackToAnAuthorizedManagersCachedLocation() async throws {
        let manager = ControlledLocationManager()
        manager.lastLocation = Self.freshLocation()
        let provider = DeviceLocationProvider(manager: manager)
        XCTAssertNotNil(provider.cachedCoordinate())
        let request = Task { await provider.requestCurrent(timeoutSeconds: 1) }
        try await Task.sleep(for: .milliseconds(10))
        // Location services can refuse acquisition before authorization changes.
        provider.locationManager(manager, didFailWithError: CLError(.denied))
        let denied = await request.value
        XCTAssertNil(denied)
        XCTAssertNil(provider.cachedCoordinate())
        let retry = Task { await provider.requestCurrent(timeoutSeconds: 1) }
        try await Task.sleep(for: .milliseconds(10))
        provider.locationManager(manager, didUpdateLocations: [Self.freshLocation()])
        let recovered = await retry.value
        XCTAssertEqual(recovered?.latitude, 45.6)
    }

    func testStaleCoordinateCannotBeUsedAsCurrentAfterTimeout() async {
        let manager = ControlledLocationManager()
        manager.lastLocation = Self.freshLocation(timestamp: Date().addingTimeInterval(-121))
        let provider = DeviceLocationProvider(manager: manager)
        XCTAssertNil(provider.cachedCoordinate())
        let result = await provider.requestCurrent(timeoutSeconds: 0.02)
        XCTAssertNil(result)
    }

    private static func freshLocation(timestamp: Date = Date()) -> CLLocation {
        CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: 45.6, longitude: -122.4),
            altitude: 0,
            horizontalAccuracy: 40,
            verticalAccuracy: 40,
            timestamp: timestamp
        )
    }
}

/// Only the OS completion/authorization boundary is controlled. The provider's
/// cancellation handlers, deadlines and concurrent caller paths are production.
private final class ControlledLocationManager: CLLocationManager {
    var status: CLAuthorizationStatus = .authorizedWhenInUse
    var lastLocation: CLLocation?
    var requestCount = 0
    var stopCount = 0
    var authorizationRequestCount = 0

    override var authorizationStatus: CLAuthorizationStatus {
        status
    }

    override var location: CLLocation? {
        lastLocation
    }

    override func requestLocation() {
        requestCount += 1
    }

    override func stopUpdatingLocation() {
        stopCount += 1
    }

    override func requestWhenInUseAuthorization() {
        authorizationRequestCount += 1
    }
}
