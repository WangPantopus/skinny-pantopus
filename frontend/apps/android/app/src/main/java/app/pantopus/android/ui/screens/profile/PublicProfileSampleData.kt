@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.profile

import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileReviewCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * B.2 (A10.5) — deterministic neighbor-profile fixtures for the two
 * design frames (Derek R. populated · Sasha M. new neighbor). Backend has
 * been removed, so previews + Paparazzi project these directly; the
 * view-model synthesises the same shape from the live DTO.
 */
object PublicProfileSampleData {
    /** FRAME 1 — populated handyman with 47 reviews + 4 verifications. */
    val derekPopulated =
        NeighborProfileContent(
            hero =
                NeighborHero(
                    name = "Derek Reyes",
                    locality = "Elm Park · 5th & Elm",
                    avatarUrl = null,
                    isVerified = true,
                    identity = NeighborIdentity.Personal,
                    kicker = "Neighbor since 2022",
                ),
            stats =
                listOf(
                    NeighborStat(
                        id = "rating",
                        value = "4.9",
                        label = "47 reviews",
                        icon = PantopusIcon.Star,
                        iconColor = PantopusColors.warning,
                    ),
                    NeighborStat(id = "jobs", value = "32", label = "Jobs done"),
                    NeighborStat(id = "response", value = "~45m", label = "Response"),
                ),
            bio =
                "Handyman who lives two doors down. Hangs shelves, patches drywall, fixes the " +
                    "stuff your landlord won't. Bike-commutes everywhere — happy to drop a tool by " +
                    "on the way home. Weekend mornings work best.",
            skills = listOf("Handyman", "Patch & paint", "Plumbing (light)", "Cycling", "Help moving", "EN · ES"),
            verifications =
                listOf(
                    NeighborVerification(
                        id = "address",
                        icon = PantopusIcon.Home,
                        label = "Address",
                        meta = "Verified Mar 2022 · postcard",
                    ),
                    NeighborVerification(id = "identity", icon = PantopusIcon.BadgeCheck, label = "Identity", meta = "Government ID"),
                    NeighborVerification(id = "email", icon = PantopusIcon.Mail, label = "Email", meta = "derek@…"),
                    NeighborVerification(id = "phone", icon = PantopusIcon.Phone, label = "Phone", meta = "+1 ••• ••• 0193"),
                ),
            reviews =
                listOf(
                    ProfileReviewCard(
                        id = "r1",
                        reviewerName = "Maria K.",
                        reviewerAvatarUrl = null,
                        rating = 5,
                        body =
                            "Showed up early, brought his own anchors, and noticed the stud finder was " +
                                "lying. Shelves are level a month later. Already booked him for the closet.",
                        timestamp = "2w · for “Hang 3 shelves”",
                    ),
                ),
            reviewCount = 47,
            posts =
                listOf(
                    PublicProfilePost(
                        id = "dp1",
                        body = "Free leftover deck screws + a half-bag of anchors on my stoop. First come.",
                        timeAgo = "3d ago",
                        locality = "5th & Elm",
                        reactions = 9,
                        replies = 4,
                        intent = PublicProfilePost.Intent.Offer,
                    ),
                ),
            isNewNeighbor = false,
            primaryCtaLabel = "Message",
        )

    /** FRAME 2 — new verified neighbor, 0 reviews, graceful degradation. */
    val sashaNewNeighbor =
        NeighborProfileContent(
            hero =
                NeighborHero(
                    name = "Sasha Mendel",
                    locality = "Elm Park · 6th St",
                    avatarUrl = null,
                    isVerified = true,
                    identity = NeighborIdentity.Fresh,
                    kicker = "Joined 4 days ago",
                ),
            stats =
                listOf(
                    NeighborStat(
                        id = "rating",
                        value = "—",
                        label = "No reviews yet",
                        icon = PantopusIcon.Star,
                        valueColor = PantopusColors.appTextMuted,
                        iconColor = PantopusColors.appTextMuted,
                    ),
                    NeighborStat(id = "jobs", value = "0", label = "Jobs done"),
                    NeighborStat(id = "response", value = "New", label = "Response", valueColor = PantopusColors.primary600),
                ),
            bio = null,
            skills = emptyList(),
            verifications =
                listOf(
                    NeighborVerification(
                        id = "address",
                        icon = PantopusIcon.Home,
                        label = "Address verified",
                        meta = "Postcard delivered to 6th St",
                        tile = NeighborVerification.Tile.Success,
                        trailing = NeighborVerification.Trailing.Status("Today"),
                    ),
                    NeighborVerification(
                        id = "identity",
                        icon = PantopusIcon.BadgeCheck,
                        label = "Identity verified",
                        meta = "Government ID matched",
                        tile = NeighborVerification.Tile.Success,
                        trailing = NeighborVerification.Trailing.Status("4d ago"),
                    ),
                    NeighborVerification(
                        id = "email",
                        icon = PantopusIcon.Mail,
                        label = "Email confirmed",
                        meta = "sasha@…",
                        tile = NeighborVerification.Tile.Success,
                        trailing = NeighborVerification.Trailing.Status("4d ago"),
                    ),
                ),
            reviews = emptyList(),
            reviewCount = 0,
            mutuals =
                NeighborMutuals(
                    count = 4,
                    names = "Jamal, Ravi, Lena, Amina",
                    initials = listOf("JT", "RD", "LP", "AS"),
                ),
            welcome =
                NeighborWelcome(
                    title = "Be the welcome wagon",
                    body =
                        "Sasha just moved in. A quick “hi, welcome to the block” goes a long way — " +
                            "and first messages from verified neighbors travel fast.",
                ),
            isNewNeighbor = true,
            primaryCtaLabel = "Say hi",
        )
}
