@file:Suppress("MagicNumber", "MatchingDeclarationName", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Geometry variant for [CompactButton]. Mirrors `CompactButton.swift`'s
 * `CompactButtonSize`.
 *
 * - [Footer] — 34dp height, full width inside its flex cell. Used for
 *   in-card row footers (My bids / My tasks / Offers / Review claims).
 * - [InlineAction] — 30dp primary / 28dp ghost. Used for inline pill
 *   actions next to row metadata (Connections Accept / Ignore).
 */
enum class CompactButtonSize { Footer, InlineAction }

/**
 * Small-density button with optional leading icon. Mirrors iOS
 * `CompactButton.swift` — variant palette matches [PantopusButton] but the
 * geometry is intentionally compact so the button fits inside list rows
 * where a 44dp primary CTA would overwhelm the row.
 *
 * @param title Label rendered in caption type. Also becomes the
 *     accessibility label for parity with iOS.
 * @param variant Palette role: primary (filled sky), ghost (surface +
 *     border), destructive (surface + border + red text).
 * @param size Geometry pick — see [CompactButtonSize].
 * @param icon Optional leading glyph at 13dp, tinted to match foreground.
 */
@Composable
fun CompactButton(
    title: String,
    variant: CompactButtonVariant,
    size: CompactButtonSize,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
) {
    val heightDp =
        when {
            size == CompactButtonSize.Footer -> 34.dp
            variant == CompactButtonVariant.Ghost -> 28.dp
            else -> 30.dp
        }
    val background = compactBackground(variant)
    val foreground = compactForeground(variant)
    val border: BorderStroke? =
        when (variant) {
            CompactButtonVariant.Primary -> null
            CompactButtonVariant.Ghost, CompactButtonVariant.Destructive ->
                BorderStroke(1.dp, PantopusColors.appBorder)
        }
    val baseShape = RoundedCornerShape(Radii.md)
    val rowModifier =
        modifier
            .height(heightDp)
            .clip(baseShape)
            .background(background)
            .let { m -> if (border != null) m.border(border, baseShape) else m }
            .clickable(onClick = onClick)
            .padding(horizontal = Spacing.s3)
            .semantics {
                contentDescription = title
                role = Role.Button
            }.testTag("compactButton")

    Row(
        modifier = rowModifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1, Alignment.CenterHorizontally),
    ) {
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 13.dp,
                tint = foreground,
            )
        }
        Text(text = title, style = PantopusTextStyle.caption, color = foreground)
    }
}

private fun compactBackground(variant: CompactButtonVariant): Color =
    when (variant) {
        CompactButtonVariant.Primary -> PantopusColors.primary600
        CompactButtonVariant.Ghost -> PantopusColors.appSurface
        CompactButtonVariant.Destructive -> PantopusColors.appSurface
    }

private fun compactForeground(variant: CompactButtonVariant): Color =
    when (variant) {
        CompactButtonVariant.Primary -> PantopusColors.appTextInverse
        CompactButtonVariant.Ghost -> PantopusColors.appTextStrong
        CompactButtonVariant.Destructive -> PantopusColors.error
    }

@Preview(showBackground = true, widthDp = 360, heightDp = 220)
@Composable
private fun CompactButtonPreview() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                CompactButton(
                    title = "Withdraw",
                    variant = CompactButtonVariant.Destructive,
                    size = CompactButtonSize.Footer,
                    onClick = {},
                    icon = PantopusIcon.X,
                )
                CompactButton(
                    title = "Edit bid",
                    variant = CompactButtonVariant.Primary,
                    size = CompactButtonSize.Footer,
                    onClick = {},
                    icon = PantopusIcon.Check,
                )
            }
        }
        CompactButton(
            title = "Accept",
            variant = CompactButtonVariant.Primary,
            size = CompactButtonSize.InlineAction,
            onClick = {},
        )
        CompactButton(
            title = "Ignore",
            variant = CompactButtonVariant.Ghost,
            size = CompactButtonSize.InlineAction,
            onClick = {},
        )
    }
}
