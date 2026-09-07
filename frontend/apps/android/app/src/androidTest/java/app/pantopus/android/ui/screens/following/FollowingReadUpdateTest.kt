package app.pantopus.android.ui.screens.following

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import app.pantopus.android.data.api.models.following.FollowingPersonaDto
import app.pantopus.android.data.api.models.following.FollowingPostDto
import app.pantopus.android.data.api.models.following.FollowingRowDto
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import java.time.Instant

class FollowingReadUpdateTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun muted_update_opens_exact_post_and_selection_does_not_open_it() {
        val now = Instant.now()
        val row =
            FollowingProjection.project(
                FollowingRowDto(
                    membershipId = "membership",
                    persona = FollowingPersonaDto(id = "beacon", handle = "maya.builds", displayName = "Maya Builds"),
                    latestPost = FollowingPostDto(id = "exact-post", snippet = "New workshop", createdAt = now.toString()),
                    mutedUntil = now.plusSeconds(3600).toString(),
                    unreadCount = 1,
                ),
                now,
            ).second
        val selecting = mutableStateOf(false)
        val openedPosts = mutableListOf<String>()
        val openedProfiles = mutableListOf<String>()
        composeRule.setContent {
            PantopusTheme {
                FollowingRowItem(
                    row = row,
                    isSelecting = selecting.value,
                    isSelected = false,
                    onOpenPersona = { openedProfiles.add(it) },
                    onOpenPost = { openedPosts.add(it) },
                    onToggleSelect = {},
                    onLongPress = {},
                    onBell = {},
                    onOverflow = {},
                )
            }
        }
        composeRule.onNodeWithTag("followingRead.exact-post").assertIsDisplayed().performClick()
        composeRule.runOnIdle {
            assertEquals(listOf("exact-post"), openedPosts)
            assertEquals(emptyList<String>(), openedProfiles)
        }
        composeRule.onNodeWithText("Maya Builds").performClick()
        composeRule.runOnIdle {
            assertEquals(listOf("maya.builds"), openedProfiles)
            selecting.value = true
        }
        composeRule.onNodeWithTag("followingRead.exact-post").assertDoesNotExist()
    }
}
