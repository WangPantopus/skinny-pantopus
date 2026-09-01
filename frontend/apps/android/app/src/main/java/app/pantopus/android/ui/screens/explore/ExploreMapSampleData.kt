@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.explore

import app.pantopus.android.data.location.UserCoordinate
import java.util.Locale
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/**
 * A11.2 Explore — deterministic sample data (backend removed from the
 * repo). Mirrors the iOS `ExploreMapSampleData.swift` so both platforms
 * render the same "47 nearby · 3 filters on" populated frame and the same
 * empty frame.
 */

/** The scenario a sample-backed view-model renders. */
enum class ExploreScenario { Populated, Empty, Loading, Error }

object ExploreMapSampleData {
    /** Anchor coordinate ("you are here"). */
    val center = UserCoordinate(40.7484, -73.9857, 50.0)

    fun entities(scenario: ExploreScenario): List<ExploreEntity> =
        when (scenario) {
            ExploreScenario.Empty -> emptyEntities()
            else -> populatedEntities()
        }

    fun filters(scenario: ExploreScenario): ExploreFilterCriteria =
        when (scenario) {
            ExploreScenario.Empty ->
                ExploreFilterCriteria(
                    kinds = emptySet(),
                    distanceUpper = 0.5f,
                    verifiedOnly = true,
                    openNow = true,
                )
            else ->
                ExploreFilterCriteria(
                    kinds = emptySet(),
                    distanceUpper = 1f,
                    verifiedOnly = true,
                    openNow = true,
                )
        }

    // MARK: Populated

    private fun populatedEntities(): List<ExploreEntity> {
        val hero =
            listOf(
                entity(
                    "t1",
                    ExploreKind.Task,
                    ExploreEntityState.Confirmed,
                    0.0010,
                    0.0009,
                    "Hang 3 floating shelves",
                    "$60",
                    0.2,
                    badge("4 bids", ExploreBadgeTone.Bids),
                ),
                entity(
                    "i1",
                    ExploreKind.Item,
                    ExploreEntityState.Confirmed,
                    -0.0006,
                    0.0030,
                    "Mid-century walnut sideboard",
                    "$420",
                    0.4,
                    badge("New", ExploreBadgeTone.New),
                ),
                entity(
                    "p1",
                    ExploreKind.Post,
                    ExploreEntityState.Confirmed,
                    0.0024,
                    -0.0008,
                    "Anyone know a good cardiologist nearby?",
                    "Asked 2h ago",
                    0.3,
                    badge("8 replies", ExploreBadgeTone.Replies),
                ),
                entity(
                    "s1",
                    ExploreKind.Spot,
                    ExploreEntityState.Confirmed,
                    0.0038,
                    0.0020,
                    "Sunrise Bakery — fresh pastries",
                    "Open",
                    0.5,
                    badge("4.8★", ExploreBadgeTone.Rating),
                ),
                entity(
                    "t2",
                    ExploreKind.Task,
                    ExploreEntityState.Pending,
                    -0.0030,
                    -0.0024,
                    "Mount a 55\" TV on drywall",
                    "$80",
                    0.6,
                    badge("2 bids", ExploreBadgeTone.Bids),
                ),
                entity(
                    "i2",
                    ExploreKind.Item,
                    ExploreEntityState.Confirmed,
                    0.0044,
                    -0.0030,
                    "Road bike, barely used",
                    "$250",
                    0.7,
                    badge("New", ExploreBadgeTone.New),
                ),
                entity(
                    "p2",
                    ExploreKind.Post,
                    ExploreEntityState.Confirmed,
                    -0.0040,
                    0.0012,
                    "Lost gray cat near Oak St",
                    "Asked 5h ago",
                    0.4,
                    badge("3 replies", ExploreBadgeTone.Replies),
                ),
                entity(
                    "s2",
                    ExploreKind.Spot,
                    ExploreEntityState.Confirmed,
                    0.0008,
                    0.0042,
                    "Verde Coffee — espresso bar",
                    "Open",
                    0.2,
                    badge("4.6★", ExploreBadgeTone.Rating),
                ),
                entity(
                    "t3",
                    ExploreKind.Task,
                    ExploreEntityState.Confirmed,
                    -0.0014,
                    0.0048,
                    "Assemble flat-pack wardrobe",
                    "$45",
                    0.8,
                    badge("1 bid", ExploreBadgeTone.Bids),
                ),
                entity(
                    "i3",
                    ExploreKind.Item,
                    ExploreEntityState.Pending,
                    0.0052,
                    0.0006,
                    "Toddler stroller, like new",
                    "$90",
                    0.5,
                    badge("New", ExploreBadgeTone.New),
                ),
                entity(
                    "p3",
                    ExploreKind.Post,
                    ExploreEntityState.Confirmed,
                    -0.0050,
                    -0.0040,
                    "Recommendations for a plumber?",
                    "Asked 1d ago",
                    0.9,
                    badge("12 replies", ExploreBadgeTone.Replies),
                ),
                entity(
                    "s3",
                    ExploreKind.Spot,
                    ExploreEntityState.Confirmed,
                    0.0030,
                    0.0054,
                    "Hudson Hardware — tools & paint",
                    "Open",
                    0.6,
                    badge("4.7★", ExploreBadgeTone.Rating),
                ),
            )
        // Dense cluster of 12 + tighter cluster of 4 (items) + scattered remainder → 47 total.
        return hero +
            filler("ca", 12, -0.0065, 0.0060, 0.0006, 0) +
            filler("cb", 4, 0.0050, 0.0090, 0.0004, 12, ExploreKind.Item) +
            filler("sc", 19, 0.0, 0.0, 0.0085, 16)
    }

    // MARK: Empty

    private fun emptyEntities(): List<ExploreEntity> =
        listOf(
            // Close, but excluded by verified/open.
            entity(
                "e1",
                ExploreKind.Task,
                ExploreEntityState.Confirmed,
                0.0008,
                0.0006,
                "Fix a leaky kitchen faucet",
                "$50",
                0.2,
                badge("2 bids", ExploreBadgeTone.Bids),
                verified = false,
                openNow = true,
            ),
            entity(
                "e2",
                ExploreKind.Spot,
                ExploreEntityState.Confirmed,
                -0.0010,
                0.0009,
                "Late Night Diner",
                "Closed",
                0.3,
                badge("4.2★", ExploreBadgeTone.Rating),
                verified = true,
                openNow = false,
            ),
            entity(
                "e3",
                ExploreKind.Item,
                ExploreEntityState.Pending,
                0.0004,
                -0.0007,
                "Bookshelf, solid oak",
                "$120",
                0.1,
                badge("New", ExploreBadgeTone.New),
                verified = false,
                openNow = true,
            ),
            // Verified + open, but beyond the 0.5 mi radius (revealed by Widen area).
            entity(
                "e4",
                ExploreKind.Post,
                ExploreEntityState.Confirmed,
                0.0090,
                0.0070,
                "Block party this weekend — who's in?",
                "Asked 3h ago",
                0.8,
                badge("9 replies", ExploreBadgeTone.Replies),
                verified = true,
                openNow = true,
            ),
            entity(
                "e5",
                ExploreKind.Task,
                ExploreEntityState.Confirmed,
                -0.0150,
                0.0120,
                "Deep clean a 2-bed apartment",
                "$140",
                1.4,
                badge("5 bids", ExploreBadgeTone.Bids),
                verified = true,
                openNow = true,
            ),
            entity(
                "e6",
                ExploreKind.Spot,
                ExploreEntityState.Confirmed,
                0.0180,
                -0.0140,
                "Greenmarket — open Saturdays",
                "Open",
                1.8,
                badge("4.9★", ExploreBadgeTone.Rating),
                verified = true,
                openNow = true,
            ),
        )

    // MARK: Builders

    private fun badge(
        text: String,
        tone: ExploreBadgeTone,
    ) = ExploreBadge(text, tone)

    @Suppress("LongParameterList")
    private fun entity(
        id: String,
        kind: ExploreKind,
        state: ExploreEntityState,
        dLat: Double,
        dLon: Double,
        title: String,
        metaLead: String,
        distanceMiles: Double,
        badge: ExploreBadge?,
        verified: Boolean = true,
        openNow: Boolean = true,
    ) = ExploreEntity(
        id = id,
        kind = kind,
        state = state,
        latitude = center.latitude + dLat,
        longitude = center.longitude + dLon,
        title = title,
        metaLead = metaLead,
        distanceLabel = distanceLabel(distanceMiles),
        distanceMiles = distanceMiles,
        badge = badge,
        verified = verified,
        openNow = openNow,
    )

    @Suppress("LongParameterList")
    private fun filler(
        prefix: String,
        count: Int,
        latBase: Double,
        lonBase: Double,
        spread: Double,
        startIndex: Int,
        kindBias: ExploreKind? = null,
    ): List<ExploreEntity> {
        val kinds = ExploreKind.entries
        val titles =
            mapOf(
                ExploreKind.Task to "Help wanted nearby",
                ExploreKind.Item to "For sale nearby",
                ExploreKind.Post to "Neighbor asked a question",
                ExploreKind.Spot to "Local spot",
                ExploreKind.Home to "Neighborhood home",
            )
        val metas =
            mapOf(
                ExploreKind.Task to "$35",
                ExploreKind.Item to "$30",
                ExploreKind.Post to "Asked today",
                ExploreKind.Spot to "Open",
                ExploreKind.Home to "Home",
            )
        val tones =
            mapOf(
                ExploreKind.Task to ExploreBadgeTone.Bids,
                ExploreKind.Item to ExploreBadgeTone.New,
                ExploreKind.Post to ExploreBadgeTone.Replies,
                ExploreKind.Spot to ExploreBadgeTone.Rating,
                ExploreKind.Home to ExploreBadgeTone.New,
            )
        val badgeText =
            mapOf(
                ExploreKind.Task to "1 bid",
                ExploreKind.Item to "New",
                ExploreKind.Post to "2 replies",
                ExploreKind.Spot to "4.5★",
                ExploreKind.Home to "Home",
            )
        return (0 until count).map { i ->
            val global = startIndex + i
            val kind = kindBias ?: kinds[global % kinds.size]
            val angle = ((global * 53) % 360) * Math.PI / 180
            val radius = spread * (0.35 + ((global * 17) % 65) / 100.0)
            val dLat = latBase + cos(angle) * radius
            val dLon = lonBase + sin(angle) * radius
            val miles = minOf(0.95, maxOf(0.1, hypot(dLat, dLon) * 69))
            entity(
                "$prefix$global",
                kind,
                if (global % 5 == 0) ExploreEntityState.Pending else ExploreEntityState.Confirmed,
                dLat,
                dLon,
                titles[kind] ?: "Nearby",
                metas[kind] ?: "",
                miles,
                ExploreBadge(badgeText[kind] ?: "New", tones[kind] ?: ExploreBadgeTone.New),
            )
        }
    }

    private fun distanceLabel(miles: Double): String =
        when {
            miles < 0.1 -> "< 0.1 mi"
            miles < 10 -> String.format(Locale.US, "%.1f mi", miles)
            else -> "${miles.toInt()} mi"
        }
}
