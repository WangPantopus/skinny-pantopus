@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.you.me

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the Me tab (T6.2b re-skin). One baseline
 * per identity binding — Personal, Home, and unbound-Business —
 * proves the identity-rebind chrome stays put while the gradient
 * header, accent, stats, action grid, and section labels swap.
 */
class MeSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test
    fun me_personal() {
        paparazzi.snapshot {
            Frame { PopulatedFrame(active = personalContent(), onSwitch = {}, onAction = {}, onSection = {}, onDestructive = {}) }
        }
    }

    @Test
    fun me_home() {
        paparazzi.snapshot {
            Frame { PopulatedFrame(active = homeContent(), onSwitch = {}, onAction = {}, onSection = {}, onDestructive = {}) }
        }
    }

    @Test
    fun me_business_unbound() {
        paparazzi.snapshot {
            Frame { PopulatedFrame(active = businessUnbound(), onSwitch = {}, onAction = {}, onSection = {}, onDestructive = {}) }
        }
    }

    private fun personalContent(): MeIdentityContent =
        MeIdentityContent(
            identity = MeIdentity.Personal,
            displayName = "Maria K.",
            initials = "MK",
            handle = "@maria",
            locality = "Elm Park",
            tagline = "Neighborhood cleanup organiser; coffee enthusiast.",
            verified = true,
            stats =
                listOf(
                    MeStat("activity", "12", "Activity"),
                    MeStat("trust", "Verified", "Trust"),
                    MeStat("reputation", "4.9", "Reputation"),
                ),
            actionTiles =
                listOf(
                    MeActionTile("posts", PantopusIcon.File, "My posts", routeKey = "me.posts"),
                    MeActionTile("bids", PantopusIcon.Hammer, "My bids", routeKey = "me.bids"),
                    MeActionTile("gigs", PantopusIcon.ClipboardList, "My tasks", routeKey = "me.gigs"),
                    MeActionTile("offers", PantopusIcon.HandCoins, "Offers", routeKey = "me.offers"),
                    MeActionTile("listings", PantopusIcon.ShoppingBag, "Listings", routeKey = "me.listings"),
                    MeActionTile("connections", PantopusIcon.UserPlus, "Connections", routeKey = "me.connections"),
                ),
            sections =
                listOf(
                    MeSection(
                        id = "profile_privacy",
                        header = "Profile & Privacy",
                        rows =
                            listOf(
                                MeSectionRow("edit", PantopusIcon.Edit2, "Edit profile", routeKey = "me.editProfile"),
                                MeSectionRow("identityCenter", PantopusIcon.Shield, "Identity Center", routeKey = "me.identityCenter"),
                                MeSectionRow("audience", PantopusIcon.Megaphone, "Audience profile", routeKey = "me.audience"),
                            ),
                    ),
                    MeSection(
                        id = "help_legal",
                        header = "Help & Legal",
                        rows =
                            listOf(
                                MeSectionRow("help", PantopusIcon.HelpCircle, "Help", routeKey = "me.help"),
                                MeSectionRow("terms", PantopusIcon.File, "Terms", routeKey = "me.legal"),
                                MeSectionRow("privacy", PantopusIcon.Shield, "Privacy", value = "Neighbors", routeKey = "me.privacy"),
                            ),
                    ),
                ),
        )

    private fun homeContent(): MeIdentityContent =
        MeIdentityContent(
            identity = MeIdentity.Home,
            displayName = "12 Rose Court",
            initials = "RC",
            handle = "Household · 2 members",
            locality = "Elm Park",
            tagline = "12 Rose Court, Unit 4B",
            verified = true,
            stats =
                listOf(
                    MeStat("bills", "—", "Bills due"),
                    MeStat("tasks", "—", "Open tasks"),
                    MeStat("members", "2", "Members"),
                ),
            actionTiles =
                listOf(
                    MeActionTile("bills", PantopusIcon.File, "Bills", routeKey = "me.bills", routeArgs = mapOf("homeId" to "h1")),
                    MeActionTile("pets", PantopusIcon.Heart, "Pets", routeKey = "me.pets", routeArgs = mapOf("homeId" to "h1")),
                    MeActionTile(
                        "members",
                        PantopusIcon.UserPlus,
                        "Members",
                        routeKey = "me.members",
                        routeArgs = mapOf("homeId" to "h1"),
                    ),
                    MeActionTile(
                        "polls",
                        PantopusIcon.CheckCircle,
                        "Polls",
                        routeKey = "me.polls",
                        routeArgs = mapOf("homeId" to "h1"),
                    ),
                    MeActionTile(
                        "calendar",
                        PantopusIcon.Calendar,
                        "Calendar",
                        routeKey = "me.calendar",
                        routeArgs = mapOf("homeId" to "h1"),
                    ),
                    MeActionTile("docs", PantopusIcon.File, "Documents", routeKey = "me.docs", routeArgs = mapOf("homeId" to "h1")),
                ),
            sections =
                listOf(
                    MeSection(
                        id = "household",
                        header = "Household",
                        rows =
                            listOf(
                                MeSectionRow("members", PantopusIcon.UserPlus, "Members", routeKey = "me.members"),
                                MeSectionRow("owners", PantopusIcon.Shield, "Owners", routeKey = "me.owners"),
                                MeSectionRow("access", PantopusIcon.Lock, "Access codes", routeKey = "me.access"),
                            ),
                    ),
                ),
        )

    private fun businessUnbound(): MeIdentityContent =
        MeIdentityContent(
            identity = MeIdentity.Business,
            displayName = "No business yet",
            initials = "B",
            handle = "Tap to register your business",
            locality = null,
            tagline = null,
            verified = false,
            stats = emptyList(),
            actionTiles =
                listOf(
                    MeActionTile("register", PantopusIcon.PlusSquare, "Register", routeKey = "business.register"),
                ),
            sections = emptyList(),
            isUnbound = true,
        )

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }
}
