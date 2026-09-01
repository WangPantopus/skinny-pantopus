@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.businesses.page_blocks

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.Toast
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * C4 — the block-based business Page builder. A separate surface from
 * `EditBusinessPageScreen` (which edits business *profile* fields): this one
 * drives `/api/businesses/:id/pages/:pageId/blocks`, `…/publish` and
 * `…/revisions`. Mirrors RN `src/app/businesses/[id]/page-editor.tsx` and iOS
 * `BusinessPageBlocksView`.
 */
@Composable
fun BusinessPageBlocksScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: BusinessPageBlocksViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val blocks by viewModel.blocks.collectAsStateWithLifecycle()
    val isPreviewing by viewModel.isPreviewing.collectAsStateWithLifecycle()
    val hasChanges by viewModel.hasChanges.collectAsStateWithLifecycle()
    val isSaving by viewModel.isSaving.collectAsStateWithLifecycle()
    val isPublishing by viewModel.isPublishing.collectAsStateWithLifecycle()
    val publishedRevision by viewModel.publishedRevision.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()

    var showsPicker by remember { mutableStateOf(false) }
    var editingIndex by remember { mutableStateOf<Int?>(null) }
    var pendingDeleteIndex by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(Unit) { viewModel.load() }

    Box(modifier = modifier.fillMaxSize().background(PantopusColors.appBg).testTag("businessPageBlocks.screen")) {
        Column(modifier = Modifier.fillMaxSize()) {
            ContentDetailTopBar(
                title = viewModel.pageTitle.ifEmpty { "Page editor" },
                onBack = onBack,
                action =
                    ContentDetailTopBarAction(
                        icon = if (isPreviewing) PantopusIcon.Pencil else PantopusIcon.Eye,
                        contentDescription = if (isPreviewing) "Exit preview" else "Preview",
                        onClick = { viewModel.togglePreview() },
                    ),
            )
            when (val current = state) {
                BusinessPageBlocksUiState.Loading -> LoadingSkeleton(modifier = Modifier.weight(1f))
                is BusinessPageBlocksUiState.Error ->
                    ErrorState(
                        headline = "Couldn't load this page",
                        message = current.message,
                        onRetry = viewModel::refresh,
                        modifier = Modifier.weight(1f).testTag("businessPageBlocks.error"),
                    )
                is BusinessPageBlocksUiState.Loaded ->
                    if (isPreviewing) {
                        PreviewMode(
                            blocks = blocks,
                            onExit = { viewModel.setPreviewing(false) },
                            modifier = Modifier.weight(1f),
                        )
                    } else {
                        EditorMode(
                            modifier = Modifier.weight(1f),
                            blocks = blocks,
                            hasChanges = hasChanges,
                            isSaving = isSaving,
                            isPublishing = isPublishing,
                            publishedRevision = publishedRevision,
                            onAdd = { showsPicker = true },
                            onEdit = { editingIndex = it },
                            onMoveUp = viewModel::moveUp,
                            onMoveDown = viewModel::moveDown,
                            onDelete = { pendingDeleteIndex = it },
                            onSaveDraft = viewModel::saveDraft,
                            onPublish = viewModel::publishPage,
                        )
                    }
            }
        }

        toast?.let { text ->
            Toast(
                message = ToastMessage(text = text, kind = ToastKind.Neutral),
                modifier = Modifier.align(Alignment.BottomCenter).padding(Spacing.s16),
            )
            LaunchedEffect(text) {
                kotlinx.coroutines.delay(TOAST_MILLIS)
                viewModel.consumeToast()
            }
        }
    }

    if (showsPicker) {
        BusinessPageBlockTypePicker(
            onSelect = { kind ->
                showsPicker = false
                editingIndex = viewModel.addBlock(kind)
            },
            onDismiss = { showsPicker = false },
        )
    }

    editingIndex?.let { index ->
        blocks.getOrNull(index)?.let { block ->
            BusinessPageBlockEditorSheet(
                block = block,
                onSave = {
                    viewModel.updateBlock(index, it)
                    editingIndex = null
                },
                onDismiss = { editingIndex = null },
            )
        }
    }

    pendingDeleteIndex?.let { index ->
        AlertDialog(
            onDismissRequest = { pendingDeleteIndex = null },
            title = { Text(text = "Delete block", style = PantopusTextStyle.h3) },
            text = {
                Text(
                    text = "Remove this block? It disappears from the draft until you add it again.",
                    style = PantopusTextStyle.small,
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteBlock(index)
                        pendingDeleteIndex = null
                    },
                    modifier = Modifier.testTag("businessPageBlocks.deleteConfirm"),
                ) {
                    Text(text = "Delete block", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDeleteIndex = null }) { Text(text = "Cancel") }
            },
        )
    }
}

private const val TOAST_MILLIS = 2_000L

@Composable
private fun LoadingSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize().padding(Spacing.s4).testTag("businessPageBlocks.loading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(4) {
            Shimmer(width = 320.dp, height = 72.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun PreviewMode(
    blocks: List<BusinessPageBlock>,
    onExit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize().testTag("businessPageBlocks.previewMode")) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.warningBg)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Eye,
                contentDescription = null,
                tint = PantopusColors.warning,
            )
            Text(
                text = "Preview mode — changes not saved",
                style = PantopusTextStyle.small,
                color = PantopusColors.warning,
            )
        }
        Column(
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(Spacing.s4),
        ) {
            BusinessPageBlocksPreview(blocks = blocks)
        }
        Column(modifier = Modifier.background(PantopusColors.appSurface).padding(Spacing.s4)) {
            PrimaryButton(
                title = "Exit preview",
                onClick = onExit,
                modifier = Modifier.testTag("businessPageBlocks.exitPreview"),
            )
        }
    }
}

@Composable
private fun EditorMode(
    blocks: List<BusinessPageBlock>,
    hasChanges: Boolean,
    isSaving: Boolean,
    isPublishing: Boolean,
    publishedRevision: Int,
    onAdd: () -> Unit,
    onEdit: (Int) -> Unit,
    onMoveUp: (Int) -> Unit,
    onMoveDown: (Int) -> Unit,
    onDelete: (Int) -> Unit,
    onSaveDraft: () -> Unit,
    onPublish: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize()) {
        RevisionStrip(publishedRevision = publishedRevision, hasChanges = hasChanges)
        if (blocks.isEmpty()) {
            Box(modifier = Modifier.weight(1f)) {
                EmptyState(
                    icon = PantopusIcon.Package,
                    headline = "No blocks yet",
                    subcopy = "Add blocks to build your page content.",
                    ctaTitle = "Add block",
                    onCta = onAdd,
                    modifier = Modifier.testTag("businessPageBlocks.empty"),
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f).padding(Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                itemsIndexed(items = blocks, key = { _, block -> block.localId }) { index, block ->
                    BlockCard(
                        block = block,
                        index = index,
                        isLast = index == blocks.lastIndex,
                        onEdit = { onEdit(index) },
                        onMoveUp = { onMoveUp(index) },
                        onMoveDown = { onMoveDown(index) },
                        onDelete = { onDelete(index) },
                    )
                }
            }
        }
        BottomBar(
            hasChanges = hasChanges,
            isSaving = isSaving,
            isPublishing = isPublishing,
            canPublish = blocks.isNotEmpty(),
            onAdd = onAdd,
            onSaveDraft = onSaveDraft,
            onPublish = onPublish,
        )
    }
}

@Composable
private fun RevisionStrip(
    publishedRevision: Int,
    hasChanges: Boolean,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (publishedRevision > 0) {
            Text(
                text = "v$publishedRevision",
                style = PantopusTextStyle.caption,
                color = PantopusColors.success,
                modifier = Modifier.testTag("businessPageBlocks.publishedRevision"),
            )
        } else {
            Text(
                text = "Unpublished",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextMuted,
            )
        }
        if (hasChanges) {
            Box(
                modifier =
                    Modifier
                        .size(6.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.warning),
            )
            Text(
                text = "Unsaved",
                style = PantopusTextStyle.caption,
                color = PantopusColors.warning,
                modifier = Modifier.testTag("businessPageBlocks.unsaved"),
            )
        }
    }
}

@Composable
private fun BlockCard(
    block: BusinessPageBlock,
    index: Int,
    isLast: Boolean,
    onEdit: () -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onDelete: () -> Unit,
) {
    val entry = BusinessPageBlockRegistry.entry(block.kind)
    val borderColor = if (block.isVisible) PantopusColors.appBorder else PantopusColors.warningLight
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, borderColor, RoundedCornerShape(Radii.md)),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onEdit)
                    .padding(Spacing.s3)
                    .testTag("businessPageBlocks.block.$index"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary50),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = entry.icon,
                    contentDescription = null,
                    tint = PantopusColors.primary600,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(text = entry.label, style = PantopusTextStyle.body, color = PantopusColors.appTextStrong)
                Text(
                    text = block.summaryLine,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                )
            }
            if (!block.isVisible) {
                PantopusIconImage(
                    icon = PantopusIcon.EyeOff,
                    contentDescription = "Hidden",
                    tint = PantopusColors.warning,
                )
            }
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                tint = PantopusColors.appTextMuted,
            )
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconAction(
                icon = PantopusIcon.ArrowUp,
                description = "Move up",
                enabled = index > 0,
                tag = "businessPageBlocks.moveUp.$index",
                onClick = onMoveUp,
            )
            IconAction(
                icon = PantopusIcon.ArrowDown,
                description = "Move down",
                enabled = !isLast,
                tag = "businessPageBlocks.moveDown.$index",
                onClick = onMoveDown,
            )
            Box(modifier = Modifier.weight(1f))
            IconAction(
                icon = PantopusIcon.Trash2,
                description = "Delete block",
                enabled = true,
                tag = "businessPageBlocks.delete.$index",
                tint = PantopusColors.error,
                onClick = onDelete,
            )
        }
    }
}

@Composable
private fun IconAction(
    icon: PantopusIcon,
    description: String,
    enabled: Boolean,
    tag: String,
    onClick: () -> Unit,
    tint: androidx.compose.ui.graphics.Color = PantopusColors.appTextSecondary,
) {
    Box(
        modifier =
            Modifier
                .alpha(if (enabled) 1f else 0.4f)
                .clickable(enabled = enabled, onClick = onClick)
                .padding(Spacing.s2)
                .testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = description, tint = tint)
    }
}

@Composable
private fun BottomBar(
    hasChanges: Boolean,
    isSaving: Boolean,
    isPublishing: Boolean,
    canPublish: Boolean,
    onAdd: () -> Unit,
    onSaveDraft: () -> Unit,
    onPublish: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).padding(Spacing.s4),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .clickable(onClick = onAdd)
                    .testTag("businessPageBlocks.addBlock"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Plus,
                contentDescription = "Add block",
                tint = PantopusColors.appTextStrong,
            )
        }
        Box(modifier = Modifier.weight(1f)) {
            GhostButton(
                title = "Save draft",
                onClick = onSaveDraft,
                isLoading = isSaving,
                isEnabled = hasChanges,
                modifier = Modifier.testTag("businessPageBlocks.saveDraft"),
            )
        }
        Box(modifier = Modifier.weight(1f)) {
            PrimaryButton(
                title = "Publish",
                onClick = onPublish,
                isLoading = isPublishing,
                isEnabled = canPublish,
                modifier = Modifier.testTag("businessPageBlocks.publish"),
            )
        }
    }
}
