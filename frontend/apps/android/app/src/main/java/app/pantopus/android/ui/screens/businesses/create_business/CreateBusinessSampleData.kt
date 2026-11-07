@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.create_business

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Fixed content for the A12.10 Create Business wizard: the "What you'll get"
 * payload shown under Home services. The search list lives in
 * [CreateBusinessCategoryCatalog].
 */
internal object CreateBusinessSampleData {
    /**
     * "What you'll get with home services" strip content — the same three
     * rows as iOS (`CreateBusinessSampleData.homeServicesWhatYouGet`).
     */
    val homeServicesWhatYouGet: List<WhatYouGetItem> =
        listOf(
            WhatYouGetItem(
                id = "listings",
                icon = PantopusIcon.ListChecks,
                label = "Service catalog",
                subcopy = "Add services and prices after setup",
            ),
            WhatYouGetItem(
                id = "profile",
                icon = PantopusIcon.FileText,
                label = "Business profile",
                subcopy = "Add your name, description, and contact details",
            ),
            WhatYouGetItem(
                id = "draft",
                icon = PantopusIcon.Shield,
                label = "Save as draft",
                subcopy = "Keep your page hidden until you publish",
            ),
        )
}
