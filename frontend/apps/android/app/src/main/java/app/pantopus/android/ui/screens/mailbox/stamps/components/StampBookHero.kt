@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.stamps.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.PerforatedStamp
import app.pantopus.android.ui.screens.mailbox.stamps.StampBook
import app.pantopus.android.ui.screens.mailbox.stamps.StampCard
import app.pantopus.android.ui.screens.mailbox.stamps.StampInk
import app.pantopus.android.ui.screens.mailbox.stamps.StampsSampleData
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.11 — the wallet hero. A featured [PerforatedStamp] (Local · Forever
 * book) beside a balance ring ("8 of 12") and the series / validity meta.
 * Mirrors iOS `StampBookHero.swift`.
 */
@Composable
fun StampBookHero(book: StampBook) {
    StampCard(
        modifier =
            Modifier.semantics {
                contentDescription =
                    "${book.series}. ${book.remaining} of ${book.total} stamps left. ${book.validityLabel}."
            },
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            PerforatedStamp(ink = StampInk.Local.color, width = 104.dp, height = 132.dp)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = book.series.uppercase(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.7.sp,
                    color = PantopusColors.appTextSecondary,
                )
                Row(
                    modifier = Modifier.padding(top = Spacing.s3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    BalanceRing(book = book)
                    BalanceMeta(book = book)
                }
            }
        }
    }
}

@Composable
private fun BalanceRing(book: StampBook) {
    val trackColor = PantopusColors.appSurfaceSunken
    val fillColor = StampInk.Local.color
    Box(
        modifier = Modifier.size(60.dp).padding(vertical = Spacing.s1),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.size(60.dp)) {
            val stroke = 8.dp.toPx()
            val arcSize = Size(size.width - stroke, size.height - stroke)
            val topLeft = Offset(stroke / 2f, stroke / 2f)
            drawArc(
                color = trackColor,
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = stroke),
            )
            drawArc(
                color = fillColor,
                startAngle = -90f,
                sweepAngle = 360f * book.remainingFraction,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Round),
            )
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "${book.remaining}",
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
                color = PantopusColors.appText,
            )
            Text(
                text = "of ${book.total}",
                fontSize = 9.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun BalanceMeta(book: StampBook) {
    Column {
        Text(
            text = "${book.remaining} stamps left",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "${book.used} used since ${book.purchasedLabel}",
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(top = 2.dp),
        )
        Row(
            modifier =
                Modifier
                    .padding(top = Spacing.s2)
                    .clip(RoundedCornerShape(Spacing.s5))
                    .background(PantopusColors.successBg)
                    .padding(horizontal = Spacing.s2, vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Infinity,
                contentDescription = null,
                size = 12.dp,
                tint = PantopusColors.success,
            )
            Text(
                text = book.validityLabel,
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.success,
            )
        }
    }
}

@Preview(showBackground = true, widthDp = 390, heightDp = 200)
@Composable
private fun StampBookHeroPreview() {
    PantopusTheme {
        Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
            StampBookHero(book = StampsSampleData.populated.book)
        }
    }
}
