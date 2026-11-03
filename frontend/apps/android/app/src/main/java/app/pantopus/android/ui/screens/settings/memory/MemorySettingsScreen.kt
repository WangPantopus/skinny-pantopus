@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.memory

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.components.closesKeyboardOnTapOrScroll
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListCallbacks
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListScreen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Settings → Privacy → What Pantopus remembers (AI assistant phase 3 contract §5.7), in the shared Settings list:
 * the header line, one row per item with its caption and a menu (Edit for a fact's words, Delete), the yearly
 * "Still right?" banner with Looks right, and Forget everything with its confirmation. Also opened by
 * `pantopus://settings/memory` (a Remember card's Open, the assistant's link, the yearly review notification).
 */
@Composable
fun MemorySettingsScreen(
    onBack: () -> Unit = {},
    viewModel: MemorySettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val isEmpty by viewModel.isEmpty.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()
    val refreshing by viewModel.refreshing.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val editing by viewModel.editing.collectAsStateWithLifecycle()
    val confirmForgetAll by viewModel.confirmForgetAll.collectAsStateWithLifecycle()
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    val toastController = remember { ToastController() }

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toast) {
        toast?.let {
            toastController.show(it)
            viewModel.consumeToast()
        }
    }

    Box(modifier = Modifier.fillMaxSize().testTag(MemorySettingsViewModel.TAG_LIST)) {
        GroupedListScreen(
            title = viewModel.title,
            state = state,
            banner = banner,
            header = { MemoryHeader(isEmpty = isEmpty) },
            callbacks =
                GroupedListCallbacks(
                    onBack = onBack,
                    onTapRow = viewModel::onTapRow,
                    onRowMenu = viewModel::onRowMenu,
                    onTapBanner = { if (!busy) viewModel.lookRight() },
                    onRetry = viewModel::load,
                ),
            refreshing = refreshing,
            onRefresh = viewModel::refresh,
        )
        ToastHost(controller = toastController)
    }

    editing?.let { current ->
        MemoryEditDialog(
            editing = current,
            onTextChange = viewModel::onEditText,
            onSave = viewModel::saveEdit,
            onDismiss = viewModel::dismissEdit,
        )
    }
    confirmForgetAll?.let { count ->
        AlertDialog(
            onDismissRequest = viewModel::dismissForgetAll,
            containerColor = PantopusColors.appSurface,
            title = { Text(text = if (count == 1) "Forget 1 thing?" else "Forget all $count things?") },
            text = { Text(text = "This can't be undone.") },
            confirmButton = {
                TextButton(
                    onClick = viewModel::confirmForgetAll,
                    enabled = !busy,
                    modifier = Modifier.testTag(MemorySettingsViewModel.TAG_FORGET_ALL_CONFIRM),
                ) {
                    Text(text = "Forget everything", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissForgetAll, enabled = !busy) {
                    Text(text = "Cancel", color = PantopusColors.appTextSecondary)
                }
            },
        )
    }
}

/** "Pantopus uses these only for you…", and the empty text when nothing is saved. */
@Composable
private fun MemoryHeader(isEmpty: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Row(
            modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextSecondary)
            Text(
                text = "Pantopus uses these only for you. Your household doesn't see them.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.weight(1f),
            )
        }
        if (isEmpty) {
            EmptyState(
                icon = PantopusIcon.Bookmark,
                headline = "Nothing yet.",
                subcopy = "Ask Pantopus to remember something, like your furnace filter size.",
                modifier = Modifier.heightIn(min = 280.dp).testTag("memory.empty"),
            )
        }
    }
}

/** Edit a fact's words: one field, checked again by the server, whose reason shows under it. */
@Composable
private fun MemoryEditDialog(
    editing: MemorySettingsViewModel.Editing,
    onTextChange: (String) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    val length = editing.text.trim().length
    val fits = length in MemorySettingsViewModel.FACT_LENGTH
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = PantopusColors.appSurface,
        title = { Text(text = "Edit") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                BasicTextField(
                    value = editing.text,
                    onValueChange = onTextChange,
                    enabled = !editing.saving,
                    textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                    cursorBrush = SolidColor(PantopusColors.primary600),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    minLines = 3,
                    maxLines = 8,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .keepsKeyboard()
                            .border(
                                1.dp,
                                if (editing.error != null) PantopusColors.error else PantopusColors.appBorderStrong,
                                RoundedCornerShape(Radii.md),
                            ).padding(Spacing.s3)
                            .semantics { contentDescription = "What Pantopus remembers" }
                            .testTag(MemorySettingsViewModel.TAG_EDITOR_FIELD),
                )
                Row(verticalAlignment = Alignment.Top) {
                    Text(
                        text = editing.error.orEmpty(),
                        fontSize = 12.sp,
                        color = PantopusColors.error,
                        modifier = Modifier.weight(1f),
                    )
                    val tooLong = length > MemorySettingsViewModel.FACT_LENGTH.last
                    Text(
                        text = "$length/${MemorySettingsViewModel.FACT_LENGTH.last}",
                        fontSize = 12.sp,
                        color = if (tooLong) PantopusColors.error else PantopusColors.appTextMuted,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = onSave,
                enabled = fits && !editing.saving,
                modifier = Modifier.testTag(MemorySettingsViewModel.TAG_EDITOR_SAVE),
            ) {
                Text(text = if (editing.saving) "Saving…" else "Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !editing.saving) {
                Text(text = "Cancel", color = PantopusColors.appTextSecondary)
            }
        },
        modifier = Modifier.closesKeyboardOnTapOrScroll().testTag(MemorySettingsViewModel.TAG_EDITOR),
    )
}
