@file:Suppress("MagicNumber", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

/**
 * A19 legal scaffold — a thin "Last updated · version" meta strip that sits
 * directly beneath the legal-document top bar. Sunken surface, a leading
 * clock glyph, and the date + version emphasised against muted label text.
 *
 * Shared by A19.1 Privacy Policy + A19.2 Terms of Service (one scaffold; only
 * the date / version copy changes per document).
 *
 * @param lastUpdated Human-readable date, e.g. "October 1, 2025".
 * @param version Document version, e.g. "3.2".
 */
@Composable
fun DocMetaStrip(
    lastUpdated: String,
    version: String,
    modifier: Modifier = Modifier,
) {
    val text =
        buildAnnotatedString {
            withStyle(SpanStyle(color = PantopusColors.appTextSecondary)) { append("Last updated: ") }
            withStyle(SpanStyle(color = PantopusColors.appTextStrong, fontWeight = FontWeight.SemiBold)) {
                append(lastUpdated)
            }
            withStyle(SpanStyle(color = PantopusColors.appTextMuted)) { append("  ·  ") }
            withStyle(SpanStyle(color = PantopusColors.appTextSecondary)) { append("Version ") }
            withStyle(SpanStyle(color = PantopusColors.appTextStrong, fontWeight = FontWeight.SemiBold)) {
                append(version)
            }
        }
    val border = PantopusColors.appBorder
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurfaceSunken)
                .drawBehind {
                    val stroke = 1.dp.toPx()
                    drawRect(
                        color = border,
                        topLeft = Offset(0f, size.height - stroke),
                        size = Size(size.width, stroke),
                    )
                }
                .padding(horizontal = Spacing.s5, vertical = 9.dp)
                .semantics { contentDescription = "Last updated $lastUpdated, version $version" }
                .testTag("docMetaStrip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Clock,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = text,
            color = PantopusColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
        )
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun DocMetaStripPreview() {
    DocMetaStrip(lastUpdated = "October 1, 2025", version = "3.2")
}
