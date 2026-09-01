//
//  PulsePostingTarget.swift
//  Pantopus
//
//  Where a Pulse post is authored — mirrors React Native
//  `PostingTarget` in `PostTargetPicker.tsx`.
//

import Foundation

/// Destination chosen in step 1 of the Pulse compose flow.
public enum PulsePostingTarget: Sendable, Hashable {
    case currentLocation(latitude: Double, longitude: Double, label: String)
    case home(homeId: String, latitude: Double, longitude: Double, label: String)
    case business(businessId: String, latitude: Double, longitude: Double, label: String)
    case connections

    public var isPlaceTarget: Bool {
        switch self {
        case .connections: false
        default: true
        }
    }

    public var isNetworkTarget: Bool {
        if case .connections = self { return true }
        return false
    }

    /// Backend `postAs` value derived from the target.
    public var postAs: String {
        switch self {
        case .currentLocation, .connections: "personal"
        case .home: "home"
        case .business: "business"
        }
    }

    /// Home and business targets lock the map pin.
    public var locationIsFixed: Bool {
        switch self {
        case .home, .business: true
        default: false
        }
    }

    public var displayLabel: String {
        switch self {
        case let .currentLocation(_, _, label),
             let .home(_, _, _, label),
             let .business(_, _, _, label):
            label
        case .connections:
            "Connections"
        }
    }

    public var latitude: Double? {
        switch self {
        case let .currentLocation(lat, _, _),
             let .home(_, lat, _, _),
             let .business(_, lat, _, _):
            lat
        case .connections:
            nil
        }
    }

    public var longitude: Double? {
        switch self {
        case let .currentLocation(_, lon, _),
             let .home(_, _, lon, _),
             let .business(_, _, lon, _):
            lon
        case .connections:
            nil
        }
    }

    public var homeId: String? {
        if case let .home(id, _, _, _) = self { return id }
        return nil
    }

    public var businessId: String? {
        if case let .business(id, _, _, _) = self { return id }
        return nil
    }
}
