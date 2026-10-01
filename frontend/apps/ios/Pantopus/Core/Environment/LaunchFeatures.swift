//
//  LaunchFeatures.swift
//  Pantopus
//
//  First-launch scope (founder direction, 2026-09-27). Eight features are
//  hidden for the first launch; their code stays so any of them can come
//  back. A feature is OFF unless its key is listed in the Info.plist value
//  `PantopusLaunchFeatures` (build setting `PANTOPUS_LAUNCH_FEATURES`,
//  comma-separated, or "all"). Debug builds also read the
//  `PANTOPUS_LAUNCH_FEATURES` environment variable (scheme env, or
//  `SIMCTL_CHILD_PANTOPUS_LAUNCH_FEATURES` for `simctl launch`).
//
//  The same keys drive the web app (NEXT_PUBLIC_LAUNCH_FEATURES), the
//  backend (LAUNCH_FEATURES) and Android (PANTOPUS_LAUNCH_FEATURES).
//

import Foundation

/// A feature cut from the first launch. The raw value is the shared key.
public enum LaunchFeature: String, CaseIterable, Sendable {
    /// 1. Beacon and creator tools: publisher pages, following publishers,
    /// updates and media, audience management, creator inbox, membership
    /// tiers and restricted content.
    case beacon
    /// 2. Personas and identity switching: public personas, Beacon identity
    /// and switching between profiles.
    case personas
    /// 3. Marketplace: listings, search, offers, trades and buyer–seller chat.
    case marketplace
    /// 4. Open Gigs marketplace: posting any task for bids, competitive
    /// bidding, unrestricted categories and broad provider search.
    case openGigs = "open_gigs"
    /// 5. Public scheduling for general businesses: booking pages,
    /// appointment types, shared resources and team scheduling.
    case publicScheduling = "public_scheduling"
    /// 6. General business directory: browsing and searching all businesses.
    case businessDirectory = "business_directory"
    /// 7. Household extras: polls, package tracking, the separate pet
    /// section, the general family calendar and full bill management.
    case householdExtras = "household_extras"
    /// 8. Mail extras: personal and ceremonial letters, e-signing, the
    /// community mail stream and event invitations by mail.
    case mailExtras = "mail_extras"
}

/// Read-only switches for the features cut from the first launch.
public enum LaunchFeatures {
    /// Features switched back on for this build, resolved once per launch.
    private static let enabledFeatures: Set<LaunchFeature> = resolve()

    #if DEBUG
    /// Unit tests only: replaces the resolved set while non-nil.
    public nonisolated(unsafe) static var overrideForTesting: Set<LaunchFeature>?
    #endif

    public static func isEnabled(_ feature: LaunchFeature) -> Bool {
        #if DEBUG
        if let overrideForTesting { return overrideForTesting.contains(feature) }
        #endif
        return enabledFeatures.contains(feature)
    }

    public static var beacon: Bool {
        isEnabled(.beacon)
    }

    public static var personas: Bool {
        isEnabled(.personas)
    }

    public static var marketplace: Bool {
        isEnabled(.marketplace)
    }

    public static var openGigs: Bool {
        isEnabled(.openGigs)
    }

    public static var publicScheduling: Bool {
        isEnabled(.publicScheduling)
    }

    public static var businessDirectory: Bool {
        isEnabled(.businessDirectory)
    }

    public static var householdExtras: Bool {
        isEnabled(.householdExtras)
    }

    public static var mailExtras: Bool {
        isEnabled(.mailExtras)
    }

    /// Parses a comma-separated key list ("all" enables every feature).
    static func parse(_ raw: String?) -> Set<LaunchFeature> {
        let listed = (raw ?? "")
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
            .filter { !$0.isEmpty }
        if listed.contains("all") { return Set(LaunchFeature.allCases) }
        return Set(listed.compactMap(LaunchFeature.init(rawValue:)))
    }

    private static func resolve() -> Set<LaunchFeature> {
        #if DEBUG
        if let raw = ProcessInfo.processInfo.environment["PANTOPUS_LAUNCH_FEATURES"] {
            return parse(raw)
        }
        #endif
        return parse(Bundle.main.object(forInfoDictionaryKey: "PantopusLaunchFeatures") as? String)
    }
}
