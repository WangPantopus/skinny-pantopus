@file:Suppress(
    "PackageNaming",
    "UNUSED_PARAMETER",
    "LongMethod",
    "CyclomaticComplexMethod",
    "MagicNumber",
    "LongParameterList",
)
@file:OptIn(
    androidx.compose.material3.ExperimentalMaterial3Api::class,
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
)

package app.pantopus.android.ui.screens.scheduling.visits

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillStatus
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStatusPill
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBarLeading
import app.pantopus.android.ui.screens.scheduling.resources.CounterRow
import app.pantopus.android.ui.screens.scheduling.resources.HomeMemberAvatar
import app.pantopus.android.ui.screens.scheduling.resources.HomeMemberStack
import app.pantopus.android.ui.screens.scheduling.resources.HomePrimaryButton
import app.pantopus.android.ui.screens.scheduling.resources.HomeSecondaryButton
import app.pantopus.android.ui.screens.scheduling.resources.PickerValueRow
import app.pantopus.android.ui.screens.scheduling.resources.ResourceDatePickerDialog
import app.pantopus.android.ui.screens.scheduling.resources.ResourceTimePickerDialog
import app.pantopus.android.ui.screens.scheduling.resources.RuleChipView
import app.pantopus.android.ui.screens.scheduling.resources.SectionCard
import app.pantopus.android.ui.screens.scheduling.resources.SelectChipIcon
import app.pantopus.android.ui.screens.scheduling.resources.SelectionCheck
import app.pantopus.android.ui.screens.scheduling.resources.VisitKind
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.format.DateTimeFormatter
import java.util.Locale

const val VISIT_DETAIL_TAG = "scheduling.visitDetail"
const val VISIT_DETAIL_EDIT_TAG = "scheduling.visitDetail.edit"

private val EDIT_DATE_FORMAT = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
private val EDIT_TIME_FORMAT = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

/** F14 Visit Detail. */
@Composable
fun VisitDetailScreen(
    visitId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: VisitDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val isEditing by viewModel.isEditing.collectAsStateWithLifecycle()
    val showCancel by viewModel.showCancelConfirm.collectAsStateWithLifecycle()
    val actionError by viewModel.actionError.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.start() }
    // The cancel DELETE runs in viewModelScope; dismiss once it actually lands.
    LaunchedEffect(Unit) { viewModel.cancelled.collect { onBack() } }

    val loaded = state as? VisitDetailUiState.Loaded

    Scaffold(
        modifier = Modifier.fillMaxSize().testTag(VISIT_DETAIL_TAG),
        containerColor = PantopusColors.appBg,
        topBar = {
            SchedulingTopBar(
                title = "Visit",
                leading = SchedulingTopBarLeading.Back,
                onLeading = onBack,
                applyStatusBarInset = true,
                trailing = {
                    if (loaded != null && loaded.lifecycle == VisitLifecycle.Confirmed) {
                        TextButton(
                            onClick = viewModel::beginEdit,
                            modifier = Modifier.testTag(VISIT_DETAIL_EDIT_TAG),
                        ) {
                            Text(
                                "Edit",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = PantopusColors.home,
                            )
                        }
                    }
                },
            )
        },
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            when (val s = state) {
                VisitDetailUiState.Loading -> SchedulingLoadingSkeleton(rows = 3)
                is VisitDetailUiState.Error ->
                    ErrorState(
                        headline = "Couldn't load this visit",
                        message = s.message,
                        onRetry = viewModel::load,
                    )
                VisitDetailUiState.Removed -> RemovedBody(onBack)
                is VisitDetailUiState.Loaded ->
                    VisitLoaded(
                        loaded = s,
                        onCancel = viewModel::requestCancel,
                        onReschedule = viewModel::beginEdit,
                        onBookAgain = { onNavigate(viewModel.bookAgainRoute()) },
                    )
            }
        }
    }

    if (isEditing) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = viewModel::dismissEdit,
            sheetState = sheetState,
            containerColor = PantopusColors.appSurface,
        ) {
            VisitEditSheet(viewModel)
        }
    }

    if (showCancel) {
        AlertDialog(
            onDismissRequest = viewModel::dismissCancel,
            confirmButton = {
                TextButton(onClick = viewModel::cancelVisit) {
                    Text("Cancel visit", color = PantopusColors.error, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = { TextButton(onClick = viewModel::dismissCancel) { Text("Keep") } },
            title = { Text("Cancel this visit?") },
            text = { Text("This removes the visit from the family calendar.") },
        )
    }

    actionError?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::clearActionError,
            confirmButton = { TextButton(onClick = viewModel::clearActionError) { Text("OK") } },
            title = { Text("Couldn't update") },
            text = { Text(message) },
        )
    }
}

@Composable
private fun VisitLoaded(
    loaded: VisitDetailUiState.Loaded,
    onCancel: () -> Unit,
    onReschedule: () -> Unit,
    onBookAgain: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(
                        1f,
                    ).verticalScroll(rememberScrollState())
                    .padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            HeaderCard(loaded)
            // Confirmed shows the "On the home calendar" banner; Done has no
            // banner (the terminal chip + timeline carry the state) — matches spec.
            if (loaded.lifecycle == VisitLifecycle.Confirmed) {
                LifecycleBanner(loaded.lifecycle)
            }
            StatusTimeline(loaded.lifecycle)
            HostsCard(loaded)
            loaded.entryNote?.let { AccessCard(it) }
        }
        Column {
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            Row(
                modifier =
                    Modifier
                        .background(
                            PantopusColors.appSurface,
                        ).fillMaxWidth()
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                when (loaded.lifecycle) {
                    VisitLifecycle.Confirmed -> {
                        HomeSecondaryButton(
                            title = "Cancel",
                            icon = PantopusIcon.X,
                            tone = PantopusColors.error,
                            onClick = onCancel,
                            modifier = Modifier.weight(1f),
                        )
                        HomePrimaryButton(
                            title = "Reschedule",
                            icon = PantopusIcon.CalendarClock,
                            onClick = onReschedule,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    VisitLifecycle.Done ->
                        HomeSecondaryButton(
                            title = "Book again",
                            icon = PantopusIcon.ArrowsRepeat,
                            onClick = onBookAgain,
                            modifier = Modifier.weight(1f),
                        )
                }
            }
        }
    }
}

@Composable
private fun HeaderCard(loaded: VisitDetailUiState.Loaded) {
    val timeColor =
        if (loaded.lifecycle ==
            VisitLifecycle.Done
        ) {
            PantopusColors.appTextSecondary
        } else {
            PantopusColors.home
        }
    SectionCard {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                listOf(
                                    PantopusColors.categoryUnboxing,
                                    PantopusColors.categoryUnboxingDark,
                                ),
                            ),
                        ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    initials(loaded.title),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    loaded.title,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                RuleChipView(
                    icon = loaded.kind.icon,
                    text = loaded.kind.label,
                    foreground = PantopusColors.categoryUnboxingDark,
                    background = PantopusColors.categoryUnboxingBg,
                )
            }
            if (loaded.lifecycle == VisitLifecycle.Done) {
                SchedulingStatusPill(status = SchedulingPillStatus.Completed)
            }
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(
                        RoundedCornerShape(Radii.md),
                    ).background(
                        PantopusColors.appSurfaceSunken,
                    ).padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Clock,
                contentDescription = null,
                size = 14.dp,
                tint = timeColor,
            )
            Text(
                loaded.timeText,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Bold,
                color = timeColor,
            )
        }
    }
}

@Composable
private fun LifecycleBanner(lifecycle: VisitLifecycle) {
    val (icon, title, body, bg, fg) =
        when (lifecycle) {
            VisitLifecycle.Confirmed ->
                BannerSpec(
                    PantopusIcon.CalendarCheck,
                    "On the home calendar",
                    "This visit shows on the family schedule.",
                    PantopusColors.homeBg,
                    PantopusColors.home,
                )
            VisitLifecycle.Done ->
                BannerSpec(
                    PantopusIcon.Check,
                    "Visit complete",
                    "This visit has passed.",
                    PantopusColors.appSurfaceSunken,
                    PantopusColors.appTextSecondary,
                )
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(
                    RoundedCornerShape(Radii.lg),
                ).background(bg)
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = fg)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = fg)
            Text(body, fontSize = 11.sp, color = PantopusColors.appText)
        }
    }
}

private data class BannerSpec(
    val icon: PantopusIcon,
    val title: String,
    val body: String,
    val bg: Color,
    val fg: Color,
)

/**
 * 4-step status timeline (Offered → Reserved → Confirmed → Done). For a concrete
 * v1 visit, Confirmed maps to step 2 and Done to step 3; earlier steps render as
 * completed (check), the active step gets a home-accent ring, later steps stay
 * grey/numbered. (The offer/reserve lifecycle has no v1 backend.)
 */
@Composable
private fun StatusTimeline(lifecycle: VisitLifecycle) {
    val steps = listOf("Offered", "Reserved", "Confirmed", "Done")
    val current = if (lifecycle == VisitLifecycle.Done) 3 else 2
    SectionCard(overline = "Status") {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Top,
        ) {
            steps.forEachIndexed { index, step ->
                val done = index < current
                val active = index == current
                Column(
                    modifier = Modifier.size(width = 46.dp, height = 40.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(22.dp)
                                .clip(CircleShape)
                                .then(
                                    if (active) {
                                        Modifier.border(2.dp, PantopusColors.homeBg, CircleShape)
                                    } else {
                                        Modifier
                                    },
                                ).background(
                                    if (done || active) PantopusColors.home else PantopusColors.appSurfaceSunken,
                                ),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (done) {
                            PantopusIconImage(
                                icon = PantopusIcon.Check,
                                contentDescription = null,
                                size = 11.dp,
                                strokeWidth = 3f,
                                tint = PantopusColors.appTextInverse,
                            )
                        } else {
                            Text(
                                "${index + 1}",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                            )
                        }
                    }
                    Text(
                        step,
                        fontSize = 9.sp,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                        color =
                            when {
                                active -> PantopusColors.homeDark
                                done -> PantopusColors.appText
                                else -> PantopusColors.appTextMuted
                            },
                    )
                }
                if (index < steps.size - 1) {
                    Box(
                        modifier =
                            Modifier
                                .weight(1f)
                                .padding(top = 10.dp)
                                .height(2.dp)
                                .clip(RoundedCornerShape(Radii.xs))
                                .background(
                                    if (index < current) PantopusColors.home else PantopusColors.appBorder,
                                ),
                    )
                }
            }
        }
    }
}

@Composable
private fun HostsCard(loaded: VisitDetailUiState.Loaded) {
    SectionCard(overline = "Host members", overlineColor = PantopusColors.appTextSecondary) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            if (loaded.hostMembers.isEmpty()) {
                PantopusIconImage(
                    icon = PantopusIcon.Users,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.appTextMuted,
                )
            } else {
                HomeMemberStack(members = loaded.hostMembers, size = 30.dp)
            }
            Text(
                loaded.hostSummary,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun AccessCard(note: String) {
    SectionCard {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(
                            32.dp,
                        ).clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.KeyRound,
                    contentDescription = null,
                    size = 16.dp,
                    tint = PantopusColors.appText,
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    "ENTRY NOTE",
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.6.sp,
                    color = PantopusColors.appTextMuted,
                )
                Text(
                    note,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
            }
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun RemovedBody(onBack: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.XCircle,
            contentDescription = null,
            size = 40.dp,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            "This visit was cancelled",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            "It's no longer on the family calendar.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        HomeSecondaryButton(title = "Go back", icon = PantopusIcon.ChevronLeft, onClick = onBack)
    }
}

private fun initials(title: String): String {
    val letters =
        title
            .split(" ")
            .filter { it.isNotBlank() }
            .take(2)
            .mapNotNull { it.firstOrNull() }
            .joinToString("")
    return letters.ifBlank { "V" }.uppercase(Locale.US)
}

@Composable
private fun VisitEditSheet(viewModel: VisitDetailViewModel) {
    val form by viewModel.editForm.collectAsStateWithLifecycle()
    val members by viewModel.memberRoster.collectAsStateWithLifecycle()
    val isSaving by viewModel.isSavingEdit.collectAsStateWithLifecycle()
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(
                    rememberScrollState(),
                ).padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Edit visit",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = viewModel::saveEdit, enabled = viewModel.editValid && !isSaving) {
                Text(
                    "Save",
                    fontWeight = FontWeight.Bold,
                    color = if (viewModel.editValid) PantopusColors.home else PantopusColors.appTextMuted,
                )
            }
        }
        SectionCard(overline = "Details") {
            app.pantopus.android.ui.components.PantopusTextField(
                label = "Title",
                value = form.title,
                onValueChange = viewModel::setEditTitle,
                placeholder = "Visit title",
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                VisitKind.entries.forEach { kind ->
                    SelectChipIcon(label = kind.label, icon = kind.icon, isOn = kind == form.kind, onClick = {
                        viewModel.setEditKind(kind)
                    })
                }
            }
        }
        SectionCard(overline = "Who must be home") {
            members.forEachIndexed { index, member ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clickable {
                                viewModel.toggleEditHost(member.id)
                            }.padding(vertical = Spacing.s1),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    HomeMemberAvatar(member = member, size = 30.dp)
                    Text(
                        member.name,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                        modifier = Modifier.weight(1f),
                    )
                    SelectionCheck(isOn = form.whoIsHome.contains(member.id))
                }
                if (index <
                    members.size - 1
                ) {
                    HorizontalDivider(color = PantopusColors.appBorderSubtle)
                }
            }
        }
        SectionCard(overline = "When") {
            PickerValueRow(label = "Date", value = form.date.format(EDIT_DATE_FORMAT), onClick = {
                showDatePicker =
                    true
            })
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            PickerValueRow(
                label = "Start time",
                value =
                    form.startTime.format(
                        EDIT_TIME_FORMAT,
                    ),
                onClick = {
                    showTimePicker =
                        true
                },
            )
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            CounterRow(
                label = "Visit length",
                value = form.durationHours,
                onValueChange = viewModel::setEditDuration,
                unit = "hr",
                range =
                    1..12,
            )
        }
        SectionCard(overline = "Access") {
            app.pantopus.android.ui.components.PantopusTextField(
                label = "Entry note",
                value = form.note,
                onValueChange = viewModel::setEditNote,
                placeholder = "Entry note for the visitor",
            )
        }
    }

    if (showDatePicker) {
        ResourceDatePickerDialog(
            initial = form.date,
            onSelect = {
                viewModel.setEditDate(it)
                showDatePicker = false
            },
            onDismiss = { showDatePicker = false },
        )
    }
    if (showTimePicker) {
        ResourceTimePickerDialog(
            initial = form.startTime,
            onSelect = {
                viewModel.setEditStartTime(it)
                showTimePicker = false
            },
            onDismiss = { showTimePicker = false },
        )
    }
}
