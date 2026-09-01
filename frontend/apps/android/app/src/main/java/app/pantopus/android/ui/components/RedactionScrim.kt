@file:Suppress("MagicNumber", "LongMethod", "MatchingDeclarationName", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * B1.3 — identity-preview primitive for A18.5 "View as".
 *
 * Mirrors `Core/Design/Components/RedactionScrim.swift`. An overlay placed
 * over any field/section to show it's withheld from the currently-previewed
 * viewer: it blurs + dims the wrapped content and floats a centred lock
 * chip (caller-supplied copy) in `appSurfaceSunken`. The [level] tunes how
 * aggressive the treatment is — [RedactionLevel.Hidden] also drops the
 * content from the accessibility tree.
 *
 * Composes over arbitrary children, so the View-As render (B5.2) can wrap
 * whichever rows the privacy resolver marks hidden without bespoke markup.
 */

/**
 * How hard the scrim hides its content. Raw treatment values are
 * geometry/opacity, not on the design-token scale, so they live on the
 * enum rather than as `Spacing`/`Radii` tokens.
 */
enum class RedactionLevel(
    val blurRadius: Dp,
    val scrimOpacity: Float,
    val contentOpacity: Float,
) {
    Hidden(blurRadius = 10.dp, scrimOpacity = 0.6f, contentOpacity = 0.35f),
    Fuzzed(blurRadius = 6.dp, scrimOpacity = 0.4f, contentOpacity = 0.6f),
    Partial(blurRadius = 3.dp, scrimOpacity = 0.18f, contentOpacity = 0.85f),
}

/**
 * Blur + wash + lock-chip overlay for withheld profile fields.
 *
 * @param level How aggressively to hide the content.
 * @param label Lock-chip copy (e.g. "Hidden from public").
 * @param showsChip Hide the lock chip when false (wash only).
 * @param content The field/section being redacted.
 */
@Composable
fun RedactionScrim(
    level: RedactionLevel,
    modifier: Modifier = Modifier,
    label: String = "Hidden",
    showsChip: Boolean = true,
    content: @Composable () -> Unit,
) {
    Box(
        modifier =
            modifier
                .clipToBounds()
                .testTag("redactionScrim"),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .blur(level.blurRadius)
                    .alpha(level.contentOpacity)
                    .then(if (level == RedactionLevel.Hidden) Modifier.clearAndSetSemantics {} else Modifier),
        ) {
            content()
        }

        Box(
            modifier =
                Modifier
                    .matchParentSize()
                    .background(PantopusColors.appSurfaceSunken.copy(alpha = level.scrimOpacity)),
        )

        if (showsChip) {
            LockChip(label = label)
        }
    }
}

@Composable
private fun LockChip(label: String) {
    val shape = RoundedCornerShape(Radii.pill)
    Row(
        modifier =
            Modifier
                .clip(shape)
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorderStrong, shape)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                .testTag("redactionScrim_lockChip")
                .clearAndSetSemantics { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Lock,
            contentDescription = null,
            size = 12.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = label,
            style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold, fontSize = 11.5.sp),
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun RedactionScrimPreview() {
    Column(
        modifier =
            Modifier
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        RedactionLevel.entries.forEach { level ->
            RedactionScrim(level = level, label = "Hidden from public") {
                SampleFieldPreview()
            }
        }
    }
}

@Composable
private fun SampleFieldPreview() {
    Column(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(text = "CONTACT", style = PantopusTextStyle.overline, color = PantopusColors.appTextMuted)
        Text(text = "(555) 010-2837", style = PantopusTextStyle.small, color = PantopusColors.appText)
    }
}
