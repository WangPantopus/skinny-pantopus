@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.earn.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.earn.EarnAccent
import app.pantopus.android.ui.screens.mailbox.earn.EarnWayKind
import app.pantopus.android.ui.screens.mailbox.earn.EarnWayToEarn
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A10.11 — the `Ways to earn` launcher card: a 3-row list (Browse open
 * tasks / Refer a neighbor / Offer a service). The featured first row
 * lifts onto a `primary50` surface with a filled `primary600` icon tile;
 * the rest carry an accent-tinted glyph on a sunken tile. Identical in
 * the populated and empty frames — it's the engine that makes money.
 */
@Composable
fun EarnWaysToEarnCard(
    items: List<EarnWayToEarn>,
    modifier: Modifier = Modifier,
    onSelect: (EarnWayKind) -> Unit = {},
) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), shape),
    ) {
        items.forEachIndexed { index, item ->
            WaysToEarnRow(
                item = item,
                isLast = index == items.size - 1,
                onClick = { onSelect(item.kind) },
            )
        }
    }
}

@Composable
private fun WaysToEarnRow(
    item: EarnWayToEarn,
    isLast: Boolean,
    onClick: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(if (item.featured) PantopusColors.primary50 else PantopusColors.appSurface)
                .clickable(onClick = onClick)
                .semantics { contentDescription = "${item.title}. ${item.meta}" }
                .testTag("earnWayToEarn-${item.kind.tag}"),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            IconTile(item = item)
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(1.dp),
            ) {
                Text(
                    text = item.title,
                    color = PantopusColors.appText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = (-0.1).sp,
                    maxLines = 1,
                )
                Text(
                    text = item.meta,
                    color = if (item.featured) PantopusColors.primary700 else PantopusColors.appTextSecondary,
                    fontSize = 11.sp,
                    fontWeight = if (item.featured) FontWeight.SemiBold else FontWeight.Normal,
                    maxLines = 1,
                )
            }
            Spacer(Modifier.width(Spacing.s2))
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        if (!isLast) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(PantopusColors.appBorderSubtle),
            )
        }
    }
}

@Composable
private fun IconTile(item: EarnWayToEarn) {
    Box(
        modifier =
            Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(if (item.featured) PantopusColors.primary600 else PantopusColors.appSurfaceSunken),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = glyphFor(item.kind),
            contentDescription = null,
            size = 17.dp,
            strokeWidth = 2f,
            tint = if (item.featured) Color.White else accentColor(item.accent),
        )
    }
}

private fun glyphFor(kind: EarnWayKind): PantopusIcon =
    when (kind) {
        EarnWayKind.Browse -> PantopusIcon.Search
        EarnWayKind.Refer -> PantopusIcon.Gift
        EarnWayKind.Offer -> PantopusIcon.Briefcase
    }

private fun accentColor(accent: EarnAccent): Color =
    when (accent) {
        EarnAccent.Primary -> PantopusColors.primary600
        EarnAccent.Home -> PantopusColors.home
        EarnAccent.Business -> PantopusColors.business
    }

/** Lowercase tag matching the iOS `EarnWayKind` raw value, so the
 *  testTag mirrors the iOS accessibilityIdentifier exactly. */
private val EarnWayKind.tag: String
    get() =
        when (this) {
            EarnWayKind.Browse -> "browse"
            EarnWayKind.Refer -> "refer"
            EarnWayKind.Offer -> "offer"
        }
