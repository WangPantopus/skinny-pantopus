@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.translation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.translation.MailTranslationContent
import app.pantopus.android.ui.screens.mailbox.translation.TranslationListenColumn
import app.pantopus.android.ui.screens.mailbox.translation.TranslationParagraph
import app.pantopus.android.ui.screens.mailbox.translation.TranslationViewMode
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

// ─── Shared serif paragraph renderer ──────────────────────────

/**
 * Build a serif [AnnotatedString] for one paragraph, optionally
 * highlighting the first occurrence of [highlight] in the translation
 * accent. Mirrors iOS `TranslationLetterText`.
 */
private fun letterText(
    string: String,
    highlight: String?,
    isHeading: Boolean,
    isSignoff: Boolean,
    baseColor: Color,
): AnnotatedString =
    buildAnnotatedString {
        val baseStyle =
            SpanStyle(
                color = baseColor,
                fontFamily = FontFamily.Serif,
                fontWeight = if (isHeading) FontWeight.Bold else FontWeight.Normal,
                fontStyle = if (isSignoff) FontStyle.Italic else FontStyle.Normal,
            )
        val markStart = if (highlight.isNullOrEmpty()) -1 else string.indexOf(highlight)
        if (markStart < 0 || highlight == null) {
            withStyle(baseStyle) { append(string) }
        } else {
            withStyle(baseStyle) { append(string.substring(0, markStart)) }
            withStyle(
                baseStyle.copy(
                    color = PantopusColors.categoryTranslationInk,
                    background = PantopusColors.categoryTranslationBg,
                    fontStyle = FontStyle.Italic,
                    fontWeight = FontWeight.SemiBold,
                ),
            ) { append(highlight) }
            withStyle(baseStyle) { append(string.substring(markStart + highlight.length)) }
        }
    }

// ─── Side-by-side comparison ──────────────────────────────────

/**
 * Paragraph-aligned original ↔ English columns in a paper serif, with the
 * glossary term highlighted inline. Mirrors iOS `SideBySideView`.
 */
@Composable
fun SideBySideView(
    content: MailTranslationContent,
    onListen: (TranslationListenColumn) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .testTag("translation_sideBySide"),
    ) {
        Row(modifier = Modifier.height(IntrinsicSize.Min)) {
            ColumnHeader(
                label = "Original · ${content.languages.sourceCode}",
                accent = false,
                onListen = { onListen(TranslationListenColumn.Original) },
                modifier = Modifier.weight(1f),
            )
            VerticalRule()
            ColumnHeader(
                label = content.languages.targetName,
                accent = true,
                onListen = { onListen(TranslationListenColumn.Translated) },
                modifier = Modifier.weight(1f),
            )
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        content.paragraphs.forEachIndexed { index, paragraph ->
            Row(modifier = Modifier.height(IntrinsicSize.Min)) {
                Cell(
                    text =
                        letterText(
                            paragraph.original,
                            highlight = null,
                            isHeading = paragraph.isHeading,
                            isSignoff = paragraph.isSignoff,
                            baseColor = PantopusColors.appTextSecondary,
                        ),
                    size = cellSize(paragraph),
                    modifier = Modifier.weight(1f),
                )
                VerticalRule()
                Cell(
                    text =
                        letterText(
                            paragraph.english,
                            highlight = content.highlightTerm,
                            isHeading = paragraph.isHeading,
                            isSignoff = paragraph.isSignoff,
                            baseColor = PantopusColors.appText,
                        ),
                    size = cellSize(paragraph),
                    modifier = Modifier.weight(1f),
                )
            }
            if (index < content.paragraphs.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
            }
        }
    }
}

private fun cellSize(p: TranslationParagraph): TextUnit = if (p.isHeading || p.isSignoff) 13.sp else 12.5.sp

@Composable
private fun ColumnHeader(
    label: String,
    accent: Boolean,
    onListen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(
            modifier =
                Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(if (accent) PantopusColors.categoryTranslation else PantopusColors.appTextMuted),
        )
        Text(
            text = label.uppercase(),
            modifier = Modifier.weight(1f),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = if (accent) PantopusColors.categoryTranslation else PantopusColors.appTextSecondary,
            maxLines = 1,
        )
        ListenButton(accent = accent, onClick = onListen)
    }
}

@Composable
private fun Cell(
    text: AnnotatedString,
    size: TextUnit,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        modifier = modifier.padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        fontSize = size,
        lineHeight = size * 1.5f,
    )
}

@Composable
private fun VerticalRule() {
    Box(
        modifier =
            Modifier
                .width(1.dp)
                .fillMaxHeight()
                .background(PantopusColors.appBorderSubtle),
    )
}

// ─── Clean reading view (paper) ───────────────────────────────

/**
 * A clean single-language reading view on warm paper (the confirmed-state
 * default + the "Original" toggle option). Mirrors iOS
 * `TranslationReadingView`.
 */
@Composable
fun TranslationReadingView(
    content: MailTranslationContent,
    showing: TranslationViewMode,
    onSelect: (TranslationViewMode) -> Unit,
    onListen: (TranslationListenColumn) -> Unit,
) {
    val showingOriginal = showing == TranslationViewMode.Original
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .testTag("translation_readingView"),
    ) {
        ReadingHeader(
            content = content,
            showingOriginal = showingOriginal,
            onSwap = { onSelect(if (showingOriginal) TranslationViewMode.Translated else TranslationViewMode.Original) },
            onListen = { onListen(if (showingOriginal) TranslationListenColumn.Original else TranslationListenColumn.Translated) },
        )
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.categoryTranslationPaper)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
        ) {
            content.paragraphs.forEachIndexed { index, paragraph ->
                val size = if (paragraph.isHeading || paragraph.isSignoff) 15.sp else 14.5.sp
                Text(
                    text =
                        letterText(
                            if (showingOriginal) paragraph.original else paragraph.english,
                            highlight = if (showingOriginal) null else content.highlightTerm,
                            isHeading = paragraph.isHeading,
                            isSignoff = paragraph.isSignoff,
                            baseColor = PantopusColors.categoryTranslationPaperInk,
                        ),
                    modifier =
                        Modifier.padding(
                            bottom = if (index < content.paragraphs.size - 1) Spacing.s3 else Spacing.s0,
                        ),
                    fontSize = size,
                    lineHeight = size * 1.6f,
                )
            }
        }
    }
}

@Composable
private fun ReadingHeader(
    content: MailTranslationContent,
    showingOriginal: Boolean,
    onSwap: () -> Unit,
    onListen: () -> Unit,
) {
    val title =
        if (showingOriginal) {
            "Original · ${content.languages.sourceName}"
        } else {
            "${content.languages.targetName} translation"
        }
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(if (showingOriginal) PantopusColors.appTextMuted else PantopusColors.categoryTranslation),
        )
        Text(
            text = title.uppercase(),
            modifier = Modifier.weight(1f),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = if (showingOriginal) PantopusColors.appTextSecondary else PantopusColors.categoryTranslation,
            maxLines = 1,
        )
        ListenButton(accent = !showingOriginal, onClick = onListen)
        Row(
            modifier =
                Modifier
                    .clickable(onClick = onSwap)
                    .testTag("translation_readingView_swap"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowRightLeft,
                contentDescription = null,
                size = 12.dp,
                tint = PantopusColors.primary600,
            )
            Text(
                text = if (showingOriginal) "Show translation" else "Show original",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary600,
            )
        }
    }
}

// ─── Listen (stub TTS) button ─────────────────────────────────

/**
 * Small circular "play" button on the column / reading-view headers. Real
 * audio is out of scope (B2.3) — wired to a toast so it's never a dead tap.
 */
@Composable
fun ListenButton(
    accent: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(26.dp)
                .clip(CircleShape)
                .background(if (accent) PantopusColors.categoryTranslationBg else PantopusColors.appSurfaceSunken)
                .clickable(onClick = onClick)
                .semantics {
                    contentDescription = if (accent) "Listen to the translation" else "Listen to the original"
                }
                .testTag("translation_listen_${if (accent) "translated" else "original"}"),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Play,
            contentDescription = null,
            size = 11.dp,
            tint = if (accent) PantopusColors.categoryTranslation else PantopusColors.appTextSecondary,
        )
    }
}
