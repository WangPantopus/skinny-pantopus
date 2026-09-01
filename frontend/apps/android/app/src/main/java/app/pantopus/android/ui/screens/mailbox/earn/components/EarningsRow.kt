@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.earn.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.earn.EarnCategory
import app.pantopus.android.ui.screens.mailbox.earn.EarnEarning
import app.pantopus.android.ui.screens.mailbox.earn.EarnStatus
import app.pantopus.android.ui.screens.wallet.components.WalletPalette
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A10.11 — Recent-earnings card. Grouped-by-day rows, each a
 * category-tinted tile + description (+ amber "Pending" chip) + the
 * counterparty / time line + a trailing "+$amount" (green cleared, amber
 * on-hold). Also hosts [EarnLockedRow] — the gated placeholder the empty
 * new-earner frame shows in place of real earnings (reused by the gated
 * Taxes row).
 */
@Composable
fun EarnEarningsList(
    items: List<EarnEarning>,
    modifier: Modifier = Modifier,
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
            val isNewDay = index == 0 || items[index - 1].day != item.day
            if (isNewDay) {
                if (index != 0) {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .background(PantopusColors.appBorderSubtle),
                    )
                }
                Text(
                    text = item.day.uppercase(),
                    color = PantopusColors.appTextMuted,
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.7.sp,
                    modifier =
                        Modifier.padding(
                            start = 14.dp,
                            end = 14.dp,
                            top = if (index == 0) Spacing.s2 else Spacing.s3,
                            bottom = Spacing.s1,
                        ),
                )
            }
            EarnEarningRow(item = item, isLast = index == items.size - 1)
        }
    }
}

@Composable
private fun EarnEarningRow(
    item: EarnEarning,
    isLast: Boolean,
) {
    val isPending = item.status is EarnStatus.Pending
    val amountText = "+$" + item.amount
    val subtext = subtextFor(item)

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 11.dp)
                    .semantics {
                        contentDescription =
                            "${item.description}. $subtext. plus $${item.amount}. " +
                            if (isPending) "On hold." else "Paid."
                    }
                    .testTag("earnEarningRow-${item.id}"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            CategoryTile(category = item.category)
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(1.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        text = item.description,
                        color = PantopusColors.appText,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = (-0.1).sp,
                        maxLines = 1,
                    )
                    if (isPending) PendingChip()
                }
                Text(
                    text = subtext,
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.sp,
                    maxLines = 1,
                )
            }
            Spacer(Modifier.width(Spacing.s2))
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(1.dp),
            ) {
                Text(
                    text = amountText,
                    color = if (isPending) WalletPalette.amberDeep else PantopusColors.success,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.2).sp,
                )
                Text(
                    text = if (isPending) "On hold" else "Paid",
                    color = PantopusColors.appTextMuted,
                    fontSize = 10.sp,
                )
            }
        }
        if (!isLast) {
            Row(modifier = Modifier.fillMaxWidth()) {
                Spacer(Modifier.width(14.dp))
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .height(1.dp)
                            .background(PantopusColors.appBorderSubtle),
                )
            }
        }
    }
}

/**
 * Gated placeholder shown in the empty new-earner frame in place of a
 * real Recent-earnings list (and reused for the gated Taxes row). A muted
 * lock tile + headline + subcopy on a dashed surface, non-interactive.
 */
@Composable
fun EarnLockedRow(
    title: String,
    subcopy: String,
    modifier: Modifier = Modifier,
    tag: String = "earnLockedRow",
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .earnDashedBorder(PantopusColors.appBorder, 14.dp)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .semantics { contentDescription = "$title. $subcopy" }
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Lock,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Text(
                text = title,
                color = PantopusColors.appTextSecondary,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.1).sp,
            )
            Text(
                text = subcopy,
                color = PantopusColors.appTextMuted,
                fontSize = 11.sp,
            )
        }
        Spacer(Modifier.width(Spacing.s2))
    }
}

@Composable
private fun CategoryTile(category: EarnCategory?) {
    Box(
        modifier =
            Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(EarnCategoryPalette.background(category)),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = EarnCategoryPalette.icon(category),
            contentDescription = null,
            size = 16.dp,
            strokeWidth = 2f,
            tint = EarnCategoryPalette.foreground(category),
        )
    }
}

@Composable
private fun PendingChip() {
    Box(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(PantopusColors.warmAmberBg)
                .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text(
            text = "PENDING",
            color = WalletPalette.amberDeep,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.4.sp,
        )
    }
}

private fun subtextFor(item: EarnEarning): String {
    val base = "${item.counterparty} · ${item.dateLabel}"
    return when (val status = item.status) {
        is EarnStatus.Pending -> "$base · clears ${status.clearsLabel}"
        else -> base
    }
}

/** Dashed rounded-rect border — Compose has no built-in dashed
 *  `Modifier.border`, so the gated cards draw their own. */
internal fun Modifier.earnDashedBorder(
    color: Color,
    cornerRadius: Dp,
    strokeWidth: Dp = 1.dp,
): Modifier =
    this.drawBehind {
        val sw = strokeWidth.toPx()
        val radiusPx = cornerRadius.toPx()
        drawRoundRect(
            color = color,
            topLeft = Offset(sw / 2f, sw / 2f),
            size = Size(size.width - sw, size.height - sw),
            cornerRadius = CornerRadius(radiusPx, radiusPx),
            style =
                Stroke(
                    width = sw,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx())),
                ),
        )
    }

/**
 * Category-tinted palette for earnings rows — the money-in subset of the
 * Wallet activity palette, reusing the same tokens so the two surfaces
 * read as siblings.
 */
internal object EarnCategoryPalette {
    fun background(category: EarnCategory?): Color =
        when (category) {
            EarnCategory.Cleaning -> PantopusColors.homeBg
            EarnCategory.ChildCare -> PantopusColors.warmAmberBg
            EarnCategory.Handyman -> PantopusColors.handyman.copy(alpha = 0.18f)
            EarnCategory.PetCare -> PantopusColors.errorLight
            null -> PantopusColors.appSurfaceSunken
        }

    fun foreground(category: EarnCategory?): Color =
        when (category) {
            EarnCategory.Cleaning -> PantopusColors.homeDark
            EarnCategory.ChildCare -> PantopusColors.warmAmber
            EarnCategory.Handyman -> PantopusColors.handyman
            EarnCategory.PetCare -> PantopusColors.error
            null -> PantopusColors.appTextSecondary
        }

    fun icon(category: EarnCategory?): PantopusIcon =
        when (category) {
            EarnCategory.Cleaning -> PantopusIcon.Sparkles
            EarnCategory.ChildCare -> PantopusIcon.Baby
            EarnCategory.Handyman -> PantopusIcon.Wrench
            EarnCategory.PetCare -> PantopusIcon.Dog
            null -> PantopusIcon.MailOpen
        }
}
