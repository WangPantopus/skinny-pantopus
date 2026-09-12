//
//  LocationProvider.swift
//  Pantopus
//
//  Coordinate hints for map and address surfaces. Production callers use
//  DeviceLocationProvider; fixed providers are for previews and tests.
//

import Foundation

/// Best-known coordinate. Includes `accuracyMeters` so callers can
/// decide whether to render a "you are here" disc or just a
/// neighborhood-level halo.
public struct UserCoordinate: Sendable, Hashable {
    public let latitude: Double
    public let longitude: Double
    public let accuracyMeters: Double

    public init(latitude: Double, longitude: Double, accuracyMeters: Double) {
        self.latitude = latitude
        self.longitude = longitude
        self.accuracyMeters = accuracyMeters
    }
}

/// Provider interface — abstracted so view-models can inject a fixed
/// coordinate in tests.
public protocol LocationProviding: AnyObject, Sendable {
    /// A recent coordinate only while device permission remains granted.
    @MainActor func cachedCoordinate() -> UserCoordinate?
    /// Acquisition is bounded after authorization; caller cancellation also
    /// releases an unanswered permission wait. Denial returns no coordinate.
    func requestCurrent(timeoutSeconds: TimeInterval) async -> UserCoordinate?
}

/// Fixed Manhattan anchor retained for existing previews and test fixtures.
/// Production permission flows use DeviceLocationProvider.
public final class FallbackLocationProvider: LocationProviding, @unchecked Sendable {
    public static let shared = FallbackLocationProvider()

    private let fallback = UserCoordinate(latitude: 40.7484, longitude: -73.9857, accuracyMeters: 100)

    public init() {}

    public func cachedCoordinate() -> UserCoordinate? {
        fallback
    }

    public func requestCurrent(timeoutSeconds _: TimeInterval = 4) async -> UserCoordinate? {
        fallback
    }
}

/// Fixed-coordinate stub useful in tests / previews.
public final class FixedLocationProvider: LocationProviding, @unchecked Sendable {
    private let coordinate: UserCoordinate

    public init(_ coordinate: UserCoordinate) {
        self.coordinate = coordinate
    }

    public func cachedCoordinate() -> UserCoordinate? {
        coordinate
    }

    public func requestCurrent(timeoutSeconds _: TimeInterval) async -> UserCoordinate? {
        coordinate
    }
}
