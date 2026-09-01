@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.shared.content_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the Content Detail shell. Renders the
 * populated, loading, and error pose of a home-dashboard-style page.
 */
class ContentDetailSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2000,
                    softButtons = false,
                ),
        )

    @Test
    fun home_dashboard_populated_shell() {
        paparazzi.snapshot {
            Root {
                ContentDetailShell(
                    title = "Home",
                    onBack = {},
                    cta = {
                        FabCreateCTA(
                            actions =
                                listOf(
                                    FabSheetAction("a", "Log a package", PantopusIcon.ShoppingBag),
                                ),
                            onSelect = {},
                        )
                    },
                    header = {
                        HomeHeroHeader(
                            address = "1234 Main Street, Springfield",
                            verified = true,
                            stats =
                                listOf(
                                    HomeHeroStat("members", "3", "Members"),
                                    HomeHeroStat("gigs", "5", "Nearby gigs"),
                                    HomeHeroStat("role", "Owner", "Your role"),
                                ),
                        )
                    },
                    body = {
                        GridTabsBody(
                            quickActions =
                                listOf(
                                    QuickActionTile("add_mail", "Add mail", PantopusIcon.Mailbox, IdentityPillar.Home),
                                    QuickActionTile("log", "Log", PantopusIcon.ShoppingBag, IdentityPillar.Business),
                                    QuickActionTile("add", "Add", PantopusIcon.UserPlus, IdentityPillar.Personal),
                                    QuickActionTile("verify", "Verify", PantopusIcon.ShieldCheck, IdentityPillar.Home),
                                ),
                            tabs =
                                listOf(
                                    GridTabsTab("overview", "Overview"),
                                    GridTabsTab("members", "Members"),
                                    GridTabsTab("mail", "Mail"),
                                    GridTabsTab("access", "Access"),
                                ),
                            selectedTab = "overview",
                            onSelectTab = {},
                            onQuickAction = {},
                        ) {
                            androidx.compose.material3.Text(
                                text = "Summary content goes here",
                                color = PantopusColors.appText,
                            )
                        }
                    },
                )
            }
        }
    }

    @Test
    fun home_dashboard_empty_tab_renders_empty_state() {
        paparazzi.snapshot {
            Root {
                ContentDetailShell(
                    title = "Home",
                    onBack = {},
                    header = {
                        HomeHeroHeader(
                            address = "1 Main",
                            verified = true,
                            stats = listOf(HomeHeroStat("m", "1", "Member")),
                        )
                    },
                    body = {
                        GridTabsBody(
                            quickActions = emptyList(),
                            tabs = listOf(GridTabsTab("overview", "Overview"), GridTabsTab("mail", "Mail")),
                            selectedTab = "mail",
                            onSelectTab = {},
                            onQuickAction = {},
                        ) {}
                    },
                )
            }
        }
    }

    @Composable
    private fun Root(content: @Composable () -> Unit) {
        Box(
            modifier = Modifier.fillMaxSize().background(PantopusColors.appBg),
        ) { content() }
    }
}
