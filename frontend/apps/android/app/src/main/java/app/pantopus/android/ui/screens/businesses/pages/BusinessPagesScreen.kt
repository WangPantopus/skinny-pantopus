@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.businesses.pages

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.PantopusTextField
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
 * C4 — custom business Pages (the multi-page CMS index). Create a page,
 * delete a non-default page, expand revision history, restore a revision, and
 * open the block builder for a page. Mirrors RN
 * `src/components/business/tabs/PagesTab.tsx` and iOS `BusinessPagesView`.
 */
@Composable
fun BusinessPagesScreen(
    onBack: () -> Unit,
    onOpenPage: (BusinessPageRow) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: BusinessPagesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val showsAddForm by viewModel.showsAddForm.collectAsStateWithLifecycle()
    val draftTitle by viewModel.draftTitle.collectAsStateWithLifecycle()
    val draftSlug by viewModel.draftSlug.collectAsStateWithLifecycle()
    val isCreating by viewModel.isCreating.collectAsStateWithLifecycle()
    val expandedPageId by viewModel.expandedRevisionsPageId.collectAsStateWithLifecycle()
    val revisions by viewModel.revisions.collectAsStateWithLifecycle()
    val isLoadingRevisions by viewModel.isLoadingRevisions.collectAsStateWithLifecycle()
    val restoringRevision by viewModel.restoringRevision.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()

    var pendingDelete by remember { mutableStateOf<BusinessPageRow?>(null) }

    LaunchedEffect(Unit) { viewModel.load() }

    Box(modifier = modifier.fillMaxSize().background(PantopusColors.appBg).testTag("businessPages.screen")) {
        Column(modifier = Modifier.fillMaxSize()) {
            ContentDetailTopBar(
                title = "Pages",
                onBack = onBack,
                action =
                    ContentDetailTopBarAction(
                        icon = if (showsAddForm) PantopusIcon.X else PantopusIcon.Plus,
                        contentDescription = if (showsAddForm) "Cancel" else "Add page",
                        onClick = viewModel::toggleAddForm,
                    ),
            )
            when (val current = state) {
                BusinessPagesUiState.Loading -> LoadingSkeleton(modifier = Modifier.weight(1f))
                is BusinessPagesUiState.Error ->
                    ErrorState(
                        headline = "Couldn't load pages",
                        message = current.message,
                        onRetry = viewModel::refresh,
                        modifier = Modifier.weight(1f).testTag("businessPages.error"),
                    )
                BusinessPagesUiState.Empty ->
                    Column(modifier = Modifier.weight(1f).fillMaxSize().testTag("businessPages.empty")) {
                        if (showsAddForm) {
                            AddPageForm(
                                title = draftTitle,
                                slug = draftSlug,
                                isCreating = isCreating,
                                onTitleChange = viewModel::setTitle,
                                onSlugChange = viewModel::setSlug,
                                onCreate = viewModel::createPage,
                                modifier = Modifier.padding(Spacing.s4),
                            )
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            EmptyState(
                                icon = PantopusIcon.FileText,
                                headline = "No pages yet",
                                subcopy =
                                    "Custom pages let you publish a menu, an about page, " +
                                        "or anything else at its own link.",
                                ctaTitle = "Add page",
                                onCta = viewModel::toggleAddForm,
                            )
                        }
                    }
                is BusinessPagesUiState.Loaded ->
                    LazyColumn(
                        modifier = Modifier.weight(1f).fillMaxSize().padding(Spacing.s4).testTag("businessPages.loaded"),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        if (showsAddForm) {
                            item {
                                AddPageForm(
                                    title = draftTitle,
                                    slug = draftSlug,
                                    isCreating = isCreating,
                                    onTitleChange = viewModel::setTitle,
                                    onSlugChange = viewModel::setSlug,
                                    onCreate = viewModel::createPage,
                                )
                            }
                        }
                        items(items = current.rows, key = { it.id }) { row ->
                            PageCard(
                                row = row,
                                isExpanded = expandedPageId == row.id,
                                revisions = revisions,
                                isLoadingRevisions = isLoadingRevisions,
                                restoringRevision = restoringRevision,
                                onOpen = { onOpenPage(row) },
                                onToggleHistory = { viewModel.toggleRevisions(row) },
                                onDelete = { pendingDelete = row },
                                onRestore = { revision -> viewModel.restore(row.id, revision) },
                            )
                        }
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

    pendingDelete?.let { row ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text(text = "Delete “${row.title}”?", style = PantopusTextStyle.h3) },
            text = {
                Text(
                    text =
                        "The page “${row.title}”, its blocks and its revision history " +
                            "are removed for good.",
                    style = PantopusTextStyle.small,
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deletePage(row)
                        pendingDelete = null
                    },
                    modifier = Modifier.testTag("businessPages.deleteConfirm"),
                ) {
                    Text(text = "Delete ${row.title}", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) { Text(text = "Cancel") }
            },
        )
    }
}

private const val TOAST_MILLIS = 2_000L

@Composable
private fun LoadingSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize().padding(Spacing.s4).testTag("businessPages.loading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        repeat(4) {
            Shimmer(width = 320.dp, height = 64.dp, cornerRadius = Radii.md, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun AddPageForm(
    title: String,
    slug: String,
    isCreating: Boolean,
    onTitleChange: (String) -> Unit,
    onSlugChange: (String) -> Unit,
    onCreate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("businessPages.addForm"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusTextField(
            label = "Page title",
            value = title,
            onValueChange = onTitleChange,
            placeholder = "e.g. Menu, About Us",
            isRequired = true,
            fieldTestTag = "businessPages.titleField",
        )
        PantopusTextField(
            label = "Slug",
            value = slug,
            onValueChange = onSlugChange,
            placeholder = "e.g. menu, about",
            isRequired = true,
            fieldTestTag = "businessPages.slugField",
        )
        PrimaryButton(
            title = "Create page",
            onClick = onCreate,
            isLoading = isCreating,
            modifier = Modifier.testTag("businessPages.create"),
        )
    }
}

@Composable
private fun PageCard(
    row: BusinessPageRow,
    isExpanded: Boolean,
    revisions: List<BusinessPageRevisionRow>,
    isLoadingRevisions: Boolean,
    restoringRevision: Int?,
    onOpen: () -> Unit,
    onToggleHistory: () -> Unit,
    onDelete: () -> Unit,
    onRestore: (Int) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md)),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onOpen)
                    .padding(Spacing.s3)
                    .testTag("businessPages.row.${row.slug}"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(text = row.title, style = PantopusTextStyle.body, color = PantopusColors.appTextStrong)
                    if (row.isDefault) {
                        Pill(text = "Default", tint = PantopusColors.primary600, background = PantopusColors.primary50)
                    }
                    Pill(
                        text = row.statusLabel,
                        tint = if (row.isPublished) PantopusColors.success else PantopusColors.appTextSecondary,
                        background =
                            if (row.isPublished) {
                                PantopusColors.successBg
                            } else {
                                PantopusColors.appSurfaceSunken
                            },
                    )
                }
                Text(
                    text = "/${row.slug}",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextMuted,
                )
            }
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                tint = PantopusColors.appTextMuted,
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3).padding(bottom = Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (row.isPublished) {
                Row(
                    modifier =
                        Modifier
                            .clickable(onClick = onToggleHistory)
                            .testTag("businessPages.history.${row.slug}"),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.History,
                        contentDescription = null,
                        tint = PantopusColors.primary600,
                    )
                    Text(
                        text = if (isExpanded) "Hide history" else "History",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.primary600,
                    )
                }
            }
            Box(modifier = Modifier.weight(1f))
            if (!row.isDefault) {
                Box(
                    modifier =
                        Modifier
                            .clickable(onClick = onDelete)
                            .padding(Spacing.s1)
                            .testTag("businessPages.delete.${row.slug}"),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Trash2,
                        contentDescription = "Delete page",
                        tint = PantopusColors.error,
                    )
                }
            }
        }
        if (isExpanded) {
            RevisionPanel(
                revisions = revisions,
                isLoading = isLoadingRevisions,
                restoringRevision = restoringRevision,
                onRestore = onRestore,
            )
        }
    }
}

@Composable
private fun RevisionPanel(
    revisions: List<BusinessPageRevisionRow>,
    isLoading: Boolean,
    restoringRevision: Int?,
    onRestore: (Int) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s3)
                .testTag("businessPages.revisions"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        when {
            isLoading -> {
                Shimmer(width = 320.dp, height = 40.dp, cornerRadius = Radii.sm, modifier = Modifier.fillMaxWidth())
                Shimmer(width = 320.dp, height = 40.dp, cornerRadius = Radii.sm, modifier = Modifier.fillMaxWidth())
            }
            revisions.isEmpty() ->
                Text(
                    text = "No revision history",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.fillMaxWidth(),
                )
            else ->
                revisions.forEach { revision ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = revision.title,
                                style = PantopusTextStyle.small,
                                color = PantopusColors.appTextStrong,
                            )
                            Text(
                                text = revision.subtitle,
                                style = PantopusTextStyle.caption,
                                color = PantopusColors.appTextSecondary,
                            )
                        }
                        Row(
                            modifier =
                                Modifier
                                    .clip(RoundedCornerShape(Radii.pill))
                                    .background(PantopusColors.primary600)
                                    .clickable(
                                        enabled = restoringRevision == null,
                                        onClick = { onRestore(revision.revision) },
                                    ).padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                                    .testTag("businessPages.restore.${revision.revision}"),
                            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            PantopusIconImage(
                                icon = PantopusIcon.Undo2,
                                contentDescription = null,
                                tint = PantopusColors.appTextInverse,
                            )
                            Text(
                                text = "Restore",
                                style = PantopusTextStyle.caption,
                                color = PantopusColors.appTextInverse,
                            )
                        }
                    }
                }
        }
    }
}

@Composable
private fun Pill(
    text: String,
    tint: Color,
    background: Color,
) {
    Text(
        text = text,
        style = PantopusTextStyle.caption,
        color = tint,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .padding(horizontal = Spacing.s2),
    )
}
