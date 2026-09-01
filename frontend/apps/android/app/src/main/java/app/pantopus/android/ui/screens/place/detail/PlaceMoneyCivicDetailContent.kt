package app.pantopus.android.ui.screens.place.detail

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.BenchmarkComparison
import app.pantopus.android.data.api.models.place.CivicLevel
import app.pantopus.android.data.api.models.place.PlaceBillBenchmarkData
import app.pantopus.android.data.api.models.place.PlaceCivicDistrict
import app.pantopus.android.data.api.models.place.PlaceCivicElectionData
import app.pantopus.android.data.api.models.place.PlaceCivicRepresentative
import app.pantopus.android.data.api.models.place.PlaceIncentive
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceRentBandData
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.components.PlaceIconTile
import app.pantopus.android.ui.screens.place.components.PlaceTileTone
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

// ─── Money signals (C7) ──────────────────────────────────────

@Composable
fun PlaceMoneyDetailContent(intel: PlaceIntelligence) {
    intel.section(PlaceSectionId.BILL_BENCHMARK)?.let { env ->
        PlaceDetailSectionLabel("Bill benchmark")
        val data = env.billBenchmark
        if (data != null && env.isLive()) BillBenchmarkCard(data) else PlaceDetailFallbackCard(env)
        PlaceSourceNote("Your utility · peer comparison")
    }
    intel.section(PlaceSectionId.INCENTIVES)?.let { env ->
        PlaceDetailSectionLabel("Incentives")
        val data = env.incentives
        if (data != null && data.programs.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { data.programs.forEach { IncentiveRow(it) } }
            Text(
                "Eligibility is an estimate — verify with each provider.",
                fontSize = 12.sp,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.padding(top = 8.dp),
            )
        } else {
            PlaceDetailFallbackCard(env)
        }
        PlaceSourceNote("DSIRE database")
    }
    intel.section(PlaceSectionId.RENT_BAND)?.let { env ->
        PlaceDetailSectionLabel("Rent band")
        val data = env.rentBand
        if (data != null && env.isLive()) RentBandCard(data) else PlaceDetailFallbackCard(env)
        PlaceSourceNote("HUD Fair Market Rents")
    }
    PlaceDetailSectionLabel("Property tax")
    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("How appeals work", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(
                "If your assessment is above market, that's the usual basis for an appeal. Check your county's " +
                    "deadline, gather comparable sales, and file a petition with the assessor.",
                fontSize = 13.5.sp,
                lineHeight = 18.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text("Informational only — not legal or tax advice.", fontSize = 12.sp, color = PantopusColors.warning)
        }
    }
}

@Composable
private fun BillBenchmarkCard(data: PlaceBillBenchmarkData) {
    val pct = abs(data.comparisonPct).roundToInt()
    val chip =
        when (data.comparison) {
            BenchmarkComparison.HIGHER -> PlaceChipModel(PlaceChipTone.WARNING, "$pct% above", PantopusIcon.TrendingUp)
            BenchmarkComparison.LOWER -> PlaceChipModel(PlaceChipTone.SUCCESS, "$pct% below", PantopusIcon.TrendingDown)
            else -> PlaceChipModel(PlaceChipTone.NEUTRAL, "Typical")
        }
    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (data.yourAmount != null) {
                    Text(
                        "${PlacePresentation.money(data.yourAmount)} / mo",
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    Text(
                        "Typical ${PlacePresentation.money(data.bandLow)}–${PlacePresentation.money(data.bandHigh)}",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                        modifier = Modifier.weight(1f),
                    )
                }
                PlaceChip(chip)
            }
            androidx.compose.foundation.layout.BoxWithConstraints(modifier = Modifier.fillMaxWidth().height(14.dp)) {
                Box(
                    modifier =
                        Modifier.fillMaxWidth().height(
                            8.dp,
                        ).align(Alignment.CenterStart).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
                )
                Box(
                    modifier =
                        Modifier.offset(
                            x = maxWidth * 0.3f,
                        ).width(
                            maxWidth * 0.4f,
                        ).height(8.dp).align(Alignment.CenterStart).clip(CircleShape).background(PantopusColors.homeBg),
                )
                data.yourAmount?.let { amount ->
                    val span = max(data.bandHigh - data.bandLow, 1.0)
                    val lo = data.bandLow - span * 0.75
                    val hi = data.bandHigh + span * 0.75
                    val pos = ((amount - lo) / (hi - lo)).coerceIn(0.04, 0.96)
                    Box(
                        modifier =
                            Modifier.offset(
                                x = maxWidth * pos.toFloat() - 7.dp,
                            ).size(
                                14.dp,
                            ).align(
                                Alignment.CenterStart,
                            ).clip(CircleShape).background(PantopusColors.primary600).border(2.dp, PantopusColors.appSurface, CircleShape),
                    )
                }
            }
            Row(modifier = Modifier.fillMaxWidth()) {
                Text(
                    "Lower",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.weight(1f),
                )
                Text("Typical", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
                Text(
                    "Higher",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.weight(1f),
                    textAlign = androidx.compose.ui.text.style.TextAlign.End,
                )
            }
            Text(data.summary, fontSize = 13.5.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary)
        }
    }
}

@Composable
private fun IncentiveRow(program: PlaceIncentive) {
    PlaceDetailCard(padding = 14.dp) {
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            PlaceIconTile(PantopusIcon.BadgePercent, PlaceTileTone.HOME, 32.dp)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        program.name,
                        fontSize = 14.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                        modifier = Modifier.weight(1f),
                    )
                    PlaceChip(PlaceChipModel(PlaceChipTone.SUCCESS, "You may be eligible"))
                }
                Text(program.summary, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary)
            }
        }
    }
}

@Composable
private fun RentBandCard(data: PlaceRentBandData) {
    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "${data.bedrooms}BR fair-market band",
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextMuted,
            )
            Text(
                "${PlacePresentation.money(data.bandLow)}–${PlacePresentation.money(data.bandHigh)}",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            androidx.compose.foundation.layout.BoxWithConstraints(modifier = Modifier.fillMaxWidth().height(8.dp)) {
                val span = max(data.marketHigh - data.marketLow, 1.0)
                val start = ((data.bandLow - data.marketLow) / span).toFloat()
                val w = ((data.bandHigh - data.bandLow) / span).toFloat()
                Box(modifier = Modifier.fillMaxWidth().height(8.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken))
                Box(
                    modifier =
                        Modifier.offset(
                            x = maxWidth * start,
                        ).width(maxWidth * w).height(8.dp).clip(CircleShape).background(PantopusColors.homeBg),
                )
            }
            if (data.summary.isNotEmpty()) Text(data.summary, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
        }
    }
}

// ─── Civic (C8) ──────────────────────────────────────────────

@Composable
fun PlaceCivicDetailContent(intel: PlaceIntelligence) {
    intel.section(PlaceSectionId.CIVIC_DISTRICTS)?.let { env ->
        val data = env.civicDistricts
        PlaceDetailSectionLabel("Your districts")
        if (data != null && data.districts.isNotEmpty()) {
            DistrictsCard(data.districts)
            PlaceSourceNote("District boundaries · public GIS records", "current")
            if (data.representatives.isNotEmpty()) {
                PlaceDetailSectionLabel("Your representatives")
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { data.representatives.forEach { RepRow(it) } }
                PlaceSourceNote("unitedstates/congress-legislators · OpenStates")
            }
        } else {
            PlaceDetailFallbackCard(env)
        }
    }
    intel.section(PlaceSectionId.CIVIC_ELECTION)?.let { env ->
        PlaceDetailSectionLabel("Election")
        val data = env.civicElection
        if (data != null && env.isLive()) {
            ElectionCard(data)
            PlaceSourceNote("Official county elections")
        } else {
            PlaceDetailCard {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("No upcoming election", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                    Text(
                        "We'll surface the date, your polling place, and a plain-language ballot preview when one is set.",
                        fontSize = 13.5.sp,
                        lineHeight = 18.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

@Composable
private fun DistrictsCard(districts: List<PlaceCivicDistrict>) {
    val order = listOf(CivicLevel.FEDERAL, CivicLevel.STATE, CivicLevel.COUNTY, CivicLevel.CITY, CivicLevel.SCHOOL)
    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            order.forEach { level ->
                val items = districts.filter { it.level == level }
                if (items.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            levelLabel(level).uppercase(),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.6.sp,
                            color = PantopusColors.appTextMuted,
                        )
                        items.forEach { d ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Box(modifier = Modifier.padding(top = 6.dp)) { PlaceDot(PantopusColors.home, 6.dp) }
                                Column {
                                    Text(
                                        d.officeLabel,
                                        fontSize = 12.5.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = PantopusColors.appTextMuted,
                                    )
                                    Text(d.name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RepRow(rep: PlaceCivicRepresentative) {
    val context = LocalContext.current
    PlaceDetailCard(padding = 14.dp) {
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(40.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                Text(initials(rep.name), fontSize = 14.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextSecondary)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    rep.party?.let {
                        "${rep.name} (${it.take(1)})"
                    } ?: rep.name,
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                Text(rep.office, fontSize = 12.5.sp, color = PantopusColors.appTextMuted)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                rep.phone?.let {
                    contactButton(PantopusIcon.Bell) {
                        context.startActivity(
                            Intent(
                                Intent.ACTION_DIAL,
                                Uri.parse(
                                    "tel:${it.filter {
                                            c ->
                                        c.isDigit()
                                    }}",
                                ),
                            ),
                        )
                    }
                }
                rep.email?.let {
                    contactButton(
                        PantopusIcon.Mail,
                    ) { context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$it"))) }
                }
                rep.website?.let { contactButton(PantopusIcon.MapPin) { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it))) } }
            }
        }
    }
}

@Composable
private fun contactButton(
    icon: PantopusIcon,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier.size(30.dp).clip(CircleShape).background(PantopusColors.primary100).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon, null, size = 15.dp, strokeWidth = 2f, tint = PantopusColors.primary600)
    }
}

@Composable
private fun ElectionCard(data: PlaceCivicElectionData) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PlaceDetailCard {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Column(
                    modifier =
                        Modifier.width(
                            54.dp,
                        ).clip(RoundedCornerShape(12.dp)).background(PantopusColors.homeBg).padding(vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(monthAbbrev(data.date), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PantopusColors.home)
                    Text(dayNumber(data.date), fontSize = 24.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(data.name, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                    PlaceChip(PlaceChipModel(PlaceChipTone.SKY, "${data.daysUntil} days away"))
                }
            }
        }
        data.pollingPlace?.let { polling ->
            PlaceDetailCard(padding = 14.dp) {
                Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
                    PlaceIconTile(PantopusIcon.Landmark, PlaceTileTone.HOME, 32.dp)
                    Column {
                        Text(polling.name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                        Text(polling.detail, fontSize = 12.5.sp, color = PantopusColors.appTextMuted)
                    }
                }
            }
        }
    }
}

private fun initials(name: String): String {
    val parts = name.split(" ").take(2).mapNotNull { it.firstOrNull()?.toString() }
    return if (parts.isEmpty()) "?" else parts.joinToString("").uppercase()
}

private fun levelLabel(level: CivicLevel): String =
    when (level) {
        CivicLevel.FEDERAL -> "Federal"
        CivicLevel.STATE -> "State"
        CivicLevel.COUNTY -> "County"
        CivicLevel.CITY -> "City"
        CivicLevel.SCHOOL -> "School"
        CivicLevel.UNKNOWN -> "Other"
    }

private fun monthAbbrev(iso: String): String = runCatching { java.time.LocalDate.parse(iso.take(10)).month.name.take(3) }.getOrDefault("")

private fun dayNumber(iso: String): String = runCatching { java.time.LocalDate.parse(iso.take(10)).dayOfMonth.toString() }.getOrDefault("")
