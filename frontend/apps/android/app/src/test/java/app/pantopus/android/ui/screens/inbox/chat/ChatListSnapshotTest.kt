@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.inbox.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
 * Paparazzi snapshots for the T2.1 Chat List: filter tabs (with one
 * unread-badge variant), populated list with all three row variants
 * (AI pinned, DM with identity chip, group), empty state, loading
 * skeleton.
 */
class ChatListSnapshotTest {
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
    fun chat_list_filter_tabs_with_unread_badge() {
        paparazzi.snapshot {
            Frame {
                FilterTabs(
                    active = ChatFilter.All,
                    unreadByFilter = mapOf(ChatFilter.Unread to 3, ChatFilter.Gigs to 1),
                    skeleton = false,
                    onSelect = {},
                )
            }
        }
    }

    @Test
    fun chat_list_populated_with_ai_pinned_dm_and_group() {
        paparazzi.snapshot {
            Frame {
                PopulatedFrame(rows = sampleRows(), onTap = {})
            }
        }
    }

    @Test
    fun chat_list_empty_frame() {
        paparazzi.snapshot {
            Frame { EmptyFrame(onCompose = {}) }
        }
    }

    @Test
    fun chat_list_loading_skeleton() {
        paparazzi.snapshot {
            Frame { LoadingFrame() }
        }
    }

    private fun sampleRows(): List<ConversationRowContent> =
        listOf(
            ConversationRowContent(
                id = "ai_assistant",
                variant = ConversationRowVariant.AiAssistant,
                displayName = "Pantopus AI",
                initials = "AI",
                avatarUrl = null,
                identityChip = null,
                verified = true,
                preview = "Hi! I can help you post tasks, find listings, or summarize mail.",
                timeLabel = "now",
                unread = 0,
                pinned = true,
                topicKinds = emptySet(),
                storageKey = "ai_assistant",
            ),
            ConversationRowContent(
                id = "u1",
                variant = ConversationRowVariant.Dm,
                displayName = "Marcus R.",
                initials = "MR",
                avatarUrl = null,
                identityChip = null,
                verified = true,
                preview = "Can you start at 9?",
                timeLabel = "10:14",
                unread = 2,
                pinned = false,
                topicKinds = setOf("gig"),
                storageKey = "person:u1",
                // First two render as pills; the third collapses to "+1".
                topics =
                    listOf(
                        ConversationRowTopic(title = "Mount shelves", topicType = "task"),
                        ConversationRowTopic(title = "Bookcase", topicType = "listing"),
                        ConversationRowTopic(title = "Garden help", topicType = "task"),
                    ),
            ),
            ConversationRowContent(
                id = "b1",
                variant = ConversationRowVariant.Dm,
                displayName = "Dahlia's Petals",
                initials = "DP",
                avatarUrl = null,
                identityChip = ConversationIdentityChip.Business,
                verified = true,
                preview = "On the porch — should arrive by noon.",
                timeLabel = "9:48",
                unread = 1,
                pinned = false,
                topicKinds = setOf("market"),
                storageKey = "person:b1",
            ),
            ConversationRowContent(
                id = "h1",
                variant = ConversationRowVariant.Dm,
                displayName = "12 Rose Court",
                initials = "RC",
                avatarUrl = null,
                identityChip = ConversationIdentityChip.Home,
                verified = true,
                preview = "Mail delivered: 2 packages.",
                timeLabel = "Mon",
                unread = 0,
                pinned = false,
                topicKinds = emptySet(),
                storageKey = "person:h1",
            ),
            ConversationRowContent(
                id = "g1",
                variant = ConversationRowVariant.Group(extraAvatars = listOf("JT", "EM", "SP"), extraCount = 5),
                displayName = "Rose Court Block",
                initials = "RC",
                avatarUrl = null,
                identityChip = null,
                verified = false,
                preview = "I'll grab the chairs. Anyone bringing ice?",
                timeLabel = "Sun",
                unread = 0,
                pinned = false,
                topicKinds = emptySet(),
                storageKey = "room:g1",
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
            ) { Column { content() } }
        }
    }
}
