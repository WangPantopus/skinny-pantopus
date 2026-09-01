@file:Suppress("PackageNaming", "ReturnCount")

package app.pantopus.android.data.api.models.mailbox.v2

import app.pantopus.android.data.api.models.common.JsonValue

/**
 * Gig-shaped sub-payload decoded from `mail.object_payload` when
 * `mail_type == "gig"` — the A17.6 "bid on your gig" mail body. Like the
 * other V2 category payloads the shape is untyped on the wire (stored as
 * JSON); the DTO is defensive and [decodeFromObjectPayload] returns null
 * unless the bidder name, bid amount, and post title are all present, so
 * the body falls back to the placeholder layout.
 */
data class GigDetailDto(
    val gigId: String? = null,
    val bidId: String? = null,
    /**
     * True once the recipient has accepted this bid — swaps the three-way
     * action row for the next-steps timeline + an "Open thread" CTA.
     */
    val isAccepted: Boolean,
    val bidder: Bidder,
    val bid: Bid,
    val post: Post,
    val otherBids: List<OtherBid>,
    val nextSteps: List<NextStep>,
) {
    /** Optimistic flip into the accepted state when the recipient accepts. */
    fun accepted(): GigDetailDto = copy(isAccepted = true)

    /** The neighbor who placed the bid. */
    data class Bidder(
        val initials: String,
        val name: String,
        val handle: String,
        val blurb: String,
        val rating: Double,
        val jobs: Int,
        val responseTime: String,
        val identityLabel: String,
        val isVerified: Boolean,
        val badges: List<String>,
    )

    /** The bid itself: amount + timing + the bidder's note. */
    data class Bid(
        val amount: Int,
        val unit: String,
        val eta: String,
        val expires: String,
        val message: List<String>,
    )

    /** Summary of the gig being bid on — tappable, opens the gig thread. */
    data class Post(
        val title: String,
        val categoryLabel: String,
        val posted: String,
        val expires: String,
        val budget: String,
        val schedule: String,
        val location: String,
        val details: String,
        val bidCount: Int,
    )

    /** A competing bid surfaced in the comparison strip. */
    data class OtherBid(
        val id: String,
        val who: String,
        val initials: String,
        val amount: Int,
        val rating: Double,
        val jobs: Int,
        val whenText: String,
        val flag: String?,
    )

    /** Lifecycle state of a next-step row in the accepted timeline. */
    enum class StepState { Active, Pending, Upcoming }

    /** One row of the post-acceptance next-steps timeline. */
    data class NextStep(
        val id: String,
        val label: String,
        val whenText: String,
        val state: StepState,
    )

    companion object {
        fun decodeFromObjectPayload(payload: JsonValue?): GigDetailDto? {
            if (payload == null) return null
            val bidderMap = payload["bidder"] as? Map<*, *>
            val bidMap = payload["bid"] as? Map<*, *>
            val postMap = payload["post"] as? Map<*, *>
            val bidder = decodeBidder(bidderMap) ?: return null
            val bid = decodeBid(bidMap) ?: return null
            val post = decodePost(postMap) ?: return null
            val gigId =
                stringCandidate(payload, "gig_id", "gigId", "gig")
                    ?: stringCandidate(postMap.orEmpty(), "id", "gig_id", "gigId")
            val bidId =
                stringCandidate(payload, "bid_id", "bidId", "bid_offer_id")
                    ?: stringCandidate(bidMap.orEmpty(), "id", "bid_id", "bidId")
            return GigDetailDto(
                gigId = gigId,
                bidId = bidId,
                isAccepted = payload["is_accepted"] as? Boolean ?: false,
                bidder = bidder,
                bid = bid,
                post = post,
                otherBids = decodeOtherBids(payload["other_bids"] as? List<*>),
                nextSteps = decodeNextSteps(payload["next_steps"] as? List<*>),
            )
        }

        private fun decodeBidder(map: Map<*, *>?): Bidder? {
            val name = (map?.get("name") as? String)?.takeIf { it.isNotEmpty() } ?: return null
            return Bidder(
                initials = map["initials"] as? String ?: initials(name),
                name = name,
                handle = map["handle"] as? String ?: "",
                blurb = map["blurb"] as? String ?: "",
                rating = (map["rating"] as? Number)?.toDouble() ?: 0.0,
                jobs = (map["jobs"] as? Number)?.toInt() ?: 0,
                responseTime = map["response_time"] as? String ?: "—",
                identityLabel = map["identity"] as? String ?: "Personal",
                isVerified = map["verified"] as? Boolean ?: false,
                badges = (map["badges"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
            )
        }

        private fun decodeBid(map: Map<*, *>?): Bid? {
            val amount = (map?.get("amount") as? Number)?.toInt() ?: return null
            return Bid(
                amount = amount,
                unit = map["unit"] as? String ?: "flat",
                eta = map["eta"] as? String ?: "—",
                expires = map["expires"] as? String ?: "",
                message = (map["message"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
            )
        }

        private fun decodePost(map: Map<*, *>?): Post? {
            val title = (map?.get("title") as? String)?.takeIf { it.isNotEmpty() } ?: return null
            return Post(
                title = title,
                categoryLabel = map["category"] as? String ?: "Gig",
                posted = map["posted"] as? String ?: "",
                expires = map["expires"] as? String ?: "",
                budget = map["budget"] as? String ?: "",
                schedule = map["schedule"] as? String ?: "",
                location = map["where"] as? String ?: "",
                details = map["details"] as? String ?: "",
                bidCount = (map["bid_count"] as? Number)?.toInt() ?: 0,
            )
        }

        private fun decodeOtherBids(list: List<*>?): List<OtherBid> =
            list.orEmpty().mapIndexedNotNull { index, raw ->
                val map = raw as? Map<*, *> ?: return@mapIndexedNotNull null
                val who = map["who"] as? String ?: return@mapIndexedNotNull null
                val amount = (map["amount"] as? Number)?.toInt() ?: return@mapIndexedNotNull null
                OtherBid(
                    id = map["id"] as? String ?: "other-$index",
                    who = who,
                    initials = map["initials"] as? String ?: initials(who),
                    amount = amount,
                    rating = (map["rating"] as? Number)?.toDouble() ?: 0.0,
                    jobs = (map["jobs"] as? Number)?.toInt() ?: 0,
                    whenText = map["when"] as? String ?: "",
                    flag = map["flag"] as? String,
                )
            }

        private fun decodeNextSteps(list: List<*>?): List<NextStep> =
            list.orEmpty().mapIndexedNotNull { index, raw ->
                val map = raw as? Map<*, *> ?: return@mapIndexedNotNull null
                val label = map["label"] as? String ?: return@mapIndexedNotNull null
                NextStep(
                    id = map["id"] as? String ?: "step-$index",
                    label = label,
                    whenText = map["when"] as? String ?: "",
                    state =
                        when (map["state"] as? String) {
                            "active" -> StepState.Active
                            "pending" -> StepState.Pending
                            else -> StepState.Upcoming
                        },
                )
            }

        private fun initials(name: String): String =
            name
                .trim()
                .split(" ")
                .take(2)
                .mapNotNull { it.firstOrNull()?.toString() }
                .joinToString("")
                .uppercase()

        private fun stringCandidate(
            payload: Map<*, *>,
            vararg keys: String,
        ): String? =
            keys.firstNotNullOfOrNull { key ->
                (payload[key] as? String)?.trim()?.takeIf { it.isNotEmpty() }
            }
    }
}
