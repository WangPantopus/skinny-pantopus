@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.contentdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.util.Locale

/**
 * "Your bid" — the bidder-side mirror of [GigOwnerBidsPanel]. Renders in the
 * gig-detail scroll footer whenever the signed-in viewer already has a live
 * bid on the gig, and carries every action RN's `BidPanel` exposes: Update
 * bid, Withdraw bid, and (while a counter-offer is pending) Accept counter /
 * Decline counter. Withdraw and Decline confirm first.
 *
 * RN reference: `src/components/gig-detail/BidPanel.tsx:106,224,251,268,292`.
 */
@Composable
fun GigViewerBidPanel(
    viewModel: GigDetailViewModel,
    onEditBid: () -> Unit,
) {
    val bid by viewModel.viewerBid.collectAsStateWithLifecycle()
    val inFlight by viewModel.viewerBidActionInFlight.collectAsStateWithLifecycle()
    val row = bid ?: return

    var confirmWithdraw by remember { mutableStateOf(false) }
    var confirmDecline by remember { mutableStateOf(false) }

    val status = row.status?.lowercase(Locale.US).orEmpty()
    val amount = moneyLabel(row.bidAmount ?: 0.0)
    val counter = moneyLabel(row.counterAmount ?: 0.0)
    val hasPendingCounter = viewModel.viewerHasPendingCounter()
    val canEdit = viewModel.viewerCanEditBid()

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5)
                .padding(top = Spacing.s5)
                .testTag("gigDetail.yourBid"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "Your bid",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .padding(Spacing.s3)
                    .alpha(if (inFlight) 0.6f else 1f)
                    .testTag("gigDetail.yourBid.card"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = amount,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = PantopusColors.primary600,
                    modifier = Modifier.testTag("gigDetail.yourBid.amount"),
                )
                ViewerBidStatusPill(status = status)
            }
            row.message?.takeIf { it.isNotEmpty() }?.let { message ->
                Text(
                    text = message,
                    fontSize = 12.5.sp,
                    color = PantopusColors.appTextStrong,
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            when {
                hasPendingCounter -> {
                    Text(
                        text = "The poster countered with $counter",
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.primary700,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(Radii.md))
                                .background(PantopusColors.primary50)
                                .padding(Spacing.s2)
                                .testTag("gigDetail.yourBid.counterCallout"),
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        ViewerBidButton(
                            label = "Accept $counter",
                            icon = PantopusIcon.Check,
                            primary = true,
                            enabled = !inFlight,
                            testTag = "gigDetail.yourBid.acceptCounter",
                            onClick = viewModel::acceptViewerCounter,
                            modifier = Modifier.weight(1f),
                        )
                        ViewerBidButton(
                            label = "Decline",
                            icon = PantopusIcon.X,
                            primary = false,
                            enabled = !inFlight,
                            testTag = "gigDetail.yourBid.declineCounter",
                            onClick = { confirmDecline = true },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                canEdit ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        ViewerBidButton(
                            label = "Update bid",
                            icon = PantopusIcon.Pencil,
                            primary = true,
                            enabled = !inFlight,
                            testTag = "gigDetail.yourBid.update",
                            onClick = onEditBid,
                            modifier = Modifier.weight(1f),
                        )
                        ViewerBidButton(
                            label = "Withdraw",
                            icon = PantopusIcon.Trash2,
                            primary = false,
                            enabled = !inFlight,
                            testTag = "gigDetail.yourBid.withdraw",
                            onClick = { confirmWithdraw = true },
                            modifier = Modifier.weight(1f),
                        )
                    }
                else ->
                    // Settled: either the poster accepted (the task details
                    // take over below) or the gig left `open`, which is
                    // exactly when the backend rejects a PUT / DELETE.
                    Text(
                        text =
                            if (status == "accepted") {
                                "This bid was accepted — the task details are below."
                            } else {
                                "This task is no longer taking bid changes."
                            },
                        fontSize = 12.sp,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.testTag("gigDetail.yourBid.settledNote"),
                    )
            }
        }
    }

    if (confirmWithdraw) {
        AlertDialog(
            onDismissRequest = { confirmWithdraw = false },
            title = { Text("Withdraw your bid?") },
            text = { Text("The poster is notified and $amount is removed from this task.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmWithdraw = false
                        viewModel.withdrawViewerBid()
                    },
                    modifier = Modifier.testTag("gigDetail.yourBid.withdraw.confirm"),
                ) {
                    Text("Withdraw bid", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmWithdraw = false }) { Text("Keep bid") }
            },
        )
    }

    if (confirmDecline) {
        AlertDialog(
            onDismissRequest = { confirmDecline = false },
            title = { Text("Decline this counter-offer?") },
            text = { Text("Your original bid of $amount stays active.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmDecline = false
                        viewModel.declineViewerCounter()
                    },
                    modifier = Modifier.testTag("gigDetail.yourBid.declineCounter.confirm"),
                ) {
                    Text("Decline counter", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmDecline = false }) { Text("Keep deciding") }
            },
        )
    }
}

/** Pending / Countered / Accepted chip, tinted like the My Bids rows. */
@Composable
private fun ViewerBidStatusPill(status: String) {
    val foreground: Color =
        when (status) {
            "accepted" -> PantopusColors.success
            "countered" -> PantopusColors.primary700
            else -> PantopusColors.warning
        }
    val background: Color =
        when (status) {
            "accepted" -> PantopusColors.successBg
            "countered" -> PantopusColors.primary50
            else -> PantopusColors.warningBg
        }
    val icon =
        when (status) {
            "accepted" -> PantopusIcon.Check
            "countered" -> PantopusIcon.ArrowsRepeat
            else -> PantopusIcon.Circle
        }
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .testTag("gigDetail.yourBid.status"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2.4f,
            tint = foreground,
        )
        Text(
            text = status.replaceFirstChar { it.uppercase() },
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = foreground,
        )
    }
}

@Composable
private fun ViewerBidButton(
    label: String,
    icon: PantopusIcon,
    primary: Boolean,
    enabled: Boolean,
    testTag: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val foreground = if (primary) PantopusColors.appTextInverse else PantopusColors.error
    val background = if (primary) PantopusColors.primary600 else PantopusColors.errorBg
    Box(
        modifier =
            modifier
                .heightIn(min = 38.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(background)
                .clickable(enabled = enabled, onClick = onClick)
                .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 12.dp,
                strokeWidth = 2.4f,
                tint = foreground,
            )
            Text(
                text = label,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Bold,
                color = foreground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** `$60` / `$60.50` — matches the iOS panel's money formatting. */
private fun moneyLabel(value: Double): String = if (value % 1.0 == 0.0) "$${value.toInt()}" else String.format(Locale.US, "$%.2f", value)
