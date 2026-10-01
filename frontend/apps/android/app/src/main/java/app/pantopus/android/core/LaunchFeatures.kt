package app.pantopus.android.core

import androidx.annotation.VisibleForTesting
import app.pantopus.android.BuildConfig

/**
 * A feature cut from the first launch (founder direction, 2026-09-27). The
 * [key] is shared with the web app, the backend and iOS.
 */
enum class LaunchFeature(
    val key: String,
) {
    /** 1. Beacon and creator tools: publisher pages, following publishers, updates and media, audience management, creator inbox, membership tiers and restricted content. */
    BEACON("beacon"),

    /** 2. Personas and identity switching: public personas, Beacon identity and switching between profiles. */
    PERSONAS("personas"),

    /** 3. Marketplace: listings, search, offers, trades and buyer–seller chat. */
    MARKETPLACE("marketplace"),

    /** 4. Open Gigs marketplace: posting any task for bids, competitive bidding, unrestricted categories and broad provider search. */
    OPEN_GIGS("open_gigs"),

    /** 5. Public scheduling for general businesses: booking pages, appointment types, shared resources and team scheduling. */
    PUBLIC_SCHEDULING("public_scheduling"),

    /** 6. General business directory: browsing and searching all businesses. */
    BUSINESS_DIRECTORY("business_directory"),

    /** 7. Household extras: polls, package tracking, the separate pet section, the general family calendar and full bill management. */
    HOUSEHOLD_EXTRAS("household_extras"),

    /** 8. Mail extras: personal and ceremonial letters, e-signing, the community mail stream and event invitations by mail. */
    MAIL_EXTRAS("mail_extras"),
}

/**
 * Read-only switches for the features cut from the first launch. They are
 * hidden, not deleted: a feature is OFF unless its key is listed in the
 * `PANTOPUS_LAUNCH_FEATURES` build value (comma-separated, or "all"), read
 * from `.env` or the environment at build time like the other BuildConfig
 * values.
 */
object LaunchFeatures {
    private val enabledFeatures: Set<LaunchFeature> = parse(BuildConfig.PANTOPUS_LAUNCH_FEATURES)

    /** Unit tests only: replaces the build's set while non-null. */
    @VisibleForTesting
    @Volatile
    var overrideForTesting: Set<LaunchFeature>? = null

    fun isEnabled(feature: LaunchFeature): Boolean = (overrideForTesting ?: enabledFeatures).contains(feature)

    val beacon: Boolean get() = isEnabled(LaunchFeature.BEACON)
    val personas: Boolean get() = isEnabled(LaunchFeature.PERSONAS)
    val marketplace: Boolean get() = isEnabled(LaunchFeature.MARKETPLACE)
    val openGigs: Boolean get() = isEnabled(LaunchFeature.OPEN_GIGS)
    val publicScheduling: Boolean get() = isEnabled(LaunchFeature.PUBLIC_SCHEDULING)
    val businessDirectory: Boolean get() = isEnabled(LaunchFeature.BUSINESS_DIRECTORY)
    val householdExtras: Boolean get() = isEnabled(LaunchFeature.HOUSEHOLD_EXTRAS)
    val mailExtras: Boolean get() = isEnabled(LaunchFeature.MAIL_EXTRAS)

    /** Parses a comma-separated key list ("all" enables every feature). */
    fun parse(raw: String?): Set<LaunchFeature> {
        val listed =
            raw
                .orEmpty()
                .split(',')
                .map { it.trim().lowercase() }
                .filter { it.isNotEmpty() }
        if ("all" in listed) return LaunchFeature.entries.toSet()
        return LaunchFeature.entries.filter { it.key in listed }.toSet()
    }
}
