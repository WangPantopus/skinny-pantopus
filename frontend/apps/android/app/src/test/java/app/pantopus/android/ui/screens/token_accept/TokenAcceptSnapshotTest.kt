@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.token_accept

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
 * Paparazzi snapshots for T3.5 Token / Accept. Three frames mirror
 * the design prompt: home invite, business seat added, 7-day guest
 * pass.
 */
class TokenAcceptSnapshotTest {
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
    fun token_accept_home_invite() {
        paparazzi.snapshot {
            Frame {
                OfferBody(offer = homeInviteOffer(), submitting = false, onAccept = {}, onDecline = {})
            }
        }
    }

    @Test
    fun token_accept_business_seat() {
        paparazzi.snapshot {
            Frame {
                OfferBody(offer = businessSeatOffer(), submitting = false, onAccept = {}, onDecline = {})
            }
        }
    }

    @Test
    fun token_accept_guest_pass() {
        paparazzi.snapshot {
            Frame {
                OfferBody(offer = guestPassOffer(), submitting = false, onAccept = {}, onDecline = {})
            }
        }
    }

    private fun identity(): IdentityChipContent = IdentityChipContent(label = "Alice")

    private fun homeInviteOffer(): TokenAcceptOffer =
        TokenAcceptOffer(
            invitationId = "inv1",
            inviteType = InviteType.HomeInvite,
            title = "Join a home",
            sender = "Maya K. invited you",
            roleOffered = "Co owner",
            venue = "412 Elm St · Portland, OR",
            benefits =
                listOf(
                    "Co-manage occupants, ownership, and home settings",
                    "Share home docs, wi-fi, and entry info with guests",
                    "See all home activity in your Hub",
                ),
            expiry = "Expires Jun 1, 2026 12:00 AM",
            safetyBand =
                SafetyBand(
                    icon = PantopusIcon.Lock,
                    text = "Your email and personal account stay private — Maya only sees your accepted role.",
                ),
            primaryCtaLabel = "Join 412 Elm St",
            secondaryCtaLabel = "Decline",
            identityChip = identity(),
        )

    private fun businessSeatOffer(): TokenAcceptOffer =
        TokenAcceptOffer(
            invitationId = "s1",
            inviteType = InviteType.BusinessSeat,
            title = "Accept a business seat",
            sender = "Bridge Builders LLC offered you a seat",
            roleOffered = "Manager",
            venue = "Bridge Builders LLC",
            benefits =
                listOf(
                    "Post and respond as Manager",
                    "Access the business dashboard and team feed",
                    "Invite teammates and manage seats",
                ),
            expiry = null,
            safetyBand =
                SafetyBand(
                    icon = PantopusIcon.ShieldCheck,
                    text = "Your seat is firewalled — coworkers see your business profile, not your local identity.",
                ),
            primaryCtaLabel = "Add me to Bridge Builders LLC",
            secondaryCtaLabel = "Decline",
            identityChip = identity(),
        )

    private fun guestPassOffer(): TokenAcceptOffer =
        TokenAcceptOffer(
            invitationId = null,
            inviteType = InviteType.GuestPass,
            title = "Marie's place",
            sender = "Welcome to Marie's place",
            roleOffered = "Weekend stay",
            venue = "Marie's place",
            benefits =
                listOf(
                    "Wifi is on the fridge — make yourself at home.",
                    "See wi-fi, parking, and entry info during your stay",
                    "Valid for 7 days",
                ),
            expiry = "Expires May 22, 2026 6:00 PM",
            safetyBand =
                SafetyBand(
                    icon = PantopusIcon.Lock,
                    text = "Guest passes never reveal your account email — you stay anonymous to the host.",
                ),
            primaryCtaLabel = "View guest pass",
            secondaryCtaLabel = "Not now",
            identityChip = identity(),
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
