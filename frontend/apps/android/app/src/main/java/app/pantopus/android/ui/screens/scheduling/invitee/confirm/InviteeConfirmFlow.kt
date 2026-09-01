@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "CyclomaticComplexMethod")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.invitee.confirm

import android.content.Intent
import android.provider.CalendarContract
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.ConflictAlternativesSheet
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.TimezoneOption
import app.pantopus.android.ui.screens.scheduling._shared.TimezonePickerSheet
import app.pantopus.android.ui.screens.scheduling._shared.defaultTimezoneOptions
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.OffsetDateTime

const val INVITEE_CONFIRM_FLOW_TAG = "inviteeConfirmFlow"

/**
 * A6 — the public invitee booking commit flow (D1 → D2 → D3). A single
 * destination hosting `details → review → (payment) → confirmed` as local steps,
 * the way A5's slot picker hands off (see [InviteeConfirmArgs]). A5 renders this
 * after slot selection; [onManage] routes to the MANAGE_BOOKING destination once
 * a `manageToken` exists.
 */
@Composable
fun InviteeConfirmFlow(
    args: InviteeConfirmArgs,
    onClose: () -> Unit,
    onManage: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: InviteeConfirmViewModel = hiltViewModel(),
) {
    LaunchedEffect(Unit) { viewModel.start(args) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pillar = pillarForOwner(args.ownerType)
    val context = LocalContext.current

    var tzOpen by remember { mutableStateOf(false) }
    var tzQuery by remember { mutableStateOf("") }
    var answersExpanded by remember { mutableStateOf(false) }
    val conflictSheetState = rememberModalBottomSheetState()
    val tzSheetState = rememberModalBottomSheetState()

    val isValid = ConfirmUtils.isIntakeValid(state.values, args.questions)
    val paidEnabled = viewModel.paidEnabled

    Column(modifier = modifier.fillMaxSize().background(PantopusColors.appBg).testTag(INVITEE_CONFIRM_FLOW_TAG)) {
        ConfirmTopBar(
            step = state.step,
            onBack = {
                when (state.step) {
                    ConfirmStep.Review -> viewModel.back()
                    else -> onClose()
                }
            },
        )

        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                state.errorMessage?.let { message ->
                    ConfirmBanner(tone = BannerTone.Error, icon = PantopusIcon.AlertCircle, title = message)
                }
                when (state.step) {
                    ConfirmStep.Details ->
                        IntakeFormBody(
                            state = state,
                            args = args,
                            pillar = pillar,
                            questions = args.questions,
                            onPatch = viewModel::updateValues,
                            onAnswer = viewModel::setAnswer,
                            onEditSlot = onClose,
                            onChangeTz = { tzOpen = true },
                            onClearPrefill = viewModel::clearPrefill,
                        )
                    ConfirmStep.Review, ConfirmStep.Payment ->
                        ReviewConfirmBody(
                            state = state,
                            args = args,
                            pillar = pillar,
                            paidEnabled = paidEnabled,
                            questions = args.questions,
                            answersExpanded = answersExpanded,
                            onToggleAnswers = { answersExpanded = !answersExpanded },
                        )
                    ConfirmStep.Confirmed ->
                        state.confirmed?.let { confirmed ->
                            ConfirmedBody(
                                confirmed = confirmed,
                                args = args,
                                pillar = pillar,
                                whenLabel = ConfirmUtils.formatSlotRange(state.slotStartUtc, state.slotEndUtc, state.tz),
                                tzLabel = ConfirmUtils.tzChipLabel(state.tz, state.slotStartUtc),
                                onAddToCalendar = { addToCalendar(context, args, state) },
                                onDownloadIcs = { addToCalendar(context, args, state) },
                                onManage = { confirmed.manageToken?.let(onManage) },
                            )
                        }
                }
            }
        }

        ConfirmFooter(
            state = state,
            pillar = pillar,
            paidEnabled = paidEnabled,
            isValid = isValid,
            ctaLabel =
                when {
                    state.holdExpired -> "Pick another time"
                    state.step == ConfirmStep.Details -> "Review booking"
                    else ->
                        ConfirmUtils.reviewCtaLabel(
                            args.eventType.priceCents,
                            args.eventType.depositCents,
                            args.eventType.currency,
                            paidEnabled,
                        )
                },
            onPrimary = { if (state.holdExpired) onClose() else viewModel.onPrimary() },
            onAddToCalendar = { addToCalendar(context, args, state) },
            onDone = onClose,
        )
    }

    state.conflict?.let { conflict ->
        ConflictAlternativesSheet(
            conflict = conflict,
            onPick = { slot -> viewModel.pickAlternative(slot.start, slot.end) },
            onPickAnotherTime = {
                viewModel.dismissConflict()
                onClose()
            },
            onDismiss = viewModel::dismissConflict,
            sheetState = conflictSheetState,
            accent = pillar.accent,
        )
    }

    if (tzOpen) {
        val options = remember { defaultTimezoneOptions() }
        val filtered = remember(tzQuery, options) { filterTimezones(options, tzQuery) }
        TimezonePickerSheet(
            options = filtered,
            selectedId = state.tz,
            query = tzQuery,
            onQueryChange = { tzQuery = it },
            onSelect = {
                viewModel.setTz(it.id)
                tzOpen = false
            },
            onDismiss = { tzOpen = false },
            sheetState = tzSheetState,
            detectedId = ConfirmUtils.deviceTimezone(),
            accent = pillar.accent,
        )
    }
}

@Composable
private fun ConfirmTopBar(
    step: ConfirmStep,
    onBack: () -> Unit,
) {
    val title =
        when (step) {
            ConfirmStep.Details -> "Your details"
            ConfirmStep.Review -> "Review & confirm"
            ConfirmStep.Payment -> "Payment"
            ConfirmStep.Confirmed -> ""
        }
    val icon = if (step == ConfirmStep.Confirmed) PantopusIcon.X else PantopusIcon.ChevronLeft
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier = Modifier.fillMaxWidth().height(46.dp).padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(34.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .clickableLabel(if (icon == PantopusIcon.X) "Close" else "Back", onBack),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = icon,
                    contentDescription = if (icon == PantopusIcon.X) "Close" else "Back",
                    size = 20.dp,
                    tint = PantopusColors.appText,
                )
            }
            Text(
                text = title,
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Box(modifier = Modifier.size(34.dp))
        }
        if (step != ConfirmStep.Confirmed) HorizontalDivider(color = PantopusColors.appBorder)
    }
}

@Composable
private fun ConfirmFooter(
    state: ConfirmFlowState,
    pillar: SchedulingPillar,
    paidEnabled: Boolean,
    isValid: Boolean,
    ctaLabel: String,
    onPrimary: () -> Unit,
    onAddToCalendar: () -> Unit,
    onDone: () -> Unit,
    onMessageHost: () -> Unit = {},
) {
    // Spec sticky dock: an elevated translucent bar with a top hairline. Compose
    // has no backdrop blur < API 31, so we approximate with a raised surface +
    // shadow that lifts the dock above the scrolling body.
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .shadow(elevation = 12.dp, clip = false)
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        HorizontalDivider(color = PantopusColors.appBorder, modifier = Modifier.padding(bottom = Spacing.s1))
        when (state.step) {
            ConfirmStep.Confirmed -> {
                val isPending = state.confirmed?.requiresApproval == true
                if (isPending) {
                    // FramePending dock: primary = 'Done' (check icon), secondary = 'Message host'
                    FilledCta(
                        label = "Done",
                        icon = PantopusIcon.Check,
                        accent = pillar.accent,
                        enabled = true,
                        onClick = onDone,
                    )
                    Box(
                        modifier = Modifier.fillMaxWidth().height(38.dp).clickableLabel("Message host", onMessageHost),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Message host",
                            style = PantopusTextStyle.small,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appTextStrong,
                        )
                    }
                } else {
                    FilledCta(
                        label = "Add to calendar",
                        icon = PantopusIcon.CalendarPlus,
                        accent = pillar.accent,
                        enabled = true,
                        onClick = onAddToCalendar,
                    )
                    Box(
                        modifier = Modifier.fillMaxWidth().height(38.dp).clickableLabel("Done", onDone),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Done",
                            style = PantopusTextStyle.small,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appTextStrong,
                        )
                    }
                }
            }
            else -> {
                if (state.submitting) {
                    // Spec frame 6 ShimmerCTA: a shimmer skeleton CTA with the in-flight label.
                    Box(
                        modifier = Modifier.fillMaxWidth().height(46.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Shimmer(width = 320.dp, height = 46.dp, cornerRadius = Radii.lg)
                        Text(
                            text = if (state.step == ConfirmStep.Details) "Submitting your booking" else "Confirming your booking",
                            style = PantopusTextStyle.caption,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                } else {
                    val enabled = !(state.step == ConfirmStep.Details && !state.holdExpired && !isValid)
                    val icon =
                        when {
                            state.holdExpired -> PantopusIcon.CalendarClock
                            state.step == ConfirmStep.Review && !paidEnabled -> PantopusIcon.Check
                            paidEnabled && state.step != ConfirmStep.Details -> PantopusIcon.Lock
                            else -> null
                        }
                    FilledCta(label = ctaLabel, icon = icon, accent = pillar.accent, enabled = enabled, onClick = onPrimary)
                }
                if (paidEnabled && state.step == ConfirmStep.Review) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                        Text(
                            text = "We'll confirm once payment clears.",
                            style = PantopusTextStyle.caption,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun FilledCta(
    label: String,
    icon: PantopusIcon?,
    accent: Color,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                // Spec PrimaryCTA height is 46 (D1–D3 docks).
                .heightIn(min = 46.dp)
                // Spec CTA carries an accent-tinted drop shadow (0 6px 16px accent/0.28).
                .then(
                    if (enabled) {
                        Modifier.shadow(
                            elevation = 10.dp,
                            shape = RoundedCornerShape(Radii.lg),
                            ambientColor = accent,
                            spotColor = accent,
                        )
                    } else {
                        Modifier
                    },
                )
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (enabled) accent else PantopusColors.appSurfaceSunken)
                .clickableLabel(label) { if (enabled) onClick() },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 16.dp,
                tint = if (enabled) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                modifier = Modifier.padding(end = Spacing.s1),
            )
        }
        Text(
            text = label,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = if (enabled) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
        )
    }
}

private fun Modifier.clickableLabel(
    label: String,
    onClick: () -> Unit,
): Modifier = this.then(Modifier.clickable(onClickLabel = label, onClick = onClick))

private fun filterTimezones(
    options: List<TimezoneOption>,
    query: String,
): List<TimezoneOption> {
    val q = query.trim()
    if (q.isEmpty()) return options
    return options.filter { it.name.contains(q, ignoreCase = true) || it.id.contains(q, ignoreCase = true) }
}

private fun addToCalendar(
    context: android.content.Context,
    args: InviteeConfirmArgs,
    state: ConfirmFlowState,
) {
    val begin = parseMillis(state.slotStartUtc) ?: return
    val end = parseMillis(state.slotEndUtc) ?: (begin + DEFAULT_DURATION_MS)
    val intent =
        Intent(Intent.ACTION_INSERT).apply {
            data = CalendarContract.Events.CONTENT_URI
            putExtra(CalendarContract.Events.TITLE, args.eventType.name ?: "Booking")
            putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, begin)
            putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end)
            putExtra(CalendarContract.Events.DESCRIPTION, "Booking with ${args.hostName}")
            args.eventType.locationDetail?.let { putExtra(CalendarContract.Events.EVENT_LOCATION, it) }
        }
    runCatching { context.startActivity(intent) }
}

private fun parseMillis(iso: String?): Long? {
    if (iso.isNullOrBlank()) return null
    return runCatching { Instant.parse(iso).toEpochMilli() }
        .recoverCatching { OffsetDateTime.parse(iso).toInstant().toEpochMilli() }
        .getOrNull()
}

private const val DEFAULT_DURATION_MS = 30L * 60 * 1000
