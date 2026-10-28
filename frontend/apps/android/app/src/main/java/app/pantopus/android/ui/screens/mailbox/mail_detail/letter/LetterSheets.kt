@file:Suppress("PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.mail_detail.letter

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.vault.VaultFolderDto
import app.pantopus.android.ui.screens.mailbox.components.MailSender
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailContent
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/**
 * The letter page's sheets and questions: the envelope turned over, "Shred this?", "Done with it?" and the Vault's
 * folders. Nothing shows without the Mail tab's letter.
 */
@Composable
fun LetterSheets(
    content: MailDetailContent?,
    showEnvelope: Boolean,
    confirmShred: Boolean,
    confirmDone: Boolean,
    folders: List<VaultFolderDto>?,
    onCloseEnvelope: () -> Unit,
    onOpenSenderPage: (MailDetailContent) -> Unit,
    onShred: () -> Unit,
    onKeep: () -> Unit,
    onDone: () -> Unit,
    onNotYet: () -> Unit,
    onFileIn: (VaultFolderDto) -> Unit,
    onCloseFolders: () -> Unit,
) {
    val letter = content?.letter ?: return
    if (showEnvelope) {
        // Pantopus has no page of its own; a person's profile or a business's page otherwise.
        val pageLabel =
            content.senderUserId
                ?.takeIf { letter.sender != MailSender.Pantopus }
                ?.let { if (content.senderIsBusiness) "See their business page" else "See their profile" }
        EnvelopeSheet(letter = letter, pageLabel = pageLabel, onOpenPage = { onOpenSenderPage(content) }, onDismiss = onCloseEnvelope)
    }
    if (confirmShred) {
        val words =
            if (letter.drawer == "home") {
                "It's gone for everyone who gets your home's mail. You can bring it back for 30 days."
            } else {
                "You can bring it back for 30 days."
            }
        Question(
            title = "Shred this?",
            text = words,
            confirm = "Shred",
            confirmTag = "mailLetterShredConfirm",
            destructive = true,
            dismiss = "Keep it",
            onConfirm = onShred,
            onDismiss = onKeep,
        )
    }
    if (confirmDone) {
        Question(
            title = "Done with it?",
            text = "It comes off the counter and goes into the Vault.",
            confirm = "Done",
            confirmTag = "mailLetterDoneConfirm",
            destructive = false,
            dismiss = "Not yet",
            onConfirm = onDone,
            onDismiss = onNotYet,
        )
    }
    folders?.let { FolderPicker(it, onFileIn, onCloseFolders) }
}

@Composable
private fun Question(
    title: String,
    text: String,
    confirm: String,
    confirmTag: String,
    destructive: Boolean,
    dismiss: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(text, fontSize = 14.sp, lineHeight = 20.sp, color = PantopusColors.appTextSecondary) },
        confirmButton = {
            TextButton(onClick = onConfirm, modifier = Modifier.testTag(confirmTag)) {
                Text(
                    confirm,
                    color = if (destructive) PantopusColors.error else PantopusColors.primary600,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(dismiss, color = PantopusColors.appTextSecondary) }
        },
    )
}

/** File in the Vault: the folders that fit this letter (the person's own, or its Home's shared cabinet). */
@Composable
private fun FolderPicker(
    folders: List<VaultFolderDto>,
    onFileIn: (VaultFolderDto) -> Unit,
    onClose: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onClose,
        title = { Text("File in the Vault") },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Choose a folder.", fontSize = 13.sp, color = PantopusColors.appTextSecondary)
                folders.forEach { folder ->
                    Text(
                        folder.label,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clickable(role = Role.Button, onClickLabel = "File here") { onFileIn(folder) }
                                .heightIn(min = 48.dp)
                                .padding(vertical = Spacing.s3)
                                .testTag("mailLetterFolder_${folder.id}"),
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onClose) { Text("Cancel", color = PantopusColors.appTextSecondary) }
        },
    )
}
