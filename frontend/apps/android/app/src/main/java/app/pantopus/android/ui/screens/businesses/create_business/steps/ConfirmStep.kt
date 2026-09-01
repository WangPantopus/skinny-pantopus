@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.create_business.steps

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
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
    HeadlineBlock("Confirm and create")
    SubcopyBlock(
        "Publish takes your business live. Save as draft keeps it hidden until you're ready.",
    )
    ReviewSummaryBlock(rows = summaryRows(state))
    state.logoUploadWarning?.let { warning ->
        Text(
            text = warning,
            style = PantopusTextStyle.caption,
            color = PantopusColors.warning,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("createBusinessLogoWarning"),
        )
    }
    state.submitError?.let { error ->
        Text(
            text = error,
            style = PantopusTextStyle.caption,
            color = PantopusColors.error,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("createBusinessSubmitError"),
        )
    }
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
            if (state.hasLocation && !state.hoursSkipped) "Weekday defaults" else "Not set",
        )
    rows +=
        ReviewSummaryRow(
            "Logo",
            if (state.logoPick != null && !state.logoSkipped) "Selected" else "Not set",
        )
    return rows
}
