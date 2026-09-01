@file:Suppress("MagicNumber", "MatchingDeclarationName", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.shared.list_of_rows.Bidder
import app.pantopus.android.ui.screens.shared.list_of_rows.BidderTone
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/**
 * Overlapping 22dp mini-avatars + `+N` overflow tile.
 *
 * Mirrors `Core/Design/Components/BidderStack.swift` — used inside My
 * tasks rows to communicate competition at a glance. The 2dp surface
 * border simulates overlap when the next tile shifts back by -8dp.
 *
 * @param bidders Bidders rendered in order. Each tile is 22dp.
 * @param overflow Trailing "+N" count. Clamped to `>= 0`.
 * @param onClick Optional tap handler — feature code wires this to the
 *     row's participants sheet (mirrors iOS row tap behaviour).
 */
@Composable
fun BidderStack(
    bidders: List<Bidder>,
    modifier: Modifier = Modifier,
    overflow: Int = 0,
    onClick: (() -> Unit)? = null,
) {
    val safeOverflow = overflow.coerceAtLeast(0)
    val a11y =
        Modifier
            .semantics {
                contentDescription = a11yLabel(bidders.size + safeOverflow)
                if (onClick != null) role = Role.Button
            }.testTag("bidderStack")
    val rowModifier =
        modifier
            .then(a11y)
            .let { m -> if (onClick != null) m.clickable(onClick = onClick) else m }

    Row(
        modifier = rowModifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        bidders.forEachIndexed { index, bidder ->
            BidderTile(
                initials = bidder.initials.take(2).uppercase(),
                background = bidderToneBackground(bidder.tone),
                foreground = bidderToneForeground(bidder.tone),
                isFirst = index == 0,
                weight = FontWeight.SemiBold,
            )
        }
        if (safeOverflow > 0) {
            BidderTile(
                initials = "+$safeOverflow",
                background = PantopusColors.appSurfaceSunken,
                foreground = PantopusColors.appTextStrong,
                isFirst = bidders.isEmpty(),
                weight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun BidderTile(
    initials: String,
    background: Color,
    foreground: Color,
    isFirst: Boolean,
    weight: FontWeight,
) {
    val offset = if (isFirst) Spacing.s0 else BIDDER_OVERLAP_OFFSET
    Box(
        modifier =
            Modifier
                .offset(x = offset)
                .size(BIDDER_TILE_SIZE)
                .clip(CircleShape)
                .background(background)
                .border(BIDDER_BORDER_WIDTH, PantopusColors.appSurface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = initials,
            color = foreground,
            fontSize = (BIDDER_TILE_SIZE.value * BIDDER_TEXT_FRACTION).sp,
            fontWeight = weight,
        )
    }
}

private fun a11yLabel(count: Int): String =
    when (count) {
        0 -> "No bidders"
        1 -> "1 bidder"
        else -> "$count bidders"
    }

/** Tone → tile background. Public so feature code can reuse the palette. */
fun bidderToneBackground(tone: BidderTone): Color =
    when (tone) {
        BidderTone.Sky -> PantopusColors.primary200
        BidderTone.Teal -> PantopusColors.successLight
        BidderTone.Amber -> PantopusColors.warningLight
        BidderTone.Rose -> PantopusColors.errorLight
        BidderTone.Violet -> PantopusColors.businessBg
        BidderTone.Slate -> PantopusColors.appSurfaceSunken
    }

/** Tone → tile foreground. Public so feature code can reuse the palette. */
fun bidderToneForeground(tone: BidderTone): Color =
    when (tone) {
        BidderTone.Sky -> PantopusColors.primary800
        BidderTone.Teal -> PantopusColors.success
        BidderTone.Amber -> PantopusColors.warning
        BidderTone.Rose -> PantopusColors.error
        BidderTone.Violet -> PantopusColors.business
        BidderTone.Slate -> PantopusColors.appTextStrong
    }

// Bidder tile geometry (matches BidderStack.swift):
//   tile = 22pt diameter, 2pt surface border, -8pt overlap, text @ 0.36×.
private val BIDDER_TILE_SIZE = 22.dp
private val BIDDER_OVERLAP_OFFSET = (-8).dp
private val BIDDER_BORDER_WIDTH = 2.dp
private const val BIDDER_TEXT_FRACTION = 0.36f

@Preview(showBackground = true, widthDp = 360, heightDp = 160)
@Composable
private fun BidderStackPreview() {
    Column(
        modifier = Modifier.background(PantopusColors.appSurface),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        BidderStack(
            bidders =
                listOf(
                    Bidder("1", "AR", BidderTone.Violet),
                    Bidder("2", "MT", BidderTone.Amber),
                    Bidder("3", "JP", BidderTone.Teal),
                ),
            overflow = 9,
        )
        BidderStack(bidders = listOf(Bidder("1", "AR", BidderTone.Sky)))
        BidderStack(bidders = emptyList(), overflow = 5)
    }
}
