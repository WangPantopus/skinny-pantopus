@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.settings

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.identity.OwnLocalProfileResponse
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.SubcomposeAsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * How neighbors see you, drawn in Privacy's header slot like the Home settings identity card: what other people see
 * (photo, name, handle), the name field and the photo choices. Mirrors iOS `NeighborsSeeYouCard` (same test tags).
 */
@Composable
fun NeighborsSeeYouCard(viewModel: NeighborsSeeYouViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    if (state is NeighborsSeeYouViewModel.UiState.Unavailable) return
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("neighborsSeeYou"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(text = "How neighbors see you", style = PantopusTextStyle.h3, color = PantopusColors.appText)
            Text(
                text = "Your name and photo on your posts, comments, chats, tasks and notices. Your account name stays private.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        when (val current = state) {
            NeighborsSeeYouViewModel.UiState.Loading, NeighborsSeeYouViewModel.UiState.Unavailable -> LoadingRow()
            NeighborsSeeYouViewModel.UiState.Failed -> FailedRow(onRetry = viewModel::retry)
            is NeighborsSeeYouViewModel.UiState.Loaded -> LoadedContent(current.view, viewModel)
        }
    }
}

@Composable
private fun LoadingRow() {
    Row(
        modifier = Modifier.testTag("neighborsSeeYouLoading"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(Modifier.size(56.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken))
        Box(Modifier.width(140.dp).heightIn(min = 14.dp).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.appSurfaceSunken))
    }
}

@Composable
private fun FailedRow(onRetry: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "We couldn't load how neighbors see you.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        ChipButton(title = "Try again", primary = false, enabled = true, tag = "neighborsSeeYouRetry", onClick = onRetry)
    }
}

@Composable
private fun LoadedContent(
    view: OwnLocalProfileResponse,
    viewModel: NeighborsSeeYouViewModel,
) {
    val nameText by viewModel.nameText.collectAsStateWithLifecycle()
    val nameError by viewModel.nameError.collectAsStateWithLifecycle()
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val picker =
        rememberLauncherForActivityResult(contract = ActivityResultContracts.PickVisualMedia()) { uri: Uri? ->
            // A null Uri is a plain cancel, not a failure: stay silent.
            if (uri == null) return@rememberLauncherForActivityResult
            val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
            val extension = if (mimeType.equals("image/png", ignoreCase = true)) "png" else "jpg"
            val filename = "profile-${System.currentTimeMillis()}.$extension"
            scope.launch {
                val bytes =
                    withContext(Dispatchers.IO) {
                        runCatching { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }.getOrNull()
                    }
                viewModel.uploadPhoto(bytes, filename, mimeType)
            }
        }

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        ShownAs(view, dimmed = busy == NeighborsSeeYouViewModel.Busy.Photo)
        NameEditor(
            view = view,
            nameText = nameText,
            nameError = nameError,
            busy = busy,
            viewModel = viewModel,
        )
        PhotoChoices(
            view = view,
            busy = busy,
            onPick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            viewModel = viewModel,
        )
    }
}

/** What other people see: the photo, the name and the handle. */
@Composable
private fun ShownAs(
    view: OwnLocalProfileResponse,
    dimmed: Boolean,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Avatar(view, dimmed = dimmed)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = view.profile.displayName,
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.testTag("neighborsSeeYouName"),
            )
            view.profile.handle?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = "@$it",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NameEditor(
    view: OwnLocalProfileResponse,
    nameText: String,
    nameError: String?,
    busy: NeighborsSeeYouViewModel.Busy?,
    viewModel: NeighborsSeeYouViewModel,
) {
    val nameChanged = NeighborsSeeYouViewModel.normalizedName(nameText) != view.profile.displayName
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PantopusTextField(
            label = "Name neighbors see",
            value = nameText,
            onValueChange = viewModel::editName,
            state = nameError?.let { PantopusFieldState.Error(it) } ?: PantopusFieldState.Default,
            fieldTestTag = "neighborsSeeYouNameField",
            enabled = busy == null,
        )
        Text(text = NeighborsSeeYouViewModel.nameNote(view), style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            ChipButton(
                title = if (busy == NeighborsSeeYouViewModel.Busy.Name) "Saving…" else "Save",
                primary = true,
                enabled = nameChanged && busy == null,
                tag = "neighborsSeeYouSave",
                onClick = viewModel::saveName,
            )
            if (!view.followsAccount.displayName) {
                Text(
                    text = "Use my account name (${view.account.displayName})",
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                    modifier =
                        Modifier
                            .heightIn(min = 44.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .clickable(enabled = busy == null, onClick = viewModel::useAccountName)
                            .padding(horizontal = Spacing.s1, vertical = Spacing.s3)
                            .testTag("neighborsSeeYouUseAccountName"),
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PhotoChoices(
    view: OwnLocalProfileResponse,
    busy: NeighborsSeeYouViewModel.Busy?,
    onPick: () -> Unit,
    viewModel: NeighborsSeeYouViewModel,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "Photo neighbors see",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            ChipButton(
                title =
                    when {
                        busy == NeighborsSeeYouViewModel.Busy.Photo -> "Saving…"
                        view.profile.avatarUrl == null -> "Add photo"
                        else -> "Change photo"
                    },
                primary = false,
                enabled = busy == null,
                tag = "neighborsSeeYouChangePhoto",
                onClick = onPick,
            )
            if (view.account.avatarUrl != null && !view.followsAccount.avatarUrl) {
                ChipButton(
                    title = "Use account photo",
                    primary = false,
                    enabled = busy == null,
                    tag = "neighborsSeeYouUseAccountPhoto",
                    onClick = viewModel::useAccountPhoto,
                )
            }
            if (view.profile.avatarUrl != null) {
                ChipButton(
                    title = "Remove photo",
                    primary = false,
                    enabled = busy == null,
                    tag = "neighborsSeeYouRemovePhoto",
                    onClick = viewModel::removePhoto,
                )
            }
        }
        Text(text = NeighborsSeeYouViewModel.photoNote(view), style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun Avatar(
    view: OwnLocalProfileResponse,
    dimmed: Boolean,
) {
    val initial =
        view.profile.displayName
            .trim()
            .take(1)
            .uppercase()
    Box(
        modifier =
            Modifier
                .size(56.dp)
                .clip(CircleShape)
                .background(PantopusColors.personalBg)
                .alpha(if (dimmed) 0.6f else 1f),
        contentAlignment = Alignment.Center,
    ) {
        val url = view.profile.avatarUrl
        if (url.isNullOrBlank()) {
            AvatarInitial(initial)
        } else {
            SubcomposeAsyncImage(
                model = url,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
                loading = { AvatarInitial(initial) },
                error = { AvatarInitial(initial) },
            )
        }
    }
}

/** Centered in its own box: the image's loading and error slots stretch their content to the whole circle. */
@Composable
private fun AvatarInitial(initial: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text = initial, style = PantopusTextStyle.h3, color = PantopusColors.personal)
    }
}

/** The Home settings rename editor's chip buttons: primary (Save) or sunken (everything else). */
@Composable
private fun ChipButton(
    title: String,
    primary: Boolean,
    enabled: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier.heightIn(min = 44.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = title,
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = if (primary) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
            modifier =
                Modifier
                    .alpha(if (enabled) 1f else 0.5f)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (primary) PantopusColors.primary600 else PantopusColors.appSurfaceSunken)
                    .clickable(enabled = enabled, onClick = onClick)
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                    .testTag(tag),
        )
    }
}
