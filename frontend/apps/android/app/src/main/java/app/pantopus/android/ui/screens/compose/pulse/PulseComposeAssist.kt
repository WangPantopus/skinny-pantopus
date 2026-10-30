package app.pantopus.android.ui.screens.compose.pulse

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.CompactButton
import app.pantopus.android.ui.components.CompactButtonSize
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDateTime

/**
 * The composer's AI assist (`POST /api/ai/draft/post-suggestion`): the whole post suggested from the person's photos,
 * the place they picked and what they've written so far. Mirrors iOS `PulseComposeAssistState`.
 */
sealed interface PulseComposeAssistState {
    data object Idle : PulseComposeAssistState

    /** A suggestion is on its way. */
    data object Writing : PulseComposeAssistState

    /** A suggestion is in the form; [note] is the AI's one sentence for the person. */
    data class Suggested(val note: String?) : PulseComposeAssistState

    /** Why no suggestion came, for the person. */
    data class Failed(val message: String) : PulseComposeAssistState
}

/** The form as it was before a suggestion went in. */
internal data class PulseComposeAssistSnapshot(
    val fields: Map<PulseComposeField, FormFieldState>,
    val lostFoundKind: PulseLostFoundKind,
    val safetyAlertKind: PulseSafetyAlertKind?,
    val askCategory: PulseAskCategory?,
    val dealExpiresAt: LocalDateTime?,
)

/**
 * The AI assist card at the top of a new post: it writes the whole post from the photos, the place and the person's
 * words. With nothing to go on yet it offers to take or choose a photo, and the suggestion follows on its own. Mirrors
 * iOS `PulseComposeAssistCard`.
 */
@Composable
internal fun PulseComposeAssistCard(
    assist: PulseComposeAssistState,
    state: PulseComposeContentState,
    actions: PulseComposeActions,
    onSuggest: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.primary50)
                .padding(Spacing.s3)
                .testTag("composePulseAssist"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PantopusIconImage(
                icon = PantopusIcon.Sparkles,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = "Write it with AI",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    text = assistMessage(assist, state.assistHasMaterial, state.assistPhotoCount),
                    style = PantopusTextStyle.caption,
                    color = if (assist is PulseComposeAssistState.Failed) PantopusColors.error else PantopusColors.appTextSecondary,
                    modifier = Modifier.testTag("composePulseAssistMessage"),
                )
                val note = (assist as? PulseComposeAssistState.Suggested)?.note
                if (!note.isNullOrBlank()) {
                    Text(
                        text = note,
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appText,
                        modifier = Modifier.testTag("composePulseAssistNote"),
                    )
                }
            }
        }
        AssistActions(assist, state, actions, onSuggest)
    }
}

@Composable
private fun AssistActions(
    assist: PulseComposeAssistState,
    state: PulseComposeContentState,
    actions: PulseComposeActions,
    onSuggest: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when {
            assist is PulseComposeAssistState.Writing ->
                CircularProgressIndicator(
                    modifier =
                        Modifier
                            .size(20.dp)
                            .semantics { contentDescription = "Writing your post" }
                            .testTag("composePulseAssistWriting"),
                    color = PantopusColors.primary600,
                    strokeWidth = 2.dp,
                )
            assist is PulseComposeAssistState.Suggested -> {
                if (state.assistCanUndo) {
                    AssistButton("Undo", PantopusIcon.Undo2, CompactButtonVariant.Ghost, "composePulseAssistUndo", actions.onUndoSuggestion)
                }
                AssistButton("Try again", PantopusIcon.Sparkles, CompactButtonVariant.Ghost, "composePulseAssistRetry", onSuggest)
            }
            state.assistHasMaterial -> {
                // A retry that failed leaves the first suggestion in the form, and its Undo.
                if (assist is PulseComposeAssistState.Failed && state.assistCanUndo) {
                    AssistButton("Undo", PantopusIcon.Undo2, CompactButtonVariant.Ghost, "composePulseAssistUndo", actions.onUndoSuggestion)
                }
                AssistButton(
                    title = if (assist is PulseComposeAssistState.Failed) "Try again" else "Suggest post",
                    icon = PantopusIcon.Sparkles,
                    variant = CompactButtonVariant.Primary,
                    tag = "composePulseAssistSuggest",
                    onClick = onSuggest,
                )
            }
            else -> {
                if (state.canTakePhoto) {
                    AssistButton(
                        title = "Take photo",
                        icon = PantopusIcon.Camera,
                        variant = CompactButtonVariant.Primary,
                        tag = "composePulseAssistTakePhoto",
                        onClick = actions.onAssistTakePhoto,
                    )
                }
                AssistButton(
                    title = "Choose photos",
                    icon = PantopusIcon.Image,
                    variant = if (state.canTakePhoto) CompactButtonVariant.Ghost else CompactButtonVariant.Primary,
                    tag = "composePulseAssistChoosePhotos",
                    onClick = actions.onAssistChoosePhotos,
                )
            }
        }
    }
}

@Composable
private fun RowScope.AssistButton(
    title: String,
    icon: PantopusIcon,
    variant: CompactButtonVariant,
    tag: String,
    onClick: () -> Unit,
) {
    CompactButton(
        title = title,
        variant = variant,
        size = CompactButtonSize.Footer,
        onClick = onClick,
        icon = icon,
        modifier = Modifier.weight(1f).testTag(tag),
    )
}

private fun assistMessage(
    assist: PulseComposeAssistState,
    hasMaterial: Boolean,
    photoCount: Int,
): String =
    when (assist) {
        PulseComposeAssistState.Writing -> "Writing your post…"
        is PulseComposeAssistState.Suggested -> "Suggested by AI. Check it and change anything before you post."
        is PulseComposeAssistState.Failed -> assist.message
        PulseComposeAssistState.Idle ->
            if (!hasMaterial) {
                "Add a photo and Pantopus suggests the whole post. You can change anything before you post."
            } else {
                val source =
                    when (photoCount) {
                        0 -> "finish this post from what you wrote"
                        1 -> "write this post from your photo"
                        else -> "write this post from your photos"
                    }
                "Pantopus can $source. You can change anything before you post."
            }
    }

/** "Post this?": words the AI suggested are checked before they go out under the person's name. */
@Composable
internal fun AIPostConfirmDialog(
    message: String,
    onPost: () -> Unit,
    onKeepEditing: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onKeepEditing,
        title = { Text("Post this?") },
        text = { Text(message) },
        confirmButton = {
            TextButton(onClick = onPost, modifier = Modifier.testTag("composePulseAIConfirmPost")) { Text("Post") }
        },
        dismissButton = {
            TextButton(onClick = onKeepEditing, modifier = Modifier.testTag("composePulseAIConfirmKeepEditing")) {
                Text("Keep editing")
            }
        },
        modifier = Modifier.testTag("composePulseAIConfirm"),
    )
}
