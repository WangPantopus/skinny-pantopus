@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "LongMethod", "TooManyFunctions", "ktlint:standard:max-line-length")

package app.pantopus.android.ui.screens.scheduling.invitee.customer

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling.invitee.edge.EdgeHalo
import app.pantopus.android.ui.screens.scheduling.invitee.edge.EdgeTone
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val RECURRING_SETUP_TAG = "schedulingRecurringSetup"

private val ACCENT get() = SchedulingPillar.Personal.accent
private val ACCENT_BG get() = SchedulingPillar.Personal.accentBg

@Composable
fun RecurringSetupScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: RecurringSetupViewModel = hiltViewModel(),
) {
    val load by viewModel.load.collectAsStateWithLifecycle()
    val config by viewModel.config.collectAsStateWithLifecycle()
    val occurrences by viewModel.occurrences.collectAsStateWithLifecycle()
    val submit by viewModel.submit.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.start() }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag(RECURRING_SETUP_TAG)) {
        TopBar(onBack = onBack)
        when (val l = load) {
            is RecurringLoadState.Loading -> SchedulingLoadingSkeleton(modifier = Modifier.weight(1f), rows = 4)
            is RecurringLoadState.Empty ->
                EmptyState(
                    icon = PantopusIcon.Calendar,
                    headline = "Create an event type first",
                    subcopy = "Recurring series book one of your event types every week. Add one to get started.",
                    modifier = Modifier.weight(1f),
                )
            is RecurringLoadState.Error ->
                ErrorState(
                    message = l.message,
                    modifier = Modifier.weight(1f),
                    onRetry = viewModel::loadEventType,
                )
            is RecurringLoadState.Loaded ->
                RecurringBody(
                    config = config,
                    occurrences = occurrences,
                    submit = submit,
                    rangeLabel = viewModel.rangeLabel(),
                    weekdayShort = viewModel.weekdayShort(),
                    timeLabel = viewModel.timeLabel(),
                    modifier = Modifier.weight(1f),
                    onRepeat = viewModel::setRepeat,
                    onWeekday = viewModel::setWeekday,
                    onStepTime = viewModel::stepTime,
                    onSetCount = viewModel::setCount,
                    onStepCount = viewModel::stepCount,
                    onReview = viewModel::review,
                    onRemoveOccurrence = viewModel::removeOccurrence,
                    onBackFromReview = viewModel::backFromReview,
                    onConfirm = viewModel::confirm,
                    onDone = onBack,
                    onRetry = viewModel::resetSubmit,
                )
        }
    }
}

@Composable
private fun TopBar(onBack: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).padding(horizontal = Spacing.s2, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(34.dp).clip(RoundedCornerShape(Radii.md)).clickable(onClickLabel = "Back", onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.ChevronLeft, contentDescription = "Back", size = 20.dp, tint = PantopusColors.appText)
        }
        Text(
            text = "Set up your series",
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center,
        )
        Box(modifier = Modifier.size(34.dp))
    }
}

@Composable
fun RecurringBody(
    config: RecurringConfig,
    occurrences: List<RecurrenceOccurrence>,
    submit: RecurringSubmitState,
    rangeLabel: String,
    weekdayShort: String,
    timeLabel: String,
    onRepeat: (RecurrenceRepeat) -> Unit,
    onWeekday: (Int) -> Unit,
    onStepTime: (Int) -> Unit,
    onSetCount: (Int) -> Unit,
    onStepCount: (Int) -> Unit,
    onReview: () -> Unit,
    onRemoveOccurrence: (RecurrenceOccurrence) -> Unit,
    onBackFromReview: () -> Unit,
    onConfirm: () -> Unit,
    onDone: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    when {
        submit is RecurringSubmitState.Result -> {
            ResultBody(result = submit, occurrences = occurrences, modifier = modifier, onDone = onDone)
            return
        }
        submit is RecurringSubmitState.Reviewing -> {
            ReviewBody(
                reviewing = submit,
                weekdayShort = weekdayShort,
                timeLabel = timeLabel,
                onRemove = onRemoveOccurrence,
                onBack = onBackFromReview,
                onConfirm = onConfirm,
                modifier = modifier,
            )
            return
        }
    }
    // ── Configure step (Frames 1, 2, 3) ──────────────────────────────────────
    val unavailableCount = occurrences.count { it.status == OccurrenceStatus.Unavailable }
    val failedCount = occurrences.count { it.status == OccurrenceStatus.Failed }
    val openCount = occurrences.count { it.status == OccurrenceStatus.Open }
    // Frame 3: partial-series path — some occurrences are fully booked (Unavailable).
    val isPartial = unavailableCount > 0

    Column(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = "Book the whole series in one go. We'll find the same time each week and flag any that's taken.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
            ConfigCard(
                config = config,
                weekdayShort = weekdayShort,
                timeLabel = timeLabel,
                onRepeat = onRepeat,
                onWeekday = onWeekday,
                onStepTime = onStepTime,
                onSetCount = onSetCount,
                onStepCount = onStepCount,
            )
            if (occurrences.isNotEmpty()) {
                // Frame 3: warn banner when some weeks are fully booked (Unavailable).
                if (isPartial) {
                    PartialSeriesBanner(openCount = openCount, totalCount = occurrences.size)
                }
                SeriesStrip(occurrences = occurrences)
                val overlineText =
                    when {
                        unavailableCount > 0 -> "$openCount OPEN · $unavailableCount FULL"
                        failedCount == 0 -> "ALL ${occurrences.size} OPEN"
                        else -> "$openCount OPEN · $failedCount NEEDS A NEW TIME"
                    }
                Text(text = overlineText, style = PantopusTextStyle.overline, color = PantopusColors.appTextSecondary)
                occurrences.forEach { OccurrenceRow(it) }
                // SummaryChip shows open-count in partial, total count otherwise.
                SummaryChip(
                    count = if (isPartial) openCount else occurrences.size,
                    weekdayShort = weekdayShort,
                    timeLabel = timeLabel,
                    rangeLabel = rangeLabel,
                )
            }
            (submit as? RecurringSubmitState.Error)?.let {
                Text(text = it.message, style = PantopusTextStyle.small, color = PantopusColors.error)
            }
        }
        Column(
            modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            when {
                submit is RecurringSubmitState.Error -> {
                    PrimaryButton(title = "Try again", onClick = onRetry)
                }
                isPartial -> {
                    // Frame 3 CTAs: "Book the N that work" (primary) + "Adjust the series" (ghost).
                    PrimaryButton(
                        title = "Book the $openCount that work",
                        onClick = onReview,
                        isEnabled = openCount > 0,
                    )
                    GhostButton(title = "Adjust the series", onClick = { /* navigates back to configure — already on configure */ })
                }
                else -> {
                    PrimaryButton(
                        title = "Review ${occurrences.size} bookings",
                        onClick = onReview,
                        isLoading = submit is RecurringSubmitState.Saving,
                        isEnabled = occurrences.isNotEmpty(),
                    )
                }
            }
        }
    }
}

@Composable
private fun ConfigCard(
    config: RecurringConfig,
    weekdayShort: String,
    timeLabel: String,
    onRepeat: (RecurrenceRepeat) -> Unit,
    onWeekday: (Int) -> Unit,
    onStepTime: (Int) -> Unit,
    onSetCount: (Int) -> Unit,
    onStepCount: (Int) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        // Design RepeatsSelect: a single-row dropdown affordance with repeat icon +
        // current value label + chevron-down. No segmented chips; no Daily option.
        // (recurring-frames.jsx lines 92-103)
        FieldLabel("Repeats")
        RepeatsDropdownRow(value = config.repeat)
        FieldLabel("On")
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1), modifier = Modifier.fillMaxWidth()) {
            listOf("S", "M", "T", "W", "T", "F", "S").forEachIndexed { i, d ->
                WeekdayChip(label = d, selected = i == config.weekdayIndex, modifier = Modifier.weight(1f)) { onWeekday(i) }
            }
        }
        FieldLabel("Time")
        Stepper(value = timeLabel, onMinus = { onStepTime(-30) }, onPlus = { onStepTime(30) })
        FieldLabel("How many")
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "${config.count} sessions",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            CountStepper(value = config.count, onMinus = { onStepCount(-1) }, onPlus = { onStepCount(1) })
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
            listOf(4, 6, 8, 12).forEach { n ->
                Segment(label = n.toString(), selected = n == config.count, modifier = Modifier.weight(1f)) { onSetCount(n) }
            }
        }
        Text(
            text = "We'll find $timeLabel each $weekdayShort and flag any that's taken.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

/**
 * Design RepeatsSelect: a single-row dropdown affordance.
 * repeat icon (accent) + "Weekly" label + chevron-down.
 * (recurring-frames.jsx lines 92-103)
 */
@Composable
private fun RepeatsDropdownRow(value: RecurrenceRepeat) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.ArrowsRepeat, contentDescription = null, size = 15.dp, tint = ACCENT)
        Text(
            text =
                when (value) {
                    RecurrenceRepeat.Weekly -> "Weekly"
                },
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(icon = PantopusIcon.ChevronDown, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(text = text, style = PantopusTextStyle.caption, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
}

@Composable
private fun Segment(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(if (selected) ACCENT else PantopusColors.appSurface)
                .border(1.dp, if (selected) ACCENT else PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s2),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = if (selected) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun WeekdayChip(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(if (selected) ACCENT else PantopusColors.appSurface)
                .border(1.dp, if (selected) ACCENT else PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s2),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = if (selected) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun Stepper(
    value: String,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
) {
    Row(
        modifier = Modifier.clip(RoundedCornerShape(Radii.md)).border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StepButton(icon = PantopusIcon.Minus, onClick = onMinus)
        Text(
            text = value,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
        StepButton(icon = PantopusIcon.Plus, onClick = onPlus)
    }
}

@Composable
private fun CountStepper(
    value: Int,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
) {
    Row(
        modifier = Modifier.clip(RoundedCornerShape(Radii.md)).border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StepButton(icon = PantopusIcon.Minus, onClick = onMinus)
        Text(
            text = value.toString(),
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
        StepButton(icon = PantopusIcon.Plus, onClick = onPlus)
    }
}

@Composable
private fun StepButton(
    icon: PantopusIcon,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier.size(34.dp).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, tint = ACCENT)
    }
}

@Composable
private fun SeriesStrip(occurrences: List<RecurrenceOccurrence>) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        occurrences.forEach { occ ->
            val failed = occ.status == OccurrenceStatus.Failed
            val unavailable = occ.status == OccurrenceStatus.Unavailable
            Box(
                modifier =
                    Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(
                            when {
                                failed || unavailable -> PantopusColors.warningBg
                                else -> ACCENT
                            },
                        ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = occ.dateLabel.substringAfterLast(' '),
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.Bold,
                    color = if (failed || unavailable) PantopusColors.warning else PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun OccurrenceRow(occ: RecurrenceOccurrence) {
    val failed = occ.status == OccurrenceStatus.Failed
    val unavailable = occ.status == OccurrenceStatus.Unavailable
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, if (failed) PantopusColors.warningLight else PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                // Design Frame 3: unavailable rows rendered at 0.6 opacity.
                .alpha(if (unavailable) 0.6f else 1f)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        // Icon tile: success green for open, warn amber for conflict, sunken for unavailable.
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(
                        when {
                            failed -> PantopusColors.warningBg
                            unavailable -> PantopusColors.appSurfaceSunken
                            else -> PantopusColors.successBg
                        },
                    ),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon =
                    when {
                        failed -> PantopusIcon.AlertCircle
                        // Design Frame 3 OccurrenceRow unavailable: calendar-x icon.
                        unavailable -> PantopusIcon.CalendarX
                        else -> PantopusIcon.CalendarCheck
                    },
                contentDescription = null,
                size = 15.dp,
                tint =
                    when {
                        failed -> PantopusColors.warning
                        unavailable -> PantopusColors.appTextMuted
                        else -> PantopusColors.success
                    },
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = occ.dateLabel,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.Bold,
                // Design: strikethrough date text for unavailable rows.
                textDecoration = if (unavailable) TextDecoration.LineThrough else TextDecoration.None,
                color = if (unavailable) PantopusColors.appTextMuted else PantopusColors.appText,
            )
            Text(
                text =
                    when {
                        failed -> "That time is taken"
                        unavailable -> "Fully booked"
                        else -> occ.timeLabel
                    },
                style = PantopusTextStyle.caption,
                color = if (failed) PantopusColors.warning else PantopusColors.appTextSecondary,
            )
        }
        when {
            failed -> {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(text = "PICK ANOTHER", style = PantopusTextStyle.overline, color = ACCENT)
                    PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 13.dp, tint = ACCENT)
                }
            }
            unavailable -> {
                // Design Frame 3: "Full" badge in a neutral sunken pill at 0.6 opacity via parent.
                Text(
                    text = "Full",
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextMuted,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.appSurfaceSunken)
                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                            .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
                )
            }
            else -> {
                Text(
                    text = "OPEN",
                    style = PantopusTextStyle.overline,
                    color = PantopusColors.success,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.successBg)
                            .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
                )
            }
        }
    }
}

@Composable
private fun SummaryChip(
    count: Int,
    weekdayShort: String,
    timeLabel: String,
    rangeLabel: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(ACCENT_BG)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.ArrowsRepeat, contentDescription = null, size = 15.dp, tint = ACCENT)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "$count sessions · $weekdayShort $timeLabel",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.Bold,
                color = ACCENT,
            )
            if (rangeLabel.isNotEmpty()) {
                Text(text = rangeLabel, style = PantopusTextStyle.overline, color = PantopusColors.appTextSecondary)
            }
        }
    }
}

/**
 * Frame 3 warn banner: "We can book N of M" (recurring-frames.jsx Banner component,
 * lines 271-281). Appears when some occurrences are Unavailable (fully booked).
 */
@Composable
private fun PartialSeriesBanner(
    openCount: Int,
    totalCount: Int,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.AlertCircle, contentDescription = null, size = 16.dp, tint = PantopusColors.warning)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "We can book $openCount of $totalCount",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.Bold,
                // Design WARN_DK (amber-800); closest available token = warmAmber (amber-700).
                color = PantopusColors.warmAmber,
            )
            Text(
                text = "The other ${totalCount - openCount} ${if (totalCount - openCount == 1) "week is" else "weeks are"} full. Book the ${if (openCount == 1) "one" else openCount.toString()} that ${if (openCount == 1) "works" else "work"}, or adjust the pattern.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.warning,
            )
        }
    }
}

/**
 * Ghost / secondary CTA button matching the design's GhostCTA shape
 * (recurring-frames.jsx lines 302-304).
 */
@Composable
private fun GhostButton(
    title: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s3),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = title,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
    }
}

/**
 * Frame 4 — Series Summary (before confirm). Shows the recap header, a card
 * listing every occurrence with a per-row remove (×) button, and a total price
 * row. Tapping "Confirm N bookings" fires the API.
 * (recurring-frames.jsx lines 382-406, FrameSummary)
 */
@Composable
private fun ReviewBody(
    reviewing: RecurringSubmitState.Reviewing,
    weekdayShort: String,
    timeLabel: String,
    onRemove: (RecurrenceOccurrence) -> Unit,
    onBack: () -> Unit,
    onConfirm: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val occs = reviewing.reviewOccurrences
    Column(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            // Recap header: 34×34 accentBg rounded-9 square + repeat icon (17dp) +
            // "N-session series" title + event-name secondary line.
            // (recurring-frames.jsx lines 385-391)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(34.dp)
                            .clip(RoundedCornerShape(9.dp))
                            .background(ACCENT_BG),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(icon = PantopusIcon.ArrowsRepeat, contentDescription = null, size = 17.dp, tint = ACCENT)
                }
                Column {
                    Text(
                        text = "${occs.size}-session series",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = "$weekdayShort $timeLabel",
                        fontSize = 11.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
            // RecapRow list inside a card.
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                        .padding(horizontal = Spacing.s3),
            ) {
                occs.forEachIndexed { index, occ ->
                    RecapRow(occ = occ, isLast = index == occs.lastIndex, onRemove = { onRemove(occ) })
                }
            }
            // Total price row — /my-bookings lean payload doesn't carry price; render
            // session count only as the designed empty/placeholder for when price lands.
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s1),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "${occs.size} ${if (occs.size == 1) "session" else "sessions"}",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
                // Price data not available from the current payload; shows session count
                // (backend join needed — acknowledged per design parity notes).
            }
        }
        Column(
            modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).padding(Spacing.s4),
        ) {
            PrimaryButton(title = "Confirm ${occs.size} bookings", onClick = onConfirm)
        }
    }
}

/**
 * One occurrence row in the Frame 4 summary card.
 * calendar-check icon + date + time + per-row remove (×) button.
 * (recurring-frames.jsx RecapRow, lines 372-381)
 */
@Composable
private fun RecapRow(
    occ: RecurrenceOccurrence,
    isLast: Boolean,
    onRemove: () -> Unit,
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CalendarCheck,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.success,
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = occ.dateLabel,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Text(
                    text = occ.timeLabel,
                    fontSize = 10.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            // Per-row remove (×) button: 26dp circle, sunken bg.
            Box(
                modifier =
                    Modifier
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurfaceSunken)
                        .clickable(onClickLabel = "Remove ${occ.dateLabel}", onClick = onRemove),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = "Remove",
                    size = 13.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
        if (!isLast) {
            HorizontalDivider(color = PantopusColors.appBorder, thickness = 1.dp)
        }
    }
}

@Composable
private fun ResultBody(
    result: RecurringSubmitState.Result,
    occurrences: List<RecurrenceOccurrence>,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val partial = result.failed.isNotEmpty()
    Column(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            EdgeHalo(
                tone = if (partial) EdgeTone.Warn else EdgeTone.Success,
                icon = if (partial) PantopusIcon.AlertCircle else PantopusIcon.CalendarCheck,
                title = if (partial) "We booked ${result.created} of ${result.requested}" else "Your series is booked",
                body =
                    if (partial) {
                        "Some weeks were full. The ones that worked are confirmed."
                    } else {
                        "All ${result.created} sessions are confirmed."
                    },
            )
            occurrences.forEach { OccurrenceRow(it) }
        }
        Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).padding(Spacing.s4)) {
            PrimaryButton(title = "Done", onClick = onDone)
        }
    }
}
