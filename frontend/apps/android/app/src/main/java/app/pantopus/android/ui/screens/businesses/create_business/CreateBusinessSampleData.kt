@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.create_business

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Deterministic fixtures for the A12.10 Create Business wizard. The
 * populated frame ships a fixed "What you'll get" payload for Home
 * Services; the search frame ships a fixed 3-result match for "tutor".
 */
internal object CreateBusinessSampleData {
    /**
     * "What you'll get with home services" strip content. Mirrors the
     * 3-row payload baked into the design's `WhatYouGet` block.
     */
    val homeServicesWhatYouGet: List<WhatYouGetItem> =
        listOf(
            WhatYouGetItem(
                id = "listings",
                icon = PantopusIcon.ListChecks,
                label = "Service listings",
                subcopy = "Set rates per hour or per job",
            ),
            WhatYouGetItem(
                id = "tax",
                icon = PantopusIcon.FileText,
                label = "1099/W-9 ready",
                subcopy = "We collect tax info in step 2",
            ),
            WhatYouGetItem(
                id = "insurance",
                icon = PantopusIcon.Shield,
                label = "Insurance hint",
                subcopy = "Optional but boosts trust score",
            ),
        )

    /**
     * Catalog the search frame ranks against. Each row carries the
     * matching category plus the sub-area label rendered under the hit.
     */
    val searchCatalog: List<CategorySearchHit> =
        listOf(
            CategorySearchHit(
                id = "tutoring-core",
                category = BusinessCategory.Personal,
                label = "Tutoring · K-12, test prep, music",
            ),
            CategorySearchHit(
                id = "tutoring-centers",
                category = BusinessCategory.Personal,
                label = "Tutoring centers",
            ),
            CategorySearchHit(
                id = "tutoring-tech",
                category = BusinessCategory.Tech,
                label = "Tutoring — tech & coding",
            ),
            CategorySearchHit(
                id = "lawncare",
                category = BusinessCategory.Home,
                label = "Lawn care · mowing & seasonal",
            ),
            CategorySearchHit(
                id = "petcare",
                category = BusinessCategory.Personal,
                label = "Pet care · sitting & walks",
            ),
            CategorySearchHit(
                id = "moving",
                category = BusinessCategory.Home,
                label = "Moving · local & long-distance",
            ),
            CategorySearchHit(
                id = "delivery-grocery",
                category = BusinessCategory.Delivery,
                label = "Grocery delivery",
            ),
            CategorySearchHit(
                id = "rideshare",
                category = BusinessCategory.Vehicles,
                label = "Rideshare driving",
            ),
        )

    /**
     * Filter the catalog against [query] and rank prefix matches first.
     * Returns up to [limit] hits — the audit explicitly shows "3 matches
     * for 'tutor'" so the search frame is sized for exactly that count.
     */
    fun searchHits(
        query: String,
        limit: Int = 3,
    ): List<CategorySearchHit> {
        val trimmed = query.trim()
        if (trimmed.isEmpty()) return emptyList()
        val q = trimmed.lowercase()
        return searchCatalog
            .mapNotNull { hit ->
                val lower = hit.label.lowercase()
                val score =
                    when {
                        lower.startsWith(q) -> 0
                        lower.contains(" $q") -> 1
                        lower.contains(q) -> 2
                        else -> return@mapNotNull null
                    }
                hit to score
            }.sortedBy { it.second }
            .take(limit)
            .map { it.first }
    }
}
