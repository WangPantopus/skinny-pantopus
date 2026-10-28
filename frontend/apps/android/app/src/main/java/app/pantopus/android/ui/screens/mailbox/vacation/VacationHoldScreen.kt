@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.vacation

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.components.DateSpan
import app.pantopus.android.ui.components.DateSpanTone
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.FutureDatePickerDialog
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.mailbox.components.MailboxDrawing
import app.pantopus.android.ui.screens.mailbox.vacation.components.HoldStatusHero
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Toast dwell time — matches iOS `VacationHoldView`'s 1.8s banner. */
private const val TOAST_MILLIS = 1_800L

/** A longer toast (what went wrong and what to do) stays long enough to read, up to [TOAST_MAX_MILLIS]. */
private const val TOAST_MILLIS_PER_CHAR = 60L
private const val TOAST_MAX_MILLIS = 7_000L

/** 1.8 s for "Your mail hold is saved.", longer for a sentence saying what went wrong. */
private fun toastMillis(text: String): Long = (text.length * TOAST_MILLIS_PER_CHAR).coerceIn(TOAST_MILLIS, TOAST_MAX_MILLIS)

/**
 * Hold my mail (Mail tab drawings, `R11-Vacation`; A14.8's screen reskinned). While the person is away their own mail
 * waits and comes back as one bundle the morning they're back (SRV-5). Two variants:
 *
 * - scheduling — Starts / Back home date rows around the [DateSpan] strip, what happens in plain words, the dates' error
 *   right under them, and "Hold my mail, Nov 20 to Nov 29".
 *
 * - active (or set for later) — the [HoldStatusHero] with the days left, what the hold has kept so far and when it
 *   comes back, End the hold early (or Cancel the hold) after a question, and `Edit` in the top bar.
 */
@Composable
fun VacationHoldScreen(
    onBack: () -> Unit,
    viewModel: VacationHoldViewModel = hiltViewModel(),
    seed: VacationHoldSeed = VacationHoldSeed.Scheduling,
    onPickFromDate: () -> Unit = {},
    onPickToDate: () -> Unit = {},
    onEditForwarding: () -> Unit = {},
    onEditEmergency: () -> Unit = {},
) {
    val mode by viewModel.mode.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val loadError by viewModel.loadError.collectAsStateWithLifecycle()
    val mutationInFlight by viewModel.mutationInFlight.collectAsStateWithLifecycle()
    val dateError by viewModel.dateError.collectAsStateWithLifecycle()

    /**
     * A14.8 — "End hold early" is destructive (the backend marks the hold
     * `cancelled` and clears `User.vacation_mode`), so it confirms first.
     */
    var showEndHoldConfirm by remember { mutableStateOf(false) }

    /** The From / To row whose date picker is open. */
    var pickingDate by remember { mutableStateOf<VacationDateField?>(null) }

    LaunchedEffect(toast) {
        val shown = toast ?: return@LaunchedEffect
        kotlinx.coroutines.delay(toastMillis(shown))
        viewModel.consumeToast()
    }

    LaunchedEffect(Unit) {
        viewModel.load(seed)
        viewModel.configureNavigation(
            onBack = onBack,
            onEditForwarding = onEditForwarding,
            onEditEmergency = onEditEmergency,
            onPickFromDate = onPickFromDate,
            onPickToDate = onPickToDate,
        )
        val modeTag = if (mode is VacationHoldMode.Active) "active" else "scheduling"
        Analytics.track(AnalyticsEvent.ScreenVacationHoldViewed(modeTag))
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .testTag("vacationHold"),
        ) {
            TopBar(
                viewModel = viewModel,
                mode = mode,
                trailingEnabled = !isLoading && loadError == null && !mutationInFlight && viewModel.trailingActionEnabled,
            )
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(bottom = Spacing.s6),
            ) {
                HoldIntro()
                if (isLoading) {
                    Box(modifier = Modifier.fillMaxWidth().height(160.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                } else if (loadError != null) {
                    // Room under the intro, so the problem doesn't sit on its last line.
                    ErrorState(
                        headline = "Couldn't load your mail hold",
                        message = loadError.orEmpty(),
                        modifier = Modifier.padding(top = Spacing.s6),
                        onRetry = { viewModel.load() },
                    )
                } else {
                    when (val m = mode) {
                        is VacationHoldMode.Scheduling ->
                            SchedulingBody(
                                viewModel = viewModel,
                                draft = m.draft,
                                dateError = dateError,
                                saving = mutationInFlight,
                                onPickDate = { pickingDate = it },
                            )
                        is VacationHoldMode.Active ->
                            ActiveBody(
                                hold = m.hold,
                                onEndHold = { showEndHoldConfirm = true },
                            )
                    }
                }
            }
        }

        val picking = pickingDate
        val scheduling = mode as? VacationHoldMode.Scheduling
        if (picking != null && scheduling != null) {
            val draft = scheduling.draft
            val isFrom = picking == VacationDateField.From
            FutureDatePickerDialog(
                initial = if (isFrom) draft.fromDate else draft.toDate,
                earliest = if (isFrom) null else draft.fromDate,
                confirmLabel = "Done",
                onSelect = { date ->
                    if (isFrom) viewModel.setFromDate(date) else viewModel.setToDate(date)
                    pickingDate = null
                },
                onDismiss = { pickingDate = null },
            )
        }

        if (showEndHoldConfirm) {
            EndHoldDialog(
                // A hold in effect ends early; one set for later is cancelled.
                active = (mode as? VacationHoldMode.Active)?.hold?.isActive != false,
                onEnd = {
                    showEndHoldConfirm = false
                    viewModel.endHoldEarly()
                },
                onKeep = { showEndHoldConfirm = false },
            )
        }

        if (toast != null) {
            // Clear of the screen's edges, and read out by TalkBack: a failure can take two or three lines.
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s10),
            ) {
                Text(
                    text = toast.orEmpty(),
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextInverse,
                    textAlign = TextAlign.Center,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.xl))
                            .background(PantopusColors.appText.copy(alpha = 0.9f))
                            .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                            .semantics { liveRegion = LiveRegionMode.Polite }
                            .testTag("vacationHoldToast"),
                )
            }
        }
    }
}

/** Ending (or cancelling) a hold asks first, and says what happens to the mail it kept. */
@Composable
private fun EndHoldDialog(
    active: Boolean,
    onEnd: () -> Unit,
    onKeep: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onKeep,
        title = { Text(text = if (active) "End your hold now?" else "Cancel this hold?") },
        text = {
            Text(
                text =
                    if (active) {
                        "What it kept comes with the next morning's mail, and your mail comes as usual after that."
                    } else {
                        "Your mail keeps coming every morning as usual."
                    },
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
            )
        },
        confirmButton = {
            TextButton(onClick = onEnd, modifier = Modifier.testTag("vacationHoldEndConfirm")) {
                Text(text = if (active) "End the hold" else "Cancel the hold", color = PantopusColors.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onKeep, modifier = Modifier.testTag("vacationHoldKeep")) {
                Text(text = if (active) "Keep holding" else "Keep it", color = PantopusColors.appTextSecondary)
            }
        },
    )
}

// MARK: - Top bar

@Composable
private fun TopBar(
    viewModel: VacationHoldViewModel,
    mode: VacationHoldMode,
    trailingEnabled: Boolean,
) {
    val trailingLabel = if (mode is VacationHoldMode.Active) "Edit" else "Save"
    val trailingColor: Color =
        when (mode) {
            is VacationHoldMode.Scheduling ->
                if (trailingEnabled) PantopusColors.primary600 else PantopusColors.appTextMuted
            is VacationHoldMode.Active -> PantopusColors.appTextSecondary
        }

    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(44.dp)
                .background(PantopusColors.appSurface),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "Hold my mail",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.testTag("vacationHoldTitle"),
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clickable { viewModel.tapBack() }
                        .testTag("vacationHoldBack"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 22.dp,
                    tint = PantopusColors.appText,
                )
            }
            if (mode is VacationHoldMode.Active) {
                Box(
                    modifier =
                        Modifier
                            .heightIn(min = 48.dp)
                            .padding(horizontal = 8.dp)
                            .clickable(enabled = trailingEnabled) { viewModel.tapTrailingAction() }
                            .testTag("vacationHoldTrailingAction"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = trailingLabel,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = trailingColor,
                    )
                }
            }
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorderSubtle),
        )
    }
}

// MARK: - Scheduling body

/** The date row a picker is open for. */
private enum class VacationDateField { From, To }

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun SchedulingBody(
    viewModel: VacationHoldViewModel,
    draft: VacationScheduleDraft,
    dateError: String?,
    saving: Boolean,
    onPickDate: (VacationDateField) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        VacationOverline("When")
        VacationCard {
            VacationDateRow(
                label = "Starts",
                sub = "The first day your mail waits",
                value = formatWeekdayShort(draft.fromDate),
                onTap = {
                    viewModel.tapFromDate()
                    onPickDate(VacationDateField.From)
                },
                tag = "vacationHoldFromDate",
            )
            VacationHairline()
            VacationDateRow(
                label = "Back home",
                sub = "Your held mail comes that morning",
                value = formatWeekdayShort(draft.toDate),
                onTap = {
                    viewModel.tapToDate()
                    onPickDate(VacationDateField.To)
                },
                tag = "vacationHoldToDate",
            )
            VacationHairline()
            Box(
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s4)
                        .padding(top = Spacing.s2, bottom = 14.dp),
            ) {
                DateSpan(
                    days = draft.spanDays,
                    fromWeekday = formatWeekdayLabel(draft.fromDate),
                    toWeekday = formatWeekdayLabel(draft.toDate),
                    tone = DateSpanTone.Info,
                )
            }
        }

        // The dates' problem, right under them, until they change. With large text the button can sit a screen
        // below the dates, so the problem scrolls into view, and TalkBack reads it.
        if (dateError != null) {
            val errorInView = remember { BringIntoViewRequester() }
            LaunchedEffect(dateError) { errorInView.bringIntoView() }
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s4)
                        .padding(top = Spacing.s3)
                        .bringIntoViewRequester(errorInView)
                        .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite }
                        .testTag("vacationHoldDateError"),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(icon = PantopusIcon.AlertCircle, contentDescription = null, size = 16.dp, tint = PantopusColors.error)
                Text(text = dateError, fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.Medium, color = PantopusColors.error)
            }
        }

        Text(
            text = "Your held mail arrives the morning of ${formatWeekdayShort(draft.toDate)}, as one bundle with that day's mail.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.appTextStrong,
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).padding(top = Spacing.s3),
        )
        VacationCardHelper("Special deliveries still come right away, and Home mail keeps coming for your household.")

        PrimaryButton(
            title = "Hold my mail, ${formatMonthDay(draft.fromDate)} to ${formatMonthDay(draft.toDate)}",
            onClick = viewModel::tapTrailingAction,
            isLoading = saving,
            isEnabled = !saving,
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).padding(top = Spacing.s5).testTag("vacationHoldSave"),
        )

        VacationMonoFooter(draft.footerBlurb)
    }
}

/** What a hold does, in a line under the title, beside the mailbox with its HOLD tag (`R11-Vacation`). */
@Composable
private fun HoldIntro() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).padding(top = Spacing.s4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(modifier = Modifier.size(72.dp).clearAndSetSemantics {}) {
            MailboxDrawing(modifier = Modifier.size(72.dp))
            // Part of the drawing, so it keeps the drawing's size at any text size (the words beside it say it all).
            Text(
                text = "HOLD",
                fontSize = with(LocalDensity.current) { 9.dp.toSp() },
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.mailManilaInk,
                modifier =
                    Modifier
                        .align(Alignment.Center)
                        .rotate(-6f)
                        .background(PantopusColors.mailManila, RoundedCornerShape(3.dp))
                        .border(1.dp, PantopusColors.mailManilaEdge, RoundedCornerShape(3.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
            )
        }
        Text(
            text =
                "Deliveries pause while you're away. Everything that comes waits for you and arrives as one bundle the " +
                    "morning you're back.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
    }
}

// MARK: - Active body

@Composable
private fun ActiveBody(
    hold: VacationActiveHold,
    onEndHold: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s3)
                    .padding(top = 14.dp),
        ) {
            HoldStatusHero(
                daysLeft = hold.daysLeft,
                untilLabel = hold.untilLabel,
                stats = emptyList(),
                statusLabel = hold.statusLabel,
                daysLabel = "days until you're back",
            )
        }

        // Where it stands: on hold now (and what it has kept), or set for later.
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s3)
                    .padding(top = Spacing.s3)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(if (hold.isActive) PantopusColors.warningBg else PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .padding(horizontal = Spacing.s4, vertical = 14.dp)
                    .semantics(mergeDescendants = true) {}
                    .testTag("vacationHoldStatus"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = if (hold.isActive) "Your mail is on hold" else "Your mail hold starts ${hold.startsLabel ?: hold.activeSinceLabel}",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(text = hold.resumeBlurb, fontSize = 14.sp, lineHeight = 20.sp, color = PantopusColors.appTextStrong)
            if (hold.isActive) {
                Text(
                    text =
                        when (hold.heldCount) {
                            0 -> "Nothing held yet."
                            1 -> "1 piece held so far."
                            else -> "${hold.heldCount} pieces held so far."
                        },
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.testTag("vacationHoldHeld"),
                )
            }
        }

        VacationCardHelper("Special deliveries still come right away, and Home mail keeps coming for your household.")
        Spacer(modifier = Modifier.height(Spacing.s3))

        VacationCard {
            VacationDestructiveRow(
                label = if (hold.isActive) "End the hold early" else "Cancel the hold",
                sub =
                    if (hold.isActive) {
                        "What it kept comes with the next morning's mail"
                    } else {
                        "Your mail keeps coming every morning as usual"
                    },
                onTap = onEndHold,
                tag = "vacationHoldEndEarly",
            )
        }

        VacationMonoFooter(hold.activeSinceLabel)
    }
}

// MARK: - Layout primitives

@Composable
private fun VacationOverline(text: String) {
    Text(
        text = text.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.9.sp,
        color = PantopusColors.appTextSecondary,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(top = 18.dp, bottom = Spacing.s2),
    )
}

@Composable
private fun VacationCard(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        content()
    }
}

@Composable
private fun VacationCardHelper(text: String) {
    Text(
        text = text,
        fontSize = 11.5.sp,
        lineHeight = 16.sp,
        color = PantopusColors.appTextSecondary,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s2),
    )
}

@Composable
private fun VacationMonoFooter(text: String) {
    Text(
        text = text,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        fontFamily = FontFamily.Monospace,
        color = PantopusColors.appTextMuted,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s6, bottom = Spacing.s2),
    )
}

/** A14.8 — destructive card row ("End hold early") at the bottom of the active body. */
@Composable
private fun VacationDestructiveRow(
    label: String,
    sub: String,
    onTap: () -> Unit,
    tag: String,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onTap() }
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag(tag),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = label,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.error,
        )
        Text(
            text = sub,
            fontSize = 11.5.sp,
            lineHeight = 16.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun VacationHairline() {
    Row(modifier = Modifier.fillMaxWidth()) {
        Spacer(modifier = Modifier.width(Spacing.s4))
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .height(1.dp)
                    .background(PantopusColors.appBorder.copy(alpha = 0.6f)),
        )
    }
}

@Composable
private fun VacationDateRow(
    label: String,
    sub: String,
    value: String,
    onTap: () -> Unit,
    tag: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onTap() }
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = label,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
            )
            Text(
                text = sub,
                fontSize = 11.5.sp,
                lineHeight = 16.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = value,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appText,
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun VacationToggleRow(
    label: String,
    sub: String,
    isOn: Boolean,
    isLocked: Boolean,
    onChange: (Boolean) -> Unit,
    tag: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = label,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
            )
            Text(
                text = sub,
                fontSize = 11.5.sp,
                lineHeight = 16.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (isLocked) {
            LockedChip(modifier = Modifier.testTag("$tag.locked"))
        } else {
            Switch(
                checked = isOn,
                onCheckedChange = onChange,
                colors =
                    SwitchDefaults.colors(
                        checkedTrackColor = PantopusColors.primary600,
                        checkedThumbColor = Color.White,
                    ),
                modifier = Modifier.testTag("$tag.toggle"),
            )
        }
    }
}

@Composable
private fun LockedChip(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s2, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Lock,
            contentDescription = null,
            size = 10.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "ALWAYS ON",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun VacationChevronIconRow(
    icon: PantopusIcon,
    tint: Color,
    background: Color,
    title: String,
    sub: String,
    onTap: () -> Unit,
    tag: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onTap() }
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(background),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 16.dp,
                tint = tint,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
            )
            Text(
                text = sub,
                fontSize = 11.5.sp,
                lineHeight = 16.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun VacationChevronAvatarRow(
    initials: String,
    title: String,
    sub: String,
    onTap: () -> Unit,
    tag: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onTap() }
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials.take(2).uppercase(),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextStrong,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
            )
            Text(
                text = sub,
                fontSize = 11.5.sp,
                lineHeight = 16.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

// MARK: - Formatting helpers

/** "Nov 20" — the Hold my mail button's dates. */
private fun formatMonthDay(date: LocalDate): String = date.format(DateTimeFormatter.ofPattern("MMM d", Locale.US))

/** "Tue, May 28" — date-row value. */
private fun formatWeekdayShort(date: LocalDate): String {
    val formatter = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
    return date.format(formatter)
}

/** "Tue · May 28" — DateSpan caption beneath the dashed strip. */
private fun formatWeekdayLabel(date: LocalDate): String {
    val day = DateTimeFormatter.ofPattern("EEE", Locale.US).format(date)
    val md = DateTimeFormatter.ofPattern("MMM d", Locale.US).format(date)
    return "$day · $md"
}

// MARK: - Previews

@Preview(showBackground = true, widthDp = 390, heightDp = 1200, name = "A14.8 · scheduling")
@Composable
private fun VacationHoldSchedulingPreview() {
    VacationHoldScreen(
        onBack = {},
        viewModel = VacationHoldViewModel(VacationHoldSeed.Scheduling),
        seed = VacationHoldSeed.Scheduling,
    )
}

@Preview(showBackground = true, widthDp = 390, heightDp = 1200, name = "A14.8 · active")
@Composable
private fun VacationHoldActivePreview() {
    VacationHoldScreen(
        onBack = {},
        viewModel = VacationHoldViewModel(VacationHoldSeed.Active),
        seed = VacationHoldSeed.Active,
    )
}
