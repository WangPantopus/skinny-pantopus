package app.pantopus.android.data.api

import app.pantopus.android.data.api.models.gigs.GigBidAcceptResponse
import app.pantopus.android.data.api.models.gigs.GigScoredOfferDto
import app.pantopus.android.data.api.models.mailbox.v2.GigDetailDto
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class GigBidReceiptDecodingTest {
    @Test fun scored_pending_offer_preserves_gig_identity_for_cold_resume() {
        val offer = GigScoredOfferDto(id = "b1", gigId = "g1", status = "pending_payment", amount = 12.5)
        assertEquals("g1", offer.asBid().gigId)
        assertEquals("b1", offer.asBid().id)
        assertEquals("pending_payment", offer.asBid().status)
    }

    @Test fun paid_receipt_preserves_exact_bid_gig_cents_and_server_readiness() {
        val json = """{"bid":{"id":"b1","gig_id":"g1","status":"pending_payment","bid_amount":12.5},
            "amountCents":1250,"currency":"usd","authorizationReady":true,"paymentStatus":"authorized",
            "providerStatus":"requires_capture","requiresPaymentSetup":false,"clientSecret":null}"""
        val adapter = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build().adapter(GigBidAcceptResponse::class.java)
        val receipt = checkNotNull(adapter.fromJson(json))
        assertEquals("b1", receipt.bid?.id)
        assertEquals("g1", receipt.bid?.gigId)
        assertEquals(1250, receipt.amountCents)
        assertEquals("usd", receipt.currency)
        assertEquals(true, receipt.authorizationReady)
        assertEquals("authorized", receipt.paymentStatus)
        assertNull(receipt.sheetParams().clientSecret)
    }

    @Test fun mail_pending_state_keeps_exact_ids_and_changes_only_with_a_confirmed_receipt() {
        val payload =
            mapOf(
                "gig_id" to "g1",
                "bid_id" to "b1",
                "bid_status" to "pending_payment",
                "bidder" to mapOf("name" to "Neighbor"),
                "bid" to mapOf("amount" to 12),
                "post" to mapOf("title" to "Task"),
            )
        val mail = checkNotNull(GigDetailDto.decodeFromObjectPayload(payload))
        assertEquals("g1", mail.gigId)
        assertEquals("b1", mail.bidId)
        assertEquals("pending_payment", mail.bidStatus)
        assertEquals(false, mail.isAccepted)
        assertEquals("accepted", mail.accepted().bidStatus)
    }
}
