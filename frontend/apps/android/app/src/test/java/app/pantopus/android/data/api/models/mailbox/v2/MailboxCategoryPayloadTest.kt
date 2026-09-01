@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.data.api.models.mailbox.v2

import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MailboxCategoryPayloadTest {
    @Test fun coupon_decodes_required_fields() {
        val payload =
            mapOf(
                "headline" to "30% OFF",
                "subcopy" to "at any participating Whole Foods",
                "code" to "PANTO30",
                "expires_at" to "2026-05-31",
                "merchant" to "Whole Foods Market",
                "min_spend" to "$25",
                "fine_print" to "One per customer.",
            )
        val resolved = MailboxCategoryPayload.resolve(MailItemCategory.Coupon, payload)
        assertTrue(resolved is MailboxCategoryPayload.Coupon)
        val coupon = (resolved as MailboxCategoryPayload.Coupon).detail
        assertEquals("30% OFF", coupon.headline)
        assertEquals("PANTO30", coupon.code)
        assertEquals("$25", coupon.minimumSpend)
    }

    @Test fun coupon_missing_headline_falls_back_to_other() {
        val payload = mapOf("code" to "X")
        assertEquals(
            MailboxCategoryPayload.Other,
            MailboxCategoryPayload.resolve(MailItemCategory.Coupon, payload),
        )
    }

    @Test fun booklet_decodes_pages_and_count() {
        val payload =
            mapOf(
                "pages" to listOf("https://x/p1.png", "https://x/p2.png"),
                "summary" to "Spring catalog",
                "page_count" to 24,
            )
        val resolved = MailboxCategoryPayload.resolve(MailItemCategory.Booklet, payload)
        assertTrue(resolved is MailboxCategoryPayload.Booklet)
        val booklet = (resolved as MailboxCategoryPayload.Booklet).detail
        assertEquals(2, booklet.pages.size)
        assertEquals(24, booklet.pageCount)
    }

    @Test fun booklet_no_pages_falls_back() {
        val payload = mapOf("summary" to "no pages")
        assertEquals(
            MailboxCategoryPayload.Other,
            MailboxCategoryPayload.resolve(MailItemCategory.Booklet, payload),
        )
    }

    @Test fun certified_decodes_chain_and_completion_state() {
        val payload =
            mapOf(
                "reference_number" to "CRT-2026-0091",
                "document_type" to "Court summons",
                "acknowledge_by" to "2026-05-25",
                "chain" to
                    listOf(
                        mapOf("id" to "sent", "label" to "Sent", "occurred_at" to "2026-05-08"),
                        mapOf("id" to "delivered", "label" to "Delivered", "occurred_at" to "2026-05-10"),
                        mapOf("id" to "ack", "label" to "Acknowledged"),
                    ),
                "notice_body" to "You are summoned.",
                "terms_url" to "https://x/terms",
                "is_acknowledged" to false,
            )
        val resolved = MailboxCategoryPayload.resolve(MailItemCategory.Certified, payload)
        assertTrue(resolved is MailboxCategoryPayload.Certified)
        val cert = (resolved as MailboxCategoryPayload.Certified).detail
        assertEquals("CRT-2026-0091", cert.referenceNumber)
        assertEquals(3, cert.chain.size)
        assertTrue(cert.chain[0].isComplete)
        assertTrue(cert.chain[1].isComplete)
        assertFalse(cert.chain[2].isComplete) // no occurred_at
        assertNull(cert.chain[2].occurredAt)
    }

    @Test fun gig_decodes_bidder_bid_post_and_other_bids() {
        val payload =
            mapOf(
                "is_accepted" to false,
                "bidder" to
                    mapOf(
                        "initials" to "MT",
                        "name" to "Marcus T.",
                        "rating" to 4.9,
                        "jobs" to 47,
                        "verified" to true,
                        "badges" to listOf("Moving · 24 jobs", "Has truck"),
                    ),
                "bid" to
                    mapOf(
                        "amount" to 65,
                        "unit" to "flat",
                        "eta" to "Saturday · 9–10 AM",
                        "message" to listOf("Hi!", "Thanks."),
                    ),
                "post" to mapOf("title" to "Sofa move", "category" to "Moving", "bid_count" to 3),
                "other_bids" to
                    listOf(
                        mapOf("who" to "Devon R.", "amount" to 55, "rating" to 4.7, "flag" to "cheapest"),
                        mapOf("who" to "Sasha P.", "amount" to 80, "rating" to 5.0, "flag" to "top-rated"),
                    ),
                "next_steps" to
                    listOf(
                        mapOf("label" to "Bid accepted", "when" to "Just now", "state" to "active"),
                        mapOf("label" to "Marcus confirms", "when" to "Pending", "state" to "pending"),
                    ),
            )
        val resolved = MailboxCategoryPayload.resolve(MailItemCategory.Gig, payload)
        assertTrue(resolved is MailboxCategoryPayload.Gig)
        val gig = (resolved as MailboxCategoryPayload.Gig).detail
        assertFalse(gig.isAccepted)
        assertEquals(65, gig.bid.amount)
        assertEquals(4.9, gig.bidder.rating, 0.001)
        assertEquals(47, gig.bidder.jobs)
        assertEquals("Sofa move", gig.post.title)
        assertEquals(2, gig.otherBids.size)
        assertEquals("cheapest", gig.otherBids[0].flag)
        assertEquals(2, gig.nextSteps.size)
        assertEquals(GigDetailDto.StepState.Active, gig.nextSteps[0].state)
        assertEquals(GigDetailDto.StepState.Pending, gig.nextSteps[1].state)
    }

    @Test fun gig_missing_post_title_falls_back_to_other() {
        val payload =
            mapOf(
                "bidder" to mapOf("name" to "Marcus T."),
                "bid" to mapOf("amount" to 65),
                "post" to mapOf<String, Any?>(),
            )
        assertEquals(
            MailboxCategoryPayload.Other,
            MailboxCategoryPayload.resolve(MailItemCategory.Gig, payload),
        )
    }

    @Test fun gig_accepted_flag_round_trips() {
        val payload =
            mapOf(
                "is_accepted" to true,
                "bidder" to mapOf("name" to "Marcus T."),
                "bid" to mapOf("amount" to 65),
                "post" to mapOf("title" to "Sofa move"),
            )
        val resolved = MailboxCategoryPayload.resolve(MailItemCategory.Gig, payload)
        assertTrue(resolved is MailboxCategoryPayload.Gig)
        assertTrue((resolved as MailboxCategoryPayload.Gig).detail.isAccepted)
    }

    @Test fun non_p18_category_returns_other() {
        val payload = mapOf("anything" to "goes")
        assertEquals(
            MailboxCategoryPayload.Other,
            MailboxCategoryPayload.resolve(MailItemCategory.Bill, payload),
        )
    }
}
