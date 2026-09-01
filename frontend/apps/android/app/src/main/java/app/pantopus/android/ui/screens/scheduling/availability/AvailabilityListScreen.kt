@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.availability

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

@Composable
fun AvailabilityListScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: AvailabilityListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var renameFor by remember { mutableStateOf<ScheduleRowUi?>(null) }
    var deleteFor by remember { mutableStateOf<ScheduleRowUi?>(null) }
    var reassignFor by remember { mutableStateOf<String?>(null) }
    var toast by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is AvailabilityListEvent.OpenEditor -> onNavigate(SchedulingRoutes.weeklyHoursEditor(event.scheduleId))
                is AvailabilityListEvent.Toast -> toast = event.message
                is AvailabilityListEvent.ReassignNeeded -> reassignFor = event.scheduleId
            }
        }
    }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2500)
            toast = null
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        Column(modifier = Modifier.fillMaxSize()) {
            AvailabilityTopBar(
                title = "Availability",
                onBack = onBack,
                trailing = {
                    TopBarAddAction(contentDescription = "Add schedule", onClick = viewModel::addSchedule)
                },
            )
            PersonalHeaderPill()
            // Spec: HelperLine is a fixed (non-scrolling) band beneath the identity pill,
            // present in the Loading, Single and Multiple frames (omitted only on Empty).
            when (state) {
                AvailabilityListUiState.Empty, is AvailabilityListUiState.Error -> Unit
                else -> AvailabilityHelperLine()
            }
            when (val s = state) {
                AvailabilityListUiState.Loading ->
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        ScheduleSkeletonRow()
                        ScheduleSkeletonRow()
                    }
                AvailabilityListUiState.Empty ->
                    EmptyState(
                        icon = PantopusIcon.CalendarClock,
                        headline = "You don't have a schedule yet",
                        subcopy = "Set the hours you're open to bookings. Your home and business pages build from this.",
                        ctaTitle = "Add working hours",
                        onCta = viewModel::createDefaultSchedule,
                    )
                is AvailabilityListUiState.Error ->
                    ErrorState(message = s.message, onRetry = viewModel::refresh)
                is AvailabilityListUiState.Loaded ->
                    LoadedList(
                        schedules = s.schedules,
                        onOpen = { onNavigate(SchedulingRoutes.weeklyHoursEditor(it)) },
                        onSetDefault = viewModel::setAsDefault,
                        onRename = { renameFor = it },
                        onDuplicate = viewModel::duplicate,
                        onDelete = { deleteFor = it },
                    )
            }
        }
        toast?.let { ToastPill(message = it, modifier = Modifier.align(Alignment.BottomCenter)) }
    }

    renameFor?.let { row ->
        RenameDialog(
            current = row.name,
            onConfirm = {
                viewModel.rename(row.id, it)
                renameFor = null
            },
            onDismiss = { renameFor = null },
        )
    }
    deleteFor?.let { row ->
        ConfirmDeleteDialog(
            name = row.name,
            onConfirm = {
                viewModel.delete(row.id)
                deleteFor = null
            },
            onDismiss = { deleteFor = null },
        )
    }
    reassignFor?.let { id ->
        ReassignDefaultDialog(
            options = viewModel.otherSchedules(id),
            onPick = { newDefault ->
                viewModel.reassignDefaultThenDelete(id, newDefault)
                reassignFor = null
            },
            onDismiss = { reassignFor = null },
        )
    }
}

@Composable
private fun AvailabilityHelperLine() {
    // Spec HelperLine: fixed band, padding '8px 14px 4px', fg3, 11.5/16.
    Text(
        text = "Times here are the source your home and business pages build from.",
        color = PantopusColors.appTextSecondary,
        fontSize = 11.5.sp,
        lineHeight = 16.sp,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 14.dp, top = Spacing.s2, end = 14.dp, bottom = Spacing.s1),
    )
}

@Composable
private fun LoadedList(
    schedules: List<ScheduleRowUi>,
    onOpen: (String) -> Unit,
    onSetDefault: (String) -> Unit,
    onRename: (ScheduleRowUi) -> Unit,
    onDuplicate: (String) -> Unit,
    onDelete: (ScheduleRowUi) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        schedules.forEach { row ->
            ScheduleCard(
                row = row,
                onOpen = { onOpen(row.id) },
                onSetDefault = { onSetDefault(row.id) },
                onRename = { onRename(row) },
                onDuplicate = { onDuplicate(row.id) },
                onDelete = { onDelete(row) },
            )
        }
        if (schedules.size == 1) {
            SpecNote("With one schedule, this list is skipped — opening Availability drops you straight into the editor.")
        }
    }
}

@Composable
private fun ScheduleCard(
    row: ScheduleRowUi,
    onOpen: () -> Unit,
    onSetDefault: () -> Unit,
    onRename: () -> Unit,
    onDuplicate: () -> Unit,
    onDelete: () -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .clickable(onClick = onOpen)
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(36.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.CalendarClock, contentDescription = null, size = 18.dp, tint = PantopusColors.primary600)
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(row.name, color = PantopusColors.appText, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
                if (row.isDefault) DefaultPill()
            }
            Text(
                // Summary in fg-secondary; only append " · TZ" (tz bolded) when
                // the timezone is non-blank, so a blank tz leaves no dangling " · ".
                text =
                    buildAnnotatedString {
                        append(row.summary)
                        if (row.timezone.isNotBlank()) {
                            append("  ·  ")
                            withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)) {
                                append(row.timezone)
                            }
                        }
                    },
                color = PantopusColors.appTextSecondary,
                fontSize = 11.5.sp,
                modifier = Modifier.padding(top = Spacing.s1),
            )
        }
        Box {
            Box(
                modifier = Modifier.size(30.dp).clip(RoundedCornerShape(Radii.sm)).clickable { menuOpen = true },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MoreVertical,
                    contentDescription = "Schedule actions",
                    size = 18.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                if (!row.isDefault) {
                    DropdownMenuItem(
                        text = { Text("Set as default") },
                        leadingIcon = {
                            PantopusIconImage(
                                icon = PantopusIcon.CalendarCheck,
                                contentDescription = null,
                                size = 16.dp,
                                tint = PantopusColors.appTextStrong,
                            )
                        },
                        onClick = {
                            menuOpen = false
                            onSetDefault()
                        },
                    )
                }
                DropdownMenuItem(
                    text = { Text("Rename") },
                    leadingIcon = {
                        PantopusIconImage(
                            icon = PantopusIcon.Pencil,
                            contentDescription = null,
                            size = 16.dp,
                            tint = PantopusColors.appTextStrong,
                        )
                    },
                    onClick = {
                        menuOpen = false
                        onRename()
                    },
                )
                DropdownMenuItem(
                    text = { Text("Duplicate") },
                    leadingIcon = {
                        PantopusIconImage(
                            icon = PantopusIcon.Copy,
                            contentDescription = null,
                            size = 16.dp,
                            tint = PantopusColors.appTextStrong,
                        )
                    },
                    onClick = {
                        menuOpen = false
                        onDuplicate()
                    },
                )
                DropdownMenuItem(
                    text = { Text("Delete", color = PantopusColors.error) },
                    leadingIcon = {
                        PantopusIconImage(icon = PantopusIcon.Trash2, contentDescription = null, size = 16.dp, tint = PantopusColors.error)
                    },
                    onClick = {
                        menuOpen = false
                        onDelete()
                    },
                )
            }
        }
    }
}

@Composable
private fun SpecNote(text: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceRaised)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Info, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextMuted)
        Text(text, color = PantopusColors.appTextSecondary, fontSize = 11.sp)
    }
}

@Composable
private fun RenameDialog(
    current: String,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var value by remember { mutableStateOf(current) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Rename schedule") },
        text = {
            OutlinedTextField(value = value, onValueChange = { value = it }, singleLine = true, label = { Text("Name") })
        },
        confirmButton = { TextButton(onClick = { onConfirm(value) }) { Text("Save") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun ConfirmDeleteDialog(
    name: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Delete \"$name\"?") },
        text = { Text("This schedule and its hours will be removed. This can't be undone.") },
        confirmButton = { TextButton(onClick = onConfirm) { Text("Delete", color = PantopusColors.error) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun ReassignDefaultDialog(
    options: List<ScheduleRowUi>,
    onPick: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Pick a new default") },
        text = {
            Column {
                Text(
                    "You can't delete your default schedule. Choose another to become the default first.",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 13.sp,
                )
                options.forEach { option ->
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(Radii.md))
                                .clickable { onPick(option.id) }
                                .padding(vertical = Spacing.s2, horizontal = Spacing.s1),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.CalendarCheck,
                            contentDescription = null,
                            size = 16.dp,
                            tint = PantopusColors.primary600,
                        )
                        Text(option.name, color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun ToastPill(
    message: String,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .padding(Spacing.s4)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appText)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
    ) {
        Text(message, color = PantopusColors.appTextInverse, fontSize = 13.sp)
    }
}
