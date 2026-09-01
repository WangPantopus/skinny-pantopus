@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.scheduling._shared.ConflictAlternativesSheet
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBarLeading
import app.pantopus.android.ui.screens.scheduling._shared.SlotTimeList
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val MANUAL_BOOKING_TAG = "scheduling.manualBooking"

@Composable
fun ManualBookingScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: ManualBookingViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.start() }
    val accent = state.pillar.accent

    val handleBack = { if (!viewModel.back()) onBack() }

    Scaffold(
        modifier = Modifier.testTag(MANUAL_BOOKING_TAG),
        containerColor = PantopusColors.appBg,
        topBar = {
            SchedulingTopBar(
                title = "Book someone in",
                leading = if (state.step != ManualStep.Created) SchedulingTopBarLeading.Back else SchedulingTopBarLeading.None,
                onLeading = handleBack,
                applyStatusBarInset = true,
            )
        },
        bottomBar = {
            if (state.step != ManualStep.Created && state.loadError == null) {
                Column(modifier = Modifier.fillMaxWidth().padding(Spacing.s4)) {
                    PrimaryButton(
                        title = if (state.step == ManualStep.Review) "Create booking" else "Continue",
                        onClick = viewModel::next,
                        modifier = Modifier.fillMaxWidth(),
                        isLoading = state.creating,
                        isEnabled = state.canContinue,
                    )
                }
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (state.step != ManualStep.Created) {
                StepRail(currentStep = state.step, accent = accent)
            }
            Box(modifier = Modifier.weight(1f)) {
                when {
                    state.loadError != null -> ErrorState(message = state.loadError!!, onRetry = viewModel::start)
                    else ->
                        when (state.step) {
                            ManualStep.EventType -> EventTypeStep(state = state, accent = accent, onSelect = viewModel::selectEventType)
                            ManualStep.Time ->
                                TimeStep(
                                    state = state,
                                    accent = accent,
                                    onSelectDay = viewModel::selectDay,
                                    onSelectSlot = viewModel::selectSlot,
                                )
                            ManualStep.Details ->
                                DetailsStep(
                                    state = state,
                                    accent = accent,
                                    onName = viewModel::setName,
                                    onContactMode = viewModel::setContactMode,
                                    onEmail = viewModel::setEmail,
                                    onPhone = viewModel::setPhone,
                                    onNote = viewModel::setNote,
                                )
                            ManualStep.Review ->
                                ReviewStep(
                                    state = state,
                                    onSkipApproval = viewModel::setSkipApproval,
                                    onSkipNotifications = viewModel::setSkipNotifications,
                                )
                            ManualStep.Created ->
                                CreatedStep(onViewBooking = {
                                    state.createdBookingId?.let { onNavigate(SchedulingRoutes.bookingDetail(it)) }
                                }, onBookAnother = viewModel::bookAnother)
                        }
                }
            }
        }
    }

    state.doubleBook?.let { conflict ->
        DoubleBookWarning(conflict = conflict, onCancel = viewModel::dismissDoubleBook, onBookAnyway = viewModel::bookAnyway)
    }
    state.slotConflict?.let { conflict ->
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ConflictAlternativesSheet(
            conflict = conflict,
            onPick = viewModel::pickAlternative,
            onPickAnotherTime = viewModel::dismissSlotConflict,
            onDismiss = viewModel::dismissSlotConflict,
            sheetState = sheetState,
            accent = accent,
        )
    }
}

@Composable
private fun StepRail(
    currentStep: ManualStep,
    accent: Color,
) {
    val labels = listOf("Event", "Time", "Details", "Review")
    val currentIndex = ManualStep.entries.indexOf(currentStep).coerceAtMost(labels.size - 1)
    Row(
        modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        labels.forEachIndexed { index, label ->
            val done = index < currentIndex
            val current = index == currentIndex
            Box(
                modifier =
                    Modifier.size(
                        22.dp,
                    ).clip(CircleShape).background(if (done || current) accent else PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                if (done) {
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
                        contentDescription = null,
                        size = 14.dp,
                        tint = PantopusColors.appTextInverse,
                    )
                } else {
                    Text(
                        text = "${index + 1}",
                        style = PantopusTextStyle.caption,
                        fontWeight = FontWeight.Bold,
                        color = if (current) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                    )
                }
            }
            if (current) {
                Text(
                    text = label,
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.padding(start = Spacing.s1),
                )
            }
            if (index < labels.size - 1) {
                Box(modifier = Modifier.weight(1f).height(1.dp).padding(horizontal = Spacing.s2).background(PantopusColors.appBorder))
            }
        }
    }
}

@Composable
private fun StepScaffold(
    title: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text(text = title, style = PantopusTextStyle.h2, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        content()
    }
}

@Composable
private fun EventTypeStep(
    state: ManualBookingUiState,
    accent: Color,
    onSelect: (String) -> Unit,
) {
    StepScaffold(title = "Pick an event type") {
        if (state.loadingEventTypes) {
            SchedulingLoadingSkeleton(rows = 3)
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                state.eventTypes.forEach { option ->
                    EventTypeTile(
                        option = option,
                        selected = option.id == state.selectedEventTypeId,
                        accent = accent,
                        onClick = { onSelect(option.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun EventTypeTile(
    option: ManualEventTypeOption,
    selected: Boolean,
    accent: Color,
    onClick: () -> Unit,
) {
    val icon =
        when (option.locationMode) {
            "video" -> PantopusIcon.Video
            "phone" -> PantopusIcon.Phone
            "in_person" -> PantopusIcon.MapPin
            else -> PantopusIcon.Calendar
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (selected) accent.copy(alpha = TILE_BG_ALPHA) else PantopusColors.appSurface)
                .border(if (selected) 1.5.dp else 1.dp, if (selected) accent else PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier.size(
                    40.dp,
                ).clip(
                    RoundedCornerShape(Radii.md),
                ).background(if (selected) accent.copy(alpha = TILE_ICON_ALPHA) else PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 18.dp,
                tint = if (selected) accent else PantopusColors.appTextStrong,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = option.name, style = PantopusTextStyle.body, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            if (option.durationLabel.isNotEmpty()) {
                Text(text = option.durationLabel, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
        }
        if (selected) {
            PantopusIconImage(icon = PantopusIcon.CheckCircle, contentDescription = null, size = 20.dp, tint = accent)
        }
    }
}

@Composable
private fun TimeStep(
    state: ManualBookingUiState,
    accent: Color,
    onSelectDay: (java.time.LocalDate) -> Unit,
    onSelectSlot: (String) -> Unit,
) {
    StepScaffold(title = "Choose a time") {
        TzChip(label = state.tzLabel)
        when {
            state.loadingSlots -> SchedulingLoadingSkeleton(rows = 3)
            state.slotsError != null ->
                Text(
                    text = state.slotsError.orEmpty(),
                    style = PantopusTextStyle.small,
                    color = PantopusColors.error,
                )
            state.days.isEmpty() ->
                Text(
                    text = "No open times in the next two weeks.",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
            else -> {
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    state.days.forEach { day ->
                        DayChip(day = day, selected = day == state.selectedDay, accent = accent, onClick = { onSelectDay(day) })
                    }
                }
                SlotTimeList(
                    slots = state.daySlots,
                    selectedStart = state.selectedSlotStart,
                    onSelect = { onSelectSlot(it.start) },
                    accent = accent,
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    PantopusIconImage(icon = PantopusIcon.Info, contentDescription = null, size = 13.dp, tint = PantopusColors.appTextMuted)
                    Text(
                        text = "Times come from each member's personal availability.",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

@Composable
private fun DayChip(
    day: java.time.LocalDate,
    selected: Boolean,
    accent: Color,
    onClick: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .width(54.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (selected) accent else PantopusColors.appSurface)
                .border(1.dp, if (selected) accent else PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s2),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(
            text = BookingsExtrasFormatting.weekdayShort(day),
            style = PantopusTextStyle.overline,
            color = if (selected) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
        )
        Text(
            text = BookingsExtrasFormatting.dayNumber(day),
            style = PantopusTextStyle.body,
            fontWeight = FontWeight.Bold,
            color = if (selected) PantopusColors.appTextInverse else PantopusColors.appText,
        )
    }
}

@Composable
private fun TzChip(label: String) {
    Row(
        modifier =
            Modifier.clip(
                RoundedCornerShape(Radii.pill),
            ).background(PantopusColors.appSurfaceSunken).padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.Globe, contentDescription = null, size = 13.dp, tint = PantopusColors.appTextSecondary)
        Text(text = label, style = PantopusTextStyle.caption, fontWeight = FontWeight.Medium, color = PantopusColors.appTextStrong)
    }
}

@Composable
private fun DetailsStep(
    state: ManualBookingUiState,
    accent: Color,
    onName: (String) -> Unit,
    onContactMode: (ContactMode) -> Unit,
    onEmail: (String) -> Unit,
    onPhone: (String) -> Unit,
    onNote: (String) -> Unit,
) {
    StepScaffold(title = "Who's it for?") {
        ExtrasInputField(
            value = state.inviteeName,
            onValueChange = onName,
            placeholder = "Full name",
            leadingIcon = PantopusIcon.User,
            accent = accent,
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ExtrasOverline("Invite by")
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                InviteByRow(
                    icon = PantopusIcon.Phone,
                    label = "Phone",
                    subtitle = "Recommended",
                    selected = state.contactMode == ContactMode.Phone,
                    onClick = { onContactMode(ContactMode.Phone) },
                    accent = accent,
                )
                InviteByRow(icon = PantopusIcon.Mail, label = "Email", selected = state.contactMode == ContactMode.Email, onClick = {
                    onContactMode(ContactMode.Email)
                }, accent = accent)
            }
            if (state.contactMode == ContactMode.Phone) {
                ExtrasInputField(
                    value = state.inviteePhone,
                    onValueChange = onPhone,
                    placeholder = "Mobile number",
                    leadingIcon = PantopusIcon.Phone,
                    accent = accent,
                    keyboardType = androidx.compose.ui.text.input.KeyboardType.Phone,
                )
            } else {
                ExtrasInputField(
                    value = state.inviteeEmail,
                    onValueChange = onEmail,
                    placeholder = "Email address",
                    leadingIcon = PantopusIcon.Mail,
                    accent = accent,
                    keyboardType = androidx.compose.ui.text.input.KeyboardType.Email,
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ExtrasOverline("Note (optional)")
            ExtrasMessageBox(
                value = state.note,
                onValueChange = onNote,
                placeholder = "Anything they should know…",
                accent = accent,
                minHeight = 64.dp,
            )
        }
    }
}

@Composable
private fun ReviewStep(
    state: ManualBookingUiState,
    onSkipApproval: (Boolean) -> Unit,
    onSkipNotifications: (Boolean) -> Unit,
) {
    val eventName = state.eventTypes.firstOrNull { it.id == state.selectedEventTypeId }?.name ?: "—"
    val contact = if (state.contactMode == ContactMode.Phone) state.inviteePhone else state.inviteeEmail
    StepScaffold(title = "Review & confirm") {
        Column(
            modifier =
                Modifier.fillMaxWidth().clip(
                    RoundedCornerShape(Radii.xl),
                ).background(
                    PantopusColors.appSurface,
                ).border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)).padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            SummaryRow(label = "Event", value = eventName)
            SummaryRow(label = "Time", value = BookingsExtrasFormatting.dayAndTime(state.selectedSlotStart))
            SummaryRow(label = "Invitee", value = state.inviteeName.ifBlank { "—" })
            SummaryRow(label = "Contact", value = contact.ifBlank { "—" })
        }
        ExtrasChannelRow(
            icon = PantopusIcon.BadgeCheck,
            label = "Skip approval",
            checked = state.skipApproval,
            onCheckedChange = onSkipApproval,
            accent = state.pillar.accent,
            subtitle = "Follows the event type's approval setting",
        )
        ExtrasChannelRow(
            icon = PantopusIcon.BellOff,
            label = "Skip notifications",
            checked = state.skipNotifications,
            onCheckedChange = onSkipNotifications,
            accent = state.pillar.accent,
        )
        state.createError?.let { ExtrasInlineError(message = it) }
    }
}

@Composable
private fun SummaryRow(
    label: String,
    value: String,
) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(text = label, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary, modifier = Modifier.width(84.dp))
        Text(
            text = value,
            style = PantopusTextStyle.body,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun CreatedStep(
    onViewBooking: () -> Unit,
    onBookAnother: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        ExtrasIconDisc(icon = PantopusIcon.Check, tint = PantopusColors.success, background = PantopusColors.successBg)
        Text(
            text = "Booking created",
            style = PantopusTextStyle.h2,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.padding(top = Spacing.s3),
        )
        Text(
            text = "We've added it and notified your invitee.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(top = Spacing.s1, bottom = Spacing.s5),
        )
        PrimaryButton(title = "View booking", onClick = onViewBooking, modifier = Modifier.fillMaxWidth())
        GhostButton(title = "Book another", onClick = onBookAnother, modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2))
    }
}

/**
 * E12 Invite-by card row — a full-width bordered card with an icon tile, a label,
 * an optional subtitle, and a trailing check-circle when selected. Matches the
 * design's onbehalf-frames.jsx lines 222–231 card-row pattern (replaces the prior
 * pill-chip selector).
 */
@Composable
private fun InviteByRow(
    icon: PantopusIcon,
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    accent: Color,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (selected) accent.copy(alpha = TILE_BG_ALPHA) else PantopusColors.appSurface)
                .border(if (selected) 1.5.dp else 1.dp, if (selected) accent else PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier.size(
                    38.dp,
                ).clip(
                    RoundedCornerShape(Radii.md),
                ).background(if (selected) accent.copy(alpha = TILE_ICON_ALPHA) else PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 18.dp,
                tint = if (selected) accent else PantopusColors.appTextStrong,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = label, style = PantopusTextStyle.body, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            if (subtitle != null) {
                Text(text = subtitle, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
        }
        if (selected) {
            PantopusIconImage(icon = PantopusIcon.CheckCircle, contentDescription = null, size = 20.dp, tint = accent)
        }
    }
}

private const val TILE_BG_ALPHA = 0.08f
private const val TILE_ICON_ALPHA = 0.16f
