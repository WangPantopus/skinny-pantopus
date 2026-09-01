@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.setup

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

class SetupSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false))

    @Test
    fun wizard_link_available() =
        paparazzi.snapshot {
            Frame {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(Spacing.s5)) {
                    WizardStepRail(listOf("Link", "Type", "Hours", "Share"), current = 1, pillar = SchedulingPillar.Personal)
                    SlugClaimField(
                        overline = "Your link",
                        slug = "maria-k",
                        state = SlugFieldUiState.Available,
                        availableHint = "People will book you at this link.",
                        onSlugChange = {},
                        onPickSuggestion = {},
                        pillar = SchedulingPillar.Personal,
                    )
                }
            }
        }

    @Test
    fun wizard_link_taken() =
        paparazzi.snapshot {
            Frame {
                Column(Modifier.padding(16.dp)) {
                    SlugClaimField(
                        overline = "Your link",
                        slug = "maria-k",
                        state = SlugFieldUiState.Taken(listOf("maria-k2", "maria-kowalski", "mariak-wa")),
                        availableHint = "People will book you at this link.",
                        onSlugChange = {},
                        onPickSuggestion = {},
                        pillar = SchedulingPillar.Personal,
                    )
                }
            }
        }

    @Test
    fun wizard_type_picker() =
        paparazzi.snapshot {
            Frame {
                Column(Modifier.padding(16.dp)) {
                    WizardTypePicker(
                        selectedMode = "video",
                        duration = 30,
                        pillar = SchedulingPillar.Personal,
                        onSelectMode = {},
                        onSelectDuration = {},
                    )
                }
            }
        }

    @Test
    fun onboarding_combine_round_robin() =
        paparazzi.snapshot {
            Frame {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
                    OnboardingModePicker(mode = "round_robin", pillar = SchedulingPillar.Home, onSelect = {})
                    OnboardingRoundRobinRule(rule = "balanced", pillar = SchedulingPillar.Home, onSelect = {})
                    ComposedAvailabilityCard(
                        message = composedMessage(OnboardingFlow.Home),
                        timezoneId = "America/New_York",
                        pillar = SchedulingPillar.Home,
                    )
                }
            }
        }

    @Test
    fun onboarding_business_service() =
        paparazzi.snapshot {
            Frame {
                Column(Modifier.padding(16.dp)) {
                    OnboardingServicePicker(
                        serviceType = "consultation",
                        duration = 30,
                        priceText = "120",
                        paidEnabled = true,
                        pillar = SchedulingPillar.Business,
                        onSelect = {},
                        onDuration = {},
                        onPrice = {},
                    )
                }
            }
        }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }
}
