@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.stamps.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.PerforatedStamp
import app.pantopus.android.ui.screens.mailbox.stamps.StampsSampleData
import app.pantopus.android.ui.screens.mailbox.stamps.WalletStamp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.11 — "Other stamps you own": a horizontal rail of the other owned
 * designs, each a mini [PerforatedStamp] + an ink-tinted quantity pill.
 * Mirrors iOS `WalletRail.swift`. The rail bleeds to the screen edges via
 * its own [PaddingValues] so tiles scroll under the gutter.
 */
@Composable
fun WalletRail(
    stamps: List<WalletStamp>,
    summary: String,
    onSeeCollection: () -> Unit = {},
) {
    Column(modifier = Modifier.fillMaxWidth().testTag("stampsWalletRail")) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            verticalAlignment = Alignment.Bottom,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Other stamps you own",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Text(
                    text = summary,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Row(
                modifier =
                    Modifier
                        .clickable(onClick = onSeeCollection)
                        .testTag("stampsWalletCollection"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Text(
                    text = "Collection",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary600,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 12.dp,
                    tint = PantopusColors.primary600,
                )
            }
        }
        Spacer(modifier = Modifier.height(Spacing.s2))
        LazyRow(
            contentPadding = PaddingValues(horizontal = Spacing.s4, vertical = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(stamps, key = { it.id }) { stamp -> WalletTile(stamp = stamp) }
        }
    }
}

@Composable
private fun WalletTile(stamp: WalletStamp) {
    Column(
        modifier =
            Modifier
                .width(124.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .semantics {
                    contentDescription =
                        "${stamp.name}, ${stamp.quantity} stamps. ${stamp.tag}, ${stamp.denom}."
                },
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
            contentAlignment = Alignment.Center,
        ) {
            PerforatedStamp(
                ink = stamp.ink.color,
                width = 74.dp,
                height = 94.dp,
                toothRadius = 4.dp,
                toothGap = 11.dp,
            ) {
                StampMiniArt(name = stamp.name)
            }
        }
        Column(
            modifier = Modifier.padding(horizontal = Spacing.s3).padding(bottom = 11.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = stamp.name,
                    modifier = Modifier.weight(1f),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.width(Spacing.s1))
                Text(
                    text = "${stamp.quantity}",
                    modifier =
                        Modifier
                            .clip(CircleShape)
                            .background(stamp.ink.color.copy(alpha = 0.08f))
                            .padding(horizontal = 7.dp, vertical = 1.dp),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = stamp.ink.color,
                )
            }
            Text(
                text = "${stamp.tag} · ${stamp.denom}",
                fontSize = 10.5.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** Compact engraved artwork for wallet tiles — title + two rings + name. */
@Composable
private fun StampMiniArt(name: String) {
    val white = Color.White.copy(alpha = 0.95f)
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 5.dp, vertical = Spacing.s2),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = "PANTOPUS POST",
            color = white.copy(alpha = 0.85f),
            fontSize = 5.5.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.6.sp,
        )
        Box(
            modifier =
                Modifier.size(26.dp).drawBehind {
                    val strokePx = 1.dp.toPx()
                    listOf(26.dp, 15.dp).forEach { d ->
                        drawCircle(
                            color = white.copy(alpha = 0.45f),
                            radius = (d.toPx() - strokePx) / 2f,
                            center = Offset(size.width / 2f, size.height / 2f),
                            style = Stroke(width = strokePx),
                        )
                    }
                },
        )
        Text(
            text = name,
            color = white,
            fontSize = 8.5.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.3.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Preview(showBackground = true, widthDp = 390, heightDp = 220)
@Composable
private fun WalletRailPreview() {
    PantopusTheme {
        Box(modifier = Modifier.background(PantopusColors.appBg).padding(vertical = Spacing.s4)) {
            WalletRail(
                stamps = StampsSampleData.populated.wallet,
                summary = StampsSampleData.populated.walletSummary,
            )
        }
    }
}
