@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.compose.gig

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.wizard.blocks.FormFieldsBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.HeadlineBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.ReviewSummaryBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.ReviewSummaryRow
import app.pantopus.android.ui.screens.shared.wizard.blocks.SubcopyBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.SuccessHeroBlock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi baselines for the P2.2 Post-a-Task wizard. Six per-step
 * frames plus the terminal success state — one snapshot per step
 * locks the visual contract for the Compose canvas.
 *
 * The full wizard chrome (top bar, segmented progress, sticky CTA) is
 * captured by the WizardShell snapshot tests under
 * `ui/screens/shared/wizard/`. Here we lock the per-step content slot
 * the way the live wizard renders it.
 */
class GigComposeSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test
    fun compose_gig_step_1_category() {
        paparazzi.snapshot {
            Frame {
                HeadlineBlock("What kind of help do you need?")
                SubcopyBlock("Pick the closest match. You can refine it later.")
                val rows = GigComposeCategory.entries.toList().chunked(3)
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    for (row in rows) {
                        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                            for (category in row) {
                                Box(modifier = Modifier.weight(1f)) {
                                    StaticCategoryTile(
                                        category = category,
                                        isSelected = category == GigComposeCategory.Handyman,
                                    )
                                }
                            }
                            repeat(3 - row.size) {
                                Box(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
        }
    }

    @Test
    fun compose_gig_step_2_basics() {
        paparazzi.snapshot {
            Frame {
                HeadlineBlock("Describe the task")
                SubcopyBlock("A clear title and a few details help neighbors decide if it's right for them.")
                FormFieldsBlock {
                    StaticLabeledValue(label = "Title", value = "Hang 3 shelves in the living room")
                    StaticLabeledValue(
                        label = "Description",
                        value =
                            "Need three IKEA Lack shelves mounted on drywall — I have the studs " +
                                "marked. Bring a level, drill, and anchor screws.",
                    )
                }
            }
        }
    }

    @Test
    fun compose_gig_step_3_budget() {
        paparazzi.snapshot {
            Frame {
                HeadlineBlock("Set your budget")
                SubcopyBlock("Pick a price model. Helpers see this on the gig card.")
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    GigComposeBudgetType.entries.forEach { type ->
                        StaticRadioRow(
                            label = type.label,
                            subcopy = type.subcopy(),
                            isSelected = type == GigComposeBudgetType.Fixed,
                        )
                    }
                }
                FormFieldsBlock {
                    StaticLabeledValue(label = "Min total", value = "$60")
                    StaticLabeledValue(label = "Max total", value = "Optional")
                }
            }
        }
    }

    @Test
    fun compose_gig_step_4_schedule() {
        paparazzi.snapshot {
            Frame {
                HeadlineBlock("When does it need to happen?")
                SubcopyBlock("Pick one — you can change it later.")
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    GigComposeScheduleType.entries.forEach { type ->
                        StaticRadioRow(
                            label = type.label,
                            subcopy = type.subcopy(),
                            isSelected = type == GigComposeScheduleType.OneTime,
                        )
                    }
                }
                FormFieldsBlock {
                    StaticLabeledValue(label = "When", value = "Sat, Apr 13 · 10:00 AM")
                }
            }
        }
    }

    @Test
    fun compose_gig_step_5_location() {
        paparazzi.snapshot {
            Frame {
                HeadlineBlock("Where does the task happen?")
                SubcopyBlock("Your exact address is shared only after a helper is selected.")
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    GigComposeLocationMode.entries.forEach { mode ->
                        StaticRadioRow(
                            label = mode.label,
                            subcopy = mode.subcopy(),
                            isSelected = mode == GigComposeLocationMode.APlace,
                        )
                    }
                }
                FormFieldsBlock {
                    StaticLabeledValue(label = "Street", value = "123 Main St")
                    StaticLabeledValue(label = "City", value = "Portland")
                    StaticLabeledValue(label = "State / ZIP", value = "OR · 97214")
                }
            }
        }
    }

    @Test
    fun compose_gig_step_6_review() {
        paparazzi.snapshot {
            Frame {
                HeadlineBlock("Review and post")
                SubcopyBlock("Check the details. Helpers see what's below as your gig card.")
                ReviewSummaryBlock(
                    rows =
                        listOf(
                            ReviewSummaryRow("Category", "Handyman"),
                            ReviewSummaryRow("Title", "Hang 3 shelves in the living room"),
                            ReviewSummaryRow(
                                "Description",
                                "Need three IKEA Lack shelves mounted on drywall — studs marked.",
                            ),
                            ReviewSummaryRow("Photos", "2 photos"),
                            ReviewSummaryRow("Budget", "$60"),
                            ReviewSummaryRow("Schedule", "Sat, Apr 13 · 10:00 AM"),
                            ReviewSummaryRow("Location", "Your saved address"),
                        ),
                )
            }
        }
    }

    @Test
    fun compose_gig_step_7_success() {
        paparazzi.snapshot {
            Frame {
                SuccessHeroBlock(
                    headline = "Task posted",
                    subcopy = "Helpers can now see it on the Gigs feed. We'll notify you when bids come in.",
                )
            }
        }
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) {
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s5),
                ) { content() }
            }
        }
    }
}
