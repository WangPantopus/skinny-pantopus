package app.pantopus.android.ui.screens.place

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import app.pantopus.android.data.api.models.place.PickupCollection
import app.pantopus.android.data.api.models.place.PlaceAddressCalendarData
import app.pantopus.android.data.api.models.place.SetPickupDayRequest
import app.pantopus.android.ui.screens.place.detail.AddressCalendarActions
import app.pantopus.android.ui.screens.place.detail.PickupScheduleEditor
import app.pantopus.android.ui.theme.PantopusTheme
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class PickupScheduleEditorTest {
    @get:Rule val compose = createComposeRule()
    private val requests = mutableListOf<SetPickupDayRequest>()
    private val actions =
        object : AddressCalendarActions {
            override val calendarBusy = MutableStateFlow(false)
            override val calendarError = MutableStateFlow<String?>(null)

            override fun setPickupDay(
                request: SetPickupDayRequest,
                offerPrimer: Boolean,
            ) {
                assertTrue(offerPrimer)
                requests.add(request)
            }

            override fun clearPickupDay(expectedVersion: String?) = Unit
        }

    private fun show() {
        compose.setContent {
            PantopusTheme {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    PickupScheduleEditor(PlaceAddressCalendarData(today = "2026-09-03"), actions, busy = false)
                }
            }
        }
    }

    @Test fun unknownRecyclingSavesOnlyAfterExplicitConfirmation() {
        show()
        compose.onNodeWithText("Save schedule").assertIsNotEnabled()
        compose.onNodeWithContentDescription("Garbage").performScrollTo().performClick()
        compose.onNodeWithContentDescription("Garbage Thursday: Not selected").performScrollTo().performClick()
        compose.onNodeWithText("Garbage first collection date").performScrollTo().performTextInput("2026-09-03")
        assertTrue(requests.isEmpty())
        compose.onNodeWithText("Save schedule").performScrollTo().performClick()
        assertEquals(
            listOf(
                SetPickupDayRequest(collections = listOf(PickupCollection("garbage", weekdays = listOf("TH"), anchorDate = "2026-09-03"))),
            ),
            requests,
        )
    }

    @Test fun recyclingRequiresAnActualDateAndCanUseADifferentDay() {
        show()
        compose.onNodeWithContentDescription("Garbage").performScrollTo().performClick()
        compose.onNodeWithContentDescription("Garbage Thursday: Not selected").performScrollTo().performClick()
        compose.onNodeWithText("Garbage first collection date").performScrollTo().performTextInput("2026-09-03")
        compose.onNodeWithContentDescription("Recycling").performScrollTo().performClick()
        compose.onNodeWithContentDescription("Recycling repeats: Every week").performScrollTo().performClick()
        compose.onNodeWithText("Every 2 weeks").performClick()
        compose.onNodeWithContentDescription("Recycling Friday: Not selected").performScrollTo().performClick()
        compose.onNodeWithText("Save schedule").assertIsNotEnabled()
        compose.onNodeWithText("Recycling first collection date").performScrollTo().performTextInput("2026-09-04")
        compose.onNodeWithText("Save schedule").assertIsEnabled().performScrollTo().performClick()
        assertEquals(
            listOf(
                SetPickupDayRequest(
                    collections =
                        listOf(
                            PickupCollection("garbage", weekdays = listOf("TH"), anchorDate = "2026-09-03"),
                            PickupCollection("recycling", interval = 2, weekdays = listOf("FR"), anchorDate = "2026-09-04"),
                        ),
                ),
            ),
            requests,
        )
    }
}
