package app.pantopus.android.ui.screens.place

import androidx.compose.ui.graphics.Color
import app.pantopus.android.data.api.models.place.AirQualityCategory
import app.pantopus.android.data.api.models.place.BenchmarkComparison
import app.pantopus.android.data.api.models.place.FloodRiskLevel
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.PlaceSectionStatus
import app.pantopus.android.data.api.models.place.SeismicDesignCategory
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.components.PlaceHeroVariant
import app.pantopus.android.ui.screens.place.components.PlaceSectionCardState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Place dashboard — contract → presentation. A faithful port of the web
 * `frontend/apps/web/src/components/place/presentation.tsx` and the iOS
 * `PlacePresentation.swift`: maps PlaceIntelligence section envelopes
 * onto the Phase-2 archetype cards, and derives the "Today's Pulse" hero
 * from the Today sections. Pure + data-driven. Keep all three in lockstep.
 */

data class PlaceSectionDisplayConfig(
    val icon: PantopusIcon,
    val title: String,
    val inline: Boolean = false,
    val sparkline: Boolean = false,
)

/** One section's derived reading (value / chip / caption / status dot). */
data class PlaceSectionReading(
    val value: String? = null,
    val chip: PlaceChipModel? = null,
    val caption: String? = null,
    val statusDot: Color? = null,
)

data class PlaceDerivedPulse(
    val variant: PlaceHeroVariant,
    val title: String,
    val chip: PlaceChipModel,
    val heroIcon: PantopusIcon,
    val nudgeIcon: PantopusIcon,
    val nudgeText: String?,
)

data class PlaceVerifyLockedItem(
    val icon: PantopusIcon,
    val title: String,
    val reason: String,
)

object PlacePresentation {
    // ── formatting helpers ─────────────────────────────────────

    fun money(n: Double?): String? {
        if (n == null || n.isNaN() || n.isInfinite()) return null
        return "$" + "%,d".format(Math.round(n))
    }

    fun grouped(n: Int): String = "%,d".format(n)

    // Instants arrive either as UTC ("…Z") or with an offset ("…-07:00");
    // OffsetDateTime handles both (and fractional seconds), Instant only "Z".
    private fun parseInstant(iso: String?): Instant? =
        iso?.let {
            runCatching { java.time.OffsetDateTime.parse(it).toInstant() }.getOrNull()
                ?: runCatching { Instant.parse(it) }.getOrNull()
        }

    /** "9:12 AM" — the freshness clock. */
    fun fmtTime(iso: String?): String? {
        val instant = parseInstant(iso) ?: return null
        return DateTimeFormatter
            .ofPattern("h:mm a", Locale.US)
            .withZone(ZoneId.systemDefault())
            .format(instant)
    }

    /** "May 2026" — the property as-of stamp. */
    fun fmtMonthYear(iso: String?): String? {
        val instant = parseInstant(iso) ?: return null
        return DateTimeFormatter
            .ofPattern("MMM yyyy", Locale.US)
            .withZone(ZoneId.systemDefault())
            .format(instant)
    }

    /**
     * "6:42a" — the compact sun clock. Sunrise/sunset arrive as LOCAL
     * wall-clock with no zone or seconds ("2026-06-12T05:19"), so parse
     * them as a LocalDateTime and read the hour/minute directly (no zone
     * conversion); fall back to an instant for safety.
     */
    fun fmtSunClock(iso: String): String {
        val t =
            runCatching { java.time.LocalDateTime.parse(iso) }.getOrNull()
                ?: parseInstant(iso)?.atZone(ZoneId.systemDefault())?.toLocalDateTime()
                ?: return ""
        var h = t.hour
        val m = "%02d".format(t.minute)
        val suffix = if (h >= 12) "p" else "a"
        h %= 12
        if (h == 0) h = 12
        return "$h:$m$suffix"
    }

    // ── tone maps ──────────────────────────────────────────────

    private fun aqiDot(category: AirQualityCategory): Color =
        when (category) {
            AirQualityCategory.GOOD -> PantopusColors.home
            AirQualityCategory.MODERATE, AirQualityCategory.UNHEALTHY_SENSITIVE -> PantopusColors.warning
            AirQualityCategory.UNHEALTHY, AirQualityCategory.VERY_UNHEALTHY, AirQualityCategory.HAZARDOUS ->
                PantopusColors.error
            AirQualityCategory.UNKNOWN -> PantopusColors.appTextMuted
        }

    private fun floodChip(
        level: FloodRiskLevel,
        zoneLabel: String,
    ): PlaceChipModel =
        when (level) {
            FloodRiskLevel.MINIMAL -> PlaceChipModel(PlaceChipTone.SUCCESS, "Minimal risk")
            FloodRiskLevel.MODERATE -> PlaceChipModel(PlaceChipTone.WARNING, "Moderate risk")
            FloodRiskLevel.HIGH -> PlaceChipModel(PlaceChipTone.ERROR, "High risk")
            FloodRiskLevel.UNKNOWN -> PlaceChipModel(PlaceChipTone.NEUTRAL, zoneLabel)
        }

    // ── per-section display config (icon/title/layout) ─────────

    fun config(id: PlaceSectionId): PlaceSectionDisplayConfig =
        when (id) {
            PlaceSectionId.WEATHER -> PlaceSectionDisplayConfig(PantopusIcon.CloudSun, "Weather", inline = true)
            PlaceSectionId.AIR_QUALITY -> PlaceSectionDisplayConfig(PantopusIcon.Wind, "Air quality", inline = true)
            PlaceSectionId.ALERTS -> PlaceSectionDisplayConfig(PantopusIcon.Bell, "Alerts", inline = true)
            PlaceSectionId.SUNRISE_SUNSET ->
                PlaceSectionDisplayConfig(PantopusIcon.Sunrise, "Sunrise & sunset", inline = true)
            PlaceSectionId.YOUR_HOME -> PlaceSectionDisplayConfig(PantopusIcon.Home, "Your home", sparkline = true)
            PlaceSectionId.FLOOD -> PlaceSectionDisplayConfig(PantopusIcon.Waves, "Flood", inline = true)
            PlaceSectionId.SEISMIC -> PlaceSectionDisplayConfig(PantopusIcon.Activity, "Earthquake", inline = true)
            PlaceSectionId.WILDFIRE -> PlaceSectionDisplayConfig(PantopusIcon.Flame, "Wildfire", inline = true)
            PlaceSectionId.LEAD_RADON -> PlaceSectionDisplayConfig(PantopusIcon.TestTube, "Lead & radon")
            PlaceSectionId.DRINKING_WATER -> PlaceSectionDisplayConfig(PantopusIcon.Droplets, "Water")
            PlaceSectionId.ENVIRONMENTAL_HAZARDS -> PlaceSectionDisplayConfig(PantopusIcon.Factory, "Environment")
            PlaceSectionId.BLOCK_DENSITY -> PlaceSectionDisplayConfig(PantopusIcon.Users, "Verified homes nearby")
            PlaceSectionId.CENSUS_CONTEXT -> PlaceSectionDisplayConfig(PantopusIcon.Home, "Homes here")
            PlaceSectionId.BILL_BENCHMARK -> PlaceSectionDisplayConfig(PantopusIcon.Zap, "Bill benchmark")
            PlaceSectionId.INCENTIVES -> PlaceSectionDisplayConfig(PantopusIcon.BadgePercent, "Incentives")
            PlaceSectionId.RENT_BAND -> PlaceSectionDisplayConfig(PantopusIcon.Building2, "Rent band")
            PlaceSectionId.CIVIC_DISTRICTS -> PlaceSectionDisplayConfig(PantopusIcon.Landmark, "Your districts")
            PlaceSectionId.CIVIC_ELECTION ->
                PlaceSectionDisplayConfig(PantopusIcon.Vote, "Next election", inline = true)
            PlaceSectionId.UNKNOWN -> PlaceSectionDisplayConfig(PantopusIcon.MapPin, "Place")
        }

    /** Freshness stamp (only weather + your_home + census show one). */
    fun asOf(env: PlaceSectionEnvelope): String? =
        when (env.sectionId) {
            PlaceSectionId.WEATHER -> fmtTime(env.asOf)
            PlaceSectionId.YOUR_HOME, PlaceSectionId.CENSUS_CONTEXT -> fmtMonthYear(env.asOf)
            else -> null
        }

    // ── the reading: build value/chip/caption/dot from typed data ─

    @Suppress("CyclomaticComplexMethod", "LongMethod")
    fun reading(env: PlaceSectionEnvelope): PlaceSectionReading =
        when (env.sectionId) {
            PlaceSectionId.WEATHER -> {
                val d = env.weather ?: return PlaceSectionReading()
                val label = if (d.conditionLabel.isEmpty()) "" else ", ${d.conditionLabel.lowercase()}"
                PlaceSectionReading(value = "${Math.round(d.currentTempF)}°$label")
            }
            PlaceSectionId.AIR_QUALITY -> {
                val d = env.airQuality ?: return PlaceSectionReading()
                PlaceSectionReading(value = "${d.categoryLabel} (${d.index})", statusDot = aqiDot(d.category))
            }
            PlaceSectionId.ALERTS -> {
                val d = env.alerts ?: return PlaceSectionReading()
                val n = d.active.size
                if (n == 0) {
                    PlaceSectionReading(value = "None", statusDot = PantopusColors.home)
                } else {
                    PlaceSectionReading(value = "$n active", statusDot = PantopusColors.error)
                }
            }
            PlaceSectionId.SUNRISE_SUNSET -> {
                val d = env.sunriseSunset ?: return PlaceSectionReading()
                PlaceSectionReading(value = "${fmtSunClock(d.sunrise)} · ${fmtSunClock(d.sunset)}")
            }
            PlaceSectionId.YOUR_HOME -> {
                val d = env.yourHome ?: return PlaceSectionReading()
                val parts =
                    buildList {
                        d.yearBuilt?.let { add("Built $it") }
                        d.sqft?.let { add("${grouped(it)} sqft") }
                        money(d.estimatedValue)?.let { add("est. value $it") }
                    }
                PlaceSectionReading(value = if (parts.isEmpty()) "Property details on file" else parts.joinToString(" · "))
            }
            PlaceSectionId.FLOOD -> {
                val d = env.flood ?: return PlaceSectionReading()
                PlaceSectionReading(chip = floodChip(d.riskLevel, d.zoneLabel))
            }
            PlaceSectionId.SEISMIC -> {
                val d = env.seismic ?: return PlaceSectionReading()
                val high = d.designCategory == SeismicDesignCategory.D || d.designCategory == SeismicDesignCategory.E
                val cat = d.designCategory.name.take(1)
                PlaceSectionReading(
                    chip = PlaceChipModel(if (high) PlaceChipTone.WARNING else PlaceChipTone.SUCCESS, "Design category $cat"),
                )
            }
            PlaceSectionId.WILDFIRE -> {
                val d = env.wildfire ?: return PlaceSectionReading()
                val high = (d.hazardClass ?: 0) >= 4
                val tone =
                    when {
                        high -> PlaceChipTone.WARNING
                        d.burnable -> PlaceChipTone.SUCCESS
                        else -> PlaceChipTone.NEUTRAL
                    }
                PlaceSectionReading(chip = PlaceChipModel(tone, d.hazardLabel))
            }
            PlaceSectionId.LEAD_RADON -> {
                val d = env.leadRadon ?: return PlaceSectionReading()
                PlaceSectionReading(value = d.summary, caption = d.disclaimer)
            }
            PlaceSectionId.DRINKING_WATER -> {
                val d = env.drinkingWater ?: return PlaceSectionReading()
                PlaceSectionReading(value = d.summary)
            }
            PlaceSectionId.ENVIRONMENTAL_HAZARDS -> {
                val d = env.environmentalHazards ?: return PlaceSectionReading()
                PlaceSectionReading(value = d.summary, caption = d.disclaimer)
            }
            PlaceSectionId.BLOCK_DENSITY -> PlaceSectionReading() // handled specially as DensityCard
            PlaceSectionId.CENSUS_CONTEXT -> {
                val d = env.censusContext ?: return PlaceSectionReading()
                val value =
                    when {
                        d.summary.isNotEmpty() -> d.summary
                        d.medianYearBuilt != null -> "Median built ${d.medianYearBuilt}"
                        else -> "Area facts"
                    }
                PlaceSectionReading(value = value, caption = "Census, area-level — not your home")
            }
            PlaceSectionId.BILL_BENCHMARK -> {
                val d = env.billBenchmark ?: return PlaceSectionReading()
                val pct = Math.round(Math.abs(d.comparisonPct)).toInt()
                val chip =
                    when (d.comparison) {
                        BenchmarkComparison.HIGHER ->
                            PlaceChipModel(PlaceChipTone.WARNING, "$pct% above", PantopusIcon.TrendingUp)
                        BenchmarkComparison.LOWER ->
                            PlaceChipModel(PlaceChipTone.SUCCESS, "$pct% below", PantopusIcon.TrendingDown)
                        else -> null
                    }
                PlaceSectionReading(value = d.summary, chip = chip)
            }
            PlaceSectionId.INCENTIVES -> {
                val d = env.incentives ?: return PlaceSectionReading()
                PlaceSectionReading(value = d.summary)
            }
            PlaceSectionId.RENT_BAND -> {
                val d = env.rentBand ?: return PlaceSectionReading()
                val lo = money(d.bandLow) ?: ""
                val hi = money(d.bandHigh) ?: ""
                PlaceSectionReading(value = "${d.bedrooms}BR market band $lo–$hi")
            }
            PlaceSectionId.CIVIC_DISTRICTS -> {
                val d = env.civicDistricts ?: return PlaceSectionReading()
                val n = d.districts.size
                PlaceSectionReading(
                    value = if (n > 0) "$n voting districts on record" else "Your federal, state, and city districts",
                )
            }
            PlaceSectionId.CIVIC_ELECTION -> {
                val d = env.civicElection ?: return PlaceSectionReading()
                PlaceSectionReading(chip = PlaceChipModel(PlaceChipTone.SKY, "In ${d.daysUntil} days"))
            }
            PlaceSectionId.UNKNOWN -> PlaceSectionReading()
        }

    // ── envelope status → card state ───────────────────────────

    fun cardState(env: PlaceSectionEnvelope): PlaceSectionCardState =
        when (env.status) {
            PlaceSectionStatus.READY, PlaceSectionStatus.PARTIAL -> PlaceSectionCardState.LOADED
            PlaceSectionStatus.STALE -> PlaceSectionCardState.STALE
            PlaceSectionStatus.ERROR -> PlaceSectionCardState.ERROR
            PlaceSectionStatus.UNAVAILABLE -> PlaceSectionCardState.UNAVAILABLE
        }

    // ── lock reason / CTA, by band ─────────────────────────────

    fun lockCta(env: PlaceSectionEnvelope): String =
        when (env.band) {
            app.pantopus.android.data.api.models.place.PlaceBand.D -> "Verify address"
            app.pantopus.android.data.api.models.place.PlaceBand.B,
            app.pantopus.android.data.api.models.place.PlaceBand.C,
            -> "Claim home"
            app.pantopus.android.data.api.models.place.PlaceBand.A -> "Create account"
        }

    fun lockReason(env: PlaceSectionEnvelope): String {
        env.unavailableReason?.takeIf { it.isNotEmpty() }?.let { return it }
        return if (env.band == app.pantopus.android.data.api.models.place.PlaceBand.D) {
            "Verify your address to see this."
        } else {
            "Claim your place to see this."
        }
    }

    // ── the Band-D "Locked until you verify" group (T3 → T4) ───

    val verifyLockedItems: List<PlaceVerifyLockedItem> =
        listOf(
            PlaceVerifyLockedItem(PantopusIcon.MessageCircle, "Neighbor messaging", "Verify your address to message neighbors."),
            PlaceVerifyLockedItem(PantopusIcon.BadgeCheck, "Verified badge", "Verify your address to get your verified badge."),
            PlaceVerifyLockedItem(
                PantopusIcon.Mailbox,
                "Your mailbox",
                "Verify your address for your mailbox — packages, civic notices, and permits.",
            ),
        )

    // ── Today's Pulse derivation (the hero) ────────────────────

    private fun findSection(
        intel: PlaceIntelligence,
        id: PlaceSectionId,
    ): PlaceSectionEnvelope? = intel.groups.flatMap { it.sections }.firstOrNull { it.sectionId == id }

    private val badAqi =
        setOf(
            AirQualityCategory.UNHEALTHY_SENSITIVE,
            AirQualityCategory.UNHEALTHY,
            AirQualityCategory.VERY_UNHEALTHY,
            AirQualityCategory.HAZARDOUS,
        )

    fun derivePulse(intel: PlaceIntelligence): PlaceDerivedPulse {
        val aqi = findSection(intel, PlaceSectionId.AIR_QUALITY)
        val alerts = findSection(intel, PlaceSectionId.ALERTS)
        val bill = findSection(intel, PlaceSectionId.BILL_BENCHMARK)

        // 1) An active weather alert outranks everything.
        val active = if (alerts?.status == PlaceSectionStatus.READY) alerts.alerts?.active.orEmpty() else emptyList()
        active.firstOrNull()?.let { a ->
            return PlaceDerivedPulse(
                variant = PlaceHeroVariant.ALERT,
                title = a.headline.ifEmpty { a.event },
                chip = PlaceChipModel(PlaceChipTone.WARNING, a.event.ifEmpty { "Active alert" }, PantopusIcon.TriangleAlert),
                heroIcon = PantopusIcon.TriangleAlert,
                nudgeIcon = PantopusIcon.Clock,
                nudgeText = a.description.ifEmpty { null },
            )
        }

        // 2) Then unhealthy air.
        val aqiData = if (aqi?.status == PlaceSectionStatus.READY) aqi.airQuality else null
        if (aqiData != null && badAqi.contains(aqiData.category)) {
            return PlaceDerivedPulse(
                variant = PlaceHeroVariant.ALERT,
                title = "Air quality is ${aqiData.categoryLabel.lowercase()} right now (${aqiData.index}).",
                chip = PlaceChipModel(PlaceChipTone.WARNING, "Air quality", PantopusIcon.Wind),
                heroIcon = PantopusIcon.Wind,
                nudgeIcon = PantopusIcon.Clock,
                nudgeText = aqiData.healthMessage.ifEmpty { null },
            )
        }

        // 3) All clear — assert only what we actually know.
        val airGood =
            aqiData != null &&
                (aqiData.category == AirQualityCategory.GOOD || aqiData.category == AirQualityCategory.MODERATE)
        val alertsKnownClear = alerts?.status == PlaceSectionStatus.READY && (alerts.alerts?.active?.isEmpty() ?: true)
        val clauses =
            buildList {
                if (airGood) add("air is good")
                if (alertsKnownClear) add("there are no active alerts")
            }
        val tail =
            if (clauses.isEmpty()) {
                ""
            } else {
                val joined = clauses.joinToString(" and ")
                " " + joined.replaceFirstChar { it.uppercase() } + "."
            }
        val title = "All clear on your block today.$tail"

        val billData = if (bill?.status == PlaceSectionStatus.READY) bill.billBenchmark else null
        val nudge =
            if (billData != null && billData.comparison == BenchmarkComparison.HIGHER) {
                "${billData.summary}. Worth a look."
            } else {
                null
            }

        return PlaceDerivedPulse(
            variant = PlaceHeroVariant.ALL_CLEAR,
            title = title,
            chip = PlaceChipModel(PlaceChipTone.SUCCESS, "All clear", PantopusIcon.Check),
            heroIcon = PantopusIcon.ShieldCheck,
            nudgeIcon = PantopusIcon.Lightbulb,
            nudgeText = nudge,
        )
    }
}
