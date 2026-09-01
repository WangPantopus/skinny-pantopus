@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.package_gig

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Wire value for `gigType` on
 * `POST api/mailbox/v2/p2/package/:mailId/gig`. Joi rejects anything
 * outside this set (`packageGigSchema`,
 * `backend/routes/mailboxV2Phase2.js:83`), so [wire] is load-bearing.
 */
enum class PackageGigType(val wire: String) {
    Hold("hold"),
    Inside("inside"),
    Sign("sign"),
    Assembly("assembly"),
    Custom("custom"),
}

/**
 * One row in the "WHAT DO YOU NEED?" selector. Copy matches RN
 * `src/app/mailbox/gig.tsx:15-21`.
 *
 * Mirrors `PackageGigOption.swift` on iOS.
 */
data class PackageGigOption(
    val type: PackageGigType,
    val icon: PantopusIcon,
    val title: String,
    val subtitle: String,
    /**
     * RN hides the post-delivery-only options while the package is still in
     * transit (`gig.tsx:38-40` filters on `preDelivery`).
     */
    val availablePreDelivery: Boolean,
) {
    companion object {
        /** Declaration order matches RN's `GIG_OPTIONS`. */
        val ALL: List<PackageGigOption> =
            listOf(
                PackageGigOption(
                    type = PackageGigType.Hold,
                    icon = PantopusIcon.Mailbox,
                    title = "Hold Package",
                    subtitle = "Neighbor holds it until you return",
                    availablePreDelivery = true,
                ),
                PackageGigOption(
                    type = PackageGigType.Inside,
                    icon = PantopusIcon.Home,
                    title = "Put Inside",
                    subtitle = "Neighbor moves it inside your porch/garage",
                    availablePreDelivery = true,
                ),
                PackageGigOption(
                    type = PackageGigType.Sign,
                    icon = PantopusIcon.FileSignature,
                    title = "Sign for Me",
                    subtitle = "Neighbor signs on your behalf",
                    availablePreDelivery = true,
                ),
                PackageGigOption(
                    type = PackageGigType.Assembly,
                    icon = PantopusIcon.Wrench,
                    title = "Help Assemble",
                    subtitle = "Neighbor helps with assembly after delivery",
                    availablePreDelivery = false,
                ),
                PackageGigOption(
                    type = PackageGigType.Custom,
                    icon = PantopusIcon.MessageSquare,
                    title = "Custom Request",
                    subtitle = "Describe what you need",
                    availablePreDelivery = false,
                ),
            )

        /**
         * Pre-delivery keeps only the options that make sense before the
         * carrier drops the box; post-delivery offers everything.
         */
        fun options(isPreDelivery: Boolean): List<PackageGigOption> = if (isPreDelivery) ALL.filter { it.availablePreDelivery } else ALL
    }
}
