@file:Suppress(
    "PackageNaming",
    "FunctionNaming",
    "MagicNumber",
    "LongMethod",
    "TooManyFunctions",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.mailbox.mail_task

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.12 (list surface) — Mail tasks. Two frames driven by
 * [MailTaskListViewModel], matching RN `src/app/mailbox/tasks.tsx`:
 *
 *  - list   — "n active · n completed" header, active task cards
 *    (checkbox → complete/reopen, tap → the A17.12 detail, "Convert to
 *    neighbor gig"), and a collapsible "Completed (n)" section.
 *  - create — the task form reached from a mail item: the mail reference
 *    card, title + description fields, a low/medium/high priority
 *    selector, and "Create Task".
 *
 * The designs folder has no list frame for A17.12 (only the detail,
 * `tasks.jsx`), so the chrome follows the A17 nav + section-card
 * archetype. Mirrors `MailTaskListView` on iOS.
 */
@Composable
fun MailTaskListScreen(
    onBack: () -> Unit,
    onOpenTask: (String) -> Unit,
    // A17.8 → "Ask a Neighbor". RN's "Post as Neighbor Task Instead"
    // escalation out of the create frame (`src/app/mailbox/tasks.tsx:236`).
    onPostAsNeighborTask: (String) -> Unit = {},
    viewModel: MailTaskListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val mode by viewModel.mode.collectAsStateWithLifecycle()
    val showsCompleted by viewModel.showsCompleted.collectAsStateWithLifecycle()
    val alert by viewModel.alert.collectAsStateWithLifecycle()
    val convertTarget by viewModel.convertTarget.collectAsStateWithLifecycle()
    val draftTitle by viewModel.draftTitle.collectAsStateWithLifecycle()
    val draftDescription by viewModel.draftDescription.collectAsStateWithLifecycle()
    val draftPriority by viewModel.draftPriority.collectAsStateWithLifecycle()
    val isCreating by viewModel.isCreating.collectAsStateWithLifecycle()
    val convertingTaskId by viewModel.convertingTaskId.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(
            onOpenTask = onOpenTask,
            onBack = onBack,
            onPostAsNeighborTask = onPostAsNeighborTask,
        )
        viewModel.load()
    }

    Column(
        modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("mailTaskList"),
    ) {
        TopBar(mode = mode, onBack = viewModel::tapBack)
        if (mode == MailTaskListMode.Create) {
            CreateFrame(
                mailSender = viewModel.mailSender,
                mailSubject = viewModel.mailSubject,
                title = draftTitle,
                description = draftDescription,
                priority = draftPriority,
                isCreating = isCreating,
                onTitleChange = viewModel::updateDraftTitle,
                onDescriptionChange = viewModel::updateDraftDescription,
                onPriorityChange = viewModel::updateDraftPriority,
                onCreate = viewModel::create,
                onSeeAll = viewModel::cancelCreate,
                onPostAsNeighborTask = viewModel::postAsNeighborTask,
            )
        } else {
            when (val current = state) {
                is MailTaskListUiState.Loading -> LoadingFrame()
                is MailTaskListUiState.Empty ->
                    EmptyState(
                        icon = PantopusIcon.ListChecks,
                        headline = "No mail tasks",
                        subcopy = "Open a mail item and tap “Create task” to get started.",
                        modifier = Modifier.testTag("mailTaskList_empty"),
                        ctaTitle = "Refresh",
                        onCta = viewModel::refresh,
                    )
                is MailTaskListUiState.Error ->
                    ErrorState(
                        headline = "Couldn't load your mail tasks",
                        message = current.message,
                        modifier = Modifier.testTag("mailTaskList_error"),
                        onRetry = viewModel::refresh,
                    )
                is MailTaskListUiState.Loaded ->
                    ListFrame(
                        active = current.active,
                        completed = current.completed,
                        showsCompleted = showsCompleted,
                        convertingTaskId = convertingTaskId,
                        onToggleCompleted = viewModel::toggleShowCompleted,
                        onToggle = viewModel::toggle,
                        onOpen = viewModel::openTask,
                        onConvert = viewModel::requestConvert,
                    )
            }
        }
    }

    alert?.let { pending ->
        AlertDialog(
            onDismissRequest = viewModel::dismissAlert,
            title = { Text(pending.title) },
            text = { Text(pending.message) },
            confirmButton = {
                TextButton(onClick = viewModel::dismissAlert) { Text("OK") }
            },
        )
    }

    convertTarget?.let { row ->
        AlertDialog(
            onDismissRequest = viewModel::dismissConvert,
            title = { Text(row.title) },
            text = { Text(row.detail.ifBlank { "No description" }) },
            confirmButton = {
                TextButton(
                    onClick = viewModel::confirmConvert,
                    modifier = Modifier.testTag("mailTaskList_convert_confirm"),
                ) { Text("Post as Task") }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissConvert) { Text("Close") }
            },
        )
    }
}

// ─── Top bar ──────────────────────────────────────────────────

@Composable
private fun TopBar(
    mode: MailTaskListMode,
    onBack: () -> Unit,
) {
    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .height(48.dp)
                    .padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.sm))
                        .clickable(onClick = onBack)
                        .padding(horizontal = Spacing.s1, vertical = 6.dp)
                        .semantics { contentDescription = "Back to Mailbox" }
                        .testTag("mailTaskList_back"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = null,
                    size = 22.dp,
                    tint = PantopusColors.primary600,
                )
                Text(text = "Mailbox", fontSize = 15.sp, color = PantopusColors.primary600)
            }
            Spacer(Modifier.weight(1f))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.categoryTask),
                )
                Text(
                    text = if (mode == MailTaskListMode.Create) "NEW TASK" else "MAIL TASKS",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                    color = PantopusColors.appTextStrong,
                )
            }
            Spacer(Modifier.weight(1f))
            Spacer(Modifier.size(72.dp))
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
    }
}

// ─── Frames ───────────────────────────────────────────────────

@Composable
private fun LoadingFrame() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s4)
                .testTag("mailTaskList_loading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 160.dp, height = 21.dp)
        repeat(3) {
            Shimmer(width = 320.dp, height = 92.dp, cornerRadius = Radii.xl)
        }
    }
}

@Composable
private fun ListFrame(
    active: List<MailTaskRow>,
    completed: List<MailTaskRow>,
    showsCompleted: Boolean,
    convertingTaskId: String?,
    onToggleCompleted: () -> Unit,
    onToggle: (MailTaskRow) -> Unit,
    onOpen: (MailTaskRow) -> Unit,
    onConvert: (MailTaskRow) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "${active.size} active · ${completed.size} completed",
            fontSize = 11.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.testTag("mailTaskList_counts"),
        )
        active.forEach { row ->
            TaskCardRow(
                row = row,
                isConverting = convertingTaskId == row.id,
                onToggle = { onToggle(row) },
                onOpen = { onOpen(row) },
                onConvert = { onConvert(row) },
            )
        }
        if (completed.isNotEmpty()) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.sm))
                        .clickable(onClick = onToggleCompleted)
                        .padding(vertical = 10.dp)
                        .testTag("mailTaskList_completedToggle"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Completed (${completed.size})",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextSecondary,
                )
                Spacer(Modifier.weight(1f))
                PantopusIconImage(
                    icon = if (showsCompleted) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                    contentDescription = null,
                    size = 17.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
            if (showsCompleted) {
                completed.forEach { row ->
                    TaskCardRow(
                        row = row,
                        isConverting = convertingTaskId == row.id,
                        onToggle = { onToggle(row) },
                        onOpen = { onOpen(row) },
                        onConvert = { onConvert(row) },
                    )
                }
            }
        }
        Spacer(Modifier.height(Spacing.s10))
    }
}

@Composable
private fun TaskCardRow(
    row: MailTaskRow,
    isConverting: Boolean,
    onToggle: () -> Unit,
    onOpen: () -> Unit,
    onConvert: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .clickable(onClick = onOpen)
                .padding(14.dp)
                .testTag("mailTaskList_row_${row.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onToggle)
                        .semantics {
                            contentDescription =
                                if (row.isDone) "Reopen ${row.title}" else "Complete ${row.title}"
                        }
                        .testTag("mailTaskList_toggle_${row.id}"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = if (row.isDone) PantopusIcon.CheckCircle else PantopusIcon.Circle,
                    contentDescription = null,
                    size = 22.dp,
                    tint = if (row.isDone) PantopusColors.success else PantopusColors.appTextSecondary,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = row.title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextStrong,
                    textDecoration = if (row.isDone) TextDecoration.LineThrough else TextDecoration.None,
                )
                row.mailSender?.takeIf { it.isNotBlank() }?.let {
                    Text(
                        text = it,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                row.mailPreview?.takeIf { it.isNotBlank() }?.let {
                    Text(text = it, fontSize = 11.sp, color = PantopusColors.appTextSecondary, maxLines = 2)
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    PriorityPill(row.priority)
                    row.dueLabel?.let {
                        Text(
                            text = it,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
            }
        }
        if (row.isConvertedToGig) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.businessBg)
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.UsersRound,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.business,
                )
                Text(
                    text = "Posted as a neighbor task",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.business,
                )
            }
        } else if (!row.isDone) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(40.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.businessBg)
                        .clickable(enabled = !isConverting, onClick = onConvert)
                        .testTag("mailTaskList_convert_${row.id}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.UsersRound,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.business,
                )
                Spacer(Modifier.size(Spacing.s2))
                Text(
                    text = if (isConverting) "Posting…" else "Convert to neighbor gig",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.business,
                )
            }
        }
    }
}

@Composable
private fun PriorityPill(priority: MailTaskPriority) {
    Text(
        text = priority.label,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        color = priority.foreground,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(priority.background)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
    )
}

// ─── Create frame ─────────────────────────────────────────────

@Composable
private fun CreateFrame(
    mailSender: String?,
    mailSubject: String?,
    title: String,
    description: String,
    priority: MailTaskPriority,
    isCreating: Boolean,
    onTitleChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    onPriorityChange: (MailTaskPriority) -> Unit,
    onCreate: () -> Unit,
    onSeeAll: () -> Unit,
    onPostAsNeighborTask: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        mailSender?.takeIf { it.isNotBlank() }?.let { sender ->
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.warningBg)
                        .padding(Spacing.s3)
                        .testTag("mailTaskList_mailRef"),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(text = sender, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.warning)
                mailSubject?.takeIf { it.isNotBlank() }?.let {
                    Text(text = it, fontSize = 11.sp, color = PantopusColors.warning, maxLines = 2)
                }
            }
        }

        SectionCard(label = "TASK DETAILS") {
            OutlinedTextField(
                value = title,
                onValueChange = onTitleChange,
                label = { Text("Task title") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("mailTaskList_field_title"),
            )
            Spacer(Modifier.size(Spacing.s2))
            OutlinedTextField(
                value = description,
                onValueChange = onDescriptionChange,
                label = { Text("Description (optional)") },
                minLines = 3,
                modifier = Modifier.fillMaxWidth().testTag("mailTaskList_field_description"),
            )
        }

        SectionCard(label = "PRIORITY") {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
                // RN orders the selector low → medium → high (tasks.tsx:193).
                listOf(
                    MailTaskPriority.Low,
                    MailTaskPriority.Medium,
                    MailTaskPriority.High,
                ).forEach { option ->
                    PriorityButton(
                        option = option,
                        selected = option == priority,
                        onClick = { onPriorityChange(option) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.primary600)
                    .clickable(enabled = !isCreating, onClick = onCreate)
                    .testTag("mailTaskList_create"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 17.dp,
                tint = PantopusColors.appTextInverse,
            )
            Spacer(Modifier.size(Spacing.s2))
            Text(
                text = if (isCreating) "Creating…" else "Create Task",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }

        // A17.8 → "Ask a Neighbor". RN's escalation out of the task pipeline
        // (`src/app/mailbox/tasks.tsx:231-240`).
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(46.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.businessBg)
                    .clickable(onClick = onPostAsNeighborTask)
                    .testTag("mailTaskList_postAsNeighborTask"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.UsersRound,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.business,
            )
            Spacer(Modifier.size(Spacing.s2))
            Text(
                text = "Post as Neighbor Task Instead",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.business,
            )
        }

        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurfaceSunken)
                    .clickable(onClick = onSeeAll)
                    .testTag("mailTaskList_seeAll"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            Text(
                text = "See all mail tasks",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
        Spacer(Modifier.height(Spacing.s10))
    }
}

@Composable
private fun PriorityButton(
    option: MailTaskPriority,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(if (selected) option.background else PantopusColors.appSurfaceSunken)
                .clickable(onClick = onClick)
                .padding(vertical = 9.dp)
                .testTag("mailTaskList_priority_${option.wireValue()}"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = option.name,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = if (selected) option.foreground else PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun SectionCard(
    label: String,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
        )
        content()
    }
}
