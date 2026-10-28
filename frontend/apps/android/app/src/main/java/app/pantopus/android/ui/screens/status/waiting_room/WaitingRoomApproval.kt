@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.status.waiting_room

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.homes.ClaimApprovalProgressDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Where one approval step stands. */
enum class WaitingRoomApprovalTone { Done, Todo, Waiting, Retry }

/** One step of the approval checklist, with the claimant's next action if any. */
@Immutable
data class WaitingRoomApprovalStep(
    val id: String,
    val icon: PantopusIcon,
    val tone: WaitingRoomApprovalTone,
    val title: String,
    val detail: String,
    val actionLabel: String? = null,
    /** [WaitingRoomApproval.CONFIRM_IDENTITY] or [WaitingRoomApproval.UPLOAD_DOCUMENT]. */
    val actionKey: String? = null,
)

/**
 * Why a claim in review isn't approved yet and what the claimant does about it.
 * Approval needs a confirmed identity (a Stripe Identity check) and a document a
 * Pantopus reviewer checked; the server reports both (`approval` on
 * `GET /api/homes/my-ownership-claims`, the same tests approval uses). Copy
 * matches iOS `WaitingRoomApproval` and the web `ClaimApprovalChecklist`.
 */
object WaitingRoomApproval {
    const val CONFIRM_IDENTITY = "confirm_identity"
    const val UPLOAD_DOCUMENT = "upload_document"

    /** What a claim in review waits on, in a few words (web `approvalSummary`). */
    fun summary(approval: ClaimApprovalProgressDto): String {
        val identityDone = approval.identity == "verified"
        return when {
            identityDone && approval.proof == "verified" -> "Waiting for approval"
            !identityDone && approval.proof == "missing" -> "Identity and document needed"
            !identityDone -> if (approval.identity == "processing") "Checking your ID" else "Identity check needed"
            approval.proof == "pending" -> "Document in review"
            else -> "Document needed"
        }
    }

    /** Both steps for a claim in review, or none when the server didn't say. */
    fun steps(
        approval: ClaimApprovalProgressDto?,
        residency: Boolean,
    ): List<WaitingRoomApprovalStep> {
        if (approval == null) return emptyList()
        return listOf(identityStep(approval), proofStep(approval, residency))
    }

    fun identityStep(approval: ClaimApprovalProgressDto): WaitingRoomApprovalStep =
        when {
            approval.identity == "verified" ->
                identity(WaitingRoomApprovalTone.Done, "Identity confirmed", "Stripe checked your ID and selfie.")
            approval.identity == "processing" ->
                identity(
                    WaitingRoomApprovalTone.Waiting,
                    "Checking your ID",
                    "Stripe is checking your ID and selfie. This usually takes a few minutes.",
                )
            !approval.identityCheckAvailable ->
                identity(
                    WaitingRoomApprovalTone.Todo,
                    "Identity confirmation",
                    "A Pantopus reviewer confirms who you are before approving your claim.",
                )
            approval.identity == "requires_input" ->
                identity(
                    WaitingRoomApprovalTone.Retry,
                    "Your ID check didn’t go through",
                    "Try again with a clear photo of your ID and your face in good light.",
                    action = "Try again",
                )
            approval.identity == "started" ->
                identity(
                    WaitingRoomApprovalTone.Todo,
                    "Finish confirming your identity",
                    "Pick up where you left off: a photo of your ID and a selfie.",
                    action = "Continue",
                )
            else ->
                identity(
                    WaitingRoomApprovalTone.Todo,
                    "Confirm your identity",
                    "Take a photo of your driver’s license, passport or ID card and a selfie. " +
                        "Stripe, our identity partner, checks them.",
                    action = "Confirm identity",
                )
        }

    fun proofStep(
        approval: ClaimApprovalProgressDto,
        residency: Boolean,
    ): WaitingRoomApprovalStep =
        when (approval.proof) {
            "verified" -> proof(WaitingRoomApprovalTone.Done, "Document checked", "A Pantopus reviewer checked your document.")
            "pending" -> proof(WaitingRoomApprovalTone.Waiting, "Document waiting for review", "A Pantopus reviewer will check it.")
            else ->
                proof(
                    WaitingRoomApprovalTone.Todo,
                    if (residency) "Upload proof you live here" else "Upload proof you own this home",
                    if (residency) {
                        "A lease or utility bill with your name and this address."
                    } else {
                        "A deed, closing disclosure or property tax bill with your name and this address."
                    },
                    action = "Upload document",
                )
        }

    private fun identity(
        tone: WaitingRoomApprovalTone,
        title: String,
        detail: String,
        action: String? = null,
    ) = WaitingRoomApprovalStep(
        id = "identity",
        icon = PantopusIcon.IdCard,
        tone = tone,
        title = title,
        detail = detail,
        actionLabel = action,
        actionKey = action?.let { CONFIRM_IDENTITY },
    )

    private fun proof(
        tone: WaitingRoomApprovalTone,
        title: String,
        detail: String,
        action: String? = null,
    ) = WaitingRoomApprovalStep(
        id = "proof",
        icon = PantopusIcon.FileText,
        tone = tone,
        title = title,
        detail = detail,
        actionLabel = action,
        actionKey = action?.let { UPLOAD_DOCUMENT },
    )
}

/** The checklist card in the waiting room. Mirrors iOS `WaitingRoomApprovalCard`. */
@Composable
fun WaitingRoomApprovalCard(
    steps: List<WaitingRoomApprovalStep>,
    busyKey: String?,
    notice: String?,
    onAction: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val ready = steps.all { it.tone == WaitingRoomApprovalTone.Done }
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("waitingRoomApproval"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = if (ready) "Everything’s in. A Pantopus reviewer will approve your claim." else "Before we can approve your claim",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        steps.forEach { step -> ApprovalRow(step, busyKey, onAction) }
        notice?.let {
            Text(
                text = it,
                fontSize = 12.sp,
                color = PantopusColors.warning,
                modifier = Modifier.testTag("waitingRoomApprovalNotice"),
            )
        }
        if (!ready) {
            Text(text = "Then a Pantopus reviewer approves your claim.", fontSize = 12.sp, color = PantopusColors.appTextMuted)
        }
    }
}

@Composable
private fun ApprovalRow(
    step: WaitingRoomApprovalStep,
    busyKey: String?,
    onAction: (String) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().testTag("waitingRoomApproval_${step.id}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        val (icon, tint) =
            when (step.tone) {
                WaitingRoomApprovalTone.Done -> PantopusIcon.CheckCircle to PantopusColors.success
                WaitingRoomApprovalTone.Waiting -> PantopusIcon.Clock to PantopusColors.info
                WaitingRoomApprovalTone.Retry -> PantopusIcon.AlertCircle to PantopusColors.warning
                WaitingRoomApprovalTone.Todo -> PantopusIcon.Circle to PantopusColors.appTextMuted
            }
        PantopusIconImage(icon = icon, contentDescription = null, size = 20.dp, tint = tint)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = step.title, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(text = step.detail, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            if (step.actionLabel != null && step.actionKey != null) {
                val busy = busyKey != null
                Text(
                    text = if (busyKey == step.actionKey) "Opening…" else step.actionLabel,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                    modifier =
                        Modifier
                            .padding(top = Spacing.s1)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(if (busy) PantopusColors.appTextMuted else PantopusColors.primary600)
                            .clickable(enabled = !busy, role = Role.Button) { onAction(step.actionKey) }
                            .heightIn(min = 32.dp)
                            .padding(horizontal = Spacing.s3, vertical = 7.dp)
                            .testTag("waitingRoomApproval_${step.id}_action"),
                )
            }
        }
    }
}
