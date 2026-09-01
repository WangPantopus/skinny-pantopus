//
//  CreateBusinessSampleData.swift
//  Pantopus
//
//  Deterministic fixtures for the A12.10 Create Business wizard. The
//  populated frame ships a fixed "What you'll get" payload for Home
//  Services; the search frame ships a fixed 3-result match for "tutor".
//

import Foundation

enum CreateBusinessSampleData {
    /// "What you'll get with home services" strip content. Mirrors the
    /// 3-row payload baked into the design's `WhatYouGet` block.
    static let homeServicesWhatYouGet: [WhatYouGetItem] = [
        WhatYouGetItem(
            id: "listings",
            icon: .listChecks,
            label: "Service listings",
            subcopy: "Set rates per hour or per job"
        ),
        WhatYouGetItem(
            id: "tax",
            icon: .fileText,
            label: "1099/W-9 ready",
            subcopy: "We collect tax info in step 2"
        ),
        WhatYouGetItem(
            id: "insurance",
            icon: .shield,
            label: "Insurance hint",
            subcopy: "Optional but boosts trust score"
        )
    ]

    /// Catalog the search frame ranks against. Each row carries the
    /// matching category plus the sub-area label rendered under the hit.
    /// The label is what `Highlighted` substring-matches against.
    static let searchCatalog: [CategorySearchHit] = [
        CategorySearchHit(
            id: "tutoring-core",
            category: .personal,
            label: "Tutoring · K-12, test prep, music"
        ),
        CategorySearchHit(
            id: "tutoring-centers",
            category: .personal,
            label: "Tutoring centers"
        ),
        CategorySearchHit(
            id: "tutoring-tech",
            category: .tech,
            label: "Tutoring — tech & coding"
        ),
        CategorySearchHit(
            id: "lawncare",
            category: .home,
            label: "Lawn care · mowing & seasonal"
        ),
        CategorySearchHit(
            id: "petcare",
            category: .personal,
            label: "Pet care · sitting & walks"
        ),
        CategorySearchHit(
            id: "moving",
            category: .home,
            label: "Moving · local & long-distance"
        ),
        CategorySearchHit(
            id: "delivery-grocery",
            category: .delivery,
            label: "Grocery delivery"
        ),
        CategorySearchHit(
            id: "rideshare",
            category: .vehicles,
            label: "Rideshare driving"
        )
    ]

    /// Filter the catalog against a query and rank prefix matches first.
    /// Returns up to 3 hits — the audit explicitly shows "3 matches for
    /// 'tutor'" so the search frame is sized for exactly that count.
    static func searchHits(query: String, limit: Int = 3) -> [CategorySearchHit] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        let q = trimmed.lowercased()
        let scored: [(hit: CategorySearchHit, score: Int)] = searchCatalog.compactMap { hit in
            let lower = hit.label.lowercased()
            if lower.hasPrefix(q) { return (hit, 0) }
            if lower.contains(" \(q)") { return (hit, 1) }
            if lower.contains(q) { return (hit, 2) }
            return nil
        }
        return scored
            .sorted { $0.score < $1.score }
            .prefix(limit)
            .map(\.hit)
    }
}
