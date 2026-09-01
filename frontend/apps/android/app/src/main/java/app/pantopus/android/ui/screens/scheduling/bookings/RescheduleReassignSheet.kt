@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "CyclomaticComplexMethod",
)
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.bookings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SlotTimeList
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val RESCHEDULE_SHEET_TAG = "rescheduleReassignSheet"

/**
 * E4 Reschedule / Reassign sheet. Wraps the shared `SlotTimeList` over a day
 * strip (renders local, sends UTC); offers Propose-to-invitee vs
 * Reschedule-now, an optional member picker (Business/Home), and a notify
 * switch. The 409 conflict is handled one level up via the shared
 * `ConflictAlternativesSheet`.
 */
@Composable
fun RescheduleReassignSheet(
    state: RescheduleSheetUiState,
    sheetState: SheetState,
    onDismiss: () -> Unit,
    onSelectDay: (Long) -> Unit,
    onSelectSlot: (app.pantopus.android.data.api.models.scheduling.SlotDto) -> Unit,
    onSelectMember: (String) -> Unit,
    onSetAuthority: (RescheduleAuthority) -> Unit,
    onToggleNotify: () -> Unit,
    onConfirm: () -> Unit,
    onProposedDone: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val accent = state.pillar.accent
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = modifier.testTag(RESCHEDULE_SHEET_TAG),
    ) {
        if (state.proposed) {
            ProposedSuccess(onDone = onProposedDone)
            return@ModalBottomSheet
        }
        Column(
            modifier =
                Modifier.fillMaxWidth().verticalScroll(
                    rememberScrollState(),
                ).padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        ) {
            Text(
                text =
                    when {
                        state.reassignOnly -> "Reassign"
                        state.allowReassign && state.members.isNotEmpty() -> "Reschedule & reassign"
                        else -> "Pick a new time"
                    },
                fontSize = 16.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.padding(bottom = Spacing.s3),
            )
            if (!state.reassignOnly) {
                CurrentSlot(
                    currentLabel = state.currentLabel,
                    selectedStart = state.selectedStart,
                    selectedEnd = null,
                    accent = accent,
                )
                Spacer(Modifier.height(Spacing.s3))
            }

            if (state.loading) {
                LoadingSkeleton()
            } else if (state.reassignOnly) {
                MemberList(state = state, accent = accent, onSelectMember = onSelectMember)
            } else {
                if (state.allowReassign && state.members.isNotEmpty()) {
                    MemberRail(state = state, accent = accent, onSelectMember = onSelectMember)
                    Spacer(Modifier.height(Spacing.s3))
                }
                TzChip(tz = state.tz)
                Spacer(Modifier.height(Spacing.s3))
                if (state.slots.isEmpty()) {
                    NoAvailability()
                } else {
                    DayStripAndSlots(
                        state = state,
                        accent = accent,
                        onSelectDay = onSelectDay,
                        onSelectSlot = onSelectSlot,
                    )
                    Spacer(Modifier.height(Spacing.s4))
                    AuthorityToggle(
                        authority = state.authority,
                        accent = accent,
                        onSet = onSetAuthority,
                    )
                    Spacer(Modifier.height(Spacing.s3))
                    NotifySwitch(notify = state.notify, accent = accent, onToggle = onToggleNotify)
                }
            }

            state.errorMessage?.let {
                Spacer(Modifier.height(Spacing.s3))
                SheetInlineError(it)
            }

            if (!state.loading && (state.reassignOnly || state.slots.isNotEmpty())) {
                Spacer(Modifier.height(Spacing.s4))
                ConfirmCta(state = state, accent = accent, onConfirm = onConfirm)
            }
            Spacer(Modifier.height(Spacing.s4))
        }
    }
}

@Composable
private fun ConfirmCta(
    state: RescheduleSheetUiState,
    accent: Color,
    onConfirm: () -> Unit,
) {
    val (label, icon, enabled) =
        when {
            state.reassignOnly ->
                Triple(
                    "Reassign",
                    PantopusIcon.UserCheck,
                    state.selectedMemberId != null,
                )
            state.authority == RescheduleAuthority.Propose ->
                Triple(
                    "Send proposal",
                    PantopusIcon.Send,
                    state.selectedStart != null,
                )
            else ->
                Triple(
                    "Reschedule now",
                    PantopusIcon.CalendarCheck,
                    state.selectedStart != null,
                )
        }
    PillarFilledButton(
        label = label,
        accent = accent,
        leadingIcon = icon,
        loading = state.submitting,
        enabled = enabled,
        onClick = onConfirm,
        modifier = Modifier.testTag("rescheduleConfirm"),
    )
}

@Composable
private fun CurrentSlot(
    currentLabel: String,
    selectedStart: String?,
    selectedEnd: String?,
    accent: Color,
) {
    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Calendar,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextMuted,
            )
            Text(
                text = currentLabel,
                fontSize = 12.5.sp,
                color = PantopusColors.appTextSecondary,
                textDecoration = TextDecoration.LineThrough,
            )
        }
        Box(
            modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s1),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowDown,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        val filled = selectedStart != null
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(
                        if (filled) accent.copy(alpha = 0.10f) else PantopusColors.appSurface,
                    )
                    .border(
                        1.5.dp,
                        if (filled) accent else PantopusColors.appBorderStrong,
                        RoundedCornerShape(Radii.lg),
                    )
                    .padding(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CalendarClock,
                contentDescription = null,
                size = 16.dp,
                tint = if (filled) accent else PantopusColors.appTextMuted,
            )
            Text(
                text = if (filled) slotRangeLabel(selectedStart, selectedEnd) else "New time",
                fontSize = 12.5.sp,
                fontWeight = if (filled) FontWeight.Bold else FontWeight.Normal,
                color = if (filled) PantopusColors.appText else PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun TzChip(tz: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Globe,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "Times in $tz",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun DayStripAndSlots(
    state: RescheduleSheetUiState,
    accent: Color,
    onSelectDay: (Long) -> Unit,
    onSelectSlot: (app.pantopus.android.data.api.models.scheduling.SlotDto) -> Unit,
) {
    val days = state.slots.mapNotNull { slotLocalDate(it)?.toEpochDay() }.distinct().sorted()
    val selectedDay = state.selectedDayEpoch ?: days.firstOrNull()
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        days.forEach { epoch ->
            val on = epoch == selectedDay
            val (weekday, dayNum) = dayChipLabels(epoch)
            Column(
                modifier =
                    Modifier
                        .size(width = 48.dp, height = 58.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(if (on) accent else PantopusColors.appSurface)
                        .then(
                            if (on) {
                                Modifier
                            } else {
                                Modifier.border(
                                    1.dp,
                                    PantopusColors.appBorder,
                                    RoundedCornerShape(Radii.lg),
                                )
                            },
                        )
                        .clickable { onSelectDay(epoch) },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = weekday,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (on) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
                )
                Text(
                    text = dayNum,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (on) PantopusColors.appTextInverse else PantopusColors.appText,
                )
            }
        }
    }
    Spacer(Modifier.height(Spacing.s3))
    val daySlots = state.slots.filter { slotLocalDate(it)?.toEpochDay() == selectedDay }
    SlotTimeList(
        slots = daySlots,
        selectedStart = state.selectedStart,
        onSelect = onSelectSlot,
        accent = accent,
    )
}

@Composable
private fun MemberRail(
    state: RescheduleSheetUiState,
    accent: Color,
    onSelectMember: (String) -> Unit,
) {
    val accentBg = state.pillar.accentBg
    Column {
        Text(
            text = "ASSIGN TO",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(bottom = Spacing.s2),
        )
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            state.members.forEach { member ->
                val on = member.id == state.selectedMemberId
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(46.dp)
                                .clip(CircleShape)
                                .background(accentBg)
                                .then(
                                    if (on) {
                                        Modifier.border(
                                            2.5.dp,
                                            accent,
                                            CircleShape,
                                        )
                                    } else {
                                        Modifier
                                    },
                                )
                                .clickable { onSelectMember(member.id) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = member.initials,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = accent,
                        )
                    }
                    Text(
                        text = member.label,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (on) accent else PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

@Composable
private fun MemberList(
    state: RescheduleSheetUiState,
    accent: Color,
    onSelectMember: (String) -> Unit,
) {
    val accentBg = state.pillar.accentBg
    if (state.members.isEmpty()) {
        EmptyHint(
            icon = PantopusIcon.Users,
            title = "No one to assign",
            body = "There are no other members who can take this booking.",
        )
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "REASSIGN TO",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
        )
        state.members.forEach { member ->
            val on = member.id == state.selectedMemberId
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(
                            if (on) accentBg else PantopusColors.appSurface,
                        )
                        .border(
                            1.5.dp,
                            if (on) accent else PantopusColors.appBorder,
                            RoundedCornerShape(Radii.lg),
                        )
                        .clickable { onSelectMember(member.id) }
                        .padding(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Box(
                    modifier =
                        Modifier.size(
                            30.dp,
                        ).clip(CircleShape).background(accentBg),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = member.initials,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = accent,
                    )
                }
                Text(
                    text = member.label,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                if (on) {
                    PantopusIconImage(
                        icon = PantopusIcon.CheckCircle,
                        contentDescription = null,
                        size = 18.dp,
                        tint = accent,
                    )
                }
            }
        }
    }
}

@Composable
private fun AuthorityToggle(
    authority: RescheduleAuthority,
    accent: Color,
    onSet: (RescheduleAuthority) -> Unit,
) {
    Column {
        Text(
            text = "HOW TO APPLY",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(bottom = Spacing.s2),
        )
        Row(
            modifier =
                Modifier.fillMaxWidth().clip(
                    RoundedCornerShape(Radii.md),
                ).background(PantopusColors.appSurfaceSunken).padding(3.dp),
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            AuthorityTab("Propose to invitee", authority == RescheduleAuthority.Propose, accent) {
                onSet(RescheduleAuthority.Propose)
            }
            AuthorityTab("Reschedule now", authority == RescheduleAuthority.Now, accent) {
                onSet(RescheduleAuthority.Now)
            }
        }
        Text(
            text =
                if (authority == RescheduleAuthority.Propose) {
                    "Propose sends the new time for the invitee to accept."
                } else {
                    "Reschedule now moves the booking and notifies the invitee."
                },
            fontSize = 10.sp,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.padding(top = Spacing.s1),
        )
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.AuthorityTab(
    label: String,
    on: Boolean,
    accent: Color,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .weight(1f)
                .height(38.dp)
                .clip(RoundedCornerShape(Radii.sm))
                .background(if (on) PantopusColors.appSurface else Color.Transparent)
                .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
            color = if (on) accent else PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun NotifySwitch(
    notify: Boolean,
    accent: Color,
    onToggle: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onToggle)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Bell,
            contentDescription = null,
            size = 17.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Notify invitee",
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(text = "Push + message", fontSize = 10.5.sp, color = PantopusColors.appTextMuted)
        }
        MiniSwitch(on = notify, accent = accent)
    }
}

@Composable
private fun MiniSwitch(
    on: Boolean,
    accent: Color,
) {
    Box(
        modifier =
            Modifier
                .size(width = 42.dp, height = 25.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (on) accent else PantopusColors.appBorderStrong),
        contentAlignment = if (on) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(
            modifier =
                Modifier.padding(
                    horizontal = 2.5.dp,
                ).size(20.dp).clip(CircleShape).background(PantopusColors.appSurface),
        )
    }
}

@Composable
private fun NoAvailability() {
    EmptyHint(
        icon = PantopusIcon.CalendarX,
        title = "No open times in this range",
        body = "Widen the window or message the invitee.",
    )
}

@Composable
private fun EmptyHint(
    icon: PantopusIcon,
    title: String,
    body: String,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier.size(
                    64.dp,
                ).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 28.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = title,
            fontSize = 14.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Text(
            text = body,
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun ProposedSuccess(onDone: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s6, vertical = Spacing.s8),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Box(
            modifier =
                Modifier.size(
                    72.dp,
                ).clip(
                    CircleShape,
                ).background(
                    PantopusColors.successBg,
                ).border(1.dp, PantopusColors.successLight, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Send,
                contentDescription = null,
                size = 30.dp,
                tint = PantopusColors.success,
            )
        }
        Text(
            text = "Proposal sent",
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "We sent the new time for the invitee to accept. We'll let you know when they respond.",
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(Spacing.s1))
        PillarOutlineButton(
            label = "Done",
            onClick = onDone,
            modifier = Modifier.testTag("rescheduleProposedDone"),
        )
        Spacer(Modifier.height(Spacing.s4))
    }
}

@Composable
private fun LoadingSkeleton() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        repeat(5) { Shimmer(width = 48.dp, height = 58.dp, cornerRadius = Radii.lg) }
    }
    Spacer(Modifier.height(Spacing.s3))
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        repeat(4) { Shimmer(width = 320.dp, height = 46.dp, cornerRadius = Radii.lg) }
    }
}

@Composable
private fun SheetInlineError(message: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.errorBg)
                .border(1.dp, PantopusColors.errorLight, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.error,
        )
        Text(
            text = message,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.error,
        )
    }
}
