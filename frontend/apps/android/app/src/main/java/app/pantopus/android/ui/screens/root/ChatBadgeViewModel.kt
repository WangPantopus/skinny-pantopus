package app.pantopus.android.ui.screens.root

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.chats.UnifiedConversationsResponse
import app.pantopus.android.data.chats.ChatBadgeCoordinator
import app.pantopus.android.data.chats.ChatConversationPreferences
import app.pantopus.android.data.chats.ChatRepository
import app.pantopus.android.data.chats.ChatUnreadBadgeMath
import app.pantopus.android.data.realtime.SocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch
import org.json.JSONObject
import timber.log.Timber
import javax.inject.Inject

@HiltViewModel
class ChatBadgeViewModel
    @Inject
    constructor(
        private val repo: ChatRepository,
        private val socket: SocketManager,
        private val preferences: ChatConversationPreferences,
        private val badgeCoordinator: ChatBadgeCoordinator,
    ) : ViewModel() {
        private val _unreadMessages = MutableStateFlow(0)
        val unreadMessages: StateFlow<Int> = _unreadMessages.asStateFlow()

        private var serverTotalUnread: Int = 0
        private var serverUnmutedUnread: Int? = null
        private var badgeRevision = 0L
        private var refreshJob: kotlinx.coroutines.Job? = null

        init {
            // A cold start shows the saved list's count at once (Instant Screens); the read below confirms it.
            repo.conversationsCopy()?.let(::show)
            refresh()
            subscribeToSocket()
            subscribeToListSnapshots()
        }

        /**
         * Reads the Messages list through the screens' store (Instant Screens), the same copy the Messages tab
         * shows: one request at launch instead of the list and the stats, and none when the copy is fresh.
         */
        fun refresh() {
            if (refreshJob?.isActive == true) return
            val revision = badgeRevision
            refreshJob =
                viewModelScope.launch {
                    val response =
                        repo.conversationsStored().data ?: run {
                            Timber.w("Chat badge refresh failed: the Messages list is unavailable")
                            return@launch
                        }
                    if (revision == badgeRevision) show(response)
                }
        }

        /** Projects a list reply onto the badge: the list's own unread total, adjusted for muted rows. */
        private fun show(response: UnifiedConversationsResponse) {
            serverTotalUnread = response.totalUnread ?: response.conversations.sumOf { it.totalUnread }
            serverUnmutedUnread = response.totalUnmutedUnread
            val conversations = response.conversations
            val mutedKeys = preferences.mutedKeys()
            val rows =
                conversations.map { dto ->
                    val isRoom = dto.type == "room"
                    val rowId =
                        if (isRoom) {
                            dto.id ?: dto.gigId ?: dto.homeId ?: "room"
                        } else {
                            dto.otherParticipantId ?: "person"
                        }
                    val storageKey =
                        if (isRoom) {
                            ChatConversationPreferences.roomKey(rowId)
                        } else {
                            ChatConversationPreferences.personKey(rowId)
                        }
                    app.pantopus.android.ui.screens.inbox.chat.ConversationRowContent(
                        id = rowId,
                        variant =
                            if (isRoom) {
                                app.pantopus.android.ui.screens.inbox.chat.ConversationRowVariant.Group()
                            } else {
                                app.pantopus.android.ui.screens.inbox.chat.ConversationRowVariant.Dm
                            },
                        displayName = rowId,
                        initials = "?",
                        avatarUrl = null,
                        identityChip = null,
                        verified = false,
                        preview = "",
                        timeLabel = "",
                        unread = dto.totalUnread,
                        pinned = false,
                        topicKinds = emptySet(),
                        storageKey = storageKey,
                        isMuted = dto.notificationsEnabled == false || storageKey in mutedKeys,
                    )
                }
            applyAdjustedUnread(rows)
        }

        private fun subscribeToSocket() {
            viewModelScope.launch {
                socket.eventsOf("badge:update").collect { json ->
                    json.badgeUnreadCount()?.let { total ->
                        badgeRevision++
                        serverTotalUnread = total
                        serverUnmutedUnread = json.badgeUnmutedUnreadCount()
                        applyAdjustedUnread(badgeCoordinator.snapshot.value.rows)
                    }
                }
            }
            viewModelScope.launch {
                var connectedBefore = false
                socket.connectionState
                    .filter { it == SocketManager.ConnectionState.Connected }
                    .collect {
                        // After a reconnect the list may have missed messages (contract §8): read it again. The
                        // first connection follows the launch read, whose copy is still fresh.
                        if (connectedBefore) repo.conversationsChanged()
                        connectedBefore = true
                        refresh()
                    }
            }
        }

        private fun subscribeToListSnapshots() {
            viewModelScope.launch {
                badgeCoordinator.snapshot.collect { snapshot ->
                    if (snapshot.initialized) {
                        badgeRevision++
                        serverTotalUnread = snapshot.serverTotalUnread
                        serverUnmutedUnread = snapshot.serverUnmutedUnread
                        applyAdjustedUnread(snapshot.rows)
                    }
                }
            }
        }

        private fun applyAdjustedUnread(rows: List<app.pantopus.android.ui.screens.inbox.chat.ConversationRowContent>) {
            _unreadMessages.value =
                serverUnmutedUnread?.coerceAtLeast(0) ?: ChatUnreadBadgeMath.adjustedTotal(
                    serverTotal = serverTotalUnread,
                    rows = rows,
                    mutedKeys = preferences.mutedKeys(),
                )
        }
    }

fun JSONObject.badgeUnreadCount(): Int? =
    when {
        has("unread_messages") -> optInt("unread_messages")
        has("unreadMessages") -> optInt("unreadMessages")
        has("total_unread") -> optInt("total_unread")
        has("totalUnread") -> optInt("totalUnread")
        else -> null
    }

fun JSONObject.badgeUnmutedUnreadCount(): Int? =
    when {
        has("unmutedUnreadMessages") && !isNull("unmutedUnreadMessages") -> optInt("unmutedUnreadMessages").coerceAtLeast(0)
        has("totalUnmutedUnread") && !isNull("totalUnmutedUnread") -> optInt("totalUnmutedUnread").coerceAtLeast(0)
        has("total_unmuted_unread") && !isNull("total_unmuted_unread") -> optInt("total_unmuted_unread").coerceAtLeast(0)
        else -> null
    }
