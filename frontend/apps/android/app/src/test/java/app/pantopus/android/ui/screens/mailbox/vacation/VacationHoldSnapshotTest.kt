@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.vacation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.mailbox.vacation.components.HeldList
import app.pantopus.android.ui.screens.mailbox.vacation.components.HoldStatusHero
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * A14.8 — Paparazzi snapshots for the hold screen's two feature-local
 * primitives. The whole-screen frames went with the Mail tab's Hold my
 * mail reskin (founder direction: end-to-end checks, no new baselines).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class VacationHoldSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2800,
                    softButtons = false,
                ),
        )

    @Before fun setup() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun hold_status_hero_primitive() {
        paparazzi.snapshot {
            Root {
                HoldStatusHero(
                    daysLeft = 5,
                    untilLabel = "Jun 9",
                    stats = VacationHoldSampleData.activeHold.stats,
                    reduceMotionOverride = true,
                )
            }
        }
    }

    @Test
    fun held_list_primitive() {
        paparazzi.snapshot {
            Root {
                HeldList(items = VacationHoldSampleData.activeHold.heldItems)
            }
        }
    }

    @Composable
    private fun Root(content: @Composable () -> Unit) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .padding(Spacing.s3),
        ) {
            content()
        }
    }
}
