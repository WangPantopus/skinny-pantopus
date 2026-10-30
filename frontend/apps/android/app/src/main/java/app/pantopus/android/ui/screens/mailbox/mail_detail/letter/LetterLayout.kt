@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.mail_detail.letter

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.MailEnclosure
import app.pantopus.android.ui.components.CompactButton
import app.pantopus.android.ui.components.CompactButtonSize
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.mailbox.components.MailPiece
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailContent
import app.pantopus.android.ui.screens.mailbox.mailbox_root.MailPieceRow
import app.pantopus.android.ui.screens.mailbox.mailbox_root.MailPieceSkeleton
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailItemDetailTopBar
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailTopBarConfig
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import java.util.Locale

/**
 * The letter page (Mail tab, receiving; drawings `R5-Bill`, `R6-Envelope`): the envelope it came in (tap it to turn it
 * over), "Pantopus read this for you" clipped to the letter, the letter on paper with what's enclosed, a bundle's
 * pieces, and the actions in mail words: Pay, Acknowledge, Put on the counter, File in the Vault, Shred.
 */
@Composable
fun LetterLayout(
    content: MailDetailContent,
    letter: MailLetter,
    bundle: MailBundleState?,
    actionInFlight: String?,
    ackInFlight: Boolean,
    enclosureInFlight: String?,
    removed: Boolean,
    onBack: () -> Unit,
    actions: LetterActions,
    /** Shredded: "Bring it back", under the top bar. */
    banner: (@Composable () -> Unit)? = null,
) {
    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("mailLetter")) {
        MailItemDetailTopBar(config = MailTopBarConfig(eyebrow = "Mail", trust = content.detailTrust, onBack = onBack))
        banner?.invoke()
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            val card = letter.card
            if (card != null) {
                // A Christmas card: the card comes out of its envelope instead of a letter.
                HolidayCardPage(letter, card, onEnvelope = actions.onEnvelope, onOpen = actions.onOpenCard)
            } else {
                Envelope(letter, actions.onEnvelope)
                letter.note?.let { PantopusNote(it) }
                LetterSheet(content, letter, enclosureInFlight, actions.onOpenEnclosure)
                if (letter.isBundle) BundlePieces(bundle, actions.onOpenPiece, actions.onRetryBundle)
            }
            // A shredded piece offers Bring it back above the letter instead. A Christmas card is nothing to do, so it
            // doesn't go on the counter.
            if (!removed) LetterButtons(letter, actionInFlight, ackInFlight, actions, counter = card == null)
        }
    }
}

/** The envelope it came in, drawn opened as in the Mailbox; tapping turns it over. */
@Composable
private fun Envelope(
    letter: MailLetter,
    onOpen: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .clickable(onClickLabel = "See who sent it and its trail", role = Role.Button, onClick = onOpen)
                .clearAndSetSemantics {
                    contentDescription = "Envelope. ${letter.envelope.accessibilityLabel}"
                    role = Role.Button
                }.testTag("mailLetterEnvelope"),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        MailPiece(letter.envelope)
        Text(
            "Tap the envelope to see who sent it and its trail.",
            fontSize = 12.sp,
            lineHeight = 16.sp,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.padding(start = 2.dp),
        )
    }
}

/** "Pantopus read this for you", clipped to the top of the letter. */
@Composable
private fun PantopusNote(note: MailLetterNote) {
    Box(modifier = Modifier.fillMaxWidth().testTag("mailLetterNote")) {
        Column(
            modifier =
                Modifier
                    .padding(top = 10.dp)
                    .fillMaxWidth()
                    .shadow(2.dp, RoundedCornerShape(6.dp))
                    .background(PantopusColors.appSurface, RoundedCornerShape(6.dp))
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(6.dp))
                    .padding(start = Spacing.s4, end = Spacing.s4, top = 18.dp, bottom = Spacing.s4)
                    .semantics(mergeDescendants = true) {},
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PantopusIconImage(icon = PantopusIcon.Sparkles, contentDescription = null, size = 14.dp, tint = PantopusColors.primary600)
                Text(
                    "Pantopus read this for you",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.02.em,
                    color = PantopusColors.primary600,
                    modifier = Modifier.semantics { heading() },
                )
            }
            Text(note.text, fontSize = 15.sp, lineHeight = 22.sp, color = PantopusColors.appText)
            note.facts.forEach { (label, value) ->
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    Text(
                        label,
                        fontSize = 13.sp,
                        lineHeight = 18.sp,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.weight(0.4f),
                    )
                    Text(
                        value,
                        fontSize = 13.sp,
                        lineHeight = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                        modifier = Modifier.weight(0.6f),
                    )
                }
            }
            Text(
                if (note.checkAmount) "Read from the letter below. Check the amount before you pay." else "Read from the letter below.",
                fontSize = 12.sp,
                lineHeight = 16.sp,
                color = PantopusColors.appTextMuted,
            )
        }
        // The clip holding the note to the letter.
        Box(
            modifier =
                Modifier
                    .align(Alignment.TopCenter)
                    .size(width = 30.dp, height = 22.dp)
                    .border(2.5.dp, PantopusColors.mailClip, RoundedCornerShape(8.dp)),
        )
    }
}

/** The letter on paper: letterhead, who it's to, the day, the text, and its enclosures. */
@Composable
private fun LetterSheet(
    content: MailDetailContent,
    letter: MailLetter,
    enclosureInFlight: String?,
    onOpenEnclosure: (MailEnclosure) -> Unit,
) {
    val shape = RoundedCornerShape(4.dp)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .shadow(1.dp, shape)
                .background(PantopusColors.mailSheet, shape)
                .border(1.dp, PantopusColors.mailSheetEdge, shape)
                .padding(horizontal = 20.dp, vertical = 22.dp)
                .testTag("mailLetterSheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Box(
                modifier = Modifier.size(36.dp).clip(RoundedCornerShape(6.dp)).background(PantopusColors.mailInk),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    letter.fromName.firstOrNull()?.uppercase() ?: "?",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    letter.fromName.uppercase(Locale.US),
                    fontSize = 12.sp,
                    lineHeight = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.06.em,
                    color = PantopusColors.mailInk,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                letter.fromLine?.let { Text(it, fontSize = 12.sp, lineHeight = 16.sp, color = PantopusColors.appTextSecondary) }
            }
        }
        HorizontalDivider(color = PantopusColors.mailSheetRule)
        if (letter.toName != null || letter.toLine != null) {
            Column {
                letter.toName?.let { Text(it, fontSize = 14.sp, lineHeight = 20.sp, color = PantopusColors.appText) }
                letter.toLine?.let { Text(it, fontSize = 14.sp, lineHeight = 20.sp, color = PantopusColors.appText) }
            }
        }
        letter.dated?.let { Text(it, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary) }
        Text(
            content.title,
            fontFamily = FontFamily.Serif,
            fontSize = 18.sp,
            lineHeight = 24.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        content.bodyParagraphs.ifEmpty { listOfNotNull(content.excerpt?.takeIf { it.isNotBlank() }) }.forEach { paragraph ->
            Text(paragraph, fontFamily = FontFamily.Serif, fontSize = 16.sp, lineHeight = 25.sp, color = PantopusColors.appText)
        }
        letter.enclosures.forEach { enclosure ->
            EnclosureSlip(enclosure, opening = enclosureInFlight == enclosure.id, onOpen = { onOpenEnclosure(enclosure) })
        }
    }
}

/** "Enclosed: Warranty card.pdf · PDF · 642 KB · Open". */
@Composable
private fun EnclosureSlip(
    enclosure: MailEnclosure,
    opening: Boolean,
    onOpen: () -> Unit,
) {
    val name = enclosure.name?.takeIf { it.isNotBlank() } ?: "Enclosure"
    val details = listOfNotNull(typeWord(enclosure.mimeType), sizeWords(enclosure.sizeBytes)).joinToString(" · ")
    val shape = RoundedCornerShape(4.dp)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.mailSlip)
                .border(1.dp, PantopusColors.mailSheetEdge, shape)
                .clickable(enabled = !opening, onClickLabel = "Open", role = Role.Button, onClick = onOpen)
                .heightIn(min = 48.dp)
                .padding(horizontal = 12.dp, vertical = 10.dp)
                .semantics(mergeDescendants = true) {}
                .testTag("mailLetterEnclosure.${enclosure.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Paperclip, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextSecondary)
        Column(modifier = Modifier.weight(1f)) {
            Text("Enclosed: $name", fontSize = 14.sp, lineHeight = 19.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            if (details.isNotEmpty()) Text(details, fontSize = 12.sp, lineHeight = 16.sp, color = PantopusColors.appTextMuted)
        }
        Text(
            if (opening) "Opening…" else "Open",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
        )
    }
}

/** "PDF", "Photo", or the file's own type. */
private fun typeWord(mime: String?): String? =
    when {
        mime == null -> null
        mime == "application/pdf" -> "PDF"
        mime.startsWith("image/") -> "Photo"
        else -> mime.substringAfter('/').uppercase(Locale.US).takeIf { it.length in 1..12 }
    }

/** "642 bytes", "48 KB", "1.2 MB". */
private fun sizeWords(bytes: Long?): String? =
    when {
        bytes == null || bytes < 0 -> null
        bytes < 1024 -> "$bytes bytes"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        else -> String.format(Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0))
    }

/** What came in a bundle, each opening its own letter page. */
@Composable
private fun BundlePieces(
    state: MailBundleState?,
    onOpenPiece: (String) -> Unit,
    onRetry: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().testTag("mailLetterBundle"), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            "IN THIS BUNDLE",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.06.em,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.semantics { heading() },
        )
        when (state) {
            null, MailBundleState.Loading -> MailPieceSkeleton()
            is MailBundleState.Failed ->
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(Spacing.s3)) {
                    Text(state.message, fontSize = 13.sp, color = PantopusColors.appTextSecondary, textAlign = TextAlign.Center)
                    CompactButton(
                        title = "Try again",
                        variant = CompactButtonVariant.Primary,
                        size = CompactButtonSize.InlineAction,
                        onClick = onRetry,
                        modifier = Modifier.padding(top = Spacing.s2).testTag("mailLetterBundleRetry"),
                    )
                }
            is MailBundleState.Loaded ->
                if (state.pieces.isEmpty()) {
                    Text("Nothing in this bundle is yours to open.", fontSize = 13.sp, color = PantopusColors.appTextSecondary)
                } else {
                    state.pieces.forEach { piece -> MailPieceRow(piece, onOpen = { onOpenPiece(piece.id) }) }
                }
        }
    }
}

/** Pay, Acknowledge, and where it goes next: the counter, the Vault, or the shredder. */
@Composable
private fun LetterButtons(
    letter: MailLetter,
    actionInFlight: String?,
    ackInFlight: Boolean,
    actions: LetterActions,
    counter: Boolean = true,
) {
    val busy = actionInFlight != null
    Column(modifier = Modifier.fillMaxWidth().testTag("mailLetterActions"), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        val invoiceId = letter.invoiceId
        if (letter.payLabel != null && invoiceId != null) {
            PrimaryButton(
                title = letter.payLabel,
                onClick = { actions.onPay(invoiceId) },
                modifier = Modifier.fillMaxWidth().testTag("mailLetterPay"),
            )
        }
        if (letter.paid) StatusLine("Paid", PantopusIcon.CheckCircle, PantopusColors.success, "mailLetterPaid")
        if (letter.asksAcknowledge) {
            if (letter.payLabel == null) {
                PrimaryButton(
                    title = "Acknowledge",
                    onClick = actions.onAcknowledge,
                    isLoading = ackInFlight,
                    modifier = Modifier.fillMaxWidth().testTag("mailLetterAcknowledge"),
                )
            } else {
                GhostButton(
                    title = "Acknowledge",
                    onClick = actions.onAcknowledge,
                    isLoading = ackInFlight,
                    modifier = Modifier.fillMaxWidth().testTag("mailLetterAcknowledge"),
                )
            }
        } else if (letter.acknowledged) {
            StatusLine("Acknowledged", PantopusIcon.CheckCircle, PantopusColors.success, "mailLetterAcknowledged")
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
            if (letter.filed || letter.archived) {
                // Filed or archived mail isn't on the counter; it comes back to Incoming first.
                ActionTile(
                    if (letter.filed) "Take out of the Vault" else "Back to Incoming",
                    PantopusIcon.Undo2,
                    busy,
                    actionInFlight == "unfile",
                    "mailLetterUnfile",
                    actions.onUnfile,
                )
            } else {
                if (counter) CounterTile(letter, busy, actionInFlight, actions)
                ActionTile("File in the Vault", PantopusIcon.FolderPlus, busy, actionInFlight == "file", "mailLetterFile", actions.onFile)
            }
            ActionTile(
                "Shred",
                PantopusIcon.Trash2,
                busy,
                actionInFlight == "shred",
                "mailLetterShred",
                actions.onShred,
                destructive = true,
            )
        }
    }
}

/** Put on the counter; on the counter, tapping asks "Done with it?" and files it. */
@Composable
private fun RowScope.CounterTile(
    letter: MailLetter,
    busy: Boolean,
    actionInFlight: String?,
    actions: LetterActions,
) {
    if (letter.onCounter) {
        ActionTile(
            "On the counter",
            PantopusIcon.CheckCircle,
            busy,
            actionInFlight == "done",
            "mailLetterOnCounter",
            actions.onDone,
            selected = true,
        )
    } else {
        ActionTile(
            "Put on the counter",
            PantopusIcon.Inbox,
            busy,
            actionInFlight == "counter",
            "mailLetterCounter",
            actions.onPutOnCounter,
        )
    }
}

@Composable
private fun StatusLine(
    title: String,
    icon: PantopusIcon,
    tint: Color,
    tag: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s1).semantics(mergeDescendants = true) {}.testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = tint)
        Text(title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = tint)
    }
}

/** One of the letter's actions: an icon and its words, at least 48 dp tall. */
@Composable
private fun RowScope.ActionTile(
    title: String,
    icon: PantopusIcon,
    busy: Boolean,
    working: Boolean,
    tag: String,
    onClick: () -> Unit,
    selected: Boolean = false,
    destructive: Boolean = false,
) {
    val ink =
        when {
            destructive -> PantopusColors.error
            selected -> PantopusColors.primary600
            else -> PantopusColors.appText
        }
    val shape = RoundedCornerShape(10.dp)
    Column(
        modifier =
            Modifier
                .weight(1f)
                .clip(shape)
                .background(if (selected) PantopusColors.primary100 else PantopusColors.appSurface)
                .border(1.dp, if (selected) PantopusColors.primary600 else PantopusColors.appBorder, shape)
                .clickable(enabled = !busy, role = Role.Button, onClick = onClick)
                .heightIn(min = 64.dp)
                .padding(horizontal = 6.dp, vertical = 10.dp)
                .semantics(mergeDescendants = true) {
                    if (selected) this.selected = true
                }.testTag(tag),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = ink)
        Text(
            if (working) "Saving…" else title,
            fontSize = 12.sp,
            lineHeight = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = ink,
            textAlign = TextAlign.Center,
        )
    }
}
