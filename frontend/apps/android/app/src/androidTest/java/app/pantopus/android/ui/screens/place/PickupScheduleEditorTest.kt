package app.pantopus.android.ui.screens.place

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
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

            override fun setPickupDay(request: SetPickupDayRequest) {
                requests.add(request)
            }

            override fun clearPickupDay() = Unit
        }

    private fun show() {
        compose.setContent {
            PantopusTheme {
                Column {
                    PickupScheduleEditor(PlaceAddressCalendarData(today = "2026-09-03"), actions, busy = false)
                }
            }
        }
    }

    @Test fun unknownRecyclingSavesOnlyAfterExplicitConfirmation() {
        show()
        compose.onNodeWithText("Save schedule").assertIsNotEnabled()
        compose.onNodeWithContentDescription("Garbage collection: Choose").performClick()
        compose.onNodeWithText("Thursday").performClick()
        assertTrue(requests.isEmpty())
        compose.onNodeWithText("Save schedule").performClick()
        assertEquals(listOf(SetPickupDayRequest("TH", "not_set", null)), requests)
    }

    @Test fun recyclingRequiresAnActualDateAndCanUseADifferentDay() {
        show()
        compose.onNodeWithContentDescription("Garbage collection: Choose").performClick()
        compose.onNodeWithText("Thursday").performClick()
        compose.onNodeWithContentDescription("Recycling: Not sure yet").performClick()
        compose.onNodeWithText("Every other week").performClick()
        compose.onNodeWithText("Save schedule").assertIsNotEnabled()
        compose.onNodeWithContentDescription("Next recycling pickup: Choose").performClick()
        compose.onNodeWithText("Friday, Sep 4").performClick()
        compose.onNodeWithText("Save schedule").assertIsEnabled().performClick()
        assertEquals(listOf(SetPickupDayRequest("TH", "biweekly", "2026-09-04")), requests)
    }
}
