@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.payments

import app.pantopus.android.data.api.models.connect.ConnectAccountDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A14.6 — the Payouts card used to be a hard-coded "not connected" scaffold.
 * It now projects the live `GET api/payments/connect/account` status into RN
 * `PayoutsTab`'s three frames: connected / verifying / never connected.
 * Mirrors iOS `PaymentsPayoutsProjectionTests`.
 */
class PaymentsPayoutsProjectionTest {
    /** No account at all keeps the honest onboarding scaffold. */
    @Test
    fun no_connect_account_keeps_the_not_connected_scaffold() {
        val payouts = PaymentsMapper.payouts(null)

        val trailing = payouts.stripe.trailing as PaymentsRowTrailing.CtaChip
        assertEquals("Connect", trailing.label)
        assertEquals(PaymentsChipTone.Primary, trailing.tone)
        assertTrue(payouts.payoutMethod.trailing is PaymentsRowTrailing.GatedDash)
        assertTrue(payouts.taxInfo.trailing is PaymentsRowTrailing.GatedDash)
    }

    /**
     * An account that exists but isn't onboarded surfaces "Continue setup" and
     * keeps the downstream rows gated.
     */
    @Test
    fun verifying_account_surfaces_continue_setup() {
        val payouts =
            PaymentsMapper.payouts(
                ConnectAccountDto(
                    stripeAccountId = "acct_1",
                    chargesEnabled = false,
                    payoutsEnabled = false,
                    detailsSubmitted = true,
                ),
            )

        val trailing = payouts.stripe.trailing as PaymentsRowTrailing.CtaChip
        assertEquals("Continue setup", trailing.label)
        assertEquals("Account verification in progress", payouts.stripe.subtext)
        assertTrue(payouts.payoutMethod.trailing is PaymentsRowTrailing.GatedDash)
    }

    /**
     * An onboarded account swaps to the green Connected chip, dates the row
     * from `StripeAccount.created_at`, and un-gates the payout rows.
     */
    @Test
    fun connected_account_renders_connected_chip_and_date() {
        val payouts =
            PaymentsMapper.payouts(
                ConnectAccountDto(
                    stripeAccountId = "acct_1",
                    chargesEnabled = true,
                    payoutsEnabled = true,
                    detailsSubmitted = true,
                    createdAt = "2024-03-12T10:00:00.000Z",
                ),
            )

        val trailing = payouts.stripe.trailing as PaymentsRowTrailing.ChipChevron
        assertEquals("Connected", trailing.label)
        assertEquals(PaymentsChipTone.Success, trailing.tone)
        assertEquals("Connected Mar 12, 2024", payouts.stripe.subtext)
        assertTrue(payouts.payoutMethod.trailing is PaymentsRowTrailing.Chevron)
        assertTrue(payouts.taxInfo.trailing is PaymentsRowTrailing.Chevron)
    }

    /**
     * Without `created_at` the row states the capability instead of inventing a
     * connection date.
     */
    @Test
    fun connected_account_without_date_falls_back_to_capability_copy() {
        val payouts =
            PaymentsMapper.payouts(
                ConnectAccountDto(
                    stripeAccountId = "acct_1",
                    chargesEnabled = true,
                    payoutsEnabled = true,
                    detailsSubmitted = true,
                ),
            )

        assertEquals("Card payments and payouts enabled", payouts.stripe.subtext)
    }
}
