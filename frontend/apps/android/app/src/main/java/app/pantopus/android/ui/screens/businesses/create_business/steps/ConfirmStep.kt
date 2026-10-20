@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.create_business.steps

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import app.pantopus.android.ui.screens.businesses.create_business.CreateBusinessUiState
import app.pantopus.android.ui.screens.shared.wizard.blocks.HeadlineBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.ReviewSummaryBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.ReviewSummaryRow
import app.pantopus.android.ui.screens.shared.wizard.blocks.SubcopyBlock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle

/**
 * Create Business step 4 — review summary + Confirm CTA (wired in the
 * wizard chrome via create-full).
 */
@Composable
fun ConfirmStep(state: CreateBusinessUiState) {
    BusinessIdentityChip()
    HeadlineBlock(if (state.createdBusinessId != null) "Your draft is saved" else "Confirm and create")
    SubcopyBlock(
        if (state.logoUploadWarning != null) {
            "Retry the logo upload and publish, or open the draft to continue editing."
        } else if (state.createdBusinessId != null) {
            "Retry publishing this draft, or open it to continue editing."
        } else {
            "Publish takes your business live. Save as draft keeps it hidden until you're ready."
        },
    )
    ReviewSummaryBlock(rows = summaryRows(state))
    state.logoUploadWarning?.let { warning ->
        SubmissionMessage(
            message = warning,
            color = PantopusColors.warning,
            tag = "createBusinessLogoWarning",
        )
    }
    state.submitError?.let { error ->
        SubmissionMessage(
            message = error,
            color = PantopusColors.error,
            tag = "createBusinessSubmitError",
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun SubmissionMessage(
    message: String,
    color: Color,
    tag: String,
) {
    val requester = remember { BringIntoViewRequester() }
    LaunchedEffect(message) { requester.bringIntoView() }
    Text(
        text = message,
        style = PantopusTextStyle.caption,
        color = color,
        modifier =
            Modifier
                .fillMaxWidth()
                .bringIntoViewRequester(requester)
                .semantics { liveRegion = LiveRegionMode.Polite }
                .testTag(tag),
    )
}

private fun summaryRows(state: CreateBusinessUiState): List<ReviewSummaryRow> {
    val rows = mutableListOf<ReviewSummaryRow>()
    rows += ReviewSummaryRow("Category", state.selectedCategory?.label ?: "—")
    rows += ReviewSummaryRow("Name", state.businessName.trim())
    rows += ReviewSummaryRow("Username", "@${state.cleanedUsername}")
    rows += ReviewSummaryRow("Email", state.email.trim())
    val desc = state.description.trim()
    if (desc.isNotEmpty()) {
        rows += ReviewSummaryRow("Description", desc)
    }
    rows +=
        ReviewSummaryRow(
            "Location",
            if (state.hasLocation) {
                "${state.address.trim()}, ${state.city.trim()}"
            } else {
                "Not set"
            },
        )
    rows +=
        ReviewSummaryRow(
            "Hours",
            if (state.hasLocation && !state.hoursSkipped) {
                state.hours.joinToString("\n") { day ->
                    "${day.shortLabel}: " + if (day.isClosed) "Closed" else "${day.openTime}–${day.closeTime}"
                }
            } else {
                "Not set"
            },
        )
    rows +=
        ReviewSummaryRow(
            "Logo",
            when {
                state.logoUploaded -> "Uploaded"
                state.logoPick != null && !state.logoSkipped -> "Selected"
                else -> "Not set"
            },
        )
    return rows
}
