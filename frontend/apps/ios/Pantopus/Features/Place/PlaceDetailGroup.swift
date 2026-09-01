//
//  PlaceDetailGroup.swift
//  Pantopus
//
//  The seven Place detail destinations (W2.3). Maps the contract's
//  curated `PlaceGroup`s onto the detail pages a dashboard card taps
//  through to — `health_environment` folds into Risk (it has no detail
//  page of its own), mirroring the web `sections.ts` GROUP_TO_SLUG.
//

import Foundation

/// A tappable Place detail page. The `slug` matches the web route
/// (`/app/place/<slug>`) for parity.
public enum PlaceDetailGroup: String, Hashable, CaseIterable, Sendable {
    case today
    case yourHome = "your-home"
    case risk
    case block
    case money
    case civic
    case identity

    /// Page title in the detail header.
    public var title: String {
        switch self {
        case .today: "Today"
        case .yourHome: "Your home"
        case .risk: "Risk & readiness"
        case .block: "Your block"
        case .money: "Money signals"
        case .civic: "Civic"
        case .identity: "Identity"
        }
    }

    /// The contract groups whose sections this detail page renders.
    public var groups: [PlaceGroup] {
        switch self {
        case .today: [.today]
        case .yourHome: [.yourHome]
        case .risk: [.riskReadiness, .healthEnvironment]
        case .block: [.yourBlock]
        case .money: [.moneySignals]
        case .civic: [.civic]
        case .identity: [.identity]
        }
    }

    /// The detail page a dashboard card in `group` taps through to.
    public static func forGroup(_ group: PlaceGroup) -> PlaceDetailGroup? {
        switch group {
        case .today: .today
        case .yourHome: .yourHome
        case .riskReadiness, .healthEnvironment: .risk
        case .yourBlock: .block
        case .moneySignals: .money
        case .civic: .civic
        case .identity: .identity
        case .unknown: nil
        }
    }
}
