@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming")

package app.pantopus.android.ui.screens.wallet.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.wallet.WalletPendingBreakdown
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/**
 * A10.10 · "Pending release" — the escrow breakdown behind the hero's single
 * Pending figure. `GET api/wallet/pending-release`
 * (`backend/routes/wallet.js:160`) returns `in_review_cents` and
 * `releasing_soon_cents` separately; RN renders both as named dollar lines
 * (`WalletTab.tsx:161-173`) so a seller can tell money still inside the
 * cooling-off window from money already queued for transfer. The amounts are
 * the server's own cents, formatted — never re-derived.
 *
 * Mirrors iOS `PendingReleaseCard`.
 */
@Composable
fun PendingReleaseCard(
    breakdown: WalletPendingBreakdown,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.successBg)
                .border(BorderStroke(1.dp, PantopusColors.successLight), shape)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .testTag("walletPendingRelease"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        BreakdownLine(
            label = "In review",
            caption = caption(breakdown.inReviewCount, releasing = false),
            amount = breakdown.inReview,
            tag = "walletPendingInReview",
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.successLight),
        )
        BreakdownLine(
            label = "Releasing soon",
            caption = caption(breakdown.releasingSoonCount, releasing = true),
            amount = breakdown.releasingSoon,
            tag = "walletPendingReleasingSoon",
        )
    }
}

@Composable
private fun BreakdownLine(
    label: String,
    caption: String?,
    amount: String,
    tag: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "$label $amount" }
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Text(
                text = label,
                color = PantopusColors.appText,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
            )
            if (caption != null) {
                Text(
                    text = caption,
                    color = PantopusColors.appTextSecondary,
                    fontSize = 10.5.sp,
                )
            }
        }
        Text(
            text = amount,
            color = PantopusColors.success,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/**
 * "2 payments · clears after review" / "· transfer queued". Counts come from
 * the same payload; zero renders no caption.
 */
private fun caption(
    count: Int,
    releasing: Boolean,
): String? {
    if (count <= 0) return null
    val noun = if (count == 1) "payment" else "payments"
    return if (releasing) {
        "$count $noun · transfer queued"
    } else {
        "$count $noun · clears after review"
    }
}
