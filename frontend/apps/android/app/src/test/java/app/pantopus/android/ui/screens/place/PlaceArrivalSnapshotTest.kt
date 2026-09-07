package app.pantopus.android.ui.screens.place

import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.core.routing.PlacePendingStore
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.ui.screens.place.launch.PendingPlaceScreen
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

class PlaceArrivalSnapshotTest {
    @get:Rule val paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_6.copy(softButtons = false))
    private val draft =
        PlacePendingStore.Pending(
            "preview",
            "12 Example Street, Apartment 4B, Camas, WA 98607",
            45.6,
            -122.4,
            Long.MAX_VALUE,
            "a",
        )

    @Test fun retryPreservesAddressAndActions() {
        render(
            PlaceArrivalState(
                draft = draft,
                previewError = true,
                error = "We couldn’t confirm the save. Your preview is still here — please try again.",
            ),
        )
    }

    @Test fun confirmedSaveKeepsSetupSeparate() {
        render(
            PlaceArrivalState(
                draft = draft,
                previewError = true,
                saved =
                    SavedPlaceDto(
                        id = "saved",
                        userId = "a",
                        label = draft.label,
                        latitude = draft.latitude,
                        longitude = draft.longitude,
                    ),
            ),
        )
    }

    private fun render(state: PlaceArrivalState) {
        paparazzi.snapshot {
            PantopusTheme {
                PendingPlaceScreen(state, onSave = {}, onDone = {}, onSavedPlaces = {}, onSetUpHome = {}, onRetryPreview = {})
            }
        }
    }
}
