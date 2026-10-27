@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.review_claims

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.admin.AdminClaimDetailResponse
import app.pantopus.android.data.api.models.admin.ClaimReviewApprovalDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * "Before you approve" on the admin claim review: what approval needs — a confirmed
 * identity (the claimant's Stripe Identity check, or the admin's own confirmation)
 * and a document a reviewer checked — as the server tests it (`approval` on
 * `GET /api/admin/claims/:claimId`). Mirrors iOS `ReviewClaimApproval` and the web
 * `ClaimReviewApprovalPanel`.
 */
object ReviewClaimApproval {
    /**
     * Why Accept is off, or null when it can go ahead (also when the server didn't send the
     * panel). The app approves as claimed, so the claimed type's document is needed.
     */
    fun blockedReason(
        detail: AdminClaimDetailResponse,
        identityAttested: Boolean,
    ): String? {
        val approval = detail.approval ?: return null
        if (detail.claim.identityStatus == "failed") return "Their identity check failed, so this claim can’t be approved."
        val identity = approval.identityConfirmed || identityAttested
        val proof = approval.proof == "verified"
        return when {
            identity && proof -> null
            proof -> "Confirm the claimant’s identity first."
            identity && approval.proof == "pending" -> "Check the claimant’s document first (Open private documents)."
            identity -> "No document yet. Use Request info to ask for one."
            else -> "Needs a confirmed identity and a checked document. Use Request info to ask for a document."
        }
    }

    fun identityLine(approval: ClaimReviewApprovalDto): Pair<String, String> =
        when {
            approval.identityConfirmed ->
                "Identity confirmed" to (
                    approval.identityName?.let { "Name on ID: $it. Compare it with the document." }
                        ?: "Compare the claimant’s name with the document."
                )
            approval.identity == "processing" -> "Identity check in progress" to "Stripe is checking the claimant’s ID."
            approval.identity == "requires_input" -> "Identity check didn’t pass" to "The claimant can try again."
            approval.identity == "started" -> "Identity not confirmed" to "The claimant started the ID check but hasn’t finished."
            !approval.identityCheckAvailable ->
                "Identity not confirmed" to "In-app ID checks aren’t set up yet, so confirm who they are yourself before approving."
            else -> "Identity not confirmed" to "The claimant hasn’t done the ID check yet. They’re asked to on their claim."
        }

    fun proofLine(approval: ClaimReviewApprovalDto): Pair<String, String> =
        when (approval.proof) {
            "verified" -> "Document checked" to "A reviewer verified a document."
            "pending" -> "Document waiting for your check" to "Open private documents and verify it."
            else -> "No document yet" to "The claimant is asked to upload one."
        }
}

/** The panel with the identity confirmation switch. */
@Composable
fun ReviewClaimApprovalPanel(
    approval: ClaimReviewApprovalDto,
    identityFailed: Boolean,
    identityAttested: Boolean,
    onIdentityAttested: (Boolean) -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .testTag("reviewClaimDetail_approval"),
    ) {
        val (identityTitle, identityDetail) = ReviewClaimApproval.identityLine(approval)
        ApprovalLine(
            icon = PantopusIcon.IdCard,
            title = identityTitle,
            detail = identityDetail,
            done = approval.identityConfirmed,
            waiting = approval.identity == "processing",
            modifier = Modifier.testTag("reviewClaimDetail_approvalIdentity"),
        )
        if (!approval.identityConfirmed && !identityFailed) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(start = Spacing.s3, end = Spacing.s3, bottom = Spacing.s3)
                        .testTag("reviewClaimDetail_identityAttested"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "I confirmed this person’s identity",
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = "Turn this on once you’ve checked who they are yourself.",
                        fontSize = 12.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                Switch(checked = identityAttested, onCheckedChange = onIdentityAttested, enabled = enabled)
            }
        }
        HorizontalDivider(modifier = Modifier.height(1.dp), color = PantopusColors.appBorder)
        val (proofTitle, proofDetail) = ReviewClaimApproval.proofLine(approval)
        ApprovalLine(
            icon = PantopusIcon.FileText,
            title = proofTitle,
            detail = proofDetail,
            done = approval.proof == "verified",
            waiting = approval.proof == "pending",
            modifier = Modifier.testTag("reviewClaimDetail_approvalProof"),
        )
    }
}

@Composable
private fun ApprovalLine(
    icon: PantopusIcon,
    title: String,
    detail: String,
    done: Boolean,
    waiting: Boolean,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 20.dp, tint = PantopusColors.appTextMuted)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(text = detail, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
        }
        val (status, tint) =
            when {
                done -> PantopusIcon.CheckCircle to PantopusColors.success
                waiting -> PantopusIcon.Clock to PantopusColors.info
                else -> PantopusIcon.Circle to PantopusColors.appTextMuted
            }
        PantopusIconImage(icon = status, contentDescription = null, size = 20.dp, tint = tint)
    }
}
