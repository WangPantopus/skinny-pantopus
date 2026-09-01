package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.PlaceFloodNfipData
import app.pantopus.android.data.api.models.place.PlaceHeatColdData
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.PlaceTier
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceDensityCard
import app.pantopus.android.ui.screens.place.components.PlaceIconTile
import app.pantopus.android.ui.screens.place.components.PlaceLockedCard
import app.pantopus.android.ui.screens.place.components.PlaceTileTone
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/** NWS HeatRisk runs 0-4; 3 is where it turns from caution to danger. */
private const val PEAK_LEVEL_SEVERE = 3

/** The outlook is a one-week strip. */
private const val OUTLOOK_DAYS = 7

/** yyyy-MM-dd. */
private const val ISO_DATE_PARTS = 3

// ─── Risk & readiness (C5) ───────────────────────────────────

@Composable
fun PlaceRiskDetailContent(
    intel: PlaceIntelligence,
    viewModel: PlaceDetailViewModel,
) {
    // Heat & cold leads: it is the only thing here with a forecast horizon
    // short enough to act on today. Everything below it is a standing fact.
    intel.section(PlaceSectionId.HEAT_COLD)?.let { env ->
        PlaceDetailSectionLabel("Heat & cold")
        val data = env.heatCold
        if (data != null && env.isLive()) {
            HeatColdCard(data)
            PlaceSourceNote(env.source.orEmpty(), "7-day forecast")
        } else {
            PlaceDetailFallbackCard(env)
        }
    }

    PlaceDetailSectionLabel("Flood & hazards")
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(PlaceSectionId.FLOOD, PlaceSectionId.SEISMIC, PlaceSectionId.WILDFIRE).forEach { id ->
            intel.section(id)?.let { RiskCard(it) }
        }
    }
    intel.section(PlaceSectionId.FLOOD)?.let { PlaceSourceNote("FEMA · USGS · USFS", PlacePresentation.fmtMonthYear(it.asOf)) }

    val health =
        listOf(PlaceSectionId.LEAD_RADON, PlaceSectionId.DRINKING_WATER, PlaceSectionId.ENVIRONMENTAL_HAZARDS).mapNotNull {
            intel.section(it)
        }
    if (health.isNotEmpty()) {
        PlaceDetailSectionLabel("Health & environment")
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { health.forEach { HealthCard(it) } }
        PlaceSourceNote("EPA radon zones · SDWIS · ECHO")
    }

    PlaceDetailSectionLabel("Emergency plan")
    EmergencyChecklist()
    PlaceSourceNote("Ready.gov · American Red Cross")

    PlaceDetailSectionLabel("Fridge card")
    if (intel.tier == PlaceTier.T4) {
        LaunchedEffect(Unit) { viewModel.loadFridgeCards() }
        PlaceFridgeCardSection(viewModel)
    } else {
        PlaceLockedCard(
            title = "The 911-ready household card",
            reason =
                "Verify your address to issue a fridge card — its headline is the verified " +
                    "address a caller reads to 911.",
            cta = "Verify address",
            icon = PantopusIcon.HeartPulse,
            onTap = null,
        )
    }
}

/**
 * Heat & cold — the 7-day NWS HeatRisk strip plus the verdict.
 *
 * Level colours are the published HeatRisk ramp: a data-viz scale with no
 * token equivalent, the same treatment the EPA AQI bands get. Outside
 * CONUS the strip is replaced by a coverage note — `heat_covered=false`
 * is a GAP, not a reading of zero, and must never imply calm.
 */
private val HEAT_RISK_COLORS =
    listOf(
        Color(0xFFC6E4B4),
        Color(0xFFFFEA61),
        Color(0xFFFFA33F),
        Color(0xFFE8442E),
        Color(0xFF8A2BE2),
    )

@Composable
private fun HeatColdCard(data: PlaceHeatColdData) {
    val tone =
        when {
            data.mode == "none" -> PantopusColors.appTextSecondary
            data.mode == "cold" || (data.peakLevel ?: 0) >= PEAK_LEVEL_SEVERE -> PantopusColors.error
            else -> PantopusColors.warning
        }
    PlaceDetailCard {
        Text(data.headline, fontSize = 15.5.sp, fontWeight = FontWeight.SemiBold, color = tone)
        if (data.guidance.isNotEmpty()) {
            Text(data.guidance, fontSize = 13.5.sp, color = PantopusColors.appTextStrong)
        }
        Spacer(modifier = Modifier.height(10.dp))
        if (data.heatCovered && data.heatDays.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                data.heatDays.take(OUTLOOK_DAYS).forEachIndexed { i, day ->
                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text(
                            if (i == 0) "Today" else weekdayLabel(day.date),
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appTextSecondary,
                        )
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .height(if (i == 0) 34.dp else 22.dp)
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(HEAT_RISK_COLORS.getOrElse(day.level) { HEAT_RISK_COLORS[0] }),
                        )
                        Text("${day.level}", fontSize = 11.sp, color = PantopusColors.appTextMuted)
                    }
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                "NWS HeatRisk, 0 (little to none) to 4 (extreme). Experimental product.",
                fontSize = 11.5.sp,
                color = PantopusColors.appTextMuted,
            )
        } else {
            Text(
                "NWS HeatRisk covers the contiguous US. The freeze forecast above still applies here.",
                fontSize = 12.5.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

/** "Mon" from an ISO date, without pulling in a formatter dependency. */
private fun weekdayLabel(date: String): String {
    val parts = date.split("-")
    if (parts.size != ISO_DATE_PARTS) return ""
    return runCatching {
        java.time.LocalDate
            .of(parts[0].toInt(), parts[1].toInt(), parts[2].toInt())
            .dayOfWeek
            .getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.US)
    }.getOrDefault("")
}

@Composable
private fun RiskCard(env: PlaceSectionEnvelope) {
    val cfg = PlacePresentation.config(env.sectionId)
    if (!env.isLive()) {
        PlaceDetailFallbackCard(env)
        return
    }
    val reading = PlacePresentation.reading(env)
    val summary =
        when (env.sectionId) {
            PlaceSectionId.FLOOD -> env.flood?.plainMeaning
            PlaceSectionId.SEISMIC -> env.seismic?.summary
            PlaceSectionId.WILDFIRE -> env.wildfire?.summary
            else -> null
        }
    val disclaimer =
        when (env.sectionId) {
            PlaceSectionId.SEISMIC -> env.seismic?.disclaimer
            PlaceSectionId.WILDFIRE -> env.wildfire?.disclaimer
            else -> null
        }
    PlaceDetailCard(padding = 16.dp) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
                PlaceIconTile(cfg.icon, PlaceTileTone.HOME, 32.dp)
                Text(
                    cfg.title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                reading.chip?.let { PlaceChip(it) }
            }
            summary?.let { Text(it, fontSize = 13.5.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary) }
            disclaimer?.let { Text(it, fontSize = 12.sp, color = PantopusColors.appTextMuted) }
            env.flood?.nfip?.let { NfipBlock(it) }
        }
    }
}

/**
 * Wave 2 — what flood policies in this tract actually cost. Absent
 * while the benchmark warms or sits below the 10-policy floor, so the
 * card degrades to zone-only. A benchmark, never a quote.
 */
@Composable
private fun NfipBlock(nfip: PlaceFloodNfipData) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        Text(
            "WHAT FLOOD POLICIES NEAR YOU COST",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextMuted,
        )
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "${PlacePresentation.money(nfip.premiumP25) ?: ""}–${PlacePresentation.money(nfip.premiumP75) ?: ""}",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                "/yr · median ${PlacePresentation.money(nfip.premiumMedian) ?: ""}",
                fontSize = 12.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        val sampled = if (nfip.coverage == "partial") " (sampled)" else ""
        Text(
            "Real NFIP premiums for the ${nfip.policyCount} policies written in your census tract over the " +
                "last ${nfip.windowMonths} months$sampled. A benchmark, not a quote — premiums vary house to house.",
            fontSize = 12.sp,
            lineHeight = 16.sp,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun HealthCard(env: PlaceSectionEnvelope) {
    val cfg = PlacePresentation.config(env.sectionId)
    if (!env.isLive()) {
        PlaceDetailFallbackCard(env)
        return
    }
    val summary =
        when (env.sectionId) {
            PlaceSectionId.LEAD_RADON -> env.leadRadon?.summary
            PlaceSectionId.DRINKING_WATER -> env.drinkingWater?.summary
            PlaceSectionId.ENVIRONMENTAL_HAZARDS -> env.environmentalHazards?.summary
            else -> null
        }
    val disclaimer =
        when (env.sectionId) {
            PlaceSectionId.LEAD_RADON -> env.leadRadon?.disclaimer
            PlaceSectionId.ENVIRONMENTAL_HAZARDS -> env.environmentalHazards?.disclaimer
            else -> null
        }
    PlaceDetailCard(padding = 16.dp) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
                PlaceIconTile(cfg.icon, PlaceTileTone.HOME, 32.dp)
                Text(cfg.title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            }
            summary?.let { Text(it, fontSize = 13.5.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary) }
            env.environmentalHazards?.facilities?.take(4)?.takeIf { it.isNotEmpty() }?.let { facilities ->
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    facilities.forEach { f ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                f.name,
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Medium,
                                color = PantopusColors.appTextStrong,
                                modifier = Modifier.weight(1f),
                            )
                            Text("%.1f mi".format(f.distanceMi), fontSize = 12.sp, color = PantopusColors.appTextMuted)
                        }
                    }
                }
            }
            disclaimer?.let { Text(it, fontSize = 12.sp, color = PantopusColors.appTextMuted) }
        }
    }
}

private data class ChecklistGroup(val title: String, val items: List<String>)

private val EMERGENCY_GROUPS =
    listOf(
        ChecklistGroup(
            "Go-bag essentials",
            listOf(
                "Water (1 gal/person/day)",
                "Three days of food",
                "Flashlight + batteries",
                "First-aid kit",
                "Medications",
                "Phone charger / power bank",
            ),
        ),
        ChecklistGroup("Key contacts", listOf("Out-of-area contact", "Local emergency numbers", "Utility shut-off info")),
        ChecklistGroup("Meeting point", listOf("Neighborhood spot", "Out-of-town spot", "Reunification plan")),
    )

@Composable
private fun EmergencyChecklist() {
    var checked by remember { mutableStateOf(setOf<String>()) }
    val total = EMERGENCY_GROUPS.sumOf { it.items.size }
    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Your household plan",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                Text("${checked.size} of $total ready", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.home)
            }
            androidx.compose.foundation.layout.BoxWithConstraints(modifier = Modifier.fillMaxWidth().height(6.dp)) {
                Box(modifier = Modifier.fillMaxWidth().height(6.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken))
                Box(
                    modifier =
                        Modifier.width(
                            maxWidth * (if (total == 0) 0f else checked.size.toFloat() / total),
                        ).height(6.dp).clip(CircleShape).background(PantopusColors.home),
                )
            }
            EMERGENCY_GROUPS.forEach { group ->
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        group.title.uppercase(),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.6.sp,
                        color = PantopusColors.appTextMuted,
                    )
                    group.items.forEach { item ->
                        Row(
                            modifier =
                                Modifier.fillMaxWidth().clickable {
                                    checked = if (item in checked) checked - item else checked + item
                                },
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                modifier =
                                    Modifier.size(
                                        22.dp,
                                    ).clip(
                                        CircleShape,
                                    ).background(
                                        if (item in checked) PantopusColors.home else PantopusColors.appSurface,
                                    ).border(2.dp, if (item in checked) PantopusColors.home else PantopusColors.appBorder, CircleShape),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (item in checked) {
                                    app.pantopus.android.ui.theme.PantopusIconImage(
                                        PantopusIcon.Check,
                                        null,
                                        size = 13.dp,
                                        strokeWidth = 3f,
                                        tint = PantopusColors.appSurface,
                                    )
                                }
                            }
                            Text(item, fontSize = 14.sp, color = PantopusColors.appText)
                        }
                    }
                }
            }
        }
    }
}

// ─── Your block (C6) ─────────────────────────────────────────

@Composable
fun PlaceBlockDetailContent(
    intel: PlaceIntelligence,
    viewModel: PlaceDetailViewModel,
) {
    intel.section(PlaceSectionId.BLOCK_DENSITY)?.let { env ->
        PlaceDetailSectionLabel("Verified homes nearby")
        val data = env.blockDensity
        if (data != null) {
            PlaceDensityCard(
                bucket = data.bucket,
                label = data.label,
                ctaTitle = "Be one of the first to verify on your block",
                onTap = null,
            )
        } else {
            PlaceDetailFallbackCard(env)
        }
        PlaceSourceNote("Pantopus verified neighbors")
    }
    // The growth surface sits right under the density bucket: the
    // k-anon bucket is what everyone sees, the founding rank and the
    // unlock meters are what a proven resident of this cell sees.
    PlaceDetailSectionLabel("Block founders")
    PlaceBlockFoundersSection(intel, viewModel)
    intel.section(PlaceSectionId.CENSUS_CONTEXT)?.let { env ->
        PlaceDetailSectionLabel("Neighborhood")
        val data = env.censusContext
        if (data != null && env.isLive()) {
            PlaceDetailCard {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        CensusStat("Median year built", data.medianYearBuilt?.toString() ?: "—", Modifier.weight(1f))
                        CensusStat("Median home value", PlacePresentation.money(data.medianHomeValue) ?: "—", Modifier.weight(1f))
                    }
                    if (data.summary.isNotEmpty()) {
                        Text(
                            data.summary,
                            fontSize = 13.5.sp,
                            lineHeight = 18.sp,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
            }
        } else {
            PlaceDetailFallbackCard(env)
        }
        PlaceSourceNote("U.S. Census · American Community Survey", PlacePresentation.fmtMonthYear(env.asOf))
    }
    PlaceDetailSectionLabel("Recent permits nearby")
    PlaceDetailCard(padding = 16.dp) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
                PlaceIconTile(PantopusIcon.HardHat, PlaceTileTone.MUTED, 32.dp)
                Text("Permits", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
            }
            Text(
                "Not available for your area yet.",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                "Building permits come from each city's portal — we're expanding coverage metro by metro.",
                fontSize = 12.5.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun CensusStat(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Text(value, fontSize = 19.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
    }
}
