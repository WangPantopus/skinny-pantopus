//
//  SavedPlacesModels.swift
//  Pantopus
//
//  BLOCK 2E — "Saved places". UI models + the client-side projection that
//  maps `SavedPlaceDTO`s into rows, the relative "Saved …" caption, and the
//  filter-chip set (All · Home · Work · Saved). Kept free of view code +
//  networking so it can be unit-tested directly and reused by previews.
//

import SwiftUI

// MARK: - Place type

/// The four `place_type` values the backend stores. `searched` folds into the
/// "Saved" chip + the bookmark tile (both are primary-tinted bookmarks).
public enum SavedPlaceType: String, Sendable, Hashable {
    case home
    case work
    case saved
    case searched

    /// Tolerant decode — an unknown `place_type` lands on `.saved`.
    public static func fromWire(_ raw: String) -> SavedPlaceType {
        SavedPlaceType(rawValue: raw.lowercased()) ?? .saved
    }

    /// Leading icon-tile glyph (Home → house, Work → briefcase, Saved/Searched → bookmark).
    public var icon: PantopusIcon {
        switch self {
        case .home: .home
        case .work: .briefcase
        case .saved: .bookmark
        case .searched: .bookmark
        }
    }

    public var tileForeground: Color {
        switch self {
        case .home: Theme.Color.home
        case .work: Theme.Color.business
        case .saved, .searched: Theme.Color.primary600
        }
    }

    public var tileBackground: Color {
        switch self {
        case .home: Theme.Color.homeBg
        case .work: Theme.Color.businessBg
        case .saved, .searched: Theme.Color.primary100
        }
    }

    /// Inline subtitle pill — only the identity types carry one.
    public var pillLabel: String? {
        switch self {
        case .home: "Home"
        case .work: "Work"
        case .saved, .searched: nil
        }
    }

    /// Which filter chip this type lives under (searched folds into Saved).
    public var filterBucket: SavedPlaceFilter {
        switch self {
        case .home: .home
        case .work: .work
        case .saved, .searched: .saved
        }
    }
}

// MARK: - Filter chips

/// The list filter chips. `wire` is unused (filtering is client-side) but the
/// `accessibilityID` is the verbatim cross-platform contract identifier.
public enum SavedPlaceFilter: String, CaseIterable, Sendable, Hashable, Identifiable {
    case all
    case home
    case work
    case saved

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .all: "All"
        case .home: "Home"
        case .work: "Work"
        case .saved: "Saved"
        }
    }

    /// `savedPlaces.chip.{all|home|work|saved}`.
    public var accessibilityID: String {
        "savedPlaces.chip.\(rawValue)"
    }

    /// Does `type` belong under this chip? `.all` matches everything.
    public func matches(_ type: SavedPlaceType) -> Bool {
        self == .all || type.filterBucket == self
    }
}

// MARK: - Row

public struct SavedPlaceRow: Identifiable, Sendable, Hashable {
    /// SavedPlace id — also the row's contract test identifier suffix.
    public let id: String
    public let label: String
    public let type: SavedPlaceType
    public let city: String?
    public let state: String?
    /// "Saved 3 weeks ago" — already prefixed.
    public let savedCaption: String
    public let latitude: Double
    public let longitude: Double
    public let geocodePlaceId: String?

    public init(
        id: String,
        label: String,
        type: SavedPlaceType,
        city: String?,
        state: String?,
        savedCaption: String,
        latitude: Double,
        longitude: Double,
        geocodePlaceId: String?
    ) {
        self.id = id
        self.label = label
        self.type = type
        self.city = city
        self.state = state
        self.savedCaption = savedCaption
        self.latitude = latitude
        self.longitude = longitude
        self.geocodePlaceId = geocodePlaceId
    }

    /// "{city}, {state}" — collapses gracefully when one or both are missing.
    public var subtitle: String {
        let parts = [city, state].compactMap { value -> String? in
            guard let value, !value.isEmpty else { return nil }
            return value
        }
        return parts.isEmpty ? "Saved place" : parts.joined(separator: ", ")
    }

    /// Compact action-sheet projection of this row.
    public var actionTarget: SavedPlaceActionTarget {
        SavedPlaceActionTarget(
            id: id,
            label: label,
            subtitle: subtitle,
            type: type,
            latitude: latitude,
            longitude: longitude
        )
    }
}

/// The row currently being acted on in the overflow / swipe actions.
public struct SavedPlaceActionTarget: Identifiable, Sendable, Hashable {
    public let id: String
    public let label: String
    public let subtitle: String
    public let type: SavedPlaceType
    public let latitude: Double
    public let longitude: Double
}

// MARK: - Undo

/// Seed for the post-removal Undo snackbar. Re-POSTing `dto` restores the
/// place; `index` is the row's original position so it slots back in place.
public struct SavedPlaceUndo: Identifiable, Sendable, Hashable {
    public let id = UUID()
    public let dto: SavedPlaceDTO
    public let index: Int
}

// MARK: - View state

public enum SavedPlacesViewState: Sendable {
    case loading
    /// `filters` is `[.all] + present buckets`; the view shows the chip row
    /// only when more than one type is present (i.e. `filters.count > 2`).
    case loaded(rows: [SavedPlaceRow], filters: [SavedPlaceFilter], total: Int)
    case empty
    case error(message: String)
}

// MARK: - Projection

/// Pure mapping from network rows → display rows. Static so it is trivially
/// unit-testable and reused by previews.
public enum SavedPlacesProjection {
    /// Present filter chips: `.all` first, then `home / work / saved` in that
    /// fixed order, but only the buckets that actually have rows.
    public static func presentFilters(from dtos: [SavedPlaceDTO]) -> [SavedPlaceFilter] {
        let buckets = Set(dtos.map { SavedPlaceType.fromWire($0.placeType).filterBucket })
        let ordered: [SavedPlaceFilter] = [.home, .work, .saved].filter { buckets.contains($0) }
        return [.all] + ordered
    }

    /// Rows matching `filter`, preserving the server's `created_at desc` order.
    public static func rows(
        from dtos: [SavedPlaceDTO],
        filter: SavedPlaceFilter,
        now: Date
    ) -> [SavedPlaceRow] {
        dtos
            .filter { filter.matches(SavedPlaceType.fromWire($0.placeType)) }
            .map { row($0, now: now) }
    }

    static func row(_ dto: SavedPlaceDTO, now: Date) -> SavedPlaceRow {
        SavedPlaceRow(
            id: dto.id,
            label: dto.label,
            type: SavedPlaceType.fromWire(dto.placeType),
            city: dto.city,
            state: dto.state,
            savedCaption: relativeSaved(from: dto.createdAt, now: now),
            latitude: dto.latitude,
            longitude: dto.longitude,
            geocodePlaceId: dto.geocodePlaceId
        )
    }

    // MARK: Helpers

    /// "Saved 3 weeks ago" — day-granular relative phrasing matching the
    /// design captions (today / yesterday / N days / N weeks / last month /
    /// N months / N years).
    static func relativeSaved(from iso: String?, now: Date) -> String {
        guard let date = parseDate(iso) else { return "Saved" }
        let seconds = max(0, now.timeIntervalSince(date))
        let day = 86400.0
        let days = Int(seconds / day)
        switch days {
        case 0: return "Saved today"
        case 1: return "Saved yesterday"
        case 2..<7: return "Saved \(days) days ago"
        case 7..<14: return "Saved 1 week ago"
        case 14..<30: return "Saved \(days / 7) weeks ago"
        case 30..<60: return "Saved last month"
        case 60..<365: return "Saved \(days / 30) months ago"
        default:
            let years = days / 365
            return "Saved \(years) year\(years == 1 ? "" : "s") ago"
        }
    }

    /// Parses an ISO-8601 timestamp (with or without fractional seconds). The
    /// formatter is created locally so this nonisolated helper stays clean
    /// under strict concurrency (`ISO8601DateFormatter` is not `Sendable`).
    static func parseDate(_ iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: iso) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: iso)
    }
}

// MARK: - Save-place type chooser

/// The three choices in the Save-place sheet's type picker. Maps onto the
/// backend `placeType` (`Other` → `saved`).
public enum SavePlaceTypeChoice: String, CaseIterable, Sendable, Hashable, Identifiable {
    case home
    case work
    case other

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .home: "Home"
        case .work: "Work"
        case .other: "Other"
        }
    }

    /// `savePlace.type.{home|work|other}`.
    public var accessibilityID: String {
        "savePlace.type.\(rawValue)"
    }

    /// Wire `placeType` value.
    public var wire: String {
        switch self {
        case .home: "home"
        case .work: "work"
        case .other: "saved"
        }
    }

    public var placeType: SavedPlaceType {
        switch self {
        case .home: .home
        case .work: .work
        case .other: .saved
        }
    }

    public var icon: PantopusIcon {
        placeType.icon
    }

    public var tileForeground: Color {
        placeType.tileForeground
    }

    public var tileBackground: Color {
        placeType.tileBackground
    }
}
