package app.pantopus.android.ui.screens.homes.tasks

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class HomeTaskMediaControlsTest {
    @get:Rule val compose = createComposeRule()
    private val selection = TaskMediaSelection("original-upload", "Local file.txt", 1)

    @Test fun unknown_upload_retry_is_enabled_and_carries_original_id() {
        var retried: String? = null
        compose.setContent {
            TaskMediaPendingControls(
                HomeTaskMediaState(visible = true, active = true, progress = TaskMediaProgress(selection, attempted = true)),
                { retried = it }, {}, {},
            )
        }
        compose.onNodeWithTag("homeTaskMedia.retry").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals(selection.id, retried) }
    }

    @Test fun retired_upload_acknowledgement_is_explicit_and_busy_retry_is_disabled() {
        var cleared: String? = null
        compose.setContent {
            TaskMediaPendingControls(
                HomeTaskMediaState(
                    visible = true, active = true,
                    progress = TaskMediaProgress(selection, attempted = true, removedUploadId = selection.id),
                ),
                {}, {}, { cleared = it },
            )
            TaskMediaPendingControls(
                HomeTaskMediaState(visible = true, active = true, busy = true, progress = TaskMediaProgress(selection, attempted = true)),
                {}, {}, {},
            )
        }
        compose.onNodeWithTag("homeTaskMedia.clearRemoved").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals(selection.id, cleared) }
        compose.onNodeWithTag("homeTaskMedia.retry").assertIsNotEnabled()
    }
}
