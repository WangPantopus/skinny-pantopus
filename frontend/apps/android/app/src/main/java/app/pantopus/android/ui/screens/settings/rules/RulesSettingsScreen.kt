@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.rules

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListCallbacks
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListScreen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/**
 * Settings → Privacy → What Pantopus does for you (AI assistant phase 3 contract §18.5), in the shared Settings list:
 * one card per standing rule (its sentence and switch, Until · Extend, why it paused, its last runs, Delete), the
 * header line and the empty text. Also opened by `pantopus://settings/rules` (a rule card's Open, the assistant's link,
 * and a rule's pause or end notification).
 */
@Composable
fun RulesSettingsScreen(
    onBack: () -> Unit = {},
    onOpenLink: (String) -> Unit = DeepLinkRouter::handle,
    viewModel: RulesSettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val isEmpty by viewModel.isEmpty.collectAsStateWithLifecycle()
    val footer by viewModel.footer.collectAsStateWithLifecycle()
    val refreshing by viewModel.refreshing.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val confirmDelete by viewModel.confirmDelete.collectAsStateWithLifecycle()
    val toastController = remember { ToastController() }

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(Unit) { viewModel.openLink.collect { link -> onOpenLink(link) } }
    LaunchedEffect(toast) {
        toast?.let {
            toastController.show(it)
            viewModel.consumeToast()
        }
    }

    Box(modifier = Modifier.fillMaxSize().testTag(RulesSettingsViewModel.TAG_LIST)) {
        GroupedListScreen(
            title = viewModel.title,
            state = state,
            footerCaption = footer,
            header = { RulesHeader(isEmpty = isEmpty) },
            callbacks =
                GroupedListCallbacks(
                    onBack = onBack,
                    onTapRow = viewModel::onTapRow,
                    onToggleRow = viewModel::onToggle,
                    onRetry = viewModel::load,
                ),
            refreshing = refreshing,
            onRefresh = viewModel::refresh,
        )
        ToastHost(controller = toastController)
    }

    confirmDelete?.let { rule ->
        AlertDialog(
            onDismissRequest = viewModel::dismissDelete,
            containerColor = PantopusColors.appSurface,
            title = { Text(text = "Delete this rule?") },
            text = { Text(text = "Pantopus stops doing it, and its history goes. Plans it posted stay. \"${rule.summary}\"") },
            confirmButton = {
                TextButton(onClick = viewModel::confirmDelete, modifier = Modifier.testTag(RulesSettingsViewModel.TAG_DELETE_CONFIRM)) {
                    Text(text = "Delete", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissDelete) {
                    Text(text = "Cancel", color = PantopusColors.appTextSecondary)
                }
            },
        )
    }
}

/** What these are, and the empty text when there are none. */
@Composable
private fun RulesHeader(isEmpty: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Row(
            modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowsRepeat,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Pantopus does these on its own and tells you each time. Switch one off whenever you like.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.weight(1f),
            )
        }
        if (isEmpty) {
            EmptyState(
                icon = PantopusIcon.ArrowsRepeat,
                headline = "Nothing yet.",
                subcopy = "Ask Pantopus to post your weekly game for you.",
                modifier = Modifier.heightIn(min = 280.dp).testTag("rules.empty"),
            )
        }
    }
}
