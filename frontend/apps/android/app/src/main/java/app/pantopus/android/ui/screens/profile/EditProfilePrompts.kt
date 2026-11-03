@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.profile.ProfilePromptDto
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.closesKeyboardOnTapOrScroll
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/*
 * The editor's PRF step 5 groups (`Edit.dc.html`, `PromptPicker.dc.html`): Prompts (n of 3), saved with the rest of
 * the form, and Pinned posts (n of 3), where Unpin saves at once and pins are added from a post's ⋯ menu.
 */

/** "Prompts · n of 3": your answers in order (tap one to change it), then "Add a prompt" while there's room. */
@Composable
internal fun EditPromptsGroup(
    prompts: List<ProfilePromptDto>,
    onOpen: (ProfilePrompt) -> Unit,
    onAdd: () -> Unit,
) {
    val answers = promptAnswers(prompts)
    FormFieldGroup("Prompts · ${answers.size} of ${ProfilePrompt.MAX}") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            answers.forEach { (prompt, answer) ->
                EditRow(
                    title = prompt.text,
                    detail = answer,
                    tag = "editProfilePrompt_${prompt.key}",
                    onClick = { onOpen(prompt) },
                )
            }
            if (answers.size < ProfilePrompt.MAX) {
                EditRow(title = "Add a prompt", detail = null, tag = "editProfileAddPrompt", icon = PantopusIcon.Plus, onClick = onAdd)
            }
            FieldHelp("Tap one to change it. Answers can be up to ${ProfilePrompt.ANSWER_LIMIT} characters.")
        }
    }
}

/** "Pinned posts · n of 3": Unpin saves at once. Hidden until your pinned posts are read. */
@Composable
internal fun EditPinnedGroup(
    pinned: List<PinnedCard>?,
    unpinning: String?,
    onUnpin: (String) -> Unit,
) {
    if (pinned == null) return
    FormFieldGroup("Pinned posts · ${pinned.size} of ${ProfilePrompt.MAX}") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            pinned.forEach { card ->
                Row(
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("editProfilePinned_${card.id}"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    PantopusIconImage(icon = PantopusIcon.Pin, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextMuted)
                    Text(
                        text = card.title,
                        fontSize = 15.sp,
                        lineHeight = 20.sp,
                        color = PantopusColors.appText,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Box(
                        modifier =
                            Modifier
                                .heightIn(min = 48.dp)
                                .alpha(if (unpinning == card.id) 0.5f else 1f)
                                .clip(RoundedCornerShape(Radii.pill))
                                .clickable(enabled = unpinning == null, role = Role.Button, onClickLabel = "Unpin ${card.title}") {
                                    onUnpin(card.id)
                                }
                                .padding(horizontal = Spacing.s3),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(text = "Unpin", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
                    }
                }
            }
            FieldHelp("Pin a post from its ⋯ menu. You can pin up to ${ProfilePrompt.MAX}.")
        }
    }
}

@Composable
private fun EditRow(
    title: String,
    detail: String?,
    tag: String,
    onClick: () -> Unit,
    icon: PantopusIcon = PantopusIcon.ChevronRight,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.md))
                .clickable(role = Role.Button, onClick = onClick)
                .padding(vertical = Spacing.s1)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = title,
                fontSize = if (detail == null) 15.sp else 13.sp,
                lineHeight = 18.sp,
                fontWeight = if (detail == null) FontWeight.SemiBold else FontWeight.Normal,
                color = if (detail == null) PantopusColors.primary600 else PantopusColors.appTextMuted,
            )
            detail?.let {
                Text(text = it, fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            }
        }
        PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

/** "Pick a prompt": the catalog, the ones you answered marked "In use" (picking one opens its answer). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PromptPickerSheet(
    used: Set<String>,
    onPick: (ProfilePrompt) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag("editProfilePromptPicker"),
    ) {
        Column(modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(bottom = Spacing.s6)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = Spacing.s5, end = Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Pick a prompt",
                    fontSize = 22.sp,
                    lineHeight = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f).semantics { heading() },
                )
                SheetTextButton(text = "Cancel", onClick = onDismiss)
            }
            Text(
                text = "Pick up to ${ProfilePrompt.MAX}. A short, friendly answer works best.",
                fontSize = 15.sp,
                lineHeight = 20.sp,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.padding(start = Spacing.s5, end = Spacing.s5, bottom = Spacing.s3),
            )
            ProfilePrompt.entries.forEach { prompt ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 56.dp)
                            .clickable(role = Role.Button) { onPick(prompt) }
                            .padding(horizontal = Spacing.s5, vertical = Spacing.s2)
                            .testTag("editProfilePromptChoice_${prompt.key}"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    Text(
                        text = prompt.text,
                        fontSize = 16.sp,
                        lineHeight = 22.sp,
                        color = PantopusColors.appText,
                        modifier = Modifier.weight(1f),
                    )
                    if (prompt.key in used) {
                        Text(
                            text = "In use",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.primary600,
                            modifier =
                                Modifier
                                    .clip(RoundedCornerShape(Radii.pill))
                                    .background(PantopusColors.primary100)
                                    .padding(horizontal = Spacing.s2, vertical = 2.dp),
                        )
                    }
                }
            }
        }
    }
}

/** One prompt's answer: up to 120 characters with a counter; Save puts it in the form, Remove takes it out. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PromptAnswerSheet(
    prompt: ProfilePrompt,
    initial: String,
    canRemove: Boolean,
    onSave: (String) -> Unit,
    onRemove: () -> Unit,
    onDismiss: () -> Unit,
) {
    var answer by rememberSaveable(prompt) { mutableStateOf(initial) }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.closesKeyboardOnTapOrScroll().testTag("editProfilePromptAnswer"),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(start = Spacing.s5, end = Spacing.s5, bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = prompt.text,
                fontSize = 22.sp,
                lineHeight = 28.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            PantopusTextField(
                label = "Your answer",
                value = answer,
                onValueChange = { answer = it.take(ProfilePrompt.ANSWER_LIMIT) },
                fieldTestTag = "editProfilePromptAnswerField",
            )
            Text(
                text = "${answer.length}/${ProfilePrompt.ANSWER_LIMIT}",
                fontSize = 13.sp,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.align(Alignment.End),
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (canRemove) SheetTextButton(text = "Remove", color = PantopusColors.error, onClick = onRemove)
                Spacer(Modifier.weight(1f))
                SheetTextButton(text = "Cancel", onClick = onDismiss)
                SheetTextButton(text = "Done", enabled = answer.isNotBlank(), onClick = { onSave(answer) })
            }
        }
    }
}

@Composable
private fun SheetTextButton(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    color: Color = PantopusColors.primary600,
) {
    Box(
        modifier =
            Modifier
                .heightIn(min = 48.dp)
                .alpha(if (enabled) 1f else 0.4f)
                .clip(RoundedCornerShape(Radii.pill))
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s3),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = color)
    }
}
