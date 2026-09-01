@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "UNUSED_PARAMETER")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.compose.foundation.background
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
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.scheduling.WorkflowDto
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillStatus
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStatusPill
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

private const val ACTION_TOAST_MS = 2200L

/**
 * Stream A16 — H2 Workflows List (full screen). Mirrors `workflows-list-frames.jsx`:
 * a top bar + scope tab strip (Global / This event type), a pinned "Default
 * reminders" card that opens the H1 sheet, a "Your workflows" group of rows
 * (trigger glyph, plain-English trigger, action + channel, status pill, toggle),
 * and a create FAB. Frames: populated · empty · loading shimmer · error retry ·
 * permission-gated.
 */
@OptIn(ExperimentalMaterialApi::class)
@Composable
fun WorkflowsListScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: WorkflowsListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val scope by viewModel.scope.collectAsStateWithLifecycle()
    val actionError by viewModel.actionError.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
    var showReminders by remember { mutableStateOf(false) }
    val accent = viewModel.pillar.accent
    val pullState = rememberPullRefreshState(refreshing = isRefreshing, onRefresh = viewModel::refresh)

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(actionError) {
        if (actionError != null) {
            delay(ACTION_TOAST_MS)
            viewModel.clearActionError()
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("scheduling.workflows.list")) {
        Column(modifier = Modifier.fillMaxSize()) {
            AutoTopBar(
                title = "Workflows",
                leading = AutoLeading.Back,
                onLeading = onBack,
                trailing = {
                    Box(
                        modifier =
                            Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(Radii.md))
                                .clickable(onClickLabel = "New workflow") { onNavigate(viewModel.createWorkflowRoute()) },
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Plus,
                            contentDescription = "New workflow",
                            size = 19.dp,
                            strokeWidth = 2.2f,
                            tint = PantopusColors.primary600,
                        )
                    }
                },
            )
            AutoUnderlineTabs(
                tabs = listOf("Global", "This event type"),
                selectedIndex = scope.ordinal,
                accent = accent,
                onSelect = viewModel::selectScope,
            )
            Box(modifier = Modifier.weight(1f).fillMaxWidth().pullRefresh(pullState)) {
                when (val s = state) {
                    WorkflowsListUiState.Loading -> WorkflowsLoading()
                    is WorkflowsListUiState.Error ->
                        AutoErrorView(
                            message = s.message,
                            onRetry = viewModel::load,
                            headline = "Couldn't load workflows",
                            asCard = true,
                            modifier = Modifier.testTag("scheduling.workflows.error"),
                        )
                    is WorkflowsListUiState.Loaded ->
                        WorkflowsLoaded(
                            state = s,
                            scope = scope,
                            accent = accent,
                            accentBg = viewModel.pillar.accentBg,
                            onOpenReminders = { showReminders = true },
                            onCreate = { onNavigate(viewModel.createWorkflowRoute()) },
                            onOpenWorkflow = { onNavigate(viewModel.workflowRoute(it.id)) },
                            onToggle = viewModel::toggleActive,
                        )
                }
                PullRefreshIndicator(
                    refreshing = isRefreshing,
                    state = pullState,
                    modifier = Modifier.align(Alignment.TopCenter),
                    contentColor = PantopusColors.primary600,
                )
            }
        }

        val loaded = state as? WorkflowsListUiState.Loaded
        if (loaded != null && !loaded.isGated) {
            AutoFAB(
                onClick = { onNavigate(viewModel.createWorkflowRoute()) },
                accessibilityLabel = "New workflow",
                accent = PantopusColors.primary600,
                modifier = Modifier.align(Alignment.BottomEnd).padding(end = Spacing.s4, bottom = Spacing.s6).testTag("automationsFAB"),
            )
        }

        actionError?.let { msg ->
            AutoToast(
                text = msg,
                icon = PantopusIcon.AlertTriangle,
                tint = PantopusColors.warning,
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = Spacing.s10),
            )
        }
    }

    if (showReminders) {
        RemindersQuickSetupSheet(
            onDismiss = {
                showReminders = false
                // Silent refetch (keeps Loaded content, no pull indicator).
                viewModel.load()
            },
        )
    }
}

@Composable
private fun WorkflowsLoaded(
    state: WorkflowsListUiState.Loaded,
    scope: WorkflowsListViewModel.Scope,
    accent: androidx.compose.ui.graphics.Color,
    accentBg: androidx.compose.ui.graphics.Color,
    onOpenReminders: () -> Unit,
    onCreate: () -> Unit,
    onOpenWorkflow: (WorkflowDto) -> Unit,
    onToggle: (WorkflowDto) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        if (state.isGated) {
            AutoNote(tone = AutoTone.Warning, icon = PantopusIcon.Lock, text = "Only admins can edit these workflows.")
        } else {
            RemindersGroup(summary = state.remindersSummary, accent = accent, accentBg = accentBg, onClick = onOpenReminders)
        }

        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            AutoOverline(text = "Your workflows", modifier = Modifier.padding(horizontal = 2.dp))
            val visible = state.visible(scope)
            if (visible.isEmpty()) {
                WorkflowsEmpty(scope = scope, gated = state.isGated, accent = accent, accentBg = accentBg, onCreate = onCreate)
            } else {
                AutoCard {
                    visible.forEachIndexed { idx, workflow ->
                        WorkflowRow(
                            workflow = workflow,
                            active = state.isActive(workflow),
                            gated = state.isGated,
                            onOpen = { onOpenWorkflow(workflow) },
                            onToggle = { onToggle(workflow) },
                        )
                        if (idx < visible.size - 1) AutoRowDivider()
                    }
                }
            }
        }
        Box(modifier = Modifier.size(80.dp))
    }
}

@Composable
private fun RemindersGroup(
    summary: String,
    accent: androidx.compose.ui.graphics.Color,
    accentBg: androidx.compose.ui.graphics.Color,
    onClick: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        AutoOverline(text = "Reminders", modifier = Modifier.padding(horizontal = 2.dp))
        AutoCard(horizontal = 13.dp, vertical = 4.dp) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onClick)
                        .padding(vertical = 11.dp)
                        .testTag("workflows.defaultRemindersCard"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(11.dp),
            ) {
                AutoIconTile(icon = PantopusIcon.Bell, bg = accentBg, fg = accent)
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = "Default reminders", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
                    Text(text = summary, fontSize = 11.sp, color = PantopusColors.appTextSecondary, modifier = Modifier.padding(top = 1.dp))
                }
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = ICON_16,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

@Composable
private fun WorkflowRow(
    workflow: WorkflowDto,
    active: Boolean,
    gated: Boolean,
    onOpen: () -> Unit,
    onToggle: () -> Unit,
) {
    val trigger = WorkflowTrigger.fromWire(workflow.trigger)
    val channel = WorkflowChannel.fromWire(workflow.action)
    val actionLabel = workflow.name.trim().ifBlank { channel.actionSummary }
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 11.dp).alpha(if (gated) 0.5f else 1f).testTag("workflows.row.${workflow.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Row(
            modifier = Modifier.weight(1f).clickable(onClick = onOpen),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            AutoIconTile(icon = trigger.icon, bg = PantopusColors.appSurfaceSunken, fg = PantopusColors.appTextStrong)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = trigger.summary(workflow.offsetMinutes ?: 0),
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    PantopusIconImage(icon = channel.icon, contentDescription = null, size = 12.dp, tint = PantopusColors.appTextMuted)
                    Text(text = actionLabel, fontSize = 10.5.sp, color = PantopusColors.appTextSecondary, maxLines = 1)
                }
                SchedulingStatusPill(
                    status = if (active) SchedulingPillStatus.Active else SchedulingPillStatus.Paused,
                    modifier = Modifier.padding(top = 5.dp),
                )
            }
        }
        if (!gated) {
            Switch(
                checked = active,
                onCheckedChange = { onToggle() },
                colors =
                    SwitchDefaults.colors(
                        checkedThumbColor = PantopusColors.appSurface,
                        checkedTrackColor = PantopusColors.primary600,
                        uncheckedThumbColor = PantopusColors.appSurface,
                        uncheckedTrackColor = PantopusColors.appBorderStrong,
                    ),
            )
        }
    }
}

@Composable
private fun WorkflowsEmpty(
    scope: WorkflowsListViewModel.Scope,
    gated: Boolean,
    accent: androidx.compose.ui.graphics.Color,
    accentBg: androidx.compose.ui.graphics.Color,
    onCreate: () -> Unit,
) {
    if (scope == WorkflowsListViewModel.Scope.Global) {
        AutoInlineEmpty(
            icon = PantopusIcon.Workflow,
            headline = "No follow-ups yet",
            subcopy = "Reminders are handled. Add a thank-you or a review request to run automatically.",
            accent = accent,
            accentBg = accentBg,
            ctaTitle = if (gated) null else "Add a follow-up",
            onCta = if (gated) null else onCreate,
        )
    } else {
        AutoInlineEmpty(
            icon = PantopusIcon.Workflow,
            headline = "No event-type workflows",
            subcopy = "Workflows scoped to a single event type show up here. Add one from its editor.",
            accent = accent,
            accentBg = accentBg,
        )
    }
}

@Composable
private fun WorkflowsLoading() {
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s3, vertical = Spacing.s3)) {
        AutoCard {
            repeat(4) { idx ->
                AutoSkeletonRow()
                if (idx < 3) AutoRowDivider()
            }
        }
    }
}
