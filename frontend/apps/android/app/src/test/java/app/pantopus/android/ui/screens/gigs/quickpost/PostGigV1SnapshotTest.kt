@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.gigs.quickpost

import androidx.compose.runtime.Composable
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.FormShellLeading
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for A13.8 Post Gig V1: the filled-ready sofa move
 * frame and the validation-errors frame. The submit() round-trip
 * (validation → POST /api/gigs → posted id) lives in
 * [PostGigV1ViewModelTest].
 */
class PostGigV1SnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1800,
                    softButtons = false,
                ),
        )

    @Test
    fun post_gig_v1_filled_ready() {
        paparazzi.snapshot {
            SnapshotFrame(PostGigV1SampleData.filledState as PostGigV1UiState.Content)
        }
    }

    @Test
    fun post_gig_v1_validation_errors() {
        paparazzi.snapshot {
            SnapshotFrame(PostGigV1SampleData.validationErrorState as PostGigV1UiState.Content)
        }
    }

    @Composable
    private fun SnapshotFrame(state: PostGigV1UiState.Content) {
        PantopusTheme {
            FormShell(
                title = "Post gig",
                leading = FormShellLeading.Back,
                rightActionLabel = "Post",
                isValid = state.canAttemptSubmit,
                isDirty = state.isPostEnabled,
                isSaving = state.isSubmitting,
                onClose = {},
                onCommit = {},
            ) {
                PostGigV1Content(state = state, actions = PostGigV1Actions())
            }
        }
    }
}
