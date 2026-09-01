//
//  NavigationDrawerViewModel.swift
//  Pantopus
//
//  §1C-b — Context-aware navigation drawer (LAUNCHER variant / Option A).
//  Design: docs/design/new/Navigation Drawer - Launcher.html
//          (+ nav-drawer-launcher-frames.jsx)
//
//  The drawer is a thin launcher: its context pill opens the existing
//  Identity Center to switch context; the body is a flat list of rows that
//  dispatch to existing routes. Three context variants — Personal / Home /
//  Business — are rendered from `NavigationDrawerContext`. The body content
//  is deterministic from the active context, so there are no network-bound
//  loading / empty / error states here (the design shows none).
//

import SwiftUI

// MARK: - Context

/// The active hub context the navigation drawer renders for.
///
/// Personal is the only context reachable today (the Hub menu button lives on
/// the personal hub); the Home / Business variants are rendered when a home or
/// business dashboard adopts the drawer, and are covered by previews + tests.
enum NavigationDrawerContext: Equatable {
    case personal(name: String)
    case home(id: String, title: String, subtitle: String)
    case business(id: String, title: String, subtitle: String)
}

/// Identity pillar tint applied to the context header.
enum NavigationDrawerPillar: Equatable {
    case personal
    case home
    case business

    /// Solid pillar colour (Personal sky / Home green / Business violet).
    var tint: Color {
        switch self {
        case .personal: Theme.Color.primary600
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        }
    }

    /// Faint tinted background behind the context pill.
    var tintBackground: Color {
        switch self {
        case .personal: Theme.Color.personalBg
        case .home: Theme.Color.homeBg
        case .business: Theme.Color.businessBg
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .personal: .user
        case .home: .home
        case .business: .building2
        }
    }
}

// MARK: - Destinations

/// A semantic destination dispatched when a drawer row is tapped. The host
/// (`HubTabRoot`) maps each onto its existing route — no new screens are
/// introduced. Destinations with no shipped native route fall back to the
/// `NotYetAvailable` placeholder host-side.
enum NavigationDrawerDestination: Equatable {
    // Personal
    case myHomes
    case myBusinesses
    case connections
    case mailbox
    case profileAndPrivacy
    case beaconUpdates
    case search
    case discoverNeighbors
    case myBeacon
    case myListings
    case myPulse
    case myTasks
    case myBids
    case offersAndBids
    case postTask
    case walletAndPayments
    case settings
    case helpSupport

    // Home (the active home id is read from `NavigationDrawerContext`)
    case homeProperty
    case homeOverview
    case homeTasks
    case homeIssues
    case homeBills
    case homeMembers
    case homeMailbox
    case homePackages
    case homeDocuments
    case homeVendors
    case homeEmergency
    case homeSettings

    // Business (the active business id is read from `NavigationDrawerContext`)
    case businessOverview
    case businessProfileRow
    case businessLocations
    case businessCatalog
    case businessPages
    case businessPostTask
    case businessChat
    case businessTeam
    case businessReviews
    case businessPayments
    case businessSettings
}

// MARK: - Item / Section models

/// A single full-width menu row. `slug` is the kebab-cased label and drives the
/// `navDrawer.item.<slug>` accessibility identifier (the cross-platform tag
/// contract).
struct NavigationDrawerItem: Identifiable, Equatable {
    let slug: String
    let icon: PantopusIcon
    let label: String
    let isActive: Bool
    let destination: NavigationDrawerDestination

    var id: String {
        slug
    }
}

/// A labelled group of rows. `overline == nil` renders the leading, header-less
/// group used by the Home / Business contexts.
struct NavigationDrawerSection: Identifiable, Equatable {
    let id: String
    let overline: String?
    let items: [NavigationDrawerItem]
}

// MARK: - View model

@Observable
@MainActor
final class NavigationDrawerViewModel {
    private(set) var context: NavigationDrawerContext

    init(context: NavigationDrawerContext) {
        self.context = context
    }

    func updateContext(_ context: NavigationDrawerContext) {
        self.context = context
    }

    var pillar: NavigationDrawerPillar {
        switch context {
        case .personal: .personal
        case .home: .home
        case .business: .business
        }
    }

    var headerTitle: String {
        switch context {
        case .personal: "Personal"
        case let .home(_, title, _): title
        case let .business(_, title, _): title
        }
    }

    var headerSubtitle: String {
        switch context {
        case let .personal(name):
            name.isEmpty ? "Your profile" : "\(name) · Your profile"
        case let .home(_, _, subtitle): subtitle
        case let .business(_, _, subtitle): subtitle
        }
    }

    /// `BackToHub` only renders for the Home / Business contexts.
    var showsBackToHub: Bool {
        switch context {
        case .personal: false
        case .home, .business: true
        }
    }

    var sections: [NavigationDrawerSection] {
        switch context {
        case .personal: Self.personalSections
        case .home: Self.homeSections
        case .business: Self.businessSections
        }
    }

    /// Kebab-cases a label into the `navDrawer.item.<slug>` suffix. Mirrors the
    /// Android `navDrawerSlug` helper verbatim so the tag contract matches.
    static func slug(_ label: String) -> String {
        label
            .replacingOccurrences(of: "&", with: "and")
            .lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "-")
    }

    private static func item(
        _ icon: PantopusIcon,
        _ label: String,
        _ destination: NavigationDrawerDestination,
        active: Bool = false
    ) -> NavigationDrawerItem {
        NavigationDrawerItem(
            slug: slug(label),
            icon: icon,
            label: label,
            isActive: active,
            destination: destination
        )
    }

    // MARK: Personal

    private static var personalSections: [NavigationDrawerSection] {
        [
            NavigationDrawerSection(id: "manage", overline: "Manage", items: [
                item(.home, "My Homes", .myHomes),
                item(.building2, "My Businesses", .myBusinesses),
                item(.users, "Connections", .connections),
                item(.mail, "Mailbox", .mailbox),
                item(.shield, "Profile & Privacy", .profileAndPrivacy)
            ]),
            NavigationDrawerSection(id: "discover", overline: "Discover", items: [
                item(.rss, "Beacon Updates", .beaconUpdates),
                item(.search, "Search", .search),
                item(.compass, "Discover Neighbors", .discoverNeighbors)
            ]),
            NavigationDrawerSection(id: "your-stuff", overline: "Your Stuff", items: [
                item(.radio, "My Beacon", .myBeacon),
                item(.tag, "My Listings", .myListings),
                item(.fileText, "My Pulse", .myPulse),
                item(.listChecks, "My Tasks", .myTasks),
                item(.hand, "My Bids", .myBids),
                item(.gavel, "Offers & Bids", .offersAndBids),
                item(.plusCircle, "Post Task", .postTask),
                item(.creditCard, "Wallet & Payments", .walletAndPayments)
            ]),
            NavigationDrawerSection(id: "settings", overline: "Settings", items: [
                item(.slidersHorizontal, "Settings", .settings),
                item(.helpCircle, "Help & Support", .helpSupport)
            ])
        ]
    }

    // MARK: Home

    private static var homeSections: [NavigationDrawerSection] {
        [
            NavigationDrawerSection(id: "home", overline: nil, items: [
                item(.info, "Property Details", .homeProperty),
                item(.barChart3, "Overview", .homeOverview, active: true),
                item(.checkCircle, "Tasks", .homeTasks),
                item(.wrench, "Issues", .homeIssues),
                item(.creditCard, "Bills", .homeBills),
                item(.users, "Members", .homeMembers),
                item(.mail, "Mailbox", .homeMailbox)
            ]),
            NavigationDrawerSection(id: "more", overline: "More", items: [
                item(.package, "Packages", .homePackages),
                item(.fileText, "Documents", .homeDocuments),
                item(.hammer, "Vendors", .homeVendors),
                item(.alertTriangle, "Emergency", .homeEmergency)
            ]),
            NavigationDrawerSection(id: "settings", overline: "Settings", items: [
                item(.slidersHorizontal, "Home Settings", .homeSettings)
            ])
        ]
    }

    // MARK: Business

    private static var businessSections: [NavigationDrawerSection] {
        [
            NavigationDrawerSection(id: "business", overline: nil, items: [
                item(.barChart3, "Overview", .businessOverview, active: true),
                item(.userRound, "Profile", .businessProfileRow),
                item(.mapPin, "Locations & Hours", .businessLocations),
                item(.tag, "Catalog", .businessCatalog),
                item(.file, "Pages", .businessPages),
                item(.plusCircle, "Post Task", .businessPostTask),
                item(.messageSquare, "Business Chat", .businessChat)
            ]),
            NavigationDrawerSection(id: "manage", overline: "Manage", items: [
                item(.users, "Team", .businessTeam),
                item(.star, "Reviews", .businessReviews),
                item(.creditCard, "Payments", .businessPayments)
            ]),
            NavigationDrawerSection(id: "settings", overline: "Settings", items: [
                item(.slidersHorizontal, "Settings", .businessSettings)
            ])
        ]
    }
}
