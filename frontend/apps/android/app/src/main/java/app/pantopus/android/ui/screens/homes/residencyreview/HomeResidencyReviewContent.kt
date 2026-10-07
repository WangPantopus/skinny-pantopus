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
    Text("Request", style = MaterialTheme.typography.titleMedium)
    claimant?.let { Text(it, style = MaterialTheme.typography.titleSmall) }
    Text("Reference: ${review.claimId.takeLast(REFERENCE_SUFFIX_LENGTH)}", style = MaterialTheme.typography.bodySmall)
    Text("Status: ${claimStatus(review.status)}", Modifier.testTag("homeResidencyReview.claimStatus"))
    Text("Asked to join as: ${joinedAs(review.claim["claimed_role"])}")
    (review.claim["claimed_address"] as? String)?.let { Text("Address: $it") }
    (review.claim["review_note"] as? String)?.takeIf(String::isNotEmpty)?.let { Text("Note: $it") }
    if (recovering) {
        Text("Your saved decision below was for an earlier request.", style = MaterialTheme.typography.bodySmall)
    }
    HorizontalDivider()
    Text("Their access now", style = MaterialTheme.typography.titleMedium)
    val occupancy = review.occupancy
    if (occupancy == null) {
        Text("They don’t have access to this Home yet.")
    } else {
        Text(
            "Membership: ${if (occupancy["is_active"] == true) "Active" else "Ended"}",
            Modifier.testTag("homeResidencyReview.membershipStatus"),
        )
        Text("Role: ${roleLabel(occupancy["role_base"] ?: occupancy["role"])}")
        Text("Age group: ${words(occupancy["age_band"])}")
        Text("Verification: ${verificationLabel(occupancy["verification_status"])}")
        MEMBERSHIP_DATES.forEach { (key, title) -> Text("$title: ${residencyReviewDate(occupancy[key])}") }
        Text("What they can do also depends on these dates and their permissions.", style = MaterialTheme.typography.bodySmall)
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
        if (receipt != null) "Decision saved" else "Check your last decision",
        style = MaterialTheme.typography.titleMedium,
    )
    Text("You chose: ${pending.action.title}")
    HomeResidencyReviewRole.entries.firstOrNull { it.wire == body["proposed_role"] }?.let { Text("Role: ${it.title}") }
    (body["reason"] as? String)?.takeIf(String::isNotEmpty)?.let { Text("Reason: $it") }
    if (receipt != null) {
        Text("Saved ${residencyReviewDate(receipt["created_at"])}")
        Text(if (pending.action == HomeResidencyDecision.Approve) "You approved this request." else "You rejected this request.")
    } else {
        Text(
            "We couldn’t confirm your decision went through. Try again; it won’t be applied twice.",
            style = MaterialTheme.typography.bodySmall,
        )
    }
    if (viewModel.recoveringAnotherClaim) Text("Finish this before reviewing another request.")
    if (state.canRetry) {
        TextButton(onClick = viewModel::retry, modifier = Modifier.testTag("homeResidencyReview.retry")) {
            Text(if (receipt != null) "Save again" else "Try again")
        }
    }
    if (state.canAcknowledge) {
        TextButton(onClick = viewModel::acknowledge, modifier = Modifier.testTag("homeResidencyReview.acknowledge")) {
            Text(if (pending.receiptJson != null) "Done" else "Start over")
        }
    }
}

private fun words(value: Any?): String = (value as? String ?: "Not given").replace('_', ' ')

private fun claimStatus(value: Any?): String =
    when (value) {
        "pending" -> "Waiting for your decision"
        "verified" -> "Approved"
        "rejected" -> "Rejected"
        else -> words(value)
    }

private fun joinedAs(value: Any?): String =
    when (value) {
        "household", "member" -> "Household member"
        "renter", "tenant" -> "Renter"
        else -> words(value)
    }

private fun roleLabel(value: Any?): String = HomeResidencyReviewRole.entries.firstOrNull { it.wire == value }?.title ?: words(value)

private fun verificationLabel(value: Any?): String =
    when (value) {
        "verified" -> "Verified"
        "pending_approval" -> "Waiting for approval"
        "pending_postcard" -> "Waiting for a postcard"
        "provisional_bootstrap", "provisional" -> "Provisional"
        "moved_out" -> "Left this Home"
        "inactive" -> "Removed"
        else -> words(value)
    }

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
