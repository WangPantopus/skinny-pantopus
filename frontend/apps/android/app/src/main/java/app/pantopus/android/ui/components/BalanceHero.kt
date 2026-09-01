@file:Suppress("MagicNumber", "LongMethod", "LongParameterList", "FunctionNaming", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Visual tone for [BalanceHero]. [HoldTone] appends an inline amber
 * banner under the split strip warning that payouts are paused.
 */
enum class BalanceHeroTone {
    Default,
    HoldTone,
}

/**
 * A single cell inside the glass split-strip below the amount.
 *
 * @property icon Optional leading glyph (e.g. clock for "Pending").
 * @property overline Uppercase mono caption (e.g. "PENDING").
 * @property value Headline number (e.g. "$186.00").
 * @property note Optional subline (e.g. "3 tasks · clears by Dec 4").
 */
data class BalanceHeroSplitCell(
    val overline: String,
    val value: String,
    val icon: PantopusIcon? = null,
    val note: String? = null,
)

/**
 * A14.6 Payments compact variant — replaces the currency chip + split
 * strip with a two-element row under the amount: "Next payout · date"
 * on the leading edge, frequency glass pill on the trailing edge.
 */
data class BalanceHeroPayoutFooter(
    val nextPayoutLabel: String,
    val frequencyPill: String,
)

/**
 * Dark sky-gradient hero card for financial surfaces (Wallet,
 * Payments). The Compose mirror of iOS
 * `Core/Design/Components/BalanceHero.swift` — same parameter names so
 * call sites read identically across the two platforms.
 *
 * @param overline Section label rendered in `primary200` mono caps.
 * @param amount Pre-formatted numeric balance — the `$` glyph is drawn
 *     separately at half size so it baseline-aligns under the amount.
 * @param currencyCode Three-letter code shown in the glass chip.
 * @param split 0–2 cells rendered in a glass split-strip below the
 *     amount. Cells beyond the first are separated by a vertical
 *     divider.
 * @param tone [BalanceHeroTone.HoldTone] appends an amber inline
 *     banner using [holdHeadline] / [holdBody].
 * @param holdHeadline Banner headline; only rendered when
 *     [tone] = [BalanceHeroTone.HoldTone].
 * @param holdBody Banner body copy; same gating as [holdHeadline].
 */
@Composable
fun BalanceHero(
    overline: String,
    amount: String,
    currencyCode: String,
    modifier: Modifier = Modifier,
    split: List<BalanceHeroSplitCell> = emptyList(),
    tone: BalanceHeroTone = BalanceHeroTone.Default,
    holdHeadline: String? = null,
    holdBody: String? = null,
    payoutFooter: BalanceHeroPayoutFooter? = null,
) {
    val gradient =
        Brush.linearGradient(
            colorStops =
                arrayOf(
                    0f to PantopusColors.primary800,
                    0.55f to PantopusColors.primary700,
                    1f to PantopusColors.primary600,
                ),
        )

    val accessibility =
        if (payoutFooter != null) {
            "$overline: $amount. ${payoutFooter.nextPayoutLabel}, ${payoutFooter.frequencyPill}"
        } else {
            "$overline: $amount $currencyCode"
        }

    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .background(gradient)
                .semantics { contentDescription = accessibility },
    ) {
        if (payoutFooter == null) {
            BalanceHeroArcs(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = 40.dp, y = (-50).dp),
            )
        }
        Column(
            modifier =
                Modifier
                    .padding(horizontal = 18.dp, vertical = Spacing.s3)
                    .padding(top = Spacing.s1, bottom = 2.dp),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            BalanceHeroTopRow(
                overline = overline,
                currencyCode = currencyCode,
                hideCurrencyChip = payoutFooter != null,
            )
            BalanceHeroAmount(amount = amount, compact = payoutFooter != null)
            if (payoutFooter != null) {
                BalanceHeroPayoutFooterRow(footer = payoutFooter)
            } else if (split.isNotEmpty()) {
                BalanceHeroSplitStrip(cells = split)
            }
            if (tone == BalanceHeroTone.HoldTone) {
                BalanceHeroHoldBanner(headline = holdHeadline, body = holdBody)
            }
        }
    }
}

@Composable
private fun BalanceHeroArcs(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .size(200.dp)
                .drawBehind {
                    listOf(90.dp.toPx(), 60.dp.toPx(), 30.dp.toPx()).forEach { radius ->
                        val centre = Offset(size.width / 2f, size.height / 2f)
                        drawCircle(
                            color = Color.White.copy(alpha = 0.18f),
                            radius = radius,
                            center = centre,
                            style = Stroke(width = 1f),
                        )
                    }
                },
    )
}

@Composable
private fun BalanceHeroTopRow(
    overline: String,
    currencyCode: String,
    hideCurrencyChip: Boolean = false,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = overline.uppercase(),
            color = PantopusColors.primary200,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
        )
        Spacer(modifier = Modifier.weight(1f))
        if (!hideCurrencyChip) {
            Row(
                modifier =
                    Modifier
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.16f))
                        .padding(horizontal = Spacing.s2, vertical = 3.dp),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ShieldCheck,
                    contentDescription = null,
                    size = 10.dp,
                    strokeWidth = 2.5f,
                    tint = Color.White,
                )
                Text(
                    text = currencyCode.uppercase(),
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.4.sp,
                )
            }
        }
    }
}

@Composable
private fun BalanceHeroAmount(
    amount: String,
    compact: Boolean = false,
) {
    Row(
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(
            text = "$",
            color = PantopusColors.primary200,
            fontSize = if (compact) 16.sp else 22.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = if (compact) 4.dp else 8.dp),
        )
        Text(
            text = amount,
            color = Color.White,
            fontSize = if (compact) 28.sp else 44.sp,
            fontWeight = if (compact) FontWeight.Bold else FontWeight.ExtraBold,
            letterSpacing = if (compact) (-0.5).sp else (-1.4).sp,
        )
    }
}

@Composable
private fun BalanceHeroPayoutFooterRow(footer: BalanceHeroPayoutFooter) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = footer.nextPayoutLabel,
            color = Color.White.copy(alpha = 0.85f),
            fontSize = 12.sp,
            maxLines = 1,
        )
        Spacer(modifier = Modifier.weight(1f))
        Text(
            text = footer.frequencyPill,
            color = Color.White,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.4.sp,
            modifier =
                Modifier
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.18f))
                    .padding(horizontal = 9.dp, vertical = 3.dp),
        )
    }
}

@Composable
private fun BalanceHeroSplitStrip(cells: List<BalanceHeroSplitCell>) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(Color.White.copy(alpha = 0.10f))
                .border(width = 1.dp, color = Color.White.copy(alpha = 0.14f), shape = RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = 10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        cells.forEachIndexed { index, cell ->
            BalanceHeroSplitCellView(
                cell = cell,
                modifier = Modifier.weight(1f),
            )
            if (index < cells.size - 1) {
                Box(
                    modifier =
                        Modifier
                            .width(1.dp)
                            .padding(horizontal = Spacing.s3)
                            .background(Color.White.copy(alpha = 0.16f)),
                )
            }
        }
    }
}

@Composable
private fun BalanceHeroSplitCellView(
    cell: BalanceHeroSplitCell,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            cell.icon?.let { icon ->
                PantopusIconImage(
                    icon = icon,
                    contentDescription = null,
                    size = 10.dp,
                    strokeWidth = 2.5f,
                    tint = PantopusColors.primary200.copy(alpha = 0.85f),
                )
            }
            Text(
                text = cell.overline.uppercase(),
                color = PantopusColors.primary200.copy(alpha = 0.85f),
                fontSize = 9.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.6.sp,
            )
        }
        Text(
            text = cell.value,
            color = Color.White,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.25).sp,
        )
        cell.note?.let { note ->
            Text(
                text = note,
                color = PantopusColors.primary200.copy(alpha = 0.8f),
                fontSize = 10.5.sp,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun BalanceHeroHoldBanner(
    headline: String?,
    body: String?,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.warningLight.copy(alpha = 0.18f))
                .border(width = 1.dp, color = PantopusColors.warningLight.copy(alpha = 0.45f), shape = RoundedCornerShape(10.dp))
                .padding(horizontal = 10.dp, vertical = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertTriangle,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2.4f,
            tint = PantopusColors.warningLight,
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            headline?.let {
                Text(
                    text = it,
                    color = PantopusColors.warningBg,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.05).sp,
                )
            }
            body?.let {
                Text(
                    text = it,
                    color = PantopusColors.warningLight.copy(alpha = 0.9f),
                    fontSize = 10.5.sp,
                )
            }
        }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 700, backgroundColor = 0xFFF6F7F9)
@Composable
private fun BalanceHeroPreview() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        BalanceHero(
            overline = "Available to withdraw",
            amount = "847.50",
            currencyCode = "USD",
            split =
                listOf(
                    BalanceHeroSplitCell(
                        icon = PantopusIcon.Clock,
                        overline = "Pending",
                        value = "$186.00",
                        note = "3 tasks · clears by Dec 4",
                    ),
                    BalanceHeroSplitCell(
                        icon = PantopusIcon.TrendingUp,
                        overline = "This month",
                        value = "$1,284.50",
                        note = "8 tasks · ▲22% vs Oct",
                    ),
                ),
        )
        BalanceHero(
            overline = "Available to withdraw",
            amount = "847.50",
            currencyCode = "USD",
            split =
                listOf(
                    BalanceHeroSplitCell(
                        icon = PantopusIcon.Clock,
                        overline = "Pending",
                        value = "$186.00",
                        note = "3 tasks · clears by Dec 4",
                    ),
                ),
            tone = BalanceHeroTone.HoldTone,
            holdHeadline = "Withdrawals paused",
            holdBody = "Re-verify your bank to release funds.",
        )
        // A14.6 Payments — compact payout-footer variant.
        BalanceHero(
            overline = "Available to pay out",
            amount = "124.50",
            currencyCode = "USD",
            payoutFooter =
                BalanceHeroPayoutFooter(
                    nextPayoutLabel = "Next payout · Mon, May 27",
                    frequencyPill = "Weekly",
                ),
        )
        // padding hint
        Text(
            text = "Padding sanity hint",
            color = PantopusColors.appTextSecondary,
            fontSize = 10.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(PaddingValues(0.dp)),
        )
    }
}
