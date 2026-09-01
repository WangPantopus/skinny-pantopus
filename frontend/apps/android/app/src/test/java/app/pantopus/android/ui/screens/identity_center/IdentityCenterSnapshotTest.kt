@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.identity_center

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.identity.IdentitySwitcherCard
import app.pantopus.android.ui.screens.shared.identity.IdentitySwitcherSheetBody
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for T3.2 Profiles & Privacy. Three frames mirror
 * the iOS snapshots: all four identities active, two set up / two
 * SetupNeeded, and the identity-switcher sheet body that the modal
 * presents.
 */
class IdentityCenterSnapshotTest {
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
    fun identity_center_all_four_active() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    loaded = allFourActive(),
                    onOpenIdentity = {},
                    onBridgeToggle = { _, _ -> },
                    onRowTap = {},
                )
            }
        }
    }

    @Test
    fun identity_center_two_setup_needed() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    loaded = twoSetupNeeded(),
                    onOpenIdentity = {},
                    onBridgeToggle = { _, _ -> },
                    onRowTap = {},
                )
            }
        }
    }

    @Test
    fun identity_center_switcher_sheet_body() {
        paparazzi.snapshot {
            Frame {
                Box(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .background(PantopusColors.appSurface),
                ) {
                    IdentitySwitcherSheetBody(cards = switcherCards(), onSelect = {})
                }
            }
        }
    }

    private fun allFourActive(): IdentityCenterLoaded =
        IdentityCenterLoaded(
            identities =
                listOf(
                    IdentityCardContent(
                        id = "lp1",
                        kind = IdentityKind.Local,
                        overline = "Local Profile",
                        name = "Maria K.",
                        handle = "/maria.k",
                        stats = "47 posts · 23 connections · Verified neighbor",
                        summary = "For nearby posts, gigs, marketplace, and neighbors.",
                    ),
                    IdentityCardContent(
                        id = "pa1",
                        kind = IdentityKind.Personal,
                        overline = "Personal",
                        name = "maria@pantopus.app",
                        stats = "Visible only to verified connections",
                        summary = "Account-level identity. Used for sign-in and direct correspondence.",
                    ),
                    IdentityCardContent(
                        id = "ap1",
                        kind = IdentityKind.PublicProfile,
                        overline = "Public profile",
                        name = "Maria the Mason",
                        handle = "@mariathemason",
                        stats = "1247 followers · weekly",
                        summary = "Your public creator face. Followers stay with you here.",
                        chip = IdentityChip("Live", IdentityChip.Tone.Success),
                    ),
                    IdentityCardContent(
                        id = "b1",
                        kind = IdentityKind.Professional,
                        overline = "Professional",
                        name = "Maria Masonry",
                        stats = "+ 1 more",
                        summary = "Hireable trade profile. Surfaced in Gigs and Marketplace.",
                    ),
                ),
            bridges =
                listOf(
                    IdentityBridgeRow(
                        id = "showPublicOnLocal",
                        label = "Show my Public profile on my Local Profile",
                        subtext = "Neighbors can find your Public profile from your Local Profile.",
                        isOn = true,
                    ),
                    IdentityBridgeRow(
                        id = "showLocalOnPublic",
                        label = "Show my Local Profile on my Public profile",
                        subtext = "Followers can see your neighbor name and home if they tap through.",
                        isOn = false,
                    ),
                ),
            privacyRows =
                listOf(
                    IdentityRowContent(
                        id = "blockedPersonal",
                        icon = PantopusIcon.Shield,
                        label = "Blocked accounts",
                        trailing = "2",
                    ),
                    IdentityRowContent(
                        id = "blockedAudience",
                        icon = PantopusIcon.Shield,
                        label = "Blocked followers",
                        trailing = "5",
                    ),
                    IdentityRowContent(
                        id = "privacyPreview",
                        icon = PantopusIcon.Eye,
                        label = "Privacy Preview",
                        subtext = "Open the visitor's view of your profiles.",
                    ),
                ),
            disclosureRows =
                listOf(
                    IdentityRowContent(
                        id = "homes",
                        icon = PantopusIcon.Home,
                        label = "Homes",
                        trailing = "1 connected",
                    ),
                    IdentityRowContent(
                        id = "businessProfiles",
                        icon = PantopusIcon.Briefcase,
                        label = "Business Profiles",
                        trailing = "2",
                    ),
                    IdentityRowContent(
                        id = "dataExport",
                        icon = PantopusIcon.File,
                        label = "Data export",
                        subtext = "Download everything we know about your identities.",
                    ),
                ),
        )

    private fun twoSetupNeeded(): IdentityCenterLoaded =
        IdentityCenterLoaded(
            identities =
                listOf(
                    IdentityCardContent(
                        id = "lp1",
                        kind = IdentityKind.Local,
                        overline = "Local Profile",
                        name = "Maria K.",
                        handle = "/maria.k",
                        stats = "47 posts · 23 connections",
                        summary = "For nearby posts, gigs, marketplace, and neighbors.",
                    ),
                    IdentityCardContent(
                        id = "pa1",
                        kind = IdentityKind.Personal,
                        overline = "Personal",
                        name = "maria@pantopus.app",
                        stats = "Visible only to verified connections",
                        summary = "Account-level identity. Used for sign-in and direct correspondence.",
                    ),
                    IdentityCardContent(
                        id = "publicProfile",
                        kind = IdentityKind.PublicProfile,
                        overline = "Public profile",
                        name = "Create your public face",
                        summary = "Followers find your Public profile here. Update them when you ship work.",
                        status = IdentityStatus.SetupNeeded(cta = "Create"),
                    ),
                    IdentityCardContent(
                        id = "professional",
                        kind = IdentityKind.Professional,
                        overline = "Professional",
                        name = "Add your trade",
                        summary = "Hireable identity. Surfaced in Gigs and Marketplace.",
                        status = IdentityStatus.SetupNeeded(cta = "Add"),
                    ),
                ),
            bridges = emptyList(),
            privacyRows =
                listOf(
                    IdentityRowContent(
                        id = "blockedPersonal",
                        icon = PantopusIcon.Shield,
                        label = "Blocked accounts",
                        trailing = "0",
                    ),
                    IdentityRowContent(
                        id = "blockedAudience",
                        icon = PantopusIcon.Shield,
                        label = "Blocked followers",
                        trailing = "0",
                    ),
                    IdentityRowContent(
                        id = "privacyPreview",
                        icon = PantopusIcon.Eye,
                        label = "Privacy Preview",
                        subtext = "Open the visitor's view of your profiles.",
                    ),
                ),
            disclosureRows =
                listOf(
                    IdentityRowContent(
                        id = "homes",
                        icon = PantopusIcon.Home,
                        label = "Homes",
                        trailing = "Not connected",
                    ),
                    IdentityRowContent(
                        id = "businessProfiles",
                        icon = PantopusIcon.Briefcase,
                        label = "Business Profiles",
                        trailing = "0",
                    ),
                    IdentityRowContent(
                        id = "dataExport",
                        icon = PantopusIcon.File,
                        label = "Data export",
                        subtext = "Download everything we know about your identities.",
                    ),
                ),
        )

    private fun switcherCards(): List<IdentitySwitcherCard> =
        listOf(
            IdentitySwitcherCard(
                id = "l",
                kind = IdentityKind.Local,
                overline = "Local Profile",
                name = "Maria K.",
                stats = "47 posts · 23 connections",
                isActive = true,
            ),
            IdentitySwitcherCard(
                id = "p",
                kind = IdentityKind.Personal,
                overline = "Personal",
                name = "maria@pantopus.app",
                stats = "Account · verified",
            ),
            IdentitySwitcherCard(
                id = "pp",
                kind = IdentityKind.PublicProfile,
                overline = "Public profile",
                name = "Maria the Mason",
                stats = "1247 followers · weekly",
            ),
            IdentitySwitcherCard(
                id = "pr",
                kind = IdentityKind.Professional,
                overline = "Professional",
                name = "Maria Masonry",
                stats = "Available for hire",
            ),
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
