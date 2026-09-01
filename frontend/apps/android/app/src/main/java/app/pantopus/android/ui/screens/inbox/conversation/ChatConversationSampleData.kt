@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.inbox.conversation

/**
 * Deterministic AI-thread fixtures for previews and the Paparazzi
 * snapshot tests. The AI thread has no backend wiring yet, so these stand
 * in for what the SSE stream will eventually produce.
 */
object ChatConversationSampleData {
    const val AI_NAME = "Pantopus AI"
    const val FAN_PERSONA_NAME = "Wynn B."
    const val CREATOR_FAN_NAME = "Priya R."

    val fanCounterparty =
        ChatCounterparty.Person(
            displayName = FAN_PERSONA_NAME,
            initials = "WB",
            locality = "The Sourdough Diary",
            verified = true,
            online = true,
        )

    val fanEntitlement =
        ChatFanEntitlement(
            currentTier = "Bronze",
            renewsOn = "Apr 12",
            messagesLeft = 3,
            messageLimit = 5,
            resetCopy = "Resets May 1",
        )

    val fanLockedEntitlement =
        ChatFanEntitlement(
            currentTier = "Bronze",
            renewsOn = "Apr 12",
            messagesLeft = 3,
            messageLimit = 5,
            resetCopy = "Resets May 1",
            requiredReplyTier = "Silver",
        )

    /**
     * Design fixture — carries an explicit quota so previews / snapshots still
     * exercise the meter. The live path leaves `quota` null (no creator-side
     * reply allowance exists on the wire yet).
     */
    val creatorContext: ChatCreatorThreadContext =
        ChatCreatorThreadContext(
            personaName = "The Sourdough Diary",
            audienceSummary = "Reach: 2,340 · Engagement up 12% this week",
            fanTierName = "Bronze",
            fanTierRank = 2,
            fanSubtitle = "Member since Aug · 0.4 mi",
            quota = ChatCreatorQuota(used = 12, total = 30, resetCopy = "Resets Monday"),
        )

    /**
     * Shape of a real tier read: name / price / description come straight
     * from `GET /api/personas/:handle/tiers`, perks from that tier's
     * published policy fields.
     */
    val creatorUpgradeOffer =
        ChatCreatorUpgradeOffer(
            tierName = "Gold",
            priceLabel = "$15/mo",
            summary = "Unlimited threads with a same-week reply promise.",
            perks =
                listOf(
                    "Unlimited message threads",
                    "Replies within 3 days",
                    "Creator can start threads",
                ),
            canSendOffer = false,
        )

    /**
     * Quota-exhausted creator thread (A15.4 secondary frame) — the state
     * that renders the exhausted pill, the upgrade card and the locked
     * composer.
     */
    val creatorMaxedContext: ChatCreatorThreadContext =
        ChatCreatorThreadContext(
            personaName = "The Sourdough Diary",
            audienceSummary = "Reach: 2,340 · Engagement up 12% this week",
            fanTierName = "Bronze",
            fanTierRank = 2,
            fanSubtitle = "Member since Aug · 0.4 mi",
            quota = ChatCreatorQuota(used = 5, total = 5, resetCopy = "Resets Monday 12:00 AM"),
            upgradeOffer = creatorUpgradeOffer,
        )

    val dmCounterparty =
        ChatCounterparty.Person(
            displayName = "Jamal T.",
            initials = "JT",
            locality = "Elm Park",
            verified = true,
            online = false,
        )

    val queuedAttachments =
        listOf(
            ChatQueuedAttachment("queued_photo", ChatQueuedAttachmentKind.Image, "shelves.jpg"),
            ChatQueuedAttachment("queued_pdf", ChatQueuedAttachmentKind.Document, "shelf.pdf"),
        )

    /**
     * An active AI thread: a user question followed by a structured AI
     * reply carrying an inline estimate card.
     */
    val aiActiveRows: List<ChatTimelineRow> =
        listOf(
            ChatTimelineRow.DayDivider(ChatDayDivider(id = "today", label = "Today")),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "u1",
                    side = ChatMessageSide.Outgoing,
                    body = ChatBubbleBody.Text("What's a fair price to hang 3 shelves in my living room?"),
                    hasTail = true,
                    stamp = "9:07 AM",
                    deliveryState = ChatDeliveryState.Read,
                ),
            ),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "ai1",
                    side = ChatMessageSide.Incoming,
                    body =
                        ChatBubbleBody.AiReply(
                            text = "For drywall, 3 shelves, ~1.5 hours of work, neighbors in Elm Park are paying:",
                            estimate =
                                ChatEstimate(
                                    amount = "$55–70",
                                    basis = "based on 8 nearby jobs",
                                    confidence = "Medium–High",
                                ),
                        ),
                    hasTail = true,
                    stamp = "9:08 AM",
                    deliveryState = null,
                ),
            ),
        )

    /**
     * A15.5 fan-side persona DM with quota chrome, tier-gated creator
     * reply, and an outgoing paid-support footer.
     */
    val fanActiveRows: List<ChatTimelineRow> =
        listOf(
            ChatTimelineRow.DayDivider(ChatDayDivider(id = "today", label = "Today")),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "fan1",
                    side = ChatMessageSide.Outgoing,
                    body = ChatBubbleBody.Text("Loved this week's loaf — quick question: can I sub bread flour for AP?"),
                    hasTail = true,
                    stamp = "8:51 AM",
                    deliveryState = ChatDeliveryState.Read,
                    sentSupportTier = "Bronze",
                ),
            ),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "creator1",
                    side = ChatMessageSide.Incoming,
                    body = ChatBubbleBody.Text("Short answer — yes, bread flour gives more chew. Drop hydration by about 5g per 100g."),
                    hasTail = true,
                    stamp = "Wynn · 9:03 AM",
                    deliveryState = null,
                ),
            ),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "creator2",
                    side = ChatMessageSide.Incoming,
                    body = ChatBubbleBody.Text("Silver members also get my starter troubleshooting checklist and bake timing notes."),
                    hasTail = true,
                    stamp = "Wynn · 9:04 AM",
                    deliveryState = null,
                    lockedTier = "Silver",
                ),
            ),
        )

    /**
     * Creator-side thread from A15.4: audience chrome, Bronze tier fan,
     * quota meter, and an inline broadcast reference before the fan's
     * workshop follow-up.
     */
    val creatorThreadRows: List<ChatTimelineRow> =
        listOf(
            ChatTimelineRow.DayDivider(ChatDayDivider(id = "today", label = "Today")),
            ChatTimelineRow.BroadcastReference(
                ChatBroadcastReference(
                    id = "workshop-broadcast",
                    title = "Workshop interest list",
                    subtitle = "Sunday bake workshop poll sent to Bronze+ members.",
                    metric = "2,340 reached · engagement up 12%",
                ),
            ),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "creator_m1",
                    side = ChatMessageSide.Incoming,
                    body = ChatBubbleBody.Text("Hi! Loved this week's loaf — quick question: can I sub bread flour for AP?"),
                    hasTail = true,
                    stamp = "Priya · 8:51 AM",
                    deliveryState = null,
                ),
            ),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "creator_m2",
                    side = ChatMessageSide.Outgoing,
                    body = ChatBubbleBody.Text("Yes — bread flour gives more chew. Use 5g less water per 100g."),
                    hasTail = true,
                    stamp = "9:02 AM",
                    deliveryState = ChatDeliveryState.Read,
                ),
            ),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "creator_m3",
                    side = ChatMessageSide.Incoming,
                    body = ChatBubbleBody.Text("Also — would you ever do a hands-on workshop? I'd pay."),
                    hasTail = true,
                    stamp = "Priya · 9:14 AM",
                    deliveryState = null,
                ),
            ),
        )

    val dmPhotoReadRows: List<ChatTimelineRow> =
        listOf(
            ChatTimelineRow.DayDivider(ChatDayDivider(id = "today", label = "Today")),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "m1",
                    side = ChatMessageSide.Incoming,
                    body = ChatBubbleBody.Text("8:30 sharp. I'll grab two."),
                    hasTail = true,
                    stamp = "9:10 AM",
                    deliveryState = null,
                ),
            ),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "m2",
                    side = ChatMessageSide.Outgoing,
                    body = ChatBubbleBody.Text("Deal — see you at the bench."),
                    hasTail = false,
                    stamp = null,
                    deliveryState = null,
                ),
            ),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "m3",
                    side = ChatMessageSide.Outgoing,
                    body = ChatBubbleBody.Text("Snapped a photo of the spot:"),
                    hasTail = false,
                    stamp = null,
                    deliveryState = null,
                    isContinuation = true,
                ),
            ),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "m4",
                    side = ChatMessageSide.Outgoing,
                    body = ChatBubbleBody.Image(url = null),
                    hasTail = true,
                    stamp = "9:14",
                    deliveryState = ChatDeliveryState.Read,
                    isContinuation = true,
                ),
            ),
        )

    val dmTypingRows: List<ChatTimelineRow> =
        listOf(
            ChatTimelineRow.DayDivider(ChatDayDivider(id = "today", label = "Today")),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "m1",
                    side = ChatMessageSide.Incoming,
                    body = ChatBubbleBody.Text("Btw — here's the bakery I keep raving about."),
                    hasTail = true,
                    stamp = "6:42 PM",
                    deliveryState = null,
                ),
            ),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "m2",
                    side = ChatMessageSide.Outgoing,
                    body = ChatBubbleBody.Text("Bookmarked. Sunday morning mission."),
                    hasTail = true,
                    stamp = "6:44 PM",
                    deliveryState = ChatDeliveryState.Read,
                ),
            ),
        )

    val dmQueuedAttachmentRows: List<ChatTimelineRow> =
        listOf(
            ChatTimelineRow.DayDivider(ChatDayDivider(id = "today", label = "Today")),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "m1",
                    side = ChatMessageSide.Incoming,
                    body = ChatBubbleBody.Text("Can you send the shelf photo and measurements?"),
                    hasTail = true,
                    stamp = "9:12 AM",
                    deliveryState = null,
                ),
            ),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "m2",
                    side = ChatMessageSide.Outgoing,
                    body = ChatBubbleBody.Text("Uploading both now."),
                    hasTail = true,
                    stamp = "9:13 AM",
                    deliveryState = ChatDeliveryState.Delivered,
                ),
            ),
        )
}
