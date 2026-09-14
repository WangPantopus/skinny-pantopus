package app.pantopus.android.ui.screens.homes.residencyreview

import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import app.pantopus.android.data.homes.HomeResidencyCurrentReview
import app.pantopus.android.data.homes.HomeResidencyDecision
import app.pantopus.android.data.homes.HomeResidencyReviewRole
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private const val REFERENCE_SUFFIX_LENGTH = 8

@Composable
internal fun HomeResidencyReviewCurrent(
    review: HomeResidencyCurrentReview,
    claimant: String?,
    recovering: Boolean,
) {
    Text("Current residency claim", style = MaterialTheme.typography.titleMedium)
    claimant?.let { Text(it, style = MaterialTheme.typography.titleSmall) }
    Text(
        "Claim reference: ${review.claimId.takeLast(REFERENCE_SUFFIX_LENGTH)} · " +
            "Applicant account: ${review.applicantId.takeLast(REFERENCE_SUFFIX_LENGTH)}",
        style = MaterialTheme.typography.bodySmall,
    )
    Text("Claim status: ${review.status}", Modifier.testTag("homeResidencyReview.claimStatus"))
    Text("Requested role: ${words(review.claim["claimed_role"])}")
    (review.claim["claimed_address"] as? String)?.let { Text("Claimed address: $it") }
    (review.claim["review_note"] as? String)?.takeIf(String::isNotEmpty)?.let { Text("Current review note: $it") }
    if (recovering) {
        Text(
            "This is the latest claim state. The saved decision below records the earlier request.",
            style = MaterialTheme.typography.bodySmall,
        )
    }
    HorizontalDivider()
    Text("Current membership", style = MaterialTheme.typography.titleMedium)
    val occupancy = review.occupancy
    if (occupancy == null) {
        Text("No membership record exists for this applicant yet.")
    } else {
        Text(
            "Membership record: ${if (occupancy["is_active"] == true) "Active" else "Inactive"}",
            Modifier.testTag("homeResidencyReview.membershipStatus"),
        )
        Text("Role: ${words(occupancy["role_base"] ?: occupancy["role"])}")
        Text("Age band: ${words(occupancy["age_band"])}")
        Text("Verification: ${words(occupancy["verification_status"])}")
        MEMBERSHIP_DATES.forEach { (key, title) -> Text("$title: ${residencyReviewDate(occupancy[key])}") }
        Text(
            "Access also depends on the current dates, verification and household permissions.",
            style = MaterialTheme.typography.bodySmall,
        )
    }
    HorizontalDivider()
}

@Composable
internal fun HomeResidencyReviewRecovery(
    state: HomeResidencyReviewUiState,
    viewModel: HomeResidencyReviewViewModel,
) {
    val pending = state.pending ?: return
    val body = viewModel.codec.objectFrom(pending.requestJson)
    val receipt = state.receiptJson?.let(viewModel.codec::objectFrom)
    Text(
        if (receipt != null) "Original decision confirmed" else "Decision needs confirmation",
        style = MaterialTheme.typography.titleMedium,
    )
    Text(pending.action.title)
    HomeResidencyReviewRole.entries.firstOrNull { it.wire == body["proposed_role"] }?.let { Text("Originally selected role: ${it.title}") }
    (body["reason"] as? String)?.takeIf(String::isNotEmpty)?.let { Text("Original reason: $it") }
    if (receipt != null) {
        Text("Recorded ${residencyReviewDate(receipt["created_at"])}")
        Text(
            if (pending.action == HomeResidencyDecision.Approve) {
                "The original residency claim was approved."
            } else {
                "The original residency claim was rejected."
            },
        )
        Text(
            "Later changes remain in effect. This confirmation does not restore access or decide a resubmitted claim.",
            style = MaterialTheme.typography.bodySmall,
        )
    } else {
        Text(
            "The original decision is saved on this device. Retry it to confirm the outcome without submitting a second decision.",
            style = MaterialTheme.typography.bodySmall,
        )
    }
    if (viewModel.recoveringAnotherClaim) Text("Finish this saved decision before reviewing another claim.")
    if (state.canRetry) {
        TextButton(onClick = viewModel::retry, modifier = Modifier.testTag("homeResidencyReview.retry")) {
            Text(if (receipt != null) "Save confirmation again" else "Retry original decision")
        }
    }
    if (state.canAcknowledge) {
        TextButton(onClick = viewModel::acknowledge, modifier = Modifier.testTag("homeResidencyReview.acknowledge")) {
            Text(if (pending.receiptJson != null) "I reviewed this confirmation" else "Review current claim again")
        }
    }
}

private fun words(value: Any?): String = (value as? String ?: "Unknown").replace('_', ' ')

private fun residencyReviewDate(value: Any?): String =
    if (value == null) {
        "Not set"
    } else {
        runCatching {
            Instant.parse(
                value as String,
            ).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT))
        }.getOrDefault("Unavailable")
    }

private val MEMBERSHIP_DATES =
    linkedMapOf(
        "start_at" to "Membership starts",
        "end_at" to "Membership ends",
        "access_start_at" to "Access starts",
        "access_end_at" to "Access ends",
        "verification_expires_at" to "Verification expires",
    )
