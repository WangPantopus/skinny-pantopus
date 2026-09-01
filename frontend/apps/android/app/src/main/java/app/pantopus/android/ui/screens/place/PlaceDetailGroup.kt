package app.pantopus.android.ui.screens.place

import app.pantopus.android.data.api.models.place.PlaceGroup

/**
 * The seven Place detail destinations (W2.3). Maps the contract's
 * curated [PlaceGroup]s onto the detail pages a dashboard card taps
 * through to — `health_environment` folds into Risk (no detail page of
 * its own), mirroring the web `sections.ts` GROUP_TO_SLUG and the iOS
 * `PlaceDetailGroup`. The [slug] matches the web route (`/app/place/<slug>`).
 */
enum class PlaceDetailGroup(val slug: String, val title: String) {
    TODAY("today", "Today"),
    YOUR_HOME("your-home", "Your home"),
    RISK("risk", "Risk & readiness"),
    BLOCK("block", "Your block"),
    MONEY("money", "Money signals"),
    CIVIC("civic", "Civic"),
    IDENTITY("identity", "Identity"),
    ;

    /** The contract groups whose sections this detail page renders. */
    val groups: List<PlaceGroup>
        get() =
            when (this) {
                TODAY -> listOf(PlaceGroup.TODAY)
                YOUR_HOME -> listOf(PlaceGroup.YOUR_HOME)
                RISK -> listOf(PlaceGroup.RISK_READINESS, PlaceGroup.HEALTH_ENVIRONMENT)
                BLOCK -> listOf(PlaceGroup.YOUR_BLOCK)
                MONEY -> listOf(PlaceGroup.MONEY_SIGNALS)
                CIVIC -> listOf(PlaceGroup.CIVIC)
                IDENTITY -> listOf(PlaceGroup.IDENTITY)
            }

    companion object {
        fun fromSlug(slug: String?): PlaceDetailGroup? = entries.firstOrNull { it.slug == slug }

        /** The detail page a dashboard card in [group] taps through to. */
        fun forGroup(group: PlaceGroup): PlaceDetailGroup? =
            when (group) {
                PlaceGroup.TODAY -> TODAY
                PlaceGroup.YOUR_HOME -> YOUR_HOME
                PlaceGroup.RISK_READINESS, PlaceGroup.HEALTH_ENVIRONMENT -> RISK
                PlaceGroup.YOUR_BLOCK -> BLOCK
                PlaceGroup.MONEY_SIGNALS -> MONEY
                PlaceGroup.CIVIC -> CIVIC
                PlaceGroup.IDENTITY -> IDENTITY
                PlaceGroup.UNKNOWN -> null
            }
    }
}
