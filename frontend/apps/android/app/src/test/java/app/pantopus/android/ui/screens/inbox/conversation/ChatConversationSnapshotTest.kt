@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.inbox.conversation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
 * Paparazzi snapshots for the T2.2 Chat Conversation: header (person
 * vs AI), AI welcome frame, person empty frame, populated thread with
 * day divider + tail-grouped bubbles + delivery states, composer with
 * + without text.
 */
class ChatConversationSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2200,
                    softButtons = false,
                ),
        )

    private val personCounterparty =
        ChatCounterparty.Person(
            displayName = "Maria K.",
            initials = "MK",
            locality = "Elm Park",
            verified = true,
            online = true,
        )

    private val aiCounterparty = ChatCounterparty.Ai(displayName = "Pantopus AI")

    private val creatorCounterparty =
        ChatCounterparty.Person(
            displayName = ChatConversationSampleData.CREATOR_FAN_NAME,
            initials = "PR",
            locality = "0.4 mi",
            verified = true,
            online = true,
        )

    @Test
    fun chat_conversation_header_person() {
        paparazzi.snapshot {
            Frame { ChatHeader(counterparty = personCounterparty, onBack = {}) }
        }
    }

    @Test
    fun chat_conversation_header_ai() {
        paparazzi.snapshot {
            Frame {
                ChatHeader(
                    counterparty = aiCounterparty,
                    onBack = {},
                    conversationMode = ChatConversationMode.AiAssistant,
                )
            }
        }
    }

    @Test
    fun chat_conversation_header_fan_thread() {
        paparazzi.snapshot {
            Frame {
                ChatHeader(
                    counterparty = ChatConversationSampleData.fanCounterparty,
                    onBack = {},
                    conversationMode = ChatConversationMode.FanThread,
                )
            }
        }
    }

    @Test
    fun chat_conversation_empty_person() {
        paparazzi.snapshot {
            Frame {
                EmptyFrame(
                    counterparty = personCounterparty,
                    aiPrompts = emptyList(),
                    emptyChips =
                        listOf(
                            ChatPromptChip("intro", "Introduce yourself", PantopusIcon.Hand),
                            ChatPromptChip("gig", "Ask about the gig", PantopusIcon.Briefcase),
                            ChatPromptChip("listing", "Share a listing", PantopusIcon.Tag),
                        ),
                    onChipTap = {},
                )
            }
        }
    }

    @Test
    fun chat_conversation_empty_ai_welcome() {
        paparazzi.snapshot {
            Frame {
                EmptyFrame(
                    counterparty = aiCounterparty,
                    aiPrompts =
                        listOf(
                            ChatPromptChip("price", "Price a task", PantopusIcon.Hammer),
                            ChatPromptChip("draft", "Draft a Pulse post", PantopusIcon.Pencil),
                            ChatPromptChip("mail", "Summarize mail", PantopusIcon.Mailbox),
                            ChatPromptChip("neighbor", "Find a neighbor", PantopusIcon.Search),
                        ),
                    emptyChips = emptyList(),
                    onChipTap = {},
                    conversationMode = ChatConversationMode.AiAssistant,
                    onCapabilityTap = {},
                )
            }
        }
    }

    @Test
    fun chat_conversation_empty_fan_thread() {
        paparazzi.snapshot {
            Frame {
                EmptyFrame(
                    counterparty = ChatConversationSampleData.fanCounterparty,
                    aiPrompts = emptyList(),
                    emptyChips = emptyList(),
                    onChipTap = {},
                    conversationMode = ChatConversationMode.FanThread,
                    fanEntitlement = ChatConversationSampleData.fanEntitlement,
                )
            }
        }
    }

    @Test
    fun chat_conversation_ai_active_with_estimate() {
        paparazzi.snapshot {
            Frame {
                PopulatedFrame(
                    rows = ChatConversationSampleData.aiActiveRows,
                    onRetry = {},
                    onLoadOlder = {},
                )
            }
        }
    }

    @Test
    fun chat_conversation_fan_active_with_locked_reply() {
        paparazzi.snapshot {
            Frame {
                PopulatedFrame(
                    rows = ChatConversationSampleData.fanActiveRows,
                    onRetry = {},
                    onLoadOlder = {},
                    conversationMode = ChatConversationMode.FanThread,
                )
            }
        }
    }

    @Test
    fun chat_conversation_fan_upgrade_prompt() {
        paparazzi.snapshot {
            Frame {
                FanTierUpgradePromptSheet(entitlement = ChatConversationSampleData.fanLockedEntitlement)
            }
        }
    }

    @Test
    fun chat_conversation_creator_thread_chrome() {
        paparazzi.snapshot {
            Frame {
                Column(modifier = Modifier.fillMaxSize()) {
                    ChatHeader(
                        counterparty = creatorCounterparty,
                        onBack = {},
                        conversationMode = ChatConversationMode.CreatorThread,
                        creatorContext = ChatConversationSampleData.creatorContext,
                    )
                    CreatorAudienceStrip(
                        context = ChatConversationSampleData.creatorContext,
                        onOpenAudienceProfile = {},
                    )
                    // `quota` is nullable since the live creator path leaves it
                    // unset; the design fixture always carries one, so unwrap it
                    // the same way the screen does.
                    ChatConversationSampleData.creatorContext.quota?.let { quota ->
                        CreatorQuotaMeter(quota = quota)
                    }
                    Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                        PopulatedFrame(
                            rows = ChatConversationSampleData.creatorThreadRows,
                            onRetry = {},
                            onLoadOlder = {},
                        )
                    }
                    Composer(
                        text = "Adding you to the list — first 6 get a slot",
                        placeholder = "Message Priya…",
                        canSend = true,
                        onTextChange = {},
                        onSend = {},
                    )
                }
            }
        }
    }

    /**
     * A15.4 secondary frame — quota exhausted: warning pill, full
     * upgrade-fan card (head / body / perks / actions) and the locked
     * composer with its lock row.
     */
    @Test
    fun chat_conversation_creator_thread_quota_exhausted() {
        val context = ChatConversationSampleData.creatorMaxedContext
        paparazzi.snapshot {
            Frame {
                Column(modifier = Modifier.fillMaxSize()) {
                    CreatorAudienceStrip(context = context, onOpenAudienceProfile = {})
                    context.quota?.let { quota ->
                        CreatorQuotaMeter(quota = quota)
                        CreatorQuotaExhaustedPill(
                            tierName = context.fanTierName,
                            fanName = "Priya",
                            total = quota.total,
                        )
                    }
                    context.upgradeOffer?.let { offer ->
                        CreatorUpgradeFanCard(
                            fanName = "Priya",
                            currentTierName = context.fanTierName,
                            offer = offer,
                            onDismiss = {},
                        )
                    }
                    Box(modifier = Modifier.weight(1f).fillMaxWidth())
                    Composer(
                        text = "",
                        placeholder = "Out of replies until Monday 12:00 AM",
                        canSend = false,
                        isLockedAction = true,
                        onTextChange = {},
                        onSend = {},
                    )
                    CreatorQuotaLockRow(tierName = context.fanTierName, fanName = "Priya")
                }
            }
        }
    }

    @Test
    fun chat_conversation_populated_with_day_divider_and_grouped_bubbles() {
        paparazzi.snapshot {
            Frame {
                PopulatedFrame(rows = populatedRows(), onRetry = {}, onLoadOlder = {})
            }
        }
    }

    @Test
    fun chat_conversation_dm_photo_bubble_with_read_receipt() {
        paparazzi.snapshot {
            Frame {
                DmConversationFrame {
                    PopulatedFrame(
                        rows = ChatConversationSampleData.dmPhotoReadRows,
                        onRetry = {},
                        onLoadOlder = {},
                        incomingInitials = "JT",
                    )
                }
            }
        }
    }

    @Test
    fun chat_conversation_dm_typing_indicator() {
        paparazzi.snapshot {
            Frame {
                DmConversationFrame {
                    PopulatedFrame(
                        rows = ChatConversationSampleData.dmTypingRows,
                        onRetry = {},
                        onLoadOlder = {},
                        incomingInitials = "JT",
                    )
                    TypingIndicator(initials = "JT")
                }
            }
        }
    }

    @Test
    fun chat_conversation_dm_queued_attachments() {
        paparazzi.snapshot {
            Frame {
                DmConversationFrame {
                    PopulatedFrame(
                        rows = ChatConversationSampleData.dmQueuedAttachmentRows,
                        onRetry = {},
                        onLoadOlder = {},
                        incomingInitials = "JT",
                    )
                    AttachmentStripView(
                        attachments = ChatConversationSampleData.queuedAttachments,
                        onRemove = {},
                    )
                }
            }
        }
    }

    @Test
    fun chat_conversation_composer_empty_and_populated() {
        paparazzi.snapshot {
            Frame {
                Column {
                    Composer(
                        text = "",
                        placeholder = "Message Maria…",
                        canSend = false,
                        onTextChange = {},
                        onSend = {},
                    )
                    Composer(
                        text = "Hey Maria, see you at 9.",
                        placeholder = "Message Maria…",
                        canSend = true,
                        onTextChange = {},
                        onSend = {},
                    )
                }
            }
        }
    }

    private fun populatedRows(): List<ChatTimelineRow> =
        listOf(
            ChatTimelineRow.DayDivider(ChatDayDivider(id = "today", label = "Today")),
            // Incoming pair, tail on second
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "m1",
                    side = ChatMessageSide.Incoming,
                    body = ChatBubbleBody.Text("Hey — are you free Saturday morning?"),
                    hasTail = false,
                    stamp = null,
                    deliveryState = null,
                ),
            ),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "m2",
                    side = ChatMessageSide.Incoming,
                    body = ChatBubbleBody.Text("I could use a hand mounting three IKEA shelves."),
                    hasTail = true,
                    stamp = "Maria · 9:48 AM",
                    deliveryState = null,
                    isContinuation = true,
                ),
            ),
            // Outgoing pair, tail + delivered stamp on second
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "m3",
                    side = ChatMessageSide.Outgoing,
                    body = ChatBubbleBody.Text("Yes! I can be over by 9."),
                    hasTail = false,
                    stamp = null,
                    deliveryState = null,
                ),
            ),
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "m4",
                    side = ChatMessageSide.Outgoing,
                    body = ChatBubbleBody.Text("Bringing my drill."),
                    hasTail = true,
                    stamp = "9:51 AM",
                    deliveryState = ChatDeliveryState.Delivered,
                    isContinuation = true,
                ),
            ),
            // System link variant
            ChatTimelineRow.Bubble(
                ChatBubbleContent(
                    id = "m5",
                    side = ChatMessageSide.Incoming,
                    body =
                        ChatBubbleBody.SystemLink(
                            label = "Shared gig ·",
                            sub = "Hang 3 floating shelves",
                            accent = ChatSystemLinkAccent.Primary,
                        ),
                    hasTail = true,
                    stamp = "Maria · 9:52 AM",
                    deliveryState = null,
                ),
            ),
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

    @Composable
    private fun DmConversationFrame(content: @Composable () -> Unit) {
        Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appSurface)) {
            ChatHeader(counterparty = ChatConversationSampleData.dmCounterparty, onBack = {})
            Box(modifier = Modifier.weight(1f).fillMaxSize()) {
                content()
            }
            Composer(
                text = "Deal — see you",
                placeholder = "Message Jamal…",
                canSend = true,
                onTextChange = {},
                onSend = {},
            )
        }
    }
}
