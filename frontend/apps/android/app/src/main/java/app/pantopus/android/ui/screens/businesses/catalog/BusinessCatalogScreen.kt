@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
)

package app.pantopus.android.ui.screens.businesses.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/** Which editor the catalog frame is showing. */
private sealed interface CatalogEditorTarget {
    data object Create : CatalogEditorTarget

    data class Edit(
        val row: BusinessCatalogItemRow,
    ) : CatalogEditorTarget
}

/**
 * A10.7 → Services → "Manage". The owner catalog manager: an in-screen
 * frame of the Business owner dashboard (the same idiom as the existing
 * owner ↔ preview toggle) that lists catalog items in `sort_order` with
 * move-up / move-down reorder, opens the item editor on tap, and archives
 * an item behind a confirm that names it.
 *
 * iOS twin: `Features/Businesses/Catalog/BusinessCatalogView.swift`.
 */
@Composable
fun BusinessCatalogScreen(
    onBack: () -> Unit,
    viewModel: BusinessCatalogViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val isMutating by viewModel.isMutating.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()

    var editorTarget by remember { mutableStateOf<CatalogEditorTarget?>(null) }
    var showsCategories by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<BusinessCatalogItemRow?>(null) }

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2_000)
            viewModel.dismissToast()
        }
    }

    val target = editorTarget
    when {
        target != null ->
            BusinessCatalogItemEditor(
                initialDraft =
                    when (target) {
                        CatalogEditorTarget.Create -> BusinessCatalogItemDraft()
                        is CatalogEditorTarget.Edit -> BusinessCatalogItemDraft.from(target.row)
                    },
                isEditing = target is CatalogEditorTarget.Edit,
                categories = state.categoryRows,
                isSaving = isMutating,
                onClose = { editorTarget = null },
                onSave = { draft ->
                    when (target) {
                        CatalogEditorTarget.Create ->
                            viewModel.createItem(draft) { ok -> if (ok) editorTarget = null }
                        is CatalogEditorTarget.Edit ->
                            viewModel.updateItem(target.row.id, draft) { ok -> if (ok) editorTarget = null }
                    }
                },
            )
        showsCategories ->
            BusinessCatalogCategoriesPanel(
                categories = state.categoryRows,
                isSaving = isMutating,
                onClose = { showsCategories = false },
                onCreate = { name, done -> viewModel.createCategory(name, done) },
                onRename = { id, name -> viewModel.renameCategory(id, name) },
                onDelete = { id -> viewModel.deleteCategory(id) },
            )
        else ->
            CatalogListFrame(
                state = state,
                isMutating = isMutating,
                toast = toast,
                onBack = onBack,
                onOpenCategories = { showsCategories = true },
                onAddItem = { editorTarget = CatalogEditorTarget.Create },
                onEditItem = { row -> editorTarget = CatalogEditorTarget.Edit(row) },
                onMove = viewModel::move,
                onRequestDelete = { row -> pendingDelete = row },
                onRetry = viewModel::refresh,
            )
    }

    pendingDelete?.let { row ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text(text = "Archive item") },
            text = {
                Text(text = "Archive “${row.name}”? It disappears from your page but stays in your records.")
            },
            confirmButton = {
                TextButton(onClick = {
                    pendingDelete = null
                    viewModel.deleteItem(row.id)
                }) {
                    Text(text = "Archive", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) { Text(text = "Cancel") }
            },
            modifier = Modifier.testTag("businessCatalog.deleteConfirm"),
        )
    }
}

@Composable
private fun CatalogListFrame(
    state: BusinessCatalogUiState,
    isMutating: Boolean,
    toast: BusinessCatalogToast?,
    onBack: () -> Unit,
    onOpenCategories: () -> Unit,
    onAddItem: () -> Unit,
    onEditItem: (BusinessCatalogItemRow) -> Unit,
    onMove: (String, BusinessCatalogMoveDirection) -> Unit,
    onRequestDelete: (BusinessCatalogItemRow) -> Unit,
    onRetry: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .statusBarsPadding()
                .testTag("businessCatalog"),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            ContentDetailTopBar(
                title = "Catalog",
                onBack = onBack,
                action =
                    ContentDetailTopBarAction(
                        icon = PantopusIcon.FolderPlus,
                        contentDescription = "Manage categories",
                        onClick = onOpenCategories,
                    ),
            )
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when (state) {
                    BusinessCatalogUiState.Loading -> CatalogLoadingLayout()
                    is BusinessCatalogUiState.Empty ->
                        EmptyState(
                            icon = PantopusIcon.Tag,
                            headline = "No catalog items yet",
                            subcopy =
                                "Add the services or products you sell so neighbors can see " +
                                    "what you offer and what it costs.",
                            ctaTitle = "Add item",
                            onCta = onAddItem,
                            tint = PantopusColors.businessBg,
                            accent = PantopusColors.business,
                            modifier = Modifier.testTag("businessCatalog.empty"),
                        )
                    is BusinessCatalogUiState.Error ->
                        EmptyState(
                            icon = PantopusIcon.AlertCircle,
                            headline = "Couldn't load your catalog",
                            subcopy = state.message,
                            ctaTitle = "Try again",
                            onCta = onRetry,
                            tint = PantopusColors.businessBg,
                            accent = PantopusColors.business,
                            modifier = Modifier.testTag("businessCatalog.error"),
                        )
                    is BusinessCatalogUiState.Loaded ->
                        CatalogList(
                            items = state.content.items,
                            isMutating = isMutating,
                            onEditItem = onEditItem,
                            onMove = onMove,
                            onRequestDelete = onRequestDelete,
                        )
                }
            }
        }
        CatalogDock(
            onAddItem = onAddItem,
            modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding(),
        )
        toast?.let {
            CatalogToast(
                toast = it,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .navigationBarsPadding()
                        .padding(bottom = 88.dp),
            )
        }
    }
}

@Composable
private fun CatalogLoadingLayout() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s3)
                .testTag("businessCatalog.loading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        repeat(5) {
            Shimmer(width = 328.dp, height = 66.dp, cornerRadius = Radii.lg)
        }
    }
}

@Composable
private fun CatalogList(
    items: List<BusinessCatalogItemRow>,
    isMutating: Boolean,
    onEditItem: (BusinessCatalogItemRow) -> Unit,
    onMove: (String, BusinessCatalogMoveDirection) -> Unit,
    onRequestDelete: (BusinessCatalogItemRow) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("businessCatalog.list"),
        contentPadding = PaddingValues(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        itemsIndexed(items, key = { _, row -> row.id }) { index, row ->
            BusinessCatalogItemCard(
                row = row,
                canMoveUp = index > 0 && !isMutating,
                canMoveDown = index < items.size - 1 && !isMutating,
                onEdit = { onEditItem(row) },
                onMoveUp = { onMove(row.id, BusinessCatalogMoveDirection.Up) },
                onMoveDown = { onMove(row.id, BusinessCatalogMoveDirection.Down) },
                onDelete = { onRequestDelete(row) },
            )
        }
    }
}

/**
 * One catalog row: reorder chevrons · name + badges + meta · price ·
 * archive. Mirrors RN's `catalogCard`.
 */
@Composable
private fun BusinessCatalogItemCard(
    row: BusinessCatalogItemRow,
    canMoveUp: Boolean,
    canMoveDown: Boolean,
    onEdit: () -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(horizontal = 12.dp, vertical = 10.dp)
                .testTag("businessCatalog.item.${row.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            ReorderChevron(
                icon = PantopusIcon.ChevronUp,
                enabled = canMoveUp,
                description = "Move ${row.name} up",
                testTag = "businessCatalog.moveUp.${row.id}",
                onClick = onMoveUp,
            )
            ReorderChevron(
                icon = PantopusIcon.ChevronDown,
                enabled = canMoveDown,
                description = "Move ${row.name} down",
                testTag = "businessCatalog.moveDown.${row.id}",
                onClick = onMoveDown,
            )
        }
        Row(
            modifier = Modifier.weight(1f).clickable(onClick = onEdit),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Text(
                        text = row.name,
                        color = PantopusColors.appText,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = (-0.1).sp,
                        maxLines = 1,
                    )
                    if (row.kind == BusinessCatalogKind.Donation) {
                        CatalogBadge("Donation", PantopusColors.business, PantopusColors.businessBg)
                    }
                    if (row.isFeatured) {
                        PantopusIconImage(
                            icon = PantopusIcon.Star,
                            contentDescription = "Featured",
                            size = 12.dp,
                            strokeWidth = 2.2f,
                            tint = PantopusColors.warning,
                        )
                    }
                    if (row.taxDeductible) {
                        CatalogBadge("Tax-deductible", PantopusColors.success, PantopusColors.successBg)
                    }
                    if (row.status == BusinessCatalogStatus.Draft) {
                        CatalogBadge("Draft", PantopusColors.warning, PantopusColors.warningBg)
                    }
                }
                Text(text = row.metaLabel, color = PantopusColors.appTextSecondary, fontSize = 11.sp)
                row.categoryName?.takeIf { it.isNotEmpty() }?.let {
                    Text(text = it, color = PantopusColors.appTextMuted, fontSize = 10.5.sp)
                }
            }
            row.priceLabel?.let {
                Text(
                    text = it,
                    color =
                        if (row.kind == BusinessCatalogKind.Donation) {
                            PantopusColors.appTextSecondary
                        } else {
                            PantopusColors.appText
                        },
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clickable(onClick = onDelete)
                    .semantics { contentDescription = "Archive ${row.name}" }
                    .testTag("businessCatalog.delete.${row.id}"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Trash2,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2f,
                tint = PantopusColors.error,
            )
        }
    }
}

@Composable
private fun ReorderChevron(
    icon: PantopusIcon,
    enabled: Boolean,
    description: String,
    testTag: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(width = 26.dp, height = 20.dp)
                .alpha(if (enabled) 1f else 0.35f)
                .clickable(enabled = enabled, onClick = onClick)
                .semantics { contentDescription = description }
                .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 16.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun CatalogBadge(
    text: String,
    tint: Color,
    background: Color,
) {
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.xs))
                .background(background)
                .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text(text = text, color = tint, fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun CatalogDock(
    onAddItem: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        HorizontalDivider(color = PantopusColors.appBorder)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp)
                    .padding(top = 10.dp, bottom = Spacing.s2),
        ) {
            Row(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 44.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.business)
                        .clickable(onClick = onAddItem)
                        .semantics { contentDescription = "Add item" }
                        .testTag("businessCatalog.addItem"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Plus,
                    contentDescription = null,
                    size = 16.dp,
                    strokeWidth = 2.4f,
                    tint = PantopusColors.appTextInverse,
                )
                Text(
                    text = "Add item",
                    color = PantopusColors.appTextInverse,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.1).sp,
                    modifier = Modifier.padding(start = Spacing.s1),
                )
            }
        }
    }
}

@Composable
private fun CatalogToast(
    toast: BusinessCatalogToast,
    modifier: Modifier = Modifier,
) {
    val background =
        when (toast.kind) {
            BusinessCatalogToastKind.Success -> PantopusColors.success
            BusinessCatalogToastKind.Error -> PantopusColors.error
        }
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .testTag("businessCatalog.toast"),
    ) {
        Text(text = toast.text, color = PantopusColors.appTextInverse, fontSize = 13.sp)
    }
}
