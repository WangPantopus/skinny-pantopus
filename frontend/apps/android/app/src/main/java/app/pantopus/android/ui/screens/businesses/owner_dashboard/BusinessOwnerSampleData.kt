@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.owner_dashboard

import app.pantopus.android.ui.screens.business_profile.BusinessProfileSampleData
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A10.7 — the hand-authored owner-view frame used by previews, the Paparazzi
 * snapshot, and iOS parity. Marlow & Co. Cleaning, the same business as the
 * A10.6 sample ([BusinessProfileSampleData.populated]) so the owner frame and
 * its "preview as neighbor" describe one business.
 *
 * Insights / profile strength / reviews are sample-driven (no analytics or
 * review-reply backend in B3.2). Mirrors iOS `BusinessOwnerSampleData.swift`.
 */
object BusinessOwnerSampleData {
    val marlow: BusinessOwnerContent =
        BusinessOwnerContent(
            businessId = "marlow",
            isLive = true,
            editedMeta = "Edited 3d ago",
            insights =
                listOf(
                    OwnerInsightTile("views", PantopusIcon.Eye, "1.2k", "Views", delta = "18%"),
                    OwnerInsightTile("saves", PantopusIcon.Bookmark, "84", "Saves", delta = "6%"),
                    OwnerInsightTile("contacts", PantopusIcon.MessageCircle, "23", "Contacts"),
                ),
            profileStrength =
                OwnerProfileStrength(
                    percent = 92,
                    caption = "One step from a complete page",
                    steps =
                        listOf(
                            OwnerStrengthStep("basics", "Logo, banner & description", done = true),
                            OwnerStrengthStep("hours", "Hours & service area", done = true),
                            OwnerStrengthStep("photos", "Add 2 more work photos", done = false, ctaLabel = "Add"),
                        ),
                ),
            reviewsToReplyLabel = "2 to reply",
            reviews =
                listOf(
                    OwnerReviewItem(
                        id = "dana",
                        reviewerName = "Dana R.",
                        reviewerAvatarUrl = null,
                        meta = "2d · Deep clean",
                        rating = 4,
                        body = "Great job overall — only ding is they ran 20 min late. Place looked spotless though.",
                        reply = null,
                    ),
                    OwnerReviewItem(
                        id = "jamal",
                        reviewerName = "Jamal T.",
                        reviewerAvatarUrl = null,
                        meta = "1w · Standard clean",
                        rating = 5,
                        body = "Same two folks every time, which I love. They remember the dog and shut the gate.",
                        reply =
                            "Thanks Jamal — Rosa and Mae always look forward to seeing Biscuit. " +
                                "See you next visit.",
                    ),
                ),
            publicProfile = BusinessProfileSampleData.populated,
            canPostAsBusiness = true,
        )
}
