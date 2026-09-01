@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.stamps.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
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
import app.pantopus.android.ui.screens.mailbox.stamps.StampPalette
import app.pantopus.android.ui.screens.mailbox.stamps.StampSectionLabel
import app.pantopus.android.ui.screens.mailbox.stamps.StampsSampleData
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.11 — "In this book": a 4-column grid of the book's stamps. The
 * first `used` cells are postmarked (slate ink + cancellation), the rest
 * are live Forever postage. Mirrors iOS `StampSheet.swift`.
 */
@Composable
fun StampSheet(book: StampBook) {
    StampCard(
        modifier =
            Modifier.semantics {
                contentDescription = "In this book. ${book.remaining} available, ${book.used} used."
            }.testTag("stampsSheet"),
    ) {
        StampSectionLabel(title = "In this book") { Legend(book = book) }
        BoxWithConstraints(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(10.dp),
        ) {
            val gap = Spacing.s2
            val cellWidth = (maxWidth - gap * 3) / 4
            Column(verticalArrangement = Arrangement.spacedBy(gap)) {
                for (rowIndices in (0 until book.total).toList().chunked(4)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                        rowIndices.forEach { index ->
                            val used = index < book.used
                            PerforatedStamp(
                                ink = if (used) StampPalette.usedInk else StampInk.Local.color,
                                width = cellWidth,
                                height = 68.dp,
                                modifier = Modifier.alpha(if (used) 0.85f else 1f),
                                toothRadius = 3.dp,
                                toothGap = 9.dp,
                                used = used,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Legend(book: StampBook) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Swatch(StampInk.Local.color)
        Text(
            text = "${book.remaining} available",
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
        )
        Swatch(PantopusColors.appTextMuted, leadingGap = true)
        Text(
            text = "${book.used} used",
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun Swatch(
    color: Color,
    leadingGap: Boolean = false,
) {
    Box(
        modifier =
            Modifier
                .padding(start = if (leadingGap) Spacing.s1 else 0.dp)
                .size(7.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(color),
    )
}

@Preview(showBackground = true, widthDp = 390, heightDp = 320)
@Composable
private fun StampSheetPreview() {
    PantopusTheme {
        Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
            StampSheet(book = StampsSampleData.populated.book)
        }
    }
}
