//
//  UniversalSearchModels.swift
//  Pantopus
//
//  S2 — Universal search. The tab set, the unified row projection, and
//  the per-kind presentation (icon + accent + section label) shared by
//  the view-model and the view.
//
//  Mirrors RN `src/app/discover.tsx` (`SearchTab`, `UnifiedResult`,
//  `SEARCH_RESULT_TYPE_CONFIG`) and the Android
//  `ui/screens/universal_search/UniversalSearchModels.kt`.
//

import SwiftUI

/// The six universal-search tabs. `all` fans out concurrently across
/// every source; the rest hit exactly one.
public enum UniversalSearchTab: String, CaseIterable, Sendable, Hashable {
    case all
    case tasks
    case people
    case beacons
    case businesses
    case homes

    /// Chip label.
    public var title: String {
        switch self {
        case .all: "All"
        case .tasks: "Tasks"
        case .people: "People"
        case .beacons: "Beacons"
        case .businesses: "Businesses"
        case .homes: "Homes"
        }
    }

    /// The single source this tab reads, or `nil` for the fan-out tab.
    public var kind: UniversalSearchKind? {
        switch self {
        case .all: nil
        case .tasks: .task
        case .people: .person
        case .beacons: .beacon
        case .businesses: .business
        case .homes: .home
        }
    }
}

/// One searchable entity kind. Ordering matches the section order RN
/// renders in the "All" tab (`src/app/discover.tsx:298`).
public enum UniversalSearchKind: String, CaseIterable, Sendable, Hashable {
    case task
    case person
    case beacon
    case business
    case home

    /// Plural section header used in the "All" tab.
    public var sectionTitle: String {
        switch self {
        case .task: "Tasks"
        case .person: "People"
        case .beacon: "Beacons"
        case .business: "Businesses"
        case .home: "Homes"
        }
    }

    /// Row / section glyph.
    public var icon: PantopusIcon {
        switch self {
        case .task: .hammer
        case .person: .user
        case .beacon: .radio
        case .business: .building2
        case .home: .home
        }
    }

    /// Accent used for the glyph, the section header, and the row's
    /// trailing meta text.
    public var accent: Color {
        switch self {
        case .task: Theme.Color.warmAmber
        case .person: Theme.Color.personal
        case .beacon: Theme.Color.magic
        case .business: Theme.Color.business
        case .home: Theme.Color.home
        }
    }

    /// Soft fill behind the glyph when the row has no avatar.
    public var accentBackground: Color {
        switch self {
        case .task: Theme.Color.warmAmberBg
        case .person: Theme.Color.personalBg
        case .beacon: Theme.Color.magicBg
        case .business: Theme.Color.businessBg
        case .home: Theme.Color.homeBg
        }
    }

    /// Copy for the "this source failed" notice in the "All" tab.
    public var failureNotice: String {
        switch self {
        case .task: "Tasks couldn't be searched."
        case .person: "People couldn't be searched."
        case .beacon: "Beacons couldn't be searched."
        case .business: "Businesses couldn't be searched."
        case .home: "Homes couldn't be searched."
        }
    }
}

/// Where a tapped result navigates. Kept as a `Hashable` payload so the
/// route enum stays closure-free.
public enum UniversalSearchDestination: Sendable, Hashable {
    case task(gigId: String)
    case person(userId: String)
    case beacon(handle: String)
    case business(businessId: String)
    case home(homeId: String)
}

/// One unified search row — the native mirror of RN's `UnifiedResult`.
public struct UniversalSearchResult: Sendable, Hashable, Identifiable {
    public let id: String
    public let kind: UniversalSearchKind
    public let title: String
    public let subtitle: String?
    /// Trailing accent text — price for tasks, locality for everyone else.
    public let meta: String?
    public let imageURL: URL?
    public let destination: UniversalSearchDestination

    public init(
        id: String,
        kind: UniversalSearchKind,
        title: String,
        subtitle: String? = nil,
        meta: String? = nil,
        imageURL: URL? = nil,
        destination: UniversalSearchDestination
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.subtitle = subtitle
        self.meta = meta
        self.imageURL = imageURL
        self.destination = destination
    }
}

/// A rendered group of rows. The "All" tab emits one per non-empty kind
/// and shows the header; single-kind tabs emit one headerless section.
public struct UniversalSearchSection: Sendable, Hashable, Identifiable {
    public let kind: UniversalSearchKind
    public let results: [UniversalSearchResult]

    public var id: String {
        kind.rawValue
    }

    public init(kind: UniversalSearchKind, results: [UniversalSearchResult]) {
        self.kind = kind
        self.results = results
    }
}
