@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.status

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the A18 Status / Waiting frames. Each design
 * frame + its secondary state is pinned: A18.1 sent/resent, A18.2
 * submitted/approved, A18.3 waiting/confirmed, plus the retained
 * under-review recipe.
 */
class StatusWaitingSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    // ── A18.2 Claim submitted ─────────────────────────────────────────────

    @Test
    fun status_claim_submitted() {
        paparazzi.snapshot {
            Frame {
                StatusWaitingScreen(
                    content = StatusWaitingContent.claimSubmitted(homeName = "418 Linden Ave, Oakland CA"),
                )
            }
        }
    }

    @Test
    fun status_claim_approved() {
        paparazzi.snapshot {
            Frame {
                StatusWaitingScreen(
                    content =
                        StatusWaitingContent.claimSubmitted(
                            homeName = "418 Linden Ave, Oakland CA",
                            approved = true,
                        ),
                )
            }
        }
    }

    // ── A18.3 Verification submitted ──────────────────────────────────────

    @Test
    fun status_verification_submitted() {
        paparazzi.snapshot {
            Frame {
                StatusWaitingScreen(
                    content =
                        StatusWaitingContent.verificationSubmitted(
                            homeName = "418 Linden Ave · Apt 3B",
                            landlordEmail = "r.osman@acme-realty.com",
                        ),
                )
            }
        }
    }

    @Test
    fun status_verification_confirmed() {
        paparazzi.snapshot {
            Frame {
                StatusWaitingScreen(
                    content =
                        StatusWaitingContent.verificationSubmitted(
                            homeName = "418 Linden Ave · Apt 3B",
                            landlordEmail = "r.osman@acme-realty.com",
                            landlordName = "Rashida Osman",
                            confirmed = true,
                        ),
                )
            }
        }
    }

    // ── A18.1 Check your email ────────────────────────────────────────────

    @Test
    fun status_check_your_email() {
        paparazzi.snapshot {
            Frame {
                StatusWaitingScreen(content = StatusWaitingContent.checkYourEmail(email = "maria.k@email.com"))
            }
        }
    }

    @Test
    fun status_check_your_email_resent() {
        paparazzi.snapshot {
            Frame {
                StatusWaitingScreen(
                    content = StatusWaitingContent.checkYourEmail(email = "maria.k@email.com", resent = true),
                )
            }
        }
    }

    // ── Under review (retained) ───────────────────────────────────────────

    @Test
    fun status_under_review() {
        paparazzi.snapshot {
            Frame {
                StatusWaitingScreen(
                    content =
                        StatusWaitingContent.underReview(
                            homeName = "412 Elm St",
                            submittedAgo = "2 days ago",
                        ),
                )
            }
        }
    }

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
