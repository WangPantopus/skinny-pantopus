//
//  LocationProvider.swift
//  Pantopus
//
//  Best-known coordinate hint surfaced to map / radius surfaces. T2.4
//  ships with a hardcoded-fallback implementation; the real
//  CLLocationManager-backed provider lands in a later pass alongside
//  the permission-prompt flow.
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
    func cachedCoordinate() -> UserCoordinate?
    func requestCurrent(timeoutSeconds: TimeInterval) async -> UserCoordinate?
}

/// Hardcoded-fallback provider. Returns a downtown Manhattan anchor so
/// the map renders during development — replace with a
/// CLLocationManager-backed implementation once the permission flow
/// lands.
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
