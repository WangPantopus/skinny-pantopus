@file:Suppress("LongMethod", "MagicNumber", "UnusedPrivateMember", "PackageNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the Phase 1.1 hero primitives. Each test
 * mirrors a `#Preview` variant from the iOS twin file
 * (`HeroPrimitivesSnapshotTests.swift`) — same seeds, same data — so
 * cross-platform parity is verifiable by eyeballing the two snapshot
 * sets side-by-side.
 */
class HeroPrimitivesSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(softButtons = false),
        )

    @Test
    fun balanceHero_default() {
        paparazzi.snapshot {
            HeroFrame {
                BalanceHero(
                    overline = "Available to withdraw",
                    amount = "847.50",
                    currencyCode = "USD",
                    split =
                        listOf(
                            BalanceHeroSplitCell(
                                icon = PantopusIcon.Clock,
                                overline = "Pending",
                                value = "$186.00",
                                note = "3 tasks · clears by Dec 4",
                            ),
                            BalanceHeroSplitCell(
                                icon = PantopusIcon.ArrowUpRight,
                                overline = "This month",
                                value = "$1,284.50",
                                note = "8 tasks · ▲22% vs Oct",
                            ),
                        ),
                )
            }
        }
    }

    @Test
    fun balanceHero_holdTone() {
        paparazzi.snapshot {
            HeroFrame {
                BalanceHero(
                    overline = "Available to withdraw",
                    amount = "847.50",
                    currencyCode = "USD",
                    split =
                        listOf(
                            BalanceHeroSplitCell(
                                icon = PantopusIcon.Clock,
                                overline = "Pending",
                                value = "$186.00",
                                note = "3 tasks · clears by Dec 4",
                            ),
                        ),
                    tone = BalanceHeroTone.HoldTone,
                    holdHeadline = "Withdrawals paused",
                    holdBody = "Re-verify your bank to release funds.",
                )
            }
        }
    }

    @Test
    fun balanceHero_payoutFooter() {
        // A14.6 Payments — compact variant: hides arcs + currency chip +
        // split strip, drops in a "Next payout · date" + frequency pill
        // row under a smaller 28sp amount.
        paparazzi.snapshot {
            HeroFrame {
                BalanceHero(
                    overline = "Available to pay out",
                    amount = "124.50",
                    currencyCode = "USD",
                    payoutFooter =
                        BalanceHeroPayoutFooter(
                            nextPayoutLabel = "Next payout · Mon, May 27",
                            frequencyPill = "Weekly",
                        ),
                )
            }
        }
    }

    @Test
    fun paperStack_default() {
        paparazzi.snapshot {
            HeroFrame {
                PaperStack {
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        Text(
                            text = "MERIDIAN WEALTH",
                            color = PantopusColors.appText,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        Text(
                            text = "Q1 2026 Statement",
                            color = PantopusColors.appTextSecondary,
                            fontSize = 9.sp,
                        )
                    }
                }
            }
        }
    }

    @Test
    fun postcard_pristine() {
        paparazzi.snapshot {
            HeroFrame {
                Postcard(
                    recipientName = "Mira Patel",
                    street = "412 Elm St, Apt 3B",
                    cityZip = "San Francisco, CA 94114",
                )
            }
        }
    }

    @Test
    fun postcard_delivered() {
        paparazzi.snapshot {
            HeroFrame {
                Postcard(
                    recipientName = "Mira Patel",
                    street = "412 Elm St, Apt 3B",
                    cityZip = "San Francisco, CA 94114",
                    delivered = true,
                )
            }
        }
    }

    @Test
    fun confettiSpray_staticSeed() {
        paparazzi.snapshot {
            HeroFrame {
                ConfettiSpray(
                    seed = 42uL,
                    isAnimating = false,
                    modifier = Modifier.background(PantopusColors.appSurface),
                )
            }
        }
    }
}

/**
 * Shared frame for hero-primitive snapshots — neutral background +
 * consistent padding so dimensions read the same across tests.
 */
@Composable
private fun HeroFrame(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        content()
    }
}
