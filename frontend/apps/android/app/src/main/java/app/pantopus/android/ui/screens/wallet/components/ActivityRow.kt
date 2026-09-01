@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "FunctionNaming")

package app.pantopus.android.ui.screens.wallet.components

import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.wallet.ActivityCategory
import app.pantopus.android.ui.screens.wallet.ActivityDirection
import app.pantopus.android.ui.screens.wallet.ActivityStatus
import app.pantopus.android.ui.screens.wallet.WalletActivityItem
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

/**
 * A10.10 — single Recent-activity row inside the wallet's transaction
 * card. 34dp category-tinted icon tile + description + counterparty /
 * date + trailing amount + status label. Composed inside [ActivityList]
 * with grouped-by-day headers.
 */
@Composable
fun ActivityRow(
    item: WalletActivityItem,
    isLast: Boolean,
    modifier: Modifier = Modifier,
) {
    val direction = item.direction
    val status = item.status
    val isPending = status is ActivityStatus.Pending
    val amountText = (if (direction == ActivityDirection.Out) "−" else "+") + "$" + item.amount
    val amountColor = amountColorFor(direction, status)
    val trailingLabel = trailingLabelFor(item)
    val subtext = subtextFor(item)

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 11.dp)
                    .semantics {
                        contentDescription =
                            "${item.description}. $subtext. $amountText. $trailingLabel."
                    }
                    .testTag("walletActivityRow-${item.id}"),
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
                    color = amountColor,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.2).sp,
                )
                Text(
                    text = trailingLabel,
                    color = PantopusColors.appTextMuted,
                    fontSize = 10.sp,
                    textAlign = TextAlign.End,
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

@Composable
private fun CategoryTile(category: ActivityCategory) {
    Box(
        modifier =
            Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(ActivityCategoryPalette.background(category)),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = ActivityCategoryPalette.icon(category),
            contentDescription = null,
            size = 16.dp,
            strokeWidth = 2f,
            tint = ActivityCategoryPalette.foreground(category),
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

private fun subtextFor(item: WalletActivityItem): String {
    val base = "${item.counterparty} · ${item.dateLabel}"
    return when (val status = item.status) {
        is ActivityStatus.Pending -> "$base · clears ${status.clearsLabel}"
        else -> base
    }
}

private fun amountColorFor(
    direction: ActivityDirection,
    status: ActivityStatus,
): Color =
    when {
        direction == ActivityDirection.Out -> PantopusColors.appTextStrong
        status is ActivityStatus.Pending -> WalletPalette.amberDeep
        else -> PantopusColors.success
    }

private fun trailingLabelFor(item: WalletActivityItem): String =
    when {
        item.isFee -> "Fee"
        item.direction == ActivityDirection.Out -> "Payout"
        item.status is ActivityStatus.Pending -> "On hold"
        else -> "Cleared"
    }

/**
 * Category-tinted palette for activity rows. Backgrounds reuse
 * existing tokens where they exist; rows whose design tints diverge
 * use the category accent at 18% opacity to stay token-friendly.
 */
internal object ActivityCategoryPalette {
    fun background(category: ActivityCategory): Color =
        when (category) {
            ActivityCategory.Cleaning -> PantopusColors.homeBg
            ActivityCategory.ChildCare -> PantopusColors.warmAmberBg
            ActivityCategory.Handyman -> PantopusColors.handyman.copy(alpha = 0.18f)
            ActivityCategory.PetCare -> PantopusColors.errorLight
            ActivityCategory.Bank -> PantopusColors.personalBg
            ActivityCategory.Fee -> PantopusColors.appSurfaceSunken
        }

    fun foreground(category: ActivityCategory): Color =
        when (category) {
            ActivityCategory.Cleaning -> PantopusColors.homeDark
            ActivityCategory.ChildCare -> PantopusColors.warmAmber
            ActivityCategory.Handyman -> PantopusColors.handyman
            ActivityCategory.PetCare -> PantopusColors.error
            ActivityCategory.Bank -> PantopusColors.business
            ActivityCategory.Fee -> PantopusColors.appTextSecondary
        }

    fun icon(category: ActivityCategory): PantopusIcon =
        when (category) {
            ActivityCategory.Cleaning -> PantopusIcon.Sparkles
            ActivityCategory.ChildCare -> PantopusIcon.Baby
            ActivityCategory.Handyman -> PantopusIcon.Wrench
            ActivityCategory.PetCare -> PantopusIcon.Dog
            ActivityCategory.Bank -> PantopusIcon.Building2
            ActivityCategory.Fee -> PantopusIcon.Receipt
        }
}
