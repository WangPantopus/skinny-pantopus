//
//  ExploreMapSampleData.swift
//  Pantopus
//
//  A11.2 Explore — deterministic sample data. The backend has been
//  removed from the repo, so the Explore map is wired against these
//  stub entities (shapes mirror the eventual API). Sample sets are
//  fixed so previews + snapshot tests render identically every run.
//
//  Tabular fixture builders intentionally use wide positional signatures
//  + grouped rows so the data reads like a table.
// swiftlint:disable function_parameter_count function_body_length type_body_length

import Foundation

/// The scenario a sample-backed view-model renders. `populated` / `empty`
/// drive the loaded states; `loading` / `error` let previews + snapshot
/// tests exercise the remaining two render states.
public enum ExploreScenario: Sendable {
    case populated
    case empty
    case loading
    case error
}

public enum ExploreMapSampleData {
    /// Anchor coordinate ("you are here") — downtown reference point.
    public static let center = UserCoordinate(latitude: 40.7484, longitude: -73.9857, accuracyMeters: 50)

    /// Raw entities for a scenario (before filtering).
    public static func entities(for scenario: ExploreScenario) -> [ExploreEntity] {
        switch scenario {
        case .populated, .loading, .error: populatedEntities()
        case .empty: emptyEntities()
        }
    }

    /// Seeded filter criteria for a scenario.
    public static func filters(for scenario: ExploreScenario) -> ExploreFilterCriteria {
        switch scenario {
        case .populated, .loading, .error:
            // Distance 1 mi + verified + open → 3 filters on, matching the
            // design's "47 nearby · 3 filters on" populated frame.
            ExploreFilterCriteria(kinds: [], distanceUpper: 1, verifiedOnly: true, openNow: true)
        case .empty:
            // Three filters narrow the view to zero — the designed empty frame.
            ExploreFilterCriteria(kinds: [], distanceUpper: 0.5, verifiedOnly: true, openNow: true)
        }
    }

    // MARK: - Populated

    /// The four design hero cards plus enough varied + clustered entities
    /// to read as a dense neighborhood ("47 nearby"). All are verified +
    /// open + within 1 mile so the seeded 3-filter populated state keeps
    /// every one of them.
    private static func populatedEntities() -> [ExploreEntity] {
        var out: [ExploreEntity] = [
            entity(
                "t1",
                .task,
                .confirmed,
                0.0010,
                0.0009,
                "Hang 3 floating shelves",
                "$60",
                0.2,
                badge("4 bids", .bids)
            ),
            entity(
                "i1",
                .item,
                .confirmed,
                -0.0006,
                0.0030,
                "Mid-century walnut sideboard",
                "$420",
                0.4,
                badge("New", .new)
            ),
            entity(
                "p1",
                .post,
                .confirmed,
                0.0024,
                -0.0008,
                "Anyone know a good cardiologist nearby?",
                "Asked 2h ago",
                0.3,
                badge("8 replies", .replies)
            ),
            entity(
                "s1",
                .spot,
                .confirmed,
                0.0038,
                0.0020,
                "Sunrise Bakery — fresh pastries",
                "Open",
                0.5,
                badge("4.8★", .rating)
            ),
            entity(
                "t2",
                .task,
                .pending,
                -0.0030,
                -0.0024,
                "Mount a 55\" TV on drywall",
                "$80",
                0.6,
                badge("2 bids", .bids)
            ),
            entity(
                "i2",
                .item,
                .confirmed,
                0.0044,
                -0.0030,
                "Road bike, barely used",
                "$250",
                0.7,
                badge("New", .new)
            ),
            entity(
                "p2",
                .post,
                .confirmed,
                -0.0040,
                0.0012,
                "Lost gray cat near Oak St",
                "Asked 5h ago",
                0.4,
                badge("3 replies", .replies)
            ),
            entity(
                "s2",
                .spot,
                .confirmed,
                0.0008,
                0.0042,
                "Verde Coffee — espresso bar",
                "Open",
                0.2,
                badge("4.6★", .rating)
            ),
            entity(
                "t3",
                .task,
                .confirmed,
                -0.0014,
                0.0048,
                "Assemble flat-pack wardrobe",
                "$45",
                0.8,
                badge("1 bid", .bids)
            ),
            entity(
                "i3",
                .item,
                .pending,
                0.0052,
                0.0006,
                "Toddler stroller, like new",
                "$90",
                0.5,
                badge("New", .new)
            ),
            entity(
                "p3",
                .post,
                .confirmed,
                -0.0050,
                -0.0040,
                "Recommendations for a plumber?",
                "Asked 1d ago",
                0.9,
                badge("12 replies", .replies)
            ),
            entity(
                "s3",
                .spot,
                .confirmed,
                0.0030,
                0.0054,
                "Hudson Hardware — tools & paint",
                "Open",
                0.6,
                badge("4.7★", .rating)
            )
        ]
        // Dense cluster of 12 just south-east of the anchor.
        out += filler(prefix: "ca", count: 12, latBase: -0.0065, lonBase: 0.0060, spread: 0.0006, startIndex: 0)
        // Tighter cluster of 4 (items-led) to the east.
        out += filler(prefix: "cb", count: 4, latBase: 0.0050, lonBase: 0.0090, spread: 0.0004, startIndex: 12, kindBias: .item)
        // Scattered remainder to reach a dense "47 nearby" total.
        out += filler(prefix: "sc", count: 19, latBase: 0.0, lonBase: 0.0, spread: 0.0085, startIndex: 16)
        return out
    }

    // MARK: - Empty

    /// Raw entities for the empty frame. None are simultaneously verified,
    /// open, and within 0.5 mi, so the seeded 3-filter state narrows to
    /// zero. "Clear filters" reveals all six; "Widen area" surfaces the
    /// three verified+open neighbors that sit just beyond the radius.
    private static func emptyEntities() -> [ExploreEntity] {
        [
            // Close, but excluded by verified/open.
            entity(
                "e1",
                .task,
                .confirmed,
                0.0008,
                0.0006,
                "Fix a leaky kitchen faucet",
                "$50",
                0.2,
                badge("2 bids", .bids),
                verified: false,
                openNow: true
            ),
            entity(
                "e2",
                .spot,
                .confirmed,
                -0.0010,
                0.0009,
                "Late Night Diner",
                "Closed",
                0.3,
                badge("4.2★", .rating),
                verified: true,
                openNow: false
            ),
            entity(
                "e3",
                .item,
                .pending,
                0.0004,
                -0.0007,
                "Bookshelf, solid oak",
                "$120",
                0.1,
                badge("New", .new),
                verified: false,
                openNow: true
            ),
            // Verified + open, but beyond the 0.5 mi radius (revealed by Widen area).
            entity(
                "e4",
                .post,
                .confirmed,
                0.0090,
                0.0070,
                "Block party this weekend — who's in?",
                "Asked 3h ago",
                0.8,
                badge("9 replies", .replies),
                verified: true,
                openNow: true
            ),
            entity(
                "e5",
                .task,
                .confirmed,
                -0.0150,
                0.0120,
                "Deep clean a 2-bed apartment",
                "$140",
                1.4,
                badge("5 bids", .bids),
                verified: true,
                openNow: true
            ),
            entity(
                "e6",
                .spot,
                .confirmed,
                0.0180,
                -0.0140,
                "Greenmarket — open Saturdays",
                "Open",
                1.8,
                badge("4.9★", .rating),
                verified: true,
                openNow: true
            )
        ]
    }

    // MARK: - Builders

    private static func badge(_ text: String, _ tone: ExploreBadge.Tone) -> ExploreBadge {
        ExploreBadge(text: text, tone: tone)
    }

    private static func entity(
        _ id: String,
        _ kind: ExploreKind,
        _ state: ExploreEntityState,
        _ dLat: Double,
        _ dLon: Double,
        _ title: String,
        _ metaLead: String,
        _ distanceMiles: Double,
        _ badge: ExploreBadge?,
        verified: Bool = true,
        openNow: Bool = true
    ) -> ExploreEntity {
        ExploreEntity(
            id: id,
            kind: kind,
            state: state,
            latitude: center.latitude + dLat,
            longitude: center.longitude + dLon,
            title: title,
            metaLead: metaLead,
            distanceLabel: distanceLabel(distanceMiles),
            distanceMiles: distanceMiles,
            badge: badge,
            verified: verified,
            openNow: openNow
        )
    }

    /// Deterministic filler used to flesh out clusters + the dense total.
    /// All entries are verified + open and within ~0.95 mi so the
    /// populated 3-filter state keeps them.
    private static func filler(
        prefix: String,
        count: Int,
        latBase: Double,
        lonBase: Double,
        spread: Double,
        startIndex: Int,
        kindBias: ExploreKind? = nil
    ) -> [ExploreEntity] {
        let kinds = ExploreKind.allCases
        let titles: [ExploreKind: String] = [
            .task: "Help wanted nearby",
            .item: "For sale nearby",
            .post: "Neighbor asked a question",
            .spot: "Local spot",
            .home: "Neighborhood home"
        ]
        let metas: [ExploreKind: String] = [
            .task: "$35",
            .item: "$30",
            .post: "Asked today",
            .spot: "Open",
            .home: "Home"
        ]
        let tones: [ExploreKind: ExploreBadge.Tone] = [
            .task: .bids, .item: .new, .post: .replies, .spot: .rating, .home: .new
        ]
        let badgeText: [ExploreKind: String] = [
            .task: "1 bid", .item: "New", .post: "2 replies", .spot: "4.5★", .home: "Home"
        ]
        return (0..<count).map { i in
            let global = startIndex + i
            let kind = kindBias ?? kinds[global % kinds.count]
            // Deterministic pseudo-offset from the index — stable across runs.
            let angle = Double((global * 53) % 360) * .pi / 180
            let radius = spread * (0.35 + Double((global * 17) % 65) / 100)
            let dLat = latBase + cos(angle) * radius
            let dLon = lonBase + sin(angle) * radius
            // ~69 mi per degree; clamped so every filler stays inside 1 mi.
            let miles = min(0.95, max(0.1, hypot(dLat, dLon) * 69))
            return entity(
                "\(prefix)\(global)",
                kind,
                global.isMultiple(of: 5) ? .pending : .confirmed,
                dLat,
                dLon,
                titles[kind] ?? "Nearby",
                metas[kind] ?? "",
                miles,
                ExploreBadge(text: badgeText[kind] ?? "New", tone: tones[kind] ?? .new)
            )
        }
    }

    private static func distanceLabel(_ miles: Double) -> String {
        if miles < 0.1 { return "< 0.1 mi" }
        if miles < 10 { return String(format: "%.1f mi", miles) }
        return "\(Int(miles)) mi"
    }
}
