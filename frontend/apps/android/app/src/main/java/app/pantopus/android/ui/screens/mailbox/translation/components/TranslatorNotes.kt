@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.translation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.translation.TranslationGlossaryNote
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Translator-notes glossary ("From Pantopus"). Mirrors iOS `TranslatorNotes`. */
@Composable
fun TranslatorNotes(notes: List<TranslationGlossaryNote>) {
    TranslationCard(modifier = Modifier.testTag("translation_glossary"), noPad = true) {
        TranslationCardLabel(
            title = "Translator notes",
            modifier = Modifier.padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s3, bottom = Spacing.s2),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Sparkles,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = "From Pantopus",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        // Design renders a border-top on every glossary row, including the first.
        notes.forEach { note ->
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            NoteRow(note)
        }
    }
}

@Composable
private fun NoteRow(note: TranslationGlossaryNote) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = note.term,
                fontSize = 14.sp,
                fontFamily = FontFamily.Serif,
                fontStyle = FontStyle.Italic,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = note.kind.uppercase(),
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.categoryTranslationBg)
                        .padding(horizontal = Spacing.s2, vertical = 2.dp),
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.4.sp,
                color = PantopusColors.categoryTranslationInk,
            )
        }
        Text(
            text = note.note,
            fontSize = 12.sp,
            color = PantopusColors.appTextStrong,
            lineHeight = 18.sp,
        )
    }
}

// ─── Inline action bars ───────────────────────────────────────

/** One labelled icon chip in the 4-up secondary row. */
@Composable
private fun TranslationChip(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s2)
                .semantics { contentDescription = label }
                .testTag("translation_chip_${label.lowercase()}"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 17.dp,
            tint = PantopusColors.appTextStrong,
        )
        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
            maxLines = 1,
        )
    }
}

@Composable
private fun PrimaryBar(
    icon: PantopusIcon,
    label: String,
    inFlight: Boolean,
    onClick: () -> Unit,
    testTag: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary600)
                .clickable(enabled = !inFlight, onClick = onClick)
                .padding(vertical = 14.dp)
                .alpha(if (inFlight) 0.6f else 1f)
                .semantics { contentDescription = label }
                .testTag(testTag),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 17.dp,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = label,
            modifier = Modifier.padding(start = Spacing.s2),
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

/** Machine-state action bar: "Confirm translation" + Edit/Language/Listen/Archive. */
@Composable
fun TranslationMachineActions(
    confirmInFlight: Boolean,
    onConfirm: () -> Unit,
    onEdit: () -> Unit,
    onLanguage: () -> Unit,
    onListen: () -> Unit,
    onArchive: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        PrimaryBar(
            icon = PantopusIcon.CheckCheck,
            label = "Confirm translation",
            inFlight = confirmInFlight,
            onClick = onConfirm,
            testTag = "translation_confirm",
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            TranslationChip(PantopusIcon.Pencil, "Edit", onEdit, Modifier.weight(1f))
            TranslationChip(PantopusIcon.Globe, "Language", onLanguage, Modifier.weight(1f))
            TranslationChip(PantopusIcon.Play, "Listen", onListen, Modifier.weight(1f))
            TranslationChip(PantopusIcon.Archive, "Archive", onArchive, Modifier.weight(1f))
        }
    }
}

/** Confirmed-state action bar: "Reply to {name}" + Re-translate/Original/Share/Archive. */
@Composable
fun TranslationConfirmedActions(
    replyName: String,
    onReply: () -> Unit,
    onRetranslate: () -> Unit,
    onShowOriginal: () -> Unit,
    onShare: () -> Unit,
    onArchive: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        PrimaryBar(
            icon = PantopusIcon.Reply,
            label = "Reply to $replyName",
            inFlight = false,
            onClick = onReply,
            testTag = "translation_reply",
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            TranslationChip(PantopusIcon.ArrowsRepeat, "Re-translate", onRetranslate, Modifier.weight(1f))
            TranslationChip(PantopusIcon.FileText, "Original", onShowOriginal, Modifier.weight(1f))
            TranslationChip(PantopusIcon.Share, "Share", onShare, Modifier.weight(1f))
            TranslationChip(PantopusIcon.Archive, "Archive", onArchive, Modifier.weight(1f))
        }
    }
}
