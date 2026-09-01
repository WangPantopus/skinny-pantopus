package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.PlaceHomeSystemsData
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.PlaceYourHomeData
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.components.PlaceChevron
import app.pantopus.android.ui.screens.place.components.PlaceIconTile
import app.pantopus.android.ui.screens.place.components.PlaceSparkline
import app.pantopus.android.ui.screens.place.components.PlaceTileTone
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import kotlin.math.max

/**
 * A system at the very end of its life still gets a visible sliver of
 * bar — a zero-width fill reads as "no data" rather than "out of time".
 */
private const val MIN_VISIBLE_LIFE_FRACTION = 0.02

@Composable
fun PlaceHomeDetailContent(intel: PlaceIntelligence) {
    val env = intel.section(PlaceSectionId.YOUR_HOME)
    val data = env?.yourHome

    // `your_home` is Band B and needs an ATTOM key, so it is unavailable on
    // plenty of installs. The Systems Ledger is Band C — the household's own
    // record — and must render regardless, so this no longer returns early
    // on a missing property record.
    if (env != null) {
        if (data != null && env.isLive()) {
            val asOf = PlacePresentation.fmtMonthYear(env.asOf)

            PlaceDetailSectionLabel("Property")
            FactsCard(data)
            PlaceSourceNote("County public records · estimate model", asOf)

            PlaceDetailSectionLabel("Value")
            ValueCard(data)
            data.assessedValue?.let { AssessmentCard(it) }
            PlaceSourceNote("County public records · estimate model", asOf)

            PlaceDetailSectionLabel("Equity")
            EquityCalculator(data.estimatedValue)
        } else {
            PlaceDetailSectionLabel("Your home")
            PlaceDetailFallbackCard(env)
        }
    }

    intel.section(PlaceSectionId.HOME_SYSTEMS)?.let { systemsEnv ->
        PlaceDetailSectionLabel("Systems")
        val systems = systemsEnv.homeSystems
        if (systems != null && systemsEnv.isLive()) {
            SystemsCard(systems)
            PlaceSourceNote(systemsEnv.source.orEmpty(), "typical service life")
        } else {
            PlaceDetailFallbackCard(systemsEnv)
        }
    }
}

/**
 * Systems Ledger — the record that compounds.
 *
 * Every row shows HOW its year is known, so an estimate is never dressed
 * up as a fact. The bar is measured against the HIGH bound of the typical
 * range: it is a range, not a countdown to failure.
 */
@Composable
private fun SystemsCard(data: PlaceHomeSystemsData) {
    PlaceDetailCard {
        Text(data.summary.headline, fontSize = 13.5.sp, color = PantopusColors.appTextStrong)
        Spacer(modifier = Modifier.height(10.dp))
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            data.systems.forEach { system ->
                val tone =
                    when (system.status) {
                        "past_expected" -> PantopusColors.error
                        "aging" -> PantopusColors.warning
                        "ok" -> PantopusColors.home
                        else -> PantopusColors.appTextMuted
                    }
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            system.label,
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appText,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            system.installedYear?.let { "$it · ${system.ageYears} yrs" } ?: "Year unknown",
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = tone,
                        )
                    }
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(5.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(PantopusColors.appSurfaceSunken),
                    ) {
                        val frac = (system.lifeRemaining ?: 0.0).coerceIn(MIN_VISIBLE_LIFE_FRACTION, 1.0).toFloat()
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth(frac)
                                    .height(5.dp)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(tone),
                        )
                    }
                    Text(
                        "${system.sourceLabel} · typical ${system.typicalLifeLow}\u2013${system.typicalLifeHigh} yrs",
                        fontSize = 11.5.sp,
                        color = PantopusColors.appTextMuted,
                    )
                }
            }
        }
    }
}

@Composable
private fun FactsCard(data: PlaceYourHomeData) {
    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                PlaceFactCell(PantopusIcon.Home, "Year built", data.yearBuilt?.toString() ?: "—", Modifier.weight(1f))
                PlaceFactCell(
                    PantopusIcon.Building2,
                    "Living area",
                    data.sqft?.let { "${PlacePresentation.grouped(it)} sqft" } ?: "—",
                    Modifier.weight(1f),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                PlaceFactCell(PantopusIcon.Users, "Bed / bath", bedBath(data), Modifier.weight(1f))
                PlaceFactCell(
                    PantopusIcon.MapPin,
                    "Lot size",
                    data.lotSqft?.let { "${PlacePresentation.grouped(it)} sqft" } ?: "—",
                    Modifier.weight(1f),
                )
            }
        }
    }
}

private fun bedBath(data: PlaceYourHomeData): String {
    val bd = data.bedrooms?.let { "${it}bd" }
    val ba = data.bathrooms?.let { b -> if (b == b.toLong().toDouble()) "${b.toInt()}ba" else "%.1fba".format(b) }
    val parts = listOfNotNull(bd, ba)
    return if (parts.isEmpty()) "—" else parts.joinToString(" ")
}

@Composable
private fun ValueCard(data: PlaceYourHomeData) {
    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.Bottom) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        PlacePresentation.money(data.estimatedValue) ?: "—",
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                    )
                    val lo = PlacePresentation.money(data.valueLow)
                    val hi = PlacePresentation.money(data.valueHigh)
                    if (lo != null && hi != null) {
                        Text("$lo – $hi", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
                    }
                }
                PlaceSparkline()
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                PlaceDot(PantopusColors.home, 8.dp)
                Text("Your home", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
                PlaceDot(PantopusColors.appBorder, 8.dp)
                Text("Block median", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
            }
        }
    }
}

@Composable
private fun AssessmentCard(assessed: Double) {
    PlaceDetailCard(padding = 16.dp) {
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
            PlaceIconTile(PantopusIcon.Landmark, PlaceTileTone.MUTED, 32.dp)
            Column(modifier = Modifier.weight(1f)) {
                Text("Assessed value", fontSize = 13.sp, color = PantopusColors.appTextMuted)
                Text(
                    PlacePresentation.money(assessed) ?: "—",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
            }
            Text("Tax roll", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
        }
    }
}

@Composable
private fun EquityCalculator(estimatedValue: Double?) {
    var stage by remember { mutableStateOf(0) } // 0 prompt, 1 form, 2 result
    var loan by remember { mutableStateOf("") }
    var rate by remember { mutableStateOf("") }
    val equity =
        estimatedValue?.let { v -> loan.filter { it.isDigit() || it == '.' }.toDoubleOrNull()?.let { max(v - it, 0.0) } }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when (stage) {
            0 ->
                Box(modifier = Modifier.clickable { stage = 1 }) {
                    PlaceDetailCard(padding = 16.dp) {
                        Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
                            PlaceIconTile(PantopusIcon.Zap, PlaceTileTone.SKY, 32.dp)
                            Text(
                                "Add your mortgage to see your equity",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = PantopusColors.appText,
                                modifier = Modifier.weight(1f),
                            )
                            PlaceChevron()
                        }
                    }
                }
            1 ->
                PlaceDetailCard {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("Your mortgage", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                        OutlinedTextField(
                            value = loan,
                            onValueChange = {
                                loan = it
                            },
                            label = {
                                Text("Loan balance")
                            },
                            singleLine = true,
                            keyboardOptions =
                                KeyboardOptions(
                                    keyboardType = KeyboardType.Decimal,
                                ),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        OutlinedTextField(
                            value = rate,
                            onValueChange = {
                                rate = it
                            },
                            label = {
                                Text("Interest rate (%)")
                            },
                            singleLine = true,
                            keyboardOptions =
                                KeyboardOptions(
                                    keyboardType = KeyboardType.Decimal,
                                ),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        PrimaryButton(title = "Calculate", isEnabled = equity != null, onClick = { stage = 2 })
                    }
                }
            else ->
                PlaceDetailCard {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text(
                            PlacePresentation.money(equity) ?: "—",
                            fontSize = 30.sp,
                            fontWeight = FontWeight.Bold,
                            color = PantopusColors.home,
                        )
                        Text("Estimated equity", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
                        Text(
                            "Edit",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.primary600,
                            modifier =
                                Modifier.clickable {
                                    stage = 1
                                },
                        )
                    }
                }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            PantopusIconImage(PantopusIcon.Lock, null, size = 12.dp, strokeWidth = 2f, tint = PantopusColors.appTextMuted)
            Text("Private to you — never shown to neighbors", fontSize = 12.sp, color = PantopusColors.appTextMuted)
        }
    }
}
