@file:Suppress("PackageNaming", "LongParameterList", "MagicNumber", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.scheduling.invitee.discovery

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SlotTimeList
import app.pantopus.android.ui.screens.scheduling._shared.slotTimeLabel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val SLOT_PICKER_CONTINUE_TAG = "slotPickerContinueBar"

/** Bottom-divider color for the picker's top bar (spec: bottom border only). */
private val pickerDividerColor = PantopusColors.appBorder

/**
 * C6 Date + time slot picker (stateful). Owns a [SlotPickerViewModel] scoped to
 * the public-booking route, starts it with the chosen event type's [args], and
 * presents the C7 timezone sheet locally. Selecting a slot + Continue is the
 * terminal A5 action — it raises [onContinue] with the chosen slot (UTC start +
 * tz) for A6 to confirm.
 */
@Composable
fun SlotPickerScreen(
    args: SlotPickerArgs,
    onBack: () -> Unit,
    onContinue: (SlotSelection) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SlotPickerViewModel = hiltViewModel(),
) {
    LaunchedEffect(args) { viewModel.start(args) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showTzSheet by remember { mutableStateOf(false) }

    SlotPickerContent(
        state = state,
        modifier = modifier,
        onBack = onBack,
        onSelectDay = viewModel::selectDay,
        onSelectSlot = viewModel::selectSlot,
        onPrevMonth = viewModel::showPreviousMonth,
        onNextMonth = viewModel::showNextMonth,
        onSeeNextAvailable = viewModel::seeNextAvailable,
        onTimezoneClick = { showTzSheet = true },
        onRetry = viewModel::retry,
        onContinue = {
            val slot = viewModel.selectedSlot()
            val content = state as? SlotPickerUiState.Content
            if (slot != null && content != null) {
                onContinue(
                    SlotSelection(
                        slug = args.slug,
                        oneOffToken = args.oneOffToken,
                        eventTypeSlug = args.eventTypeSlug,
                        eventTypeName = args.eventTypeName,
                        startAtUtc = slot.start,
                        startLocalLabel = slotTimeLabel(slot),
                        dayLabel = content.selectedDayHeading.orEmpty(),
                        durationMin = args.durationMin,
                        timezone = content.tzId,
                    ),
                )
            }
        },
    )

    if (showTzSheet) {
        val content = state as? SlotPickerUiState.Content
        TimezoneSelectorSheet(
            selectedId = content?.tzId ?: args.detectedTimezone,
            detectedId = args.detectedTimezone,
            accent = content?.pillar?.accent ?: PantopusColors.primary600,
            onSelect = viewModel::selectTimezone,
            onDismiss = { showTzSheet = false },
        )
    }
}

/** C6 stateless body — exhaustively switches loading / error / content. */
@Composable
fun SlotPickerContent(
    state: SlotPickerUiState,
    onBack: () -> Unit,
    onSelectDay: (Int) -> Unit,
    onSelectSlot: (SlotDto) -> Unit,
    onPrevMonth: () -> Unit,
    onNextMonth: () -> Unit,
    onSeeNextAvailable: () -> Unit,
    onTimezoneClick: () -> Unit,
    onRetry: () -> Unit,
    onContinue: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize().background(PantopusColors.appBg)) {
        PickerTopBar(onBack = onBack)
        when (state) {
            is SlotPickerUiState.Loading ->
                Column(
                    modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    DiscoverySkeletonSlots(count = 6)
                }
            is SlotPickerUiState.Error ->
                ErrorState(message = state.message, onRetry = onRetry, modifier = Modifier.fillMaxSize())
            is SlotPickerUiState.Content ->
                SlotPickerLoaded(
                    state = state,
                    onSelectDay = onSelectDay,
                    onSelectSlot = onSelectSlot,
                    onPrevMonth = onPrevMonth,
                    onNextMonth = onNextMonth,
                    onSeeNextAvailable = onSeeNextAvailable,
                    onTimezoneClick = onTimezoneClick,
                    onContinue = onContinue,
                )
        }
    }
}

@Composable
private fun SlotPickerLoaded(
    state: SlotPickerUiState.Content,
    onSelectDay: (Int) -> Unit,
    onSelectSlot: (SlotDto) -> Unit,
    onPrevMonth: () -> Unit,
    onNextMonth: () -> Unit,
    onSeeNextAvailable: () -> Unit,
    onTimezoneClick: () -> Unit,
    onContinue: () -> Unit,
) {
    val accent = state.pillar.accent
    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            SummaryHeader(state = state, onTimezoneClick = onTimezoneClick)
            MonthCalendarCard(
                monthLabel = state.monthLabel,
                daysInMonth = state.daysInMonth,
                firstWeekdayIndex = state.firstWeekdayIndex,
                availableDays = state.availableDays,
                selectedDay = state.selectedDay,
                onSelectDay = onSelectDay,
                today = state.today,
                accent = accent,
                monthHasAvailability = state.monthHasAvailability,
                canGoPrevious = state.canGoPreviousMonth,
                onPrevMonth = onPrevMonth,
                onNextMonth = onNextMonth,
                onSeeNextAvailable = onSeeNextAvailable,
            )
            SlotRegion(state = state, accent = accent, onSelectSlot = onSelectSlot, onSeeNextAvailable = onSeeNextAvailable)
            // bottom spacer so the docked Continue bar never covers the last row
            if (state.selectedSlotStart != null) Box(modifier = Modifier.size(72.dp))
            // extra spacer when a taken-toast is visible (Frame 6)
            if (state.takenSlotStart != null && state.selectedSlotStart == null) Box(modifier = Modifier.size(60.dp))
        }
        if (state.selectedSlotStart != null) {
            ContinueBar(
                dayLabel = state.selectedDayHeading.orEmpty(),
                timeLabel = state.daySlots.firstOrNull { it.start == state.selectedSlotStart }?.let(::slotTimeLabel).orEmpty(),
                accent = accent,
                onContinue = onContinue,
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
        // Frame 6: floating WARN toast when a slot was taken by a race condition.
        if (state.takenSlotStart != null && state.selectedSlotStart == null) {
            SlotTakenToast(modifier = Modifier.align(Alignment.BottomCenter).padding(horizontal = Spacing.s4).padding(bottom = Spacing.s5))
        }
    }
}

/** Summary header: event-type tile + timezone chip + optional DST hint banner (Frame 5). */
@Composable
private fun SummaryHeader(
    state: SlotPickerUiState.Content,
    onTimezoneClick: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Box(
                modifier = Modifier.size(34.dp).clip(RoundedCornerShape(Radii.md)).background(state.pillar.accentBg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = state.locationIcon, contentDescription = null, size = 16.dp, tint = state.pillar.accent)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = state.eventTypeName,
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                Text(text = state.subLabel, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
        }
        TimezoneChip(label = state.tzLabel, onClick = onTimezoneClick)
        // Frame 5 (DST hint): INFO banner when clocks change within the visible month.
        if (state.dstHint != null) {
            DstHintBanner(message = state.dstHint)
        }
    }
}

/**
 * Local calendar card matching the spec's [MonthCalendar] header: the month
 * label sits on the left and the "Next available" link + prev/next chevrons sit
 * on the right — all in a single header Row INSIDE the card. The shared
 * [MonthCalendar] keeps a label-only header, so this screen reproduces the card
 * locally rather than mutating the shared component.
 */
@Composable
private fun MonthCalendarCard(
    monthLabel: String,
    daysInMonth: Int,
    firstWeekdayIndex: Int,
    availableDays: Set<Int>,
    selectedDay: Int?,
    onSelectDay: (Int) -> Unit,
    today: Int?,
    accent: Color,
    monthHasAvailability: Boolean,
    canGoPrevious: Boolean,
    onPrevMonth: () -> Unit,
    onNextMonth: () -> Unit,
    onSeeNextAvailable: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = monthLabel,
                // Spec month label is 13.5px/700 — trim from the 14sp small token.
                style = PantopusTextStyle.small,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f).padding(start = Spacing.s1),
            )
            if (monthHasAvailability) {
                Text(
                    text = "Next available",
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.Bold,
                    color = accent,
                    modifier =
                        Modifier
                            .clickable(onClick = onSeeNextAvailable)
                            .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
                )
            }
            NavChevron(icon = PantopusIcon.ChevronLeft, label = "Previous month", enabled = canGoPrevious, onClick = onPrevMonth)
            NavChevron(icon = PantopusIcon.ChevronRight, label = "Next month", enabled = true, onClick = onNextMonth)
        }
        Row(modifier = Modifier.fillMaxWidth()) {
            WEEKDAY_INITIALS.forEach { initial ->
                Text(
                    text = initial,
                    style = PantopusTextStyle.overline,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.weight(1f),
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                )
            }
        }
        val cells =
            buildList {
                repeat(firstWeekdayIndex) { add(null) }
                for (d in 1..daysInMonth) add(d)
            }
        cells.chunked(WEEKDAY_INITIALS.size).forEach { week ->
            Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s1)) {
                week.forEach { day ->
                    Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                        if (day != null) {
                            LocalDayCell(
                                day = day,
                                available = day in availableDays,
                                isToday = day == today,
                                selected = day == selectedDay,
                                accent = accent,
                                onClick = { onSelectDay(day) },
                            )
                        }
                    }
                }
                repeat(WEEKDAY_INITIALS.size - week.size) { Box(modifier = Modifier.weight(1f)) {} }
            }
        }
    }
}

@Composable
private fun LocalDayCell(
    day: Int,
    available: Boolean,
    isToday: Boolean,
    selected: Boolean,
    accent: Color,
    onClick: () -> Unit,
) {
    val clickable = available || selected
    Box(
        modifier =
            Modifier
                .size(DAY_CELL)
                .then(if (selected) Modifier.size(DAY_DISC).clip(CircleShape).background(accent) else Modifier)
                .then(
                    if (isToday && !selected) {
                        Modifier.size(DAY_DISC).clip(CircleShape).border(1.5.dp, accent, CircleShape)
                    } else {
                        Modifier
                    },
                )
                .clickable(enabled = clickable, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = day.toString(),
                fontSize = 13.sp,
                fontWeight =
                    if (selected || isToday) {
                        FontWeight.Bold
                    } else if (available) {
                        FontWeight.SemiBold
                    } else {
                        FontWeight.Normal
                    },
                color =
                    when {
                        selected -> PantopusColors.appTextInverse
                        isToday -> accent
                        available -> PantopusColors.appText
                        else -> PantopusColors.appTextMuted
                    },
            )
            if (available && !selected) {
                Box(modifier = Modifier.size(4.dp).clip(CircleShape).background(accent))
            }
        }
    }
}

private val WEEKDAY_INITIALS = listOf("S", "M", "T", "W", "T", "F", "S")
private val DAY_CELL = 36.dp
private val DAY_DISC = 34.dp

@Composable
private fun NavChevron(
    icon: PantopusIcon,
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier.size(28.dp).clickable(enabled = enabled, onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = label,
            size = 17.dp,
            tint = if (enabled) PantopusColors.appTextSecondary else PantopusColors.appBorderStrong,
        )
    }
}

/**
 * The slot area: composing interim / skeleton / empty cards / day-full / time list.
 *
 * Frame 2 (Composing): member-avatar cluster + skeleton rows + ComposedPill — shown while a
 * Business/Home collective-intersect fetch runs.
 * Frame 3 (No-times-in-range): dashed EmptyCard with "See {nextMonth}" primary.
 * Frame 4 (No-times-anywhere): same EmptyCard but "Notify me" primary + "Join waitlist"
 * secondary with a count chip.
 * Frame 5 (ComposedEmpty): framed EmptyCard with pillar-soft bg + member free/busy cluster.
 * Frame 6 (Slot just taken): taken slot strikethrough via disabledStarts; toast handled above.
 */
@Composable
private fun SlotRegion(
    state: SlotPickerUiState.Content,
    accent: Color,
    onSelectSlot: (SlotDto) -> Unit,
    onSeeNextAvailable: () -> Unit,
) {
    when {
        state.slotsLoading -> {
            state.selectedDayHeading?.let { DayHeading(it) }
            // Frame 2: composing state for collective (Home/Business) intersect.
            if (state.isComposing) {
                ComposingCaption()
                DiscoverySkeletonSlots(count = 4)
                ComposedPillBanner(pillar = state.pillar)
            } else {
                DiscoverySkeletonSlots(count = 6)
            }
        }
        // Frame 5: composed-empty — Home/Business intersect, no overlap in window.
        state.isComposedEmpty -> {
            state.selectedDayHeading?.let { DayHeading(it) }
            ComposedEmptyCard(pillar = state.pillar, accent = accent, onNextMonth = onSeeNextAvailable)
        }
        !state.monthHasAvailability ->
            // Frame 3: "No open times in {month}" — calendar shows no available days.
            // The design (Frame 3) primary = "See {nextMonth}", secondary = "Get notified
            // when times open" with a bell icon. Frame 4 ("Notify me" primary + "Join
            // waitlist" secondary) requires a fully-blocked-host signal not yet in the API
            // response; deferred — Frame 3 is the safe fallback for any empty month.
            NoAvailabilityState(
                // Spec frame 3 reaches for a calendar-search glyph; the icon set has no
                // calendar-search — calendar-clock carries the "looking for times" intent.
                icon = PantopusIcon.CalendarClock,
                title = "No open times in ${state.monthLabel.substringBefore(' ')}",
                body = "Availability changes often. Try a later month.",
                primaryLabel = "See ${state.nextMonthLabel}",
                primaryIcon = PantopusIcon.ArrowRight,
                onPrimary = onSeeNextAvailable,
                accent = accent,
                // Frame 3 secondary CTA (design: "Get notified when times open", bell icon).
                secondaryLabel = "Get notified when times open",
                secondaryIcon = PantopusIcon.Bell,
                onSecondary = { /* notify-me subscription — no API yet; no-op placeholder */ },
            )
        state.selectedDay == null ->
            NoAvailabilityState(
                icon = PantopusIcon.CalendarClock,
                title = "Pick a day with open times",
                body = "Tap a highlighted date above to see its times.",
                primaryLabel = "Jump to next available",
                primaryIcon = PantopusIcon.ArrowRight,
                onPrimary = onSeeNextAvailable,
                accent = accent,
            )
        state.daySlots.isEmpty() -> {
            state.selectedDayHeading?.let { DayHeading(it) }
            DayFullyBookedNotice(onSeeNextAvailable = onSeeNextAvailable, accent = accent)
        }
        else -> {
            state.selectedDayHeading?.let { DayHeading(it) }
            // Frame 6: pass the taken slot as disabled so SlotTimeList renders strikethrough.
            SlotTimeList(
                slots = state.daySlots,
                selectedStart = state.selectedSlotStart,
                onSelect = onSelectSlot,
                accent = accent,
                disabledStarts = setOfNotNull(state.takenSlotStart),
            )
        }
    }
}

@Composable
private fun DayHeading(text: String) {
    Text(
        text = text,
        // Spec day heading is 13px/700 — a touch under the 14sp small token.
        style = PantopusTextStyle.small,
        fontSize = 13.sp,
        fontWeight = FontWeight.Bold,
        color = PantopusColors.appText,
        modifier = Modifier.padding(horizontal = Spacing.s1),
    )
}

/** Docked confirmation bar after a slot is picked — the A5 → A6 hand-off CTA. */
@Composable
private fun ContinueBar(
    dayLabel: String,
    timeLabel: String,
    accent: Color,
    onContinue: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(topStart = Radii.xl, topEnd = Radii.xl))
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = listOf(dayLabel, timeLabel).filter { it.isNotBlank() }.joinToString(" · "),
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        AccentFilledButton(
            label = "Continue",
            accent = accent,
            icon = PantopusIcon.ArrowRight,
            onClick = onContinue,
            modifier = Modifier.testTag(SLOT_PICKER_CONTINUE_TAG),
        )
    }
}

@Composable
private fun PickerTopBar(onBack: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .drawBehind {
                    val stroke = 1.dp.toPx()
                    drawLine(
                        color = pickerDividerColor,
                        start = Offset(0f, size.height - stroke / 2f),
                        end = Offset(size.width, size.height - stroke / 2f),
                        strokeWidth = stroke,
                    )
                }
                .padding(horizontal = Spacing.s2, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(34.dp).clickable(onClickLabel = "Back", onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.ChevronLeft, contentDescription = "Back", size = 20.dp, tint = PantopusColors.appText)
        }
        Text(
            text = "Pick a time",
            style = PantopusTextStyle.body,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center,
        )
        Box(modifier = Modifier.size(34.dp))
    }
}

// ─── Frame 2: Composing interim (collective-intersect) ────────────────────

private val AVATAR_SIZE = 24.dp
private val AVATAR_OVERLAP = 8.dp

/**
 * Frame 2 avatar-cluster caption: "Finding times that work for everyone" shown
 * while a Business/Home collective-intersect fetch is computing. Mirrors the
 * design's AvatarCluster row above the skeleton rows.
 */
@Composable
private fun ComposingCaption(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.padding(horizontal = Spacing.s1, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Three overlapping avatar initials (AR / JL / MK design placeholders). Implemented
        // as a Row with negative start-padding on the 2nd and 3rd avatars to create the
        // desired stacked-overlap effect without requiring absolute positioning.
        Row {
            listOf(
                Pair("AR", PantopusColors.business),
                Pair("JL", PantopusColors.personal),
                Pair("MK", PantopusColors.warning),
            ).forEachIndexed { i, (initials, color) ->
                Box(
                    modifier =
                        Modifier
                            .then(if (i > 0) Modifier.padding(start = -(AVATAR_OVERLAP)) else Modifier)
                            .size(AVATAR_SIZE)
                            .border(1.5.dp, PantopusColors.appSurface, CircleShape)
                            .clip(CircleShape)
                            .background(color),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = initials,
                        style = PantopusTextStyle.overline,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextInverse,
                        fontSize = (AVATAR_SIZE.value * 0.36f).sp,
                    )
                }
            }
        }
        Text(
            text = "Finding times that work for everyone",
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(start = Spacing.s2),
        )
    }
}

/**
 * Frame 2 ComposedPill: pillar-tinted explainer below the skeleton rows —
 * "Times come from each member's availability" with a calendar-range icon.
 */
@Composable
private fun ComposedPillBanner(
    pillar: SchedulingPillar,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(pillar.accentBg)
                .border(1.dp, pillar.accentRing, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        // Design: calendar-range icon. PantopusIcon.Calendar (DateRange) is the closest
        // available glyph — calendar-range is not yet in the icon set.
        PantopusIconImage(
            icon = PantopusIcon.Calendar,
            contentDescription = null,
            size = 15.dp,
            tint = pillar.accent,
        )
        Text(
            text = "Times come from each member's availability.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
    }
}

// ─── Frame 5: DST hint banner ─────────────────────────────────────────────

/**
 * Frame 5: INFO banner shown between the timezone chip and the calendar when a
 * DST change is imminent in the visible month. The ViewModel populates [dstHint]
 * in [SlotPickerUiState.Content] when it detects a zone offset change within the
 * window; the message is passed straight through.
 */
@Composable
private fun DstHintBanner(
    message: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.infoBg)
                .border(1.dp, PantopusColors.infoLight, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.info,
            modifier = Modifier.padding(top = 1.dp),
        )
        Text(
            text = message,
            style = PantopusTextStyle.caption,
            color = PantopusColors.info,
        )
    }
}

// ─── Frame 5 (C-slotstates): ComposedEmpty card ───────────────────────────

/**
 * Frame 5 (ComposedEmpty): shown when a Home/Business collective-intersect
 * produces no overlapping free windows on the selected day. Uses a "framed"
 * card style — pillar-soft background + 1dp solid accent-tinted border — and
 * includes a member free/busy dot-cluster row, unlike the plain dashed EmptyCard.
 */
@Composable
private fun ComposedEmptyCard(
    pillar: SchedulingPillar,
    accent: Color,
    onNextMonth: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(pillar.accentBg)
                .border(1.dp, pillar.accentRing, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s5, vertical = Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        // Icon halo — white background + accent-tinted border (framed variant).
        Box(
            modifier =
                Modifier
                    .size(50.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface)
                    .border(1.dp, pillar.accentRing, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            // calendar-x is the designed icon for the composed-empty frame exclusively.
            PantopusIconImage(icon = PantopusIcon.CalendarX, contentDescription = null, size = 23.dp, tint = accent)
        }
        Text(
            text = "Everyone's calendars don't overlap in this window",
            style = PantopusTextStyle.body,
            fontSize = 15.sp,
            lineHeight = 20.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = Spacing.s2),
        )
        Text(
            text = "These times need every required member free at once. Try widening the range.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        // Required-member free/busy dot cluster (design: AR/JL/MK placeholders).
        MemberFreeBusyRow(pillar = pillar)
        Column(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            AccentFilledButton(
                label = "Try next month",
                accent = accent,
                icon = PantopusIcon.ArrowRight,
                onClick = onNextMonth,
            )
            NoAvailabilitySecondaryButton(
                label = "Notify me",
                icon = PantopusIcon.Bell,
                onClick = { /* notify-me — no API yet; no-op placeholder */ },
            )
        }
    }
}

/** Three avatar initials in a row with a free (green) / busy (neutral) dot indicator. */
@Composable
private fun MemberFreeBusyRow(
    pillar: SchedulingPillar,
    modifier: Modifier = Modifier,
) {
    val members =
        listOf(
            Triple("AR", PantopusColors.business, true),
            Triple("JL", PantopusColors.personal, false),
            Triple("MK", PantopusColors.warning, true),
        )
    Row(
        modifier = modifier.padding(vertical = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        members.forEach { (initials, color, free) ->
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Box {
                    Box(
                        modifier =
                            Modifier.size(
                                34.dp,
                            ).clip(CircleShape).background(color).border(2.dp, PantopusColors.appSurface, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = initials,
                            style = PantopusTextStyle.overline,
                            fontWeight = FontWeight.Bold,
                            color = PantopusColors.appTextInverse,
                        )
                    }
                    Box(
                        modifier =
                            Modifier
                                .size(11.dp)
                                .clip(CircleShape)
                                .background(if (free) PantopusColors.home else PantopusColors.appBorderStrong)
                                .border(2.dp, PantopusColors.appSurface, CircleShape)
                                .align(Alignment.BottomEnd),
                    )
                }
                Text(
                    text = if (free) "Free" else "Busy",
                    style = PantopusTextStyle.overline,
                    fontWeight = FontWeight.SemiBold,
                    color = if (free) PantopusColors.homeDark else PantopusColors.appTextMuted,
                    fontSize = 9.sp,
                )
            }
        }
    }
}

/** Secondary ghost button reused from the NoAvailabilityState inline pattern. */
@Composable
private fun NoAvailabilitySecondaryButton(
    label: String,
    icon: PantopusIcon,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s3),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, tint = PantopusColors.appText)
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.padding(start = Spacing.s2),
        )
    }
}

// ─── Frame 6: Slot-just-taken toast ───────────────────────────────────────

/**
 * Frame 6: floating WARN toast shown at the bottom of the screen when a slot
 * was taken by a race condition between the user selecting it and the booking
 * POST. The slot row is rendered with [TextDecoration.LineThrough] via
 * [SlotTimeList]'s disabledStarts param; this toast adds the contextual label.
 */
@Composable
private fun SlotTakenToast(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.TriangleAlert,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.warning,
        )
        Text(
            text = "That time was just taken",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.warning,
        )
    }
}
