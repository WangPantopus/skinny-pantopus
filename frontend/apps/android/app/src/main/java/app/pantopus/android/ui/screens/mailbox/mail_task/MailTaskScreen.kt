@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

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
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.mailbox.mail_task.components.DueSnoozeCard
import app.pantopus.android.ui.screens.mailbox.mail_task.components.NextUpCard
import app.pantopus.android.ui.screens.mailbox.mail_task.components.SourceMailCard
import app.pantopus.android.ui.screens.mailbox.mail_task.components.SubtaskChecklist
import app.pantopus.android.ui.screens.mailbox.mail_task.components.TaskCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.12 — Mail-task detail screen. Mirrors iOS `MailTaskView`. A task
 * Pantopus auto-extracted from a piece of mail, with two frames driven
 * by [MailTaskViewModel]:
 *
 * - open — header row, [TaskCard], the task AI-elf strip, [DueSnoozeCard],
 *   [SubtaskChecklist], [SourceMailCard], a delegate hint, and a sticky
 *   action dock (Mark done · Snooze · Delegate).
 * - done — [TaskCard] (struck title), the "Submitted" elf, a "What got
 *   filed" completion summary, the all-checked checklist, [SourceMailCard],
 *   a [NextUpCard] suggestion, and a reopen / view-confirmation / archive
 *   dock.
 */
@Composable
fun MailTaskScreen(
    onBack: () -> Unit,
    onOpenMail: (String) -> Unit = {},
    viewModel: MailTaskViewModel = hiltViewModel(),
    seed: MailTaskSeed? = null,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val showsDelegate by viewModel.showsDelegateSheet.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onOpenMail = onOpenMail, onBack = onBack)
        // A non-null seed is the preview/test seam; live leaves it null to fetch.
        seed?.let { viewModel.configureSeed(it) }
        viewModel.load()
    }
    LaunchedEffect(toast) {
        if (toast != null) {
            kotlinx.coroutines.delay(1_800)
            viewModel.consumeToast()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("mailTask"),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            TopBar(onBack = { viewModel.tapBack() })
            when (val current = state) {
                MailTaskUiState.Loading -> MailTaskLoadingBody(modifier = Modifier.weight(1f))
                is MailTaskUiState.Loaded -> LoadedBody(content = current.content, viewModel = viewModel, modifier = Modifier.weight(1f))
                is MailTaskUiState.Error ->
                    MailTaskErrorBody(
                        message = current.message,
                        onRetry = { viewModel.retry() },
                        modifier = Modifier.weight(1f),
                    )
            }
        }

        if (showsDelegate) {
            DelegateSheet(onDismiss = { viewModel.dismissDelegateSheet() })
        }

        if (toast != null) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 120.dp),
            ) {
                Text(
                    text = toast.orEmpty(),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextInverse,
                    modifier =
                        Modifier
                            .clip(CircleShape)
                            .background(PantopusColors.appText.copy(alpha = 0.9f))
                            .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
                )
            }
        }
    }
}

// MARK: - Top bar

@Composable
private fun TopBar(onBack: () -> Unit) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .background(PantopusColors.appSurface),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1 + 2.dp)) {
            Box(
                modifier = Modifier.size(8.dp).clip(CircleShape).background(PantopusColors.categoryTask),
            )
            Text(
                text = "TASK",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextStrong,
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .clickable { onBack() }
                        .padding(horizontal = 6.dp, vertical = Spacing.s2)
                        .testTag("mailTask_back"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back to Mailbox",
                    size = 22.dp,
                    tint = PantopusColors.primary600,
                )
                Text(text = "Mailbox", fontSize = 15.sp, fontWeight = FontWeight.Medium, color = PantopusColors.primary600)
            }
            Spacer(modifier = Modifier.weight(1f))
            NavIcon(icon = PantopusIcon.Share, label = "Share")
            NavIcon(icon = PantopusIcon.MoreHorizontal, label = "More")
        }
        Box(modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
    }
}

@Composable
private fun NavIcon(
    icon: PantopusIcon,
    label: String,
) {
    Box(
        modifier =
            Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceSunken),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = label, size = 18.dp, tint = PantopusColors.appTextStrong)
    }
}

// MARK: - Loaded body

@Composable
private fun LoadedBody(
    content: MailTaskContent,
    viewModel: MailTaskViewModel,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(top = Spacing.s3, bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // The AI elf, subtask checklist, snooze, completion summary,
            // next-up, and delegate hint have no backend source on the live
            // task API, so they only render when the projection carries them
            // (the sample/preview path) — never faked from live data.
            HeaderRow(content = content)
            TaskCard(content = content)
            content.elf?.let { TaskElfStrip(elf = it) }
            if (content.isDone) {
                content.completion?.let { CompletionSummaryCard(completion = it) }
                if (content.subtasks.isNotEmpty()) {
                    SubtaskChecklist(
                        subtasks = content.subtasks,
                        allDone = true,
                        onToggle = { viewModel.toggleSubtask(it) },
                        onAddStep = { viewModel.addStep() },
                    )
                }
                content.source?.let { source ->
                    SourceMailCard(source = source, onOpen = { viewModel.openSourceMail() })
                }
                content.nextUp?.let { nextUp ->
                    NextUpCard(nextUp = nextUp, onOpen = { viewModel.openNextUp() })
                }
            } else {
                if (content.due != null && content.snoozeOptions.isNotEmpty()) {
                    DueSnoozeCard(
                        due = content.due,
                        options = content.snoozeOptions,
                        onSnooze = { viewModel.snooze(it) },
                    )
                }
                if (content.subtasks.isNotEmpty()) {
                    SubtaskChecklist(
                        subtasks = content.subtasks,
                        allDone = false,
                        onToggle = { viewModel.toggleSubtask(it) },
                        onAddStep = { viewModel.addStep() },
                    )
                }
                content.source?.let { source ->
                    SourceMailCard(source = source, onOpen = { viewModel.openSourceMail() })
                }
                if (content.elf != null) {
                    DelegateHintCard(onTap = { viewModel.delegate() })
                }
            }
        }
        ActionDock(content = content, viewModel = viewModel)
    }
}

@Composable
private fun HeaderRow(content: MailTaskContent) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1 + 2.dp)) {
        Row(
            modifier =
                Modifier
                    .clip(CircleShape)
                    .background(PantopusColors.successBg)
                    .padding(horizontal = Spacing.s2, vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = 11.dp,
                tint = PantopusColors.success,
            )
            Text(text = "Verified", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = PantopusColors.success)
        }
        Row(
            modifier =
                Modifier
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = Spacing.s2, vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(PantopusColors.categoryTask))
            Text(text = "Task", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextStrong)
        }
        Spacer(modifier = Modifier.weight(1f))
        Text(text = content.timeLabel, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
    }
}

// MARK: - Action dock

@Composable
private fun ActionDock(
    content: MailTaskContent,
    viewModel: MailTaskViewModel,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s3, bottom = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
        if (content.isDone) {
            DockPrimary(
                icon = PantopusIcon.Undo2,
                label = "Reopen task",
                filled = false,
                onClick = { viewModel.reopen() },
                modifier = Modifier.testTag("mailTask_reopen"),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                DockChip(
                    icon = PantopusIcon.FileText,
                    label = "View confirmation",
                    onClick = { viewModel.viewConfirmation() },
                    modifier = Modifier.weight(1f).testTag("mailTask_dock_viewConfirmation"),
                )
                DockChip(
                    icon = PantopusIcon.Archive,
                    label = "Archive",
                    onClick = { viewModel.archive() },
                    modifier = Modifier.weight(1f).testTag("mailTask_dock_archive"),
                )
            }
        } else {
            DockPrimary(
                icon = PantopusIcon.Check,
                label = "Mark done",
                filled = true,
                onClick = { viewModel.markDone() },
                modifier = Modifier.testTag("mailTask_markDone"),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                DockChip(
                    icon = PantopusIcon.Clock,
                    label = "Snooze",
                    onClick = { viewModel.snoozeFromDock() },
                    modifier = Modifier.weight(1f).testTag("mailTask_dock_snooze"),
                )
                DockChip(
                    icon = PantopusIcon.UserPlus,
                    label = "Delegate",
                    onClick = { viewModel.delegate() },
                    modifier = Modifier.weight(1f).testTag("mailTask_dock_delegate"),
                )
                DockChip(
                    icon = PantopusIcon.CalendarPlus,
                    label = "Calendar",
                    onClick = { viewModel.addToCalendar() },
                    modifier = Modifier.weight(1f).testTag("mailTask_dock_calendar"),
                )
            }
        }
    }
}

@Composable
private fun DockPrimary(
    icon: PantopusIcon,
    label: String,
    filled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val background = if (filled) PantopusColors.primary600 else PantopusColors.appSurface
    val foreground = if (filled) PantopusColors.appTextInverse else PantopusColors.primary700
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(background)
                .then(
                    if (filled) {
                        Modifier
                    } else {
                        Modifier.border(1.5.dp, PantopusColors.primary200, RoundedCornerShape(14.dp))
                    },
                )
                .clickable { onClick() }
                .padding(vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 17.dp, tint = foreground)
        Spacer(modifier = Modifier.size(Spacing.s2))
        Text(text = label, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = foreground)
    }
}

@Composable
private fun DockChip(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable { onClick() }
                .padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = label, size = 17.dp, tint = PantopusColors.appTextStrong)
        Text(
            text = label,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
            maxLines = 1,
        )
    }
}

@Composable
private fun DelegateSheet(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = "Hand this off") },
        text = {
            Text(
                text = "Delegate to someone in your Home drawer.",
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
            )
        },
        confirmButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.testTag("mailTask_delegate_homeDrawer"),
            ) {
                Text(text = "Delegate · Home drawer", color = PantopusColors.primary600)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = "Cancel", color = PantopusColors.appTextSecondary)
            }
        },
    )
}
