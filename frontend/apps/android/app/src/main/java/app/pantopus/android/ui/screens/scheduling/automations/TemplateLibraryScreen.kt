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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.scheduling.MessageTemplateDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

private const val ACTION_TOAST_MS = 2200L

/**
 * Stream A16 — H8 Message Template Library (full screen). Two grouped cards:
 * "Starter templates" (read-only seeds, duplicable) and "My templates" (from the
 * backend, editable). A create FAB; per-row overflow menu for edit / duplicate /
 * delete on owned templates. Empty keeps the starter card.
 */
@OptIn(ExperimentalMaterialApi::class)
@Composable
fun TemplateLibraryScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: TemplateLibraryViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val actionError by viewModel.actionError.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
    var searchActive by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<MessageTemplateDto?>(null) }
    val pullState = rememberPullRefreshState(refreshing = isRefreshing, onRefresh = viewModel::refresh)

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(actionError) {
        if (actionError != null) {
            delay(ACTION_TOAST_MS)
            viewModel.clearActionError()
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("scheduling.templates.library")) {
        Column(modifier = Modifier.fillMaxSize()) {
            AutoTopBar(
                title = "Templates",
                leading = AutoLeading.Back,
                onLeading = onBack,
                trailing = {
                    Box(
                        modifier = Modifier.size(40.dp).clickable(onClickLabel = "Search templates") { searchActive = !searchActive },
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Search,
                            contentDescription = "Search templates",
                            size = 18.dp,
                            tint = PantopusColors.primary600,
                        )
                    }
                },
            )
            if (searchActive) {
                SearchField(query = query, onQueryChange = viewModel::setQuery)
            }
            Box(modifier = Modifier.weight(1f).fillMaxWidth().pullRefresh(pullState)) {
                when (val s = state) {
                    TemplateLibraryUiState.Loading -> LibraryLoading()
                    is TemplateLibraryUiState.Error ->
                        AutoErrorView(message = s.message, onRetry = viewModel::load, headline = "Couldn't load templates")
                    is TemplateLibraryUiState.Loaded ->
                        LibraryLoaded(
                            viewModel = viewModel,
                            query = query,
                            onOpen = { onNavigate(viewModel.templateRoute(it.id)) },
                            onCreate = { onNavigate(viewModel.createNewRoute()) },
                            onDelete = { deleteTarget = it },
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

        if (state is TemplateLibraryUiState.Loaded) {
            AutoFAB(
                onClick = { onNavigate(viewModel.createNewRoute()) },
                accessibilityLabel = "New template",
                accent = viewModel.pillar.accent,
                modifier = Modifier.align(Alignment.BottomEnd).padding(end = Spacing.s4, bottom = Spacing.s6).testTag("automationsFAB"),
            )
        }

        toast?.let { AutoToast(text = it, modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = Spacing.s10)) }
        actionError?.let {
            AutoToast(
                text = it,
                icon = PantopusIcon.AlertTriangle,
                tint = PantopusColors.warning,
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = Spacing.s10),
            )
        }
    }

    deleteTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete template?") },
            text = { Text("“${target.name}” will be removed. This can't be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.confirmDelete(target)
                    deleteTarget = null
                }) { Text("Delete", color = PantopusColors.error) }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun LibraryLoaded(
    viewModel: TemplateLibraryViewModel,
    query: String,
    onOpen: (MessageTemplateDto) -> Unit,
    onCreate: () -> Unit,
    onDelete: (MessageTemplateDto) -> Unit,
) {
    val accent = viewModel.pillar.accent
    val accentBg = viewModel.pillar.accentBg
    val starters = viewModel.visibleStarters
    val templates = viewModel.visibleTemplates
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        if (starters.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                AutoOverline(text = "Starter templates", modifier = Modifier.padding(horizontal = 2.dp))
                AutoCard(horizontal = 14.dp, vertical = Spacing.s0) {
                    starters.forEachIndexed { idx, starter ->
                        StarterRow(starter = starter, onTap = { viewModel.duplicateStarter(starter) })
                        if (idx < starters.size - 1) AutoRowDivider()
                    }
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            AutoOverline(text = "My templates", modifier = Modifier.padding(horizontal = 2.dp))
            if (templates.isEmpty()) {
                if (query.isBlank()) {
                    AutoInlineEmpty(
                        icon = PantopusIcon.FileText,
                        headline = "You haven't saved any yet",
                        subcopy = "Edit a starter or write your own to reuse in workflows.",
                        accent = accent,
                        accentBg = accentBg,
                        ctaTitle = "New template",
                        onCta = onCreate,
                    )
                } else {
                    AutoInlineEmpty(
                        icon = PantopusIcon.Search,
                        headline = "No templates match",
                        subcopy = "Try a different word.",
                        accent = accent,
                        accentBg = accentBg,
                    )
                }
            } else {
                AutoCard(horizontal = 14.dp, vertical = Spacing.s0) {
                    templates.forEachIndexed { idx, template ->
                        MyTemplateRow(
                            template = template,
                            onOpen = { onOpen(template) },
                            onDuplicate = { viewModel.duplicate(template) },
                            onDelete = { onDelete(template) },
                        )
                        if (idx < templates.size - 1) AutoRowDivider()
                    }
                }
            }
        }
        Box(modifier = Modifier.size(80.dp))
    }
}

@Composable
private fun StarterRow(
    starter: StarterTemplate,
    onTap: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onTap).padding(vertical = 11.dp).testTag("starterRow_${starter.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        AutoIconTile(icon = PantopusIcon.FileText, bg = PantopusColors.primary50, fg = PantopusColors.primary600)
        TemplateText(name = starter.name, preview = starter.body, channel = starter.channel, modifier = Modifier.weight(1f))
        PantopusIconImage(
            icon = PantopusIcon.Copy,
            contentDescription = "Duplicate ${starter.name}",
            size = 17.dp,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun MyTemplateRow(
    template: MessageTemplateDto,
    onOpen: () -> Unit,
    onDuplicate: () -> Unit,
    onDelete: () -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 11.dp).testTag("templateRow_${template.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Row(
            modifier = Modifier.weight(1f).clickable(onClick = onOpen),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            AutoIconTile(icon = PantopusIcon.FileText, bg = PantopusColors.primary50, fg = PantopusColors.primary600)
            TemplateText(
                name = template.name,
                preview = template.body.orEmpty(),
                channel = WorkflowChannel.fromWire(template.channel),
                modifier = Modifier.weight(1f),
            )
        }
        Box {
            Box(
                modifier = Modifier.size(36.dp).clickable(onClickLabel = "More actions for ${template.name}") { menuOpen = true },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MoreHorizontal,
                    contentDescription = "More actions for ${template.name}",
                    size = 18.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                DropdownMenuItem(text = { Text("Edit") }, onClick = {
                    menuOpen = false
                    onOpen()
                })
                DropdownMenuItem(text = { Text("Duplicate") }, onClick = {
                    menuOpen = false
                    onDuplicate()
                })
                DropdownMenuItem(text = { Text("Delete", color = PantopusColors.error) }, onClick = {
                    menuOpen = false
                    onDelete()
                })
            }
        }
    }
}

@Composable
private fun TemplateText(
    name: String,
    preview: String,
    channel: WorkflowChannel,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(text = name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText, maxLines = 1)
        Text(text = firstLine(preview), fontSize = 11.5.sp, color = PantopusColors.appTextSecondary, maxLines = 1)
        AutoChip(text = channel.label, icon = channel.icon, tone = AutoTone.Neutral)
    }
}

private fun firstLine(body: String): String = body.lineSequence().firstOrNull() ?: body

@Composable
private fun SearchField(
    query: String,
    onQueryChange: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .fillMaxWidth()
                .heightIn(min = 40.dp)
                .background(PantopusColors.appSurface, RoundedCornerShape(10.dp))
                .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Search, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextMuted)
        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (query.isEmpty()) {
                Text(text = "Search templates", fontSize = 14.sp, color = PantopusColors.appTextMuted)
            }
            BasicTextField(
                value = query,
                onValueChange = onQueryChange,
                singleLine = true,
                textStyle = TextStyle(fontSize = 14.sp, color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun LibraryLoading() {
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s3, vertical = Spacing.s4)) {
        AutoCard {
            repeat(4) { idx ->
                AutoSkeletonRow(showTrailingPill = false)
                if (idx < 3) AutoRowDivider()
            }
        }
    }
}
