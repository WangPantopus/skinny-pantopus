package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceDensityCard
import app.pantopus.android.ui.screens.place.components.PlaceIconTile
import app.pantopus.android.ui.screens.place.components.PlaceTileTone
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

// ─── Risk & readiness (C5) ───────────────────────────────────

@Composable
fun PlaceRiskDetailContent(intel: PlaceIntelligence) {
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
        }
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
fun PlaceBlockDetailContent(intel: PlaceIntelligence) {
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
