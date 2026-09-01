@file:Suppress("PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.my_posts

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
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
import app.pantopus.android.data.api.models.posts.MyPostDto
import app.pantopus.android.ui.screens.shared.activity_filter_sheet.ActivityFilterSheet
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tag on the My posts root container. */
const val MY_POSTS_TAG = "my-posts"

/**
 * T5.3.3 — My posts. Thin wrapper around [ListOfRowsScreen]. Two tabs
 * (Active / Archived), 52dp secondary-create FAB, filter icon in the
 * top-bar trailing slot, and per-row kebab → modal bottom sheet (Archive
 * / Restore + Delete) → confirmation alert (for the destructive
 * Delete action).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyPostsScreen(
    onBack: () -> Unit,
    onOpenPost: (MyPostDto) -> Unit,
    onCompose: () -> Unit = {},
    onEditPost: (MyPostDto) -> Unit = {},
    viewModel: MyPostsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val topBarAction by viewModel.topBarAction.collectAsStateWithLifecycle()
    val fab by viewModel.fab.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val kebabTarget by viewModel.kebabTarget.collectAsStateWithLifecycle()
    val deleteTarget by viewModel.deleteTarget.collectAsStateWithLifecycle()
    val showFilterSheet by viewModel.showFilterSheet.collectAsStateWithLifecycle()
    val activityFilter by viewModel.activityFilter.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.bindCallbacks(
            onOpenPost = onOpenPost,
            onCompose = onCompose,
            onEditPost = onEditPost,
        )
        viewModel.load()
    }

    Box(modifier = Modifier.fillMaxSize().testTag(MY_POSTS_TAG)) {
        ListOfRowsScreen(
            title = "My posts",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { viewModel.loadMoreIfNeeded() },
            tabs = tabs,
            selectedTab = selectedTab,
            onSelectTab = { viewModel.selectTab(it) },
            topBarAction = topBarAction,
            fab = fab,
            onBack = onBack,
        )
    }

    val target = kebabTarget
    if (target != null) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { viewModel.cancelKebab() },
            sheetState = sheetState,
        ) {
            KebabSheetContent(
                target = target,
                onArchive = { viewModel.archive(target.postId) },
                onRestore = { viewModel.unarchive(target.postId) },
                onDelete = { viewModel.requestDelete(target.postId) },
                onCancel = { viewModel.cancelKebab() },
            )
        }
    }

    val deleteT = deleteTarget
    if (deleteT != null) {
        AlertDialog(
            onDismissRequest = { viewModel.cancelDelete() },
            title = {
                Text(
                    text = "Delete this post?",
                    color = PantopusColors.appText,
                )
            },
            text = {
                Text(
                    text = "This post will be permanently removed from your profile and the Pulse feed.",
                    color = PantopusColors.appTextSecondary,
                )
            },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.confirmDelete() },
                    modifier = Modifier.testTag("delete-confirm"),
                ) {
                    Text("Delete", color = PantopusColors.error, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { viewModel.cancelDelete() },
                    modifier = Modifier.testTag("delete-cancel"),
                ) {
                    Text("Cancel", color = PantopusColors.appText)
                }
            },
        )
    }

    if (showFilterSheet) {
        ActivityFilterSheet(
            statusTitle = viewModel.statusFilterTitle,
            statusOptions = viewModel.statusFilterOptions,
            sortOptions = viewModel.sortFilterOptions,
            filter = activityFilter,
            onApply = { viewModel.applyFilter(it) },
            onDismiss = { viewModel.dismissFilterSheet() },
        )
    }
}

@Composable
private fun KebabSheetContent(
    target: MyPostsKebabTarget,
    onArchive: () -> Unit,
    onRestore: () -> Unit,
    onDelete: () -> Unit,
    onCancel: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "Post options",
            fontSize = 20.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )

        if (target.isArchived) {
            ActionRow(
                label = "Restore post",
                icon = PantopusIcon.ArrowsRepeat,
                testTag = "kebab-restore",
                onClick = onRestore,
            )
        } else {
            ActionRow(
                label = "Archive post",
                icon = PantopusIcon.Archive,
                testTag = "kebab-archive",
                onClick = onArchive,
            )
        }
        ActionRow(
            label = "Delete post",
            icon = PantopusIcon.Trash2,
            testTag = "kebab-delete",
            isDestructive = true,
            onClick = onDelete,
        )
        Spacer(Modifier.height(Spacing.s2))
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            TextButton(
                onClick = onCancel,
                modifier = Modifier.testTag("kebab-cancel"),
            ) {
                Text(
                    text = "Cancel",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
            }
        }
    }
}

@Composable
private fun ActionRow(
    label: String,
    icon: PantopusIcon,
    testTag: String,
    isDestructive: Boolean = false,
    onClick: () -> Unit,
) {
    val tint = if (isDestructive) PantopusColors.error else PantopusColors.appText
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .testTag(testTag),
        contentAlignment = Alignment.CenterStart,
    ) {
        TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                PantopusIconImage(
                    icon = icon,
                    contentDescription = null,
                    size = 18.dp,
                    tint = tint,
                )
                Text(
                    text = label,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = tint,
                )
            }
        }
    }
}
