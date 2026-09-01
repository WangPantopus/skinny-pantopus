package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.place.PlaceRealRentData
import app.pantopus.android.data.api.models.place.PlaceSectionAccess
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionStatus
import app.pantopus.android.data.api.models.place.RealRentScope
import app.pantopus.android.data.api.models.place.RealRentStanding
import app.pantopus.android.data.api.models.place.RealRentState
import app.pantopus.android.data.api.models.place.RentReport
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.components.PlaceLockedCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Spacing

// ─── Real Rent Benchmark (Wave 3) — Money signals, band D ────
//
// NOT the rent band above it. `rent_band` is HUD's Fair Market Rent, a
// government estimate for an entire COUNTY. This is what VERIFIED
// NEIGHBORS ON THIS BLOCK actually pay, and the only reason it is worth
// anything is that the reporters proved they live there — which no
// listings site can claim. The copy here must never blur the two.
//
// Four states, per the contract: locked (not verified here yet),
// building (verified, block under the k>=10 floor — a real statement of
// progress, never an error or a bare "no data"), ready, and the
// unavailable/error fallback. Parity: the iOS section of the same name.

private val METER_HEIGHT = 6.dp
private val TRACK_HEIGHT = 8.dp
private val TRACK_ROW_HEIGHT = 14.dp
private val MARKER_SIZE = 14.dp
private val MARKER_OFFSET = 7.dp
private val MARKER_BORDER = 2.dp

/** The band's own lower/upper edge as a fraction of the drawn track. */
private const val BAND_START_FRACTION = 0.2f
private const val BAND_WIDTH_FRACTION = 0.6f
private const val MARKER_MIN = 0.04f
private const val MARKER_MAX = 0.96f

@Composable
fun PlaceRealRentSection(
    env: PlaceSectionEnvelope,
    viewModel: PlaceDetailViewModel,
) {
    if (env.access == PlaceSectionAccess.LOCKED) {
        PlaceLockedCard(
            title = "What your block actually pays",
            reason =
                env.unavailableReason?.takeIf { it.isNotEmpty() }
                    ?: "Verify your address to see what your block actually pays.",
            cta = "Verify address",
            icon = PantopusIcon.Users,
            onTap = null,
        )
        return
    }
    val data = env.realRent
    // No payload at all. `error` means the read failed and a retry is a
    // real remedy — so the fallback card's "Try again" is WIRED, not a
    // decoration. `unavailable` means the home has no coordinates, so
    // there is no block to pool into and nothing to retry.
    //
    // Neither state gets a composer underneath: offering a form over an
    // error the viewer cannot see past (or one the route would reject
    // with NO_COORDINATES) just looks broken. Web and iOS show none.
    if (data == null || env.status == PlaceSectionStatus.UNAVAILABLE || env.status == PlaceSectionStatus.ERROR) {
        PlaceDetailFallbackCard(
            env,
            onRetry = if (env.status == PlaceSectionStatus.ERROR) viewModel::refresh else null,
        )
        return
    }
    LaunchedEffect(Unit) { viewModel.loadRentReport() }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        // `building` AND any state this build has never heard of:
        // progress, never a benchmark, so an unknown vocabulary value
        // can never imply amounts the payload did not send. Parity: the
        // iOS section routes UNKNOWN the same way.
        if (data.state == RealRentState.READY) RealRentReadyCard(data) else RealRentBuildingCard(data)
        RealRentContribution(viewModel)
    }
}

/**
 * The building state is the PRODUCT, not an empty state: a true
 * statement about this block's progress toward its own benchmark, and
 * the thing that makes the Block Founders invite CTA mean something.
 */
@Composable
private fun RealRentBuildingCard(data: PlaceRealRentData) {
    val fraction =
        if (data.needed <= 0) 0f else (data.reports.toFloat() / data.needed.toFloat()).coerceIn(0f, 1f)
    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "What your block actually pays",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                PlaceChip(PlaceChipModel(PlaceChipTone.SKY, "${data.reports} of ${data.needed}"))
            }
            BoxWithConstraints(modifier = Modifier.fillMaxWidth().height(METER_HEIGHT)) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(METER_HEIGHT)
                            .clip(CircleShape)
                            .background(PantopusColors.appSurfaceSunken),
                )
                Box(
                    modifier =
                        Modifier
                            .width(maxWidth * fraction)
                            .height(METER_HEIGHT)
                            .clip(CircleShape)
                            .background(PantopusColors.primary600),
                )
            }
            Text(data.summary, fontSize = 13.5.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary)
            Text(
                "These are real rents from neighbors who proved they live on this block — not a " +
                    "county-wide estimate like the fair-market band above. Add yours below, and invite a " +
                    "neighbor by mail from Your block.",
                fontSize = 12.sp,
                lineHeight = 16.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun RealRentReadyCard(data: PlaceRealRentData) {
    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "${money(data.rentMedian)} / mo",
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                    )
                    Text(
                        "Median on your block",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appTextMuted,
                    )
                }
                standingChip(data.standing)?.let { PlaceChip(it) }
            }
            RealRentQuartileRow(data)
            RealRentBandTrack(data)
            Text(
                "The shaded band is the middle half — a quarter of your block pays less than the lower " +
                    "quarter, a quarter pays more than the upper one.",
                fontSize = 11.5.sp,
                lineHeight = 15.sp,
                color = PantopusColors.appTextMuted,
            )
            Text(data.summary, fontSize = 13.5.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary)
            Text(scopeNote(data), fontSize = 12.sp, lineHeight = 16.sp, color = PantopusColors.appTextMuted)
        }
    }
}

/**
 * All three quartiles, each LABELLED. The card leads with the median
 * because the server's own sentence does ("a median of $X/mo"); the row
 * beneath names the band's edges so the reader never has to guess which
 * figure is which. Previously only p25 and p75 were printed, under a
 * single "Middle half", and the median — the hero — was never labelled.
 */
internal fun realRentQuartiles(data: PlaceRealRentData): List<Pair<String, String>> =
    listOf(
        "Lower quarter" to money(data.rentP25),
        "Median" to money(data.rentMedian),
        "Upper quarter" to money(data.rentP75),
    )

@Composable
private fun RealRentQuartileRow(data: PlaceRealRentData) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        realRentQuartiles(data).forEach { (label, amount) ->
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    label.uppercase(),
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextMuted,
                )
                Text(
                    amount,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
            }
        }
    }
}

/**
 * The quartile track. The viewer's own figure is a marker on the band,
 * never a number set beside a neighbor's — the whole point of the k
 * floor is that no single household can be read off this.
 */
@Composable
private fun RealRentBandTrack(data: PlaceRealRentData) {
    BoxWithConstraints(modifier = Modifier.fillMaxWidth().height(TRACK_ROW_HEIGHT)) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(TRACK_HEIGHT)
                    .align(Alignment.CenterStart)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceSunken),
        )
        Box(
            modifier =
                Modifier
                    .offset(x = maxWidth * BAND_START_FRACTION)
                    .width(maxWidth * BAND_WIDTH_FRACTION)
                    .height(TRACK_HEIGHT)
                    .align(Alignment.CenterStart)
                    .clip(CircleShape)
                    .background(PantopusColors.homeBg),
        )
        markerFraction(data)?.let { pos ->
            Box(
                modifier =
                    Modifier
                        .offset(x = maxWidth * pos - MARKER_OFFSET)
                        .size(MARKER_SIZE)
                        .align(Alignment.CenterStart)
                        .clip(CircleShape)
                        .background(PantopusColors.primary600)
                        .border(MARKER_BORDER, PantopusColors.appSurface, CircleShape),
            )
        }
    }
}

/** Where the viewer's own rent sits on the drawn band, or null. */
private fun markerFraction(data: PlaceRealRentData): Float? {
    val own = data.yourRent ?: return null
    val low = data.rentP25 ?: return null
    val high = data.rentP75 ?: return null
    val span = (high - low).coerceAtLeast(1)
    val within = (own - low).toFloat() / span.toFloat()
    val mapped = BAND_START_FRACTION + within * BAND_WIDTH_FRACTION
    return mapped.coerceIn(MARKER_MIN, MARKER_MAX)
}

/**
 * The viewer is a renter comparing their own rent to their block, so
 * paying BELOW the band is the good news and ABOVE is the actionable
 * signal — hence success / neutral / warning. The wording is fixed
 * across all three clients: "Below the band" / "In the band" / "Above
 * the band".
 */
internal fun standingChip(standing: RealRentStanding?): PlaceChipModel? =
    when (standing) {
        RealRentStanding.BELOW_BAND -> PlaceChipModel(PlaceChipTone.SUCCESS, "Below the band")
        RealRentStanding.IN_BAND -> PlaceChipModel(PlaceChipTone.NEUTRAL, "In the band")
        RealRentStanding.ABOVE_BAND -> PlaceChipModel(PlaceChipTone.WARNING, "Above the band")
        else -> null
    }

/**
 * Bedroom scope is stated, never implied: a studio must never be
 * quietly priced against a four-bedroom.
 */
private fun scopeNote(data: PlaceRealRentData): String {
    val size = data.sampleSize ?: data.reports
    // ALL_SIZES is a claim the server makes explicitly. A null or
    // unrecognized scope is the absence of that claim, so the copy drops
    // the size clause rather than asserting a pooling the payload never
    // described.
    val scope =
        when {
            data.scope == RealRentScope.BEDROOMS && data.bedrooms == 0 -> "studios"
            data.scope == RealRentScope.BEDROOMS && data.bedrooms != null -> "${data.bedrooms}-bedroom homes"
            data.scope == RealRentScope.ALL_SIZES -> "homes of all sizes"
            else -> null
        }
    val builtFrom =
        if (scope == null) {
            "Built from $size verified homes on your block — the middle half of what they pay. "
        } else {
            "Built from $size verified $scope on your block — the middle half of what they pay. "
        }
    return builtFrom +
        "Quartiles and a sample size only; no household is ever shown."
}

private fun money(dollars: Int?): String = dollars?.let { PlacePresentation.money(it.toDouble()) } ?: "—"

// ── The viewer's own contribution ────────────────────────────

@Composable
private fun RealRentContribution(viewModel: PlaceDetailViewModel) {
    val state by viewModel.rentReport.collectAsStateWithLifecycle()
    when (val current = state) {
        is RealRentUiState.Loading -> Unit
        is RealRentUiState.Error ->
            PlaceDetailCard(padding = Spacing.s4) {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Text(current.message, fontSize = 13.5.sp, color = PantopusColors.appTextMuted)
                    Text(
                        "Try again",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.primary600,
                        modifier = Modifier.clickable { viewModel.loadRentReport() },
                    )
                }
            }
        is RealRentUiState.None ->
            RealRentForm(viewModel = viewModel, title = "Add your rent", cta = "Add my rent")
        is RealRentUiState.Loaded -> RealRentOwnCard(current.report, viewModel)
    }
}

/**
 * The composer — first contribution and correction alike.
 *
 * Bedrooms is a field on BOTH. An update that omits the bedroom count
 * makes the server fall back to the Home row, and a null row there
 * yields 0 — STUDIO — so a resident fixing a typo used to be silently
 * moved out of their 2-bedroom cohort, compared against a different
 * band, and counted into the wrong same-size sample for every neighbor.
 * The edit variant is SEEDED from the loaded report. Parity: web passes
 * the loaded bedrooms explicitly, iOS repopulates the field from it.
 */
@Composable
private fun RealRentForm(
    viewModel: PlaceDetailViewModel,
    title: String,
    cta: String,
    initialRent: String = "",
    initialBedrooms: String = "",
    onCancel: (() -> Unit)? = null,
) {
    var rent by remember(initialRent) { mutableStateOf(initialRent) }
    var bedrooms by remember(initialBedrooms) { mutableStateOf(initialBedrooms) }
    val isSaving by viewModel.isSavingRent.collectAsStateWithLifecycle()
    // A rejected save keeps this form — with the typed amount still in
    // it — and reports here. It must never collapse the section.
    val saveError by viewModel.rentSaveError.collectAsStateWithLifecycle()
    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Text(title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(
                "A benchmark is only real if the people in it live here — which is exactly what your " +
                    "verified address proves. Your amount is pooled and never shown on its own.",
                fontSize = 12.5.sp,
                lineHeight = 17.sp,
                color = PantopusColors.appTextSecondary,
            )
            OutlinedTextField(
                value = rent,
                onValueChange = { rent = it },
                label = { Text("Monthly rent") },
                placeholder = { Text("2150") },
                singleLine = true,
                // Decimal, not Number: the amount is parsed as a decimal
                // and rounded to the dollar, so the keyboard must be able
                // to type the separator it honours.
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = bedrooms,
                onValueChange = { bedrooms = it },
                label = { Text("Bedrooms") },
                placeholder = { Text("2") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                "Bedrooms decide which neighbors you're compared against — a studio is never priced " +
                    "against a four-bedroom. Leave it blank to use this home's own count.",
                fontSize = 11.5.sp,
                lineHeight = 15.sp,
                color = PantopusColors.appTextMuted,
            )
            saveError?.let { Text(it, fontSize = 12.5.sp, color = PantopusColors.error) }
            PrimaryButton(
                title = if (isSaving) "Saving…" else cta,
                isLoading = isSaving,
                isEnabled = rent.isNotBlank() && !isSaving,
                onClick = { viewModel.setRentReport(rent, bedrooms) },
            )
            onCancel?.let { cancel ->
                Text(
                    "Cancel",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isSaving) PantopusColors.appTextMuted else PantopusColors.appTextSecondary,
                    modifier = Modifier.clickable(enabled = !isSaving) { cancel() },
                )
            }
            Text(
                "Only the block's quartile band and its sample size are ever published — never your " +
                    "figure, never a neighbor's, and never who pays more.",
                fontSize = 11.5.sp,
                lineHeight = 15.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun RealRentOwnCard(
    report: RentReport,
    viewModel: PlaceDetailViewModel,
) {
    val isEditing by viewModel.isEditingRent.collectAsStateWithLifecycle()
    if (isEditing) {
        RealRentForm(
            viewModel = viewModel,
            title = "Update your rent",
            cta = "Save",
            initialRent = report.monthlyRent.toString(),
            initialBedrooms = report.bedrooms?.toString().orEmpty(),
            onCancel = viewModel::cancelEditingRent,
        )
    } else {
        RealRentSavedCard(report, viewModel)
    }
}

/**
 * "$2,400 / mo · 2BR" — the saved contribution read back as MONEY. It
 * used to render as a bare "2400" dropped into a permanently-editable
 * text field, which read as an unsaved draft. Parity: web's read-only
 * "$2,400 /mo" with an explicit Edit, iOS's "$2,400 / mo · 2BR".
 */
internal fun savedRentLine(report: RentReport): String {
    val amount = money(report.monthlyRent)
    val bedrooms = report.bedrooms ?: return "$amount / mo"
    return if (bedrooms == 0) "$amount / mo · studio" else "$amount / mo · ${bedrooms}BR"
}

@Composable
private fun RealRentSavedCard(
    report: RentReport,
    viewModel: PlaceDetailViewModel,
) {
    // The delete is in flight too: without this the control stayed live
    // for the whole request, so a double-tap fired two DELETEs and
    // nothing on screen said anything was happening.
    val isSaving by viewModel.isSavingRent.collectAsStateWithLifecycle()
    val saveError by viewModel.rentSaveError.collectAsStateWithLifecycle()
    PlaceDetailCard(padding = Spacing.s4) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Your rent",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.weight(1f),
                )
                PlaceChip(PlaceChipModel(PlaceChipTone.SUCCESS, "Counted", PantopusIcon.BadgeCheck))
            }
            Text(
                savedRentLine(report),
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                "Counted toward your block's benchmark. Only you see this figure; your neighbors only " +
                    "ever see the block's quartiles.",
                fontSize = 12.5.sp,
                lineHeight = 17.sp,
                color = PantopusColors.appTextMuted,
            )
            saveError?.let { Text(it, fontSize = 12.5.sp, color = PantopusColors.error) }
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Text(
                    "Edit",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isSaving) PantopusColors.appTextMuted else PantopusColors.primary600,
                    modifier = Modifier.clickable(enabled = !isSaving) { viewModel.beginEditingRent() },
                )
                Text(
                    if (isSaving) "Removing…" else "Remove my rent",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isSaving) PantopusColors.appTextMuted else PantopusColors.error,
                    modifier = Modifier.clickable(enabled = !isSaving) { viewModel.removeRentReport() },
                )
            }
            Text(
                "Updated ${PlacePresentation.fmtMonthYear(report.updatedAt ?: report.reportedAt) ?: "just now"}. " +
                    "Removing it takes your figure back out of the block's band.",
                fontSize = 11.5.sp,
                lineHeight = 15.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}
