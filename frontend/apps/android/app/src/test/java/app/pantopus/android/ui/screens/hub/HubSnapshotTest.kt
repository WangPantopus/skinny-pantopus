package app.pantopus.android.ui.screens.hub

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.screens.hub.sections.HubFirstRunHero
import app.pantopus.android.ui.screens.hub.sections.HubPillarGrid
import app.pantopus.android.ui.screens.hub.sections.HubSkeleton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the three hub states. Each renders a subset of
 * the hub composition — the whole screen is too tall for a single PNG on
 * a Pixel 5 without stacking baselines.
 */
class HubSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2200,
                    softButtons = false,
                ),
        )

    @Test
    fun hub_skeleton() {
        paparazzi.snapshot { Section { HubSkeleton() } }
    }

    @Test
    fun hub_first_run() {
        paparazzi.snapshot {
            Section {
                HubFirstRunHero(
                    content =
                        FirstRunContent(
                            greeting = "Good morning",
                            name = "Alice",
                            avatarInitials = "A",
                            identity = IdentityPillar.Personal,
                            ringProgress = 0.25f,
                            profileCompleteness = 0.25f,
                            stepsDone = 1,
                            stepsTotal = 4,
                            steps =
                                listOf(
                                    SetupStep("name", "Set your name", done = true),
                                    SetupStep("address", "Claim your home", done = false),
                                ),
                            pillars = emptyList(),
                            discovery = emptyList(),
                        ),
                    onStart = {},
                )
            }
        }
    }

    @Test
    fun hub_populated_pillars() {
        paparazzi.snapshot {
            Section {
                HubPillarGrid(
                    tiles =
                        listOf(
                            PillarTile(PillarTile.Pillar.Pulse, "Pulse", PantopusIcon.Megaphone, IdentityPillar.Personal, "3", false),
                            PillarTile(
                                PillarTile.Pillar.Marketplace,
                                "Marketplace",
                                PantopusIcon.ShoppingBag,
                                IdentityPillar.Business,
                                "Set up",
                                true,
                            ),
                            PillarTile(PillarTile.Pillar.Gigs, "Gigs", PantopusIcon.Hammer, IdentityPillar.Personal, "5", false),
                            PillarTile(PillarTile.Pillar.Mail, "Mail", PantopusIcon.Mailbox, IdentityPillar.Home, "1", false),
                        ),
                    onTap = {},
                )
            }
        }
    }

    @Composable
    private fun Section(content: @Composable () -> Unit) {
        Box(modifier = Modifier.background(PantopusColors.appBg)) { content() }
    }
}
