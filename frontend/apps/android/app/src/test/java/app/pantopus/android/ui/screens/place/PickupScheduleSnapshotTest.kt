package app.pantopus.android.ui.screens.place

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.place.HouseholdPickupSchedule
import app.pantopus.android.data.api.models.place.PlaceAddressCalendarData
import app.pantopus.android.data.api.models.place.SetPickupDayRequest
import app.pantopus.android.ui.screens.place.detail.AddressCalendarActions
import app.pantopus.android.ui.screens.place.detail.PickupScheduleEditor
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Rule
import org.junit.Test

class PickupScheduleSnapshotTest {
    @get:Rule val paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_6.copy(softButtons = false))
    private val actions =
        object : AddressCalendarActions {
            override val calendarBusy = MutableStateFlow(false)
            override val calendarError = MutableStateFlow<String?>(null)

            override fun setPickupDay(request: SetPickupDayRequest) = Unit

            override fun clearPickupDay() = Unit
        }

    @Test fun explicitRecyclingSchedule() {
        paparazzi.snapshot {
            PantopusTheme {
                Surface(color = PantopusColors.appSurface) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        PickupScheduleEditor(
                            PlaceAddressCalendarData(
                                today = "2026-09-03",
                                pickupSchedule = HouseholdPickupSchedule("TH", "biweekly", "2026-09-11"),
                            ),
                            actions,
                            busy = false,
                        )
                    }
                }
            }
        }
    }
}
