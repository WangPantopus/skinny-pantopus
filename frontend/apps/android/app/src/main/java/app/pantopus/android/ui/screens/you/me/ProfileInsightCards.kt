@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.you.me

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.users.InviteNextUnlockDto
import app.pantopus.android.data.api.models.users.InviteProgressDto
import app.pantopus.android.data.api.models.users.MonthlyReceiptDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.util.Locale

/**
 * Two profile-tab cards RN ships and native was missing:
 *
 * * Monthly Receipt — earnings / spending / neighbors helped / posts, an
 *   expandable detail block, and a share sheet. Auto-expands when the profile
 *   is opened from the `monthly_receipt` push. Mirrors RN
 *   `components/profile/MonthlyReceiptCard.tsx`.
 * * Invite progress — referral count against the unlock tiers, unlocked
 *   feature chips, next unlock, and a share CTA carrying the invite code.
 *   Mirrors RN `components/profile/InviteProgressCard.tsx`.
 */

/**
 * The unlock ladder, verbatim from
 * `backend/services/inviteRewardService.js:19`.
 */
enum class InviteFeatureTier(
    val key: String,
    val threshold: Int,
    val label: String,
) {
    ActivityMap("activity_map", 1, "Neighborhood Activity Map"),
    NeighborhoodInsights("neighborhood_insights", 3, "Neighborhood Insights"),
    PriorityMatching("priority_matching", 5, "Priority Matching"),
    FoundingBadge("founding_badge", 10, "Founding Neighbor Badge"),
    ;

    companion object {
        val maxThreshold: Int get() = entries.maxOf { it.threshold }

        /**
         * Server keys we don't know fall back to the raw key rather than
         * being dropped, so a new backend tier still renders.
         */
        fun labelForKey(key: String): String = entries.firstOrNull { it.key == key }?.label ?: key
    }
}

/** Formatting helpers, mirrored 1:1 with iOS `MonthlyReceiptCard`. */
object MonthlyReceiptFormat {
    fun dollars(cents: Int): String = String.format(Locale.US, "\$%.2f", cents / 100.0)

    fun rating(value: Double?): String = if (value == null || value <= 0) "N/A" else String.format(Locale.US, "%.1f", value)

    fun signedRating(value: Double?): String {
        if (value == null) return "N/A"
        val sign = if (value >= 0) "+" else ""
        return sign + String.format(Locale.US, "%.2f", value)
    }

    /** The message RN's `handleShareReceipt` composes. */
    fun shareMessage(receipt: MonthlyReceiptDto): String {
        val earned = String.format(Locale.US, "%.2f", receipt.earnings.totalCents / 100.0)
        val highlight = receipt.highlight?.let { "$it " }.orEmpty()
        return "My ${receipt.period.label} on Pantopus: $highlight" +
            "I earned \$$earned and helped ${receipt.community.neighborsHelped} neighbors."
    }
}

@Composable
fun MonthlyReceiptCard(
    receipt: MonthlyReceiptDto,
    startExpanded: Boolean = false,
    onShare: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var isExpanded by remember(startExpanded) { mutableStateOf(startExpanded) }
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("monthlyReceiptCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable { isExpanded = !isExpanded }
                    .testTag("monthlyReceipt.toggle"),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.BarChart3,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.primary600,
            )
            Spacer(Modifier.width(Spacing.s2))
            Text(
                text = "${receipt.period.label} Summary",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            PantopusIconImage(
                icon = if (isExpanded) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 20.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        receipt.highlight?.takeIf { it.isNotEmpty() }?.let {
            Text(
                text = it,
                fontSize = 14.sp,
                fontStyle = FontStyle.Italic,
                color = PantopusColors.appTextSecondary,
            )
        }
        ReceiptStatsGrid(receipt)
        if (isExpanded) ReceiptDetails(receipt)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .border(1.dp, PantopusColors.primary600, RoundedCornerShape(Radii.md))
                    .clickable(onClick = onShare)
                    .padding(vertical = Spacing.s3)
                    .testTag("monthlyReceipt.share"),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Share,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.primary600,
            )
            Spacer(Modifier.width(Spacing.s2))
            Text(
                text = "Share your month",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun ReceiptStatsGrid(receipt: MonthlyReceiptDto) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            StatBox(
                icon = PantopusIcon.Briefcase,
                tint = PantopusColors.success,
                background = PantopusColors.successBg,
                value = MonthlyReceiptFormat.dollars(receipt.earnings.totalCents),
                label = "Earned",
                tag = "monthlyReceipt.earned",
                modifier = Modifier.weight(1f),
            )
            StatBox(
                icon = PantopusIcon.CreditCard,
                tint = PantopusColors.primary600,
                background = PantopusColors.primary50,
                value = MonthlyReceiptFormat.dollars(receipt.spending.totalCents),
                label = "Spent",
                tag = "monthlyReceipt.spent",
                modifier = Modifier.weight(1f),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            StatBox(
                icon = PantopusIcon.Users,
                tint = PantopusColors.business,
                background = PantopusColors.appSurfaceSunken,
                value = "${receipt.community.neighborsHelped}",
                label = "Neighbors helped",
                tag = "monthlyReceipt.neighborsHelped",
                modifier = Modifier.weight(1f),
            )
            StatBox(
                icon = PantopusIcon.File,
                tint = PantopusColors.warning,
                background = PantopusColors.appSurfaceSunken,
                value = "${receipt.community.postsCreated}",
                label = "Posts",
                tag = "monthlyReceipt.posts",
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun StatBox(
    icon: PantopusIcon,
    tint: Color,
    background: Color,
    value: String,
    label: String,
    tag: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(background)
                .padding(Spacing.s3)
                .testTag(tag),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = tint)
        Text(text = value, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = tint)
        Text(
            text = label,
            fontSize = 11.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun ReceiptDetails(receipt: MonthlyReceiptDto) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("monthlyReceipt.details"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
        DetailSection(
            "Marketplace",
            listOf(
                "Listings sold" to "${receipt.marketplace.listingsSold}",
                "Listings bought" to "${receipt.marketplace.listingsBought}",
                "Free items claimed" to "${receipt.marketplace.freeItemsClaimed}",
            ),
        )
        DetailSection(
            "Earnings breakdown",
            listOf(
                "Gigs completed (as worker)" to "${receipt.earnings.gigCount}",
                "Top category" to (receipt.earnings.topCategory ?: "N/A"),
            ),
        )
        DetailSection(
            "Community",
            listOf("Connections made" to "${receipt.community.connectionsMade}"),
        )
        DetailSection(
            "Reputation",
            listOf(
                "Current rating" to MonthlyReceiptFormat.rating(receipt.reputation.currentRating),
                "Reviews received" to "${receipt.reputation.reviewsReceived}",
                "Rating change" to MonthlyReceiptFormat.signedRating(receipt.reputation.ratingChange),
            ),
        )
    }
}

@Composable
private fun DetailSection(
    title: String,
    rows: List<Pair<String, String>>,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = title.uppercase(Locale.US),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextMuted,
        )
        rows.forEach { (label, value) ->
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = label,
                    fontSize = 13.5.sp,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = value,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
            }
        }
    }
}

@Composable
fun InviteProgressCard(
    progress: InviteProgressDto,
    onShare: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("inviteProgressCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "Invite neighbors, unlock features",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        InviteProgressTrack(progress.totalConverted)
        if (progress.unlockedFeatures.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth().testTag("inviteProgress.unlocked"),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                progress.unlockedFeatures.forEach { key ->
                    Row(
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.successBg)
                                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.CheckCircle,
                            contentDescription = null,
                            size = 13.dp,
                            tint = PantopusColors.success,
                        )
                        Spacer(Modifier.width(Spacing.s1))
                        Text(
                            text = InviteFeatureTier.labelForKey(key),
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.success,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
        progress.nextUnlock?.let { next ->
            Row(
                modifier = Modifier.fillMaxWidth().testTag("inviteProgress.nextUnlock"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Lock,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.appTextMuted,
                )
                Spacer(Modifier.width(Spacing.s2))
                Text(
                    text = nextUnlockText(next),
                    fontSize = 13.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onShare)
                    .padding(vertical = Spacing.s3)
                    .testTag("inviteProgress.share"),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Send,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextInverse,
            )
            Spacer(Modifier.width(Spacing.s2))
            Text(
                text = "Invite a neighbor",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun InviteProgressTrack(totalConverted: Int) {
    val maxThreshold = InviteFeatureTier.maxThreshold
    val fraction = (totalConverted.toFloat() / maxThreshold).coerceIn(0f, 1f)
    Column(
        modifier = Modifier.fillMaxWidth().testTag("inviteProgress.track"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurfaceSunken),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth(fraction)
                        .height(6.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary600),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            InviteFeatureTier.entries.forEach { tier ->
                val unlocked = totalConverted >= tier.threshold
                Box(
                    modifier =
                        Modifier
                            .size(22.dp)
                            .clip(CircleShape)
                            .background(
                                if (unlocked) PantopusColors.primary600 else PantopusColors.appSurfaceSunken,
                            ).testTag("inviteProgress.tier.${tier.key}"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "${tier.threshold}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (unlocked) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                    )
                }
            }
        }
    }
}

/** System share sheet for the receipt / invite CTAs. */
internal fun shareText(
    context: android.content.Context,
    message: String,
) {
    val send =
        android.content.Intent(android.content.Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(android.content.Intent.EXTRA_TEXT, message)
        }
    context.startActivity(android.content.Intent.createChooser(send, "Share"))
}

internal fun nextUnlockText(next: InviteNextUnlockDto): String {
    val remaining = next.invitesRemaining.coerceAtLeast(0)
    val label = next.label ?: InviteFeatureTier.labelForKey(next.feature)
    return "Invite $remaining more neighbor${if (remaining == 1) "" else "s"} to unlock $label"
}
