@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.CouponBody
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.CouponBodyState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/** A17.5 — Paparazzi snapshots for Coupon mail across all three states. */
class CouponBodySnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2800,
                    softButtons = false,
                ),
        )

    @Test fun coupon_unused_body() {
        paparazzi.snapshot {
            Root {
                CouponBody(
                    coupon = MailItemSampleData.couponUnused,
                    state = CouponBodyState.Unused,
                    similarOffers = MailItemSampleData.couponSimilarOffers,
                )
            }
        }
    }

    @Test fun coupon_redeemed_body() {
        paparazzi.snapshot {
            Root {
                CouponBody(
                    coupon = MailItemSampleData.couponRedeemed,
                    state = CouponBodyState.Redeemed,
                    similarOffers = MailItemSampleData.couponSimilarOffers,
                    walletReminderDetail = MailItemSampleData.COUPON_WALLET_REMINDER_DETAIL,
                    walletArrivalDetail = MailItemSampleData.COUPON_WALLET_ARRIVAL_DETAIL,
                )
            }
        }
    }

    @Test fun coupon_expired_body() {
        paparazzi.snapshot {
            Root {
                CouponBody(
                    coupon = MailItemSampleData.couponExpired,
                    state = CouponBodyState.Expired,
                    similarOffers = MailItemSampleData.couponSimilarOffers,
                )
            }
        }
    }

    @Test fun coupon_expanded_barcode_body() {
        paparazzi.snapshot {
            Root {
                CouponBody(
                    coupon = MailItemSampleData.couponUnused,
                    state = CouponBodyState.Unused,
                    barcodeInitiallyExpanded = true,
                    similarOffers = MailItemSampleData.couponSimilarOffers,
                )
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
                    .padding(vertical = Spacing.s4),
        ) {
            content()
        }
    }
}
