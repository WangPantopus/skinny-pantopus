package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.ai.PickupFlyerReading
import app.pantopus.android.data.api.models.ai.AIPickupScheduleReadingDto
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch

/**
 * "Read a flyer" at the top of the pickup editor: a photo of the household's hauler's flyer, taken
 * now or chosen from the library, fills in the editor's fields through [onRead]. The reading saves
 * nothing; the person checks the days and taps Save schedule. Mirrors iOS `AddressCalendarCard.flyerControl`.
 */
@Composable
internal fun PickupFlyerControl(
    actions: AddressCalendarActions,
    enabled: Boolean,
    onReadingChange: (Boolean) -> Unit,
    onRead: (AIPickupScheduleReadingDto) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var reading by remember { mutableStateOf(false) }
    var message by rememberSaveable { mutableStateOf<String?>(null) }
    var failed by rememberSaveable { mutableStateOf(false) }
    var choosing by remember { mutableStateOf(false) }
    val sources =
        rememberReadingSources("pickup-flyer") { photo, afterwards ->
            reading = true
            onReadingChange(true)
            message = null
            scope.launch {
                try {
                    when (val result = actions.readPickupFlyer(photo)) {
                        is PickupFlyerReading.Read -> {
                            onRead(result.schedule)
                            message =
                                listOfNotNull(result.schedule.summary, result.note, "Check the days, then tap Save schedule.")
                                    .joinToString(" ")
                            failed = false
                        }
                        is PickupFlyerReading.Failed -> {
                            message = result.message
                            failed = true
                        }
                        null -> Unit
                    }
                } finally {
                    afterwards()
                    reading = false
                    onReadingChange(false)
                }
            }
        }

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Box {
            GhostButton(
                "Read a flyer",
                onClick = { if (sources.hasCamera) choosing = true else sources.choosePhoto() },
                modifier = Modifier.fillMaxWidth().testTag("addressCalendarReadFlyer"),
                isLoading = reading,
                isEnabled = enabled && !reading,
            )
            DropdownMenu(expanded = choosing, onDismissRequest = { choosing = false }) {
                DropdownMenuItem(text = { Text("Take a photo") }, onClick = {
                    choosing = false
                    sources.takePhoto()
                })
                DropdownMenuItem(text = { Text("Choose a photo") }, onClick = {
                    choosing = false
                    sources.choosePhoto()
                })
            }
        }
        val shown = if (reading) "Reading the flyer…" else message
        if (shown != null) {
            Text(
                shown,
                fontSize = 12.sp,
                color =
                    when {
                        reading -> PantopusColors.appTextSecondary
                        failed -> PantopusColors.error
                        else -> PantopusColors.appText
                    },
                modifier = Modifier.testTag("addressCalendarFlyerMessage").semantics { liveRegion = LiveRegionMode.Polite },
            )
        }
    }
}
