@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.handshake

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the T3.4 Privacy Handshake. Four frames
 * mirror the prompt's design file: step 1 (empty handle input),
 * step 2 (Free preselected), opening-Stripe-Checkout, and return-
 * visitor-already-member.
 */
class PrivacyHandshakeSnapshotTest {
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
    fun handshake_step1_empty_handle_input() {
        paparazzi.snapshot {
            Frame { ReadyBody(content = handleStepContent(handleValue = "")) }
        }
    }

    @Test
    fun handshake_step2_free_preselected() {
        paparazzi.snapshot {
            Frame { ReadyBody(content = tierStepContent(selectedRank = 1)) }
        }
    }

    @Test
    fun handshake_opens_stripe_checkout() {
        paparazzi.snapshot {
            Frame {
                ReadyBody(
                    content =
                        tierStepContent(selectedRank = 2)
                            .copy(step = HandshakeStep.OpensCheckout("https://checkout.stripe.com/c/abc")),
                )
            }
        }
    }

    @Test
    fun handshake_return_visitor_already_member() {
        paparazzi.snapshot {
            Frame {
                ReadyBody(
                    content =
                        baseContent().copy(step = HandshakeStep.AlreadyMember),
                )
            }
        }
    }

    private fun baseContent(): HandshakeReadyContent =
        HandshakeReadyContent(
            persona =
                HandshakePersonaPreview(
                    id = "p_demo",
                    handle = "mayabuilds",
                    displayName = "Maya Builds",
                    avatarUrl = null,
                    bio = "Building things in the Mission. Murals, workshops, neighborhood collabs.",
                    audienceLabel = "followers",
                    followerCount = 12,
                ),
            tierOptions =
                listOf(
                    HandshakeTierOption(
                        id = "t1",
                        rank = 1,
                        name = "Followers",
                        description = "Free updates from Maya.",
                        priceCents = 0,
                        currency = "usd",
                    ),
                    HandshakeTierOption(
                        id = "t2",
                        rank = 2,
                        name = "Members",
                        description = "Member-only updates + early mural reveals.",
                        priceCents = 500,
                        currency = "usd",
                    ),
                    HandshakeTierOption(
                        id = "t3",
                        rank = 3,
                        name = "Insiders",
                        description = "Direct messages and behind-the-scenes content.",
                        priceCents = 2500,
                        currency = "usd",
                    ),
                ),
            step = HandshakeStep.HandleEntry,
            handle = HandshakeHandleState(value = "fan_8a2c41"),
            selectedTierRank = 1,
        )

    private fun handleStepContent(handleValue: String): HandshakeReadyContent =
        baseContent().copy(handle = HandshakeHandleState(value = handleValue))

    private fun tierStepContent(selectedRank: Int): HandshakeReadyContent =
        baseContent().copy(step = HandshakeStep.TierSelection, selectedTierRank = selectedRank)

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) {
                Column(modifier = Modifier.padding(16.dp)) { content() }
            }
        }
    }
}
