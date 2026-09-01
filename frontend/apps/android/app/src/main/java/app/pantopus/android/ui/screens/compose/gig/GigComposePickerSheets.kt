@file:OptIn(
    androidx.compose.material3.ExperimentalMaterial3Api::class,
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
)
@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.compose.gig

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

// ════════════════════════════════════════════════════════════════
//  E.1 — Post-a-Task composer picker sheets (Android)
//
//  The bottom-sheet sub-modals the gig composer fields open, mirroring
//  the RN gig/_components/* modals (design: Gig Picker Sheets.html).
//  Presented one-at-a-time over the wizard via [GigComposePickerSheetHost].
//  Results bind straight back into [GigComposeViewModel].
// ════════════════════════════════════════════════════════════════

/** Resolves [GigComposeUiState.activeSheet] to a modal bottom sheet. */
@Composable
internal fun GigComposePickerSheetHost(
    state: GigComposeUiState,
    viewModel: GigComposeViewModel,
    onPickPhoto: () -> Unit = {},
    onTakePhoto: () -> Unit = {},
    onPickFile: () -> Unit = {},
) {
    val sheet = state.activeSheet ?: return
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = viewModel::dismissPicker,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
    ) {
        when (sheet) {
            GigPickerSheet.Attachment ->
                AttachmentSheetContent(
                    viewModel,
                    onPickPhoto = onPickPhoto,
                    onTakePhoto = onTakePhoto,
                    onPickFile = onPickFile,
                )
            GigPickerSheet.Category -> CategorySheetContent(state, viewModel)
            GigPickerSheet.Deadline -> DeadlineSheetContent(state, viewModel)
            GigPickerSheet.Policy -> PolicySheetContent(state, viewModel)
            GigPickerSheet.Urgency -> UrgencySheetContent(state, viewModel)
            GigPickerSheet.Tags -> TagsSheetContent(state, viewModel)
            GigPickerSheet.Identity -> IdentitySheetContent(state, viewModel)
        }
    }
}

// ─── P6c — Posting identity (persona switching) ───────────────────

/**
 * P6c — "Post as" picker behind the identity chip. Lists Personal plus
 * every business with a postable user id; the selection rides
 * magic-post as `beneficiary_user_id` (null for Personal).
 */
@Composable
private fun IdentitySheetContent(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    PickerSheetScaffold(
        rootTestTag = "gigCompose.identitySheet",
        title = "Post as",
        subtitle = "Choose who this task is posted for.",
        onClose = vm::dismissPicker,
    ) {
        IdentityOptionRow(
            label = "Personal · You",
            sublabel = "Your personal profile",
            icon = PantopusIcon.User,
            accent = PantopusColors.personal,
            accentBg = PantopusColors.personalBg,
            isSelected = state.form.beneficiaryUserId == null,
            testTag = "gigCompose.identity.option_personal",
            onTap = { vm.selectIdentity(null) },
        )
        state.identityOptions.forEach { option ->
            Spacer(Modifier.size(Spacing.s2))
            IdentityOptionRow(
                label = option.name,
                sublabel = "Business",
                icon = PantopusIcon.Briefcase,
                accent = PantopusColors.business,
                accentBg = PantopusColors.businessBg,
                isSelected = state.form.beneficiaryUserId == option.id,
                testTag = "gigCompose.identity.option_${option.id}",
                onTap = { vm.selectIdentity(option) },
            )
        }
    }
}

@Composable
private fun IdentityOptionRow(
    label: String,
    sublabel: String,
    icon: PantopusIcon,
    accent: Color,
    accentBg: Color,
    isSelected: Boolean,
    testTag: String,
    onTap: () -> Unit,
) {
    val borderColor = if (isSelected) accent else PantopusColors.appBorder
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(width = if (isSelected) 2.dp else 1.dp, color = borderColor, shape = RoundedCornerShape(Radii.md))
                .clickable(role = Role.Button, onClick = onTap)
                .padding(Spacing.s3)
                .testTag(testTag)
                .semantics {
                    contentDescription = "$label. $sublabel"
                    selected = isSelected
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(34.dp).clip(CircleShape).background(accentBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = accent)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(label, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(sublabel, fontSize = 11.5.sp, color = PantopusColors.appTextSecondary)
        }
        if (isSelected) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 18.dp,
                tint = accent,
            )
        }
    }
}

// ─── Shared scaffold ──────────────────────────────────────────────

@Composable
private fun PickerSheetScaffold(
    rootTestTag: String,
    title: String,
    onClose: () -> Unit,
    subtitle: String? = null,
    applyLabel: String? = null,
    applyTestTag: String? = null,
    onApply: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().testTag(rootTestTag)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = Spacing.s5, end = Spacing.s5, bottom = Spacing.s2),
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
                if (subtitle != null) {
                    Text(subtitle, fontSize = 12.5.sp, color = PantopusColors.appTextSecondary, lineHeight = 17.sp)
                }
            }
            SheetCloseButton(onClose)
        }
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(max = 540.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s5, vertical = Spacing.s4),
            content = content,
        )
        if (applyLabel != null && onApply != null) {
            PrimaryButton(
                title = applyLabel,
                onClick = onApply,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s5, vertical = Spacing.s4)
                        .let { if (applyTestTag != null) it.testTag(applyTestTag) else it },
            )
        }
    }
}

@Composable
private fun SheetCloseButton(onClose: () -> Unit) {
    Box(
        modifier =
            Modifier
                .size(30.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceSunken)
                .clickable(role = Role.Button, onClick = onClose)
                .semantics { contentDescription = "Close" },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.X,
            contentDescription = null,
            size = 17.dp,
            strokeWidth = 2.4f,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

// ─── Sheet 1: Deadline ────────────────────────────────────────────

@Composable
private fun DeadlineSheetContent(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    val zone = remember { ZoneId.systemDefault() }
    val today = remember { LocalDate.now(zone) }
    val restored =
        remember(state.form.deadlineISO) {
            state.form.deadlineISO?.let { iso ->
                runCatching { Instant.parse(iso).atZone(zone) }.getOrNull()
            }
        }
    var selectedDay by remember { mutableStateOf(restored?.toLocalDate()) }
    var specificTime by remember { mutableStateOf((restored?.hour ?: 23) < 23) }

    val applyLabel =
        selectedDay?.let { "Set deadline · ${it.format(SHORT_DATE)}" } ?: "Set as flexible"

    PickerSheetScaffold(
        rootTestTag = "gigPicker.deadlineSheet",
        title = "Deadline",
        subtitle = "When do you need this done?",
        applyLabel = applyLabel,
        applyTestTag = "gigPicker.deadlineApply",
        onApply = {
            vm.setDeadline(selectedDay?.let { resolveDeadlineIso(it, specificTime, zone) })
            vm.dismissPicker()
        },
        onClose = vm::dismissPicker,
    ) {
        val saturday = remember(today) { today.plusDays(((DayOfWeek.SATURDAY.value - today.dayOfWeek.value + 7) % 7).toLong()) }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PickerChip("Today", selectedDay == today) { selectedDay = today }
            PickerChip("Tomorrow", selectedDay == today.plusDays(1)) { selectedDay = today.plusDays(1) }
            PickerChip("This weekend", selectedDay == saturday) { selectedDay = saturday }
            PickerChip("Flexible", selectedDay == null, testTag = "gigPicker.deadline.flexible") { selectedDay = null }
        }
        Spacer(Modifier.size(Spacing.s4))
        DeadlineCalendar(
            selectedDay = selectedDay,
            today = today,
            onSelect = { selectedDay = it },
        )
        Spacer(Modifier.size(Spacing.s4))
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurfaceMuted)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .clickable(role = Role.Switch) { specificTime = !specificTime }
                    .padding(Spacing.s3)
                    .testTag("gigPicker.deadline.specific")
                    .semantics { selected = specificTime },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(icon = PantopusIcon.Clock, contentDescription = null, size = 17.dp, tint = PantopusColors.appTextSecondary)
            Text(
                "By a specific time",
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            Text(
                if (specificTime) "6:00 PM" else "Any time",
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                color = if (specificTime) PantopusColors.primary600 else PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun DeadlineCalendar(
    selectedDay: LocalDate?,
    today: LocalDate,
    onSelect: (LocalDate) -> Unit,
) {
    var month by remember(selectedDay) { mutableStateOf(YearMonth.from(selectedDay ?: today)) }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                month.format(MONTH_YEAR),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            CalendarNavButton(PantopusIcon.ChevronLeft, "Previous month") { month = month.minusMonths(1) }
            Spacer(Modifier.size(Spacing.s1))
            CalendarNavButton(PantopusIcon.ChevronRight, "Next month") { month = month.plusMonths(1) }
        }
        Row(modifier = Modifier.fillMaxWidth()) {
            WEEKDAY_SYMBOLS.forEach { symbol ->
                Text(
                    symbol,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextMuted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        monthCells(month).chunked(7).forEach { week ->
            Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
                week.forEach { day ->
                    Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                        if (day != null) {
                            DayCell(
                                day = day,
                                isSelected = day == selectedDay,
                                isToday = day == today,
                                isPast = day.isBefore(today),
                                onSelect = { onSelect(day) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DayCell(
    day: LocalDate,
    isSelected: Boolean,
    isToday: Boolean,
    isPast: Boolean,
    onSelect: () -> Unit,
) {
    val textColor =
        when {
            isSelected -> PantopusColors.appTextInverse
            isPast -> PantopusColors.appTextMuted
            isToday -> PantopusColors.primary600
            else -> PantopusColors.appText
        }
    Box(
        modifier =
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(if (isSelected) PantopusColors.primary600 else Color.Transparent)
                .let {
                    if (isToday && !isSelected) {
                        it.border(1.5.dp, PantopusColors.primary300, CircleShape)
                    } else {
                        it
                    }
                }
                .clickable(enabled = !isPast, role = Role.Button, onClick = onSelect)
                .semantics { contentDescription = day.format(FULL_DATE) },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            day.dayOfMonth.toString(),
            fontSize = 13.5.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = textColor,
        )
    }
}

@Composable
private fun CalendarNavButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(30.dp)
                .clip(RoundedCornerShape(Radii.md))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .clickable(role = Role.Button, onClick = onClick)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 17.dp, tint = PantopusColors.appTextSecondary)
    }
}

// ─── Sheet 2: Cancellation policy ─────────────────────────────────

@Composable
private fun PolicySheetContent(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    var selection by remember { mutableStateOf(state.form.cancellationPolicy ?: GigCancellationPolicy.Moderate) }
    PickerSheetScaffold(
        rootTestTag = "gigPicker.policySheet",
        title = "Cancellation policy",
        subtitle = "What happens if the booking is called off.",
        applyLabel = "Save policy",
        applyTestTag = "gigPicker.policySave",
        onApply = {
            vm.setCancellationPolicy(selection)
            vm.dismissPicker()
        },
        onClose = vm::dismissPicker,
    ) {
        GigCancellationPolicy.entries.forEach { policy ->
            PolicyOptionCard(policy = policy, isSelected = selection == policy) { selection = policy }
            Spacer(Modifier.size(Spacing.s2 + 2.dp))
        }
        SheetInfoNote(
            icon = PantopusIcon.Info,
            text = "Most neighbors pick Moderate — it protects you without scaring off bidders.",
            tint = PantopusColors.primary700,
            container = PantopusColors.primary50,
        )
    }
}

@Composable
private fun PolicyOptionCard(
    policy: GigCancellationPolicy,
    isSelected: Boolean,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (isSelected) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(
                    width = 1.5.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .clickable(role = Role.RadioButton, onClick = onTap)
                .padding(Spacing.s3)
                .testTag("gigPicker.policy.${policy.name.lowercase()}")
                .semantics {
                    contentDescription = "${policy.label}. ${policy.detail}"
                    selected = isSelected
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(policy.label, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(policy.detail, fontSize = 12.sp, color = PantopusColors.appTextSecondary, lineHeight = 16.sp)
        }
        RadioGlyph(isSelected)
    }
}

// ─── Sheet 3: Urgency ─────────────────────────────────────────────

private enum class UrgencyWindow(val label: String) {
    WithinHours("Within hours"),
    Today("Today"),
    ThisWeek("This week"),
}

@Composable
private fun UrgencySheetContent(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    var isUrgent by remember { mutableStateOf(state.form.isUrgent) }
    var window by remember { mutableStateOf(UrgencyWindow.WithinHours) }
    PickerSheetScaffold(
        rootTestTag = "gigPicker.urgencySheet",
        title = "Urgency",
        subtitle = "Boost a time-sensitive gig to the top.",
        applyLabel = "Apply",
        applyTestTag = "gigPicker.urgencyApply",
        onApply = {
            vm.setUrgent(isUrgent)
            vm.dismissPicker()
        },
        onClose = vm::dismissPicker,
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(if (isUrgent) PantopusColors.primary50 else PantopusColors.appSurface)
                    .border(
                        width = 1.5.dp,
                        color = if (isUrgent) PantopusColors.primary600 else PantopusColors.appBorder,
                        shape = RoundedCornerShape(Radii.lg),
                    )
                    .padding(Spacing.s4),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1 + 3.dp)) {
                    PantopusIconImage(
                        icon = PantopusIcon.Zap,
                        contentDescription = null,
                        size = 17.dp,
                        strokeWidth = 2.4f,
                        tint = PantopusColors.warning,
                    )
                    Text("Mark as urgent", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
                }
                Text(
                    "Pinned higher in the feed and flagged with an urgent badge.",
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                    lineHeight = 16.sp,
                )
            }
            Switch(
                checked = isUrgent,
                onCheckedChange = { isUrgent = it },
                colors = SwitchDefaults.colors(checkedTrackColor = PantopusColors.primary600, checkedThumbColor = Color.White),
                modifier = Modifier.testTag("gigPicker.urgencyToggle").semantics { contentDescription = "Mark as urgent" },
            )
        }
        if (isUrgent) {
            Spacer(Modifier.size(Spacing.s3))
            Text("HOW SOON", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp, color = PantopusColors.appTextMuted)
            Spacer(Modifier.size(Spacing.s2))
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                UrgencyWindow.entries.forEach { option ->
                    Box(modifier = Modifier.weight(1f)) {
                        PickerChip(option.label, window == option, fillWidth = true) { window = option }
                    }
                }
            }
            Spacer(Modifier.size(Spacing.s4))
            SheetInfoNote(
                icon = PantopusIcon.Megaphone,
                text = "Urgent gigs get a visibility boost · +\$2 promotion fee.",
                tint = PantopusColors.warning,
                container = PantopusColors.warningBg,
            )
        }
    }
}

// ─── Sheet 4: Tags ────────────────────────────────────────────────

private val TAG_SUGGESTIONS =
    listOf("#heavy-lifting", "#truck-needed", "#furniture", "#1-hour", "#stairs", "#tip-included")

@Composable
private fun TagsSheetContent(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    var draft by remember { mutableStateOf("") }
    val tags = state.form.tags
    val applyLabel =
        when (tags.size) {
            0 -> "Done"
            1 -> "Add 1 tag"
            else -> "Add ${tags.size} tags"
        }
    PickerSheetScaffold(
        rootTestTag = "gigPicker.tagsSheet",
        title = "Tags",
        subtitle = "Help the right neighbors find this gig.",
        applyLabel = applyLabel,
        applyTestTag = "gigPicker.tagsApply",
        onApply = vm::dismissPicker,
        onClose = vm::dismissPicker,
    ) {
        FlowRow(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.5.dp, PantopusColors.primary600, RoundedCornerShape(Radii.md))
                    .padding(Spacing.s2 + 2.dp),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1 + 3.dp),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1 + 3.dp),
        ) {
            tags.forEach { tag ->
                TagChipView(label = "#$tag", removable = true) { vm.removeTag(tag) }
            }
            BasicTextField(
                value = draft,
                onValueChange = { draft = it },
                singleLine = true,
                textStyle = TextStyle(color = PantopusColors.appText, fontSize = 13.5.sp),
                cursorBrush = SolidColor(PantopusColors.primary600),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions =
                    KeyboardActions(
                        onDone = {
                            vm.addTag(draft)
                            draft = ""
                        },
                    ),
                modifier = Modifier.widthIn(min = 90.dp).testTag("gigPicker.tagInput"),
                decorationBox = { inner ->
                    if (draft.isEmpty()) {
                        Text("Add a tag…", fontSize = 13.5.sp, color = PantopusColors.appTextMuted)
                    }
                    inner()
                },
            )
        }
        Spacer(Modifier.size(Spacing.s5))
        Text("SUGGESTED", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp, color = PantopusColors.appTextMuted)
        Spacer(Modifier.size(Spacing.s3))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            TAG_SUGGESTIONS.forEach { suggestion ->
                val isChosen = GigComposeViewModel.normalizeTag(suggestion)?.let { tags.contains(it) } ?: false
                SuggestionChipView(label = suggestion, isChosen = isChosen) { vm.toggleTag(suggestion) }
            }
        }
        Spacer(Modifier.size(Spacing.s4))
        Text(
            "Up to ${GigComposeLimits.MAX_TAGS} tags · ${(GigComposeLimits.MAX_TAGS - tags.size).coerceAtLeast(0)} remaining",
            fontSize = 11.5.sp,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun TagChipView(
    label: String,
    removable: Boolean,
    onRemove: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(PantopusColors.primary600)
                .padding(
                    start = Spacing.s3 - 1.dp,
                    end = if (removable) Spacing.s2 else Spacing.s3 - 1.dp,
                    top = Spacing.s1 + 2.dp,
                    bottom = Spacing.s1 + 2.dp,
                )
                .testTag("gigPicker.tagChip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1 + 1.dp),
    ) {
        Text(label, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextInverse)
        if (removable) {
            Box(
                modifier =
                    Modifier.clip(
                        CircleShape,
                    ).clickable(role = Role.Button, onClick = onRemove).semantics { contentDescription = "Remove $label" },
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = null,
                    size = 13.dp,
                    strokeWidth = 2.6f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun SuggestionChipView(
    label: String,
    isChosen: Boolean,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(if (isChosen) PantopusColors.primary600 else PantopusColors.appSurface)
                .border(
                    width = 1.dp,
                    color = if (isChosen) Color.Transparent else PantopusColors.appBorderStrong,
                    shape = CircleShape,
                )
                .clickable(role = Role.Button, onClick = onTap)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1 + 3.dp)
                .testTag("gigPicker.tagChip")
                .semantics { selected = isChosen },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1 + 1.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Plus,
            contentDescription = null,
            size = 13.dp,
            strokeWidth = 2.6f,
            tint = if (isChosen) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
        )
        Text(
            label,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (isChosen) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
        )
    }
}

// ─── Sheet 5: Attachment source ───────────────────────────────────

@Composable
private fun AttachmentSheetContent(
    vm: GigComposeViewModel,
    onPickPhoto: () -> Unit,
    onTakePhoto: () -> Unit,
    onPickFile: () -> Unit,
) {
    // P0.2 — sources launch the host's system pickers; the picked bytes
    // upload immediately via the VM. P6b — "Take a photo" launches real
    // camera capture (`TakePicture()` + FileProvider) wired by the host.
    fun pickPhoto() {
        vm.dismissPicker()
        onPickPhoto()
    }

    fun takePhoto() {
        vm.dismissPicker()
        onTakePhoto()
    }

    fun pickFile() {
        vm.dismissPicker()
        onPickFile()
    }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s2, vertical = Spacing.s2)
                .testTag("gigPicker.attachmentSheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl2))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.xl2)),
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text("Add a photo or file", fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
                Text(
                    "Up to ${GigComposeLimits.MAX_PHOTOS} attachments · 10 MB each",
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            AttachmentActionRow(
                icon = PantopusIcon.Camera,
                label = "Take a photo",
                subtitle = "Use the camera now",
                tint = PantopusColors.primary600,
                container = PantopusColors.primary50,
                testTag = "gigPicker.attach.photos",
            ) { takePhoto() }
            HorizontalDivider(color = PantopusColors.appBorderSubtle, modifier = Modifier.padding(start = 70.dp))
            AttachmentActionRow(
                icon = PantopusIcon.Image,
                label = "Photo library",
                subtitle = "Choose existing photos",
                tint = PantopusColors.success,
                container = PantopusColors.successBg,
                testTag = "gigPicker.attach.library",
            ) { pickPhoto() }
            HorizontalDivider(color = PantopusColors.appBorderSubtle, modifier = Modifier.padding(start = 70.dp))
            AttachmentActionRow(
                icon = PantopusIcon.FileText,
                label = "Choose a file",
                subtitle = "PDF, doc, or spreadsheet",
                tint = PantopusColors.magic,
                container = PantopusColors.magicBg,
                testTag = "gigPicker.attach.file",
            ) { pickFile() }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl2))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.xl2))
                    .clickable(role = Role.Button, onClick = vm::dismissPicker)
                    .padding(vertical = Spacing.s3 + 3.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text("Cancel", fontSize = 15.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        }
    }
}

@Composable
private fun AttachmentActionRow(
    icon: PantopusIcon,
    label: String,
    subtitle: String,
    tint: Color,
    container: Color,
    testTag: String,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClick = onTap)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s4 - 1.dp)
                .testTag(testTag)
                .semantics { contentDescription = "$label. $subtitle" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s4 - 2.dp),
    ) {
        Box(
            modifier = Modifier.size(40.dp).clip(RoundedCornerShape(Radii.lg - 1.dp)).background(container),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 20.dp, tint = tint)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(label, fontSize = 15.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(subtitle, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextMuted)
    }
}

// ─── Sheet 6: Category ────────────────────────────────────────────

@Composable
private fun CategorySheetContent(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    PickerSheetScaffold(
        rootTestTag = "gigPicker.categorySheet",
        title = "Category",
        subtitle = "Pick the archetype that fits this gig.",
        onClose = vm::dismissPicker,
    ) {
        gigComposeManualPickerCategories.chunked(2).forEach { row ->
            Row(modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s2), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                row.forEach { category ->
                    Box(modifier = Modifier.weight(1f)) {
                        CategorySheetTile(
                            category = category,
                            isSelected = state.form.category == category,
                        ) {
                            vm.selectCategory(category)
                            vm.dismissPicker()
                        }
                    }
                }
                repeat(2 - row.size) { Box(modifier = Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun CategorySheetTile(
    category: GigComposeCategory,
    isSelected: Boolean,
    onTap: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 84.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (isSelected) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(
                    width = if (isSelected) 2.dp else 1.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .clickable(role = Role.Button, onClick = onTap)
                .padding(Spacing.s3)
                .testTag("gigPicker.category.${category.key}")
                .semantics { contentDescription = if (isSelected) "${category.label}, selected" else category.label },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(34.dp).clip(RoundedCornerShape(Radii.md)).background(category.accent.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = category.tileIcon, contentDescription = null, size = 17.dp, strokeWidth = 2.2f, tint = category.accent)
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(category.label, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(category.examples, fontSize = 10.5.sp, color = PantopusColors.appTextSecondary, maxLines = 1)
        }
    }
}

// ─── Review-step options block (sheet triggers) ───────────────────

/**
 * Tappable field rows on the Review step that open the composer picker
 * sheets and reflect their bound values. Mirrors the design's composer
 * field list (Category · Deadline · Cancellation policy · Urgency · Tags).
 */
@Composable
internal fun GigComposeOptionsBlock(
    form: GigComposeFormState,
    vm: GigComposeViewModel,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Text(
            "ADD DETAILS (OPTIONAL)",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
        )
        OptionFieldRow("Category", form.category?.label, "Tap to choose", "gigPicker.row.category") {
            vm.presentPicker(GigPickerSheet.Category)
        }
        OptionFieldRow("Deadline", deadlineLabel(form.deadlineISO), "Flexible", "gigPicker.row.deadline") {
            vm.presentPicker(GigPickerSheet.Deadline)
        }
        OptionFieldRow("Cancellation policy", form.cancellationPolicy?.label, "Standard", "gigPicker.row.policy") {
            vm.presentPicker(GigPickerSheet.Policy)
        }
        OptionFieldRow("Urgency", if (form.isUrgent) "Urgent" else null, "Not urgent", "gigPicker.row.urgency") {
            vm.presentPicker(GigPickerSheet.Urgency)
        }
        OptionFieldRow("Tags", tagsLabel(form.tags), "Add tags", "gigPicker.row.tags") {
            vm.presentPicker(GigPickerSheet.Tags)
        }
    }
}

@Composable
private fun OptionFieldRow(
    label: String,
    value: String?,
    placeholder: String,
    testTag: String,
    onTap: () -> Unit,
) {
    Column(
        modifier = Modifier.clickable(role = Role.Button, onClick = onTap).testTag(testTag),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1 + 1.dp),
    ) {
        Text(label, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (value == null) PantopusColors.appSurface else PantopusColors.primary50)
                    .border(
                        width = 1.dp,
                        color = if (value == null) PantopusColors.appBorder else PantopusColors.primary600,
                        shape = RoundedCornerShape(Radii.md),
                    )
                    .padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                value ?: placeholder,
                fontSize = 13.5.sp,
                color = if (value == null) PantopusColors.appTextMuted else PantopusColors.appText,
                maxLines = 1,
                modifier = Modifier.weight(1f),
            )
            PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
        }
    }
}

// ─── Shared bits ──────────────────────────────────────────────────

@Composable
private fun PickerChip(
    label: String,
    isActive: Boolean,
    modifier: Modifier = Modifier,
    testTag: String? = null,
    fillWidth: Boolean = false,
    onTap: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .then(if (fillWidth) Modifier.fillMaxWidth() else Modifier)
                .clip(CircleShape)
                .background(if (isActive) PantopusColors.primary600 else PantopusColors.appSurfaceSunken)
                .border(
                    width = 1.dp,
                    color = if (isActive) Color.Transparent else PantopusColors.appBorder,
                    shape = CircleShape,
                )
                .clickable(role = Role.Button, onClick = onTap)
                .padding(horizontal = Spacing.s3 + 1.dp, vertical = Spacing.s1 + 3.dp)
                .let { if (testTag != null) it.testTag(testTag) else it }
                .semantics { selected = isActive },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun RadioGlyph(isOn: Boolean) {
    Box(
        modifier =
            Modifier
                .size(22.dp)
                .clip(CircleShape)
                .background(if (isOn) PantopusColors.primary600 else Color.Transparent)
                .border(2.dp, if (isOn) PantopusColors.primary600 else PantopusColors.appBorderStrong, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (isOn) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 3f,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun SheetInfoNote(
    icon: PantopusIcon,
    text: String,
    tint: Color,
    container: Color,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md + 2.dp))
                .background(container)
                .padding(horizontal = Spacing.s3 + 1.dp, vertical = Spacing.s3 - 1.dp),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2 + 1.dp),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, strokeWidth = 2.2f, tint = tint)
        Text(text, fontSize = 11.5.sp, color = tint, lineHeight = 16.sp)
    }
}

// ─── Helpers ──────────────────────────────────────────────────────

private val WEEKDAY_SYMBOLS = listOf("S", "M", "T", "W", "T", "F", "S")
private val SHORT_DATE: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.getDefault())
private val MONTH_YEAR: DateTimeFormatter = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.getDefault())
private val FULL_DATE: DateTimeFormatter = DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy", Locale.getDefault())

private fun monthCells(month: YearMonth): List<LocalDate?> {
    val first = month.atDay(1)
    // Sunday-start grid: SUN(7)%7 = 0 leading blanks, MON(1) = 1, … SAT(6) = 6.
    val leading = first.dayOfWeek.value % 7
    val cells = ArrayList<LocalDate?>()
    repeat(leading) { cells.add(null) }
    for (day in 1..month.lengthOfMonth()) {
        cells.add(month.atDay(day))
    }
    return cells
}

private fun resolveDeadlineIso(
    day: LocalDate,
    specificTime: Boolean,
    zone: ZoneId,
): String {
    val time = if (specificTime) LocalTime.of(18, 0) else LocalTime.of(23, 59)
    return day.atTime(time).atZone(zone).toInstant().toString()
}

private fun deadlineLabel(iso: String?): String? =
    iso?.let {
        runCatching {
            Instant.parse(it).atZone(ZoneId.systemDefault()).toLocalDate().format(SHORT_DATE)
        }.getOrNull()
    }

private fun tagsLabel(tags: List<String>): String? = if (tags.isEmpty()) null else tags.joinToString(" · ") { "#$it" }
