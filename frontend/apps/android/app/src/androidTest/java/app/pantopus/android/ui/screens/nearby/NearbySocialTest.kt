package app.pantopus.android.ui.screens.nearby

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodMeter
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class NearbySocialTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun social_actions_remain_available_in_every_meter_state() {
        val state = mutableStateOf<NearbyUiState>(NearbyUiState.Loading)
        val destinations = mutableListOf<String>()
        composeRule.setContent {
            NearbyContent(
                state = state.value,
                onClaim = { destinations.add("home") },
                onOpenPulse = { destinations.add("pulse") },
                onOpenBeacons = { destinations.add("beacons") },
                onOpenConnections = { destinations.add("connections") },
                onOpenMarketplace = { destinations.add("marketplace") },
                onOpenTasks = { destinations.add("tasks") },
                onRetry = {},
            )
        }
        val states =
            listOf(NearbyUiState.Loading, NearbyUiState.Error("Meter unavailable")) +
                listOf("no_place", "forming", "growing", "unlocked").map {
                    NearbyUiState.Loaded(
                        meter =
                            NeighborhoodMeter(
                                state = it,
                                unlocked = it == "unlocked",
                                verifiedCount = if (it == "forming") null else 12,
                            ),
                        cells = null,
                    )
                }
        states.forEach { next ->
            composeRule.runOnIdle { state.value = next }
            listOf("pulse", "beacons", "connections").forEach { destination ->
                composeRule.onNodeWithTag("nearbySocial.$destination").assertIsDisplayed().performClick()
                composeRule.runOnIdle { assertEquals(destination, destinations.last()) }
            }
        }
        assertEquals(18, destinations.size)
    }
}
